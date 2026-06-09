# L2⑥ Meeting Flow 仕様

> **この章は何か**: MTGサマリだけでなく、予定MTGカード、Drive資料同期、TODO→cockpit、Calendar作業枠、資料draft、Gmail draft まで含む L2⑥ meeting flow の現行仕様。詳細運用は `/manual/8-3-l2-extraction-routines-spec` にも残す。

## 現行 writer

| 項目 | 値 |
|---|---|
| automation | `amd-os-l6-meeting-flow` |
| 実行場所 | Windows MMO Codex Desktop automation |
| schedule | 09:00-21:00 JST、毎時 |
| early exit | 該当 MTG event 0 件なら Phase B 以降を実行しない |
| repo SKILL | `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` |

旧 GAS 153 / 074 は定期 writer として復活させない。

## 入力

| source | 内容 |
|---|---|
| Calendar | 過去60-180分終了 event、今日0:00 JSTから60日先の確定予定 |
| Notion | 議事録 page / DB |
| Gmail | report_emails thread / follow-up draft context |
| Drive | Docs / Slides / Sheets / PDF / Office metadata |
| Slack | thread / file / nudge context |
| PWA | `meeting_assets` 添付、過去 meeting summaries、monthly reports、MS context |

## Calendar PJ 判定

Calendar event の PJ 判定は、色→PJ判定を第一軸にする。

1. `CFG_ColorPJHistory` の `colorId + startDate` 履歴で PJ code を決める。
2. 色で取れない場合に `CFG_PJAlias` の title alias を見る。
3. 最後に `project_name` / `project_id` / `client_name` の substring fallback を使う。

移植・リファクタで色判定を削除しない。

## 予定MTGカード同期

- `POST /api/meeting-prep/calendar-sync` が `source_kinds='upcoming'` の予定MTGカードを upsert する。
- weekly recurring MTG は series ごとに次回1件だけ表示する。
- `+` / `＋` 始まり、全日予定、start datetime のない予定は除外する。
- Drive資料は automation 側が metadata として渡す。PWA route は Drive を直接読まない。
- Drive資料だけを根拠に `decided` へ「決定済み」と書かない。

## MTGカード由来 Calendar upsert 一次防御

MTGカード / 議事録に日時・場所・対面/オンライン・参加者・持参物・返信/宿題が入っているのに Google Calendar 側へ予定が無い状態を一次防御で検知する。PWA は Calendar を直接読まない / 書かない。L2⑥ automation が既存 Calendar event metadata を読み、`POST /api/meeting-calendar/upsert-plan` に MTGカードと既存予定候補を渡す。

`/api/meeting-calendar/upsert-plan` は dry-run only。返すものは upsert plan、重複判定、`sendUpdates='none'` 前提の proposed payload、review reason だけ。`dry_run=false` / `execute=true` は `calendar_write_disabled` で拒否する。

冪等性:
- `calendar_event_id` がある場合はその event を補完候補にする。
- `calendar_event_id` が無い場合は `amd-os:project_meeting_summaries:<meeting_id>` を deterministic source key にし、Google Calendar `extendedProperties.private` 候補へ `amd_os_mtg_card_id` / `amd_os_project_id` / `amd_os_source_kind` / `amd_os_source_key` / `amd_os_plan_hash` を入れる。
- 既存 event の `extendedProperties.private`、同日 + title、必要なら場所で duplicate match する。同じ MTGカードから二重作成しない。

自動 upsert 可能な条件:
- 日時が確定 (`meeting_start_at` あり)、PJ / title / meeting_date が揃っている。
- 既存 eventId または高確度 duplicate match がある、または eventId なしでも日時確定の新規候補として安全に作れる。
- 外部 attendees を招待しない。payload の `attendees` は常に空で、`sendUpdates` は常に `none`。

review queue / 保留条件:
- 時間未定は 08:00-21:00 JST の広めブロック proposed payload を作るが、`review_required` にする。
- 日付確度が低い候補は `hold`。
- 外部参加者への invite が必要な場合、外部返信が絡む場合、場所やPJが曖昧な場合、個人予定との境界が怪しい場合は review に送る。

強リマインド:
- 対面 / 訪問 / 初回MTG / 顧客・大学・研究機関相手 / 持参物あり / 出張直後 / 返信・宿題ありは risk flag を立て、24h・3h・60m・10m などの popup reminder 候補を返す。
- description には秘密本文を入れすぎず、OS source link、持参物、宿題、返信要否の最小メタだけを入れる。

Gmail cron は二次防御。未カード化 / 未Calendar化メールを拾うが、正規の一次ルートは MTGカード生成時点の Calendar upsert plan とする。

## TODO / task 由来 Calendar 作業枠

