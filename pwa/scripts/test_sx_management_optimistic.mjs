import assert from "node:assert/strict";
import { sxApplyOptimisticManagementPatch } from "../src/lib/sx-management-optimistic.ts";

const task = {
  id: "task-1",
  title: "旧タスク",
  description: null,
  status: "unassessed",
  plannedStart: "2026-08-01",
  plannedEnd: "2026-08-10",
  progressPct: 0,
  version: 4,
};
const partner = {
  id: "partner-1",
  name: "旧社名",
  currentBallSide: "unknown",
  interactions: [{ id: "interaction-1", summary: "旧接点" }],
  workItems: [{ id: "work-1", title: "旧作業", ownerLabel: null }],
  commitments: [],
  roles: [],
};
const issue = {
  id: "issue-1",
  title: "旧論点",
  hypotheses: [{ id: "hypothesis-1", statement: "旧仮説" }],
};
const base = {
  tasks: [task],
  partners: [partner],
  issues: [issue],
  hypotheses: [issue.hypotheses[0]],
};

const updatedTask = sxApplyOptimisticManagementPatch(base, "task", "task-1", {
  title: "新タスク",
  planned_end: "2026-08-12",
  progress_pct: "35",
});
assert.equal(updatedTask.tasks[0].title, "新タスク");
assert.equal(updatedTask.tasks[0].plannedEnd, "2026-08-12");
assert.equal(updatedTask.tasks[0].progressPct, 35);
assert.equal(updatedTask.tasks[0].version, 5);
assert.equal(base.tasks[0].title, "旧タスク");

const updatedInteraction = sxApplyOptimisticManagementPatch(
  base,
  "interaction",
  "interaction-1",
  { summary: "新接点" },
);
assert.equal(updatedInteraction.partners[0].interactions[0].summary, "新接点");

const updatedHypothesis = sxApplyOptimisticManagementPatch(
  base,
  "hypothesis",
  "hypothesis-1",
  { statement: "新仮説" },
);
assert.equal(updatedHypothesis.hypotheses[0].statement, "新仮説");
assert.equal(updatedHypothesis.issues[0].hypotheses[0].statement, "新仮説");

const updatedMilestone = sxApplyOptimisticManagementPatch(
  { milestones: [{ id: "ms-1", status: "unassessed", manualStatus: "unassessed", version: 2 }] },
  "milestone",
  "ms-1",
  { status: "completed" },
);
assert.equal(updatedMilestone.milestones[0].status, "completed");
assert.equal(updatedMilestone.milestones[0].manualStatus, "completed");
assert.equal(updatedMilestone.milestones[0].version, 3);

console.log("sx optimistic management patch tests: ok");
