"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  buildBzm22SharedMonthAxis,
  locateBzm22TimelineItemMonth,
  type Bzm22CalculationGate,
  type Bzm22PilotProject,
  type Bzm22SharedMonthAxisCell,
  type Bzm22TimelineItem,
} from "@/lib/bzm-2-2-pilot-ui";
import {
  deletePlMonthly,
  fetchMonthlyCashflow,
  fetchPlMonthly,
  upsertPlMonthly,
  type ProjectMonthlyCashflow,
  type ProjectPlMonthly,
} from "@/lib/venture-status-data";
import {
  buildSxSourceCashLedger,
  buildSxMonthlyFinanceComments,
  SX_DEFAULT_EQUITY_FUNDING_EVENTS,
  type SxMonthlyFinanceComment,
  type SxEquityFundingPlanEvent,
} from "@/lib/sx-monthly-finance-plan";
import { SX_BUSINESS_PLAN_PHASES, SX_INCORPORATION_YM } from "@/lib/sx-business-plan";
import type { SxFirstFundingTarget } from "@/lib/sx-funding-timing";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CockpitPlHearingModal } from "./CockpitPlHearingModal";

const MONTH_WIDTH = 76;
const AXIS_Y = 61;
const TIMELINE_HEIGHT = 101;

const CATEGORY_META: Record<
  Bzm22TimelineItem["category"],
  { label: string; color: string; soft: string }
> = {
  registered_policy: { label: "登録方針", color: "#24596a", soft: "#e7eff2" },
  technical: { label: "技術", color: "#2f6f87", soft: "#e9f2f6" },
  facility: { label: "設備・量産", color: "#2f766b", soft: "#e8f2ef" },
  commercial: { label: "事業・商流", color: "#675a3b", soft: "#f3efe4" },
  funding_external: { label: "資金", color: "#8b6227", soft: "#f7efdf" },
};

type PlField =
  | "revenue_yen"
  | "cogs_yen"
  | "personnel_yen"
  | "rd_yen"
  | "marketing_yen"
  | "other_opex_yen";

type PlMetricKey = PlField | "gross_profit" | "preincorporation_spend" | "operating_profit";

const PL_ROWS: Array<{
  key: PlMetricKey;
  label: string;
  kind: "input" | "calculated";
}> = [
  { key: "revenue_yen", label: "売上", kind: "input" },
  { key: "cogs_yen", label: "売上原価", kind: "input" },
  { key: "gross_profit", label: "粗利", kind: "calculated" },
  { key: "personnel_yen", label: "人件費", kind: "input" },
  { key: "rd_yen", label: "研究開発費", kind: "input" },
  { key: "marketing_yen", label: "マーケ費", kind: "input" },
  { key: "other_opex_yen", label: "その他販管費", kind: "input" },
  { key: "operating_profit", label: "営業利益", kind: "calculated" },
];

const SX_PREINCORPORATION_SPEND_ROW = {
  key: "preincorporation_spend",
  label: "設立前PJ支出",
  kind: "calculated",
} as const;

const SX_PL_ROWS: typeof PL_ROWS = [
  ...PL_ROWS.slice(0, -1),
  SX_PREINCORPORATION_SPEND_ROW,
  PL_ROWS[PL_ROWS.length - 1],
];

// project_ventures.founded_at=p20:2026-11-01 が会計主体開始の正本。capital plan の
// 設立イベントも同月へ同期する。月単位で確定した日付は月初日で保持する。
const CX_INCORPORATION_YM = "2026-11";

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

interface EventGroup {
  monthIndex: number;
  items: Bzm22TimelineItem[];
  position: number;
}

interface SxGrantEvidence {
  grant_name: string;
  agency: string | null;
  amount_yen: number | null;
  disbursed_yen: number | null;
  adopted_date: string | null;
  period_start_ym: string | null;
  period_end_ym: string | null;
}

interface SxCashLedgerRow {
  ym: string;
  operatingCashFlowYen: number;
  capexCashFlowYen: number;
  equityFundingYen: number;
  loanDrawdownYen: number | null;
  grantReceiptYen: number;
  nonDilutiveFundingYen: number;
  netCashFlowYen: number;
  openingCashYen: number | null;
  closingCashYen: number | null;
}

interface AnnualFinanceSummaryRow {
  fiscalYear: number;
  revenueYen: number;
  cogsYen: number;
  personnelYen: number;
  rdYen: number;
  marketingYen: number;
  otherOpexYen: number;
  preincorporationSpendYen: number;
  operatingProfitYen: number;
  netCashFlowYen: number | null;
  equityFundingYen: number | null;
  grantReceiptYen: number | null;
}

type SxCashMetricKey =
  | "openingCashYen"
  | "operatingCashFlowYen"
  | "capexCashFlowYen"
  | "equityFundingYen"
  | "loanDrawdownYen"
  | "grantReceiptYen"
  | "netCashFlowYen"
  | "closingCashYen";

const SX_CASH_ROWS: Array<{
  key: SxCashMetricKey;
  label: string;
  kind: "flow" | "balance" | "unplanned";
  emphasis?: boolean;
}> = [
  { key: "openingCashYen", label: "月初資金残高", kind: "balance" },
  { key: "operatingCashFlowYen", label: "営業C/F（簡易）", kind: "flow" },
  { key: "capexCashFlowYen", label: "設備投資", kind: "flow" },
  { key: "equityFundingYen", label: "株式調達", kind: "flow" },
  { key: "loanDrawdownYen", label: "融資実行", kind: "unplanned" },
  { key: "grantReceiptYen", label: "助成金等入金", kind: "flow" },
  { key: "netCashFlowYen", label: "月次純C/F", kind: "flow", emphasis: true },
  { key: "closingCashYen", label: "月末資金残高", kind: "balance", emphasis: true },
];

const LST_CASH_ROWS: Array<{
  key: keyof Pick<ProjectMonthlyCashflow, "cash_inflow_yen" | "sbir_payment_yen" | "nedo_payment_yen" | "working_capital_payment_yen" | "free_cash_flow_yen" | "financing_cash_flow_yen" | "net_cash_flow_yen" | "opening_cash_yen" | "closing_cash_yen" | "sbir_account_balance_yen" | "working_capital_balance_yen" | "bank_borrowing_balance_yen">;
  label: string;
  emphasis?: boolean;
}> = [
  { key: "cash_inflow_yen", label: "収入計" },
  { key: "sbir_payment_yen", label: "SBIR支払（税抜）" },
  { key: "nedo_payment_yen", label: "NEDO支払（税抜）" },
  { key: "working_capital_payment_yen", label: "運転資金支払＋消費税" },
  { key: "free_cash_flow_yen", label: "FCF", emphasis: true },
  { key: "financing_cash_flow_yen", label: "財務CF" },
  { key: "net_cash_flow_yen", label: "増減額", emphasis: true },
  { key: "opening_cash_yen", label: "月初預金残高" },
  { key: "closing_cash_yen", label: "月末預金残高（推定）", emphasis: true },
  { key: "sbir_account_balance_yen", label: "SBIR口座残高" },
  { key: "working_capital_balance_yen", label: "運転資金残高" },
  { key: "bank_borrowing_balance_yen", label: "借入残高" },
];

function emptyPlRow(projectId: string, ym: string): ProjectPlMonthly {
  return {
    id: `__virtual__${ym}`,
    project_id: projectId,
    ym,
    revenue_yen: 0,
    cogs_yen: 0,
    personnel_yen: 0,
    rd_yen: 0,
    marketing_yen: 0,
    other_opex_yen: 0,
    notes: null,
  };
}

function plValue(row: ProjectPlMonthly, key: PlMetricKey) {
  const revenue = Number(row.revenue_yen);
  const cogs = Number(row.cogs_yen);
  if (key === "gross_profit") return revenue - cogs;
  if (key === "operating_profit") {
    return revenue - cogs - Number(row.personnel_yen) - Number(row.rd_yen)
      - Number(row.marketing_yen) - Number(row.other_opex_yen);
  }
  if (key === "preincorporation_spend") {
    return cogs + Number(row.personnel_yen) + Number(row.rd_yen)
      + Number(row.marketing_yen) + Number(row.other_opex_yen);
  }
  return Number(row[key]);
}

function plDisplayValue(
  row: ProjectPlMonthly,
  key: PlMetricKey,
  projectId: string,
  ym: string,
  incorporationYm: string | null,
) {
  if (!incorporationYm) return key === "preincorporation_spend" ? null : plValue(row, key);
  const beforeIncorporation = ym < incorporationYm;
  if (key === "preincorporation_spend") return beforeIncorporation ? plValue(row, key) : null;
  // 設立前の明細はNewCo P/Lへ一切表示しない。SXだけは別途PJ支出として表示する。
  if (beforeIncorporation) return null;
  return plValue(row, key);
}

function formatMillionFromYen(value: number) {
  if (!Number.isFinite(value) || value === 0) return "—";
  const amount = Math.abs(value) / 1_000_000;
  const formatted = amount.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  return value < 0 ? `(${formatted})` : formatted;
}

