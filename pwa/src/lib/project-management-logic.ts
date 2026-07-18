export type ManagementDerivedStatus = "unassessed" | "on_track" | "attention" | "at_risk" | "blocked" | "completed";

export type LogicMilestone = {
  id: string;
  slug: string;
  track: string;
  status: ManagementDerivedStatus;
  plannedStart: string | null;
  plannedEnd: string | null;
  forecastEnd: string | null;
  actualEnd: string | null;
  dateCertainty: "confirmed" | "provisional";
  ownerLabel: string;
  nextDeliverable: string;
  maxIssue: string;
  completionCriteria: string;
  completionEvidence: string | null;
  criticality: "critical" | "high" | "medium" | "low";
  lastVerifiedAt: string;
  confidence: "high" | "medium" | "low" | "unknown";
};

export type LogicKpi = {
  id: string;
  track: string;
  title: string;
  baseline: number | null;
  target: number | null;
  actual: number | null;
  unit: string;
  threshold: number | null;
  thresholdRule: "gte" | "lte" | "between";
  thresholdUpper: number | null;
  measurementDate: string | null;
  sourceLabel: string;
  confidence: "high" | "medium" | "low" | "unknown";
};

export type LogicDependency = {
  id: string;
  predecessorMilestoneId: string;
  successorMilestoneId: string;
  required: boolean;
  lagDays: number;
};

export type MilestoneDerivedResult = {
  status: ManagementDerivedStatus;
  reasonCodes: string[];
  gateFailures: string[];
  criticalUnknown: boolean;
  stale: boolean;
  overdue: boolean;
  blocked: boolean;
  dependencyWaiting: boolean;
  thresholdFailed: boolean;
};

export type DagHealth = {
  valid: boolean;
  cycles: string[][];
  criticalPath: string[];
  blockedMilestoneIds: string[];
  waitingMilestoneIds: string[];
};

export type TrackLogicInput = {
  key: string;
  milestone: LogicMilestone | null;
  derived: MilestoneDerivedResult | null;
  dueSoon: boolean;
  criticalUnknownCount: number;
  staleCount: number;
  gateReady: boolean;
  gateFailures: string[];
};

export type JudgmentLogicInput = {
  tracks: TrackLogicInput[];
  requiredChecks: boolean[];
  overdueCount: number;
  staleCount: number;
  blockedCount: number;
  criticalUnknownCount: number;
  dueSoonCount: number;
  atRiskCount: number;
  thresholdFailureCount: number;
  gateFailures: string[];
  decisionQueue: string[];
  nextDeadline: string | null;
  lastVerifiedAt: string | null;
};

export type JudgmentLogicResult = {
  key: "on_track" | "attention" | "crisis" | "unassessed";
  reasons: string[];
  completenessPct: number;
};

export type LogicAction = {
  ownerLabel: string;
  dueDate: string | null;
  completionCriteria: string;
  nextReviewOn: string | null;
  status: "open" | "in_progress" | "completed" | "blocked";
  completionAt?: string | null;
  completionEvidence?: string | null;
};

export type ActionDerivedResult = {
  ready: boolean;
  overdue: boolean;
  blocked: boolean;
};

function dateDistance(from: string, to: string) {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.floor((toMs - fromMs) / 86400000);
}

function isMissingOwner(value: string) {
  return !value.trim() || value.includes("未確認") || value.includes("未設定");
}

function isMissingText(value: string | null | undefined) {
  return !value || value.includes("未確認") || value.includes("未設定") || value.includes("未登録");
}

export function isKpiThresholdMet(kpi: LogicKpi) {
  if (kpi.target == null || kpi.actual == null || kpi.threshold == null || !kpi.measurementDate || kpi.confidence === "unknown") return false;
  if (kpi.thresholdRule === "lte") return kpi.actual <= kpi.threshold;
  if (kpi.thresholdRule === "between") return kpi.thresholdUpper != null && kpi.actual >= kpi.threshold && kpi.actual <= kpi.thresholdUpper;
  return kpi.actual >= kpi.threshold;
}

