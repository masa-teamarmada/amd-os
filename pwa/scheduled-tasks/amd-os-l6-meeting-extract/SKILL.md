---
name: amd-os-l6-meeting-extract
description: AMD OS H-1 MTGサマリ + MTGフローの repo 正本。現行 writer は Windows MMO PC の Codex Desktop automation `amd-os-l6-meeting-flow` (= 毎日09:00-21:00毎時 + Phase A早期exit)。Calendar/Notion/Gmail/Drive/Slack を読み、subscription 内 Codex で narrative_md + summary arrays を抽出して `project_meeting_summaries` に保存する。PWA/GAS/Vercel に token課金LLM cron は作らず、GAS 153 + 074 + 074b-e の業務ロジックだけを移植する。
---

# AMD OS H-1 MTG サマリ抽出 (GAS 153 + 074 移植版)

GAS 153 `nav_meeting_pollRecentlyEndedEvents` + GAS 074 `nav_meeting_processOneEvent_` の Phase 3 ロジックを **Windows MMO Codex Desktop automation** に移植したもの。GAS は完全 bypass (= kill switch のまま死んでて OK、参照すらしない)。

## 設計の要点 (2026-05-25 まさ #71 確定)

- **GAS 完全 bypass**: 旧 dryRun 経由は廃止。Calendar / Notion / Gmail / Drive / Slack へは MCP で直接 access
- **LLM 呼びは subscription 内 Codex automation**: Anthropic SDK 不要、Codex Desktop automation 内で JSON 生成
- **追加課金ゼロ境界**: PWA / GAS / Vercel から Anthropic・Gemini・OpenAI の従量課金 API を呼ばない。LLM を使うのはこの MMO Codex Desktop automation 内だけ。
- **token 課金LLM cron 禁止**: routine trigger は allowed path。PWA / GAS / Vercel の cron / time trigger は、LLM 非依存の deterministic sync / 通知 / キャッシュ更新なら問題なし。この H-1では Gemini 経路の 153 / 152 を復活させない。
- **業務ロジックは GAS 元コード完全保存**: 「終了 60-180 分前 filter」「Stage 1-3 Notion fallback」「source_kinds 判定 (= 30 chars 閾値)」「source_hash 差分検知」「修正依頼織り込み」「議事録なし行のマーカー upsert」を踏襲
- **5 ソース全部見る** (= まさ絶対ルール 2026-05-11): Notion + Gmail + Drive + Slack + Calendar event 本文。GAS 074 + 074b-e の集約をこの 1 routine で実現
- **議事録品質の本丸**: Notion / Gemini / CircleBack 等が既に作った会議本文を潰さず、前後 MTG・PJ 全体の流れ・現行 MS を読んだうえで `narrative_md` に「その MTG に参加していなかったメンバーでも読めば流れが分かる議事録」を残す。
- **議事録本文の固定順**: `narrative_md` は必ず `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の順で書く。見出し文言・絵文字・順序を変えない。各見出しの本文は箇条書きではなく段落で書く。
- **配列だけ保存禁止 / 箇条書き禁止**: `source_kinds != "none"` の開催済みMTGでは `narrative_md` が主成果物。`summary_short` / `decided` / `progress` / `next_actions` / `risks` は検索・通知用の補助であり、議事録本文の代替ではない。`narrative_md` が空・短すぎる・箇条書き中心なら、その event は保存せず run summary に `blocked_low_quality_narrative` として残す。
- **既存 narrative 保護**: 既存 row に 300字以上の `narrative_md` がある場合、新しい抽出結果が空 / 箇条書き優勢 / 既存より明らかに薄いなら upsert しない。`project_meeting_summaries` には DB trigger でも保護があるが、routine 側でも必ず判定する。
- **H-1 reviewer hook**: 開催済みMTGを保存した後、別automation `amd-os-l6-meeting-reviewer` を走らせる。raw Notion/Gmail/Drive/Slack/Calendar と保存済みH-1要約を比べ、CEO/代表/VC/地元勢/PoC/PRなど重大な経営判断が薄く丸まった疑いがあれば `l2_coverage_gaps` + `l2_notifications(l2_kind='coverage_gap')` に出す。reviewer は H-1 row を自動上書きしない。
- **未来予定カード**: 終了済みMTGの議事録がまだ無いPJでも、今後60日の確定Calendar予定を `POST /api/meeting-prep/calendar-sync` に渡して `source_kinds='upcoming'` を作る。weekly recurring MTG は series ごとに次回1件だけ同期し、それ以降の occurrence はノイズとして送らない/表示しない。CLG取締役会のように前回議事録が空でも予定MTGカードを欠落させない。
- **MTGカード→Calendar一次防御**: MTGカード/議事録側に日時・場所・対面/オンライン・持参物・返信/宿題があるのに Calendar event が無い/薄いケースは、`POST /api/meeting-calendar/upsert-plan` の dry-run で upsert payload と duplicate match を作る。PWA route は Calendar を書かない。実writeに進む場合は別途 reviewed write bundle が必要。payload は `sendUpdates=none`、外部 attendees は空、metadata は `extendedProperties.private` に寄せる。
- **TODO→tasks + owner nudge**: MTGから生まれた担当タスク / OS task / Gmail TODO / Slack TODO は、まず `POST /api/task-calendar/register-tasks` で `tasks` に自動登録し、担当者本人だけへ Slack DM nudge する。admin review queue は作らない。作業枠が必要な場合だけ `POST /api/task-calendar/schedule-plan` の dry-run で、担当メンバー + まさ の共通空き枠に `+<PJコード> <task>` 枠を作る候補にする。PWA route は Calendar を書かない。外部招待/メール送信はしない。
- **次MTGカードの境界**: 議事録内に日時まで明確な次MTGがある場合だけ、PWA `POST /api/meeting-workflow/finalize` 経由で `source_kinds='upcoming'` を作る。`6月3週目以降` のような日程未確定候補は自動で確定予定にしない。必要なものは `upcoming_tentative` として「日程調整中MTG」に残す。
- **Notion eventId は MMO 側で埋める**: Calendar event から Notion 議事録ページを見つけたら、MMO automation は可能な範囲で Notion page の `eventId` / 相当プロパティに Calendar event id を追記する。これは次回以降の冪等性と traceability のためで、PWA/GAS 側ではなく L6 writer 側の責務。
- **eventId 欠損で弾かない**: Notion page に `eventId` が無いのは欠落インシデントとして記録しつつ、必ず title + event date + attendees + Gemini/Drive/Gmail URL で fallback 検索する。`eventId` が無いことだけを理由に `source_kinds='none'` や `skip_no_notion_event_id` にしない。
- **held-source preflight guard**: Calendar event に Gemini/Google Meet notes Doc 添付、Notion fallback hit、Gmail Gemini notes / follow-up がある場合は、既存 `upcoming:<event_id>` があっても開催済み `meeting_id=<event_id>` 候補へ進む。fixture guard は `npm run test:l6-held-source-guard`。これは外部サービスや DB に触らない deterministic test で、飯野さんケース相当 (`Calendar添付Geminiメモ + Notion eventId空 + report_emails空`) を落とさないことを検査する。

## 【絶対】 動く前に必ず Read

1. `pwa/manual/3-2-data-and-extraction.md` (§3.1 取り込み path / §3.2 M/W/D/H L2正本 / §3.4 修正依頼ループ)
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
4. **connector が `event.colorId` / `get_colors` を返さない場合の前段 diagnostic**:
   - `Google Calendar connector` の payload だけで色が見えないときは、待ち続けず `pwa/scripts/l6_calendar_color_diagnostic.mjs` を使う。
   - この helper は既存 PWA Google env (`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REFRESH_TOKEN`、または `GOOGLE_SERVICE_ACCOUNT_JSON` + 必要なら `GOOGLE_SERVICE_ACCOUNT_SUBJECT`) で Calendar API v3 を read-only 実行する。
   - PWA 側 Google env が無い環境では、GAS Advanced Calendar Service の `l6_calendar_color_diagnostic(opts)` を `pwaApi runFunc` から呼ぶ。GAS 側は `gas/188_L6CalendarColorDiagnostic.js` が正本で、既存 `NEXT_PUBLIC_GAS_WEBAPP_URL` + `NEXT_PUBLIC_GAS_API_KEY` を使う。
   - 実行例:
     ```bash
     cd /Users/masa/projects/AMD/amd-os/pwa
     npm run diagnose:l6-calendar-colors -- \
       --calendar-id primary \
       --time-min 2026-06-01T00:00:00+09:00 \
       --time-max 2026-06-03T23:59:59+09:00 \
       --max-results 80
     ```
   - 返すのは `event_id` / `calendar_id` / `summary` / `start` / `end` / 明示 `colorId` / `calendar_default.colorId` / CFG_PJAlias の高信頼候補有無だけ。attendees / description / DB / outbox は触らない。
   - `calendar_default.colorId` は診断情報であり、明示色の代替として自動採用しない。明示 `event.colorId` が無い event でも、CFG_PJAlias の exact / regex / bracketed / ASCII whole-token title alias が high confidence で当たり、`EXCLUDE` / `AMD` でなく、duplicate guard と既存良質サマリ保護を通る場合だけ Live 候補へ進める。単なる substring は review-only で Live 候補にしない。

═══════════════════════════════════════════════════
Phase A: Calendar events 取得 → filter → PJ 判定 (= GAS 153 移植)
═══════════════════════════════════════════════════

5. **時刻計算** (= 現在 JST 起点で過去 3 時間の window):
   - `now` = 現在時刻 (UTC ISO)
   - `queryStart` = now - 240 分 (= 4 時間前、余裕 60 分含む)
   - `queryEnd` = now
   - `winStartMs` = now - 180 分 (= 終了 180 分前)
   - `winEndMs` = now - 60 分 (= 終了 60 分前)
   - **窓**: イベントの `end` datetime が `winStartMs ≦ end < winEndMs` の範囲に入るものだけ処理対象

6. Calendar `mcp__509862f5-b23a-4c45-bf99-9978f6bc4d61__list_events`:
   - `startTime` = `queryStart` ISO
   - `endTime` = `queryEnd` ISO
   - `pageSize` = 50

7. 各 event について **filter** (= GAS 153 と同じ):
   - `event.start.date` のみで `dateTime` なし (= 全日イベント) → **skip** (= 議事録対象外)
   - `title` が `+` または `＋` 始まり → **skip** (= 候補だが未確定)
   - `title` が空 → **skip**
   - `end.dateTime` を Date に変換 → `winStartMs ≦ ms < winEndMs` 窓外なら **skip**

8. **PJ 判定** (= GAS 153 完全再現。**カレンダー色が第一判定軸 =「色優先」**。まさが運用してる正本シート `CFG_ColorPJHistory` + `CFG_PJAlias` を読む):

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
   - event の明示 `colorId` を取る。connector payload で見えない場合は `pwa/scripts/l6_calendar_color_diagnostic.mjs` の Calendar API v3 read-only 結果を使う。
   - `calendar_default.colorId` は診断・設定確認用に読むが、`get_colors` / event payload 不調時の Live write target には使わない。明示 `event.colorId` が無い event は color route では止め、下の CFG_PJAlias high-confidence route へ回す。
   - CFG_ColorPJHistory のうち、その colorId かつ `startDate <= event 開始日(00:00 JST)` の行で **startDate 最大** を採用 → `pjCode`
   - 例: colorId=6 は `2024-01-01→JC`、`2026-05-28→VSX`。2026-05-28 以降の colorId 6 イベントは **pjCode=VSX**

   **(c) title alias → pjCode (第二軸・色で取れない時の補完)**:
   - `(title + ' ' + description + ' ' + location)` を CFG_PJAlias の各 alias に matchType で照合 → priority 最大の pjCode
   - alias hit が `EXCLUDE` の場合は色で pjCode が取れていても **skip** (= 議事録対象外)
   - 明示 `event.colorId` が無い event を Live 候補へ上げてよいのは、CFG_PJAlias の high-confidence hit のみ:
     - `matchType=exact` の title 完全一致
     - `matchType=regex` の明示ルール一致
     - `[ZMP]` / `【ZMP】` / `(ZMP)` 形式など bracketed title alias
     - `ZMP MTG` のような ASCII whole-token title alias
   - `matchType=contains` の単純 substring や project_name / client_name substring は review-only。PJ 候補メモには残してよいが Live write target にはしない。

   **(d) pjCode → project_id 解決**:
   - `lower(projects.project_name) == lower(pjCode)` の active PJ を優先 (= SX/CX/OQC/ZMP/SE/BWE/CTB/CLG など大半は project_name==code)
   - project_name と一致しない code は既知マップで解決: **VSX → VasculaX (project_id = p26)**
   - `pjCode` が `pNN` 形式なら project_id として直接使う
   - `pjCode` が `AMD` / 空 → **skip_no_pj** (= AMD 全体 MTG、ghost にしない)

   **(e) 最終フォールバック** (= 色も alias も取れない時のみ、旧 text-only ロジック):
   - `(title+desc+loc)` lowercase に対して project_name / project_id / client_name の substring match
   - それでも取れなければ **skip_no_pj**

   - 複数候補は **明示色 > CFG_PJAlias high-confidence > review-only substring** の優先順位で 1 つに絞る。Live write は最初の 2 つだけ。

9. PJ 紐付けが取れた events を **処理キュー** に積む

### A-2: 未来Calendar予定 → 予定MTGカード同期

終了済みMTGの議事録抽出とは別に、毎回 **今日0:00 JSTから今後60日** の確定Calendar予定を同期する。これは LLM 不要・deterministic で、議事録がまだ無いPJにも準備カードを作るためのルート。今日すでに開始済みの予定も、Drive資料やURL補強のために当日中は同期対象にする。

1. Calendar MCP で `today 00:00 JST` から `now + 60 days` までを bounded search/list する。`title` が `+` / `＋` 始まり、全日予定、start datetime の無い予定は除外。
   - weekly recurring は `recurringEventId` / `recurring_event_id` が取れる場合はその series id、取れない場合は PJ + title + 曜日 + 開始時刻で series を推定する。
   - 6〜8日間隔で続く weekly series は **次回1件だけ** `calendar-sync` に渡す。複数の weekly がある場合は series ごとに1件ずつ残す。
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
     --data '{"events":[{"calendar_event_id":"<event.id>","recurring_event_id":"<event.recurringEventId if any>","title":"<event.summary>","start":"<event.start>","end":"<event.end>","url":"<event.url>","description":"<event.description>","location":"<event.location>","drive_files":[{"title":"<file.title>","url":"<file.url>","mime_type":"<file.mime_type>","modified_time":"<file.modified_time>","snippet":"<short snippet>"}]}]}'
   ```
