// ホーム下段「会社の記録」(メンバー / 沿革 / メディア掲載 / 写真) の読み取り API。
//
// 【なぜ route 経由か】
// 元はホームの client component がブラウザから9本のクエリを直接投げていた。名簿・沿革・
// メディア掲載・写真台帳はどれも日〜週単位でしか変わらない参照系なので、3層でキャッシュする。
//   1. サーバのプロセス内スナップショット (lib/company-content.ts, TTL 5分)
//   2. この route の Cache-Control (ブラウザHTTPキャッシュ)
//   3. クライアントのモジュールキャッシュ (lib/company-content-client.ts)
// `?fresh=1` で 1 を強制再読込する (写真を取り込んだ直後の確認用)。
//
// 規範: pwa/spec/5-10-reference-data-caching-current-spec.md
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { companyContentCacheAgeMs, getCompanyContentPreview } from "@/lib/company-content";

export const runtime = "nodejs";

/** 会社の記録は日単位でしか変わらないので、ブラウザには短時間の再利用 + 背面での更新を許す。 */
const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";

export async function GET(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  // service client を使う前に portfolio scope を確定する。
  // PJ限定の外部メンバーへ社内の名簿・沿革・写真台帳を返してはいけない。
  const access = await getCurrentMemberAccess();
  if (!access || access.scope !== "portfolio") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const force = new URL(req.url).searchParams.get("fresh") === "1";

  try {
    const content = await getCompanyContentPreview(createAdminClient(), { force });
    return NextResponse.json(
      { ok: true, content },
      {
        headers: {
          "Cache-Control": force ? "no-store" : CACHE_CONTROL,
          "x-company-content-cache-age-ms": String(companyContentCacheAgeMs() ?? -1),
        },
      },
    );
  } catch (cause) {
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "company content lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
