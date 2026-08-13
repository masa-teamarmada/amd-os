"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bzm21DynamicPolicyObservatory } from "@/components/cockpit/Bzm21DynamicPolicyObservatory";
import { Bzm22ProvisionalObservatory } from "@/components/cockpit/Bzm22ProvisionalObservatory";
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
  | { status: "idle"; projectId: string }
  | { status: "loading"; projectId: string }
  | { status: "ready"; projectId: string; payload: AmdScoreDetailPayload; fetchedAt: number }
  | { status: "error"; projectId: string; error: string };

const SCORE_DETAIL_CACHE_TTL_MS = 15 * 1000;
const scoreDetailCache = new Map<string, { payload: AmdScoreDetailPayload; fetchedAt: number }>();
const scoreDetailRequests = new Map<string, Promise<{ payload: AmdScoreDetailPayload; fetchedAt: number }>>();

function getFreshScoreDetail(projectId: string) {
  const cached = scoreDetailCache.get(projectId);
  if (!cached || Date.now() - cached.fetchedAt > SCORE_DETAIL_CACHE_TTL_MS) return null;
  return cached;
}

function fetchScoreDetail(projectId: string) {
  const fresh = getFreshScoreDetail(projectId);
  if (fresh) return Promise.resolve(fresh);

  const existing = scoreDetailRequests.get(projectId);
  if (existing) return existing;

  const request = fetch(`/api/project/${encodeURIComponent(projectId)}/amd-score-detail`, {
    cache: "no-store",
  })
    .then(async (response) => {
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error || "旧スコア詳細の取得に失敗");
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

function LazyArchiveDisclosure({
  title,
  summary,
  onFirstOpen,
  children,
}: {
  title: string;
  summary: string;
  onFirstOpen: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        setOpen(nextOpen);
        if (nextOpen) onFirstOpen();
      }}
      className="min-w-0 overflow-hidden border border-[#c9c2b5] bg-white"
    >
      <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-[#eeeae2] px-3 py-2 hover:bg-[#e8e2d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#675f52] marker:content-none">
        <span className="min-w-0">
          <span className="text-[11px] font-semibold text-[#514b42]">{title}</span>
          <span className="ml-2 text-[9px] text-[#776f63]">{summary}</span>
        </span>
        <span className="text-[9px] text-[#776f63]">{open ? "閉じる⌃" : "開く⌄"}</span>
      </summary>
      {open ? <div className="min-w-0 border-t border-[#d8d3c9]">{children}</div> : null}
    </details>
  );
}

function ArchiveLoadBoundary({
  state,
  projectId,
  children,
}: {
  state: LoadState;
  projectId: string;
  children: (payload: AmdScoreDetailPayload) => ReactNode;
}) {
  if (state.projectId !== projectId) {
    return <div className="grid min-h-28 place-items-center px-3 text-[10px] text-slate-500">PJを切り替え中…</div>;
  }
  if (state.status === "idle" || state.status === "loading") {
    return <div className="grid min-h-28 place-items-center px-3 text-[10px] text-slate-500">旧モデルを読み込み中…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="border border-red-200 bg-red-50 px-3 py-3 text-[10px] leading-4 text-red-800">
        {state.error}。BZM 2.2の値へ置き換えず、旧モデルだけを欠測として止める。
      </div>
    );
  }
  return <>{children(state.payload)}</>;
}

