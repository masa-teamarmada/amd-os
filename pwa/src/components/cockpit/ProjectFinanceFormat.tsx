"use client";

/**
 * 試算表タブの標準フォーマット。大学発SU・新規事業・顧問の全PJで、同じ区画を同じ順に描く
 * （区画・行・グラフの定義は src/lib/project-formats.ts、正本は spec 3-23）。
 *
 * - PJ番号で表示を分けない。PJごとの違いはデータ（どの計画・どの行に値があるか）だけで出る。
 * - データが無い区画も消さずに「未登録」と出す（無いのか遅いのかを読み手が区別できるように）。
 * - 新しい種類の数字は src/lib/project-finance-format.ts で標準の行へ流し込む。区画を足さない。
 */

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Bzm22PilotProject, Bzm22TimelineItem } from "@/lib/bzm-2-2-pilot-ui";
import {
  FINANCE_ANNUAL_ROWS,
  FINANCE_CASH_ROWS,
  FINANCE_CHARTS,
  FINANCE_FORMAT_SECTIONS,
  FINANCE_PL_ROWS,
  FINANCE_SUMMARY_ITEMS,
  FINANCE_UNIT_LABEL,
  type FinanceCashRowKey,
  type FinanceFormatSectionKey,
  type FinancePlRowKey,
} from "@/lib/project-formats";
import {
  addMonths,
  buildFinanceTimelineItems,
  buildPlanFinanceDatasets,
  buildRegisteredFinanceDataset,
  financeAnnualRows,
  financeMonthFigures,
  financeSummary,
  monthsBetween,
  orderFinanceDatasets,
  readCapitalPlanFinanceInputs,
  type FinanceAnnualRow,
  type FinanceCellNote,
  type FinanceDataset,
  type FinanceFundingEvent,
  type FinanceMonth,
  type FinanceMonthFigures,
} from "@/lib/project-finance-format";
import { deletePlMonthly, upsertPlMonthly, type ProjectPlMonthly } from "@/lib/venture-status-data";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CockpitPlHearingModal } from "./CockpitPlHearingModal";
import { getCachedBzm22Pilot, loadBzm22Pilot } from "./bzm-2-2-pilot-client";
import { getCachedPlMonthly, invalidatePlMonthlyCache, loadPlMonthly } from "./pl-monthly-client";
import {
  getCachedFinanceCapitalPlan,
  getCachedFinanceCashflow,
  getCachedFinanceFoundedAt,
  getCachedFinanceGrants,
  loadFinanceCapitalPlan,
  loadFinanceCashflow,
  loadFinanceFoundedAt,
  loadFinanceGrants,
  type FinanceGrantEvidence,
} from "./finance-format-client";

const MONTH_WIDTH = 76;
const AXIS_Y = 61;
const TIMELINE_HEIGHT = 101;
const CASH_CHART_HEIGHT = 150;

const CATEGORY_META: Record<Bzm22TimelineItem["category"], { label: string; color: string }> = {
  registered_policy: { label: "登録方針", color: "#24596a" },
  technical: { label: "技術", color: "#2f6f87" },
  facility: { label: "設備・量産", color: "#2f766b" },
  commercial: { label: "事業・商流", color: "#675a3b" },
  funding_external: { label: "資金", color: "#8b6227" },
};

const COLORS = {
  revenue: "#2f6f87",
  expense: "#9aa9ad",
  inflow: "#2f6f87",
  outflow: "#9aa9ad",
  line: "#b98025",
};

interface AxisCell {
  index: number;
  ym: string;
  calendarMonth: number;
  /** 試算（BZM）の評価月からの月数。試算が無い・評価月より前なら null。 */
  mLabel: string | null;
}

interface EventGroup {
  monthIndex: number;
  items: Bzm22TimelineItem[];
  position: number;
}

interface Draft {
  id?: string;
  ym: string;
  revenue_yen: string;
  cogs_yen: string;
  personnel_yen: string;
  rd_yen: string;
  marketing_yen: string;
  other_opex_yen: string;
  notes: string;
}

function formatMillionFromYen(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return "—";
  const amount = Math.abs(value) / 1_000_000;
  const formatted = amount.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  return value < 0 ? `(${formatted})` : formatted;
}

function formatMillion(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) return "—";
  const formatted = Math.abs(value).toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  return value < 0 ? `(${formatted})` : formatted;
}

function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatYm(ym: string | null): string {
  if (!ym) return "—";
  const [year, month] = ym.split("-");
  return `${year}年${Number(month)}月`;
}

function buildAxis(startYm: string, endYm: string, valuationYm: string | null): AxisCell[] {
  const length = Math.max(0, monthsBetween(startYm, endYm)) + 1;
  return Array.from({ length }, (_, index) => {
    const ym = addMonths(startYm, index);
    const offset = valuationYm ? monthsBetween(valuationYm, ym) : null;
    return {
      index,
      ym,
      calendarMonth: Number(ym.slice(5, 7)),
      mLabel: offset !== null && offset >= 0 ? `M${offset}` : null,
    };
  });
}

function buildEventGroups(
  items: readonly Bzm22TimelineItem[],
  axis: readonly AxisCell[],
  pilot: Bzm22PilotProject | null,
) {
  const valuationYm = pilot ? pilot.valuationDate.slice(0, 7) : null;
  const indexByYm = new Map(axis.map((cell) => [cell.ym, cell.index]));
  const groups = new Map<number, Bzm22TimelineItem[]>();
  let outside = 0;
  let undated = 0;
  for (const item of items) {
    const gate = pilot?.calculationTrace.inputs.gates.find((candidate) => candidate.label === item.label);
    const ym = gate && valuationYm ? addMonths(valuationYm, gate.month) : item.startDate?.slice(0, 7) ?? null;
    if (!ym) {
      undated += 1;
      continue;
    }
    const index = indexByYm.get(ym);
    if (index === undefined) {
      outside += 1;
      continue;
    }
    groups.set(index, [...(groups.get(index) ?? []), item]);
  }
  const lastMonthByPosition = [-99, -99];
  const preferredPositions = [0, 1];
  const positioned: EventGroup[] = [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([monthIndex, groupItems], order) => {
      const preference = preferredPositions[order % preferredPositions.length];
      const available = preferredPositions.find((position) => monthIndex - lastMonthByPosition[position] >= 3);
      const position = available ?? preferredPositions.reduce((best, candidate) =>
        lastMonthByPosition[candidate] < lastMonthByPosition[best] ? candidate : best, preference);
      lastMonthByPosition[position] = monthIndex;
      return { monthIndex, items: groupItems, position };
    });
  return { positioned, outside, undated };
}

function draftFromMonth(ym: string, row: ProjectPlMonthly | null): Draft {
  const toMillion = (value: number | undefined) => String((Number(value) || 0) / 1_000_000);
  return {
    id: row?.id,
    ym,
    revenue_yen: toMillion(row?.revenue_yen),
    cogs_yen: toMillion(row?.cogs_yen),
    personnel_yen: toMillion(row?.personnel_yen),
    rd_yen: toMillion(row?.rd_yen),
    marketing_yen: toMillion(row?.marketing_yen),
    other_opex_yen: toMillion(row?.other_opex_yen),
    notes: row?.notes ?? "",
  };
}

function currentYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// --- 部品 ------------------------------------------------------------------------

function MonthCellFrame({ cell, children = null, className = "" }: { cell: AxisCell; children?: ReactNode; className?: string }) {
  const yearBoundary = cell.calendarMonth === 1 || cell.index === 0;
  return (
    <div className={`min-w-0 border-b border-r border-slate-200 ${yearBoundary ? "border-l border-l-slate-400" : ""} ${className}`}>
      {children}
    </div>
  );
}

