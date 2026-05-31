import { NextResponse } from "next/server";
import { fetchActiveAlpha, fetchAmdScoreInputs } from "@/lib/amd-score-data";
import { fetchAtlasMacroSignals } from "@/lib/atlas-macro-signals";
import { createClient } from "@/lib/supabase/server";
import { fetchTripleHelixComputed } from "@/lib/triple-helix-observations";
import { fetchVentureById, fetchXrlLog } from "@/lib/venture-map-data";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [venture, inputs, activeAlpha, xrlLog, atlasMacroSignals] = await Promise.all([
    fetchVentureById(projectId),
    fetchAmdScoreInputs(projectId),
    fetchActiveAlpha(),
    fetchXrlLog(projectId),
    fetchAtlasMacroSignals(5).catch(() => null),
  ]);

  if (!venture) {
    return NextResponse.json({ error: "AMD Score 対象の PJ ではありません" }, { status: 404 });
  }

  const latestXrlLog = xrlLog.length > 0 ? xrlLog[xrlLog.length - 1] : null;
  const tripleHelix = venture.lane
    ? await fetchTripleHelixComputed(venture.lane).catch(() => null)
    : null;

  return NextResponse.json({
    venture,
    inputs,
    initialAlpha: activeAlpha.alpha,
    latestXrlLog,
    atlasMacroSignals,
    tripleHelix,
  }, {
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
    },
  });
}
