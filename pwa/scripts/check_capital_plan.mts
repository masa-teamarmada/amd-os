import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  editableValue,
  overrideValue,
  resolvedValue,
  recalculateCapTable,
  validateCapitalPlan,
  hasBlockingErrors,
  compareScenarios,
  collectSourceOverrides,
  solveInvestmentForTargetOwnership,
  solvePreMoneyForTargetOwnership,
  priceFromPreMoney,
  sharesFromInvestment,
  latestSnapshot,
  holderStandingAt,
  deriveCapitalPlan,
  safeDeriveCapitalPlan,
  discloseShareRounding,
  checkPublishEligibility,
  validateSubmissionCompleteness,
  type CapitalPlan,
  type CapitalEvent,
  type EventAllocation,
  type Holder,
  type RoundSnapshot,
} from "../src/lib/capital-plan.ts";

const YEN_TOL = 1;
const PCT_TOL = 0.01; // percentage points

let allocSeq = 0;
function alloc(holderId: string, shareClass: EventAllocation["shareClass"], shares: number, opts: Partial<EventAllocation> = {}): EventAllocation {
  allocSeq += 1;
  return {
    id: `a${allocSeq}`,
    holderId,
    shareClass,
    shares: editableValue(shares),
    ...opts,
  };
}

// ---------------------------------------------------------------------------
// Invariant checker: applied to every snapshot / round produced in this file.
// ---------------------------------------------------------------------------

function assertSnapshotInvariants(plan: CapitalPlan, snapshots: RoundSnapshot[], label: string) {
  const holderIds = new Set(plan.holders.map((h) => h.id));
  for (const snap of snapshots) {
    let issuedSum = 0;
    let dilutedSum = 0;
    let issuedPctSum = 0;
    let dilutedPctSum = 0;
    for (const h of snap.holders) {
      assert.ok(holderIds.has(h.holderId), `[${label}] 未知の株主IDがスナップショットに含まれています: ${h.holderId}`);
      assert.ok(Number.isInteger(h.issuedShares) && h.issuedShares >= 0, `[${label}] ${snap.eventLabel}: 株主 ${h.holderId} の発行済株式数が非負整数ではありません (${h.issuedShares})`);
      assert.ok(Number.isInteger(h.fullyDilutedShares) && h.fullyDilutedShares >= 0, `[${label}] ${snap.eventLabel}: 株主 ${h.holderId} の完全希薄化後株式数が非負整数ではありません (${h.fullyDilutedShares})`);
      issuedSum += h.issuedShares;
      dilutedSum += h.fullyDilutedShares;
      issuedPctSum += h.issuedPercentage;
      dilutedPctSum += h.fullyDilutedPercentage;
    }
    assert.equal(issuedSum, snap.totalIssuedShares, `[${label}] ${snap.eventLabel}: 発行済株式数の合計がスナップショット総数と一致しません`);
    assert.equal(dilutedSum, snap.totalFullyDilutedShares, `[${label}] ${snap.eventLabel}: 完全希薄化後株式数の合計がスナップショット総数と一致しません`);
    if (snap.totalIssuedShares > 0) {
      assert.ok(Math.abs(issuedPctSum * 100 - 100) < PCT_TOL, `[${label}] ${snap.eventLabel}: 発行済比率の合計が100%になっていません (${issuedPctSum * 100}%)`);
    }
    if (snap.totalFullyDilutedShares > 0) {
      assert.ok(Math.abs(dilutedPctSum * 100 - 100) < PCT_TOL, `[${label}] ${snap.eventLabel}: 完全希薄化後比率の合計が100%になっていません (${dilutedPctSum * 100}%)`);
    }
  }
}

function assertNoBlockingErrors(plan: CapitalPlan, label: string) {
  const issues = validateCapitalPlan(plan);
  const errors = issues.filter((i) => i.severity === "error");
  assert.equal(errors.length, 0, `[${label}] バリデーションエラーが検出されました: ${errors.map((e) => e.message).join(" / ")}`);
  assert.equal(hasBlockingErrors(issues), false, `[${label}] hasBlockingErrors が true を返しました`);
}

// ---------------------------------------------------------------------------
// 1) 設立 → Seed → A → B → IPO のフルラウンド系列
// ---------------------------------------------------------------------------

const holders: Holder[] = [
  { id: "founder", name: "創業者", kind: "founder" },
  { id: "seedVc", name: "Seed投資家", kind: "investor" },
  { id: "aVc", name: "A投資家", kind: "investor" },
  { id: "bVc", name: "B投資家", kind: "investor" },
  { id: "esop", name: "SOプール", kind: "esop_pool" },
  { id: "public", name: "公募投資家（IPO）", kind: "investor" },
];

function makeIncorporation(): CapitalEvent {
  return {
    id: "e-incorporation",
    type: "incorporation",
    label: "設立",
    order: 1,
    allocations: [alloc("founder", "common", 1_000_000)],
  };
}

function makeSeed(founderShares = 1_000_000, seedPreMoney = 400_000_000, seedInvestment = 100_000_000): CapitalEvent {
  const price = priceFromPreMoney(seedPreMoney, founderShares);
  const seedShares = Math.round(sharesFromInvestment(seedInvestment, price));
  const actualRaise = seedShares * price;
  return {
    id: "e-seed",
    type: "equity_issue",
    label: "Seedラウンド",
    order: 2,
    preMoneyValuation: editableValue(seedPreMoney),
    postMoneyValuation: editableValue(seedPreMoney + actualRaise),
    pricePerShare: editableValue(price),
    allocations: [
      alloc("seedVc", "preferred", seedShares, { amount: editableValue(actualRaise), pricePerShare: editableValue(price) }),
    ],
  };
}

function makeSeriesA(preRoundFd: number, preMoney = 1_500_000_000, investment = 300_000_000): CapitalEvent {
  const price = priceFromPreMoney(preMoney, preRoundFd);
  const shares = Math.round(sharesFromInvestment(investment, price));
  const actualRaise = shares * price;
  return {
    id: "e-seriesA",
    type: "equity_issue",
    label: "シリーズA",
    order: 3,
    preMoneyValuation: editableValue(preMoney),
    postMoneyValuation: editableValue(preMoney + actualRaise),
    pricePerShare: editableValue(price),
    allocations: [
      alloc("aVc", "preferred", shares, { amount: editableValue(actualRaise), pricePerShare: editableValue(price) }),
    ],
  };
}

function makeSeriesB(preRoundFd: number, preMoney = 4_000_000_000, investment = 800_000_000): CapitalEvent {
  const price = priceFromPreMoney(preMoney, preRoundFd);
  const shares = Math.round(sharesFromInvestment(investment, price));
  const actualRaise = shares * price;
  return {
    id: "e-seriesB",
    type: "equity_issue",
    label: "シリーズB",
    order: 4,
    preMoneyValuation: editableValue(preMoney),
    postMoneyValuation: editableValue(preMoney + actualRaise),
    pricePerShare: editableValue(price),
    allocations: [
      alloc("bVc", "preferred", shares, { amount: editableValue(actualRaise), pricePerShare: editableValue(price) }),
    ],
  };
}

function makeIpo(preRoundFd: number, preMoney = 10_000_000_000, raise = 2_000_000_000): CapitalEvent {
  const price = priceFromPreMoney(preMoney, preRoundFd);
  const shares = Math.round(sharesFromInvestment(raise, price));
  const actualRaise = shares * price;
  return {
    id: "e-ipo",
    type: "ipo",
    label: "IPO（公募）",
    order: 5,
    preMoneyValuation: editableValue(preMoney),
    postMoneyValuation: editableValue(preMoney + actualRaise),
    pricePerShare: editableValue(price),
    allocations: [
      alloc("public", "common", shares, { amount: editableValue(actualRaise), pricePerShare: editableValue(price) }),
    ],
  };
}

function buildFullSequencePlan(): CapitalPlan {
  const incorporation = makeIncorporation();
  const founderShares = resolvedValue(incorporation.allocations[0].shares);

  const seed = makeSeed(founderShares);
  const preSeedFd = founderShares;
  const seedFd = preSeedFd + resolvedValue(seed.allocations[0].shares);

  const seriesA = makeSeriesA(seedFd);
  const aFd = seedFd + resolvedValue(seriesA.allocations[0].shares);

  const seriesB = makeSeriesB(aFd);
  const bFd = aFd + resolvedValue(seriesB.allocations[0].shares);

  const ipo = makeIpo(bFd);

  return {
    id: "plan-full-sequence",
    name: "フルラウンド系列",
    holders,
    events: [incorporation, seed, seriesA, seriesB, ipo],
  };
}

const fullPlan = buildFullSequencePlan();
const fullSnapshots = recalculateCapTable(fullPlan);
assert.equal(fullSnapshots.length, 5, "5イベント分のスナップショットが必要です");
assertSnapshotInvariants(fullPlan, fullSnapshots, "フルラウンド系列");
assertNoBlockingErrors(fullPlan, "フルラウンド系列");

const [incSnap, seedSnap, aSnap, bSnap, ipoSnap] = fullSnapshots;
assert.equal(incSnap.totalIssuedShares, 1_000_000, "設立直後は創業者の株式のみ");
assert.equal(holderStandingAt(incSnap, "founder")?.issuedPercentage, 1, "設立直後の創業者比率は100%");

assert.ok((holderStandingAt(seedSnap, "seedVc")?.fullyDilutedShares ?? 0) > 0, "Seed投資家の株式が発行されている");
assert.ok((holderStandingAt(aSnap, "aVc")?.fullyDilutedShares ?? 0) > 0, "A投資家の株式が発行されている");
assert.ok((holderStandingAt(bSnap, "bVc")?.fullyDilutedShares ?? 0) > 0, "B投資家の株式が発行されている");
assert.ok((holderStandingAt(ipoSnap, "public")?.issuedShares ?? 0) > 0, "IPOで公募株式が発行されている");

// pre-money + raise == post-money（各増資イベントで検証）
for (const event of [seedSnap, aSnap, bSnap, ipoSnap]) {
  const src = fullPlan.events.find((e) => e.id === event.eventId)!;
  const pre = resolvedValue(src.preMoneyValuation);
  const post = resolvedValue(src.postMoneyValuation);
  const raise = src.allocations.reduce((sum, a) => sum + resolvedValue(a.amount), 0);
  assert.ok(Math.abs(pre + raise - post) <= YEN_TOL, `${src.label}: pre-money + raise が post-money と一致しません`);
}

console.log("1) フルラウンド系列: ok");

// ---------------------------------------------------------------------------
// 2) 早いラウンド（Seed）を編集すると、後続の A/B/IPO スナップショットが全て変わる
// ---------------------------------------------------------------------------

function rebuildFrom(seedPreMoney: number, seedInvestment: number): { plan: CapitalPlan; snapshots: RoundSnapshot[] } {
  const incorporation = makeIncorporation();
  const founderShares = resolvedValue(incorporation.allocations[0].shares);
  const seed = makeSeed(founderShares, seedPreMoney, seedInvestment);
  const seedFd = founderShares + resolvedValue(seed.allocations[0].shares);
  const seriesA = makeSeriesA(seedFd);
  const aFd = seedFd + resolvedValue(seriesA.allocations[0].shares);
  const seriesB = makeSeriesB(aFd);
  const bFd = aFd + resolvedValue(seriesB.allocations[0].shares);
  const ipo = makeIpo(bFd);
  const plan: CapitalPlan = { id: "plan-edit-seed", name: "Seed編集", holders, events: [incorporation, seed, seriesA, seriesB, ipo] };
  return { plan, snapshots: recalculateCapTable(plan) };
}

const original = rebuildFrom(400_000_000, 100_000_000);
const edited = rebuildFrom(600_000_000, 100_000_000); // 同じ投資額でプレマネーだけ変更

assertSnapshotInvariants(edited.plan, edited.snapshots, "Seed編集後");
assertNoBlockingErrors(edited.plan, "Seed編集後");

for (const idx of [1, 2, 3, 4]) { // seed, A, B, IPO snapshots
  const before = original.snapshots[idx];
  const after = edited.snapshots[idx];
  const changed = before.holders.some((h) => {
    const afterH = after.holders.find((x) => x.holderId === h.holderId);
    return !afterH || Math.abs(afterH.fullyDilutedPercentage - h.fullyDilutedPercentage) > 0.0000001;
  });
  assert.ok(changed, `Seedラウンド編集がイベントindex ${idx} (${before.eventLabel}) の比率に伝播していません`);
}
console.log("2) Seedラウンド編集の下流伝播: ok");

// ---------------------------------------------------------------------------
// 3) ラウンドのプレマネーに1億円加算すると、投資家の持株比率が正しく変わり伝播する
// ---------------------------------------------------------------------------

const baseline = rebuildFrom(400_000_000, 100_000_000);
const bumped = rebuildFrom(500_000_000, 100_000_000); // +1億円

const baselineSeedPct = holderStandingAt(baseline.snapshots[1], "seedVc")!.fullyDilutedPercentage;
const bumpedSeedPct = holderStandingAt(bumped.snapshots[1], "seedVc")!.fullyDilutedPercentage;
assert.ok(bumpedSeedPct < baselineSeedPct, "プレマネー増額でSeed投資家の比率は下がるはず（同じ投資額なら株数が減る）");

// 伝播確認: 最終IPO時点でも比率が異なる
const baselineFinalSeedPct = holderStandingAt(latestSnapshot(baseline.snapshots), "seedVc")!.fullyDilutedPercentage;
const bumpedFinalSeedPct = holderStandingAt(latestSnapshot(bumped.snapshots), "seedVc")!.fullyDilutedPercentage;
assert.notEqual(baselineFinalSeedPct, bumpedFinalSeedPct, "プレマネー加算の効果がIPO時点まで伝播していません");
console.log("3) プレマネー加算による比率変化と伝播: ok");

// ---------------------------------------------------------------------------
// 4) VCの投資額変更 → 当該VCの株数/比率変化、他者比率への希薄化影響
// ---------------------------------------------------------------------------

function buildTwoVcRound(bVcInvestment: number): { plan: CapitalPlan; snap: RoundSnapshot } {
  const founder = alloc("founder", "common", 1_000_000);
  const incorporation: CapitalEvent = { id: "e-inc", type: "incorporation", label: "設立", order: 1, allocations: [founder] };
  const preMoney = 400_000_000;
  const price = priceFromPreMoney(preMoney, 1_000_000);
  const aVcShares = Math.round(sharesFromInvestment(80_000_000, price));
  const bVcShares = Math.round(sharesFromInvestment(bVcInvestment, price));
  const round: CapitalEvent = {
    id: "e-round",
    type: "equity_issue",
    label: "ラウンド",
    order: 2,
    preMoneyValuation: editableValue(preMoney),
    postMoneyValuation: editableValue(preMoney + aVcShares * price + bVcShares * price),
    pricePerShare: editableValue(price),
    allocations: [
      alloc("aVc", "preferred", aVcShares, { amount: editableValue(aVcShares * price) }),
      alloc("bVc", "preferred", bVcShares, { amount: editableValue(bVcShares * price) }),
    ],
  };
  const plan: CapitalPlan = { id: "plan-two-vc", name: "2VCラウンド", holders, events: [incorporation, round] };
  const snapshots = recalculateCapTable(plan);
  return { plan, snap: snapshots.at(-1)! };
}

const twoVcBefore = buildTwoVcRound(80_000_000);
const twoVcAfter = buildTwoVcRound(160_000_000); // bVcの投資額を倍増

