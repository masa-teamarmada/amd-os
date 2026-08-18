import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import {
  addWeeks,
  isMondayWeekKey,
  mondayOfWeekJst,
  validateWeeklyTaskCommand,
} from "@/lib/mypage/member-weekly-tasks";

export const runtime = "nodejs";

type Viewer = {
  memberId: string;
  isAdmin: boolean;
};

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
 * - POST: 本人の追加・状態変更・週替わり時の冪等な繰越だけを許可
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
    .select("id, member_id, project_id, week_start, title, status, completed_at, carried_from_task_id, source, created_at, updated_at")
    .eq("member_id", requestedMemberId)
    .in("week_start", weekStarts)
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    memberId: requestedMemberId,
    editable: requestedMemberId === viewer.memberId,
    tasks: (data || []).map((task) => ({
      id: task.id,
      memberId: task.member_id,
      projectId: task.project_id,
      weekStart: task.week_start,
      title: task.title,
      status: task.status,
      completedAt: task.completed_at,
      carriedFromTaskId: task.carried_from_task_id,
      source: task.source,
    })),
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
      .select("id, member_id, project_id, week_start, title, status, completed_at, carried_from_task_id, source")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, task: data }, { status: 201 });
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
      .select("id, member_id, project_id, week_start, title, status, completed_at, carried_from_task_id, source")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, task: data });
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
