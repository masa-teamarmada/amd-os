import assert from "node:assert/strict";
import { checkPublishEligibility, safeDeriveCapitalPlan } from "../src/lib/capital-plan.ts";
import {
  SX_ANNUAL_PROJECTION,
  SX_BUSINESS_PLAN_PHASES,
  SX_CAPITAL_PLAN_DOCUMENT,
  createSxAnnualProjectionParameters,
  sxAnnualProjectionWithCash,
  sxPhaseBudgetVariance,
} from "../src/lib/sx-business-plan.ts";
import {
  buildSxMonthlyFinanceComments,
  buildSxMonthlyFinancePlan,
  SX_PHASE0_NON_DILUTIVE_FUNDING_YEN,
} from "../src/lib/sx-monthly-finance-plan.ts";

assert.equal(SX_BUSINESS_PLAN_PHASES.length, 5, "SX事業計画は5フェーズ");
for (const phase of SX_BUSINESS_PLAN_PHASES) {
  assert.equal(Object.keys(phase.lanes).length, 4, `${phase.label}: 4開発レーン`);
  assert.equal(sxPhaseBudgetVariance(phase), 0, `${phase.label}: レーン費用合計とフェーズ予算が一致`);
  for (const value of Object.values(phase.targetXrl)) {
    assert.ok(value >= 1 && value <= 8, `${phase.label}: XRLは1〜8`);
  }
}
assert.deepEqual(
  SX_BUSINESS_PLAN_PHASES.map((phase) => phase.targetXrl.grl),
  [1, 3, 5, 6, 8],
  "GRLはSIPの1〜8段階でフェーズごとに到達させる",
);

assert.ok(
  SX_CAPITAL_PLAN_DOCUMENT.holders.every((holder) => !holder.name.includes("中島")),
  "中島先生を株主原案へ含めない",
);

const incorporation = SX_CAPITAL_PLAN_DOCUMENT.events.find((event) => event.id === "sx-incorporation");
assert.ok(incorporation, "設立イベント");
const founderShares = Object.fromEntries(
  incorporation.allocations.map((allocation) => [allocation.holderId, allocation.shares.value]),
);
assert.deepEqual(founderShares, { "sx-ceo": 81_000, "sx-sugiura": 21_600, "sx-amd": 5_400 });

const seed = SX_CAPITAL_PLAN_DOCUMENT.events.find((event) => event.id === "sx-seed");
assert.ok(seed, "Seedイベント");
const seedAmounts = Object.fromEntries(
  seed.allocations.map((allocation) => [allocation.holderId, allocation.amount?.value ?? 0]),
);
assert.deepEqual(seedAmounts, {
  "sx-partners-fund": 75_000_000,
  "sx-iyogin": 40_000_000,
  "sx-davp": 35_000_000,
});
assert.equal(Object.values(seedAmounts).reduce((sum, value) => sum + value, 0), 150_000_000);

const derived = safeDeriveCapitalPlan({ id: "sx-draft", name: "SX原案", ...SX_CAPITAL_PLAN_DOCUMENT });
assert.equal(derived.error, undefined, "資本政策を全ラウンド導出できる");
const eligibility = checkPublishEligibility(derived.plan);
assert.equal(eligibility.blockingIssues.length, 0, "資本政策に凍結ブロッカーがない");

const annual = sxAnnualProjectionWithCash();
assert.equal(annual.length, 9, "FY27〜FY35の9年度");
assert.ok(annual.every((year) => year.closingCashYen >= 0), "簡易期末現預金が途中でマイナスにならない");
assert.deepEqual(
  annual.map(({ sellingGeneralAdministrativeTotalYen: _sellingGeneralAdministrativeTotalYen, operatingExpenseYen: _operatingExpenseYen, grossProfitYen: _grossProfitYen, operatingIncomeYen: _operatingIncomeYen, pretaxIncomeYen: _pretaxIncomeYen, closingCashYen: _closingCashYen, ...year }) => year),
  SX_ANNUAL_PROJECTION,
  "初期パラメータは元の年次試算原案と一致する",
);
for (const year of annual) {
  assert.equal(
    year.operatingExpenseYen,
    year.costOfSalesYen + year.executiveCompensationYen + year.salariesAndBonusesYen + year.researchAndDevelopmentYen + year.sellingGeneralAdministrativeYen,
    `FY${year.fiscalYear}: 営業費用は原価と費目の合計`,
  );
  assert.equal(year.grossProfitYen, year.revenueYen - year.costOfSalesYen, `FY${year.fiscalYear}: 売上総利益を検算`);
  assert.equal(year.pretaxIncomeYen, year.operatingIncomeYen + year.subsidySpecialGainYen - year.subsidyCompressionLossYen, `FY${year.fiscalYear}: 助成金特別損益を分離`);
}

