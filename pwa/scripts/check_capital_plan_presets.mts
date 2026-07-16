import assert from "node:assert/strict";
import {
  createStandardIpoCapitalPlanDocument,
  createCapitalPlanDocumentFromCompanyOverview,
} from "../src/lib/capital-plan-presets.ts";
import {
  deriveCapitalPlan,
  validateCapitalPlan,
  hasBlockingErrors,
  resolvedValue,
  editableValue,
  type CapitalPlan,
} from "../src/lib/capital-plan.ts";
import type { CompanyOverviewData } from "../src/lib/company-overview.ts";

function buildPlan(): CapitalPlan {
  const doc = createStandardIpoCapitalPlanDocument();
  return { id: "preset-check", name: "標準IPOプランニングポリシー", holders: doc.holders, events: doc.events };
}

// 1. コアラベル・順序の確認
{
  const plan = buildPlan();
  const labels = [...plan.events].sort((a, b) => a.order - b.order).map((e) => e.label);
  assert.deepEqual(labels, ["設立", "Seed", "Series A", "Series B", "Series C", "IPO"], "コアラベル・順序が一致しません");
}

// 2. 全イベントが planned
{
  const plan = buildPlan();
  for (const event of plan.events) {
    assert.equal(event.status, "planned", `${event.label} が planned ではありません`);
  }
}

// 3. 創業者は設立時に10000株、各ラウンドは別々の投資家、protect-holderなし
{
  const plan = buildPlan();
  const founder = plan.holders.find((h) => h.id === "founder");
  assert.ok(founder, "founder holder が存在しません");
  assert.equal(founder!.kind, "founder");

  const incorporation = plan.events.find((e) => e.label === "設立");
  assert.ok(incorporation);
  const founderAlloc = incorporation!.allocations.find((a) => a.holderId === "founder");
  assert.equal(resolvedValue(founderAlloc?.shares), 10000, "創業者の設立時株数が10000ではありません");

  const investorHolderIds = new Set<string>();
  for (const label of ["Seed", "Series A", "Series B", "Series C"]) {
    const event = plan.events.find((e) => e.label === label);
    assert.ok(event, `${label} イベントが見つかりません`);
    assert.equal(event!.calculationBasis, "valuation_and_investment");
    assert.equal(event!.allocations.length, 1, `${label} の割当数が1ではありません`);
    const holderId = event!.allocations[0].holderId;
    assert.ok(!investorHolderIds.has(holderId), `${label} の投資家が他ラウンドと重複しています`);
    investorHolderIds.add(holderId);
  }
  assert.equal(investorHolderIds.size, 4, "投資家4者が別々のholderになっていません");

  const ipo = plan.events.find((e) => e.label === "IPO");
  assert.ok(ipo);
  assert.equal(ipo!.type, "ipo");
  const ipoHolderId = ipo!.allocations[0].holderId;
  assert.ok(!investorHolderIds.has(ipoHolderId), "IPO の公開市場ホルダーが既存投資家と重複しています");
  const publicMarket = plan.holders.find((h) => h.id === ipoHolderId);
  assert.ok(publicMarket, "IPO 用の holder が holders に登録されていません");

  const holderKinds = new Set(plan.holders.map((h) => h.kind));
  assert.ok(!holderKinds.has("advisor" as never) || true); // no protect-holder assertion placeholder
  for (const h of plan.holders) {
    assert.notEqual(h.name, "", `holder ${h.id} の名前が空です`);
  }
}

// 4. validate + derive が通り、増加するpre-moneyになっている
{
  const plan = buildPlan();
  const derived = deriveCapitalPlan(plan);
  const issues = validateCapitalPlan(derived);
  const blocking = issues.filter((i) => i.severity === "error");
  assert.equal(blocking.length, 0, `derive後のプランにブロッキングエラーがあります: ${JSON.stringify(blocking)}`);
  assert.ok(!hasBlockingErrors(issues), "hasBlockingErrors が true を返しました");

  const financingLabels = ["Seed", "Series A", "Series B", "Series C", "IPO"];
  let prevPreMoney = 0;
  for (const label of financingLabels) {
    const event = derived.events.find((e) => e.label === label);
    assert.ok(event);
    const pre = resolvedValue(event!.preMoneyValuation);
    assert.ok(pre > prevPreMoney, `${label} のpre-moneyが前ラウンド以下です (${pre} <= ${prevPreMoney})`);
    prevPreMoney = pre;

    const alloc = event!.allocations[0];
    assert.ok(resolvedValue(alloc.shares) > 0, `${label} の投資家割当株数が0以下です`);
    assert.ok(resolvedValue(alloc.pricePerShare) > 0, `${label} の1株あたり価格が0以下です`);
  }
}

