# HANDOFF - AMD OS

- Last updated: 2026-06-04 (KUTE重複解消 / institution labels / company content復元)
- Current workspace: `/Users/masa/.codex/worktrees/4507/amd-os`
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `pwa/`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current HEAD in this worktree: handoff/doc sync commit (`docs: hand off KUTE institution deploy`; run `git log -1 --oneline` for the exact hash)
- Branch state: detached worktree (`HEAD`), no git push from this worker

## Latest Session Summary

Details are in `pwa/design_log/sessions_2026-06.md` under `2026-06-04 — KUTE重複解消 / v0.15.3復元 / 研究機関カード表示名`.

- KUTE (`p25`) is no longer shown in the normal Dashboard PJ list. It is shown through the institution ERS list and routed to `/institutions/inst_kute/cockpit`.
- `inst_kute -> p25` was added so the institution cockpit can mount the existing KUTE PJ cockpit content without deleting either PJ content or ERS content.
- Existing NIMS route `inst_nims -> p20` remains intact.
- Institution ERS list is back in the left/main Dashboard column immediately below the PJ list.
- Institution cards use PJ-style titles: `KUTE` / `KGW` / `NIMS`; subtitles: `工学院大学` / `香川大学` / `物質・材料研究機構`.
- The `019e9176` company content landing zone was restored: `/company`, `/admin/company`, migration draft `124_company_content_tables.sql`, dashboard shelf fallback, and dry-run docs.
- Runtime version deployed: `BUILD_VERSION = "v0.15.5"`.

## Deployment / Verification

- Production Ready: `https://amd-os-pwa.vercel.app`
- Deployment id: `dpl_42byLRKSTZEfrQGo5bDfWargtUyx`
- Inspect URL: `https://amd-os-788b8fwh1-armada0130.vercel.app`

Commands observed OK:

```sh
cd /Users/masa/.codex/worktrees/4507/amd-os/pwa
npx eslint src/components/dashboard/InstitutionReadinessList.tsx src/lib/build-info.ts
npx tsc --noEmit
npm run test:critical-ui
npm run build
```

Smoke checks observed OK:

- local `/dashboard`, `/institutions/inst_kute/cockpit`, `/company`: login redirect / status 200 / Runtime Error false
- production `/dashboard`, `/institutions/inst_kute/cockpit`, `/company`: login redirect / status 200 / Runtime Error false

## Repo State

Unpushed local commits in this worktree:

- `039a823 fix(pwa): restore institution list placement and KUTE routing`
- `ac13324 feat(company): restore Notion content landing zone`
- `40f021b fix(dashboard): use project labels for institutions`
- current handoff/doc sync commit (`docs: hand off KUTE institution deploy`)

Important boundary:

- No DB row deletion.
- No destructive migration.
- `pwa/scripts/migrations/124_company_content_tables.sql` is included as migration draft/landing-zone schema only. This worker did not apply production DB migration or import Notion content.
- No git push.

## Unresolved Tasks

- None for the KUTE duplicate / institution label runtime path.
- Optional next release item: apply/import company content tables when Masa explicitly approves DB migration + Notion import scope.
- Optional next cleanup: push these commits after deploy bundle approval, because git-connected Vercel auto-deploy may run on push.

## First Next Action

```sh
cd /Users/masa/.codex/worktrees/4507/amd-os
git status -sb
git log --oneline -8
git diff --stat origin/main...HEAD
```

If preparing to push, make a deploy bundle first and get Masa approval immediately before the push.

## First Read Next Session

1. `AGENTS.md`
2. `CLAUDE.md`
3. `pwa/AGENTS.md`
4. `pwa/CLAUDE.md`
5. `pwa/design_log/sessions_2026-06.md`
6. `pwa/design/FEATURE_REGISTRY.md`
7. `pwa/design/SPEC_pwa.md`
8. `pwa/manual/4-9-institution-ers-spec.md`
9. `pwa/BUGS.md`
