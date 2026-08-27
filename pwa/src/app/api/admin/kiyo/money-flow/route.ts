// きよ「00 お金の流れ」タブの集計 API。manual/6-11-kiyo-money-flow-spec.md が正本。
// 権限は admin 専用 (役員報酬を含むため member へ露出しない)。
// 更新は日単位の可変系データだが、サーバのプロセス内スナップショットを TTL 5分で持つ
// (pwa/spec/5-10-reference-data-caching-current-spec.md)。`?fresh=1` で強制再読込する。
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { getKiyoMoneyFlow } from "@/lib/finance/kiyo-money-flow";
import type { KiyoMoneyFlowPeriodKind } from "@/lib/finance/kiyo-money-flow-types";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";
const PERIODS: KiyoMoneyFlowPeriodKind[] = ["month", "season", "all"];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const periodParam = searchParams.get("period");
  const period: KiyoMoneyFlowPeriodKind = PERIODS.includes(periodParam as KiyoMoneyFlowPeriodKind)
    ? (periodParam as KiyoMoneyFlowPeriodKind)
    : "season";
  const ymParam = searchParams.get("ym");
  const requestedYm = ymParam && /^\d{6}$/.test(ymParam) ? ymParam : null;
  const force = searchParams.get("fresh") === "1";

  try {
    const result = await getKiyoMoneyFlow(period, requestedYm, force);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": force ? "no-store" : CACHE_CONTROL } },
    );
  } catch (cause) {
    console.error("[admin kiyo money-flow GET]", cause);
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "money flow lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
