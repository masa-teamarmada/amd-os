import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// AMD全体の累計資金調達額 + 累計助成金額 (営業アピール用ダッシュボード数字) と PJ別内訳。
// project_valuation_rounds は admin-RLS なので service_role で集計。返すのは PJ別の「合計額」までで、
// cap table の持株比率・投資家別内訳は返さない (機密保持)。read はログイン済みメンバーに開放。
// 設計: pwa/design/governance_action_items.md

const SECURED = ["adopted", "active", "completed"];

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const db = createAdminClient();
  const [roundsRes, grantsRes, projectsRes] = await Promise.all([
    db.from("project_valuation_rounds").select("project_id, raised_yen"),
    db.from("project_grants").select("project_id, amount_yen, status"),
    db.from("projects").select("project_id, project_name"),
  ]);

  if (roundsRes.error || grantsRes.error || projectsRes.error) {
    return NextResponse.json({ ok: false, error: roundsRes.error?.message || grantsRes.error?.message || projectsRes.error?.message }, { status: 500 });
  }

  const nameOf: Record<string, string> = {};
  (projectsRes.data ?? []).forEach((p) => { nameOf[p.project_id as string] = (p.project_name as string) || (p.project_id as string); });

  // PJ別に合算
  const fundByPj: Record<string, number> = {};
  for (const r of roundsRes.data ?? []) {
    const v = Number(r.raised_yen) || 0;
    if (v > 0) fundByPj[r.project_id as string] = (fundByPj[r.project_id as string] || 0) + v;
  }
  const grantByPj: Record<string, number> = {};
  for (const g of grantsRes.data ?? []) {
    if (!SECURED.includes(g.status as string)) continue;
    const v = Number(g.amount_yen) || 0;
    if (v > 0) grantByPj[g.project_id as string] = (grantByPj[g.project_id as string] || 0) + v;
  }

  const toBreakdown = (obj: Record<string, number>) =>
    Object.entries(obj)
      .map(([projectId, amountYen]) => ({ projectId, name: nameOf[projectId] || projectId, amountYen }))
      .sort((a, b) => b.amountYen - a.amountYen);

  const fundingBreakdown = toBreakdown(fundByPj);
  const grantsBreakdown = toBreakdown(grantByPj);
  const sum = (arr: { amountYen: number }[]) => arr.reduce((s, x) => s + x.amountYen, 0);

  return NextResponse.json({
    ok: true,
    funding: {
      totalRaisedYen: sum(fundingBreakdown),
      roundCount: (roundsRes.data ?? []).length,
      fundedPjCount: fundingBreakdown.length,
      breakdown: fundingBreakdown,
    },
    grants: {
      totalSecuredYen: sum(grantsBreakdown),
      securedCount: (grantsRes.data ?? []).filter((g) => SECURED.includes(g.status as string)).length,
      grantPjCount: grantsBreakdown.length,
      breakdown: grantsBreakdown,
    },
  });
}
