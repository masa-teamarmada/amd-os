import { VentureMapView } from "@/components/venture-map/VentureMapView";
import {
  fetchVenturesForMap,
  fetchLatestLaneWeights,
  fetchMacroIndexLog,
  fetchPapersLog,
  fetchSnapshot,
} from "@/lib/venture-map-data";

export const metadata = {
  title: "Venture Map | AMD OS",
};

export const dynamic = "force-dynamic";

export default async function VentureMapPage() {
  const [ventures, laneWeights, macroLog, papersLog] = await Promise.all([
    fetchVenturesForMap(),
    fetchLatestLaneWeights(),
    fetchMacroIndexLog(),
    fetchPapersLog(),
  ]);

  const snapshot = await fetchSnapshot(macroLog, papersLog);

  const lastLearnedAt = Object.values(laneWeights)
    .map((w) => w?.computed_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Venture Map</h1>
          <p className="text-xs text-muted-foreground mt-1">
            マクロトレンドの波 × 過去SU実績の統合マップ。
            project_ventures / macro_lane_weights / macro_index_log (Atlas集計) / papers_log (OpenAlex) を統合。
            実データは 2026-01 以降。それ以前は補助モック値。シーズ候補は <a href="/seeds" className="underline hover:text-foreground">/seeds</a> を参照。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/venture-map/amd-score"
            className="text-xs px-3 py-1.5 rounded border border-purple-500/40 text-purple-700 hover:bg-purple-500/10 transition-colors font-mono"
          >
            AMD Score →
          </a>
          <a
            href="/venture-map/timeline-3d"
            className="text-xs px-3 py-1.5 rounded border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 transition-colors font-mono"
            style={{ textShadow: "0 0 6px rgba(34,211,238,0.4)" }}
          >
            Timeline 3D →
          </a>
        </div>
      </div>
      <VentureMapView
        ventures={ventures}
        laneWeights={laneWeights}
        macroLog={macroLog}
        papersLog={papersLog}
        snapshot={snapshot}
        lastLearnedAt={lastLearnedAt}
      />
    </div>
  );
}
