"use client";

import { useEffect, useState } from "react";
import { CurrentSpsAssessmentCard } from "@/components/sps/CurrentSpsAssessmentCard";
import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";
import { loadSeedScreeningBandDetail } from "@/lib/seed-screening-bands-client";
import type { SeedScreeningBandDetail } from "@/types/seeds";
import { Bzm22ProvisionalObservatory } from "./Bzm22ProvisionalObservatory";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; assessment: CurrentSpsProjectAssessment }
  | { status: "error"; message: string };

export function CockpitAmdScoreDetailTab({ projectId, active = true }: { projectId: string; active?: boolean }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // 判断根拠 (q帯・q要因11項目・P^ind帯・総合判断) は seed_screening_bands の詳細行にしか無い。
  // 一覧系に積むとペイロードが膨らむため、根拠を出すこの画面だけが seedId 指定で追加取得する。
  const [band, setBand] = useState<SeedScreeningBandDetail | null>(null);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    setBand(null);
    fetch(`/api/project/${encodeURIComponent(projectId)}/sps-current`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) throw new Error(payload?.error || "現行SPSの取得に失敗");
        const assessment = payload as CurrentSpsProjectAssessment;
        setState({ status: "ready", assessment });
        if (!assessment.seed_id) return;
        // 帯は参照系。キャッシュ経由で読み、タブを行き来しても取り直さない。
        const nextBand = await loadSeedScreeningBandDetail(assessment.seed_id).catch(() => null);
        // 根拠が取れなくても現行SPS本体の表示は落とさない
        if (!controller.signal.aborted) setBand(nextBand);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "現行SPSの取得に失敗" });
      });
    return () => controller.abort();
  }, [active, projectId]);

  return (
    <div className="min-w-0 space-y-3" data-density="compact-score-page">
      {state.status === "loading" ? (
        <div className="grid min-h-24 place-items-center border border-slate-200 bg-white text-[10px] text-slate-500">現行SPSを読み込み中…</div>
      ) : state.status === "error" ? (
        <div className="border border-red-200 bg-red-50 px-3 py-3 text-[10px] text-red-800">{state.message}</div>
      ) : (
        <CurrentSpsAssessmentCard assessment={state.assessment} band={band} />
      )}

      <section aria-labelledby="bzm22-separate-model-title" className="min-w-0 border-t border-slate-300 pt-3">
        <div className="mb-2 px-1">
          <h2 id="bzm22-separate-model-title" className="text-[11px] font-semibold text-slate-700">BZM 2.2 暫定パイロット（SPSとは別モデル）</h2>
          <p className="text-[8px] text-slate-500">J / P / Q / S はSPSへ合算せず、独立した検証モデルとして表示する。</p>
        </div>
        <Bzm22ProvisionalObservatory projectId={projectId} active={active} />
      </section>
    </div>
  );
}