MTGから生まれた `meeting_action_items`、OS `tasks`、議事録 `next_actions`、Gmail thread、Slack thread のうち、担当メンバーが明確な作業系タスクは、MTG予定ではなく Calendar 作業枠として入れる。AMD運用では作業系予定のタイトル先頭に `+` を付ける。例: `+SX mail 杉浦先生`。

PWA は Calendar を読まない / 書かない。H-1 automation が owner calendar とまさ calendar の予定を bounded に読み、`POST /api/task-calendar/schedule-plan` に busy window を渡す。route は dry-run only で、09:00-21:00 JST の共通空き枠を15分刻みで探し、`calendar_writes[]` を返す。`dry_run=false` / `execute=true` は `calendar_write_disabled` で拒否する。

Gmail / Slack TODO は H-1 の既存 source 集約範囲で抽出する。PJ が解決でき、担当者 / owner calendar / owner Slack user が解けるものだけ自動候補にする。source は `source_kind='gmail_todo'` / `source_kind='slack_todo'`、`source_id=<thread/message id>`、`source_url`、`source_confidence` を付ける。低信頼、担当不明、個人予定境界、外部返信本文の自動作成が絡むものは review/hold。Calendar 作業枠を入れても、Gmail返信やSlack返信は送らない。

write条件:
- `owner_calendar_id` と `manager_calendar_id` が解決できる。
- owner + まさ の共通空き枠がある。
- title は必ず `+<PJコード> <task>`。
- 実writeは Google Calendar MCP `create_event` を calendar ごとに呼び、`attendees=[]` / Google Meetなし / popup 10分 / `sendUpdates` 相当なしで作る。
- 重複防止は `extendedProperties.private.amd_os_task_source_key`、または description の `Source key:`、または同名 `+` event の既存検索で判定し、既にあれば `already_scheduled` にする。
- 実write成功後だけ、H-1 は owner とまさの内部 Slack DM に nudge を送る。外部相手 / クライアント / 大学関係者には送らない。

review / hold条件:
- owner calendar が不明、calendar write権限がない、共通空き枠がない、個人予定との境界が怪しい場合は作らない。
- owner calendar に書けない時に、まさ calendarだけへ勝手に代替作成しない。

H-1 automation は、作成した Calendar 作業枠を automation chat の run summary に必ず出し、Slack DM nudge の送信成否も event id 付きで残す。親司令塔へのquiet closeoutとは別に、H-1実行チャット内で「カレンダーにこの予定いれたよ」を event id 付きで残す。

## ended / frozen PJ の MTGサマリ生成ガード (2026-06-03 まさ確定)

月次サマリと同じ進捗ベース原則を L2⑥ にも適用する。**開催済みの実MTG (= 実進捗) は状態を問わず記録してよい**が、**未来の予定MTG prep を終了/凍結 PJ に自動生成しない**。frozen 判定は `projects.status='frozen'` または (`freeze_from_ym` ≤ 対象 ym)。

| 生成経路 | ガード |
|---|---|
| `POST /api/meeting-prep/calendar-sync` | `projects.status in ('active','sales')` のみ対象 (既存) |
| `POST /api/meeting-prep` (upcoming prep) | ended / frozen / `freeze_from_ym ≤ ym` なら upsert せず `skipped` を返す |
| `POST /api/meeting-workflow/finalize` (次回 prep 自動生成) | 次回 prep の ym が ended / frozen 境界後ならその candidate をスキップ (開催済みMTGの finalize 自体は許可) |
| `POST /api/dialogue-meeting` (まさえいMTG 記録) | ガードしない (人が意図的に記録する実進捗のため) |

## 開催済みMTG narrative

`project_meeting_summaries.narrative_md` は次の見出し順を固定する。

```md
## 🎯背景
## 📊経緯
## ✅決まったこと
## ▶️次の一手
## ⚠️残課題
```

- 見出し文言・絵文字・順序を変えない。
- raw array の貼り付けではなく、参加していないメンバーが理解できる段落にする。
- `✅決まったこと` は会議で実際に合意・確認されたことだけを書く。

## 出力

| output | 用途 |
|---|---|
| `project_meeting_summaries` | MTG narrative / decided / progress / next_actions / risks |
| `meeting_assets` | 手動添付スクショ / PDF / 画面共有資料 |
| `meeting_notifications` | 旧 iOS APNs / 通知互換 |
| `tsukuyomi_nudge_queue` or cockpit TODO | TODO の cockpit 反映 |
| Calendar event | `+<PJ>` prefix の作業枠 |
| Drive file | automation が生成できる資料 draft |
| Gmail draft | facilitator 名義 follow-up draft。本送信は禁止 |

## 禁止事項

- Gmail を本送信しない。draft 止まり。
- Calendar 作業枠を `+<PJ>` prefix なしで作らない。
- freebusy を見ずに重複枠を作らない。
- 前提データが足りない資料を強引に生成しない。
- 旧 GAS 153 / 074 を定期 writer として復活させない。
