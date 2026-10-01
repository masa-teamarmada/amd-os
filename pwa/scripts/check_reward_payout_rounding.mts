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
  applyRewardCapsForMonth,
  buildRewardSummary,
  isRewardPayoutRoundUpYm,
  isSmallBalanceSettlementYm,
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

// SOLだけ切上げ（2026-10-01）。上の旧方式検査は他PJの非変更を保証する。
check("SOL 202609から切上げ", isRewardPayoutRoundUpYm("p21", "202609"));
check("SOL発行済み期間は非変更", !isRewardPayoutRoundUpYm("p21", "202608"));
check("他PJへ拡張しない", !isRewardPayoutRoundUpYm("pTEST", "202609"));
const roundUp = (amounts: number[], cap: number, ym = "202609", reserve = new Set<string>(), extra = false) =>
  applyRewardCapsForMonth({ members: amounts.map((basePay, i) => ({ memberId: `ID_${i}`, earnedPt: 1,
    basePay, regularBasePay: extra ? 0 : basePay, extraBasePay: extra ? basePay : 0,
    totalPay: basePay, bonusPt: 0, breakdown: [] })) },
  { totalCapYen: cap, regularCapYen: extra ? 0 : cap, extraCapYen: extra ? cap : 0 }, new Map(), new Map(), {},
  { sourceYm: ym, cycleFinalYm: "202703", roundPayoutUp: true, companyReserveMemberIds: reserve });
for (const ym of ["202609", "202701", "202703"]) {
  for (const extra of [false, true]) {
    for (const amount of [0, 1, 51, 99, 100, 101, 4651, 4700]) {
      const result = roundUp([amount], 10000, ym, new Set(), extra);
      const m = result.members[0];
      check(`切上げ清算 ${ym} ${extra} ${amount}`, (m?.totalPay || 0) === Math.ceil(amount / 100) * 100, m);
      check("清算後の端数残ゼロ", (m?.stockYen || 0) === 0, m);
      check("切上げ加算の恒等式", amount + (m?.roundingTopUpYen || 0) === (m?.totalPay || 0), m);
      check("加算の集計", result.roundingTopUpYen === (m?.roundingTopUpYen || 0), result.roundingTopUpYen);
    }
  }
}
const zeroCap = roundUp([4651], 0).members[0];
check("支払枠0では払わず元本繰越", zeroCap.totalPay === 0 && zeroCap.stockYen === 4651 && zeroCap.roundingTopUpYen === 0, zeroCap);
const partial = roundUp([4651], 4001).members[0];
check("不足元本と切上げ加算を分離", partial.totalPay === 4100 && partial.stockYen === 650 && partial.roundingTopUpYen === 99, partial);
const multiple = roundUp([5001, 5002, 5003], 10001, "202609", new Set(["ID_1"]));
check("期末不足の自動補填はしない", (multiple.finalCapTopUpYen || 0) === 0);
check("元の支払枠と加算を照合", multiple.totalPaySum! + multiple.companyReserveYen! === 10001 + multiple.roundingTopUpYen!, multiple);
for (const m of multiple.members) {
  check("元本+加算=支払+未払", m.grossDueYen! + (m.roundingTopUpYen || 0) === m.totalPay + (m.companyReserveYen || 0) + m.stockYen!, m);
  check("現金だけ100円単位", m.payoutExcluded || m.totalPay % 100 === 0, m);
  check("加算は最大99円/財布", (m.roundingTopUpYen || 0) >= 0 && (m.roundingTopUpYen || 0) <= 99, m);
}
const solBillings = billingsFor("202612", ROOMY_CAP);
const sol = buildRewardSummary({ ym: "202612", milestones: MILESTONES, progress: [], responsibilities: RESPONSIBILITIES,
  memberMap: MEMBER_MAP, billing: { ...solBillings.get("202612")!, project_id: "p21" }, billingsByYm: solBillings,
  planCycle: PLAN_CYCLE, project: { ...PROJECT, project_id: "p21" } });
check("本体からSOL切上げへ接続", sol?.members.every(m => m.totalPay % 100 === 0 && m.stockYen === 0 && (m.roundingTopUpYen || 0) > 0) === true, sol);

// capで少額の支払だけを翌月へ残さず、当月の支払にまとめる。
check("SOL202610から少額清算", isSmallBalanceSettlementYm("p21", "202610"));
check("9月以前を変えない", !isSmallBalanceSettlementYm("p21", "202609"));
check("他PJへ勝手に拡張しない", !isSmallBalanceSettlementYm("pTEST", "202610"));
function settle(regular: number, extra: number, regularCap: number, extraCap: number, roundPayoutUp = true, reserve = false) {
  return applyRewardCapsForMonth({ members: [{ memberId: "A", earnedPt: 1, basePay: regular + extra,
    regularBasePay: regular, extraBasePay: extra, totalPay: regular + extra, bonusPt: 0, breakdown: [] }] },
    { totalCapYen: regularCap + extraCap, regularCapYen: regularCap, extraCapYen: extraCap }, new Map(), new Map(), {},
    { sourceYm: "202612", settleSmallBalance: true, roundPayoutUp, companyReserveMemberIds: new Set(reserve ? ["A"] : []) });
}
for (const residual of [1, 99, 100, 4651, 10000, 10001]) {
  const r = settle(50000 + residual, 0, 50000, 0);
  const m = r.members[0];
  check(`少額残高の境界 ${residual}`, residual <= 10000
    ? m.stockYen === 0 && m.totalPay === Math.ceil((50000 + residual) / 100) * 100 && m.smallBalanceSettlementYen === residual
    : m.stockYen === residual && m.totalPay === 50000 && m.smallBalanceSettlementYen === 0, m);
  check("少額清算の恒等式", m.grossDueYen! + (m.roundingTopUpYen || 0) === m.totalPay + m.stockYen!, m);
  check("少額清算でもcap正本は変更しない", r.capBudgetYen === 50000 && r.finalCapTopUpYen === 0, r);
}
check("通常と別財布の合算で判定", settle(25000, 25000, 19000, 19000).members[0].stockYen === 12000);
check("二財布の合計1万円は清算", settle(25000, 25000, 20000, 20000).members[0].stockYen === 0);
check("支払ゼロから新しい振込を作らない", settle(5000, 0, 0, 0).members[0].totalPay === 0);
check("別財布の積立を解除しない", settle(50000, 5000, 50000, 0).members[0].stockYen === 5000);
check("非現金配賦を前倒ししない", settle(55000, 0, 50000, 0, true, true).members[0].stockYen === 5000);
check("丸め端数だけでは前倒ししない", settle(50051, 0, 60000, 0, false).members[0].stockYen === 51);
check("切捨てPJも清算時に債務を残さない", settle(55051, 0, 50000, 0, false).members[0].totalPay === 55051);
const together = applyRewardCapsForMonth({ members: [55000, 100000].map((basePay, i) => ({ memberId: `M${i}`, earnedPt: 1,
  basePay, totalPay: basePay, bonusPt: 0, breakdown: [] })) }, { totalCapYen: 140000, regularCapYen: 140000, extraCapYen: 0 },
  new Map(), new Map(), {}, { sourceYm: "202612", roundPayoutUp: true, settleSmallBalance: true });
check("複数メンバーの清算で取り合わない", together.members.every(m => m.stockYen === 0) && together.totalPaySum === 155000, together);

if (failures > 0) {
  console.error(`\nreward payout rounding: ${failures} 件失敗`);
  process.exit(1);
}
console.log("reward payout rounding: ok");
