"use client";

import { useEffect, useState } from "react";
import { Bzm21DynamicPolicyObservatory } from "@/components/cockpit/Bzm21DynamicPolicyObservatory";
import { Bzm2ModelObservatory } from "@/components/cockpit/Bzm2ModelObservatory";
import { AmdScoreView } from "@/components/venture-map/AmdScoreView";
import type { AlphaWeights } from "@/lib/amd-score";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";
import type { AtlasMacroSignals } from "@/lib/atlas-macro-signals";
import type { Bzm21PolicyModelLedger } from "@/lib/bzm-2-1-policy-model";
import type { Bzm2Observatory } from "@/lib/bzm-2-observatory";
import type { TripleHelixComputed } from "@/lib/triple-helix-observations";
import type { VentureRow, XrlLogRow } from "@/lib/venture-map-data";

interface AmdScoreDetailPayload {
  venture: VentureRow;
  inputs: AmdScoreInputRow[];
  initialAlpha: AlphaWeights;
  latestXrlLog: XrlLogRow | null;
  atlasMacroSignals: AtlasMacroSignals | null;
  tripleHelix: TripleHelixComputed | null;
  bzm2: Bzm2Observatory;
  bzm21: Bzm21PolicyModelLedger;
  spsPrimary: SpsPrimaryModelState;
}

interface SpsPrimaryModelState {
  storageState: "available" | "unavailable" | "not_registered";
  primaryModel: "legacy_sps" | "sps_2_1";
  switchStatus: "preparing" | "active" | "rolled_back" | "not_registered";
  activeBzm21RevisionId: string | null;
  switchedAt: string | null;
  rollbackNote: string | null;
  legacyArchive: {
    archiveId: string;
    snapshotKey: string;
    snapshotAt: string;
    sourceCutoff: string;
    sourceCounts: Record<string, number>;
    payloadHash: string;
  } | null;
}

type LoadState =
  | { status: "loading"; projectId: string; payload?: null; error?: null }
  | { status: "ready"; projectId: string; payload: AmdScoreDetailPayload; fetchedAt: number; error?: null }
  | { status: "error"; projectId: string; payload?: null; error: string };

// Primary切替を5分間古い表示に固定しない。短時間のタブ往復だけ再利用する。
const SCORE_DETAIL_CACHE_TTL_MS = 15 * 1000;

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

  const request = fetch(`/api/project/${encodeURIComponent(projectId)}/amd-score-detail`, {
    cache: "no-store",
  })
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

const UNAVAILABLE_PRIMARY: SpsPrimaryModelState = {
  storageState: "unavailable",
  primaryModel: "legacy_sps",
  switchStatus: "not_registered",
  activeBzm21RevisionId: null,
  switchedAt: null,
  rollbackNote: null,
  legacyArchive: null,
};