const aBefore = holderStandingAt(twoVcBefore.snap, "aVc")!;
const aAfter = holderStandingAt(twoVcBefore.snap, "aVc")!; // same before-plan reference for founder comparison below
const bBefore = holderStandingAt(twoVcBefore.snap, "bVc")!;
const bAfter = holderStandingAt(twoVcAfter.snap, "bVc")!;
const founderBefore = holderStandingAt(twoVcBefore.snap, "founder")!;
const founderAfter = holderStandingAt(twoVcAfter.snap, "founder")!;
const aAfterInAfterPlan = holderStandingAt(twoVcAfter.snap, "aVc")!;

assert.ok(bAfter.fullyDilutedShares > bBefore.fullyDilutedShares, "bVcの株数が投資額増加に応じて増えていません");
assert.ok(bAfter.fullyDilutedPercentage > bBefore.fullyDilutedPercentage, "bVcの比率が投資額増加に応じて増えていません");
assert.ok(founderAfter.fullyDilutedPercentage < founderBefore.fullyDilutedPercentage, "他の株主（創業者）の比率が希薄化されていません");
assert.ok(aAfterInAfterPlan.fullyDilutedPercentage < aBefore.fullyDilutedPercentage, "他の投資家（aVc）の比率が希薄化されていません");
assert.equal(aAfterInAfterPlan.fullyDilutedShares, aBefore.fullyDilutedShares, "aVc自身の株数は変わらないはず");
console.log("4) VC投資額変更による株数/比率と希薄化: ok");

// ---------------------------------------------------------------------------
// 5) 逆算: 目標投資額・目標比率 ⇄ プレマネー評価額
// ---------------------------------------------------------------------------

{
  const preMoney = 900_000_000;
  const targetPct = 0.2;
  const investment = solveInvestmentForTargetOwnership({ preMoneyValuation: preMoney, targetOwnershipPercentage: targetPct });
  // 逆に検算: 投資額とプレマネーからpost-moneyを作り、比率を再計算
  const postMoney = preMoney + investment;
  const impliedPct = investment / postMoney;
  assert.ok(Math.abs(impliedPct - targetPct) < 0.0001, `逆算した投資額から目標比率を再現できません (${impliedPct})`);

  const solvedPreMoney = solvePreMoneyForTargetOwnership({ investmentAmount: investment, targetOwnershipPercentage: targetPct });
  assert.ok(Math.abs(solvedPreMoney - preMoney) < YEN_TOL, `投資額から逆算したプレマネー評価額が元の値と一致しません (${solvedPreMoney} vs ${preMoney})`);
}
console.log("5) 逆算（投資額⇄プレマネー評価額）: ok");

// ---------------------------------------------------------------------------
// 6) オプションプール（新設/積み増し）が既存株主を正しく希薄化する
// ---------------------------------------------------------------------------

{
  const incorporation: CapitalEvent = { id: "e-inc", type: "incorporation", label: "設立", order: 1, allocations: [alloc("founder", "common", 1_000_000)] };
  const poolEvent: CapitalEvent = {
    id: "e-pool",
    type: "option_pool",
    label: "SOプール新設",
    order: 2,
    poolSize: editableValue(150_000),
    allocations: [alloc("esop", "option", 150_000)],
  };
  const plan: CapitalPlan = { id: "plan-pool", name: "SOプール", holders, events: [incorporation, poolEvent] };
  const snapshots = recalculateCapTable(plan);
  assertSnapshotInvariants(plan, snapshots, "SOプール");
  assertNoBlockingErrors(plan, "SOプール");

  const poolSnap = snapshots.at(-1)!;
  const founderStanding = holderStandingAt(poolSnap, "founder")!;
  const poolStanding = holderStandingAt(poolSnap, "esop")!;
  assert.equal(poolStanding.issuedShares, 0, "未行使オプションは発行済株式にカウントされない");
  assert.equal(poolStanding.fullyDilutedShares, 150_000, "プール株式数が一致しません");
  assert.ok(Math.abs(poolStanding.fullyDilutedPercentage - 150_000 / 1_150_000) < 0.0000001, "プール比率の計算が誤っています");
  assert.ok(founderStanding.fullyDilutedPercentage < 1, "オプションプール新設で創業者比率が希薄化されていません");
  assert.equal(founderStanding.issuedPercentage, 1, "発行済ベースでは創業者比率は変わらない（プールは未行使）");

  // トップアップ（積み増し）
  const topUp: CapitalEvent = {
    id: "e-pool-topup",
    type: "option_pool",
    label: "SOプール積み増し",
    order: 3,
    poolSize: editableValue(50_000),
    allocations: [alloc("esop", "option", 50_000)],
  };
  const plan2: CapitalPlan = { ...plan, id: "plan-pool-topup", events: [...plan.events, topUp] };
  const snapshots2 = recalculateCapTable(plan2);
  assertSnapshotInvariants(plan2, snapshots2, "SOプール積み増し");
  const topUpSnap = snapshots2.at(-1)!;
  assert.equal(holderStandingAt(topUpSnap, "esop")!.fullyDilutedShares, 200_000, "積み増し後のプール株式数が一致しません");
}
console.log("6) オプションプールの新設/積み増し: ok");

// ---------------------------------------------------------------------------
// 7) コンバーティブル（SAFE/J-KISS）発行 → 後続ラウンドで転換：二重計上なし
// ---------------------------------------------------------------------------

{
  const incorporation: CapitalEvent = { id: "e-inc", type: "incorporation", label: "設立", order: 1, allocations: [alloc("founder", "common", 1_000_000)] };
  const convertibleIssue: CapitalEvent = {
    id: "e-conv-issue",
    type: "convertible_issue",
    label: "J-KISS発行",
    order: 2,
    conversionCap: editableValue(500_000_000),
    conversionDiscount: editableValue(0.2),
    allocations: [alloc("seedVc", "convertible", 100_000, { amount: editableValue(20_000_000) })],
  };
  const preConversionSnapshots = recalculateCapTable({ id: "p1", name: "p1", holders, events: [incorporation, convertibleIssue] });
  const preConversionSnap = preConversionSnapshots.at(-1)!;
  assert.equal(holderStandingAt(preConversionSnap, "seedVc")!.issuedShares, 0, "転換前は発行済にカウントされない");
  assert.equal(holderStandingAt(preConversionSnap, "seedVc")!.fullyDilutedShares, 100_000, "転換前でも完全希薄化後には含まれる");
  const fdBeforeConversion = preConversionSnap.totalFullyDilutedShares;

  const conversion: CapitalEvent = {
    id: "e-conv-conversion",
    type: "convertible_conversion",
    label: "J-KISS転換（シリーズA時）",
    order: 3,
    preMoneyValuation: editableValue(500_000_000),
    postMoneyValuation: editableValue(500_000_000 + 20_000_000),
    allocations: [
      // remove the convertible-bucket shares, then issue the equivalent as real common/preferred shares
      alloc("seedVc", "convertible", -100_000),
      alloc("seedVc", "preferred", 100_000, { amount: editableValue(20_000_000) }),
    ],
  };
  const plan: CapitalPlan = { id: "p2", name: "p2", holders, events: [incorporation, convertibleIssue, conversion] };
  const snapshots = recalculateCapTable(plan);
  assertSnapshotInvariants(plan, snapshots, "コンバーティブル転換");
  assertNoBlockingErrors(plan, "コンバーティブル転換");

  const postConversionSnap = snapshots.at(-1)!;
  const seedVcStanding = holderStandingAt(postConversionSnap, "seedVc")!;
  assert.equal(seedVcStanding.issuedShares, 100_000, "転換後は発行済株式としてカウントされる");
  assert.equal(seedVcStanding.fullyDilutedShares, 100_000, "転換後の完全希薄化後株式数は転換前と同じ（二重計上なし）");
  assert.equal(postConversionSnap.totalFullyDilutedShares, fdBeforeConversion, "転換前後でFD総数が変化してはいけない（二重計上なし）");
}
console.log("7) コンバーティブル発行→転換（二重計上なし）: ok");

// ---------------------------------------------------------------------------
// 8) セカンダリ譲渡: 買い手/売り手の株数変化、移動合計はゼロ
// ---------------------------------------------------------------------------

{
  const incorporation: CapitalEvent = { id: "e-inc", type: "incorporation", label: "設立", order: 1, allocations: [alloc("founder", "common", 1_000_000)] };
  const seedEquity: CapitalEvent = {
    id: "e-seed",
    type: "equity_issue",
    label: "Seed",
    order: 2,
    preMoneyValuation: editableValue(400_000_000),
    postMoneyValuation: editableValue(500_000_000),
    allocations: [alloc("seedVc", "preferred", 250_000, { amount: editableValue(100_000_000) })],
  };
  const secondary: CapitalEvent = {
    id: "e-secondary",
    type: "secondary",
    label: "セカンダリ譲渡（創業者→A投資家）",
    order: 3,
    allocations: [
      alloc("founder", "common", -100_000, { amount: editableValue(40_000_000) }),
      alloc("aVc", "common", 100_000, { amount: editableValue(40_000_000) }),
    ],
  };
  const plan: CapitalPlan = { id: "p-secondary", name: "セカンダリ", holders, events: [incorporation, seedEquity, secondary] };
  const snapshots = recalculateCapTable(plan);
  assertSnapshotInvariants(plan, snapshots, "セカンダリ譲渡");
  assertNoBlockingErrors(plan, "セカンダリ譲渡");

  const before = snapshots[1];
  const after = snapshots[2];
  const founderBeforeShares = holderStandingAt(before, "founder")!.issuedShares;
  const founderAfterShares = holderStandingAt(after, "founder")!.issuedShares;
  const aVcAfterShares = holderStandingAt(after, "aVc")!.issuedShares;
  assert.equal(founderAfterShares, founderBeforeShares - 100_000, "売り手の株数が正しく減少していません");
  assert.equal(aVcAfterShares, 100_000, "買い手の株数が正しく増加していません");

  const secondaryEvent = plan.events.find((e) => e.id === "e-secondary")!;
  const net = secondaryEvent.allocations.reduce((sum, a) => sum + resolvedValue(a.shares), 0);
  assert.equal(net, 0, "セカンダリ譲渡の株式移動合計はゼロでなければならない");
  assert.equal(before.totalIssuedShares, after.totalIssuedShares, "セカンダリ譲渡は発行済総数を変えない");
}
console.log("8) セカンダリ譲渡（移動合計ゼロ）: ok");

// ---------------------------------------------------------------------------
// 9) 株式分割: 発行済/潜在株式を同じ比率でスケールし、比率は不変
// ---------------------------------------------------------------------------

{
  const incorporation: CapitalEvent = { id: "e-inc", type: "incorporation", label: "設立", order: 1, allocations: [alloc("founder", "common", 1_000_000)] };
  const poolEvent: CapitalEvent = {
    id: "e-pool",
    type: "option_pool",
    label: "SOプール新設",
    order: 2,
    poolSize: editableValue(100_000),
    allocations: [alloc("esop", "option", 100_000)],
  };
  const split: CapitalEvent = {
    id: "e-split",
    type: "share_split",
    label: "株式分割（1:2）",
    order: 3,
    splitRatio: editableValue(2),
    allocations: [],
  };
  const plan: CapitalPlan = { id: "p-split", name: "株式分割", holders, events: [incorporation, poolEvent, split] };
  const snapshots = recalculateCapTable(plan);
  assertSnapshotInvariants(plan, snapshots, "株式分割");
  assertNoBlockingErrors(plan, "株式分割");

  const before = snapshots[1];
  const after = snapshots[2];
  const founderBefore = holderStandingAt(before, "founder")!;
  const founderAfter = holderStandingAt(after, "founder")!;
  const poolBefore = holderStandingAt(before, "esop")!;
  const poolAfter = holderStandingAt(after, "esop")!;

  assert.equal(founderAfter.issuedShares, founderBefore.issuedShares * 2, "発行済株式が分割比率どおりスケールしていません");
  assert.equal(poolAfter.fullyDilutedShares, poolBefore.fullyDilutedShares * 2, "潜在株式（オプション）が分割比率どおりスケールしていません");
  assert.ok(Math.abs(founderAfter.fullyDilutedPercentage - founderBefore.fullyDilutedPercentage) < 0.0000001, "分割前後で比率が変わってはいけません（創業者）");
  assert.ok(Math.abs(poolAfter.fullyDilutedPercentage - poolBefore.fullyDilutedPercentage) < 0.0000001, "分割前後で比率が変わってはいけません（プール）");
}
console.log("9) 株式分割（発行済/潜在株式の一貫スケール、比率不変）: ok");

// ---------------------------------------------------------------------------
// 10) IPO新株発行: 新規発行株式の追加とIPO後cap tableの計算
// ---------------------------------------------------------------------------

{
  const preIpoFd = 2_000_000;
  const incorporation: CapitalEvent = { id: "e-inc", type: "incorporation", label: "設立", order: 1, allocations: [alloc("founder", "common", preIpoFd)] };
  const ipo = makeIpo(preIpoFd, 10_000_000_000, 2_000_000_000);
  const plan: CapitalPlan = { id: "p-ipo", name: "IPO", holders, events: [incorporation, ipo] };
  const snapshots = recalculateCapTable(plan);
  assertSnapshotInvariants(plan, snapshots, "IPO");
  assertNoBlockingErrors(plan, "IPO");

  const ipoSnap = snapshots.at(-1)!;
  const publicStanding = holderStandingAt(ipoSnap, "public")!;
  assert.ok(publicStanding.issuedShares > 0, "IPOで公募株式の発行済株式数が計上されていません");
  assert.equal(publicStanding.issuedShares, publicStanding.fullyDilutedShares, "IPO新規発行株式は普通株式としてissued/dilutedが一致するはず");
  assert.equal(ipoSnap.totalIssuedShares, preIpoFd + publicStanding.issuedShares, "IPO後の発行済総数が正しくありません");
}
console.log("10) IPO新株発行と発行後cap table: ok");

// ---------------------------------------------------------------------------
// 11) ソース上書きメタデータ: override 値の付与と照会
// ---------------------------------------------------------------------------

{
  const incorporation: CapitalEvent = { id: "e-inc", type: "incorporation", label: "設立", order: 1, allocations: [alloc("founder", "common", 1_000_000)] };
  const priceCalculated = priceFromPreMoney(400_000_000, 1_000_000);
  const overriddenPrice = 450; // 手動で発行価格を上書き（監査済み契約書の実額）
  const overrideAlloc = alloc("seedVc", "preferred", 222_222, {
    pricePerShare: overrideValue(priceCalculated, overriddenPrice, "契約書に記載の確定価格で上書き"),
    amount: editableValue(222_222 * overriddenPrice),
  });
  const seedEvent: CapitalEvent = {
    id: "e-seed",
    type: "equity_issue",
    label: "Seed（価格上書きあり）",
    order: 2,
    preMoneyValuation: editableValue(400_000_000),
    postMoneyValuation: overrideValue(500_000_000, 500_100_000, "実際の払込額に合わせて上書き"),
    allocations: [overrideAlloc],
  };
  const plan: CapitalPlan = { id: "p-override", name: "上書きあり", holders, events: [incorporation, seedEvent] };

  const overrides = collectSourceOverrides(plan);
  assert.equal(overrides.length, 2, "override が付与された値が2件検出されるはずです");
  const priceOverride = overrides.find((o) => o.field === "pricePerShare");
  assert.ok(priceOverride, "1株あたり価格の override が見つかりません");
  assert.equal(priceOverride!.value, overriddenPrice, "override 後の値が一致しません");
  assert.equal(priceOverride!.calculatedValue, priceCalculated, "override 前の自動算出値が保存されていません");
  assert.equal(priceOverride!.note, "契約書に記載の確定価格で上書き", "override の note が保存されていません");

  const postMoneyOverride = overrides.find((o) => o.field === "postMoneyValuation");
  assert.ok(postMoneyOverride, "post-money の override が見つかりません");
  assert.equal(postMoneyOverride!.eventId, "e-seed");
}
console.log("11) ソース上書きメタデータの付与/照会: ok");

