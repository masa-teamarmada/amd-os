import assert from "node:assert/strict";
import {
  extractPaymentAmount,
  extractPaymentDueDate,
  gmailObligationSourceKey,
  notificationStage,
  parsePaymentEmail,
} from "../src/lib/finance/payment-obligations.ts";
import {
  buildAmdStatutoryPaymentDrafts,
  nextStatutoryBusinessDay,
  statutoryEndOfMonthDueDate,
} from "../src/lib/finance/statutory-payment-rules.ts";
import { runMonthlyPlSimulation } from "../src/lib/finance/monthly-pl-simulation.ts";

assert.equal(extractPaymentAmount("納付額 512,300円"), 512300);
assert.equal(extractPaymentAmount("請求額 ¥12,000 / 合計 ¥13,200"), 13200);
assert.equal(extractPaymentDueDate("納期限 2026年7月10日", "2026-07-01"), "2026-07-10");
assert.equal(extractPaymentDueDate("7月10日まで", "2026-06-30"), "2026-07-10");

const exact = parsePaymentEmail("源泉所得税の納付について", "納期限 2026年7月10日 納付額 512,300円", "2026-07-01");
assert.equal(exact?.status, "open");
assert.equal(exact?.category, "tax");
assert.equal(exact?.amountYen, 512300);
assert.equal(exact?.dueDate, "2026-07-10");

const incomplete = parsePaymentEmail("社会保険料のお支払い", "期日をご確認ください", "2026-07-01");
assert.equal(incomplete?.status, "needs_review");
assert.equal(incomplete?.amountStatus, "unknown");
assert.equal(parsePaymentEmail("カード決済完了", "12,000円の支払完了", "2026-07-01"), null);
assert.equal(parsePaymentEmail("振込入金のご連絡", "318,898円を入金しました", "2026-07-01"), null);
assert.equal(parsePaymentEmail("請求書テンプレートが更新されました", "便利な請求機能です", "2026-07-01"), null);
assert.equal(parsePaymentEmail("サービス仕様変更", "請求APIを更新します", "2026-07-01"), null);
assert.equal(parsePaymentEmail("月次レポート", "税制について解説します", "2026-07-01"), null);
assert.equal(parsePaymentEmail("契約書類の確認", "請求書も添付しました", "2026-07-01"), null);
assert.equal(parsePaymentEmail("ペイジー払い込みのご確認", "社会保険料の納付期限は6月16日でした", "2026-07-01"), null);
assert.equal(parsePaymentEmail("サブスクリプションが更新されました", "次回請求日は7月28日です", "2026-07-01"), null);
assert.equal(parsePaymentEmail("納付の督促", "金額と納期限を確認してください", "2026-07-15")?.status, "needs_review");
assert.equal(parsePaymentEmail("【月会費お振込みのお願い】", "詳細をご確認ください", "2026-07-15")?.status, "needs_review");

const duplicateDebit = {
  senderDomain: "example.jp",
  category: "card_payment",
  amountYen: 318898,
  dueDate: "2026-07-10",
  referenceDate: "2026-07-01",
};
assert.equal(
  gmailObligationSourceKey({ ...duplicateDebit, title: "お引き落としのご連絡" }),
  gmailObligationSourceKey({ ...duplicateDebit, senderDomain: "another.example", title: "引落予定のご案内" })
);

assert.deepEqual(
  notificationStage({ status: "open", due_date: "2026-07-10", due_date_precision: "day", expected_payment_ym: "202607", amount_status: "exact" }, "2026-07-03"),
  { scheduleKey: "2026-07-10", stage: "7-days-before" }
);

assert.equal(nextStatutoryBusinessDay("2027-03-21"), "2027-03-23");
assert.equal(statutoryEndOfMonthDueDate("202702"), "2027-03-01");