4. PWA 側で `projects.project_name` / `project_id` / `client_name` によりPJ判定し、`upcoming:<calendar_event_id>` を upsert する。PWA route も safety net として同じ weekly series の2件目以降を skip する。既に手動編集済みの準備本文は上書きせず、Calendar由来の日時・title・URL・Drive資料リンクだけ同期する。
5. これにより、CLG `CLG 取締役会` のような recurring board meeting も、前回MTGサマリからの `finalize` を待たずに「予定MTG / 準備中」に出る。Drive folder に会議資料がある場合は、予定カード内の `関連Drive資料` として先に見える。

═══════════════════════════════════════════════════
Phase B: 各 event について source 取得 + source_kinds 判定 (= GAS 074 移植)
═══════════════════════════════════════════════════

各 event について順に実行 (= 同期、1 件ずつ):

### B-1: Notion 議事録ページ検索 (= eventId 優先 + title/date fallback)

開催済み候補へ進む前に、connector から取得した短い metadata snapshot がある場合は repo guard を使って preflight する。

```bash
cd /Users/masa/projects/AMD/amd-os/pwa
npm run test:l6-held-source-guard
```

この guard は fixture 用の再発防止だけでなく、同じ入力形 (`projects`, `events`, `upcomingRows`, `notionPages`, `gmailThreads`) を渡せる helper (`scripts/l6_meeting_held_source_guard.cjs`) としても使える。出力に `heldCandidates[]` が出た event は、準備カードだけで終了せず Phase B-D の開催済み upsert へ進める。`prep_source_meeting_id` がある場合は `project_meeting_summaries.prep_source_meeting_id` に入れ、upcoming row 自体は消さない。fallback 紐付けは `confidence` と `needs_review` を run summary に残す。

