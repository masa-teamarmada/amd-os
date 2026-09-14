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
  FUEL_CASE_KIND,
  FUEL_CONVERSIONS,
  FUEL_PARAM_GROUPS,
  FUEL_ROLE_KEYS,
  FUEL_YIELD_CASES,
  computeFuelCostModel,
  computeFuelScenario,
  computeFuelTaskFlow,
  findFuelScenario,
  fuelItemAnnual,
  fuelParamGroupOfItem,
  fuelParamGroupOfRole,
  fuelResidueOf,
  fuelRowApplies,
  fuelScaleOf,
  fuelTaskAmount,
  fuelYieldOf,
  isFuelModel,
} from "../src/lib/project-fuel-cost-model.ts";
import { applyDraft, draftKey, draftToPatches, setDraftValue } from "../src/lib/project-cost-model-draft.ts";
import type { CostModelBundle } from "../src/lib/project-cost-model.ts";

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
  near(y.kgDcwPerLiter, 0.88 / 0.04876578, 1e-9, "kg/L");
  near(y.litersPerKgDcw * 1000, 55.41566, 1e-4, "L/t");
});

check("年に要る菌体の量と設備の系列数は、年間の燃料の量から計算する（入力ではない）", () => {
  assert.ok(!FUEL_ROLE_KEYS.has("culture_capacity_kg_year"), "年間生産能力を入力として持たない");
  const vol = fixture.assumptions.find((a) => a.roleKey === "business_annual_volume");
  assert.equal(vol?.value, 50_000_000);
  for (const yc of FUEL_YIELD_CASES) {
    const y = fuelYieldOf(fixture.assumptions, yc);
    const s = fuelScaleOf(fixture.assumptions, y);
    near(s.biomassKgYear, 50_000_000 * y.kgDcwPerLiter, 1e-12, `${yc} 年に要る菌体`);
    near(s.cultureLines, s.biomassKgYear / 33_333, 1e-12, `${yc} 培養設備`);
    near(s.plantLines, s.biomassKgYear / 50_000_000, 1e-12, `${yc} 燃料化設備`);
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

check("260914版の数字（外部に委託・自社で行う × 3ケース、円/L。413 でFAMEポテンシャルを置き直した後）", () => {
  const c = computeFuelCostModel(fixture);
  const expect: Record<string, number> = {
    "outsourced:low": 4003.6, "outsourced:base": 2165.8, "outsourced:high": 1469.5,
    "inhouse:low": 4002.1, "inhouse:base": 2139.9, "inhouse:high": 1434.4,
  };
  for (const [key, v] of Object.entries(expect)) {
    const s = c.scenarios.find((x) => x.key === key)!;
    assert.equal(Math.round(s.totalPerLiter * 10) / 10, v, key);
  }
  const base = findFuelScenario(c, "outsourced", "base")!;
  assert.equal(Math.round(base.biomass.perKg * 100) / 100, 92.06, "菌体1kgの原価（排水処理の自然株 98.5円 − 保管・輸送設備 6.43円）");
  assert.equal(Math.round(base.biomassPerLiter * 10) / 10, 1661.2, "菌体費");
  for (const s of c.scenarios) assert.ok(s.breakEvenBiomassPerKg < 0, `${s.key}: 菌体がタダでも燃料化の工程だけで売価を超える`);
  const high = findFuelScenario(c, "outsourced", "high")!;
  assert.equal(Math.round(high.breakEvenBiomassPerKg * 10) / 10, -13.3, "改善・委託の売価で成立する菌体の原価");
  near(base.revenueAnnual, 10_000_000_000, 1e-12, "売上100億円");
});

check("FAMEポテンシャルを2倍にすると、菌体に比例する費用が半分になり、燃料1Lあたりの費用は変わらない", () => {
  const base = computeFuelScenario(fixture, "outsourced", "base");
  const baseFame = fixture.assumptions.find((a) => a.roleKey === "fame_potential")!.value!;
  const doubled = computeFuelScenario(setRole(clone(), "fame_potential", { value: baseFame * 2 }), "outsourced", "base");
  near(doubled.yield.kgDcwPerLiter, base.yield.kgDcwPerLiter / 2, 1e-12, "1Lに要る菌体が半分");
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
  near(s.totalPerLiter - base.totalPerLiter, r.perKgDcw * base.yield.kgDcwPerLiter, 1e-9, "処分に変えた差");
  assert.equal(Math.round(s.totalPerLiter - base.totalPerLiter), 2773, "基準の収率で約2,770円/L 上がる");
});

check("菌体の原価の上書き: 0 を入れると菌体費が0、売価で成立する菌体の原価は（売価 − 工程）÷ 1Lに要る菌体", () => {
  const b = setRole(clone(), "biomass_cost_per_kg_override", { value: 0 });
  const s = computeFuelScenario(b, "outsourced", "high");
  assert.equal(s.biomassPerLiter, 0);
  near(s.breakEvenBiomassPerKg, (200 - s.processPerLiter) / s.yield.kgDcwPerLiter, 1e-12, "成立ライン");
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

check("技術タブに「コスト試算（燃料）」のタブがあり、燃料の試算があるPJだけに出る", () => {
  const tech = read("src/components/cockpit/CockpitTechnology.tsx");
  assert.match(tech, /TECH_TAB_FUEL_COST_LABEL = "コスト試算（燃料）"/);
  assert.match(tech, /loadProjectFuelCostModel\(projectId\)/);
  assert.match(tech, /hasFuelCost \? \[\{ key: TECH_TAB_FUEL_COST/);
  assert.match(tech, /<CockpitFuelCostModel projectId=\{projectId\} allowEdit=\{costModelEditable\} \/>/);
  assert.match(tech, /TECH_VIEW_FUEL_COST = "cost-fuel"/, "開いているタブをアドレスに残す");
  const workspace = read("src/components/project-workspace/SxWeeklyControlDashboard.tsx");
  assert.match(workspace, /<CockpitTechnology projectId=\{bundle\.project\.projectId\} costModelEditable=\{false\} \/>/, "ワークスペースでは保存させない");
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

console.log(`\n${passed} checks passed (project-fuel-cost-model)`);
