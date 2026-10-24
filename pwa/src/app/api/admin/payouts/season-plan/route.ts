import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { loadPayoutSeasonPlan } from "@/lib/payout-season-plan-data";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const ym = request.nextUrl.searchParams.get("ym") ?? "";
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(ym)) return NextResponse.json({ ok: false, error: "支払月を指定してください" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...await loadPayoutSeasonPlan(ym) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[payout season plan]", error instanceof Error ? error.message : "read failed");
    return NextResponse.json({ ok: false, error: "シーズン収支予定を取得できませんでした。再読込してください" }, { status: 500 });
  }
}
