/**
 * GET /api/cron/management-score-refresh
 *
 * 月次試算表と Management Score を同じリクエスト内で更新する。
 * freee PL → freee 口座残高 → OS内部 raw signals → score snapshot の順序を固定し、
 * Vercel cron の遅延で raw と calculate が逆転する事故を避ける。
 *
 * 認証: Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectManagementScoreRawData } from "@/lib/management-score/raw-data";
import { calculateManagementScore } from "@/lib/management-score/calculate";

export const maxDuration = 180;

function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function authorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return (req.headers.get("authorization") || "") === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const ym = params.get("ym") || currentYmJST();
  const includeFreee = params.get("includeFreee") !== "0";
  const calculateOnPartial = params.get("calculateOnPartial") === "1";
  const admin = createAdminClient();

  try {
    const raw = await collectManagementScoreRawData(admin, {
      ym,
      includeFreee,
      freeeStartDate: params.get("startDate") || undefined,
      freeeEndDate: params.get("endDate") || undefined,
      includeFreeeCashBalances: params.get("includeCashBalances") !== "0",
      cashBalanceStartYm: params.get("cashStartYm") || undefined,
      cashBalanceEndYm: params.get("cashEndYm") || undefined,
      cashBalanceHistoryStartYm: params.get("cashHistoryStartYm") || undefined,
      refreshLiveMonthlyPlBudget: params.get("refreshLiveBudget") !== "0",
    });

    if (raw.status === "failed" || (!raw.ok && !calculateOnPartial)) {
      return NextResponse.json(
        {
          ok: false,
          ym,
          raw,
          calculated: false,
          reason: raw.status === "failed"
            ? "raw collection failed"
            : "raw collection was partial; score calculation skipped to avoid stale/partial monthly trial balance",
        },
        { status: 500 }
      );
    }

    const score = await calculateManagementScore(admin, ym);
    return NextResponse.json({
      ok: raw.ok && score.ok,
      ym,
      raw,
      score,
      calculated: true,
      calculatedAfterRawRunId: raw.runId,
    }, { status: score.ok ? 200 : 500 });
  } catch (error) {
    console.error("[cron/management-score-refresh]", error);
    return NextResponse.json(
      { ok: false, ym, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
