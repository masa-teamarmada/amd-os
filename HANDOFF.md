# AMD OS Handoff

Last updated: 2026-07-06 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: monthly_fixed contract cap reconciliation closeout

## Summary

This handoff closes the finance/reward incident where KUTE (`p25`) kept old gross client monthly amounts in future `billing_cycles.budget_yen`, while only the current month had been corrected to the 65% reward cap.

The root cause was not manual monthly entry. It was an old automatic bulk-create path plus a later `monthly_fixed` Contract Apply path that did not reconcile monthly budget rows:

1. 2026-05-08: KUTE plan cycle and monthly `billing_cycles` rows were bulk-created with the gross client monthly amount in `budget_yen`.
2. 2026-06-18: old Contract Apply for `monthly_fixed` wrote `projects.fee_type/fee_amount/end_ym` but intentionally left monthly rows untouched (`monthly_applied:0`).
3. 2026-07-01: contract auto-confirm touched only the current month and wrote the correct 65% cap there.

That made months differ by path: current month correct, future months stale. The fix is to make Contract Apply enforce the invariant, not rely on later auto-confirm to slowly correct one month at a time.

## Shipped Fix

- Commit: `b6be05295f91d73d8afef5d821880e1e893a3e4f` (`fix(finance): reconcile fixed contract budgets`)
- First production verification: `v0.39.1`, git `b6be0529`, `dirty=false`
- Before this handoff doc update, production had advanced to `v0.39.5`, git `bd209e00`, and still contains `b6be0529`.

Implemented in `pwa/src/lib/contracts-apply.ts`:

- `monthly_fixed` Contract Apply now derives expected monthly cap rows from contract terms.
- Bufferless monthly fixed contracts reconcile unconfirmed `billing_cycles.budget_yen` to `monthly_tax_excl × 0.65`.
- Active/confirmed/draft `value_plan_cycles.budget_yen` is reconciled to the same season cap total.
- Confirmed/progressed monthly rows that conflict with the contract cap block apply instead of being hidden.
- Contracts with explicit reserve/buffer design are not blindly overwritten; existing `contract_terms_json` buffer fields are preserved.
- Apply result logs `monthly_fixed_budget_applied` and `plan_cycles_reconciled`.

## Spec / Manual Sync

Read these first for the current rule:

- `pwa/spec/5-6-contracts-management-current-spec.md`
- `pwa/manual/6-7-contracts-management-spec.md`
- `pwa/manual/7-1-reward-calc-spec.md`
- `pwa/BUGS.md`
- `pwa/design_log/sessions_2026-07.md`

OSの最重要ルール: AMD運営側が認識していないところで、運営費・会社留保を勝手に削って報酬超過を吸収しない。シーズン末未払ゼロに必要な client payment / buffer / PJ budget / member payment の関係を編集時点で見える化し、不足がある状態では編集/applyを終えられないようにする。

## Verification Already Done

On the clean deploy worktree used for implementation:

```bash
npx tsc --noEmit
npm run test:critical-ui
npm run test:deploy-version-guard
npm run lint -- src/lib/contracts-apply.ts
npm run build
```

All passed before deploy.

Production deploy reached READY:

- Vercel deployment: `dpl_f4SXHFHKrTWScqs9CQzx8NkovzKo`
- Production `/api/build-info`: `v0.39.1 / b6be0529`, `dirty=false`
- Runtime logs after deploy: no new errors observed in the checked window.

Afterward, other main-line work advanced production to `v0.39.5 / bd209e00`. Treat `/api/build-info` as current deployment truth.

## Repo State / Closeout Warning

- Clean handoff/deploy worktree: `/tmp/amd-os-cap-carry-deploy-1783039671`
- That worktree has been fast-forwarded to `origin/main` at `bd209e00` before this handoff doc update.
- Canonical local checkout `/Users/masa/projects/AMD/amd-os` was stale and dirty during this closeout (`ahead 7 / behind 79` was observed before later fetches, plus many tracked and untracked unrelated changes).

Do not treat the canonical checkout as current truth until it is reconciled. Use `origin/main`, production `/api/build-info`, or a clean worktree for finance work.

## Open Risks / Next Checks

1. Reconcile the canonical checkout separately. Do not `git add .` there.
2. If continuing finance work, re-check all active/current plan cycles where `fee_type='monthly_fixed'` and no buffer exists:
   - `billing_cycles.budget_yen` should equal client monthly tax-excl amount × 65% for unconfirmed contract months.
   - `value_plan_cycles.budget_yen` should equal the season total of those monthly caps.
3. SX has explicit buffer/season reserve structure. Do not apply the simple KUTE bufferless reconciliation logic to SX without reading `buffer_breakdown_json` and contract terms.
4. For `/admin/payouts` and `/admin/season-pl`, keep the distinction clear:
   - client payment
   - buffer
   - PJ budget
   - member payment
   - company reserve
   - ending unpaid balance

## First Next Action

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
git rev-list --left-right --count origin/main...HEAD
curl -s https://amd-os-pwa.vercel.app/api/build-info
```

Then read this `HANDOFF.md`, the five spec/manual/log files above, `AGENTS.md`, `CLAUDE.md`, and `pwa/CLAUDE.md`.
