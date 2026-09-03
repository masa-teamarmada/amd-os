import assert from "node:assert/strict";
import {
  extractPaymentAmount,
  extractPaymentDueDate,
  gmailObligationSourceKey,
  isUnsettledStatutoryPayment,
  notificationStage,
  parsePaymentEmail,
  shouldSendNudgeOnStage,
} from "../src/lib/finance/payment-obligations.ts";
import {
  buildAmdStatutoryPaymentDrafts,
  buildStatutoryPenaltyEstimates,
  delinquencyEstimateYen,
  nextStatutoryBusinessDay,
  statutoryEndOfMonthDueDate,
  withholdingUnderpaymentPenaltyYen,
} from "../src/lib/finance/statutory-payment-rules.ts";
import { runMonthlyPlSimulation } from "../src/lib/finance/monthly-pl-simulation.ts";
import {
  buildPaymentMatrix,
  fiscalWindowFor,
  paymentKindOf,
  type PaymentLedgerRow,
} from "../src/lib/finance/payment-ledger.ts";
import { buildPaymentLedger, freeeStatusLabel, isPenaltyObligationTitle } from "../src/lib/finance/payment-ledger.ts";

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
    { ym: "202702", consumptionTaxYen: 1689315, corporateTaxYen: 70000 },
    { ym: "202703", consumptionTaxYen: 0, corporateTaxYen: 0 },
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
const shiftedSettlement = buildAmdStatutoryPaymentDrafts({
  today: "2026-07-16",
  horizonMonths: 18,
  fiscalYearStartMonth: 1,
  previousCorporateTaxYen: 72000,
  previousConsumptionTaxYen: 810400,
  payrollMonths: [],
  paymentEvidence: [],
  taxForecasts: [
    { ym: "202702", consumptionTaxYen: 0, corporateTaxYen: 0 },
    { ym: "202703", consumptionTaxYen: 302609, corporateTaxYen: 70000 },
  ],
});
assert.equal(shiftedSettlement.find((row) => row.sourceKey === "statutory:consumption-tax:final:202601")?.amountYen, 302609);
assert.equal(shiftedSettlement.find((row) => row.sourceKey === "statutory:corporate-tax:final:202601")?.amountYen, 70000);
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

// ── 加算税・延滞税の見込み ──────────────────────────────────
// 不納付加算税は本税の1万円未満を切り捨てて10%、100円未満は切り捨て、5,000円未満は不徴収。
assert.equal(withholdingUnderpaymentPenaltyYen(325500), 32000);
assert.equal(withholdingUnderpaymentPenaltyYen(269999), 26000);
assert.equal(withholdingUnderpaymentPenaltyYen(49000), 0, "加算税が5,000円未満なら課されない");
assert.equal(withholdingUnderpaymentPenaltyYen(0), 0);

// 延滞税は納期限の翌日から起算し、2か月を境に割合が変わる。令和8年は2.8%と9.1%。
assert.equal(delinquencyEstimateYen(325500, "2026-07-10", "2026-07-10", "national_tax"), 0, "納期限当日は発生しない");
assert.equal(delinquencyEstimateYen(325500, "2026-07-10", "2026-08-10", "national_tax"), 0, "全額が1,000円未満なら切り捨てる");
// 納期限の翌日から55日。2か月を越えていないので低いほうの割合だけが乗る。
const within = delinquencyEstimateYen(325500, "2026-07-10", "2026-09-03", "national_tax");
assert.equal(within, Math.floor(Math.floor(((320000 * 2.8) / 100 / 365) * 55) / 100) * 100);
assert.equal(within, 1300);
// 2か月の境目は2026-09-10。そこまでが62日、翌日から年末までの112日は高いほうの割合になる。
const across = delinquencyEstimateYen(325500, "2026-07-10", "2026-12-31", "national_tax");
assert.equal(across, Math.floor(Math.floor(((320000 * 2.8) / 100 / 365) * 62 + ((320000 * 9.1) / 100 / 365) * 112) / 100) * 100);
assert.equal(across, 10400);
assert.equal(delinquencyEstimateYen(325500, "2026-07-10", "2030-01-01", "national_tax"), null, "割合が未収録の年は見積もらない");
// 社会保険料の延滞金は3か月区切りで割合も違う。
assert.notEqual(
  delinquencyEstimateYen(304119, "2026-05-31", "2026-09-03", "social_insurance"),
  delinquencyEstimateYen(304119, "2026-05-31", "2026-09-03", "national_tax"),
);

