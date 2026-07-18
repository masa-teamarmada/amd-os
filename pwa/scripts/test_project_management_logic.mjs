import assert from "node:assert/strict";
import {
  buildDagHealth,
  computeManagementJudgment,
  deriveMilestoneState,
  evaluateActionState,
  isKpiThresholdMet,
  selectCurrentMilestone,
} from "../src/lib/project-management-logic.ts";

const baseMilestone = {
  id: "m1",
  slug: "critical-gate",
  track: "technology_development",
  status: "unassessed",
  plannedStart: "2026-08-01",
  plannedEnd: "2026-08-31",
  forecastEnd: "2026-08-31",
  actualEnd: null,
  dateCertainty: "confirmed",
  ownerLabel: "研究責任者",
  nextDeliverable: "試験条件表",
  maxIssue: "再現性",
  completionCriteria: "5回反復の結果を記録",
  completionEvidence: null,
  criticality: "critical",
  lastVerifiedAt: "2026-07-19",
  confidence: "high",
};

const completeKpi = {
  id: "kpi-1",
  track: "technology_development",
  title: "再現性",
  baseline: 0,
  target: 90,
  actual: 92,
  unit: "%",
  threshold: 85,
  thresholdRule: "gte",
  thresholdUpper: null,
  measurementDate: "2026-07-19",
  sourceLabel: "試験記録",
  confidence: "high",
};

const noKpi = deriveMilestoneState(baseMilestone, [], [], true, "2026-07-19", undefined, false);
assert.equal(noKpi.criticalUnknown, true, "critical milestone without a linked KPI must stay unknown");
assert.ok(noKpi.gateFailures.includes("kpi_missing"));

const inProgress = deriveMilestoneState(baseMilestone, [completeKpi], [], true, "2026-07-19", undefined, true);
assert.equal(inProgress.criticalUnknown, false, "in-progress gate does not require completion evidence");
assert.equal(inProgress.status, "on_track", "complete current evidence can make an in-progress gate derived on track");
assert.ok(!inProgress.gateFailures.includes("completion_evidence_missing"));

const completedWithoutEvidence = deriveMilestoneState({ ...baseMilestone, actualEnd: "2026-07-19" }, [completeKpi], [], true, "2026-07-19", undefined, true);
assert.equal(completedWithoutEvidence.status, "unassessed", "a completed-looking milestone without completion evidence must not be treated as complete");
assert.ok(completedWithoutEvidence.gateFailures.includes("completion_evidence_missing"));

const completedWithEvidence = deriveMilestoneState({ ...baseMilestone, actualEnd: "2026-07-19", completionEvidence: "試験記録ID" }, [completeKpi], [], true, "2026-07-19", undefined, true);
assert.equal(completedWithEvidence.status, "completed", "completion evidence closes a milestone");

const zeroKpi = { ...completeKpi, target: 0, actual: 0, threshold: 0 };
assert.equal(isKpiThresholdMet(zeroKpi), true, "actual=0 is a measured value when the threshold is zero");
assert.equal(deriveMilestoneState(baseMilestone, [zeroKpi], [], true, "2026-07-19", undefined, true).status, "on_track", "actual=0 must not be mistaken for missing data");

assert.equal(isKpiThresholdMet({ ...completeKpi, thresholdRule: "gte", actual: 85 }), true, "gte accepts the lower boundary");
assert.equal(isKpiThresholdMet({ ...completeKpi, thresholdRule: "gte", actual: 84.99 }), false, "gte rejects a value below the threshold");
assert.equal(isKpiThresholdMet({ ...completeKpi, thresholdRule: "lte", threshold: 85, actual: 85 }), true, "lte accepts the upper boundary");
assert.equal(isKpiThresholdMet({ ...completeKpi, thresholdRule: "lte", threshold: 85, actual: 85.01 }), false, "lte rejects a value above the threshold");
assert.equal(isKpiThresholdMet({ ...completeKpi, thresholdRule: "between", threshold: 80, thresholdUpper: 90, actual: 85 }), true, "between accepts an in-range value");
assert.equal(isKpiThresholdMet({ ...completeKpi, thresholdRule: "between", threshold: 80, thresholdUpper: 90, actual: 95 }), false, "between rejects an out-of-range value");