function formatMillion(value: number) {
  if (!Number.isFinite(value) || value === 0) return "—";
  const formatted = Math.abs(value).toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  return value < 0 ? `(${formatted})` : formatted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function equityEventsFromCapitalPlan(payload: unknown): SxEquityFundingPlanEvent[] {
  if (!isRecord(payload) || !Array.isArray(payload.events)) return [];
  return payload.events.flatMap((event): SxEquityFundingPlanEvent[] => {
    if (!isRecord(event) || (event.type !== "equity_issue" && event.type !== "ipo") || typeof event.date !== "string") return [];
    const allocations = Array.isArray(event.allocations) ? event.allocations : [];
    const amountYen = allocations.reduce((sum, allocation) => {
      if (!isRecord(allocation) || !isRecord(allocation.amount)) return sum;
      return sum + Number(allocation.amount.value ?? 0);
    }, 0);
    return [{ label: typeof event.label === "string" ? event.label : "株式調達", ym: event.date.slice(0, 7), amountYen }];
  });
}

function incorporationYmFromCapitalPlan(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.events)) return null;
  const incorporation = payload.events.find((event) =>
    isRecord(event) && event.type === "incorporation" && typeof event.date === "string");
  return isRecord(incorporation) && typeof incorporation.date === "string"
    ? incorporation.date.slice(0, 7)
    : null;
}

