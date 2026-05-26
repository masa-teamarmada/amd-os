/**
 * GET /api/cron/graduation-detection
 *
 * 卒業フェーズ検出 (= まさ #84 確定、 manual 4-6 / 39 章)。
 * 月次 cron で全 active PJ について 6 シグナルを集計、
 * readiness_score 70% 以上の PJ を project_strategy_signals に candidate insert する。
 *
 * vercel.json で「0 20 1 * *」 = 月初 1 日 05:00 JST に実行。
 * 手動再実行は ?ym=YYYYMM で対象月指定可能。
 *
 * 認証: Authorization: Bearer ${CRON_SECRET}
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runGraduationDetection } from "@/lib/graduation-detection/calculate";

export const maxDuration = 120;

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
    const result = await runGraduationDetection(createAdminClient(), ym);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/graduation-detection]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 },
    );
  }
}