const penaltyBase = [
  {
    sourceKey: "statutory:withholding-income-tax:special:2026-h1",
    title: "源泉所得税（納期の特例・1-6月分）",
    counterparty: "税務署",
    category: "tax" as const,
    amountYen: 325500,
    amountStatus: "exact" as const,
    dueDate: "2026-07-10",
    status: "open" as const,
    cashflowTreatment: "additive" as const,
    budgetCategory: null,
    autoDebit: false,
    sourceRef: "",
    confidence: 1,
    paidAt: null,
    paidAmountYen: null,
    payload: { ruleKey: "withholding_income_tax_special" },
  },
  {
    sourceKey: "statutory:social-insurance:202605",
    title: "社会保険料（2026年5月分）",
    counterparty: "日本年金機構",
    category: "social_insurance" as const,
    amountYen: 334818,
    amountStatus: "exact" as const,
    dueDate: "2026-06-30",
    status: "paid" as const,
    cashflowTreatment: "included_in_budget" as const,
    budgetCategory: null,
    autoDebit: false,
    sourceRef: "",
    confidence: 1,
    paidAt: "2026-07-16T00:00:00+09:00",
    paidAmountYen: 334818,
    payload: { ruleKey: "monthly_social_insurance" },
  },
];
const penalties = buildStatutoryPenaltyEstimates(penaltyBase, "2026-09-03");
assert.equal(penalties.length, 1, "納付済みには見込みを作らない");
assert.equal(penalties[0].parentSourceKey, "statutory:withholding-income-tax:special:2026-h1");
assert.equal(penalties[0].underpaymentPenaltyYen, 32000);
assert.equal(penalties[0].overdueDays, 55);
assert.equal(penalties[0].totalYen, 32000 + (penalties[0].delinquencyYen ?? 0));
assert.equal(
  buildStatutoryPenaltyEstimates(penaltyBase, "2026-09-03", ["statutory:withholding-income-tax:special:2026-h1"]).length,
  0,
  "賦課決定通知を受け取った親には見込みを重ねない",
);
assert.equal(buildStatutoryPenaltyEstimates(penaltyBase, "2026-07-10").length, 0, "期限内は見込みを作らない");

// ── 期限超過の督促 ────────────────────────────────────
// 超過中は毎日段階が変わるが、送るのは1・3・7・14日、以降は7日ごと。
assert.equal(shouldSendNudgeOnStage("overdue-1-days"), true);
assert.equal(shouldSendNudgeOnStage("overdue-2-days"), false);
assert.equal(shouldSendNudgeOnStage("overdue-7-days"), true);
assert.equal(shouldSendNudgeOnStage("overdue-14-days"), true);
assert.equal(shouldSendNudgeOnStage("overdue-15-days"), false);
// 2週間を超えると段階そのものが週単位になる。週が変わった最初の実行で必ず1通届く。
assert.deepEqual(
  notificationStage({ status: "open", due_date: "2026-07-10", due_date_precision: "day", expected_payment_ym: "202607", amount_status: "exact" }, "2026-09-03"),
  { scheduleKey: "2026-07-10", stage: "overdue-week-7" },
);
assert.deepEqual(
  notificationStage({ status: "open", due_date: "2026-07-10", due_date_precision: "day", expected_payment_ym: "202607", amount_status: "exact" }, "2026-09-04"),
  { scheduleKey: "2026-07-10", stage: "overdue-week-8" },
);
assert.equal(shouldSendNudgeOnStage("overdue-week-7"), true);
assert.equal(shouldSendNudgeOnStage("7-days-before"), true, "期限前の段階はそのまま送る");
assert.equal(shouldSendNudgeOnStage("needs-review"), true);

