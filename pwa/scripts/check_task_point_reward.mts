import assert from "node:assert/strict";
import { buildRewardSummary } from "../src/lib/reward-summary.ts";
import type { TaskPointLedger } from "../src/lib/task-point-ledger.ts";

const planCycle = {
  plan_cycle_id: "pc-sx-test", project_id: "p21", status: "active", budget_yen: 300000,
  total_points: 30, period_start_ym: "202609", period_end_ym: "202611",
};
const milestones = [
  { milestone_id: "ms-task", title: "成果物MS", points: 3, tag: "normal", goal_level: "annual",
    period_start_ym: "202610", target_ym: "202611" },
  { milestone_id: "ms-routine", title: "定常MS", points: 3, tag: "routine", goal_level: "annual",
    period_start_ym: "202609", target_ym: "202611" },
];
const responsibilities = [
  { milestone_id: "ms-task", member_id: "karu", share: 1 },
  { milestone_id: "ms-routine", member_id: "masa", share: 1 },
];
const billingsByYm = new Map(["202609", "202610", "202611"].map((ym) => [ym, {
  project_id: "p21", ym, budget_yen: 20000,
}]));
const taskLedger: TaskPointLedger = {
  taskBasedMilestoneIds: new Set(["ms-task"]), estimated: [], accepted: [
    { actionId: "a1", title: "検収した成果物", milestoneId: "ms-task",
      memberId: "karu", ym: "202611", points: 1.5, basis: "accepted" },
  ],
};
const summary = (ym: string, ledger?: TaskPointLedger) => buildRewardSummary({
  ym, milestones, progress: [], responsibilities, activeMemberIds: new Set(["karu", "masa"]),
  memberMap: { karu: "かる", masa: "まさ" }, billing: billingsByYm.get(ym)!, billingsByYm,
  planCycle, project: { project_id: "p21", fee_type: "monthly_fixed", fee_amount: 30000 },
  taskLedger: ledger,
});

const septemberOld = summary("202609");
const septemberPilot = summary("202609", taskLedger);
assert.deepEqual(
  septemberPilot?.members.map((m) => [m.memberId, m.earnedPt, m.totalPay]),
  septemberOld?.members.map((m) => [m.memberId, m.earnedPt, m.totalPay]),
  "9月以前の報酬を1円も動かさない",
);
const october = summary("202610", taskLedger);
assert.equal(october?.members.find((m) => m.memberId === "karu")?.earnedPt ?? 0, 0,
  "期限が来ても未検収なら成果物ptは0");
const november = summary("202611", taskLedger);
assert.equal(november?.members.find((m) => m.memberId === "karu")?.earnedPt, 1.5,
  "検収月に担当者へ確定ptが入る");
assert.equal(november?.members.find((m) => m.memberId === "masa")?.earnedPt, 1,
  "定常MSの月割りは残る");
assert.ok((november?.members.find((m) => m.memberId === "karu")?.totalPay ?? 0) <= 20000,
  "既存の月次支払上限を通す");
console.log("task-point-reward: ok");
