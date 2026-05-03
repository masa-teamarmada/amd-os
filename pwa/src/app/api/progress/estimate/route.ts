/**
 * POST /api/progress/estimate
 * LLMでMSごとの進捗%を推定し、milestone_monthly_progress に書き込む。
 * GAS R060_RewardV2_Estimator.gs の cron_progressEstimateDaily_ の PWA移植版。
 *
 * body: { projectId, ym }
 */

import { NextResponse } from "next/server";
import { estimateProgress } from "@/lib/progress-estimator";
import { requireAdmin } from "@/lib/supabase/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  try {
    const { projectId, ym } = await req.json();
    if (!projectId || !ym) {
      return NextResponse.json(
        { error: "projectId and ym required" },
        { status: 400 }
      );
    }

    const result = await estimateProgress(projectId, ym);

    return NextResponse.json({
      success: result.ok,
      saved: result.saved,
      total: result.total,
      skipped: result.skipped,
      message: result.message,
      diagnostics: result.diagnostics,
      details: result.details,
    });
  } catch (err) {
    console.error("Progress estimate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