9. **Stage 1**: Notion `notion-search` で **eventId 相当文字列** をクエリに含めて検索:
   - query = `<event.id>`
   - `data_source_url` は議事録 DB の collection URL (= 既知の Notion 議事録 DB を使う想定。後述 ScriptProperties `NOTION_DATABASE_ID` 相当を `.env.local` に追加するか、または毎回 search で十分)
   - ヒットがあれば該当ページ採用 → B-2 へ
10. **Stage 1b** (= eventId hit 時): 採用した Notion page の `eventId` / 相当プロパティが空なら、MMO automation は可能な範囲で Calendar event id を追記する。書き込みに失敗しても抽出は続け、run summary に `notion_event_id_backfill_failed` と page id / reason を残す。
11. **Stage 2** (= Stage 1 失敗時、または Notion page に eventId が無い時の必須 fallback): title から ISO datetime / `<mention-date>` / `@今日` / ` HH:MM以降` を除去した **prefix** で再検索:
    - query = `<prefix> <YYYY-MM-DD>` (= event 日も併記)
    - ヒット最大 30 件 → 各ページの `created_time` slice(0,10) で event 日 ±1 日内のものに filter
    - `last_edited_time` desc で 1 件採用
    - 採用後、Notion page の `eventId` / 相当プロパティが空なら Calendar event id を追記する。追記できない場合も抽出は続ける。
