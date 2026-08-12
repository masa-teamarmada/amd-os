import { NextResponse } from "next/server";
import { fetchBzm22PilotProject } from "@/lib/bzm-2-2-pilot-ui.server";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const pilot = await fetchBzm22PilotProject(projectId);
  if (!pilot) {
    return NextResponse.json(
      { error: "BZM 2.2 暫定試算の対象PJではありません" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { pilot },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
