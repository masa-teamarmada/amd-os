import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { saveMonthlyReportPdf } from "@/lib/monthly-report-pdf";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Retry only the PDF placement; never rewrites the report body or adds an edit-history row. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const input = await request.json().catch(() => ({}));
  if (!input.projectId || !/^\d{6}$/.test(input.ym) || !["internal", "external"].includes(input.kind) || typeof input.expectedContent !== "string") return NextResponse.json({ error: "invalid report" }, { status: 400 });
  const result = await saveMonthlyReportPdf(request, { projectId: input.projectId, ym: input.ym, kind: input.kind, version: input.version === "draft" ? "draft" : "final", expectedContent: input.expectedContent });
  return NextResponse.json(result, { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}
