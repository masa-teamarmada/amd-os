# メンバーの日常ワークフロー

AMD メンバー (= 社内常勤 / 副業) が AMD OS で日常的に触る画面と業務の流れ。 SU 側 PI / 創業候補メンバーで「自分の PJ 進捗を見たい」だけの人は [2-1 章 はじめて使う人向け](2-1-member-quick-start.md) を先に読む。

## 日常で開く 4 画面

| 画面 | URL | 何をするか |
|---|---|---|
| マイページ | `/mypage` | 自分が関わる全 PJ の当月業務と報酬を一覧する |
| 月初合意 | `/monthly-agreement` | 今月の遂行内容・報酬条件を確認して合意する |
| 立替申請 | `/reimburse` | 業務で立替えた費用を申請する |
| PJ コックピット | `/project/{projectId}/cockpit` | 担当 PJ の状況・MS 進捗・月次ルーティンを開く |
| 通知レビュー | `/notifications` | 自分宛の修正依頼カード・経営ハイライト確認を捌く |

月初はまず `/monthly-agreement` で今月の遂行対象・想定報酬・条件を確認して合意する。その後は「マイページ / PJ コックピット / 通知レビュー / 立替」を毎日 1 回ずつ見て、未対応カードを片付けるのが日常の最小単位。

## マイページ (`/mypage`)

`/mypage` は **ログインユーザー個人** の画面。 自分が関わる全 PJ の業務と報酬がここに集約される。

### 表示範囲

- **過去 6 ヶ月 + 当月 (= 計 7 ヶ月分)** を表示
- 当月だけデフォルト展開、過去月は chevron タップで展開
- `members.id = ID006` (= りり / NIMS 無償出向) は `/mypage` / `/dashboard` 上の報酬額が `ー` 表示 (= 他メンバーの集計には含めない)

### データ源 (= Supabase 直接クエリ)

| 表示要素 | 主な table |
|---|---|
| email → memberId 解決 | `members` |
| 参加 PJ 一覧 | `project_members` (= `is_active=true` で絞る) |
| PJ 名 | `projects.project_name` |
| 報酬額 (= 正本) | `billing_cycles.member_allocations_json[myMemberId]` |
| アクティブ value plan | `value_plan_cycles` (= `status='fixed'`) |
| MS 一覧 | `value_milestones` (= `is_active=true`) |
| 月次進捗率 | `milestone_monthly_progress` |
| 今週やったこと | `member_activities` (= `source='member_weekly'`) |
| 月初合意状態 | `member_monthly_work_agreements` + 当月 snapshot hash |

報酬計算の正本は GAS `gas-main/059_RewardV2_Ops.js` の `rv2_calcRewardSummary`。 結果は `billing_cycles.member_allocations_json` にキャッシュされ、 PWA は再計算せずこの json を読むだけ。

### 月初合意

`/monthly-agreement` では、当月参加中の PJ、担当 MS / share、当月の到達目標、既存 reward summary から読める想定報酬を確認する。cap / carry-over / stockYen / 条件/前提 / 未確定・要確認などの内部確認情報は本人画面に出さない。`frozen` PJ、当月報酬も担当MSもないPJは表示対象外。報酬キャッシュがあるPJで担当MSの報酬行がない場合は、未確定ではなく `0円` と表示する。合意ボタンを押すと `member_monthly_work_agreements` に表示内容の `snapshot_json` と `snapshot_hash` が保存される。

月中に MS / share / 報酬キャッシュなどが変わって現在の snapshot hash が前回合意時とズレた場合、本人画面と admin 画面に「条件更新あり」と出る。これは報酬計算を変えるものではなく、再確認が必要なサイン。

担当 MS、到達目標、想定報酬、条件/前提が違う場合は、同じ画面の「修正要望」から送る。修正要望は `member_monthly_work_agreement_requests` に保存され、admin/PM側で確認する。

### 「いまやること」生成ルール

`/mypage` の月次ルーティン TODO は、 `project_members` の担当ロールで絞る:

| ロール | 表示される TODO |
|---|---|
| `is_pm=true` の PJ | 請求額確定 / 報告会日程調整 / 月次報告書 FIX / 立替精算確認 / 請求書発行・送付 (= そのPJの月次ルーティン全部) |
| `is_pl=true AND is_pm=false` の PJ | PL 承認対象である「請求額確定」のみ |
| 参加メンバーのみ (= `is_pm=false AND is_pl=false`) | 月次ルーティン TODO は出さない |

admin 全体の確認 (= 全 SU 横断の請求マトリクス等) は `/admin/billing` 等で扱い、 `/mypage` には混ぜない。

### 週次活動 (= member_activities source=member_weekly)

`/api/cron/member-weekly-activities` が毎日 18:00 JST に発火 (= GAS 154 経由)、 前日 18:00〜当日 18:00 の 24h を抽出する。 抽出源:

- Gmail (= `SENT` / `DRAFT`、 または社内メンバーが送信者の `source_cache` 行)
- 共有メンバー Calendar (= `calendar.readonly` scope で許可済のメンバーカレンダー)
- `source_cache` の社内通信
- `project_meeting_summaries` の参加者リスト

