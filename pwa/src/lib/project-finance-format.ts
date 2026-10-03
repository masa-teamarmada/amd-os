/**
 * 試算表の標準フォーマット（src/lib/project-formats.ts）へ、PJのデータを流し込む変換。
 *
 * どのPJでも同じ規則で変換する。分けてよいのは「データの形」だけで、PJ番号では分けない
 * （spec 3-23）。新しい形の数字が来たら、この変換に「その形 → 標準の行」の対応を足す。
 * 画面に区画やグラフを足して受け止めない。
 */

import type { Bzm22TimelineItem } from "@/lib/bzm-2-2-pilot-ui";
import { resolveFundingPlan, type FundingPlan, type FundingPlanningDetails, type FundingScenarioMonth } from "@/lib/project-funding-plan";
import type { FinanceCashRowKey } from "@/lib/project-formats";
import type { ProjectPlMonthly } from "@/lib/venture-status-data";

export type FinanceSourceLabel = "実績" | "見込" | "推定" | "計画" | "簡易";

export interface FinancePlValues {
  revenue: number;
  cogs: number;
  personnel: number;
  rd: number;
  marketing: number;
  otherOpex: number;
}

export type FinanceCashValues = Record<FinanceCashRowKey, number | null>;

export interface FinanceCellNote {
  id: string;
  title: string;
  detail: string;
  evidenceState: "plan" | "observed";
}

export interface FinanceMonth {
  ym: string;
  source: FinanceSourceLabel | null;
  pl: FinancePlValues | null;
  /** 編集できる登録値の行ID（project_pl_monthly.id）。 */
  plRowId: string | null;
  plNotes: string | null;
  cash: FinanceCashValues | null;
  /** C/Fを登録値ではなく P/L・資本政策・試算の前提から組み立てた月。 */
  cashDerived: boolean;
  /** 標準の行に入らない元データの内訳（データの列名 → 値）。 */
  extras: Record<string, number | null>;
}

export interface FinanceCase {
  key: string;
  label: string;
  description: string | null;
}

export interface FinanceNoteTable {
  title: string;
  unit: string | null;
  columns: string[];
  rows: string[][];
}

export interface FinanceNote {
  title: string;
  paragraphs: string[];
}

export interface FinanceDataset {
  id: string;
  label: string;
  kind: "registered" | "plan";
  asOf: string | null;
  caption: string | null;
  /** 月次試算（P/L）を画面から編集できるか。資料から取り込んだ計画は編集しない。 */
  editable: boolean;
  cases: FinanceCase[];
  monthsByCase: Record<string, FinanceMonth[]>;
  extraRows: Array<{ key: string; label: string }>;
  reserveYen: number | null;
  tables: FinanceNoteTable[];
  notes: FinanceNote[];
}

/** 月次C/Fの元データ（project_monthly_cashflow の1行）。 */
export interface FinanceCashSourceRow {
  ym: string;
  source_status?: string | null;
  operating_cash_flow_yen?: number | null;
  investing_cash_flow_yen?: number | null;
  equity_funding_yen?: number | null;
  grant_receipt_yen?: number | null;
  cash_inflow_yen?: number | null;
  sbir_payment_yen?: number | null;
  nedo_payment_yen?: number | null;
  working_capital_payment_yen?: number | null;
  free_cash_flow_yen?: number | null;
  financing_cash_flow_yen?: number | null;
  net_cash_flow_yen?: number | null;
  opening_cash_yen?: number | null;
  closing_cash_yen?: number | null;
  sbir_account_balance_yen?: number | null;
  working_capital_balance_yen?: number | null;
  bank_borrowing_balance_yen?: number | null;
  source_note?: string | null;
  planning_details_json?: FundingPlanningDetails | null;
}

/** 資本政策の調達イベント（現金が入るもの）。 */
export interface FinanceFundingEvent {
  label: string;
  ym: string;
  amountYen: number;
}

/** 試算（BZM）の月次前提。 */
export interface FinancePilotMonthPlan {
  ym: string;
  capexMillionJpy: number;
  grantCashMillionJpy: number;
  status: string;
}

