import { contractBackedClientAmount, isYm } from "./contract-money.ts";
import { memberPayoutYmForCycle } from "./payment-groups.ts";
import { expandExtraRevenue, type ExtraRevenueSourceRow } from "./finance/extra-revenue.ts";
import { buildSeasonAllocation, type SeasonAllocation } from "./payout-season-allocation.ts";
import { isNonCashAllocationMember } from "./reward-finance-summary.ts";

export type SeasonProject = {
  project_id: string; project_name: string; status: string | null;
  fee_type?: string | null; fee_amount?: number | string | null;
  start_ym?: string | null; end_ym?: string | null; contract_terms_json?: unknown;
  payment_due_rule: string | null; payment_due_day: number | null;
  invoice_send_deadline_rule?: string | null;
};
export type SeasonPlan = {
  project_id: string; plan_cycle_id: string; status: string | null;
  period_start_ym: string; period_end_ym: string;
  budget_yen?: number | string | null;
};
export type SeasonBilling = {
  project_id: string; ym: string; invoice_ym: string | null; status: string | null;
  budget_reported_amount?: number | string | null; reward_summary_json: unknown;
  invoice_issued_at?: string | null; invoice_sent_at?: string | null;
  payment_confirmed_at?: string | null;
  extra_budget_yen?: number | string | null;
  budget_yen?: number | string | null;
};
export type SeasonMember = { member_id: string; code_name?: string | null; member_name?: string | null; is_officer?: boolean | null; exclude_from_payout_notice?: boolean | null };
export type SeasonExpense = { projectId: string | null; ym: string; amountYen: number | null; kind: "reimbursement" | "other" };
export const SEASON_METRICS = [
  ["income", "売上 · 本契約", "flow"],
  ["extraIncome", "売上 · 別契約", "flow"],
  ["regularAccrued", "発生報酬 · 本契約", "flow"],
  ["extraAccrued", "発生報酬 · 別財布", "flow"],
  ["reimbursement", "立替経費 · 実費", "flow"],
  ["other", "登録済み追加支出", "flow"],
  ["net", "差引収支", "flow"],
  ["cumulative", "累計収支", "balance"],
  ["debt", "稼働月末の未払報酬", "balance"],
] as const;
export type SeasonMetric = typeof SEASON_METRICS[number][0];
export type SeasonCell = Record<SeasonMetric, number | null>;
export type SeasonPaymentCell = Pick<SeasonCell, "regularAccrued" | "extraAccrued"> & { sourceYms?: string[] };
export type SeasonMemberPayment = {
  memberId: string; memberName: string;
  cells: Record<string, SeasonPaymentCell>; totals: SeasonPaymentCell;
};
export type SeasonProjectPlan = {
  projectId: string; projectName: string; status: string | null;
  planId: string | null; planStatus: string | null;
  startYm: string | null; endYm: string | null;
  cells: Record<string, SeasonCell>; totals: SeasonCell;
  memberPayments: SeasonMemberPayment[];
  missingMonths: string[]; notes: string[];
  allocation: SeasonAllocation | null;
};
export type PayoutSeasonPlan = {
  paymentYm: string; months: string[]; projects: SeasonProjectPlan[];
  totalCells: Record<string, SeasonCell>; totals: SeasonCell;
};

