import assert from "node:assert/strict";
import fs from "node:fs";
import { computeFuelScenario, computeFuelTaskFlow, fuelTaskAmount, fuelCultureItemPerKg, fuelEffectiveUnitPrice, fuelItemCalc, fuelSelectionOf } from "../src/lib/project-fuel-cost-model.ts";
import { scopeApplies, type CostModelBundle, type CostAssumption } from "../src/lib/project-cost-model.ts";
import { evaluateCalcSegment, evaluateItemCalc } from "../src/lib/cost-item-calc.ts";
import { deriveFuelEffluentSupply } from "../src/lib/project-fuel-effluent-supply.ts";

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
close(allocated.totalAnnual - r.totalAnnual, 0, "全培養費は排水側。旧共通費配賦を使わない");
add("inventory_common_allocation_annual", 0);
add("sunlight_capex", 300000);
const extraSolar = computeFuelScenario(b, "outsourced", "base");
close(extraSolar.capexInitial - r.capexInitial, 0);
close(extraSolar.totalAnnual - r.totalAnnual, 0, "屋外の培養設備も排水側");
add("sunlight_capex", null);
assert.ok(!computeFuelScenario(b, "outsourced", "base").scale.operating.missing.includes("sunlight_capex"));
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

// 年産10,000Lの設計と在庫10m³の供給制約を混同せず、小規模の設備・作業を数える。
const smallBundle: CostModelBundle = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_fuel_small_scale.json", import.meta.url), "utf8"));
const setSmall = (role: string, value: number | string) => {
  const a = smallBundle.assumptions.find((x) => x.roleKey === role)!;
  if (typeof value === "number") a.value = value; else a.valueText = value;
};
setSmall("inventory_sizing", "target");
const design = computeFuelScenario(smallBundle, "outsourced", "base");
close(design.scale.annualLiters, 10000);
close(design.scale.requiredInventoryVolumeM3!, 1904.796537426222);
assert.equal(design.scale.cultureLines, 9);
assert.equal(design.scale.productionBatchesYear, 103);
assert.equal(design.plantCapexInitial, 4000000);
assert.equal(computeFuelScenario(smallBundle, "inhouse", "base").plantCapexInitial, 9000000);
const designFlow = computeFuelTaskFlow(smallBundle, design);
close(designFlow.plantHours + designFlow.cultureHours, 911);
close(design.totalPerLiter, 789.2099212193468);
assert.ok(design.totalAnnual < 30000000, "大規模工場の固定費を小規模回収へ戻さない");
const productionTask = smallBundle.tasks!.find((t) => t.costTaskId === "ctf_sec_plant_operation")!;
const qcTask = smallBundle.tasks!.find((t) => t.costTaskId === "ctf_ship_qc")!;
assert.equal(fuelTaskAmount(productionTask, smallBundle.assumptions, design.scale).occurrences, 103);
assert.equal(fuelTaskAmount(qcTask, smallBundle.assumptions, design.scale).occurrences, 10);
setSmall("fuel_light_source", "led");
const litDesign = computeFuelScenario(smallBundle, "outsourced", "base");
close(litDesign.scale.annualLiters, 10000);
close(litDesign.scale.requiredInventoryVolumeM3!, design.scale.requiredInventoryVolumeM3! / 2);
setSmall("fuel_light_source", "sunlight");
setSmall("inventory_sizing", "available");
const stockLimited = computeFuelScenario(smallBundle, "outsourced", "base");
close(stockLimited.scale.annualLiters, 52.499045454545445);
assert.equal(stockLimited.scale.productionBatchesYear, 1);
assert.equal(stockLimited.plantCapexInitial, 4000000);
setSmall("inventory_sizing", "target");
setSmall("business_annual_volume", 1000);
const thousand = computeFuelScenario(smallBundle, "outsourced", "base");
close(thousand.scale.annualLiters, 1000);
close(thousand.scale.requiredInventoryVolumeM3!, design.scale.requiredInventoryVolumeM3! / 10);
assert.equal(thousand.scale.productionBatchesYear, 11);
assert.equal(thousand.scale.cultureLines, 1);
setSmall("sunlight_productivity_ratio", 0);
assert.equal(computeFuelScenario(smallBundle, "outsourced", "base").scale.annualLiters, 0);
setSmall("sunlight_productivity_ratio", 50);
setSmall("business_annual_volume", 10000);
for (const mode of ["target", "available"]) for (const lightSource of ["sunlight", "led"]) {
  setSmall("inventory_sizing", mode); setSmall("fuel_light_source", lightSource);
  for (const c of ["outsourced", "inhouse"] as const) for (const y of ["low", "base", "high"] as const) {
    const sc = computeFuelScenario(smallBundle, c, y);
    close(sc.breakdown.reduce((sum, x) => sum + x.perLiter, 0), sc.totalPerLiter);
    close(sc.confidenceBreakdown.reduce((sum, x) => sum + x.perLiter, 0), sc.totalPerLiter);
    const flow = computeFuelTaskFlow(smallBundle, sc);
    close(flow.plantHours, sc.plantTaskHours);
    close(sc.totalAnnual, sc.totalPerLiter * sc.scale.annualLiters);
  }
}
console.log("small batch design: target sizing, actual inventory cap, equipment, labor, QC batches and 24 scenario totals passed");

