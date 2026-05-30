# L2⑥ Meeting Flow 仕様

> **この章は何か**: L2 ⑥ `project_meeting_summaries` / `meeting_assets` / `meeting_notifications` と、予定MTGカード、開催済み議事録、会議後 workflow、添付資料、TODO/nudge 連携を、現行 writer で再構築するための確定仕様。運用者向けの入口は `/manual/3-2-data-and-extraction` と `/manual/8-3-l2-extraction-routines-spec`、設計履歴は `/design/meeting_summaries.md` に残す。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| L2 | ⑥ MTGサマリ + Meeting Flow |
| primary writer | Windows MMO PC の Codex Desktop automation `amd-os-l6-meeting-flow` |
| schedule | 毎日 09:00-21:00 JST、毎時 0 分。土日も同じ。 |
| early exit | Phase A で開催済み対象 event が 0 件なら Phase B 以降を実行せず 1 行 summary で終了する。A-2 予定MTG同期は別の deterministic sync として実行できる。 |
| repo skill | `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` |
| LLM authority | subscription 内 Codex Desktop automation。PWA / GAS / Vercel route から Anthropic / Gemini / OpenAI の従量課金 LLM cron を作らない。 |
| PWA deterministic routes | `/api/meeting-prep/calendar-sync`, `/api/meeting-prep`, `/api/meeting-workflow/finalize`, `/api/meeting-assets` |
| old GAS status | `gas/153_MeetingHourlyTrigger.js` は `MEETING_HOURLY_CRON_DISABLED_20260522 = true`。`gas/074_MeetingSummaryRepo.js` と `074b-e` は移植元参照。定期 writer として復活禁止。 |
| repo外状態 | MMO automation の登録状態 / run log はこの repo だけでは確認できない。復旧時は MMO PC 側 Codex Desktop automation UI / 履歴を別途確認する。 |

### 実装済み / Partial / 構想の境界

| 領域 | 現状 | 根拠 |
|---|---|---|
| 開催済み議事録抽出 | 実装済みの正本は SKILL。repo 内には旧 GAS と guard がある | `amd-os-l6-meeting-extract/SKILL.md`, `gas/153`, `gas/074`, `l6_meeting_held_source_guard.cjs` |
| 未来予定MTGカード同期 | PWA route 実装済み。Calendar / Drive 読み取りは automation 側責務 | `calendar-sync/route.ts` |
| 手動予定MTG / tentative row | PWA route 実装済み | `meeting-prep/route.ts` |
| 会議後 finalize | PWA route 実装済み。ただし LLM なし・日付時刻が明確な次MTGだけ | `meeting-workflow/finalize/route.ts` |
| 添付資料アップロード / Markdown挿入 | PWA route 実装済み | `meeting-assets/route.ts`, `insert-markdown/route.ts`, `file/[assetId]/route.ts` |
| Calendar作業枠 / Drive資料draft / Gmail follow-up draft | SKILL 上の L6 automation 仕様。PWA route には Gmail draft / Drive draft 生成 route は未実装 | SKILL Phase H/I/J |
| cockpit TODO | `meeting_action_items` + `app_notifications` は finalize 実装済み。`tsukuyomi_nudge_queue` は schema があるが、この route の主出力ではない | `finalize/route.ts`, `db_schema.md` |

## End-to-end Flow

### Phase A: Calendar event 取得 / filter / PJ判定

1. MMO automation は Google Calendar MCP で primary calendar を確認する。`MAIN_CALENDAR_ID` は `.env.local` 固定ではなく、通常は primary を採用する。
2. 開催済み抽出窓は現在時刻 JST/UTC ISO 起点で、取得範囲 `now - 240min` から `now`、処理対象は event `end` が `now - 180min <= end < now - 60min` に入るもの。
3. skip 条件:
   - `event.start.date` のみで `dateTime` がない全日 event
   - title 空
   - title が `+` または `＋` 始まり
   - end datetime がない、または処理窓外
   - alias が `EXCLUDE`
   - PJ が `AMD` / 空 / 解決不能
4. PJ 判定は必ず `CFG_ColorPJHistory` の色判定を第一軸にする。詳細は「PJ判定 Contract」。
5. 対象 event がなければ heavy source collection / LLM / DB upsert を行わない。

### Phase A-2: 未来予定MTGカード同期

