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
  buildSxMonthlyFinanceComments,
  SX_DEFAULT_EQUITY_FUNDING_EVENTS,
  SX_PHASE0_NON_DILUTIVE_FUNDING_YEN,
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
  incorporationYm: string,
) {
  if (projectId !== "p21") return key === "preincorporation_spend" ? null : plValue(row, key);
  const beforeIncorporation = ym < incorporationYm;
  if (key === "preincorporation_spend") return beforeIncorporation ? plValue(row, key) : null;
  if (beforeIncorporation && (key === "gross_profit" || key === "operating_profit")) return null;
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
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [rows, setRows] = useState<ProjectPlMonthly[]>([]);
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
  const visiblePlRows = pilot.projectId === "p21" ? SX_PL_ROWS : PL_ROWS;
  const sxCashLedger = useMemo(() => {
    if (pilot.projectId !== "p21") return [] as SxCashLedgerRow[];
    const financeRows = buildSxMonthlyFinancePlan(axis.map((month) => month.ym), sxEquityEvents)
      .filter((finance) => finance.ym >= sxIncorporationYm);
    return financeRows.map((finance): SxCashLedgerRow => {
      const plRow = rowByMonth.get(finance.ym) ?? emptyPlRow(pilot.projectId, finance.ym);
      const operatingCashFlowYen = plValue(plRow, "operating_profit");
      const capexCashFlowYen = -finance.capexYen;
      const netCashFlowYen = operatingCashFlowYen + capexCashFlowYen + finance.equityFundingYen
        + (finance.loanDrawdownYen ?? 0) + finance.grantReceiptYen;
      return { ...finance, nonDilutiveFundingYen: 0, operatingCashFlowYen, capexCashFlowYen, netCashFlowYen, openingCashYen: null, closingCashYen: null };
    });
  }, [axis, pilot.projectId, rowByMonth, sxEquityEvents, sxIncorporationYm]);
  const sxCashByMonth = useMemo(() => new Map(sxCashLedger.map((row) => [row.ym, row])), [sxCashLedger]);
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
      phase0FundingYen: SX_PHASE0_NON_DILUTIVE_FUNDING_YEN,
      closingCashYen: null,
      adoptedYen,
      disbursedKnown,
      disbursedYen,
    };
  }, [sxGrantEvidence, sxVisibleCashLedger]);
  const sxFinanceCommentsByCell = useMemo(() => {
    const comments = buildSxMonthlyFinanceComments(axis.map((month) => month.ym), sxEquityEvents);
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
  }, [axis, sxEquityEvents, sxGrantEvidence]);
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
              ["設立前PJ資金", formatMillionFromYen(sxFinanceSummary.phase0FundingYen)],
              ["設備投資", formatMillionFromYen(sxFinanceSummary.capexYen)],
              ["株式調達", formatMillionFromYen(sxFinanceSummary.equityFundingYen)],
              ["融資", "未計画"],
              ["助成金等入金（計画）", formatMillionFromYen(sxFinanceSummary.grantReceiptYen)],
              ["M60 月末資金", sxFinanceSummary.closingCashYen === null ? "算定不能" : formatMillionFromYen(sxFinanceSummary.closingCashYen)],
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
            <p className="mt-0.5">設立前PJのPhase 0資金はNewCoのC/F・現金残高へ入れない。NewCo C/Fは2027-02から表示し、設立時残高が未確認のため月初・月末残高は算定不能。設備投資・助成金等は年次額を各FY4月へ仮置きした低精度の入出金時期。</p>
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
            {pilot.projectId === "p21" && axis.some((month) => month.ym === sxIncorporationYm) ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 z-10 w-0 border-l-2 border-[#173f51]"
                style={{ left: axis.findIndex((month) => month.ym === sxIncorporationYm) * MONTH_WIDTH }}
              />
            ) : null}
            {registeredPolicy ? (
              <div className="absolute top-1 z-10 h-[18px] border-y border-[#82a3ae] bg-[#e7eff2]" style={{ left: MONTH_WIDTH / 2, width: (axis.length - 1) * MONTH_WIDTH }}>
                <span className="sticky left-1 block w-fit px-1 text-[9px] font-semibold leading-[16px] text-[#24596a]">{registeredPolicy.label} · M0–M{axis.length - 1}</span>
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
            <MonthCellFrame key={`header-${month.ym}`} month={month} className={`bg-[#edf3f5] px-1.5 py-1 text-right ${month.ym === sxIncorporationYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
              <button type="button" onClick={() => startEdit(month)} className="w-full text-right hover:text-[#173f51] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d8a96]" title={`${month.ym}を入力・編集`}>
                <span className="block text-[10px] font-semibold leading-3 text-[#365865]">M{month.month}</span>
                <span className="block font-mono text-[8px] leading-3 text-slate-500">{month.ym}</span>
              </button>
            </MonthCellFrame>
          ))}

          {pilot.projectId === "p21" ? (
            <>
              <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-white px-2 py-0.5 text-[9px] font-semibold leading-4 text-slate-600">計上主体</div>
              {axis.map((month) => {
                const beforeIncorporation = month.ym < sxIncorporationYm;
                return (
                  <MonthCellFrame key={`entity-${month.ym}`} month={month} className={`px-1 py-0.5 text-right text-[8px] font-semibold leading-4 ${beforeIncorporation ? "bg-slate-100 text-slate-500" : "bg-[#e7eff2] text-[#173f51]"} ${month.ym === sxIncorporationYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
                    {beforeIncorporation ? "設立前PJ" : "NewCo"}
                  </MonthCellFrame>
                );
              })}
            </>
          ) : null}

          <div className="contents">
            <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#173f51] px-2 py-0.5 text-[10px] font-semibold leading-4 text-white">設立前PJ支出 / NewCo P/L</div>
            {axis.map((month) => <MonthCellFrame key={`pl-section-${month.ym}`} month={month} className={`bg-[#173f51] ${month.ym === sxIncorporationYm ? "border-l-2 border-l-white" : ""}`} />)}
          </div>

          {visiblePlRows.map((metric) => {
            const total = axis.reduce((sum, month) => sum + (plDisplayValue(rowByMonth.get(month.ym) ?? emptyPlRow(pilot.projectId, month.ym), metric.key, pilot.projectId, month.ym, sxIncorporationYm) ?? 0), 0);
            const result = metric.key === "operating_profit";
            const metricLabel = pilot.projectId === "p21" && metric.key === "gross_profit"
              ? "粗利（NewCo）"
              : pilot.projectId === "p21" && metric.key === "operating_profit"
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
                  const value = plDisplayValue(row, metric.key, pilot.projectId, month.ym, sxIncorporationYm);
                  const comments = [sxPhaseCommentsByCell.get(`${metric.key}:${month.ym}`)].filter((comment): comment is LedgerCellComment => Boolean(comment));
                  const notApplicableBeforeIncorporation = value === null && month.ym < sxIncorporationYm;
                  return (
                    <MonthCellFrame key={`${metric.key}-${month.ym}`} month={month} className={`px-1.5 py-0.5 text-right ${comments.length > 0 ? "bg-amber-50/70" : metric.kind === "calculated" ? "bg-slate-50" : "bg-white"} ${month.ym === sxIncorporationYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
                      {metric.kind === "input" ? (
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

          {sxVisibleCashLedger.length > 0 ? (
            <>
              <div className="contents">
                <div className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#365865] px-2 py-0.5 text-[10px] font-semibold leading-4 text-white">NewCo C/F・資金繰り</div>
                {axis.map((month) => <MonthCellFrame key={`cf-section-${month.ym}`} month={month} className={`${month.ym < sxIncorporationYm ? "bg-slate-300" : "bg-[#365865]"} ${month.ym === sxIncorporationYm ? "border-l-2 border-l-white" : ""}`} />)}
              </div>
              {SX_CASH_ROWS.map((metric) => (
                <div key={metric.key} className="contents">
                  <div className={`sticky left-0 z-30 border-b border-r border-slate-300 px-2 py-0.5 ${metric.emphasis ? "bg-[#edf3f5]" : "bg-white"}`}>
                    <div className={`truncate text-[10px] leading-4 ${metric.emphasis ? "font-semibold text-[#173f51]" : "text-slate-700"}`}>
                      {metric.label}
                      {metric.kind === "unplanned" ? <span className="ml-1 text-[8px] text-slate-500">未計画</span> : null}
                    </div>
                  </div>
                  {axis.map((month) => {
                    const row = sxCashByMonth.get(month.ym);
                    const value = row?.[metric.key] ?? null;
                    const commentMetric = metric.key === "capexCashFlowYen"
                      ? "capexYen"
                      : metric.key === "equityFundingYen" || metric.key === "grantReceiptYen"
                        ? metric.key
                        : null;
                    const comments = commentMetric ? sxFinanceCommentsByCell.get(`${commentMetric}:${month.ym}`) ?? [] : [];
                    return (
                      <MonthCellFrame key={`${metric.key}-${month.ym}`} month={month} className={`px-1.5 py-0.5 text-right ${month.ym < sxIncorporationYm ? "bg-slate-100" : comments.length > 0 ? "bg-amber-50/70" : metric.emphasis ? "bg-slate-50" : "bg-white"} ${month.ym === sxIncorporationYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
                        <span className="flex items-center justify-end gap-1">
                          <FinanceCellComment comments={comments} ym={month.ym} metricLabel={metric.label} />
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

          <div className="sticky left-0 z-30 border-b border-r border-t-2 border-slate-400 bg-[#f7f2e8] px-2 py-0.5">
            <div className="text-[10px] font-semibold leading-4 text-[#6b5127]">BZM経済CF</div>
            <div className="text-[8px] leading-3 text-slate-500">資金繰りと別。J・Pへ接続</div>
          </div>
          {axis.map((month) => {
            const value = month.month === 0
              ? 0
              : pilot.calculationTrace.inputs.cashFlow.monthlyEconomicCFMillionJpy.base[month.month - 1] ?? 0;
            return (
              <MonthCellFrame key={`bzm-cf-${month.ym}`} month={month} className={`border-t-2 border-t-slate-400 bg-[#fdfaf4] px-1.5 py-0.5 text-right ${month.ym === sxIncorporationYm ? "border-l-2 border-l-[#173f51]" : ""}`}>
                <span className="font-mono text-[11px] leading-4 tabular-nums text-[#6b5127]">{formatMillion(value)}</span>
              </MonthCellFrame>
            );
          })}
        </div>
      </div>

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
            <DialogTitle className="text-[15px] font-semibold text-[#173f51]">{draft.ym} の月次試算</DialogTitle>
            <DialogDescription className="text-[11px]">入力単位は百万円。保存後、同じ月列へ即時反映する。</DialogDescription>
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
