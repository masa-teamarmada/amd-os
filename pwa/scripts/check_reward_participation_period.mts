import assert from "node:assert/strict";
import { buildRewardSummary } from "../src/lib/reward-summary.ts";
import { activeProjectMemberIdsForYm } from "../src/lib/project-participation.ts";
import { plannedMemberPointsForMilestone } from "../src/lib/admin/ms-overview-calc.ts";

const members = [
  { member_id: "masa", is_active: true, join_ym: "202601", leave_ym: null },
  { member_id: "karu", is_active: true, join_ym: "202601", leave_ym: "202609" },
  { member_id: "chiko", is_active: true, join_ym: "202601", leave_ym: "202609" },
];
assert.deepEqual([...activeProjectMemberIdsForYm(members, "202609")], ["masa", "karu", "chiko"]);
assert.deepEqual([...activeProjectMemberIdsForYm(members, "202610")], ["masa"]);
assert.equal(activeProjectMemberIdsForYm(members, "202512").size, 0);
const planCycle = { plan_cycle_id: "test", project_id: "p21", status: "active", budget_yen: 300000,
  total_points: 30, period_start_ym: "202608", period_end_ym: "202610" };
const milestones = [{ milestone_id: "dd", title: "DD", points: 6, tag: "normal", goal_level: "season",
  period_start_ym: "202608", target_ym: "202610" }];
const responsibilities = members.map((m, i) => ({ milestone_id: "dd", member_id: m.member_id, share: i === 0 ? 0.2 : 0.4 }));
const billingsByYm = new Map(["202608", "202609", "202610"].map(ym => [ym, { project_id: "p21", ym, budget_yen: 10000 }]));
function summary(ym: string, dated: boolean) {
  return buildRewardSummary({ ym, milestones, responsibilities, progress: [],
    activeMemberIds: new Set(members.map(m => m.member_id)), projectMembers: dated ? members : undefined,
    memberMap: { masa: "まさ", karu: "かる", chiko: "ちこ" }, billing: billingsByYm.get(ym)!, billingsByYm,
    planCycle, project: { project_id: "p21" } });
}
function stable(value: ReturnType<typeof summary>) {
  return value && { ...value, meta: value.meta && { ...value.meta, generatedAt: "" } };
}
for (const ym of ["202608", "202609"]) assert.deepEqual(stable(summary(ym, true)), stable(summary(ym, false)), `${ym}の実績・支払・繰越を保持`);
const october = summary("202610", true)!;
assert.equal(october.members.find(m => m.memberId === "masa")?.earnedPt, 2);
for (const id of ["karu", "chiko"]) {
  const row = october.members.find(m => m.memberId === id)!;
  assert.equal(row.earnedPt, 0, "停止後の新規ptは0");
  assert.ok(row.totalPay > 0, "過去分の繰越は停止後も支払対象");
  assert.ok((row.stockYen ?? 0) > 0, "上限を超えた未払残を消さない");
}
const planned = plannedMemberPointsForMilestone({ points: 6, isCapExtra: false,
  periodStartYm: "202608", targetYm: "202610", responsibilities: responsibilities.map(r => ({
    memberId: r.member_id, codeName: r.member_id, share: r.share, role: "member", taskDescription: null,
  })) }, members.map(m => ({ memberId: m.member_id, codeName: m.member_id, joinYm: m.join_ym, leaveYm: m.leave_ym,
    isPl: false, isPm: false })));
assert.ok(Math.abs(planned.get("masa")! - 2.8) < 1e-8);
assert.ok(Math.abs(planned.get("karu")! - 1.6) < 1e-8);
assert.ok(Math.abs(planned.get("chiko")! - 1.6) < 1e-8);
console.log("reward-participation-period: ok");
