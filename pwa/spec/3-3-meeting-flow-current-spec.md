# L2H-1 Meeting Flow 仕様

> **この章は何か**: MTGサマリだけでなく、予定MTGカード、Drive資料同期、TODO→cockpit、Calendar作業枠、資料draft、Gmail draft まで含む L2H-1 meeting flow の現行仕様。詳細運用は `/manual/8-3-l2-extraction-routines-spec` にも残す。

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
| Calendar | 過去60-180分終了 event、現在時刻の前後24時間にある確定予定。未来60日同期はM系メンテが担当 |
| Notion | 議事録 page / DB。connector auth failure 時は `pwa/scripts/h1_local_notion_fallback.mjs` で Notion Desktop local cache を event title + date + event id から自動探索する |
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
- PJ cockpit UI は `source_kinds='upcoming'` だけでなく、`upcoming+calendar+manual-prep` のような `+` 区切り拡張値も `upcoming` token を含めば日時確定済み予定MTGとして扱う。`upcoming_tentative` token は別欄にせず、同じ「予定MTG / 準備中」欄で日付欄を `日程未確定` として表示する。`meeting_id` が `upcoming:` で始まっても、`source_kinds` が開催済みソースへ変わっている row は準備カード扱いしない。
- 予定MTG欄に出すのは `meeting_start_at` が現在時刻より後の行だけ。`meeting_date` が今日でも、開始時刻を過ぎた予定MTGは「予定MTG / 準備中」に残さない。
- 開催済み議事録の詳細に紐づける会議前準備メモは、手動準備または prep worker の成果がある行だけに限る。`calendar-future-sync` が作った薄い予定テンプレートだけの行は、開催後の詳細へ `MTG準備情報` として出さない。
- weekly recurring MTG は series ごとに次回1件だけ表示する。
- `+` / `＋` 始まり、全日予定、start datetime のない予定は除外する。
- Drive資料は automation 側が metadata として渡す。PWA route は Drive を直接読まない。
- Drive資料だけを根拠に `decided` へ「決定済み」と書かない。
- 予定MTG詳細では `risks` を UI 上「必ず確認すること」として表示・編集する。既存データは破壊削除せず、旧「気をつけたい読み違い」相当の値もこの section の確認事項として扱う。
- ZMP (`project_id=p19`) のCalendar予定は、タイトル上の事業名 alias `ZeMA` / `葛飾水素循環` でも `calendar-sync` が p19 に解決する。

## Calendar dry-run planners

MTGカード / 議事録側に日時・場所・対面/オンライン・持参物・返信/宿題があるのに Calendar event が無い/薄いケースは、`POST /api/meeting-calendar/upsert-plan` で一次防御する。PWA は Calendar を直接読まない / 書かない。L2H-1 automation が既存 Calendar event metadata を read-only で渡し、この route は `update_existing` / `create_candidate` / `review_required` / `hold` の plan、重複判定、`sendUpdates='none'` 前提の proposed payload だけを返す。`dry_run=false` / `execute=true` は `calendar_write_disabled` で拒否する。

MTGから生まれた担当タスク、OS task、Gmail TODO、Slack TODO はまず `POST /api/task-calendar/register-tasks` で `tasks` に自動登録し、担当者本人だけへ Slack DM nudge を送る。admin review queue は作らない。重複は `task_id` で止め、既存 task には既定で再通知しない。Slack 実送信は `send_slack=true` の時だけ行い、送信先は payload の `owner_slack_user_id` または `members.slack_id` で解決した owner だけに限定する。

Calendar 作業枠候補が必要な場合だけ `POST /api/task-calendar/schedule-plan` を dry-run planner として使う。route は owner calendar とまさ calendar の busy window を入力として受け取り、`+<PJコード> <task>` の作業枠候補を `calendar_writes[]` で返す。外部 attendees は空、Google Meetなし、Gmail/Slack返信は送らない。owner calendar が不明、低信頼、個人予定境界、共通空き枠なしは `review_required` / `hold`。PWA は Calendar event を直接作成しない。

## ended / frozen PJ の MTGサマリ生成ガード (2026-06-03 まさ確定)