const payrollMonths = [
  ["202601", 104400, 333366],
  ["202602", 43700, 333366],
  ["202603", 43810, 331782],
  ["202604", 43590, 334818],
  ["202605", 43590, 334818],
].map(([ym, withholding, social]) => ({
  ym: String(ym),
  withholdingIncomeTaxYen: Number(withholding),
  withholdingObserved: true,
  socialInsuranceYen: Number(social),
  socialInsuranceObserved: true,
  residentTaxYen: null,
  residentTaxObserved: false,
}));
const statutory = buildAmdStatutoryPaymentDrafts({
  today: "2026-07-16",
  horizonMonths: 18,
  fiscalYearStartMonth: 1,
  previousCorporateTaxYen: 72000,
  previousConsumptionTaxYen: 810400,
  payrollMonths,
  paymentEvidence: [
    { kind: "social_insurance", date: "2026-02-18", amountYen: 333366, sourceRef: "social:1" },
    { kind: "social_insurance", date: "2026-03-17", amountYen: 333366, sourceRef: "social:2" },
    { kind: "social_insurance", date: "2026-05-19", amountYen: 331782, sourceRef: "social:3" },
    { kind: "social_insurance", date: "2026-06-16", amountYen: 334818, sourceRef: "social:4" },
    { kind: "labor_insurance", date: "2025-07-11", amountYen: 29056, sourceRef: "labor:2025" },
  ],
  taxForecasts: [
    { ym: "202608", consumptionTaxYen: 405200, corporateTaxYen: 0 },
    { ym: "202703", consumptionTaxYen: 1689315, corporateTaxYen: 70000 },
  ],
});
const withholdingH1 = statutory.find((row) => row.sourceKey === "statutory:withholding-income-tax:special:2026-h1");
assert.equal(withholdingH1?.dueDate, "2026-07-10");
assert.equal(withholdingH1?.amountYen, 322680);
assert.equal(withholdingH1?.amountStatus, "estimated");
assert.equal(withholdingH1?.status, "needs_review");
assert.deepEqual((withholdingH1?.payload.missingMonths as string[]), ["202606"]);
const consumptionInterim = statutory.find((row) => row.sourceKey === "statutory:consumption-tax:interim:202601");
assert.equal(consumptionInterim?.dueDate, "2026-08-31");
assert.equal(consumptionInterim?.amountYen, 405200);
assert.equal(consumptionInterim?.amountStatus, "estimated");
assert.equal(statutory.some((row) => row.sourceKey === "statutory:corporate-tax:interim:202601"), false);
assert.equal(statutory.find((row) => row.sourceKey === "statutory:consumption-tax:final:202601")?.dueDate, "2027-03-01");
assert.equal(statutory.find((row) => row.sourceKey === "statutory:consumption-tax:interim:202701")?.amountYen, 1047258);
assert.equal(statutory.find((row) => row.sourceKey === "statutory:social-insurance:202605")?.status, "needs_review");
assert.deepEqual(
  notificationStage({ status: "open", due_date: "2026-07-10", due_date_precision: "day", expected_payment_ym: "202607", amount_status: "exact" }, "2026-07-16"),
  { scheduleKey: "2026-07-10", stage: "overdue-6-days" }
);

const baseInputs = {
  params: {
    startYm: 202607,
    months: 1,
    rateCloser: 0.05,
    rateMember: 0.65,
    initialCash: 1000000,
    fiscalYearStartMonth: 1,
  },
  projects: [],
  fixedCosts: [],
  paymentObligations: [
    {
      obligationId: "additive",
      title: "追加納付",
      category: "tax",
      amountYen: 500000,
      amountStatus: "estimated" as const,
      dueDate: "2026-07-10",
      expectedPaymentYm: 202607,
      cashflowTreatment: "additive" as const,
      status: "open" as const,
      autoDebit: false,
    },
    {
      obligationId: "included",
      title: "家賃",
      category: "subscription",
      amountYen: 100000,
      amountStatus: "exact" as const,
      dueDate: null,
      expectedPaymentYm: 202607,
      cashflowTreatment: "included_in_budget" as const,
      status: "open" as const,
      autoDebit: true,
    },
  ],
};
const simulation = runMonthlyPlSimulation(baseInputs);
assert.equal(simulation.rows[0].obligationPaymentTotal, 600000);
assert.equal(simulation.rows[0].obligationPaymentAdditive, 500000);
assert.equal(simulation.rows[0].cashBalance, 500000);
assert.equal(simulation.rows[0].cashOutflow, 500000);

const timingSimulation = runMonthlyPlSimulation({
  params: {
    startYm: 202601,
    months: 7,
    rateCloser: 0,
    rateMember: 0,
    initialCash: 1000000,
    fiscalYearStartMonth: 1,
  },
  projects: [],
  fixedCosts: [{ costId: "gross-pay", costName: "給与総額", monthlyCost: 100000, startYm: 202601, endYm: 202606, costType: "exempt" }],
  paymentObligations: [{
    obligationId: "withholding-timing",
    title: "源泉所得税",
    category: "tax",
    amountYen: 600000,
    amountStatus: "exact",
    dueDate: "2026-07-10",
    expectedPaymentYm: 202607,
    cashflowTreatment: "additive",
    status: "open",
    autoDebit: false,
    originCashOffsets: [202601, 202602, 202603, 202604, 202605, 202606].map((ym) => ({ ym, amountYen: 100000, amountStatus: "exact" as const })),
  }],
});
assert.equal(timingSimulation.rows[0].cashOutflow, 0);
assert.equal(timingSimulation.rows[0].cashBalance, 1000000);
assert.equal(timingSimulation.rows[6].cashOutflow, 600000);
assert.equal(timingSimulation.rows[6].cashBalance, 400000);

const weekendSettlement = runMonthlyPlSimulation({
  params: {
    startYm: 202701,
    months: 3,
    rateCloser: 0,
    rateMember: 0,
    initialCash: 2000000,
    fiscalYearStartMonth: 1,
    unpaidConsumptionTax: 810400,
  },
  projects: [],
  fixedCosts: [],
});
assert.equal(weekendSettlement.rows[1].ctaxPayment, 0);
assert.equal(weekendSettlement.rows[2].ctaxPayment, 810400);

console.log("payment obligation checks passed");
