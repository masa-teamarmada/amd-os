// PJに紐づく「現行SPS｜産業創出価値」の凍結評価の読み取り API。
//
// 【体感速度】凍結評価は candidate → review → publish を通ってからしか動かない参照系データ。3層でキャッシュする。
//   1. サーバのプロセス内スナップショット (lib/seed-screening-bands.ts, TTL 5分)
//   2. この route の Cache-Control (ブラウザHTTPキャッシュ)
//   3. クライアントのモジュールキャッシュ (lib/current-sps-client.ts)
// `?fresh=1` で 1 を強制再読込する (再評価の publish 直後の確認用)。
import { NextResponse } from "next/server";
import { fetchCurrentSpsProjectAssessments } from "@/lib/seed-screening-bands";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 凍結評価は日単位でしか変わらないので、ブラウザには短時間の再利用 + 背面での更新を許す。 */
const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const force = new URL(req.url).searchParams.get("fresh") === "1";

  try {
    const assessments = await fetchCurrentSpsProjectAssessments([projectId], { force });
    return NextResponse.json(assessments.get(projectId), {
      headers: { "Cache-Control": force ? "no-store" : CACHE_CONTROL },
    });
  } catch (error) {
    console.error("[sps-current]", error);
    return NextResponse.json(
      { error: "現行SPSの取得に失敗" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
