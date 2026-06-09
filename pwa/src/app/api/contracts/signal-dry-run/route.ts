import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { extractContractL2Data } from "@/lib/contracts-extraction";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 90) || 90));
  const limit = Math.max(10, Math.min(500, Number(url.searchParams.get("limit") || 160) || 160));
  const projectId = url.searchParams.get("project_id")?.trim() || "";
  const admin = createAdminClient();

  try {
    const result = await extractContractL2Data(admin, { days, limit, projectId, dryRun: true });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    }, { status: 500 });
  }
}
