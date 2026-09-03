import type {
  PaymentObligationAmountStatus,
  PaymentObligationStatus,
} from "./payment-obligations.ts";

export type StatutoryPayrollMonth = {
  ym: string;
  withholdingIncomeTaxYen: number | null;
  withholdingObserved: boolean;
  socialInsuranceYen: number | null;
  socialInsuranceObserved: boolean;
  residentTaxYen: number | null;
  residentTaxObserved: boolean;
};

export type StatutoryPaymentEvidence = {
  kind: "tax_office" | "social_insurance" | "labor_insurance" | "local_tax";
  date: string;
  amountYen: number;
  sourceRef: string;
};

export type StatutoryTaxForecast = {
  ym: string;
  consumptionTaxYen: number;
  corporateTaxYen: number;
};

export type StatutoryPaymentDraft = {
  sourceKey: string;
  title: string;
  counterparty: string | null;
  category: "tax" | "social_insurance";
  amountYen: number | null;
  amountStatus: PaymentObligationAmountStatus;
  dueDate: string;
  status: PaymentObligationStatus;
  cashflowTreatment: "additive" | "included_in_budget";
  budgetCategory: string | null;
  autoDebit: boolean | null;
  sourceRef: string;
  confidence: number;
  paidAt: string | null;
  paidAmountYen: number | null;
  payload: Record<string, unknown>;
};

export type BuildStatutoryPaymentsInput = {
  today: string;
  horizonMonths: number;
  fiscalYearStartMonth: number;
  previousCorporateTaxYen: number;
  previousConsumptionTaxYen: number;
  payrollMonths: StatutoryPayrollMonth[];
  paymentEvidence: StatutoryPaymentEvidence[];
  taxForecasts: StatutoryTaxForecast[];
};

const NTA_WITHHOLDING_URL = "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2505.htm";
const NTA_CORPORATE_URL = "https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/hojin/shinkoku/01.htm";
const NTA_CONSUMPTION_URL = "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6609.htm";
const PENSION_URL = "https://www.nenkin.go.jp/service/pamphlet/kaigai/Payment_Guide.files/Payment_Guide_Japanese.pdf";
const LABOR_INSURANCE_URL = "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/hoken/roudouhoken21/index.html";

// 内閣府公表の祝日と行政機関の年末年始休業日。18か月先の法定期限補正に使う。
const JP_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
  "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
  "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23",
  "2026-10-12", "2026-11-03", "2026-11-23", "2026-12-29", "2026-12-30", "2026-12-31",
  "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21",
  "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05",
  "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11",
  "2027-11-03", "2027-11-23", "2027-12-29", "2027-12-30", "2027-12-31",
  "2028-01-01", "2028-01-02", "2028-01-03",
]);

function isoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return isoDate(value);
}

export function addMonthsToStatutoryYm(ym: string, delta: number): string {
  const date = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function endOfMonth(ym: string): string {
  const date = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)), 0));
  return isoDate(date);
}