// 排水の年間量→使う新しい菌体量→出荷待ちの分泌→FAME。燃料目標の入力は使わない。
const effluent: CostModelBundle = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_fuel_effluent_source.json", import.meta.url), "utf8"));
setSmall("inventory_sizing", "effluent"); setSmall("fuel_light_source", "sunlight");
const supply = deriveFuelEffluentSupply(effluent, { strain: "wild", application: "dye" })!;
close(supply.annualBiomassKg, 2033267.9558000576);
const linked = computeFuelScenario(smallBundle, "outsourced", "base", supply);
close(linked.scale.annualLiters, 106744.62683281793);
close(linked.scale.usedInventoryVolumeM3, 20332.67955800058);
assert.ok(linked.scale.annualLiters > 10000, "FAMEを手入力の目標量で切り詰めない");
setSmall("business_annual_volume", 1);
close(computeFuelScenario(smallBundle, "outsourced", "base", supply).scale.annualLiters, linked.scale.annualLiters);
const halfWater = structuredClone(effluent);
for (const a of halfWater.assumptions) if (a.roleKey === "business_annual_volume" || a.roleKey === "offsite_annual_volume") a.value = (a.value ?? 0) / 2;
const halfSupply = deriveFuelEffluentSupply(halfWater, { strain: "wild", application: "dye", draft: true })!;
assert.equal(halfSupply.draft, true);
close(halfSupply.annualBiomassKg, supply.annualBiomassKg / 2);
close(computeFuelScenario(smallBundle, "outsourced", "base", halfSupply).scale.annualLiters, linked.scale.annualLiters / 2);
setSmall("inventory_wait_days", 1.5);
close(computeFuelScenario(smallBundle, "outsourced", "base", supply).scale.annualLiters, linked.scale.annualLiters / 2);
setSmall("inventory_wait_days", 3); setSmall("inventory_recovery_share", 50);
close(computeFuelScenario(smallBundle, "outsourced", "base", supply).scale.annualLiters, linked.scale.annualLiters / 2);
setSmall("inventory_recovery_share", 100); setSmall("inventory_biomass_concentration", 2);
close(computeFuelScenario(smallBundle, "outsourced", "base", supply).scale.annualLiters, linked.scale.annualLiters / 2);
setSmall("inventory_biomass_concentration", 1);
const metalSupply = deriveFuelEffluentSupply(effluent, { strain: "wild", application: "metal" })!;
assert.ok(metalSupply.annualBiomassKg > supply.annualBiomassKg);
assert.equal(deriveFuelEffluentSupply(null), null);
const unavailable = computeFuelScenario(smallBundle, "outsourced", "base");
assert.equal(unavailable.scale.annualLiters, 0);
assert.ok(unavailable.scale.operating.missing.includes("effluent_supply"));
const zeroSupply = { ...supply, annualBiomassKg: 0 };
assert.equal(computeFuelScenario(smallBundle, "outsourced", "base", zeroSupply).scale.annualLiters, 0);
for (const a of effluent.assumptions) if (a.roleKey === "business_annual_volume" || a.roleKey === "offsite_annual_volume") a.value = 0;
assert.equal(deriveFuelEffluentSupply(effluent, { strain: "wild", application: "dye" })!.annualBiomassKg, 0, "排水ゼロで設備の名目能力を菌体使用量へ使わない");
console.log("effluent linkage: annual biomass use, selected application, draft volume, waiting time, concentration, share, missing/zero source and FAME output passed");

