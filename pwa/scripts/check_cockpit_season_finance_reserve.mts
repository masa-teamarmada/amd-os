import assert from "node:assert/strict";
import { buildCockpitSeasonFinance } from "../src/lib/supabase-data.ts";
import type { PlanCycle, RewardSummary } from "../src/lib/supabase-data.ts";
import { computeSeasonPl } from "../src/lib/season-pl.ts";

// SX ¥9,069,525 重複加算バグの回帰テスト。
// stockYen (月末残高スナップショット) は月次合計してはいけない。
// companyReserveYen (支払対象外メンバーの当月割当済み額=非現金配賦フロー) だけを月次合計する。

const planCycle: PlanCycle = {
  planCycleId: "pc-test",
  projectId: "pTEST",
  status: "active",
  budgetYen: 1_000_000,
  totalPoints: 30,
  periodStartYm: "202601",
  periodEndYm: "202603",
};

const projectRow = {
  project_id: "pTEST",
  fee_type: "monthly_fixed",
  fee_amount: 1_000_000,
  start_ym: "202601",
  end_ym: "202603",
  contract_terms_json: null,
  payment_due_rule: null,
  payment_due_day: null,
  invoice_send_deadline_rule: null,
};

function summaryFor(ym: string): RewardSummary {
  // memberA: exclude_from_payout_notice=true 相当 (非現金配賦=会社留保)。
  //   companyReserveYen = 当月フロー (毎月同額)、stockYen = 累積残高 (増え続ける) — これを月次合計してはいけない。
  // memberB: exclude_from_payout_notice=false 相当 (現金支払対象)。totalPay=現金支払、stockYen=期末未払残 (最終月だけ見る)。
  const stockByYm: Record<string, { a: number; b: number }> = {
    "202601": { a: 100_000, b: 5_000 },
    "202602": { a: 200_000, b: 10_000 },
    "202603": { a: 300_000, b: 20_000 },
  };
  const stock = stockByYm[ym];
  return {
    members: [
      {
        memberId: "memberA",
        earnedPt: 10,
        basePay: 100_000,
        bonusPt: 0,
        totalPay: 0,
        companyReserveYen: 100_000,
        stockYen: stock.a,
        payoutExcluded: false,
        breakdown: [],
      },
      {
        memberId: "memberB",
        earnedPt: 5,
        basePay: 50_000,
        bonusPt: 0,
        totalPay: 50_000,
        stockYen: stock.b,
        payoutExcluded: false,
        breakdown: [],
      },
    ],
    totalPaySum: 50_000,
  };
}

const billingRows = ["202601", "202602", "202603"].map((ym) => ({
  project_id: "pTEST",
  ym,
  status: "confirmed",
  budget_yen: 300_000,
  budget_reported_amount: null,
  reward_summary_json: summaryFor(ym),
}));

const finance = buildCockpitSeasonFinance({ planCycle, projectRow, billingRows });
assert.ok(finance, "buildCockpitSeasonFinance returned null");

// 1) 支払対象外メンバー配賦 (companyReserveYen) は月次フロー合計 = 100,000 × 3ヶ月 = 300,000。
//    stockYen (残高) を毎月足していたら 600,000 になってしまう (旧バグ)。
assert.equal(
  finance!.totals.companyReserveYen,
  300_000,
  `companyReserveYen should sum funded flow only (300,000), got ${finance!.totals.companyReserveYen}`
);

// 2) 期末未払残 (外部・支払対象メンバー分) は最終月のスナップショットのみ = 20,000。
//    5,000+10,000+20,000=35,000 に月次合計されていないこと。
assert.equal(
  finance!.totals.finalUnpaidStockYen,
  20_000,
  `finalUnpaidStockYen should be the last month's snapshot only (20,000), got ${finance!.totals.finalUnpaidStockYen}`
);

// 3) 支払対象メンバー (memberB) の現金支払は維持される (50,000 × 3ヶ月 = 150,000)。
assert.equal(
  finance!.totals.memberPayoutYen,
  150_000,
  `memberPayoutYen should preserve cash payout (150,000), got ${finance!.totals.memberPayoutYen}`
);