// 納期限を過ぎた法定納付だけが、通知の既定停止を越えて送られる。
const overdueTax = { source_kind: "statutory_rule", category: "tax", due_date: "2026-07-10", status: "open" } as never;
assert.equal(isUnsettledStatutoryPayment(overdueTax, "2026-09-03"), true);
assert.equal(isUnsettledStatutoryPayment(overdueTax, "2026-07-01"), false, "期限内は対象外");
assert.equal(
  isUnsettledStatutoryPayment({ source_kind: "statutory_rule", category: "tax", due_date: "2026-07-10", status: "paid" } as never, "2026-09-03"),
  false,
  "納付済みは対象外",
);
assert.equal(
  isUnsettledStatutoryPayment({ source_kind: "gmail", category: "tax", due_date: "2026-07-10", status: "open" } as never, "2026-09-03"),
  false,
  "メール由来の候補は法定納付として督促しない",
);
assert.equal(
  isUnsettledStatutoryPayment({ source_kind: "statutory_rule", category: "social_insurance", due_date: "2026-08-31", status: "needs_review" } as never, "2026-09-03"),
  true,
);

// ── 納付ページの読み取りモデル ────────────────────────────
const ledgerObligation = (overrides: Record<string, unknown>) => ({
  id: String(overrides.id ?? "x"),
  source_key: String(overrides.source_key ?? "k"),
  title: String(overrides.title ?? "t"),
  counterparty: "税務署",
  category: "tax",
  amount_yen: 100000,
  amount_status: "exact",
  due_date: "2026-07-10",
  due_date_precision: "day",
  expected_payment_ym: "202607",
  status: "open",
  cashflow_treatment: "additive",
  budget_category: null,
  auto_debit: false,
  owner_member_id: null,
  source_kind: "statutory_rule",
  source_ref: null,
  confidence: 1,
  paid_at: null,
  paid_amount_yen: null,
  payload: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-09-03T00:00:00Z",
  ...overrides,
}) as never;

const ledger = buildPaymentLedger([
  ledgerObligation({ id: "a", source_key: "statutory:withholding-income-tax:special:2026-h1", title: "源泉所得税（納期の特例・1-6月分）", amount_yen: 325500, payload: { penaltyEstimate: { totalYen: 1300, delinquencyYen: 1300, underpaymentPenaltyYen: 0 } } }),
  ledgerObligation({ id: "b", source_key: "mail-notice:x", title: "源泉所得税 不納付加算税（2026年1-6月分）", amount_yen: 26500, due_date: "2026-09-30", source_kind: "mail_notice", payload: { penaltyForSourceKey: "statutory:withholding-income-tax:special:2026-h1" } }),
  ledgerObligation({ id: "c", source_key: "statutory:social-insurance:202604", title: "社会保険料（2026年4月分）", category: "social_insurance", amount_yen: 334818, due_date: "2026-06-01", status: "paid", paid_at: "2026-06-15T15:00:00Z", paid_amount_yen: 334818 }),
  ledgerObligation({ id: "d", source_key: "statutory:corp", title: "法人税等（確定納付）", amount_yen: 70000, due_date: "2027-03-01" }),
  ledgerObligation({ id: "e", source_key: "cancelled", title: "取消済み", status: "cancelled" }),
  ledgerObligation({ id: "f", source_key: "other", title: "カード請求", category: "card_payment" }),
  ledgerObligation({ id: "g", source_key: "no-date", title: "期限未確定", due_date: null, due_date_precision: "unknown", expected_payment_ym: null }),
], "2026-09-03");

