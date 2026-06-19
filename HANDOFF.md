# HANDOFF - AMD OS

- Last updated: 2026-06-19 (H-1 recurring MTG series card fix / closeout)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- Production URL: `https://amd-os-pwa.vercel.app`
- Default branch: `main` only. Do not create branches for normal worker closeout.

## Latest Session Summary

- H-1 Meeting Flow の future Calendar 予定カードで、定例/recurring MTG が複数カードとして表示される問題を修正。
- `pwa/src/lib/meeting-series.ts` を共通 helper とし、cockpit / HUD の upcoming rows を series card に集約。
- `calendar-sync` は recurring series の2件目以降を `recurring_series_future_occurrence` で skip。`recurring_event_id` がDBへ残らない既存カードでも、title が `定例` / `月次` / `毎月` / `weekly` / `monthly` 等なら曜日を外して `PJ + title + 開始時刻` で series 推定する。
- v0.28.7 は曜日入り fallback で月次定例を畳めなかった。v0.28.8 で補正し、本番反映済み。その後 production は v0.28.10 / `75df41af` まで進行。
- 詳細ログ: `pwa/design_log/sessions_2026-06.md` の `2026-06-19 — H-1 recurring 予定MTGカード series 集約修正`。

## Repo State

- Branch: `main`
- Local HEAD at closeout: current local HEAD (`docs: handoff H1 recurring meeting card fix`; run `git log -1 --oneline` for the exact hash)
- `origin/main` / production at closeout: `75df41af` (`Simplify wallet finance table`), build `v0.28.10`
- Branch state at closeout: `main...origin/main [ahead 1, behind 1]`
- Dirty file at closeout, not from H-1: `pwa/src/components/admin/AdminPayoutsClient.tsx` (finance/admin reward debt ledger continuation)
- Production check to rerun if needed: `curl -sS https://amd-os-pwa.vercel.app/api/build-info`

## Verification Run This Session

- `npx eslint src/lib/meeting-series.ts src/components/cockpit/CockpitMeetingSummary.tsx src/components/hud/HudCockpitMeetingSummary.tsx src/app/api/meeting-prep/calendar-sync/route.ts`
- `npx tsc --noEmit --pretty false`
- `npm run test:critical-ui`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`

Note: `npm run lint` full-repo still has pre-existing lint debt unrelated to this H-1 fix. Use targeted lint for touched files unless doing a separate lint cleanup.

## Unresolved Tasks

- None for the H-1 recurring MTG card fix itself.
- Handoff docs commit is local-only because `origin/main` advanced and unrelated finance/admin dirty files exist. Do not push/rebase blindly; first resolve or quarantine the payout/reward dirty files.
- If a duplicate still appears, first inspect that card's `title`, `meeting_date`, `meeting_start_at`, `calendar_event_id`, `meeting_id`, and `source_kinds` in `project_meeting_summaries`; likely action is extending `looksSeriesLikeTitle` in `pwa/src/lib/meeting-series.ts` and `calendar-sync`.

## Read First Next Session

1. `AGENTS.md`
2. `CLAUDE.md`
3. `pwa/AGENTS.md`
4. `pwa/CLAUDE.md`
5. `SESSION_MIGRATION_PROMPT.md`
6. `pwa/design/meeting_summaries.md`
7. `pwa/design/L2_DATA.md`
8. `pwa/manual/2-3-pj-cockpit.md`
9. `pwa/manual/3-2-data-and-extraction.md`
10. `pwa/manual/8-3-l2-extraction-routines-spec.md`
11. `pwa/BUGS.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb
git log --left-right --oneline main...origin/main
curl -sS https://amd-os-pwa.vercel.app/api/build-info
```

Expected as of this handoff: `main` may be ahead/behind until the local handoff docs commit is rebased or cherry-picked onto current `origin/main`. Production build should report `v0.28.10` / `75df41af` or newer.

## Guardrails

- Never use `git add .`.
- Do not revert dirty files you did not create. Work with them or commit/carry-forward explicitly.
- For PWA code changes, bump `pwa/src/lib/build-info.ts` before deploy.
- PWA production deploy is `main push = Vercel auto deploy`; use `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` and monitor build-info.
