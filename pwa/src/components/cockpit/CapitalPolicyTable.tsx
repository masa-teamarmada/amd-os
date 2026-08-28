"use client";

import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildCapitalPolicyTable,
  type CapitalPolicyCell,
  type CompanyOverviewData,
} from "@/lib/company-overview";

/**
 * 正式な資本政策表。まさが実務で使っている cap table 雛形（captable_240819.xlsx）と
 * 同じ項目構成で、ラウンドを列・株主を行に並べる。
 * 表示するのは confirmed の株式イベントだけで、計画ラウンドは事業計画タブが正本。
 */

type MetricKind = "shares" | "yen" | "pct";
type Metric = { key: keyof CapitalPolicyCell; label: string; kind: MetricKind; compact: boolean };

const METRICS: Metric[] = [
  { key: "newShares", label: "新規割当分", kind: "shares", compact: false },
  { key: "shares", label: "発行済株数", kind: "shares", compact: true },
  { key: "paidInYen", label: "払込金額", kind: "yen", compact: false },
  { key: "ownershipPct", label: "顕在株比率", kind: "pct", compact: true },
  { key: "newOptions", label: "新規発行SO", kind: "shares", compact: false },
  { key: "options", label: "発行済SO", kind: "shares", compact: false },
  { key: "dilutedPct", label: "潜在込比率", kind: "pct", compact: true },
];

function formatShares(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0";
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString("ja-JP", { maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2 });
}

function formatYen(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0";
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "－";
  return `${value.toFixed(2)}%`;
}

function formatYenOrDash(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "－";
  return `${Math.round(Number(value)).toLocaleString("ja-JP")}円`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replaceAll("-", "/");
  if (/^\d{6}$/.test(value)) return `${value.slice(0, 4)}/${value.slice(4)}`;
  return value;
}

function metricValue(cell: CapitalPolicyCell | undefined, metric: Metric) {
  if (!cell || !cell.present) return "－";
  const value = Number(cell[metric.key] ?? 0);
  if (metric.kind === "pct") return formatPct(value);
  if (metric.kind === "yen") return formatYen(value);
  return formatShares(value);
}

function metricTone(cell: CapitalPolicyCell | undefined, metric: Metric) {
  if (!cell || !cell.present) return "text-slate-300";
  const value = Number(cell[metric.key] ?? 0);
  if (value < 0) return "text-rose-600";
  if (value === 0) return "text-slate-400";
  return "text-slate-800";
}

/**
 * ラウンド一覧。資本政策表の列にならない計画ラウンド・J-KISS検討なども含めて、
 * 登録済みのラウンドを全件表にする。株式イベント台帳が無いPJではこれが唯一の表になる。
 */
