# HANDOFF - AMD OS

- Last updated: 2026-06-23 (admin MS overview / payout matrix closeout)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Default branch: `main`

## Latest Session Summary

- `/admin/ms-overview` is now the write boundary for MS design. Cockpit / HUD cockpit show MS design and progress, but do not save MS title / period / points / tag / planned share.
- Admin MS edit mode can save MS title, points, tag, period, success criteria, member share, role, task text, add, and deactivate. Save bars are shown at the top and footer so long MS lists have an obvious save action.
- The pt basis is back to the design rule: regular points = season months x 10pt, cap_extra points = each cap_extra MS period months x 10pt, and `value_plan_cycles.total_points = regular + cap_extra`. Editing normal MS allocation points no longer changes the regular pt unit.
- cap_extra MS points are normalized from period months x 10pt on the client and again on the server. ZMP OkuDoor system development (202605-202610) is therefore 60pt, not a special-case 20pt or old 67pt.
- Admin MS edit UI was tightened after Masa feedback: MS basic info on the left, member share table on the right, one member per row, no two-column member grid, and each row shows `MS内金額`.
- The original MS point allocation UX was restored: both each MS card and the new aggregate `全MS pt配分スライダー` panel can move the same edit state. The aggregate panel also shows remaining allocatable regular points and each MS amount.
- Slider max is fixed at edit-start max point x 1.5 for normal MS. It does not follow the current value while dragging, so point increments stay visually even across the slider.
- Current main also contains later payout-side fixes through `d070807c` (`v0.34.15`): payout forecast cache/zero-summary fixes and sticky member payout matrix columns.

## Repo / Deploy State

- Pre-handoff product HEAD: `d070807c Fix payout matrix sticky columns` on `main`, aligned with `origin/main`.
- PWA BUILD_VERSION at that HEAD: `v0.34.15`.
- Dirty tracked files before this handoff docs update: none.
- Remaining untracked file: `gas-slack/.clasp.json` (not part of this PWA/MS task; do not commit without GAS/Slack owner decision).

## Verification Already Run

- For the MS overview code path: `npm exec tsc -- --noEmit --pretty false`, `npm run test:critical-ui`, `npm run build`.
- Browser route smoke: `/admin/ms-overview` redirects to `/auth/login?next=%2Fadmin%2Fms-overview` when unauthenticated. Authenticated visual verification was not completed in this session because the local browser was at the login wall.
- Closeout inventory before docs update: `main` aligned with `origin/main`, no unpushed commits, only `gas-slack/.clasp.json` untracked.

## Unresolved Tasks

1. Logged-in visual check for `/admin/ms-overview` edit mode:
   - Open a real admin session.
   - Toggle edit mode.
   - Confirm two-pane layout, one-row member share table, aggregate slider panel, remaining point display, MS amount, member MS amount, top/footer save bars.
   - Save a tiny safe test only if Masa explicitly wants a live DB write.
2. `value_milestones` estimate-line pollution remains a separate data cleanup task from the monthly report work. It may affect cockpit, `/admin/ms-overview`, and reward calculations if old fixed-cycle quote lines remain active.
3. Decide the owner of `gas-slack/.clasp.json`. It looks like GAS/Slack local clasp link state, but this handoff did not inspect or classify its contents.

## Read First Next Session

1. `HANDOFF.md`
2. `pwa/HANDOFF_pwa_rebuild.md`
3. `pwa/manual/6-8-admin-ms-overview-spec.md`
4. `pwa/design/FEATURE_REGISTRY.md`
5. `pwa/spec/6-1-appendix-changelog.md`
6. `pwa/BUGS.md`
7. `pwa/design_log/sessions_2026-06.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb --untracked-files=all
git log --left-right --oneline main...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Expected: local `main` is aligned with `origin/main`; production is `v0.34.15` / current main SHA or newer. If production or local main differs, inspect before touching finance/MS data.

## Guardrails

- Do not restore cockpit-side MS design editing. MS design writes belong in `/admin/ms-overview`.
- Do not use `ΣMS.points` as the regular pt unit denominator. Regular denominator is season months x 10pt.
- Do not make cap_extra a project-specific exception. It follows the same period x 10pt rule and separate extra budget pool.
- Do not use `git add .`; stage named handoff/docs files only.
- For PWA production-bound changes, use `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`.
