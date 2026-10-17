import fs from "node:fs";
import assert from "node:assert/strict";
import { computeFuelScenario, computeFuelTaskFlow, fuelItemCalc, fuelEffectiveUnitPrice } from "../src/lib/project-fuel-cost-model.ts";
import { evaluateItemCalc } from "../src/lib/cost-item-calc.ts";
import type { CostModelBundle } from "../src/lib/project-cost-model.ts";
const b: CostModelBundle = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_fuel_solvent_loop.json", import.meta.url), "utf8"));
const supply = { modelId: "cm_p21_260820", application: "dye" as const, strainLabel: "wild", annualBiomassKg: 2033267.9558000576, onsiteVolume: 20000000, offsiteVolume: 30000, draft: false };
const close = (a: number, b: number, label = "") => assert.ok(Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9, `${label}: ${a} != ${b}`);
const set = (x: CostModelBundle, role: string, value: number | string | null) => { const a = x.assumptions.find((a) => a.roleKey === role)!; a.value = typeof value === "number" ? value : null; a.valueText = typeof value === "string" ? value : null; };
let cases = 0;
for (const mode of ["loop", "overlay"]) for (const conversion of ["outsourced", "inhouse"] as const) for (const yieldCase of ["low", "base", "high"] as const) {
  const x = structuredClone(b); set(x, "fuel_solvent_mode", mode);
  const r = computeFuelScenario(x, conversion, yieldCase, supply), s = r.scale.solvent;
  assert.equal(r.scale.operating.missing.length, 0);
  close(r.breakdown.reduce((n, p) => n + p.perLiter, 0), r.totalPerLiter, "breakdown");
  for (const slice of r.breakdown) close(slice.parts.reduce((n, p) => n + p.perLiter, 0), slice.perLiter, slice.key);
  close(r.confidenceBreakdown.reduce((n, p) => n + p.perLiter, 0), r.totalPerLiter, "confidence");
  close(r.totalAnnual, r.scale.annualLiters * r.totalPerLiter, "annual");
  close(r.capexInitial, mode === "loop" ? 20500000 : 5500000, "single capex");
  if (mode === "loop") {
    close(s.solventM3Year * 0.8, r.scale.unitKgYear, "solvent mass balance");
    close(s.waterM3Year * .02, r.scale.unitKgYear, "water mass balance");
    close(s.stockM3, s.solventM3Hour * .5 + 2, "hold-up");
    close(s.makeupKgYear, s.solventM3Year * 900 * .00005, "loss");
  } else close(s.workingCapital, r.scale.usedInventoryVolumeM3 * .05 * 900 * 500, "overlay");
  close(s.fundingAnnual, s.workingCapital * .03, "funding");
  for (const item of x.items.filter((i) => !i.isBreakdown && i.costType !== "参考")) {
    const calc = fuelItemCalc(item, r, { assumptions: x.assumptions, items: x.items, conversion });
    if (calc && !calc.excluded) assert.ok(Number.isFinite(evaluateItemCalc(calc)), "finite displayed formula");
  }
  cases++;
}
const base = computeFuelScenario(b, "inhouse", "base", supply);
const noFunding = structuredClone(b); set(noFunding, "fuel_solvent_funding_rate", 0);
close(base.totalAnnual - computeFuelScenario(noFunding, "inhouse", "base", supply).totalAnnual, base.scale.solvent.fundingAnnual, "funding once");
const half = computeFuelScenario(b, "inhouse", "base", { ...supply, annualBiomassKg: supply.annualBiomassKg / 2 });
close(half.scale.solvent.solventM3Year, base.scale.solvent.solventM3Year / 2, "scale flow");
close(half.scale.solvent.stockM3 - 2, (base.scale.solvent.stockM3 - 2) / 2, "buffer floor");
const slow = structuredClone(b); set(slow, "fuel_solvent_cycle_minutes", 60);
close(computeFuelScenario(slow, "inhouse", "base", supply).scale.solvent.stockM3 - 2, 2 * (base.scale.solvent.stockM3 - 2), "cycle");
const empty = computeFuelScenario(b, "inhouse", "base", { ...supply, annualBiomassKg: 0 });
assert.equal(empty.scale.solvent.stockM3, 0); assert.equal(empty.scale.solvent.fundingAnnual, 0);
for (const role of ["fuel_solvent_net_loading", "fuel_solvent_water_drop", "fuel_solvent_cycle_minutes", "fuel_solvent_hours_day"]) for (const value of [0, null, NaN]) {
  const x = structuredClone(b); set(x, role, value);
  const r = computeFuelScenario(x, "inhouse", "base", supply); assert.ok(r.scale.operating.missing.includes(role)); assert.ok(Number.isFinite(r.totalPerLiter));
}
const rawMakeup = b.items.find((i) => /溶媒.*補給/.test(i.leafLabel ?? "") && i.strain === "secreting")!;
close(fuelEffectiveUnitPrice(rawMakeup, { assumptions: b.assumptions, items: b.items }), 0, "old makeup excluded");
const overlay = structuredClone(b); set(overlay, "fuel_solvent_mode", "overlay");
close(fuelEffectiveUnitPrice(rawMakeup, { assumptions: overlay.assumptions, items: overlay.items }), rawMakeup.unitPrice, "reference price retained");
close(computeFuelTaskFlow(b, base).plantHours + computeFuelTaskFlow(b, base).cultureHours, 624.75, "additional maintenance labor");
const dedicated = structuredClone(b); set(dedicated, "fuel_culture_source", "dedicated"); assert.equal(computeFuelScenario(dedicated, "inhouse", "base", supply).scale.solvent.enabled, false);
console.log("solvent loop:", cases, "scenario reconciliations, flow/hold-up/loss/power/funding/single-cost/invalid/zero/legacy checks passed", { cost: base.totalPerLiter, profit: base.profitAnnual, solvent: base.scale.solvent });