const thresholdFailure = deriveMilestoneState(baseMilestone, [{ ...completeKpi, actual: 80 }], [], true, "2026-07-19", undefined, true);
assert.equal(thresholdFailure.thresholdFailed, true, "an actual below gte threshold is a deterministic threshold failure");
assert.equal(thresholdFailure.status, "at_risk", "threshold failure marks the milestone at risk");
assert.equal(thresholdFailure.criticalUnknown, false, "a measured threshold failure is not the same as an unknown");
assert.ok(thresholdFailure.gateFailures.includes("kpi_threshold_failed"));

const missingBetweenRange = deriveMilestoneState(baseMilestone, [{ ...completeKpi, thresholdRule: "between", threshold: 80, thresholdUpper: null, actual: 85 }], [], true, "2026-07-19", undefined, true);
assert.equal(missingBetweenRange.thresholdFailed, false, "a missing between upper bound is not classified as a threshold failure");
assert.ok(missingBetweenRange.gateFailures.includes("kpi_missing"), "a missing between upper bound is a missing condition");
const reversedBetweenRange = deriveMilestoneState(baseMilestone, [{ ...completeKpi, thresholdRule: "between", threshold: 90, thresholdUpper: 80, actual: 85 }], [], true, "2026-07-19", undefined, true);
assert.equal(reversedBetweenRange.thresholdFailed, false, "a reversed between range is not classified as a threshold failure");
assert.ok(reversedBetweenRange.gateFailures.includes("kpi_missing"), "a reversed between range is a missing condition");

const overdue = deriveMilestoneState({ ...baseMilestone, forecastEnd: "2026-07-18" }, [completeKpi], [], true, "2026-07-19", undefined, true);
assert.equal(overdue.overdue, true);
assert.equal(overdue.status, "at_risk", "an overdue milestone is derived at risk");

const normalOpenAction = evaluateActionState({ ownerLabel: "SX担当", dueDate: "2026-07-25", completionCriteria: "議事録へ決定理由を記録", nextReviewOn: "2026-07-25", status: "open" }, "2026-07-19");
assert.equal(normalOpenAction.ready, true, "an unfinished action with owner, due, completion criteria, and next review is valid");
const overdueAction = evaluateActionState({ ownerLabel: "SX担当", dueDate: "2026-07-18", completionCriteria: "議事録へ決定理由を記録", nextReviewOn: "2026-07-18", status: "open" }, "2026-07-19");
assert.equal(overdueAction.overdue, true);
assert.equal(overdueAction.ready, false);

const optionalDependency = buildDagHealth(
  [baseMilestone, { ...baseMilestone, id: "m2", slug: "optional-successor", plannedStart: "2026-08-01" }],
  [{ id: "d1", predecessorMilestoneId: "m1", successorMilestoneId: "m2", required: false, lagDays: 0 }],
  "2026-08-20",
);
assert.deepEqual(optionalDependency.blockedMilestoneIds, [], "optional edges must not block a successor");
assert.deepEqual(optionalDependency.waitingMilestoneIds, [], "optional edges must not become dependency wait");

const futureRequired = buildDagHealth(
  [baseMilestone, { ...baseMilestone, id: "m2", slug: "future-successor", plannedStart: "2026-09-01" }],
  [{ id: "d2", predecessorMilestoneId: "m1", successorMilestoneId: "m2", required: true, lagDays: 0 }],
  "2026-08-20",
);
assert.deepEqual(futureRequired.blockedMilestoneIds, [], "a future successor is waiting, not stopped");
assert.deepEqual(futureRequired.waitingMilestoneIds, ["m2"]);

const startedLate = buildDagHealth(
  [baseMilestone, { ...baseMilestone, id: "m2", slug: "started-successor", plannedStart: "2026-08-01" }],
  [{ id: "d3", predecessorMilestoneId: "m1", successorMilestoneId: "m2", required: true, lagDays: 0 }],
  "2026-09-01",
);
assert.deepEqual(startedLate.blockedMilestoneIds, ["m2"], "a required predecessor past its lagged date blocks a started successor");

