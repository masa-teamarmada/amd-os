import { NextResponse } from "next/server";
import { fetchCurrentSpsProjectAssessments } from "@/lib/seed-screening-bands";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  try {
    const assessments = await fetchCurrentSpsProjectAssessments([projectId]);
    return NextResponse.json(assessments.get(projectId), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[sps-current]", error);
    return NextResponse.json({ error: "現行SPSの取得に失敗" }, { status: 500 });
  }
}
