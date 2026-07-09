# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: PJ cockpit MS design amounts + member design amounts

## Summary

- PJ cockpit / HUD cockpit の今期MSリストに、各MSの `設計額` を追加した。
- バー上のメンバー chip に、担当者ごとの `担当設計額` も追加した。表示は短く `まさ 65% / 4.6pt / 12.3万円` の形、正確な円額は hover title に残す。
- 通常MSは plan cycle の本契約予算、`cap_extra` は同期間の別財布予算から按分する。これは支払確定額ではなく `/admin/ms-overview` と同じ設計額の目安。
- manual / spec / design / FEATURE_REGISTRY / changelog / critical UI guard を同期済み。詳細ログは `pwa/design_log/sessions_2026-07.md` の `2026-07-09 — PJ cockpit MS design amounts` を見る。
- Production accepted state: `v0.39.20` / `aaa19ac354f323dc38c2d22cece1e765fcbbd203` / `dirty=false`.

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch rule: this repo works on `main`; do not create a branch for normal AMD OS work.
- HEAD / origin/main at handoff inventory: `aaa19ac3 Show member design amounts in cockpit MS chips`
- `HEAD...origin/main`: `0 0` ahead/behind.
- Production `/api/build-info`: `v0.39.20` / `aaa19ac354f323dc38c2d22cece1e765fcbbd203` / `dirty=false`.
- Registered worktrees: `/Users/masa/projects/AMD/amd-os [main]` only.
- Local branches: `main` only.

## Verification Run

For `d9d38833 Show MS design budgets in cockpit`:
- `npx tsc --noEmit`
- `npm run test:critical-ui`
- `npm run test:next-period-ui`
- `npm run build`
- targeted `eslint`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- Production build-info confirmed `v0.39.19`.

For `aaa19ac3 Show member design amounts in cockpit MS chips`:
- `npx tsc --noEmit`
- `npm run test:critical-ui`
- `npm run test:next-period-ui`
- targeted `eslint`
- `npm run build`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- Production build-info confirmed `v0.39.20`.

Browser note:
- Auth-gated cockpit route could not be visually inspected after login from this session. The local route redirected to `/auth/login`; substitute verification was build + type + critical UI guard + source-level layout review.

## Current Dirty State

This checkout is **not archive ok** right now. After the accepted MS design-amount deploy, another in-progress dirty bundle appeared in the canonical checkout. It is not part of `aaa19ac3` and is not deployed.

| path group | class | owner guess | action | risk |
|---|---|---|---|---|
| `pwa/scripts/migrations/166_milestone_change_events.sql`, `pwa/src/components/cockpit/CockpitMsChangeHistory.tsx`, `pwa/src/app/api/admin/ms-overview/[planCycleId]/route.ts`, `pwa/src/lib/supabase-data.ts`, `pwa/src/components/cockpit/CockpitView.tsx`, related `pwa/design/cockpit.md` / manual / spec / critical UI changes | other-worker / unknown | active MS変更履歴 worker or next session | Finish, validate, commit, and deploy as its own bundle, or archive/revert with explicit approval. Do not mix into this handoff closeout. | `deploy.sh` hard-stops while tracked dirty remains; local `BUILD_VERSION` is `v0.39.21` but production is `v0.39.20`. |
| `pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx`, `pwa/src/components/monthly-agreement/MonthlyAgreementGateOverlay.tsx`, `pwa/src/app/api/admin/payouts/route.ts`, `pwa/src/components/admin/AdminPayoutsClient.tsx` | other-worker / unknown | monthly-agreement / payout UI worker | Classify with the owner before committing or reverting. | Could accidentally couple monthly agreement UI changes with MS history changes. |

First check in the next session:

```bash
cd /Users/masa/projects/AMD/amd-os
git status -sb --untracked-files=all
git diff --stat
git log --oneline --decorate -5
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

## Open Next Task

1. Decide the fate of the current dirty bundle:
   - If it is the intended next feature, finish `MS変更履歴` end-to-end: migration application, schema dump if needed, API/types/UI, docs/changelog, `test:critical-ui`, `tsc`, `build`, deploy.
   - If it is stale or accidental, archive the diff first and then clean/revert only with explicit approval.
2. Optional visual follow-up for this completed lane: login-capable browserで `/project/<projectId>/cockpit` を開き、MS bar chip の `担当設計額` が横幅内で読めるかを目視する。

## Pointers

- MS cockpit spec: `pwa/spec/3-8-cockpit-current-spec.md`
- MS cockpit manual: `pwa/manual/2-3-pj-cockpit.md`
- Cockpit design: `pwa/design/cockpit.md`
- Feature registry: `pwa/design/FEATURE_REGISTRY.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
- Bug/process lessons: `pwa/BUGS.md`

## Closeout Decision

- Accepted MS design-amount work: complete, committed, pushed, deployed.
- Current checkout: `do not archive` because unrelated dirty tracked/untracked files remain.
- Branch/worktree cleanup: no local non-main branch and no extra worktree to remove.
