import fs from "node:fs";
import assert from "node:assert/strict";
import { computeCostModel, biomassOf, effectiveUnitPrice, deriveCostBasis } from "../src/lib/project-cost-model.ts";
import type { CostModelBundle } from "../src/lib/project-cost-model.ts";
import { computeFuelScenario, fuelEffectiveUnitPrice } from "../src/lib/project-fuel-cost-model.ts";
import { deriveFuelEffluentSupply, inheritFuelCulture } from "../src/lib/project-fuel-effluent-supply.ts";
import { computeProcessSummary } from "../src/lib/cost-process-summary.ts";
const load = (name: string): CostModelBundle => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"));
const f = load("sx_fuel_minimum"), w = load("sx_effluent_light");
const set = (b: CostModelBundle, role: string, value: number | string) => { const a = b.assumptions.find((x) => x.roleKey === role)!; if (typeof value === "number") a.value = value; else a.valueText = value; };
const close = (a: number, b: number, label: string) => assert.ok(Math.abs(a - b) < Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9, `${label}: ${a} != ${b}`);
const source = () => deriveFuelEffluentSupply(w, { strain: "wild", application: "dye", draft: true })!;
const saved = JSON.stringify(f);
const solarSupply = source();
const solar = computeFuelScenario(f, "inhouse", "base", solarSupply);
close(solar.totalPerLiter, 157.19211530925662, "sunlight reference");
close(solar.capexInitial, 5000000, "3M recovery plus 2M lab, counted once");
close(solar.scale.solvent.capex, 3000000, "itemized recovery budget");
assert.equal(solar.scale.effluentSupply?.draft, true);
// 培養設備、LED、CO2、培地、通常作業、上書き、屋外化、共通費配賦を動かしても燃料追加費へ流入させない。
const inflated = structuredClone(f);
for (const i of inflated.items.filter((i) => i.scenario === "中央培養" && !/溶媒.*補給/.test(i.leafLabel ?? ""))) i.unitPrice *= 1000;
for (const t of inflated.tasks.filter((t) => t.scenario === "中央培養" && t.costTaskId !== "ctf_sec_culture_operation")) { t.hoursPerOccurrence = 100000; t.expensePerOccurrence = 100000000; }
for (const r of ["sunlight_capex", "sunlight_opex_annual", "inventory_common_allocation_annual", "fuel_carbon_delivery_annual", "biomass_cost_per_kg_override"]) set(inflated, r, 100000000);
set(inflated, "fuel_carbon_source", "purchased");
set(inflated, "fuel_light_source", "led");
set(inflated, "sunlight_productivity_ratio", 1);
for (const light of ["sunlight", "led"]) {
  set(w, "culture_light_source", light);
  const supply = source();
  const effective = inheritFuelCulture(f, supply);
  const water = computeCostModel(w, { strain: "wild" });
  for (const scenario of water.scenarios) {
    const selection = { strain: "wild" as const, application: scenario.application, location: scenario.location, method: scenario.method, tankMode: scenario.tankMode };
    const process = computeProcessSummary(w, water, selection)!;
    close(process.sx, scenario.totalPerUnit, "wastewater process and total agree under either light source");
  }
  for (const conversion of ["inhouse", "outsourced"] as const) for (const y of ["low", "base", "high"] as const) {
    const r = computeFuelScenario(f, conversion, y, supply);
    close(computeFuelScenario(inflated, conversion, y, supply).totalAnnual, r.totalAnnual, "all cultivation cost excluded");
    for (const i of effective.items.filter((i) => i.scenario === "中央培養" && !/溶媒.*補給/.test(i.leafLabel ?? ""))) close(fuelEffectiveUnitPrice(i, { assumptions: effective.assumptions, items: effective.items }), 0, i.costItemId);
    close(r.breakdown.reduce((n, x) => n + x.perLiter, 0), r.totalPerLiter, "breakdown");
    for (const slice of r.breakdown) close(slice.parts.reduce((n, x) => n + x.perLiter, 0), slice.perLiter, slice.key);
    close(r.confidenceBreakdown.reduce((n, x) => n + x.perLiter, 0), r.totalPerLiter, "confidence");
  }
}
const litSupply = source();
const lit = computeFuelScenario(f, "inhouse", "base", litSupply);
close(litSupply.annualBiomassKg, solarSupply.annualBiomassKg, "demand determines biomass");
close(lit.scale.annualLiters, solar.scale.annualLiters * 2, "secretion productivity changes fuel output");
// 収量比率を固定すれば光源名で燃料費は変わらない。
close(computeFuelScenario(f, "inhouse", "base", { ...litSupply, lightProductivityFactor: 1, lightSource: "sunlight" }).totalAnnual, lit.totalAnnual, "same yield same fuel cost across light sources");
const lump = structuredClone(f); set(lump, "fuel_solvent_loop_capex", 999000000);
close(computeFuelScenario(lump, "inhouse", "base", solarSupply).totalAnnual, solar.totalAnnual, "old lump sum ignored after itemization");
const solarWater = structuredClone(w); set(solarWater, "culture_light_source", "sunlight");
const bSun = biomassOf(computeCostModel(solarWater, { strain: "wild" }), "dye"), bLed = biomassOf(computeCostModel(w, { strain: "wild" }), "dye");
close(bSun.productionLines, bLed.productionLines * 2, "sunlight lower culture capacity requires more lines");
assert.ok(bSun.productionPerKg < bLed.productionPerKg, "lighting expense charged on wastewater side");
for (const i of w.items.filter((i) => i.scenario === "中央培養" && /LED|照明/.test(`${i.midLabel} ${i.leafLabel}`))) {
  close(effectiveUnitPrice(i, solarWater.assumptions, deriveCostBasis(solarWater.assumptions), { strain: "wild", application: null }, solarWater.items), 0, "sunlight no LED cost");
  assert.ok(effectiveUnitPrice(i, w.assumptions, deriveCostBasis(w.assumptions), { strain: "wild", application: null }, w.items) > 0, "LED cost on wastewater");
}
const shortage = structuredClone(f); set(shortage, "fuel_solvent_capacity_capex", 7000000);
close(computeFuelScenario(shortage, "inhouse", "base", solarSupply).totalAnnual - solar.totalAnnual, 1000000, "capacity shortage purchase is added once");
const pump = structuredClone(f); set(pump, "fuel_solvent_water_power", .01);
assert.ok(computeFuelScenario(pump, "inhouse", "base", solarSupply).totalAnnual > solar.totalAnnual, "extra recovery pumping is not free");
const dedicated = structuredClone(f); set(dedicated, "fuel_culture_source", "dedicated"); set(dedicated, "fuel_light_source", "led");
const dedicatedLit = computeFuelScenario(dedicated, "inhouse", "base", solarSupply);
set(dedicated, "fuel_light_source", "sunlight");
assert.ok(dedicatedLit.totalAnnual > computeFuelScenario(dedicated, "inhouse", "base", solarSupply).totalAnnual, "dedicated cultivation keeps its own light cost");
assert.equal(JSON.stringify(f), saved, "inheritance never changes saved bundle");
console.log("culture boundary: 12 reconciliations; cultivation cost inflation, source inheritance, fixed-yield invariance, wastewater light/capacity, shortage CAPEX, incremental pump power, dedicated culture passed");