export function CapitalRoundsTable({ data, showLedgerHint = false }: { data: CompanyOverviewData; showLedgerHint?: boolean }) {
  const rounds = [...data.rounds]
    .sort((a, b) => String(a.round_date || a.round_ym || "").localeCompare(String(b.round_date || b.round_ym || "")))
    .reduce<{ round: (typeof data.rounds)[number]; cumulativeYen: number }[]>((acc, round) => {
      const cumulativeYen = (acc.at(-1)?.cumulativeYen || 0) + Number(round.raised_yen || 0);
      acc.push({ round, cumulativeYen });
      return acc;
    }, []);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-xs">
        <thead className="bg-slate-50 text-[11px] text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left font-medium">日付</th>
            <th className="px-3 py-3 text-left font-medium">ラウンド</th>
            <th className="px-3 py-3 text-right font-medium">発行価額</th>
            <th className="px-3 py-3 text-right font-medium">調達金額</th>
            <th className="px-3 py-3 text-right font-medium">累計調達金額</th>
            <th className="px-3 py-3 text-right font-medium">プレ時価総額</th>
            <th className="px-3 py-3 text-right font-medium">ポスト時価総額</th>
            <th className="px-4 py-3 text-left font-medium">リード投資家</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rounds.map(({ round, cumulativeYen }) => {
            return (
              <tr key={round.id}>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{formatDate(round.round_date || round.round_ym)}</td>
                <td className="px-3 py-3 font-medium text-slate-900">{round.round_name || "名称未入力"}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatYenOrDash(round.price_per_share_yen)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatYenOrDash(round.raised_yen)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-500">{formatYenOrDash(cumulativeYen)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatYenOrDash(round.pre_money_yen)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatYenOrDash(round.post_money_yen)}</td>
                <td className="px-4 py-3 text-slate-600">{round.lead_investor || "－"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {showLedgerHint && (
        <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-5 text-slate-500">
          株主別の内訳を出すには、株式イベント（設立・新株発行・譲渡など）の登録が必要だよ。登録すると、この上にラウンド別の資本政策表が出る。
        </p>
      )}
    </div>
  );
}

export function CapitalPolicyTable({ data }: { data: CompanyOverviewData }) {
  const [showDeltas, setShowDeltas] = useState(true);
  const table = useMemo(() => buildCapitalPolicyTable(data), [data]);
  const metrics = showDeltas ? METRICS : METRICS.filter((metric) => metric.compact);

  if (table.columns.length === 0) return null;

  const span = metrics.length;
  const summaryRows: { label: string; value: (column: (typeof table.columns)[number]) => string; strong?: boolean }[] = [
    { label: "発行価額", value: (column) => formatYenOrDash(column.pricePerShareYen) },
    { label: "調達金額", value: (column) => formatYenOrDash(column.raisedYen) },
    { label: "累計調達金額", value: (column) => formatYenOrDash(column.cumulativeRaisedYen) },
    { label: "プレ時価総額（顕在）", value: (column) => formatYenOrDash(column.preMoneyYen) },
    { label: "ポスト時価総額（顕在）", value: (column) => formatYenOrDash(column.postMoneyYen), strong: true },
    { label: "ポスト時価総額（潜在込）", value: (column) => formatYenOrDash(column.postMoneyDilutedYen) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <p className="text-[11px] leading-5 text-slate-500">
          確定済みの株式イベントだけを時系列に積み上げた実績値。計画中のラウンドは事業計画タブの資本政策プランが正本。
        </p>
        <Button variant="outline" className="h-9 shrink-0 text-xs" onClick={() => setShowDeltas((value) => !value)}>
          {showDeltas ? "増減・払込の列を隠す" : "全項目を表示"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table data-testid="capital-policy-table" className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-30 h-[74px] min-w-[150px] sm:min-w-[200px] border-b border-r border-slate-200 bg-slate-50 px-4 text-left align-bottom text-[11px] font-medium text-slate-500"
              >
                <span className="block pb-1.5">株主</span>
              </th>
              {table.columns.map((column) => (
                <th
                  key={`round-${column.id}`}
                  colSpan={span}
                  className="h-[46px] border-b border-r border-slate-200 bg-slate-100 px-3 text-center align-middle text-[11px] font-semibold text-slate-900"
                >
                  <span className="block leading-4">{column.roundLabel}</span>
                  <span className="block text-[10px] font-normal leading-4 text-slate-500">
                    {formatDate(column.effectiveOn)}
                    {column.shareClasses.length > 0 && <span className="ml-1 text-slate-400">/ {column.shareClasses.join("・")}</span>}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              {table.columns.map((column) =>
                metrics.map((metric, index) => (
                  <th
                    key={`metric-${column.id}-${metric.key}`}
                    className={`h-[28px] min-w-[92px] whitespace-nowrap border-b border-slate-200 bg-white px-3 text-right align-middle text-[10px] font-medium text-slate-500 ${index === metrics.length - 1 ? "border-r" : ""}`}
                  >
                    {metric.label}
                  </th>
                )),
              )}
            </tr>
          </thead>

          <tbody>
            {table.groups.map((group) => (
              <Fragment key={`group-${group.holderType}`}>
                <tr>
                  {/* 区分見出しは1セルに閉じる。全列を1つのthで span すると、横スクロール時に sticky が効かない */}
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-200 bg-slate-100 px-4 py-1.5 text-left text-[10px] font-semibold text-slate-500"
                  >
                    <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: group.color }} />
                    {group.label}
                  </th>
                  <td colSpan={table.columns.length * span} className="border-b border-slate-200 bg-slate-100" />
                </tr>

                {group.holderNames.map((holderName) => (
                  <tr key={`holder-${group.holderType}-${holderName}`} className="hover:bg-slate-50/60">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-1.5 text-left text-[11px] font-normal text-slate-700"
                    >
                      {holderName}
                    </th>
                    {table.columns.map((column) =>
                      metrics.map((metric, index) => (
                        <td
                          key={`cell-${column.id}-${holderName}-${metric.key}`}
                          className={`border-b border-slate-100 px-3 py-1.5 text-right tabular-nums ${metricTone(column.cells[holderName], metric)} ${index === metrics.length - 1 ? "border-r border-r-slate-200" : ""}`}
                        >
                          {metricValue(column.cells[holderName], metric)}
                        </td>
                      )),
                    )}
                  </tr>
                ))}

                <tr className="bg-slate-50/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-4 py-1.5 text-left text-[11px] font-medium text-slate-600"
                  >
                    {group.label} 小計
                  </th>
                  {table.columns.map((column, columnIndex) =>
                    metrics.map((metric, index) => (
                      <td
                        key={`subtotal-${column.id}-${group.holderType}-${metric.key}`}
                        className={`border-b border-slate-200 px-3 py-1.5 text-right font-medium tabular-nums text-slate-700 ${index === metrics.length - 1 ? "border-r" : ""}`}
                      >
                        {metricValue(group.subtotals[columnIndex], metric)}
                      </td>
                    )),
                  )}
                </tr>
              </Fragment>
            ))}

            <tr className="bg-slate-100">
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-100 px-4 py-2 text-left text-[11px] font-semibold text-slate-900"
              >
                合計
              </th>
              {table.columns.map((column) =>
                metrics.map((metric, index) => (
                  <td
                    key={`total-${column.id}-${metric.key}`}
                    className={`border-b border-slate-300 px-3 py-2 text-right font-semibold tabular-nums text-slate-900 ${index === metrics.length - 1 ? "border-r" : ""}`}
                  >
                    {metricValue(column.total, metric)}
                  </td>
                )),
              )}
            </tr>

            {summaryRows.map((row) => (
              <tr key={`summary-${row.label}`} className={row.strong ? "bg-slate-50" : ""}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-1.5 text-left text-[11px] ${row.strong ? "bg-slate-50 font-semibold text-slate-900" : "bg-white font-normal text-slate-600"}`}
                >
                  {row.label}
                </th>
                {table.columns.map((column) => (
                  <td
                    key={`summary-${row.label}-${column.id}`}
                    colSpan={span}
                    className={`border-b border-r border-slate-200 px-3 py-1.5 text-right tabular-nums ${row.strong ? "font-semibold text-slate-900" : "text-slate-700"}`}
                  >
                    {row.value(column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
