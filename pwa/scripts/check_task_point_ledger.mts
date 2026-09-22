import assert from "node:assert/strict";
import { buildTaskPointLedger, markNewTaskMilestones } from "../src/lib/task-point-ledger.ts";

const base = {
  actions: [{
    id: "a1", parent_id: null, origin_question_id: "q-child", title: "成果物A",
    status: "running", review_state: "accepted", planned_end: "2026-10-20",
    estimated_pt: 1.5, accepted_pt: null, reviewed_at: null, review_result: null,
  }],
  owners: [
    { action_id: "a1", member_id: "karu", share: null },
    { action_id: "a1", member_id: "chiko", share: null },
  ],
  questions: [
    { id: "q-child", parent_id: "q-ms" },
    { id: "q-ms", parent_id: null },
  ],
  questionActions: [],
  questionMilestones: [{ question_id: "q-ms", milestone_id: "ms-new" }],
  activeMilestoneIds: new Set(["ms-new"]),
};

const pending = buildTaskPointLedger(base);
assert.deepEqual(Array.from(pending.taskBasedMilestoneIds), ["ms-new"]);
assert.equal(pending.estimated.reduce((sum, line) => sum + line.points, 0), 1.5);
assert.equal(pending.accepted.length, 0, "未検収は報酬ptに入らない");
assert.deepEqual(pending.estimated.map((line) => line.memberId), ["karu", "chiko"]);
const unmapped = buildTaskPointLedger({ ...base, actions: [], questionMilestones: [] });
markNewTaskMilestones(unmapped, [
  { milestone_id: "new-ms", period_start_ym: "202610", tag: "normal" },
  { milestone_id: "routine-ms", period_start_ym: "202610", tag: "routine" },
]);
assert.deepEqual(Array.from(unmapped.taskBasedMilestoneIds), ["new-ms"], "対応線がまだ無くても新MSを月割りで先払いしない");

const accepted = buildTaskPointLedger({
  ...base,
  actions: [{ ...base.actions[0], status: "done", accepted_pt: 1.2,
    reviewed_at: "2026-10-31T15:30:00Z", review_result: "accepted" }],
  reviews: [{ id: "r1", action_id: "a1", milestone_id: "ms-new", title_snapshot: "成果物A", ym: "202611", accepted_pt: 1.2 }],
  reviewAllocations: [
    { review_id: "r1", member_id: "karu", earned_pt: 0.6 },
    { review_id: "r1", member_id: "chiko", earned_pt: 0.6 },
  ],
});
assert.equal(accepted.accepted.reduce((sum, line) => sum + line.points, 0), 1.2);
assert.deepEqual(accepted.accepted.map((line) => line.ym), ["202611", "202611"], "検収月は日本時間");

assert.throws(() => buildTaskPointLedger({
  ...base,
  questionMilestones: [],
}), /MSとの対応がない/);
assert.throws(() => buildTaskPointLedger({
  ...base,
  owners: [{ action_id: "a1", member_id: "karu", share: 0.4 },
    { action_id: "a1", member_id: "chiko", share: null }],
}), /担当割合/);
assert.throws(() => buildTaskPointLedger({
  ...base,
  questionMilestones: [
    { question_id: "q-ms", milestone_id: "ms-new" },
    { question_id: "q-ms", milestone_id: "ms-2" },
  ],
  activeMilestoneIds: new Set(["ms-new", "ms-2"]),
}), /複数/);

console.log("task-point-ledger: ok");
