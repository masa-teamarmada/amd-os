import type { SxManagementIssue } from "./sx-management";

export type SxWeeklyIssueStage = "intake" | "validating" | "decision" | "resolved";

export type SxWeeklyNextMove = {
  id: string;
  kind: "decision" | "validation" | "action";
  label: string;
  status: string;
  dueDate: string | null;
};

const ACTIVE_ISSUE_STATUSES = new Set(["open", "validating", "on_hold"]);

export function sxWeeklyWeekRangeLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${start.getUTCMonth() + 1}/${start.getUTCDate()} — ${end.getUTCMonth() + 1}/${end.getUTCDate()}`;
}

function dayDiff(from: string | null | undefined, to: string) {
  if (!from) return null;
  const left = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  const right = new Date(`${to.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.floor((right - left) / 86_400_000);
}

export function sxWeeklyValueMissing(value: string | null | undefined) {
  const normalized = (value || "").trim();
  return !normalized || normalized.includes("未確認") || normalized.includes("未設定");
}

export function sxWeeklyIssueLastActivity(issue: SxManagementIssue) {
  return [
    issue.lastVerifiedAt,
    ...issue.hypotheses.map((hypothesis) => hypothesis.lastVerifiedAt),
    ...issue.evidence.map((evidence) => evidence.lastVerifiedAt),
    ...issue.discussions.map((discussion) => discussion.discussedOn),
    ...issue.decisions.map((decision) => decision.lastVerifiedAt),
    ...issue.actionItems.map((action) => action.lastVerifiedAt),
  ].filter(Boolean).sort().at(-1) || null;
}

export function sxWeeklyIssueNextDueDate(issue: SxManagementIssue) {
  return [
    issue.dueDate,
    ...issue.hypotheses.filter((hypothesis) => ["open", "validating"].includes(hypothesis.status)).map((hypothesis) => hypothesis.dueDate),
    ...issue.validationRuns.filter((run) => ["planned", "running", "blocked"].includes(run.status)).map((run) => run.dueDate),
    ...issue.decisions.filter((decision) => decision.status === "open").map((decision) => decision.dueDate),
    ...issue.actionItems.filter((action) => action.status !== "completed").map((action) => action.dueDate),
  ].filter((value): value is string => Boolean(value)).sort().at(0) || null;
}

export function sxWeeklyIssueNextMove(issue: SxManagementIssue, asOf: string): SxWeeklyNextMove | null {
  const candidates: SxWeeklyNextMove[] = [
    ...issue.decisions.filter((decision) => decision.status === "open").map((decision) => ({
      id: decision.id,
      kind: "decision" as const,
      label: decision.title,
      status: decision.status,
      dueDate: decision.dueDate,
    })),
    ...issue.validationRuns.filter((run) => ["planned", "running", "blocked"].includes(run.status)).map((run) => ({
      id: run.id,
      kind: "validation" as const,
      label: run.method,
      status: run.status,
      dueDate: run.dueDate,
    })),
    ...issue.actionItems.filter((action) => action.status !== "completed").map((action) => ({
      id: action.id,
      kind: "action" as const,
      label: action.title,
      status: action.status,
      dueDate: action.dueDate,
    })),
  ];
  const kindPriority = { action: 0, decision: 1, validation: 2 } as const;
  const urgency = (candidate: SxWeeklyNextMove) => {
    if (candidate.status === "blocked") return 0;
    if (candidate.dueDate && candidate.dueDate < asOf) return 1;
    if (candidate.dueDate) return 2;
    return 3;
  };
  return candidates.sort((left, right) => urgency(left) - urgency(right)
    || (left.dueDate || "9999").localeCompare(right.dueDate || "9999")
    || kindPriority[left.kind] - kindPriority[right.kind])[0] || null;
}

export function sxWeeklyIssueIsStale(issue: SxManagementIssue, asOf: string, thresholdDays = 7) {
  const diff = dayDiff(sxWeeklyIssueLastActivity(issue), asOf);
  return diff == null || diff >= thresholdDays;
}

export function sxWeeklyIssueIsOverdue(issue: SxManagementIssue, asOf: string) {
  const nextDueDate = sxWeeklyIssueNextDueDate(issue);
  return ACTIVE_ISSUE_STATUSES.has(issue.status) && Boolean(nextDueDate && nextDueDate < asOf);
}