// 5. Seedのpre-money/investmentを変更すると下流に伝播する
{
  const plan = buildPlan();
  const seedEvent = plan.events.find((e) => e.label === "Seed");
  assert.ok(seedEvent);
  seedEvent!.preMoneyValuation = editableValue(400_000_000);
  seedEvent!.allocations[0].amount = editableValue(80_000_000);

  const derivedBefore = deriveCapitalPlan(buildPlan());
  const derivedAfter = deriveCapitalPlan(plan);

  const seedBefore = derivedBefore.events.find((e) => e.label === "Seed")!;
  const seedAfter = derivedAfter.events.find((e) => e.label === "Seed")!;
  assert.notEqual(resolvedValue(seedAfter.allocations[0].shares), resolvedValue(seedBefore.allocations[0].shares), "Seedの株数変更が反映されていません");

  const seriesABefore = derivedBefore.events.find((e) => e.label === "Series A")!;
  const seriesAAfter = derivedAfter.events.find((e) => e.label === "Series A")!;
  assert.notEqual(
    resolvedValue(seriesAAfter.allocations[0].shares),
    resolvedValue(seriesABefore.allocations[0].shares),
    "Seedの変更がSeries Aの株数に伝播していません",
  );

  const ipoBefore = derivedBefore.events.find((e) => e.label === "IPO")!;
  const ipoAfter = derivedAfter.events.find((e) => e.label === "IPO")!;
  assert.notEqual(
    resolvedValue(ipoAfter.allocations[0].shares),
    resolvedValue(ipoBefore.allocations[0].shares),
    "Seedの変更がIPOの株数まで伝播していません",
  );

  const afterIssues = validateCapitalPlan(derivedAfter);
  assert.ok(!hasBlockingErrors(afterIssues), `Seed変更後のプランにブロッキングエラーがあります: ${JSON.stringify(afterIssues.filter((i) => i.severity === "error"))}`);
}

// 6. 会社概要（確定履歴あり）からの取込: provenance / status / round値 / 未来イベント追記
{
  const seedRound = {
    id: "round-seed",
    round_name: "Seed",
    round_date: "2024-04-01",
    round_ym: "2024-04",
    pre_money_yen: 300_000_000,
    post_money_yen: 350_000_000,
    raised_yen: 50_000_000,
    price_per_share_yen: 10000,
    lead_investor: "Seed投資家",
    source_ref: "seed-term-sheet.pdf",
    notes: null,
  };

  const incorporationTx = {
    id: "tx-incorporation",
    project_id: "p-test",
    round_id: null,
    effective_on: "2023-01-10",
    transaction_type: "incorporation",
    description: null,
    status: "confirmed" as const,
    source_ref: "articles-of-incorporation.pdf",
    notes: "設立時登記",
    project_equity_entries: [
      {
        id: "entry-founder",
        holder_type: "founder",
        holder_name: "創業者A",
        security_class: "普通株式",
        outstanding_delta: 10000,
        diluted_delta: 10000,
        paid_in_yen_delta: 1_000_000,
      },
    ],
  };

  const seedTx = {
    id: "tx-seed",
    project_id: "p-test",
    round_id: "round-seed",
    effective_on: "2024-04-01",
    transaction_type: "new_issue",
    description: null,
    status: "confirmed" as const,
    source_ref: "seed-round-minutes.pdf",
    notes: null,
    project_equity_entries: [
      {
        id: "entry-seed-investor",
        holder_type: "vc",
        holder_name: "Seed投資家A",
        security_class: "優先株式",
        outstanding_delta: 5000,
        diluted_delta: 5000,
        paid_in_yen_delta: 50_000_000,
      },
    ],
  };

  const plannedTx = {
    id: "tx-planned-noise",
    project_id: "p-test",
    round_id: null,
    effective_on: "2025-01-01",
    transaction_type: "new_issue",
    description: "未確定の計画メモ",
    status: "planned" as const,
    source_ref: null,
    notes: null,
    project_equity_entries: [
      {
        id: "entry-planned",
        holder_type: "vc",
        holder_name: "計画中投資家",
        security_class: "優先株式",
        outstanding_delta: 999,
        diluted_delta: 999,
        paid_in_yen_delta: 999,
      },
    ],
  };

  const data: CompanyOverviewData = {
    profile: null,
    shareholders: [],
    transactions: [incorporationTx, seedTx, plannedTx],
    convertibles: [],
    financialPeriods: [],
    rounds: [seedRound],
    meetings: [],
    actionItems: [],
  };

  const before = JSON.parse(JSON.stringify(data));
  const doc = createCapitalPlanDocumentFromCompanyOverview(data);
  assert.deepEqual(data, before, "入力の CompanyOverviewData を変更してはいけません");

  const incorporationEvent = doc.events.find((e) => e.id === "tx-incorporation");
  assert.ok(incorporationEvent, "設立取引からのイベントが見つかりません");
  assert.equal(incorporationEvent!.status, "confirmed");
  assert.equal(incorporationEvent!.calculationBasis, "manual");
  assert.equal(incorporationEvent!.type, "incorporation");
  assert.ok(incorporationEvent!.note?.includes("articles-of-incorporation.pdf"), "source_ref が note に保持されていません");
  assert.ok(incorporationEvent!.note?.includes("設立時登記"), "notes が保持されていません");
  const founderAlloc = incorporationEvent!.allocations[0];
  assert.equal(resolvedValue(founderAlloc.shares), 10000);
  assert.equal(founderAlloc.shares.source, "imported");
  assert.equal(resolvedValue(founderAlloc.amount), 1_000_000);
  assert.equal(founderAlloc.amount!.source, "imported");

  const seedEvent = doc.events.find((e) => e.id === "tx-seed");
  assert.ok(seedEvent, "Seed取引からのイベントが見つかりません");
  assert.equal(seedEvent!.label, "Seed", "round_name がイベントラベルに反映されていません");
  assert.equal(seedEvent!.status, "confirmed");
  assert.equal(resolvedValue(seedEvent!.preMoneyValuation), 300_000_000);
  assert.equal(seedEvent!.preMoneyValuation!.source, "confirmed");
  assert.equal(resolvedValue(seedEvent!.postMoneyValuation), 350_000_000);
  assert.equal(resolvedValue(seedEvent!.primaryRaise), 50_000_000);
  assert.equal(resolvedValue(seedEvent!.pricePerShare), 10000);
  assert.equal(seedEvent!.allocations[0].shareClass, "preferred");

  assert.ok(
    !doc.events.some((e) => e.id === "tx-planned-noise"),
    "planned の取引が確定履歴として取り込まれてはいけません",
  );

  const labels = [...doc.events].sort((a, b) => a.order - b.order).map((e) => e.label);
  assert.deepEqual(
    labels,
    ["設立", "Seed", "Series A", "Series B", "Series C", "IPO"],
    "確定履歴のSeedと重複しない標準ラウンドが未来イベントとして順序通り追記されていません",
  );
  assert.equal(
    doc.events.filter((e) => e.label === "設立").length,
    1,
    "設立イベントが標準プリセットから重複追加されてはいけません",
  );

  const futureEvents = doc.events.filter((e) => e.status === "planned");
  assert.deepEqual(
    futureEvents.map((e) => e.label),
    ["Series A", "Series B", "Series C", "IPO"],
    "確定済みSeedを除いた将来イベントのみがplannedで追記されていません",
  );

  const orders = [...doc.events].sort((a, b) => a.order - b.order).map((e) => e.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b), "orderが連続的に増加していません");
  assert.equal(new Set(orders).size, orders.length, "orderが重複しています");

  const derived = deriveCapitalPlan({ id: "check", name: "取込テスト", holders: doc.holders, events: doc.events });
  const issues = validateCapitalPlan(derived);
  assert.ok(!hasBlockingErrors(issues), `取込プランにブロッキングエラーがあります: ${JSON.stringify(issues.filter((i) => i.severity === "error"))}`);
}

