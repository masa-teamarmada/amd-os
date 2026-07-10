# AMD OS Handoff

Last updated: 2026-07-10 15:35 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: 月初合意 `今月支払` 0円表示の修正 / closeout

## Summary

- `/admin/monthly-work-agreements?ym=202607` の一覧で `今月支払` が全員 0 円に見えていた件は、本番修正済み。
- 原因は、月初合意の支払説明で `billing_cycles.invoice_ym` (= クライアント請求書発行月) をメンバー支払月として優先していたこと。ZMP 202606 の6月稼働分が 202607 支払一覧から落ちていた。
- 修正 commit: `7ef6f44c fix(pwa): use reward payment month for monthly agreements`。支払月は PJ/member 支払条件から計算し、`invoice_ym` では上書きしない。
- 後続 commit `b552c607` / `1cf3dd4a` で、月初合意モーダルの必須確認を `発注条件` と `予定額` の2点へ寄せ、支払い状況は参考情報へ分離済み。
- 本番 current truth: `https://amd-os-pwa.vercel.app/api/build-info` は `v0.39.41` / `63737267d692230eda2fea9b45e7cd69184f4ebf` / `main` / `dirty=false`。
- read-only 再計算では 202607 の `今月支払` は合計 `87,457円`。内訳: しん `29,055`、あび `26,227`、こう `25,740`、うめ `6,435`。すべて ZMP 202606 分。
- SX 202606 分は現行データ上 `invoice_received_60_days` 系の支払条件で 202607 には乗らない。もし「SXも7月に払うべき」なら、コード不具合ではなく支払条件/契約設定の見直しタスク。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の `2026-07-10 — 月初合意 今月支払0円表示の修正 / v0.39.40-v0.39.41`。

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch policy: `main` only。今回も新規 branch は作っていない。
- Current main: `63737267 feat(pwa): add active project flyout to board nav`
- Local main vs origin/main: closeout inventory 時点で `ahead 0 / behind 0`。
- Worktrees: registered worktree は `/Users/masa/projects/AMD/amd-os [main]` のみ。
- This handoff/closeout doc update is prepared from clean clone `/tmp/amd-os-monthly-payout-fix-clone` to avoid mixing root checkout WIP.

## Dirty State

Monthly agreement payout fix: none. Accepted code/docs are in `origin/main`.

Canonical root checkout has unrelated local WIP, likely GlobalNav flyout refinement after `63737267`. Do not stage or revert it from this lane.

| path | status | class | owner guess | resolution action | risk |
|---|---:|---|---|---|---|
| `pwa/design/FEATURE_REGISTRY.md` | M | other-worker | GlobalNav / board nav refinement | send back to that lane; do not mix into monthly agreement closeout | medium |
| `pwa/scripts/check_pwa_critical_ui.cjs` | M | other-worker | GlobalNav / UI guard refinement | send back to that lane; do not mix into monthly agreement closeout | medium |
| `pwa/src/components/nav/GlobalNav.tsx` | M | other-worker | GlobalNav / board nav refinement | send back to that lane; do not mix into monthly agreement closeout | medium |
| `pwa/src/lib/build-info.ts` | M | other-worker | GlobalNav WIP build bump (`v0.39.42`) | keep for owner lane; production is currently `v0.39.41` | medium |

## Verification / Deploy

Monthly agreement payout fix:

- Read relevant docs first: `/Users/masa/projects/AGENTS.common.md`, root/pwa `AGENTS.md` / `CLAUDE.md`, `pwa/design/L2_DATA.md`, `pwa/spec/3-14-monthly-work-agreement-current-spec.md`, `pwa/manual/6-6-member-billing-prompts-spec.md`, `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`, `pwa/manual/7-1-reward-calc-spec.md`。
- Confirmed production before fix had the same bug: ZMP 202606 rewards existed but were omitted from 202607 monthly agreement list.
- `npx tsc --noEmit --pretty false` passed.
- `npm run build` passed.
- `npm run test:critical-ui` passed during deploy script.
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` pushed `7ef6f44c` and confirmed production `v0.39.40` / dirty=false.
- Later main/prod moved to `63737267` / `v0.39.41`; `7ef6f44c` is an ancestor and the fix remains included.
- `npm run lint` was attempted in the original checkout and failed on pre-existing repo-wide lint issues unrelated to this fix.

## Unresolved Tasks

- 月初合意 `今月支払` 0円表示 bug: none known.
- Potential policy task: SX 202606 報酬を 202607 に払うべきか確認する。現行データは7月支払ではない扱い。
- Dirty root checkout: GlobalNav flyout WIP belongs to another lane. Its owner should either finish and deploy `v0.39.42` or revert/park it explicitly.

## First Next Action

If continuing monthly agreement/payment work, first re-check:

1. production `/api/build-info` equals current `origin/main`;
2. `/admin/monthly-work-agreements?ym=202607` rows show ZMP 202606 payouts for しん/あび/こう/うめ;
3. SX payment timing is a product/contract decision, not silently folded into this bug fix.

If continuing the dirty GlobalNav lane, start with `git diff -- pwa/src/components/nav/GlobalNav.tsx pwa/design/FEATURE_REGISTRY.md pwa/scripts/check_pwa_critical_ui.cjs pwa/src/lib/build-info.ts`, then finish that bundle separately.

## Pointers

- Logic: `pwa/src/lib/monthly-work-agreement.ts`
- Admin list API: `pwa/src/app/api/admin/monthly-work-agreements/route.ts`
- UI: `pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx`
- Spec: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- Manual: `pwa/manual/2-2-member-workflows-quick-start.md`, `pwa/manual/6-6-member-billing-prompts-spec.md`, `pwa/manual/7-1-reward-calc-spec.md`
- Changelog: `pwa/manual/9-3-appendix-changelog.md`, `pwa/spec/6-1-appendix-changelog.md`
- Process lessons: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
