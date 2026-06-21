import assert from "node:assert/strict";
import {
  buildTaskOwnerSlackNudge,
  buildTaskRegistrationRow,
  normalizeTaskRegistrationSource,
} from "../src/lib/task-calendar-register.ts";

const source = normalizeTaskRegistrationSource({
  project_id: "p21",
  project_code: "SX",
  title: "提案資料を直す",
  description: "MTG next action",
  owner_member_id: "ID001",
  owner_code_name: "まさ",
  owner_slack_user_id: "U_MASA",
  due_at: "2026-06-24T18:00:00+09:00",
  earliest_start: "2026-06-20T09:00:00+09:00",
  source_kind: "meeting_todo",
  source_id: "meeting-next-action-1",
  source_url: "https://amd-os-pwa.vercel.app/project/p21/cockpit",
  source_confidence: 0.92,
  source_excerpt: "次回までに提案資料を更新する",
});

assert.ok(source);
assert.equal(source.projectId, "p21");
assert.equal(source.taskId.startsWith("h1_task_"), true);
assert.equal(source.sourceKey, "amd-os:meeting_todo:meeting-next-action-1");

const row = buildTaskRegistrationRow({
  source,
  assigneeCodeName: "まさ",
  actor: "workflow:h1_meeting_flow",
  nowIso: "2026-06-19T00:00:00.000Z",
});

assert.equal(row.project_id, "p21");
assert.equal(row.assignee_member_id, "ID001");
assert.equal(row.assignee, "まさ");
assert.equal(row.task_source, "meeting_todo");
assert.equal(row.agent_kind, "h1_meeting_flow");
assert.equal(row.due_date, "2026-06-24");
assert.equal(row.start_date, "2026-06-20");
assert.match(row.description || "", /Source key: amd-os:meeting_todo:meeting-next-action-1/);

const nudge = buildTaskOwnerSlackNudge({
  source,
  appUrl: "https://amd-os-pwa.vercel.app",
  taskId: source.taskId,
  projectName: "SX",
});

assert.match(nudge, /タスクを自動登録したよ/);
assert.match(nudge, /\/project\/p21\/cockpit/);
assert.match(nudge, /task_id:/);

console.log(JSON.stringify({ ok: true, task_id: source.taskId, due_date: row.due_date }, null, 2));
