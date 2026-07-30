"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, RotateCcw } from "lucide-react";
import { fetchSeedsForInstitution, fetchSeedSpsHistoryForSeeds } from "@/lib/seeds-data";
import {
  collectObservationDates,
  computeSpsDistributionStats,
  formatSourceDateRange,
  rankSeedsBySps,
  selectLatestPerKeyAsOf,
  type SpsDistributionStats,
} from "@/lib/institution-soil-seeds";
import {
  computeErs,
  type ErsAssessment,
  type ErsAxis,
  type ErsCriterion,
  type ErsResult,
} from "@/lib/ers";
import type { SeedPublicSpsAssessment, SeedPublicView } from "@/types/seeds";

type SpsHistoryMap = Map<string, SeedPublicSpsAssessment[]>;
const EMPTY_SPS_HISTORY: SpsHistoryMap = new Map();

type ObservationRow = {
  asOfDate: string;
  ecrResult: ErsResult;
  ecrSourceDates: string[];
  ecrVersions: string[];
  evidenceCount: number;
  spsSourceDates: string[];
  distribution: SpsDistributionStats;
};

/**
 * 研究機関の ECR と所属シーズ群の SPS を、元評価日を失わずに並べる観測ノート。
 * 両指標は最後まで別系列とし、合成値・相関係数・回帰線・因果表現は出さない。
 */
