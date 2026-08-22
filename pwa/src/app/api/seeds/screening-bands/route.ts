// 一次選別スクリーニング帯 (Tier 0) の読み取り API。
// seed_screening_bands は RLS ポリシーが無い service_role 専用テーブルのため、
// クライアントコンポーネント (CockpitKuteSeeds / SeedDetailModal / KuteSeedDetailModal) はこの route 経由で読む。
// 設計正本: pwa/design/seeds.md「seed_screening_bands」節 / bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md §6 確定13
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import { fetchSeedScreeningBandDetail, fetchSeedScreeningBandSummaries } from "@/lib/seed-screening-bands";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const seedId = searchParams.get("seedId");

  try {
    if (seedId) {
      const band = await fetchSeedScreeningBandDetail(seedId);
      return NextResponse.json({ ok: true, band });
    }
    const summaries = await fetchSeedScreeningBandSummaries();
    return NextResponse.json({ ok: true, bands: Array.from(summaries.values()) });
  } catch (cause) {
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "screening band lookup failed" },
      { status: 500 },
    );
  }
}
