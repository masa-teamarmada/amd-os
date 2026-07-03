# 月初タスク・報酬合意 仕様

> **この章は何か**: メンバーが月初に OS 上で当月の遂行対象、予定到達点、予定報酬を確認し、合意 snapshot を残すフローの current contract。

## Current Truth

| item | contract |
|---|---|
| member route | `/monthly-agreement?ym=YYYYMM` |
| mypage entry | `/mypage` の当月報酬カード直下に「今月の遂行内容・報酬条件」カードを表示 |
| admin route | `/admin/monthly-work-agreements?ym=YYYYMM` |
| member API | `GET /api/monthly-work-agreement?ym=YYYYMM&memberId=IDxxx` |
| agree API | `POST /api/monthly-work-agreement/agree` |
| revision request API | `POST /api/monthly-work-agreement/request-revision` |
| admin API | `GET /api/admin/monthly-work-agreements?ym=YYYYMM` |
| app entry gate | 未合意 / 条件更新ありで表示対象PJがある場合、開いた画面を背景に残したまま月初合意の必須モーダルを前面表示。背景クリックや閉じる操作では先送りできず、合意完了後だけ閉じる |
| DB | `member_monthly_work_agreements`, `member_monthly_work_agreement_requests`, `member_monthly_work_agreement_payout_overrides` |
| migration | `pwa/scripts/migrations/139_member_monthly_work_agreements.sql`, `140_member_monthly_work_agreement_requests.sql`, `145_member_monthly_work_agreement_payout_overrides.sql` |

## Scope

月初合意は **月初計画の表示・合意 snapshot・未合意管理レイヤー**。報酬計算の入力や支払確定額を変更しない。

- 予定報酬は `/admin/payouts` の支払予定 (`reward_summary_json.members[].totalPay`) ではなく、当月の月次予算を当月の予定MS消化ptと担当shareで配分した **月初合意用の予定額** として算出する。
- `value_plan_cycles` / `value_milestones` / `milestone_responsibility` / `milestone_monthly_progress` から、当月の遂行対象、予定到達点、担当shareを読む。
- 進捗は `milestone_monthly_progress` の非確定行を正本にせず、D-2と同じアンカー方式の月割りデフォルトをコード計算する。PM locked 行があればそれをアンカーにする。
- `project_members` と `projects` から当月 active member / active project member を解く。`projects.status='frozen'` / `project_freeze_periods.status='active'` / `projects.freeze_from_ym <= ym` は報酬が発生しないため対象外。例: CTB p06 は `status='active'` だが 202605 から freeze overlay のため 202606 月初合意に出さない。
- `members.exclude_from_payout_notice=true` かつ `is_admin=false` のメンバーは月初合意対象外。例: りり / ID006 (NIMS 無償出向) と あき / ID029 (無報酬稼働) は報酬を受け取れないため `not_required` とし、admin一覧・合意保存・修正要望保存から外す。`is_admin=true` のメンバーは、テスト確認のため支払通知対象外でも月初合意対象に含める。
- 合意時点で本人へ表示した内容を `snapshot_json` と `snapshot_hash` で保存する。
- snapshot hash が変わったら本人/adminに「条件更新あり」と表示し、再合意対象にする。
- 報酬キャッシュを再計算しない。通常 GET は読むだけ。
- cap、carry-over、条件/前提、未確定・要確認などの精算/確認内部情報は本人向け月初合意画面に出さない。例外として、`reward_summary_json.members[].stockYen > 0` の場合だけ、当月支払とは分けて翌月以降へ繰り越される残額が本人に伝わるよう `今月末未払い残（今月は支払われない）` を read-only 表示する。月初合意は「どのPJのどのMSへコミットし、当月どこまで到達すべきか」と「その対価としての予定報酬」を示す。
- 当月報酬も担当MSもないPJは、月初合意の「何をすればいくら」に答えないため本人画面から非表示にする。

## Payout Gate

`/admin/payouts` は、支払対象の `member × source_ym × project` ごとに月初合意状態を read し、未合意のまま支払データ同期・支払通知書PDF生成・通知メール送信・送付済み確定へ進ませない。

