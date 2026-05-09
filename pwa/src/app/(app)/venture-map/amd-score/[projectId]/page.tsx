import { notFound } from "next/navigation";
import { AmdScoreView } from "@/components/venture-map/AmdScoreView";
import { fetchActiveAlpha, fetchAmdScoreInputs } from "@/lib/amd-score-data";
import { fetchVentureById, fetchXrlLog } from "@/lib/venture-map-data";
import { fetchAtlasMacroSignals } from "@/lib/atlas-macro-signals";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function AmdScorePjPage({ params }: Props) {
  const { projectId } = await params;
  const [venture, inputs, { alpha }, xrlLog, atlasMacroSignals] = await Promise.all([
    fetchVentureById(projectId),
    fetchAmdScoreInputs(projectId),
    fetchActiveAlpha(),
    fetchXrlLog(projectId),
    fetchAtlasMacroSignals(5),
  ]);
  if (!venture) notFound();
  // 最新の XRL 観測 (source_note があればフォールバック根拠として使う)
  const latestXrlLog = xrlLog.length > 0 ? xrlLog[xrlLog.length - 1] : null;
  return (
    <AmdScoreView
      venture={venture}
      inputs={inputs}
      initialAlpha={alpha}
      latestXrlLog={latestXrlLog}
      atlasMacroSignals={atlasMacroSignals}
    />
  );
}