/** project_monthly_cashflow の、標準の行に入らない列。どのPJでも同じ見出しで内訳に出す。 */
export const FINANCE_CASH_EXTRA_COLUMNS: ReadonlyArray<{ key: keyof FinanceCashSourceRow; label: string }> = [
  { key: "cash_inflow_yen", label: "収入計" },
  { key: "sbir_payment_yen", label: "SBIR支払（税抜）" },
  { key: "nedo_payment_yen", label: "NEDO支払（税抜）" },
  { key: "working_capital_payment_yen", label: "運転資金支払＋消費税" },
  { key: "free_cash_flow_yen", label: "FCF（営業＋投資）" },
  { key: "financing_cash_flow_yen", label: "財務C/F" },
  { key: "sbir_account_balance_yen", label: "SBIR口座残高" },
  { key: "working_capital_balance_yen", label: "運転資金残高" },
];

/** 資金計画（planning_details_json）から入る、標準の行に入らない内訳。 */
const PLAN_EXTRA_ROWS = [
  { key: "plan_interest_yen", label: "うち融資利息・手数料" },
  { key: "plan_rounding_yen", label: "端数調整" },
] as const;

const EMPTY_CASH: FinanceCashValues = {
  opening: null,
  operating: null,
  investing: null,
  equity: null,
  loanDrawdown: null,
  loanRepayment: null,
  grant: null,
  net: null,
  closing: null,
  loanBalance: null,
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** P/L 行の出所。`notes` の先頭に書いた区分から読む。 */
export function plProvenance(notes: string | null | undefined): FinanceSourceLabel | null {
  const head = (notes ?? "").trimStart();
  if (head.startsWith("実績")) return "実績";
  if (head.startsWith("推定")) return "推定";
  if (head.startsWith("見込")) return "見込";
  return null;
}

function cashProvenance(status: string | null | undefined): FinanceSourceLabel | null {
  if (status === "actual") return "実績";
  if (status === "forecast") return "見込";
  if (status === "estimated") return "推定";
  return null;
}

export function addMonths(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthsBetween(fromYm: string, toYm: string): number {
  const [fy, fm] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function fiscalYearOf(ym: string): number {
  const [year, month] = ym.split("-").map(Number);
  return month < 4 ? year - 1 : year;
}

function plValues(row: ProjectPlMonthly): FinancePlValues {
  return {
    revenue: Number(row.revenue_yen) || 0,
    cogs: Number(row.cogs_yen) || 0,
    personnel: Number(row.personnel_yen) || 0,
    rd: Number(row.rd_yen) || 0,
    marketing: Number(row.marketing_yen) || 0,
    otherOpex: Number(row.other_opex_yen) || 0,
  };
}

export function plExpense(pl: FinancePlValues): number {
  return pl.cogs + pl.personnel + pl.rd + pl.marketing + pl.otherOpex;
}

export function plOperatingProfit(pl: FinancePlValues): number {
  return pl.revenue - plExpense(pl);
}

/** 登録済みのC/F行を標準の行へ。標準の列が無い形（取締役会資料など）は残高と増減だけを標準の行に入れ、残りは内訳へ。 */
function cashFromRegistered(row: FinanceCashSourceRow): { cash: FinanceCashValues; extras: Record<string, number | null> } {
  const extras: Record<string, number | null> = {};
  for (const column of FINANCE_CASH_EXTRA_COLUMNS) extras[column.key] = toNumber(row[column.key]);
  return {
    cash: {
      ...EMPTY_CASH,
      opening: toNumber(row.opening_cash_yen),
      operating: toNumber(row.operating_cash_flow_yen),
      investing: toNumber(row.investing_cash_flow_yen),
      equity: toNumber(row.equity_funding_yen),
      grant: toNumber(row.grant_receipt_yen),
      net: toNumber(row.net_cash_flow_yen),
      closing: toNumber(row.closing_cash_yen),
      loanBalance: toNumber(row.bank_borrowing_balance_yen),
    },
    extras,
  };
}

function hasRegisteredCash(row: FinanceCashSourceRow): boolean {
  return [
    row.opening_cash_yen,
    row.operating_cash_flow_yen,
    row.investing_cash_flow_yen,
    row.equity_funding_yen,
    row.grant_receipt_yen,
    row.closing_cash_yen,
  ].some((value) => toNumber(value) !== null) || toNumber(row.net_cash_flow_yen) !== null;
}

/**
 * 登録済みの月次試算（project_pl_monthly と project_monthly_cashflow の標準の列）。
 * C/Fの登録が無い月は、資金の計画（資本政策の調達・試算の月次前提）を持つPJに限り、会社設立後
 * （設立月が分からなければ全期間）の月について、営業利益・試算の設備投資と助成金・資本政策の調達から
 * 簡易C/Fを組み立て、出所に「簡易」と出す。計画を持たないPJの実績P/Lから資金繰りを作り出さない。
 * 設立前の支出は会社の資金繰りに入れない。
 */
export function buildRegisteredFinanceDataset(input: {
  plRows: readonly ProjectPlMonthly[];
  cashRows: readonly FinanceCashSourceRow[];
  incorporationYm: string | null;
  fundingEvents: readonly FinanceFundingEvent[];
  pilotMonthPlans: readonly FinancePilotMonthPlan[];
}): FinanceDataset {
  const plByYm = new Map(input.plRows.map((row) => [row.ym, row]));
  const cashByYm = new Map(input.cashRows.filter(hasRegisteredCash).map((row) => [row.ym, row]));
  const pilotByYm = new Map(input.pilotMonthPlans.map((row) => [row.ym, row]));
  const fundingByYm = new Map<string, number>();
  for (const event of input.fundingEvents) fundingByYm.set(event.ym, (fundingByYm.get(event.ym) ?? 0) + event.amountYen);

  const months = new Set<string>([...plByYm.keys(), ...cashByYm.keys()]);
  const companyMonth = (ym: string) => !input.incorporationYm || ym >= input.incorporationYm;
  const hasCashPlan = pilotByYm.size > 0 || fundingByYm.size > 0;
  // 簡易C/Fは、試算の前提や調達がある会社設立後の月にも置く（P/Lが無くても資金の動きは読む）。
  for (const ym of [...pilotByYm.keys(), ...fundingByYm.keys()]) {
    if (input.incorporationYm && companyMonth(ym)) months.add(ym);
  }

  const result: FinanceMonth[] = [...months].sort().map((ym) => {
    const plRow = plByYm.get(ym) ?? null;
    const cashRow = cashByYm.get(ym) ?? null;
    const pl = plRow ? plValues(plRow) : null;
    let cash: FinanceCashValues | null = null;
    let extras: Record<string, number | null> = {};
    let cashDerived = false;
    if (cashRow) {
      ({ cash, extras } = cashFromRegistered(cashRow));
    } else if (hasCashPlan && companyMonth(ym)) {
      const pilot = pilotByYm.get(ym);
      const equity = fundingByYm.get(ym) ?? 0;
      const operating = pl ? plOperatingProfit(pl) : 0;
      const investing = pilot ? -Math.round(pilot.capexMillionJpy * 1_000_000) : 0;
      const grant = pilot ? Math.round(pilot.grantCashMillionJpy * 1_000_000) : 0;
      if (pl || pilot || equity) {
        cashDerived = true;
        cash = {
          ...EMPTY_CASH,
          operating,
          investing,
          equity,
          grant,
          net: operating + investing + equity + grant,
        };
      }
    }
    const source = plProvenance(plRow?.notes) ?? cashProvenance(cashRow?.source_status) ?? (cashDerived ? "簡易" : null);
    return { ym, source, pl, plRowId: plRow?.id ?? null, plNotes: plRow?.notes ?? null, cash, cashDerived, extras };
  });

  const extraRows = FINANCE_CASH_EXTRA_COLUMNS
    .filter((column) => result.some((month) => {
      const value = month.extras[column.key];
      return value !== null && value !== undefined && value !== 0;
    }))
    .map((column) => ({ key: column.key, label: column.label }));

  return {
    id: "registered",
    label: "登録済みの月次試算",
    kind: "registered",
    asOf: null,
    caption: hasCashPlan
      ? "月次試算（P/L）と資金繰り（C/F）の登録値。C/Fの登録が無い会社設立後の月は、営業利益・試算の前提・資本政策の調達から簡易C/Fを組み立てる（出所「簡易」）。"
      : "月次試算（P/L）と資金繰り（C/F）の登録値。",
    editable: true,
    cases: [{ key: "base", label: "登録値", description: null }],
    monthsByCase: { base: result },
    extraRows,
    reserveYen: null,
    tables: [],
    notes: [],
  };
}

function formatYenShort(value: number): string {
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}億円`;
  return `${Math.round(value / 10_000).toLocaleString("ja-JP")}万円`;
}

function formatMillionCell(value: number): string {
  return (value / 1_000_000).toLocaleString("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function planMonth(ym: string, scenario: FundingScenarioMonth): FinanceMonth {
  return {
    ym,
    source: "計画",
    pl: null,
    plRowId: null,
    plNotes: null,
    cash: {
      opening: scenario.openingYen,
      operating: -(scenario.ordinarySpendYen + scenario.interestYen),
      investing: -scenario.equipmentSpendYen,
      equity: scenario.seedInflowYen + scenario.bridgeInflowYen,
      loanDrawdown: scenario.loanDrawdownYen,
      loanRepayment: -scenario.loanRepaymentYen,
      grant: scenario.grantReceiptYen,
      net: scenario.netCashFlowYen,
      closing: scenario.closingYen,
      loanBalance: scenario.loanBalanceYen,
    },
    cashDerived: false,
    extras: {
      plan_interest_yen: -scenario.interestYen,
      plan_rounding_yen: scenario.roundingYen,
    },
  };
}

/**
 * 資金計画（project_monthly_cashflow.planning_details_json）。ケースごとの月次の入出金を標準のC/Fの行へ入れる。
 * 通常支出と融資利息は営業C/F、設備・初期費用は設備投資、シードとブリッジの払込は株式調達へ入れる。
 * 計画はP/Lを持たない（現金の予算）ので、P/Lの行は空のまま出す。
 */
export function buildPlanFinanceDatasets(rows: ReadonlyArray<Pick<FinanceCashSourceRow, "ym" | "planning_details_json">>): FinanceDataset[] {
  const planRows = rows.filter((row) => row.planning_details_json);
  if (planRows.length === 0) return [];
  const plan = resolveFundingPlan(planRows.map((row) => ({ ym: row.ym, planning_details_json: row.planning_details_json })));
  return plan ? [financeDatasetFromFundingPlan(plan)] : [];
}

/** 検証済みの資金計画1本を、標準フォーマットの計画にする（DDのようにサーバが読んだ計画を渡す面でも使う）。 */
export function financeDatasetFromFundingPlan(plan: FundingPlan): FinanceDataset {
  const summary = plan.summary;
  const firstMonth = plan.months[0];
  const cases: FinanceCase[] = summary.cases.map((entry) => ({
    key: entry.key,
    label: firstMonth.planning_details_json.scenarios.find((scenario) => scenario.key === entry.key)?.label ?? entry.key,
    description: entry.description || null,
  }));
  const monthsByCase: Record<string, FinanceMonth[]> = {};
  for (const entry of cases) {
    monthsByCase[entry.key] = plan.months.map((month) =>
      planMonth(month.ym, month.planning_details_json.scenarios.find((scenario) => scenario.key === entry.key)!));
  }
  const extraRows = PLAN_EXTRA_ROWS.filter((row) =>
    Object.values(monthsByCase).some((months) => months.some((month) => (month.extras[row.key] ?? 0) !== 0)))
    .map((row) => ({ key: row.key, label: row.label }));

  const overview: string[] = [
    `${summary.startYm}〜${summary.endYm}の${plan.months.length}か月の資金計画。次の調達は${summary.nextRoundYm}${summary.nextRoundAmountYen === null ? "（金額は再精査中）" : `（${formatYenShort(summary.nextRoundAmountYen)}）`}。`,
  ];
  if (summary.seedAmountYen > 0) overview.push(`期首の調達 ${formatYenShort(summary.seedAmountYen)}。調達の条件は資本政策表で管理する。`);
  if (summary.reserveYen > 0) overview.push(`手元資金の目安 ${formatYenShort(summary.reserveYen)}（月次の資金推移の破線）。`);
  if (summary.improvementTargetYen > 0) overview.push(`月次の数字に入れていない純改善目標 ${formatYenShort(summary.improvementTargetYen)}。`);
  if (summary.loanFacilityTargetYen > 0) overview.push(`融資相談枠の目安 ${formatYenShort(summary.loanFacilityTargetYen)}（未合意）。`);

  const notes: FinanceNote[] = [{ title: "計画の概要", paragraphs: overview }];
  if (summary.bridgePolicy.length > 0) notes.push({ title: "調達の方針", paragraphs: summary.bridgePolicy });
  if (summary.assumptions.length > 0) notes.push({ title: "対象経費・支払時期・未確定条件", paragraphs: summary.assumptions });

  const tables: FinanceNoteTable[] = [];
  if (summary.monthlyCosts.length > 0) {
    tables.push({
      title: "通常費用の前提",
      unit: "百万円／月",
      columns: ["費用", "月額", "扱い"],
      rows: summary.monthlyCosts.map((cost) => [cost.label, formatMillionCell(cost.amountYen), cost.status]),
    });
  }
  if (summary.equipment.length > 0) {
    tables.push({
      title: "設備・初期費用の予算",
      unit: "百万円",
      columns: ["項目", "支出額", "支払月"],
      rows: summary.equipment.map((item) => [item.label, formatMillionCell(item.amountYen), item.deliveryYm || item.orderYm]),
    });
  }

  const sourceParts = [summary.source.adoptedMaterial ? `採用資料：${summary.source.adoptedMaterial}` : null, summary.source.cutoff || null]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.replace(/[。．.]+$/, ""));

  return {
    id: `plan:${summary.version}`,
    label: `資金計画（${summary.asOf}改定）`,
    kind: "plan",
    asOf: summary.asOf,
    caption: sourceParts.length > 0 ? `${sourceParts.join("。")}。` : null,
    editable: false,
    cases,
    monthsByCase,
    extraRows,
    reserveYen: summary.reserveYen > 0 ? summary.reserveYen : null,
    tables,
    notes,
  };
}

/** 表示する計画の並び。資料から取り込んだ計画（新しい順）→ 登録済みの月次試算。先頭が既定。 */
export function orderFinanceDatasets(datasets: readonly FinanceDataset[]): FinanceDataset[] {
  const plans = datasets.filter((dataset) => dataset.kind === "plan")
    .sort((left, right) => (right.asOf ?? "").localeCompare(left.asOf ?? ""));
  return [...plans, ...datasets.filter((dataset) => dataset.kind === "registered")];
}

// --- 集計 ------------------------------------------------------------------------

export interface FinanceMonthFigures {
  ym: string;
  /** 会社設立前の月か（設立月が分からなければ false）。 */
  beforeIncorporation: boolean;
  revenue: number | null;
  cogs: number | null;
  personnel: number | null;
  rd: number | null;
  marketing: number | null;
  otherOpex: number | null;
  grossProfit: number | null;
  preincorporationSpend: number | null;
  operatingProfit: number | null;
  inflow: number | null;
  outflow: number | null;
}

/** P/Lは設立前なら「設立前PJ支出」に集約し、NewCo の行には出さない。入金・出金はC/Fの行から作る。 */
export function financeMonthFigures(month: FinanceMonth, incorporationYm: string | null): FinanceMonthFigures {
  const beforeIncorporation = Boolean(incorporationYm && month.ym < incorporationYm);
  const pl = month.pl;
  const company = pl && !beforeIncorporation ? pl : null;
  const cash = month.cash;
  let inflow: number | null = null;
  let outflow: number | null = null;
  if (cash) {
    const parts = [cash.operating, cash.investing, cash.equity, cash.loanDrawdown, cash.loanRepayment, cash.grant];
    if (parts.some((value) => value !== null)) {
      inflow = parts.reduce<number>((sum, value) => sum + (value !== null && value > 0 ? value : 0), 0);
      outflow = parts.reduce<number>((sum, value) => sum + (value !== null && value < 0 ? -value : 0), 0);
    } else {
      const reportedInflow = month.extras.cash_inflow_yen ?? null;
      if (reportedInflow !== null && cash.net !== null) {
        inflow = reportedInflow;
        outflow = Math.max(0, reportedInflow - cash.net);
      }
    }
  }
  return {
    ym: month.ym,
    beforeIncorporation,
    revenue: company ? company.revenue : null,
    cogs: company ? company.cogs : null,
    personnel: company ? company.personnel : null,
    rd: company ? company.rd : null,
    marketing: company ? company.marketing : null,
    otherOpex: company ? company.otherOpex : null,
    grossProfit: company ? company.revenue - company.cogs : null,
    preincorporationSpend: pl && beforeIncorporation ? plExpense(pl) : null,
    operatingProfit: company ? plOperatingProfit(company) : null,
    inflow,
    outflow,
  };
}

export interface FinanceAnnualRow {
  fiscalYear: number;
  revenue: number;
  expense: number;
  cogs: number;
  personnel: number;
  rd: number;
  marketing: number;
  otherOpex: number;
  operatingProfit: number;
  equity: number | null;
  loanNet: number | null;
  grant: number | null;
  net: number | null;
  closing: number | null;
  preincorporationSpend: number;
  hasPl: boolean;
}

export function financeAnnualRows(months: readonly FinanceMonth[], incorporationYm: string | null): FinanceAnnualRow[] {
  const annual = new Map<number, FinanceAnnualRow>();
  for (const month of months) {
    if (!month.pl && !month.cash) continue;
    const fiscalYear = fiscalYearOf(month.ym);
    const row = annual.get(fiscalYear) ?? {
      fiscalYear,
      revenue: 0,
      expense: 0,
      cogs: 0,
      personnel: 0,
      rd: 0,
      marketing: 0,
      otherOpex: 0,
      operatingProfit: 0,
      equity: null,
      loanNet: null,
      grant: null,
      net: null,
      closing: null,
      preincorporationSpend: 0,
      hasPl: false,
    };
    const figures = financeMonthFigures(month, incorporationYm);
    if (figures.revenue !== null) {
      row.hasPl = true;
      row.revenue += figures.revenue;
      row.cogs += figures.cogs ?? 0;
      row.personnel += figures.personnel ?? 0;
      row.rd += figures.rd ?? 0;
      row.marketing += figures.marketing ?? 0;
      row.otherOpex += figures.otherOpex ?? 0;
      row.expense += (figures.cogs ?? 0) + (figures.personnel ?? 0) + (figures.rd ?? 0) + (figures.marketing ?? 0) + (figures.otherOpex ?? 0);
      row.operatingProfit += figures.operatingProfit ?? 0;
    }
    row.preincorporationSpend += figures.preincorporationSpend ?? 0;
    const cash = month.cash;
    if (cash) {
      const add = (current: number | null, value: number | null) => value === null ? current : (current ?? 0) + value;
      row.equity = add(row.equity, cash.equity);
      row.loanNet = add(add(row.loanNet, cash.loanDrawdown), cash.loanRepayment);
      row.grant = add(row.grant, cash.grant);
      row.net = add(row.net, cash.net);
      if (cash.closing !== null) row.closing = cash.closing;
    }
    annual.set(fiscalYear, row);
  }
  return [...annual.values()].sort((left, right) => left.fiscalYear - right.fiscalYear);
}

export interface FinanceSummary {
  periodStart: string | null;
  periodEnd: string | null;
  revenue: number | null;
  expense: number | null;
  funding: number | null;
  lowestCash: { ym: string; value: number } | null;
  endingCash: { ym: string; value: number } | null;
}

export function financeSummary(months: readonly FinanceMonth[], incorporationYm: string | null): FinanceSummary {
  const withData = months.filter((month) => month.pl || month.cash);
  let revenue: number | null = null;
  let expense: number | null = null;
  let funding: number | null = null;
  let lowestCash: FinanceSummary["lowestCash"] = null;
  let endingCash: FinanceSummary["endingCash"] = null;
  for (const month of withData) {
    const figures = financeMonthFigures(month, incorporationYm);
    if (figures.revenue !== null) {
      revenue = (revenue ?? 0) + figures.revenue;
      expense = (expense ?? 0) + (figures.cogs ?? 0) + (figures.personnel ?? 0) + (figures.rd ?? 0) + (figures.marketing ?? 0) + (figures.otherOpex ?? 0);
    }
    const cash = month.cash;
    if (cash) {
      const raised = (cash.equity ?? 0) + (cash.loanDrawdown ?? 0) + (cash.grant ?? 0);
      if (cash.equity !== null || cash.loanDrawdown !== null || cash.grant !== null) funding = (funding ?? 0) + raised;
      if (cash.closing !== null) {
        if (!lowestCash || cash.closing < lowestCash.value) lowestCash = { ym: month.ym, value: cash.closing };
        endingCash = { ym: month.ym, value: cash.closing };
      }
    }
  }
  return {
    periodStart: withData[0]?.ym ?? null,
    periodEnd: withData.at(-1)?.ym ?? null,
    revenue,
    expense,
    funding,
    lowestCash,
    endingCash,
  };
}

// --- 時間軸のイベント ---------------------------------------------------------------

function premiseItem(id: string, label: string, ym: string, category: Bzm22TimelineItem["category"], description: string): Bzm22TimelineItem {
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

/**
 * 時間軸に置くイベント。試算（BZM）の時間軸に、資本政策の会社設立・調達と、
 * AMDの必須ゲート「設立前DD完了期限」（設立の前月）を足す。調達は資本政策を正にし、
 * 同じ月の試算側の資金イベントは重ねない。
 */
export function buildFinanceTimelineItems(input: {
  pilotItems: readonly Bzm22TimelineItem[];
  incorporationYm: string | null;
  fundingEvents: readonly FinanceFundingEvent[];
}): Bzm22TimelineItem[] {
  const premises: Bzm22TimelineItem[] = [];
  if (input.incorporationYm) {
    premises.push(premiseItem(
      "format-dd-before-incorporation",
      "設立前DD完了期限",
      addMonths(input.incorporationYm, -1),
      "funding_external",
      "AMDの必須ゲート。技術・法務・財務・知財のDD論点を会社設立より前に完了する。",
    ));
    premises.push(premiseItem(
      "format-incorporation",
      "会社設立",
      input.incorporationYm,
      "commercial",
      "資本政策の設立イベントの月。設立前のPJ活動と会社の会計をこの月で分ける。",
    ));
  }
  const fundingMonths = new Set<string>();
  for (const event of input.fundingEvents) {
    fundingMonths.add(event.ym);
    premises.push(premiseItem(
      `format-funding-${event.label}-${event.ym}`,
      `${event.label}（資本政策）`,
      event.ym,
      "funding_external",
      "資本政策表の計画イベント。着金の実績ではない。",
    ));
  }
  const pilotItems = input.pilotItems
    .filter((item) => item.category !== "registered_policy")
    .filter((item) => !(item.category === "funding_external" && item.startDate && fundingMonths.has(item.startDate.slice(0, 7))));
  return [...pilotItems, ...premises];
}

/** 資本政策の文書（document_json）から、会社設立の月と現金が入る調達イベントを読む。 */
export function readCapitalPlanFinanceInputs(document: unknown): { incorporationYm: string | null; fundingEvents: FinanceFundingEvent[] } {
  if (!document || typeof document !== "object" || !Array.isArray((document as { events?: unknown }).events)) {
    return { incorporationYm: null, fundingEvents: [] };
  }
  const events = (document as { events: unknown[] }).events;
  let incorporationYm: string | null = null;
  const fundingEvents: FinanceFundingEvent[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const event = raw as { type?: unknown; date?: unknown; label?: unknown; allocations?: unknown };
    if (typeof event.date !== "string" || event.date.length < 7) continue;
    const ym = event.date.slice(0, 7);
    if (event.type === "incorporation" && !incorporationYm) incorporationYm = ym;
    if (event.type === "equity_issue" || event.type === "ipo" || event.type === "convertible_issue") {
      const allocations = Array.isArray(event.allocations) ? event.allocations : [];
      const amountYen = allocations.reduce<number>((sum, allocation) => {
        const amount = allocation && typeof allocation === "object" ? (allocation as { amount?: { value?: unknown } }).amount : undefined;
        return sum + (toNumber(amount?.value) ?? 0);
      }, 0);
      if (amountYen > 0) fundingEvents.push({ label: typeof event.label === "string" ? event.label : "調達", ym, amountYen });
    }
  }
  return { incorporationYm, fundingEvents };
}
