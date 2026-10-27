import { isNonCashAllocationMember } from "./reward-finance-summary.ts";
import type { SeasonBilling, SeasonMember, SeasonPlan } from "./payout-season-plan.ts";
import { buildSeasonAllocationEvidence, type SeasonAllocationEvidence } from "./payout-season-evidence.ts";

export type PayoutSnapshot = { project_id: string; ym: string; member_id: string; total_pay: number | string | null };
export type SeasonAllocationMember = {
  memberId: string; memberName: string; cashYen: number; internalYen: number; closingUnfundedYen: number; totalYen: number;
};
export type SeasonAllocation = {
  regularBudgetYen: number | null; extraBudgetYen: number | null; budgetYen: number | null;
  cashYen: number | null; internalYen: number | null; closingUnfundedYen: number | null;
  committedYen: number | null; remainingYen: number | null;
  status: "within_budget" | "deficit" | "unknown";
  members: SeasonAllocationMember[]; issues: string[];
  evidence: SeasonAllocationEvidence;
};
function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function money(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Saved payment records override the displayed cash amount, never the historical accrual/stock cache. */
export function applyPayoutSnapshotsToCycles<T extends SeasonBilling>(cycles: T[], snapshots: PayoutSnapshot[]): T[] {
  const byCycle = new Map<string, PayoutSnapshot[]>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.project_id}:${snapshot.ym}`;
    byCycle.set(key, [...(byCycle.get(key) ?? []), snapshot]);
  }
  return cycles.map((cycle) => {
    const summary = record(cycle.reward_summary_json);
    const saved = byCycle.get(`${cycle.project_id}:${cycle.ym}`);
    if (!summary || !Array.isArray(summary.members) || !saved?.length) return cycle;
    const rows = summary.members.map((m) => ({ ...record(m) }));
    for (const snapshot of saved) {
      let member = rows.find((m) => (m.memberId ?? m.member_id) === snapshot.member_id);
      if (!member) { member = { memberId: snapshot.member_id, totalPay: 0, basePay: 0, breakdown: [], stockYen: 0, carryInYen: 0 }; rows.push(member); }
      const total = money(snapshot.total_pay);
      const calculatedTotal = money(member.totalPay ?? member.total_pay);
      const extra = money(member.extraPaidYen ?? member.extra_paid_yen ?? 0)!;
      const unknownSplit = extra > 0 && (total == null || extra > total || money(member.totalPay ?? member.total_pay) !== total);
      Object.assign(member, {
        totalPay: total, regularPaidYen: unknownSplit || total == null ? null : total - extra,
        extraPaidYen: unknownSplit ? null : extra,
        payoutSnapshotAmountUnknown: total == null, payoutSnapshotSplitUnknown: unknownSplit,
        payoutSnapshotCalculatedTotalYen: calculatedTotal,
      });
    }
    return { ...cycle, reward_summary_json: { ...summary, members: rows } };
  });
}

/** Reward-budget check, distinct from cash flow. Annual flows plus the final month's stock exactly once. */
export function buildSeasonAllocation(plan: SeasonPlan, cycles: SeasonBilling[], profiles: SeasonMember[], months: string[]): SeasonAllocation {
  const issues = new Set<string>();
  const regularBudgetYen = money(plan.budget_yen);
  if (regularBudgetYen == null) issues.add("本契約のシーズン報酬予算が未設定");
  const byYm = new Map(cycles.filter((c) => c.project_id === plan.project_id).map((c) => [c.ym, c]));
  const byMember = new Map(profiles.map((p) => [p.member_id, p]));
  const allocations = new Map<string, SeasonAllocationMember>();
  let extraBudgetYen = 0;
  let extraPayYen = 0;
  for (const ym of months) {
    const cycle = byYm.get(ym);
    const extraBudget = money(cycle?.extra_budget_yen ?? 0);
    if (extraBudget == null) issues.add(`${ym}の別財布予算が未確認`);
    else extraBudgetYen += extraBudget;
    const summary = record(cycle?.reward_summary_json);
    if (!Array.isArray(summary?.members)) { issues.add(`${ym}の報酬が未計算`); continue; }
    let attributedInternal = 0;
    for (const value of summary.members) {
      const m = record(value);
      const id = String(m?.memberId ?? m?.member_id ?? "");
      const profile = byMember.get(id);
      if (!m || !profile) { issues.add(`${ym}の報酬対象者が未確認`); continue; }
      if (m.payoutSnapshotSplitUnknown) issues.add(`${ym}の本契約・別財布内訳が未確認`);
      const internal = profile.exclude_from_payout_notice === true || isNonCashAllocationMember(m);
      const cash = internal ? 0 : money(m.totalPay ?? m.total_pay);
      const funded = internal ? money(m.companyReserveYen ?? m.officerReserveYen) : 0;
      const stock = ym === plan.period_end_ym ? money(m.stockYen ?? m.stock_yen ?? m.deferredYen ?? m.deferred_yen ?? (internal ? m.companyReserveUnfundedYen : 0) ?? 0) : 0;
      if (cash == null || funded == null || stock == null) { issues.add(`${ym}の配分額が未確認`); continue; }
      extraPayYen += money(internal ? m.extraCompanyReserveYen ?? 0 : m.extraPaidYen ?? m.extra_paid_yen ?? 0) ?? 0;
      attributedInternal += funded;
      const row = allocations.get(id) ?? { memberId: id, memberName: profile.code_name?.trim() || profile.member_name?.trim() || id, cashYen: 0, internalYen: 0, closingUnfundedYen: 0, totalYen: 0 };
      row.cashYen += cash; row.internalYen += funded; row.closingUnfundedYen += stock;
      row.totalYen = row.cashYen + row.internalYen + row.closingUnfundedYen;
      allocations.set(id, row);
    }
    if (money(summary?.companyReserveYen ?? 0)! > attributedInternal) issues.add(`${ym}の内部配賦にメンバー未帰属額がある`);
  }
  if (extraPayYen > 0 && extraBudgetYen === 0) issues.add("別財布報酬の予算が未設定");
  const members = [...allocations.values()].sort((a, b) => Number(a.internalYen > 0) - Number(b.internalYen > 0) || b.totalYen - a.totalYen || a.memberId.localeCompare(b.memberId));
  const complete = issues.size === 0;
  const sum = (key: "cashYen" | "internalYen" | "closingUnfundedYen" | "totalYen") => complete ? members.reduce((a, m) => a + m[key], 0) : null;
  const budgetYen = regularBudgetYen == null ? null : regularBudgetYen + extraBudgetYen;
  const committedYen = sum("totalYen");
  const remainingYen = complete && budgetYen != null && committedYen != null ? budgetYen - committedYen : null;
  return { regularBudgetYen, extraBudgetYen, budgetYen, cashYen: sum("cashYen"), internalYen: sum("internalYen"), closingUnfundedYen: sum("closingUnfundedYen"), committedYen, remainingYen,
    status: remainingYen == null ? "unknown" : remainingYen < 0 ? "deficit" : "within_budget", members: complete ? members : [], issues: [...issues],
    evidence: buildSeasonAllocationEvidence(plan, cycles, profiles, months, committedYen, budgetYen) };
}
