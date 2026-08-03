/**
 * POST /api/report/fix
 * 月次報告書を確定（FIX）する。
 * body: { projectId, ym, force? }
 * draft_content → final_content にコピーし、statusをfixedに。
 * 本文更新 + 編集履歴 (monthly_report_edit_history) 追記は RPC
 * monthly_report_internal_save 内で1トランザクションにまとめ、confirmed_by は
 * 実行した admin の表示名を必ず残す。
 */

import { NextResponse } from "next/server";
import { validateInternalMonthlyReport } from "@/lib/monthly-report-quality";
import { changedMonthlyReportSections } from "@/lib/monthly-report-history";
import { requireAdmin } from "@/lib/supabase/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  try {
    const { projectId, ym, force = false } = await req.json();
    if (!projectId || !ym) {
      return NextResponse.json({ error: "projectId and ym required" }, { status: 400 });
    }

    const reportRes = await auth.supabase
      .from("monthly_reports")
      .select("draft_content, final_content")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle();
    if (reportRes.error) {
      return NextResponse.json({ error: reportRes.error.message }, { status: 500 });
    }
    if (!reportRes.data) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    if (!reportRes.data.draft_content) {
      return NextResponse.json({ error: "No draft content to fix" }, { status: 400 });
    }
    if (reportRes.data.final_content && !force) {
      return NextResponse.json(
        { error: "確定済みの社内版を置き換えるには force: true が必要です" },
        { status: 409 }
      );
    }

    const validation = validateInternalMonthlyReport(reportRes.data.draft_content);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.errors.join("\n"), errors: validation.errors },
        { status: 422 }
      );
    }

    const memberRes = await auth.supabase
      .from("members")
      .select("member_id, code_name, member_name")
      .eq("email", auth.user.email.toLowerCase())
      .maybeSingle();
    if (memberRes.error || !memberRes.data) {
      return NextResponse.json({ error: memberRes.error?.message || "member not found" }, { status: 500 });
    }
    const actorMemberId = memberRes.data.member_id;
    const actorLabel = memberRes.data.code_name || memberRes.data.member_name?.trim() || auth.user.email;
    const changedSections = changedMonthlyReportSections(reportRes.data.final_content, validation.normalized);

    const { data, error } = await auth.supabase.rpc("monthly_report_internal_save", {
      p_project_id: projectId,
      p_ym: ym,
      p_action: "confirm",
      p_content: validation.normalized,
      p_actor_member_id: actorMemberId,
      p_actor_kind: actorMemberId ? "member" : "system",
      p_actor_label: actorLabel,
      p_changed_sections: changedSections,
      p_source: "pwa:report-fix",
      p_force: force === true,
    }).single();

    if (error) {
      if (error.message?.includes("force")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const savedReport = data as { fixed_at: string; confirmed_by: string | null };

    // billing_cycles にも report_fixed_at を更新
    await auth.supabase
      .from("billing_cycles")
      .update({ report_fixed_at: savedReport.fixed_at })
      .eq("project_id", projectId)
      .eq("ym", ym);

    return NextResponse.json({
      success: true,
      fixedAt: savedReport.fixed_at,
      confirmedBy: savedReport.confirmed_by,
    });
  } catch (err) {
    console.error("Report fix error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
