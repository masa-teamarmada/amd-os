"use client";

/**
 * /institutions「分析」タブ。支援プログラム比較のデータ (参照系キャッシュ経由) を多視点で見る。
 * 集計はすべて lib/institution-support-analysis.ts の純粋関数。画面は結果を描くだけ。
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  INSTITUTION_TYPE_LABEL,
} from "@/lib/ers";
import { POLICY_STATUS_LABEL, POLICY_STATUS_TONE } from "@/lib/institution-policy";
import {
  ATTRIBUTE_VOCAB,
  buildStatusLookup,
  bucketAttribute,
  computeColumnRates,
  computeRegionMatrix,
  rankGaps,
  rankInstitutions,
  regionBlockOf,
  typeGroupOf,
  type AnalysisInstitution,
  type InstitutionScore,
  type StatusCounts,
} from "@/lib/institution-support-analysis";
import {
  loadInstitutionSupportPrograms,
  peekInstitutionSupportPrograms,
} from "@/lib/institution-support-programs-client";
import type { SupportProgramBundle } from "@/types/institution-support-programs";

type TypeFilter = "all" | "大学" | "研究機関";

/** 整備率 0..1 を indigo の濃淡に。null (確認済み 0) はグレー。 */
function rateCell(rate: number | null): { background: string; color: string } {
  if (rate == null) return { background: "#f4f4f5", color: "#71717a" };
  const lightness = 95 - Math.max(0, Math.min(1, rate)) * 60;
  return {
    background: `hsl(243 58% ${lightness}%)`,
    color: lightness < 62 ? "rgba(255,255,255,0.96)" : "hsl(243 45% 28%)",
  };
}

const percent = (rate: number | null) => (rate == null ? "—" : `${Math.round(rate * 100)}%`);

