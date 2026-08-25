import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncMemberPayoutSettlements } from "@/lib/finance/member-payout-settlements";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * AMD → メンバーの業務委託費の実支払を freee の出金から取り込む。
 * クライアント入金側の `/api/cron/freee-payment-sync` と対になる出金側。
 *
 * `dryRun=1` は書き込まずに突合結果だけ返す。
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return bearer === secret || req.nextUrl.searchParams.get("secret") === secret;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultWindow(months: number): { start: string; end: string } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
  return { start: isoDate(start), end: isoDate(end) };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1";
  const months = Math.min(24, Math.max(1, Number(params.get("months") ?? 13) || 13));
  const window = defaultWindow(months);
  const startDate = params.get("from") || window.start;
  const endDate = params.get("to") || window.end;

  try {
    const db = createAdminClient();
    const result = await syncMemberPayoutSettlements(db, { startDate, endDate, dryRun });

    return NextResponse.json({
      ok: true,
      dryRun,
      window: result.window,
      dealCount: result.dealCount,
      walletTxnCount: result.walletTxnCount,
      outflowCount: result.outflowCount,
      matchedCount: result.settlements.length,
      highConfidenceCount: result.settlements.filter((row) => row.confidence === "high").length,
      learnedAliases: result.learnedAliases.map((alias) => ({ alias: alias.alias, memberId: alias.memberId })),
      persisted: result.persisted,
      settlements: result.settlements,
    });
  } catch (err) {
    console.error("[freee-member-payout-sync]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