export function shiftSeasonMonth(ym: string, delta: number): string {
  const date = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function seasonMonths(start: string, end: string): string[] {
  const result: string[] = [];
  for (let month = start; month <= end; month = shiftSeasonMonth(month, 1)) {
    if (result.length >= 120) throw new Error("シーズン期間が120か月を超えています");
    result.push(month);
  }
  return result;
}
function blank(): SeasonCell {
  return { income: 0, extraIncome: 0, regularAccrued: 0, extraAccrued: 0, reimbursement: 0, other: 0, net: 0, cumulative: 0, debt: 0 };
}
function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function amount(value: unknown): number { return Math.round(Number(value ?? 0) || 0); }
function knownAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
function sum(values: Array<number | null>): number | null {
  return values.some((value) => value == null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}
function add(cell: SeasonCell, metric: SeasonMetric, value: number | null) {
  cell[metric] = cell[metric] == null || value == null ? null : cell[metric] + value;
}
export function choosePayoutSeason(plans: SeasonPlan[], project: SeasonProject, paymentYm: string): SeasonPlan | null {
  const candidates = plans.filter((plan) => plan.project_id === project.project_id && isYm(plan.period_start_ym) && isYm(plan.period_end_ym) && plan.period_start_ym <= plan.period_end_ym && ["active", "confirmed", "fixed", "draft"].includes(plan.status ?? ""));
  const payoutMonth = (sourceYm: string) => memberPayoutYmForCycle({ ym: sourceYm, invoice_ym: null }, project);
  const matching = candidates.filter((plan) => payoutMonth(plan.period_start_ym) <= paymentYm && payoutMonth(plan.period_end_ym) >= paymentYm);
  const overlapping = candidates.filter((plan) => plan.period_start_ym <= paymentYm && plan.period_end_ym >= paymentYm);
  return [...(matching.length ? matching : overlapping)]
    .sort((a, b) => Number(a.status === "draft") - Number(b.status === "draft") || b.period_start_ym.localeCompare(a.period_start_ym) || a.plan_cycle_id.localeCompare(b.plan_cycle_id))[0] ?? null;
}

/** Read-only work-month projection. Payment and receipt dates do not move monthly revenue or costs. */
export function buildPayoutSeasonPlan(input: {
  paymentYm: string; projects: SeasonProject[]; plans: SeasonPlan[];
  cycles: SeasonBilling[]; members: SeasonMember[];
  extraRevenueRows: ExtraRevenueSourceRow[]; expenses?: SeasonExpense[];
}): PayoutSeasonPlan {
  const { paymentYm } = input;
  const members = new Map(input.members.map((member) => [member.member_id, member]));
  const cycleMap = new Map(input.cycles.map((cycle) => [`${cycle.project_id}:${cycle.ym}`, cycle]));
  const selected = input.projects.map((project) => ({ project, plan: choosePayoutSeason(input.plans, project, paymentYm) }))
    .filter(({ project, plan }) => project.status !== "ended" || (plan != null && plan.period_start_ym <= paymentYm && memberPayoutYmForCycle({ ym: plan.period_end_ym, invoice_ym: null }, project) >= paymentYm));
  const projects: SeasonProjectPlan[] = selected.map(({ project, plan }) => {
    const row: SeasonProjectPlan = {
      projectId: project.project_id, projectName: project.project_name, status: project.status,
      planId: plan?.plan_cycle_id ?? null, planStatus: plan?.status ?? null,
      startYm: plan?.period_start_ym ?? null, endYm: plan?.period_end_ym ?? null,
      cells: {}, totals: blank(), memberPayments: [], missingMonths: [], notes: [], allocation: null,
    };
    if (!plan) { row.notes.push("シーズン未設定"); return row; }
    row.allocation = buildSeasonAllocation(plan, input.cycles, input.members, seasonMonths(plan.period_start_ym, plan.period_end_ym));
    if (plan.status === "draft") row.notes.push("シーズンは検討中");
    if (plan.period_end_ym < paymentYm) row.notes.push("直近の終了シーズン");
    const cell = (ym: string) => row.cells[ym] ??= blank();
    const memberPayments = new Map<string, SeasonMemberPayment>();
    const missingRewardMonths = new Set<string>();
    for (const ym of seasonMonths(plan.period_start_ym, plan.period_end_ym)) {
      const cycle = cycleMap.get(`${project.project_id}:${ym}`);
      const source = cycle ?? { project_id: project.project_id, ym, invoice_ym: null, status: null, reward_summary_json: null };
      const income = contractBackedClientAmount({ ym, project, reportedAmount: cycle?.budget_reported_amount, cycleStatus: cycle?.status, hasInvoiceEvidence: Boolean(cycle?.invoice_issued_at) });
      add(cell(ym), "income", income);
      const summary = record(cycle?.reward_summary_json);
      if (!Array.isArray(summary?.members)) {
        row.missingMonths.push(ym);
        missingRewardMonths.add(ym);
        cell(ym).regularAccrued = null;
        cell(ym).extraAccrued = null;
        cell(ym).debt = null;
        continue;
      }
      for (const raw of summary.members) {
        const member = record(raw);
        if (!member) continue;
        const id = String(member.memberId ?? member.member_id ?? "");
        const profile = members.get(id);
        if (profile?.exclude_from_payout_notice || isNonCashAllocationMember(member)) continue;
        const memberId = id || "unidentified";
        let payment = memberPayments.get(memberId);
        if (!payment) {
          payment = {
            memberId,
            memberName: profile ? profile.code_name?.trim() || profile.member_name?.trim() || id : `${id || "メンバー"}（対象者未確認）`,
            cells: {}, totals: { regularAccrued: 0, extraAccrued: 0 },
          };
          memberPayments.set(memberId, payment);
        }
        const memberCell = payment.cells[ym] ??= { regularAccrued: 0, extraAccrued: 0 };
        memberCell.sourceYms = [...new Set([...(memberCell.sourceYms ?? []), ym])];
        const totalBase = knownAmount(member.basePay ?? member.base_pay);
        const extraBase = knownAmount(member.extraBasePay ?? member.extra_base_pay ?? 0);
        const regularBase = knownAmount(member.regularBasePay ?? member.regular_base_pay ?? (totalBase == null || extraBase == null ? null : totalBase - extraBase));
        if (!profile || regularBase == null || extraBase == null || (totalBase != null && regularBase + extraBase !== totalBase)) {
          cell(ym).regularAccrued = null; cell(ym).extraAccrued = null; cell(ym).debt = null;
          memberCell.regularAccrued = null; memberCell.extraAccrued = null;
          const note = !profile ? "報酬の対象者を確認" : "発生報酬・原資内訳を確認";
          if (!row.notes.includes(note)) row.notes.push(note);
          continue;
        }
        add(cell(ym), "regularAccrued", regularBase);
        add(cell(ym), "extraAccrued", extraBase);
        memberCell.regularAccrued = sum([memberCell.regularAccrued, regularBase]);
        memberCell.extraAccrued = sum([memberCell.extraAccrued, extraBase]);
        add(cell(ym), "debt", amount(member.stockYen ?? member.stock_yen ?? member.deferredYen ?? member.deferred_yen));
      }
    }
    row.memberPayments = [...memberPayments.values()];
    for (const payment of row.memberPayments) {
      for (const month of missingRewardMonths) payment.cells[month] = { regularAccrued: null, extraAccrued: null };
    }
    const extraRows = input.extraRevenueRows.filter((source) => source.project_id === project.project_id).map((source) => ({ ...source, extra_revenue_json: (source.extra_revenue_json ?? []).filter((entry) => {
      const start = entry.period_start_ym ?? String(source.ym);
      const end = entry.period_end_ym ?? start;
      return start <= plan.period_end_ym && end >= plan.period_start_ym;
    }) }));
    for (const extra of expandExtraRevenue(extraRows, { minYm: Number(plan.period_start_ym), maxYm: Number(plan.period_end_ym) })) add(cell(String(extra.ym)), "extraIncome", extra.amount);
    for (const expense of input.expenses ?? []) {
      if (expense.projectId !== project.project_id) continue;
      if (expense.ym < plan.period_start_ym || expense.ym > plan.period_end_ym) continue;
      add(cell(expense.ym), expense.kind === "other" ? "other" : "reimbursement", expense.amountYen);
    }
    return row;
  }).sort((a, b) => {
    const currentAccrued = (row: SeasonProjectPlan) => (row.cells[paymentYm]?.regularAccrued ?? 0) + (row.cells[paymentYm]?.extraAccrued ?? 0);
    const income = (row: SeasonProjectPlan) => Object.values(row.cells).reduce((total, cell) => total + (cell.income ?? 0) + (cell.extraIncome ?? 0), 0);
    return Number(!a.planId) - Number(!b.planId) || currentAccrued(b) - currentAccrued(a) || income(b) - income(a) || a.projectName.localeCompare(b.projectName, "ja");
  });
  const bounds = projects.flatMap((project) => Object.keys(project.cells));
  const months = seasonMonths([paymentYm, ...bounds].sort()[0], [paymentYm, ...bounds].sort().at(-1)!);
  for (const row of projects) {
    if (!row.planId) continue;
    let cumulative: number | null = 0;
    for (const month of months) {
      const cell = row.cells[month] ??= blank();
      const out = sum([cell.regularAccrued, cell.extraAccrued, cell.reimbursement, cell.other]);
      cell.net = out == null ? null : cell.income! + cell.extraIncome! - out;
      cumulative = sum([cumulative, cell.net]);
      cell.cumulative = cumulative;
    }
    for (const [metric, , kind] of SEASON_METRICS) {
      row.totals[metric] = kind === "flow" ? sum(months.map((month) => row.cells[month][metric]))
        : metric === "debt" ? row.cells[row.endYm!]?.debt ?? null : cumulative;
    }
    for (const payment of row.memberPayments) {
      for (const month of months) payment.cells[month] ??= { regularAccrued: 0, extraAccrued: 0 };
      payment.totals = {
        regularAccrued: sum(months.map((month) => payment.cells[month].regularAccrued)),
        extraAccrued: sum(months.map((month) => payment.cells[month].extraAccrued)),
      };
    }
    const paymentAmount = (cell: SeasonPaymentCell) => (cell.regularAccrued ?? 0) + (cell.extraAccrued ?? 0);
    row.memberPayments.sort((a, b) => paymentAmount(b.cells[paymentYm]) - paymentAmount(a.cells[paymentYm]) || paymentAmount(b.totals) - paymentAmount(a.totals) || a.memberName.localeCompare(b.memberName, "ja") || a.memberId.localeCompare(b.memberId));
  }
  const totalCells = Object.fromEntries(months.map((month) => [month, Object.fromEntries(SEASON_METRICS.map(([metric]) => [metric, sum(projects.filter((row) => row.planId).map((row) => row.cells[month][metric]))])) as SeasonCell]));
  const totals = Object.fromEntries(SEASON_METRICS.map(([metric]) => [metric, sum(projects.filter((row) => row.planId).map((row) => row.totals[metric]))])) as SeasonCell;
  return { paymentYm, months, projects, totalCells, totals };
}
