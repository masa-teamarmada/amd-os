# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: PJ cockpit cash-basis `収支` / Admin MS Overview guard / cockpit Tsukuyomi memo removal closeout

## Summary

See `pwa/design_log/sessions_2026-07.md` sections:
- `2026-07-08 — PJ cockpit 今シーズン収支 cash-basis 収支 / v0.39.12`
- `2026-07-08 — Admin MS Overview 個人名カード回帰防止 / v0.39.13 closeout`
- `2026-07-09 — Finance cockpit + MS guard handoff closeout refresh`
- `2026-07-09 — Final clean closeout after cockpit memo removal`

- PJ cockpit season finance table no longer shows the member-facing `会社留保` / officer-reserve-equivalent column.
- The visible last column changed from obligation residual `残` to cash-basis `収支`.
- Cash-basis formula: `収支 = クライアント支払 - バッファ - メンバー支払`.
- Hidden safety checks still keep `companyReserveYen`, `finalUnpaidYen`, and `finalRemainingYen`; only the member-facing display changed.
- Admin MS Overview current truth remains fixed at 4 top metrics: 合計pt / 本契約pt / 別財布pt / `budgetImpact` safety card. Do not restore personal-name comparison cards.
- Parallel cockpit work landed as `e5d3771a fix: remove tsukuyomi memo from cockpit`: normal PJ / institution cockpit no longer renders `CockpitNudge` / `tsukuyomi_nudge_queue` cards. BUILD_VERSION is now `v0.39.14`.
- Final checkout state before this docs-only closeout refresh was clean.

## Current Truth

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Latest product commit before this docs-only refresh: `e5d3771a8154359a48e2a37325b9543b9e880d4c` (`fix: remove tsukuyomi memo from cockpit`)
- Handoff docs commit: current `origin/main` HEAD after this file is pushed. Re-check with `git log -3 --oneline` because this file is part of the final docs commit itself.
- Local main vs origin/main before this docs-only refresh: ahead `0`, behind `0`
- Worktree registry: one registered worktree only, `/Users/masa/projects/AMD/amd-os [main]`.
- Local branch inventory: `main` only.
- Production URL: `https://amd-os-pwa.vercel.app`
- Production state to re-check on restart:
  - expected build version: `v0.39.14` or newer
  - expected git sha: current `origin/main` HEAD after docs deploy
  - expected dirty: `false`

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
- Local browser route check reached `/auth/login`; authenticated cockpit screen was not visually rechecked in this closeout.
- Production for the finance cockpit change was observed as `v0.39.12` / `0eee5780...` / `dirty:false` before later commits.

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

Cockpit Tsukuyomi memo removal:
- Commit `e5d3771a` removed `CockpitNudge` from normal project / institution cockpit and updated manual/spec/registry/changelog/critical UI check.
- This handoff session did not re-run that bundle's tests; verify from the `e5d3771a` worker if detailed proof is needed.

Closeout inventory:

```bash
git status -sb --untracked-files=all
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD
git worktree list --porcelain
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Final target state:
- `git status -sb --untracked-files=all`: clean
- `HEAD` / `origin/main`: same
- ahead `0`, behind `0`
- worktree registry: one main worktree
- production build-info: current `origin/main` / `dirty:false` after final docs deploy

## Design Records

- PJ cockpit user manual: `pwa/manual/2-3-pj-cockpit.md`
- PJ cockpit spec: `pwa/spec/3-8-cockpit-current-spec.md`
- Admin MS Overview manual: `pwa/manual/6-8-admin-ms-overview-spec.md`
- Important UI registry: `pwa/design/FEATURE_REGISTRY.md`
- Changelogs: `pwa/manual/9-3-appendix-changelog.md`, `pwa/spec/6-1-appendix-changelog.md`
- Bug/lesson: `pwa/BUGS.md` entry `[admin/ms-overview] 個人名カードが上段メトリクスへ戻った`
- Session log: `pwa/design_log/sessions_2026-07.md`

## Dirty State To Preserve

None at final closeout.

During the handoff work, parallel WIP briefly appeared as 19 dirty files. That bundle was committed separately as `e5d3771a fix: remove tsukuyomi memo from cockpit` before the final closeout docs refresh. Do not resurrect the stale dirty inventory from older chat/tool output.

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

Then continue from the user's next actual request. If finance display work resumes, authenticated cockpit visual verification is the next useful check. If MS finance math work resumes, treat it as a new bundle and do not ship without spec/manual sync and tests.

## Closeout Decision

Archive is OK for this thread after final docs deploy confirmation: the repo is on `main`, local and origin are aligned, no extra worktree/branch remains, and there is no dirty state to preserve.