export function buildDagHealth(milestones: LogicMilestone[], dependencies: LogicDependency[], today?: string): DagHealth {
  const ids = new Set(milestones.map((milestone) => milestone.id));
  const outgoing = new Map<string, LogicDependency[]>();
  const incoming = new Map<string, LogicDependency[]>();
  for (const dependency of dependencies) {
    if (!ids.has(dependency.predecessorMilestoneId) || !ids.has(dependency.successorMilestoneId)) continue;
    outgoing.set(dependency.predecessorMilestoneId, [...(outgoing.get(dependency.predecessorMilestoneId) || []), dependency]);
    incoming.set(dependency.successorMilestoneId, [...(incoming.get(dependency.successorMilestoneId) || []), dependency]);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];
  const visit = (id: string) => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      cycles.push([...path.slice(start), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    path.push(id);
    for (const edge of outgoing.get(id) || []) visit(edge.successorMilestoneId);
    path.pop();
    visiting.delete(id);
    visited.add(id);
  };
  for (const milestone of milestones) visit(milestone.id);

  const depthMemo = new Map<string, { depth: number; path: string[] }>();
  const depth = (id: string, guard = new Set<string>()): { depth: number; path: string[] } => {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    if (guard.has(id)) return { depth: 0, path: [id] };
    const nextGuard = new Set(guard).add(id);
    const predecessors = incoming.get(id) || [];
    if (predecessors.length === 0) {
      const result = { depth: 1, path: [id] };
      depthMemo.set(id, result);
      return result;
    }
    const best = predecessors
      .map((edge) => depth(edge.predecessorMilestoneId, nextGuard))
      .sort((a, b) => b.depth - a.depth)[0] || { depth: 0, path: [] };
    const result = { depth: best.depth + 1, path: [...best.path, id] };
    depthMemo.set(id, result);
    return result;
  };
  const criticalPath = milestones.map((milestone) => depth(milestone.id)).sort((a, b) => b.depth - a.depth)[0]?.path || [];
  const blockedMilestoneIds: string[] = [];
  const waitingMilestoneIds: string[] = [];
  for (const milestone of milestones) {
    const requiredIncoming = (incoming.get(milestone.id) || []).filter((edge) => edge.required);
    let waiting = false;
    let blocked = false;
    for (const edge of requiredIncoming) {
      const predecessor = milestones.find((candidate) => candidate.id === edge.predecessorMilestoneId);
      if (!predecessor || (predecessor.actualEnd && predecessor.completionEvidence)) continue;
      const prerequisiteDate = predecessor.forecastEnd || predecessor.plannedEnd;
      const successorStarted = Boolean(today && milestone.plannedStart && milestone.plannedStart <= today);
      const laggedPrerequisiteDate = prerequisiteDate
        ? new Date(Date.parse(`${prerequisiteDate}T00:00:00.000Z`) + edge.lagDays * 86400000).toISOString().slice(0, 10)
        : null;
      const predecessorOverdue = Boolean(today && successorStarted && laggedPrerequisiteDate && laggedPrerequisiteDate < today && !predecessor.actualEnd);
      if (predecessorOverdue) blocked = true;
      else waiting = true;
    }
    if (blocked) blockedMilestoneIds.push(milestone.id);
    else if (waiting) waitingMilestoneIds.push(milestone.id);
  }

  return { valid: cycles.length === 0, cycles, criticalPath, blockedMilestoneIds, waitingMilestoneIds };
}

export function selectCurrentMilestone<T extends { slug: string; status: ManagementDerivedStatus; plannedStart: string | null; plannedEnd: string | null; forecastEnd: string | null; actualEnd: string | null }>(milestones: T[], today: string) {
  const incomplete = milestones.filter((item) => item.status !== "completed");
  return [...incomplete].sort((a, b) => {
    const aStarted = Boolean(a.plannedStart && a.plannedStart <= today);
    const bStarted = Boolean(b.plannedStart && b.plannedStart <= today);
    if (aStarted !== bStarted) return aStarted ? -1 : 1;
    const aUrgent = a.status === "blocked" || a.status === "at_risk";
    const bUrgent = b.status === "blocked" || b.status === "at_risk";
    if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
    return (a.forecastEnd || a.plannedEnd || "9999-12-31").localeCompare(b.forecastEnd || b.plannedEnd || "9999-12-31")
      || (a.plannedStart || "9999-12-31").localeCompare(b.plannedStart || "9999-12-31")
      || a.slug.localeCompare(b.slug);
  })[0] || [...milestones].sort((a, b) => (b.actualEnd || b.forecastEnd || b.plannedEnd || "0000-01-01").localeCompare(a.actualEnd || a.forecastEnd || a.plannedEnd || "0000-01-01") || b.slug.localeCompare(a.slug))[0] || null;
}

export function deriveMilestoneState(
  milestone: LogicMilestone,
  linkedKpis: LogicKpi[],
  predecessors: LogicMilestone[],
  dagValid: boolean,
  today: string,
  dependencyState?: { blocked: boolean; waiting: boolean },
  hasCurrentEvidence = false,
): MilestoneDerivedResult {
  const stale = dateDistance(milestone.lastVerifiedAt, today) > 14;
  const dueDate = milestone.forecastEnd || milestone.plannedEnd;
  const overdue = Boolean(dueDate && dueDate < today && !milestone.actualEnd);
  const requiresKpi = milestone.criticality === "critical" || milestone.criticality === "high";
  const kpiIsComplete = (kpi: LogicKpi) => kpi.target != null && kpi.actual != null && kpi.threshold != null && Boolean(kpi.measurementDate) && kpi.confidence !== "unknown"
    && (kpi.thresholdRule !== "between" || (kpi.thresholdUpper != null && kpi.threshold <= kpi.thresholdUpper));
  const requiredKpiMissing = requiresKpi && (linkedKpis.length === 0 || linkedKpis.some((kpi) => !kpiIsComplete(kpi)));
  const thresholdFailed = requiresKpi && linkedKpis.some((kpi) => kpiIsComplete(kpi) && !isKpiThresholdMet(kpi));
  const gateFailures: string[] = [];
  if (isMissingOwner(milestone.ownerLabel)) gateFailures.push("owner_missing");
  if (!milestone.plannedEnd || !milestone.forecastEnd) gateFailures.push("deadline_missing");
  if (stale) gateFailures.push("stale");
  if (milestone.dateCertainty !== "confirmed") gateFailures.push("date_provisional");
  if (isMissingText(milestone.completionCriteria)) gateFailures.push("completion_criteria_missing");
  if (requiredKpiMissing) gateFailures.push("kpi_missing");
  if (thresholdFailed) gateFailures.push("kpi_threshold_failed");
  if (!hasCurrentEvidence) gateFailures.push("current_evidence_missing");
  if (!dagValid) gateFailures.push("dag_cycle");
  const dependencyWaiting = Boolean(dependencyState?.waiting);
  const blocked = !dagValid || Boolean(dependencyState?.blocked);
  if (milestone.actualEnd && !milestone.completionEvidence) gateFailures.push("completion_evidence_missing");
  const criticalUnknown = (milestone.criticality === "critical" || milestone.criticality === "high") && gateFailures.some((failure) => failure !== "kpi_threshold_failed");
  const reasonCodes: string[] = [];
  if (blocked) reasonCodes.push(!dagValid ? "dag_cycle" : "dependency_blocked");
  else if (dependencyWaiting) reasonCodes.push("dependency_waiting");
  if (overdue) reasonCodes.push("overdue");
  for (const failure of gateFailures) if (!reasonCodes.includes(failure)) reasonCodes.push(failure);

  let status: ManagementDerivedStatus = "on_track";
  if (blocked) status = "blocked";
  else if (overdue) status = "at_risk";
  else if (thresholdFailed) status = "at_risk";
  else if (milestone.actualEnd && milestone.completionEvidence) status = "completed";
  else if (criticalUnknown) status = "unassessed";
  else if (dependencyWaiting || stale) status = "attention";
  return { status, reasonCodes, gateFailures, criticalUnknown, stale, overdue, blocked, dependencyWaiting, thresholdFailed };
}

export function computeManagementJudgment(input: JudgmentLogicInput): JudgmentLogicResult {
  const completeCount = input.requiredChecks.filter(Boolean).length;
  const completenessPct = input.requiredChecks.length === 0 ? 0 : Math.round((completeCount / input.requiredChecks.length) * 100);
  const requiredIncomplete = input.gateFailures.length > 0 || input.tracks.some((track) => !track.milestone || !track.gateReady);
  const reasons: string[] = [];
  let key: JudgmentLogicResult["key"] = "on_track";
  if (input.overdueCount > 0 || input.blockedCount > 0) key = "crisis";
  else if (input.thresholdFailureCount > 0) key = "crisis";
  else if (requiredIncomplete || input.criticalUnknownCount > 0 || input.staleCount > 0) key = "unassessed";
  else if (input.dueSoonCount > 0 || input.atRiskCount > 0) key = "attention";

  if (input.overdueCount > 0) reasons.push(`期限超過 ${input.overdueCount}件。予定と予測の差分を確認してね`);
  if (input.blockedCount > 0) reasons.push(`依存関係で停止しているゲート ${input.blockedCount}件。前提を解消してね`);
  if (input.thresholdFailureCount > 0) reasons.push(`重要KPIが閾値外 ${input.thresholdFailureCount}件。実績と判定条件を確認してね`);
  if (input.criticalUnknownCount > 0) reasons.push(`重要な未確認 ${input.criticalUnknownCount}件。根拠・測定値・完了条件が不足しているよ`);
  if (input.gateFailures.length > 0) reasons.push(`決定的ゲート未達 ${input.gateFailures.length}件。手入力の状態では順調にできないよ`);
  if (input.staleCount > 0) reasons.push(`14日超の更新切れ ${input.staleCount}件。事実を再確認してね`);
  if (requiredIncomplete) reasons.push(`必須項目の充足率が${completenessPct}%。担当・確度・証跡を補ってね`);
  if (input.dueSoonCount > 0) reasons.push(`7日以内の期限 ${input.dueSoonCount}件。今週の判断と接続してね`);
  if (input.atRiskCount > 0) reasons.push(`遅れ懸念のゲート ${input.atRiskCount}件。予測変更理由を確認してね`);
  if (reasons.length === 0) reasons.push("期限・阻害・担当・確度・証跡を確認済み。現時点では大きな差分はないよ");
  return { key, reasons: reasons.slice(0, 3), completenessPct };
}

export function evaluateActionState(action: LogicAction, today: string): ActionDerivedResult {
  const blocked = action.status === "blocked";
  const overdue = action.status !== "completed" && Boolean(action.dueDate && action.dueDate < today);
  const ready = action.status === "completed"
    ? Boolean(action.completionAt || action.completionEvidence) && !isMissingText(action.completionCriteria)
    : !blocked && !overdue && Boolean(action.dueDate) && !isMissingOwner(action.ownerLabel) && !isMissingText(action.completionCriteria) && Boolean(action.nextReviewOn);
  return { ready, overdue, blocked };
}

export { dateDistance, isMissingOwner, isMissingText };
