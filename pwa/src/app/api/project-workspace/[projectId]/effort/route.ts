import { NextRequest, NextResponse } from "next/server";
import {
  canAccessWorkspaceProject,
  getCurrentMemberAccess,
} from "@/lib/project-workspace";
import { EFFORT_CATEGORIES } from "@/lib/project-workspace-types";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EffortBody = {
  memberId?: unknown;
  weekStart?: unknown;
  category?: unknown;
  plannedHours?: unknown;
  actualHours?: unknown;
  note?: unknown;
  managementTrack?: unknown;
  managementMilestoneId?: unknown;
  deliverableLabel?: unknown;
};

function hoursValue(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > 168) return null;
  return Math.round(number * 100) / 100;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const access = await getCurrentMemberAccess();
  if (!access) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { projectId } = await params;
  if (!canAccessWorkspaceProject(access, projectId)) {
    return NextResponse.json({ ok: false, error: "このPJにはアクセスできないよ" }, { status: 403 });
  }

  let body: EffortBody;
  try {
    body = await request.json() as EffortBody;
  } catch {
    return NextResponse.json({ ok: false, error: "入力形式が不正だよ" }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const weekStart = typeof body.weekStart === "string" ? body.weekStart.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const plannedHours = hoursValue(body.plannedHours);
  const actualHours = hoursValue(body.actualHours);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) || null : null;
  let managementTrack = typeof body.managementTrack === "string" ? body.managementTrack.trim() || null : null;
  const managementMilestoneId = typeof body.managementMilestoneId === "string" ? body.managementMilestoneId.trim() || null : null;
  const deliverableLabel = typeof body.deliverableLabel === "string" ? body.deliverableLabel.trim().slice(0, 300) || null : null;
  const managementTracks = ["business_development", "technology_development", "funding", "organizational_building"];

  if (!memberId || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ ok: false, error: "メンバーと週を確認してね" }, { status: 400 });
  }
  const weekDate = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(weekDate.getTime()) || weekDate.getUTCDay() !== 1) {
    return NextResponse.json({ ok: false, error: "週の開始日は月曜日を選んでね" }, { status: 400 });
  }
  if (!EFFORT_CATEGORIES.some((item) => item.key === category)) {
    return NextResponse.json({ ok: false, error: "活動区分を確認してね" }, { status: 400 });
  }
  if (plannedHours === null || actualHours === null) {
    return NextResponse.json({ ok: false, error: "時間は0〜168時間で入力してね" }, { status: 400 });
  }
  if (managementTrack && !managementTracks.includes(managementTrack)) {
    return NextResponse.json({ ok: false, error: "経営の柱を確認してね" }, { status: 400 });
  }
  if (access.scope === "project" && memberId !== access.memberId) {
    return NextResponse.json({ ok: false, error: "PJメンバーは自分の時間だけ更新できるよ" }, { status: 403 });
  }

  const db = createAdminClient();
  const { count, error: membershipError } = await db
    .from("project_members")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("member_id", memberId)
    .eq("is_active", true);
  if (membershipError) {
    return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ ok: false, error: "このメンバーはPJに参加してないよ" }, { status: 400 });
  }

  if (managementMilestoneId) {
    const { data: milestone, error: milestoneError } = await db
      .from("project_management_milestones")
      .select("id,track")
      .eq("project_id", projectId)
      .eq("id", managementMilestoneId)
      .is("deleted_at", null)
      .maybeSingle();
    if (milestoneError) return NextResponse.json({ ok: false, error: milestoneError.message }, { status: 500 });
    if (!milestone) return NextResponse.json({ ok: false, error: "このPJのマイルストーンを選んでね" }, { status: 400 });
    const milestoneTrack = String(milestone.track);
    if (managementTrack && milestoneTrack !== managementTrack) {
      return NextResponse.json({ ok: false, error: "柱とマイルストーンの組み合わせを確認してね" }, { status: 400 });
    }
    managementTrack = milestoneTrack;
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from("project_weekly_effort_entries")
    .upsert({
      project_id: projectId,
      member_id: memberId,
      week_start: weekStart,
      work_category: category,
      planned_hours: plannedHours,
      actual_hours: actualHours,
      note,
      management_track: managementTrack,
      management_milestone_id: managementMilestoneId,
      deliverable_label: deliverableLabel,
      source_kind: "manual",
      created_by: access.memberId,
      updated_at: now,
    }, { onConflict: "project_id,member_id,week_start,work_category" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