PJ 判定は、 PJ 専用 email / PJ 名 / client 名 / `project_knowledge(category='alias', status='active')` (= PWA runtime mirror、 alias 正本は GAS 側の `CFG_PJAlias`)。

社内メンバー 2 名以上の共同作業で PJ が特定できないものは `p00` (= AMD 全体) として保存される。

`/mypage` は今週 (= 月-日 JST) の行を表示する。 マイページに自分の活動が出ないときは、 Calendar の共有設定または `members.google_calendar_status` を確認する。

## 立替申請 (`/reimburse`)

業務関連の立替費用 (= 出張 / イベント参加 / 書籍 / 外注費 等) を申請する画面。

### 入力項目

| 項目 | 列 | 備考 |
|---|---|---|
| 日付 | `reimbursements.date` | 領収書日付 |
| カテゴリ | `reimbursements.category` | 交通費 / 会議費 / 書籍 / 接待 / その他 |
| 金額 | `reimbursements.amount` | 税込 |
| 税率 | `reimbursements.tax_rate` | 0.10 / 0.08 / 0.00 |
| 用途 | `reimbursements.description` | 何のための支出か |
| PJ 紐付け | `reimbursements.project_id` | 該当 PJ。 AMD 全体は `p00` |
| 領収書 | `reimbursements.receipt_storage_paths` / `receipt_file_names` | Supabase Storage への path 配列 |
| 交通費の場合 | `transport_mode` / `transport_from` / `transport_to` / `transport_trip` | mode (= 電車 / タクシー 等)、 区間、 片道/往復 |

### 承認フロー

| 状態 | `reimbursements.status` | アクター |
|---|---|---|
| 申請 | `submitted` | メンバーが POST |
| PM 承認 | `pm_approved` (= `pm_approved_by` / `pm_approved_at` set) | PJ の `project_members.is_pm=true` メンバー |
| admin 承認 | `admin_approved` (= `admin_approved_by` / `admin_approved_at` set) | まさ等 admin |
| 支払済 | (= 月次支払に合算済) | `billed_ym` set |

承認された立替は、 該当月の `billing_cycles.member_allocations_json` の reward summary に上乗せされる (= 報酬 + 立替分を合算した金額が支払通知書に載る)。

## PJ コックピット (`/project/{projectId}/cockpit`)

担当 PJ ごとに 1 画面。 詳細は [2-3 章 PJ コックピットの見方](2-3-pj-cockpit.md)。 メンバー視点で日常的に使うのは:

- 上部の PJ Status (= MS 進捗バー / 経営ハイライト)
- 右カラム月次ルーティン (= `is_pm=true` のメンバーのみクリック導線が見える)
- MTG サマリ tab (= 自分が出た MTG の決定・進捗・next action)
- 経営ハイライト tab (= 自分が confirm 担当の signal、 まさえいMTG で確定されたもの)

## MTG 終了後に自動で起きること (= 2026-05-27 拡張)

メンバーが Calendar に登録した MTG が終わると、 60-180 分後に **Codex Desktop automation `amd-os-l6-meeting-flow`** (= Windows MMO PC、 平日土日 09:00-21:00 毎時 0 分発火) が以下を自動で実行する。 該当 MTG event が無い時間帯は即終了 (= 早期 exit) なので深夜にも余計な処理は走らない。 詳細は [8-3 章 § H-1 MTG サマリ + フロー](8-3-l2-extraction-routines-spec.md)。

1. **議事録抽出 + 高品質化** (= Phase A): Calendar event 1 個ごとに、 Notion 議事録 / Gmail report mail / Drive Docs / Slack thread の 4 ソースを横断 fetch → `narrative_md` を `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` の固定5見出しで生成。箇条書きではなく、そのMTGに参加していなかったメンバーでも背景から次の動きまで分かる文章として `project_meeting_summaries` に upsert
2. **次 MTG カード生成** (= Phase C): 次 MTG 用 page を Notion 議事録 DB に「<日付> <PJ name> 定例 (draft)」 で自動作成、 「📋 次 MTG 準備情報」 toggle + 「📝 議事録」 toggle 構造。 Calendar event も自動作成、 参加者を attendees に招待
3. **Slack nudge** (= Phase D): 担当メンバーに mention 付きで Slack 投稿、 1 thread に tasks 並ぶ
4. **TODO → cockpit + 自分の Calendar に作業枠** (= Phase H): MTG で発生した TODO は cockpit の TODO 欄に並び、 さらに **自分 + PL の Google Calendar に「+<PJコード> <task>」 タイトルで作業枠が空き時間に勝手に入る** (= estimated_hours は LLM が推定、 資料作り 2h / 軽い調査 1h / アポ調整 0.5h / 設計レビュー 1.5h / 重資料 3-4h)。 例: `+SX 顧客 X 向け Pitch deck 修正`
5. **自動資料生成** (= Phase I): タスクのうち「議事録 + monthly_reports + 既存 Drive 資料で前提が揃う」 AND 「成果物が text/markdown/Google Docs/Slides/Sheets」 と判定されたものは、 automation 内で資料 draft を自動生成 → Drive 保存 (= 命名 `<YYYY-MM-DD>_<PJcode>_<task slug>_draft.<ext>`) → Calendar 作業枠の description に「📎 資料 draft: <drive_url>」 が自動追記
6. **ファシリ役メール下書き** (= Phase J): ファシリ役 (= `projects.facilitator_member_id`、 無ければ `primary_owner_member_id`) の Gmail に follow-up メールの **下書き** が自動作成される。 本文構成は (1) 挨拶 / (2) 本日サマリ / (3) 決まったこと / (4) 次回までの宿題 / (5) 次回 MTG 概要 / (6) 添付資料案内 / (7) 結び の 7 セクション。 当日シェアした Drive 資料は exportLinks で PDF 化して添付。 **本送信は禁止** = ファシリが本人 Gmail で確認してから手動送信する
7. **当日処理** (= Phase G): MTG 当日終了後、 元々 draft だった次 MTG カードの「📝 議事録」 toggle 内に narrative_md が自動 insert され、 page title から `(draft)` が削除される。 「📋 次 MTG 準備情報」 toggle は折りたたまれる

