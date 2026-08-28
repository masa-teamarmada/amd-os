/**
 * 現金支払額を100円単位へ切り捨てる規則の検査。
 *
 * 実行: npm run test:reward-payout-rounding
 * 正本: pwa/src/lib/reward-summary.ts / 仕様は manual 7-1。
 *
 * まさ確定 2026-08-28「報酬額が1円単位になっていて細かすぎる。9,009円とかになっていて、
 * お互いに面倒になってる。100円未満は切り捨てにしようよ。このPJ単位の合意にするのにあわせて」。
 *
 * ここで守るのは金額事故に直結する規則。
 *   - 202609 稼働分から、現金で受け取るメンバーの支払額が100円単位になる
 *   - 202608 以前は1円単位のまま。発行済み・発行中の支払通知書の額を動かさない
 *   - 切り捨てた端数は消えず stockYen として翌月へ繰り越す
 *   - plan cycle の最終月は切り捨てない。シーズン終了時に未払残 0 で閉じるため
 *   - 支払対象外メンバーの非現金配賦は丸めない
 *
 * 実際の金額を目で見たいときは PEEK=1 を付けて実行する。
 */

import {
  buildRewardSummary,
  REWARD_PAYOUT_ROUNDING_START_YM,
  REWARD_PAYOUT_ROUNDING_UNIT_YEN,
} from "../src/lib/reward-summary.ts";

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) return;
  failures++;
  console.error(`✗ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}

const PLAN_CYCLE = {
  plan_cycle_id: "pc_test",
  project_id: "pTEST",
  status: "fixed",
  // 12か月 × 10pt = 120pt、原資 1,171,111 → ptUnit = 9,759 (1円単位の端数が出る値)
  budget_yen: 1_171_111,
  total_points: 120,
  period_start_ym: "202601",
  period_end_ym: "202612",
};

const PROJECT = { project_id: "pTEST", fee_type: "monthly_fixed", fee_amount: 150_000 };

const MILESTONES = [
  {
    milestone_id: "MS-1",
    title: "テストMS",
    points: 120,
    tag: "normal",
    goal_level: "annual",
    period_start_ym: "202601",
    target_ym: "202612",
  },
];

const RESPONSIBILITIES = [
  { milestone_id: "MS-1", member_id: "ID_A", share: 0.6 },
  { milestone_id: "MS-1", member_id: "ID_B", share: 0.4 },
];

const MEMBER_MAP = { ID_A: "えー", ID_B: "びー" };

function billingsFor(ym: string, capYen: number) {
  const map = new Map<string, { project_id: string; ym: string; budget_yen: number }>();
  const start = Number(PLAN_CYCLE.period_start_ym);
  for (let y = start; y <= Number(ym); y += 1) {
    const month = String(y);
    if (!/^\d{6}$/.test(month) || Number(month.slice(4)) > 12 || Number(month.slice(4)) < 1) continue;
    map.set(month, { project_id: "pTEST", ym: month, budget_yen: capYen });
  }
  return map;
}

function summaryFor(ym: string, capYen: number, payoutExcluded: string[] = []) {
  const billingsByYm = billingsFor(ym, capYen);
  return buildRewardSummary({
    ym,
    milestones: MILESTONES,
    progress: [],
    responsibilities: RESPONSIBILITIES,
    memberMap: MEMBER_MAP,
    billing: billingsByYm.get(ym)!,
    billingsByYm,
    planCycle: PLAN_CYCLE,
    project: PROJECT,
    companyReserveMemberIds: new Set(payoutExcluded),
    payoutExcludedMemberIds: new Set(payoutExcluded),
  });
}

function memberOf(summary: ReturnType<typeof summaryFor>, memberId: string) {
  return summary?.members.find((member) => member.memberId === memberId);
}

const isRounded = (yen: number | undefined) =>
  yen != null && yen % REWARD_PAYOUT_ROUNDING_UNIT_YEN === 0;

// cap をたっぷり取り、需要が全額払える状況。1円単位の端数がそのまま支払額に出るケース
const ROOMY_CAP = 1_000_000;

// --- 1. 開始月より前は1円単位のまま ---
const august = summaryFor("202608", ROOMY_CAP);
const augustA = memberOf(august, "ID_A");
check("202608 は計算できる", Boolean(augustA), august?.members.length);
check(
  "202608 の支払額は1円単位のまま (発行中の月を動かさない)",
  augustA != null && augustA.totalPay === augustA.grossDueYen,
  { totalPay: augustA?.totalPay, grossDueYen: augustA?.grossDueYen },
);
check(
  "202608 の支払額には100円未満の端数が残っている (この検査の前提)",
  augustA != null && augustA.totalPay % REWARD_PAYOUT_ROUNDING_UNIT_YEN !== 0,
  { totalPay: augustA?.totalPay },
);

// --- 2. 開始月からは100円単位 ---
const september = summaryFor("202609", ROOMY_CAP);
const septemberA = memberOf(september, "ID_A");
const septemberB = memberOf(september, "ID_B");
check("開始月の定数は 202609", REWARD_PAYOUT_ROUNDING_START_YM === "202609", REWARD_PAYOUT_ROUNDING_START_YM);
check("202609 の支払額は100円単位", isRounded(septemberA?.totalPay), { totalPay: septemberA?.totalPay });
check("202609 の支払額は100円単位 (2人目)", isRounded(septemberB?.totalPay), { totalPay: septemberB?.totalPay });

// --- 3. 切り捨てた端数は消えず翌月へ繰り越す ---
check(
  "切り捨てた端数は stockYen に残る",
  septemberA != null && septemberA.totalPay + (septemberA.stockYen ?? 0) === septemberA.grossDueYen,
  {
    totalPay: septemberA?.totalPay,
    stockYen: septemberA?.stockYen,
    grossDueYen: septemberA?.grossDueYen,
  },
);
check(
  "端数の繰越は100円未満",
  septemberA != null && (septemberA.stockYen ?? 0) < REWARD_PAYOUT_ROUNDING_UNIT_YEN,
  { stockYen: septemberA?.stockYen },
);
const october = summaryFor("202610", ROOMY_CAP);
const octoberA = memberOf(october, "ID_A");
check(
  "翌月は前月の端数が carryIn として戻る",
  octoberA != null && (octoberA.carryInYen ?? 0) > 0,
  { carryInYen: octoberA?.carryInYen },
);
check("翌月の支払額も100円単位", isRounded(octoberA?.totalPay), { totalPay: octoberA?.totalPay });

// --- 4. plan cycle の最終月は切り捨てない (未払残 0 で閉じる) ---
const december = summaryFor("202612", ROOMY_CAP);
const decemberA = memberOf(december, "ID_A");
const decemberB = memberOf(december, "ID_B");
check(
  "最終月は端数まで払い切る (支払対象メンバーの未払残が 0)",
  decemberA != null && (decemberA.stockYen ?? 0) === 0 && (decemberB?.stockYen ?? 0) === 0,
  { a: decemberA?.stockYen, b: decemberB?.stockYen },
);

// --- 5. cap 不足で按分される月も100円単位 ---
const tightSeptember = summaryFor("202609", 20_000);
const tightA = memberOf(tightSeptember, "ID_A");
const tightB = memberOf(tightSeptember, "ID_B");
check("cap不足の按分でも100円単位", isRounded(tightA?.totalPay), { totalPay: tightA?.totalPay });
check("cap不足の按分でも100円単位 (2人目)", isRounded(tightB?.totalPay), { totalPay: tightB?.totalPay });
check(
  "cap不足でも払わなかった分は全額 stock へ回る",
  tightA != null && tightA.totalPay + (tightA.stockYen ?? 0) === tightA.grossDueYen,
  { totalPay: tightA?.totalPay, stockYen: tightA?.stockYen, grossDueYen: tightA?.grossDueYen },
);
check(
  "cap不足の月の支払合計は cap を超えない",
  (tightA?.totalPay ?? 0) + (tightB?.totalPay ?? 0) <= 20_000,
  { total: (tightA?.totalPay ?? 0) + (tightB?.totalPay ?? 0) },
);

// --- 6. 支払対象外メンバーの非現金配賦は丸めない ---
const withExcluded = summaryFor("202609", ROOMY_CAP, ["ID_B"]);
const excludedB = memberOf(withExcluded, "ID_B");
const cashA = memberOf(withExcluded, "ID_A");
check(
  "支払対象外メンバーの配賦は100円単位に丸めない",
  excludedB != null && (excludedB.companyReserveYen ?? 0) === excludedB.grossDueYen,
  { companyReserveYen: excludedB?.companyReserveYen, grossDueYen: excludedB?.grossDueYen },
);
check("支払対象外がいても現金支払は100円単位", isRounded(cashA?.totalPay), { totalPay: cashA?.totalPay });

if (process.env.PEEK === "1") {
  for (const [label, summary] of [["202608", august], ["202609", september], ["202610", october], ["202612", december], ["202609 cap不足", tightSeptember]] as const) {
    console.log(label, summary?.members.map((m) => ({
      id: m.memberId, base: m.basePay, carryIn: m.carryInYen, gross: m.grossDueYen, pay: m.totalPay, stock: m.stockYen,
    })));
  }
}

if (failures > 0) {
  console.error(`\nreward payout rounding: ${failures} 件失敗`);
  process.exit(1);
}
console.log("reward payout rounding: ok");
