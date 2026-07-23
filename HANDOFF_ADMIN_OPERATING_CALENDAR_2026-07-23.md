# AMD運営カレンダー Handoff

Last updated: 2026-07-23 JST

Target: `/Users/masa/projects/AMD/amd-os`

Topic: `/admin/schedule` の実装・資金表示訂正・closeout

## Latest Session Summary

- AMD運営カレンダーは、税務署・年金事務所などへの法人納付を主役に、年間を俯瞰する読み取り画面として実装済み。カレンダー上の手入力はない。
- PJごとの請求書発行・送付・入金確認は対象外。`tax` と `social_insurance` の法定納付だけを表示する。
- 年間の資金表示は、`納付済み`、`要照合`、`これからの口座流出`を分離した。先頭の必要資金には未完了の二分類だけを入れる。
- 社会保険料の口座納付額は本人預り分を含む全額であり、月次PLの会社負担コストとは別指標として固定した。
- 貸付元本返済は役員報酬ではない。明示分類された`loan_payment`として月次CFだけに反映し、固定費、役員報酬、社会保険の算定ベースから除外した。
- accepted commitは `8bb41d2009ab8276a21cc12ddb8775cd4d50c836`。2026-07-23確認時のproductionは後続変更を含む `v3.47.13 / e4ea6759535ac920ae7155c78f5b43231bf0fadb` で、このcommitを祖先に含む。

## Repo State

- branch / HEAD / origin/main: `main` / `e4ea6759535ac920ae7155c78f5b43231bf0fadb` / 同一（このhandoff commit前の確認値）。
- local main: ahead 0 / behind 0。registered worktreeはroot 1件、local branchは`main`のみ。
- production確認: `/api/build-info` が `v3.47.13`、`git_branch=main`、`dirty=false` を返した。
- このセッションが作ったbranch/worktree: 0。
- root `HANDOFF.md`とroot `SESSION_MIGRATION_PROMPT.md`は別の進行レーン（PoC / Book A）のため、このhandoffでは変更しない。AMD運営カレンダーを再開する時は本ファイルと同名のmigration promptを使う。

### 現在の未コミット変更（本件外・変更禁止）

| path | class | owner guess | resolution action | next owner / judgment | risk |
|---|---|---|---|---|---|
| `pwa/bzm/book-a-ch-1.md` | other-worker | active Book A本文worker | 本文差分を採否し、対象ファイルだけcommit/pushしてcloseoutする | Book Aの本文workerの次回closeout | high: 未採否の本文がrootに残る |

## Unresolved Tasks

- AMD運営カレンダーの実装・本番反映は完了。新しい画面要望はない。
- root全体は上記Book A本文差分があるため `do not archive`。本件のhandoffは作成済みだが、shared checkoutのZero-Trace closeoutは本文workerの解消待ち。

## First Next Action

新しいフィードバックが来たら、まずproduction build-info、`/admin/schedule`の表示対象、支払義務台帳を読み取りで照合する。法定納付同期routeは通知の副作用を持ちうるため、根拠なく実行しない。

## Pointers

- 仕様正本: [`pwa/spec/5-9-admin-operating-calendar-current-spec.md`](pwa/spec/5-9-admin-operating-calendar-current-spec.md)
- 支払義務の運用: [`pwa/manual/6-9-company-payment-obligations-spec.md`](pwa/manual/6-9-company-payment-obligations-spec.md)
- Finance分類: [`pwa/manual/4-5-management-score-and-finance-simulation-spec.md`](pwa/manual/4-5-management-score-and-finance-simulation-spec.md)
- 回帰契約: [`pwa/design/FEATURE_REGISTRY.md`](pwa/design/FEATURE_REGISTRY.md)
- バグ・事故記録: [`pwa/BUGS.md`](pwa/BUGS.md)
- session log: [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md)
- この件の再開prompt: [`SESSION_MIGRATION_PROMPT_ADMIN_OPERATING_CALENDAR_2026-07-23.md`](SESSION_MIGRATION_PROMPT_ADMIN_OPERATING_CALENDAR_2026-07-23.md)

## Verification Evidence

- 実装時: `npm run test:admin-schedule`、`npm run test:payment-obligations`、`npm run test:critical-ui`、`npx tsc --noEmit`、`npm run build`。
- 2026-07-23: `git diff --check`、main/originの一致、worktree/branch inventory、production `/api/build-info` を再確認。
