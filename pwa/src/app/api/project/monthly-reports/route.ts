import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { normalizeMonthlyReportYm } from "@/lib/monthly-report-drive";

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId || projectId.length > 160) return NextResponse.json({ error: "PJの指定が不正です。" }, { status: 400 });
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const db = createAdminClient();
  const [internal, submission] = await Promise.all([
    db.from("monthly_reports").select("ym,status,generated_at,fixed_at").eq("project_id", projectId).order("ym", { ascending: false }),
    db.from("monthly_reports_external").select("ym,updated_at,generated_at").eq("project_id", projectId).order("ym", { ascending: false }),
  ]);
  if (internal.error || submission.error) return NextResponse.json({ error: "月次報告書を読み込めませんでした。" }, { status: 500 });
  const months = new Map<string, { ym: string; internalStatus: string | null; hasSubmission: boolean; updatedAt: string | null }>();
  for (const row of internal.data ?? []) {
    const ym = normalizeMonthlyReportYm(row.ym);
    if (ym && row.status !== "invalid") months.set(ym, { ym, internalStatus: row.status, hasSubmission: false, updatedAt: row.fixed_at ?? row.generated_at });
  }
  for (const row of submission.data ?? []) {
    const ym = normalizeMonthlyReportYm(row.ym);
    if (!ym) continue;
    const month = months.get(ym) ?? { ym, internalStatus: null, hasSubmission: false, updatedAt: null };
    month.hasSubmission = true;
    const updatedAt = row.updated_at ?? row.generated_at;
    if (updatedAt && (!month.updatedAt || updatedAt > month.updatedAt)) month.updatedAt = updatedAt;
    months.set(ym, month);
  }
  return NextResponse.json({ reports: [...months.values()].sort((a, b) => b.ym.localeCompare(a.ym)) }, { headers: { "Cache-Control": "private, max-age=30" } });
}