const cycle = buildDagHealth(
  [baseMilestone, { ...baseMilestone, id: "m2", slug: "cycle-successor" }],
  [
    { id: "d4", predecessorMilestoneId: "m1", successorMilestoneId: "m2", required: true, lagDays: 0 },
    { id: "d5", predecessorMilestoneId: "m2", successorMilestoneId: "m1", required: true, lagDays: 0 },
  ],
  "2026-07-19",
);
assert.equal(cycle.valid, false, "dependency cycles must be detected");

const currentGate = selectCurrentMilestone([
  { slug: "finished-gate", status: "completed", plannedStart: "2026-07-01", plannedEnd: "2026-07-10", forecastEnd: "2026-07-10", actualEnd: "2026-07-10" },
  { slug: "future-gate", status: "unassessed", plannedStart: "2026-09-01", plannedEnd: "2026-09-30", forecastEnd: "2026-09-30", actualEnd: null },
  { slug: "started-risk-gate", status: "at_risk", plannedStart: "2026-08-01", plannedEnd: "2026-08-31", forecastEnd: "2026-08-31", actualEnd: null },
], "2026-08-20");
assert.equal(currentGate?.slug, "started-risk-gate", "current gate moves past a completed gate and prioritizes an active urgent gate");
const lastCompletedGate = selectCurrentMilestone([
  { slug: "first-completed", status: "completed", plannedStart: "2026-07-01", plannedEnd: "2026-07-10", forecastEnd: "2026-07-10", actualEnd: "2026-07-10" },
  { slug: "last-completed", status: "completed", plannedStart: "2026-07-11", plannedEnd: "2026-07-20", forecastEnd: "2026-07-20", actualEnd: "2026-07-21" },
], "2026-08-20");
assert.equal(lastCompletedGate?.slug, "last-completed", "when all gates are complete the latest completed gate remains visible");

const judgment = computeManagementJudgment({
  tracks: [{ key: "technology_development", milestone: baseMilestone, derived: null, dueSoon: false, criticalUnknownCount: 0, staleCount: 0, gateReady: true, gateFailures: [] }],
  requiredChecks: [false, false, false],
  overdueCount: 0,
  staleCount: 0,
  blockedCount: 0,
  criticalUnknownCount: 0,
  dueSoonCount: 0,
  atRiskCount: 0,
  thresholdFailureCount: 0,
  gateFailures: [],
  decisionQueue: [],
  nextDeadline: null,
  lastVerifiedAt: "2026-07-19",
});
assert.equal(judgment.key, "on_track", "display completeness alone must not force an unassessed judgment");

const overdueActionJudgment = computeManagementJudgment({
  tracks: [{ key: "technology_development", milestone: baseMilestone, derived: null, dueSoon: false, criticalUnknownCount: 0, staleCount: 0, gateReady: true, gateFailures: [] }],
  requiredChecks: [true, true, true],
  overdueCount: 1,
  staleCount: 0,
  blockedCount: 0,
  criticalUnknownCount: 0,
  dueSoonCount: 0,
  atRiskCount: 0,
  thresholdFailureCount: 0,
  gateFailures: [],
  decisionQueue: [],
  nextDeadline: null,
  lastVerifiedAt: "2026-07-19",
});
assert.equal(overdueActionJudgment.key, "crisis", "an overdue action must make the overall judgment crisis");

const thresholdJudgment = computeManagementJudgment({
  tracks: [{ key: "technology_development", milestone: baseMilestone, derived: null, dueSoon: false, criticalUnknownCount: 0, staleCount: 0, gateReady: true, gateFailures: [] }],
  requiredChecks: [true, true, true],
  overdueCount: 0,
  staleCount: 0,
  blockedCount: 0,
  criticalUnknownCount: 0,
  dueSoonCount: 0,
  atRiskCount: 0,
  thresholdFailureCount: 1,
  gateFailures: [],
  decisionQueue: [],
  nextDeadline: null,
  lastVerifiedAt: "2026-07-19",
});
assert.equal(thresholdJudgment.key, "crisis", "a measured critical KPI outside its threshold must make the overall judgment crisis");

console.log("project management logic tests passed");
