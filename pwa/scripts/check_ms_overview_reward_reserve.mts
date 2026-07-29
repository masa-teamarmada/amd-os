import assert from "node:assert/strict";
import {
  externalUnpaidStockYen,
  fundedNonCashAllocationYen,
} from "../src/lib/reward-finance-summary.ts";
import type { RewardSummary } from "../src/lib/reward-summary.ts";

// SX ¥9,069,525 重複加算バグの回帰テスト (ms-overview route 側)。
// stockYen (月末残高スナップショット) を月次ループで合計すると、支払対象外メンバー配賦が
// 実際の何倍にも膨らむ。rewardSummaryCompanyReserve は当月フローだけを返し、
// rewardSummaryFinalStock は各メンバーの残高を単発で返す (呼び出し側で最終月だけ使う) こと。

function summaryFor(a: number, b: number): RewardSummary {
  return {
    members: [
      {
        memberId: "memberA",
        earnedPt: 10,
        basePay: 100_000,
        bonusPt: 0,
        totalPay: 0,
        companyReserveYen: 100_000, // 当月フロー (毎月同額)
        stockYen: a, // 累積残高 (増え続ける) — 月次合計してはいけない
        payoutExcluded: true,
        breakdown: [],
      },
      {
        memberId: "memberB",
        earnedPt: 5,
        basePay: 50_000,
        bonusPt: 0,
        totalPay: 50_000,
        stockYen: b, // 支払対象メンバーの期末未払残
        payoutExcluded: false,
        breakdown: [],
      },
    ],
    totalPaySum: 50_000,
  };
}

const monthlySummaries = [summaryFor(100_000, 5_000), summaryFor(200_000, 10_000), summaryFor(300_000, 20_000)];

const companyReserveTotal = monthlySummaries.reduce((sum, s) => sum + fundedNonCashAllocationYen(s), 0);
assert.equal(
  companyReserveTotal,
  300_000,
  `company reserve total should be funded-flow sum only (300,000), got ${companyReserveTotal}`
);

// 期末未払残 (支払対象メンバー分) は最終月のスナップショットのみを使うべき — 月次合計しない。
const finalStock = externalUnpaidStockYen(monthlySummaries[monthlySummaries.length - 1]);
assert.equal(finalStock, 20_000, `final stock should be last month's snapshot only (20,000), got ${finalStock}`);

const summedStockAcrossMonths = monthlySummaries.reduce((sum, s) => sum + externalUnpaidStockYen(s), 0);
assert.notEqual(
  summedStockAcrossMonths,
  finalStock,
  "sanity check: summing per-month stock across months must differ from the single final snapshot"
);

console.log("ms-overview route reward reserve/stock double-counting checks passed");
