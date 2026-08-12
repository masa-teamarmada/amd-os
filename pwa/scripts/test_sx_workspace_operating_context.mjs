import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { deriveSxWorkspaceOperatingContext } from "../src/lib/sx-workspace-operating-context.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const emptyBundle = {
  asOf: "2026-08-12",
  horizonMonths: [],
  objective: null,
  outcomes: [],
  kpis: [],
  dependencies: [],
  scheduleDependencies: [],
  dag: {},
  judgment: {},
  tracks: [],
  milestones: [],
  tasks: [],
  issues: [],
  hypotheses: [],
  evidence: [],
  validationRuns: [],
  decisions: [{
    id: "decision-1",
    title: "PoC対象をA社に決定",
    status: "decided",
    ownerLabel: "SX経営担当",
    dueDate: "2026-08-12",
    track: "business_development",
  }],
  actions: [],
  partners: [],
  partnerCommitments: [],
  partnerInteractions: [],
  partnerRoles: [],
  partnerWorkItems: [],
  technicalTests: [],
  fundingSnapshots: [],
  organizationRoles: [],
  raci: [],
  capacity: [],
  history: [],
  fieldAudit: [],
  canManage: false,
  hasData: true,
};

const decisionHistory = {
  id: "history-decision-1",
  entityType: "decision",
  entityId: "decision-1",
  updateKind: "manual_edit",
  summary: "decision: PoC対象をA社に決定",
  changedBy: "private-member-id",
  changedOn: "2026-08-12",
  fromStatus: "pending",
  toStatus: "decided",
};
const routineHistory = Array.from({ length: 61 }, (_, index) => ({
  id: `history-action-${String(index).padStart(2, "0")}`,
  entityType: "action_item",
  entityId: `action-${index}`,
  updateKind: "manual_edit",
  summary: `action_item: 通常更新${index + 1}`,
  changedBy: "private-member-id",
  changedOn: "2026-08-12",
  fromStatus: "open",
  toStatus: "in_progress",
}));

const context = deriveSxWorkspaceOperatingContext({
  projectId: "p21",
  bundle: emptyBundle,
  history: [decisionHistory, ...routineHistory],
  since: "2026-08-12",
  until: "2026-08-12",
});

assert.equal(context.changeCount, 62, "変更件数を任意の上限で切らない");
assert.equal(context.changes.length, 62, "62件すべてをautomation入力へ渡す");
const decision = context.changes.find((change) => change.changeId === decisionHistory.id);
assert.ok(decision);
assert.deepEqual(decision.current, {
  title: "PoC対象をA社に決定",
  status: "decided",
  ownerLabel: "SX経営担当",
  dueDate: "2026-08-12",
  track: "business_development",
});
assert.deepEqual(decision.strategyEvidence, {
  eligible: true,
  signalTypeHint: "management_decision",
  reason: "状態がpendingからdecidedへ変わった",
});
assert.equal(context.changes[1].strategyEvidence.eligible, false, "通常の進行中TODOを経営ハイライト候補にしない");
assert.equal(decision.meetingEvidence.claimBoundary, "context_only", "ワークスペース変更だけで会議決定に昇格させない");
assert.equal(
  decision.sourceRef.source_url,
  "/project/p21/workspace?focusKind=decision&focusId=decision-1#issue-hypothesis",
);
assert.equal(JSON.stringify(context).includes("private-member-id"), false, "内部member idをautomation DTOへ出さない");
assert.deepEqual(Object.keys(decision).sort(), [
  "changeId", "changedOn", "current", "entityId", "entityType", "fromStatus",
  "meetingEvidence", "projectId", "sourceRef", "strategyEvidence", "summary",
  "toStatus", "updateKind",
].sort());

const route = readFileSync(resolve(root, "src/app/api/project-workspace/[projectId]/automation-context/route.ts"), "utf8");
const server = readFileSync(resolve(root, "src/lib/sx-workspace-operating-context-server.ts"), "utf8");
const strategyUi = readFileSync(resolve(root, "src/components/cockpit/CockpitStrategySignals.tsx"), "utf8");
assert.match(route, /projectId !== "p21"/);
assert.match(route, /WORKFLOW_SECRET \|\| process\.env\.CRON_SECRET/);
assert.doesNotMatch(server, /\.limit\(/, "取得件数を固定上限で切らない");
assert.match(strategyUi, /kind === "project_management_update"/);
assert.match(strategyUi, /sourceUrl\.startsWith\(safeWorkspacePrefix\)/, "外部URLをworkspace導線として信用しない");
assert.doesNotMatch(strategyUi, /refs\s*\.slice\(/, "根拠も固定件数で切らない");

console.log("SX workspace operating context contract: pass (62 changes, deterministic gates, exact source ref, no item cap)");
