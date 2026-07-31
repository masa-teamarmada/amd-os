/**
 * POST /api/report/fix
 * 月次報告書を確定（FIX）する。
 * body: { projectId, ym, force? }
 * draft_content → final_content にコピーし、statusをfixedに。
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateInternalMonthlyReport } from "@/lib/monthly-report-quality";
import { requireAdmin } from "@/lib/supabase/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );

  try {
    const { projectId, ym, force = false } = await req.json();
    if (!projectId || !ym) {
      return NextResponse.json({ error: "projectId and ym required" }, { status: 400 });
    }

    // 既存レポート取得
    const { data: report, error: fetchErr } = await supabase
      .from("monthly_reports")
      .select("report_id, draft_content, final_content, status")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (!report.draft_content) {
      return NextResponse.json({ error: "No draft content to fix" }, { status: 400 });
    }

    // 確定版の置き換えは、紙面上での明示操作だけに限定する。
    // 手動の下書き保存が final_content を暗黙に上書きしないための境界。
    if (report.final_content && !force) {
      return NextResponse.json(
        { error: "確定済みの社内版を置き換えるには force: true が必要です" },
        { status: 409 }
      );
    }

    const validation = validateInternalMonthlyReport(report.draft_content);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.errors.join("\n"), errors: validation.errors },
        { status: 422 }
      );
    }

    // FIX: draft → final
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("monthly_reports")
      .update({
        draft_content: validation.normalized,
        final_content: validation.normalized,
        status: "fixed",
        fixed_at: now,
      })
      .eq("project_id", projectId)
      .eq("ym", ym);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // billing_cycles にも report_fixed_at を更新
    await supabase
      .from("billing_cycles")
      .update({ report_fixed_at: now })
      .eq("project_id", projectId)
      .eq("ym", ym);

    return NextResponse.json({
      success: true,
      fixedAt: now,
    });
  } catch (err) {
    console.error("Report fix error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
