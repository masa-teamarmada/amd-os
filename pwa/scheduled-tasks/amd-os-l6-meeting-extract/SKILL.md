---
name: amd-os-l6-meeting-extract
description: AMD OS L2 ⑥ MTG サマリ (議事録) 抽出 routine。毎時 0 分、Calendar/Notion/Gmail/Drive/Slack MCP 直叩き → サブスク内 Claude で抽出 → project_meeting_summaries + meeting_notifications upsert。GAS 153 + 074 + 074b-e 完全 inline 移植版 (= GAS 完全 bypass、まさ #71)。
---

# AMD OS L2 ⑥ MTG サマリ抽出 (GAS 153 + 074 完全 inline 移植版)

GAS 153 `nav_meeting_pollRecentlyEndedEvents` + GAS 074 `nav_meeting_processOneEvent_` の Phase 3 ロジックを **Claude routine 内に完全 inline 移植** したもの。GAS は完全 bypass (= kill switch のまま死んでて OK、参照すらしない)。

## 設計の要点 (2026-05-25 まさ #71 確定)

- **GAS 完全 bypass**: 旧 dryRun 経由は廃止。Calendar / Notion / Gmail / Drive / Slack へは MCP で直接 access
- **LLM 呼びはサブスク内 Claude (= 私自身)**: Anthropic SDK 不要、scheduled task 内で私が prompt 受けて JSON 生成
- **業務ロジックは GAS 元コード完全保存**: 「終了 60-180 分前 filter」「Stage 1-3 Notion fallback」「source_kinds 判定 (= 30 chars 閾値)」「source_hash 差分検知」「修正依頼織り込み」「議事録なし行のマーカー upsert」を踏襲
- **5 ソース全部見る** (= まさ絶対ルール 2026-05-11): Notion + Gmail + Drive + Slack + Calendar event 本文。GAS 074 + 074b-e の集約をこの 1 routine で実現

## 【絶対】 動く前に必ず Read

1. `pwa/manual/03-data-and-extraction.md` (§3.1 取り込み path / §3.2 L2 9 種正本 / §3.4 修正依頼ループ)
2. `pwa/manual/05-decisions-and-history.md` (§5.4 責務分担マトリクス / §5.7 L2 ghost 復旧計画)
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

7. **PJ 判定** (= GAS 153 + 074d の単純 alias マッチ移植、外部スプシ CFG は使わない):
   - Supabase REST で `projects` を fetch:
     ```bash
     curl -s "$SUPABASE_URL/rest/v1/projects?select=project_id,project_name,client_name,status,slack_channel_id,drive_folder_id,report_emails&status=in.(active,sales)" \
       -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
     ```
   - 各 event の `(title + ' ' + description + ' ' + location)` を lowercase 化
   - 各 PJ について `project_name` (lowercase) を **substring match**
   - 加えて `project_id` 文字列 (= "p06", "p21" 等) も substring match
   - 加えて `client_name` (lowercase) も substring match
   - マッチした PJ がなければ **skip_no_pj** としてカウント (= 議事録対象外、AMD 全体 MTG として skip、ghost にしない)
   - マッチが複数あれば最も具体的なもの 1 つ (= project_name 完全一致 > project_id > client_name の優先順位)

8. PJ 紐付けが取れた events を **処理キュー** に積む

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
    - query = `(from:<email1> OR to:<email1> OR from:<email2> OR ...) after:<event 日 -1 日 YYYY/MM/DD> before:<event 日 +2 日 YYYY/MM/DD>`
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

### B-4: Drive 議事録ファイル取得 (= GAS 074c 移植、optional)

22. PJ の `drive_folder_id` がある場合のみ:
    - Drive `search_files` で query = `'<drive_folder_id>' in parents and modifiedTime > '<event 日 -1 日 ISO>' and modifiedTime < '<event 日 +2 日 ISO>' and (title contains '議事録' or title contains 'meeting' or title contains 'MTG' or title contains '定例' or title contains '打合せ' or title contains '報告会' or title contains 'kickoff') and mimeType = 'application/vnd.google-apps.document'`
    - ヒットファイルそれぞれを `read_file_content` で本文取得 (= 最大 ~16000 chars)
    - 結合 → `driveText`

### B-5: Slack thread 取得 (= GAS 074b 移植、optional)

23. PJ の `slack_channel_id` がある場合のみ:
    - Slack `slack_read_channel` で channel_id = `<slack_channel_id>`、oldest = `<event 日 -1 日 unix秒>.000000`、latest = `<event 日 +2 日 unix秒>.000000`、limit = 50
    - 各 message について thread root (= `thread_ts === ts` or `thread_ts` 不在) で reply_count >= 2 OR parentText >= 200 chars のものだけを対象
    - 候補スレッドそれぞれを `slack_read_thread` で message_ts = `<parent_ts>` で取得 (= 親 + replies)
    - bot メッセージ (= subtype=bot_message / app_id 存在 / user=USLACKBOT) は除外
    - parent + replies の text を結合 (= 各 800 chars 上限) → `slackText`

### B-6: source_kinds 判定 (= GAS 074 と同じ閾値 30 chars)

24. 各 source の文字数:
    - `hasNotion` = `notionText.length >= 30`
    - `hasGmail` = `gmailText.length >= 30`
    - `hasDrive` = `driveText.length >= 30`
    - `hasSlack` = `slackText.length >= 30`
25. **source_kinds 文字列** (= "+ で結合"、GAS 074 / 074b-e と同じ):
    - すべて false → `"none"`
    - 該当した source 名を `notion` / `gmail` / `drive` / `slack` のいずれかで `+` join (= 例: `"notion+gmail+slack"`)

### B-7: source_hash 計算 + 差分検知 (= GAS 074 `_meeting_sha256_` 移植)

26. **combined text** を組み立て:
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

27. **alias map + feedback の hash** を combined に混ぜる (= GAS と同じ、feedback 追加で自動再抽出):
    - alias = Phase C-2 で構築 (= members 全件、members.member_name 列が無い場合は member_id + code_name + email local だけ)
    - feedback = Phase C-3 で構築 (= l2_feedbacks の active rows)
    - `fbHashInput` = feedback 各行の `feedback_id + "|" + feedback_text` を `\n` join (= 該当なしなら "")
    - `hashInput` = `"rev=v4_alias_feedback\nfb=" + fbHashInput + "\n" + combinedText`
    - `newHash` = bash で計算:
      ```bash
      newHash=$(printf '%s' "$hashInput" | sha256sum | awk '{print $1}')
      ```

28. **既存 row** を Supabase REST で fetch:
    ```bash
    curl -s "$SUPABASE_URL/rest/v1/project_meeting_summaries?meeting_id=eq.<event.id>&select=source_hash&limit=1" \
      -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
    ```
29. 既存 `source_hash == newHash` なら **skip_unchanged** (= LLM 呼ばない、idempotent)
30. 既存 row なしまたは hash 違うなら C へ

### B-8: 議事録なしケース (= source_kinds == "none"、GAS 074 移植)

31. `source_kinds == "none"` のとき:
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

<C-2 alias block>

<C-3 feedback block (該当ありなら)>

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
- 雑談 / 個人事情は除外 (= MTG として意味のある合意・進捗・課題だけ)
- narrative_md は 500-1500 字、「背景 → 進捗 → 決定 → 次の一手 → 残課題」の markdown
- **JSON 以外の文字一切出力禁止** (= markdown ブロックも禁)

**出力形式**:
```json
{
  "summary_short": "<議事録全体を 1-2 文の短いサマリ>",
  "decided": ["<決定事項 1>", "..."],
  "progress": ["<進捗事項 1>", "..."],
  "next_actions": ["<次のアクション (担当者を含める)>", "..."],
  "risks": ["<リスク 1>", "..."],
  "narrative_md": "<議事録 narrative 500-1500 字 markdown>"
}
```

═══════════════════════════════════════════════════
Phase D: Supabase upsert + 通知
═══════════════════════════════════════════════════

### D-1: project_meeting_summaries upsert

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