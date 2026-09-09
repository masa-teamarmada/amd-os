"use client";

/**
 * 事業計画タブの月次試算表 (BZM 2.2 暫定試算が無いPJ向け)。
 *
 * 2026-08-13 に月次試算表を事業計画タブへ移設した時点では、表は BZM 2.2 暫定試算を持つPJ
 * (`Bzm22TimeLedgerSection`) だけに出て、暫定試算が無いPJでは何も出ていなかった。
 * SE / ZMP / RTM / SMILE のような顧問・新規事業PJでも `project_pl_monthly` に登録済みの
 * 数字をそのまま読めるようにする (2026-09-09 まさ「試算表のタブをSEにも作って」)。
 *
 * 暫定試算があるPJでは `Bzm22TimeLedgerSection` が同じ表を時間軸つきで出すので、
 * このセクションは自分から何も描かない (表が二重に出ない)。
 */

import { useEffect, useMemo, useState } from "react";
import { Bzm22PilotNotFoundError, getCachedBzm22Pilot, loadBzm22Pilot } from "./bzm-2-2-pilot-client";
import { getCachedPlMonthly, loadPlMonthly } from "./pl-monthly-client";
import type { ProjectPlMonthly } from "@/lib/venture-status-data";

/** 行の出所。`notes` の先頭に書いた区分から読む。 */
type Provenance = "actual" | "estimate" | "outlook" | "unknown";

