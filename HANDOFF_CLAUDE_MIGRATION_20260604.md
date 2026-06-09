# HANDOFF - Claude Migration for AMD OS L2 Routine Incident

- Last updated: 2026-06-04 JST
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- Session topic: L2 Claude routine未登録事故の是正をClaude側へ移す
- Current branch observed: `codex/bzm-vercel-quota-gate`

## Why This Handoff Exists

まさ確認で、L2抽出をClaude定額token/routine上限内で回す方針だったのに、Claude Routines UIにはroutineが1本も無い事故が判明した。`~/.claude/scheduled-tasks/.../SKILL.md` は存在しても、Claude routineがACTIVE登録されている証拠ではない。

この事故で実害が出ているため、次セッションは「方針検討」ではなく「Claude側で実登録・証跡確認・docs current truth反映」を最優先にする。

## Absolute Rules For Next Session

- Vercel quota hard gate中。`git push` / `vercel deploy` 禁止。
- 作業はlocal確認・local commitまで。push/deployは `withheld due to Vercel quota gate`。
- worker quiet mode。worker詳細ログを親司令塔へ流さない。
- このスレッドで直接作業を進めない。次はClaude側で実登録作業を行う。
- `SKILL.mdがある` と `Claude routineがACTIVE登録されている` を絶対に混同しない。

## Current Truth

- Claude Routines UI: routine 0本とまさが確認。
- `amd-os-l2-consolidated-evidence`: 実体未確認。登録済み扱い禁止。
- L2③ MS進捗: MMOマシン Codex Desktop automation `amd-os-l3-ms-progress-extract` 維持。
- L2⑥ MTGフロー: MMOマシン Codex Desktop automation `amd-os-l6-meeting-flow` 維持。
- PWA/Vercel background LLM cronは復活禁止。
- L2⑪ = Atlas Signals。
- L2⑫ = Macrotrend Evidence / Index。
- L2⑬ = Member Weekly Activities。
- L2⑭ = Finance Ops Evidence。
- L2⑮ = VC News / Funding Signals。
- L2⑯ = Management Monthly Signal Evaluation。

## Required Claude Routine Targets

1. `amd-os-l2-consolidated-evidence`
   - cadence: daily 08:00 JST
   - target: L2②④⑤⑦⑨⑩⑪⑫
   - completion evidence: Claude Routines UI `ACTIVE / next run / last run` + initial dry/manual run evidence

2. Separate routine candidates
   - L2①: month-end, Supabase internal OS/L2 evidence origin
   - L2⑧: month-end after L2①, XRL checklist audit
   - L2⑬: weekly candidate, or daily pickup + weekly aggregation ifまさ判断
   - L2⑯: month-end final day 17:00 JST, Management Monthly Signal Evaluation

## Repo State To Inspect First

Run:

```sh
cd /Users/masa/projects/AMD/amd-os
git status -sb
git diff --stat
git log --branches --not --remotes --oneline
```

Known dirty before this handoff:

- `COMMANDER_TASKS.md`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`
- `pwa/supabase/postgres.sql` untracked

Additional dirty created in the interrupted Codex session:

- `pwa/design/L2_DATA.md`
- `pwa/spec/3-1-l2-data-extraction-current-spec.md`
- `pwa/manual/8-3-l2-extraction-routines-spec.md`
- `pwa/spec/5-3-automation-responsibility-current-spec.md`

Important: these docs edits were started in this Codex thread even afterまさ said not to start here. Treat them as draft local diffs, not approved final state. Claude should inspect them, keep only the parts that correctly express the accident/current truth, and either commit locally or rewrite as needed. Do not push.

## First Next Action

Open Claude Routines UI and create/verify the actual routines. Do not mark the task complete from repo docs alone.

Minimum close gate:

- Claude Routines UI shows the routine.
- routine is `ACTIVE`.
- `next run` is visible and correct.
- `last run` or manual/dry run evidence exists.
- first run produced DB row / outbox / applied / UI read evidence, or a clear blocker is recorded.
- docs are updated to remove ambiguous `Codex / subscription automation` wording.
- local commit only; push withheld due Vercel quota gate.

## Pointers

- `/Users/masa/projects/AMD/amd-os/COMMANDER_TASKS.md`
- `/Users/masa/projects/AMD/amd-os/pwa/design/L2_DATA.md`
- `/Users/masa/projects/AMD/amd-os/pwa/spec/3-1-l2-data-extraction-current-spec.md`
- `/Users/masa/projects/AMD/amd-os/pwa/spec/5-3-automation-responsibility-current-spec.md`
- `/Users/masa/projects/AMD/amd-os/pwa/manual/8-3-l2-extraction-routines-spec.md`
- `/Users/masa/projects/AMD/amd-os/pwa/design/l2_expanded_automation_strategy.md`
- `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`
