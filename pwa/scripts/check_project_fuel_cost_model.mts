// コスト試算（燃料）の計算エンジンと画面の契約チェック。DB接続なし。
// Run: npm run test:project-cost-model（排水処理のコスト試算の契約チェックの後に続けて走る。deploy.sh が本番反映前に実行）
//
// 【なぜこの guard があるか】
// 2026-09-14 まさ「OSの技術ページに、新たに『コスト試算（燃料）』を追加してほしい。
// そんで廃液処理のコスト試算と同様にバイオディーゼル事業のコスト試算シートを作ってほしい」。
// 排水処理のコスト試算で積み上げた約束（年に要る量は入力ではなく計算、未確定値はすべて画面で変えられる、
// 操作と結果を1枠に並べる、3桁カンマ、作業単価は共通の1つ、CAPEX / OPEX の区分、画面に「中央培養」を出さない）を、
// 燃料の試算でも崩さない。燃料の試算は同じテーブルに case_kind = 'biodiesel' で入るので、
// 排水処理のコスト試算タブが燃料の試算を読んでしまう事故も止める。
//
// 正本: pwa/spec/5-16-project-fuel-cost-model-current-spec.md
// fixture: scripts/__fixtures__/sx_fuel_cost_model.json（migration 412 の SX の燃料の試算。同じ生成定義から書き出した）
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  FUEL_BREAKDOWN_ORDER,
  FUEL_SECRETION_YIELD_ROLES,
  LIPID_SECRETION_ROLE,
  fuelBreakdownLabelOf,
  fuelSecretionOn,
  fuelSelectionOf,
  fuelUnitFactorOf,
  FUEL_CASE_KIND,
  FUEL_CONVERSIONS,
  FUEL_PARAM_GROUPS,
  FUEL_ROLE_KEYS,
  FUEL_TEXT_CHOICE_ROLES,
  FUEL_YIELD_CASES,
  computeFuelCostModel,
  computeFuelScenario,
  computeFuelTaskFlow,
  findFuelScenario,
  fuelCultureItemPerKg,
  fuelEffectiveUnitPrice,
  fuelItemAnnual,
  fuelItemCalc,
  fuelItemLabel,
  fuelParamGroupOfItem,
  fuelParamGroupOfRole,
  fuelResidueOf,
  fuelRowApplies,
  fuelScaleOf,
  fuelTaskAmount,
  fuelYieldOf,
  isFuelModel,
  type FuelPriceContext,
} from "../src/lib/project-fuel-cost-model.ts";
import { applyDraft, draftKey, draftToPatches, setDraftValue } from "../src/lib/project-cost-model-draft.ts";
import {
  CO2_FLUE_GAS_ROLE,
  COST_PARAM_GROUPS,
  COST_ROLE_KEYS,
  ITEM_INLINE_ROLES,
  WASTE_MEDIUM_REDUCTION_ROLE,
  WASTE_MEDIUM_ROLE,
  annualAmount,
  biomassOf,
  centralItemPerKg,
  computeCostModel,
  costItemCalc,
  effectiveUnitPrice,
  type CostModelBundle,
} from "../src/lib/project-cost-model.ts";
import { evaluateCalcSegment, evaluateItemCalc, type ItemCalc } from "../src/lib/cost-item-calc.ts";