// 4) シーズン義務 = 現金支払合計 + 会社留保フロー合計 + 期末未払残 (単発)
//    = 150,000 + 300,000 + 20,000 = 470,000。旧バグでは残高が毎月加算され過大になっていた。
assert.equal(
  finance!.totals.rewardObligationYen,
  470_000,
  `rewardObligationYen should be 470,000, got ${finance!.totals.rewardObligationYen}`
);
assert.equal(finance!.status, "shortage", "a real final unpaid cash stock must continue to stop editing");
assert.equal(finance!.totals.finalRemainingYen, 430_000, "remaining budget must stay visible even with unpaid stock");

const settledFinalSummary: RewardSummary = {
  ...summaryFor("202603"),
  members: summaryFor("202603").members.map((member) => ({ ...member, stockYen: 0 })),
};
const balancedFinance = buildCockpitSeasonFinance({
  planCycle,
  projectRow,
  billingRows: billingRows.map((row, index) => (
    index === billingRows.length - 1
      ? { ...row, reward_summary_json: settledFinalSummary }
      : row
  )),
});
assert.equal(balancedFinance?.status, "balanced", "unused PJ budget without final unpaid stock must not be a shortage");
assert.equal(balancedFinance?.totals.finalRemainingYen, 450_000, "intentional unused budget must remain visible");

// 5) 役員フラグではなく exclude_from_payout_notice が現金/非現金の分類正本。
//    30pt のうち 17pt だけを意図的に配賦し、残り13ptがあっても未払にはしない。
const classification = computeSeasonPl({
  planCycle: {
    plan_cycle_id: "pc-classification",
    project_id: "pCLASS",
    status: "active",
    budget_yen: 1_950,
    total_points: 30,
    period_start_ym: "202601",
    period_end_ym: "202603",
  },
  project: {
    project_id: "pCLASS",
    project_name: "classification",
    client_name: "client",
    fee_type: "monthly_fixed",
    fee_amount: 1_000,
    start_ym: "202601",
    end_ym: "202603",
  },
  billings: ["202601", "202602", "202603"].map((ym) => ({
    project_id: "pCLASS",
    ym,
    status: "confirmed",
    budget_yen: 650,
    budget_reported_amount: 1_000,
    budget_buffer_amount: 0,
  })),
  milestones: [
    { milestone_id: "ms-noncash", title: "noncash", points: 5, goal_level: "project", period_start_ym: "202601", target_ym: "202603" },
    { milestone_id: "ms-cash", title: "cash", points: 12, goal_level: "project", period_start_ym: "202601", target_ym: "202603" },
  ],
  progress: [
    { milestone_key: "ms-noncash", ym: "202603", progress_pct: 100, consumed_pt: 5, source: "admin" },
    { milestone_key: "ms-cash", ym: "202603", progress_pct: 100, consumed_pt: 12, source: "admin" },
  ],
  responsibilities: [
    { milestone_id: "ms-noncash", member_id: "aki-like", share: 1 },
    { milestone_id: "ms-cash", member_id: "cash-member", share: 1 },
  ],
  members: [
    { member_id: "aki-like", code_name: "Aki-like", is_officer: false, exclude_from_payout_notice: true },
    { member_id: "cash-member", code_name: "Cash", is_officer: true, exclude_from_payout_notice: false },
  ],
  activeMemberIds: new Set(["aki-like", "cash-member"]),
});

const nonCashMember = classification.members.find((member) => member.memberId === "aki-like");
const cashMember = classification.members.find((member) => member.memberId === "cash-member");
assert.equal(nonCashMember?.reserveKind, "company_reserve", "non-officer exclude=true must be non-cash allocation");
assert.equal(nonCashMember?.budgetShareYen, 325, "non-cash allocation must still participate in the 65% budget allocation");
assert.ok(
  Math.abs((nonCashMember?.paidYen ?? 0) - (nonCashMember?.budgetShareYen ?? 0)) <= 1,
  "non-cash allocation must converge within the existing one-yen monthly rounding",
);
assert.equal(cashMember?.reserveKind, "cash", "officer exclude=false must remain a cash payout member");
assert.equal(cashMember?.paidYen, 780, "cash payout member allocation must be preserved");
assert.equal(classification.checks.unassignedPt, 13, "the intentional unassigned balance must remain 13pt");
assert.equal(classification.finalStockSumYen, 0, "intentional unassigned pt must not create unpaid stock");

console.log("cockpit season finance reserve/stock double-counting checks passed");
