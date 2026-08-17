import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { fetchErsBundle } from "@/lib/ers-data";
import { fetchAllResearchInstitutionSeeds } from "@/lib/seeds-data";
import { fetchSeedScreeningBandSummaries } from "@/lib/seed-screening-bands";

export const runtime = "nodejs";

/**
 * /dashboard ホームの研究ポートフォリオ優先キュー用データ。
 *
 * migration 213 で anon/default browser client の institutions/seeds 系 read が閉じたため、
 * server-side の service client (createAdminClient) 経由でだけ取得する。ECR (institutions)
 * とシーズは Promise.allSettled で障害分離し、片方が失敗してももう片方は返す。
 */
export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  // service client を使う前に必ず portfolio scope を確定する。
  // project scope の外部メンバーは所属PJだけを見られる設計なので、
  // 研究機関・全シーズの横断母集団を返してはいけない。
  const access = await getCurrentMemberAccess();
  if (!access || access.scope !== "portfolio") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const readClient = createAdminClient();
  const [institutionRes, seedsRes, bandsRes] = await Promise.allSettled([
    fetchErsBundle(readClient),
    fetchAllResearchInstitutionSeeds(readClient),
    fetchSeedScreeningBandSummaries(),
  ]);

  if (institutionRes.status === "rejected") {
    console.error("[portfolio-pulse] fetchErsBundle failed:", institutionRes.reason);
  }
  if (seedsRes.status === "rejected") {
    console.error("[portfolio-pulse] fetchAllResearchInstitutionSeeds failed:", seedsRes.reason);
  }

  return NextResponse.json(
    {
      ok: true,
      institutionBundle: institutionRes.status === "fulfilled" ? institutionRes.value : null,
      institutionError: institutionRes.status === "rejected",
      seeds: seedsRes.status === "fulfilled" ? seedsRes.value : null,
      seedsError: seedsRes.status === "rejected",
      screeningBands: bandsRes.status === "fulfilled" ? Array.from(bandsRes.value.values()) : null,
      screeningBandsError: bandsRes.status === "rejected",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
