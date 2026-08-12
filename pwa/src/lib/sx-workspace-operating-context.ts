import type { SxHistory, SxManagementBundle } from "./sx-management";

export type SxWorkspaceCurrentFact = {
  title: string;
  status: string | null;
  ownerLabel: string | null;
  dueDate: string | null;
  track: string | null;
};

export type SxWorkspaceSourceRef = {
  kind: "project_management_update";
  project_id: string;
  update_id: string;
  entity_type: string;
  entity_id: string | null;
  date: string;
  title: string;
  snippet: string;
  source_url: string;
};

export type SxWorkspaceOperatingChange = {
  changeId: string;
  projectId: string;
  entityType: string;
  entityId: string | null;
  updateKind: string;
  changedOn: string;
  summary: string;
  fromStatus: string | null;
  toStatus: string | null;
  current: SxWorkspaceCurrentFact | null;
  strategyEvidence: {
    eligible: boolean;
    signalTypeHint: string | null;
    reason: string | null;
  };
  meetingEvidence: {
    eligible: true;
    claimBoundary: "context_only";
  };
  sourceRef: SxWorkspaceSourceRef;
};

export type SxWorkspaceOperatingContext = {
  projectId: string;
  asOf: string;
  since: string | null;
  until: string | null;
  changeCount: number;
  changes: SxWorkspaceOperatingChange[];
};

type EntityRow = Record<string, unknown>;

const DONE_STATES = new Set([
  "decided",
  "completed",
  "passed",
  "failed",
  "blocked",
  "validated",
  "rejected",
  "closed",
  "filled",
  "committed",
  "received",
  "analyzed",
  "established",
]);

const STRATEGY_TYPES: Record<string, string> = {
  decision: "management_decision",
  milestone: "business_progress",
  outcome: "business_progress",
  task: "business_progress",
  action_item: "business_progress",
  issue: "risk",
  hypothesis: "strategic_pivot",
  evidence: "tech_progress",
  validation_run: "tech_progress",
  technical_test: "tech_progress",
  funding_snapshot: "funding",
  partner_commitment: "partnership",
  partner_interaction: "partnership",
  partner_work_item: "partnership",
  partner_sample: "partnership",
  partner_role: "partnership",
  organization_role: "business_progress",
};

const EXACT_FOCUS_KIND: Record<string, string> = {
  issue: "issue",
  hypothesis: "hypothesis",
  validation_run: "validation",
  decision: "decision",
  action_item: "action",
};

function asRow(value: unknown): EntityRow {
  return value as EntityRow;
}