// ---------------------------------------------------------------------------
// 12) シナリオ比較: 2つのプランの主要指標を diff できる
// ---------------------------------------------------------------------------

{
  const base = rebuildFrom(400_000_000, 100_000_000).plan;
  const variant = rebuildFrom(600_000_000, 100_000_000).plan;
  const comparison = compareScenarios(base, variant);

  assert.notEqual(comparison.baseTotalFullyDilutedShares, comparison.scenarioTotalFullyDilutedShares, "2シナリオのFD総数は異なるはず");
  const founderComparison = comparison.holders.find((h) => h.holderId === "founder")!;
  assert.ok(founderComparison, "創業者の比較行が見つかりません");
  assert.ok(Math.abs(founderComparison.fullyDilutedPercentageDelta) > 0.00001, "プレマネー変更によるシナリオ間の比率差が検出されていません");
  assert.ok(
    Math.abs((founderComparison.scenarioFullyDilutedPercentage - founderComparison.baseFullyDilutedPercentage) - founderComparison.fullyDilutedPercentageDelta) < 1e-9,
    "delta の計算が base/scenario の差分と一致しません",
  );
}
console.log("12) シナリオ比較（2プランの主要指標diff）: ok");

// ---------------------------------------------------------------------------
// 13) protect-holder 概念が存在しないことの確認
// ---------------------------------------------------------------------------

{
  const src = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/lib/capital-plan.ts", import.meta.url), "utf8"));
  const codeOnly = src
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
  assert.ok(!/protect/i.test(codeOnly), "capital-plan.ts のコード本体に protect-holder 概念の痕跡が残っています");
}
console.log("13) protect-holder 概念の不在確認: ok");

// ---------------------------------------------------------------------------
// 14) 妥当性検証: 不整合な入力がエラーとして検出される
// ---------------------------------------------------------------------------

{
  // pre-money + raise != post-money
  const badPost: CapitalEvent = {
    id: "e-bad-post",
    type: "equity_issue",
    label: "不整合ラウンド",
    order: 1,
    preMoneyValuation: editableValue(400_000_000),
    postMoneyValuation: editableValue(999_000_000),
    allocations: [alloc("seedVc", "preferred", 100_000, { amount: editableValue(100_000_000) })],
  };
  const plan1: CapitalPlan = { id: "p-bad-post", name: "bad", holders, events: [makeIncorporation(), badPost] };
  const issues1 = validateCapitalPlan(plan1);
  assert.ok(issues1.some((i) => i.code === "post_money_mismatch"), "post-money 不整合が検出されていません");
  assert.ok(issues1.every((i) => /[぀-ヿ一-鿿]/.test(i.message)), "バリデーションメッセージが日本語になっていません");

  // fractional shares
  const fractional: CapitalEvent = {
    id: "e-fractional",
    type: "equity_issue",
    label: "端数株式",
    order: 1,
    allocations: [alloc("seedVc", "preferred", 100.5)],
  };
  const plan2: CapitalPlan = { id: "p-fractional", name: "frac", holders, events: [fractional] };
  const issues2 = validateCapitalPlan(plan2);
  assert.ok(issues2.some((i) => i.code === "fractional_shares"), "端数株式が検出されていません");

  // secondary net != 0
  const badSecondary: CapitalEvent = {
    id: "e-bad-secondary",
    type: "secondary",
    label: "不整合セカンダリ",
    order: 2,
    allocations: [
      alloc("founder", "common", -100_000),
      alloc("aVc", "common", 90_000),
    ],
  };
  const plan3: CapitalPlan = { id: "p-bad-secondary", name: "bad-secondary", holders, events: [makeIncorporation(), badSecondary] };
  const issues3 = validateCapitalPlan(plan3);
  assert.ok(issues3.some((i) => i.code === "secondary_net_not_zero"), "セカンダリ移動合計不一致が検出されていません");
}
console.log("14) 妥当性検証（不整合入力の検出、日本語メッセージ）: ok");

// ---------------------------------------------------------------------------
// 15) deriveCapitalPlan: valuation_and_investment 基準で VC投資額のみ変更 → 後続ラウンドに伝播
// ---------------------------------------------------------------------------

function calcAlloc(holderId: string, shareClass: EventAllocation["shareClass"], opts: Partial<EventAllocation> = {}): EventAllocation {
  allocSeq += 1;
  return {
    id: `ca${allocSeq}`,
    holderId,
    shareClass,
    shares: editableValue(0, "calculated"),
    ...opts,
  };
}

function buildValuationBasisPlan(seedPreMoney: number, seedInvestment: number, aPreMoney: number, aInvestment: number) {
  const incorporation = makeIncorporation();
  const seed: CapitalEvent = {
    id: "e-seed-basis",
    type: "equity_issue",
    label: "Seed（基準算出）",
    order: 2,
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: editableValue(seedPreMoney),
    allocations: [calcAlloc("seedVc", "preferred", { amount: editableValue(seedInvestment) })],
  };
  const seriesA: CapitalEvent = {
    id: "e-a-basis",
    type: "equity_issue",
    label: "シリーズA（基準算出）",
    order: 3,
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: editableValue(aPreMoney),
    allocations: [calcAlloc("aVc", "preferred", { amount: editableValue(aInvestment) })],
  };
  const plan: CapitalPlan = { id: "p-valuation-basis", name: "valuation_and_investment基準", holders, events: [incorporation, seed, seriesA] };
  const derived = deriveCapitalPlan(plan);
  return { plan: derived, snapshots: recalculateCapTable(derived) };
}

{
  const base = buildValuationBasisPlan(400_000_000, 100_000_000, 1_500_000_000, 300_000_000);
  const vcOnlyChanged = buildValuationBasisPlan(400_000_000, 150_000_000, 1_500_000_000, 300_000_000); // Seed投資額のみ変更

  assertSnapshotInvariants(base.plan, base.snapshots, "valuation_and_investment基準");
  assertNoBlockingErrors(base.plan, "valuation_and_investment基準");
  assertSnapshotInvariants(vcOnlyChanged.plan, vcOnlyChanged.snapshots, "VC投資額のみ変更（basis）");
  assertNoBlockingErrors(vcOnlyChanged.plan, "VC投資額のみ変更（basis）");

  const baseSeedPct = holderStandingAt(base.snapshots[1], "seedVc")!.fullyDilutedPercentage;
  const changedSeedPct = holderStandingAt(vcOnlyChanged.snapshots[1], "seedVc")!.fullyDilutedPercentage;
  assert.notEqual(baseSeedPct, changedSeedPct, "Seed投資額のみの変更がSeed投資家比率に反映されていません");

  const baseSeedShares = holderStandingAt(base.snapshots[1], "seedVc")!.fullyDilutedShares;
  const changedSeedShares = holderStandingAt(vcOnlyChanged.snapshots[1], "seedVc")!.fullyDilutedShares;
  assert.ok(changedSeedShares > baseSeedShares, "投資額増加でSeed投資家の株数が増えていません");

  // 手動でA/後続ラウンドを組み直さずに、基準算出だけでシリーズAまで伝播している
  // (aVcの取得比率は投資額/(プレマネー+投資額)のみで決まるため一定だが、株数はラウンド前FDに応じて変わる)
  const baseAShares = holderStandingAt(base.snapshots[2], "aVc")!.fullyDilutedShares;
  const changedAShares = holderStandingAt(vcOnlyChanged.snapshots[2], "aVc")!.fullyDilutedShares;
  assert.notEqual(baseAShares, changedAShares, "Seed投資額変更がシリーズA投資家の株数まで伝播していません（手動再構築なしで自動反映される必要があります）");

  const baseFounderAPct = holderStandingAt(base.snapshots[2], "founder")!.fullyDilutedPercentage;
  const changedFounderAPct = holderStandingAt(vcOnlyChanged.snapshots[2], "founder")!.fullyDilutedPercentage;
  assert.notEqual(baseFounderAPct, changedFounderAPct, "Seed投資額変更がシリーズA時点の創業者比率まで伝播していません（手動再構築なしで自動反映される必要があります）");
}
console.log("15) deriveCapitalPlan: VC投資額のみ変更の下流伝播（valuation_and_investment基準）: ok");

// ---------------------------------------------------------------------------
// 16) deriveCapitalPlan: プレマネーのみ1億円加算 → 後続ラウンドに伝播
// ---------------------------------------------------------------------------

{
  const base = buildValuationBasisPlan(400_000_000, 100_000_000, 1_500_000_000, 300_000_000);
  const preMoneyBumped = buildValuationBasisPlan(500_000_000, 100_000_000, 1_500_000_000, 300_000_000); // +1億円、投資額は同じ

  assertSnapshotInvariants(preMoneyBumped.plan, preMoneyBumped.snapshots, "プレマネー+1億円（basis）");
  assertNoBlockingErrors(preMoneyBumped.plan, "プレマネー+1億円（basis）");

  const baseSeedPct = holderStandingAt(base.snapshots[1], "seedVc")!.fullyDilutedPercentage;
  const bumpedSeedPct = holderStandingAt(preMoneyBumped.snapshots[1], "seedVc")!.fullyDilutedPercentage;
  assert.ok(bumpedSeedPct < baseSeedPct, "プレマネー加算で同じ投資額ならSeed投資家比率は下がるはず");

  const baseAShares = holderStandingAt(base.snapshots[2], "aVc")!.fullyDilutedShares;
  const bumpedAShares = holderStandingAt(preMoneyBumped.snapshots[2], "aVc")!.fullyDilutedShares;
  assert.notEqual(baseAShares, bumpedAShares, "プレマネー加算がシリーズA投資家の株数まで伝播していません（手動再構築なしで自動反映される必要があります）");
}
console.log("16) deriveCapitalPlan: プレマネーのみ1億円加算の下流伝播: ok");

// ---------------------------------------------------------------------------
// 17) deriveCapitalPlan: price_and_shares 基準（価格と株数からamount/pre-money/post-moneyを算出）
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();
  const founderShares = resolvedValue(incorporation.allocations[0].shares);
  const price = 400;
  const shares = 250_000;
  const round: CapitalEvent = {
    id: "e-price-shares",
    type: "equity_issue",
    label: "Seed（価格株数基準）",
    order: 2,
    calculationBasis: "price_and_shares",
    pricePerShare: editableValue(price),
    allocations: [calcAlloc("seedVc", "preferred", { shares: editableValue(shares) })],
  };
  const plan: CapitalPlan = { id: "p-price-shares", name: "price_and_shares基準", holders, events: [incorporation, round] };
  const derived = deriveCapitalPlan(plan);
  const derivedRound = derived.events.find((e) => e.id === "e-price-shares")!;

  assert.equal(resolvedValue(derivedRound.allocations[0].amount), shares * price, "amountが株数×価格で算出されていません");
  assert.equal(resolvedValue(derivedRound.newShares), shares, "newSharesが正しく算出されていません");
  assert.equal(resolvedValue(derivedRound.primaryRaise), shares * price, "primaryRaiseが正しく算出されていません");
  assert.equal(resolvedValue(derivedRound.preMoneyValuation), price * founderShares, "pre-moneyがラウンド前FDから算出されていません");
  assert.equal(
    resolvedValue(derivedRound.postMoneyValuation),
    price * founderShares + shares * price,
    "post-moneyがpre-money+primaryRaiseで算出されていません",
  );

  const snapshots = recalculateCapTable(derived);
  assertSnapshotInvariants(derived, snapshots, "price_and_shares基準");
  assertNoBlockingErrors(derived, "price_and_shares基準");
}
console.log("17) deriveCapitalPlan: price_and_shares基準の算出: ok");

// ---------------------------------------------------------------------------
// 18) deriveCapitalPlan: ownership_target 基準（目標保有比率から投資額/株数を逆算）、達成不可能な組み合わせは拒否
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();
  const preMoney = 400_000_000;
  const targetPct = 0.2;
  const round: CapitalEvent = {
    id: "e-ownership-target",
    type: "equity_issue",
    label: "Seed（目標比率基準）",
    order: 2,
    calculationBasis: "ownership_target",
    preMoneyValuation: editableValue(preMoney),
    allocations: [calcAlloc("seedVc", "preferred", { targetOwnershipPercentage: editableValue(targetPct) })],
  };
  const plan: CapitalPlan = { id: "p-ownership-target", name: "ownership_target基準", holders, events: [incorporation, round] };
  const derived = deriveCapitalPlan(plan);
  const snapshots = recalculateCapTable(derived);
  assertSnapshotInvariants(derived, snapshots, "ownership_target基準");
  assertNoBlockingErrors(derived, "ownership_target基準");

  const seedStanding = holderStandingAt(snapshots.at(-1), "seedVc")!;
  assert.ok(Math.abs(seedStanding.fullyDilutedPercentage - targetPct) < 0.001, "目標保有比率どおりの比率になっていません");

  const derivedRound = derived.events.find((e) => e.id === "e-ownership-target")!;
  const expectedInvestment = solveInvestmentForTargetOwnership({ preMoneyValuation: preMoney, targetOwnershipPercentage: targetPct });
  assert.ok(
    Math.abs(resolvedValue(derivedRound.primaryRaise) - expectedInvestment) < resolvedValue(derivedRound.allocations[0].pricePerShare!) * 2,
    "目標比率から逆算した投資額が標準の逆算式と大きく乖離しています",
  );

  // 達成不可能な組み合わせ（合計目標比率が100%以上）は拒否される
  const impossibleRound: CapitalEvent = {
    id: "e-impossible",
    type: "equity_issue",
    label: "達成不可能ラウンド",
    order: 2,
    calculationBasis: "ownership_target",
    preMoneyValuation: editableValue(preMoney),
    allocations: [
      calcAlloc("seedVc", "preferred", { targetOwnershipPercentage: editableValue(0.6) }),
      calcAlloc("aVc", "preferred", { targetOwnershipPercentage: editableValue(0.5) }),
    ],
  };
  const impossiblePlan: CapitalPlan = { id: "p-impossible", name: "impossible", holders, events: [incorporation, impossibleRound] };
  assert.throws(() => deriveCapitalPlan(impossiblePlan), /達成不可能/, "合計目標比率100%以上の組み合わせがエラーになりません");
}
console.log("18) deriveCapitalPlan: ownership_target基準の逆算と達成不可能組み合わせの拒否: ok");