export function CockpitSoilSeeds({
  institutionId,
  ersResult,
  ersAssessments,
  ersAssessmentHistory,
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
  const [history, setHistory] = useState<SpsHistoryMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchSeedsForInstitution(institutionId)
      .then((data) => {
        if (!cancelled) setSeeds(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "所属シーズを読み込めなかった");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [institutionId, requestKey]);

  useEffect(() => {
    if (seeds === null || seeds.length === 0) return;
    let cancelled = false;
    fetchSeedSpsHistoryForSeeds(seeds.map((seed) => seed.id))
      .then((nextHistory) => {
        if (!cancelled) setHistory(nextHistory);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setHistoryError(cause instanceof Error ? cause.message : "SPS履歴を読み込めなかった");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [seeds]);

  const effectiveHistory = seeds?.length === 0 ? EMPTY_SPS_HISTORY : history;

  const distribution = useMemo(
    () => computeSpsDistributionStats((seeds ?? []).map((seed) => seed.latest_sps?.score ?? null)),
    [seeds]
  );

  const ranking = useMemo(() => {
    const ranked = rankSeedsBySps(
      (seeds ?? []).map((seed) => ({ seedId: seed.id, score: seed.latest_sps?.score ?? null }))
    );
    const bySeedId = new Map(ranked.map((row) => [row.seedId, row]));
    return (seeds ?? [])
      .map((seed) => ({
        seed,
        rank: bySeedId.get(seed.id)?.rank ?? null,
        score: bySeedId.get(seed.id)?.score ?? null,
      }))
      .sort((a, b) => {
        if (a.rank == null && b.rank == null) return a.seed.title.localeCompare(b.seed.title, "ja");
        if (a.rank == null) return 1;
        if (b.rank == null) return -1;
        return a.rank - b.rank || a.seed.title.localeCompare(b.seed.title, "ja");
      });
  }, [seeds]);

  const topSeeds = ranking.filter((row) => row.rank != null && row.rank <= 3);
  const ecrLatestDate = formatSourceDateRange(ersAssessments.map((assessment) => assessment.evaluatedAt));
  const ecrVersions = Array.from(new Set(ersAssessments.map((assessment) => assessment.evaluationVersion))).sort();
  const ecrEvidenceCount = ersAssessments.filter((assessment) => Boolean(assessment.note?.trim())).length;
  const latestSpsSourceDate = formatSourceDateRange(
    (seeds ?? []).flatMap((seed) => (seed.latest_sps ? [seed.latest_sps.evaluated_at] : []))
  );

  const observationRows = useMemo<ObservationRow[]>(() => {
    if (seeds === null || effectiveHistory === null) return [];
    const dates = collectObservationDates(
      ersAssessmentHistory.map((assessment) => assessment.evaluatedAt),
      Array.from(effectiveHistory.values()).flatMap((rows) => rows.map((row) => row.evaluated_at))
    );
    return dates.slice(0, 24).map((asOfDate) => {
      const ecrSnapshot = selectLatestPerKeyAsOf(
        ersAssessmentHistory,
        asOfDate,
        (assessment) => assessment.criterionId
      );
      const selectedSps = seeds.map((seed) =>
        selectLatestSpsAsOf(effectiveHistory.get(seed.id) ?? [], asOfDate)
      );
      return {
        asOfDate,
        ecrResult: computeErs(ersAxes, ersCriteria, ecrSnapshot),
        ecrSourceDates: ecrSnapshot.map((assessment) => assessment.evaluatedAt),
        ecrVersions: Array.from(
          new Set(ecrSnapshot.map((assessment) => assessment.evaluationVersion))
        ).sort(),
        evidenceCount: ecrSnapshot.filter((assessment) => Boolean(assessment.note?.trim())).length,
        spsSourceDates: selectedSps.flatMap((assessment) =>
          assessment ? [assessment.evaluated_at] : []
        ),
        distribution: computeSpsDistributionStats(
          selectedSps.map((assessment) => assessment?.score ?? null)
        ),
      };
    });
  }, [effectiveHistory, ersAssessmentHistory, ersAxes, ersCriteria, seeds]);

  return (
    <section className="space-y-5 border border-[#22212a] bg-[#fdfcf8] px-3 py-4 text-[#22212a] sm:px-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#22212a] pb-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-semibold tracking-[0.16em] text-indigo-800">
            研究機関 観測ノート
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            土壌 × シーズ — ECRとSPS分布の継続観測
          </h2>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-[#55525d]">
            機関環境のECRと、所属シーズごとのSPSを別系列のまま並べる。
            観測日は整列の基準で、ECR元評価日とSPS元評価日はそれぞれ明示する。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSeeds(null);
            setHistory(null);
            setError(null);
            setHistoryError(null);
            setRequestKey((value) => value + 1);
          }}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-[#22212a] bg-white text-[#22212a] transition-colors hover:bg-[#efede5] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          title="再読み込み"
          aria-label="土壌とシーズの観測データを再読み込み"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <StatisticalCautionNotice />

      <div>
        <SectionTitle
          label="観測断面台帳"
          meta={
            effectiveHistory === null && !historyError
              ? "SPS履歴を読み込み中"
              : `${observationRows.length}断面 / 元評価日を別表示`
          }
        />
        {historyError ? (
          <InlineError message={`履歴断面を表示できない: ${historyError}`} />
        ) : effectiveHistory === null || seeds === null ? (
          <LoadingLine label="観測断面を再構成中" />
        ) : observationRows.length === 0 ? (
          <EmptyLine label="ECRまたはSPSの評価履歴がまだない" />
        ) : (
          <div className="mt-2 overflow-x-auto border border-[#22212a]">
            <table className="min-w-[1180px] w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[#22212a] bg-[#efede5] text-left text-[10px]">
                  <th className="px-2 py-2" rowSpan={2}>観測日</th>
                  <th className="border-l border-[#22212a]/30 px-2 py-2" rowSpan={2}>ECR元日 / 版</th>
                  <th className="border-l border-[#22212a]/30 px-2 py-2 text-center" colSpan={8}>ECR 8軸</th>
                  <th className="border-l border-[#22212a]/30 px-2 py-2" rowSpan={2}>SPS元日</th>
                  <th className="px-2 py-2 text-right" rowSpan={2}>n / 所属</th>
                  <th className="border-l border-[#22212a]/30 px-2 py-2 text-center" colSpan={3}>SPS分布</th>
                </tr>
                <tr className="border-b border-[#22212a] bg-[#f6f4ee] font-mono text-[10px]">
                  {ersAxes.map((axis) => (
                    <th key={axis.axisId} className="px-2 py-1.5 text-right">A{axis.axisNo}</th>
                  ))}
                  <th className="border-l border-[#22212a]/30 px-2 py-1.5 text-right">Q1</th>
                  <th className="px-2 py-1.5 text-right">中央値</th>
                  <th className="px-2 py-1.5 text-right">Q3</th>
                </tr>
              </thead>
              <tbody>
                {observationRows.map((row) => (
                  <tr key={row.asOfDate} className="border-b border-[#22212a]/25 last:border-b-0">
                    <td className="whitespace-nowrap px-2 py-2 font-mono font-semibold">{row.asOfDate}</td>
                    <td className="border-l border-[#22212a]/20 px-2 py-2">
                      <div className="font-mono">{formatSourceDateRange(row.ecrSourceDates)}</div>
                      <div className="text-[9px] text-[#6b6871]">
                        {row.ecrVersions.join(", ") || "—"} / 証拠 {row.evidenceCount}/{row.ecrResult.assessedCriteria}
                      </div>
                    </td>
                    {row.ecrResult.axisScores.map((axis) => (
                      <td key={axis.axisId} className="px-2 py-2 text-right font-mono">
                        {axis.score == null ? "—" : `${Math.round(axis.score * 100)}%`}
                      </td>
                    ))}
                    <td className="border-l border-[#22212a]/20 px-2 py-2 font-mono">
                      {formatSourceDateRange(row.spsSourceDates)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-mono">
                      {row.distribution.n} / {seeds.length}
                    </td>
                    <DistributionCell value={row.distribution.q1} withBorder />
                    <DistributionCell value={row.distribution.median} />
                    <DistributionCell value={row.distribution.q3} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 grid gap-x-4 gap-y-1 text-[10px] text-[#65616b] sm:grid-cols-2 lg:grid-cols-4">
          {ersAxes.map((axis) => (
            <div key={axis.axisId}>
              <span className="font-mono font-semibold text-indigo-900">A{axis.axisNo}</span> {axis.name}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(330px,0.7fr)]">
        <div className="min-w-0">
          <SectionTitle
            label="最新ECR 8軸"
            meta={
              ecrLatestDate === "—"
                ? "評価未着手"
                : `元日 ${ecrLatestDate} / ${ecrVersions.join(", ") || "v1"} / 証拠 ${ecrEvidenceCount}/${ersResult.assessedCriteria}`
            }
          />
          <div className="mt-2 overflow-x-auto border border-[#22212a]">
            <table className="min-w-[620px] w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[#22212a] bg-[#efede5] text-left text-[10px]">
                  <th className="px-2 py-1.5">軸</th>
                  <th className="px-2 py-1.5">名称</th>
                  <th className="px-2 py-1.5">対応XRL</th>
                  <th className="px-2 py-1.5 text-right">評価済</th>
                  <th className="px-2 py-1.5 text-right">充足率</th>
                </tr>
              </thead>
              <tbody>
                {ersResult.axisScores.map((axis) => (
                  <tr key={axis.axisId} className="border-b border-[#22212a]/25 last:border-b-0">
                    <td className="px-2 py-1.5 font-mono">A{axis.axisNo}</td>
                    <td className="px-2 py-1.5">{axis.name}</td>
                    <td className="px-2 py-1.5 text-[#65616b]">{axis.correspondsXrl ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {axis.assessedCount}/{axis.totalCount}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold text-indigo-900">
                      {axis.score == null ? "未評価" : `${Math.round(axis.score * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0">
          <SectionTitle
            label="最新SPS分布"
            meta={
              seeds === null
                ? "読み込み中"
                : `元日 ${latestSpsSourceDate} / n=${distribution.n} / 所属${seeds.length}件`
            }
          />
          {error ? (
            <InlineError message={error} />
          ) : seeds === null ? (
            <LoadingLine label="所属シーズを読み込み中" />
          ) : (
            <>
              <div className="mt-2 overflow-x-auto border border-[#22212a]">
                <table className="min-w-[430px] w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-[#22212a] bg-[#efede5] text-left font-mono text-[10px]">
                      <th className="px-2 py-1.5 text-right">n</th>
                      <th className="px-2 py-1.5 text-right">min</th>
                      <th className="px-2 py-1.5 text-right">Q1</th>
                      <th className="px-2 py-1.5 text-right">中央値</th>
                      <th className="px-2 py-1.5 text-right">Q3</th>
                      <th className="px-2 py-1.5 text-right">max</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-2 text-right font-mono font-semibold">{distribution.n}</td>
                      <DistributionCell value={distribution.min} />
                      <DistributionCell value={distribution.q1} />
                      <DistributionCell value={distribution.median} />
                      <DistributionCell value={distribution.q3} />
                      <DistributionCell value={distribution.max} />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-[#65616b]">
                SPS未評価 {seeds.length - distribution.n}件は0へ置換せず、分布の外に保持している。
                分位点は線形補間法。
              </p>
            </>
          )}
        </div>
      </div>

      <div>
        <SectionTitle
          label="所属シーズ順位"
          meta={seeds === null ? "読み込み中" : `SPS評価済 ${distribution.n} / 所属 ${seeds.length}`}
        />
        <div className="mt-2 max-h-[52vh] overflow-auto border border-[#22212a]">
          {error ? (
            <InlineError message={error} />
          ) : seeds === null ? (
            <LoadingLine label="所属シーズを読み込み中" />
          ) : ranking.length === 0 ? (
            <EmptyLine label="この機関に紐づくシーズがまだない" />
          ) : (
            <table className="min-w-[780px] w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#22212a] bg-[#efede5] text-left text-[10px]">
                  <th className="px-2 py-1.5">順位</th>
                  <th className="px-2 py-1.5">シーズ</th>
                  <th className="px-2 py-1.5">研究者</th>
                  <th className="px-2 py-1.5 text-right">SPS</th>
                  <th className="px-2 py-1.5">評価日</th>
                  <th className="px-2 py-1.5 text-right">観測数</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map(({ seed, rank, score }) => (
                  <tr key={seed.id} className="border-b border-[#22212a]/25 last:border-b-0">
                    <td className="px-2 py-1.5 font-mono font-semibold">{rank ?? "—"}</td>
                    <td className="px-2 py-1.5">{seed.title}</td>
                    <td className="px-2 py-1.5 text-[#65616b]">{seed.researcher_name ?? "未登録"}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold text-indigo-900">
                      {score == null ? "未評価" : score.toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[#65616b]">
                      {seed.latest_sps?.evaluated_at ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-[#65616b]">
                      {effectiveHistory?.get(seed.id)?.length ?? (seed.latest_sps ? 1 : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {pathwayProjectId && topSeeds.length > 0 && (
        <div className="border border-indigo-900 bg-indigo-50/60 px-3 py-3 sm:px-4">
          <div className="font-mono text-[10px] font-semibold tracking-[0.12em] text-indigo-900">
            KUTE → GTIE申請支援
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#393641]">
            SPS上位{topSeeds.length}件（{topSeeds.map((row) => row.seed.title).join(" / ")}）を、
            既存PJ側で申請支援の検討材料として開く。順位は優先度決定や採択予測ではない。
          </p>
          <Link
            href={`/project/${pathwayProjectId}/cockpit`}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 border border-indigo-900 bg-white px-3 text-xs font-semibold text-indigo-900 transition-colors hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            {pathwayProjectLabel ?? "GTIE申請支援"}を検討
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

function selectLatestSpsAsOf(
  assessments: SeedPublicSpsAssessment[],
  asOfDate: string
): SeedPublicSpsAssessment | null {
  let latest: SeedPublicSpsAssessment | null = null;
  for (const assessment of assessments) {
    if (assessment.evaluated_at > asOfDate) continue;
    if (!latest || assessment.evaluated_at > latest.evaluated_at) latest = assessment;
  }
  return latest;
}

function SectionTitle({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#22212a]/45 pb-1.5">
      <h3 className="text-sm font-semibold">{label}</h3>
      <span className="font-mono text-[10px] text-[#65616b]">{meta}</span>
    </div>
  );
}

function DistributionCell({ value, withBorder = false }: { value: number | null; withBorder?: boolean }) {
  return (
    <td
      className={`px-2 py-2 text-right font-mono font-semibold ${
        withBorder ? "border-l border-[#22212a]/20" : ""
      }`}
    >
      {value == null ? <span className="text-[#8a8790]">—</span> : value.toFixed(2)}
    </td>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="mt-2 flex items-center justify-center gap-2 border border-[#22212a] px-3 py-7 text-xs text-[#65616b]">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

function EmptyLine({ label }: { label: string }) {
  return <div className="mt-2 border border-[#22212a] px-3 py-7 text-center text-xs text-[#65616b]">{label}</div>;
}

function InlineError({ message }: { message: string }) {
  return <div className="mt-2 border border-red-800 bg-red-50 px-3 py-3 text-xs text-red-900">{message}</div>;
}

function StatisticalCautionNotice() {
  return (
    <div className="border-l-4 border-amber-700 bg-amber-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-amber-950">
      <span className="font-semibold">読み方の制約: </span>
      小標本、機関内反復、交絡、欠測、ECR levelとSPS構成軸に含まれる順序尺度を無視しない。
      この画面は観測・仮説生成・縦断検証の基盤であり、並びや同時変化を相関、因果、検証済み予測モデルとして扱わない。
    </div>
  );
}