function firstText(row: EntityRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function currentFact(row: EntityRow): SxWorkspaceCurrentFact {
  return {
    title: firstText(row, ["title", "name", "statement", "summary", "testName", "roleName", "roleLabel", "label", "validationKind", "snapshotDate", "stakeholderLabel"]) || "名称未確認",
    status: firstText(row, ["status", "relationshipState", "relationshipStage", "activityState"]),
    ownerLabel: firstText(row, ["ownerLabel", "actorLabel", "candidate"]),
    dueDate: firstText(row, ["dueDate", "forecastEnd", "plannedEnd", "targetDate", "measuredOn", "measurementDate", "snapshotDate"]),
    track: firstText(row, ["track"]),
  };
}

function indexCurrentFacts(bundle: SxManagementBundle) {
  const index = new Map<string, SxWorkspaceCurrentFact>();
  const add = (entityType: string, rows: unknown[]) => {
    for (const value of rows) {
      const row = asRow(value);
      if (typeof row.id !== "string" || !row.id) continue;
      index.set(`${entityType}:${row.id}`, currentFact(row));
    }
  };

  if (bundle.objective) add("objective", [bundle.objective]);
  add("outcome", bundle.outcomes);
  add("milestone", bundle.milestones);
  add("task", bundle.tasks);
  add("kpi", bundle.kpis);
  add("issue", bundle.issues);
  add("hypothesis", bundle.hypotheses);
  add("evidence", bundle.evidence);
  add("validation_run", bundle.validationRuns);
  add("decision", bundle.decisions);
  add("action_item", bundle.actions);
  add("partner", bundle.partners);
  add("partner_commitment", bundle.partnerCommitments);
  add("partner_interaction", bundle.partnerInteractions);
  add("partner_role", bundle.partnerRoles);
  add("partner_work_item", bundle.partnerWorkItems);
  add("partner_sample", bundle.partners.flatMap((partner) => partner.samples));
  add("dependency", bundle.dependencies);
  add("schedule_dependency", bundle.scheduleDependencies);
  add("technical_test", bundle.technicalTests);
  add("funding_snapshot", bundle.fundingSnapshots);
  add("organization_role", bundle.organizationRoles);
  add("raci", bundle.raci);
  add("capacity", bundle.capacity);
  return index;
}

function workspaceHref(projectId: string, history: SxHistory) {
  const base = `/project/${encodeURIComponent(projectId)}/workspace`;
  const focusKind = EXACT_FOCUS_KIND[history.entityType];
  if (!focusKind || !history.entityId) return base;
  return `${base}?focusKind=${encodeURIComponent(focusKind)}&focusId=${encodeURIComponent(history.entityId)}#issue-hypothesis`;
}

function strategyEvidence(history: SxHistory) {
  const signalTypeHint = STRATEGY_TYPES[history.entityType] || null;
  const statusCompleted = Boolean(history.toStatus && DONE_STATES.has(history.toStatus));
  const completedFactCreated = history.updateKind === "manual_create" && [
    "evidence",
    "partner_interaction",
    "funding_snapshot",
  ].includes(history.entityType);
  const eligible = Boolean(signalTypeHint && (statusCompleted || completedFactCreated));
  return {
    eligible,
    signalTypeHint: eligible ? signalTypeHint : null,
    reason: eligible
      ? statusCompleted
        ? `状態が${history.fromStatus || "未設定"}から${history.toStatus}へ変わった`
        : "完了済みの事実が追加された"
      : null,
  };
}

/**
 * SXワークスペースの正本変更を、既存D-6/H-1が読む安全な共通入力へ投影する。
 * ここではLLMを呼ばず、件数も絞らない。経営ハイライトへの採用はD-6の既存claim gateが判断する。
 */
export function deriveSxWorkspaceOperatingContext(input: {
  projectId: string;
  bundle: SxManagementBundle;
  history: SxHistory[];
  since?: string | null;
  until?: string | null;
}): SxWorkspaceOperatingContext {
  const current = indexCurrentFacts(input.bundle);
  const history = [...input.history].sort(
    (left, right) => left.changedOn.localeCompare(right.changedOn) || left.id.localeCompare(right.id),
  );
  const changes = history.map((entry): SxWorkspaceOperatingChange => {
    const now = entry.entityId ? current.get(`${entry.entityType}:${entry.entityId}`) || null : null;
    const title = now?.title || entry.summary || `${entry.entityType}の更新`;
    const sourceRef: SxWorkspaceSourceRef = {
      kind: "project_management_update",
      project_id: input.projectId,
      update_id: entry.id,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      date: entry.changedOn,
      title,
      snippet: entry.summary,
      source_url: workspaceHref(input.projectId, entry),
    };
    return {
      changeId: entry.id,
      projectId: input.projectId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      updateKind: entry.updateKind,
      changedOn: entry.changedOn,
      summary: entry.summary,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      current: now,
      strategyEvidence: strategyEvidence(entry),
      meetingEvidence: { eligible: true, claimBoundary: "context_only" },
      sourceRef,
    };
  });

  return {
    projectId: input.projectId,
    asOf: input.bundle.asOf,
    since: input.since || null,
    until: input.until || null,
    changeCount: changes.length,
    changes,
  };
}