1. 開催済み抽出とは別に、今日 00:00 JST から `now + 60 days` までの確定Calendar予定を同期する。
2. automation は Calendar MCP で event metadata を読み、title `+` / `＋`、全日予定、start datetime なしを除外する。
3. weekly recurring は `recurringEventId` があればそれを series key にし、なければ PJ + normalized title + 曜日 + 開始時刻 + location で推定する。6-8日間隔の weekly series は次回1件だけを `calendar-sync` に渡す。
4. automation は `projects.drive_folder_id` がある PJ について、会議日 token (`YYMMDD`, `YYYYMMDD`, `YYYY-MM-DD`, `M月D日`) と title token (`取締役会`, `board`, `月次`, `報告会`, `キックオフ`, `MTG`, PJ名, client_name) で Drive root と1階層サブフォルダを探す。
5. Drive file は Docs / Slides / Sheets / PDF / Office / text を最大8件程度、`{title,url,mime_type,modified_time,snippet}` に正規化して PWA route へ渡す。PWA route は Drive を直接読まない。
6. `POST /api/meeting-prep/calendar-sync` が `meeting_id='upcoming:<calendar_event_id>'`, `source_kinds='upcoming'` の row を upsert する。
7. 既存 row の `generated_by_model` が `calendar-future-sync` 以外なら、手動編集済み本文として `summary_short` / arrays / `narrative_md` は上書きせず、Calendar由来の日時・title・URL・hashのみ同期する。

### Phase B: source取得

開催済み候補ごとに、5生データと PWA 添付を読む。`source_cache` だけで no-data 判定しない。

| source | contract |
|---|---|
| Calendar | event title, description, location, start/end, attendees, attachments, conference notes, Google Docs links。description 30 chars 以上は `calendar` source として guard で扱える。 |
| Notion | Stage 1 eventId exact、Stage 2 title prefix + event date、Stage 3 event date search。eventId 欠損だけで skip しない。該当 page が取れたら可能な範囲で `eventId` / 相当プロパティを backfill する。 |
| Gmail | `projects.report_emails` があれば from/to query。空でも Gemini notes sender / event title / project_name / client_name / attendee context で fallback search する。 |
| Drive | `projects.drive_folder_id` があれば root, date/title subfolder, Drive search fallback。Drive資料は補助根拠であり、Driveだけで「決定済み」にしない。 |
| Slack | `projects.slack_channel_id` があれば event日前後の channel thread を読む。thread root + replies を取得し、bot noise を除く。 |
| PWA `meeting_assets` | `meeting_id=<event.id>` の `caption`, `extracted_text`, `file_name`, `asset_kind` を OS context に入れる。画像そのものが必要な場合だけ private Storage signed URL を使う。 |
| existing OS context | 同 PJ の過去MTG、既存 upcoming row、monthly/MS context、active milestones、feedback、members alias map。 |

### Phase C: LLM narrative生成 / quality gate

1. `source_kinds != 'none'` の event だけ LLM narrative へ進む。
2. combined sources は source ごとに section を分ける。`source_hash` は prompt revision + active feedback hash + combined source text から sha256 する。OS context は `source_hash` に混ぜない。
3. LLM prompt には `meeting_meta`, `os_context`, alias map, active feedback, manual assets, combined sources を入れる。
4. 出力は JSON のみ。`summary_short`, `decided`, `progress`, `next_actions`, `risks`, `narrative_md` を返す。
5. `narrative_md` は必須で、次の見出し・順序・表記を固定する。

```md
## 🎯背景
## 📊経緯
## ✅決まったこと
## ▶️次の一手
## ⚠️残課題
```

6. 各見出し本文は段落で書く。`-`, `*`, `・`, `•`, `1.`, checkbox で始まる羅列は開催済み議事録本文として保存しない。Markdown table は元データに表がある場合だけ許可。
7. `source_kinds != 'none'` なのに `narrative_md` が空、500字未満、見出し違い、箇条書き優勢なら保存せず `blocked_low_quality_narrative` / `blocked_wrong_narrative_headings` として run summary に残す。
8. 既存 row に 300字以上の rich `narrative_md` がある場合、新しい narrative が空・短い・箇条書き中心なら上書きしない。DB trigger `pms_preserve_rich_narrative` も保護するが、routine 側でも判定する。

### Phase D: Supabase保存 / 通知

