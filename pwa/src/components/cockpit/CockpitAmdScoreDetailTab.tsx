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
  | { status: "ready"; projectId: string; payload: AmdScoreDetailPayload; fetchedAt: number; error?: null }
  | { status: "error"; projectId: string; payload?: null; error: string };

const SCORE_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

const scoreDetailCache = new Map<string, { payload: AmdScoreDetailPayload; fetchedAt: number }>();
const scoreDetailRequests = new Map<string, Promise<{ payload: AmdScoreDetailPayload; fetchedAt: number }>>();

function getFreshScoreDetail(projectId: string) {
  const cached = scoreDetailCache.get(projectId);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > SCORE_DETAIL_CACHE_TTL_MS) return null;
  return cached;
}

function fetchScoreDetail(projectId: string, options?: { force?: boolean }) {
  const fresh = options?.force ? null : getFreshScoreDetail(projectId);
  if (fresh) return Promise.resolve(fresh);

  const existing = scoreDetailRequests.get(projectId);
  if (existing) return existing;

  const request = fetch(`/api/project/${encodeURIComponent(projectId)}/amd-score-detail`)
    .then(async (res) => {
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "AMD Score 詳細の取得に失敗");
      }
      const entry = { payload: json as AmdScoreDetailPayload, fetchedAt: Date.now() };
      scoreDetailCache.set(projectId, entry);
      return entry;
    })
    .finally(() => {
      scoreDetailRequests.delete(projectId);
    });

  scoreDetailRequests.set(projectId, request);
  return request;
}

export function CockpitAmdScoreDetailTab({
  projectId,
  active = true,
}: {
  projectId: string;
  active?: boolean;
}) {
  const [state, setState] = useState<LoadState>(() => {
    const cached = getFreshScoreDetail(projectId);
    return cached
      ? { status: "ready", projectId, payload: cached.payload, fetchedAt: cached.fetchedAt }
      : { status: "loading", projectId };
  });

  useEffect(() => {
    let cancelled = false;

    fetchScoreDetail(projectId)
      .then((entry) => {
        if (cancelled) return;
        setState({ status: "ready", projectId, payload: entry.payload, fetchedAt: entry.fetchedAt });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          projectId,
          error: err instanceof Error ? err.message : "AMD Score 詳細の取得に失敗",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!active || state.projectId !== projectId || state.status !== "ready") return;
    if (Date.now() - state.fetchedAt <= SCORE_DETAIL_CACHE_TTL_MS) return;

    let cancelled = false;
    fetchScoreDetail(projectId, { force: true })
      .then((entry) => {
        if (cancelled) return;
        setState({ status: "ready", projectId, payload: entry.payload, fetchedAt: entry.fetchedAt });
      })
      .catch(() => {
        // Keep the last visible score detail if background refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [active, projectId, state]);

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
