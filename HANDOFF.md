# AMD OS Handoff

Last updated: 2026-07-10 16:02 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: 月初合意 `今月支払` 0円表示の修正 / closeout

## Summary

- `/admin/monthly-work-agreements?ym=202607` の一覧で `今月支払` が全員 0 円に見えていた件は、本番修正済み。
- 原因は、月初合意の支払説明で `billing_cycles.invoice_ym` (= クライアント請求書発行月) をメンバー支払月として優先していたこと。ZMP 202606 の6月稼働分が 202607 支払一覧から落ちていた。
- 修正 commit: `7ef6f44c fix(pwa): use reward payment month for monthly agreements`。支払月は PJ/member 支払条件から計算し、`invoice_ym` では上書きしない。
- 後続 commit `b552c607` / `1cf3dd4a` で、月初合意モーダルの必須確認を `発注条件` と `予定額` の2点へ寄せ、支払い状況は参考情報へ分離済み。
- PWA product baseline: `v0.39.43` / `0221beaadd3a31b24f4fe2a485332dba7bdbb382` / `main` / `dirty=false`。この handoff docs refresh 後は、最初に production `/api/build-info` を再読込する。
- read-only 再計算では 202607 の `今月支払` は合計 `87,457円`。内訳: しん `29,055`、あび `26,227`、こう `25,740`、うめ `6,435`。すべて ZMP 202606 分。
- SX 202606 分は現行データ上 `invoice_received_60_days` 系の支払条件で 202607 には乗らない。もし「SXも7月に払うべき」なら、コード不具合ではなく支払条件/契約設定の見直しタスク。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の `2026-07-10 — 月初合意 今月支払0円表示の修正 / v0.39.40-v0.39.43`。

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch policy: `main` only。今回も新規 branch は作っていない。
- Current main includes `bc6beafa docs(bzm): Book A Ch4 L3 初版...` and PWA baseline `0221beaa fix(pwa): constrain board flyout viewport height` before this docs refresh.
- Local main vs origin/main: closeout inventory 時点で `ahead 0 / behind 0`。
- Worktrees: registered worktree は `/Users/masa/projects/AMD/amd-os [main]` のみ。
- This handoff/closeout doc update is docs-only; final chat reports the exact pushed SHA after deploy.

## Dirty State

Monthly agreement payout fix: none. Accepted code/docs are in `origin/main`.

Canonical root checkout is clean at final closeout. Earlier GlobalNav flyout dirty was resolved and pushed as `0221beaa`.

| path | status | class | owner guess | resolution action | risk |
|---|---:|---|---|---|---|
| none | clean | n/a | n/a | n/a | none |

## Verification / Deploy

Monthly agreement payout fix:

- Read relevant docs first: `/Users/masa/projects/AGENTS.common.md`, root/pwa `AGENTS.md` / `CLAUDE.md`, `pwa/design/L2_DATA.md`, `pwa/spec/3-14-monthly-work-agreement-current-spec.md`, `pwa/manual/6-6-member-billing-prompts-spec.md`, `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`, `pwa/manual/7-1-reward-calc-spec.md`。
- Confirmed production before fix had the same bug: ZMP 202606 rewards existed but were omitted from 202607 monthly agreement list.
- `npx tsc --noEmit --pretty false` passed.
- `npm run build` passed.
- `npm run test:critical-ui` passed during deploy script.
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` pushed `7ef6f44c` and confirmed production `v0.39.40` / dirty=false.
- Later main/prod moved to `0221beaa` / `v0.39.43`; `7ef6f44c` is an ancestor and the fix remains included.
- `npm run lint` was attempted in the original checkout and failed on pre-existing repo-wide lint issues unrelated to this fix.

## Unresolved Tasks

- 月初合意 `今月支払` 0円表示 bug: none known.
- Potential policy task: SX 202606 報酬を 202607 に払うべきか確認する。現行データは7月支払ではない扱い。
- Dirty root checkout: none at final closeout.

## First Next Action

If continuing monthly agreement/payment work, first re-check:

1. production `/api/build-info` equals current `origin/main`;
2. `/admin/monthly-work-agreements?ym=202607` rows show ZMP 202606 payouts for しん/あび/こう/うめ;
3. SX payment timing is a product/contract decision, not silently folded into this bug fix.

If continuing GlobalNav / board nav work, start from committed main after `0221beaa`; there is no local dirty carry-forward from this closeout.

## Pointers

- Logic: `pwa/src/lib/monthly-work-agreement.ts`
- Admin list API: `pwa/src/app/api/admin/monthly-work-agreements/route.ts`
- UI: `pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx`
- Spec: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- Manual: `pwa/manual/2-2-member-workflows-quick-start.md`, `pwa/manual/6-6-member-billing-prompts-spec.md`, `pwa/manual/7-1-reward-calc-spec.md`
- Changelog: `pwa/manual/9-3-appendix-changelog.md`, `pwa/spec/6-1-appendix-changelog.md`
- Process lessons: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
