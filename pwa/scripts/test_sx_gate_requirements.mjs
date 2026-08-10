import assert from "node:assert/strict";
import {
  sxGateRequirementCounts,
  sxGateRequirementState,
  sxGateRequirementsBySuccessor,
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

const requirements =
  sxGateRequirementsBySuccessor(milestones, dependencies).get(
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
  "completed with all four evidence fields should be met",
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

// A blocking MS is its own record. Its success condition is the completed state and its required
// evidence, not an invisible checklist of lower-level tasks.
const paidPoc = milestones.find((milestone) => milestone.id === "paid-poc");
assert.equal(
  sxGateRequirementState(paidPoc),
  "met",
  "evidence-ready blocking milestone must be met without a hidden task checklist",
);
const optional = milestones.find((milestone) => milestone.id === "optional");
assert.equal(sxGateRequirementState(optional), "met");

console.log("sx gate requirement tests passed");
