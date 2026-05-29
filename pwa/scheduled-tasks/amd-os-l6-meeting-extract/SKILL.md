---
name: amd-os-l6-meeting-extract
description: AMD OS L2 ⑥ MTG サマリ (議事録) 抽出 Cloud routine。routine trigger で起動し、Calendar/Notion/Gmail/Drive/Slack MCP 直叩き → サブスク内 Claude で抽出 → project_meeting_summaries + meeting_notifications upsert。PWA/GAS/Vercel に token 課金LLM cron は作らず、GAS 153 + 074 + 074b-e の業務ロジックだけを inline 移植 (= GAS 完全 bypass、まさ #71)。
---

# AMD OS L2 ⑥ MTG サマリ抽出 (GAS 153 + 074 完全 inline 移植版)

GAS 153 `nav_meeting_pollRecentlyEndedEvents` + GAS 074 `nav_meeting_processOneEvent_` の Phase 3 ロジックを **Claude routine 内に完全 inline 移植** したもの。GAS は完全 bypass (= kill switch のまま死んでて OK、参照すらしない)。

## 設計の要点 (2026-05-25 まさ #71 確定)

- **GAS 完全 bypass**: 旧 dryRun 経由は廃止。Calendar / Notion / Gmail / Drive / Slack へは MCP で直接 access
- **LLM 呼びはサブスク内 Claude (= 私自身)**: Anthropic SDK 不要、scheduled task 内で私が prompt 受けて JSON 生成
- **追加課金ゼロ境界**: PWA / GAS / Vercel から Anthropic・Gemini・OpenAI の従量課金 API を呼ばない。LLM を使うのはこの Claude Cloud routine 内だけ。
- **token 課金LLM cron 禁止**: routine trigger は allowed path。PWA / GAS / Vercel の cron / time trigger は、LLM 非依存の deterministic sync / 通知 / キャッシュ更新なら問題なし。この L2⑥では Gemini 経路の 153 / 152 を復活させない。
- **業務ロジックは GAS 元コード完全保存**: 「終了 60-180 分前 filter」「Stage 1-3 Notion fallback」「source_kinds 判定 (= 30 chars 閾値)」「source_hash 差分検知」「修正依頼織り込み」「議事録なし行のマーカー upsert」を踏襲
- **5 ソース全部見る** (= まさ絶対ルール 2026-05-11): Notion + Gmail + Drive + Slack + Calendar event 本文。GAS 074 + 074b-e の集約をこの 1 routine で実現
- **議事録品質の本丸**: Notion / Gemini / CircleBack 等が既に作った会議本文を潰さず、前後 MTG・PJ 全体の流れ・現行 MS を読んだうえで `narrative_md` に「その MTG に参加していなかったメンバーでも読めば流れが分かる議事録」を残す。
- **配列だけ保存禁止 / 箇条書き禁止**: `source_kinds != "none"` の開催済みMTGでは `narrative_md` が主成果物。`summary_short` / `decided` / `progress` / `next_actions` / `risks` は検索・通知用の補助であり、議事録本文の代替ではない。`narrative_md` が空・短すぎる・箇条書き中心なら、その event は保存せず run summary に `blocked_low_quality_narrative` として残す。
- **既存 narrative 保護**: 既存 row に 300字以上の `narrative_md` がある場合、新しい抽出結果が空 / 箇条書き優勢 / 既存より明らかに薄いなら upsert しない。`project_meeting_summaries` には DB trigger でも保護があるが、routine 側でも必ず判定する。
- **未来予定カード**: 終了済みMTGの議事録がまだ無いPJでも、今後60日の確定Calendar予定を `POST /api/meeting-prep/calendar-sync` に渡して `source_kinds='upcoming'` を作る。CLG取締役会のように前回議事録が空でも予定MTGカードを欠落させない。
- **次MTGカードの境界**: 議事録内に日時まで明確な次MTGがある場合だけ、PWA `POST /api/meeting-workflow/finalize` 経由で `source_kinds='upcoming'` を作る。`6月3週目以降` のような日程未確定候補は自動で確定予定にしない。必要なものは `upcoming_tentative` として「日程調整中MTG」に残す。

## 【絶対】 動く前に必ず Read

1. `pwa/manual/3-2-data-and-extraction.md` (§3.1 取り込み path / §3.2 L2 9 種正本 / §3.4 修正依頼ループ)
2. `pwa/manual/9-1-decisions-and-history.md` (§5.4 責務分担マトリクス / §5.7 L2 ghost 復旧計画)
3. `pwa/design/meeting_summaries.md` (= MTG サマリ仕様正本)
4. `pwa/design/db_schema.md` (= **列名は想像で書かない、必ず grep**)
5. `pwa/design/l2_extract_claude_routine.md` (= 設計議論)
6. `gas/074_MeetingSummaryRepo.js` (= 元実装、source_kinds 判定 / Notion 3 段 fallback / Notion AI transcription block 取得 / Gmail thread filter)
7. `gas/153_MeetingHourlyTrigger.js` (= 元 polling)
8. `gas/079_NameAliasMap.js` (= 名前正規化マップ)

═══════════════════════════════════════════════════
Phase 0: env と calendar の準備
═══════════════════════════════════════════════════

1. cwd を `/Users/masa/projects/AMD/amd-os` に固定
2. `pwa/.env.local` から以下を bash でロード:
   ```bash
   ENV=pwa/.env.local
   SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV" | cut -d= -f2- | tr -d '"')
   SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2- | tr -d '"')
   COLOR_PJ_CONFIG_SPREADSHEET_ID=$(grep '^COLOR_PJ_CONFIG_SPREADSHEET_ID=' "$ENV" | cut -d= -f2- | tr -d '"')
   CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV" | cut -d= -f2- | tr -d '"')
   WORKFLOW_SECRET=$(grep '^WORKFLOW_SECRET=' "$ENV" | cut -d= -f2- | tr -d '"')
   WORKFLOW_SECRET="${WORKFLOW_SECRET:-$CRON_SECRET}"
   ```
3. Calendar `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__list_calendars` で primary calendar を確認 (= 通常まさの primary)。MAIN_CALENDAR_ID を `.env.local` に置く運用にしてないので、毎回 primary を採用。

═══════════════════════════════════════════════════
Phase A: Calendar events 取得 → filter → PJ 判定 (= GAS 153 移植)
═══════════════════════════════════════════════════

4. **時刻計算** (= 現在 JST 起点で過去 3 時間の window):
   - `now` = 現在時刻 (UTC ISO)
   - `queryStart` = now - 240 分 (= 4 時間前、余裕 60 分含む)
   - `queryEnd` = now
   - `winStartMs` = now - 180 分 (= 終了 180 分前)
   - `winEndMs` = now - 60 分 (= 終了 60 分前)
   - **窓**: イベントの `end` datetime が `winStartMs ≦ end < winEndMs` の範囲に入るものだけ処理対象

5. Calendar `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__list_events`:
   - `startTime` = `queryStart` ISO
   - `endTime` = `queryEnd` ISO
   - `pageSize` = 50

6. 各 event について **filter** (= GAS 153 と同じ):
   - `event.start.date` のみで `dateTime` なし (= 全日イベント) → **skip** (= 議事録対象外)
   - `title` が `+` または `＋` 始まり → **skip** (= 候補だが未確定)
   - `title` が空 → **skip**
   - `end.dateTime` を Date に変換 → `winStartMs ≦ ms < winEndMs` 窓外なら **skip**

7. **PJ 判定** (= GAS 153 完全再現。**カレンダー色が第一判定軸 =「色優先」**。まさが運用してる正本シート `CFG_ColorPJHistory` + `CFG_PJAlias` を読む):

   > 🚨 **このステップを削除・簡略化しないこと**。2026-05-29 復旧 — #71 の Claude routine 移植時に、この色→PJ 判定 (CFG_ColorPJHistory) が誤って削除され `project_name` substring match だけに簡略化されていた (= まさ未承認の機能削除事故)。正本仕様は `pwa/manual/3-2-data-and-extraction.md` の「カレンダー色→PJ判定」。色判定は AMD OS の恒久仕様。

   **(a) 設定読み込み** (= 外部スプシ正本を Drive MCP で直読み):
   - `mcp__66e633f8-4f3e-495d-aa3c-4733ce09335f__read_file_content(fileId = COLOR_PJ_CONFIG_SPREADSHEET_ID)` でシート本文 (markdown) を取得
   - 2 つの table をパース:
     - **CFG_ColorPJHistory**: `colorId | startDate | pjCode | note` (= colorId ごとに startDate 昇順の履歴)
     - **CFG_PJAlias**: `alias | pjCode | priority | matchType | note`
   - active PJ 一覧も fetch (pjCode→project_id 解決用):
     ```bash
     curl -s "$SUPABASE_URL/rest/v1/projects?select=project_id,project_name,client_name,status,slack_channel_id,drive_folder_id,report_emails&status=in.(active,sales)" \
       -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
     ```

   **(b) colorId → pjCode (第一軸・色優先)**:
   - event の `colorId` を取る (= 未設定なら primary calendar の default colorId)
   - CFG_ColorPJHistory のうち、その colorId かつ `startDate <= event 開始日(00:00 JST)` の行で **startDate 最大** を採用 → `pjCode`
   - 例: colorId=6 は `2024-01-01→JC`、`2026-05-28→VSX`。2026-05-28 以降の colorId 6 イベントは **pjCode=VSX**

   **(c) title alias → pjCode (第二軸・色で取れない時の補完)**:
   - `(title + ' ' + description + ' ' + location)` を CFG_PJAlias の各 alias に matchType (contains 等) で照合 → priority 最大の pjCode
   - alias hit が `EXCLUDE` の場合は色で pjCode が取れていても **skip** (= 議事録対象外)

   **(d) pjCode → project_id 解決**:
   - `lower(projects.project_name) == lower(pjCode)` の active PJ を優先 (= SX/CX/OQC/ZMP/SE/BWE/CTB/CLG など大半は project_name==code)
   - project_name と一致しない code は既知マップで解決: **VSX → VasculaX (project_id = p26)**
   - `pjCode` が `pNN` 形式なら project_id として直接使う
   - `pjCode` が `AMD` / 空 → **skip_no_pj** (= AMD 全体 MTG、ghost にしない)

   **(e) 最終フォールバック** (= 色も alias も取れない時のみ、旧 text-only ロジック):
   - `(title+desc+loc)` lowercase に対して project_name / project_id / client_name の substring match
   - それでも取れなければ **skip_no_pj**

   - 複数候補は **色 > title 完全一致 alias > substring** の優先順位で 1 つに絞る

8. PJ 紐付けが取れた events を **処理キュー** に積む

### A-2: 未来Calendar予定 → 予定MTGカード同期

終了済みMTGの議事録抽出とは別に、毎回 **今日0:00 JSTから今後60日** の確定Calendar予定を同期する。これは LLM 不要・deterministic で、議事録がまだ無いPJにも準備カードを作るためのルート。今日すでに開始済みの予定も、Drive資料やURL補強のために当日中は同期対象にする。

1. Calendar MCP で `today 00:00 JST` から `now + 60 days` までを bounded search/list する。`title` が `+` / `＋` 始まり、全日予定、start datetime の無い予定は除外。
2. 各 event について、PJ が解決できる場合は **Drive 関連資料も先に探す** (= LLM 不要、準備カード用 metadata):
   - `projects.drive_folder_id` があれば folder root を Drive MCP で list し、event 日付 token (`YYMMDD` / `YYYYMMDD` / `YYYY-MM-DD`) と title token (`取締役会` / `board` / `月次` / `報告会` / `キックオフ` / PJ名 / client_name) でサブフォルダを探す。
   - 日付フォルダが見つかったら、その直下の Docs / Slides / Sheets / PDF / Office files を最大 8 件採用。例: CLG `260527_取締役会` folder の招集通知 PDF・予算xlsx・報告xlsx。
   - 日付フォルダが無い場合だけ、folder root 直下と Drive search で title/date/PJ token を検索する。
   - 各 file は `{title,url,mime_type,modified_time,snippet}` に正規化する。本文 fetch は重ければ不要、snippet はタイトルだけでもよい。raw 本文全文は渡さない。
3. 取得した event metadata を PWA に渡す:
   ```bash
   curl -s -X POST "$APP_BASE_URL/api/meeting-prep/calendar-sync" \
     -H "Authorization: Bearer $WORKFLOW_SECRET" \
     -H "Content-Type: application/json" \
     --data '{"events":[{"calendar_event_id":"<event.id>","title":"<event.summary>","start":"<event.start>","end":"<event.end>","url":"<event.url>","description":"<event.description>","location":"<event.location>","drive_files":[{"title":"<file.title>","url":"<file.url>","mime_type":"<file.mime_type>","modified_time":"<file.modified_time>","snippet":"<short snippet>"}]}]}'
   ```
4. PWA 側で `projects.project_name` / `project_id` / `client_name` によりPJ判定し、`upcoming:<calendar_event_id>` を upsert する。既に手動編集済みの準備本文は上書きせず、Calendar由来の日時・title・URL・Drive資料リンクだけ同期する。
5. これにより、CLG `CLG 取締役会` のような recurring board meeting も、前回MTGサマリからの `finalize` を待たずに「予定MTG / 準備中」に出る。Drive folder に会議資料がある場合は、予定カード内の `関連Drive資料` として先に見える。

═══════════════════════════════════════════════════
Phase B: 各 event について source 取得 + source_kinds 判定 (= GAS 074 移植)
═══════════════════════════════════════════════════

各 event について順に実行 (= 同期、1 件ずつ):

### B-1: Notion 議事録ページ検索 (= GAS 074 `_meeting_findNotionPageByEventId_` Stage 1-3 fallback 移植)

9. **Stage 1**: Notion `notion-search` で **eventId 相当文字列** をクエリに含めて検索:
   - query = `<event.id>`
   - `data_source_url` は議事録 DB の collection URL (= 既知の Notion 議事録 DB を使う想定。後述 ScriptProperties `NOTION_DATABASE_ID` 相当を `.env.local` に追加するか、または毎回 search で十分)
   - ヒットがあれば該当ページ採用 → B-2 へ
10. **Stage 2** (= Stage 1 失敗時): title から ISO datetime / `<mention-date>` / `@今日` / ` HH:MM以降` を除去した **prefix** で再検索:
    - query = `<prefix> <YYYY-MM-DD>` (= event 日も併記)
    - ヒット最大 30 件 → 各ページの `created_time` slice(0,10) で event 日 ±1 日内のものに filter
    - `last_edited_time` desc で 1 件採用
11. **Stage 3** (= Stage 2 失敗時): event 日のみで search:
    - query = `<YYYY-MM-DD>` + 議事録 DB scope
    - 1 件採用
12. すべて失敗なら **notion なし** として `notionText = ""` で続行 (= Gmail / Drive / Slack 拾えるかも)

### B-2: Notion ページ本文取得 (= GAS 074 `_meeting_fetchAiNotesBody_` + `nav_repo_notion_fetchPageBodyText` 移植)

13. ページが取れたら `notion-fetch` で本文取得:
    - id = page URL or UUID
    - 通常 block の本文 + props `内容` rich_text + **AI 議事録 transcription block** (= type=`transcription` の children.summary_block_id + notes_block_id を再帰取得) を取得
    - 3 つを `\n\n` 結合 → `notionText`
    - 上限 ~20000 chars

### B-3: Gmail thread 取得 (= GAS 074 `_meeting_loadGmailCacheForMonth_` + `_meeting_pickRelevantGmailThreads_` 移植)

14. PJ の `report_emails` を取得 (= projects.report_emails の semicolon / comma 区切りリスト)
15. **report_emails が空 PJ** はスキップ (= 該当なし、Gmail なし扱い)
16. Gmail `search_threads` で:
    - 通常MTG: query = `(from:<email1> OR to:<email1> OR from:<email2> OR ...) after:<event 日 -1 日 YYYY/MM/DD> before:<event 日 +2 日 YYYY/MM/DD>`
    - 取締役会 / 株主報告 / 月次報告 / 予算 / 招集通知 / board / monthly を title or project context に含む場合: `after:<event 日 -21 日>` まで広げる。CLGのように招集通知・資料送付が会議の1週間以上前に届くPJを拾うため。
    - pageSize = 20
17. ヒットスレッドそれぞれを `get_thread` (messageFormat=FULL_CONTENT) で本文取得
18. **chitchat 抑制**: bot 配信 (= from に noreply/no-reply/notification@ 含む) は除外
19. 各 thread の subject + message bodies (= 各 message 800 chars × 最大 5 msg、合計 ~4000 chars) を format:
    ```
    --- mail [MM/dd HH:mm] subject: <subject> ---
    <body>
    ```
20. 全 thread 結合 → `gmailText` (= 上限 ~8000 chars)
21. `gmailThreadIds` = ヒットした threadId list

### B-4: Drive 関連資料取得 (= 会議資料・議事録・招集通知・予実表を拾う)

22. PJ の `drive_folder_id` がある場合のみ実行。`drive_folder_id` が空の場合は、Drive を「生データなし」とは扱わず、run summary に `drive_folder_id missing` として残す。
23. **候補 folder 探索**:
    - Drive MCP `list_folder` で root folder (`https://drive.google.com/drive/folders/<drive_folder_id>`) を最大 50 件 list。
    - event 日付 token を作る: `YYMMDD` (= 260527), `YYYYMMDD`, `YYYY-MM-DD`, `M月D日`。
    - title / PJ token を作る: event title から `CLG` / `チャレナジー` / `取締役会` / `board` / `月次` / `報告会` / `キックオフ` / `MTG` / `定例` / `議案` / `資料` などを抽出。
    - folder title が日付 token または title token を含む場合、まずその folder を候補にする。例: CLG root の `260527_取締役会`。
    - 候補 folder がある場合は、その直下を `list_folder` で最大 50 件読む。候補 folder が無い場合だけ root 直下 file と Drive search を使う。
    - 必要なら 1 階層だけ再帰してよい。深掘りしすぎて無関係資料を混ぜない。
24. **Drive search fallback** (= folder list だけで拾えない場合):
    - `query` は短く分割する。例: `CLG 取締役会`, `チャレナジー 取締役会`, `260527 取締役会`, `<project_name> <YYMMDD>`。
    - `special_filter_query_str` が使える場合は `'<drive_folder_id>' in parents and mimeType != 'application/vnd.google-apps.folder'` を基本に、`modifiedTime` は **会議日前後だけに狭めすぎない**。招集通知や取締役会資料は 1 週間以上前に作成されることがある。
25. **採用する file 種別**:
    - Google Docs / Slides / Sheets
    - PDF
    - Office files (`.docx` / `.pptx` / `.xlsx`)
    - text / markdown
    - folder は本文 source にはしない (= folder 内の file を読む)
26. **ranking**:
    - +5: title に event 日付 token
    - +4: title に event title の主要語 (`取締役会`, `報告会`, `キックオフ`, `MTG` など)
    - +3: title に `議事録` / `招集通知` / `議案` / `報告資料` / `予算` / `予実` / `月次`
    - +2: parent folder が event 日付 folder
    - -5: title が明らかに別月・別日
    - score 上位 8 件まで採用。
27. **本文取得**:
    - Docs: `fetch` / `get_document` で text 化。
    - Slides: `get_presentation_text` を優先。重い場合は title + outline text のみ。
    - Sheets / xlsx: `fetch` で text 化できる範囲だけ。大きい workbook は sheet 全体を読まず、file title / sheet names / first visible summary 程度に留める。
    - PDF / Office binary: `fetch` の text extraction が返れば使う。返らない場合でも title / url / mime_type / modified_time を `driveText` に入れ、「本文未抽出」と明記する。
    - 各 file 本文は最大 2000 chars、Drive 全体で最大 12000 chars。
28. `driveText` format:
    ```
    --- drive file: <title> ---
    url: <url>
    mime_type: <mime_type>
    modified_time: <modified_time>
    extraction: <text|metadata_only>
    <extracted text or short metadata note>
    ```
29. **汚染防御**:
    - Drive資料は「会議資料・補助根拠」として扱う。Drive資料に書かれているだけで、当日会議で決定されたとは書かない。
    - `decided` は Notion/Gmail/Slack/発言系 source に明確な決定がある場合を優先。Driveのみの場合は `progress` / `risks` / `next_actions` / `narrative_md` に寄せる。
    - ただし招集通知・議案資料・予実資料のように取締役会の正式資料であることが file title / folder から明確なら、`narrative_md` に「資料上の論点」として反映する。

### B-5: Slack thread 取得 (= GAS 074b 移植、optional)

30. PJ の `slack_channel_id` がある場合のみ:
    - Slack `slack_read_channel` で channel_id = `<slack_channel_id>`、oldest = `<event 日 -1 日 unix秒>.000000`、latest = `<event 日 +2 日 unix秒>.000000`、limit = 50
    - 各 message について thread root (= `thread_ts === ts` or `thread_ts` 不在) で reply_count >= 2 OR parentText >= 200 chars のものだけを対象
    - 候補スレッドそれぞれを `slack_read_thread` で message_ts = `<parent_ts>` で取得 (= 親 + replies)
    - bot メッセージ (= subtype=bot_message / app_id 存在 / user=USLACKBOT) は除外
    - parent + replies の text を結合 (= 各 800 chars 上限) → `slackText`

### B-6: source_kinds 判定 (= GAS 074 と同じ閾値 30 chars)

31. 各 source の文字数:
    - `hasNotion` = `notionText.length >= 30`
    - `hasGmail` = `gmailText.length >= 30`
    - `hasDrive` = `driveText.length >= 30`
    - `hasSlack` = `slackText.length >= 30`
32. **source_kinds 文字列** (= "+ で結合"、GAS 074 / 074b-e と同じ):
    - すべて false → `"none"`
    - 該当した source 名を `notion` / `gmail` / `drive` / `slack` のいずれかで `+` join (= 例: `"notion+gmail+slack"`)

### B-7: source_hash 計算 + 差分検知 (= GAS 074 `_meeting_sha256_` 移植)

33. **combined text** を組み立て:
    ```
    === notion ===
    <notionText>

    === gmail ===
    <gmailText>

    === drive ===
    <driveText>

    === slack ===
    <slackText>
    ```
    (= has* が true の section のみ含める)

34. **alias map + feedback の hash** を combined に混ぜる (= GAS と同じ、feedback 追加で自動再抽出):
    - alias = Phase C-2 で構築 (= members 全件、members.member_name 列が無い場合は member_id + code_name + email local だけ)
    - feedback = Phase C-3 で構築 (= l2_feedbacks の active rows)
    - `fbHashInput` = feedback 各行の `feedback_id + "|" + feedback_text` を `\n` join (= 該当なしなら "")
    - `hashInput` = `"rev=v6_absent_member_narrative\nfb=" + fbHashInput + "\n" + combinedText`
    - **os_context は source_hash に混ぜない**。MS進捗や予定MTGが変わるたびに議事録を再生成すると credit を浪費するため、OS文脈は新規抽出時の品質向上に使い、再生成は source / feedback / prompt revision の変化だけで起こす。
    - `newHash` = bash で計算:
      ```bash
      newHash=$(printf '%s' "$hashInput" | sha256sum | awk '{print $1}')
      ```

35. **既存 row** を Supabase REST で fetch:
    ```bash
    curl -s "$SUPABASE_URL/rest/v1/project_meeting_summaries?meeting_id=eq.<event.id>&select=source_hash,narrative_md,generated_by_model,updated_at&limit=1" \
      -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
    ```
36. 既存 `source_hash == newHash` なら **skip_unchanged** (= LLM 呼ばない、idempotent)
37. 既存 row なしまたは hash 違うなら C へ

### B-8: 議事録なしケース (= source_kinds == "none"、GAS 074 移植)

38. `source_kinds == "none"` のとき:
    - `noneHash` = sha256(`"none|" + meetingDate + "|" + title`)
    - 既存 source_hash == noneHash なら skip
    - そうでなければ **マーカー行** として upsert:
      ```json
      {
        "meeting_id": "<event.id>",
        "project_id": "<projectId>",
        "ym": "<YYYYMM>",
        "meeting_date": "<YYYY-MM-DD>",
        "meeting_start_at": "<event.start.dateTime ISO>",
        "title": "<event.title sanitized>",
        "notion_url": "<notionUrl or null>",
        "notion_page_id": "<notionPageId or null>",
        "calendar_event_id": "<event.id>",
        "gmail_thread_ids": [],
        "source_kinds": "none",
        "summary_short": "議事録なし",
        "decided": [],
        "progress": [],
        "next_actions": [],
        "risks": [],
        "source_hash": "<noneHash>",
        "generated_at": "<ISO now>",
        "generated_by_model": null
      }
      ```
    - upsert:
      ```bash
      curl -s -X POST "$SUPABASE_URL/rest/v1/project_meeting_summaries?on_conflict=meeting_id" \
        -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
        -H "Content-Type: application/json" \
        -H "Prefer: resolution=merge-duplicates,return=minimal" \
        --data "$ROW_JSON"
      ```
    - meeting_notifications には upsert **しない** (= source_kinds=="none" は通知不要)
    - 続く event へ

═══════════════════════════════════════════════════
Phase C: LLM 抽出 (= サブスク内 私自身が JSON 生成)
═══════════════════════════════════════════════════

source_kinds != "none" の event について:

### C-0: OS context block (= まさ #MTGサマリ品質改善)

Supabase から、この会議を PJ 全体の流れに位置づけるための context を取得する。

1. **PJ 本体**
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/projects?project_id=eq.<projectId>&select=project_id,project_name,status,project_category,start_ym,end_ym&limit=1" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
2. **直近の過去 MTG** (= 同 PJ、開催日前、`source_kinds != upcoming`、最大 4 件)
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/project_meeting_summaries?project_id=eq.<projectId>&meeting_date=lt.<YYYY-MM-DD>&source_kinds=neq.upcoming&order=meeting_date.desc&limit=4&select=meeting_id,meeting_date,title,summary_short,decided,progress,next_actions,risks,narrative_md" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
3. **既にある次 MTG / 準備カード** (= `source_kinds=upcoming`、最大 3 件)
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/project_meeting_summaries?project_id=eq.<projectId>&meeting_date=gte.<YYYY-MM-DD>&source_kinds=eq.upcoming&order=meeting_date.asc&limit=3&select=meeting_id,meeting_date,title,summary_short,next_actions,risks,narrative_md,prep_status" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
4. **PWA 手動添付** (= Meet/Gmail 議事録に落ちないスクショ・PDF・画面キャプチャ)
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/meeting_assets?meeting_id=eq.<event.id>&select=asset_id,file_name,media_type,asset_kind,caption,extracted_text,sort_order&order=sort_order.asc,created_at.asc" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
   - 画像そのものが必要な時だけ private Storage `meeting-assets` を signed URL 経由で読む。
   - まずは `caption` / `extracted_text` / `file_name` を context に入れ、未OCRなら `file_name + caption` のみを使う。
5. **現行 plan cycle + MS**
   - `value_plan_cycles`: `project_id=<projectId>` かつ `period_start_ym <= ym <= period_end_ym`、`status in (active,confirmed,fixed,draft)`、最大 1 件
   - `value_milestones`: その `plan_cycle_id` の `is_active=true`、`sort_order asc`、最大 12 件
   - `milestone_monthly_progress`: 上記 `milestone_id` × `ym`

format:
```
=== os_context (AMD OS 側の文脈。今回MTGの意味づけに使う。ここだけを根拠に決定事項を捏造しない) ===
## project
project_id=... / project_name=... / status=... / category=...

## recent_previous_meetings
- YYYY-MM-DD <title>
  summary: ...
  next: ...

## known_next_or_prep_meetings
- YYYY-MM-DD <title>
  summary: ...

## manual_meeting_assets
- <asset_kind> <file_name> (<media_type>)
  caption: ...
  extracted_text: ...

## active_milestones
- <MS title> / points=... / progress=... / criteria=...
```

長文は各項目 200-500 字で truncate。os_context 全体は最大 9000 chars。

### C-1: meeting_meta block

```
=== meeting_meta (これが対象 PJ の唯一の正解。これと無関係な内容は完全に無視) ===
projectId: <projectId>
projectName: <projects.project_name>
meetingTitle: <event.title sanitized>
meetingDate: <YYYY-MM-DD>
meetingId: <event.id>
ym: <YYYYMM>
sourceKinds: <source_kinds>
```

### C-2: alias block (= GAS 079 `nameAlias_buildBlock` 移植)

Supabase REST:
```bash
curl -s "$SUPABASE_URL/rest/v1/members?select=member_id,code_name,email,status&order=member_id" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
```

各 row について:
- `codeName` = members.code_name
- 別表記候補 = email local part (`@` 手前) (= NB: members に member_name 列があれば併用、無ければ skip)
- フォーマット:
  ```
  === 名前の正規化マップ (同一人物の別表記) ===
  [以下は AMD のメンバー一覧。同一人物が異なる表記 (姓 / 名 / 本名 / ローマ字) で
   入力に出てくることがある。LLM は以下のマップに従って **必ず code_name に正規化** して
   抽出すること。例: '山田氏' と書かれていたら 'りょー' と読み替える。'山地' は 'まさ'、
   'chiko' は 'ちこ'。誤って別人として扱わないこと。]

  - まさ = 山地 正洋, 山地, 正洋, masa  (= 同一人物、code_name は 'まさ')
  - ちこ = ... (以下続く)
  ```

### C-3: feedback block (= GAS 155 `_l2_loadFeedbackBlock_` 移植)

```bash
curl -s "$SUPABASE_URL/rest/v1/l2_feedbacks?l2_kind=eq.meeting_summary&target_id=eq.<projectId>&status=eq.active&order=created_at.desc&limit=20&select=feedback_id,scope_key,feedback_text,created_at,created_by" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
```

filter:
- `scope_key == event.id` または `scope_key == "global"` のものに絞る (= GAS と同じ)

フォーマット (= 該当ありなら):
```
=== 過去のユーザーフィードバック (重要・必ず反映すること) ===
  1. [YYYY-MM-DD masa] <feedback_text>
  2. [YYYY-MM-DD masa] <feedback_text>
  ...
```

`feedbackIds` = 上記の feedback_id list

### C-4: 抽出 prompt 生成 + Claude (= 私) が JSON 出力

入力データ:
```
=== meeting_meta ===
<C-1>

<C-0 os_context block>

<C-2 alias block>

<C-3 feedback block (該当ありなら)>

<manual_meeting_assets block (該当ありなら)>

=== combined sources ===
<combinedText>
```

**抽出ルール** (= GAS 074 prompt revision v4_alias_feedback と同じ):
- meeting_meta に書かれた `projectId` / `projectName` 以外の PJ の話題は **完全に無視**
- decided / progress / next_actions / risks は **各 1 文 1 項目**、5W1H 明確、固有名詞は alias map で **code_name に正規化**
- past_feedbacks があれば必ず反映
- summary_short は 80-180 字目安
- 該当事項なし field は `[]`、null / undefined は禁止
- 推測で書かない、combinedText に出てる事実のみ
- os_context は「今回の会議の意味づけ」に使う。前回からの流れ、MSとの関係、次MTGへ持ち越す論点は narrative_md に書く。ただし os_context だけにある内容を「今回決まったこと」にしない
- manual_meeting_assets は画面共有・表・スライドなどの補助根拠。caption / extracted_text がある場合は narrative_md の「添付資料から見えること」に反映してよいが、画像を読めていないのに中身を断定しない
- drive source は会議資料・招集通知・議案・予実表・報告資料として扱う。Drive だけを根拠に「会議で決定した」とは書かず、`資料上の論点` / `会議前に確認すべき資料` / `当日確認された資料` として narrative_md に位置づける。Notion/Gmail/Slack の発言根拠と一致する場合だけ decided に寄せる。
- 雑談 / 個人事情は除外 (= MTG として意味のある合意・進捗・課題だけ)
- narrative_md は必須。900-2200 字を目安に、「なぜこのMTGが必要だったか → 何が議題になったか → 議論がどう動いたか → 何が決まったか / まだ決まっていないか → MSや事業判断への意味 → 次に誰が何をするか → 残課題」を文章でつなぐ markdown。**その場にいなかったメンバーが、前提知識なしでも会議の流れを追える粒度で書く。**
- **narrative_md では箇条書き禁止**。`-` / `*` / `・` / `•` / `1.` で始まる羅列、チェックボックス、配列項目の貼り付けを本文に使わない。必要なら見出しと段落で整理する。Markdown table は、元データに表がある場合だけ許可。
- 元のAI議事録やNotion/Gmail/Drive資料にまとまった本文がある場合は、要点だけに潰さず、読み手が会議の流れを復元できる粒度で narrative_md に残す。`decided` / `progress` / `next_actions` / `risks` は検索・通知用の補助フィールドであり、議事録本文の代替ではない。
- **JSON 以外の文字一切出力禁止** (= markdown ブロックも禁)

**出力形式**:
```json
{
  "summary_short": "<議事録全体を 1-2 文の短いサマリ>",
  "decided": ["<決定事項 1>", "..."],
  "progress": ["<進捗事項 1>", "..."],
  "next_actions": ["<次のアクション (担当者を含める)>", "..."],
  "risks": ["<リスク 1>", "..."],
  "narrative_md": "<欠席メンバーでも流れが分かる、箇条書きではない議事録 narrative 900-2200 字 markdown>"
}
```

═══════════════════════════════════════════════════
Phase D: Supabase upsert + 通知
═══════════════════════════════════════════════════

### D-1: project_meeting_summaries upsert

upsert 前に品質 gate を必ず通す。

- `source_kinds != "none"` なのに `narrative_md` が空、または trim 後 500 字未満なら保存しない。
- `narrative_md` に `-` / `*` / `・` / `•` / `1.` などの箇条書き行や `- [ ]` チェックボックス行が含まれる場合は保存しない。Markdown table の `|` 行と `##` 見出しは許可。
- 既存 row の `narrative_md` が 300 字以上あり、新しい `narrative_md` が空・短い・箇条書きを含むなら保存せず、`skipped_preserve_existing_narrative` として run summary に書く。
- 手動 backfill でもこの gate は同じ。過去議事録を入れる時も `summary_short` と配列だけで `project_meeting_summaries` に直書きしない。

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/project_meeting_summaries?on_conflict=meeting_id" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  --data @<json-file>
```

row 構造:
```json
{
  "meeting_id": "<event.id>",
  "project_id": "<projectId>",
  "ym": "<YYYYMM>",
  "meeting_date": "<YYYY-MM-DD>",
  "meeting_start_at": "<event.start.dateTime ISO>",
  "title": "<event.title sanitized>",
  "notion_url": "<notionUrl or null>",
  "notion_page_id": "<notionPageId or null>",
  "calendar_event_id": "<event.id>",
  "gmail_thread_ids": ["..."],
  "source_kinds": "<source_kinds>",
  "summary_short": "<extracted.summary_short>",
  "decided": [...],
  "progress": [...],
  "next_actions": [...],
  "risks": [...],
  "narrative_md": "<extracted.narrative_md>",
  "source_hash": "<newHash>",
  "generated_at": "<ISO now>",
  "generated_by_model": "anthropic:claude-sonnet-4-7@claude-routine"
}
```

`title` の sanitize (= GAS 074 `_meeting_sanitizeTitle_` 移植):
- ISO 8601 `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*` → `YYYY/MM/DD HH:MM` に置換
- `<mention-date ...>...</mention-date>` 除去
- `@今日...` 除去
- 空白整理

### D-2: meeting_notifications upsert (= iOS APNs 通知)

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/meeting_notifications?on_conflict=meeting_id" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  --data '{"meeting_id":"<event.id>","project_id":"<projectId>","title":"<title>","source_kinds":"<source_kinds>","summary_short":"<extracted.summary_short>"}'
```

(= notified_at は null のまま挿入 → iOS 側 polling が APNs 送信 → notified_at=now() 更新)

### D-3: feedback applied_count++ (= feedbackIds が空でないとき)

各 feedback_id について:
1. 既存 applied_count を取得:
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/l2_feedbacks?feedback_id=eq.<id>&select=applied_count" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
   ```
2. PATCH で `applied_count = (取得値 + 1)` + `last_applied_at = <ISO now>`:
   ```bash
   curl -s -X PATCH "$SUPABASE_URL/rest/v1/l2_feedbacks?feedback_id=eq.<id>" \
     -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
     -H "Content-Type: application/json" \
     -H "Prefer: return=minimal" \
	   --data '{"applied_count":<+1>,"last_applied_at":"<ISO now>"}'
	   ```

### D-4: 次MTGカード生成 (= exact date/time のみ)

保存した議事録 row の `decided` / `next_actions` / `narrative_md` に、`6/11（水）15:00` や `2026-06-11 15:00` のような **日付と時刻が両方ある** 次MTG表現があれば、PWA の deterministic workflow を呼ぶ。

```bash
curl -s -X POST "$APP_BASE_URL/api/meeting-workflow/finalize" \
  -H "Authorization: Bearer $WORKFLOW_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"meeting_id":"<event.id>"}'
```

workflow 側のルール:
- 複数候補があれば最大 6 件まで `project_meeting_summaries` に `source_kinds='upcoming'` で保存する。
- `next_meeting` が明示指定されない限り Google Calendar event は作らない。Calendar は source of truth ではなく、予定カードは OS 上の準備ブリーフとして作る。
- `6月3週目以降`、`日程調整`、`候補日未定` のような曖昧な候補は確定予定として自動保存しない。必要なら `POST /api/meeting-prep` に `is_tentative=true` を渡して `source_kinds='upcoming_tentative'` として仮置き保存する。仮置き row は PWA の「日程調整中MTG」に残る。
- 旧 fallback の「次MTG指定がなければ7日後に1件」は禁止。架空カードを作らない。

═══════════════════════════════════════════════════
Phase E: run summary
═══════════════════════════════════════════════════

ログを集計:
- Phase A: `scanned` / `in_window` / `skipped_excluded` / `skipped_no_pj` / `processed`
- Phase B: source_kinds 別件数 (= notion / notion+gmail / notion+gmail+slack / gmail / drive / slack / none)
- Phase D: `saved` (= 新規 + 更新) / `saved_none` / `skipped_unchanged` / `errors`
- feedback applied 件数

**まさへの 1 行サマリ** (= notifyOnCompletion で表示される):
```
🕐 議事録 routine HH:MM 完了: 過去 60-180 分の MTG を N 件チェック、M 件 saved (= notion+gmail=X, notion=Y, slack=Z), K 件は議事録なし、feedback W 件反映
```

═══════════════════════════════════════════════════
【禁止】
═══════════════════════════════════════════════════

- GAS WebApp 経由で何かを呼ぶ (= dryRun アプローチ廃止、Claude が MCP 直叩き)
- 列名を想像で書く (= 必ず `pwa/design/db_schema.md` を grep してから insert/upsert payload を組む)
- meeting_meta に書かれた `projectId` 以外の PJ の話題を混ぜる (= 汚染防御)
- LLM が「議事録なし」と勝手判定 (= source_kinds 30 chars 閾値で判定済み、その結果に従う)
- 1 event について複数回 upsert
- raw な Notion / Gmail / Drive / Slack 本文を `decided` 等の配列に丸ごとコピペ (= 必ず 1 文 1 項目に分解)
- past_feedbacks を無視 (= まさの修正依頼が反映されない事故防止)
- bot メール / bot Slack メッセージ / 自動配信を抽出対象に含める (= GAS と同じ noise reduction)
- service_role 以外で Supabase を叩く (= anon key は RLS で蹴られる、必ず SUPABASE_SERVICE_ROLE_KEY)
- Calendar `list_events` の `eventTypeFilter` で `outOfOffice` 等の noise type を含める (= default 値で OK)

═══════════════════════════════════════════════════
【参考】
═══════════════════════════════════════════════════

- 既存 GAS の `MEETING_HOURLY_CRON_DISABLED_20260522 = true` は維持 (= GAS 完全 bypass、復活させない)
- 既存 routine `amd-os-management-dialogue-prep` (= daily 07:00 JST) と並列実行されることを想定
- `members` テーブルに `member_name` 列が無い (= 2026-05-25 #71 確認時点)。alias map は code_name + email local part だけで動かす (= GAS 079 想定の member_name 部分は skip)。後で migration で member_name 追加してまさが入れれば自動で alias 充実
- 5/22 〜 5/25 の取り込み穴期間は別 task で backfill (= `--backfill-from 2026-05-22` モード追加 or 一時手動キック routine 別建て)
- Calendar `list_events` MCP の `pageSize` は最大 250、過去 4 時間なら 50 で十分
- Notion `notion-search` の `data_source_url` には議事録 DB の collection URL を指定すると効率的、無くても workspace 全体検索で動く
- Gmail `search_threads` の query 構文は Gmail 標準 (= `after:YYYY/MM/DD`、`OR`、`from:`)
- 議事録 DB ID と PJ DB ID は GAS の ScriptProperties (= `NOTION_DATABASE_ID` / `NOTION_PJ_DATABASE_ID`) から取得していたが、Claude routine からは search の query で動く。固定したい場合は別 task で env 化