月次サマリと同じ進捗ベース原則を L2H-1 にも適用する。**開催済みの実MTG (= 実進捗) は状態を問わず記録してよい**が、**未来の予定MTG prep を終了/凍結 PJ に自動生成しない**。frozen 判定は `projects.status='frozen'` または (`freeze_from_ym` ≤ 対象 ym)。

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
- 詳細モーダルの編集 mode は、表示している section と同じ source field を編集する。`narrative_md` が主表示なら `narrative_md`、raw 配列が表示されている fallback 時だけ `decided / progress / next_actions / risks` を編集する。

## Notion auth failure / recent none recovery

Notion connector の `oauth_token_invalid_grant` / `TRIGGER_REAUTHENTICATION` は H-1 の停止理由にしない。H-1 は再認証通知を作りつつ、同じ run で `npm run h1:local-notion-fallback -- --title "<event title>" --date "<YYYY-MM-DD>" --event-id "<calendar_event_id>"` を実行する。hit した local Notion page は `source_kind='notion-local'` として narrative 入力に使い、保存時は `notion_page_id` / `notion_url` / `source_hash` に反映する。

過去 run で `source_kinds='none'` / `summary_short='議事録なし'` になった開催済みMTGは、次回以降 24 時間は自動再探索する。通常の終了60-180分 window から外れていても、`meeting_start_at` / `calendar_event_id` / `title` から event payload を再構成し、Local Notion fallback、Gmail、Drive、Slack、Calendar を再評価する。本文が取れた場合は同じ `meeting_id` を source 付きに更新し、本文が取れない場合だけ `none` を維持する。

## 出力

| output | 用途 |
|---|---|
| `project_meeting_summaries` | MTG narrative / decided / progress / next_actions / risks |
| `meeting_assets` | 手動添付の一般ファイル / スクショ / PDF / 画面共有資料。新規実体はDriveの `PJフォルダ / YYMMDD_会議名`、旧実体はprivate Storage |
| `meeting_notifications` | 旧 iOS APNs / 通知互換 |
| `tsukuyomi_nudge_queue` or cockpit TODO | TODO の cockpit 反映 |
| Calendar event | `+<PJ>` prefix の作業枠 |
| Drive file | automation が生成できる資料 draft |
| Gmail draft | facilitator 名義 follow-up draft。本送信は禁止 |

## 禁止事項

- Gmail を本送信しない。draft 止まり。
- Calendar 作業枠を `+<PJ>` prefix なしで作らない。
- freebusy を見ずに重複枠を作らない (= MTG カード → Calendar 一次防御 / tasks→Calendar 枠側の制約)。**Phase P の prep 枠は freebusy 不在時の F2 deterministic fallback で作ってよい** (= 2026-06-24 まさ確定、Phase P 節 + SKILL Phase P-2 A 参照)。
- 前提データが足りない資料を強引に生成しない。
- 旧 GAS 153 / 074 を定期 writer として復活させない。

## H-1 MTG Prep セッション自動立ち上げ (= H-1 内 Phase P、2026-06-22 まさ確定)

> **この節は何か**: 「明日 MTG あるけど準備してない、毎回 codex を開いて『背景はこうで…』と説明するのがだるい」問題への OS 側回答。**既存 H-1 automation (`amd-os-l6-meeting-flow`、name は「H-1」)** の内部に prep 用 Phase P を追加し、対象 MTG ごとに **codex の新規 session を事前 spawn** する。session の中で worker prompt が文脈ロード→着地点 draft→資料 draft→readiness 計算まで完遂し、まさを待つ状態で待機する。まさは Slack DM で「{MTG} の prep セッション立ち上げといたよー」と通知を受け、自分で codex を開いて該当 session に入る (= ターミナル操作なし)。

### 設計の核

