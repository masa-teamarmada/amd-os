import assert from "node:assert/strict";
import { taskNestCandidateIds } from "../src/lib/sx-gantt-task-nesting.ts";

const tasks = [
  { id: "root", milestoneId: "ms-a", parentTaskId: null },
  { id: "child", milestoneId: "ms-a", parentTaskId: "root" },
  { id: "grandchild", milestoneId: "ms-a", parentTaskId: "child" },
  { id: "peer", milestoneId: "ms-a", parentTaskId: null },
  { id: "other-milestone", milestoneId: "ms-b", parentTaskId: null },
];

assert.deepEqual(
  [...taskNestCandidateIds(tasks, "root")],
  ["peer"],
  "a task cannot be dropped onto its own descendants, current child tree, or another milestone",
);
assert.deepEqual(
  [...taskNestCandidateIds(tasks, "child")],
  ["peer"],
  "the existing parent is not presented as a no-op drop target, but a same-milestone peer remains valid",
);
assert.deepEqual(
  [...taskNestCandidateIds(tasks, "missing")],
  [],
  "unknown task has no drop targets",
);

console.log("sx gantt task nesting tests passed");