export function SupportProgramAnalysis({
  institutions,
}: {
  institutions: AnalysisInstitution[];
}) {
  const [bundle, setBundle] = useState<SupportProgramBundle | undefined>(() =>
    peekInstitutionSupportPrograms(),
  );
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const reload = useCallback(
    () =>
      loadInstitutionSupportPrograms()
        .then((value) => {
          setBundle(value);
          setError("");
        })
        .catch((cause: unknown) =>
          setError(cause instanceof Error ? cause.message : "読み込み失敗"),
        ),
    [],
  );
  useEffect(() => {
    if (!bundle) void reload();
  }, [bundle, reload]);

  const filtered = useMemo(
    () =>
      typeFilter === "all"
        ? institutions
        : institutions.filter((institution) => typeGroupOf(institution.type) === typeFilter),
    [institutions, typeFilter],
  );
  const lookup = useMemo(
    () => buildStatusLookup(bundle?.cells ?? [], bundle?.extraCells ?? []),
    [bundle],
  );
  const valueLookup = useMemo(() => {
    const map = new Map<string, { status: SupportProgramBundle["cells"][number]["status"]; value: string | null }>();
    for (const cell of bundle?.cells ?? []) map.set(`${cell.institutionId}:${cell.policyItemId}`, { status: cell.status, value: cell.value });
    for (const cell of bundle?.extraCells ?? []) map.set(`${cell.institutionId}:${cell.policyItemId}`, { status: cell.status, value: cell.value });
    return (institutionId: string, policyItemId: string) => map.get(`${institutionId}:${policyItemId}`);
  }, [bundle]);

  const columns = useMemo(() => bundle?.columns ?? [], [bundle]);
  const columnRates = useMemo(() => computeColumnRates(columns, filtered, lookup), [columns, filtered, lookup]);
  const regionMatrix = useMemo(() => computeRegionMatrix(columns, filtered, lookup), [columns, filtered, lookup]);
  const ranking = useMemo(() => rankInstitutions(columns, filtered, lookup), [columns, filtered, lookup]);
  const gaps = useMemo(() => rankGaps(ranking), [ranking]);
  const attributeBuckets = useMemo(() => {
    const items = bundle?.items ?? [];
    return Object.keys(ATTRIBUTE_VOCAB)
      .map((key) => items.find((item) => item.key === key))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => bucketAttribute(item, filtered, valueLookup, ATTRIBUTE_VOCAB[item.key]));
  }, [bundle, filtered, valueLookup]);

  const overall = useMemo(() => {
    const total = filtered.length * columns.length;
    let confirmed = 0;
    let established = 0;
    for (const row of ranking) {
      confirmed += row.counts.confirmed;
      established += row.counts.established;
    }
    const byType: Record<string, number> = {};
    for (const institution of filtered) byType[typeGroupOf(institution.type)] = (byType[typeGroupOf(institution.type)] ?? 0) + 1;
    return { total, confirmed, established, byType };
  }, [filtered, columns, ranking]);

  const loaded = Boolean(bundle);

  return (
    <section className="space-y-6" aria-labelledby="support-analysis-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="support-analysis-title" className="text-base font-bold text-slate-950">
            支援プログラムの分析
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            支援プログラム比較のデータを、どの支援が一般的か（列別）、地域ごとの差、機関ごとの充実度、AMDが提案できる余地、制度の型の分布で見る。
            割合の分母は根拠を確認できた機関で、未確認は別に数える。
          </p>
        </div>
        <div className="inline-grid grid-cols-3 rounded-md border border-slate-300 bg-slate-100 p-0.5" role="tablist" aria-label="種別で絞る">
          {(["all", "大学", "研究機関"] as TypeFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={typeFilter === value}
              onClick={() => setTypeFilter(value)}
              className={`min-h-9 rounded px-3 text-xs font-semibold ${typeFilter === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              {value === "all" ? "全機関" : value}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>
      )}

      <dl className="grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-2 sm:grid-cols-6">
        <Metric label="対象機関" value={`${filtered.length}機関`} />
        <Metric label="大学 / 研究機関" value={`${overall.byType["大学"] ?? 0} / ${overall.byType["研究機関"] ?? 0}`} />
        <Metric label="比較項目" value={loaded ? `${columns.length}列` : "—"} />
        <Metric label="確認済みセル" value={loaded ? `${overall.confirmed} / ${overall.total}` : "—"} />
        <Metric label="整備済みセル" value={loaded ? `${overall.established}` : "—"} />
        <Metric
          label="整備率（確認済み中）"
          value={loaded && overall.confirmed ? `${Math.round((overall.established / overall.confirmed) * 100)}%` : "—"}
        />
      </dl>

      {/* 1. 列別の整備率 */}
      <Block
        title="どの支援が一般的か（列別の整備率）"
        description="確認済み機関のうち整備済みの割合が高い順。AMDの推奨で「大部分が認めている」と言える根拠はここ。"
      >
        {loaded ? (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-semibold text-slate-600">
                <th className="border-b border-slate-200 px-3 py-2">項目</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">整備率</th>
                <th className="w-[40%] border-b border-slate-200 px-3 py-2">内訳（整備済み / 検討中 / 未整備 ｜ 未確認）</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">整備済み</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">検討中</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">未整備</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">未確認</th>
              </tr>
            </thead>
            <tbody>
              {columnRates.map(({ column, counts }) => (
                <tr key={column.policyItemId} className="hover:bg-slate-50/70">
                  <td className="border-b border-slate-200 px-3 py-1.5">
                    <span className="font-semibold text-slate-900">{column.label}</span>
                    <span className="ml-1.5 text-[10px] text-slate-400">{column.group}</span>
                  </td>
                  <td className="border-b border-slate-200 px-3 py-1.5 text-right font-mono font-bold tabular-nums text-indigo-800">
                    {percent(counts.rate)}
                  </td>
                  <td className="border-b border-slate-200 px-3 py-1.5">
                    <StatusBar counts={counts} />
                  </td>
                  <td className="border-b border-slate-200 px-3 py-1.5 text-right tabular-nums text-emerald-700">{counts.established}</td>
                  <td className="border-b border-slate-200 px-3 py-1.5 text-right tabular-nums text-amber-700">{counts.drafting}</td>
                  <td className="border-b border-slate-200 px-3 py-1.5 text-right tabular-nums text-rose-700">{counts.notStarted}</td>
                  <td className="border-b border-slate-200 px-3 py-1.5 text-right tabular-nums text-slate-400">{counts.unknown}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Skeleton rows={8} />
        )}
      </Block>

      {/* 2. 地域 × 列 */}
      <Block
        title="地域ブロック別の整備率"
        description="行は所在地の地域ブロック、列は比較項目。セルは確認済み機関のうち整備済みの割合（濃いほど高い）。括弧は整備済み / 確認済み。"
      >
        {loaded ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-semibold text-slate-600">
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2">地域</th>
                  {columns.map((column) => (
                    <th key={column.policyItemId} title={column.fullLabel} className="min-w-[84px] border-b border-r border-slate-200 px-1 py-2 text-center">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regionMatrix.map((row) => (
                  <tr key={row.block}>
                    <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-1.5 text-left font-semibold text-slate-900">
                      {row.block}
                      <span className="ml-1 text-[10px] font-normal text-slate-400">{row.institutions}機関</span>
                    </th>
                    {columns.map((column) => {
                      const counts = row.counts[column.policyItemId];
                      return (
                        <td
                          key={column.policyItemId}
                          className="border-b border-r border-slate-200 px-1 py-1.5 text-center font-mono text-[11px]"
                          style={rateCell(counts.rate)}
                          title={`整備済み ${counts.established} / 確認済み ${counts.confirmed}（未確認 ${counts.unknown}）`}
                        >
                          {percent(counts.rate)}
                          <span className="block text-[9px] opacity-80">
                            {counts.established}/{counts.confirmed}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Skeleton rows={5} />
        )}
      </Block>

      {/* 3. 機関ランキング */}
      <Block
        title="機関ごとの支援充実度"
        description="整備済みの列数が多い順。同数なら確認済みの多い順。未確認が多い機関は、充実度が低いのではなく調べきれていない。"
      >
        {loaded ? (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="sticky top-0 z-10 bg-slate-50 text-[10px] font-semibold text-slate-600">
                  <th className="border-b border-slate-200 px-3 py-2 text-right">#</th>
                  <th className="border-b border-slate-200 px-3 py-2">研究機関</th>
                  <th className="border-b border-slate-200 px-3 py-2">種別 / 地域</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">整備済み</th>
                  <th className="w-[26%] border-b border-slate-200 px-3 py-2">内訳</th>
                  <th className="border-b border-slate-200 px-3 py-2">整備済みの項目</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, index) => (
                  <tr key={row.institution.institutionId} className="hover:bg-slate-50/70">
                    <td className="border-b border-slate-200 px-3 py-1.5 text-right font-mono text-slate-400">{index + 1}</td>
                    <td className="border-b border-slate-200 px-3 py-1.5 font-semibold text-slate-900">
                      <Link href={`/institutions/${row.institution.institutionId}`} className="hover:text-indigo-700">
                        {row.institution.name}
                      </Link>
                    </td>
                    <td className="border-b border-slate-200 px-3 py-1.5 text-[11px] text-slate-500">
                      {INSTITUTION_TYPE_LABEL[row.institution.type] ?? row.institution.type} · {regionBlockOf(row.institution.region)}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-1.5 text-right font-mono font-bold tabular-nums text-slate-900">
                      {row.counts.established}
                      <span className="text-[10px] font-normal text-slate-400"> / {columns.length}</span>
                    </td>
                    <td className="border-b border-slate-200 px-3 py-1.5">
                      <StatusBar counts={row.counts} />
                    </td>
                    <td className="border-b border-slate-200 px-3 py-1.5">
                      <ColumnChips columns={row.establishedColumns} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Skeleton rows={10} />
        )}
      </Block>

      {/* 4. 提案余地 */}
      <Block
        title="AMDが提案できる余地（ギャップ）"
        description="根拠を見た上で未整備・検討中と分かっている項目の多い順。ここが AMD の支援メニューになる。未確認は余地に数えない（調べてから判断する）。"
      >
        {loaded ? (
          gaps.length ? (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="sticky top-0 z-10 bg-slate-50 text-[10px] font-semibold text-slate-600">
                    <th className="border-b border-slate-200 px-3 py-2">研究機関</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-right">余地</th>
                    <th className="border-b border-slate-200 px-3 py-2">未整備・検討中の項目</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-right">未確認</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((row) => (
                    <tr key={row.institution.institutionId} className="hover:bg-slate-50/70">
                      <td className="border-b border-slate-200 px-3 py-1.5 font-semibold text-slate-900">
                        <Link href={`/institutions/${row.institution.institutionId}`} className="hover:text-indigo-700">
                          {row.institution.name}
                        </Link>
                        <span className="ml-1.5 text-[10px] font-normal text-slate-400">{regionBlockOf(row.institution.region)}</span>
                      </td>
                      <td className="border-b border-slate-200 px-3 py-1.5 text-right font-mono font-bold tabular-nums text-amber-800">
                        {row.gapColumns.length}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-1.5">
                        <ColumnChips columns={row.gapColumns} tone="border-amber-200 bg-amber-50 text-amber-800" />
                      </td>
                      <td className="border-b border-slate-200 px-3 py-1.5 text-right tabular-nums text-slate-400">{row.unknownColumns.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-slate-500">未整備・検討中と分かっている項目を持つ機関はまだない。</p>
          )
        ) : (
          <Skeleton rows={6} />
        )}
      </Block>

      {/* 5. 型の分布 */}
      <Block
        title="制度の型の分布"
        description="退職・卒業後の期限、更新、呼称、規程主体などの属性を、値の先頭の語で束ねて数える。括弧は代表機関。"
      >
        {loaded ? (
          attributeBuckets.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {attributeBuckets.map(({ item, buckets, unknown, confirmed }) => (
                <div key={item.policyItemId} className="border border-slate-200 bg-white">
                  <div className="flex items-baseline justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                    <h4 className="text-xs font-bold text-slate-900">{item.label}</h4>
                    <span className="text-[10px] text-slate-500">確認済み {confirmed} · 未確認 {unknown}</span>
                  </div>
                  {buckets.length ? (
                    <ul className="divide-y divide-slate-100">
                      {buckets.map((bucket) => (
                        <li key={bucket.label} className="grid grid-cols-[minmax(120px,1fr)_60px_minmax(140px,1.4fr)] items-center gap-2 px-3 py-1.5 text-xs">
                          <span className="truncate font-semibold text-slate-800" title={bucket.label}>{bucket.label}</span>
                          <span className="text-right font-mono tabular-nums text-slate-900">
                            {bucket.count}
                            <span className="text-[10px] text-slate-400"> / {confirmed}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 flex-1 bg-slate-100">
                              <span className="block h-full bg-indigo-500" style={{ width: `${confirmed ? (bucket.count / confirmed) * 100 : 0}%` }} />
                            </span>
                            <span className="truncate text-[10px] text-slate-500" title={bucket.examples.join("、")}>{bucket.examples.join("、")}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-4 text-center text-xs text-slate-500">値が入っている機関がまだない</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-slate-500">属性項目がまだ登録されていない。</p>
          )
        ) : (
          <Skeleton rows={4} />
        )}
      </Block>
    </section>
  );
}

function Block({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{description}</p>
      </div>
      <div className="overflow-hidden border border-slate-200 bg-white">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0">
      <dt className="text-[10px] text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-base font-bold tabular-nums text-slate-950">{value}</dd>
    </div>
  );
}

function StatusBar({ counts }: { counts: StatusCounts }) {
  const width = (n: number) => `${counts.total ? (n / counts.total) * 100 : 0}%`;
  return (
    <div
      className="flex h-2 w-full overflow-hidden bg-slate-100"
      role="img"
      aria-label={`整備済み${counts.established}、検討中${counts.drafting}、未整備${counts.notStarted}、未確認${counts.unknown}`}
    >
      <span className="bg-emerald-500" style={{ width: width(counts.established) }} />
      <span className="bg-amber-400" style={{ width: width(counts.drafting) }} />
      <span className="bg-rose-400" style={{ width: width(counts.notStarted) }} />
    </div>
  );
}

function ColumnChips({ columns, tone }: { columns: InstitutionScore["establishedColumns"]; tone: string }) {
  if (!columns.length) return <span className="text-[10px] text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {columns.map((column) => (
        <span key={column.policyItemId} className={`border px-1 py-px text-[10px] ${tone}`} title={column.fullLabel}>
          {column.label}
        </span>
      ))}
    </span>
  );
}

// 凡例用に status の色を再利用する (未使用警告を避けるための参照ではなく、実際の凡例)
export function AnalysisLegend() {
  return (
    <ul className="flex flex-wrap gap-1.5 text-[10px]">
      {(["established", "drafting", "not_started", "unknown"] as const).map((status) => (
        <li key={status} className={`border px-1.5 py-0.5 font-semibold ${POLICY_STATUS_TONE[status]}`}>
          {POLICY_STATUS_LABEL[status]}
        </li>
      ))}
    </ul>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2">
          <span className="h-3 w-40 animate-pulse rounded bg-slate-100" />
          <span className="h-2 flex-1 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
