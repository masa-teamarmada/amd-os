import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// AMD全体の累計資金調達額 + 累計助成金額の集計 (営業アピール用ダッシュボード数字)。
// project_valuation_rounds は admin-RLS なので service_role で集計し、合計値のみ返す
// (per-PJ の cap table 内訳は返さない = 機密保持)。read はログイン済みメンバーに開放。
// 設計: pwa/design/governance_action_items.md (累計アピール数字章)

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const db = createAdminClient();
  const [roundsRes, grantsRes] = await Promise.all([
    db.from("project_valuation_rounds").select("project_id, raised_yen"),
    db.from("project_grants").select("project_id, amount_yen, status"),
  ]);

  if (roundsRes.error || grantsRes.error) {
    return NextResponse.json({ ok: false, error: roundsRes.error?.message || grantsRes.error?.message }, { status: 500 });
  }

  const rounds = roundsRes.data ?? [];
  const grants = grantsRes.data ?? [];

  // 資金調達: 全PJのラウンド調達額合計
  const totalRaisedYen = rounds.reduce((s, r) => s + (Number(r.raised_yen) || 0), 0);
  const fundedPjs = new Set(rounds.filter((r) => (Number(r.raised_yen) || 0) > 0).map((r) => r.project_id));

  // 助成金: 採択/受給中/完了のみアピール対象に集計
  const SECURED = ["adopted", "active", "completed"];
  const securedGrants = grants.filter((g) => SECURED.includes(g.status));
  const totalGrantYen = securedGrants.reduce((s, g) => s + (Number(g.amount_yen) || 0), 0);
  const grantPjs = new Set(securedGrants.map((g) => g.project_id));

  return NextResponse.json({
    ok: true,
    funding: { totalRaisedYen, roundCount: rounds.length, fundedPjCount: fundedPjs.size },
    grants: { totalSecuredYen: totalGrantYen, securedCount: securedGrants.length, grantPjCount: grantPjs.size },
  });
}
