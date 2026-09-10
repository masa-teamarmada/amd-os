import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ActionNode,
  ActionStatus,
  ProposalNode,
  Confidence,
  Contribution,
  FindingKind,
  FindingNode,
  OriginKind,
  QuestionNode,
  QuestionState,
  QuestionStatus,
  QuestionTreeBundle,
} from "@/lib/question-tree-types";

export * from "@/lib/question-tree-types";

/**
 * 問いの木。正本は pwa/spec/3-21-question-tree-current-spec.md。
 *
 * 型は3つだけ。
 *   問い       … 答えが出れば閉じる（論点・仮説・決めること・目的・成立条件）
 *   やること   … 実行すれば終わる（工程・タスク・検証・技術試験・決定後の行動）
 *   分かったこと … 事実と出どころ（根拠・反証）
 *
 * 状態はすべて導出値で、人が直接編集しない。子が片付いても親を自動で閉じない。
 */

type RawRow = Record<string, unknown>;

const STALE_DAYS = 7;

function str(row: RawRow, key: string, fallback = ""): string {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function nullableStr(row: RawRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(row: RawRow, key: string, fallback = 0): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asConfidence(value: unknown): Confidence {
  return value === "high" || value === "medium" || value === "low" ? value : "unknown";
}

function asOriginKind(value: unknown): OriginKind {
  return value === "meeting" || value === "automation" || value === "migrated" ? value : "manual";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: string | null, to: string): number | null {
  if (!from) return null;
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  return Math.round((toMs - fromMs) / 86_400_000);
}

/** 日付の小さい方。null は「期限なし」として弱い */
function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function later(a: string, b: string): string {
  return a >= b ? a : b;
}

const ACTION_OPEN_STATUSES: ActionStatus[] = ["unassessed", "not_started", "running", "blocked"];

function isActionOpen(action: ActionNode): boolean {
  return ACTION_OPEN_STATUSES.includes(action.status);
}

function mapAction(row: RawRow, questionIds: string[]): ActionNode {
  const status = (row.status as ActionStatus) || "unassessed";
  const plannedEnd = nullableStr(row, "planned_end");
  const today = todayIso();
  return {
    id: str(row, "id"),
    projectId: str(row, "project_id"),
    parentId: nullableStr(row, "parent_id"),
    title: str(row, "title"),
    detail: nullableStr(row, "detail"),
    actionKind: row.action_kind === "measure" ? "measure" : "work",
    status,
    ownerLabel: str(row, "owner_label", "担当未確認"),
    plannedStart: nullableStr(row, "planned_start"),
    plannedEnd,
    actualEnd: nullableStr(row, "actual_end"),
    dateCertainty: row.date_certainty === "confirmed" ? "confirmed" : "provisional",
    progressPct: num(row, "progress_pct"),
    blocker: nullableStr(row, "blocker"),
    doneCriteria: nullableStr(row, "done_criteria"),
    doneEvidence: nullableStr(row, "done_evidence"),
    target: nullableStr(row, "target"),
    actual: nullableStr(row, "actual"),
    unit: nullableStr(row, "unit"),
    originKind: asOriginKind(row.origin_kind),
    originRef: nullableStr(row, "origin_ref"),
    originQuestionId: nullableStr(row, "origin_question_id"),
    sortOrder: num(row, "sort_order"),
    lastVerifiedAt: str(row, "last_verified_at", today),
    questionIds,
    children: [],
    findings: [],
    isOverdue:
      ACTION_OPEN_STATUSES.includes(status) && Boolean(plannedEnd) && (plannedEnd as string) < today,
  };
}

function mapFinding(row: RawRow, questionIds: string[]): FindingNode {
  return {
    id: str(row, "id"),
    projectId: str(row, "project_id"),
    summary: str(row, "summary"),
    findingKind: (row.finding_kind as FindingKind) || "neutral",
    observedOn: nullableStr(row, "observed_on"),
    sourceLabel: str(row, "source_label", "出どころ未確認"),
    sourceUrl: nullableStr(row, "source_url"),
    confidence: asConfidence(row.confidence),
    fromActionId: nullableStr(row, "from_action_id"),
    lastVerifiedAt: str(row, "last_verified_at", todayIso()),
    questionIds,
  };
}

/**
 * 問いの状態を決める。子から先に確定している必要があるため、木を下から上へ辿る。
 *
 * spec 3-21「判定」:
 *   判断できる … required の子がすべて片付き、alternative があれば1件以上 answered、
 *                 直下の measure がすべて完了
 *   手が止まっている … 未閉じで、子もやることも無い
 *   枝が死んだ   … alternative が全滅、または required の子が捨てられた
 */
function resolveState(node: QuestionNode): QuestionState {
  if (node.status === "answered") return "answered";
  if (node.status === "dropped") return "dropped";

  const requiredChildren = node.children.filter((child) => child.contribution === "required");
  const alternativeChildren = node.children.filter((child) => child.contribution === "alternative");

  const requiredDropped = requiredChildren.some((child) => child.status === "dropped");
  const alternativesAllDropped =
    alternativeChildren.length > 0 && alternativeChildren.every((child) => child.status === "dropped");
  if (requiredDropped || alternativesAllDropped) return "dead_branch";

  if (node.children.length === 0 && node.actions.length === 0) return "stalled";

  const requiredSettled = requiredChildren.every(
    (child) => child.status === "answered" || child.status === "dropped",
  );
  const alternativeSettled =
    alternativeChildren.length === 0 || alternativeChildren.some((child) => child.status === "answered");
  const measuresDone = node.actions
    .filter((action) => action.actionKind === "measure")
    .every((action) => !isActionOpen(action));

  if (requiredSettled && alternativeSettled && measuresDone) return "decidable";
  return "in_progress";
}

/** 子から順に導出値を埋める。戻り値は自分自身。 */
function decorate(node: QuestionNode, today: string, depth: number): QuestionNode {
  node.depth = depth;
  for (const child of node.children) decorate(child, today, depth + 1);

  node.state = resolveState(node);

  const openActions = node.actions.filter(isActionOpen);
  node.openMeasureCount = openActions.filter((action) => action.actionKind === "measure").length;

  let nextDue = node.status === "open" ? node.dueDate : null;
  for (const action of openActions) nextDue = earlier(nextDue, action.plannedEnd);
  for (const child of node.children) nextDue = earlier(nextDue, child.nextDueDate);
  node.nextDueDate = nextDue;

  let latest = node.lastVerifiedAt;
  for (const action of node.actions) latest = later(latest, action.lastVerifiedAt);
  for (const finding of node.findings) latest = later(latest, finding.lastVerifiedAt);
  for (const child of node.children) latest = later(latest, child.latestVerifiedAt);
  node.latestVerifiedAt = latest;

  node.isOverdue = node.status === "open" && Boolean(nextDue) && (nextDue as string) < today;
  const staleDays = daysBetween(latest, today);
  node.isStale = node.status === "open" && (staleDays === null || staleDays >= STALE_DAYS);

  node.openDescendantCount = node.children.reduce(
    (total, child) => total + (child.status === "open" ? 1 : 0) + child.openDescendantCount,
    0,
  );
  node.openMeasureCountDeep = node.children.reduce(
    (total, child) => total + child.openMeasureCountDeep,
    node.openMeasureCount,
  );

  return node;
}

function flatten(nodes: QuestionNode[]): QuestionNode[] {
  const out: QuestionNode[] = [];
  const walk = (list: QuestionNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export async function getQuestionTreeBundle(
  projectId: string,
  canManage: boolean,
): Promise<QuestionTreeBundle> {
  const db = createAdminClient();
  const today = todayIso();

  const live = (table: string, select: string) =>
    db.from(table).select(select).eq("project_id", projectId).is("deleted_at", null);
  const plain = (table: string, select: string) =>
    db.from(table).select(select).eq("project_id", projectId);

  const [questionRes, actionRes, findingRes, qaRes, qfRes, depRes] = await Promise.all([
    live(
      "project_questions",
      "id,project_id,parent_id,contribution,title,background,question_kind,status,answer,answered_on,answered_by,drop_reason,confidence,owner_label,due_date,origin_kind,origin_ref,origin_question_id,sort_order,last_verified_at,review_state,proposed_parent_id,proposed_contribution,proposal_reason,created_at",
    ).order("sort_order"),
    live(
      "project_actions",
      "id,project_id,parent_id,title,detail,action_kind,status,owner_label,planned_start,planned_end,actual_end,date_certainty,progress_pct,blocker,done_criteria,done_evidence,target,actual,unit,origin_kind,origin_ref,origin_question_id,sort_order,last_verified_at,review_state,proposed_question_id,proposal_reason,created_at",
    ).order("sort_order"),
    live(
      "project_findings",
      "id,project_id,summary,finding_kind,observed_on,source_label,source_url,confidence,from_action_id,sort_order,last_verified_at,review_state,proposed_question_id,proposal_reason,created_at",
    ).order("observed_on", { ascending: false }),
    plain("project_question_actions", "question_id,action_id"),
    plain("project_question_findings", "question_id,finding_id"),
    plain("project_action_dependencies", "predecessor_action_id,successor_action_id"),
  ]);

  const allQuestionRows = (questionRes.data || []) as unknown as RawRow[];
  const allActionRows = (actionRes.data || []) as unknown as RawRow[];
  const allFindingRows = (findingRes.data || []) as unknown as RawRow[];

  // つくよみが拾ったまま人が見ていないものは木へ入れない。別枠で見せて、
  // 承認されたときだけ親と線が確定する（spec 3-21）。
  const isProposed = (row: RawRow) => row.review_state === "proposed";
  const questionRows = allQuestionRows.filter((row) => !isProposed(row));
  const actionRows = allActionRows.filter((row) => !isProposed(row));
  const findingRows = allFindingRows.filter((row) => !isProposed(row));
  const qaRows = (qaRes.data || []) as unknown as RawRow[];
  const qfRows = (qfRes.data || []) as unknown as RawRow[];
  const depRows = (depRes.data || []) as unknown as RawRow[];

  const questionIdsByAction = new Map<string, string[]>();
  const actionIdsByQuestion = new Map<string, string[]>();
  for (const row of qaRows) {
    const questionId = str(row, "question_id");
    const actionId = str(row, "action_id");
    questionIdsByAction.set(actionId, [...(questionIdsByAction.get(actionId) || []), questionId]);
    actionIdsByQuestion.set(questionId, [...(actionIdsByQuestion.get(questionId) || []), actionId]);
  }

  const questionIdsByFinding = new Map<string, string[]>();
  const findingIdsByQuestion = new Map<string, string[]>();
  for (const row of qfRows) {
    const questionId = str(row, "question_id");
    const findingId = str(row, "finding_id");
    questionIdsByFinding.set(findingId, [...(questionIdsByFinding.get(findingId) || []), questionId]);
    findingIdsByQuestion.set(questionId, [...(findingIdsByQuestion.get(questionId) || []), findingId]);
  }

  const findings = findingRows.map((row) =>
    mapFinding(row, questionIdsByFinding.get(str(row, "id")) || []),
  );
  const findingById = new Map(findings.map((finding) => [finding.id, finding]));

  const actions = actionRows.map((row) =>
    mapAction(row, questionIdsByAction.get(str(row, "id")) || []),
  );
  const actionById = new Map(actions.map((action) => [action.id, action]));

  for (const finding of findings) {
    if (!finding.fromActionId) continue;
    actionById.get(finding.fromActionId)?.findings.push(finding);
  }

  // やることの入れ子を組む。親が消えている行は最上位として扱い、行を失わない。
  const rootActions: ActionNode[] = [];
  for (const action of actions) {
    const parent = action.parentId ? actionById.get(action.parentId) : null;
    if (parent) parent.children.push(action);
    else rootActions.push(action);
  }

  const questions: QuestionNode[] = questionRows.map((row) => {
    const id = str(row, "id");
    const linkedActionIds = actionIdsByQuestion.get(id) || [];
    const linkedFindingIds = findingIdsByQuestion.get(id) || [];
    return {
      id,
      projectId: str(row, "project_id"),
      parentId: nullableStr(row, "parent_id"),
      contribution: (row.contribution as Contribution | null) ?? null,
      title: str(row, "title"),
      background: nullableStr(row, "background"),
      questionKind: row.question_kind === "decision" ? "decision" : "open",
      status: (row.status as QuestionStatus) || "open",
      answer: nullableStr(row, "answer"),
      answeredOn: nullableStr(row, "answered_on"),
      answeredBy: nullableStr(row, "answered_by"),
      dropReason: nullableStr(row, "drop_reason"),
      confidence: asConfidence(row.confidence),
      ownerLabel: str(row, "owner_label", "担当未確認"),
      dueDate: nullableStr(row, "due_date"),
      originKind: asOriginKind(row.origin_kind),
      originRef: nullableStr(row, "origin_ref"),
      originQuestionId: nullableStr(row, "origin_question_id"),
      sortOrder: num(row, "sort_order"),
      lastVerifiedAt: str(row, "last_verified_at", today),
      children: [],
      actions: linkedActionIds
        .map((actionId) => actionById.get(actionId))
        .filter((action): action is ActionNode => Boolean(action)),
      findings: linkedFindingIds
        .map((findingId) => findingById.get(findingId))
        .filter((finding): finding is FindingNode => Boolean(finding)),
      derivedQuestionIds: [],
      state: "in_progress",
      nextDueDate: null,
      latestVerifiedAt: str(row, "last_verified_at", today),
      isOverdue: false,
      isStale: false,
      openMeasureCount: 0,
      openDescendantCount: 0,
      openMeasureCountDeep: 0,
      depth: 0,
    };
  });

  const questionById = new Map(questions.map((question) => [question.id, question]));
  const roots: QuestionNode[] = [];
  for (const question of questions) {
    if (question.originQuestionId) {
      questionById.get(question.originQuestionId)?.derivedQuestionIds.push(question.id);
    }
    const parent = question.parentId ? questionById.get(question.parentId) : null;
    if (parent) {
      parent.children.push(question);
    } else {
      // 親が消えている子は根として扱い、行を失わない。かわりに親から見た役割
      // （必須／代替）は意味を持たなくなるので外す。根に「必須」の印だけが
      // 残ると、何に対して必須なのか読めない。
      question.parentId = null;
      question.contribution = null;
      roots.push(question);
    }
  }

  // 閉じた問いは同じ並びの末尾へ落とす。未閉じが上に来ないと、
  // いま何が残っているのかを目で拾えない。
  const closedRank = (node: QuestionNode) => (node.status === "open" ? 0 : 1);
  const sortQuestions = (list: QuestionNode[]) => {
    list.sort(
      (a, b) =>
        closedRank(a) - closedRank(b) ||
        a.sortOrder - b.sortOrder ||
        a.title.localeCompare(b.title, "ja"),
    );
    for (const node of list) sortQuestions(node.children);
  };
  sortQuestions(roots);
  for (const root of roots) decorate(root, today, 0);

  const allQuestions = flatten(roots);
  const linkedActionIds = new Set(qaRows.map((row) => str(row, "action_id")));
  const looseActions = rootActions.filter((action) => !linkedActionIds.has(action.id));

  const counts = {
    questions: allQuestions.length,
    open: allQuestions.filter((question) => question.status === "open").length,
    answered: allQuestions.filter((question) => question.status === "answered").length,
    dropped: allQuestions.filter((question) => question.status === "dropped").length,
    decidable: allQuestions.filter((question) => question.state === "decidable").length,
    stalled: allQuestions.filter((question) => question.state === "stalled").length,
    deadBranch: allQuestions.filter((question) => question.state === "dead_branch").length,
    overdue: allQuestions.filter((question) => question.isOverdue).length,
    actions: actions.length,
    openMeasures: actions.filter((action) => action.actionKind === "measure" && isActionOpen(action))
      .length,
  };

  const titleById = new Map(allQuestionRows.map((row) => [str(row, "id"), str(row, "title")]));
  const toProposal = (row: RawRow, kind: ProposalNode["kind"]): ProposalNode => {
    const parentId =
      kind === "question" ? nullableStr(row, "proposed_parent_id") : nullableStr(row, "proposed_question_id");
    return {
      kind,
      id: str(row, "id"),
      title: kind === "finding" ? str(row, "summary") : str(row, "title"),
      detail: kind === "action" ? nullableStr(row, "detail") : nullableStr(row, "background"),
      proposedParentId: parentId,
      proposedParentTitle: parentId ? titleById.get(parentId) ?? null : null,
      proposedContribution: (row.proposed_contribution as Contribution | null) ?? null,
      reason: nullableStr(row, "proposal_reason"),
      originRef: nullableStr(row, "origin_ref"),
      createdAt: str(row, "created_at"),
    };
  };
  const proposals: ProposalNode[] = [
    ...allQuestionRows.filter(isProposed).map((row) => toProposal(row, "question")),
    ...allActionRows.filter(isProposed).map((row) => toProposal(row, "action")),
    ...allFindingRows.filter(isProposed).map((row) => toProposal(row, "finding")),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return {
    projectId,
    asOf: today,
    roots,
    proposals,
    looseActions,
    allQuestions,
    allActions: actions,
    findings,
    dependencies: depRows.map((row) => ({
      predecessorActionId: str(row, "predecessor_action_id"),
      successorActionId: str(row, "successor_action_id"),
    })),
    counts,
    canManage,
    hasData: allQuestions.length > 0 || actions.length > 0,
  };
}
