"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { computeErs, type ErsAssessment, type ErsAxis, type ErsCriterion, type ErsResult } from "@/lib/ers";
import { fetchSeedsForInstitution, formatOkuYen, seedScreeningBandMedianYen } from "@/lib/seeds-data";
import { loadSeedScreeningBandSummaries } from "@/lib/seed-screening-bands-client";
import type { SeedPublicView, SeedScreeningBandSummary } from "@/types/seeds";

export function CockpitSoilSeeds({
  institutionId,
  ersResult,
  ersAssessments,
  ersAxes,
  ersCriteria,
  pathwayProjectId,
  pathwayProjectLabel,
}: {
  institutionId: string;
  ersResult: ErsResult;
  ersAssessments: ErsAssessment[];
  ersAssessmentHistory: ErsAssessment[];
  ersAxes: ErsAxis[];
  ersCriteria: ErsCriterion[];
  pathwayProjectId?: string;
  pathwayProjectLabel?: string;
}) {
  const [seeds, setSeeds] = useState<SeedPublicView[] | null>(null);
  const [bands, setBands] = useState<Map<string, SeedScreeningBandSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchSeedsForInstitution(institutionId),
      // 帯は参照系。キャッシュ経由で読み、画面を行き来しても取り直さない。
      loadSeedScreeningBandSummaries().catch(() => new Map<string, SeedScreeningBandSummary>()),
    ])
      .then(([nextSeeds, bandMap]) => {
        if (cancelled) return;
        setSeeds(nextSeeds);
        setBands(bandMap);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "土壌とシーズを読み込めなかった");
      });
    return () => { cancelled = true; };
  }, [institutionId, requestKey]);

  const currentErs = useMemo(
    () => computeErs(ersAxes, ersCriteria, ersAssessments),
    [ersAssessments, ersAxes, ersCriteria],
  );
  const rankedSeeds = useMemo(() => (seeds ?? []).map((seed) => {
    const band = bands.get(seed.id) ?? null;
    return { seed, band, median: band ? seedScreeningBandMedianYen(band.sps_lower_yen, band.sps_upper_yen) : null };
  }).sort((a, b) => {
    if (a.median == null && b.median != null) return 1;
    if (a.median != null && b.median == null) return -1;
    return (b.median ?? 0) - (a.median ?? 0) || a.seed.title.localeCompare(b.seed.title, "ja");
  }), [bands, seeds]);

  return (
    <section className="space-y-5 border border-[#22212a] bg-[#fdfcf8] px-3 py-4 text-[#22212a] sm:px-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#22212a] pb-4">
        <div>
          <div className="font-mono text-[10px] font-semibold tracking-[0.16em] text-indigo-800">研究機関 観測ノート</div>
          <h2 className="mt-1 text-lg font-semibold">土壌 × シーズ — ECRと現行SPS</h2>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-[#55525d]">ECRとSPSは合成しない。SPSは産業創出価値版の凍結評価だけを表示し、旧版しかないシーズは最新版未評価とする。</p>
        </div>
        <button type="button" onClick={() => { setSeeds(null); setError(null); setRequestKey((value) => value + 1); }} className="inline-flex h-10 w-10 items-center justify-center border border-[#22212a] bg-white hover:bg-[#efede5]" aria-label="再読み込み"><RotateCcw className="h-4 w-4" /></button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-[#22212a] bg-white">
          <div className="border-b border-[#22212a] bg-[#efede5] px-3 py-2"><h3 className="text-[11px] font-semibold">ECR｜研究機関環境</h3></div>
          <div className="grid grid-cols-2 gap-px bg-slate-200">
            <div className="bg-white p-3"><div className="text-[9px] text-slate-500">総合</div><div className="text-xl font-semibold">{(currentErs.ers ?? ersResult.ers) == null ? "未評価" : `${Math.round((currentErs.ers ?? ersResult.ers ?? 0) * 100)}%`}</div></div>
            <div className="bg-white p-3"><div className="text-[9px] text-slate-500">評価基準</div><div className="text-xl font-semibold">{currentErs.assessedCriteria}/{currentErs.totalCriteria}</div></div>
          </div>
          <div className="grid grid-cols-4 gap-px border-t border-slate-200 bg-slate-200">{currentErs.axisScores.map((axis) => <div key={axis.axisId} className="bg-white p-2 text-center"><div className="text-[8px] text-slate-500">A{axis.axisNo}</div><div className="font-mono text-[11px] font-semibold">{axis.score == null ? "—" : `${Math.round(axis.score * 100)}%`}</div></div>)}</div>
        </section>

        <section className="border border-[#9bb8ad] bg-white">
          <div className="border-b border-[#9bb8ad] bg-[#e6f1ed] px-3 py-2"><h3 className="text-[11px] font-semibold text-[#174b42]">現行SPS｜産業創出価値</h3><p className="text-[8px] text-[#55736c]">sps-ind-v1 / q-eval-v2 / rubric-v1.1 / p-ind-v1</p></div>
          {error ? <div className="p-3 text-[10px] text-red-700">{error}</div> : seeds === null ? <div className="flex items-center justify-center gap-2 p-8 text-[10px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />読み込み中</div> : <div className="divide-y divide-slate-100">{rankedSeeds.map(({ seed, band, median }) => <div key={seed.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2"><div><div className="text-[10px] font-semibold">{seed.title}</div><div className="text-[8px] text-slate-500">{seed.researcher_name ?? "研究者未登録"}</div></div><div className="text-right"><div className={`text-[10px] font-semibold ${band?.assessment_id ? "text-[#174b42]" : "text-amber-700"}`}>{band?.assessment_id ? `${formatOkuYen(median)}（${formatOkuYen(band.sps_lower_yen)}〜${formatOkuYen(band.sps_upper_yen)}）` : "最新版未評価"}</div><div className="font-mono text-[8px] text-slate-400">{band?.assessment_id ?? "none"}</div></div></div>)}</div>}
        </section>
      </div>

      {pathwayProjectId ? <Link href={`/project/${encodeURIComponent(pathwayProjectId)}/cockpit`} className="inline-flex text-[10px] font-semibold text-indigo-800 underline">{pathwayProjectLabel ?? pathwayProjectId} のコックピットを開く</Link> : null}
    </section>
  );
}