2026年6月以前の稼働月 (`source_ym <= 202606`) は月初合意導入前/移行月のため、支払 gate 上は `agreed` 扱いで通す。6月は契約改定前かつシステム未完成期間だったため、合意条件として支払いを止めない。実際の `member_monthly_work_agreements` 行を偽造せず、gate の理由を「導入前/移行月のため合意済み扱い」として保持する。2026年7月以降の稼働月から通常どおり `pending` / `stale` / `revision_requested` を blocker にする。

移行月扱いの行だけで blocker が無い場合、`/admin/payouts` の gate panel は個別メンバー一覧を出さず、対象支払行数と「移行月スキップ」の summary だけを表示する。支払 gate の対象はあくまで「支払が発生する `member × source_ym × project`」なので、支払行が無い他メンバーを「合意済み一覧」に混ぜて見せない。

| status | meaning | payout behavior |
|---|---|---|
| `not_required` | 支払額 0、非adminの通知対象外、`frozen` / `lost` / `freeze_from_ym` 到達後 / active期間外PJなど | gate 対象外 |
| `pending` | 支払対象だが本人の active `agreed` row が無い、または支払対象PJが snapshot に無い | block |
| `agreed` | latest active `agreed.snapshot_hash === currentHash` | allow |
| `agreed` (移行月扱い) | `source_ym <= 202606` | allow。導入前/移行月なので合意済み扱い |
| `stale` | latest active `agreed` はあるが `snapshot_hash !== currentHash` | block (`条件更新あり`) |
| `revision_requested` | `member_monthly_work_agreement_requests.status='open'` が member全体または当該PJにある | block |
| `admin_override` | admin が理由を入れて server-side action を例外実行し、監査ログが残った | allow for that action |

gate は `/admin/payouts` の server action で実行する。UI の警告だけにはしない。

- `POST /api/admin/payouts` (`支払データ同期`)
- `PATCH /api/admin/payouts` の `issue_notice_pdf` / `preview_notice_pdf`
- `PATCH /api/admin/payouts` の `bulk_issue_notice_pdf` / `bulk_preview_notice_pdf`
- `PATCH /api/admin/payouts` の `send_notice_email`
- `PATCH /api/admin/payouts` の `update_notice` のうち `markSent=true`
- `POST/GET /api/cron/payout-notice-prebuild` は blocker 付き member を PDF 生成対象から外し、`agreement_gate` failure として返す

admin override は `agreementOverrideReason` が 8 文字以上かつ actor email がある場合だけ有効。override は `member_monthly_work_agreement_payout_overrides` に append-only で保存し、対象 action、理由、actor、支払月、稼働月、member、project、blocker status、snapshot hash / current hash、request id を残す。override は報酬計算や合意 row を変更しない。

`/admin/payouts` は gate と同じ画面で、報酬債務台帳を表示する。`stockYen` を単独の支払予定として見せず、`member × PJ × 稼働月` ごとに `carryInYen + (grossDueYen - carryInYen) - totalPay = stockYen` を表示し、原因を `契約前発生` / `繰越+今月発生` / `繰越のみ` / `cap不足` に分類する。先12か月表は `キャッシュ支払` / `会社留保` / `報酬債務` / `cap超過チェック` の4表に分け、会社留保を支出扱いしない。報酬債務は月末残高なので、12か月合計ではなく各月残・ピーク・最終月残で読む。すべての plan cycle は終了月に `stockYen = 0` へ閉じることが必須だが、報酬計算側で最終月に自動精算枠を足してゼロに見せることは禁止する。最終月に `stockYen > 0` が残る場合、または `PJ予算 > (クライアント支払 - バッファ) × 65%` の原資超過がある場合は、`/admin/ms-overview` の保存前検算でクライアント支払額・バッファ・原資上限・PJ予算・メンバー支払額・不足額を表示し、MS編集保存を `blocked` にする。`/admin/ms-overview` は閲覧モードで cycle を開いた時点でも現行 MS 案を検算し、既存状態が `blocked` なら MS 一覧の上に赤い `MS編集停止中` 表示を出す。

### 契約レイヤー

