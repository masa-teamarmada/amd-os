import { NextResponse } from "next/server";
import { fetchActiveAlpha, fetchAmdScoreInputs } from "@/lib/amd-score-data";
import { fetchAtlasMacroSignals } from "@/lib/atlas-macro-signals";
import { fetchBzm21PolicyModelLedger } from "@/lib/bzm-2-1-policy-model-data";
import { fetchBzm2Observatory } from "@/lib/bzm-2-observatory-data";
import { requireMember } from "@/lib/supabase/api-auth";
import { fetchSpsPrimaryModelState } from "@/lib/sps-primary-model-data";
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

  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const spsPrimary = await fetchSpsPrimaryModelState(projectId);
  const [venture, inputs, activeAlpha, xrlLog, atlasMacroSignals, bzm2, bzm21] = await Promise.all([
    fetchVentureById(projectId),
    fetchAmdScoreInputs(projectId),
    fetchActiveAlpha(),
    fetchXrlLog(projectId),
    fetchAtlasMacroSignals(5).catch(() => null),
    fetchBzm2Observatory(projectId),
    fetchBzm21PolicyModelLedger(
      projectId,
      spsPrimary.switchStatus === "active"
        ? spsPrimary.activeBzm21RevisionId
        : null,
    ),
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
    bzm2,
    bzm21,
    spsPrimary,
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
