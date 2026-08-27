// シーズごとの BZM 3.0 の入力とスコアの読み取り API。
// モデル定義（式・係数・格子）はシーズに依存しないので `/api/model/bzm30` が返す。ここは案件固有の分だけ。
//
// 【体感速度】3層でキャッシュする（規範: pwa/spec/5-10-reference-data-caching-current-spec.md）
//   1. サーバのプロセス内スナップショット（lib/bzm30/seed-score.ts、TTL 5分）
//   2. この route の Cache-Control
//   3. クライアントのモジュールキャッシュ（lib/bzm30-seed-client.ts）
// `?fresh=1` で 1 を強制再読込する（算出バッチの直後の確認用）。
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import { fetchSeedBzm30, fetchSeedBzm30Summaries } from "@/lib/bzm30/seed-score";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";

export async function GET(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const seedId = searchParams.get("seedId");
  const force = searchParams.get("fresh") === "1";

  try {
    // seedId 無しは一覧向けのサマリ（全シーズの最新スコアを1回で読む）
    if (!seedId) {
      const summaries = await fetchSeedBzm30Summaries({ force });
      return NextResponse.json(
        { ok: true as const, summaries: Array.from(summaries.values()) },
        { headers: { "Cache-Control": force ? "no-store" : CACHE_CONTROL } },
      );
    }
    const dto = await fetchSeedBzm30(seedId, { force });
    return NextResponse.json(
      { ok: true as const, bzm30: dto },
      { headers: { "Cache-Control": force ? "no-store" : CACHE_CONTROL } },
    );
  } catch (cause) {
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "bzm30 seed lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
