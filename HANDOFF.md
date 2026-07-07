# AMD OS Handoff

Last updated: 2026-07-08 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: MTGカード亡霊修正の本体 closeout / handoff refresh

## Summary

See `pwa/design_log/sessions_2026-07.md` sections:
- `2026-07-08 — MTGカード 予定/準備/日程未確定 亡霊解消`
- `2026-07-08 — repo closeout / handoff refresh`

- MTGカードの `予定MTG / 準備中`、`MTG準備情報`、`next_meeting_prep` TODO、別欄 `日程調整中MTG` の亡霊修正は完了済み。
- まさ確認: 2026-07-08 に「調整中なくなった」と受領済み。
- その後の docs closeout commit まで `main` に入り、本体 checkout は `origin/main` と一致して clean。
- 今回の closeout で、古い handoff に残っていた「canonical checkout stale/dirty」という前提を更新した。

## Current Truth

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- HEAD / origin/main: `04a3a55d0cf62c48b588c8ba8f0c140cc41a022d`
- Production build-info observed during closeout:
  - `build_version`: `v0.39.7`
  - `git_sha`: `04a3a55d0cf62c48b588c8ba8f0c140cc41a022d`
  - `git_branch`: `main`
  - `dirty`: `false`
- Worktree registry: one registered worktree only, `/Users/masa/projects/AMD/amd-os [main]`.
- Local branch inventory: `main` only.
- Local main vs origin/main: ahead `0`, behind `0`.

## Accepted Implementation Commits

- `bec4159810c59f76f4fe115ce7c14e65dfb66f32` — `fix(pwa): clear stale meeting prep ghosts`
- `80cd1fe557282e8bced855c60426735aab62de90` — `fix(pwa): fold undated meetings into schedule list`
- `04a3a55d0cf62c48b588c8ba8f0c140cc41a022d` — `docs(handoff): record meeting card ghost closeout`

## Verification Already Run

Implementation verification from the MTG-card fix:

```bash
npx tsc --noEmit
npm run test:critical-ui
node predicate checks for upcoming / tentative / held-source-upcoming rows
git diff --check
npm run build
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
curl -sS https://amd-os-pwa.vercel.app/api/build-info
```

Closeout verification run on 2026-07-08:

```bash
bash /Users/masa/.codex/skills/closeout/scripts/closeout_inventory.sh /Users/masa/projects/AMD/amd-os
git status -sb --untracked-files=all
git worktree list
git branch -vv
git rev-list --left-right --count HEAD...origin/main
curl -sS https://amd-os-pwa.vercel.app/api/build-info
```

Observed cleanup / data checks from the implementation session:
- `proactive-todo-extract` one-shot after `v0.39.6`: `closed_expired_prep: 13`
- After cleanup: open/blocked `next_meeting_prep` linked to already-started meetings = `0`
- KUTE p25 under the `v0.39.7` predicate: scheduled block contains future 3 rows; the screenshot rows from 2026-06-23 / 2026-06-22 do not enter the scheduled block.
- Browser automation could reach the auth wall only; desktop/mobile login screen had no overflow or console errors. Authenticated cockpit visual check was user-confirmed byまさ.

## Design Records

- User/dev manual: `pwa/manual/2-3-pj-cockpit.md`
- Current spec: `pwa/spec/3-3-meeting-flow-current-spec.md`
- Proactive TODO spec: `pwa/spec/2-4-proactive-todo-current-spec.md`
- Changelogs: `pwa/spec/6-1-appendix-changelog.md`, `pwa/manual/9-3-appendix-changelog.md`
- Bug/lesson: `pwa/BUGS.md` entry `[pwa/meeting-prep] 開催済みMTGに準備カード/TODOが亡霊のように残った`
- Session log: `pwa/design_log/sessions_2026-07.md`

## Repo State / Closeout

- `git status -sb --untracked-files=all`: clean.
- Conflicts: none.
- Untracked files: none.
- Staged files: none.
- Registered worktrees: one, main only.
- Local branches: main only.
- Local unpushed commits: none.
- Main/default alignment: `main aligned`.
- Production alignment: `main aligned` (`/api/build-info` reports the current main SHA).
- This closeout session created no branch and no registered git worktree.
- Ignored local tooling artifacts present and expected: `.vercel/project.json`, `ios/supabase/.temp/linked-project.json`, `pwa/.next`, `pwa/node_modules`.
- Tracked local link marker: `ios/supabase/.temp/project-ref` is tracked in git; do not delete as temp trash.

## Outside-Repo Temp Note

There are multiple `/tmp/amd-os-*` disposable clones/artifacts from older sessions. They are not registered git worktrees and no current repo state depends on them. Because deleting them requires destructive filesystem cleanup, they were not removed in this closeout. Ifまさ wants a separate temp cleanup pass, remove only after listing exact paths and preserving any needed evidence.

## Open Risks / Next Checks

1. MTG ghost fix is done and deployed.
2. If a future screenshot still shows old MTG-card state, first check the visible build version / `/api/build-info`. If it is older than `v0.39.7`, it is cache or stale deployment; if it is `v0.39.7+`, inspect `project_meeting_summaries.source_kinds`, `meeting_id`, `meeting_start_at`, and the UI predicates before changing data.
3. No current repo closeout blocker remains.

## First Next Action

If continuing AMD OS work:

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
curl -sS https://amd-os-pwa.vercel.app/api/build-info
```

Then read `/Users/masa/projects/AGENTS.common.md`, AMD level memory, this `HANDOFF.md`, `pwa/AGENTS.md`, `pwa/CLAUDE.md`, and the spec/manual files relevant to the next task.

## Archive Decision

`archive ok` for the AMD OS repo session: main/default aligned, production aligned, clean status, no conflicts, no untracked files, main branch only, one registered worktree only, and no local ahead.
