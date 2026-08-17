import { NextResponse } from "next/server";
import { fetchCurrentSpsProjectAssessments } from "@/lib/seed-screening-bands";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  // 旧URLのブックマーク互換だけを維持。旧スコアは読まず、現行SPS DTOだけを返す。
  const assessments = await fetchCurrentSpsProjectAssessments([projectId]);
  return NextResponse.json(assessments.get(projectId), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Deprecation": "true",
      "Sunset": "Wed, 30 Sep 2026 00:00:00 GMT",
      "Link": `</api/project/${encodeURIComponent(projectId)}/sps-current>; rel=successor-version`,
    },
  });
}
