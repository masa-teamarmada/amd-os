// コスト試算（二段階版）の計算エンジン契約チェック。DB接続なし。
// Run: npm run test:project-cost-model
//
// 【なぜこの guard があるか】2026-09-13 まさ指摘。旧版は中央培養の設備償却を「排水1m³あたりの固定額」で置いており、
// 菌体使用回数を変えると菌体1kgあたりの原価が見かけ上 98円 → 約440円 → 約1,200円と動いた。
// 「製造原価は株で決まり、用途では変わらない。用途で変わるのは使い回せる回数」という事実と合わない計算を二度と戻さない。
//
// 正本: pwa/spec/5-13-project-cost-model-current-spec.md
// fixture: scripts/__fixtures__/sx_cost_model_two_stage.json（migration 393 適用後の SX データ）
import assert from "node:assert/strict";
import fs from "node:fs";
import { computeBiomassCost, computeCostModel } from "../src/lib/project-cost-model.ts";

const fixture = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_cost_model_two_stage.json", import.meta.url), "utf8"));
const clone = () => JSON.parse(JSON.stringify(fixture));
const scenario = (bundle: any, strain: "enhanced" | "wild", app: "dye" | "metal", key: string) => {
  const s = computeCostModel(bundle, { strain }).scenarios.find((x) => x.key === `${app}:${key}`);
  assert.ok(s, `scenario ${strain} ${app} ${key}`);
  return s;
};
const near = (got: number, want: number, tol: number, label: string) =>
  assert.ok(Math.abs(got - want) <= tol, `${label}: got ${got.toFixed(3)}, want ${want} ±${tol}`);

// 1. 旧版と同じ条件へ戻すと、260820版の検証値（原典スプレッドシート一致済み）に戻る
{
  const legacy = clone();
  for (const a of legacy.assumptions) if (a.roleKey === "uptake_alpha" && a.application === "metal" && a.strain === "wild") a.value = 0.05;
  legacy.items = legacy.items.filter((i: any) => !["labor_batch", "patrol", "patrol_module", "patrol_membrane"].includes(i.priceRule));
  for (const i of legacy.items) {
    if (i.costItemId === "ci_260820_133") i.unitPrice = 5;
    if (i.costItemId === "ci_260820_141") i.unitPrice = 4;
  }
  const expected: Record<string, number> = { "循環-既設": 582.4, "循環-新設": 642.4, "投入-既設": 349.7, "投入-新設": 409.7 };
  for (const [key, want] of Object.entries(expected)) near(scenario(legacy, "wild", "metal", key).totalPerUnit, want, 0.05, `旧版再現 ${key}`);
}

// 2. 菌体の製造原価は用途で変わらない（第2段の菌体費 ÷ 使った菌体量 ＝ 第1段の原価）
for (const strain of ["enhanced", "wild"] as const) {
  const perKg = computeBiomassCost(fixture, strain).perKg;
  assert.ok(perKg > 0, `${strain} 第1段の原価が出ている`);
  for (const s of computeCostModel(fixture, { strain }).scenarios) {
    near(s.centralTotalPerUnit / s.biomassKgPerUnit, perKg, 1e-6, `${strain} ${s.key} の菌体1kg原価が第1段と一致`);
  }
}

// 3. 強化株は閉鎖系の追加費用で自然株より高い。自然株には強化株の行が1円も乗らない
{
  const enh = computeBiomassCost(fixture, "enhanced");
  const wild = computeBiomassCost(fixture, "wild");
  assert.ok(enh.perKg > wild.perKg, "強化株の菌体原価 > 自然株");
  assert.ok(enh.strainSpecificPerKg > 0, "強化株に株固有の行が乗る");
  assert.equal(wild.strainSpecificPerKg, 0, "自然株に強化株の行は乗らない");
  for (const s of computeCostModel(fixture, { strain: "wild" }).scenarios) assert.equal(s.strainSpecificPerUnit, 0, `自然株 ${s.key} に閉鎖系の追加費用なし`);
}