- **automation = 新規 session を生み出す役だけ**。prep 本体 (= 文脈ロード / draft 生成 / readiness 計算) は生まれた session の中で実行する。
- **既存 H-1 automation 1本に統合**。`amd-os-l6-meeting-flow` に Phase P を追加するだけで、新 automation は作らない。
- **1 MTG = 1 新規 session**。MTG ごとに `codex exec` を subprocess で呼び、別個の session を立ち上げる。session ファイルは disk persist され、まさが codex desktop で開ける状態で残る。
- **codex のみで spawn 統一**。サブスク (ChatGPT) 認証で動くため定額外トークン課金は発生しない (`~/.codex/auth.json` の `auth_mode='chatgpt'`)。
- **post-MTG 即時 timing**。「前回 MTG 終了 + 次回 MTG 確定」の瞬間が来た MTG を対象に prep を始める (= 先手先手主義)。
- **カレンダー枠化**。prep 作業自体を「**＋ <PJコード> MTG準備: <タイトル>**」というタイトル先頭 `＋` 付きの動かせる Calendar event として まさカレンダーに作る。
- **ドラッグ追従**。Calendar の `＋ prep枠` がまさによって移動されたら、その新しい日時を spawn 時刻として追従する (= 毎時 H-1 が走るたびに Calendar 状態を再確認)。
- **対象 facilitator はまさだけ** (2026-06-22 まさ確定)。他メンバーの Calendar には prep 枠を作らない。
- **Notion AI Meeting Notes context gate**。prep worker は固有名詞・略称・拾うべき論点の context を生成するだけでは完了扱いにしない。`pwa/scripts/l6_prep_notion_context_gate.cjs` で、当日の AI Meeting Notes page に `amd-os:notion-ai-context:{meeting_id}:{digest}` marker が入ったこと、または `not_found` / `write_failed` / `ambiguous` / `wrong_page` 等の完了状態を確認してから `ready` へ進む。

### 既存 H-1 automation との統合

prep は別 automation ではなく `amd-os-l6-meeting-flow` の内部 Phase として実行する。既存 H-1 は **毎時、平日 09:00-21:00、15分発火** で走っているため、prep の各種タイミング判定 (= post-MTG即時 / ドラッグ追従) を毎時 catch できる。

- Phase A-J (既存) はそのまま残す
- **Phase P (新規)**: prep セッション spawn (毎時走るたびに必要分だけ起動)

`prep_worker_status` で重複起動を防ぐ。一度 `ready` になった MTG は再 spawn しない。`failed` の MTG は次回 H-1 run で再試行する。

### Phase P (prep セッション spawn) — 動作

```sql
SELECT pms.meeting_id, pms.project_id, pms.title,
       pms.meeting_start_at, pms.calendar_event_id,
       pms.prep_worker_status, pms.prep_calendar_event_id
FROM project_meeting_summaries pms
JOIN projects p USING (project_id)
WHERE pms.source_kinds LIKE '%upcoming%'
  AND pms.source_kinds NOT LIKE '%upcoming_tentative%'
  AND pms.meeting_id NOT LIKE 'upcoming-tentative:%'
  AND pms.meeting_start_at IS NOT NULL
  AND pms.meeting_start_at > now()
  AND pms.meeting_start_at < now() + interval '7 days'
  AND (pms.prep_worker_status IS NULL OR pms.prep_worker_status = 'failed')
  AND p.status IN ('active', 'sales');
```

各対象 MTG について順に:

1. **timing 判定 (2026-06-24 まさ確定: F2+F3 フォールバック)**:
   - **基準時刻 = `meeting_start_at - 24h`** (= 外部依存ゼロで必ず決まる、F2)
   - Calendar `get_availability` (freebusy) が成功する場合のみ、`max(now, 同シリーズ前回 MTG +1日後 09:00 JST)` から `meeting_start_at - 24h` までの window で最初の 30 分以上の空き枠を探して**前倒し**する
   - freebusy が `ACCESS_TOKEN_SCOPE_INSUFFICIENT` 等で取れない場合、基準時刻のまま続行する (= Phase P を skip しない)
2. **カレンダー＋枠作成**: `＋ <PJコード> MTG準備: <MTGタイトル>` を作成 (= 動かせるタスク = まさが手動でドラッグして調整する前提)。event ID を `prep_calendar_event_id` に保存。既存枠は read してドラッグ追従
   - **Calendar 書き込み自体が失敗した場合も spawn は進める** (= F3)。`prep_calendar_event_id` は null のまま、3 の spawn 判定では基準時刻 = `meeting_start_at - 24h` を起点とする
3. **spawn 判定**: 現在時刻が **spawn 起点時刻** (= `prep_calendar_event_id` ある時はその start、null の時は基準時刻) に達してれば spawn 実行
4. **codex exec で新規 session spawn** (subprocess):
   ```bash
   codex exec --skip-git-repo-check --json \
     --output-last-message /tmp/prep-{meeting_id_hash}-out.txt \
     -C /Users/masa/projects/AMD/amd-os \
     "あなたは {MTG} 専属 prep worker。pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md を読んで meeting_id={...} project_id={...} で実行。Phase 1-10 完遂後、対話可能な状態で待機する (= 自動で session を閉じない)。"
   ```
