import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import {
  addWeeks,
  actionItemCandidateKey,
  actionItemIdFromCandidateKey,
  isMondayWeekKey,
  mondayOfWeekJst,
  validateWeeklyTaskCommand,
  weekBoundsJst,
  type MemberWeeklyTask,
  type WeeklyTaskCandidate,
} from "@/lib/mypage/member-weekly-tasks";

export const runtime = "nodejs";

type Viewer = {
  memberId: string;
  isAdmin: boolean;
};

type WeeklyTaskRow = {
  id: string;
  member_id: string;
  project_id: string | null;
  week_start: string;
  title: string;
  status: "open" | "completed";
  completed_at: string | null;
  carried_from_task_id: string | null;
  candidate_key: string | null;
  source: "manual" | "carryover" | "action_item";
};

type ActionItemRow = {
  action_id: string;
  project_id: string | null;
  title: string;
  due_at: string;
};

const TASK_SELECT = "id, member_id, project_id, week_start, title, status, completed_at, carried_from_task_id, candidate_key, source";

function serializeTask(task: WeeklyTaskRow): MemberWeeklyTask {
  return {
    id: task.id,
    memberId: task.member_id,
    projectId: task.project_id,
    weekStart: task.week_start,
    title: task.title,
    status: task.status,
    completedAt: task.completed_at,
    carriedFromTaskId: task.carried_from_task_id,
    candidateKey: task.candidate_key,
    source: task.source,
  };
}

/**
 * 「来週の候補」は、本人担当・confirmed・未完了・期日が来週内の action_items に限定する。
 * 予定や議事録の自由文をそのまま個人タスクへ昇格させず、画面上の明示追加まで正本へ書かない。
 */
async function actionItemCandidates(
  admin: SupabaseClient,
  memberId: string,
  weekStart: string,
): Promise<WeeklyTaskCandidate[]> {
  const { startIso, endIso } = weekBoundsJst(weekStart);
  const { data, error } = await admin
    .from("action_items")
    .select("action_id, project_id, title, due_at")
    .eq("assignee_member_id", memberId)
    .eq("review_status", "confirmed")
    .in("status", ["open", "in_progress"])
    .gte("due_at", startIso)
    .lt("due_at", endIso)
    .order("due_at", { ascending: true })
    .order("action_id", { ascending: true });
  if (error) throw new Error(error.message);

  return ((data || []) as ActionItemRow[])
    .filter((item) => Boolean(item.action_id && item.title && item.due_at))
    .map((item) => ({
      candidateKey: actionItemCandidateKey(item.action_id),
      projectId: item.project_id,
      title: item.title.trim().slice(0, 240),
      dueAt: item.due_at,
      sourceLabel: "要対応" as const,
    }));
}

async function resolveViewer(email: string, supabase: SupabaseClient): Promise<Viewer | null> {
  const { data, error } = await supabase
    .from("members")
    .select("member_id, is_admin")
    .ilike("email", email)
    .maybeSingle();
  if (error || !data?.member_id) return null;
  return { memberId: data.member_id, isAdmin: Boolean(data.is_admin) };
}

function parseWeekStarts(raw: string | null) {
  const values = (raw || "").split(",").map((value) => value.trim()).filter(Boolean);
  const weeks = values.length ? [...new Set(values)] : [mondayOfWeekJst()];
  if (weeks.length > 4 || weeks.some((week) => !isMondayWeekKey(week))) {
    throw new Error("weekStart must contain up to four Monday YYYY-MM-DD values");
  }
  return weeks;
}

/**
 * 手動週次タスクの読み書き口。
 * - GET: 本人、または admin の閲覧だけを許可
 * - POST: 本人の追加・状態変更・週替わり時の冪等な繰越・候補の明示追加だけを許可
 */
