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

export type SxMonthlyFinanceCommentMetric =
  | "capexYen"
  | "equityFundingYen"
  | "grantReceiptYen"
  | "nonDilutiveFundingYen";

export interface SxMonthlyFinanceComment {
  metric: SxMonthlyFinanceCommentMetric;
  ym: string;
  title: string;
  detail: string;
  evidenceState: "plan" | "observed";
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

function phaseForYm(ym: string) {
  return SX_BUSINESS_PLAN_PHASES.find((phase) => {
    const [start, end] = phase.period.split("–").map((value) => value.replace(".", "-"));
    return ym >= start && ym <= end;
  });
}

function formatYenAsMillion(valueYen: number) {
  return `${(valueYen / 1_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}百万円`;
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

/**
 * 月次C/Fの大きな変動理由を、同じ計算正本から再現する。
 * 金額・月を新しく推測せず、buildSxMonthlyFinancePlanと同じ年次計画・資本政策だけを使う。
 */
export function buildSxMonthlyFinanceComments(
  yms: readonly string[],
  equityEvents: readonly SxEquityFundingPlanEvent[] = SX_DEFAULT_EQUITY_FUNDING_EVENTS,
): SxMonthlyFinanceComment[] {
  const rows = buildSxMonthlyFinancePlan(yms, equityEvents);
  return rows.flatMap((row): SxMonthlyFinanceComment[] => {
    const comments: SxMonthlyFinanceComment[] = [];
    const fiscalYear = fiscalYearForYm(row.ym);
    const phase = phaseForYm(row.ym);

    if (row.capexYen > 0) {
      const facilityActivity = phase?.lanes.technology.activities.find((activity) => /工場|設備/.test(activity));
      const title = facilityActivity?.includes("本格自社工場")
        ? "本格自社工場の建設"
        : facilityActivity?.includes("量産実証工場")
          ? "量産実証工場の整備"
          : facilityActivity?.includes("パイロット設備")
            ? "小規模パイロット設備"
            : "設備投資計画";
      comments.push({
        metric: "capexYen",
        ym: row.ym,
        title,
        detail: `${phase?.label ?? `FY${fiscalYear}`}。${facilityActivity ?? "設備投資"}。年次計画${formatYenAsMillion(row.capexYen)}を、支払月未確認のためFY${fiscalYear}の4月へ仮置き。`,
        evidenceState: "plan",
      });
    }

    const fundingEvents = equityEvents.filter((event) => event.ym === row.ym && event.amountYen > 0);
    if (fundingEvents.length > 0) {
      comments.push({
        metric: "equityFundingYen",
        ym: row.ym,
        title: fundingEvents.map((event) => `${event.label}調達`).join("・"),
        detail: `active資本政策の計画。${fundingEvents.map((event) => `${event.label} ${formatYenAsMillion(event.amountYen)}`).join("、")}をイベント月へ配置。契約・入金実績ではない。`,
        evidenceState: "plan",
      });
    }

    if (row.grantReceiptYen > 0) {
      comments.push({
        metric: "grantReceiptYen",
        ym: row.ym,
        title: "助成金等の入金計画",
        detail: `FY${fiscalYear}の年次計画${formatYenAsMillion(row.grantReceiptYen)}。制度名と受領月は未確認のため4月へ仮置きし、採択額・受領実績とは自動同一視しない。`,
        evidenceState: "plan",
      });
    }

    if (row.nonDilutiveFundingYen > 0) {
      comments.push({
        metric: "nonDilutiveFundingYen",
        ym: row.ym,
        title: "Phase 0 非希薄化資金",
        detail: `Phase 0計画${formatYenAsMillion(row.nonDilutiveFundingYen)}を1回だけ配置。資金源であり、P/L売上へは算入しない。`,
        evidenceState: "plan",
      });
    }

    return comments;
  });
}
