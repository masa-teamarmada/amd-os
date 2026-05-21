/**
 * GET /api/cron/management-score-raw-data
 *
 * AMD Management Score の算出に必要な raw signals を月次で取り込む。
 * - OS 内部データ: member_activities / billing / PJ継続 / pipeline / direction signals
 * - freee 実績: ?includeFreee=1 のとき trial_pl を company_actual_monthly + raw_signals に保存
 *
 * 認証: Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectManagementScoreRawData } from "@/lib/management-score/raw-data";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const params = req.nextUrl.searchParams;
    const result = await collectManagementScoreRawData(createAdminClient(), {
      ym: params.get("ym") || undefined,
      includeFreee: params.get("includeFreee") === "1" || params.get("includeFreee") === "true",
      freeeStartDate: params.get("startDate") || undefined,
      freeeEndDate: params.get("endDate") || undefined,
    });
    return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
  } catch (error) {
    console.error("[cron/management-score-raw-data]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
