import assert from "node:assert/strict";
import {
  sxGateRequirementCounts,
  sxGateRequirementState,
  sxGateRequirementsBySuccessor,
  sxMilestoneRequiredTaskSummary,
} from "../src/lib/sx-gate-requirements.ts";

const milestones = [
  {
    id: "paid-poc",
    slug: "business-paid-poc-oral-agreement",
    manualStatus: "completed",
    completionEvidence:
      "先方：PoC候補A\n合意内容：有償PoC 1件\n確認日：2026-08-01\n根拠：面談メモ",
  },
  {
    id: "investment",
    slug: "funding-investment-oral-agreement",
    manualStatus: "completed",
    completionEvidence: "口頭合意あり",
  },
  {
    id: "optional",
    slug: "optional",
    manualStatus: "completed",
    completionEvidence: "記録あり",
  },
  {
    id: "newco",
    slug: "newco",
    manualStatus: "unassessed",
    completionEvidence: null,
  },
];

const dependencies = [
  {
    id: "d1",
    predecessorMilestoneId: "paid-poc",
    successorMilestoneId: "newco",
    required: true,
  },
  {
    id: "d2",
    predecessorMilestoneId: "investment",
    successorMilestoneId: "newco",
    required: true,
  },
  {
    id: "d3",
    predecessorMilestoneId: "optional",
    successorMilestoneId: "newco",
    required: true,
  },
  {
    id: "d4",
    predecessorMilestoneId: "missing",
    successorMilestoneId: "newco",
    required: true,
  },
];

// Round 32 (2026-08-02): achievement of the two blocking milestones now also requires every
// required task under them to be complete, not just the four-item evidence text. Give paid-poc
// a fully completed required-task chain so the "evidence + tasks both ready" case is exercised.
const requiredTasks = [
  { milestoneId: "paid-poc", sortOrder: 1, title: "A", status: "completed" },
  { milestoneId: "paid-poc", sortOrder: 2, title: "B", status: "completed" },
];

const requirements =
  sxGateRequirementsBySuccessor(milestones, dependencies, requiredTasks).get(
    "newco",
  ) || [];
assert.equal(
  requirements.length,
  2,
  "only the two explicit blocking milestones should become requirements",
);
assert.equal(
  requirements.find((item) => item.milestone.id === "paid-poc")?.state,
  "met",
  "completed with evidence and all required tasks done should be met",
);
assert.equal(
  requirements.find((item) => item.milestone.id === "investment")?.state,
  "unconfirmed",
  "oral agreement without the four required evidence fields must not be treated as met",
);
assert.equal(
  sxGateRequirementState(
    milestones.find((milestone) => milestone.id === "newco"),
  ),
  "unconfirmed",
  "unassessed prerequisite must be shown as unconfirmed, not unmet",
);
assert.deepEqual(sxGateRequirementCounts(requirements), { met: 1, total: 2 });

// Round 32 (2026-08-02): the four-item oral-agreement evidence alone must not be sufficient for
// the two founding-prerequisite milestones — every required task under them must also complete.
const paidPoc = milestones.find((milestone) => milestone.id === "paid-poc");
assert.equal(
  sxGateRequirementState(paidPoc, []),
  "unmet",
  "evidence-ready blocking milestone with zero registered tasks must not be met",
);
const tasksAllComplete = [
  { milestoneId: "paid-poc", sortOrder: 1, title: "A", status: "completed" },
  { milestoneId: "paid-poc", sortOrder: 2, title: "B", status: "completed" },
];
assert.equal(
  sxGateRequirementState(paidPoc, tasksAllComplete),
  "met",
  "evidence-ready blocking milestone with all required tasks completed must be met",
);
const tasksPartial = [
  { milestoneId: "paid-poc", sortOrder: 1, title: "A", status: "completed" },
  { milestoneId: "paid-poc", sortOrder: 2, title: "B", status: "unassessed" },
];
assert.equal(
  sxGateRequirementState(paidPoc, tasksPartial),
  "unmet",
  "one incomplete required task must keep the blocking milestone unmet even with evidence",
);
// A non-blocking milestone's achievement must never depend on child tasks.
const optional = milestones.find((milestone) => milestone.id === "optional");
assert.equal(sxGateRequirementState(optional, []), "met");

const summary = sxMilestoneRequiredTaskSummary("paid-poc", tasksPartial);
assert.deepEqual(summary, {
  total: 2,
  completed: 1,
  nextIncomplete: tasksPartial[1],
  allComplete: false,
});
assert.equal(
  sxMilestoneRequiredTaskSummary("paid-poc", []).allComplete,
  false,
  "a milestone with zero registered tasks is never all-complete by omission",
);

console.log("sx gate requirement tests passed");