const root = new URL("..", import.meta.url);
const read = (p: string) => fs.readFileSync(new URL(p, root), "utf8");
const fixture: CostModelBundle = JSON.parse(read("scripts/__fixtures__/sx_fuel_cost_model.json"));
const clone = (): CostModelBundle => JSON.parse(JSON.stringify(fixture));
const near = (a: number, b: number, tol = 1e-6, msg = "") => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg} ${a} ≠ ${b}`);
const setRole = (b: CostModelBundle, role: string, patch: Record<string, unknown>) => {
  b.assumptions = b.assumptions.map((a) => (a.roleKey === role ? { ...a, ...patch } : a));
  return b;
};
let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

check("fixture は燃料の試算で、6通りを計算できる", () => {
  assert.equal(fixture.model.caseKind, FUEL_CASE_KIND);
  assert.ok(isFuelModel(fixture.model));
  assert.equal(fixture.model.unitBasisLabel, "L");
  const c = computeFuelCostModel(fixture);
  assert.equal(c.scenarios.length, FUEL_CONVERSIONS.length * FUEL_YIELD_CASES.length);
  for (const conv of FUEL_CONVERSIONS) for (const y of FUEL_YIELD_CASES) assert.ok(findFuelScenario(c, conv, y), `${conv}:${y}`);
  assert.equal(c.targetTotalPerLiter, 140);
});

check("収率の3ケース: FAMEポテンシャルは細胞の構造からの試算（4 / 6 / 8%）、回収率などはマテバラ推定（2026-09-07）", () => {
  const fame = (role: string) => fixture.assumptions.find((a) => a.roleKey === role)?.value;
  assert.deepEqual([fame("fame_potential_low"), fame("fame_potential"), fame("fame_potential_high")], [4, 6, 8], "FAMEポテンシャル 低位4・基準6・改善8");
  // 精製FAME / 乾燥菌体1t: 低位 4%×90%×80%×95%×95% ・基準 6%×95%×90%×97%×98% ・改善 8%×98%×95%×99%×99%
  near(fuelYieldOf(fixture.assumptions, "base").fameKgPerKgDcw * 1000, 48.76578, 1e-9, "基準");
  near(fuelYieldOf(fixture.assumptions, "low").fameKgPerKgDcw * 1000, 25.992, 1e-9, "低位");
  near(fuelYieldOf(fixture.assumptions, "high").fameKgPerKgDcw * 1000, 72.997848, 1e-9, "改善");
  // 燃料1Lに要る菌体 = 密度 ÷ FAME kg/kg
  const y = fuelYieldOf(fixture.assumptions, "base");
  near(y.unitKgPerLiter, 0.88 / 0.04876578, 1e-9, "kg/L");
  near(y.litersPerKgDcw * 1000, 55.41566, 1e-4, "L/t");
});

check("年に要る菌体の量と設備の系列数は、年間の燃料の量から計算する（入力ではない）", () => {
  assert.ok(!FUEL_ROLE_KEYS.has("culture_capacity_kg_year"), "年間生産能力を入力として持たない");
  const vol = fixture.assumptions.find((a) => a.roleKey === "business_annual_volume");
  assert.equal(vol?.value, 50_000_000);
  for (const yc of FUEL_YIELD_CASES) {
    const y = fuelYieldOf(fixture.assumptions, yc);
    const s = fuelScaleOf(fixture.assumptions, y);
    near(s.unitKgYear, 50_000_000 * y.unitKgPerLiter, 1e-12, `${yc} 年に要る菌体`);
    near(s.cultureLines, s.unitKgYear / 33_333, 1e-12, `${yc} 培養設備`);
    near(s.plantLines, s.unitKgYear / 50_000_000, 1e-12, `${yc} 燃料化設備`);
    near(s.shipmentsPerYear, 50_000_000 / 20_000, 1e-12, "出荷の台数");
    near(s.lotsPerYear, 50_000_000 / 500_000, 1e-12, "品質確認のロット数");
  }
  // 年間の燃料の量を2倍にすると、系列数と初期投資と売上が2倍、1Lあたりはほとんど変わらない（系列ごとに並べるので）
  const base = computeFuelScenario(fixture, "outsourced", "base");
  const doubled = computeFuelScenario(setRole(clone(), "business_annual_volume", { value: 100_000_000 }), "outsourced", "base");
  near(doubled.scale.plantLines, base.scale.plantLines * 2, 1e-12, "系列数2倍");
  near(doubled.capexInitial, base.capexInitial * 2, 1e-9, "初期投資2倍");
  near(doubled.revenueAnnual, base.revenueAnnual * 2, 1e-12, "売上2倍");
  near(doubled.totalPerLiter, base.totalPerLiter, 1e-9, "1Lあたりは同じ（拠点に1つの作業が無い）");
});

check("内訳は6区分で、足すと総コストに一致する。CAPEX と OPEX を足しても総コスト", () => {
  const c = computeFuelCostModel(fixture);
  for (const s of c.scenarios) {
    assert.deepEqual(s.breakdown.map((b) => b.key), FUEL_BREAKDOWN_ORDER);
    near(s.breakdown.reduce((t, b) => t + b.perLiter, 0), s.totalPerLiter, 1e-12, `${s.key} 内訳の合計`);
    for (const b of s.breakdown) near(b.parts.reduce((t, p) => t + p.perLiter, 0), b.perLiter, 1e-9, `${s.key} ${b.key} 中身の合計`);
    near(s.capexPerLiter + s.opexPerLiter, s.totalPerLiter, 1e-12, `${s.key} CAPEX+OPEX`);
    near(s.biomassPerLiter + s.processPerLiter, s.totalPerLiter, 1e-12, `${s.key} 菌体費+工程`);
    near(s.totalAnnual, s.totalPerLiter * s.scale.annualLiters, 1e-12, `${s.key} 年額`);
  }
});

check("260914版の数字（外部に委託・自社で行う × 3ケース、円/L。413 でFAMEポテンシャルを置き直し、426 で培養の原料を「使う量 × 買値」に組み直し、430 で培養ロス補充の単価を原料の合計から出すようにした後。排ガス利用可能は OFF）", () => {
  const c = computeFuelCostModel(fixture);
  const expect: Record<string, number> = {
    "outsourced:low": 11260.0, "outsourced:base": 6033.4, "outsourced:high": 4053.3,
    "inhouse:low": 11258.5, "inhouse:base": 6007.5, "inhouse:high": 4018.1,
  };
  for (const [key, v] of Object.entries(expect)) {
    const s = c.scenarios.find((x) => x.key === key)!;
    assert.equal(Math.round(s.totalPerLiter * 10) / 10, v, key);
  }
  const base = findFuelScenario(c, "outsourced", "base")!;
  assert.equal(Math.round(base.biomass.perKg * 100) / 100, 306.39, "菌体1kgの原価（排水処理の自然株 312.8円 − 保管・輸送設備 6.43円）");
  assert.equal(Math.round(base.biomassPerLiter * 10) / 10, 5528.9, "菌体費");
  for (const s of c.scenarios) assert.ok(s.breakEvenBiomassPerKg < 0, `${s.key}: 菌体がタダでも燃料化の工程だけで売価を超える`);
  const high = findFuelScenario(c, "outsourced", "high")!;
  assert.equal(Math.round(high.breakEvenBiomassPerKg * 10) / 10, -13.3, "改善・委託の売価で成立する菌体の原価");
  near(base.revenueAnnual, 10_000_000_000, 1e-12, "売上100億円");
});

check("FAMEポテンシャルを2倍にすると、菌体に比例する費用が半分になり、燃料1Lあたりの費用は変わらない", () => {
  const base = computeFuelScenario(fixture, "outsourced", "base");
  const baseFame = fixture.assumptions.find((a) => a.roleKey === "fame_potential")!.value!;
  const doubled = computeFuelScenario(setRole(clone(), "fame_potential", { value: baseFame * 2 }), "outsourced", "base");
  near(doubled.yield.unitKgPerLiter, base.yield.unitKgPerLiter / 2, 1e-12, "1Lに要る菌体が半分");
  near(doubled.biomassPerLiter, base.biomassPerLiter / 2, 1e-9, "菌体費が半分");
  const sliceOf = (s: typeof base, key: string) => s.breakdown.find((b) => b.key === key)!.perLiter;
  // FAMEにする（委託費・輸送は燃料1Lあたり）は変わらない
  near(sliceOf(doubled, "conversion"), sliceOf(base, "conversion"), 1e-12, "委託費は1Lあたり");
  // 設備の償却は処理する菌体の量で系列を並べるので半分
  near(sliceOf(doubled, "capex"), sliceOf(base, "capex") / 2, 1e-9, "燃料化設備の償却が半分");
});

check("FAME転換: 委託するときは自社精製の行を数えず、自社で行うときは外部委託の行を数えない", () => {
  for (const conv of FUEL_CONVERSIONS) {
    const s = computeFuelScenario(fixture, conv, "base");
    const other = conv === "outsourced" ? "自社精製" : "外部委託";
    const ownIds = new Set(s.breakdown.flatMap((b) => b.parts.map((p) => p.label)));
    for (const i of fixture.items.filter((x) => (x.scenario as string) === other)) {
      assert.ok(!fuelRowApplies(i, conv), `${conv} で ${i.costItemId} は発生しない`);
    }
    for (const t of (fixture.tasks ?? []).filter((x) => (x.scenario as string) === other)) {
      assert.ok(!ownIds.has(t.label), `${conv} の内訳に ${t.label} が入らない`);
    }
    // 片方の範囲の明細を消しても、もう片方の総コストは変わらない
    const pruned = clone();
    pruned.items = pruned.items.filter((x) => (x.scenario as string) !== other);
    pruned.tasks = (pruned.tasks ?? []).filter((x) => (x.scenario as string) !== other);
    near(computeFuelScenario(pruned, conv, "base").totalPerLiter, s.totalPerLiter, 1e-12, `${conv} は ${other} の行に左右されない`);
  }
  const out = computeFuelScenario(fixture, "outsourced", "base");
  const tolling = fixture.items.find((i) => i.costItemId === "cif_out_tolling")!;
  near(fuelItemAnnual(tolling, out.scale) / out.scale.annualLiters, 60, 1e-12, "委託費 60円/L");
});

check("残渣の行き先: 発酵などは正味の費用、産業廃棄物は 残渣の量 × 湿重量倍率 × 処分単価", () => {
  const digest = fuelResidueOf(fixture.assumptions);
  assert.equal(digest.route, "digestion");
  assert.equal(digest.perKgDcw, 0);
  const disposed = setRole(clone(), "residue_route", { valueText: "disposal" });
  const r = fuelResidueOf(disposed.assumptions);
  near(r.perKgDcw, 0.878 * 5 * 35, 1e-12, "処分の単価");
  const s = computeFuelScenario(disposed, "outsourced", "base");
  const base = computeFuelScenario(fixture, "outsourced", "base");
  near(s.totalPerLiter - base.totalPerLiter, r.perKgDcw * base.yield.unitKgPerLiter, 1e-9, "処分に変えた差");
  assert.equal(Math.round(s.totalPerLiter - base.totalPerLiter), 2773, "基準の収率で約2,770円/L 上がる");
});

check("菌体の原価の上書き: 0 を入れると菌体費が0、売価で成立する菌体の原価は（売価 − 工程）÷ 1Lに要る菌体", () => {
  const b = setRole(clone(), "biomass_cost_per_kg_override", { value: 0 });
  const s = computeFuelScenario(b, "outsourced", "high");
  assert.equal(s.biomassPerLiter, 0);
  near(s.breakEvenBiomassPerKg, (200 - s.processPerLiter) / s.yield.unitKgPerLiter, 1e-12, "成立ライン");
  const flow = computeFuelTaskFlow(b, s);
  assert.equal(flow.steps.find((st) => st.label === "菌体をつくる")?.perLiter ?? 0, 0, "上書き値のとき培養の作業は1Lに配らない");
});

check("作業: 年額 = 年間回数 ×（工数 × 共通の作業単価 ＋ 経費）。系列ごとの作業は系列数を掛ける", () => {
  const s = computeFuelScenario(fixture, "inhouse", "base");
  const op = (fixture.tasks ?? []).find((t) => t.costTaskId === "ctf_plant_operation")!;
  const amt = fuelTaskAmount(op, fixture.assumptions, s.scale);
  near(amt.occurrences, 300 * s.scale.plantLines, 1e-12, "燃料化設備の系列ごと");
  near(amt.annual, amt.occurrences * 72 * 4000, 1e-12, "年額");
  const ship = (fixture.tasks ?? []).find((t) => t.costTaskId === "ctf_ship_truck")!;
  near(fuelTaskAmount(ship, fixture.assumptions, s.scale).annual, 2500 * 60000, 1e-12, "出荷の台数 × 運賃");
  // 作業単価を2倍にすると、工数のある作業の人件費が2倍（作業ごとの単価は持たない）
  const doubled = setRole(clone(), "labor_rate", { value: 8000 });
  near(fuelTaskAmount(op, doubled.assumptions, s.scale).laborAnnual, amt.laborAnnual * 2, 1e-12, "共通の作業単価");
  // 作業の流れの合計は、シナリオの作業と一致する
  const flow = computeFuelTaskFlow(fixture, s);
  near(flow.plantHours, s.plantTaskHours, 1e-9, "工数");
  assert.deepEqual(flow.steps.map((st) => st.label), ["菌体をつくる", "脱水・油回収", "FAMEにする", "品質を確かめて出荷する"]);
  const outFlow = computeFuelTaskFlow(fixture, computeFuelScenario(fixture, "outsourced", "base"));
  assert.ok(!outFlow.steps.some((st) => st.rows.some((r) => r.task.costTaskId === "ctf_inhouse_operation")), "委託では自社のFAME転換の運転が無い");
});

check("前提・明細は区分に置かれる（事業と製造の条件 / CAPEX / OPEX）。計算に使う前提は全部置き場所がある", () => {
  for (const a of fixture.assumptions) {
    assert.ok(a.roleKey && FUEL_ROLE_KEYS.has(a.roleKey), `計算に使う前提: ${a.label}`);
    assert.ok(fuelParamGroupOfRole(a.roleKey), `区分: ${a.label}`);
  }
  for (const i of fixture.items.filter((x) => !x.isBreakdown)) assert.ok(fuelParamGroupOfItem(i), `明細の区分: ${i.costItemId}`);
  const keys = new Set(FUEL_PARAM_GROUPS.map((g) => g.key));
  assert.ok(keys.has("cond-yield") && keys.has("capex-plant") && keys.has("opex-residue") && keys.has("opex-labor"));
  // 作業単価は共通の1つ
  assert.ok((fixture.tasks ?? []).every((t) => !("hourlyRate" in t) || (t as { hourlyRate?: unknown }).hourlyRate == null));
});

check("試算中の変更は保存値を書き換えず、patch は DB の列名になる", () => {
  const a = fixture.assumptions.find((x) => x.roleKey === "fame_potential_high")!;
  const saved = a.value;
  const draft = setDraftValue({}, fixture, "assumption", a.costAssumptionId, "value", 25);
  assert.equal(draft[draftKey("assumption", a.costAssumptionId, "value")], 25);
  const working = applyDraft(fixture, draft);
  assert.equal(fixture.assumptions.find((x) => x.costAssumptionId === a.costAssumptionId)!.value, saved, "保存値は変わらない");
  assert.ok(computeFuelScenario(working, "outsourced", "high").totalPerLiter < computeFuelScenario(fixture, "outsourced", "high").totalPerLiter);
  const route = fixture.assumptions.find((x) => x.roleKey === "residue_route")!;
  const d2 = setDraftValue(draft, fixture, "assumption", route.costAssumptionId, "valueText", "disposal");
  const patches = draftToPatches(fixture, d2);
  assert.ok(patches.some((p) => p.id === route.costAssumptionId && p.patch.value_text === "disposal"), "残渣の行き先は value_text");
  assert.ok(patches.some((p) => p.id === a.costAssumptionId && p.patch.value === 25));
});

// ---- 画面と API の契約（静的確認）----
check("排水処理のコスト試算タブは燃料の試算を読まず、?kind=fuel のときだけ燃料の試算を読む", () => {
  const route = read("src/app/api/project-cost-model/route.ts");
  assert.match(route, /kind === "fuel" \? base\.eq\("case_kind", "biodiesel"\) : base\.neq\("case_kind", "biodiesel"\)/);
  assert.match(route, /searchParams\.get\("kind"\) === "fuel"/);
  assert.match(route, /"plant_line"/, "PATCH が燃料化設備の系列ごとを受け付ける");
  const client = read("src/lib/project-cost-model-client.ts");
  assert.match(client, /&kind=fuel/);
  assert.match(client, /export function loadProjectFuelCostModel/);
  assert.match(client, /export async function saveFuelCostPatches/);
  const migration = read("scripts/migrations/411_project_cost_fuel_model.sql");
  assert.match(migration, /'biodiesel'/);
  assert.match(migration, /'外部委託', '自社精製'/);
  assert.match(migration, /'plant_line'/);
});

check("「コスト試算（燃料）」は事業計画グループのコスト試算（廃液）の右隣で、燃料の試算があるPJだけに出る", () => {
  // 2026-09-14 まさ「事業計画グループ内に置いてほしかった。元々ある『コスト試算』は『コスト試算（廃液）』に変えて、それの右に並べて」
  const tabs = read("src/lib/cockpit-tabs.ts");
  // 2026-09-14 同日に、技術の右隣へ競合比較が入り（まさ「事業計画グループの直下に置いてほしい」）、その右隣へビジネスモデルが入った。
  assert.match(tabs, /children: \["score-detail", "technology", "competition", "business-model", "business-plan", "cost-model", "cost-fuel", "ip", "capital-policy"\]/, "コスト試算の右隣");
  const view = read("src/components/cockpit/CockpitView.tsx");
  assert.match(view, /"cost-model": hasFuelCost \? "コスト試算（廃液）" : "コスト試算"/, "燃料の試算を持つPJだけ（廃液）と呼び分ける");
  assert.match(view, /"cost-fuel": "コスト試算（燃料）"/);
  assert.match(view, /if \(tab === "cost-fuel"\) return hasFuelCost \|\|/, "燃料の試算が無いPJには出さない");
  assert.match(view, /loadProjectFuelCostModel\(projectId\)/);
  assert.match(view, /activeTab === "cost-fuel" && \(\s*<section role="tabpanel" aria-label="コスト試算（燃料）"[\s\S]*?<CockpitFuelCostModel projectId=\{project\.projectId\} \/>/);
  // 技術タブからは外した（置き場所の間違い。二重に置かない）
  const tech = read("src/components/cockpit/CockpitTechnology.tsx");
  assert.ok(!/CockpitFuelCostModel|コスト試算（燃料）|cost-fuel/.test(tech), "技術タブにコスト試算（燃料）を置かない");
  // ワークスペースも、経営・会社のコスト試算（廃液）の右隣。保存させない
  const workspace = read("src/components/project-workspace/SxWeeklyControlDashboard.tsx");
  assert.match(workspace, /\{ key: "cost", label: "コスト試算" \}, \{ key: "cost-fuel", label: "コスト試算（燃料）" \}/);
  assert.match(workspace, /tab\.key !== "cost-fuel" \|\| hasFuelCost/);
  assert.match(workspace, /tab\.key === "cost" && hasFuelCost \? \{ \.\.\.tab, label: "コスト試算（廃液）" \}/);
  assert.match(workspace, /<CockpitFuelCostModel projectId=\{bundle\.project\.projectId\} allowEdit=\{false\} \/>/, "ワークスペースでは保存させない");
  assert.match(workspace, /"cost-fuel": "cost-model-fuel"/, "開いているタブをアドレスに残す");
});

check("燃料のシミュレーターの画面の約束（排水処理のコスト試算タブと同じ形）", () => {
  const main = read("src/components/cockpit/CockpitFuelCostModel.tsx");
  const controls = read("src/components/cockpit/CockpitFuelCostModelControls.tsx");
  const results = read("src/components/cockpit/CockpitFuelCostModelResults.tsx");
  const reading = read("src/components/cockpit/CockpitFuelCostModelReading.tsx");
  // 操作パネルと結果を同じ枠に2列、スマホ幅は要約を上に固定
  assert.match(main, /xl:grid-cols-\[minmax\(0,1fr\)_460px\]/);
  assert.match(main, /sticky top-0 z-20 xl:hidden/);
  assert.match(main, /FuelResultsSummaryBar/);
  // 保存は編集できる人だけ、「この値を保存」から。入力のたびに保存しない
  assert.match(main, /\{canEdit && \(\s*<button[\s\S]*?この値を保存/);
  assert.ok(!/saveFuelCostPatches\([^)]*\)[\s\S]{0,40}onChange/.test(main));
  assert.match(main, /loadProjectFuelCostModel/);
  // 切り替えは FAME転換 と 収率
  assert.match(main, /FAME転換の切り替え/);
  assert.match(main, /収率の切り替え/);
  // 数字の欄は3桁カンマの NumberField を使う
  assert.match(controls, /NumberField/);
  assert.ok(!/type="number"/.test(controls), "3桁カンマの入らない数字の欄を作らない");
  // 作業の流れと工数が操作パネルの一番上、CAPEX / OPEX の区分
  assert.ok(controls.indexOf('id="fuel-flow"') > 0 && controls.indexOf('id="fuel-flow"') < controls.indexOf("id={`fuel-block-"), "作業の流れが先頭");
  assert.match(controls, /FUEL_PARAM_BLOCKS/);
  assert.match(controls, /YieldTable/);
  // 結果に6通りの積み上げ棒・内訳の棒グラフ・売価で成立する菌体の原価・事業全体の年間
  assert.match(results, /FUEL_CONVERSIONS\.map/);
  assert.match(results, /FUEL_YIELD_CASES\.map/);
  assert.match(results, /内訳の棒グラフ/);
  assert.match(results, /data-testid="fuel-break-even"/);
  assert.match(results, /data-testid="fuel-business-annual"/);
  // 画面の文言に DB の値「中央培養」を出さない（コードの比較にだけ使う）
  for (const [name, src] of Object.entries({ main, controls, results, reading })) {
    const visible = src
      .split("\n")
      .filter((line) => !/scenario === "中央培養"|scenario !== "中央培養"|"中央培養"\s*\?|scope: "中央培養"|^\s*\/\//.test(line));
    assert.ok(!visible.some((line) => line.includes("中央培養")), `${name} に「中央培養」の文言`);
  }
  assert.match(reading, /id="fuel-guide"/);
});