業務委託契約上は、OS 月次合意を毎月の個別発注 / SOW / 条件確認として扱う前提で設計する。ただし hard guard を本番運用の法的拘束力として使うには、契約改定・メンバー同意・法務レビューが前提。この仕様は運用/システム設計であり、AI が法的助言として断定するものではない。

### 予定報酬の算定

```text
monthlyBudgetYen =
  billing_cycles.budget_yen                       # 明示値。0 も有効
  or projects.fee_amount × 0.65                   # monthly_fixed fallback
  or value_plan_cycles.budget_yen / cycleMonths   # cycle budget fallback

msMonthlyConsumedPt = points × max(0, currentDefaultCumPct - prevDefaultCumPct) / 100
memberEarnedPt      = msMonthlyConsumedPt × active-member normalized plannedShare
projectEarnedPt     = Σ all active members memberEarnedPt
msPlannedRewardYen  = round(monthlyBudgetYen × memberEarnedPt / projectEarnedPt)
projectPlannedRewardYen = Σ msPlannedRewardYen
```

これは月初合意用の「今月そのMSにコミットする対価」。`reward_summary_json` の capped 支払予定、carryIn、stockYen、現時点の支払確定状態は予定報酬計算には使わない。ただし SX のように `totalPay=0` でも `stockYen` が発生するケースを本人が見落とさないよう、表示専用に `totalPay` / `stockYen` / `grossDueYen` を読む。支払済み/保存済みの過去分は `monthly_reward_payout(project_id, ym, member_id).total_pay` を優先し、MS編集後に過去月の支払額表示が再計算値へ揺れないようにする。保存済み明細が無い protected 月は `billing_cycles.reward_summary_json` の保護済み cache を fallback として読む。`支払済み実績` として集計するのは、保存済み明細に加えて `billing_cycles.reward_paid_by` が `freee_wallet_txn_verified:` の証跡を持つ行だけ。`reward_paid_at` だけがある行は `要照合` として別枠にし、実績にも未来予定にも混ぜない。

## Snapshot Contract

`snapshot_json` は安定 JSON。hash に揺れる時刻を含めない。

| field | meaning |
|---|---|
| `schemaVersion` | `monthly_work_agreement.v1` |
| `ym` | 業務月 `YYYYMM` |
| `member` | `memberId`, `codeName`, `email`, `isAdmin` |
| `projects[]` | 当月参加中PJ |
| `projects[].milestones[]` | 担当MS、share、task description、progress、conditions |
| `projects[].expectedRewardYen` | 月初合意用の予定報酬 (= 当月月次予算 × 当月予定MS消化pt × share) |
| `projects[].payoutYen` / `stockYen` / `grossDueYen` / `carryInYen` | 表示専用の今月支払額 / 今月末未払い残 / 支払対象額 / 前月繰越。支払額は `monthly_reward_payout` の保存済み明細を優先し、無ければ `reward_summary_json.members[]` を読む。予定報酬計算や合意 gate 判定には使わない |
| `projects[].payoutSchedule[]` | 稼働月ごとの `新規発生` / `支払対象` / `支払額` / `支払後残`。各行は税抜の `totalPayYen` と、freee銀行出金と照合する税込 `totalPayTaxIncludedYen` を持つ。`amountSource` (`actual_paid` / `unverified_paid` / `payout_snapshot` / `protected_reward_cache` / `reward_cache`) で、支払済み実績・実績未照合・保存済み・保護済み・予定を区別する |
| `projects[].reviewReasons[]` | 月次予算未設定、value plan未設定、MS/share未設定など admin 向け確認事項 |
| `totals` | PJ数、予定報酬合計、支払済み実績合計、これから支払予定合計、今月末未払い残合計、admin向け確認事項数 |

`currentHash = sha256(stableJson(snapshot_json))`。`latestAgreement.snapshotHash !== currentHash` のとき `needs_reagreement`。

## DB Contract

`member_monthly_work_agreements`:

| column | contract |
|---|---|
| `ym` / `member_id` | 合意対象 |
| `status` | `agreed` / `superseded` / `revoked` |
| `agreed_at` / `agreed_by` | 合意時刻と actor email |
| `snapshot_json` | 合意時表示内容 |
| `snapshot_hash` | 合意時の hash |
| `current_hash` | supersede 時などに保持する現在 hash |
| `invalidated_at` / `invalidation_reason` | `superseded` / `revoked` の理由 |

