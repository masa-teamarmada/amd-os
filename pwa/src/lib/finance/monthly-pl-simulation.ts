export type BudgetInputKind =
  | "params"
  | "project"
  | "project_revenue"
  | "fixed_cost"
  | "var_cost"
  | "loan"
  | "spot"
  | "scenario";

export interface MonthlyPlParams {
  startYm: number;
  months: number;
  rateAmd?: number;
  rateCloser: number;
  rateMember: number;
  initialCash: number;
  socialInsRate?: number;
  corpTaxEffectiveRate?: number;
  minCorpTax?: number;
  carryforwardLoss?: number;
  prevCorpTax?: number;
  prevConsumptionTax?: number;
  unpaidConsumptionTax?: number;
  unpaidCorpTax?: number;
  fiscalYearStartMonth?: number;
}

export interface MonthlyPlProject {
  projectId: string;
  projectName: string;
  monthlyRevenue: number;
  startYm: number;
  endYm?: number | null;
  type?: "fixed" | "spot" | string;
  memo?: string;
  internalMemberCost?: number | null;
  closerInternal?: boolean | string | null;
  status?: "confirmed" | "tentative" | string;
  billingType?: "monthly" | "annual_march" | string;
  cashDelayMonths?: number | null;
  cashStartYm?: number | null;
}

export interface MonthlyPlFixedCost {
  costId: string;
  costName: string;
  monthlyCost: number;
  startYm: number;
  endYm?: number | null;
  costType?: CostType;
  memo?: string;
}

export interface MonthlyPlScenarioOverride {
  scenarioId: string;
  scenarioName?: string;
  paramKey: string;
  paramValue: string | number | boolean | null;
}

export interface MonthlyPlVarCost {
  varCostId: string;
  costName: string;
  ym: number;
  amount: number;
  costType?: CostType;
  memo?: string;
}

export interface MonthlyPlProjectRevenue {
  projectId: string;
  ym: number;
  monthlyRevenue?: number | null;
  internalMemberCost?: number | null;
  /**
   * 別財布（別契約）売上。定額/変動の本契約売上とは別枠で、その月だけ revenue に加算される。
   * monthlyRevenue (= 上書き・持続) と違い「立つ月だけ加算」セマンティクス (spot と同じ)。
   * 原価は cap_extra プールの uncapped 報酬として internalMemberCost 経由で別途計上済みなので、
   * extraRevenue には rateMember/rateCloser の自動原価計算を **通さない** (二重計上を防ぐ)。
   * 開発期間按分は live-inputs 層 (live-monthly-pl-inputs.ts) で総額÷期間月数を各月行に展開して
   * 注入する (= pt消化と同じ「期間で割る」思想)。エンジンはここで来た ym ごとの額を素直に加算する。
   * 実例: OkuDoor システム開発 ¥2,000,000 (p19, 開発期間 202605〜202610 を6ヶ月按分≒¥333,333/月)。
   */
  extraRevenue?: number | null;
  /**
   * 別財布売上のキャッシュ入金。extraRevenue は PL の開発期間按分、extraRevenueCash は請求/入金予定月。
   * 予実差分を壊さないため、キャッシュ残高(予算)だけこの値を使い、PL 売上は extraRevenue を使う。
   */
  extraRevenueCash?: number | null;
  extraRevenueMemo?: string | null;
  extraRevenueCashMemo?: string | null;
  memo?: string;
}

export interface MonthlyPlLoan {
  loanId: string;
  loanName: string;
  principal: number;
  annualRate: number;
  totalPayments: number;
  startYm: number;
  method?: "equal_payment" | "equal_principal" | string;
  disbursementYm?: number | null;
  memo?: string;
}

export interface MonthlyPlSpot {
  spotId: string;
  spotName: string;
  ym: number;
  amount: number;
  direction: "income" | "expense" | string;
  costType?: CostType;
  memo?: string;
}

export type CostType = "taxable" | "executive" | "salary" | "exempt" | string;

