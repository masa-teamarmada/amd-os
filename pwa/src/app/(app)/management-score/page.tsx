import { createClient } from "@/lib/supabase/server";
import { GasMonthlySimulationPanel, type GasMonthlyRow, type GasProjectListItem, type GasSimulationResult } from "@/components/management-score/GasMonthlySimulationPanel";
import {
  EvidencePanel,
  type EvidenceRow,
  type DialogueConfirmedSignal,
} from "@/components/management-score/EvidencePanel";
import { AlertTriangle, CheckCircle2, CircleGauge, ShieldAlert } from "lucide-react";
import type { MonthlyPlInputs } from "@/lib/finance/monthly-pl-simulation";
import { effectivePaymentYmForCycle } from "@/lib/payment-groups";

export const dynamic = "force-dynamic";

type BudgetActualRow = {
  ym: string;
  scope: string;
  project_id: string | null;
  category: string;
  account_name: string | null;
  budget_amount_yen: number | null;
  actual_amount_yen: number | null;
  variance_yen: number | null;
  cash_amount_yen: number | null;
  runway_months: number | null;
  budget_payload: Record<string, unknown> | null;
  actual_payload: Record<string, unknown> | null;
};

type AggregatedBudgetActualRow = {
  ym: string;
  category: string;
  budget_amount_yen: number;
  actual_amount_yen: number;
  variance_yen: number;
  cash_amount_yen: number | null;
  runway_months: number | null;
};

type ScoreSnapshot = {
  ym: string;
  total_score: number | null;
  initiative_score: number | null;
  finance_score: number | null;
  retention_score: number | null;
  pipeline_score: number | null;
  direction_score: number | null;
  confidence: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type ScoreSnapshotFull = ScoreSnapshot & {
  id: string;
  inputs_json: Record<string, unknown> | null;
  next_actions_json: unknown;
  summary: string | null;
  finance_cap_applied: string | null;
};

type EvidenceQueryRow = {
  id: string;
  axis: string;
  evidence_kind: string;
  summary: string;
  source_type: string | null;
  source_ref: string | null;
  impact: number | string | null;
  confidence: number | string | null;
  payload: Record<string, unknown> | null;
};

type SimulationRun = {
  id: string;
  scenario_id: string | null;
  version: string;
  engine_version: string | null;
  ran_at: string;
};

type VarianceNote = {
  id: string;
  ym: string;
  category: string | null;
  variance_kind: string;
  note: string;
  confidence: number | null;
  status: string;
};

type ManagementSignalReviewRow = {
  id: string;
  ym: string;
  status: string;
  summary: string;
  forecast_summary: string | null;
  cost_actions: unknown;
  pipeline_actions: unknown;
  variance_findings: unknown;
  risk_alerts: unknown;
  decision_signals: unknown;
  source_refs_json: unknown;
  codex_thread_id: string | null;
  reviewed_at: string | null;
  created_at: string | null;
};

type ManagementSignalSection = {
  title: string;
  body: string;
  items: string[];
  tone: "neutral" | "good" | "watch" | "danger";
};

type ManagementSignalReview = {
  id: string;
  ym: string;
  status: string;
  sourceLabel: string;
  statusTone: ManagementSignalSection["tone"];
  statusIcon: "good" | "watch" | "danger" | "neutral";
  statusLabel: string;
  headline: string;
  summary: string;
  reviewedAt: string | null;
  codexThreadId: string | null;
  sections: ManagementSignalSection[];
};

type BudgetInputRow = {
  input_kind: string;
  source_id: string | null;
  label: string | null;
  payload: Record<string, unknown> | null;
};

type PaymentProjectRow = {
  project_id: string;
  project_name: string;
  client_name: string | null;
  status: string | null;
  freee_partner_id: string | null;
  payment_due_rule: string | null;
  payment_due_day: number | null;
};

type PaymentMemberRow = {
  member_id: string;
  code_name: string | null;
  member_name: string | null;
  is_officer: boolean | null;
};

type BillingCycleActualRow = {
  id: string;
  project_id: string;
  ym: string;
  status: string | null;
  budget_yen: number | string | null;
  budget_reported_amount: number | string | null;
  invoice_ym: string | null;
  invoice_base_lines_json: string | null;
  invoice_issued_at: string | null;
  invoice_sent_at: string | null;
  freee_invoice_number: string | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  payout_notice_uploaded_at: string | null;
  reward_paid_at: string | null;
  reward_paid_by: string | null;
  reward_summary_json: Record<string, unknown> | null;
};

type ProjectMonthlyFinanceCell = {
  projectId: string;
  projectName: string;
  ym: string;
  budgetYen: number;
  payoutYen: number;
  officerPayoutYen: number;
  stockYen: number;
  finalBalanceYen: number;
};

type ProjectMonthlyFinanceRow = {
  projectId: string;
  projectName: string;
  cells: ProjectMonthlyFinanceCell[];
  totals: Omit<ProjectMonthlyFinanceCell, "projectId" | "projectName" | "ym">;
};

type PayoutNoticeActualRow = {
  member_id: string;
  ym: string;
  total_yen: number | string | null;
  sent_at: string | null;
  pdf_url: string | null;
};

type MonthlyActualSummary = {
  ym: string;
  hasActualData: boolean;
  actualRevenue: number;
  confirmedDepositsGross: number;
  payoutNoticeNetTotal: number;
  payoutNoticeSentNetTotal: number;
  payoutNoticePendingNetTotal: number;
  payoutNoticeGrossTotal: number;
  actualFixedCost: number;
  actualSocialIns: number;
  actualSpotIncome: number;
  actualSpotExpense: number;
  actualLoanPayment: number;
  actualCtaxPayment: number;
  actualCorpTaxPayment: number;
  actualNetCashFlow: number;
};

type ExpectedReceiptSummary = {
  gross: number;
  highConfidenceGross: number;
  items: Array<{
    projectId: string;
    projectName: string;
    sourceYm: string;
    gross: number;
    status: string | null;
    source: "invoice_sent" | "invoice_issued" | "budget_confirmed" | "unconfirmed";
  }>;
};

const SCORE_COMPONENTS: Array<{
  key: keyof Pick<
    ScoreSnapshot,
    "initiative_score" | "finance_score" | "retention_score" | "pipeline_score" | "direction_score"
  >;
  axis: EvidenceRow["axis"];
  label: string;
  colorClass: string;
}> = [
  { key: "initiative_score", axis: "initiative", label: "先手力", colorClass: "text-sky-600" },
  { key: "finance_score", axis: "finance", label: "財務", colorClass: "text-emerald-600" },
  { key: "retention_score", axis: "retention", label: "継続", colorClass: "text-amber-600" },
  { key: "pipeline_score", axis: "pipeline", label: "新規", colorClass: "text-violet-600" },
  { key: "direction_score", axis: "direction", label: "方向", colorClass: "text-rose-600" },
];

const AXIS_FIELD: Record<string, keyof Pick<ScoreSnapshot, "initiative_score" | "finance_score" | "retention_score" | "pipeline_score" | "direction_score">> = {
  initiative: "initiative_score",
  finance: "finance_score",
  retention: "retention_score",
  pipeline: "pipeline_score",
  direction: "direction_score",
};

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T | null; error: { message?: string } | null }>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await run();
    return { data: data ?? null, error: error?.message ?? null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function yen(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
}

function scoreTone(value: number | null | undefined): string {
  if (value == null) return "text-muted-foreground";
  if (value >= 75) return "text-emerald-600";
  if (value >= 55) return "text-amber-600";
  return "text-red-600";
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    revenue: "売上",
    cost_member: "メンバー原価",
    cost_closer: "クローザー原価",
    gross_profit: "粗利",
    fixed_cost: "固定費",
    social_insurance: "社保",
    operating_profit: "営業利益",
    loan_payment: "借入返済",
    loan_interest: "支払利息",
    tax_payment_consumption: "消費税",
    tax_payment_corporate: "法人税",
    net_cash_flow: "純CF",
  };
  return labels[category] ?? category;
}

function ymToDate(ym: string): Date {
  return new Date(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1);
}

function dateToYm(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym: string, delta: number): string {
  const date = ymToDate(ym);
  date.setMonth(date.getMonth() + delta);
  return dateToYm(date);
}

function shortYm(ym: string): string {
  return `${ym.slice(2, 4)}/${ym.slice(4, 6)}`;
}

function centeredMonths(centerYm: string | null, availableYms: string[], before = 12, after = 12): string[] {
  const center = centerYm ?? availableYms.sort().at(-1) ?? dateToYm(new Date());
  return Array.from({ length: before + after + 1 }, (_, index) => addMonths(center, index - before));
}

function aggregateCategoryRows(rows: BudgetActualRow[], ym?: string): AggregatedBudgetActualRow[] {
  const map = new Map<string, AggregatedBudgetActualRow>();
  for (const row of rows) {
    if (ym && row.ym !== ym) continue;
    if (row.scope !== "company" || row.category === "project_revenue") continue;
    const current = map.get(row.category) ?? {
      ym: row.ym,
      category: row.category,
      budget_amount_yen: 0,
      actual_amount_yen: 0,
      variance_yen: 0,
      cash_amount_yen: null,
      runway_months: null,
    };
    current.budget_amount_yen += row.budget_amount_yen ?? 0;
    current.actual_amount_yen += row.actual_amount_yen ?? 0;
    current.cash_amount_yen = current.cash_amount_yen ?? row.cash_amount_yen;
    current.runway_months = current.runway_months ?? row.runway_months;
    map.set(row.category, current);
  }
  return Array.from(map.values()).map((row) => ({
    ...row,
    variance_yen: row.actual_amount_yen - row.budget_amount_yen,
  }));
}

function byMonthCategory(rows: BudgetActualRow[]): Map<string, Map<string, BudgetActualRow[]>> {
  const map = new Map<string, Map<string, BudgetActualRow[]>>();
  for (const row of rows) {
    const month = map.get(row.ym) ?? new Map<string, BudgetActualRow[]>();
    const list = month.get(row.category) ?? [];
    list.push(row);
    month.set(row.category, list);
    map.set(row.ym, month);
  }
  return map;
}

function findAmount(rows: AggregatedBudgetActualRow[], category: string, key: "budget_amount_yen" | "actual_amount_yen" | "variance_yen") {
  return rows.find((row) => row.category === category)?.[key] ?? null;
}

function signedYen(value: number): string {
  if (value === 0) return "±¥0";
  return `${value > 0 ? "+" : "-"}¥${Math.abs(Math.round(value)).toLocaleString("ja-JP")}`;
}

function reviewToneClass(tone: ManagementSignalSection["tone"]): string {
  if (tone === "good") return "border-sky-200 bg-sky-50/70 text-sky-950";
  if (tone === "watch") return "border-amber-200 bg-amber-50/70 text-amber-950";
  if (tone === "danger") return "border-pink-200 bg-pink-50/70 text-pink-950";
  return "border-border bg-background text-foreground";
}

