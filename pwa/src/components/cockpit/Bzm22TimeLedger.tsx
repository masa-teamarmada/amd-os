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
  fetchPlMonthly,
  upsertPlMonthly,
  type ProjectPlMonthly,
} from "@/lib/venture-status-data";
import {
  buildSxMonthlyFinancePlan,
  SX_DEFAULT_EQUITY_FUNDING_EVENTS,
  type SxEquityFundingPlanEvent,
} from "@/lib/sx-monthly-finance-plan";
import { CockpitPlHearingModal } from "./CockpitPlHearingModal";

const MONTH_WIDTH = 112;
const EVENT_CARD_WIDTH = 232;
const AXIS_Y = 184;

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

type PlMetricKey = PlField | "gross_profit" | "operating_profit";

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
  amount_yen: number | null;
  disbursed_yen: number | null;
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
  openingCashYen: number;
  closingCashYen: number;
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
  { key: "grantReceiptYen", label: "助成金等入金（計画）", kind: "flow" },
  { key: "netCashFlowYen", label: "月次純C/F", kind: "flow", emphasis: true },
  { key: "closingCashYen", label: "月末資金残高（簡易）", kind: "balance", emphasis: true },
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
  return Number(row[key]);
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
) {
  const groups = new Map<number, Bzm22TimelineItem[]>();
  const outside: Bzm22TimelineItem[] = [];
  const undated: Bzm22TimelineItem[] = [];
  const eventItems = pilot.timeline.lanes
    .flatMap((lane) => lane.items)
    .filter((item) => item.category !== "registered_policy");
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

  const lastMonthByPosition = [-99, -99, -99, -99];
  const preferredPositions = [0, 2, 1, 3];
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
  const topSide = group.position < 2;
  const tier = group.position % 2;
  const top = topSide ? (tier === 0 ? 108 : 36) : (tier === 0 ? 208 : 280);
  const cardHeight = 60;
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
        className={`absolute z-20 overflow-hidden border bg-white px-3 py-2 text-left transition-colors ${selected ? "border-[#173f51]" : "border-slate-300 hover:border-[#678692]"}`}
        style={{
          left: cardX,
          top,
          width: EVENT_CARD_WIDTH,
          height: cardHeight,
          transform,
          boxShadow: selected ? "0 0 0 1px #173f51" : "none",
        }}
        title={`${first.label}：${first.choiceLabel}`}
      >
        <span className="block truncate text-xs font-semibold text-[#173f51]">{first.label}</span>
        <span className="mt-1 block truncate text-xs text-slate-500">{first.choiceLabel}</span>
        {group.items.length > 1 ? <span className="absolute right-1 top-1 text-xs text-slate-400">ほか{group.items.length - 1}件</span> : null}
      </button>
      <span
        aria-hidden="true"
        className="absolute z-10 w-px bg-slate-400"
        style={{ left: cardX, top: connectorTop, height: Math.max(0, connectorHeight) }}
      />
      <button
        type="button"
        aria-label={`${axis[group.monthIndex].ym} ${first.label}`}
        onClick={onSelect}
        className="absolute z-30 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 bg-white"
        style={{ left: cardX, top: AXIS_Y, borderColor: category.color }}
      />
    </>
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

export function Bzm22TimeLedger({
  pilot,
  gateMonths,
}: {
  pilot: Bzm22PilotProject;
  gateMonths: Record<string, number>;
}) {
  const axis = useMemo(
    () => buildBzm22SharedMonthAxis(pilot.valuationDate, pilot.calculationTrace.inputs.horizonMonths),
    [pilot.valuationDate, pilot.calculationTrace.inputs.horizonMonths],
  );
  const eventGroups = useMemo(
    () => buildEventGroups(pilot, axis, gateMonths),
    [axis, gateMonths, pilot],
  );
  const [selectedMonth, setSelectedMonth] = useState<number | null>(eventGroups.positioned[0]?.monthIndex ?? null);
  const [rows, setRows] = useState<ProjectPlMonthly[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hearingOpen, setHearingOpen] = useState(false);
  const [sxEquityEvents, setSxEquityEvents] = useState<SxEquityFundingPlanEvent[]>(SX_DEFAULT_EQUITY_FUNDING_EVENTS);
  const [sxGrantEvidence, setSxGrantEvidence] = useState<SxGrantEvidence[]>([]);
  const [sxGrantEvidenceStatus, setSxGrantEvidenceStatus] = useState<"loading" | "loaded" | "unavailable">("loading");

  const reload = async () => {
    setLoading(true);
    setRows(await fetchPlMonthly(pilot.projectId));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilot.projectId]);

  useEffect(() => {
    if (pilot.projectId !== "p21") return;
    let active = true;
    void Promise.allSettled([
      fetch(`/api/governance/capital-plans?projectId=${encodeURIComponent(pilot.projectId)}`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/grants?projectId=${encodeURIComponent(pilot.projectId)}`).then((response) => response.ok ? response.json() : null),
    ]).then(([capitalResult, grantResult]) => {
      if (!active) return;
      if (capitalResult.status === "fulfilled" && isRecord(capitalResult.value) && Array.isArray(capitalResult.value.plans)) {
        const activePlan = capitalResult.value.plans.find((plan) => isRecord(plan) && plan.status === "active");
        const events = isRecord(activePlan) ? equityEventsFromCapitalPlan(activePlan.document_json) : [];
        if (events.length > 0) setSxEquityEvents(events);
      }
      if (grantResult.status === "fulfilled" && isRecord(grantResult.value) && Array.isArray(grantResult.value.grants)) {
        setSxGrantEvidence(grantResult.value.grants.flatMap((grant): SxGrantEvidence[] => {
          if (!isRecord(grant)) return [];
          return [{
            amount_yen: grant.amount_yen === null ? null : Number(grant.amount_yen),
            disbursed_yen: grant.disbursed_yen === null ? null : Number(grant.disbursed_yen),
          }];
        }));
        setSxGrantEvidenceStatus("loaded");
      } else {
        setSxGrantEvidenceStatus("unavailable");
      }
    });
    return () => { active = false; };
  }, [pilot.projectId]);

  useEffect(() => {
    if (selectedMonth !== null && !eventGroups.positioned.some((group) => group.monthIndex === selectedMonth)) {
      setSelectedMonth(eventGroups.positioned[0]?.monthIndex ?? null);
    }
  }, [eventGroups.positioned, selectedMonth]);

  const rowByMonth = useMemo(() => new Map(rows.map((row) => [row.ym, row])), [rows]);
  const sxCashLedger = useMemo(() => {
    if (pilot.projectId !== "p21") return [] as SxCashLedgerRow[];
    const yms = ["2026-07", ...axis.map((month) => month.ym).filter((ym) => ym !== "2026-07")];
    const financeRows = buildSxMonthlyFinancePlan(yms, sxEquityEvents);
    let cashYen = 0;
    return financeRows.map((finance): SxCashLedgerRow => {
      const plRow = rowByMonth.get(finance.ym) ?? emptyPlRow(pilot.projectId, finance.ym);
      const operatingCashFlowYen = plValue(plRow, "operating_profit");
      const capexCashFlowYen = -finance.capexYen;
      const openingCashYen = cashYen;
      const netCashFlowYen = operatingCashFlowYen + capexCashFlowYen + finance.equityFundingYen
        + (finance.loanDrawdownYen ?? 0) + finance.grantReceiptYen + finance.nonDilutiveFundingYen;
      cashYen += netCashFlowYen;
      return { ...finance, operatingCashFlowYen, capexCashFlowYen, netCashFlowYen, openingCashYen, closingCashYen: cashYen };
    });
  }, [axis, pilot.projectId, rowByMonth, sxEquityEvents]);
  const sxCashByMonth = useMemo(() => new Map(sxCashLedger.map((row) => [row.ym, row])), [sxCashLedger]);
  const sxVisibleCashLedger = useMemo(() => axis.flatMap((month) => {
    const row = sxCashByMonth.get(month.ym);
    return row ? [row] : [];
  }), [axis, sxCashByMonth]);
  const sxFinanceSummary = useMemo(() => {
    if (sxVisibleCashLedger.length === 0) return null;
    const sum = (field: "capexCashFlowYen" | "equityFundingYen" | "grantReceiptYen" | "nonDilutiveFundingYen") =>
      sxVisibleCashLedger.reduce((total, row) => total + row[field], 0);
    const adoptedYen = sxGrantEvidence.reduce((total, grant) => total + Number(grant.amount_yen ?? 0), 0);
    const disbursedKnown = sxGrantEvidence.some((grant) => grant.disbursed_yen !== null);
    const disbursedYen = sxGrantEvidence.reduce((total, grant) => total + Number(grant.disbursed_yen ?? 0), 0);
    return {
      capexYen: -sum("capexCashFlowYen"),
      equityFundingYen: sum("equityFundingYen"),
      grantReceiptYen: sum("grantReceiptYen"),
      phase0FundingYen: sxCashLedger.reduce((total, row) => total + row.nonDilutiveFundingYen, 0),
      closingCashYen: sxVisibleCashLedger.at(-1)?.closingCashYen ?? 0,
      adoptedYen,
      disbursedKnown,
      disbursedYen,
    };
  }, [sxCashLedger, sxGrantEvidence, sxVisibleCashLedger]);
  const selectedGroup = eventGroups.positioned.find((group) => group.monthIndex === selectedMonth) ?? null;
  const registeredPolicy = pilot.timeline.lanes.find((lane) => lane.key === "registered_policy")?.items[0];
  const gridStyle = {
    gridTemplateColumns: `var(--bzm-ledger-label-width) repeat(${axis.length}, ${MONTH_WIDTH}px)`,
    width: `calc(var(--bzm-ledger-label-width) + ${axis.length * MONTH_WIDTH}px)`,
  } satisfies CSSProperties;

  const startEdit = (cell: Bzm22SharedMonthAxisCell) => {
    setSaveError(null);
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
    <section data-testid="bzm22-time-ledger" className="border-b border-[#b9cbd1] bg-white">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-base font-semibold text-[#173f51]">イベントと月次試算表</h3>
          <p className="mt-1 text-sm text-slate-600">上のイベントと下のP/L・C/Fは、同じ月の列で揃っている。</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-sm font-semibold text-slate-600">単位：百万円</span>
          <button type="button" onClick={() => setHearingOpen(true)} className="min-h-11 border border-[#6d8a96] bg-white px-4 text-sm font-semibold text-[#285b6b] transition-colors hover:bg-[#f1f5f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]">つくよみと試算を作る</button>
          <button type="button" onClick={() => startEdit(axis[0])} className="min-h-11 border border-[#173f51] bg-[#173f51] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#285b6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]">月を入力</button>
        </div>
      </header>

      {sxFinanceSummary ? (
        <div className="border-b border-slate-200 bg-[#f7f9fa] px-4 py-4 sm:px-5" data-testid="sx-monthly-finance-summary">
          <div className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ["Phase 0 非希薄化資金", formatMillionFromYen(sxFinanceSummary.phase0FundingYen)],
              ["設備投資", formatMillionFromYen(sxFinanceSummary.capexYen)],
              ["株式調達", formatMillionFromYen(sxFinanceSummary.equityFundingYen)],
              ["融資", "未計画"],
              ["助成金等入金（計画）", formatMillionFromYen(sxFinanceSummary.grantReceiptYen)],
              ["M60 月末資金", formatMillionFromYen(sxFinanceSummary.closingCashYen)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-3">
                <div className="text-xs font-medium text-slate-500">{label}</div>
                <div className="mt-1 text-right font-mono text-lg font-semibold tabular-nums text-slate-900">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            PSI/GAPはDB採択額 {sxGrantEvidenceStatus === "loading" ? "読込中" : sxGrantEvidenceStatus === "unavailable" ? "取得不能" : formatMillionFromYen(sxFinanceSummary.adoptedYen)}、
            受領実績 {sxGrantEvidenceStatus === "loaded" && sxFinanceSummary.disbursedKnown ? formatMillionFromYen(sxFinanceSummary.disbursedYen) : "未確認"}。
            C/FはPhase 0計画6,000万円を2026-07に1回だけ置く。設備投資と助成金等は年次額を各FY4月へ仮置きした低精度の入出金時期で、税金・運転資金増減は未反映。
          </p>
        </div>
      ) : null}

      <div data-testid="bzm22-shared-month-scroll" className="max-w-full overflow-x-auto overscroll-x-contain">
        <div className="grid [--bzm-ledger-label-width:148px] sm:[--bzm-ledger-label-width:220px]" style={gridStyle}>
          <div className="sticky left-0 z-40 border-b border-r border-slate-300 bg-[#f7f9fa] px-4 py-4">
            <div className="text-sm font-semibold text-[#173f51]">事業価値の時間軸</div>
            <div className="mt-2 text-xs leading-5 text-slate-500">M0が価値基準月。点を押すと、その時点の前提を読める。</div>
            {eventGroups.outside.length > 0 ? <div className="mt-3 text-xs text-slate-500">評価期間外 {eventGroups.outside.length}件</div> : null}
            {eventGroups.undated.length > 0 ? <div className="mt-1 text-xs text-slate-500">日付未登録 {eventGroups.undated.length}件</div> : null}
          </div>
          <div className="relative border-b border-slate-300 bg-white" style={{ gridColumn: `2 / span ${axis.length}`, height: 356 }}>
            {axis.map((month) => (
              <span
                key={month.ym}
                aria-hidden="true"
                className={`absolute inset-y-0 border-l ${month.calendarMonth === 1 || month.month === 0 ? "border-slate-300" : "border-slate-100"}`}
                style={{ left: month.month * MONTH_WIDTH }}
              />
            ))}
            {registeredPolicy ? (
              <div className="absolute top-2 z-10 h-7 border-y border-[#82a3ae] bg-[#e7eff2]" style={{ left: MONTH_WIDTH / 2, width: (axis.length - 1) * MONTH_WIDTH }}>
                <span className="sticky left-2 block w-fit px-2 text-xs font-semibold leading-7 text-[#24596a]">{registeredPolicy.label} · M0–M{axis.length - 1}</span>
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

          <div className="sticky left-0 z-40 border-b border-r border-slate-300 bg-[#edf3f5] px-4 py-3">
            <div className="text-sm font-semibold text-[#173f51]">月次試算表</div>
            <div className="mt-1 text-xs text-slate-500">P/L・資金繰り</div>
          </div>
          {axis.map((month) => (
            <MonthCellFrame key={`header-${month.ym}`} month={month} className="bg-[#edf3f5] px-2 py-3 text-right">
              <button type="button" onClick={() => startEdit(month)} className="w-full text-right hover:text-[#173f51] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]" title={`${month.ym}を入力・編集`}>
                <span className="block text-xs font-semibold text-[#365865]">M{month.month}</span>
                <span className="mt-1 block font-mono text-xs text-slate-500">{month.ym}</span>
              </button>
            </MonthCellFrame>
          ))}

          <div className="contents">
            <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#173f51] px-4 py-2 text-sm font-semibold text-white">P/L</div>
            {axis.map((month) => <MonthCellFrame key={`pl-section-${month.ym}`} month={month} className="bg-[#173f51]" />)}
          </div>

          {PL_ROWS.map((metric) => {
            const total = axis.reduce((sum, month) => sum + plValue(rowByMonth.get(month.ym) ?? emptyPlRow(pilot.projectId, month.ym), metric.key), 0);
            const result = metric.key === "operating_profit";
            return (
              <div key={metric.key} className="contents">
                <div className={`sticky left-0 z-30 border-b border-r border-slate-300 px-4 py-3 ${result ? "bg-[#edf3f5]" : "bg-white"}`}>
                  <div className={`text-sm ${result ? "font-semibold text-[#173f51]" : "text-slate-700"}`}>{metric.label}</div>
                  <div className="mt-1 text-right font-mono text-xs tabular-nums text-slate-500">累計 {formatMillionFromYen(total)}</div>
                </div>
                {axis.map((month) => {
                  const row = rowByMonth.get(month.ym) ?? emptyPlRow(pilot.projectId, month.ym);
                  const value = plValue(row, metric.key);
                  return (
                    <MonthCellFrame key={`${metric.key}-${month.ym}`} month={month} className={`px-2 py-3 text-right ${metric.kind === "calculated" ? "bg-slate-50" : "bg-white"}`}>
                      {metric.kind === "input" ? (
                        <button type="button" onClick={() => startEdit(month)} className="w-full text-right font-mono text-sm tabular-nums text-slate-700 hover:text-[#173f51] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96] decoration-dotted" title={`${month.ym}の${metric.label}を編集`}>
                          {formatMillionFromYen(value)}
                        </button>
                      ) : (
                        <span className={`font-mono text-sm tabular-nums ${result && value < 0 ? "text-rose-700" : "text-slate-700"}`}>{formatMillionFromYen(value)}</span>
                      )}
                    </MonthCellFrame>
                  );
                })}
              </div>
            );
          })}

          {sxVisibleCashLedger.length > 0 ? (
            <>
              <div className="contents">
                <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#365865] px-4 py-2 text-sm font-semibold text-white">C/F・資金繰り</div>
                {axis.map((month) => <MonthCellFrame key={`cf-section-${month.ym}`} month={month} className="bg-[#365865]" />)}
              </div>
              {SX_CASH_ROWS.map((metric) => (
                <div key={metric.key} className="contents">
                  <div className={`sticky left-0 z-30 border-b border-r border-slate-300 px-4 py-3 ${metric.emphasis ? "bg-[#edf3f5]" : "bg-white"}`}>
                    <div className={`text-sm ${metric.emphasis ? "font-semibold text-[#173f51]" : "text-slate-700"}`}>{metric.label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {metric.kind === "unplanned" ? "金額・時期未登録" : metric.kind === "balance" ? "残高は合計しない" : "計画値"}
                    </div>
                  </div>
                  {axis.map((month) => {
                    const row = sxCashByMonth.get(month.ym);
                    const value = row?.[metric.key] ?? null;
                    return (
                      <MonthCellFrame key={`${metric.key}-${month.ym}`} month={month} className={`px-2 py-3 text-right ${metric.emphasis ? "bg-slate-50" : "bg-white"}`}>
                        <span className={`font-mono text-sm tabular-nums ${typeof value === "number" && value < 0 ? "text-rose-700" : "text-slate-700"}`}>
                          {value === null ? "—" : formatMillionFromYen(value)}
                        </span>
                      </MonthCellFrame>
                    );
                  })}
                </div>
              ))}
            </>
          ) : null}

          <div className="sticky left-0 z-30 border-b border-r border-t-2 border-slate-400 bg-[#f7f2e8] px-3 py-2">
            <div className="text-sm font-semibold text-[#6b5127]">BZM経済CF</div>
            <div className="mt-1 text-xs text-slate-500">上の資金繰りとは別。J・Pへ接続</div>
          </div>
          {axis.map((month) => {
            const value = month.month === 0
              ? 0
              : pilot.calculationTrace.inputs.cashFlow.monthlyEconomicCFMillionJpy.base[month.month - 1] ?? 0;
            return (
              <MonthCellFrame key={`bzm-cf-${month.ym}`} month={month} className="border-t-2 border-t-slate-400 bg-[#fdfaf4] px-2 py-3 text-right">
                <span className="font-mono text-sm tabular-nums text-[#6b5127]">{formatMillion(value)}</span>
              </MonthCellFrame>
            );
          })}
        </div>
      </div>

      {selectedGroup ? (
        <div className="border-t border-slate-200 bg-[#f7f9fa] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
            <span className="font-semibold text-[#173f51]">M{selectedGroup.monthIndex} · {axis[selectedGroup.monthIndex].ym}</span>
            {selectedGroup.items.map((item) => {
              const category = CATEGORY_META[item.category];
              const gate = pilot.calculationTrace.inputs.gates.find((candidate) => candidate.label === item.label);
              return (
                <span key={item.id} className="inline-flex flex-wrap items-center gap-1 border-l-2 pl-2" style={{ borderColor: category.color }}>
                  <b className="text-slate-700">{item.label}</b>
                  <span>{item.choiceLabel}</span>
                  {gate ? <span>通過値 {formatRate(gate.probabilities.base)} / 停止時 {formatMillion(gate.signedFailureSettlementMillionJpy.base)}</span> : null}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {loading ? <div className="px-4 py-4 text-sm text-slate-500">月次試算を読み込み中…</div> : null}
      {!loading && rows.length === 0 ? <div className="px-4 py-3 text-sm text-slate-500">月次試算の入力はまだない。月見出しか「月を入力」から入力できる。</div> : null}

      {draft ? (
        <div className="border-t border-slate-200 bg-[#f7f9fa] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-[#173f51]">{draft.ym} の月次試算</h4>
              <p className="mt-1 text-xs text-slate-500">入力単位は百万円。表は小数1桁まで表示する。</p>
            </div>
            <button type="button" onClick={() => setDraft(null)} className="min-h-11 px-3 text-sm text-slate-500">閉じる</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ["revenue_yen", "売上"],
              ["cogs_yen", "売上原価"],
              ["personnel_yen", "人件費"],
              ["rd_yen", "研究開発費"],
              ["marketing_yen", "マーケ費"],
              ["other_opex_yen", "その他販管費"],
            ] as const).map(([key, label]) => (
              <label key={key} className="text-xs font-semibold text-slate-600">{label}（百万円）
                <input type="number" step="0.1" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} onFocus={(event) => event.currentTarget.select()} className="mt-1 min-h-11 w-full border border-slate-300 bg-white px-3 text-right font-mono text-sm font-normal" />
              </label>
            ))}
            <label className="text-xs font-semibold text-slate-600 sm:col-span-3">メモ
              <textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="mt-1 w-full border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
            </label>
          </div>
          {saveError ? <p className="mt-2 text-sm text-rose-700">{saveError}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            {draft.id ? <button type="button" onClick={() => void remove()} disabled={saving} className="min-h-11 border border-rose-200 px-4 text-sm font-semibold text-rose-700 disabled:opacity-50">この月を削除</button> : null}
            <button type="button" onClick={() => setDraft(null)} className="min-h-11 border border-slate-300 px-4 text-sm font-semibold text-slate-600">キャンセル</button>
            <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 border border-[#173f51] bg-[#173f51] px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "保存中…" : "保存"}</button>
          </div>
        </div>
      ) : null}

      {hearingOpen ? (
        <CockpitPlHearingModal
          projectId={pilot.projectId}
          onClose={() => setHearingOpen(false)}
          onApplied={async () => { await reload(); }}
        />
      ) : null}
    </section>
  );
}
