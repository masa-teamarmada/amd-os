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
    gateKind: "oral_agreement",
    manualStatus: "completed",
    completionEvidence:
      "先方：PoC候補A\n合意内容：有償PoC 1件\n確認日：2026-08-01\n根拠：面談メモ",
  },
  {
    id: "investment",
    slug: "funding-investment-oral-agreement",
    gateKind: "oral_agreement",
    manualStatus: "completed",
    completionEvidence: "口頭合意あり",
  },
  {
    id: "optional",
    slug: "optional",
    gateKind: null,
    manualStatus: "completed",
    completionEvidence: "記録あり",
  },
  {
    id: "newco",
    slug: "newco",
    gateKind: null,
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
  "only the milestones with a prerequisite gate_kind should become requirements (any project, never by slug)",
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

// 同じ slug でも gate_kind が無ければ前提条件にならない（PJ番号・slug では決めない）。
const sameSlugWithoutGate = { ...milestones[0], id: "other-project", gateKind: null };
assert.equal(
  (sxGateRequirementsBySuccessor([sameSlugWithoutGate, milestones[3]], [{ id: "d9", predecessorMilestoneId: "other-project", successorMilestoneId: "newco", required: true }]).get("newco") || []).length,
  0,
  "a milestone without gate_kind must not become a prerequisite even when its slug matches",
);

console.log("sx gate requirement tests passed");