function reviewStatusClass(tone: ManagementSignalSection["tone"]): string {
  if (tone === "good") return "border-sky-200 bg-sky-50 text-sky-900";
  if (tone === "watch") return "border-amber-200 bg-amber-50 text-amber-950";
  if (tone === "danger") return "border-pink-200 bg-pink-50 text-pink-950";
  return "border-border bg-background text-foreground";
}

function shortMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10_000) return `${value < 0 ? "-" : ""}約${Math.round(abs / 10_000).toLocaleString("ja-JP")}万円`;
  return yen(value);
}

function compactSignalStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return [record.title, record.body, record.action, record.note, record.summary]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" / ");
    })
    .filter((item): item is string => Boolean(item));
}

function payloadNumberValue(payload: Record<string, unknown> | null | undefined, key: string): number {
  const value = payload?.[key];
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function invoiceLinesNet(raw: string | null): number {
  if (!raw?.trim()) return 0;
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return 0;
    return Math.round(
      parsed.reduce((sum, row) => {
        if ((row.type ?? "item") === "text") return sum;
        const quantity = numberValue(row.qty ?? row.quantity) || 1;
        const unitPrice = numberValue(row.unit_price);
        return sum + quantity * unitPrice;
      }, 0)
    );
  } catch {
    return 0;
  }
}

function expectedNetForCycle(cycle: BillingCycleActualRow): number {
  const invoiceNet = invoiceLinesNet(cycle.invoice_base_lines_json);
  if ((cycle.invoice_issued_at || cycle.freee_invoice_number) && invoiceNet > 0) return invoiceNet;
  const reported = numberValue(cycle.budget_reported_amount);
  if (reported > 0) return reported;
  if (invoiceNet > 0) return invoiceNet;
  const budget = numberValue(cycle.budget_yen);
  return budget > 0 ? Math.round(budget / 0.65) : 0;
}

function rewardSummaryMembers(summary: Record<string, unknown> | null): Array<Record<string, unknown>> {
  return Array.isArray(summary?.members) ? (summary.members as Array<Record<string, unknown>>) : [];
}

function rewardMemberId(member: Record<string, unknown>): string {
  return String(member.memberId ?? member.member_id ?? "").trim();
}

function buildProjectMonthlyFinanceRows({
  months,
  cycles,
  projects,
  members,
}: {
  months: string[];
  cycles: BillingCycleActualRow[];
  projects: PaymentProjectRow[];
  members: PaymentMemberRow[];
}): ProjectMonthlyFinanceRow[] {
  const projectMap = new Map(projects.map((project) => [project.project_id, project]));
  const officerMemberIds = new Set(members.filter((member) => member.is_officer).map((member) => member.member_id));
  const rows = new Map<string, ProjectMonthlyFinanceRow>();
  const ensureRow = (projectId: string) => {
    const project = projectMap.get(projectId);
    const current =
      rows.get(projectId) ??
      {
        projectId,
        projectName: project?.project_name || projectId,
        cells: [],
        totals: {
          budgetYen: 0,
          payoutYen: 0,
          officerPayoutYen: 0,
          stockYen: 0,
          finalBalanceYen: 0,
        },
      };
    rows.set(projectId, current);
    return current;
  };

  for (const cycle of cycles.filter((item) => months.includes(item.ym))) {
    const row = ensureRow(cycle.project_id);
    let payoutYen = 0;
    let officerPayoutYen = 0;
    let stockYen = 0;
    for (const member of rewardSummaryMembers(cycle.reward_summary_json)) {
      const totalPay = numberValue(member.totalPay ?? member.total_pay);
      const stock = numberValue(member.stockYen ?? member.stock_yen ?? member.deferredYen ?? member.deferred_yen);
      const isOfficer = officerMemberIds.has(rewardMemberId(member));
      if (isOfficer) {
        officerPayoutYen += totalPay;
      } else {
        payoutYen += totalPay;
      }
      stockYen += stock;
    }
    const budgetYen = numberValue(cycle.budget_yen);
    const finalBalanceYen = budgetYen - payoutYen;
    const cell: ProjectMonthlyFinanceCell = {
      projectId: cycle.project_id,
      projectName: row.projectName,
      ym: cycle.ym,
      budgetYen,
      payoutYen,
      officerPayoutYen,
      stockYen,
      finalBalanceYen,
    };
    row.cells.push(cell);
    row.totals.budgetYen += budgetYen;
    row.totals.payoutYen += payoutYen;
    row.totals.officerPayoutYen += officerPayoutYen;
    row.totals.stockYen += stockYen;
    row.totals.finalBalanceYen += finalBalanceYen;
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      cells: months.map((ym) => row.cells.find((cell) => cell.ym === ym) ?? {
        projectId: row.projectId,
        projectName: row.projectName,
        ym,
        budgetYen: 0,
        payoutYen: 0,
        officerPayoutYen: 0,
        stockYen: 0,
        finalBalanceYen: 0,
      }),
    }))
    .filter((row) => row.totals.budgetYen > 0 || row.totals.payoutYen > 0 || row.totals.stockYen > 0)
    .sort((a, b) => a.projectName.localeCompare(b.projectName, "ja"));
}

function actualCompanyValue(categoryRows: Map<string, Map<string, BudgetActualRow[]>>, ym: string, category: string): number {
  return (categoryRows.get(ym)?.get(category) ?? []).reduce((sum, row) => sum + (row.actual_amount_yen ?? 0), 0);
}

function emptyActualSummary(ym: string): MonthlyActualSummary {
  return {
    ym,
    hasActualData: false,
    actualRevenue: 0,
    confirmedDepositsGross: 0,
    payoutNoticeNetTotal: 0,
    payoutNoticeSentNetTotal: 0,
    payoutNoticePendingNetTotal: 0,
    payoutNoticeGrossTotal: 0,
    actualFixedCost: 0,
    actualSocialIns: 0,
    actualSpotIncome: 0,
    actualSpotExpense: 0,
    actualLoanPayment: 0,
    actualCtaxPayment: 0,
    actualCorpTaxPayment: 0,
    actualNetCashFlow: 0,
  };
}

function buildMonthlyActualSummaries(
  months: string[],
  categoryRows: Map<string, Map<string, BudgetActualRow[]>>,
  cycles: BillingCycleActualRow[],
  projects: PaymentProjectRow[],
  payoutNotices: PayoutNoticeActualRow[]
): Map<string, MonthlyActualSummary> {
  const summaries = new Map<string, MonthlyActualSummary>();
  const projectMap = new Map(projects.map((project) => [project.project_id, project]));
  const ensure = (ym: string) => {
    const current = summaries.get(ym) ?? emptyActualSummary(ym);
    summaries.set(ym, current);
    return current;
  };
  for (const ym of months) {
    const summary = ensure(ym);
    summary.actualRevenue = actualCompanyValue(categoryRows, ym, "revenue");
    summary.actualFixedCost = actualCompanyValue(categoryRows, ym, "fixed_cost");
    summary.actualSocialIns = actualCompanyValue(categoryRows, ym, "social_insurance");
    summary.actualSpotIncome = actualCompanyValue(categoryRows, ym, "spot_income");
    summary.actualSpotExpense = actualCompanyValue(categoryRows, ym, "spot_expense");
    summary.actualLoanPayment = actualCompanyValue(categoryRows, ym, "loan_payment");
    summary.actualCtaxPayment = actualCompanyValue(categoryRows, ym, "tax_payment_consumption");
    summary.actualCorpTaxPayment = actualCompanyValue(categoryRows, ym, "tax_payment_corporate");
    summary.hasActualData = (categoryRows.get(ym) ? Array.from(categoryRows.get(ym)!.values()).flat() : []).some(
      (row) => row.actual_amount_yen != null
    );
  }
  for (const cycle of cycles) {
    if (!cycle.payment_confirmed_at) continue;
    const project = projectMap.get(cycle.project_id);
    const paymentYm = effectivePaymentYmForCycle(cycle, project);
    const summary = ensure(paymentYm);
    summary.confirmedDepositsGross += Math.round(expectedNetForCycle(cycle) * 1.1);
    summary.hasActualData = true;
  }
  for (const notice of payoutNotices) {
    const summary = ensure(notice.ym);
    const amount = numberValue(notice.total_yen);
    summary.payoutNoticeNetTotal += amount;
    summary.payoutNoticeGrossTotal += Math.round(amount * 1.1);
    if (notice.sent_at) {
      summary.payoutNoticeSentNetTotal += amount;
    } else {
      summary.payoutNoticePendingNetTotal += amount;
    }
    summary.hasActualData = true;
  }
  for (const summary of summaries.values()) {
    const paidOutflowGross = Math.round(summary.payoutNoticeSentNetTotal * 1.1);
    const actualOutflow =
      paidOutflowGross +
      summary.actualFixedCost +
      summary.actualSocialIns +
      summary.actualSpotExpense -
      summary.actualSpotIncome +
      summary.actualLoanPayment +
      summary.actualCtaxPayment +
      summary.actualCorpTaxPayment;
    summary.actualNetCashFlow = summary.confirmedDepositsGross - actualOutflow;
  }
  return summaries;
}

function cycleForecastSource(cycle: BillingCycleActualRow): ExpectedReceiptSummary["items"][number]["source"] {
  if (cycle.invoice_sent_at) return "invoice_sent";
  if (cycle.invoice_issued_at || cycle.freee_invoice_number) return "invoice_issued";
  if (["budget_confirmed", "report_fixed", "invoice_issued", "invoice_sent"].includes(cycle.status ?? "")) return "budget_confirmed";
  return "unconfirmed";
}

function buildExpectedReceiptsByPaymentYm(cycles: BillingCycleActualRow[], projects: PaymentProjectRow[]): Map<string, ExpectedReceiptSummary> {
  const projectMap = new Map(projects.map((project) => [project.project_id, project]));
  const map = new Map<string, ExpectedReceiptSummary>();
  const ensure = (ym: string) => {
    const current = map.get(ym) ?? { gross: 0, highConfidenceGross: 0, items: [] };
    map.set(ym, current);
    return current;
  };
  for (const cycle of cycles) {
    if (cycle.payment_confirmed_at) continue;
    const project = projectMap.get(cycle.project_id);
    const paymentYm = effectivePaymentYmForCycle(cycle, project);
    const net = expectedNetForCycle(cycle);
    if (net <= 0) continue;
    const gross = Math.round(net * 1.1);
    const source = cycleForecastSource(cycle);
    const summary = ensure(paymentYm);
    summary.gross += gross;
    if (source !== "unconfirmed") summary.highConfidenceGross += gross;
    summary.items.push({
      projectId: cycle.project_id,
      projectName: project?.project_name || cycle.project_id,
      sourceYm: cycle.ym,
      gross,
      status: cycle.status,
      source,
    });
  }
  return map;
}

function buildOneOffInflowGrossByYm(inputRows: BudgetInputRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of inputRows) {
    if (row.input_kind !== "project" || !row.payload) continue;
    const payload = row.payload as Record<string, unknown>;
    if (payload.type !== "spot") continue;
    const ym = String(payload.startYm ?? "");
    if (!/^[0-9]{6}$/.test(ym)) continue;
    const revenue = numberValue(payload.monthlyRevenue);
    if (revenue <= 0) continue;
    map.set(ym, (map.get(ym) ?? 0) + Math.round(revenue * 1.1));
  }
  return map;
}