12. **Stage 3** (= Stage 2 失敗時): event 日のみで search:
    - query = `<YYYY-MM-DD>` + 議事録 DB scope
    - 1 件採用
    - 複数ヒット時は title 類似度、attendees、Calendar/Drive/Gmail URL一致、created/edited time で rank し、曖昧なら Notion source なしとして他 source へ進む。
13. すべて失敗なら **notion なし** として `notionText = ""` で続行 (= Gmail / Drive / Slack 拾えるかも)。`eventId` が無いから失敗扱いにしない。

### B-2: Notion ページ本文取得 (= GAS 074 `_meeting_fetchAiNotesBody_` + `nav_repo_notion_fetchPageBodyText` 移植)

14. ページが取れたら `notion-fetch` で本文取得:
    - id = page URL or UUID
    - 通常 block の本文 + props `内容` rich_text + **AI 議事録 transcription block** (= type=`transcription` の children.summary_block_id + notes_block_id を再帰取得) を取得
    - 3 つを `\n\n` 結合 → `notionText`
    - 上限 ~20000 chars

### B-3: Gmail thread 取得 (= GAS 074 `_meeting_loadGmailCacheForMonth_` + `_meeting_pickRelevantGmailThreads_` 移植)

15. PJ の `report_emails` を取得 (= projects.report_emails の semicolon / comma 区切りリスト)
16. **report_emails が空 PJ** でも Gmail を完全スキップしない。Calendar event title / project_name / client_name / known keywords / Gemini notes sender (`gemini-notes@google.com`) / Meet recording 通知を使って限定検索し、run summary に `report_emails_missing_but_gmail_fallback_used` を残す。
17. Gmail `search_threads` で:
    - `report_emails` がある通常MTG: query = `(from:<email1> OR to:<email1> OR from:<email2> OR ...) after:<event 日 -1 日 YYYY/MM/DD> before:<event 日 +2 日 YYYY/MM/DD>`
    - `report_emails` が空の fallback: query = `("<event title token>" OR "<project_name>" OR "<client_name>") (from:gemini-notes@google.com OR "Gemini によるメモ" OR "meeting notes" OR "議事録") after:<event 日 -1 日> before:<event 日 +2 日>`
    - 取締役会 / 株主報告 / 月次報告 / 予算 / 招集通知 / board / monthly を title or project context に含む場合: `after:<event 日 -21 日>` まで広げる。CLGのように招集通知・資料送付が会議の1週間以上前に届くPJを拾うため。
    - pageSize = 20
