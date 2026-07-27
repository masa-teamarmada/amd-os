import assert from "node:assert/strict";
import { checkPublishEligibility, safeDeriveCapitalPlan } from "../src/lib/capital-plan.ts";
import {
  SX_BUSINESS_PLAN_PHASES,
  SX_CAPITAL_PLAN_DOCUMENT,
  sxAnnualProjectionWithCash,
  sxPhaseBudgetVariance,
} from "../src/lib/sx-business-plan.ts";

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
for (const year of annual) {
  assert.equal(
    year.operatingExpenseYen,
    year.costOfSalesYen + year.executiveCompensationYen + year.salariesAndBonusesYen + year.researchAndDevelopmentYen + year.sellingGeneralAdministrativeYen,
    `FY${year.fiscalYear}: 営業費用は原価と費目の合計`,
  );
  assert.equal(year.grossProfitYen, year.revenueYen - year.costOfSalesYen, `FY${year.fiscalYear}: 売上総利益を検算`);
  assert.equal(year.pretaxIncomeYen, year.operatingIncomeYen + year.subsidySpecialGainYen - year.subsidyCompressionLossYen, `FY${year.fiscalYear}: 助成金特別損益を分離`);
}

console.log("sx business plan: ok");
