/**
 * /api/project/monthly-report-print
 *
 * GET ?projectId=&ym= → クライアント提出用月次レポートの集約データ
 *
 * 印刷ページ /project/[projectId]/report/[ym]/print が呼ぶ。
 * Cockpit 月次モーダルが表示している以下の情報を一括で返す:
 *  - project (project_name / client_name)
 *  - report (monthly_reports.final_content || draft_content + status)
 *  - milestones (value_milestones + milestone_monthly_progress 当月%)
 *  - meetings (project_meeting_summaries 当月分 narrative_md / decided / next_actions)
 *  - signals (project_strategy_signals confirmed の当月分)
 *  - members (project_members + members.code_name)
 *  - monthlyNote (project_monthly_notes.body)
 *
 * 列名は design/db_schema.md 準拠 (想像で書かない)。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

interface MsRow {
  milestoneId: string;
  title: string;
  points: number;
  tag: string;
  progressPct: number;
  note: string | null;
}

interface MeetingRow {
  meetingId: string;
  meetingDate: string;
  title: string;
  summaryShort: string;
  narrativeMd: string | null;
  decided: unknown[];
  nextActions: unknown[];
  risks: unknown[];
  notionUrl: string | null;
}

interface SignalRow {
  signalId: string;
  signalType: string;
  title: string;
  summary: string;
  impactLevel: string;
  decisionState: string;
  signalDate: string | null;
}

interface MemberRow {
  memberId: string;
  codeName: string;
  roleLabel: string | null;
  isPm: boolean;
  isPl: boolean;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const ym = searchParams.get("ym");
  if (!projectId || !/^\d{6}$/.test(ym ?? "")) {
    return NextResponse.json({ error: "projectId and ym (YYYYMM) required" }, { status: 400 });
  }

  const db = auth.supabase;

  const [projRes, repRes, milestoneRes, meetingRes, signalRes, pmRes, noteRes] = await Promise.all([
    db
      .from("projects")
      .select("project_id,project_name,client_name,status,start_ym,end_ym")
      .eq("project_id", projectId)
      .maybeSingle(),
    db
      .from("monthly_reports")
      .select("draft_content,final_content,status,generated_at,fixed_at,confirmed_by")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle(),
    db
      .from("value_milestones")
      .select("milestone_id,plan_cycle_id,title,points,tag,is_active")
      .eq("is_active", true),
    db
      .from("project_meeting_summaries")
      .select("meeting_id,meeting_date,title,summary_short,narrative_md,decided,next_actions,risks,notion_url")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .order("meeting_date", { ascending: true }),
    db
      .from("project_strategy_signals")
      .select("signal_id,signal_type,title,summary,impact_level,decision_state,signal_date,status")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .in("status", ["confirmed"])
      .order("signal_date", { ascending: false }),
    db
      .from("project_members")
      .select("member_id,role_label,is_pm,is_pl,is_active")
      .eq("project_id", projectId)
      .eq("is_active", true),
    db
      .from("project_monthly_notes")
      .select("body,updated_at,updated_by")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle(),
  ]);

  if (projRes.error || !projRes.data) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  // MS を当該 PJ の plan_cycle に絞る
  const planCycleRes = await db
    .from("value_plan_cycles")
    .select("plan_cycle_id,status,period_start_ym,period_end_ym,total_points,budget_yen")
    .eq("project_id", projectId)
    .order("period_start_ym", { ascending: false });

  const planCycleIds = new Set((planCycleRes.data || []).map((c) => c.plan_cycle_id));
  const projectMilestones = (milestoneRes.data || []).filter((m) => planCycleIds.has(m.plan_cycle_id));
  const milestoneIds = projectMilestones.map((m) => m.milestone_id);

  // 当月 milestone_monthly_progress
  const progressRes = milestoneIds.length
    ? await db
        .from("milestone_monthly_progress")
        .select("milestone_key,progress_pct,consumed_pt,source,note")
        .in("milestone_key", milestoneIds)
        .eq("ym", ym)
    : { data: [] as Array<{ milestone_key: string; progress_pct: number; consumed_pt: number; source: string | null; note: string | null }> };
  const progressMap = new Map(
    (progressRes.data || []).map((p) => [p.milestone_key, p])
  );

  const milestones: MsRow[] = projectMilestones.map((m) => {
    const p = progressMap.get(m.milestone_id);
    return {
      milestoneId: m.milestone_id,
      title: m.title,
      points: Number(m.points || 0),
      tag: m.tag || "normal",
      progressPct: Math.round(Number(p?.progress_pct || 0)),
      note: p?.note || null,
    };
  });

  // メンバー名解決
  const memberIds = (pmRes.data || []).map((r) => r.member_id);
  const memberNameRes = memberIds.length
    ? await db.from("members").select("member_id,code_name").in("member_id", memberIds)
    : { data: [] as Array<{ member_id: string; code_name: string }> };
  const memberNameMap = new Map((memberNameRes.data || []).map((m) => [m.member_id, m.code_name]));

  const members: MemberRow[] = (pmRes.data || []).map((pm) => ({
    memberId: pm.member_id,
    codeName: memberNameMap.get(pm.member_id) || pm.member_id,
    roleLabel: pm.role_label || null,
    isPm: !!pm.is_pm,
    isPl: !!pm.is_pl,
  }));

  const meetings: MeetingRow[] = (meetingRes.data || []).map((m) => ({
    meetingId: m.meeting_id,
    meetingDate: m.meeting_date,
    title: m.title,
    summaryShort: m.summary_short || "",
    narrativeMd: m.narrative_md || null,
    decided: Array.isArray(m.decided) ? m.decided : [],
    nextActions: Array.isArray(m.next_actions) ? m.next_actions : [],
    risks: Array.isArray(m.risks) ? m.risks : [],
    notionUrl: m.notion_url || null,
  }));

  const signals: SignalRow[] = (signalRes.data || []).map((s) => ({
    signalId: s.signal_id,
    signalType: s.signal_type,
    title: s.title,
    summary: s.summary,
    impactLevel: s.impact_level,
    decisionState: s.decision_state,
    signalDate: s.signal_date,
  }));

  const overallPct = (() => {
    const counted = milestones.filter((m) => (m.tag || "").toLowerCase() !== "buffer");
    const totalPt = counted.reduce((s, m) => s + m.points, 0);
    if (totalPt <= 0) return 0;
    const weighted = counted.reduce((s, m) => s + m.progressPct * m.points, 0) / totalPt;
    return Math.round(weighted);
  })();

  return NextResponse.json({
    ok: true,
    project: {
      projectId: projRes.data.project_id,
      projectName: projRes.data.project_name,
      clientName: projRes.data.client_name || null,
      status: projRes.data.status,
      startYm: projRes.data.start_ym || null,
      endYm: projRes.data.end_ym || null,
    },
    ym,
    report: repRes.data
      ? {
          status: repRes.data.status || "pending",
          draftContent: repRes.data.draft_content || "",
          finalContent: repRes.data.final_content || "",
          generatedAt: repRes.data.generated_at,
          fixedAt: repRes.data.fixed_at,
          confirmedBy: repRes.data.confirmed_by || null,
        }
      : null,
    milestones,
    overallPct,
    meetings,
    signals,
    members,
    monthlyNote: noteRes.data?.body || "",
  });
}