18. ヒットスレッドそれぞれを `get_thread` (messageFormat=FULL_CONTENT) で本文取得
19. **chitchat 抑制**: bot 配信 (= from に noreply/no-reply/notification@ 含む) は除外。ただし Gemini notes / Google Meet recording 通知は会議本文 source なので除外しない。
20. 各 thread の subject + message bodies (= 各 message 800 chars × 最大 5 msg、合計 ~4000 chars) を format:
    ```
    --- mail [MM/dd HH:mm] subject: <subject> ---
    <body>
    ```
21. 全 thread 結合 → `gmailText` (= 上限 ~8000 chars)
22. `gmailThreadIds` = ヒットした threadId list

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
    - `hashInput` = `"rev=v7_fixed_heading_narrative\nfb=" + fbHashInput + "\n" + combinedText`
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
- narrative_md は必須。900-2200 字を目安に、**必ず次の Markdown 見出しをこの順で置く**。見出し文言・絵文字・順序を変えず、絵文字と語の間に空白を入れない。各セクション本文は、その場にいなかったメンバーが前提知識なしでも会議の流れを追える粒度の段落で書く。
  - `## 🎯背景`: なぜこのMTGが必要だったか、前提となるPJ状況・相手・直前までの文脈を書く。
  - `## 📊経緯`: 何が議題になり、議論や共有事項がどう動いたか、MSや事業判断への意味も含めて流れを書く。
  - `## ✅決まったこと`: 実際に合意・確認・採択されたことを書く。未決事項やDrive資料だけの推定を決定済みにしない。
  - `## ▶️次の一手`: 次に誰が何をするか、期限・担当・会議候補が分かる範囲で文章にする。
  - `## ⚠️残課題`: 未決・リスク・確認待ち・根拠不足を文章で残す。
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
  "narrative_md": "<## 🎯背景 → ## 📊経緯 → ## ✅決まったこと → ## ▶️次の一手 → ## ⚠️残課題 の固定順で、欠席メンバーでも流れが分かる箇条書きではない議事録 narrative 900-2200 字 markdown>"
}
```

═══════════════════════════════════════════════════
Phase D: Supabase upsert + 通知
═══════════════════════════════════════════════════

### D-1: project_meeting_summaries upsert

upsert 前に品質 gate を必ず通す。

- `source_kinds != "none"` なのに `narrative_md` が空、または trim 後 500 字未満なら保存しない。
- `narrative_md` に `-` / `*` / `・` / `•` / `1.` などの箇条書き行や `- [ ]` チェックボックス行が含まれる場合は保存しない。Markdown table の `|` 行と `##` 見出しは許可。
- `narrative_md` が `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の固定順を満たさない場合は保存しない。表記ゆれ (`## 🎯 背景`、`## 📊経緯・進捗` など) も `blocked_wrong_narrative_headings` として扱う。
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
  "prep_source_meeting_id": "<upcoming:event.id が既存ならその meeting_id / 無ければ null>",
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
Phase P: MTG Prep セッション spawn (= 2026-06-22 追加)
═══════════════════════════════════════════════════

