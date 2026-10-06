import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { loadPortfolioPulse } from "@/lib/portfolio-pulse-server";

export const runtime = "nodejs";

/**
 * /dashboard ホームの研究ポートフォリオ優先キュー用データ。
 *
 * migration 213 で anon/default browser client の institutions/seeds 系 read が閉じたため、
 * server-side の service client (createAdminClient) 経由でだけ取得する。ECR (institutions)
 * とシーズは Promise.allSettled で障害分離し、片方が失敗してももう片方は返す。
 */
export async function GET(request: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  // service client を使う前に必ず portfolio scope を確定する。
  // project scope の外部メンバーは所属PJだけを見られる設計なので、
  // 研究機関・全シーズの横断母集団を返してはいけない。
  const access = await getCurrentMemberAccess();
  if (!access || access.scope !== "portfolio") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const payload = await loadPortfolioPulse({ fresh, db: createAdminClient() });
  // Authenticate every network request, including cache hits. Browser/module reuse is limited to 60s.
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
