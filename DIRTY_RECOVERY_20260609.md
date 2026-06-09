# Root Dirty Recovery 2026-06-09

This branch archives the dirty state that was present in `/Users/masa/projects/AMD/amd-os`
while that root checkout was still on stale `codex/bzm-vercel-quota-gate` / `v0.15.3`.

The root checkout was moved back to a current line and is now on
`codex/root-current-v01624`; this branch keeps the old dirty work out of the
root working tree without discarding it.

## Included

- AMD OS commander ledger updates in `COMMANDER_TASKS.md`.
- PRS / AMD Score / L2 / meeting-flow manual and spec edits.
- Calendar upsert / task schedule dry-run implementation and fixtures.
- Claude migration handoff files.
- `scripts/worker-freshness-check.sh` from the stale root dirty state.

## Excluded

- Supabase `.temp` files.
- Empty/generated `pwa/supabase/postgres.sql`.

## Next Handling

- Do not deploy from this branch.
- Cherry-pick or re-port useful pieces onto a current `v0.16.24+` line after freshness checks.
- Treat `COMMANDER_TASKS.md` as historical ledger state, not as current truth unless rechecked.
