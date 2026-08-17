import {
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

/**
 * かる作成の「SX_月次試算表_v2.0_260818.xlsx」C/Fをそのまま投影した明細。
 * 対象は FY2027〜FY2031（2027-04〜2032-03）。設備投資・株式調達は
 * 年次への機械的な4月配賦ではなく、原表で計上されている月だけに置く。
 */
const SX_TRIAL_BALANCE_CAPEX_BY_YM: Readonly<Record<string, number>> = {
  "2027-04": 34_900_000,
  "2028-04": 27_300_000,
  "2029-04": 27_300_000,
  "2030-04": 85_800_000,
  "2031-04": 22_300_000,
  "2031-08": 600_000_000,
};

const SX_TRIAL_BALANCE_EQUITY_BY_YM: Readonly<Record<string, number>> = {
  "2027-04": 150_000_000,
  "2028-10": 300_000_000,
  "2030-03": 600_000_000,
  "2031-04": 1_500_000_000,
};

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
    const sourceEquityYen = SX_TRIAL_BALANCE_EQUITY_BY_YM[ym];
    const capitalPlanEquityYen = equityEvents
      .filter((event) => event.ym === ym)
      .reduce((sum, event) => sum + event.amountYen, 0);
    return {
      ym,
      capexYen: SX_TRIAL_BALANCE_CAPEX_BY_YM[ym] ?? 0,
      // 採用月次試算表を優先し、原表の対象外期間だけ active 資本政策を補完表示する。
      equityFundingYen: sourceEquityYen ?? capitalPlanEquityYen,
      loanDrawdownYen: null,
      grantReceiptYen: 0,
      nonDilutiveFundingYen: 0,
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
        detail: `${phase?.label ?? `FY${fiscalYear}`}。${facilityActivity ?? "設備投資"}。採用月次試算表で${formatYenAsMillion(row.capexYen)}をこの月へ計上。`,
        evidenceState: "plan",
      });
    }

    const fundingEvents = equityEvents.filter((event) => event.ym === row.ym && event.amountYen > 0);
    if (row.equityFundingYen > 0) {
      comments.push({
        metric: "equityFundingYen",
        ym: row.ym,
        title: fundingEvents.map((event) => `${event.label}調達`).join("・") || "資金調達",
        detail: `採用月次試算表で${formatYenAsMillion(row.equityFundingYen)}をこの月へ計上。${fundingEvents.length ? "active資本政策のイベント名は参照用で、契約・入金実績ではない。" : "資本政策との対応は未確認。"}`,
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
