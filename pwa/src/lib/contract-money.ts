export type ContractPeriodLike = {
  start_ym?: string | null;
  end_ym?: string | null;
};

export type ContractFeeLike = ContractPeriodLike & {
  fee_type?: string | null;
  fee_amount?: number | string | null;
  contract_terms_json?: unknown;
};

export type BillingBufferLike = {
  ym: string;
  budget_buffer_amount?: number | string | null;
};

const REALIZED_BILLING_STATUSES = new Set([
  "reported",
  "budget_confirmed",
  "allocation_confirmed",
  "invoice_issued",
  "invoice_sent",
  "payment_confirmed",
  "reward_paid",
]);

export function yenNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function isYm(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export function isWithinContractPeriod(project: ContractPeriodLike | null | undefined, ym: string): boolean {
  if (!isYm(ym)) return false;
  const startYm = project?.start_ym ?? null;
  const endYm = project?.end_ym ?? null;

  // Legacy rows without any period data cannot be proven out-of-contract here.
  // Once a contract period exists, it is authoritative.
  if (!isYm(startYm) && !isYm(endYm)) return true;
  if (isYm(startYm) && ym < startYm) return false;
  if (isYm(endYm) && ym > endYm) return false;
  return true;
}

export function monthlyFixedClientAmount(project: ContractFeeLike | null | undefined, ym: string): number {
  if ((project?.fee_type || "").toLowerCase() !== "monthly_fixed") return 0;
  if (!isWithinContractPeriod(project, ym)) return 0;
  return Math.max(0, yenNumber(project?.fee_amount));
}

export function contractBackedClientAmount({
  ym,
  project,
  reportedAmount,
  cycleStatus,
  hasInvoiceEvidence,
}: {
  ym: string;
  project: ContractFeeLike | null | undefined;
  reportedAmount?: number | string | null;
  cycleStatus?: string | null;
  hasInvoiceEvidence?: boolean | null;
}): number {
  const reported = Math.max(0, yenNumber(reportedAmount));
  if (!isWithinContractPeriod(project, ym)) {
    const realized = REALIZED_BILLING_STATUSES.has(String(cycleStatus || "").toLowerCase()) || hasInvoiceEvidence === true;
    return realized && reported > 0 ? reported : 0;
  }
  if (reported > 0) return reported;
  return monthlyFixedClientAmount(project, ym);
}

export function basePayoutCapYen(clientAmountYen: number, bufferYen: number): number {
  return Math.max(0, Math.round(clientAmountYen * 0.65) - Math.max(0, yenNumber(bufferYen)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function contractTerms(project: ContractFeeLike | null | undefined): Record<string, unknown> {
  return asRecord(project?.contract_terms_json) ?? {};
}

function contractBufferStartYm(project: ContractFeeLike | null | undefined): string | null {
  const terms = contractTerms(project);
  const start =
    terms.companyReserveBufferStartYm ??
    terms.company_reserve_buffer_start_ym ??
    terms.rewardBufferStartYm ??
    terms.billingStartYm ??
    terms.contractStartYm ??
    project?.start_ym;
  return isYm(start) ? start : null;
}

export function contractReserveBufferTotalYen(project: ContractFeeLike | null | undefined): number {
  const terms = contractTerms(project);
  return Math.max(0, yenNumber(
    terms.companyReserveBufferYen ??
    terms.company_reserve_buffer_yen ??
    terms.initialCompanyReserveYen ??
    terms.initial_company_reserve_yen ??
    terms.rewardBufferYen ??
    terms.reward_buffer_yen ??
    terms.payoutBufferYen ??
    terms.payout_buffer_yen
  ));
}

export function resolveContractReserveBufferYen({
  project,
  cycles,
  ym,
  invoiceYen,
}: {
  project: ContractFeeLike | null | undefined;
  cycles: BillingBufferLike[];
  ym: string;
  invoiceYen: number;
}): number {
  const totalBufferYen = contractReserveBufferTotalYen(project);
  if (totalBufferYen <= 0 || !isYm(ym)) return 0;

  const startYm = contractBufferStartYm(project);
  if (startYm && ym < startYm) return 0;

  const consumedBefore = cycles
    .filter((cycle) => isYm(cycle.ym) && cycle.ym < ym)
    .reduce((sum, cycle) => sum + Math.max(0, yenNumber(cycle.budget_buffer_amount)), 0);
  const remaining = Math.max(0, totalBufferYen - consumedBefore);
  const monthlyGrossCap = Math.max(0, Math.round(yenNumber(invoiceYen) * 0.65));
  return Math.min(remaining, monthlyGrossCap);
}
