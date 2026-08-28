/**
 * PJコックピット「PJ概要」タブのシーズン予算・消化状況。
 *
 * まさ依頼 2026-08-28:「各PJのそのシーズンの予算配分をちゃんとPJコックピットに書いておくといい。
 * 予算を棒グラフで示して、ここまで消化している、ここは未消化、ってのが視覚的にも分かるように」。
 *
 * 計算は `/admin/season-pl` (シーズン予実表) と同じ `computeSeasonPl` を使う。
 * 同じ数字を2か所で別々に出さない。設計正本: pwa/design/season_budget_actual.md
 *
 * メンバー別の内訳 (誰にいくら払ったか) は admin にだけ返す。
 * PJメンバーはシーズン全体の予算と消化だけを見る。
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { computeForPlanCycle, loadPlanCycles } from "@/app/api/admin/season-pl/route";
import type { SeasonPl } from "@/lib/season-pl";

export const runtime = "nodejs";

/** 参照系。日次の報酬キャッシュ更新が主な変化なので、プロセス内で少し持つ。 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { storedAt: number; value: SeasonPlPayload }>();

export type SeasonBudgetSeason = Omit<SeasonPl, "members"> & {
  /** admin だけ中身が入る。PJメンバーには空配列で返す */
  members: SeasonPl["members"];
  /** members に中身があるか (admin かどうか) */
  membersVisible: boolean;
};

export type SeasonPlPayload = {
  ok: true;
  projectId: string;
  seasons: SeasonBudgetSeason[];
};

function nowMs(): number {
  return new Date().getTime();
}

export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const db = createAdminClient();

  const { data: memberRow } = await db
    .from("members")
    .select("is_admin")
    .ilike("email", auth.user.email)
    .maybeSingle();
  const isAdmin = Boolean((memberRow as { is_admin?: boolean } | null)?.is_admin);

  const cacheKey = `${projectId}:${isAdmin ? "admin" : "member"}`;
  const cached = cache.get(cacheKey);
  if (cached && nowMs() - cached.storedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.value, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=240" },
    });
  }

  try {
    const planCycles = (await loadPlanCycles(db, null)).filter((plan) => plan.project_id === projectId);
    const seasons: SeasonBudgetSeason[] = [];
    for (const planCycle of planCycles) {
      const detail = await computeForPlanCycle(db, planCycle);
      if (!detail) continue;
      seasons.push({
        ...detail,
        members: isAdmin ? detail.members : [],
        membersVisible: isAdmin,
      });
    }
    // 新しいシーズンを先頭に
    seasons.sort((a, b) => b.periodStartYm.localeCompare(a.periodStartYm));

    const payload: SeasonPlPayload = { ok: true, projectId, seasons };
    cache.set(cacheKey, { storedAt: nowMs(), value: payload });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=240" },
    });
  } catch (err) {
    console.error("[project season-budget GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "シーズン予算の取得に失敗" },
      { status: 500 },
    );
  }
}
