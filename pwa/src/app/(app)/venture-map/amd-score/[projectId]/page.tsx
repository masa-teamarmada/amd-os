import { redirect } from "next/navigation";
import { AmdScoreView } from "@/components/venture-map/AmdScoreView";
import { fetchActiveAlpha, fetchAmdScoreInputs } from "@/lib/amd-score-data";
import { buildAaaScoreInputsFromSx } from "@/lib/amd-score-derived";
import { AAA_PROJECT_ID, aaaVenture } from "@/lib/demo-aaa-data";
import { fetchAtlasMacroSignals } from "@/lib/atlas-macro-signals";
import { amdScoreDetailHref } from "@/lib/amd-score-routes";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function AmdScorePjPage({ params }: Props) {
  const { projectId } = await params;
  if (projectId !== AAA_PROJECT_ID) {
    redirect(amdScoreDetailHref(projectId));
  }

  const [{ alpha }, sxInputs, atlasMacroSignals] = await Promise.all([
    fetchActiveAlpha(),
    fetchAmdScoreInputs("p21"),
    fetchAtlasMacroSignals(5).catch(() => null),
  ]);
  return (
    <AmdScoreView
      venture={aaaVenture}
      inputs={buildAaaScoreInputsFromSx(sxInputs, alpha)}
      initialAlpha={alpha}
      latestXrlLog={null}
      atlasMacroSignals={atlasMacroSignals}
      tripleHelix={null}
    />
  );
}
