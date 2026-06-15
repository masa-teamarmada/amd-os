# 月初タスク・報酬合意 仕様

> **この章は何か**: メンバーが月初に OS 上で当月の遂行対象、想定報酬、条件/前提を確認し、合意 snapshot を残すフローの current contract。

## Current Truth

| item | contract |
|---|---|
| member route | `/monthly-agreement?ym=YYYYMM` |
| mypage entry | `/mypage` の当月報酬カード直下に「今月の遂行内容・報酬条件」カードを表示 |
| admin route | `/admin/monthly-work-agreements?ym=YYYYMM` |
| member API | `GET /api/monthly-work-agreement?ym=YYYYMM&memberId=IDxxx` |
| agree API | `POST /api/monthly-work-agreement/agree` |
| admin API | `GET /api/admin/monthly-work-agreements?ym=YYYYMM` |
| DB | `member_monthly_work_agreements` |
| migration | `pwa/scripts/migrations/139_member_monthly_work_agreements.sql` |

## Scope

月初合意は **表示・合意 snapshot・未合意管理レイヤー**。報酬計算の入力や支払額を変更しない。

- `billing_cycles.reward_summary_json` / `member_allocations_json` を読む。
- `value_plan_cycles` / `value_milestones` / `milestone_responsibility` / `milestone_monthly_progress` から、当月の遂行対象と条件を読む。
- `project_members` から当月 active member / active project member を解く。
- 合意時点で本人へ表示した内容を `snapshot_json` と `snapshot_hash` で保存する。
- snapshot hash が変わったら本人/adminに「条件更新あり」と表示し、再合意対象にする。
- 報酬キャッシュを再計算しない。通常 GET は読むだけ。

## Snapshot Contract

`snapshot_json` は安定 JSON。hash に揺れる時刻を含めない。

| field | meaning |
|---|---|
| `schemaVersion` | `monthly_work_agreement.v1` |
| `ym` | 業務月 `YYYYMM` |
| `member` | `memberId`, `codeName`, `email`, `isAdmin` |
| `projects[]` | 当月参加中PJ |
| `projects[].milestones[]` | 担当MS、share、task description、progress、conditions |
| `projects[].expectedRewardYen` | 既存 reward summary / member allocation から読める想定報酬 |
| `projects[].reviewReasons[]` | 報酬キャッシュ未生成、MS/share未設定、cap未確定など |
| `totals` | PJ数、想定報酬合計、要確認PJ数 |

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

## Authority / RLS

| actor | read | write |
|---|---|---|
| 本人 | 自分の合意 row | 自分の合意 insert |
| admin | 全件 read / update | admin API で一覧確認 |
| service_role | 全件 | API route 経由の insert/update |
| anon | 不可 | 不可 |

API route は logged-in user を `members.email` で解決する。本人以外の合意保存は禁止。admin は他メンバーの `/monthly-agreement?memberId=` を表示できるが、本人の代わりに合意保存はしない。

## UI Contract

### `/monthly-agreement`

- 上部に対象月、member、snapshot hash、合意状態を表示する。
- 合意状態は `未合意` / `合意済み` / `条件更新あり`。
- 合計: 参加PJ数、想定報酬合計、要確認PJ数。
- PJごとに、想定報酬、billing status、PM/PL role、遂行条件、未確定理由、担当MS/share/進捗を表示する。
- 保存テーブル未適用時は保存ボタンを無効化し、migration未適用として表示する。

### `/mypage`

- 当月報酬合計カードの直下に、当月の月初合意カードを表示する。
- `未合意` / `条件更新あり` のとき、`/monthly-agreement` へ誘導する。
- `/mypage` 本体の報酬表示や週次活動取得が失敗しないよう、合意カードのAPIエラーは主表示をブロックしない。

### `/admin/monthly-work-agreements`

- 対象月、対象メンバー数、合意済み、未合意、条件更新あり、要確認ありを表示する。
- member / PJ / status で検索できる。
- 各行から `/monthly-agreement?memberId=...&ym=...` と `/mypage?memberId=...` へ遷移できる。

## Failure Mode

| failure | behavior |
|---|---|
| 合意テーブル未適用 | API は `tableReady=false`、保存 API は 503。画面は表示だけ可能 |
| 報酬キャッシュ未生成 | `review_required` として表示。合意は保存可能だが admin/PM 要確認 |
| value plan / MS / share missing | `review_required` として表示 |
| admin が他人の合意保存を試す | 403 |
| snapshot hash changed | `needs_reagreement` |

## Validation

- migration SQL check: `pwa/scripts/migrations/139_member_monthly_work_agreements.sql`
- `npm run lint`
- `npm run build`
- local browser: `/monthly-agreement`, `/mypage`, `/admin/monthly-work-agreements`
- intact smoke: `/dashboard`, `/admin/payouts`, `/admin/weekly`, `/spec/3-0-l2-data-list-current-spec`, `/project/p25/cockpit`

## 報酬計算との境界

月初合意は `reward-summary.ts`、`payout-reward-cache-refresh`、`/admin/payouts` の計算結果を変えない。将来、未合意のまま支払確定できない guard を入れる場合も、まずこの合意 table を read する gate として追加し、報酬計算式そのものへは混ぜない。
