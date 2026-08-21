import { NextResponse } from "next/server";

import { fetchProjectPlanValueCheck } from "@/lib/project-plan-value";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * その PJ の月次試算表から年度別付加価値を返す。SPS の P^ind 下限が PJ 単体の何年分に
 * あたるかを画面側で割り算するための照合材料であって、P^ind の算出根拠ではない
 * (P^ind は実績限定・産業全体スコープ。詳細は src/lib/project-plan-value.ts の冒頭)。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;
  try {
    const check = await fetchProjectPlanValueCheck(projectId);
    return NextResponse.json(check, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[plan-value-check]", error);
    return NextResponse.json({ error: "事業計画の付加価値集計に失敗" }, { status: 500 });
  }
}
