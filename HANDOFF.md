# AMD OS Handoff

Last updated: 2026-07-08 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: MTGカードの「準備/日程調整中」亡霊を解消

## Summary

See `pwa/design_log/sessions_2026-07.md` section "2026-07-08 — MTGカード 予定/準備/日程未確定 亡霊解消" for details.

- 複数PJのMTGカードに、開催済みなのに `予定MTG / 準備中`、`MTG準備情報`、`agenda / 進行案` TODO、別欄 `日程調整中MTG` が残る問題を修正した。
- `v0.39.6` (`bec41598`) で、予定MTG表示を開始時刻ベースへ変更し、薄い calendar sync 準備テンプレートを開催済み議事録へ表示しないようにし、開始済みMTGの `next_meeting_prep` TODO を自動終了するようにした。
- `v0.39.7` (`80cd1fe5`) で、`日程調整中MTG` 別欄を廃止。日程未確定は同じ `予定MTG / 準備中` 欄の行として、日付欄に `日程未確定` と表示する。
- `meeting_id` が `upcoming:` で始まっても、`source_kinds` が開催済みソースへ変わっている row は準備カード扱いしない。
- まさ確認: 2026-07-08 に「調整中なくなった」と受領済み。

## Current Truth

- Production behavior baseline: `https://amd-os-pwa.vercel.app/api/build-info`
  - Implementation build observed before handoff docs: `v0.39.7` / `80cd1fe557282e8bced855c60426735aab62de90` / `dirty=false`
  - After this handoff docs commit is pushed, `build_version` should stay `v0.39.7` but `git_sha` may be the docs-only closeout commit on top. Re-check `/api/build-info` for the exact current SHA.
- Accepted implementation commits:
  - `bec4159810c59f76f4fe115ce7c14e65dfb66f32` — `fix(pwa): clear stale meeting prep ghosts`
  - `80cd1fe557282e8bced855c60426735aab62de90` — `fix(pwa): fold undated meetings into schedule list`
- Work was done from clean disposable clone `/tmp/amd-os-mtg-ghost-fix-1783401569`, not from the dirty canonical checkout.

## Verification Already Run

```bash
npx tsc --noEmit
npm run test:critical-ui
node predicate checks for upcoming / tentative / held-source-upcoming rows
git diff --check
npm run build
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
curl -sS https://amd-os-pwa.vercel.app/api/build-info
```

Observed production cleanup / data checks:
- `proactive-todo-extract` one-shot after `v0.39.6`: `closed_expired_prep: 13`
- After cleanup: open/blocked `next_meeting_prep` linked to already-started meetings = `0`
- KUTE p25 under the new `v0.39.7` predicate: scheduled block contains future 3 rows; the screenshot rows from 2026-06-23 / 2026-06-22 do not enter the scheduled block.
- Browser automation could reach the auth wall only; desktop/mobile login screen had no overflow or console errors. Authenticated cockpit visual check is user-confirmed byまさ.

## Design Records

- User/dev manual: `pwa/manual/2-3-pj-cockpit.md`
- Current spec: `pwa/spec/3-3-meeting-flow-current-spec.md`
- Proactive TODO spec: `pwa/spec/2-4-proactive-todo-current-spec.md`
- Changelogs: `pwa/spec/6-1-appendix-changelog.md`, `pwa/manual/9-3-appendix-changelog.md`
- Bug/lesson: `pwa/BUGS.md` entry `[pwa/meeting-prep] 開催済みMTGに準備カード/TODOが亡霊のように残った`
- Session log: `pwa/design_log/sessions_2026-07.md`

## Repo State / Closeout

- Clean clone `/tmp/amd-os-mtg-ghost-fix-1783401569`: `main...origin/main`, clean at `80cd1fe5` before this handoff update.
- Canonical checkout `/Users/masa/projects/AMD/amd-os`: read-only inventory on 2026-07-08 showed `main...origin/main [ahead 7, behind 84]` with many unrelated modified/untracked files. Treat it as preexisting branch/dirty debt; do not mix it into this MTG-card fix.
- Preexisting local branches in canonical checkout: `book-a-pf012` (`main aligned`) and `codex/monthly-agreement-reward-boundary` (`patch-equivalent-main`). These were not created by this session and were not deleted here.
- This session created no branch and no registered git worktree.

## Open Risks / Next Checks

1. MTG ghost fix is done and deployed.
2. If a future screenshot still shows old MTG-card state, first check the visible build version / `/api/build-info`. If it is older than `v0.39.7`, it is cache or stale deployment; if it is `v0.39.7`, inspect `project_meeting_summaries.source_kinds`, `meeting_id`, `meeting_start_at`, and the UI predicates before changing data.
3. Canonical checkout dirty/branch debt remains separate cleanup work. Do not reset/delete/merge it without a dedicated cleanup pass.

## First Next Action

If continuing AMD OS work:

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
curl -sS https://amd-os-pwa.vercel.app/api/build-info
```

Then read `/Users/masa/projects/AGENTS.common.md`, AMD level memory, this `HANDOFF.md`, `pwa/spec/3-3-meeting-flow-current-spec.md`, `pwa/manual/2-3-pj-cockpit.md`, and `pwa/BUGS.md`.

## Archive Decision

MTG-card fix worker: `archive ok` after this handoff commit is pushed.

Canonical checkout `/Users/masa/projects/AMD/amd-os`: `do not archive` as a repo cleanup target until its preexisting dirty/ahead/behind state and old local branches are reconciled separately.