// ---------------------------------------------------------------------------
// 19) deriveCapitalPlan: 算出値をoverrideに変更しても保持され、warning/source entryとして見える
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();
  const founderShares = resolvedValue(incorporation.allocations[0].shares);
  const preMoney = 400_000_000;
  const investment = 100_000_000;
  const calculatedPrice = priceFromPreMoney(preMoney, founderShares);
  const calculatedShares = Math.round(sharesFromInvestment(investment, calculatedPrice));

  const overriddenShares = calculatedShares + 500; // 監査済み契約に合わせて手動上書き
  const round: CapitalEvent = {
    id: "e-override-basis",
    type: "equity_issue",
    label: "Seed（算出値をoverride）",
    order: 2,
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: editableValue(preMoney),
    allocations: [
      calcAlloc("seedVc", "preferred", {
        shares: overrideValue(calculatedShares, overriddenShares, "契約書の確定株数で上書き"),
        amount: editableValue(investment),
      }),
    ],
  };
  const plan: CapitalPlan = { id: "p-override-basis", name: "override-basis", holders, events: [incorporation, round] };
  const derived = deriveCapitalPlan(plan);
  const derivedRound = derived.events.find((e) => e.id === "e-override-basis")!;
  const derivedAlloc = derivedRound.allocations[0];

  // override された株数はそのまま保持される
  assert.equal(derivedAlloc.shares.value, overriddenShares, "overrideされた株数がderiveCapitalPlanで変更されてしまっています");
  assert.equal(derivedAlloc.shares.source, "override", "overrideされたフィールドのsourceが変わってはいけません");

  // 再計算後もcalculatedValueが最新の自動算出値に更新され、乖離がsource entryとして見える
  assert.equal(derivedAlloc.shares.calculatedValue, calculatedShares, "override後もcalculatedValueが最新の自動算出値で確認できる必要があります");

  const overrides = collectSourceOverrides(derived);
  const sharesOverride = overrides.find((o) => o.field === "shares" && o.eventId === "e-override-basis");
  assert.ok(sharesOverride, "override状態がcollectSourceOverridesで確認できません");
  assert.equal(sharesOverride!.value, overriddenShares, "source entryのvalueがoverride値と一致しません");
  assert.equal(sharesOverride!.calculatedValue, calculatedShares, "source entryのcalculatedValueが最新の自動算出値と一致しません");

  // downstream (post-money 等) は override株数ではなく再計算された自動算出値を使い続ける
  assert.equal(
    resolvedValue(derivedRound.postMoneyValuation),
    preMoney + investment,
    "post-moneyはprimaryRaise(=amount入力)から算出され続ける必要があります",
  );

  const snapshots = recalculateCapTable(derived);
  assertSnapshotInvariants(derived, snapshots, "override-basis");
  assert.equal(
    holderStandingAt(snapshots.at(-1), "seedVc")!.fullyDilutedShares,
    overriddenShares,
    "cap tableはoverrideされた株数を反映する必要があります",
  );

  // override により株数と入力済み金額(amount)が食い違うため、validateCapitalPlanが警告として検出する
  // (= override の乖離が"warning/source entry"として可視化されるという要件)
  const issues = validateCapitalPlan(derived);
  assert.ok(
    issues.some((i) => i.code === "allocation_amount_price_mismatch" && i.eventId === "e-override-basis"),
    "overrideによる株数と金額の乖離がバリデーションで警告として検出されていません",
  );
}
console.log("19) deriveCapitalPlan: override保持とsource entryでの乖離確認: ok");

// ---------------------------------------------------------------------------
// 20) 新規バリデーション: primaryRaise/newShares/オプションプール/割当金額/セカンダリ金額の不整合検出
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();

  // primaryRaise がallocation現金合計と一致しない
  const badPrimaryRaise: CapitalEvent = {
    id: "e-bad-primary-raise",
    type: "equity_issue",
    label: "primaryRaise不整合",
    order: 2,
    primaryRaise: editableValue(999_000_000),
    allocations: [alloc("seedVc", "preferred", 100_000, { amount: editableValue(100_000_000) })],
  };
  const issuesPrimary = validateCapitalPlan({ id: "p1", name: "p1", holders, events: [incorporation, badPrimaryRaise] });
  assert.ok(issuesPrimary.some((i) => i.code === "primary_raise_mismatch"), "primaryRaise不整合が検出されていません");

  // newShares が正の割当合計と一致しない
  const badNewShares: CapitalEvent = {
    id: "e-bad-new-shares",
    type: "equity_issue",
    label: "newShares不整合",
    order: 2,
    newShares: editableValue(999_999),
    allocations: [alloc("seedVc", "preferred", 100_000)],
  };
  const issuesNewShares = validateCapitalPlan({ id: "p2", name: "p2", holders, events: [incorporation, badNewShares] });
  assert.ok(issuesNewShares.some((i) => i.code === "new_shares_mismatch"), "newShares不整合が検出されていません");

  // 割当金額が株数×価格と一致しない
  const badAllocAmount: CapitalEvent = {
    id: "e-bad-alloc-amount",
    type: "equity_issue",
    label: "割当金額不整合",
    order: 2,
    allocations: [
      alloc("seedVc", "preferred", 100_000, { amount: editableValue(999_000_000), pricePerShare: editableValue(400) }),
    ],
  };
  const issuesAllocAmount = validateCapitalPlan({ id: "p3", name: "p3", holders, events: [incorporation, badAllocAmount] });
  assert.ok(issuesAllocAmount.some((i) => i.code === "allocation_amount_price_mismatch"), "割当金額の不整合が検出されていません");

  // オプションプールサイズがオプション割当合計と一致しない
  const badPool: CapitalEvent = {
    id: "e-bad-pool",
    type: "option_pool",
    label: "プールサイズ不整合",
    order: 2,
    poolSize: editableValue(999_999),
    allocations: [alloc("esop", "option", 150_000)],
  };
  const issuesPool = validateCapitalPlan({ id: "p4", name: "p4", holders, events: [incorporation, badPool] });
  assert.ok(issuesPool.some((i) => i.code === "option_pool_size_mismatch"), "オプションプールサイズ不整合が検出されていません");

  // セカンダリの譲渡人受取額と譲受人支払額が一致しない
  const badSecondaryAmount: CapitalEvent = {
    id: "e-bad-secondary-amount",
    type: "secondary",
    label: "セカンダリ金額不整合",
    order: 2,
    allocations: [
      alloc("founder", "common", -100_000, { amount: editableValue(40_000_000) }),
      alloc("aVc", "common", 100_000, { amount: editableValue(35_000_000) }),
    ],
  };
  const issuesSecondaryAmount = validateCapitalPlan({ id: "p5", name: "p5", holders, events: [incorporation, badSecondaryAmount] });
  assert.ok(issuesSecondaryAmount.some((i) => i.code === "secondary_amount_mismatch"), "セカンダリ金額不整合が検出されていません");
}
console.log("20) 新規バリデーション（primaryRaise/newShares/割当金額/プール/セカンダリ金額）: ok");

// ---------------------------------------------------------------------------
// 21) discloseShareRounding: 可視丸めの開示ヘルパー
// ---------------------------------------------------------------------------

{
  const d = discloseShareRounding(123456.4);
  assert.equal(d.roundedShares, 123456, "四捨五入の丸めが正しくありません");
  assert.ok(Math.abs(d.roundingDelta - (123456 - 123456.4)) < 1e-9, "丸め誤差(delta)の計算が正しくありません");

  const d2 = discloseShareRounding(999.5);
  assert.equal(d2.roundedShares, 1000, "0.5の丸めが正しくありません");
}
console.log("21) discloseShareRounding: ok");

// ---------------------------------------------------------------------------
// 22) status (confirmed/planned) は deriveCapitalPlan / recalculateCapTable を通じて保持される
// ---------------------------------------------------------------------------

{
  const incorporation: CapitalEvent = {
    id: "e-inc",
    type: "incorporation",
    label: "設立",
    order: 1,
    status: "confirmed",
    allocations: [alloc("founder", "common", 1_000_000)],
  };
  const plannedRound: CapitalEvent = {
    id: "e-planned",
    type: "equity_issue",
    label: "計画中ラウンド",
    order: 2,
    status: "planned",
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: editableValue(400_000_000),
    allocations: [calcAlloc("seedVc", "preferred", { amount: editableValue(100_000_000) })],
  };
  const plan: CapitalPlan = { id: "p-status", name: "status", holders, events: [incorporation, plannedRound] };
  const derived = deriveCapitalPlan(plan);

  assert.equal(derived.events.find((e) => e.id === "e-inc")!.status, "confirmed", "confirmed status が derive で保持されていません");
  assert.equal(derived.events.find((e) => e.id === "e-planned")!.status, "planned", "planned status が derive で保持されていません");

  const snapshots = recalculateCapTable(derived);
  assertSnapshotInvariants(derived, snapshots, "status保持");
  assertNoBlockingErrors(derived, "status保持");
}
console.log("22) status(confirmed/planned)の保持: ok");

// ---------------------------------------------------------------------------
// 23) safeDeriveCapitalPlan: 不完全な評価額イベントでもクラッシュせず、著者プランと日本語エラーを返す
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();
  const incompleteRound: CapitalEvent = {
    id: "e-incomplete",
    type: "equity_issue",
    label: "入力途中のラウンド",
    order: 2,
    calculationBasis: "valuation_and_investment",
    // preMoneyValuation が未入力（0扱い）→ price <= 0 で deriveEvent が throw する
    allocations: [calcAlloc("seedVc", "preferred", { amount: editableValue(100_000_000) })],
  };
  const plan: CapitalPlan = { id: "p-incomplete", name: "incomplete", holders, events: [incorporation, incompleteRound] };

  assert.throws(() => deriveCapitalPlan(plan), "不完全な評価額イベントで deriveCapitalPlan が例外を投げませんでした");

  const result = safeDeriveCapitalPlan(plan);
  assert.ok(result.error, "safeDeriveCapitalPlan がエラーを返していません");
  assert.ok(/[぀-ヿ一-鿿]/.test(result.error!), "safeDeriveCapitalPlan のエラーメッセージが日本語になっていません");
  assert.deepEqual(result.plan, plan, "エラー時は著者プランがそのまま返される必要があります");

  // 正常系では error が付かず、derive 結果が返る
  const okPlan: CapitalPlan = { id: "p-ok", name: "ok", holders, events: [makeIncorporation(), makeSeed()] };
  const okResult = safeDeriveCapitalPlan(okPlan);
  assert.equal(okResult.error, undefined, "正常系で error が設定されてしまっています");
}
console.log("23) safeDeriveCapitalPlan: 不完全入力での安全なフォールバック: ok");

// ---------------------------------------------------------------------------
// 24) collectSourceOverrides: primaryRaise/newShares/targetOwnershipPercentage の override も検出される
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();
  const overrideAlloc = alloc("seedVc", "preferred", 100_000, {
    amount: editableValue(100_000_000),
    targetOwnershipPercentage: overrideValue(0.2, 0.25, "交渉結果で目標比率を上書き"),
  });
  const round: CapitalEvent = {
    id: "e-new-override-fields",
    type: "equity_issue",
    label: "新規override対象フィールド",
    order: 2,
    preMoneyValuation: editableValue(400_000_000),
    postMoneyValuation: editableValue(500_000_000),
    primaryRaise: overrideValue(100_000_000, 105_000_000, "追加払込を反映して上書き"),
    newShares: overrideValue(100_000, 105_000, "追加発行分を反映して上書き"),
    allocations: [overrideAlloc],
  };
  const plan: CapitalPlan = { id: "p-new-override-fields", name: "new-override-fields", holders, events: [incorporation, round] };
  const overrides = collectSourceOverrides(plan);

  assert.ok(overrides.some((o) => o.field === "primaryRaise" && o.value === 105_000_000), "primaryRaise の override が検出されていません");
  assert.ok(overrides.some((o) => o.field === "newShares" && o.value === 105_000), "newShares の override が検出されていません");
  assert.ok(
    overrides.some((o) => o.field === "targetOwnershipPercentage" && o.value === 0.25 && o.holderId === "seedVc"),
    "targetOwnershipPercentage の override が検出されていません",
  );
}
console.log("24) collectSourceOverrides: 新規override対象フィールド(primaryRaise/newShares/targetOwnershipPercentage): ok");

// ---------------------------------------------------------------------------
// 25) deriveCapitalPlan: ownership_target 基準の複数株主同時解決（新規VC2社）
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();
  const preMoney = 400_000_000;
  const targetA = 0.2;
  const targetB = 0.1;
  const round: CapitalEvent = {
    id: "e-multi-target",
    type: "equity_issue",
    label: "Seed（新規VC2社の目標比率同時解決）",
    order: 2,
    calculationBasis: "ownership_target",
    preMoneyValuation: editableValue(preMoney),
    allocations: [
      calcAlloc("aVc", "preferred", { targetOwnershipPercentage: editableValue(targetA) }),
      calcAlloc("bVc", "preferred", { targetOwnershipPercentage: editableValue(targetB) }),
    ],
  };
  const plan: CapitalPlan = { id: "p-multi-target", name: "multi-target", holders, events: [incorporation, round] };
  const derived = deriveCapitalPlan(plan);
  const snapshots = recalculateCapTable(derived);
  assertSnapshotInvariants(derived, snapshots, "ownership_target複数株主同時解決");
  assertNoBlockingErrors(derived, "ownership_target複数株主同時解決");

  const finalSnap = snapshots.at(-1)!;
  const aStanding = holderStandingAt(finalSnap, "aVc")!;
  const bStanding = holderStandingAt(finalSnap, "bVc")!;
  assert.ok(Math.abs(aStanding.fullyDilutedPercentage - targetA) < 0.001, "aVcの目標保有比率が達成されていません");
  assert.ok(Math.abs(bStanding.fullyDilutedPercentage - targetB) < 0.001, "bVcの目標保有比率が達成されていません");
}
console.log("25) deriveCapitalPlan: ownership_target基準の複数株主(新規VC2社)同時解決: ok");

// ---------------------------------------------------------------------------
// 26) deriveCapitalPlan: ownership_target 基準の既存投資家フォローオン目標
//     （既存保有分を含めた「合計」post-round比率として解決される）
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();
  const founderShares = resolvedValue(incorporation.allocations[0].shares);
  const seed = makeSeed(founderShares, 400_000_000, 100_000_000); // seedVcが既存保有を持つ
  const seedFd = founderShares + resolvedValue(seed.allocations[0].shares);
  const preSeedVcShares = resolvedValue(seed.allocations[0].shares);

  const followOnTarget = 0.3; // シリーズAでseedVcの「合計」保有比率を30%にする
  const seriesA: CapitalEvent = {
    id: "e-follow-on",
    type: "equity_issue",
    label: "シリーズA（既存投資家フォローオン目標）",
    order: 3,
    calculationBasis: "ownership_target",
    preMoneyValuation: editableValue(1_500_000_000),
    allocations: [calcAlloc("seedVc", "preferred", { targetOwnershipPercentage: editableValue(followOnTarget) })],
  };
  const plan: CapitalPlan = { id: "p-follow-on", name: "follow-on", holders, events: [incorporation, seed, seriesA] };
  const derived = deriveCapitalPlan(plan);
  const snapshots = recalculateCapTable(derived);
  assertSnapshotInvariants(derived, snapshots, "既存投資家フォローオン目標");
  assertNoBlockingErrors(derived, "既存投資家フォローオン目標");

  const finalSnap = snapshots.at(-1)!;
  const seedVcStanding = holderStandingAt(finalSnap, "seedVc")!;
  assert.ok(
    Math.abs(seedVcStanding.fullyDilutedPercentage - followOnTarget) < 0.001,
    "既存投資家のフォローオン後の合計保有比率が目標と一致しません",
  );

  const derivedSeriesA = derived.events.find((e) => e.id === "e-follow-on")!;
  const newShares = resolvedValue(derivedSeriesA.allocations[0].shares);
  assert.ok(
    newShares < followOnTarget * seedVcStanding.fullyDilutedShares + preSeedVcShares,
    "新規発行株式数が既存保有分を二重に含めて算出されています",
  );
  // 既存保有分を差し引いた分だけが新規発行株式になっているはず
  assert.ok(newShares > 0 && newShares < seedVcStanding.fullyDilutedShares, "フォローオンの新規発行株式数が既存保有分を考慮せず算出されています");
  assert.equal(seedFd > 0, true);
}
console.log("26) deriveCapitalPlan: ownership_target基準の既存投資家フォローオン目標（既存保有込みの合計比率）: ok");

// ---------------------------------------------------------------------------
// 27) deriveCapitalPlan: ownership_target 基準は割当の順序に依存しない
// ---------------------------------------------------------------------------

