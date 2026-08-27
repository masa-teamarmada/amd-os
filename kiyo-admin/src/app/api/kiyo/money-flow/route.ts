/**
 * 「お金の流れ」— AMD OS 本体の集計結果をそのまま渡すだけの中継。
 *
 * 集計しているのは本体の /api/admin/kiyo/money-flow。
 * ここでは足し算ひとつしない。返ってきた JSON をそのまま画面へ渡す。
 * 仕様正本: pwa/manual/6-11-kiyo-money-flow-spec.md
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { callAmdOs } from "@/lib/amd-os";

export const runtime = "nodejs";

const PERIODS = new Set(["month", "season", "all"]);

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const periodParam = req.nextUrl.searchParams.get("period") ?? "season";
  const period = PERIODS.has(periodParam) ? periodParam : "season";
  const fresh = req.nextUrl.searchParams.get("fresh") === "1" ? "&fresh=1" : "";

  const result = await callAmdOs(`/api/admin/kiyo/money-flow?period=${period}${fresh}`);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