export function sxWeeklyIssueStage(issue: SxManagementIssue): SxWeeklyIssueStage {
  const hasPendingDecision = issue.decisions.some((decision) => decision.status === "open");
  const hasActiveValidation = issue.validationRuns.some((run) => run.status === "planned" || run.status === "running");
  const hasValidatingHypothesis = issue.hypotheses.some((hypothesis) => hypothesis.status === "validating");
  const hasJudgmentReadyHypothesis = issue.hypotheses.some((hypothesis) => hypothesis.status === "validated");
  const allHypothesesClosed = issue.hypotheses.length > 0 && issue.hypotheses.every((hypothesis) => hypothesis.status === "rejected" || hypothesis.status === "decided");
  if (issue.status === "closed" || issue.status === "decided" || allHypothesesClosed) return "resolved";
  if (issue.knowledgeType === "decision_needed" || hasPendingDecision || hasJudgmentReadyHypothesis) return "decision";
  if (issue.status === "validating" || hasActiveValidation || hasValidatingHypothesis) return "validating";
  return "intake";
}

export function sxWeeklyIssueNeedsAttention(issue: SxManagementIssue, asOf: string) {
  const unfinishedActions = issue.actionItems.filter((action) => action.status !== "completed");
  if (sxWeeklyIssueStage(issue) === "resolved") return unfinishedActions.length > 0;
  return sxWeeklyIssueIsStale(issue, asOf)
    || sxWeeklyIssueIsOverdue(issue, asOf)
    || sxWeeklyValueMissing(issue.ownerLabel)
    || !sxWeeklyIssueNextDueDate(issue)
    || issue.hypotheses.length === 0
    || (sxWeeklyIssueStage(issue) === "validating" && issue.validationRuns.length === 0);
}

export function sxWeeklyIssueAttentionScore(issue: SxManagementIssue, asOf: string) {
  return (sxWeeklyIssueIsOverdue(issue, asOf) ? 20 : 0)
    + (sxWeeklyIssueIsStale(issue, asOf) ? 12 : 0)
    + (sxWeeklyValueMissing(issue.ownerLabel) ? 8 : 0)
    + (!sxWeeklyIssueNextDueDate(issue) ? 6 : 0)
    + (issue.hypotheses.length === 0 ? 5 : 0)
    + (issue.knowledgeType === "decision_needed" ? 4 : 0);
}

/** 手動並び替えの並び順そのもの。第一キーは sort_order、同値のときだけ従来の自動順
    (未解決優先 → 要フォロー度 → 期限) へ落とす。一度でも並び替えれば sort_order は
    10刻みで一意になるので、以後は手で置いた順だけが効く。 */
export function sxWeeklyIssueOrder(issues: SxManagementIssue[], asOf: string) {
  return [...issues].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      Number(sxWeeklyIssueStage(left) === "resolved") -
        Number(sxWeeklyIssueStage(right) === "resolved") ||
      sxWeeklyIssueAttentionScore(right, asOf) - sxWeeklyIssueAttentionScore(left, asOf) ||
      (sxWeeklyIssueNextDueDate(left) || "9999").localeCompare(
        sxWeeklyIssueNextDueDate(right) || "9999",
      ),
  );
}

export type SxIssueReorderTarget = { issueId: string; place: "before" | "after" };

/**
 * 掴んだ論点を落とし先の前後へ入れた、並び替え後の全体を返す。渡すのは絞り込み後の
 * 表示行ではなく論点の全体で、隠れている論点の相対順が崩れないようにする。落とし先が
 * 見つからない、動かす先が同じ位置、のときは null を返す (保存に行かない)。
 */
export function sxReorderIssueList<T extends { id: string; sortOrder: number }>(
  ordered: T[],
  sourceIssueId: string,
  target: SxIssueReorderTarget,
): { nextOrder: T[]; moved: Array<{ issue: T; sortOrder: number }> } | null {
  if (sourceIssueId === target.issueId) return null;
  const source = ordered.find((issue) => issue.id === sourceIssueId);
  if (!source) return null;
  const rest = ordered.filter((issue) => issue.id !== sourceIssueId);
  const anchorIndex = rest.findIndex((issue) => issue.id === target.issueId);
  if (anchorIndex < 0) return null;
  const nextOrder = [...rest];
  nextOrder.splice(target.place === "before" ? anchorIndex : anchorIndex + 1, 0, source);
  const moved = nextOrder
    .map((issue, index) => ({ issue, sortOrder: index * 10 }))
    .filter(({ issue, sortOrder }) => issue.sortOrder !== sortOrder);
  if (moved.length === 0) return null;
  return { nextOrder, moved };
}