check("コスト試算（廃液・燃料）共通: 操作パネルの一番上に総コストの内訳（大きい順）、札を押すとその額を乗せている小分けへ移る", () => {
  // まさ 2026-09-14「右カラムに出てるこのサマリの内訳が、左カラムの一番上に出るようにしてほしい。
  // この棒グラフで一番大きく占めているところを減らしていかないといけないんだけど、その部分が左カラムのどこにあるのかが、現状だとめちゃくちゃ分かりにくい」
  // 計算: 内訳の中身はすべて操作パネルの小分けに結び付き、小分けごとに足すと区分の額になる
  const fuelGroups = new Set(FUEL_PARAM_GROUPS.map((g) => g.key));
  for (const s of computeFuelCostModel(fixture).scenarios) {
    for (const b of s.breakdown) {
      for (const p of b.parts) assert.ok(p.groupKey !== null && fuelGroups.has(p.groupKey), `燃料 ${s.key} ${b.key}「${p.label}」の小分け ${p.groupKey}`);
      near(b.parts.reduce((t, p) => t + p.perLiter, 0), b.perLiter, 1e-9, `燃料 ${s.key} ${b.key} 小分けの合計`);
    }
  }
  const wwFixture: CostModelBundle = JSON.parse(read("scripts/__fixtures__/sx_cost_model_two_stage.json"));
  const wwGroups = new Set(COST_PARAM_GROUPS.map((g) => g.key));
  for (const strain of ["enhanced", "wild"] as const) {
    for (const s of computeCostModel(wwFixture, { strain }).scenarios) {
      for (const b of s.breakdown) for (const p of b.parts) assert.ok(p.groupKey !== null && wwGroups.has(p.groupKey), `廃液 ${strain} ${s.key} ${b.key}「${p.label}」の小分け ${p.groupKey}`);
    }
  }
  // 画面: 共通の部品を、両方の操作パネルの作業の流れより前（一番上）に置く。区分は額の大きい順、札は小分けごとに足して大きい順
  const guide = read("src/components/cockpit/CockpitCostBreakdownGuide.tsx");
  assert.match(guide, /\.sort\(\(a, b\) => b\.amount - a\.amount\)/, "区分を額の大きい順に並べる");
  assert.match(guide, /export function breakdownGroupsOf/);
  assert.match(guide, /onClick=\{\(\) => onJump\(g\.groupKey\)\}/, "札を押すと小分けへ移る");
  const fuelControls = read("src/components/cockpit/CockpitFuelCostModelControls.tsx");
  assert.ok(fuelControls.indexOf("<CostBreakdownGuide") > 0 && fuelControls.indexOf("<CostBreakdownGuide") < fuelControls.indexOf('<section id="fuel-flow"'), "燃料: 内訳が作業の流れより前");
  assert.match(fuelControls, /jump\(`fuel-g-\$\{groupKey\}`\)/);
  assert.match(fuelControls, /onClick=\{\(\) => jump\("fuel-breakdown"\)\}/, "燃料: 目次から内訳へ戻れる");
  const wwControls = read("src/components/cockpit/CockpitCostModelControls.tsx");
  assert.ok(wwControls.indexOf("<CostBreakdownGuide") > 0 && wwControls.indexOf("<CostBreakdownGuide") < wwControls.indexOf('<section id="cm-flow"'), "廃液: 内訳が作業の流れより前");
  assert.match(wwControls, /jump\(`cm-g-\$\{groupKey\}`\)/);
  assert.match(wwControls, /onClick=\{\(\) => jump\("cm-breakdown"\)\}/, "廃液: 目次から内訳へ戻れる");
});