function CellNotes({ notes, ym, label }: { notes: readonly FinanceCellNote[]; ym: string; label: string }) {
  if (notes.length === 0) return null;
  const hasObserved = notes.some((note) => note.evidenceState === "observed");
  return (
    <Tooltip>
      <TooltipTrigger
        closeOnClick={false}
        aria-label={`${ym} ${label}の変動理由`}
        data-testid="finance-cell-note"
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-[8px] font-bold ${hasObserved ? "text-cyan-800" : "text-amber-700"}`}
      >
        ◆
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="end"
        className="block w-80 max-w-[calc(100vw-24px)] rounded-sm border border-[#365865] bg-[#173f51] px-3 py-2 text-left text-[11px] leading-4 text-white shadow-xl"
      >
        <div className="mb-1 border-b border-white/20 pb-1 font-semibold">{ym} · {label}</div>
        <div className="space-y-1.5">
          {notes.map((note) => (
            <div key={note.id}>
              <div className="font-semibold">
                <span className="mr-1 text-[9px] text-cyan-100">{note.evidenceState === "observed" ? "観測" : "計画"}</span>
                {note.title}
              </div>
              <div className="text-slate-200">{note.detail}</div>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function EventCard({ group, axis, selected, onSelect }: { group: EventGroup; axis: readonly AxisCell[]; selected: boolean; onSelect: () => void }) {
  const category = CATEGORY_META[group.items[0].category];
  const eventTitle = group.items.map((item) => item.label).join(" / ");
  const topSide = group.position === 0;
  const top = topSide ? 27 : 70;
  const cardHeight = 23;
  const cardX = group.monthIndex * MONTH_WIDTH + MONTH_WIDTH / 2;
  const transform = group.monthIndex === 0 ? "translateX(0)" : group.monthIndex === axis.length - 1 ? "translateX(-100%)" : "translateX(-50%)";
  const connectorTop = topSide ? top + cardHeight : AXIS_Y;
  const connectorHeight = topSide ? AXIS_Y - connectorTop : top - AXIS_Y;
  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        className={`absolute z-20 flex items-center whitespace-nowrap border bg-white px-1.5 text-left text-[9px] font-semibold text-[#173f51] transition-colors ${selected ? "border-[#173f51]" : "border-slate-300 hover:border-[#678692]"}`}
        style={{ left: cardX, top, width: "max-content", height: cardHeight, transform, boxShadow: selected ? "0 0 0 1px #173f51" : "none" }}
        title={eventTitle}
      >
        {eventTitle}
      </button>
      <span aria-hidden="true" className="absolute z-10 w-px bg-slate-400" style={{ left: cardX, top: connectorTop, height: Math.max(0, connectorHeight) }} />
      <button
        type="button"
        aria-label={`${axis[group.monthIndex].ym} ${eventTitle}`}
        onClick={onSelect}
        className="absolute z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 bg-white"
        style={{ left: cardX, top: AXIS_Y, borderColor: category.color }}
      />
    </>
  );
}

function SectionFrame({ sectionKey, title, aside, children, includes }: { sectionKey: FinanceFormatSectionKey; title: string; aside?: ReactNode; children: ReactNode; includes?: readonly FinanceFormatSectionKey[] }) {
  return (
    <section data-testid={`finance-format-section-${sectionKey}`} data-format-sections={(includes ?? [sectionKey]).join(" ")} aria-label={title} className="border-t border-[#d8e2e5]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 pb-1 pt-2.5 sm:px-4">
        <h4 className="text-[12px] font-semibold tracking-tight text-[#173f51]">{title}</h4>
        {aside ? <div className="text-[10px] text-slate-600">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-3 text-[11px] leading-5 text-slate-500 sm:px-4">{children}</p>;
}

// --- グラフ ------------------------------------------------------------------------

function MonthlyCashChart({ axis, figuresByYm, months, reserveYen }: {
  axis: readonly AxisCell[];
  figuresByYm: ReadonlyMap<string, FinanceMonthFigures>;
  months: ReadonlyMap<string, FinanceMonth>;
  reserveYen: number | null;
}) {
  const points = axis.flatMap((cell) => {
    const closing = months.get(cell.ym)?.cash?.closing ?? null;
    return closing === null ? [] : [{ index: cell.index, value: closing }];
  });
  const bars = axis.map((cell) => figuresByYm.get(cell.ym));
  const scaleTop = Math.max(1, reserveYen ?? 0, ...points.map((point) => point.value), ...bars.flatMap((figure) => [figure?.inflow ?? 0, figure?.outflow ?? 0]));
  const scaleBottom = Math.min(0, ...points.map((point) => point.value));
  const span = scaleTop - scaleBottom;
  const y = (value: number) => ((scaleTop - value) / span) * CASH_CHART_HEIGHT;
  const width = axis.length * MONTH_WIDTH;
  const barHeight = (value: number | null | undefined) => value && value > 0 ? Math.max(1.5, (value / span) * CASH_CHART_HEIGHT) : 0;
  const zeroY = y(0);
  return (
    <div className="relative" style={{ width, height: CASH_CHART_HEIGHT }} data-testid="finance-format-monthly-cash-plot">
      <div aria-hidden="true" className="absolute inset-x-0 border-t border-slate-400" style={{ top: zeroY }} />
      {reserveYen ? <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-slate-500" style={{ top: y(reserveYen) }} title={`${FINANCE_CHARTS.monthlyCash.guide.label} ${formatMillionFromYen(reserveYen)}百万円`} /> : null}
      {axis.map((cell) => {
        const figure = figuresByYm.get(cell.ym);
        if (!figure || (figure.inflow === null && figure.outflow === null)) return null;
        return (
          <div key={cell.ym} className="absolute flex items-end justify-center gap-0.5" style={{ left: cell.index * MONTH_WIDTH, width: MONTH_WIDTH, top: 0, height: zeroY }}>
            <div className="w-3" style={{ height: barHeight(figure.inflow), backgroundColor: COLORS.inflow }} title={`${cell.ym} ${FINANCE_CHARTS.monthlyCash.bars[0].label} ${formatMillionFromYen(figure.inflow)}百万円`} />
            <div className="w-3" style={{ height: barHeight(figure.outflow), backgroundColor: COLORS.outflow }} title={`${cell.ym} ${FINANCE_CHARTS.monthlyCash.bars[1].label} ${formatMillionFromYen(figure.outflow)}百万円`} />
          </div>
        );
      })}
      {points.length > 0 ? (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={CASH_CHART_HEIGHT}>
          <polyline
            points={points.map((point) => `${point.index * MONTH_WIDTH + MONTH_WIDTH / 2},${y(point.value)}`).join(" ")}
            fill="none"
            stroke={COLORS.line}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {points.map((point) => (
        <div
          key={point.index}
          className={`absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${point.value < 0 ? "bg-white" : ""}`}
          style={{ left: point.index * MONTH_WIDTH + MONTH_WIDTH / 2, top: y(point.value), borderColor: COLORS.line, backgroundColor: point.value < 0 ? "#fff" : COLORS.line }}
          title={`${axis[point.index].ym} ${FINANCE_CHARTS.monthlyCash.line.label} ${formatMillionFromYen(point.value)}百万円`}
        />
      ))}
    </div>
  );
}

function AnnualChart({ rows }: { rows: readonly FinanceAnnualRow[] }) {
  const scaleTop = Math.max(1, ...rows.flatMap((row) => [row.revenue, row.expense, row.net ?? 0]));
  const scaleBottom = Math.min(0, ...rows.map((row) => row.net ?? 0));
  const span = scaleTop - scaleBottom;
  const zeroTop = (scaleTop / span) * 100;
  const barHeight = (value: number) => value <= 0 ? "0%" : `${Math.max(2, (value / scaleTop) * 100)}%`;
  const points = rows.flatMap((row, index) => row.net === null ? [] : [{
    fiscalYear: row.fiscalYear,
    value: row.net,
    x: ((index + 0.5) / rows.length) * 100,
    y: ((scaleTop - row.net) / span) * 100,
  }]);
  const columnStyle = { gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` };
  return (
    <div className="mx-3 mb-3 overflow-hidden border border-[#cbd9de] bg-white sm:mx-4" data-testid="finance-format-annual-chart">
      <div className="grid border-b border-[#cbd9de] bg-[#edf3f5]" style={columnStyle}>
        {rows.map((row) => (
          <div key={row.fiscalYear} className="min-w-0 border-r border-[#cbd9de] px-1 py-1.5 text-center last:border-r-0">
            <div className="font-mono text-[11px] font-semibold tabular-nums text-[#173f51]">FY{row.fiscalYear}</div>
            <div className="mt-0.5 text-[8px] text-slate-500">{row.fiscalYear}.04–{row.fiscalYear + 1}.03</div>
          </div>
        ))}
      </div>
      <div data-testid="finance-format-annual-plot" className="relative my-3 h-44">
        <div aria-hidden="true" className="absolute inset-x-0 border-t border-slate-400" style={{ top: `${zeroTop}%` }} />
        <div aria-hidden="true" className="pointer-events-none absolute left-0.5 top-0 z-10 -translate-y-1/2 bg-white/80 px-0.5 font-mono text-[8px] leading-3 text-slate-500">{formatMillionFromYen(scaleTop)}</div>
        <div aria-hidden="true" className="pointer-events-none absolute left-0.5 z-10 -translate-y-1/2 bg-white/80 px-0.5 font-mono text-[8px] leading-3 text-slate-500" style={{ top: `${zeroTop}%` }}>0</div>
        {zeroTop < 88 ? <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0.5 z-10 translate-y-1/2 bg-white/80 px-0.5 font-mono text-[8px] leading-3 text-slate-500">{formatMillionFromYen(scaleBottom)}</div> : null}
        <div className="absolute inset-0 grid" style={columnStyle}>
          {rows.map((row) => (
            <div key={row.fiscalYear} className="relative min-w-0 border-r border-dashed border-slate-200 last:border-r-0">
              <div className="absolute inset-x-0 flex items-end justify-center gap-0.5" style={{ top: 0, height: `${zeroTop}%` }}>
                <div className="w-3 sm:w-4" style={{ height: barHeight(row.revenue), backgroundColor: COLORS.revenue }} title={`FY${row.fiscalYear} 売上 ${formatMillionFromYen(row.revenue)}百万円`} />
                <div className="w-3 sm:w-4" style={{ height: barHeight(row.expense), backgroundColor: COLORS.expense }} title={`FY${row.fiscalYear} 費用 ${formatMillionFromYen(row.expense)}百万円`} />
              </div>
            </div>
          ))}
        </div>
        {points.length > 0 ? (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={COLORS.line} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
        ) : null}
        {points.map((point) => (
          <div
            key={point.fiscalYear}
            className="absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ left: `${point.x}%`, top: `${point.y}%`, borderColor: COLORS.line, backgroundColor: point.value < 0 ? "#fff" : COLORS.line }}
            title={`FY${point.fiscalYear} 年次純C/F ${formatMillionFromYen(point.value)}百万円`}
          />
        ))}
      </div>
      <div className="grid border-t border-[#d8e2e5] bg-slate-50" style={columnStyle}>
        {rows.map((row) => (
          <div key={row.fiscalYear} className="min-w-0 border-r border-[#d8e2e5] px-1 py-1.5 text-center last:border-r-0">
            <div className={`font-mono text-[10px] font-semibold tabular-nums ${row.operatingProfit < 0 ? "text-rose-700" : "text-[#173f51]"}`}>{row.hasPl ? formatMillionFromYen(row.operatingProfit) : "—"}</div>
            <div className="mt-0.5 text-[8px] text-slate-500">営業利益</div>
            <div className={`mt-1 font-mono text-[10px] tabular-nums ${row.net !== null && row.net < 0 ? "text-rose-700" : "text-[#9a6a1d]"}`}>{formatMillionFromYen(row.net)}</div>
            <div className="mt-0.5 text-[8px] text-slate-500">年次純C/F</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 本体 ------------------------------------------------------------------------

export interface FinanceFormatViewProps {
  projectId: string;
  datasets: readonly FinanceDataset[];
  timelineItems: readonly Bzm22TimelineItem[];
  pilot: Bzm22PilotProject | null;
  incorporationYm: string | null;
  fundingEvents: readonly FinanceFundingEvent[];
  grants: readonly FinanceGrantEvidence[];
  plRows: readonly ProjectPlMonthly[];
  readOnly?: boolean;
  onPlChanged?: () => Promise<void> | void;
}

export function FinanceFormatView({
  projectId,
  datasets,
  timelineItems,
  pilot,
  incorporationYm,
  fundingEvents,
  grants,
  plRows,
  readOnly = false,
  onPlChanged,
}: FinanceFormatViewProps) {
  const ordered = useMemo(() => orderFinanceDatasets(datasets), [datasets]);
  const [datasetId, setDatasetId] = useState<string | null>(ordered[0]?.id ?? null);
  const dataset = ordered.find((candidate) => candidate.id === datasetId) ?? ordered[0] ?? null;
  const [caseKey, setCaseKey] = useState<string | null>(dataset?.cases[0]?.key ?? null);
  const activeCase = dataset?.cases.find((entry) => entry.key === caseKey) ?? dataset?.cases[0] ?? null;
  const months = useMemo(() => (dataset && activeCase ? dataset.monthsByCase[activeCase.key] ?? [] : []), [dataset, activeCase]);
  const monthByYm = useMemo(() => new Map(months.map((month) => [month.ym, month])), [months]);
  const plRowByYm = useMemo(() => new Map(plRows.map((row) => [row.ym, row])), [plRows]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hearingOpen, setHearingOpen] = useState(false);

  const valuationYm = pilot ? pilot.valuationDate.slice(0, 7) : null;
  const axis = useMemo(() => {
    let start = months[0]?.ym ?? null;
    let end = months.at(-1)?.ym ?? null;
    if (pilot && valuationYm && dataset?.kind === "registered") {
      const horizonEnd = addMonths(valuationYm, pilot.calculationTrace.inputs.horizonMonths);
      start = !start || valuationYm < start ? valuationYm : start;
      end = !end || horizonEnd > end ? horizonEnd : end;
    }
    if (!start || !end) return [] as AxisCell[];
    return buildAxis(start, end, valuationYm);
  }, [months, pilot, valuationYm, dataset?.kind]);

  const figuresByYm = useMemo(() => new Map(months.map((month) => [month.ym, financeMonthFigures(month, incorporationYm)])), [months, incorporationYm]);
  const annualRows = useMemo(() => financeAnnualRows(months, incorporationYm), [months, incorporationYm]);
  const summary = useMemo(() => financeSummary(months, incorporationYm), [months, incorporationYm]);
  const eventGroups = useMemo(() => buildEventGroups(timelineItems, axis, pilot), [timelineItems, axis, pilot]);
  const hasCash = months.some((month) => month.cash !== null);
  const hasPl = months.some((month) => month.pl !== null);
  const editable = Boolean(dataset?.editable) && !readOnly;

  // 選んだ月が今の時間軸に無ければ（計画を切り替えたときなど）、先頭のイベントを選んだことにする。
  const activeMonth = selectedMonth !== null && eventGroups.positioned.some((group) => group.monthIndex === selectedMonth)
    ? selectedMonth
    : eventGroups.positioned[0]?.monthIndex ?? null;

  const notesByCell = useMemo(() => {
    const grouped = new Map<string, FinanceCellNote[]>();
    const add = (metric: string, ym: string, note: FinanceCellNote) => {
      const key = `${metric}:${ym}`;
      grouped.set(key, [...(grouped.get(key) ?? []), note]);
    };
    for (const event of fundingEvents) {
      add("equity", event.ym, {
        id: `funding-${event.label}-${event.ym}`,
        title: `${event.label}（資本政策）`,
        detail: `資本政策表の計画額 ${formatMillionFromYen(event.amountYen)}百万円。売上ではなく調達。着金の実績ではない。`,
        evidenceState: "plan",
      });
    }
    for (const grant of grants) {
      const visible = axis.find((cell) => (!grant.period_start_ym || cell.ym >= grant.period_start_ym) && (!grant.period_end_ym || cell.ym <= grant.period_end_ym));
      if (!visible) continue;
      add("grant", visible.ym, {
        id: `grant-${grant.grant_name}-${visible.ym}`,
        title: `${grant.grant_name} 採択情報`,
        detail: `${grant.agency ? `${grant.agency}。` : ""}採択額 ${formatMillionFromYen(Number(grant.amount_yen ?? 0))}百万円、採択日 ${grant.adopted_date ?? "未登録"}、受領実績 ${grant.disbursed_yen === null ? "未確認" : `${formatMillionFromYen(grant.disbursed_yen)}百万円`}。`,
        evidenceState: "observed",
      });
    }
    return grouped;
  }, [fundingEvents, grants, axis]);

  const gridStyle = {
    gridTemplateColumns: `var(--finance-label-width) repeat(${axis.length}, ${MONTH_WIDTH}px)`,
    width: `calc(var(--finance-label-width) + ${axis.length * MONTH_WIDTH}px)`,
  } satisfies CSSProperties;
  const incorporationIndex = incorporationYm ? axis.findIndex((cell) => cell.ym === incorporationYm) : -1;
  const selectedGroup = eventGroups.positioned.find((group) => group.monthIndex === activeMonth) ?? null;
  const registeredPolicy = pilot?.timeline.lanes.find((lane) => lane.key === "registered_policy")?.items[0] ?? null;

  const startEdit = (ym: string) => {
    if (!editable) return;
    setSaveError(null);
    setDraft(draftFromMonth(ym, plRowByYm.get(ym) ?? null));
  };

  const save = async () => {
    if (!draft || !/^\d{4}-\d{2}$/.test(draft.ym)) return;
    setSaving(true);
    setSaveError(null);
    const toYen = (value: string) => Math.round((Number(value) || 0) * 1_000_000);
    const saved = await upsertPlMonthly(projectId, {
      id: draft.id,
      ym: draft.ym,
      revenue_yen: toYen(draft.revenue_yen),
      cogs_yen: toYen(draft.cogs_yen),
      personnel_yen: toYen(draft.personnel_yen),
      rd_yen: toYen(draft.rd_yen),
      marketing_yen: toYen(draft.marketing_yen),
      other_opex_yen: toYen(draft.other_opex_yen),
      notes: draft.notes.trim() || null,
    });
    setSaving(false);
    if (!saved) {
      setSaveError("保存できなかった。入力内容と接続を確認して。");
      return;
    }
    setDraft(null);
    invalidatePlMonthlyCache(projectId);
    await onPlChanged?.();
  };

  const remove = async () => {
    if (!draft?.id || !confirm(`${draft.ym} の月次試算を削除する？`)) return;
    setSaving(true);
    const deleted = await deletePlMonthly(projectId, draft.id);
    setSaving(false);
    if (!deleted) {
      setSaveError("削除できなかった。接続を確認して。");
      return;
    }
    setDraft(null);
    invalidatePlMonthlyCache(projectId);
    await onPlChanged?.();
  };

  const draftBeforeIncorporation = Boolean(draft && incorporationYm && draft.ym < incorporationYm);

  const renderSection = (key: FinanceFormatSectionKey, title: string): ReactNode => {
    switch (key) {
      case "dataset":
        return (
          <SectionFrame key={key} sectionKey={key} title={title} aside={FINANCE_UNIT_LABEL}>
            <div className="space-y-2 px-3 pb-3 sm:px-4">
              {ordered.length === 0 ? (
                <p className="text-[11px] text-slate-500">月次試算・資金繰り・資金計画はまだ登録されていない。</p>
              ) : (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="計画" data-testid="finance-format-dataset">
                  {ordered.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-pressed={candidate.id === dataset?.id}
                      onClick={() => setDatasetId(candidate.id)}
                      className={`h-8 border px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96] ${candidate.id === dataset?.id ? "border-[#173f51] bg-[#173f51] text-white" : "border-slate-300 bg-white text-[#285b6b] hover:bg-[#f1f5f6]"}`}
                    >
                      {candidate.label}
                    </button>
                  ))}
                </div>
              )}
              {dataset && dataset.cases.length > 1 ? (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="ケース" data-testid="finance-format-case">
                  {dataset.cases.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      aria-pressed={entry.key === activeCase?.key}
                      onClick={() => setCaseKey(entry.key)}
                      className={`h-8 border px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96] ${entry.key === activeCase?.key ? "border-[#2f6f87] bg-[#e9f2f6] text-[#173f51]" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {activeCase?.description ? <p className="text-[11px] leading-5 text-slate-700">{activeCase.description}</p> : null}
              {dataset?.caption ? <p className="text-[10px] leading-4 text-slate-500">{dataset.caption}</p> : null}
            </div>
          </SectionFrame>
        );
      case "summary": {
        const values: Record<(typeof FINANCE_SUMMARY_ITEMS)[number]["key"], string> = {
          period: summary.periodStart ? `${formatYm(summary.periodStart)}〜${formatYm(summary.periodEnd)}` : "未登録",
          revenue: summary.revenue === null ? "未登録" : formatMillionFromYen(summary.revenue),
          expense: summary.expense === null ? "未登録" : formatMillionFromYen(summary.expense),
          funding: summary.funding === null ? "未登録" : formatMillionFromYen(summary.funding),
          lowestCash: summary.lowestCash ? `${formatMillionFromYen(summary.lowestCash.value)}（${summary.lowestCash.ym}）` : "未登録",
          endingCash: summary.endingCash ? `${formatMillionFromYen(summary.endingCash.value)}（${summary.endingCash.ym}）` : "未登録",
        };
        return (
          <SectionFrame key={key} sectionKey={key} title={title}>
            <div className="mx-3 mb-3 grid grid-cols-2 gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:mx-4 sm:grid-cols-3 xl:grid-cols-6">
              {FINANCE_SUMMARY_ITEMS.map((item) => (
                <div key={item.key} className="bg-white px-2 py-1.5">
                  <div className="truncate text-[9px] font-medium leading-3 text-slate-500">{item.label}</div>
                  <div className={`mt-0.5 text-right font-mono text-[12px] font-semibold leading-4 tabular-nums ${values[item.key] === "未登録" ? "text-slate-400" : "text-slate-900"}`}>{values[item.key]}</div>
                </div>
              ))}
            </div>
          </SectionFrame>
        );
      }
      case "timeline":
        return null; // 時間軸は月次表と同じ横スクロールの中に描く（月の列をそろえるため）。
      case "monthly-table":
        return (
          <SectionFrame
            key={key}
            sectionKey={key}
            includes={["timeline", "monthly-table", "monthly-cash-chart"]}
            title={`${FINANCE_FORMAT_SECTIONS.find((section) => section.key === "timeline")?.label}・${title}・${FINANCE_CHARTS.monthlyCash.title}`}
            aside={editable ? (
              <span className="flex flex-wrap items-center justify-end gap-1">
                <button type="button" onClick={() => setHearingOpen(true)} className="h-8 border border-[#6d8a96] bg-white px-2 text-[10px] font-semibold text-[#285b6b] transition-colors hover:bg-[#f1f5f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]">つくよみと試算</button>
                <button type="button" onClick={() => startEdit(axis[0]?.ym ?? currentYm())} className="h-8 border border-[#173f51] bg-[#173f51] px-2 text-[10px] font-semibold text-white transition-colors hover:bg-[#285b6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]">月を入力</button>
              </span>
            ) : dataset && !dataset.editable && !readOnly ? <span>資料から取り込んだ計画。数字は取り込み元で直す。</span> : null}
          >
            {axis.length === 0 ? (
              <EmptyNote>月次の登録はまだない。{editable ? "「月を入力」から入れられる。" : ""}</EmptyNote>
            ) : (
              <div data-testid="finance-format-monthly-scroll" className="max-w-full overflow-x-auto overscroll-x-contain">
                <div className="grid [--finance-label-width:112px] sm:[--finance-label-width:172px]" style={gridStyle}>
                  {/* 時間軸 */}
                  <div className="sticky left-0 z-40 border-b border-r border-slate-300 bg-[#f7f9fa] px-2 py-1" data-testid="finance-format-timeline">
                    <div className="text-[11px] font-semibold text-[#173f51]">時間軸</div>
                    <div className="text-[8px] leading-3 text-slate-500">◇を押すと内容。{valuationYm ? "M0=試算の評価月。" : ""}</div>
                    {eventGroups.outside > 0 ? <div className="text-[8px] text-slate-500">期間外 {eventGroups.outside}件</div> : null}
                    {eventGroups.undated > 0 ? <div className="text-[8px] text-slate-500">日付なし {eventGroups.undated}件</div> : null}
                    {eventGroups.positioned.length === 0 ? <div className="text-[8px] text-slate-500">期間内のイベントなし</div> : null}
                  </div>
                  <div className="relative border-b border-slate-300 bg-white" style={{ gridColumn: `2 / span ${axis.length}`, height: TIMELINE_HEIGHT }}>
                    {axis.map((cell) => (
                      <span key={cell.ym} aria-hidden="true" className={`absolute inset-y-0 border-l ${cell.calendarMonth === 1 || cell.index === 0 ? "border-slate-300" : "border-slate-100"}`} style={{ left: cell.index * MONTH_WIDTH }} />
                    ))}
                    {incorporationIndex >= 0 ? <span aria-hidden="true" className="absolute inset-y-0 z-10 w-0 border-l-2 border-[#173f51]" style={{ left: incorporationIndex * MONTH_WIDTH }} /> : null}
                    {registeredPolicy && pilot && valuationYm ? (() => {
                      const startIndex = Math.max(0, monthsBetween(axis[0].ym, valuationYm));
                      const endIndex = Math.min(axis.length - 1, monthsBetween(axis[0].ym, addMonths(valuationYm, pilot.calculationTrace.inputs.horizonMonths)));
                      if (endIndex < startIndex) return null;
                      return (
                        <div className="absolute top-1 z-10 h-[18px] border-y border-[#82a3ae] bg-[#e7eff2]" style={{ left: startIndex * MONTH_WIDTH + MONTH_WIDTH / 2, width: (endIndex - startIndex) * MONTH_WIDTH }}>
                          <span className="sticky left-1 block w-fit px-1 text-[9px] font-semibold leading-[16px] text-[#24596a]">{registeredPolicy.label}</span>
                        </div>
                      );
                    })() : null}
                    <div className="absolute left-0 right-0 h-px bg-[#173f51]" style={{ top: AXIS_Y }} />
                    {axis.map((cell) => (
                      <span key={`tick-${cell.ym}`} aria-hidden="true" className="absolute h-2 w-px bg-[#173f51]" style={{ left: cell.index * MONTH_WIDTH + MONTH_WIDTH / 2, top: AXIS_Y - 4 }} />
                    ))}
                    {eventGroups.positioned.map((group) => (
                      <EventCard key={`${group.monthIndex}-${group.items.map((item) => item.id).join("-")}`} group={group} axis={axis} selected={activeMonth === group.monthIndex} onSelect={() => setSelectedMonth(group.monthIndex)} />
                    ))}
                  </div>

                  {/* 月の見出し */}
                  <div className="sticky left-0 z-40 border-b border-r border-slate-300 bg-[#edf3f5] px-2 py-1">
                    <div className="text-[11px] font-semibold text-[#173f51]">{title}</div>
                    <div className="text-[8px] leading-3 text-slate-500">P/L・資金繰り</div>
                  </div>
                  {axis.map((cell) => (
                    <MonthCellFrame key={`header-${cell.ym}`} cell={cell} className={`bg-[#edf3f5] px-1.5 py-1 text-right ${cell.index === incorporationIndex ? "border-l-2 border-l-[#173f51]" : ""}`}>
                      {editable ? (
                        <button type="button" onClick={() => startEdit(cell.ym)} className="w-full text-right hover:text-[#173f51] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]" title={`${cell.ym}を入力・編集`}>
                          <span className="block text-[10px] font-semibold leading-3 text-[#365865]">{cell.mLabel ?? " "}</span>
                          <span className="block font-mono text-[8px] leading-3 text-slate-500">{cell.ym}</span>
                        </button>
                      ) : (
                        <>
                          <span className="block text-[10px] font-semibold leading-3 text-[#365865]">{cell.mLabel ?? " "}</span>
                          <span className="block font-mono text-[8px] leading-3 text-slate-500">{cell.ym}</span>
                        </>
                      )}
                    </MonthCellFrame>
                  ))}

                  {/* 出所・計上主体 */}
                  <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-white px-2 py-0.5 text-[9px] font-semibold leading-4 text-slate-600">出所</div>
                  {axis.map((cell) => (
                    <MonthCellFrame key={`source-${cell.ym}`} cell={cell} className="px-1 py-0.5 text-right text-[8px] font-semibold leading-4 text-slate-500">
                      {monthByYm.get(cell.ym)?.source ?? "—"}
                    </MonthCellFrame>
                  ))}
                  <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-white px-2 py-0.5 text-[9px] font-semibold leading-4 text-slate-600">計上主体</div>
                  {axis.map((cell) => {
                    const before = incorporationYm ? cell.ym < incorporationYm : null;
                    return (
                      <MonthCellFrame key={`entity-${cell.ym}`} cell={cell} className={`px-1 py-0.5 text-right text-[8px] font-semibold leading-4 ${before === null ? "text-slate-400" : before ? "bg-slate-100 text-slate-500" : "bg-[#e7eff2] text-[#173f51]"} ${cell.index === incorporationIndex ? "border-l-2 border-l-[#173f51]" : ""}`}>
                        {before === null ? "—" : before ? "設立前PJ" : "会社"}
                      </MonthCellFrame>
                    );
                  })}

                  {/* P/L */}
                  <div className="contents">
                    <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#173f51] px-2 py-0.5 text-[10px] font-semibold leading-4 text-white">P/L{!hasPl ? "（この計画には無い）" : incorporationYm ? "（設立前は設立前PJ支出）" : ""}</div>
                    {axis.map((cell) => <MonthCellFrame key={`pl-section-${cell.ym}`} cell={cell} className="bg-[#173f51]" />)}
                  </div>
                  {FINANCE_PL_ROWS.map((row) => {
                    const total = axis.reduce((sum, cell) => sum + ((figuresByYm.get(cell.ym)?.[row.key as FinancePlRowKey] as number | null | undefined) ?? 0), 0);
                    const result = row.key === "operatingProfit" || row.key === "preincorporationSpend";
                    return (
                      <div key={row.key} className="contents" data-testid={`finance-format-pl-row-${row.key}`}>
                        <div className={`sticky left-0 z-30 flex items-center justify-between gap-1 border-b border-r border-slate-300 px-2 py-0.5 ${result ? "bg-[#edf3f5]" : "bg-white"}`}>
                          <div className={`truncate text-[10px] leading-4 ${result ? "font-semibold text-[#173f51]" : "text-slate-700"}`}>{row.label}</div>
                          <div className="truncate text-right font-mono text-[8px] leading-3 tabular-nums text-slate-500">計 {hasPl ? formatMillionFromYen(total) : "—"}</div>
                        </div>
                        {axis.map((cell) => {
                          const value = (figuresByYm.get(cell.ym)?.[row.key as FinancePlRowKey] as number | null | undefined) ?? null;
                          const canEdit = editable && row.kind === "input";
                          return (
                            <MonthCellFrame key={`${row.key}-${cell.ym}`} cell={cell} className={`px-1.5 py-0.5 text-right ${row.kind === "calculated" ? "bg-slate-50" : "bg-white"} ${cell.index === incorporationIndex ? "border-l-2 border-l-[#173f51]" : ""}`}>
                              {canEdit ? (
                                <button type="button" onClick={() => startEdit(cell.ym)} className="block w-full text-right font-mono text-[11px] leading-4 tabular-nums text-slate-700 decoration-dotted hover:text-[#173f51] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]" title={`${cell.ym}の${row.label}を編集`}>
                                  {formatMillionFromYen(value)}
                                </button>
                              ) : (
                                <span className={`font-mono text-[11px] leading-4 tabular-nums ${result && value !== null && value < 0 ? "text-rose-700" : "text-slate-700"}`}>{formatMillionFromYen(value)}</span>
                              )}
                            </MonthCellFrame>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* C/F */}
                  <div className="contents">
                    <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#365865] px-2 py-0.5 text-[10px] font-semibold leading-4 text-white">C/F・資金繰り</div>
                    {axis.map((cell) => <MonthCellFrame key={`cf-section-${cell.ym}`} cell={cell} className="bg-[#365865]" />)}
                  </div>
                  {FINANCE_CASH_ROWS.map((row) => (
                    <div key={row.key} className="contents" data-testid={`finance-format-cash-row-${row.key}`}>
                      <div className={`sticky left-0 z-30 border-b border-r border-slate-300 px-2 py-0.5 ${row.kind === "total" ? "bg-[#edf3f5]" : "bg-white"}`}>
                        <div className={`truncate text-[10px] leading-4 ${row.kind === "total" ? "font-semibold text-[#173f51]" : "text-slate-700"}`}>{row.label}</div>
                      </div>
                      {axis.map((cell) => {
                        const value = monthByYm.get(cell.ym)?.cash?.[row.key as FinanceCashRowKey] ?? null;
                        const notes = notesByCell.get(`${row.key}:${cell.ym}`) ?? [];
                        return (
                          <MonthCellFrame key={`${row.key}-${cell.ym}`} cell={cell} className={`px-1.5 py-0.5 text-right ${notes.length > 0 ? "bg-amber-50/70" : row.kind === "total" ? "bg-slate-50" : "bg-white"}`}>
                            <span className="flex items-center justify-end gap-1">
                              <CellNotes notes={notes} ym={cell.ym} label={row.label} />
                              <span className={`font-mono text-[11px] leading-4 tabular-nums ${value !== null && value < 0 ? "text-rose-700" : "text-slate-700"}`}>{formatMillionFromYen(value)}</span>
                            </span>
                          </MonthCellFrame>
                        );
                      })}
                    </div>
                  ))}

                  {/* 追加の内訳 */}
                  {dataset && dataset.extraRows.length > 0 ? (
                    <>
                      <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-white px-2 py-0.5">
                        <button type="button" aria-expanded={showExtras} onClick={() => setShowExtras((open) => !open)} className="text-left text-[9px] font-semibold leading-4 text-[#285b6b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]">
                          {showExtras ? "−" : "+"} 元データの内訳（{dataset.extraRows.length}行）
                        </button>
                      </div>
                      {axis.map((cell) => <MonthCellFrame key={`extras-head-${cell.ym}`} cell={cell} className="bg-white" />)}
                      {showExtras ? dataset.extraRows.map((extra) => (
                        <div key={extra.key} className="contents" data-testid="finance-format-extra-row">
                          <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-slate-50 px-2 py-0.5 text-[9px] leading-4 text-slate-600">{extra.label}</div>
                          {axis.map((cell) => {
                            const value = monthByYm.get(cell.ym)?.extras[extra.key] ?? null;
                            return (
                              <MonthCellFrame key={`${extra.key}-${cell.ym}`} cell={cell} className="bg-slate-50 px-1.5 py-0.5 text-right">
                                <span className={`font-mono text-[10px] leading-4 tabular-nums ${value !== null && value < 0 ? "text-rose-700" : "text-slate-600"}`}>{formatMillionFromYen(value)}</span>
                              </MonthCellFrame>
                            );
                          })}
                        </div>
                      )) : null}
                    </>
                  ) : null}

                  {/* BZM経済CF */}
                  <div className="sticky left-0 z-30 border-b border-r border-t-2 border-slate-400 bg-[#f7f2e8] px-2 py-0.5">
                    <div className="text-[10px] font-semibold leading-4 text-[#6b5127]">BZM経済CF</div>
                    <div className="text-[8px] leading-3 text-slate-500">{pilot ? "資金繰りと別。事業価値の計算用" : "試算なし"}</div>
                  </div>
                  {axis.map((cell) => {
                    const offset = valuationYm ? monthsBetween(valuationYm, cell.ym) : null;
                    const value = !pilot || offset === null || offset < 0 || offset > pilot.calculationTrace.inputs.horizonMonths
                      ? null
                      : offset === 0 ? 0 : pilot.calculationTrace.inputs.cashFlow.monthlyEconomicCFMillionJpy.base[offset - 1] ?? 0;
                    return (
                      <MonthCellFrame key={`bzm-${cell.ym}`} cell={cell} className="border-t-2 border-t-slate-400 bg-[#fdfaf4] px-1.5 py-0.5 text-right">
                        <span className="font-mono text-[11px] leading-4 tabular-nums text-[#6b5127]">{formatMillion(value)}</span>
                      </MonthCellFrame>
                    );
                  })}

                  {/* 月次の資金推移 */}
                  <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#f7f9fa] px-2 py-1" data-testid="finance-format-monthly-cash-chart">
                    <div className="text-[11px] font-semibold text-[#173f51]">{FINANCE_CHARTS.monthlyCash.title}</div>
                    <div className="mt-1 space-y-0.5 text-[8px] leading-3 text-slate-600">
                      <div className="flex items-center gap-1"><i aria-hidden="true" className="h-2 w-2" style={{ backgroundColor: COLORS.inflow }} />{FINANCE_CHARTS.monthlyCash.bars[0].label}</div>
                      <div className="flex items-center gap-1"><i aria-hidden="true" className="h-2 w-2" style={{ backgroundColor: COLORS.outflow }} />{FINANCE_CHARTS.monthlyCash.bars[1].label}</div>
                      <div className="flex items-center gap-1"><i aria-hidden="true" className="h-0.5 w-3" style={{ backgroundColor: COLORS.line }} />{FINANCE_CHARTS.monthlyCash.line.label}</div>
                      {dataset?.reserveYen ? <div className="flex items-center gap-1"><i aria-hidden="true" className="h-0 w-3 border-t border-dashed border-slate-500" />{FINANCE_CHARTS.monthlyCash.guide.label}</div> : null}
                      {!hasCash ? <div className="text-slate-400">資金繰りは未登録</div> : null}
                    </div>
                  </div>
                  <div className="border-b border-slate-300 bg-white py-2" style={{ gridColumn: `2 / span ${axis.length}` }}>
                    <MonthlyCashChart axis={axis} figuresByYm={figuresByYm} months={monthByYm} reserveYen={dataset?.reserveYen ?? null} />
                  </div>
                </div>
              </div>
            )}
            {selectedGroup && axis[selectedGroup.monthIndex] ? (
              <div className="border-t border-slate-200 bg-[#f7f9fa] px-3 py-1.5 sm:px-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] leading-4 text-slate-600">
                  <span className="font-semibold text-[#173f51]">{axis[selectedGroup.monthIndex].ym}</span>
                  {selectedGroup.items.map((item) => {
                    const gate = pilot?.calculationTrace.inputs.gates.find((candidate) => candidate.label === item.label);
                    return (
                      <span key={item.id} className="inline-flex flex-wrap items-center gap-1 border-l-2 pl-2" style={{ borderColor: CATEGORY_META[item.category].color }}>
                        <b className="text-slate-700">{item.label}</b>
                        {gate ? <span>通過値 {formatRate(gate.probabilities.base)} / 停止時 {formatMillion(gate.signedFailureSettlementMillionJpy.base)}</span> : item.description ? <span>{item.description}</span> : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </SectionFrame>
        );
      case "monthly-cash-chart":
        return null; // 月次表と同じ月の列にそろえて、月次表の下端に描いている。
      case "annual-chart":
        return (
          <SectionFrame
            key={key}
            sectionKey={key}
            title={title}
            aside={(
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-[9px]">
                <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2 w-2" style={{ backgroundColor: COLORS.revenue }} />{FINANCE_CHARTS.annual.bars[0].label}</span>
                <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2 w-2" style={{ backgroundColor: COLORS.expense }} />{FINANCE_CHARTS.annual.bars[1].label}</span>
                <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-0.5 w-3" style={{ backgroundColor: COLORS.line }} />{FINANCE_CHARTS.annual.line.label}</span>
              </span>
            )}
          >
            <p className="px-3 pb-2 text-[10px] leading-4 text-slate-600 sm:px-4">4月始まり。売上と費用を横並びの棒、年次純C/Fを折れ線で同じ目盛りに重ねる。調達は売上に含めない。{!hasPl && hasCash ? "この計画はP/Lを持たないので棒は出ない。" : ""}</p>
            {annualRows.length === 0 ? <EmptyNote>年度に集計できる登録はまだない。</EmptyNote> : <AnnualChart rows={annualRows} />}
          </SectionFrame>
        );
      case "annual-table":
        return (
          <SectionFrame key={key} sectionKey={key} title={title} aside={FINANCE_UNIT_LABEL}>
            {annualRows.length === 0 ? <EmptyNote>年度に集計できる登録はまだない。</EmptyNote> : (
              <div className="mx-3 mb-3 overflow-x-auto border border-[#cbd9de] bg-white sm:mx-4" data-testid="finance-format-annual-table">
                <table className="w-full min-w-[680px] border-collapse text-[10px] tabular-nums">
                  <thead>
                    <tr className="border-b border-[#d8e2e5] bg-[#edf3f5] text-slate-500">
                      <th scope="col" className="w-44 px-2 py-1.5 text-left font-medium">項目</th>
                      {annualRows.map((row) => <th key={row.fiscalYear} scope="col" className="border-l border-[#e2eaed] px-1.5 py-1.5 text-right font-medium">FY{row.fiscalYear}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {FINANCE_ANNUAL_ROWS.map((tableRow) => {
                      const emphasis = tableRow.key === "revenue" || tableRow.key === "expense" || tableRow.key === "operatingProfit" || tableRow.key === "net";
                      return (
                        <tr key={tableRow.key} className={`border-b border-[#edf1f2] last:border-b-0 ${emphasis ? "bg-slate-50 font-semibold" : ""}`}>
                          <th scope="row" className={`px-2 py-1.5 text-left font-medium ${tableRow.key === "preincorporationSpend" ? "text-amber-800" : "text-slate-700"}`}>{tableRow.label}</th>
                          {annualRows.map((row) => {
                            const raw = row[tableRow.key as keyof FinanceAnnualRow];
                            const plKey = ["revenue", "expense", "cogs", "personnel", "rd", "marketing", "otherOpex", "operatingProfit"].includes(tableRow.key);
                            const value = plKey && !row.hasPl ? null : typeof raw === "number" ? raw : null;
                            return <td key={row.fiscalYear} className={`border-l border-[#edf1f2] px-1.5 py-1.5 text-right ${value !== null && value < 0 ? "text-rose-700" : tableRow.key === "net" || tableRow.key === "closing" || tableRow.key === "equity" ? "text-[#9a6a1d]" : "text-slate-800"}`}>{formatMillionFromYen(value)}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionFrame>
        );
      case "notes":
        return (
          <SectionFrame key={key} sectionKey={key} title={title}>
            {!dataset || (dataset.tables.length === 0 && dataset.notes.length === 0) ? (
              <EmptyNote>この計画の前提と注記は未登録。</EmptyNote>
            ) : (
              <div className="space-y-3 px-3 pb-4 sm:px-4" data-testid="finance-format-notes">
                {dataset.tables.length > 0 ? (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {dataset.tables.map((table) => (
                      <div key={table.title} className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold text-[#173f51]">{table.title}{table.unit ? <span className="ml-1 font-normal text-slate-500">{table.unit}</span> : null}</div>
                        <div className="overflow-x-auto border border-[#cbd9de]">
                          <table className="w-full border-collapse text-[10px]">
                            <thead><tr className="bg-[#edf3f5] text-slate-500">{table.columns.map((column, index) => <th key={column} scope="col" className={`px-2 py-1 font-medium ${index === 0 ? "text-left" : "text-right"}`}>{column}</th>)}</tr></thead>
                            <tbody>{table.rows.map((cells) => <tr key={cells.join("|")} className="border-t border-[#edf1f2]">{cells.map((cellValue, index) => <td key={`${index}-${cellValue}`} className={`px-2 py-1 ${index === 0 ? "text-left text-slate-700" : "text-right font-mono tabular-nums text-slate-800"}`}>{cellValue}</td>)}</tr>)}</tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {dataset.notes.map((note, index) => (
                  <details key={note.title} open={index === 0} className="border border-slate-200 bg-white px-3 py-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-[#173f51]">{note.title}</summary>
                    <div className="mt-1.5 space-y-1.5 text-[11px] leading-5 text-slate-700">{note.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
                  </details>
                ))}
              </div>
            )}
          </SectionFrame>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider delay={100}>
      <section data-testid="project-finance-format" className="amd-dense-ui overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-baseline justify-between gap-2 px-3 pb-1 pt-3 sm:px-4">
          <h3 className="text-[14px] font-semibold tracking-tight text-[#173f51]">試算表</h3>
          <span className="text-[10px] text-slate-500">{dataset ? dataset.label : "未登録"}{activeCase && dataset && dataset.cases.length > 1 ? ` · ${activeCase.label}` : ""}</span>
        </header>
        {FINANCE_FORMAT_SECTIONS.map((section) => renderSection(section.key, section.label))}

        <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open && !saving) setDraft(null); }}>
          {draft ? (
            <DialogContent data-testid="finance-format-edit-dialog" className="max-h-[90vh] overflow-y-auto rounded-none border border-[#7898a5] bg-white p-0 sm:!max-w-[680px]" showCloseButton={!saving}>
              <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
                <DialogHeader className="border-b border-slate-200 bg-[#edf3f5] px-4 py-3">
                  <DialogTitle className="text-[15px] font-semibold text-[#173f51]">{draft.ym} の{draftBeforeIncorporation ? "設立前PJ支出" : "月次試算"}</DialogTitle>
                  <DialogDescription className="text-[11px]">入力単位は百万円。{draftBeforeIncorporation ? "会社設立前の月は、会社のP/Lには出さず設立前PJ支出へまとめる。" : "保存すると同じ月の列へすぐ反映する。"}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 p-4 sm:grid-cols-3">
                  {([
                    ["revenue_yen", "売上"],
                    ["cogs_yen", "売上原価"],
                    ["personnel_yen", "人件費"],
                    ["rd_yen", "研究開発費"],
                    ["marketing_yen", "販売促進費"],
                    ["other_opex_yen", "その他販管費"],
                  ] as const).map(([field, label]) => (
                    <label key={field} className="text-[11px] font-semibold text-slate-600">{label}（百万円）
                      <input type="number" step="0.1" value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} onFocus={(event) => event.currentTarget.select()} className="mt-1 h-10 w-full border border-slate-300 bg-white px-3 text-right font-mono text-sm font-normal outline-none focus:border-[#285b6b] focus:ring-2 focus:ring-[#a9c5cf]" />
                    </label>
                  ))}
                  <label className="text-[11px] font-semibold text-slate-600 sm:col-span-3">メモ（先頭に「実績」「見込」「推定」と書くと出所に出る）
                    <textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="mt-1 w-full border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#285b6b] focus:ring-2 focus:ring-[#a9c5cf]" />
                  </label>
                  {saveError ? <p className="text-[11px] text-rose-700 sm:col-span-3">{saveError}</p> : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-[#f7f9fa] px-4 py-3">
                  {draft.id ? <button type="button" onClick={() => void remove()} disabled={saving} className="h-10 border border-rose-200 px-4 text-[11px] font-semibold text-rose-700 disabled:opacity-50">この月を削除</button> : null}
                  <button type="button" onClick={() => setDraft(null)} disabled={saving} className="h-10 border border-slate-300 px-4 text-[11px] font-semibold text-slate-600 disabled:opacity-50">キャンセル</button>
                  <button type="submit" disabled={saving} className="h-10 border border-[#173f51] bg-[#173f51] px-5 text-[11px] font-semibold text-white disabled:opacity-50">{saving ? "保存中…" : "保存"}</button>
                </div>
              </form>
            </DialogContent>
          ) : null}
        </Dialog>

        {hearingOpen ? (
          <CockpitPlHearingModal projectId={projectId} onClose={() => setHearingOpen(false)} onApplied={async () => { invalidatePlMonthlyCache(projectId); await onPlChanged?.(); }} />
        ) : null}
      </section>
    </TooltipProvider>
  );
}

/**
 * 試算表タブ。PJのデータ（月次試算・資金繰り・資金計画・資本政策・試算の時間軸・助成金）を読み、
 * 標準フォーマットへ流し込んで描く。全PJで同じ部品・同じ読み方。
 */
export function ProjectFinanceFormat({ projectId }: { projectId: string }) {
  const [plRows, setPlRows] = useState(() => getCachedPlMonthly(projectId));
  const [cashRows, setCashRows] = useState(() => getCachedFinanceCashflow(projectId));
  const [capitalPlan, setCapitalPlan] = useState(() => getCachedFinanceCapitalPlan(projectId));
  const [grants, setGrants] = useState(() => getCachedFinanceGrants(projectId));
  const [pilot, setPilot] = useState<Bzm22PilotProject | null | undefined>(() => getCachedBzm22Pilot(projectId));
  const [foundedAt, setFoundedAt] = useState(() => getCachedFinanceFoundedAt(projectId));
  const [error, setError] = useState<string | null>(null);

  // PJを切り替えたときは親が key で作り直すので、ここは読み込みの結果を受け取るだけ。
  useEffect(() => {
    let cancelled = false;
    loadPlMonthly(projectId).then((rows) => { if (!cancelled) setPlRows(rows); }).catch(() => { if (!cancelled) setError("月次試算を読み込めない。再読み込みして。"); });
    loadFinanceCashflow(projectId).then((rows) => { if (!cancelled) setCashRows(rows); }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "資金繰りを読み込めない。"); });
    loadFinanceCapitalPlan(projectId).then((document) => { if (!cancelled) setCapitalPlan(document); }).catch(() => { if (!cancelled) setCapitalPlan(null); });
    loadFinanceGrants(projectId).then((rows) => { if (!cancelled) setGrants(rows); }).catch(() => { if (!cancelled) setGrants([]); });
    loadFinanceFoundedAt(projectId).then((value) => { if (!cancelled) setFoundedAt(value); }).catch(() => { if (!cancelled) setFoundedAt(null); });
    loadBzm22Pilot(projectId)
      .then((loaded) => { if (!cancelled) setPilot(loaded); })
      // 試算（BZM）の対象外PJは 404。ほかの失敗でも、試算の行は「試算なし」として描く（表そのものは止めない）。
      .catch(() => { if (!cancelled) setPilot(null); });
    return () => { cancelled = true; };
  }, [projectId]);

  const reloadPl = async () => {
    const rows = await loadPlMonthly(projectId);
    setPlRows(rows);
  };

  const capitalInputs = useMemo(() => readCapitalPlanFinanceInputs(capitalPlan ?? null), [capitalPlan]);
  // 設立月の正本は会社の設立日（project_ventures.founded_at）。未登録なら資本政策の設立イベント。
  const incorporationYm = foundedAt ? foundedAt.slice(0, 7) : capitalInputs.incorporationYm;
  const built = useMemo(() => {
    if (!plRows || !cashRows || pilot === undefined || foundedAt === undefined) return null;
    let planDatasets: FinanceDataset[] = [];
    let planError: string | null = null;
    try {
      planDatasets = buildPlanFinanceDatasets(cashRows);
    } catch (cause) {
      planError = cause instanceof Error ? cause.message : "資金計画の数字が不整合";
    }
    const registered = buildRegisteredFinanceDataset({
      plRows,
      cashRows,
      incorporationYm,
      fundingEvents: capitalInputs.fundingEvents,
      pilotMonthPlans: (pilot?.monthlyFinancePlan ?? []).map((row) => ({ ym: row.ym, capexMillionJpy: row.capexMillionJpy, grantCashMillionJpy: row.grantCashMillionJpy, status: row.status })),
    });
    // 登録が1か月も無くても、試算（BZM）の時間軸があれば登録済みの枠で時間軸を描く。
    const hasRegistered = registered.monthsByCase.base.length > 0 || Boolean(pilot);
    return { datasets: [...planDatasets, ...(hasRegistered ? [registered] : [])], planError };
  }, [plRows, cashRows, pilot, foundedAt, incorporationYm, capitalInputs]);

  const timelineItems = useMemo(() => buildFinanceTimelineItems({
    pilotItems: (pilot?.timeline.lanes ?? []).flatMap((lane) => lane.items),
    incorporationYm,
    fundingEvents: capitalInputs.fundingEvents,
  }), [pilot, incorporationYm, capitalInputs]);

  if (error) {
    return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{error}</p>;
  }
  if (!built) {
    return (
      <section data-testid="project-finance-format" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy="true">
        <header className="px-4 pb-1 pt-3"><h3 className="text-[14px] font-semibold tracking-tight text-[#173f51]">試算表</h3></header>
        {FINANCE_FORMAT_SECTIONS.filter((section) => section.key !== "timeline" && section.key !== "monthly-cash-chart").map((section) => (
          <div key={section.key} className="border-t border-[#d8e2e5] px-4 py-3">
            <div className="text-[12px] font-semibold text-[#173f51]">{section.label}</div>
            <div className="mt-2 h-6 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </section>
    );
  }
  return (
    <div className="min-w-0 space-y-2">
      {built.planError ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">資金計画の数字が合っていないため表示していない：{built.planError}</p> : null}
      <FinanceFormatView
        key={projectId}
        projectId={projectId}
        datasets={built.datasets}
        timelineItems={timelineItems}
        pilot={pilot ?? null}
        incorporationYm={incorporationYm}
        fundingEvents={capitalInputs.fundingEvents}
        grants={grants ?? []}
        plRows={plRows ?? []}
        onPlChanged={reloadPl}
      />
    </div>
  );
}
