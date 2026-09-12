import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AcceptState,
  ActionNode,
  ActionOwner,
  ActionStatus,
  ProposalNode,
  Confidence,
  Contribution,
  FindingKind,
  FindingNode,
  OriginKind,
  QuestionKind,
  QuestionNode,
  QuestionState,
  QuestionStatus,
  QuestionTreeBundle,
} from "@/lib/question-tree-types";

export * from "@/lib/question-tree-types";

/**
 * ゴールツリー。正本は pwa/spec/3-21-question-tree-current-spec.md。
 *
 * 型は3つだけ。
 *   問い       … 答えが出れば閉じる（論点・仮説・決めること・目的・成立条件）
 *   TODO   … 実行すれば終わる（工程・タスク・検証・技術試験・決定後の行動）
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

function asQuestionKind(value: unknown): QuestionKind {
  return value === "decision" || value === "goal" || value === "milestone" ? value : "open";
}

function asAcceptState(value: unknown): AcceptState {
  return value === "assigned" || value === "accepted" || value === "negotiating" ? value : "unassigned";
}

/** numeric は driver によって文字列で届く。pt は小数1桁なので数に戻して扱う。 */
function nullableNum(row: RawRow, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

/**
 * ptは報酬に直結するので、ツリーとガントの束には載せない（まさ 2026-09-11
 * 「ツリーはAMD外のメンバーも見るから、ここでptを書かれると困る」）。
 * 共有ワークスペースの外部メンバーはガントを見るので、画面で隠すだけでなく
 * 返す値から落とす。ptを並べて比べる面はMS・月次タブ（内部だけ）に置く。
 */
function mapAction(
  row: RawRow,
  questionIds: string[],
  owners: ActionOwner[],
  includePoints: boolean,
  isProposed = false,
): ActionNode {
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
    estimatedPt: includePoints ? nullableNum(row, "estimated_pt") : null,
    acceptedPt: includePoints ? nullableNum(row, "accepted_pt") : null,
    acceptState: asAcceptState(row.accept_state),
    owners,
    // 会議中はタイトルだけで足せる（3-22 §4）。担当か期限のどちらかが空なら、
    // まだアサインが済んでいない。終わった仕事は対象にしない。
    isUnassigned:
      ACTION_OPEN_STATUSES.includes(status) && (owners.length === 0 || !plannedEnd),
    urgent: row.urgent === true,
    isProposed,
    createdAt: nullableStr(row, "created_at"),
    createdBy: nullableStr(row, "created_by"),
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
 * 問いの状態を決める。子から先に確定している必要があるため、ツリーを下から上へ辿る。
 *
 * spec 3-21「判定」:
 *   判断できる … required の子がすべて片付き、alternative があれば1件以上 answered、
 *                 直下の measure がすべて完了
 *   手が止まっている … 未閉じで、子もTODOも無い
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
function decorate(
  node: QuestionNode,
  today: string,
  depth: number,
  ownerQuestionOfAction: Map<string, string>,
): QuestionNode {
  node.depth = depth;
  for (const child of node.children) decorate(child, today, depth + 1, ownerQuestionOfAction);

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

  // この枝のTODOの集計。自分のものとして数えるのは、ツリーの上から見て
  // 最初にここへぶら下がったTODOだけ。
  // 未承認は数に入れない。承認するまでは「やると決まった仕事」ではないので、
  // ptの合計や件数へ混ぜると、配りすぎの判断を誤らせる（まさ確定 2026-09-12）。
  const mine = node.actions.filter(
    (action) => ownerQuestionOfAction.get(action.id) === node.id && !action.isProposed,
  );
  node.assignedPt =
    Math.round(
      (mine.reduce((total, action) => total + (action.estimatedPt ?? 0), 0) +
        node.children.reduce((total, child) => total + child.assignedPt, 0)) *
        10,
    ) / 10;
  node.todoCount =
    mine.length + node.children.reduce((total, child) => total + child.todoCount, 0);
  node.unassignedCount =
    mine.filter((action) => action.isUnassigned).length +
    node.children.reduce((total, child) => total + child.unassignedCount, 0);

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

/**
 * 割り振りセッションが読む束（3-22 §4「えいみが読むもの」）。
 *
 * 担当・期限・見積ptは、まさかPMがセッションでえいみと決めてえいみが書き込む。
 * その1回目に必要なもの——未アサインのTODOが、どの到達点のどのMSのどの論点の下に
 * ぶら下がっているか、完了条件、前後関係、同じMSに既に配ったpt——をまとめて返す。
 * 画面の提案列ではないので、ツリーそのものには何も足さない。
 */
export async function getGoalTreeAssignmentView(projectId: string) {
  // 割り振りを決める面なので、ここだけはptを載せて読む。
  const bundle = await getQuestionTreeBundle(projectId, true, true);

  type Trail = { kind: QuestionKind; title: string; id: string }[];
  const trailByAction = new Map<string, Trail>();
  const milestoneByAction = new Map<string, QuestionNode>();

  const walk = (node: QuestionNode, trail: Trail, milestone: QuestionNode | null) => {
    const nextTrail: Trail = [...trail, { kind: node.questionKind, title: node.title, id: node.id }];
    // 未承認のMSは集計の器にしない。承認して初めてMSとして数える。
    const nextMilestone = node.questionKind === "milestone" && !node.isProposed ? node : milestone;
    for (const action of node.actions) {
      // 同じTODOが複数の問いに効くときは、最初に出会った道を使う。
      if (!trailByAction.has(action.id)) {
        trailByAction.set(action.id, nextTrail);
        if (nextMilestone) milestoneByAction.set(action.id, nextMilestone);
      }
    }
    for (const child of node.children) walk(child, nextTrail, nextMilestone);
  };
  for (const root of bundle.roots) walk(root, [], null);

  const actionById = new Map(bundle.allActions.map((action) => [action.id, action]));
  const titleOf = (id: string) => actionById.get(id)?.title ?? null;

  // MSごとに、配下のTODOへ既に配った見積ptを積む。配りすぎの判断材料。
  const milestoneRollup = new Map<string, { assignedPt: number; todos: number; unassigned: number }>();
  for (const action of bundle.allActions) {
    if (action.isProposed) continue;
    const milestone = milestoneByAction.get(action.id);
    if (!milestone) continue;
    const current = milestoneRollup.get(milestone.id) ?? { assignedPt: 0, todos: 0, unassigned: 0 };
    current.assignedPt += action.estimatedPt ?? 0;
    current.todos += 1;
    if (action.isUnassigned) current.unassigned += 1;
    milestoneRollup.set(milestone.id, current);
  }

  const milestones = bundle.allQuestions
    .filter((question) => question.questionKind === "milestone" && !question.isProposed)
    .map((question) => {
      const rollup = milestoneRollup.get(question.id) ?? { assignedPt: 0, todos: 0, unassigned: 0 };
      const goal = question.parentId ? bundle.allQuestions.find((q) => q.id === question.parentId) : null;
      return {
        id: question.id,
        title: question.title,
        dueDate: question.dueDate,
        goalTitle: goal?.title ?? null,
        milestoneIds: question.milestoneIds,
        assignedPt: Math.round(rollup.assignedPt * 10) / 10,
        todoCount: rollup.todos,
        unassignedCount: rollup.unassigned,
      };
    });

  const unassigned = bundle.allActions
    .filter((action) => action.isUnassigned && !action.isProposed)
    .map((action) => {
      const milestone = milestoneByAction.get(action.id) ?? null;
      return {
        id: action.id,
        title: action.title,
        actionKind: action.actionKind,
        status: action.status,
        detail: action.detail,
        doneCriteria: action.doneCriteria,
        plannedStart: action.plannedStart,
        plannedEnd: action.plannedEnd,
        estimatedPt: action.estimatedPt,
        ownerLabel: action.ownerLabel,
        owners: action.owners,
        // 何の下の話かを、到達点からの道で渡す。これが無いとptの重みを判断できない。
        path: trailByAction.get(action.id) ?? [],
        milestoneId: milestone?.id ?? null,
        milestoneTitle: milestone?.title ?? null,
        predecessors: bundle.dependencies
          .filter((dependency) => dependency.successorActionId === action.id)
          .map((dependency) => ({
            id: dependency.predecessorActionId,
            title: titleOf(dependency.predecessorActionId),
          })),
        successors: bundle.dependencies
          .filter((dependency) => dependency.predecessorActionId === action.id)
          .map((dependency) => ({
            id: dependency.successorActionId,
            title: titleOf(dependency.successorActionId),
          })),
      };
    });

  return {
    projectId,
    asOf: bundle.asOf,
    members: bundle.members,
    milestones,
    unassigned,
    counts: {
      unassigned: unassigned.length,
      actions: bundle.allActions.length,
      milestones: milestones.length,
    },
  };
}

/**
 * ptを並べて比べる面（MS・月次タブ）。
 *
 * ツリーの中に飛び飛びで出ていると「このTODOはpt高すぎないか」を比べられない
 * （まさ 2026-09-11）。MSごとにまとめ、同じMSの中はptの大きい順に並べて返す。
 * ここは内部だけが開くコックピットの面で、共有ワークスペースには出さない。
 */
export async function getGoalTreePointsView(projectId: string) {
  const bundle = await getQuestionTreeBundle(projectId, true, true);

  const milestoneOfAction = new Map<string, QuestionNode>();
  const goalOfMilestone = new Map<string, string>();
  const walk = (node: QuestionNode, milestone: QuestionNode | null, goalTitle: string | null) => {
    // 未承認のMS・到達点はptの集計単位にしない。承認して初めて器になる。
    const isGoal = node.questionKind === "goal" && !node.isProposed;
    const isMilestone = node.questionKind === "milestone" && !node.isProposed;
    const nextGoal = isGoal ? node.title : goalTitle;
    const nextMilestone = isMilestone ? node : milestone;
    if (isMilestone && nextGoal) goalOfMilestone.set(node.id, nextGoal);
    for (const action of node.actions) {
      if (!milestoneOfAction.has(action.id) && nextMilestone) {
        milestoneOfAction.set(action.id, nextMilestone);
      }
    }
    for (const child of node.children) walk(child, nextMilestone, nextGoal);
  };
  for (const root of bundle.roots) walk(root, null, null);

  const rows = bundle.allActions
    .filter((action) => action.status !== "dropped" && !action.isProposed)
    .map((action) => {
      const milestone = milestoneOfAction.get(action.id) ?? null;
      return {
        id: action.id,
        title: action.title,
        actionKind: action.actionKind,
        status: action.status,
        estimatedPt: action.estimatedPt,
        acceptedPt: action.acceptedPt,
        plannedStart: action.plannedStart,
        plannedEnd: action.plannedEnd,
        isOverdue: action.isOverdue,
        isUnassigned: action.isUnassigned,
        owners: action.owners,
        ownerLabel: action.ownerLabel,
        milestoneId: milestone?.id ?? null,
        milestoneTitle: milestone?.title ?? null,
      };
    });

  const groups = bundle.allQuestions
    .filter((question) => question.questionKind === "milestone" && !question.isProposed)
    .map((question) => {
      const items = rows
        .filter((row) => row.milestoneId === question.id)
        // 大きい順。比べたいのは「どれが重いか」なので、pt無しは最後へ。
        .sort((a, b) => (b.estimatedPt ?? -1) - (a.estimatedPt ?? -1) || a.title.localeCompare(b.title, "ja"));
      return {
        milestoneId: question.id,
        title: question.title,
        goalTitle: goalOfMilestone.get(question.id) ?? null,
        dueDate: question.dueDate,
        assignedPt: Math.round(items.reduce((total, row) => total + (row.estimatedPt ?? 0), 0) * 10) / 10,
        todoCount: items.length,
        unassignedCount: items.filter((row) => row.isUnassigned).length,
        pricedCount: items.filter((row) => row.estimatedPt !== null).length,
        items,
      };
    })
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  // MSにぶら下がっていないTODO。ptを配る前に置き場所を決める必要がある。
  const loose = rows
    .filter((row) => !row.milestoneId)
    .sort((a, b) => (b.estimatedPt ?? -1) - (a.estimatedPt ?? -1) || a.title.localeCompare(b.title, "ja"));

  return {
    projectId,
    asOf: bundle.asOf,
    groups,
    loose,
    totals: {
      assignedPt: Math.round(rows.reduce((total, row) => total + (row.estimatedPt ?? 0), 0) * 10) / 10,
      todoCount: rows.length,
      pricedCount: rows.filter((row) => row.estimatedPt !== null).length,
      unassignedCount: rows.filter((row) => row.isUnassigned).length,
      maxPt: rows.reduce((max, row) => Math.max(max, row.estimatedPt ?? 0), 0),
    },
  };
}

export type GoalTreePointsView = Awaited<ReturnType<typeof getGoalTreePointsView>>;

export async function getQuestionTreeBundle(
  projectId: string,
  canManage: boolean,
  /** ptを束に載せるか。既定は載せない（ツリー・ガントは外部も見る） */
  includePoints = false,
): Promise<QuestionTreeBundle> {
  const db = createAdminClient();
  const today = todayIso();

  const live = (table: string, select: string) =>
    db.from(table).select(select).eq("project_id", projectId).is("deleted_at", null);
  const plain = (table: string, select: string) =>
    db.from(table).select(select).eq("project_id", projectId);

  const [questionRes, actionRes, findingRes, qaRes, qfRes, depRes, ownerRes, qmRes, memberRes] =
    await Promise.all([
      live(
        "project_questions",
        "id,project_id,parent_id,contribution,title,background,question_kind,status,answer,answered_on,answered_by,drop_reason,confidence,owner_label,due_date,origin_kind,origin_ref,origin_question_id,sort_order,last_verified_at,review_state,proposed_parent_id,proposed_contribution,proposal_reason,created_at",
      ).order("sort_order"),
      live(
        "project_actions",
        "id,project_id,parent_id,title,detail,action_kind,status,owner_label,planned_start,planned_end,actual_end,date_certainty,progress_pct,blocker,done_criteria,done_evidence,target,actual,unit,origin_kind,origin_ref,origin_question_id,sort_order,last_verified_at,review_state,proposed_question_id,proposal_reason,created_at,estimated_pt,accepted_pt,accept_state,accepted_at,accepted_by,reviewed_at,reviewed_by,review_result,urgent,created_by",
      ).order("sort_order"),
      live(
        "project_findings",
        "id,project_id,summary,finding_kind,observed_on,source_label,source_url,confidence,from_action_id,sort_order,last_verified_at,review_state,proposed_question_id,proposal_reason,created_at",
      ).order("observed_on", { ascending: false }),
      plain("project_question_actions", "question_id,action_id"),
      plain("project_question_findings", "question_id,finding_id"),
      plain("project_action_dependencies", "predecessor_action_id,successor_action_id"),
      plain("project_action_owners", "action_id,member_id,share"),
      plain("project_question_milestones", "question_id,milestone_id"),
      // 担当に選べる人。名簿のとおり在籍者を出し、こちらで人を選り分けない
      db.from("members").select("member_id,code_name").eq("status", "active").order("member_id"),
    ]);

  const allQuestionRows = (questionRes.data || []) as unknown as RawRow[];
  const allActionRows = (actionRes.data || []) as unknown as RawRow[];
  const allFindingRows = (findingRes.data || []) as unknown as RawRow[];

  /**
   * 未承認も、承認したら入る位置でツリーに出す（まさ確定 2026-09-12
   * 「承認したらツリーのどこにいくかが分からないのに承認できない。
   * ツリーの中に未承認として目立たせて表示して」）。
   * 論点・到達点・MSは `parent_id` が空でも `proposed_parent_id` で仮に繋いで描く。
   */
  const isProposed = (row: RawRow) => row.review_state === "proposed";
  const questionRows = allQuestionRows;
  /**
   * 未承認のTODOも、ツリーには出す（まさ確定 2026-09-12
   * 「承認したらツリーのどこにいくかが分からないのに承認できない。
   * ツリーの中に未承認として目立たせて表示して」）。
   * 承認前は線が無いので、提案が持っている「戻り先」で仮に繋いで描く。
   */
  const actionRows = allActionRows;
  const findingRows = allFindingRows.filter((row) => !isProposed(row));
  const qaRows = (qaRes.data || []) as unknown as RawRow[];
  const qfRows = (qfRes.data || []) as unknown as RawRow[];
  const depRows = (depRes.data || []) as unknown as RawRow[];
  const ownerRows = (ownerRes.data || []) as unknown as RawRow[];
  const qmRows = (qmRes.data || []) as unknown as RawRow[];
  const memberRows = (memberRes.data || []) as unknown as RawRow[];

  const members = memberRows.map((row) => ({
    memberId: str(row, "member_id"),
    displayName: str(row, "code_name", str(row, "member_id")),
  }));
  const memberNameById = new Map(members.map((member) => [member.memberId, member.displayName]));

  const ownersByAction = new Map<string, ActionOwner[]>();
  for (const row of ownerRows) {
    const actionId = str(row, "action_id");
    const memberId = str(row, "member_id");
    ownersByAction.set(actionId, [
      ...(ownersByAction.get(actionId) || []),
      {
        memberId,
        displayName: memberNameById.get(memberId) ?? memberId,
        share: nullableNum(row, "share"),
      },
    ]);
  }

  const milestoneIdsByQuestion = new Map<string, string[]>();
  for (const row of qmRows) {
    const questionId = str(row, "question_id");
    milestoneIdsByQuestion.set(questionId, [
      ...(milestoneIdsByQuestion.get(questionId) || []),
      str(row, "milestone_id"),
    ]);
  }

  const questionIdsByAction = new Map<string, string[]>();
  const actionIdsByQuestion = new Map<string, string[]>();
  // 未承認は線をまだ持たないので、戻り先で仮に繋ぐ。承認すると本物の線が入る。
  for (const row of allActionRows) {
    if (!isProposed(row)) continue;
    const questionId = nullableStr(row, "proposed_question_id");
    if (!questionId) continue;
    const actionId = str(row, "id");
    questionIdsByAction.set(actionId, [...(questionIdsByAction.get(actionId) || []), questionId]);
    actionIdsByQuestion.set(questionId, [...(actionIdsByQuestion.get(questionId) || []), actionId]);
  }
  for (const row of qaRows) {
    const questionId = str(row, "question_id");
    const actionId = str(row, "action_id");
    questionIdsByAction.set(actionId, [...(questionIdsByAction.get(actionId) || []), questionId]);
    actionIdsByQuestion.set(questionId, [...(actionIdsByQuestion.get(questionId) || []), actionId]);
  }
  // 未承認へ戻した行は、戻り先（proposed_question_id）と本物の線を両方持っていることが
  // ある。そのまま足すと同じ行が同じ親の下に2回出るので、ここで重複を落とす。
  for (const [key, list] of questionIdsByAction) {
    questionIdsByAction.set(key, [...new Set(list)]);
  }
  for (const [key, list] of actionIdsByQuestion) {
    actionIdsByQuestion.set(key, [...new Set(list)]);
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
    mapAction(
      row,
      questionIdsByAction.get(str(row, "id")) || [],
      ownersByAction.get(str(row, "id")) || [],
      // ツリーとガントにはptを載せない。外部メンバーがガントを見るため。
      includePoints,
      isProposed(row),
    ),
  );
  const actionById = new Map(actions.map((action) => [action.id, action]));

  for (const finding of findings) {
    if (!finding.fromActionId) continue;
    actionById.get(finding.fromActionId)?.findings.push(finding);
  }

  // TODOの入れ子を組む。親が消えている行は最上位として扱い、行を失わない。
  const rootActions: ActionNode[] = [];
  for (const action of actions) {
    const parent = action.parentId ? actionById.get(action.parentId) : null;
    if (parent) parent.children.push(action);
    else rootActions.push(action);
  }

  const questions: QuestionNode[] = questionRows.map((row) => {
    const id = str(row, "id");
    const proposed = isProposed(row);
    // 未承認は本物の線をまだ持たないことがある。そのときは戻り先で仮に繋ぐ。
    const parentId = nullableStr(row, "parent_id") ?? (proposed ? nullableStr(row, "proposed_parent_id") : null);
    const contribution =
      (row.contribution as Contribution | null) ??
      (proposed ? (row.proposed_contribution as Contribution | null) : null) ??
      null;
    const linkedActionIds = actionIdsByQuestion.get(id) || [];
    const linkedFindingIds = findingIdsByQuestion.get(id) || [];
    return {
      id,
      projectId: str(row, "project_id"),
      parentId,
      contribution,
      title: str(row, "title"),
      background: nullableStr(row, "background"),
      questionKind: asQuestionKind(row.question_kind),
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
      milestoneIds: milestoneIdsByQuestion.get(id) || [],
      isProposed: proposed,
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
      assignedPt: 0,
      todoCount: 0,
      unassignedCount: 0,
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

  // ひとつのTODOが複数の問いに効くので、ツリーを上から歩いて「最初に出会った問い」を
  // そのTODOの所属にする。これをしないと、同じptが複数の枝で二重に積まれる。
  const ownerQuestionOfAction = new Map<string, string>();
  const claim = (node: QuestionNode) => {
    for (const action of node.actions) {
      if (!ownerQuestionOfAction.has(action.id)) ownerQuestionOfAction.set(action.id, node.id);
    }
    for (const child of node.children) claim(child);
  };
  for (const root of roots) claim(root);

  for (const root of roots) decorate(root, today, 0, ownerQuestionOfAction);

  const allQuestions = flatten(roots);
  // 「紐づいている」と数えるのは、ツリーに実在する論点への線だけ。消された論点への線を
  // 数えると、そのTODOはツリーにも下の一覧にも出ず、画面から消える
  // （2026-09-12 本番で確認。SXは未承認16件が消された論点にぶら下がっていた）。
  const liveQuestionIds = new Set(allQuestions.map((question) => question.id));
  const linkedActionIds = new Set(
    qaRows
      .filter((row) => liveQuestionIds.has(str(row, "question_id")))
      .map((row) => str(row, "action_id")),
  );
  const looseActions = rootActions.filter((action) => !linkedActionIds.has(action.id));

  // 承認済みだけを数える。未承認はツリーの中で光らせて見せるが、進捗の数字には入れない。
  const liveActions = actions.filter((action) => !action.isProposed);
  const liveQuestions = allQuestions.filter((question) => !question.isProposed);
  const counts = {
    questions: liveQuestions.length,
    open: liveQuestions.filter((question) => question.status === "open").length,
    answered: liveQuestions.filter((question) => question.status === "answered").length,
    dropped: liveQuestions.filter((question) => question.status === "dropped").length,
    decidable: liveQuestions.filter((question) => question.state === "decidable").length,
    stalled: liveQuestions.filter((question) => question.state === "stalled").length,
    deadBranch: liveQuestions.filter((question) => question.state === "dead_branch").length,
    overdue: liveQuestions.filter((question) => question.isOverdue).length,
    actions: liveActions.length,
    openMeasures: liveActions.filter(
      (action) => action.actionKind === "measure" && isActionOpen(action),
    ).length,
    unassignedActions: liveActions.filter((action) => action.isUnassigned).length,
    assignedPt:
      Math.round(liveActions.reduce((total, action) => total + (action.estimatedPt ?? 0), 0) * 10) /
      10,
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
    members,
    counts,
    canManage,
    hasData: allQuestions.length > 0 || actions.length > 0,
  };
}
