// `/admin/cash`「現金と融資」の読み取り。正本は pwa/manual/6-12-cash-and-loans-spec.md。
// 口座残高と借入は役員報酬の振込額まで読めるので admin 専用。
// きよが手で更新する参照系なので、spec 5-10 のとおり 3 層キャッシュを通す。
// 画面は必ず src/lib/finance/cash-and-loans-client.ts 経由で読む。
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { getCashAndLoans } from "@/lib/finance/cash-and-loans";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const force = new URL(req.url).searchParams.get("fresh") === "1";
  try {
    const data = await getCashAndLoans(force);
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": force ? "no-store" : CACHE_CONTROL } },
    );
  } catch (cause) {
    console.error("[admin cash GET]", cause);
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "cash lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