const workforceScenario = createSxAnnualProjectionParameters();
workforceScenario.annualByFiscalYear[2027].executiveHeadcount = 2;
workforceScenario.annualByFiscalYear[2027].employeeAnnualTravelPerPersonYen = 500_000;
workforceScenario.factoryProjects = workforceScenario.factoryProjects.map((factory) => factory.id === "pilot" ? { ...factory, costYen: 50_000_000 } : factory);
const workforceAnnual = sxAnnualProjectionWithCash(workforceScenario);
const workforceFy27 = workforceAnnual.find((year) => year.fiscalYear === 2027)!;
assert.equal(workforceFy27.executiveCompensationYen, 18_000_000, "役員人数×役員報酬が役員報酬へ反映される");
assert.equal(workforceFy27.sellingGeneralAdministrativeYen, 39_200_000, "社員の旅費単価が販管費へ反映される");
assert.equal(workforceFy27.capexYen, 50_000_000, "工場投資額が設備投資へ反映される");
assert.equal(workforceFy27.closingCashYen, 19_800_000, "人件費・旅費・工場費の差分が期末現預金へ反映される");

const ipoScenario = createSxAnnualProjectionParameters();
ipoScenario.ipoFiscalYear = 2034;
ipoScenario.ipoProceedsYen = 8_000_000_000;
const ipoAnnual = sxAnnualProjectionWithCash(ipoScenario);
assert.equal(ipoAnnual.find((year) => year.fiscalYear === 2034)?.equityFundingYen, 8_000_000_000, "IPO時期と調達額が選択年度の株式調達へ反映される");
assert.equal(ipoAnnual.find((year) => year.fiscalYear === 2035)?.equityFundingYen, 0, "IPOを前倒しすると元年度のIPO資金は残らない");

const monthRange: string[] = [];
for (let cursor = 2026 * 12 + 6; cursor <= 2031 * 12 + 7; cursor += 1) {
  monthRange.push(`${Math.floor(cursor / 12)}-${String(cursor % 12 + 1).padStart(2, "0")}`);
}
const monthlyFinance = buildSxMonthlyFinancePlan(monthRange);
const sumFinance = (key: "capexYen" | "equityFundingYen" | "grantReceiptYen" | "nonDilutiveFundingYen") =>
  monthlyFinance.reduce((sum, row) => sum + row[key], 0);
assert.equal(SX_ANNUAL_PROJECTION.find((year) => year.fiscalYear === 2027)?.subsidyCashReceiptYen, 0, "Phase 0 PSI資金をFY2027助成金へ二重計上しない");
assert.equal(sumFinance("nonDilutiveFundingYen"), SX_PHASE0_NON_DILUTIVE_FUNDING_YEN, "Phase 0資金は1回だけ");
assert.equal(sumFinance("capexYen"), 1_060_000_000, "M0〜M60内の設備投資計画をtie-out");
assert.equal(sumFinance("equityFundingYen"), 2_250_000_000, "Seed・Series A・Series Bをラウンド月へ配置");
assert.equal(sumFinance("grantReceiptYen"), 400_000_000, "FY2028・FY2031の助成金入金計画をtie-out");
assert.ok(monthlyFinance.every((row) => row.loanDrawdownYen === null), "融資額は0と捏造せず未計画");
assert.equal(monthlyFinance.find((row) => row.ym === "2028-10")?.equityFundingYen, 600_000_000, "Series AはPhase 2開始月");
const monthlyFinanceComments = buildSxMonthlyFinanceComments(monthRange);
assert.ok(
  monthlyFinanceComments.some((comment) =>
    comment.metric === "equityFundingYen"
    && comment.ym === "2028-10"
    && comment.title === "Series A調達"
    && comment.detail.includes("600百万円")),
  "Series A調達セルの注記を資本政策から再現",
);
assert.ok(
  monthlyFinanceComments.some((comment) =>
    comment.metric === "capexYen"
    && comment.ym === "2031-04"
    && comment.title === "本格自社工場の建設"
    && comment.detail.includes("600百万円")),
  "本格工場建設セルの注記をフェーズ計画から再現",
);
assert.ok(
  monthlyFinanceComments.some((comment) =>
    comment.metric === "grantReceiptYen"
    && comment.detail.includes("受領月は未確認")),
  "助成金計画注記は採択額・受領実績と自動同一視しない",
);

console.log("sx business plan: ok");
