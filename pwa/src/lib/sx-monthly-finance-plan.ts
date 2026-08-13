import {
  SX_ANNUAL_PROJECTION,
  SX_BUSINESS_PLAN_PHASES,
  SX_CAPITAL_PLAN_EVENTS,
} from "./sx-business-plan.ts";

export interface SxEquityFundingPlanEvent {
  label: string;
  ym: string;
  amountYen: number;
}

export interface SxMonthlyFinancePlanRow {
  ym: string;
  capexYen: number;
  equityFundingYen: number;
  loanDrawdownYen: number | null;
  grantReceiptYen: number;
  nonDilutiveFundingYen: number;
}

function eventAmountYen(event: (typeof SX_CAPITAL_PLAN_EVENTS)[number]) {
  return event.allocations.reduce(
    (sum, allocation) => sum + Number(allocation.amount?.value ?? 0),
    0,
  );
}

export const SX_DEFAULT_EQUITY_FUNDING_EVENTS: SxEquityFundingPlanEvent[] =
  SX_CAPITAL_PLAN_EVENTS
    .filter((event) => event.type === "equity_issue" || event.type === "ipo")
    .map((event) => ({
      label: event.label,
      ym: event.date!.slice(0, 7),
      amountYen: eventAmountYen(event),
    }));

export const SX_PHASE0_NON_DILUTIVE_FUNDING_YEN =
  SX_BUSINESS_PLAN_PHASES.find((phase) => phase.id === "psi")?.budgetYen ?? 0;

function fiscalYearForYm(ym: string) {
  const [year, month] = ym.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

/**
 * SXコックピットの現行年次計画を月次C/Fへ置くための決定的ルール。
 * - 設備投資: 旧月次試算の発生規則どおり各FYの4月へ一括仮置き。
 * - 株式調達: 保存済み資本政策と同じラウンド月。引数でDB正本へ差し替え可能。
 * - 助成金入金: 年次額しかないため各FYの4月へ仮置き。入金月は低精度。
 * - 融資: 現行計画に金額・実行月がないため0ではなくnull（未計画）。
 * - Phase 0 PSI等: 2026-07に1回だけ置き、FY2027助成金との二重計上を禁止。
 */
export function buildSxMonthlyFinancePlan(
  yms: readonly string[],
  equityEvents: readonly SxEquityFundingPlanEvent[] = SX_DEFAULT_EQUITY_FUNDING_EVENTS,
): SxMonthlyFinancePlanRow[] {
  return yms.map((ym) => {
    const fiscalYear = fiscalYearForYm(ym);
    const annual = SX_ANNUAL_PROJECTION.find((item) => item.fiscalYear === fiscalYear);
    const isFiscalYearOpening = ym === `${fiscalYear}-04`;
    return {
      ym,
      capexYen: isFiscalYearOpening ? annual?.capexYen ?? 0 : 0,
      equityFundingYen: equityEvents
        .filter((event) => event.ym === ym)
        .reduce((sum, event) => sum + event.amountYen, 0),
      loanDrawdownYen: null,
      grantReceiptYen: isFiscalYearOpening ? annual?.subsidyCashReceiptYen ?? 0 : 0,
      nonDilutiveFundingYen: ym === "2026-07" ? SX_PHASE0_NON_DILUTIVE_FUNDING_YEN : 0,
    };
  });
}