assert.equal(ledger.rows.length, 5, "税・社会保険だけを対象にし、取消は落とす");
const ledgerById = new Map(ledger.rows.map((row) => [row.id, row]));
assert.equal(ledgerById.get("a")?.state, "overdue");
assert.equal(ledgerById.get("a")?.overdueDays, 55);
assert.equal(ledgerById.get("a")?.penaltyNotices.length, 1, "届いた加算税を元の納付へ紐づける");
assert.equal(ledgerById.get("a")?.penaltyNotices[0]?.amountYen, 26500);
assert.equal(ledgerById.get("b")?.isPenalty, true);
assert.equal(ledgerById.get("c")?.state, "paid");
assert.equal(ledgerById.get("d")?.state, "upcoming");
assert.equal(ledgerById.get("g")?.state, "needs_review", "期限を作れない行も落とさない");
assert.equal(ledger.rows.at(-1)?.id, "g", "期限が無い行は最後に置く");
assert.equal(ledger.summary.overdueCount, 2, "期限超過と要確認を未決として数える");
assert.equal(ledger.summary.overdueYen, 325500 + 100000);
assert.equal(ledger.summary.upcomingYen, 26500 + 70000);
assert.equal(ledger.summary.paidYen, 334818);
assert.equal(ledger.summary.penaltyEstimateYen, 1300);
assert.equal(ledger.summary.penaltyNoticeYen, 26500);

assert.equal(isPenaltyObligationTitle("源泉所得税 不納付加算税（2026年1-6月分）"), true);
assert.equal(isPenaltyObligationTitle("健康保険・厚生年金保険料 延滞金"), true);
assert.equal(isPenaltyObligationTitle("社会保険料（2026年7月分）"), false);
assert.equal(freeeStatusLabel(1), "freeeで消込待ち");
assert.equal(freeeStatusLabel(2), "freeeで消込済み");
assert.equal(freeeStatusLabel(null), null);

// メール由来の候補は、人の確認が付いた行だけを納付として数える。
const mailLedger = buildPaymentLedger([
  ledgerObligation({ id: "m1", source_key: "gmail-obligation:noise", title: "高機能素材Week 来場登録受付中", amount_yen: 5000, due_date: "2026-09-30", source_kind: "gmail" }),
  ledgerObligation({ id: "m2", source_key: "gmail-obligation:reviewed", title: "納付書が届いた件", amount_yen: 12000, due_date: "2026-09-30", source_kind: "gmail", reviewed_at: "2026-09-01T00:00:00Z" }),
  ledgerObligation({ id: "m3", source_key: "statutory:x", title: "源泉所得税（納期の特例・7-12月分）", amount_yen: 278460, due_date: "2027-01-20" }),
], "2026-09-03");
assert.equal(mailLedger.rows.length, 2, "未確認のメール候補は納付として数えない");
assert.equal(mailLedger.summary.unreviewedMailCandidateCount, 1, "除外した件数は隠さず出す");
assert.deepEqual(mailLedger.rows.map((row) => row.id).sort(), ["m2", "m3"]);
assert.equal(mailLedger.summary.upcomingYen, 12000 + 278460);

// ── 月 × 種類の集計 ──────────────────────────────────
// 12月決算なら今期は1月から12月。3月決算なら4月から翌年3月。
assert.deepEqual(fiscalWindowFor("2026-09-04", 12), { startYm: "202601", endYm: "202612" });
assert.deepEqual(fiscalWindowFor("2026-01-05", 12), { startYm: "202601", endYm: "202612" });
assert.deepEqual(fiscalWindowFor("2026-09-04", 3), { startYm: "202604", endYm: "202703" });
assert.deepEqual(fiscalWindowFor("2026-02-01", 3), { startYm: "202504", endYm: "202603" });

assert.equal(paymentKindOf({ sourceKey: "statutory:withholding-income-tax:special:2026-h1", title: "源泉所得税（納期の特例・1-6月分）", isPenalty: false }), "withholding");
assert.equal(paymentKindOf({ sourceKey: "statutory:social-insurance:202607", title: "社会保険料（2026年7月分）", isPenalty: false }), "social_insurance");
assert.equal(paymentKindOf({ sourceKey: "statutory:consumption-tax:interim:202601", title: "消費税等（中間納付）", isPenalty: false }), "consumption_tax");
assert.equal(paymentKindOf({ sourceKey: "mail-notice:2026-08-31:x", title: "源泉所得税 不納付加算税（2026年1-6月分）", isPenalty: true }), "penalty", "加算税は元の税目に混ぜない");
assert.equal(paymentKindOf({ sourceKey: "manual:x", title: "法人県民税（均等割）", isPenalty: false }), "corporate_tax", "手で登録した納付書は名前で拾う");
assert.equal(paymentKindOf({ sourceKey: "manual:x", title: "なにかの納付", isPenalty: false }), "other", "分類できない納付も消さない");

