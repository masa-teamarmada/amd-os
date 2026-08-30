// BZM 3.0 — 入力を1つずつ振ったときの産業創出価値の曲線の読み取り API。
// 画面は `/seeds/sensitivity`（入力を動かして見る）。
//
// 計算は `model/tools/bzm30_sensitivity.cjs` が先に済ませて `seed_bzm30_sensitivity` へ書く。
// **この route は読むだけ。前向き計算をリクエストの中で走らせない**（model/README.md (g)）。
//
// 【体感速度】3層でキャッシュする（規範: pwa/spec/5-10-reference-data-caching-current-spec.md）
//   1. サーバのプロセス内スナップショット（lib/bzm30/sensitivity.ts、TTL 5分）
//   2. この route の Cache-Control
//   3. クライアントのモジュールキャッシュ（lib/bzm30-sensitivity-client.ts）
// `?fresh=1` で 1 を強制再読込する（曲線の算出バッチの直後の確認用）。
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import { fetchBzm30SensitivityDetail, fetchBzm30SensitivityOverview } from "@/lib/bzm30/sensitivity";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";

export async function GET(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const seedId = searchParams.get("seedId");
  const force = searchParams.get("fresh") === "1";

  try {
    const body = seedId
      ? { ok: true as const, detail: await fetchBzm30SensitivityDetail(seedId, { force }) }
      : { ok: true as const, overview: await fetchBzm30SensitivityOverview({ force }) };
    return NextResponse.json(body, {
      headers: { "Cache-Control": force ? "no-store" : CACHE_CONTROL },
    });
  } catch (cause) {
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "bzm30 sensitivity lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
