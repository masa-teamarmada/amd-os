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
      },
    });
  }
  return drafts;
}

function taxDrafts(input: BuildStatutoryPaymentsInput, horizonYm: string): StatutoryPaymentDraft[] {
  const forecastByYm = new Map(input.taxForecasts.map((row) => [row.ym, row]));
  const forecastForBaseYm = (baseYm: string) => {
    const paymentYm = ymFromDate(statutoryEndOfMonthDueDate(baseYm));
    return forecastByYm.get(paymentYm) ?? forecastByYm.get(baseYm);
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
        payload: { ruleKey: "consumption_tax_final", fiscalStartYm, amountFormula: "management monthly forecast" },
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
        payload: { ruleKey: "corporate_tax_final", fiscalStartYm, amountFormula: "management monthly forecast" },
      });
    }
  }
  return drafts;
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
