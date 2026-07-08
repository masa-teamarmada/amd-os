# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: PJ cockpit season finance cash-basis `収支` + Admin MS Overview guard closeout

## Summary

See `pwa/design_log/sessions_2026-07.md` sections:
- `2026-07-08 — PJ cockpit 今シーズン収支 cash-basis 収支 / v0.39.12`
- `2026-07-08 — Admin MS Overview 個人名カード回帰防止 / v0.39.13 closeout`
- `2026-07-09 — Finance cockpit + MS guard handoff closeout refresh`

- PJ cockpit season finance table no longer shows the member-facing `会社留保` / officer-reserve-equivalent column.
- The visible last column changed from obligation residual `残` to cash-basis `収支`.
- Cash-basis formula: `収支 = クライアント支払 - バッファ - メンバー支払`.
- Hidden safety checks still keep `companyReserveYen`, `finalUnpaidYen`, and `finalRemainingYen`; only the member-facing display changed.
- Admin MS Overview current truth remains fixed at 4 top metrics: 合計pt / 本契約pt / 別財布pt / `budgetImpact` safety card. Do not restore personal-name comparison cards.

## Current Truth

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Confirmed before this handoff docs refresh:
  - HEAD / `origin/main`: `2d64a3faa8571d1e7cb26d928712bf700eaefdba`
  - local main vs origin/main: ahead `0`, behind `0`
  - production `/api/build-info`: `v0.39.13` / `2d64a3faa8571d1e7cb26d928712bf700eaefdba` / `main` / `dirty:false`
- Latest product commits included in production:
  - `0eee5780 Show cockpit season finance cash balance`
  - `cb584019 chore(pwa): bump build version for MS guard`
  - `2d64a3fa docs(closeout): clarify handoff production state`
- Production URL: `https://amd-os-pwa.vercel.app`
- Worktree registry: one registered worktree only, `/Users/masa/projects/AMD/amd-os [main]`.
- Local branch inventory: `main` only.
- Re-check `git status`, `git log -1 --oneline`, and production `/api/build-info` at restart, because this file may itself be committed after the snapshot above and parallel WIP changed during closeout.

## Verification Already Run

PJ cockpit cash-basis change:

```bash
npx tsc --noEmit
npm run test:critical-ui
npm run build
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Observed:
- TypeScript, critical UI anchors, and production build passed.
- Local browser check reached `/auth/login`; authenticated cockpit screen was not visually rechecked in this closeout.
- Production for the finance cockpit change was observed as `v0.39.12` / `0eee5780...` / `dirty:false` before later MS guard commits.

MS Overview guard:

```bash
npm run test:critical-ui
npm run test:deploy-version-guard
npx tsc --noEmit
node pwa/scripts/deploy-version-guard.cjs --target production --app-url https://amd-os-pwa.vercel.app --repo-root /Users/masa/projects/AMD/amd-os
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Observed:
- critical UI anchors passed.
- deploy rollback guard passed before push.
- TypeScript check passed.
- Production switched to `v0.39.13`.
- Forbidden old MS card wording search returned zero matches.

Closeout inventory:

```bash
git status -sb --untracked-files=all
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD
git worktree list --porcelain
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

## Design Records

- PJ cockpit user manual: `pwa/manual/2-3-pj-cockpit.md`
- PJ cockpit spec: `pwa/spec/3-8-cockpit-current-spec.md`
- Admin MS Overview manual: `pwa/manual/6-8-admin-ms-overview-spec.md`
- Important UI registry: `pwa/design/FEATURE_REGISTRY.md`
- Changelogs: `pwa/manual/9-3-appendix-changelog.md`, `pwa/spec/6-1-appendix-changelog.md`
- Bug/lesson: `pwa/BUGS.md` entry `[admin/ms-overview] 個人名カードが上段メトリクスへ戻った`
- Session log: `pwa/design_log/sessions_2026-07.md`

## Dirty State To Preserve

These files are dirty after the accepted `v0.39.13` release and are not part of this handoff bundle. Do not revert or stage them casually.

| path | class | owner guess | next action | risk |
|---|---|---|---|---|
| `pwa/src/app/api/admin/ms-overview/route.ts` | other-worker / MS finance WIP | MS design amount worker | Decide whether exact design amount should use `budget × pt比`; if yes, sync spec/manual, test, bump version, commit, push. | Medium: accidental staging can ship unverified finance math. |
| `pwa/src/components/admin/AdminMsOverviewClient.tsx` | other-worker / MS finance WIP | MS design amount worker | Same bundle as above. | Medium |
| `pwa/src/lib/admin/ms-overview-calc.ts` | other-worker / MS finance WIP | MS design amount worker | Same bundle as above. | Medium |
| `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Decide whether removing Tsukuyomi nudge from project cockpit is intentional; if yes, sync manual/spec/registry/changelog and verify cockpit layout. | High: deletes a visible cockpit surface. |
| `pwa/src/app/(app)/institutions/[institutionId]/cockpit/page.tsx` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above. | High |
| `pwa/src/components/cockpit/CockpitNudge.tsx` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above; deletion should not ship without design record. | High |
| `pwa/src/components/cockpit/CockpitView.tsx` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above. | High |
| `pwa/src/components/dashboard/CyberHudWallDashboard.tsx` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above; dashboard embedded cockpit copy changed too. | Medium/High |
| `pwa/src/lib/build-info.ts` | other-worker / cockpit nudge removal WIP | cockpit UI worker | `v0.39.14` bump appears tied to this WIP; keep with that bundle, not with docs-only handoff. | Medium/High |
| `pwa/scripts/check_pwa_critical_ui.cjs` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above; critical UI anchors changed and need test proof. | Medium/High |
| `pwa/manual/2-3-pj-cockpit.md` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above; manual already being adjusted for no nudge card. | Medium |
| `pwa/spec/3-8-cockpit-current-spec.md` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above; spec already being adjusted for no `CockpitNudge` in normal cockpit. | Medium |
| `pwa/design/FEATURE_REGISTRY.md` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above; this is the important UI registry, so verify the removal is intended. | Medium/High |
| `pwa/design/cockpit.md` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above. | Medium |
| `pwa/design/proactive_operating_loop.md` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above. | Medium |
| `pwa/manual/9-3-appendix-changelog.md` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above. | Low/Medium |
| `pwa/spec/6-1-appendix-changelog.md` | other-worker / cockpit nudge removal WIP | cockpit UI worker | Same bundle as above. | Low/Medium |
| `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` | other-worker / L6 prep WIP | L6 prep worker | Decide whether prep Drive outputs should be HTML-only; if yes, sync related specs/manual and commit. | Low/Medium |
| `pwa/scripts/atlas_signal_review_tool.mjs` | preexisting / Atlas WIP | Atlas signal worker | Validate retryable disabled-ingest handling, then commit or revert in Atlas lane. | Low/Medium |

## First Next Action

If continuing this repo immediately:

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
git log -3 --oneline
git rev-list --left-right --count origin/main...HEAD
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Then resolve the dirty bundles one lane at a time. If continuing finance display work, authenticated cockpit visual verification is the next useful check. If continuing MS design amount WIP, do not ship it without spec/manual sync and tests. If continuing cockpit nudge removal, treat it as a feature removal and update design records before deploy.

## Closeout Decision

`do not archive` for the whole checkout while the nineteen unrelated dirty files remain.

This finance cockpit + MS guard lane is otherwise complete: accepted work is on `main`, production had `v0.39.13` / `dirty:false` at closeout check, current docs state the cash-basis `収支` definition, and MS Overview docs forbid the old personal-name card shape.
