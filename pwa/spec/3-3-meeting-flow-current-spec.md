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
- PJ cockpit UI は `source_kinds='upcoming'` だけでなく、`upcoming+calendar+manual-prep` のような `+` 区切り拡張値も `upcoming` token を含めば日時確定済み予定MTGとして扱う。`upcoming_tentative` token がある場合だけ日程調整中扱いにする。
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
- freebusy を見ずに重複枠を作らない。
- 前提データが足りない資料を強引に生成しない。
- 旧 GAS 153 / 074 を定期 writer として復活させない。

## MTG Prep Worker (= 自動準備セッション生成)

> **この節は何か**: まさが「明日 MTG あるけど準備してない」状況を、OS が前夜〜当朝に **自動で MTG専属の準備セッション (worker)** を起動し、文脈ロード・着地点 draft・資料 draft・想定質問まで先に終わらせて待機する仕組み。まさは Slack DM の link を tap するだけで「もう全部知ってる前提の対話」から始められる。

### 設計の核 (2026-06-22 まさ確定)

- **codex/claude code session を毎回起動して「背景はこうで…」と説明するコストを廃止する**。OS が先に session を spawn し、文脈ロード済みの状態で待機する。
- **つくよみは判断しない**。worker spawn と Slack DM nudge だけが役目。prep の中身を作るのは worker (= 1 MTG 1 session)。
- **1 MTG = 1 worker session**。複数 MTG をまとめた俯瞰 session は作らない (= context 汚染回避)。
- **過去同類 MTG の議事録全 read を前提**。着地点は「過去の流れを踏まえて」推定する。

### 構成 (3 SKILL)

| SKILL | 実行場所 | cron | 役割 |
|---|---|---|---|
| `amd-os-l6-meeting-prep-spawner` | Codex Cloud automation | 毎朝 06:30 JST | 翌48h の upcoming MTG 拾って 各MTG ごとに worker を Codex Cloud automation として動的 spawn |
| `amd-os-l6-meeting-prep-worker` | Codex Cloud automation (動的) | spawn 即発火 (1回限り) | 1MTG 専属。文脈ロード→着地点draft→Drive資料draft→Notion議事録draft→readiness 計算→DB upsert→session を待機保持 |
| `amd-os-l6-meeting-prep-nudge` | Codex Cloud automation | 毎朝 07:30 JST | worker_status='ready' の MTG を Slack DM (まさ専用) でまとめ通知。session URL + readiness pill + 空き枠/見積 |

### Worker 入力

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

### Worker 出力 (= `project_meeting_summaries` の upcoming row に upsert)

| column | 内容 |
|---|---|
| `prep_readiness_score` | 0-100。アジェンダ30 + 持参資料25 + 前回next_actions消化20 + 相手側コンテキスト15 + アサイン明確10 |
| `prep_readiness_reasons` | jsonb. 各要素の点数と根拠 (= 「アジェンダ: 25/30 (Notion page あり、章立て確認済)」等) |
| `prep_draft_md` | 着地点 / 背景 / 想定質問 / 持参物 の Markdown draft |
| `prep_drive_asset_id` | Worker が生成した資料 draft の Drive file ID (= `PJfolder/YYMMDD_MTG名_prep/`) |
| `prep_notion_page_id` | Worker が作成した議事録ページ (アジェンダ草案入り) |
| `prep_worker_session_id` | Codex Cloud automation run ID |
| `prep_worker_session_url` | まさが tap する URL (= Codex Cloud session への直接 link) |
| `prep_worker_status` | `spawning` / `preparing` / `ready` / `failed` |
| `prep_worker_spawned_at` | spawner が起動した時刻 |
| `prep_worker_ready_at` | worker が待機状態に到達した時刻 |
| `prep_concierge_nudged_at` | nudge cron が Slack DM 送信した時刻 (= 重複送信防止) |

### Readiness Score 計算

| シグナル | 重み | 取り方 |
|---|---|---|
| アジェンダ存在 | 30 | Notion 議事録ページ の本文文字数 + Calendar description 文字数。100 文字以上で満点、50-99 で半分 |
| 持参資料 | 25 | `project_documents` / `meeting_assets` の当該PJ直近資料 ref 数。3件以上で満点 |
| 前回 next_actions 消化 | 20 | 同シリーズ前回 `next_actions[]` のうち `tasks.status='done'` 比率 |
| 相手側コンテキスト | 15 | 直近30日のメール往復 + 関連 Notion ページ |
| アサイン明確 | 10 | `projects.facilitator_member_id` + Calendar attendees 整合 |