const PROVENANCE_META: Record<Provenance, { label: string; className: string }> = {
  actual: { label: "実績", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  estimate: { label: "推定", className: "border-amber-200 bg-amber-50 text-amber-800" },
  outlook: { label: "見込", className: "border-sky-200 bg-sky-50 text-sky-800" },
  unknown: { label: "区分なし", className: "border-slate-200 bg-slate-50 text-slate-600" },
};

function provenanceOf(notes: string | null): Provenance {
  const head = (notes ?? "").trimStart();
  if (head.startsWith("実績")) return "actual";
  if (head.startsWith("推定")) return "estimate";
  if (head.startsWith("見込")) return "outlook";
  return "unknown";
}

/** 4月始まりの年度。2024-03 は FY23 に入る。 */
function fiscalYearOf(ym: string): number {
  const [year, month] = ym.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

function operatingProfitOf(row: ProjectPlMonthly): number {
  return (
    Number(row.revenue_yen) -
    Number(row.cogs_yen) -
    Number(row.personnel_yen) -
    Number(row.rd_yen) -
    Number(row.marketing_yen) -
    Number(row.other_opex_yen)
  );
}

/** 円 → 万円。表は万円で読む方が桁を追いやすい。 */
function man(yen: number): string {
  if (yen === 0) return "—";
  const value = Math.round(yen / 10000);
  if (value === 0) return "0";
  return value.toLocaleString();
}

interface Metric {
  key: string;
  label: string;
  of: (row: ProjectPlMonthly) => number;
  emphasis?: boolean;
  calculated?: boolean;
}

const METRICS: Metric[] = [
  { key: "revenue", label: "売上", of: (r) => Number(r.revenue_yen) },
  { key: "cogs", label: "売上原価", of: (r) => Number(r.cogs_yen) },
  { key: "gross", label: "粗利", of: (r) => Number(r.revenue_yen) - Number(r.cogs_yen), calculated: true },
  { key: "personnel", label: "人件費", of: (r) => Number(r.personnel_yen) },
  { key: "rd", label: "研究開発費", of: (r) => Number(r.rd_yen) },
  { key: "marketing", label: "販売促進費", of: (r) => Number(r.marketing_yen) },
  { key: "other", label: "その他販管費", of: (r) => Number(r.other_opex_yen) },
  { key: "operating", label: "営業利益", of: operatingProfitOf, emphasis: true, calculated: true },
];

interface FiscalYearGroup {
  fiscalYear: number;
  label: string;
  rows: ProjectPlMonthly[];
  provenance: Provenance;
  totals: Record<string, number>;
}

function groupByFiscalYear(rows: ProjectPlMonthly[]): FiscalYearGroup[] {
  const buckets = new Map<number, ProjectPlMonthly[]>();
  for (const row of rows) {
    const fiscalYear = fiscalYearOf(row.ym);
    const bucket = buckets.get(fiscalYear);
    if (bucket) bucket.push(row);
    else buckets.set(fiscalYear, [row]);
  }
  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([fiscalYear, bucketRows]) => {
      const counts = new Map<Provenance, number>();
      for (const row of bucketRows) {
        const kind = provenanceOf(row.notes);
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
      const provenance = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "unknown";
      const totals: Record<string, number> = {};
      for (const metric of METRICS) {
        totals[metric.key] = bucketRows.reduce((sum, row) => sum + metric.of(row), 0);
      }
      return {
        fiscalYear,
        label: `FY${String(fiscalYear).slice(2)}`,
        rows: [...bucketRows].sort((left, right) => left.ym.localeCompare(right.ym)),
        provenance,
        totals,
      };
    });
}

/**
 * 全期間ゼロの費目は列から落とす (PJによって使う費目が違うので、空列を並べない)。
 * 売上と計算項目 (粗利・営業利益) は、ゼロでも読み筋として残す。
 */
function visibleMetrics(rows: ProjectPlMonthly[]): Metric[] {
  return METRICS.filter(
    (metric) =>
      metric.key === "revenue" ||
      metric.calculated ||
      rows.some((row) => metric.of(row) !== 0),
  );
}

function signClass(value: number): string {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-600";
  return "text-slate-500";
}

function ProvenanceBadge({ kind }: { kind: Provenance }) {
  const meta = PROVENANCE_META[kind];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${meta.className}`}>
      {meta.label}
    </span>
  );
}

/** 年度サマリ: 行 = 年度、列 = 項目。まず全体の形を見る。 */
function FiscalYearSummary({ groups, metrics }: { groups: FiscalYearGroup[]; metrics: Metric[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-50">
            <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600">年度</th>
            <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600">出所</th>
            {metrics.map((metric) => (
              <th key={metric.key} className="border-b border-slate-200 px-2 py-1.5 text-right font-semibold text-slate-600">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.fiscalYear} className="hover:bg-slate-50/70">
              <th scope="row" className="whitespace-nowrap border-b border-slate-100 px-2 py-1.5 text-left font-mono font-semibold text-slate-800">
                {group.label}
              </th>
              <td className="border-b border-slate-100 px-2 py-1.5">
                <ProvenanceBadge kind={group.provenance} />
              </td>
              {metrics.map((metric) => (
                <td
                  key={metric.key}
                  className={`border-b border-slate-100 px-2 py-1.5 text-right font-mono tabular-nums ${
                    metric.emphasis ? `font-semibold ${signClass(group.totals[metric.key])}` : "text-slate-700"
                  } ${metric.calculated ? "bg-slate-50/60" : ""}`}
                >
                  {man(group.totals[metric.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 月次: 行 = 項目、列 = 月。年度の切れ目に区切り線を入れる。 */
function MonthlyPivot({ groups, metrics }: { groups: FiscalYearGroup[]; metrics: Metric[] }) {
  const columns = useMemo(
    () => groups.flatMap((group) => group.rows.map((row, index) => ({ row, group, isFirstOfYear: index === 0 }))),
    [groups],
  );

  return (
    <div className="overflow-x-auto" data-testid="cockpit-pl-monthly-scroll">
      <table className="border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-[104px] border-b border-r border-slate-200 bg-white px-2 py-1.5 text-left font-semibold text-slate-600">
              年度
            </th>
            {columns.map(({ row, group, isFirstOfYear }) => (
              <th
                key={`fy-${row.ym}`}
                className={`min-w-[62px] border-b border-slate-200 bg-white px-1.5 py-1.5 text-center font-mono text-[10px] text-slate-500 ${
                  isFirstOfYear ? "border-l border-slate-300" : ""
                }`}
              >
                {isFirstOfYear ? group.label : ""}
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-white px-2 py-1.5 text-left font-semibold text-slate-600">
              項目
            </th>
            {columns.map(({ row, isFirstOfYear }) => (
              <th
                key={`ym-${row.ym}`}
                className={`whitespace-nowrap border-b border-slate-200 bg-white px-1.5 py-1.5 text-right font-mono text-[10px] font-medium text-slate-700 ${
                  isFirstOfYear ? "border-l border-slate-300" : ""
                }`}
                title={row.notes ?? undefined}
              >
                {row.ym.slice(2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.key} className={metric.emphasis ? "border-t border-slate-300" : ""}>
              <th
                scope="row"
                className={`sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-100 bg-white px-2 py-1.5 text-left ${
                  metric.emphasis ? "font-semibold text-slate-900" : "font-medium text-slate-600"
                }`}
              >
                {metric.label}
              </th>
              {columns.map(({ row, isFirstOfYear }) => {
                const value = metric.of(row);
                return (
                  <td
                    key={`${metric.key}-${row.ym}`}
                    className={`border-b border-slate-100 px-1.5 py-1.5 text-right font-mono tabular-nums ${
                      metric.emphasis ? `font-semibold ${signClass(value)}` : "text-slate-700"
                    } ${metric.calculated ? "bg-slate-50/60" : ""} ${isFirstOfYear ? "border-l border-slate-300" : ""}`}
                  >
                    {man(value)}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 bg-white px-2 py-1.5 text-left font-medium text-slate-600">
              出所
            </th>
            {columns.map(({ row, isFirstOfYear }) => (
              <td
                key={`prov-${row.ym}`}
                className={`px-1.5 py-1.5 text-center ${isFirstOfYear ? "border-l border-slate-300" : ""}`}
                title={row.notes ?? undefined}
              >
                <ProvenanceBadge kind={provenanceOf(row.notes)} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function CockpitPlMonthlySection({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<ProjectPlMonthly[] | null>(() => getCachedPlMonthly(projectId) ?? null);
  const [error, setError] = useState("");
  // 暫定試算があるPJでは Bzm22TimeLedgerSection が同じ表を出すので、こちらは描かない。
  const [coveredByTimeLedger, setCoveredByTimeLedger] = useState<boolean>(() => Boolean(getCachedBzm22Pilot(projectId)));
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setResolved(false);
    setRows(getCachedPlMonthly(projectId) ?? null);
    setCoveredByTimeLedger(Boolean(getCachedBzm22Pilot(projectId)));

    loadBzm22Pilot(projectId)
      .then(() => {
        if (!cancelled) {
          setCoveredByTimeLedger(true);
          setResolved(true);
        }
      })
      .catch(async (cause) => {
        if (cancelled) return;
        if (!(cause instanceof Bzm22PilotNotFoundError)) {
          // 暫定試算の取得が落ちた場合も、月次試算表そのものは読めるので表は出す。
          setCoveredByTimeLedger(false);
        }
        try {
          const loaded = await loadPlMonthly(projectId);
          if (!cancelled) setRows(loaded);
        } catch (readCause) {
          if (!cancelled) setError(readCause instanceof Error ? readCause.message : "月次試算表を読み出せていない");
        } finally {
          if (!cancelled) setResolved(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const groups = useMemo(() => groupByFiscalYear(rows ?? []), [rows]);
  const metrics = useMemo(() => visibleMetrics(rows ?? []), [rows]);

  if (coveredByTimeLedger) return null;

  if (error) {
    return (
      <section data-testid="cockpit-pl-monthly-section" className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-900">
        <div className="font-semibold">月次試算表を読み出せていない</div>
        <div>{error}</div>
      </section>
    );
  }

  if (!resolved && !rows) {
    return (
      <section data-testid="cockpit-pl-monthly-section" className="grid min-h-32 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs text-slate-500 shadow-sm">
        月次試算表を読み込み中…
      </section>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <section data-testid="cockpit-pl-monthly-section" className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm leading-6 text-slate-500 shadow-sm">
        このPJの月次試算表はまだ登録されていないよ。
      </section>
    );
  }

  const span = `${groups[0].rows[0].ym} 〜 ${groups[groups.length - 1].rows.slice(-1)[0].ym}`;

  return (
    <section data-testid="cockpit-pl-monthly-section" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-slate-950">月次試算表</h3>
          <p className="text-[10px] leading-4 text-slate-600">
            4月始まりの年度で集計。出所の区分は各月のメモから読んでいる（メモは月にカーソルを当てると出る）。
          </p>
        </div>
        <div className="flex shrink-0 items-baseline gap-2 text-[10px] font-semibold text-slate-600">
          <span className="font-mono font-normal">{span}</span>
          <span>単位：万円</span>
        </div>
      </div>

      <div className="border-b border-slate-200 px-4 py-3">
        <div className="mb-1.5 text-[10px] font-semibold text-slate-700">年度別</div>
        <FiscalYearSummary groups={groups} metrics={metrics} />
      </div>

      <div className="px-4 py-3">
        <div className="mb-1.5 text-[10px] font-semibold text-slate-700">月別</div>
        <MonthlyPivot groups={groups} metrics={metrics} />
      </div>
    </section>
  );
}