// 在庫の既存設備利用では、新規購入の参考明細を追加原価へ載せない。
const existingBundle: CostModelBundle = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_fuel_small_scale.json", import.meta.url), "utf8"));
const sourceBundle: CostModelBundle = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_fuel_effluent_source.json", import.meta.url), "utf8"));
const existingSupply = deriveFuelEffluentSupply(sourceBundle, { strain: "wild", application: "dye" })!;
const equipmentBefore = computeFuelScenario(existingBundle, "outsourced", "base", existingSupply);
const extra = (role: string, value: number | null) => {
  let a = existingBundle.assumptions.find((r) => r.roleKey === role);
  if (!a) { a = { ...existingBundle.assumptions[0], roleKey: role, costAssumptionId: role, valueText: null }; existingBundle.assumptions.push(a); }
  a.value = value;
};
extra("inventory_equipment_capex", null); extra("inventory_equipment_life_years", 7); extra("inventory_initial_working_capital", null);
const shared = computeFuelScenario(existingBundle, "outsourced", "base", existingSupply);
close(shared.scale.annualLiters, equipmentBefore.scale.annualLiters);
assert.equal(shared.capexInitial, 0);
assert.equal(shared.capexPerLiter, 0);
close(shared.totalPerLiter, 708.953356392487);
assert.ok(shared.scale.operating.missing.includes("inventory_equipment_capex"));
const sharedCtx = { assumptions: existingBundle.assumptions, items: existingBundle.items, conversion: "outsourced" as const };
for (const item of existingBundle.items.filter((r) => r.costType === "CAPEX")) {
  assert.equal(fuelEffectiveUnitPrice(item, sharedCtx), 0, item.costItemId);
}
// 参考の装置価格を何倍にしても既存利用の追加採算は変わらない。
for (const item of existingBundle.items.filter((r) => r.costType === "CAPEX")) item.unitPrice *= 10;
close(computeFuelScenario(existingBundle, "outsourced", "base", existingSupply).totalPerLiter, shared.totalPerLiter);
extra("inventory_equipment_capex", 700000);
const purchased = computeFuelScenario(existingBundle, "outsourced", "base", existingSupply);
close(purchased.capexInitial, 700000);
close(purchased.totalAnnual - shared.totalAnnual, 100000, "追加購入の入力額だけを1回償却");
close(purchased.confidenceBreakdown.reduce((sum, p) => sum + p.perLiter, 0), purchased.totalPerLiter);
close(purchased.breakdown.reduce((sum, p) => sum + p.perLiter, 0), purchased.totalPerLiter);
extra("inventory_initial_working_capital", 500000);
const funded = computeFuelScenario(existingBundle, "outsourced", "base", existingSupply);
assert.equal(funded.scale.operating.inventoryInitialWorkingCapital, 500000);
close(funded.totalAnnual, purchased.totalAnnual, "初回溶媒等の運転資金を年間費用へ再計上しない");
extra("inventory_equipment_capex", 0);
for (const conv of ["outsourced", "inhouse"] as const) for (const yc of ["base", "low", "high"] as const) {
  const sc = computeFuelScenario(existingBundle, conv, yc, existingSupply);
  assert.equal(sc.capexPerLiter, 0);
  close(sc.breakdown.reduce((sum, p) => sum + p.perLiter, 0), sc.totalPerLiter);
  close(sc.confidenceBreakdown.reduce((sum, p) => sum + p.perLiter, 0), sc.totalPerLiter);
  for (const item of existingBundle.items.filter((i) => scopeApplies(i, fuelSelectionOf(existingBundle.assumptions)))) {
    const calc = fuelItemCalc(item, sc, { ...sharedCtx, conversion: conv });
    if (!calc) continue;
    if (calc.price) close(evaluateCalcSegment(calc.price, null), calc.price.result.value);
    let previous: number | null = null;
    for (const seg of calc.segments) { previous = evaluateCalcSegment(seg, previous); close(previous, seg.result.value); }
  }
}
const dedicatedRole = existingBundle.assumptions.find((a) => a.roleKey === "fuel_culture_source")!;
dedicatedRole.valueText = "dedicated";
assert.ok(computeFuelScenario(existingBundle, "outsourced", "base").capexInitial > 0, "専用培養では設備投資を残す");
console.log("existing inventory equipment: no duplicate CAPEX, explicit purchase only, startup working capital separated, dedicated cultivation preserved and totals reconciled");
// 自動運転の追加人時、炭素源と品質確認は独立した前提で比較する。
const automated: CostModelBundle = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_fuel_automated.json", import.meta.url), "utf8"));
const supplyAuto = { modelId: "test", application: "dye" as const, strainLabel: "自然株", annualBiomassKg: 2033267.9558000576, onsiteVolume: 20000000, offsiteVolume: 30000, draft: false };
const autoRole = (bundle: CostModelBundle, role: string, val: number | string | null) => {
 const a = bundle.assumptions.find(a => a.roleKey === role)!;
 a.value = typeof val === "number" ? val : null; a.valueText = typeof val === "string" ? val : null;
};
const auto = computeFuelScenario(automated, "outsourced", "base", supplyAuto);
const autoFlow = computeFuelTaskFlow(automated, auto);
close(auto.scale.annualLiters, 106744.62683281793);
close(autoFlow.cultureHours, 75);
close(autoFlow.cultureHours + autoFlow.plantHours, 417.75);
close(autoFlow.annual, autoFlow.laborAnnual + autoFlow.expenseAnnual);
close(autoFlow.perLiter, autoFlow.laborPerLiter + autoFlow.expensePerLiter);
const twiceAuto = computeFuelScenario(automated, "outsourced", "base", { ...supplyAuto, annualBiomassKg: supplyAuto.annualBiomassKg * 2 });
close(computeFuelTaskFlow(automated, twiceAuto).cultureHours, 75, "拠点の追加確認に系列数を掛けない");
assert.equal(auto.scale.operating.quality.hybrid, true);
assert.ok(auto.scale.operating.missing.includes("fuel_lab_capex"));
assert.ok(auto.scale.operating.missing.includes("fuel_lab_annual"));
assert.ok(!auto.scale.operating.missing.includes("fuel_carbon_delivery_annual"));
const upgradedLab = structuredClone(automated);
autoRole(upgradedLab, "fuel_lab_capex", 700000);
autoRole(upgradedLab, "fuel_lab_annual", 50000);
const withLab = computeFuelScenario(upgradedLab, "outsourced", "base", supplyAuto);
close(withLab.totalAnnual - auto.totalAnnual, 150000, "分析機器は一度だけ償却し校正維持を加える");
close(withLab.capexInitial - auto.capexInitial, 700000);
autoRole(upgradedLab, "fuel_carbon_delivery_annual", 123456);
close(computeFuelScenario(upgradedLab, "outsourced", "base", supplyAuto).totalAnnual - withLab.totalAnnual, 0, "在庫回収では送気費を計上しない");
const bought = structuredClone(automated);
autoRole(bought, "fuel_carbon_source", "purchased");
autoRole(bought, "co2_flue_gas", "on");
const purchasedAuto = computeFuelScenario(bought, "outsourced", "base", supplyAuto);
close(purchasedAuto.totalPerLiter - auto.totalPerLiter, 0, "在庫回収では購入CO2も全額排水側");
const airAuto = structuredClone(automated);
autoRole(airAuto, "fuel_carbon_source", "air");
const halfAir = computeFuelScenario(airAuto, "outsourced", "base", supplyAuto);
close(halfAir.scale.annualLiters, auto.scale.annualLiters, "在庫回収では燃料側の炭素源で培養条件を変えない");
autoRole(airAuto, "fuel_air_productivity_ratio", 0);
close(computeFuelScenario(airAuto, "outsourced", "base", supplyAuto).scale.annualLiters, auto.scale.annualLiters);
const exterior = structuredClone(upgradedLab);
autoRole(exterior, "fuel_quality_mode", "external");
const outside = computeFuelScenario(exterior, "outsourced", "base", supplyAuto);
close(outside.capexInitial, 0, "各ロット外注は分析機器を購入しない");
const periodic = exterior.tasks.find(t=>t.costTaskId === "ctf_periodic_external_qc")!;
close(fuelTaskAmount(periodic, exterior.assumptions, outside.scale).annual, 0, "各ロット外注では定期一式の別枠を加算しない");
for (const source of ["flue_gas", "air", "purchased"]) for (const qc of ["hybrid", "external"]) for (const c of ["outsourced", "inhouse"] as const) for (const y of ["low", "base", "high"] as const) {
 const b = structuredClone(upgradedLab); autoRole(b,"fuel_carbon_source",source); autoRole(b,"fuel_quality_mode",qc);
 const sc = computeFuelScenario(b,c,y,supplyAuto);
 close(sc.breakdown.reduce((s,r)=>s+r.perLiter,0),sc.totalPerLiter,"36条件の内訳整合");
 close(sc.breakdown.flatMap(r=>r.parts).reduce((s,r)=>s+r.perLiter,0),sc.totalPerLiter,"小分け整合");
 close(sc.confidenceBreakdown.reduce((s,r)=>s+r.perLiter,0),sc.totalPerLiter,"確度別整合");
 close(sc.totalAnnual,sc.totalPerLiter*sc.scale.annualLiters);
 close(sc.capexPerLiter+sc.opexPerLiter,sc.totalPerLiter);
 const ctx = { assumptions:b.assumptions,items:b.items,conversion:c };
 for (const i of b.items.filter(i=>scopeApplies(i,fuelSelectionOf(b.assumptions)))) {
  const calc=fuelItemCalc(i,sc,ctx); if(!calc)continue;
  if(calc.price)close(evaluateCalcSegment(calc.price,null),calc.price.result.value);
  let prev: number|null=null;for(const seg of calc.segments){prev=evaluateCalcSegment(seg,prev);close(prev,seg.result.value);}
 }
}
console.log("automated fuel: incremental site labor, purchased/air/flue gas, quality modes, lab CAPEX, missing estimates and 36 reconciliations passed", { cost:auto.totalPerLiter, hours:autoFlow.cultureHours+autoFlow.plantHours, labor:autoFlow.laborPerLiter, expense:autoFlow.expensePerLiter });