| case | write |
|---|---|
| `source_kinds='none'` | `project_meeting_summaries` に marker row を upsert。`summary_short='議事録なし'`, arrays `[]`, `generated_by_model=null`。`meeting_notifications` は作らない。 |
| held with source | `project_meeting_summaries` に開催済み row を upsert。`meeting_id=<calendar_event_id>`。既存 upcoming があれば `prep_source_meeting_id='upcoming:<calendar_event_id>'`。 |
| held notification | `meeting_notifications` に `meeting_id`, `project_id`, `title`, `source_kinds`, `summary_short` を upsert。`notified_at` は null のまま iOS 互換 polling に渡す。 |
| feedback applied | 反映した `l2_feedbacks` は `applied_count += 1`, `last_applied_at=now()`。 |
| exact next MTG | `POST /api/meeting-workflow/finalize` を呼べる。ただし exact date/time の候補だけ。曖昧候補は `upcoming_tentative` へ手動/別 route で仮置き。 |

### Phase E以降: TODO / cockpit / 作業枠 / 資料draft / Gmail draft

| phase | current behavior |
|---|---|
| finalize next MTG | PWA `finalize` は明示 `next_meeting.meeting_start_at` または議事録中の exact date/time 表現から最大6件の `source_kinds='upcoming'` row を作る。明示 `create_calendar=true` の場合だけ GAS pwaApi `nav_meeting_createCalendarEventForPrep_` を呼ぶ。 |
| action items | primary prep row がある場合、開催済み row の `next_actions` から `meeting_action_items` を作る。owner は action 文中の `members.code_name` で推定。 |
| Slack / app nudge | `SLACK_BOT_TOKEN` があれば DM / scheduleMessage。`app_notifications.kind='meeting_action'` も insert する。 |
| facilitator nudge | `facilitator_member_id` がある prep row で、前日Slack DMを schedule/post し、prep row の `facilitator_nudge_scheduled_at` / `facilitator_slack_scheduled_message_id` を更新する。 |
| Calendar作業枠 | SKILL Phase H では freebusy を見て `+<PJ>` prefix 枠を作る仕様。現行 PWA `finalize` route は TODO作業枠を作らない。 |
| Drive資料draft | SKILL Phase I 仕様。PWA route は資料draft作成 route を持たない。前提不足なら生成しない。 |
| Gmail draft | SKILL Phase J 仕様。Gmail本送信は禁止。draft 止まり。PWA route は Gmail draft 作成 route を持たない。 |

## Input Contract

### Calendar

| field | required | use |
|---|---|---|
| `id` / `calendar_event_id` | yes | 開催済み `meeting_id`、予定 row `upcoming:<id>`、idempotency |
| `summary` / `title` | yes | filter, PJ alias, card title |
| `start.dateTime` | held/upcoming yes | all-day exclusion, `meeting_start_at`, `meeting_date` |
| `end.dateTime` | held yes | 60-180分終了 window |
| `colorId` | PJ判定で重要 | `CFG_ColorPJHistory` |
| `description`, `location` | optional | alias / source / context |
| `attendees` | optional | Notion/Gmail fallback confidence |
| `attachments`, `conference_notes`, Docs links | optional | held-source guard、Drive source refs |
| `recurringEventId`, `recurrence` | upcoming sync | weekly next-one-only rule |

### Notion

| item | contract |
|---|---|
| search stage | eventId exact -> title prefix + date -> date search |
| body | normal blocks + props `内容` + AI transcription block children |
| backfill | page property `eventId` / PJ relation / date を可能な範囲で補完。失敗しても non-fatal |
| failure | `eventId` missing は failure ではなく fallback 対象。Notion なしでも Gmail/Drive/Slack/Calendar で続行 |

### Gmail

| item | contract |
|---|---|
| normal query | `projects.report_emails` の from/to と event日前後 |
| fallback query | report_emails 空でも event title / project / client / Gemini notes / Google Meet / follow-up 文脈で限定検索 |
| extended window | board/月次/招集通知/予算などは event日 -21日まで広げる |
| noise | noreply/no-reply/notification は除外。ただし Gemini notes / Meet recording 通知は source として残す |
| output | threadId list + subject/body excerpt。raw全文を L2 row に保存しない |

### Drive

| item | contract |
|---|---|
| root | `projects.drive_folder_id` がある時のみ folder list |
| folder search | date token + title token。1階層まで。深掘りしすぎない |
| file types | Google Docs/Slides/Sheets, PDF, Office, text/markdown |
| body limit | fileごと約2000 chars、Drive全体約12000 chars。binaryは metadata_only でも source として残す |
| contamination guard | Driveだけで `decided` にしない。資料上の論点 / 確認事項 / risk に寄せる |