5. **SESSION_ID 取得**: codex stdout の `session id: {UUID}` 行から取得 → `prep_worker_session_id` に保存
6. **DB upsert**: `prep_worker_status='preparing'` + `prep_worker_spawned_at=now()`
7. session 内で worker prompt が `prep_*` 列を upsert + Phase 完遂で `prep_worker_status='ready'`
8. **Slack DM nudge**: H-1 run の Phase P 末尾で `ready` 達成MTG を まさ専用 Slack DM にまとめて送る

### Worker SKILL の役割 (= spawn された session の中で走る)

`pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` は **spawn された codex session の中で読まれる prompt** として扱う。SKILL 自体は cron では走らない (= H-1 内 Phase P から `codex exec` 経由でしか実行されない)。

Worker 入力:

| source | 内容 |
|---|---|
| `project_meeting_summaries` (upcoming) | 対象MTG基本情報 + 過去同シリーズ |
| `project_meeting_summaries` (held) | 過去同シリーズ全件の `narrative_md` |
| `project_meeting_summaries` (dialogue) | 直近まさえいMTG (= 提案・論点) |
| `project_strategy_signals` | PJ の直近経営シグナル |
| `project_knowledge` | active な PJ ナレッジ |
| `monthly_reports` 直近3件 | PJ 全体文脈 |
| `project_xrl_evidence` | XRL 根拠 |
| `tasks` | 当該 PJ の未完了 task |
| Calendar | event detail + attendees + freebusy |
| Notion | 議事録 page (既存 / 新規) |
| Gmail | 関連 thread |
| Drive | PJ folder + 既存資料 |

Worker 出力 (= `project_meeting_summaries` の対象 row に upsert):

| column | 内容 |
|---|---|
| `prep_readiness_score` | 0-100 |
| `prep_readiness_reasons` | jsonb 内訳 |
| `prep_draft_md` | 着地点 / 背景 / 想定質問 / 持参物 の Markdown draft |
| `prep_drive_asset_id` | `_prep/` フォルダ配下 Drive file ID |
| `prep_notion_page_id` | アジェンダ草案入り Notion 議事録ページ |
| `prep_worker_status='ready'` | Phase 完遂時 |
| `prep_worker_ready_at` | now |

`prep_readiness_reasons.notion_ai_context` には Notion AI Meeting Notes 事前コンテキストの gate 結果を保存する。

| status | 意味 | ready 判定 |
|---|---|---|
| `injected` | 今回 worker が marker 付き context を当日 AI Meeting Notes page へ insert し、再fetchで確認した | 可 |
| `already_present` | marker がすでに当日 page にあった | 可 |
| `not_found` | 当日 AI Meeting Notes page を特定できなかった。`prep_draft_md` に手動貼り付け用 context を残す | 可 |
| `write_failed` | target page は見つかったが insert / 再fetch確認に失敗した。手動貼り付け用 context を残す | 可 |
| `ambiguous` | 候補 page が複数あり決め切れない。過去 page へ誤挿入しない | 可 |
| `wrong_page` | 既存 `prep_notion_page_id` が別日/別MTG page を指す。そこへは追記しない | 可 |
| `skipped_after_meeting` | 会議開始後または開催済み summary があり、事前注入対象外 | 可 |
| `needs_insert` | target page は見つかったが marker 未挿入。insert-only 後の再fetch確認が未完了 | **不可** |

`needs_insert` のまま `prep_worker_status='ready'` にしてはいけない。worker は Notion MCP で append-only insert → page 再fetch → gate 再実行を行い、`injected` / `already_present` または完了扱いの失敗状態へ遷移させる。

### W-Prep Launch (= 週次 visible prep thread 起動レーン、2026-07-09 現行)

H-1 の毎時処理とは別に、まさが水曜15:00 JSTに自分で確認できる前提の **visible prep thread 起動レーン**として Codex automation `w-prep-launch` を置く。W-Prep は DB にある upcoming 行だけを見て完了扱いにしない。必ず Google Calendar の同じ7日窓を直接確認し、DBに無い確定MTGがあれば active/sales PJ へ `source_kinds='upcoming'` のカードを作ってから prep thread 対象に入れる。

