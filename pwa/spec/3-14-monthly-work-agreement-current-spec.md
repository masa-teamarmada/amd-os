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
| DB | `member_monthly_work_agreements`, `member_monthly_work_agreement_requests` |
| migration | `pwa/scripts/migrations/139_member_monthly_work_agreements.sql`, `140_member_monthly_work_agreement_requests.sql` |

## Scope

月初合意は **月初計画の表示・合意 snapshot・未合意管理レイヤー**。報酬計算の入力や支払確定額を変更しない。

- 予定報酬は `/admin/payouts` の支払予定 (`reward_summary_json.members[].totalPay`) ではなく、当月の月次予算を当月の予定MS消化ptと担当shareで配分した **月初合意用の予定額** として算出する。
- `value_plan_cycles` / `value_milestones` / `milestone_responsibility` / `milestone_monthly_progress` から、当月の遂行対象、予定到達点、担当shareを読む。
- 進捗は `milestone_monthly_progress` の非確定行を正本にせず、D-2と同じアンカー方式の月割りデフォルトをコード計算する。PM locked 行があればそれをアンカーにする。
- `project_members` と `projects` から当月 active member / active project member を解く。`projects.status='frozen'` は報酬が発生しないため対象外。
- 合意時点で本人へ表示した内容を `snapshot_json` と `snapshot_hash` で保存する。
- snapshot hash が変わったら本人/adminに「条件更新あり」と表示し、再合意対象にする。
- 報酬キャッシュを再計算しない。通常 GET は読むだけ。
- cap、carry-over、stockYen、条件/前提、未確定・要確認などの精算/確認内部情報は本人向け月初合意画面に出さない。月初合意は「どのPJのどのMSへコミットし、当月どこまで到達すべきか」と「その対価としての予定報酬」を示す。
- 当月報酬も担当MSもないPJは、月初合意の「何をすればいくら」に答えないため本人画面から非表示にする。

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

これは月初合意用の「今月そのMSにコミットする対価」。`reward_summary_json` の capped 支払予定、carryIn、stockYen、現時点の支払確定状態は使わない。

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
| `projects[].reviewReasons[]` | 月次予算未設定、value plan未設定、MS/share未設定など admin 向け確認事項 |
| `totals` | PJ数、予定報酬合計、admin向け確認事項数 |

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

## Authority / RLS

| actor | read | write |
|---|---|---|
| 本人 | 自分の合意 row | 自分の合意 insert |
| 本人 | 自分の修正要望 row | 自分の修正要望 insert |
| admin | 全件 read / update | admin API で一覧確認、修正要望の処理 |
| service_role | 全件 | API route 経由の insert/update |
| anon | 不可 | 不可 |

API route は logged-in user を `members.email` で解決する。本人以外の合意保存は禁止。admin は他メンバーの `/monthly-agreement?memberId=` を表示できるが、本人の代わりに合意保存はしない。

## UI Contract

### `/monthly-agreement`

- 上部に対象月、member、snapshot hash、合意状態を表示する。
- 合意状態は `未合意` / `合意済み` / `条件更新あり`。
- 合計: 参加PJ数、予定報酬合計。
- PJごとに、予定報酬、PM/PL role、担当MS/share/到達目標/予定報酬を表示する。
- MS別予定報酬は、当月月次予算を当月予定MS消化ptと active member 正規化 share で配分する。`reward_summary_json.members[].breakdown[].payYen` は使わない。
- 担当MS、到達目標、予定報酬が違う場合は、合意とは別に修正要望を送信できる。
- 保存テーブル未適用時は保存ボタンを無効化し、migration未適用として表示する。

### `/mypage`

- 当月報酬合計カードの直下に、当月の月初合意カードを表示する。
- `未合意` / `条件更新あり` のとき、`/monthly-agreement` へ誘導する。
- `/mypage` 本体の報酬表示や週次活動取得が失敗しないよう、合意カードのAPIエラーは主表示をブロックしない。

### `/admin/monthly-work-agreements`

- 対象月、対象メンバー数、合意済み、未合意、条件更新あり、修正要望数を表示する。
- member / PJ / status で検索できる。
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

## Validation

- migration SQL check: `pwa/scripts/migrations/139_member_monthly_work_agreements.sql`, `140_member_monthly_work_agreement_requests.sql`
- `npm run lint`
- `npm run build`
- local browser: `/monthly-agreement`, `/mypage`, `/admin/monthly-work-agreements`
- intact smoke: `/dashboard`, `/admin/payouts`, `/admin/weekly`, `/spec/3-0-l2-data-list-current-spec`, `/project/p25/cockpit`

## 報酬計算との境界

月初合意は `reward-summary.ts`、`payout-reward-cache-refresh`、`/admin/payouts` の計算結果を変えない。将来、未合意のまま支払確定できない guard を入れる場合も、まずこの合意 table を read する gate として追加し、報酬計算式そのものへは混ぜない。