{
  const preMoney = 400_000_000;
  const targetA = 0.15;
  const targetB = 0.25;
  const buildOrdered = (allocs: EventAllocation[]) => {
    const incorporation = makeIncorporation();
    const round: CapitalEvent = {
      id: "e-order",
      type: "equity_issue",
      label: "順序依存性確認",
      order: 2,
      calculationBasis: "ownership_target",
      preMoneyValuation: editableValue(preMoney),
      allocations: allocs,
    };
    const plan: CapitalPlan = { id: "p-order", name: "order", holders, events: [incorporation, round] };
    return recalculateCapTable(deriveCapitalPlan(plan)).at(-1)!;
  };

  const forward = buildOrdered([
    calcAlloc("aVc", "preferred", { targetOwnershipPercentage: editableValue(targetA) }),
    calcAlloc("bVc", "preferred", { targetOwnershipPercentage: editableValue(targetB) }),
  ]);
  const reversed = buildOrdered([
    calcAlloc("bVc", "preferred", { targetOwnershipPercentage: editableValue(targetB) }),
    calcAlloc("aVc", "preferred", { targetOwnershipPercentage: editableValue(targetA) }),
  ]);

  assert.equal(
    holderStandingAt(forward, "aVc")!.fullyDilutedShares,
    holderStandingAt(reversed, "aVc")!.fullyDilutedShares,
    "割当の並び順でaVcの算出株式数が変わってしまっています",
  );
  assert.equal(
    holderStandingAt(forward, "bVc")!.fullyDilutedShares,
    holderStandingAt(reversed, "bVc")!.fullyDilutedShares,
    "割当の並び順でbVcの算出株式数が変わってしまっています",
  );
}
console.log("27) deriveCapitalPlan: ownership_target基準は割当の順序に依存しない: ok");

// ---------------------------------------------------------------------------
// 28) deriveCapitalPlan: ownership_target 基準の不可能な組み合わせを拒否
//     (重複/矛盾するtarget行、既存保有込みで負の新規株式数)
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();

  // 同一株主に対するtarget行が複数ある場合は一意に解決できず拒否される
  const duplicateTargetRound: CapitalEvent = {
    id: "e-dup-target",
    type: "equity_issue",
    label: "重複target行",
    order: 2,
    calculationBasis: "ownership_target",
    preMoneyValuation: editableValue(400_000_000),
    allocations: [
      calcAlloc("aVc", "preferred", { targetOwnershipPercentage: editableValue(0.1) }),
      calcAlloc("aVc", "preferred", { targetOwnershipPercentage: editableValue(0.2) }),
    ],
  };
  const dupPlan: CapitalPlan = { id: "p-dup-target", name: "dup-target", holders, events: [incorporation, duplicateTargetRound] };
  assert.throws(() => deriveCapitalPlan(dupPlan), /複数行/, "同一株主への重複target行がエラーになりません");

  // 既存保有分を含めるとフォローオン目標が現状の保有比率より低く、
  // 新規発行株式数が負になる組み合わせは拒否される
  const founderShares = resolvedValue(incorporation.allocations[0].shares);
  const seed = makeSeed(founderShares, 400_000_000, 300_000_000); // seedVcが大きく保有
  const tooLowFollowOn: CapitalEvent = {
    id: "e-too-low-follow-on",
    type: "equity_issue",
    label: "達成不可能なフォローオン目標",
    order: 3,
    calculationBasis: "ownership_target",
    preMoneyValuation: editableValue(2_000_000_000),
    // seedVcの既存保有比率よりも低い目標 → 新規発行株式数が負になり拒否される
    allocations: [calcAlloc("seedVc", "preferred", { targetOwnershipPercentage: editableValue(0.01) })],
  };
  const tooLowPlan: CapitalPlan = { id: "p-too-low", name: "too-low", holders, events: [incorporation, seed, tooLowFollowOn] };
  assert.throws(() => deriveCapitalPlan(tooLowPlan), /負またはNaN/, "既存保有込みで負になる新規株式数がエラーになりません");

  // 合計target比率が100%以上の組み合わせは引き続き拒否される
  const impossibleRound: CapitalEvent = {
    id: "e-impossible-2",
    type: "equity_issue",
    label: "達成不可能ラウンド2",
    order: 2,
    calculationBasis: "ownership_target",
    preMoneyValuation: editableValue(400_000_000),
    allocations: [
      calcAlloc("aVc", "preferred", { targetOwnershipPercentage: editableValue(0.7) }),
      calcAlloc("bVc", "preferred", { targetOwnershipPercentage: editableValue(0.4) }),
    ],
  };
  const impossiblePlan2: CapitalPlan = { id: "p-impossible-2", name: "impossible2", holders, events: [incorporation, impossibleRound] };
  assert.throws(() => deriveCapitalPlan(impossiblePlan2), /達成不可能/, "合計target比率100%以上の組み合わせがエラーになりません");
}
console.log("28) deriveCapitalPlan: ownership_target基準の不可能な組み合わせ(重複行/既存保有込み負の新規株式/合計100%以上)の拒否: ok");

// ---------------------------------------------------------------------------
// 29) deriveCapitalPlan: ownership_target 基準の primaryRaise は固定割当(非target)の
//     金額も含めて合計される（target行だけの合計だと過小評価になる）
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();
  const founderShares = resolvedValue(incorporation.allocations[0].shares);
  const preMoney = 400_000_000;
  const targetPct = 0.2;
  const price = priceFromPreMoney(preMoney, founderShares);
  const fixedShares = 10_000;
  const fixedAmount = fixedShares * price;
  const round: CapitalEvent = {
    id: "e-mixed-fixed-target",
    type: "equity_issue",
    label: "固定割当+目標比率割当の混在",
    order: 2,
    calculationBasis: "ownership_target",
    preMoneyValuation: editableValue(preMoney),
    allocations: [
      // fixed (non-target) allocation: authored shares/amount, not solved
      alloc("aVc", "preferred", fixedShares, { amount: editableValue(fixedAmount), pricePerShare: editableValue(price) }),
      calcAlloc("seedVc", "preferred", { targetOwnershipPercentage: editableValue(targetPct) }),
    ],
  };
  const plan: CapitalPlan = { id: "p-mixed-fixed-target", name: "mixed-fixed-target", holders, events: [incorporation, round] };
  const derived = deriveCapitalPlan(plan);
  const derivedRound = derived.events.find((e) => e.id === "e-mixed-fixed-target")!;
  const seedAlloc = derivedRound.allocations.find((a) => a.holderId === "seedVc")!;

  const solvedAmount = resolvedValue(seedAlloc.amount);
  assert.ok(
    Math.abs(resolvedValue(derivedRound.primaryRaise) - (fixedAmount + solvedAmount)) <= YEN_TOL,
    `primaryRaiseは固定割当の金額(${fixedAmount})+目標比率割当の解決額(${solvedAmount})の合計になる必要があります（実際: ${resolvedValue(derivedRound.primaryRaise)}）`,
  );

  const snapshots = recalculateCapTable(derived);
  assertSnapshotInvariants(derived, snapshots, "固定割当+目標比率割当の混在");
  assertNoBlockingErrors(derived, "固定割当+目標比率割当の混在");
}
console.log("29) deriveCapitalPlan: ownership_target基準のprimaryRaiseが固定割当の金額を含めて合計される: ok");

// ---------------------------------------------------------------------------
// 30) newShares: イベント種別/株式クラスを考慮した検証（セカンダリのnet-zero取込・
//     SO付与のoutstanding_delta=0取込が誤検知されない／セカンダリでnewShares!=0は誤り）
// ---------------------------------------------------------------------------

{
  // 取込セカンダリ: net-zeroの株式移動、newShares=0（インポート時の合算値どおり）→ 誤検知なし
  const importedSecondary: CapitalEvent = {
    id: "e-imported-secondary",
    type: "secondary",
    label: "取込セカンダリ",
    order: 2,
    newShares: editableValue(0, "confirmed"),
    allocations: [
      alloc("founder", "common", -30_000, { amount: editableValue(12_000_000) }),
      alloc("aVc", "common", 30_000, { amount: editableValue(12_000_000) }),
    ],
  };
  const plan1: CapitalPlan = { id: "p-imported-secondary", name: "imported-secondary", holders, events: [makeIncorporation(), importedSecondary] };
  const issues1 = validateCapitalPlan(plan1);
  assert.ok(!issues1.some((i) => i.code === "new_shares_mismatch"), "net-zeroの取込セカンダリでnew_shares_mismatchが誤検知されました");

  // セカンダリでnewShares!=0は誤り
  const badSecondaryNewShares: CapitalEvent = { ...importedSecondary, id: "e-bad-secondary-new-shares", newShares: editableValue(30_000, "confirmed") };
  const plan2: CapitalPlan = { id: "p-bad-secondary-new-shares", name: "bad-secondary-new-shares", holders, events: [makeIncorporation(), badSecondaryNewShares] };
  const issues2 = validateCapitalPlan(plan2);
  assert.ok(issues2.some((i) => i.code === "new_shares_mismatch" && /セカンダリ/.test(i.message)), "セカンダリのnewShares!=0が検出されていません");

  // 取込SO付与: outstanding_delta=0（オプションはFDのみ）、newShares=0 → 誤検知なし
  const importedOptionGrant: CapitalEvent = {
    id: "e-imported-option-grant",
    type: "option_pool",
    label: "取込SO付与",
    order: 2,
    poolSize: editableValue(5_000, "confirmed"),
    newShares: editableValue(0, "confirmed"),
    allocations: [alloc("esop", "option", 5_000)],
  };
  const plan3: CapitalPlan = { id: "p-imported-option-grant", name: "imported-option-grant", holders, events: [makeIncorporation(), importedOptionGrant] };
  const issues3 = validateCapitalPlan(plan3);
  assert.ok(!issues3.some((i) => i.code === "new_shares_mismatch"), "outstanding_delta=0の取込SO付与でnew_shares_mismatchが誤検知されました");
  assert.ok(!issues3.some((i) => i.code === "option_pool_size_mismatch"), "取込SO付与でoption_pool_size_mismatchが誤検知されました");

  // equity_issue で非希薄化クラスの正の割当合計とnewSharesが一致しない場合は引き続き検出される
  const badEquityNewShares: CapitalEvent = {
    id: "e-bad-equity-new-shares",
    type: "equity_issue",
    label: "不整合newShares",
    order: 2,
    newShares: editableValue(999_999, "confirmed"),
    allocations: [alloc("seedVc", "preferred", 100_000)],
  };
  const plan4: CapitalPlan = { id: "p-bad-equity-new-shares", name: "bad-equity-new-shares", holders, events: [makeIncorporation(), badEquityNewShares] };
  const issues4 = validateCapitalPlan(plan4);
  assert.ok(issues4.some((i) => i.code === "new_shares_mismatch"), "増資イベントのnewShares不一致が検出されていません");
}
console.log("30) newShares（イベント/株式クラス考慮、セカンダリ・SO取込の誤検知なし）: ok");

// ---------------------------------------------------------------------------
// 31) 負の割当（金額・株数）の拒否
// ---------------------------------------------------------------------------

{
  // セカンダリ以外での負の金額
  const negativeAmount: CapitalEvent = {
    id: "e-negative-amount",
    type: "equity_issue",
    label: "負の金額",
    order: 2,
    allocations: [alloc("seedVc", "preferred", 100_000, { amount: editableValue(-1) })],
  };
  const plan1: CapitalPlan = { id: "p-negative-amount", name: "negative-amount", holders, events: [makeIncorporation(), negativeAmount] };
  const issues1 = validateCapitalPlan(plan1);
  const negAmountIssue = issues1.find((i) => i.code === "negative_allocation_amount");
  assert.ok(negAmountIssue, "セカンダリ以外での負の金額が検出されていません");
  assert.ok(/[぀-ヿ一-鿿]/.test(negAmountIssue!.message), "負の金額エラーメッセージが日本語になっていません");

  // セカンダリ以外での負の株数（買い手・売り手の概念がないため常に不可）
  const negativeShares: CapitalEvent = {
    id: "e-negative-shares",
    type: "equity_issue",
    label: "負の株数",
    order: 2,
    allocations: [alloc("seedVc", "preferred", -100_000)],
  };
  const plan2: CapitalPlan = { id: "p-negative-shares", name: "negative-shares", holders, events: [makeIncorporation(), negativeShares] };
  const issues2 = validateCapitalPlan(plan2);
  const negSharesIssue = issues2.find((i) => i.code === "negative_shares_not_allowed");
  assert.ok(negSharesIssue, "セカンダリ以外での負の株数が検出されていません");
  assert.ok(/[぀-ヿ一-鿿]/.test(negSharesIssue!.message), "負の株数エラーメッセージが日本語になっていません");

  // セカンダリの譲渡人側の負の株数は許容される（既存テスト8と整合）
  const validSecondary: CapitalEvent = {
    id: "e-valid-secondary",
    type: "secondary",
    label: "正当なセカンダリ",
    order: 2,
    allocations: [
      alloc("founder", "common", -50_000, { amount: editableValue(20_000_000) }),
      alloc("aVc", "common", 50_000, { amount: editableValue(20_000_000) }),
    ],
  };
  const plan3: CapitalPlan = { id: "p-valid-secondary", name: "valid-secondary", holders, events: [makeIncorporation(), validSecondary] };
  const issues3 = validateCapitalPlan(plan3);
  assert.ok(!issues3.some((i) => i.code === "negative_shares_not_allowed"), "セカンダリの譲渡人側の負の株数が誤検知されました");
  assert.ok(!issues3.some((i) => i.code === "negative_allocation_amount"), "セカンダリの正の受渡金額が誤検知されました");
}
console.log("31) 負の割当金額・株数の拒否（セカンダリ以外）: ok");

// ---------------------------------------------------------------------------
// 32) コンバーティブルのライフサイクル強化: 発行は正のconvertible単位のみ、
//     転換には消込と非希薄化発行が必須、残高を超える消込は拒否、
//     転換は新規現金として扱わない（primaryRaiseは0でなければならない）
// ---------------------------------------------------------------------------

