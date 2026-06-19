# HANDOFF - AMD OS

- Last updated: 2026-06-19 (H-1 task auto-registration + owner Slack nudge closeout)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- Worker checkout used for this closeout: `/Users/masa/.codex/worktrees/h1-calendar-review-queue-v0286`
- Production URL: `https://amd-os-pwa.vercel.app`
- Default branch: `main`

## Latest Session Summary

- Removed the temporary `/admin/calendar-review` screen and admin sidebar entry. H-1 next actions no longer rely on an admin review queue.
- Added `POST /api/task-calendar/register-tasks` so H-1 can register MTG / minutes / Gmail TODO / Slack TODO next actions directly into `tasks`.
- The route dedupes by `task_id`, writes via service role after `WORKFLOW_SECRET` / `CRON_SECRET` or admin auth, and nudges only the task owner via Slack when `send_slack=true`.
- Calendar work-block planning remains a dry-run planner (`/api/task-calendar/schedule-plan`). This route does not create Calendar events, send Gmail, invite external attendees, or Slack DM admins.
- Production contains the feature through commit `2354e085 feat(pwa): register H1 tasks with owner nudges`; closeout production check reported `v0.28.13` / `e32d2bd2` / `dirty=false` or newer.
- Detailed session log: `pwa/design_log/sessions_2026-06.md` entry `2026-06-19 - H-1 task auto-registration + owner Slack nudge`.

## Repo State

- Accepted implementation commit: `2354e085 feat(pwa): register H1 tasks with owner nudges`.
- Current `origin/main` at closeout: `b2277b5f feat(contracts): normalize registry table`, which includes the implementation commit.
- Worker branch at closeout before handoff commit: `codex/h1-calendar-review-queue-v0286...origin/main` aligned, no tracked dirty files.
- Canonical root `/Users/masa/projects/AMD/amd-os` is on `main` / `b2277b5f`, but has unrelated finance/admin dirty files. Do not use that checkout as a clean implementation source until those are committed or quarantined.
- Separate unpushed local branch exists: `codex/cx-contract-terms-cap-fix` at `019cdc4c feat(contracts): add contract terms cap source`. It is unrelated to this H-1 task-registration work.

## Verification Run This Session

- `npm run test:task-calendar-register`
- `npm run test:task-calendar-schedule-plan`
- `npm run test:meeting-calendar-upsert-plan`
- targeted `eslint` for the new route/helper/sidebar/build-info changes
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:critical-ui`
- production `/api/build-info` check: `v0.28.13` / `e32d2bd2eade61a410a9219937d16a7cf828619b` / `dirty=false`
- production unauthenticated route smoke: `POST /api/task-calendar/register-tasks` returned `401 unauthorized`, confirming the route exists and is protected

No real Slack DM was sent during verification. The Slack send path is implemented but only fires on an authorized non-dry-run call with `send_slack=true` and a resolvable owner Slack user id.

## Unresolved Tasks

- H-1 automation should call `POST /api/task-calendar/register-tasks` after extracting next actions. This is an automation wiring task, not a PWA route task.
- If Calendar work blocks are still needed, keep using `/api/task-calendar/schedule-plan` as dry-run. Do not add back an admin review page unless Masa explicitly asks for one.
- Clean up or route the unrelated canonical-root finance/admin dirty files before using `/Users/masa/projects/AMD/amd-os` for a fresh product change.

## Read First Next Session

1. `HANDOFF.md`
2. `pwa/spec/3-3-meeting-flow-current-spec.md`
3. `pwa/spec/2-1-pwa-runtime-routes.md`
4. `pwa/spec/2-2-pwa-surface-inventory-current-spec.md`
5. `pwa/manual/3-2-data-and-extraction.md`
6. `pwa/manual/8-3-l2-extraction-routines-spec.md`
7. `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
8. `pwa/BUGS.md`
9. `pwa/design_log/sessions_2026-06.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb
curl -sS https://amd-os-pwa.vercel.app/api/build-info
```

Expected: production is `v0.28.13` / `e32d2bd2` or newer. If wiring H-1 automation, use `WORKFLOW_SECRET` and start with `dry_run=true`; switch to `send_slack=true` only when the task payload, target count, owner mapping, and rollback are clear.

## Guardrails

- Never use `git add .`.
- Do not revert dirty files you did not create.
- This flow writes `tasks` and optional owner Slack DMs only. It must not send Gmail, invite external attendees, or write Calendar events.
- For PWA production deploys, `.vercel/project.json` must be `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm`.