> **役割**: 翌7日の upcoming MTG ごとに、まさカレンダーに `＋ <PJコード> MTG準備: <タイトル>` 枠を作成し、該当時刻になったら `codex exec` で新規 session を spawn する。spawn された session の中では `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` を prompt として読み、prep 本体 (= 文脈ロード / 着地点 draft / 資料 draft / readiness 計算) を完遂する。
>
> automation はあくまで「session を生み出す役」、prep 本体は spawn された session 内で実行する責務分離 (= まさ確定 2026-06-22)。
>
> 詳細仕様: `pwa/spec/3-3-meeting-flow-current-spec.md` の「H-1 MTG Prep セッション自動立ち上げ」節。

### Phase P-1: 対象 MTG 抽出

```sql
SELECT pms.meeting_id, pms.project_id, pms.title,
       pms.meeting_start_at, pms.calendar_event_id,
       pms.prep_worker_status, pms.prep_calendar_event_id,
       pms.prep_worker_session_id, pms.prep_worker_ready_at,
       pms.prep_concierge_nudged_at,
       p.status AS project_status
FROM project_meeting_summaries pms
JOIN projects p USING (project_id)
WHERE pms.source_kinds LIKE '%upcoming%'
  AND pms.source_kinds NOT LIKE '%upcoming_tentative%'
  AND pms.meeting_id NOT LIKE 'upcoming-tentative:%'
  AND pms.meeting_start_at IS NOT NULL
  AND pms.meeting_start_at > now()
  AND pms.meeting_start_at < now() + interval '7 days'
  AND p.status IN ('active', 'sales');
```