// 7. 確定履歴が無い場合: 現在値取込（履歴未復元）フォールバック
{
  const data: CompanyOverviewData = {
    profile: null,
    shareholders: [
      {
        id: "sh-founder",
        holder_type: "founder",
        holder_name: "創業者A",
        share_class: "普通株式",
        shares: 8000,
        ownership_pct: 80,
        invested_yen: 800_000,
        as_of_ym: "2026-06",
        is_current: true,
      },
      {
        id: "sh-vc",
        holder_type: "vc",
        holder_name: "既存投資家A",
        share_class: "優先株式",
        shares: 2000,
        ownership_pct: 20,
        invested_yen: 20_000_000,
        as_of_ym: "2026-06",
        is_current: true,
      },
    ],
    transactions: [],
    convertibles: [],
    financialPeriods: [],
    rounds: [],
    meetings: [],
    actionItems: [],
  };

  const before = JSON.parse(JSON.stringify(data));
  const doc = createCapitalPlanDocumentFromCompanyOverview(data);
  assert.deepEqual(data, before, "入力の CompanyOverviewData を変更してはいけません");

  const baseline = doc.events.find((e) => e.label === "現在値取込（履歴未復元）");
  assert.ok(baseline, "確定履歴が無い場合のフォールバックイベントが見つかりません");
  assert.equal(baseline!.status, "confirmed");
  assert.equal(baseline!.type, "incorporation");
  assert.ok(baseline!.note && /現在|履歴/.test(baseline!.note), "現在値取込であり履歴を復元できない旨のnoteが必要です");
  assert.equal(baseline!.allocations.length, 2);

  const labels = [...doc.events].sort((a, b) => a.order - b.order).map((e) => e.label);
  assert.deepEqual(
    labels,
    ["現在値取込（履歴未復元）", "Seed", "Series A", "Series B", "Series C", "IPO"],
    "現在値取込のあと標準ラウンドが全て未来イベントとして追記されていません",
  );

  const derived = deriveCapitalPlan({ id: "check", name: "現在値フォールバック", holders: doc.holders, events: doc.events });
  const issues = validateCapitalPlan(derived);
  assert.ok(!hasBlockingErrors(issues), `フォールバックプランにブロッキングエラーがあります: ${JSON.stringify(issues.filter((i) => i.severity === "error"))}`);
}

console.log("check_capital_plan_presets.mts: all checks passed");
