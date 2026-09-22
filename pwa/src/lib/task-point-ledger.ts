/**
 * Goal-tree TODOs are the source of task-based points. This module is deliberately
 * independent of reward caps: it answers which milestone and member earned each
 * accepted point, leaving the existing cap/carry calculation unchanged.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
export type TaskPointAction = {
  id: string;
  parent_id: string | null;
  origin_question_id: string | null;
  title: string;
  status: string;
  review_state: string | null;
  planned_end: string | null;
  estimated_pt: number | string | null;
  accepted_pt: number | string | null;
  reviewed_at: string | null;
  review_result: string | null;
};

export type TaskPointOwner = { action_id: string; member_id: string; share: number | string | null };
export type TaskPointQuestion = { id: string; parent_id: string | null };
export type TaskPointQuestionAction = { question_id: string; action_id: string };
export type TaskPointQuestionMilestone = { question_id: string; milestone_id: string };
export type TaskPointReview = { id: string; action_id: string; milestone_id: string; title_snapshot: string; ym: string; accepted_pt: number | string };
export type TaskPointReviewAllocation = { review_id: string; member_id: string; earned_pt: number | string };

export type TaskPointLine = {
  actionId: string;
  title: string;
  milestoneId: string;
  memberId: string;
  ym: string;
  points: number;
  basis: "estimated" | "accepted";
};

export type TaskPointLedger = {
  taskBasedMilestoneIds: Set<string>;
  estimated: TaskPointLine[];
  accepted: TaskPointLine[];
};

export const TASK_POINT_PILOT_PROJECT_ID = "p21";
export const TASK_POINT_PILOT_START_YM = "202610";

export function isTaskPointPilot(projectId: string, ym: string): boolean {
  return projectId === TASK_POINT_PILOT_PROJECT_ID && ym >= TASK_POINT_PILOT_START_YM;
}

/** 新MSは対応線が未設定でも月割りで先払いしない。 */
export function markNewTaskMilestones(
  ledger: TaskPointLedger,
  milestones: Array<{ milestone_id: string; period_start_ym?: string | null; tag?: string | null }>,
): void {
  for (const ms of milestones) {
    if ((ms.period_start_ym ?? "") >= TASK_POINT_PILOT_START_YM
      && String(ms.tag ?? "").toLowerCase() !== "routine") {
      ledger.taskBasedMilestoneIds.add(ms.milestone_id);
    }
  }
}