ended / frozen / `freeze_from_ym <= 当月ym` は対象外。recurring MTG は既に `calendar-sync` 段階で series 次回1件に絞り込まれている。

### Phase P-2: 各 MTG ごとに処理 (順次)

各対象 MTG について:

**A) ＋ prep 枠 (Calendar event) の作成 or 追従**

- `prep_calendar_event_id` が **null** の場合:
  - 「prep 開始すべき時間帯」を以下で算出:
    - 同シリーズ前回 MTG の `meeting_start_at` の **+1日後 09:00 JST** から、今回 MTG の **24時間前** までの window
    - 過去同シリーズが無い場合は **now** から今回 MTG の 24時間前までの window
  - その window 内でまさの Calendar freebusy を取得し、最初の **30分以上の空き枠** を見つける
  - 所要時間見積: readiness 計算後の見積 (初回はまだ readiness 不明なので **暫定 1.5h**) に応じて枠サイズを決める
  - Calendar に `summary='＋ <PJコード> MTG準備: <MTG タイトル>'`、`description='meeting_id=<id>'`、`extendedProperties.private={'amd_os_prep_meeting_id': '<id>'}` で event を create
  - 作成した event id を `prep_calendar_event_id` に保存
- `prep_calendar_event_id` が **NOT null** の場合 (= 既存):
  - Calendar から event を read
  - event が **削除されてた**ら `prep_calendar_event_id=null` にして当該 H-1 run 内では skip (= 次回 run で再生成)
  - event の `start.dateTime` が変わってた (= まさがドラッグした) ら新 start time を採用
  - 既存 spawn 状態 (`prep_worker_status='ready'` 等) は維持

**B) spawn 判定**

- 現在時刻が `prep_calendar_event_id` の start time に達してるか?
  - 達してない → skip (= 次回 H-1 run まで待つ)
  - 達してる + `prep_worker_status IS NULL or 'failed'` → spawn 実行へ
  - 達してる + `prep_worker_status IN ('preparing', 'ready')` → skip (= 既に spawn 済み or 完了済み)

**C) codex exec で新規 session spawn**

```bash
codex exec --skip-git-repo-check --json \
  --output-last-message /tmp/amd-os-prep-{meeting_id_hash}-out.txt \
  -C /Users/masa/projects/AMD/amd-os \
  "あなたは {MTG タイトル} 専属の prep worker。pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md を読んで、meeting_id={meeting_id} project_id={project_id} で実行。Phase 1-10 完遂後、対話可能な状態で待機する (= 自動で session を閉じない、まさが入ってきたら prep_draft_md を文脈に対話継続)。"
```

