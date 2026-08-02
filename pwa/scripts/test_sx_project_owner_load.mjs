import assert from "node:assert/strict";
import {
  sxProjectOwnerLoads,
  sxProjectWorkUnitIsDueSoon,
  sxProjectWorkUnitIsOverdue,
} from "../src/lib/sx-project-owner-load.ts";

const management = {
  asOf: "2026-08-01",
  milestones: [
    {
      id: "paid-poc",
      slug: "paid-poc",
      title: "有償PoC合意",
      gate: "有償PoCの口頭合意",
      manualStatus: "unassessed",
      ownerLabel: "石原先生",
      plannedEnd: null,
    },
    {
      id: "newco",
      slug: "newco",
      title: "NewCo設立",
      gate: "NewCo設立",
      manualStatus: "on_track",
      ownerLabel: "輕部",
      plannedEnd: "2026-09-30",
    },
  ],
  dependencies: [
    {
      predecessorMilestoneId: "paid-poc",
      successorMilestoneId: "newco",
      required: true,
    },
  ],
  tasks: [
    {
      id: "task-1",
      milestoneId: "paid-poc",
      title: "候補先へ条件提示",
      status: "blocked",
      ownerLabel: "石原先生",
      plannedEnd: "2026-07-31",
    },
  ],
  issues: [],
  hypotheses: [],
  validationRuns: [],
  decisions: [],
  actions: [],
  partners: [],
};

const loads = sxProjectOwnerLoads(management);
const ishihara = loads.find((load) => load.ownerLabel === "石原先生");
assert.ok(ishihara, "owner load should merge work from different resources");
assert.equal(ishihara.openCount, 2);
assert.equal(ishihara.blockedCount, 1);
assert.equal(ishihara.overdueCount, 1);
assert.equal(ishihara.dueUnsetCount, 1);
assert.deepEqual(ishihara.impactedGates, ["NewCo設立", "有償PoCの口頭合意"]);

// Round 32 (2026-08-02): every unit must carry a single navigation target so the PJ全体管制入口
// can jump back to the source edit context (gantt row for milestone/task, issue card otherwise).
const allUnits = loads.flatMap((load) => load.items);
const milestoneUnit = allUnits.find((item) => item.kind === "milestone");
assert.equal(milestoneUnit.navMilestoneId, "paid-poc");
assert.equal(milestoneUnit.navTaskId, null);
const taskUnit = allUnits.find((item) => item.kind === "task");
assert.equal(taskUnit.navTaskId, "task-1");
assert.equal(taskUnit.navMilestoneId, "paid-poc");
assert.equal(
  sxProjectWorkUnitIsOverdue(taskUnit, "2026-08-01"),
  true,
  "task due 2026-07-31 is overdue as of 2026-08-01",
);
assert.equal(sxProjectWorkUnitIsDueSoon(taskUnit, "2026-08-01"), false);

console.log("sx project owner load tests passed");
