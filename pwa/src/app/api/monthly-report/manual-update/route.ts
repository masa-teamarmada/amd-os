/**
 * POST /api/monthly-report/manual-update
 * body: { projectId, ym, content }
 *
 * 月次報告書の draft_content をまさが直接編集した本文で上書き。
 * - service_role で書き込む (anon RLS bypass)
 * - 認証は requireAuth (admin チェックは monthly_reports の運用上 PJ メンバー全員が対象)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateInternalMonthlyReport } from "@/lib/monthly-report-quality";
import { requireAuth } from "@/lib/supabase/api-auth";

export async function POST(req: Request) {
  const auth = await requireAuth();
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );

  // 下書き保存は確定版を変えない。確定済みなら status も維持し、
  // final_content の更新は /api/report/fix の明示操作だけに限定する。
  const { data: existing, error: existingError } = await supabase
    .from("monthly_reports")
    .select("status, final_content")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ ok: false, message: existingError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("monthly_reports")
    .upsert({
      report_id: `${projectId}_${ym}`,
      project_id: projectId,
      ym,
      draft_content: validation.normalized,
      status: existing?.final_content ? existing.status : "draft",
    }, { onConflict: "project_id,ym" });
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, content: validation.normalized });
}
