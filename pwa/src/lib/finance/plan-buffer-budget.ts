import { isWithinContractPeriod, type ContractPeriodLike } from "@/lib/contract-money";
import { parseSeasonBufferTotal } from "@/lib/finance/season-finance";

export type PlanBufferedBudgetLike = {
  budget_yen?: number | string | null;
  period_start_ym?: string | null;
  period_end_ym?: string | null;
  buffer_breakdown_json?: unknown;
};

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function ymToMonths(ym: string): number {
  return parseInt(ym.slice(0, 4), 10) * 12 + parseInt(ym.slice(4, 6), 10);
}

function monthsToYm(months: number): string {
  const zeroBased = months - 1;
  const year = Math.floor(zeroBased / 12);
  const month = (zeroBased % 12) + 1;
  return `${year}${String(month).padStart(2, "0")}`;
}

function ymRange(startYm: string, endYm: string): string[] {
  if (!/^\d{6}$/.test(startYm) || !/^\d{6}$/.test(endYm) || startYm > endYm) return [];
  const start = ymToMonths(startYm);
  const end = ymToMonths(endYm);
  const months: string[] = [];
  for (let i = start; i <= end; i += 1) months.push(monthsToYm(i));
  return months;
}

export function planBufferedMonthlyBudgetYen({
  plan,
  project,
  ym,
}: {
  plan: PlanBufferedBudgetLike | null | undefined;
  project: ContractPeriodLike | null | undefined;
  ym: string;
}): number | null {
  const totalBudget = Math.max(0, numberValue(plan?.budget_yen));
  if (totalBudget <= 0 || !/^\d{6}$/.test(ym)) return null;
  if (!parseSeasonBufferTotal(plan?.buffer_breakdown_json)) return null;
  const startYm = plan?.period_start_ym ?? null;
  const endYm = plan?.period_end_ym ?? null;
  if (!startYm || !endYm) return null;
  const billableMonths = ymRange(startYm, endYm).filter((month) => isWithinContractPeriod(project, month));
  const index = billableMonths.indexOf(ym);
  if (index < 0 || billableMonths.length === 0) return null;
  const per = Math.floor(totalBudget / billableMonths.length);
  return index === billableMonths.length - 1 ? totalBudget - per * (billableMonths.length - 1) : per;
}