export interface MonthlyPlInputs {
  params: MonthlyPlParams;
  projects: MonthlyPlProject[];
  fixedCosts: MonthlyPlFixedCost[];
  scenarios?: MonthlyPlScenarioOverride[];
  varCosts?: MonthlyPlVarCost[];
  projectRevenues?: MonthlyPlProjectRevenue[];
  loans?: MonthlyPlLoan[];
  spots?: MonthlyPlSpot[];
}

export interface MonthlyPlProjectDetail {
  projectId: string;
  revenue: number;
  cashRevenue?: number;
  externalMember?: number;
  internalMember?: number;
  /** 別財布（別契約）売上の内訳。revenue にはこの額が含まれる。 */
  extraRevenue?: number;
}

export interface MonthlyPlFixedCostDetail {
  name: string;
  amount: number;
}

export interface MonthlyPlRow {
  ym: number;
  revenue: number;
  costMember: number;
  costCloser: number;
  grossProfit: number;
  fixedCost: number;
  socialIns: number;
  operatingProfit: number;
  loanPayment: number;
  loanInterest: number;
  ctaxPayment: number;
  corpTaxPayment: number;
  netCashFlow: number;
  cashBalance: number;
  runway: number;
  loanDisbursement: number;
  spotIncome: number;
  spotExpense: number;
  cashInflow: number;
  cashOutflow: number;
  pjDetails: MonthlyPlProjectDetail[];
  fixedCostDetails: MonthlyPlFixedCostDetail[];
}

export interface MonthlyPlProjectListItem {
  projectId: string;
  projectName: string;
  closerInternal: boolean;
  billingType: string;
  cashDelayMonths?: number | null;
  cashStartYm?: number | null;
}

export interface MonthlyPlSimulationResult {
  params: MonthlyPlParams;
  rows: MonthlyPlRow[];
  projectList: MonthlyPlProjectListItem[];
}

export interface CompanyBudgetMonthlyRow {
  ym: string;
  scope: "company" | "project";
  project_id: string | null;
  category: string;
  account_name: string | null;
  budget_amount_yen: number;
  cash_amount_yen: number | null;
  runway_months: number | null;
  payload: Record<string, unknown>;
}

interface LoanScheduleRow {
  ym: number;
  payment: number;
  interest: number;
  principalPart: number;
  remainingBalance: number;
}