W-Prep の事故防止ルール:

- `list_projects` は呼ばない。`projects` table と Calendar title / PJ alias / 既知PJディレクトリだけで対象を解く。
- `create_thread` の target は対象PJディレクトリを優先する。例: SX = `/Users/masa/projects/AMD/SX`、KUTE = `/Users/masa/projects/AMD/kute`、ZMP = `/Users/masa/projects/AMD/ZMP`、CX = `/Users/masa/projects/AMD/CX`。PJディレクトリを確定できない場合だけ `/Users/masa/projects/AMD` を fallback にする。`/Users/masa/projects/AMD/amd-os` は OS DB / spec 参照用であり、prep thread の作業場にしない。
- `create_thread` 前に、会議ごとに DB claim を1件ずつ取る。claim → thread作成 → thread title変更 → pin → DBへ `prep_worker_session_id` / `prep_worker_status='preparing'` 保存まで終えてから次の会議へ進む。
- すでに `prep_worker_session_id` がある行、`prep_worker_status IN ('claiming','preparing','ready')` の行、同じ `calendar_event_id` で別canonical rowが ready/preparing の行は起動しない。
- 立ち上げた thread は必ず `{meeting_title} prep` へ改題し、`set_thread_pinned` でピン留めする。pin できなかった場合は保留として報告し、同じ会議に追加threadを作らない。
- `create_thread` prompt は日本語で書く。英語の見出し・英語指示文にしない。
- root `AGENTS.md` の `@~/knowledge/...` は、この環境では `/Users/masa/projects/knowledge/` へ読み替える。

W-Prep / worker の待機開始点:

- まさが prep thread を開くまでに、worker は (1) これまでのMTGの流れ、(2) 今回のMTGの位置づけと推定着地点、(3) その着地点に到達するためにまさがやるべきこと、の3点を完了しておく。
- 待機時の第一声は、会議冒頭で読み上げるセリフ案ではなく、この3点の完了報告にする。
- 第一声の末尾は必ず「これであってる？どうする？」で止め、まさの判断を待つ。

W-Prep / worker の共有フォルダ資料:

- `projects.drive_folder_id` 直下の `YYMMDD_<MTG名>_prep/` に置く prep 資料の主成果物は、すべて AMD OS のデザインコードに従った HTML に統一する。
- Google Docs / Markdown / Slides / Sheets を主成果物として作らない。表、チェックリスト、提案書、アジェンダ、試算も HTML 内の section / table / callout で表現する。
- HTML は `pwa/src/lib/exec_summary/template.css`、`pwa/src/lib/exec_summary/template_section.html`、`pwa/design/cyber_hud_design_code.md`、`pwa/design/hud_visual_language.md` を参照し、原則 self-contained にする。外部URL、secret、raw本文は入れない。

### Readiness Score 計算

| シグナル | 重み | 取り方 |
|---|---|---|
| アジェンダ存在 | 30 | Notion 議事録ページ本文文字数 + Calendar description 文字数。100↑ で 30、50-99 で 15、<50 で 5 |
| 持参資料 | 25 | `project_documents` + `meeting_assets` + worker 生成 `prep_drive_asset_id` の合計件数。3↑ で 25、1-2 で 12、0 で 0 |
| 前回 next_actions 消化 | 20 | 同シリーズ前回 `next_actions[]` のうち `tasks.status='done'` 比率 × 20 |
| 相手側コンテキスト | 15 | 直近30日 Gmail 往復 + 関連 Notion ページ件数。3↑ で 15、1-2 で 8、0 で 0 |
| アサイン明確 | 10 | `project_meeting_summaries.facilitator_member_id` (MTG 行単位) が NOT NULL かつ対応メンバーが Calendar attendees に含まれていれば 10。`projects.facilitator_member_id` 列は現状 DB に存在しない (2026-06-24 確認) ので参照しない |

合計 = `prep_readiness_score`。80↑ 緑「準備OK」 / 50-79 黄「もう一押し」 / <50 赤「要相談」。

### Nudge (= まさ専用 Slack DM、Phase P 末尾で実行)