⚠️ **注意**: 現状 LLM は **outbox JSON を吐くまで**。 Notion / Calendar / Drive / Gmail への実反映は別の non-LLM helper (`apply-outbox`) を実装するまでは保留 (= 2026-05-27 時点未実装)。

## 通知レビュー (`/notifications`)

通知のカード一覧。 詳細は [3-3 章 通知・修正依頼・正本反映ゲート](3-3-notifications-and-tsukuyomi.md) と [8-2 章 通知レビュー UI 仕様](8-2-notification-review-and-strategy-signals-spec.md)。

メンバーが日常で捌くのは:

- **MS 進捗の修正依頼カード** (= つくよみが推定した % が違うので直して、というレビュー依頼)
- **PJ ナレッジ追加候補カード** (= D-3 が新しく抽出した PJ 知識、 確認 → confirm/reject)
- **MTG サマリ修正依頼カード** (= 議事録の decided/progress が違う、 narrative_md を直して、 等)
- **経営ハイライト確認カード** (= D-6 が抽出した signal、 まさえいMTG にかける前のレビュー)

カードを confirm/reject すると、 該当の `l2_feedbacks` 行が `status='active'` で残り、 次回 subscription automation 発火時に prompt に注入される (= 同じ間違いを繰り返さない)。

## 月次の流れ (= メンバー視点)

| 月 N の流れ | やること |
|---|---|
| N 月 毎日 | `/mypage` の今週活動を確認、 漏れがあれば Calendar / Gmail で補足 |
| N 月 月初 | `/monthly-agreement` で当月の遂行内容・報酬条件を確認し、合意する |
| N 月 月中 | 担当 PJ コックピットで MS 進捗 / signal を確認、 修正依頼があれば `/notifications` で処理 |
| N+1 月 第 1 営業日 | `/mypage` の前月集計を確認、 報酬額が想定通りか member_allocations_json をチェック |
| N+1 月 月末まで | 立替がある月は `/reimburse` で N 月分を申請、 PM/admin 承認まで通す |
| N+1 月 報告会日まで | `is_pm=true` の PJ で月次報告書を FIX、 請求書発行・送付 (= [01.5 月次ルーティン](2-3-pj-cockpit.md)) |

## よくある困りごと

| 症状 | 確認場所 |
|---|---|
| `/mypage` に自分が出ない | `members` テーブルに email 登録あるか、 `google_calendar_status='connected'` か |
| 当月の報酬額が出ない | `billing_cycles.member_allocations_json` に当該 ym 行があるか、 `rv2_calcRewardSummary` 実行済か |
| 立替が承認されたのに当月支払に乗らない | `reimbursements.billed_ym` set されているか、 該当 ym の `billing_cycles` が `status` 進んでいるか |
| 月次ルーティン TODO が出ない | `project_members.is_pm` / `is_pl` フラグを確認 (= ただの参加メンバーには TODO が出ないのが仕様) |
| 修正依頼カードが消えない | `l2_feedbacks.status` が `active` のまま、 confirm/reject すると `resolved` になる |

## 関連

- マイページ設計: [`pwa/design/mypage.md`](../design/mypage.md)
- 月次ルーティン: [`pwa/design/routine.md`](../design/routine.md)
- 報酬計算正本: `gas-main/059_RewardV2_Ops.js`
- 6-6 章 [Member Ops / Billing / Prompt](6-6-member-billing-prompts-spec.md) (= mypage / reimburse / admin billing / prompt 管理の開発者向け仕様)
- 2-6 章 [admin オペ](2-6-admin-ops.md) (= 月次ルーティン早見表)
- 3-3 章 [通知・修正依頼・正本反映ゲート](3-3-notifications-and-tsukuyomi.md)