function formatArchiveDate(value: string | null | undefined) {
  if (!value) return "未登録";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function LegacyScoreStack({ payload }: { payload: AmdScoreDetailPayload }) {
  return (
    <div className="min-w-0 space-y-4">
      <Bzm2ModelObservatory model={payload.bzm2} />
      <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-600">
        <div className="font-semibold text-slate-800">旧・現行運用SPS（9軸）</div>
        <div>旧M・P・R・S診断。SPS 2.1の円価値、到達見込み、選択方針とは尺度を混ぜない。</div>
      </div>
      <AmdScoreView
        venture={payload.venture}
        inputs={payload.inputs}
        initialAlpha={payload.initialAlpha}
        latestXrlLog={payload.latestXrlLog}
        atlasMacroSignals={payload.atlasMacroSignals}
        tripleHelix={payload.tripleHelix}
        embedded
      />
    </div>
  );
}

function ArchiveMetadata({ primary }: { primary: SpsPrimaryModelState }) {
  const archive = primary.legacyArchive;
  if (!archive) {
    return (
      <div className="border-b border-orange-200 bg-orange-50 px-3 py-2 text-[10px] text-orange-800">
        legacy凍結スナップショットのメタデータを取得できていない。旧値を0として扱わない。
      </div>
    );
  }
  const counts = Object.entries(archive.sourceCounts).sort(([left], [right]) => left.localeCompare(right));
  return (
    <div className="border-b border-[#d8d3c9] bg-[#f4f1ea] px-3 py-2 text-[9px] leading-4 text-[#635f56]">
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1">
        <span><b>凍結版</b> {archive.snapshotKey}</span>
        <span><b>凍結時点</b> {formatArchiveDate(archive.snapshotAt)}</span>
        <span><b>情報締切</b> {formatArchiveDate(archive.sourceCutoff)}</span>
        <span><b>行数</b> {counts.length > 0 ? counts.map(([key, count]) => `${key} ${count}`).join(" / ") : "未取得"}</span>
      </div>
      <div className="mt-1 break-all font-mono text-[8px] text-[#817b70]">SHA-256 {archive.payloadHash}</div>
    </div>
  );
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

  const primary = state.payload.spsPrimary ?? UNAVAILABLE_PRIMARY;
  const sps21IsPrimary =
    primary.storageState === "available" &&
    primary.primaryModel === "sps_2_1" &&
    primary.switchStatus === "active";
  const exactRevisionLoaded =
    Boolean(primary.activeBzm21RevisionId) &&
    state.payload.bzm21.currentRevision?.revisionId === primary.activeBzm21RevisionId;

  if (!sps21IsPrimary) {
    const reason = primary.switchStatus === "preparing"
      ? "SPS 2.1は切替準備中。完了するまでは旧SPSを主表示に固定。"
      : primary.switchStatus === "rolled_back"
        ? `SPS 2.1はロールバック済み。${primary.rollbackNote ?? "理由未登録"}`
        : primary.storageState === "unavailable"
          ? "主表示レジストリを取得できないため、旧SPSへ安全にフォールバック。"
          : "SPS 2.1はまだ主表示へ登録されていない。";
    return (
      <div className="min-w-0 space-y-4">
        <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-900">
          <div className="font-semibold">現在の主表示: legacy SPS</div>
          <div>{reason}</div>
        </div>
        <LegacyScoreStack payload={state.payload} />
        <details className="min-w-0 overflow-hidden border border-amber-200 bg-white">
          <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-amber-50 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-700 sm:min-h-0 marker:content-none">
            <span className="min-w-0">
              <span className="text-[11px] font-semibold text-amber-900">SPS 2.1 切替前プレビュー</span>
              <span className="ml-2 text-[9px] text-amber-700">主値ではない。推定と欠測を確認するための表示。</span>
            </span>
            <span className="text-[9px] text-amber-700">開く ›</span>
          </summary>
          <div className="border-t border-amber-200 p-2 sm:p-3">
            <Bzm21DynamicPolicyObservatory model={state.payload.bzm21} displayMode="preview" />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {!exactRevisionLoaded ? (
        <div className="border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] leading-4 text-orange-900">
          <div className="font-semibold">SPS 2.1の主表示版を正確に読み出せていない</div>
          <div>レジストリの指定版と画面版が一致するまで値を0にせず、下のSPS 2.1画面を欠測表示にする。</div>
        </div>
      ) : null}
      {exactRevisionLoaded ? (
        <Bzm21DynamicPolicyObservatory model={state.payload.bzm21} displayMode="primary" />
      ) : (
        <div className="border border-orange-200 bg-orange-50 px-3 py-3 text-[10px] leading-4 text-orange-900">
          主表示版の値は抑止中。レジストリ指定版を読み直すまで、別版の値をSPS 2.1として表示しない。
        </div>
      )}
      <details className="min-w-0 overflow-hidden border border-[#c9c2b5] bg-white">
        <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-[#eeeae2] px-3 py-2 hover:bg-[#e8e2d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#675f52] sm:min-h-0 marker:content-none">
          <span className="min-w-0">
            <span className="text-[11px] font-semibold text-[#514b42]">旧SPS / BZM 2.0 アーカイブ</span>
            <span className="ml-2 text-[9px] text-[#776f63]">旧値は消さず凍結。SPS 2.1へ混ぜない。</span>
          </span>
          <span className="flex min-w-0 flex-wrap items-center justify-end gap-3 text-[9px] text-[#776f63]">
            <span className="hidden break-all sm:inline">{primary.legacyArchive?.snapshotKey ?? "凍結版未取得"}</span>
            <span>開く ›</span>
          </span>
        </summary>
        <ArchiveMetadata primary={primary} />
        <div className="min-w-0 space-y-4 border-t border-[#d8d3c9] p-2 sm:p-3">
          <LegacyScoreStack payload={state.payload} />
        </div>
      </details>
    </div>
  );
}