// 4. 菌体使用回数を2倍にすると、菌体費はちょうど半分になる（旧版の頭打ちを戻さない）
{
  const base = scenario(fixture, "enhanced", "dye", "投入-既設");
  const doubled = clone();
  for (const a of doubled.assumptions) if (a.roleKey === "reuse_count" && a.application === "dye") a.value = (a.value ?? 1) * 2;
  const twice = scenario(doubled, "enhanced", "dye", "投入-既設");
  near(twice.centralTotalPerUnit, base.centralTotalPerUnit / 2, 1e-6, "使用回数2倍で菌体費が半分");
  near(twice.biomassKgPerUnit, base.biomassKgPerUnit / 2, 1e-9, "使用回数2倍で菌体量が半分");
}

// 5. 用途の行は他の用途に混ざらない（色素分解に酸処理は乗らない。金属回収に汚泥処分は乗らない）
{
  const dyeItems = new Set(fixture.items.filter((i: any) => i.application === "dye").map((i: any) => i.costItemId));
  const metalItems = new Set(fixture.items.filter((i: any) => i.application === "metal").map((i: any) => i.costItemId));
  assert.ok(dyeItems.size > 0 && metalItems.size > 0, "用途別の行がある");
  const dye = scenario(fixture, "wild", "dye", "投入-既設");
  const metal = scenario(fixture, "wild", "metal", "投入-既設");
  assert.ok(dye.postProcessPerUnit > 0 && metal.postProcessPerUnit > 0, "両用途に後処理がある");
  const dyeOnlyAcid = clone();
  dyeOnlyAcid.items = dyeOnlyAcid.items.filter((i: any) => !metalItems.has(i.costItemId));
  near(scenario(dyeOnlyAcid, "wild", "dye", "投入-既設").totalPerUnit, dye.totalPerUnit, 1e-9, "金属専用の行を消しても色素分解は変わらない");
}

// 6. 人件費は総コストに含み、除いた値と整合する
for (const s of computeCostModel(fixture, { strain: "enhanced" }).scenarios) {
  assert.ok(s.laborPerUnit > 0, `${s.key} 人件費が入っている`);
  near(s.totalWithoutLaborPerUnit, s.totalPerUnit - s.laborPerUnit, 1e-9, `${s.key} 人件費を除いた値`);
  assert.ok(s.patrolPerUnit > 0, `${s.key} 巡回サービスが入っている`);
}

// 7. 仕様書の検証表と一致する（B:投入／既設）
near(computeBiomassCost(fixture, "enhanced").perKg, 127.1, 0.05, "強化株 菌体原価");
near(computeBiomassCost(fixture, "wild").perKg, 98.5, 0.05, "自然株 菌体原価");
near(scenario(fixture, "enhanced", "dye", "投入-既設").totalPerUnit, 878.0, 0.05, "強化株 色素 B既設");
near(scenario(fixture, "enhanced", "metal", "投入-既設").totalPerUnit, 715.0, 0.05, "強化株 金属 B既設");
near(scenario(fixture, "wild", "dye", "投入-既設").totalPerUnit, 826.5, 0.05, "自然株 色素 B既設");
near(scenario(fixture, "wild", "metal", "投入-既設").totalPerUnit, 708.1, 0.05, "自然株 金属 B既設");

// 8. 株・用途を持たない試算（LiSTie の部分試算など）でも落ちない
{
  const empty = { assumptions: [], items: [] };
  const c = computeCostModel(empty);
  assert.deepEqual(c.strains, []);
  assert.deepEqual(c.applications, []);
  assert.equal(c.scenarios.length, 4, "用途なしは従来どおり4シナリオ");
  assert.ok(c.scenarios.every((s) => Number.isFinite(s.totalPerUnit)), "空でも数値が有限");
}

// 9. 画面は株のスイッチと用途の比較を持つ（静的確認）
{
  const ui = fs.readFileSync(new URL("../src/components/cockpit/CockpitCostModel.tsx", import.meta.url), "utf8");
  assert.match(ui, /STRAIN_LABEL/, "画面が株のラベルを使う");
  assert.match(ui, /computeCostModel\([^)]*strain/, "画面が選んだ株で計算する");
  assert.match(ui, /第1段/, "第1段の表示がある");
  assert.match(ui, /第2段/, "第2段の表示がある");
}

console.log("project-cost-model: OK");
