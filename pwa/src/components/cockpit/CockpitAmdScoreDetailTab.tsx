"use client";

import { useEffect, useState } from "react";
import { AmdScoreView } from "@/components/venture-map/AmdScoreView";
import type { AlphaWeights } from "@/lib/amd-score";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";
import type { AtlasMacroSignals } from "@/lib/atlas-macro-signals";
import type { TripleHelixComputed } from "@/lib/triple-helix-observations";
import type { VentureRow, XrlLogRow } from "@/lib/venture-map-data";

interface AmdScoreDetailPayload {
  venture: VentureRow;
  inputs: AmdScoreInputRow[];
  initialAlpha: AlphaWeights;
  latestXrlLog: XrlLogRow | null;
  atlasMacroSignals: AtlasMacroSignals | null;
  tripleHelix: TripleHelixComputed | null;
}

type LoadState =
  | { status: "loading"; projectId: string; payload?: null; error?: null }
  | { status: "ready"; projectId: string; payload: AmdScoreDetailPayload; error?: null }
  | { status: "error"; projectId: string; payload?: null; error: string };

export function CockpitAmdScoreDetailTab({ projectId }: { projectId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading", projectId });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/project/${encodeURIComponent(projectId)}/amd-score-detail`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || "AMD Score 詳細の取得に失敗");
        }
        setState({ status: "ready", projectId, payload: json as AmdScoreDetailPayload });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({
          status: "error",
          projectId,
          error: err instanceof Error ? err.message : "AMD Score 詳細の取得に失敗",
        });
      });

    return () => controller.abort();
  }, [projectId]);

  if (state.projectId !== projectId || state.status === "loading") {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-xl border border-[#e5e5e7] bg-white text-[12px] text-muted-foreground">
        スコア詳細を読み込み中…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
        {state.error}
      </div>
    );
  }

  return (
    <AmdScoreView
      venture={state.payload.venture}
      inputs={state.payload.inputs}
      initialAlpha={state.payload.initialAlpha}
      latestXrlLog={state.payload.latestXrlLog}
      atlasMacroSignals={state.payload.atlasMacroSignals}
      tripleHelix={state.payload.tripleHelix}
      embedded
    />
  );
}
