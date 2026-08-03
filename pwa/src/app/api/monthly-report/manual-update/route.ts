/**
 * POST /api/monthly-report/manual-update
 * body: { projectId, ym, content }
 *
 * 月次報告書の draft_content を直接編集した本文で上書きする。print page (admin-only)
 * と揃え、admin-only にしている。本文保存 + 編集履歴 (monthly_report_edit_history)
 * 追記は RPC monthly_report_internal_save 内で1トランザクションにまとめる。
 */

import { NextResponse } from "next/server";
import { validateInternalMonthlyReport } from "@/lib/monthly-report-quality";
import { changedMonthlyReportSections } from "@/lib/monthly-report-history";
import { requireAdmin } from "@/lib/supabase/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { projectId?: string; ym?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid JSON" }, { status: 400 });
  }
  const { projectId, ym, content } = body;
  if (!projectId || !ym || typeof content !== "string") {
    return NextResponse.json(
      { ok: false, message: "projectId, ym, content required" },
      { status: 400 }
    );
  }
  if (!/^\d{6}$/.test(ym)) {
    return NextResponse.json({ ok: false, message: "ym must be YYYYMM" }, { status: 400 });
  }

  const validation = validateInternalMonthlyReport(content);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, message: validation.errors.join("\n"), errors: validation.errors },
      { status: 422 }
    );
  }

  const memberRes = await auth.supabase
    .from("members")
    .select("member_id, code_name, member_name")
    .eq("email", auth.user.email.toLowerCase())
    .maybeSingle();
  if (memberRes.error || !memberRes.data) {
    return NextResponse.json({ ok: false, message: memberRes.error?.message || "member not found" }, { status: 500 });
  }
  const actorMemberId = memberRes.data.member_id;
  const actorLabel = memberRes.data.code_name || memberRes.data.member_name?.trim() || auth.user.email;

  const existingRes = await auth.supabase
    .from("monthly_reports")
    .select("draft_content")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .maybeSingle();
  if (existingRes.error) {
    return NextResponse.json({ ok: false, message: existingRes.error.message }, { status: 500 });
  }
  const changedSections = changedMonthlyReportSections(existingRes.data?.draft_content, validation.normalized);

  const { data, error } = await auth.supabase.rpc("monthly_report_internal_save", {
    p_project_id: projectId,
    p_ym: ym,
    p_action: "draft_save",
    p_content: validation.normalized,
    p_actor_member_id: actorMemberId,
    p_actor_kind: actorMemberId ? "member" : "system",
    p_actor_label: actorLabel,
    p_changed_sections: changedSections,
    p_source: "pwa:manual-update",
    p_force: false,
  }).single();
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  const savedReport = data as { draft_content?: string | null } | null;

  return NextResponse.json({ ok: true, content: savedReport?.draft_content ?? validation.normalized, changedSections });
}
