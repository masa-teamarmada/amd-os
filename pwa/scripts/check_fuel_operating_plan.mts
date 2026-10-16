import assert from "node:assert/strict";
import fs from "node:fs";
import { computeFuelScenario, fuelCultureItemPerKg, fuelEffectiveUnitPrice, fuelItemCalc, fuelSelectionOf } from "../src/lib/project-fuel-cost-model.ts";
import { scopeApplies, type CostModelBundle, type CostAssumption } from "../src/lib/project-cost-model.ts";
import { evaluateCalcSegment, evaluateItemCalc } from "../src/lib/cost-item-calc.ts";

const original: CostModelBundle = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_fuel_cost_model.json", import.meta.url), "utf8"));
function model() {
  const b = structuredClone(original);
  const add = (role: string, value: number | string | null) => {
    const a = b.assumptions.find((x) => x.roleKey === role);
    if (a) { a.value = typeof value === "number" ? value : null; a.valueText = typeof value === "string" ? value : null; }
    else b.assumptions.push({ ...b.assumptions[0], costAssumptionId: role, roleKey: role, label: role, value: typeof value === "number" ? value : null, valueText: typeof value === "string" ? value : null } as CostAssumption);
  };
  add("business_annual_volume", 10000);
  add("lipid_secreting_strain", "on");
  add("fuel_light_source", "sunlight");
  add("fuel_culture_source", "inventory");
  add("fuel_equipment_sizing", "whole");
  add("sunlight_productivity_ratio", 50);
  add("sunlight_capex", 100000);
  add("sunlight_life_years", 10);
  add("sunlight_opex_annual", 20000);
  add("inventory_volume_m3", 10);
  add("inventory_wait_days", 3);
  add("inventory_batches_year", 100);
  add("inventory_incremental_annual", 30000);
  add("inventory_common_allocation_annual", 0);
  return { b, add };
}
const close = (a: number, b: number, label = "") => assert.ok(Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9, `${label}: ${a} != ${b}`);
const { b, add } = model();
const r = computeFuelScenario(b, "outsourced", "base");
// 10m³ × 300日 × 0.036g/L/日 × 50% = 54kg。回収・反応・精製を通した量を上限にする。
close(r.scale.unitKgYear, 54, "物質収支");
close(r.scale.annualLiters, 54 * 0.9 * 0.97 * 0.98 / 0.88, "販売可能量");
assert.equal(r.scale.requestedAnnualLiters, 10000);
assert.equal(r.scale.cultureLines, 1);
assert.equal(r.scale.plantLines, 1);
assert.equal(r.scale.shipmentsPerYear, 1);
assert.equal(r.scale.lotsPerYear, 1);
const snapshot = JSON.stringify(b);
add("business_annual_volume", 1000000);
const largerTarget = computeFuelScenario(b, "outsourced", "base");
close(largerTarget.scale.annualLiters, r.scale.annualLiters, "目標増で在庫を増やさない");
close(largerTarget.totalAnnual, r.totalAnnual);
add("business_annual_volume", 10000);
assert.equal(JSON.stringify(b), snapshot, "元の保存束を破壊しない");

add("sunlight_productivity_ratio", 25);
const dim = computeFuelScenario(b, "outsourced", "base");
close(dim.scale.annualLiters, r.scale.annualLiters / 2);
close(dim.scale.cultureLineVolumeM3, r.scale.cultureLineVolumeM3, "光で槽を縮小しない");
assert.ok(dim.totalPerLiter > r.totalPerLiter, "固定費が同じで生産量が減れば単価が上がる");
add("sunlight_productivity_ratio", 50);
add("inventory_wait_days", 10);
const overSchedule = computeFuelScenario(b, "outsourced", "base");
assert.equal(overSchedule.scale.inventoryExposureDays, 300);
assert.equal(overSchedule.scale.inventoryScheduleExceeded, true);
add("inventory_wait_days", 3);

