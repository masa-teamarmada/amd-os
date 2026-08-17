"use client";

import { useEffect, useState } from "react";
import { CurrentSpsAssessmentCard } from "@/components/sps/CurrentSpsAssessmentCard";
import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";
import { Bzm22ProvisionalObservatory } from "./Bzm22ProvisionalObservatory";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; assessment: CurrentSpsProjectAssessment }
  | { status: "error"; message: string };

export function CockpitAmdScoreDetailTab({ projectId, active = true }: { projectId: string; active?: boolean }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/project/${encodeURIComponent(projectId)}/sps-current`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) throw new Error(payload?.error || "現行SPSの取得に失敗");
        setState({ status: "ready", assessment: payload as CurrentSpsProjectAssessment });
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
        <CurrentSpsAssessmentCard assessment={state.assessment} />
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
