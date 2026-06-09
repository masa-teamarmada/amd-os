# Dirty Cleanup Status 2026-06-09

Final classification for the stale root dirty archive.

## Current Root Result

- root checkout: `/Users/masa/projects/AMD/amd-os`
- recovery branch: `codex/recover-calendar-dry-run-v01626`
- recovery commit: `e08592e8 feat(pwa): recover calendar dry-run planners`
- build version after recovery: `v0.16.27`

## Bucket Classification

| bucket | status | handling |
|---|---|---|
| A. `scripts/worker-freshness-check.sh` | already-current | Same file already exists on current root. No port needed. |
| B. archive metadata | archive-only | `DIRTY_RECOVERY_20260609.md`, execution plan, and this status stay only on archive branch. |
| C. commander / migration notes | discarded from current | Historical stale-root ledger/migration text only. Current root already has the Vercel project guard note. |
| D. Calendar dry-run planners | ported | Ported to current root in `e08592e8`: meeting calendar upsert plan, task calendar schedule plan, fixtures, tests, package scripts, `BUILD_VERSION=v0.16.27`. |
| E. L6 meeting extraction docs | ported minimal | Ported only the dry-run planner boundary into `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`, `pwa/spec/3-3-meeting-flow-current-spec.md`, `pwa/manual/8-3-l2-extraction-routines-spec.md`, and changelogs. |
| F. PRS / AMD Score / L2 / ERS docs | discarded from current | Current `v0.16.27` docs already contain newer PRS primary, `R_net`, L2 old-slug, KUTE routing, contracts, and MTG attachment truth. Archive docs are older-base deltas and should not be merged. |
| G. generated/temp | excluded | Supabase temp files and empty/generated `pwa/supabase/postgres.sql` were not kept. |

## Verification Run On Current Root

- freshness gate: OK on `codex/recover-calendar-dry-run-v01626`, `BUILD_VERSION=v0.16.27`
- `npm run test:meeting-calendar-upsert-plan`: OK
- `npm run test:task-calendar-schedule-plan`: OK
- `npm run test:deploy-version-guard`: OK
- `npx tsc --noEmit`: OK
- `npm run build`: OK, both new routes listed
- local route smoke:
  - `POST /api/meeting-calendar/upsert-plan`: returns `write_enabled:false`
  - `POST /api/task-calendar/schedule-plan`: returns `write_enabled:false`
  - `execute=true` / `dry_run=false`: returns `calendar_write_disabled`

## Close

No unclassified stale-root dirty remains. This archive branch can be kept as a
record, but the recovery worktree itself no longer needs to stay mounted.