同一 `ym, member_id` の active `agreed` は 1 件だけ。再合意時は旧 `agreed` を `superseded` に更新してから新 snapshot を `agreed` で insert する。

`member_monthly_work_agreement_requests`:

| column | contract |
|---|---|
| `ym` / `member_id` / `project_id` | 修正要望の対象。`project_id` が null の場合は全体 |
| `request_type` | `scope_or_goal` / `reward` / `condition` / `other` |
| `body` | 本人が書いた修正要望 |
| `status` | `open` / `resolved` / `rejected` |
| `snapshot_hash` | 要望送信時に本人が見ていた current hash |
| `resolved_at` / `resolved_by` / `resolution_note` | admin/PM 側の処理結果 |

`member_monthly_work_agreement_payout_overrides`:

| column | contract |
|---|---|
| `payment_ym` | `/admin/payouts` の支払月 |
| `source_ym` | 報酬明細の稼働月 (`billing_cycles.ym` / `monthly_reward_payout.ym`) |
| `member_id` / `project_id` | override 対象 |
| `target_action` | 例外実行した server-side action |
| `blocker_status` | `pending` / `stale` / `revision_requested` |
| `reason` / `actor_email` / `created_at` | admin override の監査情報 |
| `snapshot_hash` / `current_hash` / `request_id` | どの blocker を越えたかを再現する補助キー |
| `metadata_json` | member/project label、支払額、blocker reason など |

## Authority / RLS

| actor | read | write |
|---|---|---|
| 本人 | 自分の合意 row | 自分の合意 insert |
| 本人 | 自分の修正要望 row | 自分の修正要望 insert |
| admin | 全件 read / update | admin API で一覧確認、修正要望の処理 |
| service_role | 全件 | API route 経由の insert/update |
| anon | 不可 | 不可 |

API route は logged-in user を `members.email` で解決する。本人以外の合意保存は禁止。admin は他メンバーの `/monthly-agreement?memberId=` を表示できるが、本人の代わりに合意保存はしない。

`member_monthly_work_agreement_payout_overrides` は admin/service_role のみ read/insert。update/delete は通常運用で使わず、append-only 監査ログとして扱う。

## UI Contract

### `/monthly-agreement`

- 上部に対象月、member、snapshot hash、合意状態を表示する。
- 合意状態は `未合意` / `合意済み` / `条件更新あり` / `対象外`。
- `exclude_from_payout_notice=true` でも `is_admin=true` のメンバーは、テスト確認のため通常メンバーと同じく合意保存・修正要望保存を有効にする。本人以外の代理合意は禁止のまま。
- `/monthly-agreement` ページと強制表示モーダルは同じ `MonthlyAgreementExperience` を使い、表示内容・合意保存・修正要望を分岐させない。
- 合意状態の下に `月初合意 → MS pt → 支払ゲート` の3ステップ案内を表示し、月初合意と実支払を混同しないようにする。
- 合計: 参加PJ数、予定報酬合計、支払済み実績(税込)、実績未照合(税込)、これから支払予定(税込)、今月末未払い残合計 (`stockYen > 0` のときのみ)。支払済み実績は `reward_paid_at` ではなく、`monthly_reward_payout` の保存済み明細と `freee_wallet_txn_verified:` 証跡がそろった行だけを、税込額 (`round(total_pay × 1.1)`) で集計する。`reward_paid_at` はあるが実支払証跡とPJ別明細額が一致していない行は `実績未照合` へ分け、実績にも「これから支払予定」にも混ぜない。
- PJごとに、今月支払額、今月末未払い残、前月繰越・今月発生・今月支払の内訳、合意用予定報酬、PM/PL role、担当MS/担当割合/累積進捗/今月pt/予定報酬を表示する。`stockYen` は「今月は支払われない」別枠で強調し、支払額や合意用予定報酬と同じ見え方にしない。
- PJカードには `/project/:projectId/cockpit?ym=YYYYMM` への「今シーズンのMSリストへ」リンクを置く。admin閲覧時は `/admin/ms-overview?projectId=...` への設計レビュー導線も出す。
- `未払いストックの流れ` は、グラフと明細表のどちらも縦方向の内部スクロールを使わず全行を表示する。狭い画面では横方向だけスクロールを許容する。明細表の支払額には税抜と税込を併記し、`支払実績` / `要照合` / `保存済み` / `保護済み` / `予定` の source badge を出し、過去実績・未照合・未来予定を混ぜない。
- MS別予定報酬は、当月月次予算を当月予定MS消化ptと active member 正規化 share で配分する。`reward_summary_json.members[].breakdown[].payYen` は使わない。
- 担当MS、到達目標、予定報酬が違う場合は、合意とは別に修正要望を送信できる。
- 主要な概念には `Hint` を付ける。対象IDは `monthly-agreement.flow` / `monthly-agreement.project-count` / `monthly-agreement.expected-reward` / `monthly-agreement.payout` / `monthly-agreement.stock` / `monthly-agreement.stock-flow` / `monthly-agreement.ms-pt` / `monthly-agreement.ms-link` / `monthly-agreement.revision-request`。
- 保存テーブル未適用時は保存ボタンを無効化し、migration未適用として表示する。

