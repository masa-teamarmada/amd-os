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
  partners: [
    {
      id: "partner-work-item",
      name: "ワークアイテム先",
      ownerLabel: "担当A",
      nextCommitment: "未確認",
      dueDate: null,
      dueDatePrecision: "unknown",
      currentBallSide: "none",
      currentBallOwner: null,
      lastVerifiedAt: "2026-08-01",
      workItems: [
        {
          id: "wi-1",
          partnerId: "partner-work-item",
          side: "sx",
          itemKind: "task",
          title: "見積を送る",
          detail: null,
          status: "open",
          dueDate: "2026-08-10",
          dueDatePrecision: "day",
          ownerLabel: "担当A",
          handoffTo: null,
          completionCriteria: null,
          completedOn: null,
          completionEvidence: null,
          acceptedBy: null,
          acceptedOn: null,
          relatedMilestoneId: null,
          sourceKind: "manual",
          sourceRef: null,
          lastVerifiedAt: "2026-08-01",
          confidence: "unknown",
        },
      ],
      commitments: [],
    },
    {
      id: "partner-commitment",
      name: "約束先",
      ownerLabel: "担当B",
      nextCommitment: "未確認",
      dueDate: null,
      dueDatePrecision: "unknown",
      currentBallSide: "none",
      currentBallOwner: null,
      lastVerifiedAt: "2026-08-01",
      workItems: [],
      commitments: [
        {
          id: "commit-1",
          partnerId: "partner-commitment",
          title: "先方から返信をもらう",
          commitmentText: "見積回答の返信",
          commitmentKind: "counterparty_promise",
          status: "open",
          promisedOn: "2026-07-20",
          dueDate: "2026-08-05",
          completedOn: null,
          ownerLabel: "担当B",
          counterpartyOwner: "先方担当",
          sxOwner: null,
          evidence: "2026-07-20 打ち合わせで口頭確認",
          nextReviewOn: "2026-08-05",
          lastVerifiedAt: "2026-08-01",
          confidence: "unknown",
          sourceKind: "manual",
          sourceRef: null,
        },
      ],
    },
    {
      id: "partner-fallback",
      name: "未構造化先",
      ownerLabel: "担当C",
      nextCommitment: "次回打ち合わせ日程を確定する",
      dueDate: "2026-08-08",
      dueDatePrecision: "day",
      currentBallSide: "sx",
      currentBallOwner: "担当C",
      lastVerifiedAt: "2026-08-01",
      workItems: [],
      commitments: [],
    },
  ],
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

// Non-partner units never carry provenance — only kind === "partner" units resolve to an
// editable record via originResource/recordId/partnerId.
assert.equal(milestoneUnit.originResource, null);
assert.equal(milestoneUnit.recordId, null);
assert.equal(milestoneUnit.partnerId, null);
assert.equal(taskUnit.originResource, null);

// 2026-08 provenance audit: every partner-kind unit must carry an unambiguous
// originResource/recordId/partnerId triad — never inferred by trying id lookups across
// partner.workItems and partner.commitments in sequence. All 3 provenance kinds covered here.
const partnerUnits = allUnits.filter((item) => item.kind === "partner");
assert.equal(partnerUnits.length, 3);

const workItemUnit = partnerUnits.find(
  (item) => item.originResource === "partner_work_item",
);
assert.ok(workItemUnit, "a work-item-backed holding must surface as partner_work_item");
assert.equal(workItemUnit.recordId, "wi-1");
assert.equal(workItemUnit.partnerId, "partner-work-item");

const commitmentUnit = partnerUnits.find(
  (item) => item.originResource === "commitment",
);
assert.ok(commitmentUnit, "a commitment-backed holding must surface as commitment");
assert.equal(commitmentUnit.recordId, "commit-1");
assert.equal(commitmentUnit.partnerId, "partner-commitment");

const fallbackUnit = partnerUnits.find(
  (item) => item.originResource === "partner_next_action",
);
assert.ok(
  fallbackUnit,
  "a partner with no structured holdings must fall back to partner_next_action",
);
assert.equal(fallbackUnit.recordId, "partner-fallback");
assert.equal(fallbackUnit.partnerId, "partner-fallback");

console.log("sx project owner load tests passed");
