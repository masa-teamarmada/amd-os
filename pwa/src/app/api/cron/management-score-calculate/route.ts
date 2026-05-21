/**
 * GET /api/cron/management-score-calculate
 *
 * amd_management_score_raw_signals から月次 score snapshot / evidence を作る。
 * 認証: Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateManagementScore } from "@/lib/management-score/calculate";

export const maxDuration = 60;

function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const ym = req.nextUrl.searchParams.get("ym") || currentYmJST();
    const result = await calculateManagementScore(createAdminClient(), ym);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/management-score-calculate]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
