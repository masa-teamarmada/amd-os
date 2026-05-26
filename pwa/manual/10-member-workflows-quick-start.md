# メンバーの日常ワークフロー

AMD メンバー (= 社内常勤 / 副業) が AMD OS で日常的に触る画面と業務の流れ。 SU 側 PI / 創業候補メンバーで「自分の PJ 進捗を見たい」だけの人は [08 章 はじめて使う人向け](08-member-quick-start.md) を先に読む。

## 日常で開く 4 画面

| 画面 | URL | 何をするか |
|---|---|---|
| マイページ | `/mypage` | 自分が関わる全 PJ の当月業務と報酬を一覧する |
| 立替申請 | `/reimburse` | 業務で立替えた費用を申請する |
| PJ コックピット | `/project/{projectId}/cockpit` | 担当 PJ の状況・MS 進捗・月次ルーティンを開く |
| 通知レビュー | `/notifications` | 自分宛の修正依頼カード・経営ハイライト確認を捌く |

「とりあえずこの 4 つを毎日 1 回ずつ見て、未対応カードを片付ける」が日常の最小単位。

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

報酬計算の正本は GAS `gas-main/059_RewardV2_Ops.js` の `rv2_calcRewardSummary`。 結果は `billing_cycles.member_allocations_json` にキャッシュされ、 PWA は再計算せずこの json を読むだけ。

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

担当 PJ ごとに 1 画面。 詳細は [01 章 PJ コックピットの見方](01-pj-cockpit.md)。 メンバー視点で日常的に使うのは:

- 上部の PJ Status (= MS 進捗バー / 経営ハイライト)
- 右カラム月次ルーティン (= `is_pm=true` のメンバーのみクリック導線が見える)
- MTG サマリ tab (= 自分が出た MTG の決定・進捗・next action)
- 経営ハイライト tab (= 自分が confirm 担当の signal、 まさえいMTG で確定されたもの)

## 通知レビュー (`/notifications`)

通知のカード一覧。 詳細は [22 章 通知・修正依頼・正本反映ゲート](22-notifications-and-tsukuyomi.md) と [28 章 通知レビュー UI 仕様](28-notification-review-and-strategy-signals-spec.md)。

メンバーが日常で捌くのは:

- **MS 進捗の修正依頼カード** (= つくよみが推定した % が違うので直して、というレビュー依頼)
- **PJ ナレッジ追加候補カード** (= L2 ④ が新しく抽出した PJ 知識、 確認 → confirm/reject)
- **MTG サマリ修正依頼カード** (= 議事録の decided/progress が違う、 narrative_md を直して、 等)
- **経営ハイライト確認カード** (= L2 ⑨ が抽出した signal、 まさえいMTG にかける前のレビュー)

カードを confirm/reject すると、 該当の `l2_feedbacks` 行が `status='active'` で残り、 次回 Cloud routine 発火時に prompt に注入される (= 同じ間違いを繰り返さない)。

## 月次の流れ (= メンバー視点)

| 月 N の流れ | やること |
|---|---|
| N 月 毎日 | `/mypage` の今週活動を確認、 漏れがあれば Calendar / Gmail で補足 |
| N 月 月中 | 担当 PJ コックピットで MS 進捗 / signal を確認、 修正依頼があれば `/notifications` で処理 |
| N+1 月 第 1 営業日 | `/mypage` の前月集計を確認、 報酬額が想定通りか member_allocations_json をチェック |
| N+1 月 月末まで | 立替がある月は `/reimburse` で N 月分を申請、 PM/admin 承認まで通す |
| N+1 月 報告会日まで | `is_pm=true` の PJ で月次報告書を FIX、 請求書発行・送付 (= [01.5 月次ルーティン](01-pj-cockpit.md)) |

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
- 26 章 [Member Ops / Billing / Prompt](26-member-billing-prompts-spec.md) (= mypage / reimburse / admin billing / prompt 管理の開発者向け仕様)
- 04 章 [admin オペ](04-admin-ops.md) (= 月次ルーティン早見表)
- 22 章 [通知・修正依頼・正本反映ゲート](22-notifications-and-tsukuyomi.md)