function previousYm(ym: string) {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fiscalYearFromYm(ym: string) {
  const [year, month] = ym.split("-").map(Number);
  return month < 4 ? year - 1 : year;
}

function sxTimelineItem(
  id: string,
  label: string,
  ym: string,
  category: Bzm22TimelineItem["category"],
  description: string,
): Bzm22TimelineItem {
  return {
    id,
    kind: "planned_or_assumed_event",
    label,
    category,
    startDate: `${ym}-01`,
    endDate: null,
    dateRole: "sx_canonical_month",
    datePrecision: "month",
    dateLabel: ym,
    status: "registered_project_premise",
    precision: "documented_or_management_confirmed",
    sourceStatus: "canonical_project_premise",
    sourceRefCount: 1,
    description,
    choiceRole: "not_a_choice",
    choiceLabel: "",
  };
}

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function draftFromRow(row: ProjectPlMonthly): Draft {
  const virtual = row.id.startsWith("__virtual__");
  const toMillion = (value: number) => String(Number(value) / 1_000_000);
  return {
    id: virtual ? undefined : row.id,
    ym: row.ym,
    revenue_yen: toMillion(row.revenue_yen),
    cogs_yen: toMillion(row.cogs_yen),
    personnel_yen: toMillion(row.personnel_yen),
    rd_yen: toMillion(row.rd_yen),
    marketing_yen: toMillion(row.marketing_yen),
    other_opex_yen: toMillion(row.other_opex_yen),
    notes: row.notes ?? "",
  };
}

function eventMonth(
  item: Bzm22TimelineItem,
  gate: Bzm22CalculationGate | undefined,
  gateMonths: Record<string, number>,
  axis: readonly Bzm22SharedMonthAxisCell[],
) {
  if (gate) return gateMonths[gate.id] ?? gate.month;
  return locateBzm22TimelineItemMonth(item, axis);
}

function buildEventGroups(
  pilot: Bzm22PilotProject,
  axis: readonly Bzm22SharedMonthAxisCell[],
  gateMonths: Record<string, number>,
  projectPremiseItems: readonly Bzm22TimelineItem[],
) {
  const groups = new Map<number, Bzm22TimelineItem[]>();
  const outside: Bzm22TimelineItem[] = [];
  const undated: Bzm22TimelineItem[] = [];
  const eventItems = pilot.timeline.lanes
    .flatMap((lane) => lane.items)
    .filter((item) => item.category !== "registered_policy")
    .filter((item) => pilot.projectId !== "p21" || item.id !== "funding-event-2")
    .concat(projectPremiseItems);
  for (const item of eventItems) {
    const gate = pilot.calculationTrace.inputs.gates.find((candidate) => candidate.label === item.label);
    const month = eventMonth(item, gate, gateMonths, axis);
    if (month === null) {
      if (item.startDate) outside.push(item);
      else undated.push(item);
      continue;
    }
    const current = groups.get(month) ?? [];
    current.push(item);
    groups.set(month, current);
  }

  const lastMonthByPosition = [-99, -99];
  const preferredPositions = [0, 1];
  const positioned: EventGroup[] = [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([monthIndex, items], index) => {
      const preference = preferredPositions[index % preferredPositions.length];
      const available = preferredPositions.find((position) => monthIndex - lastMonthByPosition[position] >= 3);
      const position = available ?? preferredPositions.reduce((best, candidate) =>
        lastMonthByPosition[candidate] < lastMonthByPosition[best] ? candidate : best, preference);
      lastMonthByPosition[position] = monthIndex;
      return { monthIndex, items, position };
    });
  return { positioned, outside, undated };
}

function EventCard({
  group,
  axis,
  selected,
  onSelect,
}: {
  group: EventGroup;
  axis: readonly Bzm22SharedMonthAxisCell[];
  selected: boolean;
  onSelect: () => void;
}) {
  const first = group.items[0];
  const category = CATEGORY_META[first.category];
  const eventTitle = group.items.map((item) => item.label).join(" / ");
  const topSide = group.position === 0;
  const top = topSide ? 27 : 70;
  const cardHeight = 23;
  const cardX = group.monthIndex * MONTH_WIDTH + MONTH_WIDTH / 2;
  const transform = group.monthIndex === 0
    ? "translateX(0)"
    : group.monthIndex === axis.length - 1
      ? "translateX(-100%)"
      : "translateX(-50%)";
  const connectorTop = topSide ? top + cardHeight : AXIS_Y;
  const connectorHeight = topSide ? AXIS_Y - connectorTop : top - AXIS_Y;
  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        className={`absolute z-20 flex items-center whitespace-nowrap border bg-white px-1.5 text-left text-[9px] font-semibold text-[#173f51] transition-colors ${selected ? "border-[#173f51]" : "border-slate-300 hover:border-[#678692]"}`}
        style={{
          left: cardX,
          top,
          width: "max-content",
          height: cardHeight,
          transform,
          boxShadow: selected ? "0 0 0 1px #173f51" : "none",
        }}
        title={eventTitle}
      >
        {eventTitle}
      </button>
      <span
        aria-hidden="true"
        className="absolute z-10 w-px bg-slate-400"
        style={{ left: cardX, top: connectorTop, height: Math.max(0, connectorHeight) }}
      />
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

function phaseStartYm(period: string) {
  return period.slice(0, 7).replace(".", "-");
}

interface LedgerCellComment {
  id: string;
  title: string;
  detail: string;
  evidenceState: "plan" | "observed";
}

function FinanceCellComment({
  comments,
  ym,
  metricLabel,
}: {
  comments: readonly LedgerCellComment[];
  ym: string;
  metricLabel: string;
}) {
  if (comments.length === 0) return null;
  const hasObserved = comments.some((comment) => comment.evidenceState === "observed");
  return (
    <Tooltip>
      <TooltipTrigger
        closeOnClick={false}
        aria-label={`${ym} ${metricLabel}の変動理由`}
        data-testid="bzm22-finance-comment"
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-[8px] font-bold ${hasObserved ? "text-cyan-800" : "text-amber-700"}`}
      >
        ◆
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="end"
        className="block w-80 max-w-[calc(100vw-24px)] rounded-sm border border-[#365865] bg-[#173f51] px-3 py-2 text-left text-[11px] leading-4 text-white shadow-xl"
      >
        <div className="mb-1 border-b border-white/20 pb-1 font-semibold">{ym} · {metricLabel}</div>
        <div className="space-y-1.5">
          {comments.map((comment) => (
            <div key={comment.id}>
              <div className="font-semibold">
                <span className="mr-1 text-[9px] text-cyan-100">{comment.evidenceState === "observed" ? "観測" : "計画"}</span>
                {comment.title}
              </div>
              <div className="text-slate-200">{comment.detail}</div>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function MonthCellFrame({ month, children = null, className = "" }: { month: Bzm22SharedMonthAxisCell; children?: ReactNode; className?: string }) {
  const yearBoundary = month.calendarMonth === 1 || month.month === 0;
  return (
    <div className={`min-w-0 border-b border-r border-slate-200 ${yearBoundary ? "border-l border-l-slate-400" : ""} ${className}`}>
      {children}
    </div>
  );
}

function AnnualFinanceChart({ rows, showPreincorporationSpend = false }: { rows: readonly AnnualFinanceSummaryRow[]; showPreincorporationSpend?: boolean }) {
  if (rows.length === 0) return null;
  const plMaxMagnitude = Math.max(
    1,
    ...rows.flatMap((row) => [
      row.revenueYen,
      row.cogsYen + row.personnelYen + row.rdYen + row.marketingYen + row.otherOpexYen,
      Math.abs(row.operatingProfitYen),
    ]),
  );
  const cashMaxMagnitude = Math.max(
    1,
    ...rows.flatMap((row) => [
      Math.abs(row.netCashFlowYen ?? 0),
      row.equityFundingYen ?? 0,
      row.grantReceiptYen ?? 0,
      ...(showPreincorporationSpend ? [row.preincorporationSpendYen] : []),
    ]),
  );
  const percentage = (value: number, maximum: number) =>
    value === 0 ? "0%" : `${Math.max(3, Math.min(100, (Math.abs(value) / maximum) * 100))}%`;
  const expenseSegments = [
    ["売上原価", "#7898a5", "cogsYen"],
    ["人件費", "#557582", "personnelYen"],
    ["研究開発費", "#2f766b", "rdYen"],
    ["マーケ費", "#8b7045", "marketingYen"],
    ["その他販管費", "#9aa9ad", "otherOpexYen"],
  ] as const;
  const hasCashFlow = rows.some((row) => row.netCashFlowYen !== null);
  const columnStyle = { gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` };
  const annualTableRows: Array<{ label: string; values: (row: AnnualFinanceSummaryRow) => number; emphasis?: boolean; tone?: string }> = [
    { label: "売上", values: (row) => row.revenueYen, emphasis: true },
    { label: "費用計", values: (row) => row.cogsYen + row.personnelYen + row.rdYen + row.marketingYen + row.otherOpexYen, emphasis: true },
    { label: "売上原価", values: (row) => row.cogsYen },
    { label: "人件費", values: (row) => row.personnelYen },
    { label: "研究開発費", values: (row) => row.rdYen },
    { label: "マーケ費", values: (row) => row.marketingYen },
    { label: "その他販管費", values: (row) => row.otherOpexYen },
    { label: "営業利益", values: (row) => row.operatingProfitYen, emphasis: true, tone: "profit" },
    ...(hasCashFlow ? [
      { label: "株式調達", values: (row: AnnualFinanceSummaryRow) => row.equityFundingYen ?? 0, tone: "funding" },
      { label: "助成金等入金", values: (row: AnnualFinanceSummaryRow) => row.grantReceiptYen ?? 0, tone: "grant" },
      { label: "年次純C/F", values: (row: AnnualFinanceSummaryRow) => row.netCashFlowYen ?? 0, emphasis: true, tone: "cash" },
    ] : []),
    ...(showPreincorporationSpend ? [{ label: "設立前PJ支出（NewCo P/L外）", values: (row: AnnualFinanceSummaryRow) => row.preincorporationSpendYen, tone: "preincorporation" }] : []),
  ];

  return (
    <section data-testid="bzm22-annual-finance-chart" aria-labelledby="bzm22-annual-finance-chart-title" className="border-t border-[#b9cbd1] bg-[#f7f9fa] px-3 py-3 sm:px-4">
      <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div>
          <h4 id="bzm22-annual-finance-chart-title" className="text-[13px] font-semibold tracking-tight text-[#173f51]">年度別の事業・資金推移</h4>
          <p className="text-[10px] leading-4 text-slate-600">4月始まり。横に連なるFY列で、事業の伸びと資金の必要量を読む。</p>
        </div>
        <span className="text-[10px] font-semibold text-slate-600">単位：百万円</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-600">
        <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2 w-2 bg-[#2f6f87]" />売上</span>
        {expenseSegments.map(([label, color]) => <span key={label} className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2 w-2" style={{ backgroundColor: color }} />{label}</span>)}
        <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2 w-2 bg-[#173f51]" />営業利益</span>
      </div>
      <div className="overflow-hidden border border-[#cbd9de] bg-white">
        <div className="grid border-b border-[#cbd9de] bg-[#edf3f5]" style={columnStyle}>
          {rows.map((row) => <div key={row.fiscalYear} className="min-w-0 border-r border-[#cbd9de] px-1 py-1.5 text-center last:border-r-0"><div className="font-mono text-[11px] font-semibold tabular-nums text-[#173f51]">FY{row.fiscalYear}</div><div className="mt-0.5 text-[8px] text-slate-500">{row.fiscalYear}.04–{row.fiscalYear + 1}.03</div></div>)}
        </div>
        <div className="border-b border-[#d8e2e5] px-2 pt-2"><div className="text-[10px] font-semibold text-[#173f51]">事業構造 <span className="ml-1 font-normal text-slate-500">同一尺度</span></div></div>
        <div className="grid h-28 items-stretch px-1 pt-2" style={columnStyle}>
          {rows.map((row) => {
            const expenses = row.cogsYen + row.personnelYen + row.rdYen + row.marketingYen + row.otherOpexYen;
            return <div key={row.fiscalYear} className="relative min-w-0 border-r border-dashed border-slate-200 px-1 last:border-r-0">
              <div className="absolute inset-x-1 bottom-1/2 top-2 flex items-end justify-center"><div className="w-4 min-w-2 bg-[#2f6f87]" style={{ height: percentage(row.revenueYen, plMaxMagnitude) }} title={`FY${row.fiscalYear} 売上 ${formatMillionFromYen(row.revenueYen)}百万円`} /></div>
              <div className="absolute inset-x-1 bottom-2 top-1/2 flex flex-col-reverse items-center justify-start"><div className="flex w-4 min-w-2 flex-col-reverse" style={{ height: percentage(expenses, plMaxMagnitude) }} title={`FY${row.fiscalYear} 費用 ${formatMillionFromYen(expenses)}百万円`}>{expenseSegments.map(([, color, key]) => row[key] > 0 ? <div key={key} style={{ height: `${(row[key] / Math.max(expenses, 1)) * 100}%`, backgroundColor: color }} /> : null)}</div></div>
              <div aria-hidden="true" className="absolute inset-x-1 top-1/2 border-t border-slate-300" />
              <div className={`absolute left-1/2 w-4 -translate-x-1/2 ${row.operatingProfitYen < 0 ? "bottom-1/2 bg-rose-500/80" : "top-1/2 bg-[#173f51]/80"}`} style={{ height: percentage(row.operatingProfitYen, plMaxMagnitude) }} title={`FY${row.fiscalYear} 営業利益 ${formatMillionFromYen(row.operatingProfitYen)}百万円`} />
            </div>;
          })}
        </div>
        <div className="grid border-t border-[#d8e2e5] bg-slate-50" style={columnStyle}>{rows.map((row) => <div key={row.fiscalYear} className="min-w-0 border-r border-[#d8e2e5] px-1 py-1.5 text-center last:border-r-0"><div className={`font-mono text-[10px] font-semibold tabular-nums ${row.operatingProfitYen < 0 ? "text-rose-700" : "text-[#173f51]"}`}>{formatMillionFromYen(row.operatingProfitYen)}</div><div className="mt-0.5 text-[8px] text-slate-500">営業利益</div></div>)}</div>
        {(hasCashFlow || showPreincorporationSpend) && <>
          <div className="border-y border-[#d8e2e5] bg-[#fbfcfc] px-2 py-2"><div className="text-[10px] font-semibold text-[#173f51]">資金レール <span className="ml-1 font-normal text-slate-500">P/Lとは別尺度・調達は売上に含めない</span></div></div>
          <div className="grid h-20 px-1 pt-2" style={columnStyle}>{rows.map((row) => <div key={row.fiscalYear} className="relative min-w-0 border-r border-dashed border-slate-200 px-1 last:border-r-0">
            <div aria-hidden="true" className="absolute inset-x-1 top-1/2 border-t border-slate-300" />
            {row.equityFundingYen ? <div className="absolute bottom-1/2 left-[16%] w-4 bg-[#b98025]" style={{ height: percentage(row.equityFundingYen, cashMaxMagnitude) }} title={`FY${row.fiscalYear} 株式調達 ${formatMillionFromYen(row.equityFundingYen)}百万円`} /> : null}
            {row.grantReceiptYen ? <div className="absolute bottom-1/2 left-[38%] w-4 bg-[#5d8a7b]" style={{ height: percentage(row.grantReceiptYen, cashMaxMagnitude) }} title={`FY${row.fiscalYear} 助成金等入金 ${formatMillionFromYen(row.grantReceiptYen)}百万円`} /> : null}
            {row.netCashFlowYen !== null ? <div className={`absolute left-[60%] w-4 ${row.netCashFlowYen < 0 ? "bottom-1/2 bg-rose-500" : "top-1/2 bg-[#2f766b]"}`} style={{ height: percentage(row.netCashFlowYen, cashMaxMagnitude) }} title={`FY${row.fiscalYear} 年次純C/F ${formatMillionFromYen(row.netCashFlowYen)}百万円`} /> : null}
            {showPreincorporationSpend && row.preincorporationSpendYen > 0 ? <div className="absolute bottom-1 left-[82%] w-4 bg-amber-500" style={{ height: percentage(row.preincorporationSpendYen, cashMaxMagnitude) }} title={`FY${row.fiscalYear} 設立前PJ支出 ${formatMillionFromYen(row.preincorporationSpendYen)}百万円`} /> : null}
          </div>)}</div>
          <div className="grid bg-slate-50" style={columnStyle}>{rows.map((row) => <div key={row.fiscalYear} className="min-w-0 border-r border-[#d8e2e5] px-1 py-1.5 text-center last:border-r-0"><div className={`font-mono text-[10px] tabular-nums ${row.netCashFlowYen !== null && row.netCashFlowYen < 0 ? "text-rose-700" : "text-[#2f766b]"}`}>{formatMillionFromYen(row.netCashFlowYen ?? 0)}</div><div className="mt-0.5 text-[8px] text-slate-500">年次純C/F</div></div>)}</div>
          <div className="border-t border-[#d8e2e5] px-2 py-2 text-[8px] leading-3 text-slate-600"><span className="mr-3 inline-flex items-center gap-1"><i className="h-2 w-2 bg-[#b98025]" />株式調達</span><span className="mr-3 inline-flex items-center gap-1"><i className="h-2 w-2 bg-[#5d8a7b]" />助成金等入金</span><span className="mr-3 inline-flex items-center gap-1"><i className="h-2 w-2 bg-[#2f766b]" />正：年次純C/F</span><span className="mr-3 inline-flex items-center gap-1"><i className="h-2 w-2 bg-rose-500" />負：年次純C/F</span>{showPreincorporationSpend ? <span className="inline-flex items-center gap-1 text-amber-800"><i className="h-2 w-2 bg-amber-500" />設立前PJ支出（NewCo P/L外）</span> : null}</div>
        </>}
      </div>
      <div className="mt-3 overflow-x-auto border border-[#cbd9de] bg-white">
        <table className="w-full min-w-[680px] border-collapse text-[10px] tabular-nums">
          <caption className="border-b border-[#cbd9de] bg-[#edf3f5] px-2 py-2 text-left text-[11px] font-semibold text-[#173f51]">年度別数値 <span className="ml-1 font-normal text-slate-500">単位：百万円</span></caption>
          <thead><tr className="border-b border-[#d8e2e5] text-slate-500"><th scope="col" className="w-44 px-2 py-1.5 text-left font-medium">項目</th>{rows.map((row) => <th key={row.fiscalYear} scope="col" className="border-l border-[#e2eaed] px-1.5 py-1.5 text-right font-medium">FY{row.fiscalYear}</th>)}</tr></thead>
          <tbody>{annualTableRows.map((tableRow) => <tr key={tableRow.label} className={`border-b border-[#edf1f2] last:border-b-0 ${tableRow.emphasis ? "bg-slate-50 font-semibold" : ""}`}><th scope="row" className={`px-2 py-1.5 text-left font-medium ${tableRow.tone === "preincorporation" ? "text-amber-800" : "text-slate-700"}`}>{tableRow.label}</th>{rows.map((row) => { const value = tableRow.values(row); return <td key={row.fiscalYear} className={`border-l border-[#edf1f2] px-1.5 py-1.5 text-right ${value < 0 ? "text-rose-700" : tableRow.tone === "cash" ? "text-[#2f766b]" : tableRow.tone === "funding" ? "text-[#9a6a1d]" : "text-slate-800"}`}>{formatMillionFromYen(value)}</td>; })}</tr>)}</tbody>
        </table>
      </div>
      </div>
    </section>
  );
}

export function Bzm22TimeLedger({
  pilot,
  gateMonths,
}: {
  pilot: Bzm22PilotProject;
  gateMonths: Record<string, number>;
}) {
  const [rows, setRows] = useState<ProjectPlMonthly[]>([]);
  const [monthlyCashflows, setMonthlyCashflows] = useState<ProjectMonthlyCashflow[]>([]);
  const axis = useMemo(() => {
    let horizon = pilot.calculationTrace.inputs.horizonMonths;
    if (pilot.projectId === "p21") {
      const [startYear, startMonth] = pilot.valuationDate.slice(0, 7).split("-").map(Number);
      for (const row of [...rows, ...monthlyCashflows]) {
        const [year, month] = row.ym.split("-").map(Number);
        horizon = Math.max(horizon, (year - startYear) * 12 + month - startMonth);
      }
    }
    return buildBzm22SharedMonthAxis(pilot.valuationDate, horizon);
  }, [pilot.projectId, pilot.valuationDate, pilot.calculationTrace.inputs.horizonMonths, rows, monthlyCashflows]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hearingOpen, setHearingOpen] = useState(false);
  const [sxEquityEvents, setSxEquityEvents] = useState<SxEquityFundingPlanEvent[]>(SX_DEFAULT_EQUITY_FUNDING_EVENTS);
  const [sxCapitalPlanStatus, setSxCapitalPlanStatus] = useState<"loading" | "active" | "fallback">("loading");
  const [sxIncorporationYm, setSxIncorporationYm] = useState(SX_INCORPORATION_YM);
  const [sxFirstFundingTarget, setSxFirstFundingTarget] = useState<SxFirstFundingTarget | null>(null);
  const [sxGrantEvidence, setSxGrantEvidence] = useState<SxGrantEvidence[]>([]);
  const [sxGrantEvidenceStatus, setSxGrantEvidenceStatus] = useState<"loading" | "loaded" | "unavailable">("loading");
  const [cxEquityEvents, setCxEquityEvents] = useState<SxEquityFundingPlanEvent[]>([]);

  const reload = async () => {
    setLoading(true);
    const [plRows, cashflowRows] = await Promise.all([fetchPlMonthly(pilot.projectId), fetchMonthlyCashflow(pilot.projectId)]);
    setRows(plRows);
    setMonthlyCashflows(cashflowRows);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilot.projectId]);

  useEffect(() => {
    if (pilot.projectId === "p20") {
      let active = true;
      void fetch(`/api/governance/capital-plans?projectId=${encodeURIComponent(pilot.projectId)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (!active || !isRecord(payload) || !Array.isArray(payload.plans)) return;
          const activePlan = payload.plans.find((plan) => isRecord(plan) && plan.status === "active");
          if (isRecord(activePlan)) setCxEquityEvents(equityEventsFromCapitalPlan(activePlan.document_json));
        });
      return () => { active = false; };
    }
    if (pilot.projectId !== "p21") return;
    let active = true;
    void Promise.allSettled([
      fetch(`/api/governance/capital-plans?projectId=${encodeURIComponent(pilot.projectId)}`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/grants?projectId=${encodeURIComponent(pilot.projectId)}`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/project/${encodeURIComponent(pilot.projectId)}/sx-funding-timing`).then((response) => response.ok ? response.json() : null),
    ]).then(([capitalResult, grantResult, meetingResult]) => {
      if (!active) return;
      if (capitalResult.status === "fulfilled" && isRecord(capitalResult.value) && Array.isArray(capitalResult.value.plans)) {
        const activePlan = capitalResult.value.plans.find((plan) => isRecord(plan) && plan.status === "active");
        const events = isRecord(activePlan) ? equityEventsFromCapitalPlan(activePlan.document_json) : [];
        const incorporationYm = isRecord(activePlan) ? incorporationYmFromCapitalPlan(activePlan.document_json) : null;
        if (incorporationYm) setSxIncorporationYm(incorporationYm);
        if (events.length > 0) {
          setSxEquityEvents(events);
          setSxCapitalPlanStatus("active");
        } else {
          setSxCapitalPlanStatus("fallback");
        }
      } else {
        setSxCapitalPlanStatus("fallback");
      }
      if (grantResult.status === "fulfilled" && isRecord(grantResult.value) && Array.isArray(grantResult.value.grants)) {
        setSxGrantEvidence(grantResult.value.grants.flatMap((grant): SxGrantEvidence[] => {
          if (!isRecord(grant)) return [];
          return [{
            grant_name: typeof grant.grant_name === "string" ? grant.grant_name : "助成金等",
            agency: typeof grant.agency === "string" ? grant.agency : null,
            amount_yen: grant.amount_yen === null ? null : Number(grant.amount_yen),
            disbursed_yen: grant.disbursed_yen === null ? null : Number(grant.disbursed_yen),
            adopted_date: typeof grant.adopted_date === "string" ? grant.adopted_date : null,
            period_start_ym: typeof grant.period_start_ym === "string" ? grant.period_start_ym : null,
            period_end_ym: typeof grant.period_end_ym === "string" ? grant.period_end_ym : null,
          }];
        }));
        setSxGrantEvidenceStatus("loaded");
      } else {
        setSxGrantEvidenceStatus("unavailable");
      }
      if (meetingResult.status === "fulfilled" && isRecord(meetingResult.value) && isRecord(meetingResult.value.target)) {
        const target = meetingResult.value.target;
        if (typeof target.ym === "string" && typeof target.sourceMeetingDate === "string" && typeof target.sourceMeetingId === "string") {
          setSxFirstFundingTarget({
            ym: target.ym,
            sourceMeetingDate: target.sourceMeetingDate,
            sourceMeetingId: target.sourceMeetingId,
            evidenceState: "internal_target",
          });
        }
      }
    });
    return () => { active = false; };
  }, [pilot.projectId]);

  const sxProjectPremiseItems = useMemo(() => {
    if (pilot.projectId !== "p21") return [] as Bzm22TimelineItem[];
    const items: Bzm22TimelineItem[] = [
      sxTimelineItem(
        "sx-dd-complete-before-incorporation",
        "設立前DD完了期限",
        previousYm(sxIncorporationYm),
        "funding_external",
        "AMDの必須ゲート。技術・法務・財務・知財のDD論点を会社設立より前に完了する。完了実績は未確認。",
      ),
      sxTimelineItem(
        "sx-canonical-incorporation",
        "会社設立",
        sxIncorporationYm,
        "commercial",
        "SXの会社設立予定月。設立前PJ活動とNewCoの会計主体をこの月で分ける。",
      ),
    ];
    if (sxFirstFundingTarget) {
      items.push(sxTimelineItem(
        "sx-first-funding-target",
        "初回資金調達目標",
        sxFirstFundingTarget.ym,
        "funding_external",
        "会議正本の内部目標。投資家合意・契約・着金実績ではない。",
      ));
    }
    for (const event of sxEquityEvents) {
      items.push(sxTimelineItem(
        `sx-capital-plan-${event.label}-${event.ym}`,
        `${event.label}調達（資本政策計上）`,
        event.ym,
        "funding_external",
        "active資本政策の計画イベント。着金実績ではない。",
      ));
    }
    return items;
  }, [pilot.projectId, sxEquityEvents, sxFirstFundingTarget, sxIncorporationYm]);
  const eventGroups = useMemo(
    () => buildEventGroups(pilot, axis, gateMonths, sxProjectPremiseItems),
    [axis, gateMonths, pilot, sxProjectPremiseItems],
  );

  useEffect(() => {
    if (selectedMonth === null || !eventGroups.positioned.some((group) => group.monthIndex === selectedMonth)) {
      setSelectedMonth(eventGroups.positioned[0]?.monthIndex ?? null);
    }
  }, [eventGroups.positioned, selectedMonth]);

  const rowByMonth = useMemo(() => new Map(rows.map((row) => [row.ym, row])), [rows]);
  const accountingEntityYm = pilot.projectId === "p21"
    ? sxIncorporationYm
    : pilot.projectId === "p20"
      ? CX_INCORPORATION_YM
      : null;
  // CXはNewCo単体の試算表。設立前のAMD/NIMS PJ費用を会社のP/Lへ持ち込まない。
  const visiblePlRows = pilot.projectId === "p21" ? SX_PL_ROWS : PL_ROWS;
  const sxCashLedger = useMemo(() => {
    if (pilot.projectId !== "p21") return [] as SxCashLedgerRow[];
    return buildSxSourceCashLedger(monthlyCashflows)
      .filter((row) => row.ym >= sxIncorporationYm);
  }, [pilot.projectId, monthlyCashflows, sxIncorporationYm]);
  const sxCashByMonth = useMemo(() => new Map(sxCashLedger.map((row) => [row.ym, row])), [sxCashLedger]);
  const cxCashLedger = useMemo(() => {
    if (pilot.projectId !== "p20") return [] as SxCashLedgerRow[];
    const financeByMonth = new Map((pilot.monthlyFinancePlan ?? []).map((row) => [row.ym, row]));
    return axis.filter((month) => month.ym >= CX_INCORPORATION_YM).map((month): SxCashLedgerRow => {
      const plan = financeByMonth.get(month.ym);
      const plRow = rowByMonth.get(month.ym) ?? emptyPlRow(pilot.projectId, month.ym);
      // CX NewCoの営業C/FはNewCo P/Lから読む。BZM入力は別行の経済CFに残し、二重計上しない。
      const operatingCashFlowYen = plValue(plRow, "operating_profit");
      const capexCashFlowYen = plan ? -Math.round(plan.capexMillionJpy * 1_000_000) : 0;
      const equityFundingYen = cxEquityEvents.filter((event) => event.ym === month.ym).reduce((total, event) => total + event.amountYen, 0);
      const grantReceiptYen = plan ? Math.round(plan.grantCashMillionJpy * 1_000_000) : 0;
      const netCashFlowYen = operatingCashFlowYen + capexCashFlowYen + equityFundingYen + grantReceiptYen;
      return { ym: month.ym, operatingCashFlowYen, capexCashFlowYen, equityFundingYen, loanDrawdownYen: null, grantReceiptYen, nonDilutiveFundingYen: 0, netCashFlowYen, openingCashYen: null, closingCashYen: null };
    });
  }, [axis, cxEquityEvents, pilot.monthlyFinancePlan, pilot.projectId, rowByMonth]);
  const cashLedger = pilot.projectId === "p21" ? sxCashLedger : cxCashLedger;
  const cashByMonth = useMemo(() => new Map(cashLedger.map((row) => [row.ym, row])), [cashLedger]);
  const lstCashByMonth = useMemo(() => new Map(monthlyCashflows.map((row) => [row.ym, row])), [monthlyCashflows]);
  const annualFinanceRows = useMemo(() => {
    const annual = new Map<number, AnnualFinanceSummaryRow>();
    for (const month of axis) {
      const plRow = rowByMonth.get(month.ym);
      const cashRow = cashByMonth.get(month.ym);
      if (!plRow && !cashRow) continue;
      const fiscalYear = fiscalYearFromYm(month.ym);
      const current = annual.get(fiscalYear) ?? {
        fiscalYear,
        revenueYen: 0,
        cogsYen: 0,
        personnelYen: 0,
        rdYen: 0,
        marketingYen: 0,
        otherOpexYen: 0,
        preincorporationSpendYen: 0,
        operatingProfitYen: 0,
        netCashFlowYen: cashRow ? 0 : null,
        equityFundingYen: cashRow ? 0 : null,
        grantReceiptYen: cashRow ? 0 : null,
      };
      if (plRow) {
        current.revenueYen += plDisplayValue(plRow, "revenue_yen", pilot.projectId, month.ym, accountingEntityYm) ?? 0;
        current.cogsYen += plDisplayValue(plRow, "cogs_yen", pilot.projectId, month.ym, accountingEntityYm) ?? 0;
        current.personnelYen += plDisplayValue(plRow, "personnel_yen", pilot.projectId, month.ym, accountingEntityYm) ?? 0;
        current.rdYen += plDisplayValue(plRow, "rd_yen", pilot.projectId, month.ym, accountingEntityYm) ?? 0;
        current.marketingYen += plDisplayValue(plRow, "marketing_yen", pilot.projectId, month.ym, accountingEntityYm) ?? 0;
        current.otherOpexYen += plDisplayValue(plRow, "other_opex_yen", pilot.projectId, month.ym, accountingEntityYm) ?? 0;
        if (pilot.projectId === "p21") current.preincorporationSpendYen += plDisplayValue(plRow, "preincorporation_spend", pilot.projectId, month.ym, accountingEntityYm) ?? 0;
        current.operatingProfitYen += plDisplayValue(plRow, "operating_profit", pilot.projectId, month.ym, accountingEntityYm) ?? 0;
      }
      if (cashRow) {
        current.netCashFlowYen = (current.netCashFlowYen ?? 0) + cashRow.netCashFlowYen;
        current.equityFundingYen = (current.equityFundingYen ?? 0) + cashRow.equityFundingYen;
        current.grantReceiptYen = (current.grantReceiptYen ?? 0) + cashRow.grantReceiptYen;
      }
      annual.set(fiscalYear, current);
    }
    return [...annual.values()].sort((left, right) => left.fiscalYear - right.fiscalYear);
  }, [accountingEntityYm, axis, cashByMonth, pilot.projectId, rowByMonth]);
  const sxFirstEquityEvent = useMemo(
    () => [...sxEquityEvents].sort((left, right) => left.ym.localeCompare(right.ym))[0] ?? null,
    [sxEquityEvents],
  );
  const sxVisibleCashLedger = useMemo(() => axis.flatMap((month) => {
    const row = sxCashByMonth.get(month.ym);
    return row ? [row] : [];
  }), [axis, sxCashByMonth]);
  const sxFinanceSummary = useMemo(() => {
    if (sxVisibleCashLedger.length === 0) return null;
    const sum = (field: "capexCashFlowYen" | "equityFundingYen" | "grantReceiptYen") =>
      sxVisibleCashLedger.reduce((total, row) => total + row[field], 0);
    const adoptedYen = sxGrantEvidence.reduce((total, grant) => total + Number(grant.amount_yen ?? 0), 0);
    const disbursedKnown = sxGrantEvidence.some((grant) => grant.disbursed_yen !== null);
    const disbursedYen = sxGrantEvidence.reduce((total, grant) => total + Number(grant.disbursed_yen ?? 0), 0);
    return {
      capexYen: -sum("capexCashFlowYen"),
      equityFundingYen: sum("equityFundingYen"),
      grantReceiptYen: sum("grantReceiptYen"),
      // 採用月次試算表の対象外の資金は、C/F要約へ補完計上しない。
      phase0FundingYen: 0,
      closingCashYen: sxVisibleCashLedger.at(-1)?.closingCashYen ?? null,
      adoptedYen,
      disbursedKnown,
      disbursedYen,
    };
  }, [sxGrantEvidence, sxVisibleCashLedger]);
  const sxFinanceCommentsByCell = useMemo(() => {
    const comments = buildSxMonthlyFinanceComments(axis.map((month) => month.ym), sxEquityEvents, monthlyCashflows);
    const grouped = new Map<string, LedgerCellComment[]>();
    const add = (metric: SxMonthlyFinanceComment["metric"], ym: string, comment: LedgerCellComment) => {
      const key = `${metric}:${ym}`;
      grouped.set(key, [...(grouped.get(key) ?? []), comment]);
    };
    for (const comment of comments) {
      add(comment.metric, comment.ym, {
        id: `${comment.metric}-${comment.ym}-${comment.title}`,
        title: comment.title,
        detail: comment.detail,
        evidenceState: comment.evidenceState,
      });
    }
    for (const grant of sxGrantEvidence) {
      const visibleMonth = axis.find((month) =>
        (!grant.period_start_ym || month.ym >= grant.period_start_ym)
        && (!grant.period_end_ym || month.ym <= grant.period_end_ym));
      if (!visibleMonth) continue;
      add("grantReceiptYen", visibleMonth.ym, {
        id: `grant-observed-${grant.grant_name}-${visibleMonth.ym}`,
        title: `${grant.grant_name} 採択情報`,
        detail: `${grant.agency ? `${grant.agency}。` : ""}採択額 ${formatMillionFromYen(Number(grant.amount_yen ?? 0))}、採択日 ${grant.adopted_date ?? "未登録"}、受領実績 ${grant.disbursed_yen === null ? "未確認" : formatMillionFromYen(grant.disbursed_yen)}。受領未確認分は当月入金へ計上しない。`,
        evidenceState: "observed",
      });
    }
    return grouped;
  }, [axis, sxEquityEvents, sxGrantEvidence, monthlyCashflows]);
  const cxFinanceCommentsByCell = useMemo(() => {
    const grouped = new Map<string, LedgerCellComment[]>();
    const add = (metric: string, ym: string, comment: LedgerCellComment) => {
      const key = `${metric}:${ym}`;
      grouped.set(key, [...(grouped.get(key) ?? []), comment]);
    };
    if (pilot.projectId !== "p20") return grouped;
    for (const plan of pilot.monthlyFinancePlan ?? []) {
      if (plan.ym < CX_INCORPORATION_YM) continue;
      if (plan.capexMillionJpy !== 0) add("capexCashFlowYen", plan.ym, {
        id: `cx-capex-${plan.ym}`,
        title: "BZM設備投資前提",
        detail: `BZM 2.2の月次入力。設備投資 ${plan.capexMillionJpy}。P/L実績ではなく、${plan.status}。`,
        evidenceState: "plan",
      });
      if (plan.opexMillionJpy !== 0 || plan.revenueMillionJpy !== 0) add("operatingCashFlowYen", plan.ym, {
        id: `cx-operating-${plan.ym}`,
        title: "BZM営業C/F前提",
        detail: `売上 ${plan.revenueMillionJpy}、運営費 ${plan.opexMillionJpy}。P/L実績とは混同しない ${plan.status} の推定。`,
        evidenceState: "plan",
      });
    }
    for (const event of cxEquityEvents) {
      if (event.ym < CX_INCORPORATION_YM) continue;
      add("equityFundingYen", event.ym, {
        id: `cx-equity-${event.label}-${event.ym}`,
        title: `${event.label} 資本政策計上`,
        detail: `active資本政策の計画額 ${formatMillionFromYen(event.amountYen)}。売上ではなく財務C/Fのみへ計上。着金実績ではない。`,
        evidenceState: "plan",
      });
    }
    return grouped;
  }, [cxEquityEvents, pilot.monthlyFinancePlan, pilot.projectId]);
  const sxPhaseCommentsByCell = useMemo(() => new Map(
    SX_BUSINESS_PLAN_PHASES.flatMap((phase): Array<[string, LedgerCellComment]> => {
      const ym = phaseStartYm(phase.period);
      if (!axis.some((month) => month.ym === ym)) return [];
      const metricKey: PlMetricKey = ym < sxIncorporationYm ? "preincorporation_spend" : "operating_profit";
      return [[`${metricKey}:${ym}`, {
        id: `phase-start-${phase.id}`,
        title: `${phase.label} 開始`,
        detail: `${phase.period}。フェーズ予算 ${formatMillionFromYen(phase.budgetYen)}、開始時の資金計画は${phase.openingRound}。${metricKey === "preincorporation_spend" ? "会社設立前はNewCoの営業損失にせず、PJ支出として表示する。" : "月次P/Lは一次月別内訳がない範囲を推定配賦している。"}`,
        evidenceState: "plan",
      }]];
    }),
  ), [axis, sxIncorporationYm]);
  const selectedGroup = eventGroups.positioned.find((group) => group.monthIndex === selectedMonth) ?? null;
  const draftBeforeIncorporation = Boolean(draft && accountingEntityYm && draft.ym < accountingEntityYm);
  const registeredPolicy = pilot.timeline.lanes.find((lane) => lane.key === "registered_policy")?.items[0];
  const gridStyle = {
    gridTemplateColumns: `var(--bzm-ledger-label-width) repeat(${axis.length}, ${MONTH_WIDTH}px)`,
    width: `calc(var(--bzm-ledger-label-width) + ${axis.length * MONTH_WIDTH}px)`,
  } satisfies CSSProperties;

  const startEdit = (cell: Bzm22SharedMonthAxisCell) => {
    setSaveError(null);
    if (pilot.projectId === "p20" && cell.ym < CX_INCORPORATION_YM) {
      setSaveError(`CX NewCoは${CX_INCORPORATION_YM}設立。設立前のPJ費用はこの試算表へ入力しない。`);
      return;
    }
    setDraft(draftFromRow(rowByMonth.get(cell.ym) ?? emptyPlRow(pilot.projectId, cell.ym)));
  };

  const save = async () => {
    if (!draft || !/^\d{4}-\d{2}$/.test(draft.ym)) return;
    setSaving(true);
    setSaveError(null);
    const toYen = (value: string) => Math.round((Number(value) || 0) * 1_000_000);
    const saved = await upsertPlMonthly(pilot.projectId, {
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
    await reload();
  };

  const remove = async () => {
    if (!draft?.id || !confirm(`${draft.ym} の月次試算を削除する？`)) return;
    setSaving(true);
    const deleted = await deletePlMonthly(pilot.projectId, draft.id);
    setSaving(false);
    if (!deleted) {
      setSaveError("削除できなかった。接続を確認して。");
      return;
    }
    setDraft(null);
    await reload();
  };

  return (
    <TooltipProvider delay={100}>
    <section data-testid="bzm22-time-ledger" data-density="compact-ledger" className="border-b border-[#b9cbd1] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-200 px-2 py-1.5">
        <div>
          <h3 className="text-[13px] font-semibold text-[#173f51]">イベントと月次試算表</h3>
          <p className="text-[9px] text-slate-600">イベント、P/L、C/Fを同じ月列で読む。◆は変動理由。</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <span className="mr-1 text-[10px] font-semibold text-slate-600">単位：百万円</span>
          <button type="button" onClick={() => setHearingOpen(true)} className="h-8 border border-[#6d8a96] bg-white px-2 text-[10px] font-semibold text-[#285b6b] transition-colors hover:bg-[#f1f5f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]">つくよみと試算</button>
          <button type="button" onClick={() => startEdit(axis[0])} className="h-8 border border-[#173f51] bg-[#173f51] px-2 text-[10px] font-semibold text-white transition-colors hover:bg-[#285b6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]">月を入力</button>
        </div>
      </header>

      {sxFinanceSummary ? (
        <div className="border-b border-slate-200 bg-[#f7f9fa] p-1.5" data-testid="sx-monthly-finance-summary">
          <div data-testid="sx-premise-audit" className="mb-1 grid grid-cols-[auto_1fr] gap-x-2 border border-amber-300 bg-amber-50 px-1.5 py-1 text-[8px] leading-3">
            <b className="text-amber-900">SX前提監査</b>
            <span className="text-amber-900">設立 {sxIncorporationYm} / 設立前DD完了期限 {previousYm(sxIncorporationYm)} / 初回調達目標 {sxFirstFundingTarget?.ym ?? "未抽出"}</span>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-4 xl:grid-cols-8">
            {[
              ["会社設立", sxIncorporationYm],
              ["設立前DD", `${previousYm(sxIncorporationYm)}まで`],
              ...(sxFinanceSummary.phase0FundingYen > 0 ? [["設立前PJ資金", formatMillionFromYen(sxFinanceSummary.phase0FundingYen)]] : []),
              ["設備投資", formatMillionFromYen(sxFinanceSummary.capexYen)],
              ["株式調達", formatMillionFromYen(sxFinanceSummary.equityFundingYen)],
              ["融資", "未計画"],
              ["助成金等入金（計画）", formatMillionFromYen(sxFinanceSummary.grantReceiptYen)],
              [`${sxVisibleCashLedger.at(-1)?.ym ?? "期末"} 月末資金`, sxFinanceSummary.closingCashYen === null ? "未登録" : formatMillionFromYen(sxFinanceSummary.closingCashYen)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-1.5 py-1">
                <div className="truncate text-[8px] font-medium leading-3 text-slate-500">{label}</div>
                <div className="text-right font-mono text-[12px] font-semibold leading-4 tabular-nums text-slate-900">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 border border-slate-200 bg-white px-1.5 py-1 text-[8px] leading-3 text-slate-600">
            <span data-testid="sx-first-funding-target"><b className="text-[#173f51]">初回調達目標</b> {sxFirstFundingTarget?.ym ?? "未抽出"} <span className="text-amber-700">MTG内部目標・着金未合意{sxFirstFundingTarget ? `（${sxFirstFundingTarget.sourceMeetingDate}）` : ""}</span></span>
            <span data-testid="sx-first-capital-plan-event"><b className="text-[#173f51]">資本政策計上</b> {sxFirstEquityEvent ? `${sxFirstEquityEvent.ym} ${sxFirstEquityEvent.label} ${formatMillionFromYen(sxFirstEquityEvent.amountYen)}` : "未登録"} <span className="text-slate-400">{sxCapitalPlanStatus === "active" ? "現行案" : sxCapitalPlanStatus === "loading" ? "読込中" : "内蔵案"}</span></span>
            <span><b className="text-[#173f51]">PSI/GAP</b> 採択 {sxGrantEvidenceStatus === "loading" ? "読込中" : sxGrantEvidenceStatus === "unavailable" ? "取得不能" : formatMillionFromYen(sxFinanceSummary.adoptedYen)} / 受領 {sxGrantEvidenceStatus === "loaded" && sxFinanceSummary.disbursedKnown ? formatMillionFromYen(sxFinanceSummary.disbursedYen) : "未確認"}</span>
          </div>
          <details className="mt-0.5 text-[8px] leading-3 text-slate-500">
            <summary className="cursor-pointer list-none font-semibold text-[#376274] marker:content-none">計上規則と精度を表示</summary>
            <p className="mt-0.5">採用試算表 v3.2（2027年4月〜2037年3月）の計画値。営業CFは税金・償却の足し戻し・運転資金を反映した原表の額。設備投資・調達・月初月末現金も原表の月別額を表示する。初回1.5億円、STS入金なし。回収・支払は翌月の仮定。対象期間外の資金は補完しない。</p>
          </details>
        </div>
      ) : null}

      <div data-testid="bzm22-shared-month-scroll" className="max-w-full overflow-x-auto overscroll-x-contain">
        <div className="grid [--bzm-ledger-label-width:108px] sm:[--bzm-ledger-label-width:172px]" style={gridStyle}>
          <div className="sticky left-0 z-40 border-b border-r border-slate-300 bg-[#f7f9fa] px-2 py-1">
            <div className="text-[11px] font-semibold text-[#173f51]">事業価値の時間軸</div>
            <div className="text-[8px] leading-3 text-slate-500">M0=価値基準月。点で前提表示。</div>
            {eventGroups.outside.length > 0 ? <div className="text-[8px] text-slate-500">期間外 {eventGroups.outside.length}件</div> : null}
            {eventGroups.undated.length > 0 ? <div className="text-[8px] text-slate-500">日付なし {eventGroups.undated.length}件</div> : null}
          </div>
          <div className="relative border-b border-slate-300 bg-white" style={{ gridColumn: `2 / span ${axis.length}`, height: TIMELINE_HEIGHT }}>
            {axis.map((month) => (
              <span
                key={month.ym}
                aria-hidden="true"
                className={`absolute inset-y-0 border-l ${month.calendarMonth === 1 || month.month === 0 ? "border-slate-300" : "border-slate-100"}`}
                style={{ left: month.month * MONTH_WIDTH }}
              />
            ))}
            {accountingEntityYm && axis.some((month) => month.ym === accountingEntityYm) ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 z-10 w-0 border-l-2 border-[#173f51]"
                style={{ left: axis.findIndex((month) => month.ym === accountingEntityYm) * MONTH_WIDTH }}
              />
            ) : null}
            {registeredPolicy ? (
              <div className="absolute top-1 z-10 h-[18px] border-y border-[#82a3ae] bg-[#e7eff2]" style={{ left: MONTH_WIDTH / 2, width: pilot.calculationTrace.inputs.horizonMonths * MONTH_WIDTH }}>
                <span className="sticky left-1 block w-fit px-1 text-[9px] font-semibold leading-[16px] text-[#24596a]">{registeredPolicy.label} · M0–M{pilot.calculationTrace.inputs.horizonMonths}</span>
              </div>
            ) : null}
            <div className="absolute left-0 right-0 h-px bg-[#173f51]" style={{ top: AXIS_Y }} />
            {axis.map((month) => (
              <span key={`tick-${month.ym}`} aria-hidden="true" className="absolute h-2 w-px bg-[#173f51]" style={{ left: month.month * MONTH_WIDTH + MONTH_WIDTH / 2, top: AXIS_Y - 4 }} />
            ))}
            {eventGroups.positioned.map((group) => (
              <EventCard
                key={`${group.monthIndex}-${group.items.map((item) => item.id).join("-")}`}
                group={group}
                axis={axis}
                selected={selectedMonth === group.monthIndex}
                onSelect={() => setSelectedMonth(group.monthIndex)}
              />
            ))}
          </div>

          <div className="sticky left-0 z-40 border-b border-r border-slate-300 bg-[#edf3f5] px-2 py-1">
            <div className="text-[11px] font-semibold text-[#173f51]">月次試算表</div>
            <div className="text-[8px] leading-3 text-slate-500">P/L・資金繰り</div>
          </div>
          {axis.map((month) => (
            <MonthCellFrame key={`header-${month.ym}`} month={month} className={`bg-[#edf3f5] px-1.5 py-1 text-right ${month.ym === accountingEntityYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
              <button type="button" onClick={() => startEdit(month)} className="w-full text-right hover:text-[#173f51] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]" title={`${month.ym}を入力・編集`}>
                <span className="block text-[10px] font-semibold leading-3 text-[#365865]">M{month.month}</span>
                <span className="block font-mono text-[8px] leading-3 text-slate-500">{month.ym}</span>
              </button>
            </MonthCellFrame>
          ))}

          {accountingEntityYm ? (
            <>
              <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-white px-2 py-0.5 text-[9px] font-semibold leading-4 text-slate-600">計上主体</div>
              {axis.map((month) => {
                const beforeIncorporation = month.ym < accountingEntityYm;
                return (
                  <MonthCellFrame key={`entity-${month.ym}`} month={month} className={`px-1 py-0.5 text-right text-[8px] font-semibold leading-4 ${beforeIncorporation ? "bg-slate-100 text-slate-500" : "bg-[#e7eff2] text-[#173f51]"} ${month.ym === accountingEntityYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
                    {beforeIncorporation ? (pilot.projectId === "p20" ? "法人未設立" : "設立前PJ") : "NewCo"}
                  </MonthCellFrame>
                );
              })}
            </>
          ) : null}

          <div className="contents">
            <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#173f51] px-2 py-0.5 text-[10px] font-semibold leading-4 text-white">{pilot.projectId === "p20" ? "NewCo P/L" : "設立前PJ支出 / NewCo P/L"}</div>
            {axis.map((month) => <MonthCellFrame key={`pl-section-${month.ym}`} month={month} className={`bg-[#173f51] ${month.ym === accountingEntityYm ? "border-l-2 border-l-white" : ""}`} />)}
          </div>

          {visiblePlRows.map((metric) => {
            const total = axis.reduce((sum, month) => sum + (plDisplayValue(rowByMonth.get(month.ym) ?? emptyPlRow(pilot.projectId, month.ym), metric.key, pilot.projectId, month.ym, accountingEntityYm) ?? 0), 0);
            const result = metric.key === "operating_profit";
            const metricLabel = accountingEntityYm && metric.key === "gross_profit"
              ? "粗利（NewCo）"
              : accountingEntityYm && metric.key === "operating_profit"
                ? "営業利益（NewCo）"
                : metric.label;
            return (
              <div key={metric.key} className="contents" data-testid={`bzm22-pl-row-${metric.key}`}>
                <div className={`sticky left-0 z-30 flex items-center justify-between gap-1 border-b border-r border-slate-300 px-2 py-0.5 ${result || metric.key === "preincorporation_spend" ? "bg-[#edf3f5]" : "bg-white"}`}>
                  <div className={`truncate text-[10px] leading-4 ${result || metric.key === "preincorporation_spend" ? "font-semibold text-[#173f51]" : "text-slate-700"}`}>{metricLabel}</div>
                  <div className="truncate text-right font-mono text-[8px] leading-3 tabular-nums text-slate-500">計 {formatMillionFromYen(total)}</div>
                </div>
                {axis.map((month) => {
                  const row = rowByMonth.get(month.ym) ?? emptyPlRow(pilot.projectId, month.ym);
                  const value = plDisplayValue(row, metric.key, pilot.projectId, month.ym, accountingEntityYm);
                  const comments = [sxPhaseCommentsByCell.get(`${metric.key}:${month.ym}`)].filter((comment): comment is LedgerCellComment => Boolean(comment));
                  const notApplicableBeforeIncorporation = value === null && Boolean(accountingEntityYm && month.ym < accountingEntityYm);
                  return (
                    <MonthCellFrame key={`${metric.key}-${month.ym}`} month={month} className={`px-1.5 py-0.5 text-right ${comments.length > 0 ? "bg-amber-50/70" : metric.kind === "calculated" ? "bg-slate-50" : "bg-white"} ${month.ym === accountingEntityYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
                      {metric.kind === "input" && !notApplicableBeforeIncorporation ? (
                        <button type="button" onClick={() => startEdit(month)} className="block w-full text-right font-mono text-[11px] leading-4 tabular-nums text-slate-700 hover:text-[#173f51] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96] decoration-dotted" title={`${month.ym}の${metricLabel}を編集`}>
                          {formatMillionFromYen(value ?? 0)}
                        </button>
                      ) : (
                        <span className="flex items-center justify-end gap-1" data-accounting-scope={notApplicableBeforeIncorporation ? "not-applicable-before-incorporation" : undefined}>
                          <FinanceCellComment comments={comments} ym={month.ym} metricLabel={metricLabel} />
                          <span className={`font-mono text-[11px] leading-4 tabular-nums ${result && typeof value === "number" && value < 0 ? "text-rose-700" : "text-slate-700"}`} title={notApplicableBeforeIncorporation ? "会社設立前のためNewCoのP/L対象外" : undefined}>{value === null ? "—" : formatMillionFromYen(value)}</span>
                        </span>
                      )}
                    </MonthCellFrame>
                  );
                })}
              </div>
            );
          })}

          {cashLedger.length > 0 ? (
            <>
              <div className="contents">
                <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#365865] px-2 py-0.5 text-[10px] font-semibold leading-4 text-white">NewCo C/F・資金繰り</div>
                {axis.map((month) => <MonthCellFrame key={`cf-section-${month.ym}`} month={month} className={`${accountingEntityYm && month.ym < accountingEntityYm ? "bg-slate-300" : "bg-[#365865]"} ${month.ym === accountingEntityYm ? "border-l-2 border-l-white" : ""}`} />)}
              </div>
              {SX_CASH_ROWS.map((metric) => (
                <div key={metric.key} className="contents">
                  <div className={`sticky left-0 z-30 border-b border-r border-slate-300 px-2 py-0.5 ${metric.emphasis ? "bg-[#edf3f5]" : "bg-white"}`}>
                    <div className={`truncate text-[10px] leading-4 ${metric.emphasis ? "font-semibold text-[#173f51]" : "text-slate-700"}`}>
                      {pilot.projectId === "p21" && metric.key === "operatingCashFlowYen" ? "営業C/F（採用試算）" : metric.label}
                      {metric.kind === "unplanned" ? <span className="ml-1 text-[8px] text-slate-500">未計画</span> : null}
                    </div>
                  </div>
                  {axis.map((month) => {
                    const row = cashByMonth.get(month.ym);
                    const value = row?.[metric.key] ?? null;
                    const commentMetric = metric.key === "capexCashFlowYen"
                      ? "capexYen"
                      : metric.key === "equityFundingYen" || metric.key === "grantReceiptYen"
                        ? metric.key
                        : null;
                    const comments = commentMetric ? sxFinanceCommentsByCell.get(`${commentMetric}:${month.ym}`) ?? [] : [];
                    const cxComments = commentMetric ? cxFinanceCommentsByCell.get(`${commentMetric}:${month.ym}`) ?? [] : [];
                    const allComments = [...comments, ...cxComments];
                    return (
                      <MonthCellFrame key={`${metric.key}-${month.ym}`} month={month} className={`px-1.5 py-0.5 text-right ${accountingEntityYm && month.ym < accountingEntityYm ? "bg-slate-100" : allComments.length > 0 ? "bg-amber-50/70" : metric.emphasis ? "bg-slate-50" : "bg-white"} ${month.ym === accountingEntityYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
                        <span className="flex items-center justify-end gap-1">
                          <FinanceCellComment comments={allComments} ym={month.ym} metricLabel={metric.label} />
                          <span className={`font-mono text-[11px] leading-4 tabular-nums ${typeof value === "number" && value < 0 ? "text-rose-700" : "text-slate-700"}`}>
                            {value === null ? "—" : formatMillionFromYen(value)}
                          </span>
                        </span>
                      </MonthCellFrame>
                    );
                  })}
                </div>
              ))}
            </>
          ) : null}

          {pilot.projectId === "p07" && monthlyCashflows.length > 0 ? (
            <>
              <div className="contents">
                <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#365865] px-2 py-0.5 text-[10px] font-semibold leading-4 text-white">取締役会資料 C/F・資金繰り <span className="text-[8px] font-normal">2026/4–7実績・8–3見込</span></div>
                {axis.map((month) => <MonthCellFrame key={`lst-cf-section-${month.ym}`} month={month} className="bg-[#365865]" />)}
              </div>
              {LST_CASH_ROWS.map((metric) => (
                <div key={metric.key} className="contents">
                  <div className={`sticky left-0 z-30 border-b border-r border-slate-300 px-2 py-0.5 ${metric.emphasis ? "bg-[#edf3f5]" : "bg-white"}`}>
                    <div className={`truncate text-[10px] leading-4 ${metric.emphasis ? "font-semibold text-[#173f51]" : "text-slate-700"}`}>{metric.label}</div>
                  </div>
                  {axis.map((month) => {
                    const row = lstCashByMonth.get(month.ym);
                    const value = row?.[metric.key] ?? null;
                    return <MonthCellFrame key={`${metric.key}-${month.ym}`} month={month} className={`px-1.5 py-0.5 text-right ${metric.emphasis ? "bg-slate-50" : "bg-white"}`}>
                      <span className={`font-mono text-[11px] leading-4 tabular-nums ${typeof value === "number" && value < 0 ? "text-rose-700" : "text-slate-700"}`} title={row?.source_note ?? undefined}>{value === null ? "—" : formatMillionFromYen(value)}</span>
                    </MonthCellFrame>;
                  })}
                </div>
              ))}
            </>
          ) : null}

          <div className="sticky left-0 z-30 border-b border-r border-t-2 border-slate-400 bg-[#f7f2e8] px-2 py-0.5">
            <div className="text-[10px] font-semibold leading-4 text-[#6b5127]">BZM経済CF</div>
            <div className="text-[8px] leading-3 text-slate-500">資金繰りと別。J・Pへ接続</div>
          </div>
          {axis.map((month) => {
            const value = month.month > pilot.calculationTrace.inputs.horizonMonths ? null : month.month === 0
              ? 0
              : pilot.calculationTrace.inputs.cashFlow.monthlyEconomicCFMillionJpy.base[month.month - 1] ?? 0;
            return (
              <MonthCellFrame key={`bzm-cf-${month.ym}`} month={month} className={`border-t-2 border-t-slate-400 bg-[#fdfaf4] px-1.5 py-0.5 text-right ${month.ym === accountingEntityYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
                <span className="font-mono text-[11px] leading-4 tabular-nums text-[#6b5127]">{value === null ? "—" : formatMillion(value)}</span>
              </MonthCellFrame>
            );
          })}
        </div>
      </div>

      <AnnualFinanceChart rows={annualFinanceRows} showPreincorporationSpend={pilot.projectId === "p21"} />

      {selectedGroup ? (
        <div className="border-t border-slate-200 bg-[#f7f9fa] px-2 py-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] leading-3 text-slate-600">
            <span className="font-semibold text-[#173f51]">M{selectedGroup.monthIndex} · {axis[selectedGroup.monthIndex].ym}</span>
            {selectedGroup.items.map((item) => {
              const category = CATEGORY_META[item.category];
              const gate = pilot.calculationTrace.inputs.gates.find((candidate) => candidate.label === item.label);
              return (
                <span key={item.id} className="inline-flex flex-wrap items-center gap-1 border-l-2 pl-2" style={{ borderColor: category.color }}>
                  <b className="text-slate-700">{item.label}</b>
                  {gate ? <span>通過値 {formatRate(gate.probabilities.base)} / 停止時 {formatMillion(gate.signedFailureSettlementMillionJpy.base)}</span> : null}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {loading ? <div className="px-2 py-1 text-[9px] text-slate-500">月次試算を読み込み中…</div> : null}
      {!loading && rows.length === 0 ? <div className="px-2 py-1 text-[9px] text-slate-500">月次試算の入力はまだない。月見出しか「月を入力」から入力できる。</div> : null}

      <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open && !saving) setDraft(null); }}>
      {draft ? (
        <DialogContent data-testid="bzm22-monthly-edit-dialog" className="max-h-[90vh] overflow-y-auto rounded-none border border-[#7898a5] bg-white p-0 sm:!max-w-[680px]" showCloseButton={!saving}>
          <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <DialogHeader className="border-b border-slate-200 bg-[#edf3f5] px-4 py-3">
            <DialogTitle className="text-[15px] font-semibold text-[#173f51]">{draft.ym} の{draftBeforeIncorporation ? "設立前PJ支出" : "月次試算"}</DialogTitle>
            <DialogDescription className="text-[11px]">入力単位は百万円。{draftBeforeIncorporation ? "この月の明細はNewCo P/Lへ表示せず、設立前PJ支出へ集約する。" : "保存後、同じ月列へ即時反映する。"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 p-4 sm:grid-cols-3">
            {([
              ["revenue_yen", "売上"],
              ["cogs_yen", "売上原価"],
              ["personnel_yen", "人件費"],
              ["rd_yen", "研究開発費"],
              ["marketing_yen", "マーケ費"],
              ["other_opex_yen", "その他販管費"],
            ] as const).map(([key, label]) => (
              <label key={key} className="text-[11px] font-semibold text-slate-600">{label}（百万円）
                <input type="number" step="0.1" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} onFocus={(event) => event.currentTarget.select()} className="mt-1 h-10 w-full border border-slate-300 bg-white px-3 text-right font-mono text-sm font-normal outline-none focus:border-[#285b6b] focus:ring-2 focus:ring-[#a9c5cf]" />
              </label>
            ))}
            <label className="text-[11px] font-semibold text-slate-600 sm:col-span-3">メモ
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
        <CockpitPlHearingModal
          projectId={pilot.projectId}
          onClose={() => setHearingOpen(false)}
          onApplied={async () => { await reload(); }}
        />
      ) : null}
    </section>
    </TooltipProvider>
  );
}
