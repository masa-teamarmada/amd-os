# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: W-Prep Launch automation hardening and closeout

## Summary

See `pwa/design_log/sessions_2026-07.md` section:
- `2026-07-09 — W-Prep Launch 漏れ補完 + automation設計修正`

This session fixed the weekly visible prep-thread lane after missing meetings and misleading worker first messages were found.

- W-Prep must inspect both Google Calendar and the AMD OS DB for the next 7 days. DB-only extraction is explicitly forbidden because it misses calendar-backed meetings that have not yet synced into `project_meeting_summaries`.
- Thread creation remains exact-once: claim the target DB row first, read it back, then create one visible prep thread, immediately save `prep_worker_session_id`, rename to `{meeting_title} prep`, and pin it.
- Thread targets must use the matched PJ directory under `/Users/masa/projects/AMD` when available; `/Users/masa/projects/AMD/amd-os` is not a prep thread working directory.
- Prep prompts are now Japanese and include the AMD OS repo path only as the DB/reference repo.
- Prep worker first visible message now reports three completed analyses and ends with `これであってる？どうする？`.
- Shared-folder prep deliverables must now be HTML primary artifacts following AMD OS design code. Google Docs, Markdown, Slides, and Sheets are not allowed as the primary prep deliverable.
- The active automation prompt and automation memory were updated outside the repo.

## Current Truth

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Automation ID: `w-prep-launch`
- Active automation file: `/Users/masa/.codex/automations/w-prep-launch/automation.toml`
- Automation memory: `/Users/masa/.codex/automations/w-prep-launch/memory.md`
- Current schedule: every Wednesday 15:00 JST, written as visible local time.
- W-Prep thread target rule: use `/Users/masa/projects/AMD/<PJ>` when the PJ directory can be determined; fallback only to `/Users/masa/projects/AMD`.
- Knowledge path rule for workers: `~/knowledge/...` references resolve under `/Users/masa/projects/knowledge/...`.
- Repo commit for this closeout: re-check with `git log -1 --oneline` after the final push because this file is part of that closeout commit.

## Verification Already Run

- Updated the active automation through Codex automation tooling.
- Verified the active automation content contains the new pinning, Japanese prompt, Calendar+DB scan, knowledge path, first-message contract, and HTML artifact rules.
- Verified the repo docs/spec/manual surfaces mention the W-Prep rules using targeted text searches.
- This closeout is docs/SKILL/automation-prompt only. No app build or runtime test was run for this bundle.

## Design Records

- W-Prep canonical spec: `pwa/spec/3-3-meeting-flow-current-spec.md`
- Prep worker skill: `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md`
- Scheduled task index: `pwa/scheduled-tasks/README.md`
- L2/current data surface: `pwa/design/L2_DATA.md`
- Manual sections:
  - `pwa/manual/2-3-pj-cockpit.md`
  - `pwa/manual/3-2-data-and-extraction.md`
  - `pwa/manual/8-3-l2-extraction-routines-spec.md`
- Changelog: `pwa/manual/9-3-appendix-changelog.md`
- Bug/lesson: `pwa/BUGS.md` entry `[automation/w-prep] Calendar未同期MTGのprep漏れ・第一声/資料形式の仕様ズレ (2026-07-09)`
- Session log: `pwa/design_log/sessions_2026-07.md`

## Dirty State To Preserve

These files were already dirty or belong to other lanes. Do not revert or stage them as part of W-Prep closeout.

| path | class | owner guess | next action | risk |
|---|---|---|---|---|
| `pwa/scripts/atlas_signal_review_tool.mjs` | other-worker / Atlas WIP | Atlas signal worker | Validate disabled-ingest retryable handling, then commit or revert in the Atlas lane. | Low/Medium: accidental staging can ship unreviewed queue behavior. |
| `pwa/src/app/api/admin/ms-overview/route.ts` | other-worker / MS finance WIP | MS design amount worker | Decide whether design amount should use `budget × pt ratio`; if yes, sync spec/manual, test, bump version, commit, push. | Medium: accidental staging can ship unverified finance math. |
| `pwa/src/components/admin/AdminMsOverviewClient.tsx` | other-worker / MS finance WIP | MS design amount worker | Same bundle as above. | Medium |
| `pwa/src/lib/admin/ms-overview-calc.ts` | other-worker / MS finance WIP | MS design amount worker | Same bundle as above. | Medium |

## First Next Action

If W-Prep is touched again:

```bash
cd /Users/masa/projects/AMD/amd-os
git status -sb --untracked-files=all
git log -3 --oneline
sed -n '1,220p' /Users/masa/.codex/automations/w-prep-launch/automation.toml
tail -80 /Users/masa/.codex/automations/w-prep-launch/memory.md
```

Then verify any reported missing prep by scanning Calendar and DB together for the next 7 days. Do not create a duplicate thread when `prep_worker_session_id` already exists or an equivalent canonical row is `claiming` / `preparing` / `ready`.

## Closeout Decision

`do not archive` for the whole shared checkout while the unrelated Atlas/MS dirty files remain. This W-Prep bundle itself is ready to commit and push.