function compactReceiptItems(items: ExpectedReceiptSummary["items"], limit = 3): string {
  if (items.length === 0) return "なし";
  const sourceLabels: Record<ExpectedReceiptSummary["items"][number]["source"], string> = {
    invoice_sent: "請求送付済",
    invoice_issued: "請求発行済",
    budget_confirmed: "予算確定",
    unconfirmed: "未確認",
  };
  const head = items.slice(0, limit).map((item) => `${item.projectName} ${shortYm(item.sourceYm)} ${yen(item.gross)} ${sourceLabels[item.source]}`);
  const rest = items.length - head.length;
  return rest > 0 ? `${head.join(" / ")} ほか${rest}件` : head.join(" / ");
}

function rowForYm(rows: GasMonthlyRow[], ym: string): GasMonthlyRow | null {
  return rows.find((row) => String(row.ym) === ym) ?? null;
}

function buildPersistedManagementSignalReviews(rows: ManagementSignalReviewRow[]): ManagementSignalReview[] {
  return rows.map((row) => ({
    id: row.id,
    ym: row.ym,
    status: row.status,
    sourceLabel: row.status === "confirmed" ? "月末Codex評価" : "Codex評価候補",
    statusTone: compactSignalStrings(row.risk_alerts).length > 0 ? "watch" : "neutral",
    statusIcon: compactSignalStrings(row.risk_alerts).length > 0 ? "watch" : "neutral",
    statusLabel: row.status === "confirmed" ? "月末評価済み" : "評価候補",
    headline: row.summary,
    summary: row.summary,
    reviewedAt: row.reviewed_at ?? row.created_at,
    codexThreadId: row.codex_thread_id,
    sections: [
      {
        title: "先3か月見込み",
        body: row.forecast_summary ?? "先3か月の見込み評価待ち。",
        items: compactSignalStrings(row.decision_signals),
        tone: "neutral",
      },
      {
        title: "費用を抑えるべきところ",
        body: "月末レビューで、削る費用・支払い時期・抑制ラインを確認する。",
        items: compactSignalStrings(row.cost_actions),
        tone: "watch",
      },
      {
        title: "追加獲得/入金前倒し目標",
        body: "資金の谷に対して、いつまでにどのくらいを追加するかを見る。",
        items: compactSignalStrings(row.pipeline_actions),
        tone: "danger",
      },
      {
        title: "予実乖離の原因",
        body: "freee PL / 入金確認 / 支払通知書 / billing_log / payout_notices の差分原因。",
        items: compactSignalStrings(row.variance_findings),
        tone: "neutral",
      },
      {
        title: "意思決定アラート",
        body: "未請求・未反映・支払済み未反映・runway 低下を月末レビューで確定する。",
        items: compactSignalStrings(row.risk_alerts),
        tone: "danger",
      },
    ],
  }));
}

function buildAutoManagementSignalReview({
  ymCap,
  pastActualYm,
  outlookMonths,
  rows,
  oneOffInflowGrossByYm,
  financeAlerts,
  varianceNotes,
}: {
  ymCap: string;
  pastActualYm: string;
  outlookMonths: string[];
  rows: GasMonthlyRow[];
  oneOffInflowGrossByYm: Map<string, number>;
  financeAlerts: string[];
  varianceNotes: VarianceNote[];
}): ManagementSignalReview {
  const outlookRows = outlookMonths.map((ym) => rowForYm(rows, ym)).filter((row): row is GasMonthlyRow => Boolean(row));
  const lowestCash = outlookRows.reduce(
    (lowest, row) => (row.cashBalance < lowest.cash ? { ym: String(row.ym), cash: row.cashBalance } : lowest),
    { ym: ymCap, cash: Number.POSITIVE_INFINITY }
  );
  const normalCfTotal = outlookRows.reduce((sum, row) => sum + row.netCashFlow - (oneOffInflowGrossByYm.get(String(row.ym)) ?? 0), 0);
  const cashGap = lowestCash.cash === Number.POSITIVE_INFINITY ? 0 : Math.max(0, 1_500_000 - lowestCash.cash);
  const negativeCfGap = outlookRows.reduce((sum, row) => {
    const oneOff = oneOffInflowGrossByYm.get(String(row.ym)) ?? 0;
    return sum + Math.max(0, -(row.netCashFlow - oneOff));
  }, 0);
  const targetGap = Math.max(cashGap, negativeCfGap);
  const dueYm = lowestCash.cash === Number.POSITIVE_INFINITY ? ymCap : addMonths(lowestCash.ym, -1);
  const pastRow = rowForYm(rows, pastActualYm);
  const varianceItems = pastRow
    ? [
        { label: "売上計", budget: pastRow.revenue, actual: pastRow.actualRevenue, diff: pastRow.actualRevenue - pastRow.revenue },
        {
          label: "売上原価",
          budget: pastRow.costMember + pastRow.costCloser,
          actual: pastRow.payoutNoticeSentNetTotal,
          diff: pastRow.payoutNoticeSentNetTotal - (pastRow.costMember + pastRow.costCloser),
        },
        { label: "固定費", budget: pastRow.fixedCost, actual: pastRow.actualFixedCost, diff: pastRow.actualFixedCost - pastRow.fixedCost },
        { label: "社保", budget: pastRow.socialIns, actual: pastRow.actualSocialIns, diff: pastRow.actualSocialIns - pastRow.socialIns },
        {
          label: "営業利益",
          budget: pastRow.operatingProfit,
          actual: pastRow.actualRevenue - pastRow.payoutNoticeSentNetTotal - pastRow.actualFixedCost - pastRow.actualSocialIns + pastRow.actualSpotIncome - pastRow.actualSpotExpense,
          diff:
            pastRow.actualRevenue -
            pastRow.payoutNoticeSentNetTotal -
            pastRow.actualFixedCost -
            pastRow.actualSocialIns +
            pastRow.actualSpotIncome -
            pastRow.actualSpotExpense -
            pastRow.operatingProfit,
        },
        { label: "純CF", budget: pastRow.netCashFlow, actual: pastRow.actualNetCashFlow, diff: pastRow.actualNetCashFlow - pastRow.netCashFlow },
      ].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    : [];
  const costCandidates = outlookRows
    .flatMap((row) => [
      { ym: String(row.ym), label: "売上原価", amount: row.costMember + row.costCloser },
      { ym: String(row.ym), label: "固定費", amount: row.fixedCost },
      { ym: String(row.ym), label: "社保", amount: row.socialIns },
      { ym: String(row.ym), label: "税金/返済", amount: row.loanPayment + row.ctaxPayment + row.corpTaxPayment },
    ])
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  const monthlyNormalCfs = outlookRows.map((row) => row.netCashFlow - (oneOffInflowGrossByYm.get(String(row.ym)) ?? 0));
  const hasNegativeNormalMonth = monthlyNormalCfs.some((value) => value < 0);
  const hasLargeGap = targetGap >= 2_000_000;
  const hasFinanceAlert = financeAlerts.length > 0;
  const statusTone: ManagementSignalSection["tone"] = hasLargeGap || hasFinanceAlert ? "danger" : targetGap > 0 || hasNegativeNormalMonth ? "watch" : "good";
  const statusLabel = statusTone === "danger" ? "要介入" : statusTone === "watch" ? "注意して進める" : "概ね良好";
  const headline =
    statusTone === "danger"
      ? "足元の数字だけ見ると回っているけど、先の資金の谷が近い。今月中に入金前倒し or 新規案件の上積みを決めたい。"
      : statusTone === "watch"
        ? "まあ悪くない。ただ、通常月の収支が少し薄いので、もう1本新規案件か入金前倒しがあるとかなり安心。"
        : "今のところ大きな介入は不要。入金予定のズレだけ見ながら、このまま案件化を積み増したい。";
  const summary =
    targetGap > 0
      ? `${dueYm} までに ${shortMoney(targetGap)} くらいの上積み余地を作れると、先3か月の見通しがかなり楽になる。`
      : "資金繰りの即時危険は小さい。月末評価では、予定入金の確度と新規案件の積み上がりを確認する。";
  const forecastItems = [
    hasNegativeNormalMonth
      ? "通常月だけで見ると赤字月がある。一括入金に助けられている月は、継続収益としては少し弱めに見る。"
      : "先3か月の通常月収支は大きく崩れていない。入金予定が予定通り入れば、急な資金ショート感は薄い。",
    lowestCash.cash < 3_000_000
      ? `${lowestCash.ym} あたりがいちばん薄い。ここまでに入金前倒しか小さめの新規案件を1本作れると安心。`
      : "最低Cashはまだ見られる水準。必要以上に支出を止めるより、案件化の速度を落とさない方がよさそう。",
  ];
  const costNarrative =
    costCandidates.length > 0
      ? `${costCandidates[0].label}と${costCandidates[1]?.label ?? "固定費"}が支出の重いところ。削るというより、支払いタイミングと外注稼働の必要性を月末に確認したい。`
      : "目立って重い費用候補はまだ薄い。費用削減より、入金確度の確認を優先する。";
  const topVariance = varianceItems[0];
  const varianceNarrative = topVariance
    ? `${pastActualYm} は ${topVariance.label} のズレが一番大きい。まずは会計上の発生月ズレなのか、実際の入出金タイミング差なのかを切り分けたい。`
    : "前月実績の差分原因はまだ薄い。freee PL、入金確認、支払通知書の更新が揃ってから確定評価する。";

  return {
    id: `auto-${ymCap}`,
    ym: ymCap,
    status: "auto_preview",
    sourceLabel: "自動抽出 / 月末Codex評価待ち",
    statusTone,
    statusIcon: statusTone,
    statusLabel,
    headline,
    summary,
    reviewedAt: null,
    codexThreadId: null,
    sections: [
      {
        title: "先3か月の温度感",
        body: statusTone === "danger" ? "資金の谷が近いので、楽観視はしない方がいい。" : "大きく崩れてはいないけど、入金タイミングに依存している。",
        items: forecastItems,
        tone: statusTone === "danger" ? "danger" : "watch",
      },
      {
        title: "費用の見方",
        body: costNarrative,
        items: [
          "無理に一律カットするより、支払い時期をずらせるものと、売上に直結しない稼働を分けて見る。",
        ],
        tone: "watch",
      },
      {
        title: "次の営業判断",
        body: targetGap > 0 ? `${dueYm} までに ${shortMoney(targetGap)} くらいの追加案件・入金前倒し・支出調整を作れると安心。` : "すぐに大型新規が必要な状態ではない。ただ、継続案件だけに寄りすぎないよう、相談案件を増やしておきたい。",
        items: [
          normalCfTotal < 0 ? "通常月収支が少し薄いので、新規案件は“あると嬉しい”ではなく安心材料として見たい。" : "通常月収支は踏みとどまっているので、焦って粗い案件を取りにいく必要は薄い。",
          "月末評価では、追加で獲得すべき金額よりも、どの案件がいつ入金に変わるかを確定したい。",
        ],
        tone: targetGap > 0 ? "danger" : "good",
      },
      {
        title: "乖離の読み方",
        body: varianceNarrative,
        items: [
          "数字の良し悪しだけで判断せず、入金確認・支払通知・freee PLのどれが先に動いた差分かを見る。",
          topVariance && Math.abs(topVariance.diff) > 0 ? `${topVariance.label} は ${signedYen(topVariance.diff)} のズレ。原因が説明できれば評価は安定、説明できなければ要確認。` : "大きな差分が出たら、原因メモをL2評価に残す。",
        ].filter((item): item is string => Boolean(item)),
        tone: varianceItems.some((item) => Math.abs(item.diff) >= 300_000) ? "watch" : "neutral",
      },
      {
        title: "今すぐ見ること",
        body: financeAlerts.length > 0 ? "未反映や未確認が残っている。経営判断の前に、OS上の状態と実態を合わせたい。" : "今すぐ止めるほどのアラートは薄い。次は新規案件と入金確度を見る。",
        items: financeAlerts.length > 0 ? financeAlerts : varianceNotes.slice(0, 2).map((note) => note.note),
        tone: financeAlerts.length > 0 ? "danger" : "neutral",
      },
    ],
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function humanizeValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-";
    return Math.abs(value) >= 1000 ? value.toLocaleString("ja-JP") : String(Math.round(value * 10) / 10);
  }
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "yes" : "no";
  return JSON.stringify(value);
}

