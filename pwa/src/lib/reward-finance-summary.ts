/**
 * reward_summary_json のうち、シーズン予算検算で使う金額だけを扱う純粋関数。
 *
 * companyReserveYen は支払対象外メンバーへの当月の非現金配賦フロー、
 * stockYen は月末残高スナップショット。両者を同じ月次フローとして足さない。
 */
export type RewardFinanceMember = {
  payoutExcluded?: boolean;
  companyReserveYen?: number;
  officerReserveYen?: number;
  stockYen?: number;
  deferredYen?: number;
};

export type RewardFinanceSummary = {
  companyReserveYen?: number;
  members?: RewardFinanceMember[];
};

function nonNegativeYen(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Math.max(0, Math.round(Number.isFinite(parsed) ? parsed : 0));
}

export function isNonCashAllocationMember(member: RewardFinanceMember): boolean {
  return member.payoutExcluded === true
    || nonNegativeYen(member.companyReserveYen ?? member.officerReserveYen) > 0;
}

/** 支払対象外メンバーへの当月の割当済み額。月末 stock は含めない。 */
export function fundedNonCashAllocationYen(summary: RewardFinanceSummary | null | undefined): number {
  const explicit = nonNegativeYen(summary?.companyReserveYen);
  if (explicit > 0) return explicit;
  return (summary?.members ?? []).reduce(
    (sum, member) => sum + nonNegativeYen(member.companyReserveYen ?? member.officerReserveYen),
    0,
  );
}

/** 現金支払対象メンバーだけの月末未払残高。呼び出し側は最終月を一度だけ使う。 */
export function externalUnpaidStockYen(summary: RewardFinanceSummary | null | undefined): number {
  return (summary?.members ?? []).reduce((sum, member) => {
    if (isNonCashAllocationMember(member)) return sum;
    return sum + nonNegativeYen(member.stockYen ?? member.deferredYen);
  }, 0);
}