### Slack

| item | contract |
|---|---|
| channel | `projects.slack_channel_id` |
| time window | event日 -1日から +2日 |
| thread | root reply_count >= 2 または parentText >= 200 chars を優先 |
| noise | bot_message / app_id / USLACKBOT を除外 |
| output | parent + replies excerpt。raw全文保存禁止 |

### PWA `meeting_assets`

| item | contract |
|---|---|
| upload | admin session only。PNG/JPG/WebP/GIF/PDF、25MB以下 |
| storage | private Supabase Storage bucket `meeting-assets` |
| DB | `meeting_assets` row。`storage_path` unique |
| display | `/api/meeting-assets/file/{asset_id}` が admin session で 60s signed URL へ redirect |
| narrative insert | `<!-- meeting-assets:start -->` / `<!-- meeting-assets:end -->` block を `narrative_md` に挿入/置換 |
| L6 input | `caption`, `extracted_text`, `file_name`, `asset_kind` を context に入れる。OCR/visionは PWA route では行わない |

### Existing summaries / monthly reports / MS context

L6 prompt は同 PJ の直近過去MTG、既存 upcoming row、active plan cycle、`value_milestones`, `milestone_monthly_progress`, manual assets を読む。monthly reports は SKILL/8-3 で PJ全体文脈として入力候補だが、現行 PWA `finalize` route の `loadOsContext()` は monthly_reports を直接読まない。automation 側で品質向上に使う場合も、今回MTGにない事実を決定事項として捏造しない。

## PJ判定 Contract

| step | rule |
|---|---|
| config source | env `COLOR_PJ_CONFIG_SPREADSHEET_ID` の外部スプレッドシート `CalendarRepo_AMD_OS` を Drive MCP で読む |
| `CFG_ColorPJHistory` | `colorId | startDate | pjCode | note`。event start date 以前で startDate 最大の row を採用 |
| `CFG_PJAlias` | `alias | pjCode | priority | matchType | note`。色で取れない時の補完。`EXCLUDE` は色で取れていても skip |
| priority | 色 > title exact/alias > substring fallback |
| pjCode resolution | `lower(projects.project_name)==lower(pjCode)` 優先。`pNN` は project_id として直接扱える |
| known exception | `VSX` は VasculaX、`project_id='p26'` に解決 |
| AMD / no PJ | `pjCode='AMD'` や空は skip_no_pj。AMD全体MTGを ghost row にしない |
| final fallback | 色も alias も取れない時だけ `(title+description+location)` と `project_name` / `project_id` / `client_name` の substring match |

PWA `calendar-sync` route の PJ判定は safety net で、`project_id` が渡されたら強制紐付け、なければ `projects.project_name` / `client_name` / `project_id` substring で判定する。色判定の正本は automation 側であり、PWA route に色履歴読み取りは実装されていない。

## DB Contract

列名は `pwa/design/db_schema.md` で確認した current schema。想像で列を足さない。

### `project_meeting_summaries`

PRIMARY KEY: `meeting_id`

| column | contract |
|---|---|
| `meeting_id` | 開催済みは Calendar event id。予定は `upcoming:<calendar_event_id>`、手動fallbackは `upcoming:<project_id>:<yyyymmdd>:<title_hash>` |
| `project_id` | `projects.project_id` |
| `ym` | `YYYYMM` |
| `meeting_date` | JST date。NOT NULL |
| `meeting_start_at` | timed event ISO。tentative は null あり |
| `title` | sanitized title。500 chars程度まで |
| `notion_url`, `notion_page_id` | Notion hit時のみ |
| `calendar_event_id` | Calendar event id。予定 row でも保持 |
| `summary_short` | card summary。NOT NULL default empty |
| `decided`, `progress`, `next_actions`, `risks` | JSONB arrays。検索/通知補助であり本文の代替ではない |
| `source_hash` | source + feedback + prompt revision の sha256。予定 sync では event metadata + drive_files の hash |
| `generated_at` | generation timestamp |
| `generated_by_model` | `anthropic:claude-sonnet-4-7@claude-routine`, `calendar-future-sync`, `workflow-no-llm`, `codex-eimi`, `manual-asset-insert`, `manual-edit` など |
| `gmail_thread_ids` | JSONB thread id array |
| `source_kinds` | `none`, `notion`, `gmail`, `drive`, `slack`, `calendar` を `+` join、または `upcoming`, `upcoming_tentative`, `dialogue` |
| `source_url` | Calendar / source URL |
| `narrative_md` | 議事録本文 / 予定ブリーフ。開催済み sourceありでは必須 |
| `prep_source_meeting_id` | 開催済み row から元の upcoming row、または upcoming row から元の held row への紐付け |
| `prep_status` | `draft`, `tentative`, `nudging` など。DB check constraint はないので使用値を増やす時はspec更新 |
| `facilitator_member_id` | prep/facilitator nudge 用 |
| `facilitator_nudge_scheduled_at`, `facilitator_slack_scheduled_message_id` | facilitator reminder result |