function axisInputFacts(axis: EvidenceRow["axis"], inputs: Record<string, unknown>): string[] {
  if (axis === "pipeline") {
    const stageCount = recordValue(inputs.stageCount);
    return [
      `案件追跡 ${humanizeValue(inputs.commercials)}件`,
      `decided ${humanizeValue(stageCount.decided)} / executing ${humanizeValue(stageCount.executing)}`,
      `pipeline_value ${humanizeValue(inputs.pipelineValue)} / 10`,
      `OS未反映diff ${humanizeValue(inputs.diffs)}件`,
      `PJ派生knowledge ${humanizeValue(inputs.knowledge)}件`,
    ];
  }
  if (axis === "direction") {
    return [
      `ファンド ${humanizeValue(inputs.fundCount)}件`,
      `研究機関連携 ${humanizeValue(inputs.partnerCount)}件`,
      `OS導入 ${humanizeValue(inputs.osInstallCount)}件`,
      `マネタイズ ${humanizeValue(inputs.monetCount)}件`,
      `属人脱却 ${Math.round(Number(inputs.nonMasaRatio ?? 0) * 100)}%`,
      `成功卒業 ${humanizeValue(inputs.graduationCount)}件`,
    ];
  }
  if (axis === "initiative") {
    return [
      `対象event ${humanizeValue(inputs.totalEvents)}件`,
      `受け身event ${humanizeValue(inputs.passiveEvents)}件`,
      `AMD起点 ${humanizeValue(inputs.amdProposedCount)}件`,
      `共同決定 ${humanizeValue(inputs.coDecidedCount)}件`,
    ];
  }
  if (axis === "finance") {
    return [
      `runway ${humanizeValue(inputs.runway)}ヶ月`,
      `予実score ${humanizeValue(inputs.varianceScore)}`,
      `請求score ${humanizeValue(inputs.billingScore)}`,
      `freee行 ${humanizeValue(inputs.freeeRows)}件`,
    ];
  }
  return [
    `active PJ ${humanizeValue(inputs.activeProjects)}件`,
    `freeze ${humanizeValue(inputs.freezeCount)}件`,
    `進捗score ${humanizeValue(inputs.progressScore)}`,
    `MTG risk ${humanizeValue(inputs.riskMeetings)}件`,
  ];
}

function companyBudgetRow(categoryRows: Map<string, Map<string, BudgetActualRow[]>>, ym: string, category: string): BudgetActualRow | null {
  return categoryRows.get(ym)?.get(category)?.find((row) => row.budget_amount_yen != null && row.budget_payload !== null) ?? null;
}

function companyBudgetValue(categoryRows: Map<string, Map<string, BudgetActualRow[]>>, ym: string, category: string): number {
  return companyBudgetRow(categoryRows, ym, category)?.budget_amount_yen ?? 0;
}

function fixedCostDetailsForGas(categoryRows: Map<string, Map<string, BudgetActualRow[]>>, ym: string) {
  const details = companyBudgetRow(categoryRows, ym, "fixed_cost")?.budget_payload?.fixedCostDetails;
  if (!Array.isArray(details)) return [];
  return details
    .map((detail) => {
      if (!detail || typeof detail !== "object") return null;
      const row = detail as { name?: unknown; amount?: unknown };
      const amount = Number(row.amount);
      if (!row.name || !Number.isFinite(amount)) return null;
      return { name: String(row.name), amount };
    })
    .filter((row): row is { name: string; amount: number } => row !== null);
}

function buildGasSimulationResult(
  months: string[],
  categoryRows: Map<string, Map<string, BudgetActualRow[]>>,
  rawRows: BudgetActualRow[],
  inputRows: BudgetInputRow[],
  actualSummaries: Map<string, MonthlyActualSummary>,
  currentYm: string
): GasSimulationResult {
  const projectInputs = inputRows.filter((row) => row.input_kind === "project" && row.source_id);
  const projectList: GasProjectListItem[] = projectInputs.map((row) => ({
    projectId: row.source_id as string,
    projectName: row.label ?? (row.source_id as string),
    closerInternal: row.payload?.closerInternal === true || row.payload?.closerInternal === "TRUE" || row.payload?.closerInternal === "true",
  }));
  const projectRowsByMonth = new Map<string, BudgetActualRow[]>();
  for (const row of rawRows) {
    if (row.scope !== "project" || row.category !== "project_revenue") continue;
    const list = projectRowsByMonth.get(row.ym) ?? [];
    list.push(row);
    projectRowsByMonth.set(row.ym, list);
  }
  const rows: GasMonthlyRow[] = months.map((ym) => {
    const netCash = companyBudgetRow(categoryRows, ym, "net_cash_flow");
    const revenueRow = companyBudgetRow(categoryRows, ym, "revenue");
    const projectRows = projectRowsByMonth.get(ym) ?? [];
    const actualSummary = actualSummaries.get(ym);
    return {
      ym: Number(ym),
      actualStatus: Number(ym) > Number(currentYm) ? "future" : actualSummary?.hasActualData ? "actual" : "missing",
      revenue: companyBudgetValue(categoryRows, ym, "revenue"),
      actualRevenue: actualSummary?.actualRevenue ?? 0,
      confirmedDepositsGross: actualSummary?.confirmedDepositsGross ?? 0,
      costMember: companyBudgetValue(categoryRows, ym, "cost_member"),
      costCloser: companyBudgetValue(categoryRows, ym, "cost_closer"),
      grossProfit: companyBudgetValue(categoryRows, ym, "gross_profit"),
      fixedCost: companyBudgetValue(categoryRows, ym, "fixed_cost"),
      actualFixedCost: actualSummary?.actualFixedCost ?? 0,
      socialIns: companyBudgetValue(categoryRows, ym, "social_insurance"),
      actualSocialIns: actualSummary?.actualSocialIns ?? 0,
      operatingProfit: companyBudgetValue(categoryRows, ym, "operating_profit"),
      loanPayment: companyBudgetValue(categoryRows, ym, "loan_payment"),
      actualLoanPayment: actualSummary?.actualLoanPayment ?? 0,
      loanInterest: companyBudgetValue(categoryRows, ym, "loan_interest"),
      ctaxPayment: companyBudgetValue(categoryRows, ym, "tax_payment_consumption"),
      actualCtaxPayment: actualSummary?.actualCtaxPayment ?? 0,
      corpTaxPayment: companyBudgetValue(categoryRows, ym, "tax_payment_corporate"),
      actualCorpTaxPayment: actualSummary?.actualCorpTaxPayment ?? 0,
      netCashFlow: companyBudgetValue(categoryRows, ym, "net_cash_flow"),
      actualNetCashFlow: actualSummary?.actualNetCashFlow ?? 0,
      actualSpotIncome: actualSummary?.actualSpotIncome ?? 0,
      actualSpotExpense: actualSummary?.actualSpotExpense ?? 0,
      payoutNoticeNetTotal: actualSummary?.payoutNoticeNetTotal ?? 0,
      payoutNoticeSentNetTotal: actualSummary?.payoutNoticeSentNetTotal ?? 0,
      cashBalance: revenueRow?.cash_amount_yen ?? 0,
      runway: Number(revenueRow?.runway_months ?? 0),
      loanDisbursement: payloadNumberValue(netCash?.budget_payload, "loanDisbursement"),
      spotIncome: payloadNumberValue(netCash?.budget_payload, "spotIncome"),
      spotExpense: payloadNumberValue(netCash?.budget_payload, "spotExpense"),
      cashInflow: payloadNumberValue(netCash?.budget_payload, "cashInflow"),
      cashOutflow: payloadNumberValue(netCash?.budget_payload, "cashOutflow"),
      pjDetails: projectList.map((project) => {
        const projectRow = projectRows.find((row) => row.budget_payload?.gasProjectId === project.projectId || row.account_name === project.projectName);
        return {
          projectId: project.projectId,
          revenue: projectRow?.budget_amount_yen ?? 0,
          externalMember: payloadNumberValue(projectRow?.budget_payload, "externalMember"),
          internalMember: payloadNumberValue(projectRow?.budget_payload, "internalMember"),
        };
      }),
      fixedCostDetails: fixedCostDetailsForGas(categoryRows, ym),
    };
  });
  return {
    params: { rateCloser: 0.05 },
    rows,
    projectList,
  };
}

function buildMonthlyPlInputs(inputRows: BudgetInputRow[]): MonthlyPlInputs | null {
  const payloads = (kind: string): Record<string, unknown>[] =>
    inputRows
      .filter((row) => row.input_kind === kind && row.payload)
      .map((row) => row.payload as Record<string, unknown>);
  const params = inputRows.find((row) => row.input_kind === "params" && row.payload)?.payload;
  if (!params) return null;
  return {
    params: params as unknown as MonthlyPlInputs["params"],
    projects: payloads("project") as unknown as MonthlyPlInputs["projects"],
    fixedCosts: payloads("fixed_cost") as unknown as MonthlyPlInputs["fixedCosts"],
    projectRevenues: payloads("project_revenue") as unknown as MonthlyPlInputs["projectRevenues"],
    varCosts: payloads("var_cost") as unknown as MonthlyPlInputs["varCosts"],
    loans: payloads("loan") as unknown as MonthlyPlInputs["loans"],
    spots: payloads("spot") as unknown as MonthlyPlInputs["spots"],
    scenarios: payloads("scenario") as unknown as MonthlyPlInputs["scenarios"],
  };
}

