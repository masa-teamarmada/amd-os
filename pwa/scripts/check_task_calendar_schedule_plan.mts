#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTaskCalendarSchedulePlans,
  type TaskCalendarBusyWindow,
  type TaskCalendarExistingEvent,
  type TaskCalendarSource,
} from "../src/lib/task-calendar-schedule-plan.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = process.argv.includes("--fixture")
  ? process.argv[process.argv.indexOf("--fixture") + 1]
  : path.join(__dirname, "__fixtures__", "task_calendar_schedule_plan.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
  now: string;
  tasks: TaskCalendarSource[];
  busy_windows: TaskCalendarBusyWindow[];
  existing_task_events?: TaskCalendarExistingEvent[];
};

const plans = buildTaskCalendarSchedulePlans(
  fixture.tasks,
  fixture.busy_windows,
  fixture.existing_task_events || [],
  new Date(fixture.now),
);
const sx = plans.find((plan) => plan.task_id === "meeting-action-001");
assert.equal(sx?.action, "schedule_candidate");
assert.equal(sx?.title, "+SX mail 杉浦先生");
// ＋枠は PJ コードを必ずタイトルに持ち、その PJ の色で書く (manual 3-2 §PJ → カレンダー色)
assert.equal(sx?.color_id, "4");
assert.ok(sx?.calendar_writes.every((write) => write.colorId === "4"));
assert.equal(sx?.start, "2026-06-10T01:00:00.000Z");
assert.equal(sx?.end, "2026-06-10T01:30:00.000Z");
assert.equal(sx?.calendar_writes.length, 2);
assert.deepEqual(sx?.calendar_writes[0].attendees, []);
assert.ok(sx?.calendar_writes.every((write) => write.title.startsWith("+")));
assert.equal(sx?.calendar_writes[0].extendedProperties.private.amd_os_task_source_key, "amd-os:meeting_action_item:act_001");
assert.equal(sx?.slack_nudge_candidates.length, 1);
assert.equal(sx?.slack_nudge_candidates[0].slack_user_id, "U_MASA");

const gmail = plans.find((plan) => plan.task_id === "gmail-todo-001");
assert.equal(gmail?.action, "already_scheduled");
assert.deepEqual(gmail?.calendar_event_ids, ["existing_gmail_task_event"]);
assert.equal(gmail?.slack_nudge_candidates.length, 0);

const slack = plans.find((plan) => plan.task_id === "slack-todo-001");
assert.equal(slack?.action, "review_required");
assert.ok(slack?.review_reasons.includes("low_source_confidence"));
assert.equal(slack?.calendar_writes.length, 2);
assert.equal(slack?.slack_nudge_candidates.length, 0);

const kute = plans.find((plan) => plan.task_id === "meeting-action-002");
assert.equal(kute?.action, "hold");
assert.equal(kute?.title, "+KUTE 訪問資料 draft");
assert.equal(kute?.color_id, "11");
assert.ok(kute?.review_reasons.includes("missing_task_owner_calendar"));

console.log(JSON.stringify({
  ok: true,
  total: plans.length,
  actions: plans.reduce((acc, plan) => {
    acc[plan.action] = (acc[plan.action] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>),
}, null, 2));