### `meeting_assets`

PRIMARY KEY: `asset_id`; UNIQUE: `storage_path`

| column | contract |
|---|---|
| `asset_id` | UUID。route が `crypto.randomUUID()` で事前生成する |
| `meeting_id`, `project_id` | `project_meeting_summaries` に紐付け |
| `storage_bucket` | default `meeting-assets` |
| `storage_path` | `<project_id>/<meeting_id>/<asset_id>-<safe_name>` |
| `file_name`, `media_type`, `file_size_bytes` | upload metadata |
| `asset_kind` | `upload`, `paste`, `screen_capture`, `notion_image`, `generated` |
| `caption` | UI編集可。Markdown alt/説明にも使う |
| `extracted_text` | OCR/vision等の将来入力。PWA route は生成しない |
| `source_url` | external source がある場合 |
| `sort_order` | 10刻みで追加。PATCHで更新可 |
| `created_by` | admin user email |

### `meeting_notifications`

PRIMARY KEY: `meeting_id`

| column | contract |
|---|---|
| `meeting_id` | 開催済み sourceあり row の id |
| `project_id` | PJ |
| `title` | notification title |
| `source_kinds` | `none` 以外 |
| `summary_short` | notification body |
| `notified_at` | nullで挿入。iOS互換通知側が送信後更新 |
| `read_at` | PWA/iOS read state |

### `meeting_action_items`

PRIMARY KEY: `action_id`

| column | contract |
|---|---|
| `project_id` | PJ |
| `source_meeting_id` | held meeting id |
| `prep_meeting_id` | next/upcoming meeting id |
| `owner_member_id`, `owner_code_name` | action文中の code_name match で推定。取れなければ null |
| `title`, `detail` | TODO |
| `due_at` | primary next meeting start |
| `status` | default `todo`。completion route は `done` に更新し、`completed_at` / `completion_*` を使う。open 判定では `todo`, `nudged`, `blocked` を未完了として扱う |
| `source_hash` | `source_meeting_id|title` の sha256 |
| `last_nudged_at`, `slack_message_ts`, `scheduled_nudge_at`, `slack_scheduled_message_id` | Slack result |

### `tsukuyomi_nudge_queue`

schema は存在するが、現行 `meeting-workflow/finalize` の主要出力ではない。L6 SKILL Phase H で cockpit TODO / nudge の候補として言及される。使う場合は `nudge_id` unique、`project_id`, `ym`, `message`, `status='ready'`, `posted_at`, `error_note` を守る。

## PWA API Contract

### `POST /api/meeting-prep/calendar-sync`

| item | contract |
|---|---|
| auth | `Authorization: Bearer ${WORKFLOW_SECRET || CRON_SECRET}`、または logged-in admin session |
| body | `{ events: [...] }` または `{ calendar_events: [...] }`; optional `dry_run`, `project_ids` |
| event accepted keys | `id/event_id/calendar_event_id`, `recurring_event_id/recurringEventId`, `recurrence`, `title/summary`, `start/start_at/start_time/startISO`, `end/end_at/end_time`, `url/htmlLink/source_url`, `description`, `location`, `project_id`, `drive_files` |
| validation failure | events空 400、eventごとの `missing_event_id`, `missing_title`, `tentative_calendar_title`, `missing_timed_start`, `past_event`, `no_project_match`, `ambiguous_project_match` は results に入れて skip |
| project query | `projects.status in ('active','sales')`。body `project_ids` があれば絞る |
| write | `project_meeting_summaries.upsert(..., onConflict='meeting_id')` |
| idempotency | `source_hash` 一致なら `mode='unchanged'` |
| weekly skip | `weekly_recurring_future_occurrence` を results に入れ、kept meeting id を返す |
| manual protection | existing `generated_by_model !== 'calendar-future-sync'` なら body fields を preserve |
| response | `{ok, created, updated, skipped, total, created_by, results[]}` |

