import assert from "node:assert/strict";
import { sxProjectOwnerLoads } from "../src/lib/sx-project-owner-load.ts";

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

console.log("sx project owner load tests passed");
