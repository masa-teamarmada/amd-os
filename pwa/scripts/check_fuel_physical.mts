import fs from "node:fs";
import assert from "node:assert/strict";
import type { CostModelBundle } from "../src/lib/project-cost-model.ts";
import { computeFuelScenario, fuelEffectiveUnitPrice } from "../src/lib/project-fuel-cost-model.ts";
import { deriveFuelEffluentSupply } from "../src/lib/project-fuel-effluent-supply.ts";
import { fuelSmallScaleCases } from "../src/lib/project-fuel-small-scale.ts";
import { fuelPhysicalReplaces } from "../src/lib/project-fuel-physical.ts";
const load = (name: string): CostModelBundle => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"));
const f = load("sx_fuel_physical"), w = load("sx_effluent_light");
const saved = JSON.stringify(f), savedWater = JSON.stringify(w);
const set = (b: CostModelBundle, role: string, value: number | string) => {
  const a = b.assumptions.find((x) => x.roleKey === role)!;
  assert.ok(a, role); if (typeof value === "number") a.value = value; else a.valueText = value;
};
const close = (a: number, b: number, label: string) => assert.ok(Math.abs(a - b) < Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9, `${label}: ${a} != ${b}`);
const supply = deriveFuelEffluentSupply(w, { strain: "wild", application: "dye", draft: true })!;
const r = computeFuelScenario(f, "inhouse", "base", supply);
close(r.scale.annualLiters, 10000, "reference is derived from wastewater stock");
close(r.totalPerLiter, 361.5571332812359, "monthly external QC");
close(r.capexInitial, 2960000, "2 recovery points plus lab, no cultivation equipment");
close(r.scale.physical.recoveryCapex, 960000, "48万円 per point");
close(r.scale.physical.points, 2, "capacity scales recovery equipment");
close(r.scale.physical.waterKg, r.scale.physical.recoveredKg * 3, "moisture load");
close(r.scale.physical.heatMj, r.scale.physical.waterKg * 2.6 / .7, "drying efficiency");
close(r.scale.solvent.stockM3, 0, "no solvent stock");
close(r.scale.operating.inventoryIncrementalAnnual, 0, "physical maintenance replaces solvent upkeep");
for (const i of f.items.filter((i) => fuelPhysicalReplaces(i, f.assumptions))) close(fuelEffectiveUnitPrice(i, { assumptions: f.assumptions, items: f.items }), 0, `no solvent expense ${i.costItemId}`);
assert.ok(f.items.some((i) => (i.scenario as string) === "自社精製" && fuelEffectiveUnitPrice(i, { assumptions: f.assumptions, items: f.items }) > 0), "FAME reagents remain chargeable");
for (const mode of ["physical", "loop", "overlay"]) for (const conversion of ["inhouse", "outsourced"] as const) for (const y of ["low", "base", "high"] as const) for (const light of ["sunlight", "led"] as const) {
  const b = structuredClone(f); set(b, "fuel_solvent_mode", mode);
  const x = computeFuelScenario(b, conversion, y, { ...supply, lightSource: light, lightProductivityFactor: light === "sunlight" ? .5 : 1 });
  close(x.breakdown.reduce((n, p) => n + p.perLiter, 0), x.totalPerLiter, "breakdown");
  for (const p of x.breakdown) close(p.parts.reduce((n, q) => n + q.perLiter, 0), p.perLiter, p.key);
  close(x.confidenceBreakdown.reduce((n, p) => n + p.perLiter, 0), x.totalPerLiter, "confidence");
}
for (const role of ["fuel_physical_secretion_rate", "fuel_physical_recovery"]) {
  const b = structuredClone(f); set(b, role, (b.assumptions.find((a) => a.roleKey === role)!.value ?? 0) / 2);
  close(computeFuelScenario(b, "inhouse", "base", supply).scale.annualLiters, 5000, `${role} independent adjustment`);
  set(b, role, 0); close(computeFuelScenario(b, "inhouse", "base", supply).scale.annualLiters, 0, `${role} zero yield`);
  b.assumptions = b.assumptions.filter((a) => a.roleKey !== role);
  const missing = computeFuelScenario(b, "inhouse", "base", supply);
  close(missing.scale.annualLiters, 0, "no solvent benchmark fallback");
  assert.ok(missing.scale.physical.missing.includes(role));
}
const inflation = structuredClone(f);
for (const i of inflation.items.filter((i) => i.scenario === "中央培養")) i.unitPrice *= 1000;
for (const role of ["sunlight_capex", "sunlight_opex_annual", "inventory_common_allocation_annual", "fuel_carbon_delivery_annual", "inventory_incremental_annual", "fuel_solvent_loop_capex", "secretion_rate", "broth_recovery"]) set(inflation, role, 100000000);
close(computeFuelScenario(inflation, "inhouse", "base", supply).totalAnnual, r.totalAnnual, "cultivation and solvent inputs never enter physical recovery");
const points = structuredClone(f); set(points, "fuel_physical_points", 3);
const morePoints = computeFuelScenario(points, "inhouse", "base", supply);
close(morePoints.capexInitial - r.capexInitial, 480000, "layout minimum");
close(morePoints.totalAnnual - r.totalAnnual, 480000 / 7 + 50000, "extra point depreciation and maintenance once");
const plan = fuelSmallScaleCases(f, r, supply)!;
assert.ok(plan && plan.cases.length === 5);
close(plan.requiredBiomass!, 1028590.1302101596, "source biomass needed for target");
close(plan.cases[1].result.totalPerLiter, 209.557133281236, "twice-yearly external QC");
close(plan.cases[2].result.totalPerLiter, 193.74035590754718, "mechanical dewatering improvement");
close(plan.cases[3].result.totalPerLiter, 194.35713328123597, "once-yearly external QC");
close(plan.cases[4].result.totalPerLiter, 295.98570470980746, "additional FAME equipment");
close(plan.cases[4].result.capexInitial, 7960000, "new FAME equipment counted once");
assert.equal(plan.maxExternalChecks, 1);
for (const c of plan.cases) {
  const b = structuredClone(f);
  set(b, "inventory_recovery_share", plan.share); set(b, "fuel_physical_fame_capex", c.fame); set(b, "fuel_physical_water", c.water);
  b.tasks.find((t) => t.costTaskId === c.qcTaskId)!.countPerYear = c.qc;
  close(computeFuelScenario(b, "inhouse", "base", supply).totalAnnual, c.result.totalAnnual, "applying comparison reproduces result");
}
const limited = structuredClone(f); set(limited, "fuel_small_reference_l", 1000000);
const cap = fuelSmallScaleCases(limited, computeFuelScenario(limited, "inhouse", "base", supply), supply)!;
close(cap.share, 100, "biomass share cannot exceed actual supply");
assert.ok(cap.requiredBiomass! > supply.annualBiomassKg);
close(cap.cases[0].result.scale.annualLiters, cap.availableLiters, "show constrained output");
close(computeFuelScenario(limited, "inhouse", "base", supply).scale.annualLiters, r.scale.annualLiters, "comparison reference is not production input");
assert.equal(JSON.stringify(f), saved, "scenario computation never mutates saved fuel");
assert.equal(JSON.stringify(w), savedWater, "wastewater unchanged");
console.log("physical recovery: 36 reconciliations, independent yield inputs, no solvent/cultivation leakage, equipment sizing, drying, small-scale cases, source cap and non-mutating application passed");