// 共通培養の二重計上を止めても、分泌株の溶媒等は残す。
const ctx = { assumptions: b.assumptions, items: b.items, conversion: "outsourced" as "outsourced" | "inhouse" };
for (const i of b.items.filter((i) => i.scenario === "中央培養" && i.strain === null)) close(fuelCultureItemPerKg(i, r.scale.cultureLineCapacityUnitYear, ctx, r.scale), 0);
assert.ok(r.biomass.variablePerKg > 0);
add("inventory_common_allocation_annual", 123456);
const allocated = computeFuelScenario(b, "outsourced", "base");
close(allocated.totalAnnual - r.totalAnnual, 123456, "共通費配賦は一度だけ足す");
add("inventory_common_allocation_annual", 0);
add("sunlight_capex", 300000);
const extraSolar = computeFuelScenario(b, "outsourced", "base");
close(extraSolar.capexInitial - r.capexInitial, 200000);
close(extraSolar.totalAnnual - r.totalAnnual, 20000, "追加屋外設備を償却");
add("sunlight_capex", null);
assert.ok(computeFuelScenario(b, "outsourced", "base").scale.operating.missing.includes("sunlight_capex"));
add("sunlight_capex", 100000);

// 設備の実購入と量産配賦を分ける。年100Lでも1基と最低1ロット。
add("fuel_culture_source", "dedicated");
add("business_annual_volume", 100);
const small = computeFuelScenario(b, "outsourced", "base");
add("business_annual_volume", 1000);
const medium = computeFuelScenario(b, "outsourced", "base");
assert.equal(small.scale.plantLines, 1);
close(small.plantCapexInitial, medium.plantCapexInitial);
assert.ok(small.totalPerLiter > medium.totalPerLiter);
add("fuel_equipment_sizing", "proportional");
const proportional = computeFuelScenario(b, "outsourced", "base");
assert.ok(proportional.scale.plantLines < 1);
assert.ok(proportional.totalPerLiter < medium.totalPerLiter);
add("fuel_equipment_sizing", "whole");
add("fuel_plant_capex_override", 1000000);
for (const c of ["outsourced", "inhouse"] as const) {
  const quoted = computeFuelScenario(b, c, "base");
  close(quoted.plantLineCapexInitial, 1000000, "小型設備の見積総額");
  close(quoted.plantCapexInitial, 1000000, "設備1系列の実購入額");
}

// LEDは価格の入力を消さず光源の切り替えだけで除外する。
const light = { ...b.items[0], leafLabel: "照明の電力（LED）", unitPrice: 17.45 };
assert.equal(fuelEffectiveUnitPrice(light, ctx), 0);
add("fuel_light_source", "led");
assert.equal(fuelEffectiveUnitPrice(light, ctx), 17.45);
add("fuel_light_source", "sunlight");

// 明細の各式、内訳、確度別の合計と原価・年額のつながりを全運転条件で検査。
for (const source of ["inventory", "dedicated"]) for (const light of ["sunlight", "led"]) for (const sizing of ["whole", "proportional"]) {
  add("fuel_culture_source", source); add("fuel_light_source", light); add("fuel_equipment_sizing", sizing);
  for (const c of ["outsourced", "inhouse"] as const) for (const y of ["low", "base", "high"] as const) {
    ctx.conversion = c;
    const sc = computeFuelScenario(b, c, y);
    close(sc.breakdown.reduce((sum, x) => sum + x.perLiter, 0), sc.totalPerLiter);
    close(sc.confidenceBreakdown.reduce((sum, x) => sum + x.perLiter, 0), sc.totalPerLiter);
    close(sc.totalAnnual, sc.totalPerLiter * sc.scale.annualLiters);
    close(sc.capexPerLiter + sc.opexPerLiter, sc.totalPerLiter);
    const sel = fuelSelectionOf(b.assumptions);
    for (const i of b.items.filter((i) => scopeApplies(i, sel))) {
      const calc = fuelItemCalc(i, sc, ctx);
      if (!calc) continue;
      if (calc.price) close(evaluateCalcSegment(calc.price, null), calc.price.result.value, "実効単価 " + i.costItemId);
      let previous: number | null = null;
      for (const seg of calc.segments) { previous = evaluateCalcSegment(seg, previous); close(previous, seg.result.value, i.costItemId); }
      assert.ok(Number.isFinite(evaluateItemCalc(calc)));
    }
  }
}
add("inventory_volume_m3", 0); add("fuel_culture_source", "inventory");
const zero = computeFuelScenario(b, "outsourced", "base");
assert.equal(zero.scale.annualLiters, 0);
assert.ok(Number.isFinite(zero.totalPerLiter));
add("lipid_secreting_strain", "off");
assert.equal(computeFuelScenario(b, "outsourced", "base").scale.operating.inventory, false, "非分泌株へ出荷待ち分泌量を流用しない");
console.log("fuel operating plan: inventory balance, sunlight, small-scale fixed costs, missing estimates and 48 scenario reconciliations passed");