function CurrentSpsArchive({ payload }: { payload: AmdScoreDetailPayload }) {
  const primary = payload.spsPrimary;
  const sps21IsPrimary =
    primary.storageState === "available" &&
    primary.primaryModel === "sps_2_1" &&
    primary.switchStatus === "active";
  const exactRevisionLoaded =
    Boolean(primary.activeBzm21RevisionId) &&
    payload.bzm21.currentRevision?.revisionId === primary.activeBzm21RevisionId;

  if (sps21IsPrimary && !exactRevisionLoaded) {
    return (
      <div className="border border-orange-200 bg-orange-50 px-3 py-3 text-[10px] leading-4 text-orange-900">
        <div className="font-semibold">SPS 2.1のレジストリ指定版を正確に読み出せていない</div>
        <div>別版を現行運用値として表示せず、指定版を読み直すまで抑止する。</div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2 p-2 sm:p-3">
      <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-[9px] leading-4 text-slate-600">
        OSの運用レジストリは {sps21IsPrimary ? "SPS 2.1 active" : `${primary.primaryModel} / ${primary.switchStatus}`}。ここではBZM 2.2暫定値と混ぜず、比較用の旧モデルとして表示する。
      </div>
      <Bzm21DynamicPolicyObservatory model={payload.bzm21} displayMode="archive" />
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
  const [archiveRequestedProjectId, setArchiveRequestedProjectId] = useState<string | null>(null);
  const [archiveState, setArchiveState] = useState<LoadState>(() => {
    const cached = getFreshScoreDetail(projectId);
    return cached
      ? { status: "ready", projectId, payload: cached.payload, fetchedAt: cached.fetchedAt }
      : { status: "idle", projectId };
  });

  useEffect(() => {
    if (!active || archiveRequestedProjectId !== projectId) return;
    let cancelled = false;
    fetchScoreDetail(projectId)
      .then((entry) => {
        if (!cancelled) {
          setArchiveState({ status: "ready", projectId, payload: entry.payload, fetchedAt: entry.fetchedAt });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setArchiveState({
            status: "error",
            projectId,
            error: error instanceof Error ? error.message : "旧スコア詳細の取得に失敗",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active, archiveRequestedProjectId, projectId]);

  const requestArchives = () => setArchiveRequestedProjectId(projectId);

  return (
    <div className="min-w-0 space-y-2" data-density="compact-score-page">
      <Bzm22ProvisionalObservatory projectId={projectId} active={active} />

      <section data-testid="score-model-archives" aria-labelledby="score-model-archives-title" className="min-w-0 space-y-1.5 border-t border-slate-300 pt-2">
        <div className="px-1">
          <h2 id="score-model-archives-title" className="text-[11px] font-semibold text-slate-700">旧モデル / 現行運用モデル</h2>
          <p className="mt-0.5 text-[9px] leading-4 text-slate-500">ページ最下部に分離。初期状態では閉じ、開いたモデルだけを描画する。</p>
        </div>

        <LazyArchiveDisclosure
          key={`${projectId}-sps21`}
          title="現行SPS / BZM 2.1"
          summary="OS運用レジストリの版。BZM 2.2暫定値とは尺度を混ぜない。"
          onFirstOpen={requestArchives}
        >
          <ArchiveLoadBoundary state={archiveState} projectId={projectId}>
            {(payload) => <CurrentSpsArchive payload={payload} />}
          </ArchiveLoadBoundary>
        </LazyArchiveDisclosure>

        <LazyArchiveDisclosure
          key={`${projectId}-bzm20`}
          title="BZM 2.0"
          summary="過去理論のモデル観測台帳。比較用。"
          onFirstOpen={requestArchives}
        >
          <ArchiveLoadBoundary state={archiveState} projectId={projectId}>
            {(payload) => <div className="min-w-0 p-2 sm:p-3"><Bzm2ModelObservatory model={payload.bzm2} /></div>}
          </ArchiveLoadBoundary>
        </LazyArchiveDisclosure>

        <LazyArchiveDisclosure
          key={`${projectId}-sps10`}
          title="SPS 1.0 / Legacy AMD"
          summary="9軸SPSと旧M×X×F。履歴・根拠確認のため凍結保持。"
          onFirstOpen={requestArchives}
        >
          <ArchiveLoadBoundary state={archiveState} projectId={projectId}>
            {(payload) => (
              <div className="min-w-0">
                <ArchiveMetadata primary={payload.spsPrimary} />
                <div className="min-w-0 p-2 sm:p-3">
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
              </div>
            )}
          </ArchiveLoadBoundary>
        </LazyArchiveDisclosure>
      </section>
    </div>
  );
}