### `POST /api/meeting-prep`

| item | contract |
|---|---|
| auth | `WORKFLOW_SECRET || CRON_SECRET` bearer、または logged-in admin session |
| required | `project_id`, `meeting_date` (`YYYY-MM-DD`), `title` |
| optional | `meeting_id`, `ym`, `meeting_start_at`, `calendar_event_id`, `source_url`, `summary_short`, arrays, `narrative_md`, `prep_status`, `is_tentative`, `generated_by_model` |
| source kind | `is_tentative=true`、`prep_status='tentative'`、または `meeting_start_at` invalid/missing なら `upcoming_tentative`; それ以外は `upcoming` |
| meeting id | body `meeting_id` 優先。なければ `calendar_event_id` から `upcoming:<id>`、さらに fallback `upcoming:<project_id>:<yyyymmdd>:<title_hash>` |
| write | `project_meeting_summaries.upsert(..., onConflict='meeting_id')` |
| failure | unauthorized 401、non-admin 403、required missing 400、Supabase error 500 |

### `POST /api/meeting-workflow/finalize`

| item | contract |
|---|---|
| auth | `WORKFLOW_SECRET || CRON_SECRET` bearer、または logged-in admin session |
| required | `meeting_id` of held row |
| rejects | missing `meeting_id` 400、not found 404、`source_kinds='upcoming'` or `meeting_id` starts `upcoming:` は 400 |
| LLM | 呼ばない。`narrative_md` があればそれを使用、なければ arrays から deterministic fallback minutes を組む |
| OS context | `projects`, previous meetings, existing upcoming, active `value_plan_cycles`, `value_milestones`, `milestone_monthly_progress` |
| next candidates | body `next_meeting.meeting_start_at` があれば優先。なければ `decided`, `next_actions`, `summary_short`, `narrative_md` から date + time が両方あるMTG表現のみ最大6件 |
| Calendar creation | explicit input candidate で `create_calendar !== false` の場合だけ GAS pwaApi `nav_meeting_createCalendarEventForPrep_` を呼ぶ。extracted candidate は Calendar auto-create しない |
| writes | `project_meeting_summaries` upcoming rows、`meeting_action_items`, `app_notifications`, Slack DM/schedule result、facilitator nudge fields |
| current code note | file header comment には「指定がなければ翌週同時刻」とあるが、実装は exact date/time がなければ nextCandidates 0。spec は実装を正とする |

### `POST /api/meeting-workflow/actions/{actionId}/complete`

| item | contract |
|---|---|
| auth | `WORKFLOW_SECRET || CRON_SECRET` bearer、または logged-in admin session |
| required | URL param `actionId` |
| body | optional `completion_source` (default `manual`), `completion_evidence_url` |
| write | `meeting_action_items.status='done'`, `completion_source`, `completion_evidence_url`, `completed_at=now()` |
| prep status | 同じ `prep_meeting_id` に `todo/nudged/blocked` が残れば `prep_status='nudging'`、残らなければ `prep_status='ready'` |
| failure | missing actionId 400、not found 404、auth 401/403、Supabase error 500 |

### `/api/meeting-assets`

| route | auth | contract |
|---|---|---|
| `GET /api/meeting-assets?meeting_id=...` | admin session | meeting assets を `sort_order, created_at` 順で返し、1h signed URL も付ける |
| `POST /api/meeting-assets` | admin session | multipart `files[]`, `meeting_id`, optional `asset_kind`, `caption`。meeting存在確認後、Storage upload + `meeting_assets` insert。途中失敗時は upload済み path を remove |
| `PATCH /api/meeting-assets` | admin session | `asset_id` 必須。`caption`, `sort_order`, `extracted_text` を更新 |
| `DELETE /api/meeting-assets?asset_id=...` | admin session | Storage object を削除してから DB row delete |
| `GET /api/meeting-assets/file/{asset_id}` | admin session | `meeting_assets.storage_bucket/path` から 60s signed URL を作り redirect |
| `POST /api/meeting-assets/insert-markdown` | admin session | assets を `narrative_md` の meeting-assets block に挿入/置換し、`generated_by_model='manual-asset-insert'` |

## State / Status / source_kinds