check("コスト試算（廃液・燃料）共通: 明細の行の下に、数量 × 単価 から右端の額までの計算の式と、数の根拠を出す。式の答えは右端の額と一致する", () => {
  // まさ 2026-09-14「それぞれの項目が妥当なのかの確認をどうやってすればいいかが、これだと分からない。
  // そもそも「数量」「単価」って何？単価の単位は/kg-DCWになっていて、これに数量をかけると右の「円/L」になる？ならないよね？」
  // 式の各段の答えはその段を計算した値で、最後の答えは画面の右端に出している額（エンジンの値）。先頭は数量と単価
  const walk = (calc: ItemCalc, msg: string): number => {
    if (calc.price) near(evaluateCalcSegment(calc.price, null), calc.price.result.value, 1e-9, `${msg} 単価の出し方`);
    let previous: number | null = null;
    for (const segment of calc.segments) {
      const v = evaluateCalcSegment(segment, previous);
      near(v, segment.result.value, 1e-9, `${msg} 段の答え`);
      previous = v;
    }
    assert.equal(calc.segments[0].continues, false, `${msg} 先頭の段は数量から始まる`);
    return previous ?? 0;
  };
  const shown = (items: CostModelBundle["items"]) => items.filter((i) => !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考");

  // 燃料: 右端の円/L は、培養設備の行は 菌体1kgあたり × 燃料1Lに要る菌体、それ以外は 年額 ÷ 年間の燃料の量
  // CO2（排ガス利用可能）と培養ロス補充（原料の合計）の単価は、前提とほかの行から出すので、前提と明細の束を渡す
  const fuel = computeFuelCostModel(fixture);
  const ctx: FuelPriceContext = { assumptions: fixture.assumptions, items: fixture.items };
  let fuelRows = 0;
  let fuelPriced = 0;
  for (const sc of fuel.scenarios) {
    for (const i of shown(fixture.items).filter((x) => fuelRowApplies(x, sc.conversion))) {
      const calc = fuelItemCalc(i, sc, ctx);
      assert.ok(calc, `燃料 ${sc.key} ${i.costItemId} に式がある`);
      assert.equal(calc.segments[0].terms[0].value, i.quantity, `燃料 ${i.costItemId} 先頭は数量`);
      assert.equal(calc.segments[0].terms[1].value, fuelEffectiveUnitPrice(i, ctx), `燃料 ${i.costItemId} 次は単価`);
      if (calc.price) {
        fuelPriced += 1;
        near(calc.price.result.value, fuelEffectiveUnitPrice(i, ctx), 1e-9, `燃料 ${i.costItemId} 計算で出した単価`);
      }
      const right = i.scenario === "中央培養" ? fuelCultureItemPerKg(i, sc.scale.cultureLineCapacityUnitYear, ctx, sc.scale) * sc.yield.unitKgPerLiter : fuelItemAnnual(i, sc.scale, ctx) / sc.scale.annualLiters;
      near(walk(calc, `燃料 ${sc.key} ${i.costItemId}`), right, 1e-9, `燃料 ${sc.key} ${i.costItemId} 式の答え ＝ 右端の円/L`);
      assert.equal(calc.excluded, null);
      fuelRows += 1;
    }
  }
  assert.ok(fuelRows >= 6 * 40, `燃料の式の行 ${fuelRows}`);
  assert.equal(fuelPriced, 6, "燃料で単価を計算で出す行は培養ロス補充だけ（6通り × 1行。排ガス利用可能が OFF の CO2 は入力の買値）");
  // 行の名前で見分けられる（培養設備の OPEX は小項目。「ユーティリティ」が CO2 と補給水の2行に並ばない）
  const cultureOpex = shown(fixture.items).filter((i) => i.scenario === "中央培養" && i.costType === "OPEX").map((i) => fuelItemLabel(i));
  assert.equal(new Set(cultureOpex).size, cultureOpex.length, `培養設備の OPEX の行の名前が重なる: ${cultureOpex.join("・")}`);
  assert.ok(cultureOpex.includes("CO2（液化炭酸ガス）") && cultureOpex.includes("補給水（上水）"));
  // 例（基準・委託）: 窒素源 0.4854 kg/kg-DCW × 187 円/kg ＝ 菌体1kgあたり 90.77円 → × 燃料1Lに要る菌体 ＝ 1,638.0円/L（426 で「使う量 × 買値」に組み直した）
  const base = findFuelScenario(fuel, "outsourced", "base");
  assert.ok(base);
  const medium = fixture.items.find((x) => x.costItemId === "cif_culture_120");
  assert.ok(medium);
  const mc = fuelItemCalc(medium, base, ctx);
  assert.ok(mc);
  assert.deepEqual(mc.segments.map((s) => s.result.label ?? s.result.unit), ["菌体1kgあたり", "円/L"]);
  near(evaluateItemCalc(mc), 0.4854 * 187 * base.yield.unitKgPerLiter, 1e-9, "窒素源");
  near(evaluateItemCalc(mc), 1638.0, 1e-4, "窒素源 円/L");
  assert.deepEqual([mc.segments[0].terms[0].unit, mc.segments[0].terms[1].unit], ["kg/kg-DCW", "円/kg"], "量と買値の単位で式が読める");
  // 菌体の原価を上書きしているときは、培養設備の行は燃料の原価に入らないと式に書く
  const overridden = computeFuelCostModel(setRole(clone(), "biomass_cost_per_kg_override", { value: 100 }));
  const ob = findFuelScenario(overridden, "outsourced", "base");
  assert.ok(ob);
  assert.match(fuelItemCalc(medium, ob, ctx)?.excluded ?? "", /上書き/);

  // 廃液: 右端の額は、菌体の製造拠点の行は 円/kg（centralItemPerKg）、それ以外は 年額 ÷ 顧客1社の年間処理量
  const ww: CostModelBundle = JSON.parse(read("scripts/__fixtures__/sx_cost_model_two_stage.json"));
  const unit = ww.model.unitBasisLabel ?? "m³";
  let wwRows = 0;
  let priced = 0;
  for (const strain of ["enhanced", "wild"] as const) {
    const cw = computeCostModel(ww, { strain });
    for (const { application, derived } of cw.derivedByApplication) {
      const sel = { strain, application };
      const centralSel = { strain, application: null };
      const capacity = biomassOf(cw, application).lineCapacityKgYear;
      for (const i of shown(ww.items)) {
        const calc = costItemCalc(i, ww.assumptions, derived, sel, { capacity, sel: centralSel }, unit, ww.items);
        const right = i.scenario === "中央培養" ? centralItemPerKg(i, ww.assumptions, capacity, centralSel, ww.items) : annualAmount(i, ww.assumptions, derived, sel, ww.items) / derived.annualVolume;
        if (!calc) {
          assert.equal(right, 0, `廃液 ${i.costItemId} 式が無い行は右端も0`);
          continue;
        }
        near(walk(calc, `廃液 ${strain} ${application} ${i.costItemId}`), right, 1e-9, `廃液 ${strain} ${application} ${i.costItemId} 式の答え ＝ 右端の額`);
        if (calc.price) {
          priced += 1;
          const priceSel = i.scenario === "中央培養" ? centralSel : sel;
          near(calc.price.result.value, effectiveUnitPrice(i, ww.assumptions, derived, priceSel, ww.items), 1e-9, `廃液 ${i.costItemId} 前提から計算した単価`);
        }
        wwRows += 1;
      }
    }
  }
  assert.ok(wwRows > 100, `廃液の式の行 ${wwRows}`);
  assert.ok(priced > 0, "前提から計算する単価の行にも単価の出し方がある");

  // 画面: 両方の操作パネルの明細の行に、計算と根拠を出す。根拠は「説明」を押さなくても読める
  const calcUi = read("src/components/cockpit/CockpitCostItemCalc.tsx");
  assert.match(calcUi, /data-testid="cost-item-calc"/);
  assert.match(calcUi, /data-testid="cost-item-note"/);
  assert.match(calcUi, /line-clamp-2/, "長い根拠は2行で畳む");
  const fuelControls = read("src/components/cockpit/CockpitFuelCostModelControls.tsx");
  const fuelRowsSrc = fuelControls.slice(fuelControls.indexOf("function FuelItemRows("));
  assert.match(fuelRowsSrc, /<ItemCalcLine calc=\{fuelItemCalc\(i, current, ctx\)\} \/>/);
  assert.match(fuelRowsSrc, /<ItemNoteLine note=\{i\.note\} \/>/);
  assert.ok(!/菌体1kgあたり \{num\(perKg/.test(fuelRowsSrc), "「菌体1kgあたり」を2回並べない");
  const wwControls = read("src/components/cockpit/CockpitCostModelControls.tsx");
  const wwRowsSrc = wwControls.slice(wwControls.indexOf("function ItemRows("));
  assert.match(wwRowsSrc, /<ItemCalcLine calc=\{costItemCalc\([\s\S]*?, unit, working\.items\)\} \/>/, "廃液の式にも明細の束を渡す（培養ロス補充の単価）");
  assert.match(wwRowsSrc, /<ItemNoteLine note=\{i\.note\} \/>/);
});

check("コスト試算（廃液・燃料）共通: 培養の原料10行は「使う量 × 買値」で、2つの試算で同じ値。培養ロス補充の単価は原料9行の合計", () => {
  // まさ 2026-09-14「Aで」（培養の原料を使う量 × 買値に組み直す。量は菌体の成分と菌体の濃さから、買値は公開の相場から。廃液のタブの同じ行もそろえる）。migration 426
  const ww: CostModelBundle = JSON.parse(read("scripts/__fixtures__/sx_cost_model_two_stage.json"));
  const materials = ["120", "121", "122", "123", "124", "125", "126", "127", "128"];
  const rowsOf = (b: CostModelBundle, prefix: string) =>
    [...materials, "134"].map((k) => {
      const i = b.items.find((x) => x.costItemId === `${prefix}${k}`);
      assert.ok(i, `${prefix}${k}`);
      return i;
    });
  const fuelRows = rowsOf(fixture, "cif_culture_");
  const wwRows = rowsOf(ww, "ci_260820_");
  for (const [idx, f] of fuelRows.entries()) {
    const w = wwRows[idx];
    assert.equal(f.basis, "毎kg菌体比例", `${f.costItemId} は菌体1kgあたり`);
    assert.deepEqual([w.leafLabel, w.quantity, w.quantityUnit, w.unitPrice, w.unitPriceUnit], [f.leafLabel, f.quantity, f.quantityUnit, f.unitPrice, f.unitPriceUnit], `${f.costItemId} と ${w.costItemId} は同じ値`);
    assert.match(f.note ?? "", /確かめ方:/, `${f.costItemId} の説明に確かめ方`);
  }
  for (const i of fuelRows.slice(0, 9)) {
    assert.notEqual(i.quantityUnit, "kg-DCW", `${i.costItemId}「${i.leafLabel}」は量を持つ（「1 kg-DCW × 円/kg-DCW」の額の直置きに戻さない）`);
    assert.ok(!/円\/kg-DCW$/.test(i.unitPriceUnit ?? ""), `${i.costItemId} の買値は物の単位あたり`);
  }
  // 430 から、培養ロス補充の単価は原料9行の菌体1kgあたりの合計を計算で出す（直に置いた261.6円は使わない）。CO2 の行は排ガス利用可能で0円にできる
  const sum = fuelRows.slice(0, 9).reduce((t, i) => t + i.quantity * i.unitPrice, 0);
  const loss = fuelRows[9];
  assert.equal(loss.priceRule, "culture_loss", "培養ロス補充は原料の合計から単価を出す");
  assert.equal(wwRows[9].priceRule, "culture_loss", "廃液の培養ロス補充も同じ");
  assert.deepEqual([fuelRows[3].priceRule, wwRows[3].priceRule], ["co2_supply", "co2_supply"], "CO2 の行は排ガス利用可能で切り替える");
  near(fuelEffectiveUnitPrice(loss, { assumptions: fixture.assumptions, items: fixture.items }), sum, 1e-9, "燃料: 培養ロス補充の単価 ＝ 原料9行の菌体1kgあたりの合計");
  const wwCentral = { strain: "wild" as const, application: null };
  const wwDerived = computeCostModel(ww, { strain: "wild" }).derivedByApplication[0].derived;
  near(effectiveUnitPrice(wwRows[9], ww.assumptions, wwDerived, wwCentral, ww.items), sum, 1e-9, "廃液: 培養ロス補充の単価 ＝ 原料9行の菌体1kgあたりの合計");
  // 量の元: 炭素50%・CO2の固定80% → 2.29kg、窒素8% ÷ 硝酸ナトリウムの窒素16.48%、リン1% ÷ りん酸二アンモニウムのリン23.45%
  near(fuelRows[3].quantity, 2.29, 1e-9, "CO2");
  near(fuelRows[0].quantity, Math.round((0.08 / (14.007 / 84.995)) * 1e4) / 1e4, 1e-12, "窒素源");
  near(fuelRows[1].quantity, Math.round((0.01 / (30.974 / 132.056)) * 1e4) / 1e4, 1e-12, "リン源");
});

check("排ガス利用可能: ON のとき CO2 の単価を0円にし、培養ロス補充も一緒に下がる。スイッチは CO2 の明細の行（前提の一覧に出さない）", () => {
  // まさ 2026-09-14「「排ガス利用可能」のスイッチをCO2コストのところに設置してほしい。それがONのときはCO2コストがゼロになるようにして」
  const flue = fixture.assumptions.filter((a) => a.roleKey === CO2_FLUE_GAS_ROLE);
  assert.equal(flue.length, 1, "排ガス利用可能の前提は1行");
  assert.equal(flue[0].valueText, "off", "既定は OFF");
  assert.ok(FUEL_ROLE_KEYS.has(CO2_FLUE_GAS_ROLE), "計算に使う前提");
  assert.equal(fuelParamGroupOfRole(CO2_FLUE_GAS_ROLE)?.key, "opex-culture", "置き場所は OPEX の培養の原料・品質確認");
  assert.ok(ITEM_INLINE_ROLES.has(CO2_FLUE_GAS_ROLE));
  const on = setRole(clone(), CO2_FLUE_GAS_ROLE, { valueText: "on" });
  const co2 = fixture.items.find((i) => i.costItemId === "cif_culture_123")!;
  const loss = fixture.items.find((i) => i.costItemId === "cif_culture_134")!;
  const offCtx = { assumptions: fixture.assumptions, items: fixture.items };
  const onCtx = { assumptions: on.assumptions, items: on.items };
  assert.equal(fuelEffectiveUnitPrice(co2, offCtx), 50, "OFF は液化炭酸ガスの買値");
  assert.equal(fuelEffectiveUnitPrice(co2, onCtx), 0, "ON は0円");
  near(fuelEffectiveUnitPrice(loss, offCtx) - fuelEffectiveUnitPrice(loss, onCtx), 2.29 * 50, 1e-9, "培養ロス補充の単価は CO2 の分だけ下がる");
  assert.equal(fuelEffectiveUnitPrice(loss), loss.unitPrice, "束を渡さなければ入力の単価");
  const off = computeFuelCostModel(fixture);
  const onc = computeFuelCostModel(on);
  const drop = 2.29 * 50 * (1 + loss.quantity);
  for (const s of off.scenarios) {
    const t = onc.scenarios.find((x) => x.key === s.key)!;
    near(s.biomass.perKg - t.biomass.perKg, drop, 1e-9, `${s.key} 菌体1kgの原価は CO2 と作り直す分の CO2 だけ下がる`);
    near(s.totalPerLiter - t.totalPerLiter, drop * s.yield.unitKgPerLiter, 1e-6, `${s.key} 燃料1Lあたりは その額 × 燃料1Lに要る菌体 だけ下がる`);
  }
  const ob = findFuelScenario(onc, "outsourced", "base")!;
  assert.equal(Math.round(ob.totalPerLiter * 10) / 10, 3863.9, "ON 基準・委託（2026-09-14）");
  assert.ok(onc.scenarios.every((s) => s.totalPerLiter > 200), "ON でも6通りすべて売価200円/Lを上回る");
  // 菌体の原価を上書きしていれば、切り替えても数字は変わらない
  const overridden = setRole(clone(), "biomass_cost_per_kg_override", { value: 100 });
  const overriddenOn = setRole(JSON.parse(JSON.stringify(overridden)), CO2_FLUE_GAS_ROLE, { valueText: "on" });
  near(findFuelScenario(computeFuelCostModel(overriddenOn), "outsourced", "base")!.totalPerLiter, findFuelScenario(computeFuelCostModel(overridden), "outsourced", "base")!.totalPerLiter, 1e-12, "上書き値のときは効かない");
  // 式: ON のときは「液化炭酸ガスの買値 × 工場の排ガスを使うので 0」、培養ロス補充は原料9行の足し算
  const onCalc = fuelItemCalc(co2, ob, onCtx);
  assert.deepEqual(onCalc?.price?.terms.map((t) => t.label), ["液化炭酸ガスの買値", "工場の排ガスを使うので"]);
  assert.equal(evaluateItemCalc(onCalc!), 0, "ON の CO2 は燃料1Lあたり0円");
  const lossCalc = fuelItemCalc(loss, ob, onCtx);
  assert.equal(lossCalc?.price?.terms.length, 9, "培養ロス補充は原料9行を足す");
  near(lossCalc!.price!.result.value, fuelEffectiveUnitPrice(loss, onCtx), 1e-9, "式の単価 ＝ 計算の単価");
  // 燃料の試算の読み物は、選択肢の前提の値を言葉で出す
  assert.equal(FUEL_TEXT_CHOICE_ROLES[CO2_FLUE_GAS_ROLE]?.find((c) => c.value === "on")?.label, "使える（CO2は0円）");
  // 画面の行の計算も同じ束を使う
  const controls = read("src/components/cockpit/CockpitFuelCostModelControls.tsx");
  assert.match(controls, /fuelCultureItemPerKg\(i, current\.scale\.cultureLineCapacityUnitYear, ctx, current\.scale\)/);
  assert.match(controls, /fuelItemAnnual\(i, current\.scale, ctx\)/);
  const reading = read("src/components/cockpit/CockpitFuelCostModelReading.tsx");
  assert.match(reading, /fuelCultureItemPerKg\(i, current\.scale\.cultureLineCapacityUnitYear, priceCtx, current\.scale\)/);
});

check("脂質分泌株: ON のとき第1段の単位が脂肪酸になり、菌体を集めて壊す行を数えない。スイッチは枠の上端（前提の一覧に出さない）", () => {
  // まさ 2026-09-14「脂質を分泌できる株の開発も理論的には可能っていう話を杉浦先生からもらったので、
  // コスト試算表を「脂質分泌株」のスイッチオンオフで切り替えられるようにしてほしい。脂質分泌株だと一気にコストが下がりそうな気がしてる」
  const sw = fixture.assumptions.filter((a) => a.roleKey === LIPID_SECRETION_ROLE);
  assert.equal(sw.length, 1, "脂質分泌株の前提は1行");
  assert.equal(sw[0].valueText, "off", "既定は OFF（菌体から取り出す）");
  assert.ok(FUEL_ROLE_KEYS.has(LIPID_SECRETION_ROLE), "計算に使う前提");
  assert.ok(fuelParamGroupOfRole(LIPID_SECRETION_ROLE), "置き場所がある");
  for (const role of FUEL_SECRETION_YIELD_ROLES) {
    assert.ok(FUEL_ROLE_KEYS.has(role) && FUEL_ROLE_KEYS.has(`${role}_low`) && FUEL_ROLE_KEYS.has(`${role}_high`), `${role} の3ケース`);
    assert.equal(fuelParamGroupOfRole(role)?.key, "cond-yield", `${role} は収率の区分`);
  }
  assert.equal(fuelSecretionOn(fixture.assumptions), false);
  assert.deepEqual(fuelSelectionOf(fixture.assumptions), { strain: "wild", application: null }, "OFF は自然株の行が効く");

  const on = setRole(clone(), LIPID_SECRETION_ROLE, { valueText: "on" });
  assert.deepEqual(fuelSelectionOf(on.assumptions), { strain: "secreting", application: null });
  const off = computeFuelCostModel(fixture);
  const onc = computeFuelCostModel(on);
  const ob = findFuelScenario(onc, "outsourced", "base")!;
  const fb = findFuelScenario(off, "outsourced", "base")!;

  // 収率: 分泌株は 密度 ÷（培養液からの回収率 × メチル化 × 精製）。菌体回収率・脂質抽出回収率・FAMEポテンシャルは効かない
  near(ob.yield.unitKgPerLiter, 0.88 / (0.9 * 0.97 * 0.98), 1e-9, "燃料1Lに要る脂肪酸");
  assert.equal(ob.yield.unitLabel, "脂肪酸");
  assert.equal(fb.yield.unitLabel, "菌体");
  const potential = setRole(JSON.parse(JSON.stringify(on)), "fame_potential", { value: 12 });
  near(findFuelScenario(computeFuelCostModel(potential), "outsourced", "base")!.totalPerLiter, ob.totalPerLiter, 1e-9, "分泌株ではFAMEポテンシャルが効かない");

  // 規模: 1系列が年に出す脂肪酸 ＝ 培養液量 × 分泌速度 × 稼働日数、培養液量 ＝ 年間生産能力 ÷（生産性 × 稼働日数）
  near(ob.scale.cultureLineVolumeM3, 33333 / (0.5 * 300), 1e-9, "1系列の培養液量（m³）");
  near(ob.scale.cultureLineCapacityUnitYear, ob.scale.cultureLineVolumeM3 * 0.036 * 300, 1e-9, "1系列が年に出す脂肪酸");
  assert.equal(fb.scale.cultureLineCapacityUnitYear, 33333, "OFF は入力の年間生産能力そのまま");
  const half = setRole(JSON.parse(JSON.stringify(on)), "secretion_rate", { value: 0.018 });
  near(findFuelScenario(computeFuelCostModel(half), "outsourced", "base")!.scale.cultureLines, ob.scale.cultureLines * 2, 1e-6, "分泌速度が半分なら培養設備は2倍");

  // 明細: 菌体1kgあたりの行は「入れ替える菌体」を掛けて脂肪酸1kgあたりに直す。脂肪酸あたりで入れた行はそのまま
  const n = fixture.items.find((i) => i.costItemId === "cif_culture_120")!;
  const co2fa = on.items.find((i) => i.costItemId === "cif_sec_co2")!;
  assert.equal(fuelUnitFactorOf(n, ob.scale), 0.4, "菌体1kgあたりの行は入れ替える菌体を掛ける");
  assert.equal(fuelUnitFactorOf(co2fa, ob.scale), 1, "脂肪酸1kgあたりの行はそのまま");
  assert.equal(fuelUnitFactorOf(n, fb.scale), 1, "OFF は掛けない");
  const calc = fuelItemCalc(n, ob, { assumptions: on.assumptions, items: on.items })!;
  assert.ok(calc.segments[0].terms.some((t) => t.label === "脂肪酸1kgあたりに入れ替える菌体"), "式に入れ替える菌体の段が出る");
  near(evaluateItemCalc(calc), n.quantity * n.unitPrice * 0.4 * ob.yield.unitKgPerLiter, 1e-9, "式の答え ＝ 右端の額");

  // 株で行を出し入れする: 分泌株では菌体を集めて壊す設備を数えず、分泌株の設備を数える
  const wildOnly = ["cif_plant_disruption", "cif_plant_extraction", "cif_plant_residue", "cif_culture_057", "cif_op_solvent"];
  const secretingOnly = ["cif_sec_closed_exhaust", "cif_sec_solvent_fill", "cif_sec_co2", "cif_sec_plant_strip", "cif_sec_op_heat"];
  for (const id of wildOnly) {
    const i = fixture.items.find((x) => x.costItemId === id)!;
    assert.equal(i.strain, "wild", `${id} は分泌株でないときだけ`);
    assert.equal(fuelRowApplies(i, "outsourced", fuelSelectionOf(on.assumptions)), false, `${id} は分泌株では数えない`);
  }
  for (const id of secretingOnly) {
    const i = on.items.find((x) => x.costItemId === id)!;
    assert.equal(i.strain, "secreting", `${id} は分泌株のときだけ`);
    assert.equal(fuelRowApplies(i, "outsourced", fuelSelectionOf(fixture.assumptions)), false, `${id} は分泌株でないときは数えない`);
  }
  const secretingItems = on.items.filter((i) => i.strain === "secreting");
  assert.ok(secretingItems.length >= 13, `分泌株の明細 ${secretingItems.length} 行`);
  for (const i of secretingItems) assert.ok((i.note ?? "").includes("確かめ方"), `${i.costItemId} の根拠に確かめ方`);
  assert.ok((on.tasks ?? []).some((t) => t.strain === "secreting"), "分泌株の作業がある");
  assert.ok(computeFuelTaskFlow(on, ob).steps.some((st) => st.label === "脂肪酸を回収する"), "作業の流れに脂肪酸を回収する段");
  assert.ok(!computeFuelTaskFlow(on, ob).steps.some((st) => st.label === "脱水・油回収"), "分泌株では脱水・油回収の段が出ない");

  // 残渣は入れ替えた菌体の分だけ
  near(fuelResidueOf(on.assumptions, ob.yield).dryKgPerUnit, 0.878 * 0.4, 1e-9, "分泌株の残渣は入れ替えた菌体の分だけ");
  assert.equal(fuelBreakdownLabelOf("recovery", true), "培養液からの回収");

  // 260914版の数字（432 適用後、排ガス利用可能は OFF）
  const table: Record<string, number> = {
    "outsourced:low": 3968.7, "outsourced:base": 1289.7, "outsourced:high": 814.8,
    "inhouse:low": 3933.8, "inhouse:base": 1251.8, "inhouse:high": 775.7,
  };
  for (const s of onc.scenarios) assert.equal(Math.round(s.totalPerLiter * 10) / 10, table[s.key], `分泌株 ${s.key}`);
  assert.ok(onc.scenarios.every((s) => s.totalPerLiter > 200), "分泌株でも6通りすべて売価200円/Lを上回る");
  assert.ok(ob.totalPerLiter < fb.totalPerLiter / 4, "基準・委託は4分の1より下がる");
  // 下がるのは原料、上がるのは培養設備（光合成の速さで培養の系列数が決まるので、株を変えてもあまり減らない）
  const materials = (s: typeof ob) => s.biomass.variablePerKg * s.yield.unitKgPerLiter;
  const cultureCapex = (s: typeof ob) => (s.biomass.rows.find((r) => r.key === "capex")?.perKg ?? 0) * s.yield.unitKgPerLiter;
  assert.ok(materials(ob) < materials(fb) / 10, "原料は10分の1より下がる");
  assert.ok(cultureCapex(ob) > cultureCapex(fb), "培養設備の償却は1Lあたり上がる");
  assert.ok(ob.scale.cultureLines > fb.scale.cultureLines * 0.6, "培養設備の系列数はあまり減らない");

  // 排ガス利用可能は分泌株でも効く（脂肪酸の炭素の CO2 も0円になる）
  const onFlue = setRole(JSON.parse(JSON.stringify(on)), CO2_FLUE_GAS_ROLE, { valueText: "on" });
  assert.ok(findFuelScenario(computeFuelCostModel(onFlue), "outsourced", "base")!.totalPerLiter < ob.totalPerLiter, "分泌株でも排ガスで下がる");
  assert.equal(fuelEffectiveUnitPrice(co2fa, { assumptions: onFlue.assumptions, items: onFlue.items }), 0, "脂肪酸の炭素の CO2 も0円");

  // 画面: スイッチは枠の上端、前提の一覧には出さない
  const shell = read("src/components/cockpit/CockpitFuelCostModel.tsx");
  assert.match(shell, /data-testid="fuel-strain-switch"/, "枠の上端に株のスイッチ");
  assert.match(shell, /ariaLabel="脂質分泌株の切り替え"/);
  assert.match(shell, /LIPID_SECRETION_ROLE/);
  const controls = read("src/components/cockpit/CockpitFuelCostModelControls.tsx");
  assert.match(controls, /if \(role === LIPID_SECRETION_ROLE\) return \[\];/, "前提の一覧には出さない");
  assert.match(controls, /fuelRowApplies\(i, current\.conversion, sel\)/, "株で効かない行を薄く出す");
});

check("工場の排液を培地に使える: ON のとき培地の原料3行の買値が減る割合だけ引かれ、培養ロス補充も一緒に下がる。スイッチは培地の原料の行（前提の一覧に出さない）", () => {
  // まさ 2026-09-15「その結果次第では、燃料事業は、顧客の工場のCO2と排熱、排ガスをフル活用してやる方向も見えてくる」
  const wwBundle: CostModelBundle = JSON.parse(read("scripts/__fixtures__/sx_cost_model_two_stage.json"));
  for (const [name, bundle] of [["燃料", fixture], ["廃液", wwBundle]] as const) {
    const sw = bundle.assumptions.filter((a) => a.roleKey === WASTE_MEDIUM_ROLE);
    const red = bundle.assumptions.filter((a) => a.roleKey === WASTE_MEDIUM_REDUCTION_ROLE);
    assert.equal(sw.length, 1, `${name}: 排液の前提は1行`);
    assert.equal(sw[0].valueText, "off", `${name}: 既定は OFF`);
    assert.equal(red.length, 1, `${name}: 減る割合は1行`);
    assert.equal(red[0].value, 80, `${name}: 減る割合は80%（試算シート 2026-07-30版）`);
    const rows = bundle.items.filter((i) => i.priceRule === "medium_supply");
    assert.equal(rows.length, 3, `${name}: 培地の原料3行`);
    for (const r of rows) assert.ok(/窒素源|リン源|カリウム/.test(r.leafLabel ?? ""), `${name}: ${r.costItemId} は培地の原料`);
  }
  assert.ok(ITEM_INLINE_ROLES.has(WASTE_MEDIUM_ROLE), "スイッチは前提の一覧に出さない");
  assert.ok(!ITEM_INLINE_ROLES.has(WASTE_MEDIUM_REDUCTION_ROLE), "減る割合は前提の一覧に出す");
  assert.ok(FUEL_ROLE_KEYS.has(WASTE_MEDIUM_ROLE) && FUEL_ROLE_KEYS.has(WASTE_MEDIUM_REDUCTION_ROLE), "計算に使う前提");
  assert.equal(fuelParamGroupOfRole(WASTE_MEDIUM_ROLE)?.key, "opex-culture", "置き場所は OPEX の培養の原料・品質確認");

  const on = setRole(clone(), WASTE_MEDIUM_ROLE, { valueText: "on" });
  const ctxOff = { assumptions: fixture.assumptions, items: fixture.items };
  const ctxOn = { assumptions: on.assumptions, items: on.items };
  const n = fixture.items.find((i) => i.costItemId === "cif_culture_120")!;
  assert.equal(fuelEffectiveUnitPrice(n, ctxOff), 187, "OFF は試薬の買値");
  near(fuelEffectiveUnitPrice(n, ctxOn), 187 * 0.2, 1e-9, "ON は80%引き");
  assert.equal(fuelEffectiveUnitPrice(n), n.unitPrice, "束を渡さなければ入力の単価");
  // 培養ロス補充は原料の合計から出すので一緒に下がる
  const loss = fixture.items.find((i) => i.costItemId === "cif_culture_134")!;
  const drop = (0.4854 * 187 + 0.0426 * 161 + 0.074 * 324) * 0.8;
  near(fuelEffectiveUnitPrice(loss, ctxOff) - fuelEffectiveUnitPrice(loss, ctxOn), drop, 1e-9, "培養ロス補充は培地の原料の分だけ下がる");
  // 菌体1kgの原価は、培地の原料と作り直す分だけ下がる
  const off = findFuelScenario(computeFuelCostModel(fixture), "outsourced", "base")!;
  const onSc = findFuelScenario(computeFuelCostModel(on), "outsourced", "base")!;
  near(off.biomass.perKg - onSc.biomass.perKg, drop * (1 + loss.quantity), 1e-9, "菌体1kgの原価の下がり方");
  assert.equal(Math.round(onSc.totalPerLiter * 10) / 10, 4190.1, "排液 ON 基準・委託（2026-09-15）");
  // 割合を0にすると効かない、100にすると買値が0
  const zero = setRole(JSON.parse(JSON.stringify(on)), WASTE_MEDIUM_REDUCTION_ROLE, { value: 0 });
  near(findFuelScenario(computeFuelCostModel(zero), "outsourced", "base")!.totalPerLiter, off.totalPerLiter, 1e-9, "割合0なら効かない");
  const full = setRole(JSON.parse(JSON.stringify(on)), WASTE_MEDIUM_REDUCTION_ROLE, { value: 100 });
  assert.equal(fuelEffectiveUnitPrice(n, { assumptions: full.assumptions, items: full.items }), 0, "割合100なら買値0");
  // 排ガスと組み合わせる（まさの「工場をフル活用」）
  const both = setRole(JSON.parse(JSON.stringify(on)), CO2_FLUE_GAS_ROLE, { valueText: "on" });
  assert.equal(Math.round(findFuelScenario(computeFuelCostModel(both), "outsourced", "base")!.totalPerLiter * 10) / 10, 2020.6, "排液＋排ガス 基準・委託");
  // 式: ON のときは「試薬を買う買値 × 工場の排液で80%減るので 0.2」
  const calc = fuelItemCalc(n, onSc, ctxOn);
  assert.deepEqual(calc?.price?.terms.map((t) => t.label), ["試薬を買う買値", "工場の排液で80%減るので"]);
  near(calc!.price!.result.value, 187 * 0.2, 1e-9, "式の単価 ＝ 計算の単価");
  // 画面: スイッチは培地の原料の行に出す
  const controls = read("src/components/cockpit/CockpitFuelCostModelControls.tsx");
  assert.match(controls, /i\.priceRule === "medium_supply" && wasteMedium/);
  assert.match(controls, /<WasteMediumSwitch/);
  const wwControls = read("src/components/cockpit/CockpitCostModelControls.tsx");
  assert.match(wwControls, /i\.priceRule === "medium_supply" && wasteMedium/);
  assert.match(wwControls, /<WasteMediumSwitch/);
});

check("コスト試算（廃液・燃料）共通: 数字の出どころを残す。計算に使う明細・前提・作業はすべて根拠を持ち、組み直した行は前の額とその出どころを持つ。書き換えは変更の記録に残る", () => {
  // まさ 2026-09-14「「前の額が何を前提にしていたかは、記録が無くて分からない。」→これはまずいと思う。えいみが作ったんだから、えいみしか分からんよ。
  // こういうことが起きないようにして」。記録は試算シートの古い版にあったのに、取り込みと組み直しで説明に書き写さず、たどらずに答えた（migration 431）
  const ww: CostModelBundle = JSON.parse(read("scripts/__fixtures__/sx_cost_model_two_stage.json"));
  const blank = (v: string | null | undefined) => !v || v.trim() === "";
  for (const [name, b, calcRole] of [
    ["廃液", ww, (r: string | null) => r !== null && COST_ROLE_KEYS.has(r)],
    ["燃料", fixture, (r: string | null) => r !== null && FUEL_ROLE_KEYS.has(r)],
  ] as const) {
    const items = b.items.filter((i) => !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考" && blank(i.note)).map((i) => i.costItemId);
    assert.deepEqual(items, [], `${name}: 根拠（説明）の無い明細を置かない。どの資料のどの版のどの行から来た数か、決め方が分からないならそう書く`);
    const assumptions = b.assumptions.filter((a) => calcRole(a.roleKey) && blank(a.note)).map((a) => a.costAssumptionId);
    assert.deepEqual(assumptions, [], `${name}: 根拠の無い計算用の前提を置かない`);
    const tasks = (b.tasks ?? []).filter((t) => blank(t.note)).map((t) => t.costTaskId);
    assert.deepEqual(tasks, [], `${name}: 根拠の無い作業を置かない`);
  }
  // 「使う量 × 買値」に組み直した培養の原料20行は、前の額と、その額が試算シートのどこから来たかを持つ
  const OLD_PER_KG: Record<string, number> = { "120": 9, "121": 10.8, "122": 7.2, "123": 4.5, "124": 1.8, "125": 2.7, "126": 4.5, "127": 9, "128": 5.4, "134": 5.4 };
  for (const [prefix, b] of [["ci_260820_", ww], ["cif_culture_", fixture]] as const) {
    for (const [k, old] of Object.entries(OLD_PER_KG)) {
      const note = b.items.find((i) => i.costItemId === `${prefix}${k}`)?.note ?? "";
      assert.match(note, new RegExp(`前の額（2026-09-14 に「使う量 × 買値」へ組み直す前）: 菌体1kgあたり${old}円`), `${prefix}${k} の前の額`);
      assert.match(note, /ちこさんの試算シート（2026-07-30版〜2026-08-20版）/, `${prefix}${k} の前の額の出どころ`);
    }
  }
  assert.match(fixture.items.find((i) => i.costItemId === "cif_culture_123")?.note ?? "", /排ガス利用等も想定した最小構成/, "CO2 の前の額は排ガスを使う前提だった");
  assert.match(fixture.items.find((i) => i.costItemId === "cif_culture_120")?.note ?? "", /培地原料低減率 80%（排液利用で大幅低減）/, "培地の前の額は排液を培地に使う前提だった");
  assert.ok(fixture.notes.some((n) => n.section === "history" && n.title.includes("培養の原料の前の額は、どこから来たか")), "版の履歴に前の額の流れ");
  // 変更の記録: 明細・前提・作業の書き換えと削除を、トリガーが前の値と後の値で残す
  const migration431 = read("scripts/migrations/431_sol_cost_model_provenance_change_log.sql");
  assert.match(migration431, /create table project_cost_change_log/);
  for (const table of ["project_cost_items", "project_cost_assumptions", "project_cost_tasks"]) {
    assert.match(migration431, new RegExp(`create trigger ${table}_change_log after update or delete on ${table}\\s+for each row execute function project_cost_log_change\\(\\)`), `${table} の書き換えを記録する`);
  }
  // これから数字や説明を書き換える migration は、理由（何を・なぜ・どこから来た数か）を変更の記録に渡す
  const dir = new URL("scripts/migrations/", root);
  const touching = /update\s+project_cost_(items|assumptions|tasks)\s+set/i;
  for (const file of fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f) && Number(f.split("_")[0]) >= 431)) {
    const sql = fs.readFileSync(new URL(file, dir), "utf8");
    if (!touching.test(sql)) continue;
    assert.match(
      sql,
      /set_config\('amd\.cost_change_reason'/,
      `${file}: コスト試算の明細・前提・作業を書き換える migration は、書き換えの前に select set_config('amd.cost_change_reason', '<何を・なぜ・どこから来た数か>', true); を呼ぶ（pwa/spec/5-13-project-cost-model-current-spec.md「数字の出どころと変更の記録」）`
    );
  }
});

console.log(`\n${passed} checks passed (project-fuel-cost-model)`);