const ledgerRow = (overrides: Partial<PaymentLedgerRow>): PaymentLedgerRow => ({
  id: overrides.id ?? "r1",
  sourceKey: overrides.sourceKey ?? "statutory:social-insurance:202602",
  title: overrides.title ?? "社会保険料（2026年2月分）",
  counterparty: "日本年金機構",
  category: "social_insurance",
  amountYen: overrides.amountYen ?? 333366,
  amountStatus: overrides.amountStatus ?? "exact",
  dueDate: overrides.dueDate ?? "2026-03-02",
  dueDatePrecision: "day",
  expectedPaymentYm: overrides.expectedPaymentYm ?? null,
  state: overrides.state ?? "paid",
  overdueDays: null,
  paidAt: null,
  paidAmountYen: overrides.paidAmountYen ?? null,
  sourceRef: null,
  sourceKind: "statutory_rule",
  isPenalty: overrides.isPenalty ?? false,
  penaltyForSourceKey: null,
  settlement: null,
  penaltyEstimate: null,
  penaltyNotices: [],
  ...overrides,
});

const matrix = buildPaymentMatrix([
  ledgerRow({ id: "a", dueDate: "2026-03-02", amountYen: 333366, state: "paid", paidAmountYen: 333366 }),
  ledgerRow({ id: "b", dueDate: "2026-07-10", sourceKey: "statutory:withholding-income-tax:special:2026-h1", title: "源泉所得税（納期の特例・1-6月分）", amountYen: 325500, state: "overdue" }),
  ledgerRow({ id: "c", dueDate: "2026-07-31", amountYen: 304119, state: "paid", paidAmountYen: 304119 }),
  ledgerRow({ id: "d", dueDate: "2026-09-30", sourceKey: "mail-notice:2026-08-31:x", title: "源泉所得税 不納付加算税（2026年1-6月分）", amountYen: 26500, state: "due_soon", isPenalty: true }),
  ledgerRow({ id: "e", dueDate: "2028-02-29", amountYen: 912633, state: "upcoming" }),
], "2026-09-04", 12);

assert.equal(matrix.months.length, 12);
assert.equal(matrix.startYm, "202601");
assert.equal(matrix.endYm, "202612");
assert.equal(matrix.outsideCount, 1, "今期の外に期日がある行は表に混ぜず件数だけ残す");
const march = matrix.months.find((row) => row.ym === "202603");
assert.equal(march?.cells.social_insurance.state, "paid");
assert.equal(march?.cells.social_insurance.paidYen, 333366);
assert.equal(march?.cells.withholding.state, "none");
const july = matrix.months.find((row) => row.ym === "202607");
assert.equal(july?.cells.withholding.state, "overdue");
assert.equal(july?.cells.withholding.unpaidYen, 325500);
assert.equal(july?.cells.social_insurance.state, "paid");
assert.equal(july?.totals.totalYen, 325500 + 304119);
const september = matrix.months.find((row) => row.ym === "202609");
assert.equal(september?.cells.penalty.state, "scheduled");
// 期限前でも金額や期日が確認できていないものは、期限超過と同じ色にしない。
const reviewMatrix = buildPaymentMatrix([
  ledgerRow({ id: "f", dueDate: "2026-09-30", amountYen: 304119, state: "needs_review" }),
], "2026-09-04", 12);
assert.equal(reviewMatrix.months.find((row) => row.ym === "202609")?.cells.social_insurance.state, "review");
assert.equal(september?.cells.penalty.totalYen, 26500);
assert.equal(matrix.kindTotals.social_insurance.totalYen, 333366 + 304119);
assert.equal(matrix.kindTotals.social_insurance.unpaidYen, 0);
assert.equal(matrix.kindTotals.withholding.unpaidYen, 325500);
assert.equal(matrix.kindTotals.penalty.totalYen, 26500);
assert.equal(matrix.totals.totalYen, 333366 + 325500 + 304119 + 26500);
assert.equal(matrix.totals.unpaidYen, 325500 + 26500);

console.log("payment obligation checks passed");
