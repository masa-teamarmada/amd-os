import assert from "node:assert/strict";
import {
  sxApplyOptimisticManagementPatch,
  sxInsertOptimisticManagementRecord,
  sxIsOptimisticId,
  sxNewOptimisticId,
  sxRemoveOptimisticManagementRecord,
  sxReplaceOptimisticManagementId,
} from "../src/lib/sx-management-optimistic.ts";

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

// --- 追加・削除・仮IDの差し替え (2026-08-07: 確定ボタンの待ち時間をなくす) ---
const createBase = {
  tasks: [{ ...task }],
  milestones: [{ id: "ms-1", title: "旧MS", version: 1 }],
  scheduleDependencies: [
    {
      id: "dep-1",
      predecessorType: "task",
      predecessorTaskId: "task-1",
      predecessorMilestoneId: null,
      successorType: "milestone",
      successorTaskId: null,
      successorMilestoneId: "ms-1",
      dependencyType: "finish_to_start",
    },
  ],
};

const temporaryId = sxNewOptimisticId("task-0-タスクを追加");
assert.ok(sxIsOptimisticId(temporaryId));
assert.equal(sxIsOptimisticId("task-1"), false);

const inserted = sxInsertOptimisticManagementRecord(
  createBase,
  "task",
  "p21",
  temporaryId,
  { title: "新タスク", milestone_id: "ms-1", planned_end: "2026-09-30" },
);
assert.equal(inserted.tasks.length, 2);
assert.equal(inserted.tasks[1].id, temporaryId);
assert.equal(inserted.tasks[1].projectId, "p21");
assert.equal(inserted.tasks[1].title, "新タスク");
assert.equal(inserted.tasks[1].milestoneId, "ms-1");
// 予測完了日が未入力なら計画終了日に揃える。ガントのバーが描けない状態を作らない。
assert.equal(inserted.tasks[1].forecastEnd, "2026-09-30");
assert.equal(createBase.tasks.length, 1);

// フォームは未選択の親タスクを空文字で送る。サーバは null として保存するので、
// 楽観挿入も null に正規化する。空文字のままだとガントのトップレベル判定
// (parentTaskId == null) から外れて「作成した瞬間だけ行が出ない」(v3.58.19の実欠陥)。
const insertedTopLevel = sxInsertOptimisticManagementRecord(
  createBase,
  "task",
  "p21",
  sxNewOptimisticId("task-top"),
  {
    title: "トップレベル",
    milestone_id: "ms-1",
    parent_task_id: "",
    track: "business_development",
    planned_end: "2026-09-30",
  },
);
assert.equal(insertedTopLevel.tasks[1].parentTaskId, null);
assert.equal(insertedTopLevel.tasks[1].track, "business_development");

const insertedNoTrack = sxInsertOptimisticManagementRecord(
  createBase,
  "task",
  "p21",
  sxNewOptimisticId("task-no-track"),
  { title: "レーン未指定", milestone_id: "ms-1", parent_task_id: "", track: "" },
);
// track も空文字なら null (サーバと同じ)。レーンは所属MSのtrackから決まる。
assert.equal(insertedNoTrack.tasks[1].track, null);

const insertedMilestone = sxInsertOptimisticManagementRecord(
  createBase,
  "milestone",
  "p21",
  "sx-optimistic-ms",
  { title: "新MS", display_lane_keys: ["business_development"], status: "in_progress" },
);
assert.equal(insertedMilestone.milestones.length, 2);
assert.deepEqual(insertedMilestone.milestones[1].displayLaneKeys, [
  "business_development",
]);
assert.equal(insertedMilestone.milestones[1].derivedStatus, "in_progress");

const swapped = sxReplaceOptimisticManagementId(inserted, temporaryId, "task-9");
assert.equal(swapped.tasks[1].id, "task-9");
assert.equal(inserted.tasks[1].id, temporaryId);

// 削除は、そのレコードを指していた依存線も一緒に落とす (サーバも同じ扱いをする)。
const removed = sxRemoveOptimisticManagementRecord(createBase, "task-1");
assert.equal(removed.tasks.length, 0);
assert.equal(removed.scheduleDependencies.length, 0);
assert.equal(createBase.tasks.length, 1);
assert.equal(createBase.scheduleDependencies.length, 1);

const removedDependency = sxRemoveOptimisticManagementRecord(createBase, "dep-1");
assert.equal(removedDependency.tasks.length, 1);
assert.equal(removedDependency.scheduleDependencies.length, 0);

console.log("sx optimistic management patch tests: ok");
