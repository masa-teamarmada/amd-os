// 一次選別スクリーニング帯 (Tier 0) の読み取り API。
// seed_screening_bands は RLS ポリシーが無い service_role 専用テーブルのため、
// クライアントコンポーネント (CockpitKuteSeeds / SeedDetailModal / KuteSeedDetailModal) はこの route 経由で読む。
// 設計正本: pwa/design/seeds.md「seed_screening_bands」節 / bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md §6 確定13
//
// 【体感速度】帯は評価ツールからしか書かれない参照系データ。3層でキャッシュする。
//   1. サーバのプロセス内スナップショット (lib/seed-screening-bands.ts, TTL 5分)
//   2. この route の Cache-Control (ブラウザHTTPキャッシュ)
//   3. クライアントのモジュールキャッシュ (lib/seed-screening-bands-client.ts)
// `?fresh=1` で 1 を強制再読込する (評価ツール実行直後の確認用)。
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import {
  fetchSeedScreeningBandDetail,
  fetchSeedScreeningBandSummaries,
  seedScreeningBandCacheAgeMs,
} from "@/lib/seed-screening-bands";

export const runtime = "nodejs";

/** 帯は日単位でしか変わらないので、ブラウザには短時間の再利用 + 背面での更新を許す。 */
const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";

export async function GET(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const seedId = searchParams.get("seedId");
  const force = searchParams.get("fresh") === "1";

  try {
    const body = seedId
      ? { ok: true as const, band: await fetchSeedScreeningBandDetail(seedId, { force }) }
      : {
          ok: true as const,
          bands: Array.from((await fetchSeedScreeningBandSummaries(undefined, { force })).values()),
        };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": force ? "no-store" : CACHE_CONTROL,
        "x-band-cache-age-ms": String(seedScreeningBandCacheAgeMs() ?? -1),
      },
    });
  } catch (cause) {
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "screening band lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