function numberOr(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boolLike(value: unknown): boolean {
  return value === true || value === "TRUE" || value === "true" || value === "1" || value === 1;
}

export function nextYm(ym: number): number {
  let year = Math.floor(ym / 100);
  let month = ym % 100;
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return year * 100 + month;
}

function addMonthsToYm(ym: number, delta: number): number {
  const year = Math.floor(ym / 100);
  const month = ym % 100;
  const zeroBasedMonth = year * 12 + (month - 1) + Math.floor(delta);
  const nextYear = Math.floor(zeroBasedMonth / 12);
  const nextMonth = zeroBasedMonth % 12 + 1;
  return nextYear * 100 + nextMonth;
}

function isActive(ym: number, startYm: number, endYm?: number | null): boolean {
  if (ym < startYm) return false;
  if (endYm && ym > endYm) return false;
  return true;
}

function applyScenario(
  params: MonthlyPlParams,
  projects: MonthlyPlProject[],
  fixedCosts: MonthlyPlFixedCost[],
  overrides: MonthlyPlScenarioOverride[]
) {
  for (const override of overrides) {
    const key = override.paramKey;
    const dotIdx = key.indexOf(".");
    const val = optionalNumber(override.paramValue) ?? override.paramValue;

    if (dotIdx < 0) {
      (params as unknown as Record<string, unknown>)[key] = val;
      continue;
    }

    const id = key.slice(0, dotIdx);
    const field = key.slice(dotIdx + 1);
    if (id.startsWith("fc")) {
      const target = fixedCosts.find((row) => row.costId === id);
      if (target) (target as unknown as Record<string, unknown>)[field] = val;
    }
    if (id.startsWith("pj")) {
      const target = projects.find((row) => row.projectId === id);
      if (target) (target as unknown as Record<string, unknown>)[field] = val;
    }
  }
}

function resolveVarCostsForYm(varCosts: MonthlyPlVarCost[], ym: number): MonthlyPlVarCost[] {
  const grouped = new Map<string, MonthlyPlVarCost[]>();
  for (const cost of varCosts) {
    const list = grouped.get(cost.varCostId) ?? [];
    list.push(cost);
    grouped.set(cost.varCostId, list);
  }

  const result: MonthlyPlVarCost[] = [];
  for (const entries of grouped.values()) {
    entries.sort((a, b) => a.ym - b.ym);
    let resolved: MonthlyPlVarCost | null = null;
    for (const entry of entries) {
      if (entry.ym <= ym) resolved = entry;
      else break;
    }
    if (resolved && resolved.amount > 0) result.push(resolved);
  }
  return result;
}

function resolveProjectRevenue(
  projectId: string,
  ym: number,
  overrides: MonthlyPlProjectRevenue[],
  defaultRevenue: number
): number {
  let resolved = defaultRevenue;
  for (const override of overrides) {
    if (override.projectId === projectId && override.ym <= ym && override.monthlyRevenue !== null && override.monthlyRevenue !== undefined) {
      resolved = override.monthlyRevenue;
    }
  }
  return resolved;
}

function resolveInternalMemberCost(
  projectId: string,
  ym: number,
  overrides: MonthlyPlProjectRevenue[],
  defaultValue: number | null
): number | null {
  let resolved = defaultValue;
  for (const override of overrides) {
    if (override.projectId === projectId && override.ym <= ym && override.internalMemberCost !== null && override.internalMemberCost !== undefined) {
      resolved = override.internalMemberCost;
    }
  }
  return resolved;
}

function projectRevenueForYm(
  project: MonthlyPlProject,
  ym: number,
  overrides: MonthlyPlProjectRevenue[]
): number {
  if (!isActive(ym, project.startYm, project.endYm)) return 0;
  if (project.type === "spot") return ym === project.startYm ? project.monthlyRevenue : 0;
  return resolveProjectRevenue(project.projectId, ym, overrides, project.monthlyRevenue);
}

/**
 * その月・その PJ の別財布（別契約）売上の合計。
 * monthlyRevenue (上書き・持続) と違い「その月ちょうど (ym 一致)」だけ加算する。
 * 開発期間按分は live-inputs 層で各月行に展開済みなので、ここは ym 一致の額を素直に合算する。
 * 原価は cap_extra プールで別途計上済みなので、ここで rateMember/rateCloser は通さない。
 */
function extraRevenueForYm(
  projectId: string,
  ym: number,
  overrides: MonthlyPlProjectRevenue[]
): number {
  let total = 0;
  for (const override of overrides) {
    if (override.projectId !== projectId || override.ym !== ym) continue;
    const v = override.extraRevenue;
    if (v !== null && v !== undefined && Number.isFinite(v)) total += v;
  }
  return total;
}

/**
 * その月・その PJ の別財布（別契約）キャッシュ入金の合計。
 * PL按分 (extraRevenue) とは分離し、請求/支払サイトから解決した入金月だけに立てる。
 */
function extraRevenueCashForYm(
  projectId: string,
  ym: number,
  overrides: MonthlyPlProjectRevenue[]
): number {
  let total = 0;
  for (const override of overrides) {
    if (override.projectId !== projectId || override.ym !== ym) continue;
    const v = override.extraRevenueCash;
    if (v !== null && v !== undefined && Number.isFinite(v)) total += v;
  }
  return total;
}

function calcLoanSchedule(loan: MonthlyPlLoan): LoanScheduleRow[] {
  const principal = numberOr(loan.principal);
  const monthlyRate = numberOr(loan.annualRate) / 12;
  const payments = Math.max(1, Math.floor(numberOr(loan.totalPayments, 1)));
  const method = loan.method || "equal_payment";
  const schedule: LoanScheduleRow[] = [];
  let ym = loan.startYm;

  if (monthlyRate === 0) {
    const monthlyPay = Math.round(principal / payments);
    let balance = principal;
    for (let i = 0; i < payments; i++) {
      const pay = i === payments - 1 ? balance : monthlyPay;
      balance -= pay;
      schedule.push({ ym, payment: pay, interest: 0, principalPart: pay, remainingBalance: balance });
      ym = nextYm(ym);
    }
    return schedule;
  }

  if (method === "equal_principal") {
    const monthlyPrincipal = Math.round(principal / payments);
    let balance = principal;
    for (let i = 0; i < payments; i++) {
      const interest = Math.round(balance * monthlyRate);
      const principalPart = i === payments - 1 ? balance : monthlyPrincipal;
      const payment = principalPart + interest;
      balance = Math.max(0, balance - principalPart);
      schedule.push({ ym, payment, interest, principalPart, remainingBalance: balance });
      ym = nextYm(ym);
    }
    return schedule;
  }

  let monthlyPayment = Math.round(
    principal * monthlyRate * Math.pow(1 + monthlyRate, payments) /
      (Math.pow(1 + monthlyRate, payments) - 1)
  );
  let balance = principal;
  for (let i = 0; i < payments; i++) {
    const interest = Math.round(balance * monthlyRate);
    let principalPart = monthlyPayment - interest;
    if (i === payments - 1) {
      principalPart = balance;
      monthlyPayment = principalPart + interest;
    }
    balance = Math.max(0, balance - principalPart);
    schedule.push({ ym, payment: monthlyPayment, interest, principalPart, remainingBalance: balance });
    ym = nextYm(ym);
  }
  return schedule;
}

export function runMonthlyPlSimulation(rawInputs: MonthlyPlInputs, scenarioId?: string | null): MonthlyPlSimulationResult {
  const params: MonthlyPlParams = { ...rawInputs.params };
  const projects = rawInputs.projects.map((row) => ({
    ...row,
    monthlyRevenue: numberOr(row.monthlyRevenue),
    startYm: numberOr(row.startYm),
    endYm: optionalNumber(row.endYm),
    internalMemberCost: optionalNumber(row.internalMemberCost),
    cashDelayMonths: optionalNumber(row.cashDelayMonths),
    cashStartYm: optionalNumber(row.cashStartYm),
  }));
  const fixedCosts = rawInputs.fixedCosts.map((row) => ({
    ...row,
    monthlyCost: numberOr(row.monthlyCost),
    startYm: numberOr(row.startYm),
    endYm: optionalNumber(row.endYm),
  }));
  const varCosts = (rawInputs.varCosts ?? []).map((row) => ({
    ...row,
    ym: numberOr(row.ym),
    amount: numberOr(row.amount),
  }));
  const projectRevenues = (rawInputs.projectRevenues ?? [])
    .map((row) => ({
      ...row,
      ym: numberOr(row.ym),
      monthlyRevenue: optionalNumber(row.monthlyRevenue),
      internalMemberCost: optionalNumber(row.internalMemberCost),
      extraRevenue: optionalNumber(row.extraRevenue),
      extraRevenueCash: optionalNumber(row.extraRevenueCash),
    }))
    .sort((a, b) => a.ym - b.ym);
  const loans = (rawInputs.loans ?? []).map((row) => ({
    ...row,
    principal: numberOr(row.principal),
    annualRate: numberOr(row.annualRate),
    totalPayments: numberOr(row.totalPayments),
    startYm: numberOr(row.startYm),
    disbursementYm: optionalNumber(row.disbursementYm),
  }));
  const spots = (rawInputs.spots ?? []).map((row) => ({
    ...row,
    ym: numberOr(row.ym),
    amount: numberOr(row.amount),
  }));

  if (scenarioId) {
    const overrides = (rawInputs.scenarios ?? []).filter((row) => row.scenarioId === scenarioId);
    applyScenario(params, projects, fixedCosts, overrides);
  }

  const startYm = numberOr(params.startYm);
  const months = Math.max(1, Math.floor(numberOr(params.months, 1)));
  const rateMember = numberOr(params.rateMember);
  const rateCloser = numberOr(params.rateCloser);
  let cash = numberOr(params.initialCash);
  const socialInsRate = numberOr(params.socialInsRate, 0.15);
  const corpTaxRate = numberOr(params.corpTaxEffectiveRate, 0.25);
  const minCorpTax = numberOr(params.minCorpTax, 70000);
  let carryforwardLoss = numberOr(params.carryforwardLoss);
  const prevCorpTax = numberOr(params.prevCorpTax);
  const prevCtaxAnnual = numberOr(params.prevConsumptionTax);
  const unpaidCtax = numberOr(params.unpaidConsumptionTax);
  const unpaidCorpTax = numberOr(params.unpaidCorpTax);
  const fyStart = numberOr(params.fiscalYearStartMonth, 1);

  const settlementMonth = fyStart + 1 > 12 ? fyStart + 1 - 12 : fyStart + 1;
  const interimMonth = fyStart + 7 > 12 ? fyStart + 7 - 12 : fyStart + 7;

  let fyCtaxAccum = 0;
  let fyCtaxInterimPaid = 0;
  let fyProfitAccum = 0;
  let lastFyCtaxAnnual = prevCtaxAnnual;
  let lastFyCorpTax = prevCorpTax;
  let lastFyCtaxInterimPaid = lastFyCtaxAnnual > 480000 ? Math.round(lastFyCtaxAnnual / 2) : 0;
  let unpaidCtaxDone = false;
  let unpaidCorpTaxDone = false;

  const loanSchedules = loans.map(calcLoanSchedule);
  const projectList = projects.map((p) => ({
    projectId: p.projectId,
    projectName: p.projectName,
    closerInternal: boolLike(p.closerInternal),
    billingType: p.billingType || "monthly",
    cashDelayMonths: p.cashDelayMonths,
    cashStartYm: p.cashStartYm,
  }));
  const cashRevenueByYm = new Map<number, Map<string, number>>();
  const addCashRevenue = (cashYm: number, projectId: string, amount: number) => {
    const byProject = cashRevenueByYm.get(cashYm) ?? new Map<string, number>();
    byProject.set(projectId, (byProject.get(projectId) ?? 0) + amount);
    cashRevenueByYm.set(cashYm, byProject);
  };

  let scheduleYm = startYm;
  for (let i = 0; i < months; i++) {
    for (const pj of projects) {
      if (pj.billingType === "annual_march") continue;
      const pjRev = projectRevenueForYm(pj, scheduleYm, projectRevenues);
      const pjExtraCash = extraRevenueCashForYm(pj.projectId, scheduleYm, projectRevenues);
      if (pjRev === 0 && pjExtraCash === 0) continue;

      const delay = Math.max(0, Math.floor(pj.cashDelayMonths ?? 0));
      let cashYm = addMonthsToYm(scheduleYm, delay);
      if (pj.cashStartYm && cashYm < pj.cashStartYm) cashYm = pj.cashStartYm;
      if (pjRev > 0) addCashRevenue(cashYm, pj.projectId, pjRev);
      if (pjExtraCash > 0) addCashRevenue(scheduleYm, pj.projectId, pjExtraCash);
    }
    scheduleYm = nextYm(scheduleYm);
  }

  const annualMarchAccum: Record<string, number> = {};
  const rows: MonthlyPlRow[] = [];
  let ym = startYm;

  for (let i = 0; i < months; i++) {
    const month = ym % 100;

    if (month === fyStart && i > 0) {
      lastFyCtaxAnnual = fyCtaxAccum;
      lastFyCtaxInterimPaid = fyCtaxInterimPaid;
      let taxableIncome = fyProfitAccum;
      if (carryforwardLoss > 0 && taxableIncome > 0) {
        const deduction = Math.min(carryforwardLoss, taxableIncome);
        taxableIncome -= deduction;
        carryforwardLoss -= deduction;
      }
      lastFyCorpTax = taxableIncome > 0 ? Math.round(taxableIncome * corpTaxRate) : minCorpTax;
      if (lastFyCorpTax < minCorpTax) lastFyCorpTax = minCorpTax;
      fyCtaxAccum = 0;
      fyCtaxInterimPaid = 0;
      fyProfitAccum = 0;
    }

    let revenue = 0;
    let actualMemberTotal = 0;
    let autoMemberTotal = 0;
    let closerInternalTotal = 0;
    let closerExternalTotal = 0;
    const pjDetails: MonthlyPlProjectDetail[] = [];
    const cashRevenueThisYm = cashRevenueByYm.get(ym) ?? new Map<string, number>();

    for (const pj of projects) {
      const cashRevenue = cashRevenueThisYm.get(pj.projectId) ?? 0;
      if (!isActive(ym, pj.startYm, pj.endYm)) {
        pjDetails.push({ projectId: pj.projectId, revenue: 0, cashRevenue });
        continue;
      }
      // 別財布（別契約）売上: 本契約売上とは別枠で revenue に加算。原価は cap_extra 側で計上済みのため
      // rateMember/rateCloser は通さない (= 自動原価の二重計上を防ぐ)。
      const pjExtra = extraRevenueForYm(pj.projectId, ym, projectRevenues);
      const pjRev = projectRevenueForYm(pj, ym, projectRevenues);
      if (pjRev === 0 && pjExtra === 0) {
        pjDetails.push({ projectId: pj.projectId, revenue: 0, cashRevenue, externalMember: 0, internalMember: 0 });
        continue;
      }

      revenue += pjRev + pjExtra;
      const memberAlloc = Math.round(pjRev * rateMember);
      const intCost = resolveInternalMemberCost(pj.projectId, ym, projectRevenues, pj.internalMemberCost ?? null);
      let pjExternal = 0;
      let pjInternal = 0;
      if (intCost !== null) {
        pjExternal = Math.max(0, memberAlloc - intCost);
        pjInternal = intCost;
        actualMemberTotal += pjExternal;
      } else {
        pjExternal = memberAlloc;
        autoMemberTotal += memberAlloc;
      }
      pjDetails.push({
        projectId: pj.projectId,
        revenue: pjRev + pjExtra,
        cashRevenue,
        externalMember: pjExternal,
        internalMember: pjInternal,
        extraRevenue: pjExtra > 0 ? pjExtra : undefined,
      });

      const closerAmt = Math.round(pjRev * rateCloser);
      if (boolLike(pj.closerInternal)) closerInternalTotal += closerAmt;
      else closerExternalTotal += closerAmt;
    }

    const costMember = actualMemberTotal + autoMemberTotal;
    const costCloser = closerExternalTotal + closerInternalTotal;
    const grossProfit = revenue - costMember - costCloser;

    let fixedCostTotal = 0;
    let taxableFixedCost = 0;
    let socialInsBase = 0;
    const fixedCostDetails: MonthlyPlFixedCostDetail[] = [];

    for (const fc of fixedCosts) {
      if (!isActive(ym, fc.startYm, fc.endYm)) continue;
      fixedCostTotal += fc.monthlyCost;
      fixedCostDetails.push({ name: fc.costName, amount: fc.monthlyCost });
      if (fc.costType === "taxable") taxableFixedCost += fc.monthlyCost;
      if (fc.costType === "executive" || fc.costType === "salary") socialInsBase += fc.monthlyCost;
    }

    for (const vc of resolveVarCostsForYm(varCosts, ym)) {
      fixedCostTotal += vc.amount;
      fixedCostDetails.push({ name: vc.costName, amount: vc.amount });
      if (vc.costType === "taxable") taxableFixedCost += vc.amount;
      if (vc.costType === "executive" || vc.costType === "salary") socialInsBase += vc.amount;
    }

    const socialIns = Math.round(socialInsBase * socialInsRate);
    const operatingProfit = grossProfit - fixedCostTotal - socialIns;

    let loanPayment = 0;
    let loanInterest = 0;
    for (const schedule of loanSchedules) {
      const current = schedule.find((row) => row.ym === ym);
      if (current) {
        loanPayment += current.payment;
        loanInterest += current.interest;
      }
    }

    let loanDisbursement = 0;
    for (const loan of loans) {
      if (loan.disbursementYm === ym) loanDisbursement += loan.principal;
    }

    let spotIncome = 0;
    let spotExpense = 0;
    let spotTaxableIncome = 0;
    let spotTaxableExpense = 0;
    for (const spot of spots) {
      if (spot.ym !== ym) continue;
      if (spot.direction === "income") {
        spotIncome += spot.amount;
        if (spot.costType === "taxable") spotTaxableIncome += spot.amount;
      } else {
        spotExpense += spot.amount;
        if (spot.costType === "taxable") spotTaxableExpense += spot.amount;
      }
    }

    const profitAfterInterest = operatingProfit - loanInterest + spotIncome - spotExpense;
    fyProfitAccum += profitAfterInterest;

    const ctaxReceived = Math.round((revenue + spotTaxableIncome) * 0.1);
    const ctaxPaidOnCost = Math.round((costMember + closerExternalTotal + taxableFixedCost + spotTaxableExpense) * 0.1);
    const ctaxDelta = ctaxReceived - ctaxPaidOnCost;
    fyCtaxAccum += ctaxDelta;

    let ctaxPayment = 0;
    let corpTaxPayment = 0;

    if (month === settlementMonth) {
      if (!unpaidCtaxDone && unpaidCtax > 0) {
        ctaxPayment += unpaidCtax;
        unpaidCtaxDone = true;
      } else if (unpaidCtaxDone || i > 0) {
        ctaxPayment += lastFyCtaxAnnual - lastFyCtaxInterimPaid;
      }
      if (!unpaidCorpTaxDone && unpaidCorpTax > 0) {
        corpTaxPayment += unpaidCorpTax;
        unpaidCorpTaxDone = true;
      } else if (unpaidCorpTaxDone || i > 0) {
        const corpInterim = lastFyCorpTax > 200000 ? Math.round(lastFyCorpTax / 2) : 0;
        const corpSettlement = lastFyCorpTax - corpInterim;
        if (corpSettlement > 0) corpTaxPayment += corpSettlement;
      }
    }

    if (month === interimMonth) {
      if (lastFyCtaxAnnual > 480000) {
        const ctaxInterim = Math.round(lastFyCtaxAnnual / 2);
        ctaxPayment += ctaxInterim;
        fyCtaxInterimPaid = ctaxInterim;
      }
      if (lastFyCorpTax > 200000) {
        corpTaxPayment += Math.round(lastFyCorpTax / 2);
      }
    }

    let monthlyBilledRevenue = 0;
    let annualMarchFlush = 0;

    for (const amount of cashRevenueThisYm.values()) {
      monthlyBilledRevenue += amount;
    }

    projects.forEach((project, index) => {
      const pjRev = pjDetails[index]?.revenue ?? 0;
      if (pjRev === 0) return;
      if (project.billingType === "annual_march") {
        annualMarchAccum[project.projectId] = (annualMarchAccum[project.projectId] ?? 0) + pjRev;
        if (month === 3) {
          annualMarchFlush += annualMarchAccum[project.projectId];
          annualMarchAccum[project.projectId] = 0;
        }
      }
    });

    const taxIncomeFlow = Math.round(monthlyBilledRevenue * 1.1) + Math.round(annualMarchFlush * 1.1)
      + Math.round(spotTaxableIncome * 1.1) + (spotIncome - spotTaxableIncome);
    const taxMemberFlow = Math.round(costMember * 1.1);
    const taxCloserExtFlow = Math.round(closerExternalTotal * 1.1);
    const taxFixedFlow = Math.round(taxableFixedCost * 1.1);
    const exemptFixedCost = fixedCostTotal - taxableFixedCost;
    const spotExpenseFlow = Math.round(spotTaxableExpense * 1.1) + (spotExpense - spotTaxableExpense);

    const netCashFlow = taxIncomeFlow
      + loanDisbursement
      - taxMemberFlow
      - taxCloserExtFlow
      - taxFixedFlow
      - exemptFixedCost
      - socialIns
      - spotExpenseFlow
      - loanPayment
      - ctaxPayment
      - corpTaxPayment;

    cash += netCashFlow;

    let confirmedRevenue = 0;
    let confirmedMemberCost = 0;
    let confirmedCloserExt = 0;
    for (const cpj of projects) {
      if (cpj.status === "tentative") continue;
      if (!isActive(ym, cpj.startYm, cpj.endYm)) continue;
      const cpjRev = projectRevenueForYm(cpj, ym, projectRevenues);
      const cpjExtra = extraRevenueForYm(cpj.projectId, ym, projectRevenues);
      confirmedRevenue += cpjRev + cpjExtra;

      const cIntCost = resolveInternalMemberCost(cpj.projectId, ym, projectRevenues, cpj.internalMemberCost ?? null);
      if (cIntCost !== null) {
        confirmedMemberCost += Math.max(0, Math.round(cpjRev * rateMember) - cIntCost);
      } else {
        confirmedMemberCost += Math.round(cpjRev * rateMember);
      }
      const cCloser = Math.round(cpjRev * rateCloser);
      if (!boolLike(cpj.closerInternal)) confirmedCloserExt += cCloser;
    }

    const confirmedGrossInflow = Math.round(confirmedRevenue * 1.1)
      - Math.round(confirmedMemberCost * 1.1)
      - Math.round(confirmedCloserExt * 1.1);
    const monthlyBurn = fixedCostTotal + socialIns + loanPayment;
    const netBurn = monthlyBurn - confirmedGrossInflow;
    const runway = netBurn > 0 ? Math.round((cash / netBurn) * 10) / 10 : 999;

    rows.push({
      ym,
      revenue,
      costMember,
      costCloser,
      grossProfit,
      fixedCost: fixedCostTotal,
      socialIns,
      operatingProfit,
      loanPayment,
      loanInterest,
      ctaxPayment,
      corpTaxPayment,
      netCashFlow,
      cashBalance: cash,
      runway,
      loanDisbursement,
      spotIncome,
      spotExpense,
      cashInflow: taxIncomeFlow + loanDisbursement + (ctaxPayment < 0 ? Math.abs(ctaxPayment) : 0),
      cashOutflow: taxMemberFlow + taxCloserExtFlow + taxFixedFlow + exemptFixedCost + socialIns + spotExpenseFlow + loanPayment + (ctaxPayment > 0 ? ctaxPayment : 0) + corpTaxPayment,
      pjDetails,
      fixedCostDetails,
    });

    ym = nextYm(ym);
  }

  return { params, rows, projectList };
}

function ymText(ym: number): string {
  return String(ym).padStart(6, "0");
}

function companyRow(row: MonthlyPlRow, category: string, amount: number, payload: Record<string, unknown> = {}): CompanyBudgetMonthlyRow {
  return {
    ym: ymText(row.ym),
    scope: "company",
    project_id: null,
    category,
    account_name: null,
    budget_amount_yen: amount,
    cash_amount_yen: row.cashBalance,
    runway_months: row.runway,
    payload,
  };
}

export function toCompanyBudgetMonthlyRows(result: MonthlyPlSimulationResult): CompanyBudgetMonthlyRow[] {
  const rows: CompanyBudgetMonthlyRow[] = [];
  for (const row of result.rows) {
    rows.push(companyRow(row, "revenue", row.revenue));
    rows.push(companyRow(row, "cost_member", row.costMember));
    rows.push(companyRow(row, "cost_closer", row.costCloser));
    rows.push(companyRow(row, "gross_profit", row.grossProfit));
    rows.push(companyRow(row, "fixed_cost", row.fixedCost, { fixedCostDetails: row.fixedCostDetails }));
    rows.push(companyRow(row, "social_insurance", row.socialIns));
    rows.push(companyRow(row, "operating_profit", row.operatingProfit));
    rows.push(companyRow(row, "loan_payment", row.loanPayment));
    rows.push(companyRow(row, "loan_interest", row.loanInterest));
    rows.push(companyRow(row, "tax_payment_consumption", row.ctaxPayment));
    rows.push(companyRow(row, "tax_payment_corporate", row.corpTaxPayment));
    rows.push(companyRow(row, "net_cash_flow", row.netCashFlow, {
      cashInflow: row.cashInflow,
      cashOutflow: row.cashOutflow,
      loanDisbursement: row.loanDisbursement,
      spotIncome: row.spotIncome,
      spotExpense: row.spotExpense,
    }));

    for (const detail of row.pjDetails) {
      rows.push({
        ym: ymText(row.ym),
        scope: "project",
        project_id: detail.projectId,
        category: "project_revenue",
        account_name: null,
        budget_amount_yen: detail.revenue,
        cash_amount_yen: null,
        runway_months: null,
        payload: {
          externalMember: detail.externalMember ?? 0,
          internalMember: detail.internalMember ?? 0,
          cashRevenue: detail.cashRevenue ?? 0,
        },
      });
    }
  }
  return rows;
}