### `/mypage`

- 当月報酬合計カードの直下に、当月の月初合意カードを表示する。
- `未合意` / `条件更新あり` のとき、`/monthly-agreement` へ誘導する。
- 当月の本人合意が `未合意` / `条件更新あり` かつ表示対象PJがある場合、OS内の他画面を開いても遷移先ページの上に月初合意モーダルを強制表示する。モーダル内には `/monthly-agreement` ページと同じコンテンツ全体を出し、別ページへのCTAだけを出して背景でページが開く状態は禁止。背景クリック、Esc、閉じるボタンで先送りできる UI にはしない。`/monthly-agreement` 自体は強制モーダル対象から除外する。合意完了後はモーダルを閉じて通常どおり他画面へ入れる。
- `/mypage` 本体の報酬表示や週次活動取得が失敗しないよう、合意カードのAPIエラーは主表示をブロックしない。

### `/admin/monthly-work-agreements`

- 対象月、対象メンバー数、合意済み、未合意、条件更新あり、修正要望数、今月支払合計、今月末未払い残合計を表示する。
- member / PJ / status で検索できる。
- 各行は `予定報酬` だけでなく `今月支払` と `未払い残` を分けて表示し、stock が今月支払対象ではないことを admin 一覧でも判別できるようにする。
- 各行に open 修正要望数と最新要望時刻を表示する。
- 各行から `/monthly-agreement?memberId=...&ym=...` と `/mypage?memberId=...` へ遷移できる。

## Failure Mode

| failure | behavior |
|---|---|
| 合意テーブル未適用 | API は `tableReady=false`、保存 API は 503。画面は表示だけ可能 |
| 報酬キャッシュ未生成 | `review_required` として表示。合意は保存可能だが admin/PM 要確認 |
| value plan / MS / share missing | `review_required` として表示 |
| admin が他人の合意保存を試す | 403 |
| 本人以外が修正要望を送る | 403 |
| snapshot hash changed | `needs_reagreement` |
| payout gate blockerあり | `/api/admin/payouts` は 409 で stop。cron prebuild は該当 member を `agreement_gate` failure として skip |
| admin override 監査テーブル未適用 | override できない。通常 blocker は引き続き stop |

## Validation

- migration SQL check: `pwa/scripts/migrations/139_member_monthly_work_agreements.sql`, `140_member_monthly_work_agreement_requests.sql`, `145_member_monthly_work_agreement_payout_overrides.sql`
- `npm run lint`
- `npm run build`
- local browser: `/monthly-agreement`, `/mypage`, `/admin/monthly-work-agreements`
- intact smoke: `/dashboard`, `/admin/payouts`, `/admin/weekly`, `/spec/3-0-l2-data-list-current-spec`, `/project/p25/cockpit`

## 報酬計算との境界

月初合意は `reward-summary.ts`、`payout-reward-cache-refresh`、`/admin/payouts` の計算結果を変えない。未合意のまま支払確定できない guard は、合意 table を read する payout gate として `/admin/payouts` の保存/発行/送付 action の直前に置く。報酬計算式そのものへは混ぜない。
