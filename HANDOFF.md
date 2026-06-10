# HANDOFF - AMD OS

- Last updated: 2026-06-10 (ZMP/ZeMA 6/10定例MTGカード「日程調整中」復旧)
- Current workspace: `/Users/masa/.codex/worktrees/5689/amd-os`
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `pwa/`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `codex/zmp-meeting-card-v01623`
- Functional fix commit: `2fb37412 fix(meeting): treat upcoming source tokens as scheduled`
- Push/deploy status: not pushed, not deployed

## Latest Session Summary

Details are in `pwa/design_log/sessions_2026-06.md` under `2026-06-10 - ZMP/ZeMA 6/10定例MTGカード「日程調整中」復旧`.

- Calendar confirmed `【ZeMA】定例MTG` on 2026-06-10 09:00-10:00 JST with event id `bivl92dr7vhaa1fmi7325lnlis_20260610T000000Z`.
- DB row existed in `project_meeting_summaries` for ZMP (`p19`) with the same event id, but `source_kinds='upcoming+calendar+manual-prep'`.
- Direct cause: cockpit UI checked exact `source_kinds === 'upcoming'`, while `meeting_id` started with `upcoming:`, so the composite source token was treated like prep/tentative and shown as `日程調整中`.
- Non-destructive DB patch was applied only to that exact row: `source_kinds='upcoming'`.
- Code fix in `2fb37412`: token-based `source_kinds` handling in meeting cards/modals, ZeMA/Katsushika H2 aliases for p19 calendar sync, critical UI anchors, BUILD_VERSION `v0.16.23`, spec/manual/changelog updates.

## Verification

Observed OK in this worker:

```sh
cd /Users/masa/.codex/worktrees/5689/amd-os/pwa
npm ci
npm run test:critical-ui
npx tsc --noEmit
npm run build
npm run test:l6-held-source-guard
npm run test:color-pj-resolution
git diff --check
```

Also observed:

- `POST /api/meeting-prep/calendar-sync` dry-run through local dev server matched `project_id='p19'` with reason `matched:ZeMA`.
- Local browser to `/project/p19/cockpit` redirected to login, so authenticated visual confirmation was not performed in this worker.
- Current worktree was clean before this handoff doc update.

## Repo State

- Branch: `codex/zmp-meeting-card-v01623`
- Functional fix: `2fb37412`
- Relevant unpushed worker commits: `2fb37412` and the current handoff/doc sync commit (`git log -1 --oneline`).
- No push from this worker.
- No Vercel deploy from this worker.
- Current worktree `.vercel/project.json` is absent. Canonical root link was checked earlier as `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`, but this worktree itself must not run Vercel CLI until the link artifact is safely restored and deploy approval is granted.
- Separate current-line branch `codex/main-current-v01629-sync` exists locally at `186a2740`; it does not contain `2fb37412`. Before production deploy, merge/cherry-pick this fix onto the accepted current line and preserve monotonic `BUILD_VERSION`.

## Unresolved Tasks

- Production deploy is pending. It needs a deploy bundle and Masa approval because preview/production deploy or git push can trigger Vercel.
- Push is pending for the same reason. Do not push without an approval bundle.
- Business model diagram discussion for the 2026-06-10 ZMP/KR meeting was requested after the fix, but no repo artifact was created before this closeout.

## First Next Action

```sh
cd /Users/masa/.codex/worktrees/5689/amd-os
git status -sb --untracked-files=all
git show --stat --oneline 2fb37412
git log --oneline --decorate -5
```

If preparing release, first move `2fb37412` onto the accepted current production line, run the targeted checks again, then present a deploy bundle before any push/deploy.

## First Read Next Session

1. `AGENTS.md`
2. `CLAUDE.md`
3. `pwa/AGENTS.md`
4. `pwa/CLAUDE.md`
5. `pwa/design_log/sessions_2026-06.md`
6. `pwa/spec/3-3-meeting-flow-current-spec.md`
7. `pwa/manual/2-3-pj-cockpit.md`
8. `pwa/BUGS.md`