H-1 run の Phase P の最後に、その run で `prep_worker_status='ready'` になった MTG を 1本の Slack DM にまとめて送る。

- 送信先: まさ専用 DM (= `members.slack_id` から `is_admin=true` AND `code_name='まさ'` で解決、env には保持しない)
- 既に `prep_concierge_nudged_at` がセットされてる MTG は除外 (= 重複防止)
- 送信完了で `prep_concierge_nudged_at=now()` を upsert
- 形式 (つくよみ口調、月モチーフ):

```
🌙 まさ、prep セッション立ち上げといたよー

📌 KUTE定例 (明日10:00, p25, オンライン)
   readiness 75/100  🟡
   codex で開いてね、待機してるよ

📌 pHydrogen KR訪問 (明後日14:00, p07)
   readiness 35/100  🔴
   codex で開いてね、資料draftは作ったけど着地点要相談

📌 香川大MTG (木曜14:00, p06)
   readiness 60/100  🟡
   codex で開いてね、prep枠は明日13:00-14:30に取っといた
```

- Link 不要 (= まさは codex desktop を自分で起動してそこから入る)
- 「codex で開いてね」だけ書く (= まさ確定: claude / codex の使い分けは廃止、codex 一本化)
- `prep_worker_status='failed'` の MTG は別ブロックに「⚠️ {MTG} の prep セッション起動失敗、手動準備して」と表示

### 配置

- **SKILL (本体)**: `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` (= 既存 H-1 SKILL に Phase P 追加)
- **Worker SKILL (codex exec から読まれる prompt)**: `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md`
- **Notion context ready gate**: `pwa/scripts/l6_prep_notion_context_gate.cjs` (`npm run test:l6-prep-notion-context-gate`)
- **automation 登録**: `~/.codex/automations/amd-os-l6-meeting-flow/automation.toml` (`name = "H-1"` に変更済み、`prompt` に prep Phase 追記済み)

L6 シリーズ (= meeting flow 関連) として既存 `amd-os-l6-meeting-extract` / `amd-os-l6-meeting-reviewer` と並ぶ。`amd-os-l6-meeting-prep-spawner/` と `amd-os-l6-meeting-prep-nudge/` は **昨夜 (2026-06-22) いったん作ったが H-1 統合に再設計したため削除**。

### DB schema (migration 150 + 151)

migration 150 で `project_meeting_summaries` に以下追加済:
- `prep_readiness_score` (int4) / `prep_readiness_reasons` (jsonb)
- `prep_draft_md` (text) / `prep_drive_asset_id` (text) / `prep_notion_page_id` (text)
- `prep_worker_session_id` (text) / `prep_worker_status` (text)
- `prep_worker_spawned_at` / `prep_worker_ready_at` / `prep_concierge_nudged_at` (timestamptz)

migration 151 で追加:
- `prep_calendar_event_id` (text) ← `＋ prep枠` の Calendar event ID。ドラッグ追従の追跡用

廃止 (= 昨夜の Codex Cloud REST API 経路の名残):
- `prep_worker_session_url` (text) は **migration 151 で DROP**。codex desktop は SESSION_ID から直接開けるため URL 不要

### 禁止事項 (prep セッション)

- worker が生成した draft を**自動で Notion 本ページ・Drive 本資料・Calendar event description に書き込まない**。すべて `_prep/` フォルダ / draft Notion page / DB の `prep_*` 列に置き、まさ確認後の手動反映 or 別 route 経由で本反映する。
- worker は Gmail 本送信しない (= 既存 H-1 と同じ)。
- Phase P / Worker は MTG 本体の議事録 (`narrative_md` / `decided` 等) を書き換えない。これは既存 H-1 抽出 Phase A の責務。
- ended / frozen PJ、`source_kinds='upcoming_tentative'` は対象外 (= 既存 H-1 と同じ進捗ベース原則)。
- recurring MTG は series ごとに次回1件のみ。連続 occurrence で複数 session を spawn しない。
- 同じ MTG に複数 session を spawn しない (= `prep_worker_status` で防御)。`failed` のみ再試行可。
- `claude code` で session を spawn しない (= まさ確定で codex 一本化)。
- 定額外トークン課金経路 (= OpenAI API key / Anthropic API key) で worker を動かさない (= `~/.codex/auth.json` の `auth_mode='chatgpt'` を維持)。
