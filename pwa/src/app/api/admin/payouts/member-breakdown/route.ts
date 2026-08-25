import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { loadMemberPayoutBreakdown } from "@/lib/reward-member-breakdown";

export const runtime = "nodejs";

const YM_RE = /^[0-9]{6}$/;

/**
 * `/admin/payouts` のメンバー行から開く「支払額の内訳」。
 * 保存済み報酬キャッシュを読むだけで、報酬計算はやり直さない (一覧の金額と必ず一致させるため)。
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const projectId = (req.nextUrl.searchParams.get("projectId") ?? "").trim();
  const ym = (req.nextUrl.searchParams.get("ym") ?? "").trim();
  const memberId = (req.nextUrl.searchParams.get("memberId") ?? "").trim();
  if (!projectId || !memberId || !YM_RE.test(ym)) {
    return NextResponse.json(
      { ok: false, error: "projectId / ym(YYYYMM) / memberId are required" },
      { status: 400 }
    );
  }

  try {
    const db = createAdminClient();
    const breakdown = await loadMemberPayoutBreakdown(db, { projectId, ym, memberId });
    if (!breakdown) {
      return NextResponse.json(
        { ok: false, error: "この稼働月の報酬キャッシュに該当メンバーの行がない" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, breakdown });
  } catch (err) {
    console.error("[admin payouts member-breakdown GET]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