{
  // convertible_issue: shareClassがconvertible以外
  const invalidClassIssue: CapitalEvent = {
    id: "e-conv-issue-invalid-class",
    type: "convertible_issue",
    label: "不正クラスの発行",
    order: 2,
    allocations: [alloc("seedVc", "preferred", 100_000)],
  };
  const planA: CapitalPlan = { id: "p-conv-invalid-class", name: "conv-invalid-class", holders, events: [makeIncorporation(), invalidClassIssue] };
  assert.ok(validateCapitalPlan(planA).some((i) => i.code === "convertible_issue_invalid_class"), "convertible_issueでの不正なshareClassが検出されていません");

  // convertible_issue: 0以下の発行数
  const nonPositiveIssue: CapitalEvent = {
    id: "e-conv-issue-non-positive",
    type: "convertible_issue",
    label: "0以下の発行",
    order: 2,
    allocations: [alloc("seedVc", "convertible", 0)],
  };
  const planB: CapitalPlan = { id: "p-conv-non-positive", name: "conv-non-positive", holders, events: [makeIncorporation(), nonPositiveIssue] };
  assert.ok(validateCapitalPlan(planB).some((i) => i.code === "convertible_issue_non_positive_units"), "convertible_issueでの0以下の発行数が検出されていません");

  // convertible_conversion: 消込（負のconvertible）がない
  const missingConsumption: CapitalEvent = {
    id: "e-conv-missing-consumption",
    type: "convertible_conversion",
    label: "消込なし転換",
    order: 3,
    allocations: [alloc("seedVc", "preferred", 100_000)],
  };
  const planC: CapitalPlan = { id: "p-conv-missing-consumption", name: "conv-missing-consumption", holders, events: [makeIncorporation(), missingConsumption] };
  assert.ok(validateCapitalPlan(planC).some((i) => i.code === "convertible_conversion_missing_consumption"), "消込のない転換イベントが検出されていません");

  // convertible_conversion: 非希薄化発行（普通株式・優先株式等）がない
  const missingIssuance: CapitalEvent = {
    id: "e-conv-missing-issuance",
    type: "convertible_conversion",
    label: "発行なし転換",
    order: 3,
    allocations: [alloc("seedVc", "convertible", -100_000)],
  };
  const planD: CapitalPlan = { id: "p-conv-missing-issuance", name: "conv-missing-issuance", holders, events: [makeIncorporation(), missingIssuance] };
  assert.ok(validateCapitalPlan(planD).some((i) => i.code === "convertible_conversion_missing_issuance"), "非希薄化発行のない転換イベントが検出されていません");

  // 保有残高を超えるコンバーティブル消込は拒否される（イベント順に残高を追跡）
  const convIssue: CapitalEvent = {
    id: "e-conv-issue-balance",
    type: "convertible_issue",
    label: "J-KISS発行",
    order: 2,
    allocations: [alloc("seedVc", "convertible", 50_000, { amount: editableValue(10_000_000) })],
  };
  const overConsume: CapitalEvent = {
    id: "e-conv-overconsume",
    type: "convertible_conversion",
    label: "残高超過の転換",
    order: 3,
    preMoneyValuation: editableValue(500_000_000),
    postMoneyValuation: editableValue(500_000_000),
    allocations: [
      alloc("seedVc", "convertible", -60_000),
      alloc("seedVc", "preferred", 60_000, { amount: editableValue(12_000_000) }),
    ],
  };
  const planE: CapitalPlan = { id: "p-conv-overconsume", name: "conv-overconsume", holders, events: [makeIncorporation(), convIssue, overConsume] };
  assert.ok(validateCapitalPlan(planE).some((i) => i.code === "convertible_consumption_exceeds_balance"), "保有残高を超えるコンバーティブル消込が検出されていません");

  // 正当な消込（残高ちょうど）は誤検知されない（既存テスト7相当の残高チェック再確認）
  const exactConsume: CapitalEvent = {
    id: "e-conv-exact-consume",
    type: "convertible_conversion",
    label: "残高ちょうどの転換",
    order: 3,
    preMoneyValuation: editableValue(500_000_000),
    postMoneyValuation: editableValue(500_000_000),
    allocations: [
      alloc("seedVc", "convertible", -50_000),
      alloc("seedVc", "preferred", 50_000, { amount: editableValue(10_000_000) }),
    ],
  };
  const planF: CapitalPlan = { id: "p-conv-exact-consume", name: "conv-exact-consume", holders, events: [makeIncorporation(), convIssue, exactConsume] };
  assert.ok(!validateCapitalPlan(planF).some((i) => i.code === "convertible_consumption_exceeds_balance"), "残高ちょうどの消込が誤検知されました");

  // 転換は新規現金として扱わない: primaryRaiseが非ゼロならエラー
  const conversionWithCash: CapitalEvent = {
    id: "e-conv-with-cash",
    type: "convertible_conversion",
    label: "現金調達扱いの転換（誤り）",
    order: 3,
    preMoneyValuation: editableValue(500_000_000),
    postMoneyValuation: editableValue(999_000_000), // pre+raiseルールが適用されないことも併せて確認
    primaryRaise: editableValue(20_000_000),
    allocations: [
      alloc("seedVc", "convertible", -50_000),
      alloc("seedVc", "preferred", 50_000, { amount: editableValue(20_000_000) }),
    ],
  };
  const planG: CapitalPlan = { id: "p-conv-with-cash", name: "conv-with-cash", holders, events: [makeIncorporation(), convIssue, conversionWithCash] };
  const issuesG = validateCapitalPlan(planG);
  assert.ok(issuesG.some((i) => i.code === "convertible_conversion_primary_raise_nonzero"), "転換イベントのprimaryRaise非ゼロが検出されていません");
  assert.ok(!issuesG.some((i) => i.code === "post_money_mismatch"), "転換イベントはpre+raiseのpost-money整合性チェックから除外される必要があります");
  assert.ok(!issuesG.some((i) => i.code === "primary_raise_mismatch"), "転換イベントは通常のprimaryRaise整合性チェック対象外である必要があります");
}
console.log("32) コンバーティブルのライフサイクル強化（発行/転換の妥当性・残高追跡・現金非計上）: ok");

// ---------------------------------------------------------------------------
// 33) 提出完全性検証（validateSubmissionCompleteness / checkPublishEligibility）:
//     設立→…→IPOの一連が揃って初めて凍結可能。単発の未完成ドラフトは凍結不可だが
//     safeDeriveCapitalPlanはクラッシュしない。
// ---------------------------------------------------------------------------

{
  const completeHolders: Holder[] = [
    { id: "founder-c", name: "創業者", kind: "founder" },
    { id: "seedVc-c", name: "Seed投資家", kind: "investor" },
    { id: "public-c", name: "公募投資家", kind: "investor" },
  ];
  const completeIncorporation: CapitalEvent = {
    id: "e-complete-inc",
    type: "incorporation",
    label: "設立",
    order: 1,
    date: "2023-01-10",
    allocations: [alloc("founder-c", "common", 1_000_000)],
  };
  const seedPrice = priceFromPreMoney(400_000_000, 1_000_000);
  const seedShares = Math.round(sharesFromInvestment(100_000_000, seedPrice));
  const seedRaise = seedShares * seedPrice;
  const completeSeed: CapitalEvent = {
    id: "e-complete-seed",
    type: "equity_issue",
    label: "Seed",
    order: 2,
    date: "2023-06-01",
    preMoneyValuation: editableValue(400_000_000),
    postMoneyValuation: editableValue(400_000_000 + seedRaise),
    pricePerShare: editableValue(seedPrice),
    primaryRaise: editableValue(seedRaise),
    newShares: editableValue(seedShares),
    calculationBasis: "manual",
    allocations: [alloc("seedVc-c", "preferred", seedShares, { amount: editableValue(seedRaise), pricePerShare: editableValue(seedPrice) })],
  };
  const ipoPreRoundFd = 1_000_000 + seedShares;
  const ipoPrice = priceFromPreMoney(2_000_000_000, ipoPreRoundFd);
  const ipoShares = Math.round(sharesFromInvestment(500_000_000, ipoPrice));
  const ipoRaise = ipoShares * ipoPrice;
  const completeIpo: CapitalEvent = {
    id: "e-complete-ipo",
    type: "ipo",
    label: "IPO",
    order: 3,
    date: "2024-01-15",
    preMoneyValuation: editableValue(2_000_000_000),
    postMoneyValuation: editableValue(2_000_000_000 + ipoRaise),
    pricePerShare: editableValue(ipoPrice),
    primaryRaise: editableValue(ipoRaise),
    newShares: editableValue(ipoShares),
    calculationBasis: "manual",
    allocations: [alloc("public-c", "common", ipoShares, { amount: editableValue(ipoRaise), pricePerShare: editableValue(ipoPrice) })],
  };
  const completePlan: CapitalPlan = {
    id: "p-complete-submission",
    name: "complete-submission",
    holders: completeHolders,
    events: [completeIncorporation, completeSeed, completeIpo],
  };

  assert.deepEqual(validateSubmissionCompleteness(completePlan), [], "完全な設立→Seed→IPOプランに提出完全性エラーが検出されました");
  const completeEligibility = checkPublishEligibility(completePlan);
  assert.equal(completeEligibility.eligible, true, `完全なプランがeligible=falseになりました: ${JSON.stringify(completeEligibility.blockingIssues)}`);

  // 末尾がIPOでない場合は凍結不可
  const noIpoPlan: CapitalPlan = { ...completePlan, id: "p-no-ipo", events: [completeIncorporation, completeSeed] };
  const noIpoEligibility = checkPublishEligibility(noIpoPlan);
  assert.equal(noIpoEligibility.eligible, false, "末尾がIPOでないプランがeligible=trueになりました");
  assert.ok(noIpoEligibility.blockingIssues.some((i) => i.code === "submission_last_event_not_ipo"), "末尾IPO必須の違反が検出されていません");

  // 先頭が設立でない場合は凍結不可
  const noIncorporationPlan: CapitalPlan = { ...completePlan, id: "p-no-inc", events: [{ ...completeSeed, order: 1 }, { ...completeIpo, order: 2 }] };
  const noIncorporationIssues = validateSubmissionCompleteness(noIncorporationPlan);
  assert.ok(noIncorporationIssues.some((i) => i.code === "submission_first_event_not_incorporation"), "先頭設立必須の違反が検出されていません");

  // 設立イベントに創業株主への正の割当がない場合は凍結不可
  const founderlessIncorporation: CapitalEvent = { ...completeIncorporation, allocations: [] };
  const founderlessPlan: CapitalPlan = { ...completePlan, events: [founderlessIncorporation, completeSeed, completeIpo] };
  assert.ok(
    validateSubmissionCompleteness(founderlessPlan).some((i) => i.code === "submission_incorporation_missing_founder_allocation"),
    "創業株主割当なしの設立イベントが検出されていません",
  );

  // ラベル・日付が欠けている場合は凍結不可
  const missingDateSeed: CapitalEvent = { ...completeSeed, date: undefined };
  const missingLabelPlan: CapitalPlan = { ...completePlan, events: [completeIncorporation, missingDateSeed, completeIpo] };
  assert.ok(
    validateSubmissionCompleteness(missingLabelPlan).some((i) => i.code === "submission_event_missing_date"),
    "日付欠落イベントが検出されていません",
  );

  // 名前を持つ株主が1人もいない場合は凍結不可
  const unnamedHoldersPlan: CapitalPlan = { ...completePlan, holders: completeHolders.map((h) => ({ ...h, name: "" })) };
  assert.ok(
    validateSubmissionCompleteness(unnamedHoldersPlan).some((i) => i.code === "submission_no_named_holder"),
    "株主名なしプランが検出されていません",
  );

  // 一部の株主にだけ名前が設定されている（1名でも名前があれば良い、ではない）場合も凍結不可
  const partiallyUnnamedHoldersPlan: CapitalPlan = {
    ...completePlan,
    holders: completeHolders.map((h, i) => (i === 0 ? h : { ...h, name: "" })),
  };
  const partiallyUnnamedIssues = validateSubmissionCompleteness(partiallyUnnamedHoldersPlan);
  assert.ok(
    partiallyUnnamedIssues.some((i) => i.code === "submission_no_named_holder"),
    "1名だけ名前がある（他は無名）株主構成が提出完全性エラーとして検出されていません",
  );

  // 単発の未完成ドラフト（設立のみ）: 凍結不可だが safeDeriveCapitalPlan はクラッシュしない
  const draftPlan: CapitalPlan = {
    id: "p-draft",
    name: "draft",
    holders: completeHolders,
    events: [completeIncorporation],
  };
  const draftEligibility = checkPublishEligibility(draftPlan);
  assert.equal(draftEligibility.eligible, false, "単発ドラフトがeligible=trueになりました");
  const draftDerive = safeDeriveCapitalPlan(draftPlan);
  assert.equal(draftDerive.error, undefined, "単発ドラフトのderiveでエラーが発生しました");
}
console.log("33) 提出完全性検証（設立→IPO一連の完全性・凍結可否・WIPでの安全なderive）: ok");

// ---------------------------------------------------------------------------
// 34) 提出完全性検証: calculationBasisがmanual以外というだけでは「完全」とは
//     判定されない（未derive・未入力のまま凍結を通してしまう回帰の防止）。
// ---------------------------------------------------------------------------

{
  const holders34: Holder[] = [
    { id: "founder-34", name: "創業者", kind: "founder" },
    { id: "public-34", name: "公募投資家", kind: "investor" },
  ];
  const incorporation34: CapitalEvent = {
    id: "e-34-inc",
    type: "incorporation",
    label: "設立",
    order: 1,
    date: "2023-01-10",
    allocations: [alloc("founder-34", "common", 1_000_000)],
  };
  // calculationBasisはmanual以外（valuation_and_investment）に設定されているが、
  // preMoneyValuation/postMoneyValuation/pricePerShare/primaryRaise/newSharesは
  // いずれも未解決（deriveCapitalPlanを実行していない）まま。
  const unresolvedIpo: CapitalEvent = {
    id: "e-34-ipo",
    type: "ipo",
    label: "IPO（未derive）",
    order: 2,
    date: "2024-01-15",
    calculationBasis: "valuation_and_investment",
    allocations: [alloc("public-34", "common", 500_000)],
  };
  const unresolvedPlan: CapitalPlan = {
    id: "p-34-unresolved",
    name: "unresolved-basis-only",
    holders: holders34,
    events: [incorporation34, unresolvedIpo],
  };

  const completenessIssues = validateSubmissionCompleteness(unresolvedPlan);
  assert.ok(
    completenessIssues.some((i) => i.code === "submission_financing_incomplete" && i.eventId === "e-34-ipo"),
    "calculationBasisがmanual以外というだけで未解決の財務項目が『完全』と誤判定されました",
  );

  const unresolvedEligibility = checkPublishEligibility(unresolvedPlan);
  assert.equal(
    unresolvedEligibility.eligible,
    false,
    "calculationBasisがmanual以外というだけの未derive・未入力プランがeligible=trueになりました",
  );
  assert.ok(
    unresolvedEligibility.blockingIssues.some((i) => i.code === "submission_financing_incomplete"),
    "未derive・未入力プランのブロッキングissueにsubmission_financing_incompleteが含まれていません",
  );
}
console.log("34) 提出完全性検証: calculationBasis(manual以外)だけでは完全と判定されない: ok");

// ---------------------------------------------------------------------------
// 35) freeze APIのソースコード検査: /api/governance/capital-plans の
//     freezeアクションが、保存済みの生document_jsonではなくサーバー側で
//     derive済みのプランに対してeligibility判定を行い、derive失敗時は400を
//     返し、derive済みdocument_jsonをRPCに渡していることをソース上で確認する。
// ---------------------------------------------------------------------------

