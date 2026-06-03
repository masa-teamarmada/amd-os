# Worker Quiet Mode Rule Update

Date: 2026-06-03 JST

Scope:
- Update Textbook/BZM commander ledgers for the new all-commander worker quiet mode.
- Do not edit public manuscript body.
- Do not change historical run notes.

## Executive verdict

Worker-to-parent reporting is now quiet by default.

After a worker is launched, the worker should not send progress updates, interim summaries, self-judged completion reports, or routine stop reports into the parent commander thread.

The worker sends one parent-thread closeout only after Masa explicitly says in the worker thread that the work is fully complete, OK, or otherwise accepted.

## Exceptions

A worker may send one short blocker/handoff to the parent commander only when commander intervention is needed, for example:

- `UU` conflict;
- unclassified dirty state;
- permission, destructive operation, or external decision required;
- repeated identical blocker with no meaningful way forward;
- worker cannot safely classify its state.

## Commander behavior

The commander should not rely on worker reports to fill the parent chat.

Instead, the commander should:

- use heartbeat/read_thread quietly when monitoring is needed;
- prohibit `askuserquestion` / `request_user_input` in worker prompts;
- update `COMMANDER_TASKS.md` frequently for worker launch, state classification change, commander decision, main/deploy gate, blocker, completion confirmation, and next-action change;
- keep each update short;
- record active worker id, state, next check condition, Masa decision if any, completion/rejection, and next action;
- avoid pasting worker detail logs into the ledger.
- do not wait for additional Masa approval before editing md/run note/ledger files in AMD worktrees, `.worktrees`, or clean `/private/tmp` worktrees. Avoid dirty main worktrees; continue in a clean worktree when needed.

## Prompt update

Future worker prompts must remove or override the old rule:

`完了・停止・要判断時は必ず親司令塔へ能動報告`

The replacement rule is:

`worker quiet mode: no parent-thread report unless Masa accepted final closeout or commander intervention is required.`

Also add:

`askuserquestion/request_user_input are prohibited. If judgment is truly needed, send one short blocker/handoff to the parent commander; the commander will bundle the decision.`

## Files updated

- `pwa/bzm/textbook/COMMANDER_TASKS.md`
- `pwa/bzm/COMMANDER_TASKS.md`

## Verification

- `git diff --check`: passed.
- conflict marker scan: no hits.
- md-only; build not required.
