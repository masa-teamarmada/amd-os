# AMD OS Proactive Heartbeat

## Purpose

10:15-20:15 JST の毎時15分に、`proactive_outbox` の `queued` / `blocked` かつ due soon の行を拾い、対応する PJ 司令塔 thread へ能動通知する。heartbeat は通知と状態記録だけを担い、重い draft 作成は司令塔 worker に渡す。

## Inputs

- DB tables: `proactive_outbox`, `project_commander_threads`, `proactive_loop_events`, `proactive_loops`
- Helper: `pwa/scripts/proactive_loop_tool.mjs`
- Design source: `pwa/design/proactive_operating_loop.md`
- Schema source: `pwa/design/db_schema.md`

## Schedule

JST daily:

- 10:15
- 11:15
- 12:15
- 13:15
- 14:15
- 15:15
- 16:15
- 17:15
- 18:15
- 19:15
- 20:15

## Standard Run

Run from repo root:

```sh
node pwa/scripts/proactive_loop_tool.mjs heartbeat --status queued,blocked --due-hours 72 --limit 20 --json
```

If the current worktree does not have env files, load the main checkout env only for the command:

```sh
set -a
source /Users/masa/projects/AMD/amd-os/pwa/.env.local
set +a
node pwa/scripts/proactive_loop_tool.mjs heartbeat --status queued,blocked --due-hours 72 --limit 20 --json
```

For each returned `actions[]` item:

1. If `can_send=false`, do not guess a thread. Report `routing_missing` to AMD OS commander.
2. Use `send_message_to_thread` with:
   - `threadId = commander_thread_id`
   - `prompt = prompt`
3. Only after `send_message_to_thread` succeeds, run:

```sh
node pwa/scripts/proactive_loop_tool.mjs mark-sent <outbox_id> --summary "Heartbeat notified <project_label> commander."
```

4. Re-run:

```sh
node pwa/scripts/proactive_loop_tool.mjs list --status queued,blocked --due-hours 72 --json
```

## Safety Rules

- Do not send external email, Slack, Docs, or counterpart messages from heartbeat.
- Do not create new NIMS outbox unless due_at / agenda is explicitly decided elsewhere.
- Do not rewrite seed project ids. `zmp` and `p19` are both known aliases; use the helper output as current routing.
- Do not mark-sent before a `send_message_to_thread` call succeeds.
- If duplicate risk appears (`status` already `sent_to_commander`, existing `sent_at`, or commander thread already has the same outbox id in recent messages), stop that row and report `duplicate_risk`.
- If Supabase is unreachable, report `transient_network` and retry next heartbeat. Do not create fallback rows manually.

## Commander Message Template

The helper-generated `prompt` is the template. It includes:

- PJ label / project_id / outbox_id
- priority / due_at JST / trigger / ball_owner / draft_type
- recommended first move
- risk if late
- evidence refs
- commander next steps

## Completion Report

Each heartbeat report should include:

- picked count
- sent count
- mark-sent count
- routing_missing count
- duplicate_risk count
- remaining queued/blocked count
- any failed thread ids or outbox ids
