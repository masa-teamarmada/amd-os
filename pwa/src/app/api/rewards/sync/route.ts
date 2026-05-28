import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { syncRewardSummariesForPlanCycle, syncRewardSummaryForCycle } from "@/lib/reward-summary";

export const runtime = "nodejs";

const YM_RE = /^[0-9]{6}$/;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const ym = typeof body.ym === "string" ? body.ym.trim() : "";
  const planCycleId = typeof body.planCycleId === "string" ? body.planCycleId.trim() : "";

  if (planCycleId) {
    try {
      const result = await syncRewardSummariesForPlanCycle(createAdminClient(), planCycleId);
      return NextResponse.json({
        ok: true,
        mode: "planCycle",
        projectId: result.projectId,
        yms: result.yms,
        syncedCount: result.synced.size,
      });
    } catch (err) {
      console.error("[rewards/sync planCycle]", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 }
      );
    }
  }

  if (!projectId || !YM_RE.test(ym)) {
    return NextResponse.json({ ok: false, error: "projectId and valid ym, or planCycleId, are required" }, { status: 400 });
  }

  try {
    const result = await syncRewardSummaryForCycle(createAdminClient(), projectId, ym);
    const { ok: syncOk, ...rest } = result;
    return NextResponse.json({ ok: true, syncOk, ...rest });
  } catch (err) {
    console.error("[rewards/sync]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