function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthStartJstInstant(ym: string): Date {
  const year = Number(ym.slice(0, 4));
  const monthIndex = Number(ym.slice(4, 6)) - 1;
  return new Date(Date.UTC(year, monthIndex, 1, -9, 0, 0, 0));
}

function nextYm(ym: string): string {
  let year = Number(ym.slice(0, 4));
  let month = Number(ym.slice(4, 6)) + 1;
  if (month > 12) {
    year += 1;
    month = 1;
  }
  return `${year}${String(month).padStart(2, "0")}`;
}

function dateStringToYm(date: string | null | undefined): string | null {
  if (!date) return null;
  const match = date.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}${match[2]}` : null;
}

function snapshotMaterialTime(snapshot: Pick<ScoreSnapshot, "updated_at" | "created_at">): Date | null {
  const value = snapshot.updated_at ?? snapshot.created_at;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPreMonthSnapshot(snapshot: Pick<ScoreSnapshot, "ym" | "updated_at" | "created_at">): boolean {
  const materialTime = snapshotMaterialTime(snapshot);
  if (!materialTime) return false;
  return materialTime < monthStartJstInstant(snapshot.ym);
}

function signalTypeToVitalAxis(signalType: string): EvidenceRow["axis"] | null {
  if (signalType === "commercial_progress") return "pipeline";
  if (["funding", "partner_growth", "graduation", "next_move"].includes(signalType)) return "direction";
  return null;
}

function filterVitalConfirmedSignals(signals: DialogueConfirmedSignal[], targetYm: string | null): DialogueConfirmedSignal[] {
  if (!targetYm) return [];
  const start = monthStartJstInstant(targetYm);
  const end = monthStartJstInstant(nextYm(targetYm));
  return signals.filter((signal) => {
    if (signal.project_id !== "p00") return false;
    if (!signalTypeToVitalAxis(signal.signal_type)) return false;
    if (signal.ym !== targetYm) return false;
    const signalDateYm = dateStringToYm(signal.signal_date);
    if (signalDateYm && signalDateYm !== targetYm) return false;
    const confirmedAt = signal.confirmed_at ? new Date(signal.confirmed_at) : null;
    if (!confirmedAt || Number.isNaN(confirmedAt.getTime())) return false;
    return confirmedAt >= start && confirmedAt < end;
  });
}

export default async function ManagementScorePage() {
  const supabase = await createClient();
  // 未来月の snapshot を除外 (= まさ #76 確定 2026-05-26)。
  // 計算ミスやデータ不足の 6 月 snapshot が「最新」 と判定されて表示されないように、
  // ym <= currentYmJST() で filter する。
  const ymCap = currentYmJST();
  const [scoreRes, scoreHistoryRes, budgetRes, inputRes, runRes, notesRes, signalReviewsRes, evidenceRes, dialogueConfirmedRes] = await Promise.all([
    safeSelect<ScoreSnapshotFull[]>(() =>
      supabase
        .from("amd_management_score_snapshots")
        .select("id,ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,inputs_json,next_actions_json,summary,finance_cap_applied,created_at,updated_at")
        .lte("ym", ymCap)
        .order("ym", { ascending: false })
        .limit(6)
    ),
    safeSelect<ScoreSnapshot[]>(() =>
      supabase
        .from("amd_management_score_snapshots")
        .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,created_at,updated_at")
        .lte("ym", ymCap)
        .order("ym", { ascending: false })
        .limit(25)
    ),
    safeSelect<BudgetActualRow[]>(() =>
      supabase
        .from("company_budget_actual_monthly")
        .select("ym,scope,project_id,category,account_name,budget_amount_yen,actual_amount_yen,variance_yen,cash_amount_yen,runway_months,budget_payload,actual_payload")
        .order("ym", { ascending: false })
        .limit(2000)
    ),
    safeSelect<BudgetInputRow[]>(() =>
      supabase
        .from("company_budget_inputs")
        .select("input_kind,source_id,label,payload")
        .eq("source", "gas_monthly_pl")
        .order("input_kind", { ascending: true })
        .limit(500)
    ),
    safeSelect<SimulationRun[]>(() =>
      supabase
        .from("company_budget_simulation_runs")
        .select("id,scenario_id,version,engine_version,ran_at")
        .order("ran_at", { ascending: false })
        .limit(1)
    ),
    safeSelect<VarianceNote[]>(() =>
      supabase
        .from("company_budget_variance_notes")
        .select("id,ym,category,variance_kind,note,confidence,status")
        .order("created_at", { ascending: false })
        .limit(8)
    ),
    safeSelect<ManagementSignalReviewRow[]>(() =>
      supabase
        .from("company_management_signal_reviews")
        .select("id,ym,status,summary,forecast_summary,cost_actions,pipeline_actions,variance_findings,risk_alerts,decision_signals,source_refs_json,codex_thread_id,reviewed_at,created_at")
        .lte("ym", ymCap)
        .order("ym", { ascending: false })
        .limit(12)
    ),
    safeSelect<(EvidenceQueryRow & { ym: string; snapshot_id: string | null })[]>(() =>
      supabase
        .from("amd_management_score_evidence")
        .select("id,snapshot_id,ym,axis,evidence_kind,summary,source_type,source_ref,impact,confidence,payload")
        .order("created_at", { ascending: false })
        .limit(200)
    ),
    // dialogue で confirmed されたシグナル (= status='confirmed' AND decision_state IN decided/executing/revised)。
    // バイタル計算の新規軸 / 方向軸の入力に流れるので、EvidencePanel に chip 表示して
    // 「議論 → バイタル反映」 の経路を可視化する (= まさ #91 再設計)。
    safeSelect<DialogueConfirmedSignal[]>(() =>
      supabase
        .from("project_strategy_signals")
        .select("signal_id,project_id,ym,signal_type,impact_level,decision_state,title,summary,signal_date,confirmed_at,polarity,score_impact_summary,source_refs_json")
        .eq("status", "confirmed")
        .in("decision_state", ["decided", "executing", "revised"])
        .in("signal_type", ["commercial_progress", "funding", "partner_growth", "graduation", "next_move"])
        .lte("ym", ymCap)
        .order("confirmed_at", { ascending: false, nullsFirst: false })
        .limit(40)
    ),
  ]);
  const hiddenPreMonthSnapshots = (scoreRes.data ?? []).filter(isPreMonthSnapshot);
  const scoreHistoryDesc = (scoreHistoryRes.data ?? []).filter((row) => !isPreMonthSnapshot(row));
  const score = (scoreRes.data ?? []).find((row) => !isPreMonthSnapshot(row)) ?? null;
  const previous = scoreHistoryDesc.find((row) => score && row.ym < score.ym) ?? null;
  const scoreHistory = scoreHistoryDesc.slice().reverse();
  const budgetRows = budgetRes.data ?? [];
  const scoreInputs = (score?.inputs_json ?? {}) as Record<string, unknown>;
  const financeCap = score?.finance_cap_applied ?? (typeof scoreInputs.financeCap === "string" ? (scoreInputs.financeCap as string) : null);
  const snapshotSummary = score?.summary ?? null;
  const rawSignalCount = typeof scoreInputs.rawSignalCount === "number" ? (scoreInputs.rawSignalCount as number) : null;
  const nextActionsRaw = score?.next_actions_json;
  const nextActions = Array.isArray(nextActionsRaw)
    ? (nextActionsRaw as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const evidenceRowsRaw = (evidenceRes.data ?? []) as Array<EvidenceQueryRow & { ym: string; snapshot_id: string | null }>;
  const evidenceRows: EvidenceRow[] = evidenceRowsRaw
    .filter((row) => (score?.id ? row.snapshot_id === score.id : score?.ym ? row.ym === score.ym : true))
    .map((row) => ({
      id: row.id,
      axis: row.axis,
      evidence_kind: row.evidence_kind,
      summary: row.summary,
      source_type: row.source_type,
      source_ref: row.source_ref,
      impact: Number(row.impact ?? 0),
      confidence: Number(row.confidence ?? 0),
      payload: row.payload,
    }));
  const selectedYm = score?.ym ?? null;
  const dialogueConfirmedSignals = filterVitalConfirmedSignals(dialogueConfirmedRes.data ?? [], selectedYm);
  const materialTime = score ? snapshotMaterialTime(score) : null;
  const excludedCurrentSnapshot = hiddenPreMonthSnapshots.find((row) => row.ym === ymCap) ?? null;
  const availableBudgetYms = Array.from(new Set(budgetRows.filter((row) => row.scope === "company").map((row) => row.ym)));
  const financeMonths = availableBudgetYms.length > 0 ? availableBudgetYms.sort() : centeredMonths(selectedYm, availableBudgetYms);
  const budgetCategoryRows = byMonthCategory(budgetRows.filter((row) => row.scope === "company"));
  const budgetInputRows = inputRes.data ?? [];
  const projectForecastMonths = Array.from({ length: 12 }, (_, index) => addMonths(ymCap, index));
  const projectForecastEndYm = projectForecastMonths.at(-1) ?? ymCap;
  const financeStartYm = financeMonths[0] ?? addMonths(ymCap, -12);
  const financeEndYm = [financeMonths.at(-1) ?? addMonths(ymCap, 12), projectForecastEndYm].sort().at(-1) ?? projectForecastEndYm;
  const cycleStartYm = addMonths(financeStartYm, -3);
  const cycleEndYm = addMonths(financeEndYm, 1);
  const [paymentProjectsRes, paymentMembersRes, billingCyclesRes, payoutNoticesRes] = await Promise.all([
    safeSelect<PaymentProjectRow[]>(() =>
      supabase
        .from("projects")
        .select("project_id,project_name,client_name,status,freee_partner_id,payment_due_rule,payment_due_day")
        .limit(500)
    ),
    safeSelect<PaymentMemberRow[]>(() =>
      supabase
        .from("members")
        .select("member_id,code_name,member_name,is_officer")
        .limit(500)
    ),
    safeSelect<BillingCycleActualRow[]>(() =>
      supabase
        .from("billing_cycles")
        .select("id,project_id,ym,status,budget_yen,budget_reported_amount,invoice_ym,invoice_base_lines_json,invoice_issued_at,invoice_sent_at,freee_invoice_number,payment_confirmed_at,payment_confirmed_by,payout_notice_uploaded_at,reward_paid_at,reward_paid_by,reward_summary_json")
        .gte("ym", cycleStartYm)
        .lte("ym", cycleEndYm)
        .limit(1200)
    ),
    safeSelect<PayoutNoticeActualRow[]>(() =>
      supabase
        .from("payout_notices")
        .select("member_id,ym,total_yen,sent_at,pdf_url")
        .gte("ym", financeStartYm)
        .lte("ym", financeEndYm)
        .limit(1200)
    ),
  ]);
  const paymentProjects = paymentProjectsRes.data ?? [];
  const paymentMembers = paymentMembersRes.data ?? [];
  const billingCycles = billingCyclesRes.data ?? [];
  const payoutNotices = payoutNoticesRes.data ?? [];
  const projectMonthlyFinanceRows = buildProjectMonthlyFinanceRows({
    months: projectForecastMonths,
    cycles: billingCycles,
    projects: paymentProjects,
    members: paymentMembers,
  });
  const monthlyActualSummaries = buildMonthlyActualSummaries(
    financeMonths,
    budgetCategoryRows,
    billingCycles,
    paymentProjects,
    payoutNotices
  );
  const gasSimulationResult = buildGasSimulationResult(
    financeMonths,
    budgetCategoryRows,
    budgetRows,
    budgetInputRows,
    monthlyActualSummaries,
    ymCap
  );
  const gasSimulationInputs = buildMonthlyPlInputs(budgetInputRows);
  const expectedReceiptsByYm = buildExpectedReceiptsByPaymentYm(billingCycles, paymentProjects);
  const oneOffInflowGrossByYm = buildOneOffInflowGrossByYm(budgetInputRows);
  const pastActualYm = addMonths(ymCap, -1);
  const outlookMonths = [ymCap, addMonths(ymCap, 1), addMonths(ymCap, 2)];
  const pastActual = monthlyActualSummaries.get(pastActualYm) ?? emptyActualSummary(pastActualYm);
  const currentForecast = rowForYm(gasSimulationResult.rows, ymCap);
  const lowestCashOutlook = outlookMonths.reduce(
    (lowest, ym) => {
      const row = rowForYm(gasSimulationResult.rows, ym);
      if (!row) return lowest;
      return row.cashBalance < lowest.cash ? { ym, cash: row.cashBalance } : lowest;
    },
    { ym: ymCap, cash: Number.POSITIVE_INFINITY }
  );
  const unconfirmedReceiptTotal = outlookMonths.reduce((sum, ym) => sum + (expectedReceiptsByYm.get(ym)?.gross ?? 0), 0);
  const highConfidenceReceiptTotal = outlookMonths.reduce((sum, ym) => sum + (expectedReceiptsByYm.get(ym)?.highConfidenceGross ?? 0), 0);
  const paidCycleCount = billingCycles.filter((cycle) => {
    const project = paymentProjects.find((item) => item.project_id === cycle.project_id);
    return effectivePaymentYmForCycle(cycle, project) === pastActualYm && Boolean(cycle.reward_paid_at);
  }).length;
  const paymentNoticeUploadedMissing = billingCycles.filter((cycle) => {
    const project = paymentProjects.find((item) => item.project_id === cycle.project_id);
    return effectivePaymentYmForCycle(cycle, project) === pastActualYm && cycle.reward_paid_at && !cycle.payout_notice_uploaded_at;
  }).length;
  const financeAlerts = [
    pastActual.confirmedDepositsGross === 0 ? `${pastActualYm} の入金確認がまだ0円。billing/paymentログの取り込み確認が必要。` : null,
    pastActual.payoutNoticeNetTotal > 0 && pastActual.payoutNoticePendingNetTotal > 0
      ? `${pastActualYm} の支払通知書に未送付扱い ${yen(pastActual.payoutNoticePendingNetTotal)} が残っている。`
      : null,
    paidCycleCount === 0 && pastActual.payoutNoticeSentNetTotal > 0
      ? `${pastActualYm} の支払通知書は送付済みだが、billing_cycles.reward_paid_at が未反映。`
      : null,
    paymentNoticeUploadedMissing > 0
      ? `${pastActualYm} の支払済みcycle ${paymentNoticeUploadedMissing}件で payout_notice_uploaded_at が未反映。`
      : null,
    lowestCashOutlook.cash !== Number.POSITIVE_INFINITY && lowestCashOutlook.cash < 1_500_000
      ? `${lowestCashOutlook.ym} 月末Cashが ${yen(lowestCashOutlook.cash)} まで落ちる見込み。入金前倒し/支出抑制の確認が必要。`
      : null,
    unconfirmedReceiptTotal > 0
      ? `先3か月に未入金予定 ${yen(unconfirmedReceiptTotal)}。うち請求送付/発行/予算確定済みは ${yen(highConfidenceReceiptTotal)}。`
      : null,
  ].filter((item): item is string => Boolean(item));
  const persistedManagementSignalReviews = buildPersistedManagementSignalReviews(signalReviewsRes.data ?? []);
  const autoManagementSignalReview = buildAutoManagementSignalReview({
    ymCap,
    pastActualYm,
    outlookMonths,
    rows: gasSimulationResult.rows,
    oneOffInflowGrossByYm,
    financeAlerts,
    varianceNotes: notesRes.data ?? [],
  });
  const managementSignalReviews = [
    autoManagementSignalReview,
    ...persistedManagementSignalReviews.filter((review) => review.ym !== autoManagementSignalReview.ym),
  ];
  const latestRows = aggregateCategoryRows(budgetRows, selectedYm ?? undefined);
  const latestYm = latestRows[0]?.ym ?? null;
  const latestRun = runRes.data?.[0] ?? null;
  const runway = latestRows.find((row) => row.runway_months != null)?.runway_months ?? null;
  const cash = latestRows.find((row) => row.cash_amount_yen != null)?.cash_amount_yen ?? null;
  const revenueBudget = findAmount(latestRows, "revenue", "budget_amount_yen");
  const revenueActual = findAmount(latestRows, "revenue", "actual_amount_yen");
  const netCashBudget = findAmount(latestRows, "net_cash_flow", "budget_amount_yen");
  const netCashActual = findAmount(latestRows, "net_cash_flow", "actual_amount_yen");
  const blockingError =
    scoreRes.error ||
    scoreHistoryRes.error ||
    budgetRes.error ||
    inputRes.error ||
    runRes.error ||
    notesRes.error ||
    evidenceRes.error ||
    paymentProjectsRes.error ||
    paymentMembersRes.error ||
    billingCyclesRes.error ||
    payoutNoticesRes.error;
  const totalDelta = score?.total_score != null && previous?.total_score != null ? Number(score.total_score) - Number(previous.total_score) : null;
  function delta(curr: number | null | undefined, prev: number | null | undefined): number | null {
    if (curr == null || prev == null) return null;
    return Number(curr) - Number(prev);
  }
  function deltaLabel(value: number | null): string {
    if (value == null) return "";
    if (value === 0) return "±0";
    const sign = value > 0 ? "+" : "";
    return `${sign}${Math.round(value)}`;
  }
  function deltaTone(value: number | null): string {
    if (value == null) return "text-muted-foreground";
    if (value > 0) return "text-emerald-600";
    if (value < 0) return "text-red-600";
    return "text-muted-foreground";
  }
  function financeCapLabel(cap: string | null): string | null {
    if (!cap) return null;
    if (cap === "runway_lt_2") return "runway <2ヶ月: total max 45";
    if (cap === "runway_lt_4") return "runway <4ヶ月: total max 60";
    return cap;
  }

  return (
    <div className="min-h-[calc(100vh-2.75rem)] bg-background">
      <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">AMD Management Score</p>
            <h1 className="text-2xl font-semibold tracking-normal">経営状況</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>対象月 {score?.ym ?? latestYm ?? "-"}</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>前月比 <span className={`font-semibold tabular-nums ${deltaTone(totalDelta)}`}>{deltaLabel(totalDelta) || "-"}</span></span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>confidence {score?.confidence != null ? `${Math.round(Number(score.confidence) * 100)}%` : "-"}</span>
            {rawSignalCount != null && (
              <>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>raw {rawSignalCount}件</span>
              </>
            )}
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>材料時点 {materialTime ? materialTime.toLocaleString("ja-JP") : "-"}</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>計算 {latestRun ? new Date(latestRun.ran_at).toLocaleString("ja-JP") : materialTime ? materialTime.toLocaleString("ja-JP") : "-"}</span>
          </div>
        </div>

        {excludedCurrentSnapshot && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
            <span className="font-semibold">当月スコアの鮮度警告:</span>{" "}
            {excludedCurrentSnapshot.ym} の snapshot は月開始前
            {snapshotMaterialTime(excludedCurrentSnapshot) ? ` (${snapshotMaterialTime(excludedCurrentSnapshot)?.toLocaleString("ja-JP")})` : ""}
            に作られているため、最新の経営バイタルとしては除外した。月初後の raw 収集と再計算が必要。
          </div>
        )}

        {snapshotSummary && (
          <section className="rounded-md border bg-card px-4 py-3">
            <div className="text-xs font-semibold text-muted-foreground">今月の結論</div>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">{snapshotSummary}</p>
          </section>
        )}

        {financeCap && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900">
            <span className="font-semibold">finance cap 適用中:</span> {financeCapLabel(financeCap)}
          </div>
        )}

        {nextActions.length > 0 && (
          <section className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="text-xs font-semibold text-primary">次の一手</div>
            <ul className="mt-1.5 space-y-1 text-sm">
              {nextActions.map((action, idx) => (
                <li key={idx} className="leading-snug">・{action}</li>
              ))}
            </ul>
          </section>
        )}

        {blockingError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            finance schema waiting: {blockingError}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-6">
          <Metric
            label="Total"
            value={score ? pct(score.total_score) : "-"}
            delta={deltaLabel(totalDelta)}
            deltaClassName={deltaTone(totalDelta)}
            className={scoreTone(score?.total_score)}
          />
          <Metric
            label="先手力"
            value={score ? pct(score.initiative_score) : "-"}
            delta={deltaLabel(delta(score?.initiative_score, previous?.initiative_score))}
            deltaClassName={deltaTone(delta(score?.initiative_score, previous?.initiative_score))}
            className={scoreTone(score?.initiative_score)}
          />
          <Metric
            label="財務"
            value={score ? pct(score.finance_score) : "-"}
            delta={deltaLabel(delta(score?.finance_score, previous?.finance_score))}
            deltaClassName={deltaTone(delta(score?.finance_score, previous?.finance_score))}
            className={scoreTone(score?.finance_score)}
          />
          <Metric
            label="継続"
            value={score ? pct(score.retention_score) : "-"}
            delta={deltaLabel(delta(score?.retention_score, previous?.retention_score))}
            deltaClassName={deltaTone(delta(score?.retention_score, previous?.retention_score))}
            className={scoreTone(score?.retention_score)}
          />
          <Metric
            label="新規"
            value={score ? pct(score.pipeline_score) : "-"}
            delta={deltaLabel(delta(score?.pipeline_score, previous?.pipeline_score))}
            deltaClassName={deltaTone(delta(score?.pipeline_score, previous?.pipeline_score))}
            className={scoreTone(score?.pipeline_score)}
          />
          <Metric
            label="方向"
            value={score ? pct(score.direction_score) : "-"}
            delta={deltaLabel(delta(score?.direction_score, previous?.direction_score))}
            deltaClassName={deltaTone(delta(score?.direction_score, previous?.direction_score))}
            className={scoreTone(score?.direction_score)}
          />
        </section>

        <AxisMovePanel
          score={score}
          previous={previous}
          axisInputs={recordValue(scoreInputs.axisInputs)}
          evidenceRows={evidenceRows}
          dialogueConfirmedSignals={dialogueConfirmedSignals}
          omegaReasoning={typeof scoreInputs.omega_reasoning === "string" ? scoreInputs.omega_reasoning : null}
        />

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="Runway" value={runway == null ? "-" : `${runway.toFixed(1)}ヶ月`} />
          <Metric label="Cash" value={yen(cash)} />
          <Metric label="売上 予算 / 実績" value={`${yen(revenueBudget)} / ${yen(revenueActual)}`} />
          <Metric label="純CF 予算 / 実績" value={`${yen(netCashBudget)} / ${yen(netCashActual)}`} />
        </section>

        <ProjectMonthlyFinanceTable months={projectForecastMonths} rows={projectMonthlyFinanceRows} />

        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">スコア推移</h2>
          </div>
          <ScoreHistory rows={scoreHistory} />
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {SCORE_COMPONENTS.map((component) => (
            <ScoreComponentTrend
              key={component.key}
              rows={scoreHistory}
              scoreKey={component.key}
              label={component.label}
              colorClass={component.colorClass}
            />
          ))}
        </section>

        <EvidencePanel rows={evidenceRows} dialogueConfirmedSignals={dialogueConfirmedSignals} />

        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">キャッシュ判断</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  実績は freee PL / 入金確認 / 支払通知書、見込みは月次試算と請求サイクルから分けて見る。
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                過去実績 {pastActualYm} / 当月 {ymCap} / 先3か月 {outlookMonths.join(", ")}
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-4">
            <Metric label={`${pastActualYm} 入金確認済`} value={yen(pastActual.confirmedDepositsGross)} />
            <Metric label={`${pastActualYm} 支払通知書送付済`} value={yen(pastActual.payoutNoticeSentNetTotal)} />
            <Metric
              label={`${ymCap} 月次CF見込み`}
              value={yen(currentForecast?.netCashFlow)}
              className={(currentForecast?.netCashFlow ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}
            />
            <Metric
              label="先3か月の最低Cash"
              value={lowestCashOutlook.cash === Number.POSITIVE_INFINITY ? "-" : `${lowestCashOutlook.ym} ${yen(lowestCashOutlook.cash)}`}
              className={lowestCashOutlook.cash < 1_500_000 ? "text-red-600" : ""}
            />
          </div>

          <div className="border-t px-4 py-3">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 text-left font-medium">月</th>
                    <th className="py-2 px-3 text-right font-medium">試算上の入金</th>
                    <th className="py-2 px-3 text-right font-medium">未入金予定</th>
                    <th className="py-2 px-3 text-right font-medium">支出予定</th>
                    <th className="py-2 px-3 text-right font-medium">月次CF</th>
                    <th className="py-2 px-3 text-right font-medium">一括入金除きCF</th>
                    <th className="py-2 pl-3 text-right font-medium">月末Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {outlookMonths.map((ym) => {
                    const row = rowForYm(gasSimulationResult.rows, ym);
                    const expected = expectedReceiptsByYm.get(ym);
                    const oneOff = oneOffInflowGrossByYm.get(ym) ?? 0;
                    const normalCf = row ? row.netCashFlow - oneOff : 0;
                    const receiptDetail = compactReceiptItems(expected?.items ?? []);
                    return (
                      <tr key={ym} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 font-medium tabular-nums">{ym}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          <div>{yen(row?.cashInflow)}</div>
                          <div className="text-[11px] text-muted-foreground">予定</div>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          <div>{yen(expected?.gross ?? 0)}</div>
                          <div className="mt-0.5 max-w-[300px] truncate text-left text-[11px] text-muted-foreground" title={receiptDetail}>
                            {receiptDetail}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          <div>{yen(row?.cashOutflow)}</div>
                          <div className="text-[11px] text-muted-foreground">予定</div>
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums ${(row?.netCashFlow ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {yen(row?.netCashFlow)}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums ${normalCf < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {yen(normalCf)}
                          {oneOff > 0 && <div className="text-[11px] text-muted-foreground">一括入金 {yen(oneOff)} 除き</div>}
                        </td>
                        <td className={`py-2 pl-3 text-right tabular-nums ${(row?.cashBalance ?? 0) < 1_500_000 ? "text-red-600" : ""}`}>
                          {yen(row?.cashBalance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 border-t px-4 py-3 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="rounded-md border bg-background px-3 py-3">
              <div className="text-xs font-semibold">5月実績の読み分け</div>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">freee PL 売上</dt>
                <dd className="font-medium tabular-nums">{yen(pastActual.actualRevenue)}</dd>
                <dt className="text-muted-foreground">入金確認済み</dt>
                <dd className="font-medium tabular-nums">{yen(pastActual.confirmedDepositsGross)}</dd>
                <dt className="text-muted-foreground">支払通知書 送付済み(税抜)</dt>
                <dd className="font-medium tabular-nums">{yen(pastActual.payoutNoticeSentNetTotal)}</dd>
                <dt className="text-muted-foreground">実績差引</dt>
                <dd className={`font-medium tabular-nums ${pastActual.actualNetCashFlow < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {yen(pastActual.actualNetCashFlow)}
                </dd>
              </dl>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">実績: payment_confirmed_at / sent_at</span>
                <span className="rounded-full border bg-sky-50 px-2 py-1 text-[11px] text-sky-700">予定: budget simulation</span>
                <span className="rounded-full border bg-amber-50 px-2 py-1 text-[11px] text-amber-700">未確認: 未送付・未入金cycle</span>
              </div>
            </div>

            <div className="rounded-md border bg-background px-3 py-3">
              <div className="text-xs font-semibold text-muted-foreground">意思決定アラート</div>
              {financeAlerts.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">直近3か月に重大アラートなし。</p>
              ) : (
                <ul className="mt-1.5 space-y-1 text-sm">
                  {financeAlerts.map((alert, index) => (
                    <li key={index} className="leading-relaxed">・{alert}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <GasMonthlySimulationPanel result={gasSimulationResult} inputs={gasSimulationInputs} />

        <ManagementSignalReviewPanel reviews={managementSignalReviews} />

        <section className="grid gap-4 xl:grid-cols-[1fr_0.42fr]">
          <div className="rounded-md border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">差分メモ</h2>
            </div>
            <div className="divide-y">
              {(notesRes.data ?? []).length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">データ待ち</div>
              )}
              {(notesRes.data ?? []).map((note) => (
                <div key={note.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{note.ym} / {note.category ? categoryLabel(note.category) : note.variance_kind}</span>
                    <span>{note.status}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{note.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProjectMonthlyFinanceTable({ months, rows }: { months: string[]; rows: ProjectMonthlyFinanceRow[] }) {
  const monthTotals = months.map((ym) => {
    const cells = rows.map((row) => row.cells.find((cell) => cell.ym === ym)).filter((cell): cell is ProjectMonthlyFinanceCell => Boolean(cell));
    return {
      ym,
      budgetYen: cells.reduce((sum, cell) => sum + cell.budgetYen, 0),
      payoutYen: cells.reduce((sum, cell) => sum + cell.payoutYen, 0),
      stockYen: cells.reduce((sum, cell) => sum + cell.stockYen, 0),
      finalBalanceYen: cells.reduce((sum, cell) => sum + cell.finalBalanceYen, 0),
    };
  });
  const grand = monthTotals.reduce(
    (acc, item) => ({
      budgetYen: acc.budgetYen + item.budgetYen,
      payoutYen: acc.payoutYen + item.payoutYen,
      stockYen: acc.stockYen + item.stockYen,
      finalBalanceYen: acc.finalBalanceYen + item.finalBalanceYen,
    }),
    { budgetYen: 0, payoutYen: 0, stockYen: 0, finalBalanceYen: 0 }
  );

  return (
    <section className="rounded-md border bg-card">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">PJ別 先12か月収支</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              billing_cycles のPJ予算と reward_summary_json の支払予定から、毎月のPJ収支を先読みする。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border bg-background px-2 py-1">PJ予算 {yen(grand.budgetYen)}</span>
            <span className="rounded-full border bg-background px-2 py-1">支払予定 {yen(grand.payoutYen)}</span>
            {grand.stockYen > 0 && <span className="rounded-full border bg-amber-50 px-2 py-1 text-amber-700">stock {yen(grand.stockYen)}</span>}
            <span className={`rounded-full border px-2 py-1 font-semibold ${grand.finalBalanceYen < 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
              収支 {yen(grand.finalBalanceYen)}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky left-0 z-20 w-44 border-b border-r bg-muted px-3 py-2 text-left font-medium">PJ</th>
              <th className="w-28 border-b border-r px-3 py-2 text-right font-medium">12か月収支</th>
              {months.map((month) => (
                <th key={month} className="min-w-[132px] border-b border-r px-3 py-2 text-right font-medium">{month}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={months.length + 2} className="px-3 py-8 text-center text-muted-foreground">PJ収支データ待ち</td>
              </tr>
            ) : (
              <>
                <tr className="bg-muted/20">
                  <th className="sticky left-0 z-10 border-b border-r bg-muted px-3 py-2 text-left font-semibold">全PJ合計</th>
                  <td className={`border-b border-r px-3 py-2 text-right font-semibold tabular-nums ${grand.finalBalanceYen < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {yen(grand.finalBalanceYen)}
                  </td>
                  {monthTotals.map((total) => (
                    <td key={total.ym} className="border-b border-r px-3 py-2 text-right align-top">
                      <div className={`font-semibold tabular-nums ${total.finalBalanceYen < 0 ? "text-red-700" : "text-emerald-700"}`}>{yen(total.finalBalanceYen)}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">予算 {yen(total.budgetYen)}</div>
                      <div className="text-[11px] text-muted-foreground">支払 {yen(total.payoutYen)}</div>
                      {total.stockYen > 0 && <div className="text-[11px] text-amber-700">stock {yen(total.stockYen)}</div>}
                    </td>
                  ))}
                </tr>
                {rows.map((row) => (
                  <tr key={row.projectId} className="hover:bg-muted/15">
                    <th className="sticky left-0 z-10 border-b border-r bg-card px-3 py-2 text-left align-top font-medium">
                      <div className="truncate">{row.projectName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{row.projectId}</div>
                    </th>
                    <td className={`border-b border-r px-3 py-2 text-right align-top font-semibold tabular-nums ${row.totals.finalBalanceYen < 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {yen(row.totals.finalBalanceYen)}
                      <div className="mt-0.5 text-[11px] font-normal text-muted-foreground">支払 {yen(row.totals.payoutYen)}</div>
                    </td>
                    {row.cells.map((cell) => {
                      const hasData = cell.budgetYen > 0 || cell.payoutYen > 0 || cell.stockYen > 0;
                      return (
                        <td key={`${row.projectId}:${cell.ym}`} className="border-b border-r px-3 py-2 text-right align-top">
                          {hasData ? (
                            <>
                              <div className={`font-semibold tabular-nums ${cell.finalBalanceYen < 0 ? "text-red-700" : "text-emerald-700"}`}>{yen(cell.finalBalanceYen)}</div>
                              <div className="text-[11px] text-muted-foreground">予算 {yen(cell.budgetYen)}</div>
                              <div className="text-[11px] text-muted-foreground">支払 {yen(cell.payoutYen)}</div>
                              {cell.stockYen > 0 && <div className="text-[11px] text-amber-700">stock {yen(cell.stockYen)}</div>}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ManagementSignalReviewPanel({ reviews }: { reviews: ManagementSignalReview[] }) {
  const statusIcon = (review: ManagementSignalReview) => {
    const className = "h-5 w-5";
    if (review.statusIcon === "good") return <CheckCircle2 className={className} />;
    if (review.statusIcon === "danger") return <ShieldAlert className={className} />;
    if (review.statusIcon === "watch") return <AlertTriangle className={className} />;
    return <CircleGauge className={className} />;
  };

  return (
    <section className="rounded-md border bg-card">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">経営シグナル評価</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              数字の再掲ではなく、今の会社状態をひとことで評価し、次にどこを見るかを月末Codex評価で残す。
            </p>
          </div>
          <span className="rounded-full border bg-background px-2 py-1 text-[11px] text-muted-foreground">
            最新は展開 / 過去分は折りたたみ
          </span>
        </div>
      </div>
      <div className="divide-y">
        {reviews.map((review, index) => {
          const isLatest = index === 0;
          return (
            <details key={review.id} open={isLatest} className="group">
              <summary className="cursor-pointer list-none px-4 py-3 hover:bg-muted/30">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${reviewStatusClass(review.statusTone)}`}>
                    {statusIcon(review)}
                    {review.statusLabel}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{review.ym}</span>
                  <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{review.sourceLabel}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground group-open:hidden">開く</span>
                  <span className="ml-auto hidden text-[11px] text-muted-foreground group-open:inline">閉じる</span>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-[0.8fr_1.2fr]">
                  <p className="text-lg font-semibold leading-snug tracking-normal text-foreground">{review.headline}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{review.summary}</p>
                </div>
              </summary>
              <div className="px-4 pb-4">
                <div className="grid gap-3 lg:grid-cols-2">
                  {review.sections.map((section) => (
                    <div key={section.title} className={`rounded-md border px-3 py-3 ${reviewToneClass(section.tone)}`}>
                      <div className="text-sm font-semibold">{section.title}</div>
                      <p className="mt-1 text-sm leading-relaxed">{section.body}</p>
                      {section.items.length > 0 ? (
                        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                          {section.items.map((item, itemIndex) => (
                            <li key={itemIndex}>・{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">月末レビュー待ち</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>作成日 {review.reviewedAt ? new Date(review.reviewedAt).toLocaleString("ja-JP") : "月末生成待ち"}</span>
                  {review.codexThreadId && <span>Codex thread {review.codexThreadId}</span>}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  delta,
  deltaClassName = "",
  className = "",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaClassName?: string;
  className?: string;
}) {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {delta && (
          <div className={`text-[11px] font-semibold tabular-nums ${deltaClassName}`}>{delta}</div>
        )}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums tracking-normal ${className}`}>{value}</div>
    </div>
  );
}

function AxisMovePanel({
  score,
  previous,
  axisInputs,
  evidenceRows,
  dialogueConfirmedSignals,
  omegaReasoning,
}: {
  score: ScoreSnapshotFull | null;
  previous: ScoreSnapshot | null;
  axisInputs: Record<string, unknown>;
  evidenceRows: EvidenceRow[];
  dialogueConfirmedSignals: DialogueConfirmedSignal[];
  omegaReasoning: string | null;
}) {
  if (!score) return null;

  return (
    <section className="rounded-md border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">各軸の変動理由</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          前月から何点動いたか、その月の計算入力、効いた根拠を軸ごとに読む場所。急に落ちた軸はここを開けば、 raw signal と evidence のどちらを確認すべきか分かる。
        </p>
      </div>

      <div className="divide-y">
        {SCORE_COMPONENTS.map((component) => {
          const axis = component.axis;
          const scoreKey = AXIS_FIELD[axis];
          const currentScore = score[scoreKey];
          const previousScore = previous?.[scoreKey] ?? null;
          const axisDelta = deltaNumber(currentScore, previousScore);
          const inputs = recordValue(axisInputs[axis]);
          const axisEvidence = evidenceRows
            .filter((row) => row.axis === axis)
            .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
          const axisSignals = dialogueConfirmedSignals.filter((signal) => {
            if (axis === "pipeline") return signal.signal_type === "commercial_progress";
            if (axis === "direction") return ["funding", "partner_growth", "graduation", "next_move"].includes(signal.signal_type);
            return false;
          });
          const summary =
            typeof inputs.summary === "string"
              ? inputs.summary
              : axisEvidence.find((row) => row.evidence_kind === "axis_summary")?.summary ?? "この軸のsummary evidence待ち。";
          const facts = axisInputFacts(axis, inputs).filter((fact) => !fact.includes("undefined") && !fact.includes("NaN"));
          const open = axis === "pipeline" || (axisDelta != null && axisDelta <= -8);

          return (
            <details key={axis} className="group" open={open}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <span className="min-w-16 text-sm font-semibold">{component.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${scoreTone(currentScore)}`}>{pct(currentScore)}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${axisDeltaTone(axisDelta)}`}>
                  {deltaLabelText(axisDelta)}
                </span>
                <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground break-words">{summary}</span>
                <span className="text-[11px] text-muted-foreground group-open:hidden">開く</span>
                <span className="hidden text-[11px] text-muted-foreground group-open:inline">閉じる</span>
              </summary>

              <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-md border bg-background px-3 py-3">
                  <div className="text-xs font-semibold">計算入力</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {facts.map((fact) => (
                      <span key={fact} className="rounded-full border bg-card px-2 py-1 text-[11px] text-muted-foreground">
                        {fact}
                      </span>
                    ))}
                    {axis === "pipeline" && omegaReasoning && (
                      <span className="rounded-full border bg-violet-50 px-2 py-1 text-[11px] text-violet-700">
                        新規重み: {omegaReasoning}
                      </span>
                    )}
                    {axisSignals.length > 0 && (
                      <span className="rounded-full border bg-primary/5 px-2 py-1 text-[11px] text-primary">
                        まさえいMTG確定 {axisSignals.length}件
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {axis === "pipeline"
                      ? "新規は商談・紹介・提案の前進が少ない月ほど下がる。commercial_progress が減る、または proposed/observed 止まりだと pipeline_value が伸びない。"
                      : axis === "direction"
                        ? "方向はAMDの勝ち筋に近づいた材料を見る。funding、研究機関連携、OS導入、マネタイズ、属人脱却、成功卒業が主入力。"
                        : "この軸は下のevidenceを見れば、加点・減点に効いた具体的な出来事へ辿れる。"}
                  </p>
                </div>

                <div className="rounded-md border bg-background px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold">効いた根拠</div>
                    <div className="text-[11px] text-muted-foreground">{axisEvidence.length}件</div>
                  </div>
                  {axisEvidence.length === 0 ? (
                    <div className="mt-2 rounded border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                      evidence待ち。 raw signal はあるが説明カードが生成されていない可能性がある。
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {axisEvidence.slice(0, 4).map((row) => (
                        <div key={row.id} className="rounded border bg-card px-2.5 py-2">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-medium text-muted-foreground">{row.evidence_kind}</span>
                            <span className={`font-semibold tabular-nums ${row.impact >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {row.impact >= 0 ? "+" : ""}{row.impact.toFixed(1)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed break-words">{row.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function deltaNumber(curr: number | string | null | undefined, prev: number | string | null | undefined): number | null {
  if (curr == null || prev == null) return null;
  const c = Number(curr);
  const p = Number(prev);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  return c - p;
}

function deltaLabelText(value: number | null): string {
  if (value == null) return "前月なし";
  if (Math.abs(value) < 0.5) return "±0";
  return `${value > 0 ? "+" : ""}${Math.round(value)}`;
}

function axisDeltaTone(value: number | null): string {
  if (value == null) return "border-border text-muted-foreground bg-background";
  if (value > 0) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value < 0) return "border-red-200 bg-red-50 text-red-700";
  return "border-border text-muted-foreground bg-background";
}

function linePoints(values: Array<number | null>, width: number, height: number, minValue: number, maxValue: number): string {
  const range = Math.max(1, maxValue - minValue);
  return values
    .map((value, index) => {
      if (value == null || Number.isNaN(value)) return null;
      const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function ScoreComponentTrend({
  rows,
  scoreKey,
  label,
  colorClass,
}: {
  rows: ScoreSnapshot[];
  scoreKey: keyof Pick<ScoreSnapshot, "initiative_score" | "finance_score" | "retention_score" | "pipeline_score" | "direction_score">;
  label: string;
  colorClass: string;
}) {
  const latest = rows.at(-1)?.[scoreKey] ?? null;
  const points = linePoints(rows.map((row) => row[scoreKey]), 180, 64, 0, 100);
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs text-muted-foreground">{label} 推移</div>
        <div className={`text-sm font-semibold tabular-nums ${colorClass}`}>{pct(latest)}</div>
      </div>
      <svg className={`mt-3 h-16 w-full overflow-visible ${colorClass}`} viewBox="0 0 180 64" role="img" aria-label={`${label}の推移`}>
        <line x1="0" x2="180" y1="48" y2="48" className="stroke-border" strokeWidth="1" />
        <line x1="0" x2="180" y1="16" y2="16" className="stroke-border/60" strokeWidth="1" />
        {points && (
          <polyline
            points={points}
            fill="none"
            className="stroke-current"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{rows[0]?.ym ? shortYm(rows[0].ym) : "-"}</span>
        <span>{rows.at(-1)?.ym ? shortYm(rows.at(-1)?.ym ?? "") : "-"}</span>
      </div>
    </div>
  );
}

function ScoreHistory({ rows }: { rows: ScoreSnapshot[] }) {
  if (rows.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-muted-foreground">データ待ち</div>;
  }
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px] px-4 py-4">
        <div className="flex items-end gap-2 border-b pb-3">
          {rows.map((row) => {
            const score = row.total_score ?? 0;
            return (
              <div key={row.ym} className="flex min-w-16 flex-1 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end rounded-sm bg-muted/40 px-2">
                  <div
                    className="w-full rounded-sm bg-primary/75"
                    style={{ height: `${Math.max(4, Math.min(100, score))}%` }}
                    title={`${row.ym}: ${pct(row.total_score)}`}
                  />
                </div>
                <div className="text-xs font-medium tabular-nums">{pct(row.total_score)}</div>
                <div className="text-[11px] text-muted-foreground">{row.ym}</div>
              </div>
            );
          })}
        </div>
        <table className="mt-3 w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">月</th>
              <th className="py-1 text-right font-medium">Total</th>
              <th className="py-1 text-right font-medium">先手</th>
              <th className="py-1 text-right font-medium">財務</th>
              <th className="py-1 text-right font-medium">継続</th>
              <th className="py-1 text-right font-medium">新規</th>
              <th className="py-1 text-right font-medium">方向</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice().reverse().map((row) => (
              <tr key={row.ym} className="border-t">
                <td className="py-1">{row.ym}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.total_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.initiative_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.finance_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.retention_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.pipeline_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.direction_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
