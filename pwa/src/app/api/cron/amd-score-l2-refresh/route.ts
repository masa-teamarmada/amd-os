import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 旧9軸/SPS writerは廃止。再評価は現行SPSのcandidate-review-publish経路だけで行う。 */
export async function GET() {
  return NextResponse.json({ ok: false, retired: true, error: "旧スコアwriterは廃止済み" }, { status: 410 });
}