function ymDay(ym: string, day: number): string {
  const lastDay = Number(endOfMonth(ym).slice(8, 10));
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function nextStatutoryBusinessDay(date: string): string {
  let value = date;
  while (true) {
    const day = new Date(`${value}T00:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6 && !JP_HOLIDAYS.has(value)) return value;
    value = addDays(value, 1);
  }
}

export function statutoryEndOfMonthDueDate(baseYm: string): string {
  return nextStatutoryBusinessDay(endOfMonth(baseYm));
}

function monthRange(startYm: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addMonthsToStatutoryYm(startYm, index));
}

function ymFromDate(date: string): string {
  return date.slice(0, 7).replace("-", "");
}

function amountStatus(amount: number | null, exact: boolean): PaymentObligationAmountStatus {
  if (amount == null) return "unknown";
  return exact ? "exact" : "estimated";
}

function withinHorizon(date: string, today: string, horizonYm: string): boolean {
  const oldCutoff = addDays(today, -62);
  return date >= oldCutoff && ymFromDate(date) <= horizonYm;
}

/**
 * 消し込めなかったときに「口座には何があったのか」を残すための候補一覧。
 * 一致しなかった理由が金額違いなのか、そもそも出金が無いのかを、人が画面で判断できるようにする。
 * 2026年7月10日期限の源泉所得税は、同じ月に税務署あての出金があるのに金額が違って
 * 消し込めず、未納か照合漏れかを誰も判断できないまま加算税になった。
 */
function evidenceCandidates(
  evidence: StatutoryPaymentEvidence[],
  kind: StatutoryPaymentEvidence["kind"],
  dueDate: string,
  beforeDays: number,
  afterDays: number
): StatutoryPaymentEvidence[] {
  return evidence
    .filter((row) => row.kind === kind)
    .filter((row) => row.date >= addDays(dueDate, -beforeDays) && row.date <= addDays(dueDate, afterDays))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type SettlementSearch = {
  kind: StatutoryPaymentEvidence["kind"];
  from: string;
  to: string;
  matched: boolean;
  candidateCount: number;
  candidates: Array<{ date: string; amountYen: number; sourceRef: string }>;
};

function settlementSearch(
  evidence: StatutoryPaymentEvidence[],
  kind: StatutoryPaymentEvidence["kind"],
  dueDate: string,
  beforeDays: number,
  afterDays: number,
  matched: boolean
): SettlementSearch {
  const candidates = evidenceCandidates(evidence, kind, dueDate, beforeDays, afterDays);
  return {
    kind,
    from: addDays(dueDate, -beforeDays),
    to: addDays(dueDate, afterDays),
    matched,
    candidateCount: candidates.length,
    candidates: candidates.slice(0, 8).map((row) => ({ date: row.date, amountYen: row.amountYen, sourceRef: row.sourceRef })),
  };
}

function matchingEvidence(
  evidence: StatutoryPaymentEvidence[],
  kind: StatutoryPaymentEvidence["kind"],
  amount: number | null,
  dueDate: string,
  beforeDays: number,
  afterDays: number
): StatutoryPaymentEvidence | null {
  if (amount == null) return null;
  return evidence
    .filter((row) => row.kind === kind && row.amountYen === amount)
    .filter((row) => row.date >= addDays(dueDate, -beforeDays) && row.date <= addDays(dueDate, afterDays))
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

function withholdingDrafts(input: BuildStatutoryPaymentsInput, horizonYm: string): StatutoryPaymentDraft[] {
  const payrollByYm = new Map(input.payrollMonths.map((row) => [row.ym, row]));
  const observed = input.payrollMonths
    .filter((row) => row.withholdingObserved && (row.withholdingIncomeTaxYen ?? 0) >= 0)
    .sort((a, b) => a.ym.localeCompare(b.ym));
  const fallback = observed.at(-1)?.withholdingIncomeTaxYen ?? null;
  const currentYear = Number(input.today.slice(0, 4));
  const drafts: StatutoryPaymentDraft[] = [];

  for (let year = currentYear - 1; year <= currentYear + 2; year += 1) {
    for (const half of [1, 2] as const) {
      const startYm = `${year}${half === 1 ? "01" : "07"}`;
      const periodMonths = monthRange(startYm, 6);
      const dueDate = nextStatutoryBusinessDay(half === 1 ? `${year}-07-10` : `${year + 1}-01-20`);
      if (!withinHorizon(dueDate, input.today, horizonYm)) continue;

      const offsets: Array<{ ym: string; amountYen: number; amountStatus: "exact" | "estimated" }> = [];
      const missingMonths: string[] = [];
      let total = 0;
      for (const ym of periodMonths) {
        const row = payrollByYm.get(ym);
        const exactAmount = row?.withholdingObserved ? row.withholdingIncomeTaxYen : null;
        const value = exactAmount ?? fallback;
        if (exactAmount == null) missingMonths.push(ym);
        if (value == null) continue;
        total += Math.max(0, Math.round(value));
        offsets.push({ ym, amountYen: Math.max(0, Math.round(value)), amountStatus: exactAmount == null ? "estimated" : "exact" });
      }
      const amount = offsets.length ? total : null;
      const exact = missingMonths.length === 0;
      const paid = matchingEvidence(input.paymentEvidence, "tax_office", amount, dueDate, 15, 35);
      const endedMissingMonths = missingMonths.filter((ym) => endOfMonth(ym) < input.today);
      const needsReview = !paid && dueDate <= input.today && (amount == null || endedMissingMonths.length > 0);
      drafts.push({
        sourceKey: `statutory:withholding-income-tax:special:${year}-h${half}`,
        title: `源泉所得税（納期の特例・${half === 1 ? "1-6月" : "7-12月"}分）`,
        counterparty: "税務署",
        category: "tax",
        amountYen: amount,
        amountStatus: amountStatus(amount, exact),
        dueDate,
        status: paid ? "paid" : needsReview ? "needs_review" : "open",
        cashflowTreatment: "additive",
        budgetCategory: "payroll_withholding_timing",
        autoDebit: false,
        sourceRef: NTA_WITHHOLDING_URL,
        confidence: exact ? 1 : amount == null ? 0.6 : 0.85,
        paidAt: paid ? `${paid.date}T00:00:00+09:00` : null,
        paidAmountYen: paid?.amountYen ?? null,
        payload: {
          ruleKey: "withholding_income_tax_special",
          statutoryPeriod: { startYm, endYm: periodMonths.at(-1) },
          observedMonths: periodMonths.filter((ym) => payrollByYm.get(ym)?.withholdingObserved),
          missingMonths,
          originCashOffsets: offsets,
          amountFormula: "freee payroll withholding income tax; missing months use latest observed month",
          scheduleBasis: "AMD has a prior Jan 20 semiannual tax-office payment",
          paidEvidenceRef: paid?.sourceRef ?? null,
          settlementSearch: settlementSearch(input.paymentEvidence, "tax_office", dueDate, 15, 35, Boolean(paid)),
        },
      });
    }
  }
  return drafts;
}

function socialInsuranceDrafts(input: BuildStatutoryPaymentsInput, horizonYm: string): StatutoryPaymentDraft[] {
  const payrollByYm = new Map(input.payrollMonths.map((row) => [row.ym, row]));
  const observed = input.payrollMonths
    .filter((row) => row.socialInsuranceObserved && (row.socialInsuranceYen ?? 0) > 0)
    .sort((a, b) => a.ym.localeCompare(b.ym));
  const fallback = observed.at(-1)?.socialInsuranceYen ?? null;
  if (fallback == null) return [];

  const currentYm = ymFromDate(input.today);
  const firstYm = `${input.today.slice(0, 4)}01`;
  const sourceEndYm = addMonthsToStatutoryYm(horizonYm, -1);
  const sourceMonths: string[] = [];
  for (let ym = firstYm; ym <= sourceEndYm; ym = addMonthsToStatutoryYm(ym, 1)) sourceMonths.push(ym);

  const availablePayments = input.paymentEvidence
    .filter((row) => row.kind === "social_insurance")
    .sort((a, b) => a.date.localeCompare(b.date));
  const usedEvidence = new Set<string>();
  const matchedByYm = new Map<string, StatutoryPaymentEvidence>();
  for (const ym of sourceMonths) {
    const row = payrollByYm.get(ym);
    if (!row?.socialInsuranceObserved || row.socialInsuranceYen == null) continue;
    const baseDueYm = addMonthsToStatutoryYm(ym, 1);
    const dueDate = statutoryEndOfMonthDueDate(baseDueYm);
    const dueMonthStart = `${baseDueYm.slice(0, 4)}-${baseDueYm.slice(4, 6)}-01`;
    const match = availablePayments.find((payment) =>
      !usedEvidence.has(payment.sourceRef)
      && payment.amountYen === row.socialInsuranceYen
      && payment.date >= dueMonthStart
      && payment.date <= addDays(dueDate, 45)
    );
    if (match) {
      usedEvidence.add(match.sourceRef);
      matchedByYm.set(ym, match);
    }
  }

  return sourceMonths.map((ym) => {
    const row = payrollByYm.get(ym);
    const exact = Boolean(row?.socialInsuranceObserved && row.socialInsuranceYen != null);
    const amount = exact ? row?.socialInsuranceYen ?? null : fallback;
    const dueDate = statutoryEndOfMonthDueDate(addMonthsToStatutoryYm(ym, 1));
    const paid = matchedByYm.get(ym) ?? null;
    const sourceMonthEnded = endOfMonth(ym) < input.today;
    const needsReview = !paid && ((dueDate < input.today && ym <= currentYm) || (!exact && sourceMonthEnded));
    return {
      sourceKey: `statutory:social-insurance:${ym}`,
      title: `社会保険料（${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月分）`,
      counterparty: "日本年金機構",
      category: "social_insurance" as const,
      amountYen: amount,
      amountStatus: amountStatus(amount, exact),
      dueDate,
      status: paid ? "paid" as const : needsReview ? "needs_review" as const : "open" as const,
      cashflowTreatment: "additive" as const,
      budgetCategory: "social_insurance_timing",
      autoDebit: true,
      sourceRef: PENSION_URL,
      confidence: exact ? 1 : 0.8,
      paidAt: paid ? `${paid.date}T00:00:00+09:00` : null,
      paidAmountYen: paid?.amountYen ?? null,
      payload: {
        ruleKey: "monthly_social_insurance",
        sourceYm: ym,
        originCashOffsets: amount == null ? [] : [{ ym, amountYen: amount, amountStatus: exact ? "exact" : "estimated" }],
        amountFormula: exact ? "freee payroll employer plus employee contributions" : "latest observed freee payroll contribution",
        paidEvidenceRef: paid?.sourceRef ?? null,
        settlementSearch: settlementSearch(input.paymentEvidence, "social_insurance", dueDate, 10, 35, Boolean(paid)),
      },
    };
  });
}

function residentTaxDrafts(input: BuildStatutoryPaymentsInput, horizonYm: string): StatutoryPaymentDraft[] {
  const observed = input.payrollMonths
    .filter((row) => row.residentTaxObserved && (row.residentTaxYen ?? 0) > 0)
    .sort((a, b) => a.ym.localeCompare(b.ym));
  const fallback = observed.at(-1)?.residentTaxYen ?? null;
  const currentYm = ymFromDate(input.today);
  if (fallback == null || (observed.at(-1)?.ym ?? "") < addMonthsToStatutoryYm(currentYm, -2)) return [];
  const payrollByYm = new Map(input.payrollMonths.map((row) => [row.ym, row]));
  const sourceEndYm = addMonthsToStatutoryYm(horizonYm, -1);
  const drafts: StatutoryPaymentDraft[] = [];
  for (let ym = currentYm; ym <= sourceEndYm; ym = addMonthsToStatutoryYm(ym, 1)) {
    const row = payrollByYm.get(ym);
    const exact = Boolean(row?.residentTaxObserved && row.residentTaxYen != null);
    const amount = exact ? row?.residentTaxYen ?? null : fallback;
    const dueYm = addMonthsToStatutoryYm(ym, 1);
    const dueDate = nextStatutoryBusinessDay(ymDay(dueYm, 10));
    drafts.push({
      sourceKey: `statutory:resident-tax-special-collection:${ym}`,
      title: `住民税（特別徴収・${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月分）`,
      counterparty: "地方公共団体",
      category: "tax",
      amountYen: amount,
      amountStatus: amountStatus(amount, exact),
      dueDate,
      status: "open",
      cashflowTreatment: "additive",
      budgetCategory: "payroll_withholding_timing",
      autoDebit: false,
      sourceRef: "https://www.soumu.go.jp/main_content/000679118.pdf",
      confidence: exact ? 1 : 0.8,
      paidAt: null,
      paidAmountYen: null,
      payload: {
        ruleKey: "resident_tax_special_collection",
        sourceYm: ym,
        originCashOffsets: amount == null ? [] : [{ ym, amountYen: amount, amountStatus: exact ? "exact" : "estimated" }],
      },
    });
  }
  return drafts;
}

function laborInsuranceDrafts(input: BuildStatutoryPaymentsInput, horizonYm: string): StatutoryPaymentDraft[] {
  const currentYear = Number(input.today.slice(0, 4));
  const prior = input.paymentEvidence
    .filter((row) => row.kind === "labor_insurance" && row.date.slice(0, 4) < String(currentYear))
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const drafts: StatutoryPaymentDraft[] = [];
  for (let year = currentYear; year <= currentYear + 1; year += 1) {
    const dueDate = nextStatutoryBusinessDay(`${year}-07-10`);
    if (!withinHorizon(dueDate, input.today, horizonYm)) continue;
    const paid = input.paymentEvidence
      .filter((row) => row.kind === "labor_insurance" && row.date.slice(0, 4) === String(year))
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    const amount = paid?.amountYen ?? prior?.amountYen ?? null;
    drafts.push({
      sourceKey: `statutory:labor-insurance:annual:${year}`,
      title: `労働保険料（年度更新・${year}年度）`,
      counterparty: "厚生労働省",
      category: "social_insurance",
      amountYen: amount,
      amountStatus: paid ? "exact" : amount == null ? "unknown" : "estimated",
      dueDate,
      status: paid ? "paid" : dueDate < input.today ? "needs_review" : "open",
      cashflowTreatment: "additive",
      budgetCategory: "labor_insurance",
      autoDebit: false,
      sourceRef: LABOR_INSURANCE_URL,
      confidence: paid ? 1 : amount == null ? 0.6 : 0.75,
      paidAt: paid ? `${paid.date}T00:00:00+09:00` : null,
      paidAmountYen: paid?.amountYen ?? null,
      payload: {
        ruleKey: "annual_labor_insurance",
        amountFormula: paid ? "current freee bank payment" : "previous annual freee bank payment",
        priorEvidenceRef: prior?.sourceRef ?? null,
        paidEvidenceRef: paid?.sourceRef ?? null,
        settlementSearch: settlementSearch(input.paymentEvidence, "labor_insurance", dueDate, 40, 60, Boolean(paid)),
      },
    });
  }
  return drafts;
}

function taxDrafts(input: BuildStatutoryPaymentsInput, horizonYm: string): StatutoryPaymentDraft[] {
  const forecastByYm = new Map(input.taxForecasts.map((row) => [row.ym, row]));
  const forecastForBaseYm = (baseYm: string) => {
    const paymentYm = ymFromDate(statutoryEndOfMonthDueDate(baseYm));
    const paymentMonth = forecastByYm.get(paymentYm);
    const baseMonth = forecastByYm.get(baseYm);
    if (!paymentMonth && !baseMonth) return undefined;
    return {
      ym: paymentYm,
      consumptionTaxYen: paymentMonth?.consumptionTaxYen || baseMonth?.consumptionTaxYen || 0,
      corporateTaxYen: paymentMonth?.corporateTaxYen || baseMonth?.corporateTaxYen || 0,
    };
  };
  const currentYear = Number(input.today.slice(0, 4));
  const startMonth = Math.max(1, Math.min(12, Math.round(input.fiscalYearStartMonth || 1)));
  const drafts: StatutoryPaymentDraft[] = [];

  for (let startYear = currentYear; startYear <= currentYear + 1; startYear += 1) {
    const fiscalStartYm = `${startYear}${String(startMonth).padStart(2, "0")}`;
    const interimBaseYm = addMonthsToStatutoryYm(fiscalStartYm, 7);
    const finalBaseYm = addMonthsToStatutoryYm(fiscalStartYm, 13);
    const interimDueDate = statutoryEndOfMonthDueDate(interimBaseYm);
    const finalDueDate = statutoryEndOfMonthDueDate(finalBaseYm);
    const interimForecast = forecastForBaseYm(interimBaseYm);
    const finalForecast = forecastForBaseYm(finalBaseYm);

    const previousFiscalStartYm = addMonthsToStatutoryYm(fiscalStartYm, -12);
    const previousInterimForecast = forecastForBaseYm(addMonthsToStatutoryYm(previousFiscalStartYm, 7));
    const previousFinalForecast = forecastForBaseYm(addMonthsToStatutoryYm(previousFiscalStartYm, 13));
    const forecastPreviousConsumption = (previousInterimForecast?.consumptionTaxYen ?? 0) + (previousFinalForecast?.consumptionTaxYen ?? 0);
    const priorConsumption = startYear === currentYear ? input.previousConsumptionTaxYen : forecastPreviousConsumption;
    const fallbackConsumptionInterim = priorConsumption > 480_000 ? Math.round(priorConsumption / 2) : 0;
    const consumptionInterim = interimForecast?.consumptionTaxYen || fallbackConsumptionInterim;
    if (consumptionInterim > 0 && withinHorizon(interimDueDate, input.today, horizonYm)) {
      drafts.push({
        sourceKey: `statutory:consumption-tax:interim:${fiscalStartYm}`,
        title: "消費税等（中間納付）",
        counterparty: "税務署",
        category: "tax",
        amountYen: consumptionInterim,
        amountStatus: "estimated",
        dueDate: interimDueDate,
        status: "open",
        cashflowTreatment: "included_in_budget",
        budgetCategory: "tax_payment_consumption",
        autoDebit: false,
        sourceRef: NTA_CONSUMPTION_URL,
        confidence: startYear === currentYear ? 0.95 : 0.85,
        paidAt: null,
        paidAmountYen: null,
        payload: {
          ruleKey: "consumption_tax_interim",
          fiscalStartYm,
          settlementSearch: settlementSearch(input.paymentEvidence, "tax_office", interimDueDate, 15, 35, false),
          amountFormula: startYear === currentYear ? "previous confirmed annual tax / 2" : "management forecast tax payment",
          priorAnnualTaxYen: priorConsumption || null,
        },
      });
    }

    const forecastPreviousCorporate = (previousInterimForecast?.corporateTaxYen ?? 0) + (previousFinalForecast?.corporateTaxYen ?? 0);
    const priorCorporate = startYear === currentYear ? input.previousCorporateTaxYen : forecastPreviousCorporate;
    const corporateInterimByPrior = Math.floor(priorCorporate / 12) * 6;
    const fallbackCorporateInterim = corporateInterimByPrior > 100_000 ? corporateInterimByPrior : 0;
    const corporateInterim = interimForecast?.corporateTaxYen || fallbackCorporateInterim;
    if (corporateInterim > 0 && withinHorizon(interimDueDate, input.today, horizonYm)) {
      drafts.push({
        sourceKey: `statutory:corporate-tax:interim:${fiscalStartYm}`,
        title: "法人税等（中間納付）",
        counterparty: "税務署・地方公共団体",
        category: "tax",
        amountYen: corporateInterim,
        amountStatus: startYear === currentYear && fallbackCorporateInterim === corporateInterim ? "exact" : "estimated",
        dueDate: interimDueDate,
        status: "open",
        cashflowTreatment: "included_in_budget",
        budgetCategory: "tax_payment_corporate",
        autoDebit: false,
        sourceRef: NTA_CORPORATE_URL,
        confidence: startYear === currentYear ? 1 : 0.85,
        paidAt: null,
        paidAmountYen: null,
        payload: {
          ruleKey: "corporate_tax_interim",
          fiscalStartYm,
          settlementSearch: settlementSearch(input.paymentEvidence, "tax_office", interimDueDate, 15, 35, false),
          amountFormula: "floor(previous corporate tax / 12) * 6; generated only when over 100,000 yen",
          priorCorporateTaxYen: priorCorporate || null,
        },
      });
    }

    if (finalForecast?.consumptionTaxYen && finalForecast.consumptionTaxYen > 0 && withinHorizon(finalDueDate, input.today, horizonYm)) {
      drafts.push({
        sourceKey: `statutory:consumption-tax:final:${fiscalStartYm}`,
        title: "消費税等（確定納付）",
        counterparty: "税務署",
        category: "tax",
        amountYen: finalForecast.consumptionTaxYen,
        amountStatus: "estimated",
        dueDate: finalDueDate,
        status: "open",
        cashflowTreatment: "included_in_budget",
        budgetCategory: "tax_payment_consumption",
        autoDebit: false,
        sourceRef: NTA_CONSUMPTION_URL,
        confidence: 0.85,
        paidAt: null,
        paidAmountYen: null,
        payload: { ruleKey: "consumption_tax_final", fiscalStartYm, amountFormula: "management monthly forecast", settlementSearch: settlementSearch(input.paymentEvidence, "tax_office", finalDueDate, 15, 35, false) },
      });
    }
    if (finalForecast?.corporateTaxYen && finalForecast.corporateTaxYen > 0 && withinHorizon(finalDueDate, input.today, horizonYm)) {
      drafts.push({
        sourceKey: `statutory:corporate-tax:final:${fiscalStartYm}`,
        title: "法人税等（確定納付）",
        counterparty: "税務署・地方公共団体",
        category: "tax",
        amountYen: finalForecast.corporateTaxYen,
        amountStatus: "estimated",
        dueDate: finalDueDate,
        status: "open",
        cashflowTreatment: "included_in_budget",
        budgetCategory: "tax_payment_corporate",
        autoDebit: false,
        sourceRef: NTA_CORPORATE_URL,
        confidence: 0.85,
        paidAt: null,
        paidAmountYen: null,
        payload: { ruleKey: "corporate_tax_final", fiscalStartYm, amountFormula: "management monthly forecast", settlementSearch: settlementSearch(input.paymentEvidence, "tax_office", finalDueDate, 15, 35, false) },
      });
    }
  }
  return drafts;
}

// ── 加算税・延滞税 ────────────────────────────────────────────────
// 法定納付が納期限を過ぎても未納なら、加算税と延滞税が後から必ず請求される。
// 賦課決定通知が届くまで実額は分からないが、算式は法令で決まっているので、
// 「このまま未納なら今いくら積み上がっているか」は決定的に計算できる。
// 実際の通知書が届いたらそれが正本になり、その親については見込みを作らない。

const NTA_DELINQUENT_TAX_URL = "https://www.nta.go.jp/taxes/nozei/entaizei/keisan/entai_wariai.htm";
const NTA_WITHHOLDING_PENALTY_URL = "https://www.nta.go.jp/law/jimu-unei/shotoku/gensen/000703/01.htm";
const PENSION_DELINQUENT_URL = "https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/20141219-02.html";

// 国税庁が年ごとに公表する延滞税の割合（％）。区切りは納期限の翌日から2か月。
// 未収録の年は見込みを出さない。推定値で埋めない。
const NATIONAL_DELINQUENT_RATES: Record<string, { withinBoundary: number; afterBoundary: number }> = {
  "2024": { withinBoundary: 2.9, afterBoundary: 9.2 },
  "2025": { withinBoundary: 2.8, afterBoundary: 9.1 },
  "2026": { withinBoundary: 2.8, afterBoundary: 9.1 },
};

// 日本年金機構が年ごとに公表する延滞金の割合（％）。区切りは納期限の翌日から3か月で、
// 国税の延滞税とは区切りも率も違う。
const PENSION_DELINQUENT_RATES: Record<string, { withinBoundary: number; afterBoundary: number }> = {
  "2024": { withinBoundary: 2.4, afterBoundary: 8.7 },
  "2025": { withinBoundary: 2.4, afterBoundary: 8.7 },
  "2026": { withinBoundary: 2.4, afterBoundary: 8.7 },
};

export const PENALTY_RATES_AS_OF = "2026-09-03";

function addMonthsToDate(date: string, months: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  const shifted = new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay)));
  return isoDate(shifted);
}

export type DelinquencyKind = "national_tax" | "social_insurance";

/**
 * 延滞税（国税）・延滞金（社会保険料）の見込み額。
 * 本税は1万円未満を切り捨て、日数は納期限の翌日から起算日まで、年365日の日割りで積む。
 * 1,000円未満は切り捨て（不徴収）、それ以上は100円未満を切り捨てる。
 * 率が未収録の年をまたぐ場合はnullを返し、金額未取得として扱う。
 */
export function delinquencyEstimateYen(
  principalYen: number,
  dueDate: string,
  asOf: string,
  kind: DelinquencyKind
): number | null {
  const base = Math.floor(principalYen / 10000) * 10000;
  if (base <= 0) return 0;
  if (asOf <= dueDate) return 0;
  const rates = kind === "national_tax" ? NATIONAL_DELINQUENT_RATES : PENSION_DELINQUENT_RATES;
  const boundary = addMonthsToDate(dueDate, kind === "national_tax" ? 2 : 3);
  let total = 0;
  for (let day = addDays(dueDate, 1); day <= asOf; day = addDays(day, 1)) {
    const rate = rates[day.slice(0, 4)];
    if (!rate) return null;
    const percent = day <= boundary ? rate.withinBoundary : rate.afterBoundary;
    total += (base * percent) / 100 / 365;
  }
  const yen = Math.floor(total);
  if (yen < 1000) return 0;
  return Math.floor(yen / 100) * 100;
}

/**
 * 源泉所得税の不納付加算税の見込み額。
 * 納税告知を受けた場合は本税（1万円未満切捨）の10%。100円未満は切り捨て、
 * 全額が5,000円未満なら不徴収。自主納付なら5%だが、安全側の10%で見積もる。
 */
export function withholdingUnderpaymentPenaltyYen(principalYen: number): number {
  const base = Math.floor(principalYen / 10000) * 10000;
  if (base <= 0) return 0;
  const penalty = Math.floor((base * 0.1) / 100) * 100;
  return penalty < 5000 ? 0 : penalty;
}

export type StatutoryPenaltyEstimate = {
  parentSourceKey: string;
  parentTitle: string;
  parentDueDate: string;
  parentAmountYen: number;
  overdueDays: number;
  delinquencyKind: DelinquencyKind;
  delinquencyYen: number | null;
  underpaymentPenaltyYen: number | null;
  totalYen: number | null;
  ratesAsOf: string;
  officialRefs: string[];
  formula: string;
};

const DELINQUENCY_KIND_BY_RULE: Record<string, DelinquencyKind> = {
  withholding_income_tax_special: "national_tax",
  consumption_tax_interim: "national_tax",
  consumption_tax_final: "national_tax",
  corporate_tax_interim: "national_tax",
  corporate_tax_final: "national_tax",
  resident_tax_special_collection: "national_tax",
  monthly_social_insurance: "social_insurance",
};

/**
 * 期限を過ぎて未納の法定納付から、いま積み上がっている加算税・延滞税を見積もる。
 * 労働保険料は延滞金の割合の一次情報を保持していないため対象外にし、督促状が届いたら
 * 実受領の支払義務として登録する運用で拾う。
 */
export function buildStatutoryPenaltyEstimates(
  drafts: StatutoryPaymentDraft[],
  today: string,
  settledParentSourceKeys: string[] = []
): StatutoryPenaltyEstimate[] {
  const settled = new Set(settledParentSourceKeys);
  const estimates: StatutoryPenaltyEstimate[] = [];
  for (const draft of drafts) {
    if (draft.status === "paid" || draft.status === "cancelled") continue;
    if (draft.dueDate >= today) continue;
    if (draft.amountYen == null || draft.amountYen <= 0) continue;
    if (settled.has(draft.sourceKey)) continue;
    const ruleKey = String(draft.payload.ruleKey ?? "");
    const kind = DELINQUENCY_KIND_BY_RULE[ruleKey];
    if (!kind) continue;
    const delinquency = delinquencyEstimateYen(draft.amountYen, draft.dueDate, today, kind);
    const penalty = ruleKey === "withholding_income_tax_special"
      ? withholdingUnderpaymentPenaltyYen(draft.amountYen)
      : null;
    const total = delinquency == null ? null : delinquency + (penalty ?? 0);
    estimates.push({
      parentSourceKey: draft.sourceKey,
      parentTitle: draft.title,
      parentDueDate: draft.dueDate,
      parentAmountYen: draft.amountYen,
      overdueDays: Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${draft.dueDate}T00:00:00Z`)) / 86400000),
      delinquencyKind: kind,
      delinquencyYen: delinquency,
      underpaymentPenaltyYen: penalty,
      totalYen: total,
      ratesAsOf: PENALTY_RATES_AS_OF,
      officialRefs: kind === "national_tax"
        ? [NTA_DELINQUENT_TAX_URL, ...(penalty != null ? [NTA_WITHHOLDING_PENALTY_URL] : [])]
        : [PENSION_DELINQUENT_URL],
      formula: kind === "national_tax"
        ? "本税(1万円未満切捨) × 延滞税の割合 × 経過日数 ÷ 365。納期限の翌日から2か月までと以後で割合が変わる"
        : "保険料(1万円未満切捨) × 延滞金の割合 × 経過日数 ÷ 365。納期限の翌日から3か月までと以後で割合が変わる",
    });
  }
  return estimates;
}

export function buildAmdStatutoryPaymentDrafts(input: BuildStatutoryPaymentsInput): StatutoryPaymentDraft[] {
  const horizonYm = addMonthsToStatutoryYm(ymFromDate(input.today), Math.max(1, input.horizonMonths));
  return [
    ...withholdingDrafts(input, horizonYm),
    ...socialInsuranceDrafts(input, horizonYm),
    ...residentTaxDrafts(input, horizonYm),
    ...laborInsuranceDrafts(input, horizonYm),
    ...taxDrafts(input, horizonYm),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.sourceKey.localeCompare(b.sourceKey));
}