{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const routeFilePath = path.join(__dirname, "..", "src", "app", "api", "governance", "capital-plans", "route.ts");
  const routeSrc = fs.readFileSync(routeFilePath, "utf8");

  assert.ok(
    /import\s*\{[^}]*\bderiveCapitalPlan\b[^}]*\}\s*from\s*["']@\/lib\/capital-plan["']/.test(routeSrc),
    "route.tsがcapital-planからderiveCapitalPlanをimportしていません",
  );

  const freezeActionMatch = routeSrc.match(/if \(body\.action === "freeze"\) \{[\s\S]*?\n  \}\n/);
  assert.ok(freezeActionMatch, "route.ts内にfreezeアクションのブロックが見つかりません");
  const freezeBlock = freezeActionMatch![0];

  assert.ok(
    /let derivedPlan: CapitalPlan;\s*\n\s*try\s*\{\s*\n\s*derivedPlan = deriveCapitalPlan\(capitalPlan\);/.test(freezeBlock),
    "freezeアクションがtoCapitalPlan()の結果をtry/catchでderiveCapitalPlanにかけていません",
  );
  assert.ok(
    /catch \(e\) \{[\s\S]*?return badRequest\(`plan derivation failed:/.test(freezeBlock),
    "freezeアクションがderive失敗時にbadRequest(400)を返していません",
  );
  assert.ok(
    /checkPublishEligibility\(derivedPlan\)/.test(freezeBlock),
    "freezeアクションが生のcapitalPlanではなくderive済みのderivedPlanに対してcheckPublishEligibilityを実行していません",
  );
  assert.ok(
    !/checkPublishEligibility\(capitalPlan\)/.test(freezeBlock),
    "freezeアクションが依然としてderive前の生capitalPlanに対してcheckPublishEligibilityを実行しています",
  );
  assert.ok(
    /p_document_json:\s*\{\s*holders:\s*derivedPlan\.holders,\s*events:\s*derivedPlan\.events\s*\}/.test(freezeBlock),
    "freezeアクションがderive済みのholders/eventsをp_document_jsonとしてRPCに渡していません",
  );
}
console.log("35) freeze APIソース検査: derive→400フォールバック→derive済みプランでのeligibility判定→derive済みdocument_jsonのRPC引き渡し: ok");

// ---------------------------------------------------------------------------
// 36) 提出完全性検証: 日付はYYYY-MM-DD形式の有効な暦日であり、かつイベント順序と
//     非減少（同日は可）でなければならない。
// ---------------------------------------------------------------------------

{
  const holders36: Holder[] = [
    { id: "founder-36", name: "創業者", kind: "founder" },
    { id: "seedVc-36", name: "Seed投資家", kind: "investor" },
    { id: "public-36", name: "公募投資家", kind: "investor" },
  ];
  const inc36: CapitalEvent = {
    id: "e-36-inc",
    type: "incorporation",
    label: "設立",
    order: 1,
    date: "2023-01-10",
    allocations: [alloc("founder-36", "common", 1_000_000)],
  };
  const seedBase: CapitalEvent = {
    id: "e-36-seed",
    type: "equity_issue",
    label: "Seed",
    order: 2,
    date: "2023-06-01",
    preMoneyValuation: editableValue(400_000_000),
    postMoneyValuation: editableValue(500_000_000),
    pricePerShare: editableValue(400),
    primaryRaise: editableValue(100_000_000),
    newShares: editableValue(250_000),
    calculationBasis: "manual",
    allocations: [alloc("seedVc-36", "preferred", 250_000, { amount: editableValue(100_000_000), pricePerShare: editableValue(400) })],
  };
  const ipoBase: CapitalEvent = {
    id: "e-36-ipo",
    type: "ipo",
    label: "IPO",
    order: 3,
    date: "2024-01-15",
    preMoneyValuation: editableValue(2_000_000_000),
    postMoneyValuation: editableValue(2_500_000_000),
    pricePerShare: editableValue(1600),
    primaryRaise: editableValue(500_000_000),
    newShares: editableValue(312_500),
    calculationBasis: "manual",
    allocations: [alloc("public-36", "common", 312_500, { amount: editableValue(500_000_000), pricePerShare: editableValue(1600) })],
  };

  // 不正な形式（スラッシュ区切り）
  const slashDatePlan: CapitalPlan = {
    id: "p-36-slash",
    name: "slash-date",
    holders: holders36,
    events: [inc36, { ...seedBase, date: "2023/06/01" }, ipoBase],
  };
  assert.ok(
    validateSubmissionCompleteness(slashDatePlan).some((i) => i.code === "submission_event_invalid_date"),
    "YYYY-MM-DD形式ではない日付が検出されていません",
  );

  // 暦日として存在しない日付（2月30日）
  const overflowDatePlan: CapitalPlan = {
    id: "p-36-overflow",
    name: "overflow-date",
    holders: holders36,
    events: [inc36, { ...seedBase, date: "2023-02-30" }, ipoBase],
  };
  assert.ok(
    validateSubmissionCompleteness(overflowDatePlan).some((i) => i.code === "submission_event_invalid_date"),
    "暦日として存在しない日付（2023-02-30）が検出されていません",
  );

  // 存在しない月（13月）
  const invalidMonthPlan: CapitalPlan = {
    id: "p-36-month",
    name: "invalid-month",
    holders: holders36,
    events: [inc36, { ...seedBase, date: "2023-13-01" }, ipoBase],
  };
  assert.ok(
    validateSubmissionCompleteness(invalidMonthPlan).some((i) => i.code === "submission_event_invalid_date"),
    "存在しない月（13月）が検出されていません",
  );

  // 順序が後のイベントの日付が、先行イベントより前になっている
  const outOfOrderPlan: CapitalPlan = {
    id: "p-36-out-of-order",
    name: "out-of-order-date",
    holders: holders36,
    events: [inc36, { ...seedBase, date: "2022-12-01" }, ipoBase],
  };
  const outOfOrderIssues = validateSubmissionCompleteness(outOfOrderPlan);
  assert.ok(
    outOfOrderIssues.some((i) => i.code === "submission_event_date_out_of_order" && i.eventId === "e-36-seed"),
    "イベント順序より前の日付を持つイベントが検出されていません",
  );

  // 同日は許容される
  const sameDayPlan: CapitalPlan = {
    id: "p-36-same-day",
    name: "same-day-date",
    holders: holders36,
    events: [inc36, { ...seedBase, date: "2023-01-10" }, ipoBase],
  };
  assert.ok(
    !validateSubmissionCompleteness(sameDayPlan).some((i) => i.code === "submission_event_date_out_of_order"),
    "同日のイベント日付が誤って順序違反として検出されました",
  );

  // 正しく整合した日付は問題なし
  const validDatesPlan: CapitalPlan = {
    id: "p-36-valid",
    name: "valid-dates",
    holders: holders36,
    events: [inc36, seedBase, ipoBase],
  };
  assert.ok(
    !validateSubmissionCompleteness(validDatesPlan).some(
      (i) => i.code === "submission_event_invalid_date" || i.code === "submission_event_date_out_of_order",
    ),
    "整合した有効な日付のプランに日付関連エラーが誤検出されました",
  );
}
console.log("36) 提出完全性検証: 日付形式（YYYY-MM-DD/実在暦日）とイベント順序との非減少整合性: ok");

// ---------------------------------------------------------------------------
// 37) コンバーティブル転換（convertible_conversion）はcalculationBasisが
//     manual（または未設定）でなければならない: validateCapitalPlanでの検出と、
//     deriveCapitalPlanが増資向けロジックを適用する前に明確な日本語エラーで
//     停止すること（現金調達・newSharesへの消込混入を未然に防ぐ）。
// ---------------------------------------------------------------------------

{
  const holders37: Holder[] = [
    { id: "founder-37", name: "創業者", kind: "founder" },
    { id: "seedVc-37", name: "Seed投資家", kind: "investor" },
  ];
  const inc37: CapitalEvent = {
    id: "e-37-inc",
    type: "incorporation",
    label: "設立",
    order: 1,
    date: "2023-01-10",
    allocations: [alloc("founder-37", "common", 1_000_000)],
  };
  const convIssue37: CapitalEvent = {
    id: "e-37-conv-issue",
    type: "convertible_issue",
    label: "J-KISS発行",
    order: 2,
    date: "2023-03-01",
    allocations: [alloc("seedVc-37", "convertible", 50_000, { amount: editableValue(10_000_000) })],
  };

  for (const basis of ["valuation_and_investment", "price_and_shares", "ownership_target"] as const) {
    const badConversion: CapitalEvent = {
      id: "e-37-conversion",
      type: "convertible_conversion",
      label: `非manualな転換（${basis}）`,
      order: 3,
      date: "2023-09-01",
      preMoneyValuation: editableValue(500_000_000),
      calculationBasis: basis,
      allocations: [
        alloc("seedVc-37", "convertible", -50_000),
        alloc("seedVc-37", "preferred", 50_000, { amount: editableValue(10_000_000) }),
      ],
    };
    const badPlan: CapitalPlan = { id: `p-37-${basis}`, name: `conv-non-manual-${basis}`, holders: holders37, events: [inc37, convIssue37, badConversion] };

    const issues = validateCapitalPlan(badPlan);
    assert.ok(
      issues.some((i) => i.code === "convertible_conversion_non_manual_basis" && i.eventId === "e-37-conversion"),
      `calculationBasis「${basis}」のコンバーティブル転換イベントがvalidateCapitalPlanで検出されていません`,
    );

    assert.throws(
      () => deriveCapitalPlan(badPlan),
      /コンバーティブル転換イベント.*calculationBasis.*manual/,
      `deriveCapitalPlanがcalculationBasis「${basis}」の転換イベントで明確な日本語エラーを投げていません`,
    );

    const safeResult = safeDeriveCapitalPlan(badPlan);
    assert.ok(safeResult.error, `safeDeriveCapitalPlanがcalculationBasis「${basis}」の転換イベントでエラーメッセージを返していません`);
    assert.ok(/コンバーティブル/.test(safeResult.error ?? ""), "safeDeriveCapitalPlanのエラーメッセージにコンバーティブル転換への言及がありません");
    assert.deepEqual(safeResult.plan, badPlan, "safeDeriveCapitalPlanがderive失敗時に元のプランをそのまま返していません");
  }

  // manual（明示）は許容される
  const manualConversion: CapitalEvent = {
    id: "e-37-manual-conversion",
    type: "convertible_conversion",
    label: "manualな転換",
    order: 3,
    date: "2023-09-01",
    calculationBasis: "manual",
    allocations: [
      alloc("seedVc-37", "convertible", -50_000),
      alloc("seedVc-37", "preferred", 50_000, { amount: editableValue(10_000_000) }),
    ],
  };
  const manualPlan: CapitalPlan = { id: "p-37-manual", name: "conv-manual", holders: holders37, events: [inc37, convIssue37, manualConversion] };
  assert.ok(
    !validateCapitalPlan(manualPlan).some((i) => i.code === "convertible_conversion_non_manual_basis"),
    "calculationBasisがmanualの転換イベントが誤ってnon_manual_basisとして検出されました",
  );
  assert.doesNotThrow(() => deriveCapitalPlan(manualPlan), "calculationBasisがmanualの転換イベントでderiveCapitalPlanが例外を投げました");

  // calculationBasis未設定（undefined）も許容される
  const undefinedBasisConversion: CapitalEvent = { ...manualConversion, id: "e-37-undefined-conversion", calculationBasis: undefined };
  const undefinedBasisPlan: CapitalPlan = {
    id: "p-37-undefined",
    name: "conv-undefined-basis",
    holders: holders37,
    events: [inc37, convIssue37, undefinedBasisConversion],
  };
  assert.ok(
    !validateCapitalPlan(undefinedBasisPlan).some((i) => i.code === "convertible_conversion_non_manual_basis"),
    "calculationBasis未設定の転換イベントが誤ってnon_manual_basisとして検出されました",
  );
  assert.doesNotThrow(() => deriveCapitalPlan(undefinedBasisPlan), "calculationBasis未設定の転換イベントでderiveCapitalPlanが例外を投げました");
}
console.log("37) コンバーティブル転換のcalculationBasis制約: validateCapitalPlanでの検出とderiveCapitalPlanの事前停止（現金調達・newShares混入の防止）: ok");

// ---------------------------------------------------------------------------
// 38) deriveCapitalPlan: calculationBasisがmanual（または未設定）の増資イベントでも
//     primaryRaise/newShares/postMoneyValuationは割当から再計算される（放置された
//     無意味なサマリーではなく、割当編集が下流のサマリー・検証に反映されること）。
// ---------------------------------------------------------------------------

{
  const holders38: Holder[] = [
    { id: "founder-38", name: "創業者", kind: "founder" },
    { id: "seedVc-38", name: "Seed投資家", kind: "investor" },
  ];
  const inc38: CapitalEvent = {
    id: "e-38-inc",
    type: "incorporation",
    label: "設立",
    order: 1,
    allocations: [alloc("founder-38", "common", 1_000_000)],
  };

  function makeManualSeed38(shares: number, amount: number): CapitalEvent {
    return {
      id: "e-38-seed",
      type: "equity_issue",
      label: "Seed（manual）",
      order: 2,
      preMoneyValuation: editableValue(400_000_000),
      // calculationBasis未設定(manual扱い)。primaryRaise/newShares/postMoneyValuationは
      // 未入力のまま = derive時にcalculated値として算出されるべき。
      allocations: [alloc("seedVc-38", "preferred", shares, { amount: editableValue(amount) })],
    };
  }

  // 初回derive: 割当(shares/amount)からサマリーが算出される。
  const plan38a: CapitalPlan = { id: "p-38a", name: "manual-seed-a", holders: holders38, events: [inc38, makeManualSeed38(250_000, 100_000_000)] };
  const derived38a = deriveCapitalPlan(plan38a);
  const seed38a = derived38a.events.find((e) => e.id === "e-38-seed")!;
  assert.equal(seed38a.newShares?.source, "calculated", "manual増資イベントのnewSharesがcalculatedとして算出されていません");
  assert.equal(resolvedValue(seed38a.newShares), 250_000, "manual増資イベントのnewSharesが割当株数合計と一致しません");
  assert.equal(seed38a.primaryRaise?.source, "calculated", "manual増資イベントのprimaryRaiseがcalculatedとして算出されていません");
  assert.equal(resolvedValue(seed38a.primaryRaise), 100_000_000, "manual増資イベントのprimaryRaiseが割当金額合計と一致しません");
  assert.equal(seed38a.postMoneyValuation?.source, "calculated", "manual増資イベントのpostMoneyValuationがcalculatedとして算出されていません");
  assert.equal(resolvedValue(seed38a.postMoneyValuation), 500_000_000, "manual増資イベントのpostMoneyValuationがpreMoney+primaryRaiseと一致しません");
  assertNoBlockingErrors(derived38a, "38a: 初回derive後のmanual増資イベント");

  // 割当(1株主あたりのamount/shares)を編集 → サマリー(newShares/primaryRaise/postMoney)が追随する。
  const plan38b: CapitalPlan = { id: "p-38b", name: "manual-seed-b", holders: holders38, events: [inc38, makeManualSeed38(300_000, 120_000_000)] };
  const derived38b = deriveCapitalPlan(plan38b);
  const seed38b = derived38b.events.find((e) => e.id === "e-38-seed")!;
  assert.equal(resolvedValue(seed38b.newShares), 300_000, "割当株数編集後にnewSharesが更新されていません");
  assert.equal(resolvedValue(seed38b.primaryRaise), 120_000_000, "割当金額編集後にprimaryRaiseが更新されていません");
  assert.equal(resolvedValue(seed38b.postMoneyValuation), 520_000_000, "割当金額編集後にpostMoneyValuationが更新されていません");
  assertNoBlockingErrors(derived38b, "38b: 割当編集後のmanual増資イベント");

  // newShares/primaryRaiseは真の派生出力（allocations由来）のため、手動入力(source:
  // 'input')で割当と食い違う値が入っていても、deriveは常に割当から再算出したcalculated
  // 値で上書きする（overrideだけが例外）。stale値がderive後も残ることはない。
  const staleSeed38: CapitalEvent = {
    ...makeManualSeed38(250_000, 100_000_000),
    newShares: editableValue(999),
    primaryRaise: editableValue(999),
  };
  const stalePlan38: CapitalPlan = { id: "p-38-stale", name: "manual-seed-stale", holders: holders38, events: [inc38, staleSeed38] };
  const derivedStale38 = deriveCapitalPlan(stalePlan38);
  const staleDerived = derivedStale38.events.find((e) => e.id === "e-38-seed")!;
  assert.equal(resolvedValue(staleDerived.newShares), 250_000, "手動入力(source: input)のnewSharesがderiveで割当から再算出されていません");
  assert.equal(staleDerived.newShares?.source, "calculated", "手動入力(source: input)のnewSharesがderive後にcalculatedへ更新されていません");
  assert.equal(resolvedValue(staleDerived.primaryRaise), 100_000_000, "手動入力(source: input)のprimaryRaiseがderiveで割当から再算出されていません");
  assert.equal(staleDerived.primaryRaise?.source, "calculated", "手動入力(source: input)のprimaryRaiseがderive後にcalculatedへ更新されていません");
  assertNoBlockingErrors(derivedStale38, "38c: derive後は割当と一致するため不整合が解消される");
}
console.log("38) deriveCapitalPlan: manual基準の増資イベントで割当編集がサマリー(primaryRaise/newShares/postMoney)に反映される: ok");

// ---------------------------------------------------------------------------
// 39) deriveCapitalPlan: manual基準のコンバーティブル転換イベントはprimaryRaiseが
//     常に0として算出され、newSharesは転換後の正の非希薄化割当から算出される。
//     コンバーティブル残高を超える消込のチェックはderiveではなくvalidateCapitalPlan
//     (ライフサイクル検証)が担う。
// ---------------------------------------------------------------------------

{
  const holders39: Holder[] = [
    { id: "founder-39", name: "創業者", kind: "founder" },
    { id: "seedVc-39", name: "Seed投資家", kind: "investor" },
  ];
  const inc39: CapitalEvent = {
    id: "e-39-inc",
    type: "incorporation",
    label: "設立",
    order: 1,
    allocations: [alloc("founder-39", "common", 1_000_000)],
  };
  const convIssue39: CapitalEvent = {
    id: "e-39-conv-issue",
    type: "convertible_issue",
    label: "J-KISS発行",
    order: 2,
    allocations: [alloc("seedVc-39", "convertible", 50_000, { amount: editableValue(10_000_000) })],
  };
  const conversion39: CapitalEvent = {
    id: "e-39-conversion",
    type: "convertible_conversion",
    label: "転換",
    order: 3,
    calculationBasis: "manual",
    allocations: [
      alloc("seedVc-39", "convertible", -50_000),
      alloc("seedVc-39", "preferred", 60_000),
    ],
  };
  const plan39: CapitalPlan = { id: "p-39", name: "conv-conversion-cashless", holders: holders39, events: [inc39, convIssue39, conversion39] };
  const derived39 = deriveCapitalPlan(plan39);
  const derivedConversion39 = derived39.events.find((e) => e.id === "e-39-conversion")!;
  assert.equal(derivedConversion39.primaryRaise?.source, "calculated", "manual転換イベントのprimaryRaiseがcalculatedとして算出されていません");
  assert.equal(resolvedValue(derivedConversion39.primaryRaise), 0, "manual転換イベントのprimaryRaiseが0として算出されていません（転換に現金授受はない）");
  assert.equal(derivedConversion39.newShares?.source, "calculated", "manual転換イベントのnewSharesがcalculatedとして算出されていません");
  assert.equal(resolvedValue(derivedConversion39.newShares), 60_000, "manual転換イベントのnewSharesが転換後の正の非希薄化割当と一致しません");
  assertNoBlockingErrors(derived39, "39: 残高内消込のmanual転換イベント");

  // コンバーティブル保有残高(50,000)を超える消込(-60,000)は、derive自体はエラーにせず
  // primaryRaise/newSharesを算出する。超過消込の検出はvalidateCapitalPlan(ライフサイクル
  // 検証)の責務であり、実際に検出されることを確認する。
  const overConsumeConversion39: CapitalEvent = {
    ...conversion39,
    id: "e-39-over-conversion",
    allocations: [
      alloc("seedVc-39", "convertible", -60_000),
      alloc("seedVc-39", "preferred", 70_000),
    ],
  };
  const overConsumePlan39: CapitalPlan = { id: "p-39-over", name: "conv-conversion-overconsume", holders: holders39, events: [inc39, convIssue39, overConsumeConversion39] };
  assert.doesNotThrow(() => deriveCapitalPlan(overConsumePlan39), "残高超過消込のmanual転換イベントでderiveCapitalPlanが例外を投げました（超過チェックはvalidateの責務）");
  const overConsumeIssues = validateCapitalPlan(overConsumePlan39);
  assert.ok(
    overConsumeIssues.some((i) => i.code === "convertible_consumption_exceeds_balance" && i.eventId === "e-39-over-conversion"),
    "コンバーティブル保有残高を超える消込がvalidateCapitalPlanで検出されていません",
  );
}
console.log("39) deriveCapitalPlan: manual基準の転換イベントはprimaryRaise=0・newSharesを算出し、残高超過消込の検出はvalidateCapitalPlanが担う: ok");

// ---------------------------------------------------------------------------
// 40) deriveCapitalPlan: imported/confirmedな真の派生出力(割当shares/price、
//     イベントprice/newShares/primaryRaise/postMoney)は、割当を編集して
//     再deriveすると必ずcalculated・最新値に更新される（stale値が残らない）。
//     一方、明示的なoverrideはoverrideのまま保持され、calculatedValueだけが
//     最新の算出値に更新される。
// ---------------------------------------------------------------------------

{
  const holders40: Holder[] = [
    { id: "founder-40", name: "創業者", kind: "founder" },
    { id: "seedVc-40", name: "Seed投資家", kind: "investor" },
  ];
  const inc40: CapitalEvent = {
    id: "e-40-inc",
    type: "incorporation",
    label: "設立",
    order: 1,
    allocations: [alloc("founder-40", "common", 1_000_000)],
  };
  const preMoney40 = 400_000_000;
  const expectedPrice40 = priceFromPreMoney(preMoney40, 1_000_000); // 400

  function makeImportedConfirmedSeed40(amount: number): CapitalEvent {
    return {
      id: "e-40-seed",
      type: "equity_issue",
      label: "Seed（取込値のstaleなサマリー）",
      order: 2,
      calculationBasis: "valuation_and_investment",
      preMoneyValuation: editableValue(preMoney40),
      // イベントレベルのサマリー・株価は、他システムからの取込(imported)や
      // 確認済み(confirmed)としてマークされた古い値。真の派生出力なので、
      // deriveでは割当由来の最新値に必ず更新されるべき。
      pricePerShare: editableValue(999, "confirmed"),
      newShares: editableValue(999_999, "imported"),
      primaryRaise: editableValue(999_999, "confirmed"),
      postMoneyValuation: editableValue(999_999_999, "imported"),
      allocations: [
        alloc("seedVc-40", "preferred", 999_999, {
          amount: editableValue(amount), // 投資額(amount)がbasisのドライバー
          pricePerShare: editableValue(999, "confirmed"),
        }),
      ],
    };
  }
  // shares自体もimportedのstale値で上書きしておく（alloc()はデフォルトinputなので明示的に差し替える）
  function withImportedShares(event: CapitalEvent): CapitalEvent {
    return { ...event, allocations: [{ ...event.allocations[0], shares: editableValue(999_999, "imported") }] };
  }

  // --- 初回derive: 取込/確認済みのstaleなサマリー値がすべて再算出される ---
  const seed40a = withImportedShares(makeImportedConfirmedSeed40(80_000_000));
  const plan40a: CapitalPlan = { id: "p-40a", name: "imported-confirmed-a", holders: holders40, events: [inc40, seed40a] };
  const derived40a = deriveCapitalPlan(plan40a);
  const derivedSeed40a = derived40a.events.find((e) => e.id === "e-40-seed")!;
  const derivedAlloc40a = derivedSeed40a.allocations[0];

  const expectedShares40a = Math.round(80_000_000 / expectedPrice40); // 200,000
  assert.equal(derivedAlloc40a.shares.value, expectedShares40a, "imported割当sharesがderiveで最新値に再算出されていません");
  assert.equal(derivedAlloc40a.shares.source, "calculated", "imported割当sharesのsourceがcalculatedに更新されていません");
  assert.equal(derivedAlloc40a.pricePerShare!.value, expectedPrice40, "confirmed割当pricePerShareがderiveで最新値に再算出されていません");
  assert.equal(derivedAlloc40a.pricePerShare!.source, "calculated", "confirmed割当pricePerShareのsourceがcalculatedに更新されていません");
  assert.equal(derivedSeed40a.pricePerShare!.value, expectedPrice40, "confirmedイベントpricePerShareがderiveで最新値に再算出されていません");
  assert.equal(derivedSeed40a.pricePerShare!.source, "calculated", "confirmedイベントpricePerShareのsourceがcalculatedに更新されていません");
  assert.equal(derivedSeed40a.newShares!.value, expectedShares40a, "importedイベントnewSharesがderiveで最新値に再算出されていません");
  assert.equal(derivedSeed40a.newShares!.source, "calculated", "importedイベントnewSharesのsourceがcalculatedに更新されていません");
  assert.equal(derivedSeed40a.primaryRaise!.value, 80_000_000, "confirmedイベントprimaryRaiseがderiveで最新値に再算出されていません");
  assert.equal(derivedSeed40a.primaryRaise!.source, "calculated", "confirmedイベントprimaryRaiseのsourceがcalculatedに更新されていません");
  assert.equal(derivedSeed40a.postMoneyValuation!.value, preMoney40 + 80_000_000, "importedイベントpostMoneyValuationがderiveで最新値に再算出されていません");
  assert.equal(derivedSeed40a.postMoneyValuation!.source, "calculated", "importedイベントpostMoneyValuationのsourceがcalculatedに更新されていません");
  assertNoBlockingErrors(derived40a, "40a: 初回derive後のimported/confirmedサマリー");

  // --- 割当(amount)を編集して再derive: サマリーが新しい値へ追随する（staleなまま残らない） ---
  const seed40b = withImportedShares(makeImportedConfirmedSeed40(120_000_000));
  const plan40b: CapitalPlan = { id: "p-40b", name: "imported-confirmed-b", holders: holders40, events: [inc40, seed40b] };
  const derived40b = deriveCapitalPlan(plan40b);
  const derivedSeed40b = derived40b.events.find((e) => e.id === "e-40-seed")!;
  const derivedAlloc40b = derivedSeed40b.allocations[0];

  const expectedShares40b = Math.round(120_000_000 / expectedPrice40); // 300,000
  assert.equal(derivedAlloc40b.shares.value, expectedShares40b, "割当amount編集後にsharesが再算出されていません");
  assert.equal(derivedSeed40b.newShares!.value, expectedShares40b, "割当amount編集後にnewSharesが再算出されていません");
  assert.equal(derivedSeed40b.primaryRaise!.value, 120_000_000, "割当amount編集後にprimaryRaiseが再算出されていません");
  assert.equal(derivedSeed40b.postMoneyValuation!.value, preMoney40 + 120_000_000, "割当amount編集後にpostMoneyValuationが再算出されていません");
  assertNoBlockingErrors(derived40b, "40b: 割当編集後のimported/confirmedサマリー");

  // --- 明示的なoverrideは保持され、calculatedValueだけが最新算出値に更新される ---
  const overriddenShares40 = expectedShares40a + 1_000; // 監査済み契約に合わせた手動上書き
  const seed40c: CapitalEvent = {
    ...makeImportedConfirmedSeed40(80_000_000),
    allocations: [
      {
        ...makeImportedConfirmedSeed40(80_000_000).allocations[0],
        shares: overrideValue(expectedShares40a, overriddenShares40, "契約書の確定株数で上書き"),
      },
    ],
  };
  const plan40c: CapitalPlan = { id: "p-40c", name: "imported-confirmed-override", holders: holders40, events: [inc40, seed40c] };
  const derived40c = deriveCapitalPlan(plan40c);
  const derivedAlloc40c = derived40c.events.find((e) => e.id === "e-40-seed")!.allocations[0];
  assert.equal(derivedAlloc40c.shares.value, overriddenShares40, "override後の割当sharesがderiveで変更されてしまっています");
  assert.equal(derivedAlloc40c.shares.source, "override", "override後の割当sharesのsourceがoverride以外に変わってはいけません");
  assert.equal(derivedAlloc40c.shares.calculatedValue, expectedShares40a, "override後もcalculatedValueが最新の自動算出値に更新されている必要があります");
}
console.log("40) deriveCapitalPlan: imported/confirmedな真の派生出力は編集・再deriveでstaleにならず常にcalculatedへ更新される（overrideは保持されcalculatedValueのみ更新）: ok");

// ---------------------------------------------------------------------------
// 41) 新規バリデーション: price_and_shares基準でイベント単価と割当単価が乖離した場合の
//     price_basis_allocation_price_mismatch（VC提出時の単価矛盾ブロック）
// ---------------------------------------------------------------------------

{
  const incorporation = makeIncorporation();

  // イベント単価と割当単価が乖離 → ブロッキングエラー、eligibleがfalseになる
  const mismatchRound: CapitalEvent = {
    id: "e-price-mismatch",
    type: "equity_issue",
    label: "Seed（単価矛盾）",
    order: 2,
    calculationBasis: "price_and_shares",
    pricePerShare: editableValue(400),
    allocations: [alloc("seedVc", "preferred", 100_000, { pricePerShare: editableValue(300) })],
  };
  const mismatchPlan: CapitalPlan = {
    id: "p-price-mismatch",
    name: "price-mismatch",
    holders,
    events: [incorporation, mismatchRound],
  };
  const mismatchIssues = validateCapitalPlan(mismatchPlan);
  const mismatchIssue = mismatchIssues.find(
    (i) => i.code === "price_basis_allocation_price_mismatch" && i.eventId === "e-price-mismatch",
  );
  assert.ok(mismatchIssue, "price_and_shares基準でのイベント単価と割当単価の乖離が検出されていません");
  assert.equal(mismatchIssue!.severity, "error", "単価矛盾はブロッキングエラーである必要があります");
  assert.equal(mismatchIssue!.holderId, "seedVc", "単価矛盾issueのholderIdが対象株主と一致しません");

  const mismatchEligibility = checkPublishEligibility(mismatchPlan);
  assert.equal(
    mismatchEligibility.eligible,
    false,
    "イベント単価と割当単価が矛盾したVC提出書類がeligible=trueのまま通過してしまっています",
  );

  // 許容誤差(YEN_TOLERANCE)以内の差は検出されない
  const withinTolRound: CapitalEvent = {
    id: "e-price-within-tol",
    type: "equity_issue",
    label: "Seed（誤差内）",
    order: 2,
    calculationBasis: "price_and_shares",
    pricePerShare: editableValue(400),
    allocations: [alloc("seedVc", "preferred", 100_000, { pricePerShare: editableValue(400) })],
  };
  const withinTolPlan: CapitalPlan = {
    id: "p-price-within-tol",
    name: "price-within-tol",
    holders,
    events: [incorporation, withinTolRound],
  };
  assert.ok(
    !validateCapitalPlan(withinTolPlan).some((i) => i.code === "price_basis_allocation_price_mismatch"),
    "誤差なしの一致した単価が誤って乖離検出されています",
  );

  // 割当に単価が設定されていない（=イベント単価のみで駆動する通常ケース）は誤検出されない
  const noAllocPriceRound: CapitalEvent = {
    id: "e-price-no-alloc-price",
    type: "equity_issue",
    label: "Seed（割当単価なし）",
    order: 2,
    calculationBasis: "price_and_shares",
    pricePerShare: editableValue(400),
    allocations: [alloc("seedVc", "preferred", 100_000)],
  };
  const noAllocPricePlan: CapitalPlan = {
    id: "p-price-no-alloc-price",
    name: "price-no-alloc-price",
    holders,
    events: [incorporation, noAllocPriceRound],
  };
  assert.ok(
    !validateCapitalPlan(noAllocPricePlan).some((i) => i.code === "price_basis_allocation_price_mismatch"),
    "割当単価が未設定なのに誤って乖離検出されています",
  );

  // manual基準は割当ごとの個別単価が正規の運用のため、このチェックの対象外
  const manualRound: CapitalEvent = {
    id: "e-price-manual",
    type: "equity_issue",
    label: "Seed（manual基準）",
    order: 2,
    calculationBasis: "manual",
    pricePerShare: editableValue(400),
    allocations: [alloc("seedVc", "preferred", 100_000, { pricePerShare: editableValue(300) })],
  };
  const manualPlan: CapitalPlan = { id: "p-price-manual", name: "price-manual", holders, events: [incorporation, manualRound] };
  assert.ok(
    !validateCapitalPlan(manualPlan).some((i) => i.code === "price_basis_allocation_price_mismatch"),
    "manual基準の個別単価が誤ってprice_and_shares専用チェックで検出されています",
  );
}
console.log("41) 新規バリデーション: price_and_shares基準でのイベント単価/割当単価の乖離検出（VC提出時の単価矛盾ブロック）: ok");

console.log("capital plan: ok");