export async function GET(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const viewer = await resolveViewer(auth.user.email, auth.supabase);
  if (!viewer) return NextResponse.json({ ok: false, error: "member not found" }, { status: 403 });

  const url = new URL(req.url);
  const requestedMemberId = url.searchParams.get("memberId")?.trim() || viewer.memberId;
  if (requestedMemberId !== viewer.memberId && !viewer.isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let weekStarts: string[];
  try {
    weekStarts = parseWeekStarts(url.searchParams.get("weekStart"));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "invalid weekStart" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_weekly_tasks")
    .select(TASK_SELECT)
    .eq("member_id", requestedMemberId)
    .in("week_start", weekStarts)
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const tasks = ((data || []) as WeeklyTaskRow[]).map(serializeTask);
  const nextWeekStart = addWeeks(mondayOfWeekJst(), 1);
  let suggestions: WeeklyTaskCandidate[] = [];
  if (weekStarts.includes(nextWeekStart)) {
    try {
      const existingCandidateKeys = new Set(
        tasks
          .filter((task) => task.weekStart === nextWeekStart && task.candidateKey)
          .map((task) => task.candidateKey),
      );
      suggestions = (await actionItemCandidates(admin, requestedMemberId, nextWeekStart))
        .filter((candidate) => !existingCandidateKeys.has(candidate.candidateKey));
    } catch (candidateError) {
      return NextResponse.json({ ok: false, error: candidateError instanceof Error ? candidateError.message : "next-week candidates failed" }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    memberId: requestedMemberId,
    editable: requestedMemberId === viewer.memberId,
    candidateWeekStart: nextWeekStart,
    suggestions,
    tasks,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const viewer = await resolveViewer(auth.user.email, auth.supabase);
  if (!viewer) return NextResponse.json({ ok: false, error: "member not found" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const command = validateWeeklyTaskCommand(body);
  if (!command.ok) return NextResponse.json({ ok: false, error: command.error }, { status: 400 });

  const admin = createAdminClient();
  if (command.action === "create") {
    const { data, error } = await admin
      .from("member_weekly_tasks")
      .insert({
        member_id: viewer.memberId,
        project_id: command.projectId,
        week_start: command.weekStart,
        title: command.title,
        status: "open",
        source: "manual",
      })
      .select(TASK_SELECT)
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, task: serializeTask(data as WeeklyTaskRow) }, { status: 201 });
  }

  if (command.action === "set-status") {
    const { data: existing, error: lookupError } = await admin
      .from("member_weekly_tasks")
      .select("id, member_id")
      .eq("id", command.taskId)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ ok: false, error: lookupError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ ok: false, error: "task not found" }, { status: 404 });
    if (existing.member_id !== viewer.memberId) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const completedAt = command.status === "completed" ? new Date().toISOString() : null;
    const { data, error } = await admin
      .from("member_weekly_tasks")
      .update({ status: command.status, completed_at: completedAt })
      .eq("id", command.taskId)
      .eq("member_id", viewer.memberId)
      .select(TASK_SELECT)
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, task: serializeTask(data as WeeklyTaskRow) });
  }

  if (command.action === "accept-candidate") {
    const nextWeekStart = addWeeks(mondayOfWeekJst(), 1);
    if (command.weekStart !== nextWeekStart) {
      return NextResponse.json({ ok: false, error: "candidates are available only for next week" }, { status: 400 });
    }

    const actionItemId = actionItemIdFromCandidateKey(command.candidateKey!);
    let candidates: WeeklyTaskCandidate[];
    try {
      candidates = await actionItemCandidates(admin, viewer.memberId, nextWeekStart);
    } catch (candidateError) {
      return NextResponse.json({ ok: false, error: candidateError instanceof Error ? candidateError.message : "next-week candidates failed" }, { status: 500 });
    }
    const candidate = candidates.find((item) => item.candidateKey === command.candidateKey);
    if (!actionItemId || !candidate) {
      return NextResponse.json({ ok: false, error: "candidate is not available" }, { status: 404 });
    }

    const { data: existing, error: existingError } = await admin
      .from("member_weekly_tasks")
      .select(TASK_SELECT)
      .eq("member_id", viewer.memberId)
      .eq("week_start", nextWeekStart)
      .eq("candidate_key", command.candidateKey)
      .maybeSingle();
    if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
    if (existing) return NextResponse.json({ ok: true, task: serializeTask(existing as WeeklyTaskRow) });

    const { data, error } = await admin
      .from("member_weekly_tasks")
      .insert({
        member_id: viewer.memberId,
        project_id: candidate.projectId,
        week_start: nextWeekStart,
        title: candidate.title,
        status: "open",
        source: "action_item",
        candidate_key: command.candidateKey,
      })
      .select(TASK_SELECT)
      .single();
    if (error) {
      if (error.code === "23505") {
        const { data: concurrent } = await admin
          .from("member_weekly_tasks")
          .select(TASK_SELECT)
          .eq("member_id", viewer.memberId)
          .eq("week_start", nextWeekStart)
          .eq("candidate_key", command.candidateKey)
          .maybeSingle();
        if (concurrent) return NextResponse.json({ ok: true, task: serializeTask(concurrent as WeeklyTaskRow) });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, task: serializeTask(data as WeeklyTaskRow) }, { status: 201 });
  }

  const currentWeek = mondayOfWeekJst();
  if (command.weekStart! > currentWeek) {
    return NextResponse.json({ ok: false, error: "future week rollover is not allowed" }, { status: 400 });
  }
  if (command.weekStart! < addWeeks(currentWeek, -1)) {
    return NextResponse.json({ ok: false, error: "rollover is available only for the current week" }, { status: 400 });
  }
  const { data, error } = await admin.rpc("rollover_member_weekly_tasks", {
    target_member_id: viewer.memberId,
    target_week_start: command.weekStart,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rolledOver: typeof data === "number" ? data : 0 });
}