- subprocess 起動。終了を await しない (= H-1 はすぐ次の MTG に進む)
- ただし起動直後の最初の数秒は wait して `session id: <UUID>` 行が標準出力に出るのを catch
- catch した UUID を `prep_worker_session_id` に保存
- 同時に upsert: `prep_worker_status='preparing'` + `prep_worker_spawned_at=now()`
- subprocess は background で走り続け、session 内の worker prompt が Phase 1-10 完遂すると `prep_worker_status='ready'` + `prep_worker_ready_at=now()` を自分で upsert する

**D) ready 達成検知**

H-1 run 内で `prep_worker_status='ready'` かつ `prep_concierge_nudged_at IS NULL` の MTG を集める (= 前回以前の run で spawn 済み + 今回 ready になったもの)。これは Phase P-3 で Slack DM 送信対象になる。

### Phase P-3: まさ専用 Slack DM nudge

「ready 達成 + 未通知」MTG が 1件以上あれば、まさ専用 Slack DM を投げる。

1. 送信先解決:
   ```sql
   SELECT slack_id FROM members
   WHERE is_admin = true AND code_name = 'まさ' AND slack_id IS NOT NULL
   LIMIT 1;
   ```
   - 取れない場合は nudge skip + run summary に `nudge_skipped: masa_slack_id_unresolved`
2. つくよみ口調で本文生成 (deterministic template):
   ```
   🌙 まさ、prep セッション立ち上げといたよー

   📌 {MTG タイトル} ({日付} {HH:MM}, {project_name})
      readiness {score}/100  {🟢/🟡/🔴}
      codex で開いてね、待機してるよ
      {readiness < 50 なら 1行コメント: 「資料draftは作ったけど着地点要相談」}

   {failed の MTG があれば別ブロック:}
   ⚠️ {MTG タイトル} ({日付} {HH:MM}, {project_name})
      prep セッション起動失敗 ({reason})
      手動準備して
   ```
3. Slack API でまさ DM に送信 (= unfurl 切る、link なし)
4. 通知に含めた全 MTG (ready / failed) の `prep_concierge_nudged_at=now()` を upsert

### Phase P エラーハンドリング

| 状況 | 対応 |
|---|---|
| Calendar freebusy 取得失敗 | 当該 MTG のみ skip。次回 H-1 run で再試行 |
| Calendar event create 失敗 | `prep_calendar_event_id` セットせず、`prep_worker_status='failed'` + `reason='calendar_create_failed'` upsert |
| `codex exec` 起動失敗 | `prep_worker_status='failed'` + `reason='codex_exec_failed'`、subprocess kill |
| `codex exec` で session id catch できず | `prep_worker_status='failed'` + `reason='session_id_not_captured'`、subprocess kill |
| Slack DM 送信失敗 | `prep_concierge_nudged_at` 触らない (= 次回 run で再送試行) |
| まさ slack_id 解決失敗 | nudge skip、run summary に記録 |

### Phase P 禁止事項

- worker session の subprocess を `wait` しない (= 各 MTG ごとに subprocess を fire-and-forget で起動して次へ)
- 同じ MTG に複数 session を spawn しない (= `prep_worker_status` で防御)
- ended / frozen PJ の MTG に prep 枠を作らない
- recurring MTG の同シリーズで連続 occurrence (= 次回1件 + その後の occurrence) を同時に spawn しない
- まさ以外の Calendar に prep 枠を作らない (= まさ 2026-06-22 確定)
- `claude code` で spawn しない (= まさ 2026-06-22 確定、codex 一本化)
- 定額外トークン課金経路 (= OpenAI API key 等) で worker を spawn しない (= `~/.codex/auth.json` の `auth_mode='chatgpt'` のままにする)
- 通知の link / URL を貼らない (= まさは codex desktop を自分で起動する)

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
