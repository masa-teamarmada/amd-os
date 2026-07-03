# AMD OS Handoff

Last updated: 2026-07-03 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: ZMP reward liability offset closeout + current-truth warning

## Latest Session Summary

See `pwa/design_log/sessions_2026-07.md` section "2026-07-03 — ZMP reward liability offset closeout + handoff".

- Reward offset implementation originally shipped in `v0.37.3`, commit `45cb4e551d4a1aa24dbb8e3d9dd428ac1f5fc580`.
- `origin/main` later advanced through MS/monthly-agreement safety work up to `v0.38.11`; this handoff is rebased on top of that line and does not lower build version.
- Added `reward_member_liability_offsets` so paid/sent overages are offset only from the same member's own unpaid stock. Do not offset against company reserve, other members, or PJ buffer.
- ZMP 2026 active offsets are only:
  - `ID008` うめ: 1,560円 from own stock
  - `ID009` あび: 1,658円 from own stock
  - `ID004` こう and `ID026` しん: small overages intentionally tolerated by まさ decision, no active offset.
- Recomputed production reward cache for 202601 + 11 months. ZMP 202605 showed `liabilityOffsetAppliedYen=3,218` and active offset remaining 0.
- Corrected audit metadata typo: migration 162 had `ID010` in `metadata_json.tolerated_members`; `ID010=らん`. Migration 163 updated existing production active rows to `ID004/ID026`.

## Repo State

- Clean current-truth worktree used for this handoff: `/tmp/amd-os-ms-overview-v03643`.
- Rebase base before this handoff commit: `origin/main` `54d080e8` (`fix(pwa): enforce monthly agreement modal gate`).
- Canonical local checkout `/Users/masa/projects/AMD/amd-os` is not clean/current: observed `main...origin/main [ahead 7, behind 58]` earlier in this closeout with many tracked/untracked changes. Do not overwrite or blindly merge it.
- If the next session starts in `/Users/masa/projects/AMD/amd-os`, run `git fetch origin main --prune` and inspect status before trusting local files. For current production truth, compare with `origin/main` or use a fresh clean clone.

## Verification Run

Already observed in this closeout:

```bash
npx tsc --noEmit
npm run test:critical-ui
python3 -X utf8 /tmp/amd-os-ms-overview-v03643/pwa/scripts/apply_ddl.py /tmp/amd-os-ms-overview-v03643/pwa/scripts/migrations/163_fix_zmp_liability_offset_metadata.sql
GET https://amd-os-pwa.vercel.app/api/cron/payout-reward-cache-refresh?ym=202601&lookahead=11
GET https://amd-os-pwa.vercel.app/api/build-info
```

Observed:
- reward refresh: `cycleCount=130`, `refreshedCount=130`.
- active offset rows after metadata fix:
  - ID008 any 1,560円, `applies_from_ym=202605`, `tolerated_members=["ID004","ID026"]`
  - ID009 any 1,658円, `applies_from_ym=202605`, `tolerated_members=["ID004","ID026"]`
- `npm run test:critical-ui` passed before rebase. Run it again after conflict resolution before deploy.

## Important Warnings

- Earlier explanation "company reserve can absorb ¥17,453" was wrong. The current rule is: paid/sent amounts are locked; only the same member's own unpaid stock can absorb that member's overpayment. Other members and company reserve must not be used.
- Production DB also contains p19 `reward_member_liability_offsets` rows with `status='pending'`, `amount_yen=null`, `applies_from_ym=null` from another in-flight bundle. Current reward code filters `status='active'`, so these do not affect calculation. Do not delete them without understanding the other bundle.
- Local `npm run build` in the old temp clone failed due the temp `node_modules` symlink/Turbopack and existing CSS minifier issue. Later origin/main monthly-agreement closeout reports `npm run build` passed in `/tmp/amd-os-monthly-agreement-modal-ZYKPJe`; re-run current checks when continuing.

## Design Records

- Main reward spec: `pwa/manual/7-1-reward-calc-spec.md`
- Payout operation spec: `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
- Season audit spec: `pwa/design/season_budget_actual.md`
- DB schema snapshot: `pwa/design/db_schema.md`
- Bug/lesson: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
- Migrations:
  - `pwa/scripts/migrations/161_reward_member_liability_offsets.sql`
  - `pwa/scripts/migrations/162_zmp_2026_liability_offsets.sql`
  - `pwa/scripts/migrations/163_fix_zmp_liability_offset_metadata.sql`

## Unresolved Tasks

1. ZMP active offsets for あび/うめ are complete and production-verified.
2. If まさ later wants the tolerated しん/こう difference to be strictly closed too, get an explicit policy decision first. Do not silently use company reserve or another member's stock.
3. Reconcile canonical local checkout separately. It is stale/dirty and likely contains other worker/user changes.
4. Investigate the p19 `status='pending'` liability offset rows only in the context of the owner bundle. They are ignored by current reward code.
5. Monthly-agreement modal closeout from `54d080e8` remains recorded in `pwa/design_log/sessions_2026-07.md`; if working that lane, read `pwa/spec/3-14-monthly-work-agreement-current-spec.md`.

## First Next Action

1. Read this `HANDOFF.md`.
2. Then read `pwa/manual/7-1-reward-calc-spec.md`, `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`, and `pwa/design/season_budget_actual.md`.
3. Then read `pwa/BUGS.md`.
4. Verify current repo truth before editing:

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
git rev-list --left-right --count origin/main...HEAD
git log --oneline -5 origin/main
curl -s https://amd-os-pwa.vercel.app/api/build-info
```

5. If continuing finance/reward work, query production DB first and separate `active` offsets from `pending` draft rows.