function positivePoint(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function ownerShares(owners: TaskPointOwner[], actionId: string): Array<{ memberId: string; share: number }> {
  const matches = owners.filter((owner) => owner.action_id === actionId);
  if (matches.length === 0) return [];
  if (matches.every((owner) => owner.share == null)) {
    return matches.map((owner) => ({ memberId: owner.member_id, share: 1 / matches.length }));
  }
  if (matches.some((owner) => owner.share == null)) {
    throw new Error(`TODO ${actionId}: 担当割合は全員を明示するか、全員を均等に設定`);
  }
  const shares = matches.map((owner) => ({ memberId: owner.member_id, share: Number(owner.share) }));
  const total = shares.reduce((sum, owner) => sum + owner.share, 0);
  if (shares.some((owner) => !Number.isFinite(owner.share) || owner.share <= 0) || Math.abs(total - 1) > 0.0001) {
    throw new Error(`TODO ${actionId}: 担当割合の合計が100%ではないよ`);
  }
  return shares;
}

function distributedPoints(points: number, shares: Array<{ memberId: string; share: number }>) {
  let assigned = 0;
  return shares.map((owner, index) => {
    const amount = index === shares.length - 1
      ? Math.round((points - assigned) * 100) / 100
      : Math.round(points * owner.share * 100) / 100;
    assigned += amount;
    return { memberId: owner.memberId, points: amount };
  });
}

export function buildTaskPointLedger({
  actions,
  owners,
  questions,
  questionActions,
  questionMilestones,
  reviews = [],
  reviewAllocations = [],
  activeMilestoneIds,
}: {
  actions: TaskPointAction[];
  owners: TaskPointOwner[];
  questions: TaskPointQuestion[];
  questionActions: TaskPointQuestionAction[];
  questionMilestones: TaskPointQuestionMilestone[];
  reviews?: TaskPointReview[];
  reviewAllocations?: TaskPointReviewAllocation[];
  activeMilestoneIds: Set<string>;
}): TaskPointLedger {
  const actionById = new Map(actions.map((row) => [row.id, row]));
  const questionById = new Map(questions.map((row) => [row.id, row]));
  const milestoneByQuestion = new Map<string, Set<string>>();
  for (const link of questionMilestones) {
    if (!activeMilestoneIds.has(link.milestone_id)) continue;
    const ids = milestoneByQuestion.get(link.question_id) ?? new Set<string>();
    ids.add(link.milestone_id);
    milestoneByQuestion.set(link.question_id, ids);
  }
  const questionIdsByAction = new Map<string, Set<string>>();
  for (const link of questionActions) {
    const ids = questionIdsByAction.get(link.action_id) ?? new Set<string>();
    ids.add(link.question_id);
    questionIdsByAction.set(link.action_id, ids);
  }
  const taskBasedMilestoneIds = new Set(Array.from(milestoneByQuestion.values()).flatMap((ids) => Array.from(ids)));
  for (const review of reviews) {
    if (activeMilestoneIds.has(review.milestone_id)) taskBasedMilestoneIds.add(review.milestone_id);
  }
  const estimated: TaskPointLine[] = [];
  const accepted: TaskPointLine[] = [];
  const reviewedActionIds = new Set(reviews.map((row) => row.action_id));

  for (const review of reviews) {
    if (!activeMilestoneIds.has(review.milestone_id)) continue;
    const allocations = reviewAllocations.filter((row) => row.review_id === review.id);
    const total = allocations.reduce((sum, row) => sum + Number(row.earned_pt), 0);
    if (Math.abs(total - Number(review.accepted_pt)) > 0.001) {
      throw new Error(`TODO ${review.action_id}: 検収ptと担当配分が一致しないよ`);
    }
    for (const allocation of allocations) accepted.push({
      actionId: review.action_id, title: review.title_snapshot,
      milestoneId: review.milestone_id, memberId: allocation.member_id,
      ym: review.ym, points: Number(allocation.earned_pt), basis: "accepted",
    });
  }

  for (const action of actions) {
    if (action.review_state === "proposed" || action.status === "dropped") continue;
    if (reviewedActionIds.has(action.id)) continue;
    const questionIds = new Set<string>();
    let cursor: TaskPointAction | undefined = action;
    const visitedActions = new Set<string>();
    while (cursor && !visitedActions.has(cursor.id)) {
      visitedActions.add(cursor.id);
      if (cursor.origin_question_id) questionIds.add(cursor.origin_question_id);
      for (const id of questionIdsByAction.get(cursor.id) ?? []) questionIds.add(id);
      cursor = cursor.parent_id ? actionById.get(cursor.parent_id) : undefined;
    }
    const matchingMilestones = new Set<string>();
    for (const questionId of questionIds) {
      let qid: string | null = questionId;
      const visitedQuestions = new Set<string>();
      while (qid && !visitedQuestions.has(qid)) {
        visitedQuestions.add(qid);
        for (const id of milestoneByQuestion.get(qid) ?? []) matchingMilestones.add(id);
        qid = questionById.get(qid)?.parent_id ?? null;
      }
    }
    const estimatedPt = positivePoint(action.estimated_pt);
    const acceptedPt = positivePoint(action.accepted_pt);
    if (matchingMilestones.size === 0) {
      if ((estimatedPt ?? 0) > 0 || (acceptedPt ?? 0) > 0) {
        throw new Error(`TODO ${action.id}: ptがあるのにMSとの対応がないよ`);
      }
      continue;
    }
    if (matchingMilestones.size !== 1) {
      throw new Error(`TODO ${action.id}: 報酬対象のMSが複数あるよ`);
    }
    const milestoneId = Array.from(matchingMilestones)[0];
    const shares = ownerShares(owners, action.id);
    if (((estimatedPt ?? 0) > 0 || (acceptedPt ?? 0) > 0) && shares.length === 0) {
      throw new Error(`TODO ${action.id}: ptがあるのに担当がいないよ`);
    }
    if (estimatedPt != null && action.planned_end && /^\d{4}-\d{2}-\d{2}$/.test(action.planned_end)) {
      for (const owner of distributedPoints(estimatedPt, shares)) estimated.push({
        actionId: action.id, title: action.title, milestoneId, memberId: owner.memberId,
        ym: action.planned_end.slice(0, 7).replace("-", ""),
        points: owner.points, basis: "estimated",
      });
    }
    if (acceptedPt != null || action.reviewed_at || action.review_result === "accepted") {
      throw new Error(`TODO ${action.id}: 確定ptがあるのに検収台帳に無いよ`);
    }
  }
  return { taskBasedMilestoneIds, estimated, accepted };
}

export async function loadTaskPointLedger(
  db: SupabaseClient,
  projectId: string,
  activeMilestoneIds: Set<string>,
): Promise<TaskPointLedger> {
  const [actionsRes, ownersRes, questionsRes, linksRes, mappingsRes, reviewsRes] = await Promise.all([
    db.from("project_actions")
      .select("id,parent_id,origin_question_id,title,status,review_state,planned_end,estimated_pt,accepted_pt,reviewed_at,review_result")
      .eq("project_id", projectId).is("deleted_at", null),
    db.from("project_action_owners")
      .select("action_id,member_id,share").eq("project_id", projectId),
    db.from("project_questions")
      .select("id,parent_id").eq("project_id", projectId).is("deleted_at", null),
    db.from("project_question_actions")
      .select("question_id,action_id").eq("project_id", projectId),
    db.from("project_question_milestones")
      .select("question_id,milestone_id").eq("project_id", projectId),
    db.from("project_action_pt_reviews")
      .select("id,action_id,milestone_id,title_snapshot,ym,accepted_pt").eq("project_id", projectId),
  ]);
  for (const result of [actionsRes, ownersRes, questionsRes, linksRes, mappingsRes, reviewsRes]) {
    if (result.error) throw result.error;
  }
  const reviewIds = (reviewsRes.data ?? []).map((row) => String(row.id));
  const allocationsRes = reviewIds.length
    ? await db.from("project_action_pt_review_allocations")
      .select("review_id,member_id,earned_pt").in("review_id", reviewIds)
    : { data: [], error: null };
  if (allocationsRes.error) throw allocationsRes.error;
  return buildTaskPointLedger({
    actions: (actionsRes.data ?? []) as TaskPointAction[],
    owners: (ownersRes.data ?? []) as TaskPointOwner[],
    questions: (questionsRes.data ?? []) as TaskPointQuestion[],
    questionActions: (linksRes.data ?? []) as TaskPointQuestionAction[],
    questionMilestones: (mappingsRes.data ?? []) as TaskPointQuestionMilestone[],
    reviews: (reviewsRes.data ?? []) as TaskPointReview[],
    reviewAllocations: (allocationsRes.data ?? []) as TaskPointReviewAllocation[],
    activeMilestoneIds,
  });
}