- 80↑ = 緑「準備OK」
- 50-79 = 黄「もう一押し」
- <50 = 赤「まだ何もない」

### Spawner 動作

```sql
-- spawner が拾う対象
SELECT *
FROM project_meeting_summaries
WHERE source_kinds LIKE '%upcoming%'
  AND source_kinds NOT LIKE '%upcoming_tentative%'
  AND meeting_start_at BETWEEN now() AND now() + interval '48 hours'
  AND (prep_worker_status IS NULL OR prep_worker_status = 'failed')
  AND projects.status IN ('active', 'sales')  -- ended/frozen は対象外
```

- 各 MTG について Codex Cloud REST API で動的 automation を 1 回限り登録する (= `amd-os-l6-prep-{meeting_id_hash}` 命名)
- 動的 automation の指示文は `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md を読んで meeting_id={...} project_id={...} で実行` のみ
- spawn 完了したら `prep_worker_status='spawning'` + `prep_worker_session_id` + `prep_worker_session_url` を upsert
- recurring MTG は series ごとに次回1件だけ。`source_kinds='upcoming_tentative'` は対象外
- spawner 自体は LLM を呼ばない (= deterministic)

### Nudge 動作

- 07:30 JST 発火
- `prep_worker_status='ready'` かつ `prep_concierge_nudged_at IS NULL` かつ `meeting_start_at BETWEEN now() AND now() + interval '48 hours'` を全件拾う
- まさ専用 Slack DM 1本にまとめて投げる (= MTG 1件ごとに別DMは送らない)
- DM 形式は つくよみ口調:
  ```
  🌙 まさ、明日と明後日の MTG prep worker、もう動かしといたよー
  📌 KUTE定例 (明日10:00, p25, オンライン) readiness 75/100
     worker準備完了 → [▶ 開く]
  📌 pHydrogen KR訪問 (明後日14:00, p07) readiness 35/100 ⚠️
     worker準備完了 → [▶ 開く] (資料draftは作ったけど着地点要相談)
  今日のまさ空き枠: 14:00-15:30, 17:00-18:00 (合計2.5h)
  prep見積: KUTE 0.5h + pHydrogen 2h = 2.5h ✅ 収まるよ
  ```
- 空き枠は Calendar freebusy + busy window から計算 (= まさの個人カレンダーも含む。既存 H-1 で抽出済み)
- nudge 完了したら `prep_concierge_nudged_at=now()` を upsert
- `prep_worker_status='failed'` の MTG は別ブロックに「⚠️ worker起動失敗、手動でclaude code開いて」と表示

### Worker session URL

- Codex Cloud automation の run page URL を保存 (= `https://codex.cloud.openai.com/runs/{run_id}` 相当)
- まさが tap → そのまま session に入る → worker の第一声 (= prep_draft_md の冒頭が代わりに表示される) から対話継続
- session は worker 終了後も Codex Cloud 上で見える状態に残る (= idle session として保持)

### 配置

- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-spawner/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md`
- `pwa/scheduled-tasks/amd-os-l6-meeting-prep-nudge/SKILL.md`

L6 シリーズ (= meeting flow 関連) として既存 `amd-os-l6-meeting-extract` / `amd-os-l6-meeting-reviewer` と並べる。

### 禁止事項 (prep worker)

- worker が生成した draft を**自動で Notion 本ページ・Drive 本資料・Calendar event の description に書き込まない**。すべて draft / 別ファイル / DB の `prep_*` 列に置き、まさ確認後の手動反映 or 別 route 経由で本反映する。
- worker は Gmail 本送信しない (= 既存 H-1 と同じ)。
- spawner / nudge / worker は **MTG 本体の議事録 (`narrative_md` / `decided` 等)** を書き換えない。これは既存 H-1 抽出 routine の責務。
- `prep_worker_status='ready'` 未達でも、ある程度の draft が DB にあれば nudge には出す (= ただし「準備中」chip 付き)。完全失敗のみ `failed` 扱い。
- recurring MTG の同シリーズで連続2回連続 worker が走らないよう、shed cycle ごとに次回1件のみ対象とする (= 既存 `recurring_series_future_occurrence` skip に従う)。