| state | row identity | meaning |
|---|---|---|
| held source row | `meeting_id=<calendar_event_id>` | 開催済み議事録。`source_kinds` は `notion+gmail+drive+slack+calendar` の subset join、または `none` |
| no source marker | `meeting_id=<calendar_event_id>`, `source_kinds='none'` | Calendar event はあったが source 30 chars 以上なし。通知なし |
| confirmed upcoming | `meeting_id='upcoming:<calendar_event_id>'`, `source_kinds='upcoming'` | 日時確定の予定MTGカード |
| tentative upcoming | `source_kinds='upcoming_tentative'`, `prep_status='tentative'` | 日程未確定 / 手動仮置き。「日程調整中MTG」扱い |
| dialogue | `source_kinds='dialogue'` | まさえいMTG等の対話ログ。L6開催済みCalendar flowとは別 route |
| prep link | `prep_source_meeting_id` | held row から元 upcoming row、または upcoming row から元 held row を参照。upcoming row は削除しない |

`source_kinds` の判定は各 source text length 30 chars 以上を has source とし、該当 source 名を `+` join する。現行 SKILL は `notion`, `gmail`, `drive`, `slack` を主 source とし、guard helper は Calendar description / attachments を `calendar` / `drive` source refs として扱う。PWA UI は `source_kinds='upcoming'` と `meeting_id LIKE 'upcoming:%'` を混同せず、source kind を正とする。

## Quality / Guard

| guard | rule |
|---|---|
| fixed headings | 開催済み narrative は5見出し固定。表記ゆれを保存しない |
| arrays only 禁止 | `summary_short` + arrays だけで開催済み source row を完了扱いしない |
| existing narrative protection | 既存300字以上 narrative を低品質更新で消さない |
| held-source preflight | `npm run test:l6-held-source-guard` の helper shape を使い、Gemini Docs添付 / Notion eventId空 fallback / report_emails空 Gmail fallback を held candidate に進める |
| report_emails gap | fallback Gmail を使ったら `projects.report_emails_missing_but_gmail_fallback_used` を config gap として残す。自動DB更新しない |
| Drive contamination | Drive資料だけで決定済みにしない |
| weekly recurring | future occurrence は seriesごとに次回1件だけ。route と UI の両方で守る |
| PWA LLM boundary | PWA/GAS/Vercel route に従量課金 LLM cron を置かない |
| old GAS boundary | GAS 153/074系は参照元。kill switch解除・定期復活禁止 |

## Failure Mode

| failure | behavior |
|---|---|
| no events | Phase A early exit。heavy source read / LLMなし |
| no source | `source_kinds='none'` marker row。notificationなし |
| Notion eventId missing | title/date/attendees/Gemini/Drive/Gmail URL fallback。可能なら eventId backfill。欠損だけで skip しない |
| Notion backfill failed | extraction 続行。run summary に `notion_event_id_backfill_failed` |
| Gmail `report_emails` empty | fallback search。hit したら config gap を残し、自動DB更新しない |
| Drive folder missing | Drive sourceなしとして続行。no-data 判定には使わない |
| Drive text extraction failed | metadata_only として title/url/mime/modified を source に残す |
| Slack connector failure | Slack sourceなしで続行。failure type を run summary に分けて記録 |
| weekly duplicate | 2件目以降は `weekly_recurring_future_occurrence` skip |
| low quality narrative | DB upsert しない。既存 rich narrative を保護 |
| PWA API auth failure | 401/403。automation は secret/env を確認し、DB直書きへ逃がさない |
| PWA API Supabase failure | 500。response body/errorを run summary に残す |
| connector failure | その source の failure として記録。他 source があれば source_kinds 判定を続ける |
| exact next meeting absent | `finalize` は next row / action item を作らない。7日後 fallbackは禁止 |
| Gmail draft send risk | draft作成まで。本送信は禁止 |

## Validation

最低限:

1. `git diff --check`
2. conflict marker scan: `rg -n '^(<<<<<<<|=======|>>>>>>>)' pwa/spec/3-3-meeting-flow-current-spec.md pwa/spec/1-3-reconstruction-coverage-audit.md pwa/spec/6-1-appendix-changelog.md`
3. `cd pwa && npm run test:l6-held-source-guard`

API / route の smoke:

1. `POST /api/meeting-prep/calendar-sync` は `dry_run:true` と fixture event で `created/updated/skipped/results` を返すこと。実DBに書かない確認では `dry_run:true` を使う。
2. `POST /api/meeting-prep` は `WORKFLOW_SECRET` または admin session で、tentative / confirmed の `source_kinds` が分かれること。
3. `POST /api/meeting-workflow/finalize` は upcoming row を拒否し、held row で exact date/time がない時に架空カードを作らないこと。
4. `GET/POST/PATCH/DELETE /api/meeting-assets` は admin session 必須、非admin 401/403、meeting missing 404、file type/size 400 を確認すること。

DB spot check:

1. `project_meeting_summaries` で held row と `upcoming:<calendar_event_id>` row が別行になっていること。
2. held row の `prep_source_meeting_id` が既存 upcoming row を指すこと。
3. `source_kinds='none'` row に `meeting_notifications` が作られていないこと。
4. rich `narrative_md` が arrays-only 更新で消えていないこと。
5. weekly recurring の future row が UI で次回1件だけ表示されること。

spec page:

1. production `/spec/3-3-meeting-flow-current-spec` はログイン/auth redirect 境界が既存 spec page と同じこと。
2. spec metadataを触った場合は `cd pwa && npx tsc --noEmit` と `cd pwa && npm run build`。

## この章だけで再構築できること

L2⑥ Meeting Flow の writer boundary、Calendar filter、色優先PJ判定、5 source input、held/upcoming/tentative state、`project_meeting_summaries` / `meeting_assets` / `meeting_notifications` / `meeting_action_items` の column-level contract、PWA deterministic API、narrative quality gate、held-source guard、旧GAS復活禁止境界、validation を再構築できる。

## まだ再構築できないこと

MMO PC 側 Codex Desktop automation の登録 UI / run log / 実 schedule は repo 外状態なので、この章だけでは確認できない。Calendar作業枠、Drive資料draft、Gmail draft は SKILL 上の automation 仕様で、PWA route の実装としては未確認/未実装部分がある。Google Calendar / Drive / Gmail / Slack / Notion connector の実 MCP tool 名や認可状態も実行環境側で確認が必要。

## 確認したcurrent truth

- `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
- `pwa/manual/3-2-data-and-extraction.md`
- `pwa/manual/8-3-l2-extraction-routines-spec.md`
- `pwa/design/L2_DATA.md`
- `pwa/design/meeting_summaries.md`
- `pwa/design/db_schema.md`
- `pwa/src/app/api/meeting-prep/calendar-sync/route.ts`
- `pwa/src/app/api/meeting-prep/route.ts`
- `pwa/src/app/api/meeting-workflow/finalize/route.ts`
- `pwa/src/app/api/meeting-assets/route.ts`
- `pwa/src/app/api/meeting-assets/insert-markdown/route.ts`
- `pwa/src/app/api/meeting-assets/file/[assetId]/route.ts`
- `pwa/scripts/l6_meeting_held_source_guard.cjs`
- `gas/153_MeetingHourlyTrigger.js`
- `gas/074_MeetingSummaryRepo.js`

## 未確認 / inferred

- `amd-os-l6-meeting-flow` の Windows MMO PC 登録状態、実行履歴、最終成功時刻は repo 外なので未確認。
- SKILL Phase H/I/J の Calendar作業枠、Drive資料draft、Gmail draft は automation 仕様として確認したが、PWA API route としては未実装/未確認。
- `finalize/route.ts` の file header comment には古い「next meeting fallback」説明が残るが、コード実体は exact date/time のみなので、ここではコードを current truth とした。
- `source_kinds` に `calendar` を含める扱いは guard helper の source refs 由来。SKILLの主保存 payload は `notion/gmail/drive/slack` 中心なので、復旧時は run summary と DB既存値を spot check する。

## 次に見る実装ファイル

- `pwa/src/components/cockpit/CockpitMeetingSummary.tsx`
- `pwa/src/components/cockpit/CockpitMeetingDetailModal.tsx`
- `pwa/src/lib/supabase-data.ts`
- `pwa/src/app/api/meeting-summary/manual-update/route.ts`
- `pwa/src/app/api/meeting-workflow/actions/[actionId]/complete/route.ts`
- `gas/074b_MeetingSummarySlack.js`
- `gas/074c_MeetingSummaryDrive.js`
- `gas/074d_MeetingSummaryCalendar.js`
- `gas/074e_MeetingSummaryGmail.js`
- `gas/074f_MeetingWorkflow.js`
