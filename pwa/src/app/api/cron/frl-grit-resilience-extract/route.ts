import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** FRLを旧スコア入力へ書く経路は廃止。観測データの候補化は現行SPS再評価と分離する。 */
export async function GET() {
  return NextResponse.json({ ok: false, retired: true, error: "旧スコアwriterは廃止済み" }, { status: 410 });
}
