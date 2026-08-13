import { NextResponse } from "next/server";
import { fetchBzm22PilotProject } from "@/lib/bzm-2-2-pilot-ui.server";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
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

  const view = new URL(req.url).searchParams.get("view");
  const responsePilot = view === "summary"
    ? {
        projectId: pilot.projectId,
        projectName: pilot.projectName,
        modelVersion: pilot.modelVersion,
        valuationDate: pilot.valuationDate,
        claimBoundary: pilot.claimBoundary,
        summary: pilot.summary,
      }
    : pilot;

  return NextResponse.json(
    { pilot: responsePilot },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
