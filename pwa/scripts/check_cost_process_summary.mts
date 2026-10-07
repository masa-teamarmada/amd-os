import assert from "node:assert/strict";
import fs from "node:fs";
import {
  annualAmount, computeCostModel, derivedOf, isReactorRow, resolveBearer,
  resolvePerformer, scopeApplies, scopesFor, taskAmount, type CostModelBundle,
} from "../src/lib/project-cost-model.ts";
import { computeProcessSummary } from "../src/lib/cost-process-summary.ts";

const fixture = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sx_cost_model_two_stage.json", import.meta.url), "utf8")) as CostModelBundle;
const clone = () => structuredClone(fixture);
const near = (a: number, b: number, label: string) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);
let checked = 0;
function check(bundle: CostModelBundle) {
  const before = JSON.stringify(bundle);
  for (const strain of ["wild", "enhanced"] as const) {
    const computed = computeCostModel(bundle, { strain });
    for (const scenario of computed.scenarios) {
      const selection = { strain, application: scenario.application, location: scenario.location, method: scenario.method, tankMode: scenario.tankMode };
      const result = computeProcessSummary(bundle, computed, selection)!;
      assert.equal(result.steps.length, 8);
      assert.deepEqual(result.steps.map((s) => s.key), ["culture", "concentrate", "prepare", "deliver", "install", "treat", "collect", "finish"]);
      near(result.sx, scenario.totalPerUnit, `${strain} ${scenario.key} existing SX cost`);
      near(result.steps.flatMap((s) => s.rows).filter((r) => r.payer === "sx" && r.type === "CAPEX").reduce((n, r) => n + r.perUnit, 0), scenario.capexTotalPerUnit, "SX CAPEX partition");
      near(result.steps.flatMap((s) => s.rows).filter((r) => r.payer === "sx" && r.type === "OPEX").reduce((n, r) => n + r.perUnit, 0), scenario.opexTotalPerUnit, "SX OPEX partition");
      const scopes = scopesFor(scenario.location, scenario.method);
      const derived = derivedOf(computed, scenario.application, scenario.location);
      const extras = bundle.items.filter((i) => !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考" && scopes.includes(i.scenario) && scopeApplies(i, selection) && !isReactorRow(i) && resolveBearer(i, scenario.location, computed.reactorCustomerBorne) === "customer")
        .reduce((n, i) => n + annualAmount(i, bundle.assumptions, derived, selection, bundle.items), 0)
        + bundle.tasks.filter((t) => scopes.includes(t.scenario) && scopeApplies(t, selection) && !isReactorRow(t) && resolvePerformer(t, scenario.location, computed.reactorCustomerBorne) === "customer")
          .reduce((n, t) => n + taskAmount(t, bundle.assumptions, derived, selection).annual, 0);
      near(result.customer, scenario.reactorCustomerPerUnit + (derived.annualVolume > 0 ? extras / derived.annualVolume : 0), "customer reactor plus non-reactor source costs");
      near(result.capex + result.opex, result.sx + result.customer, "both cost partitions agree");
      near(result.steps[7].cumulative, result.total, "final cumulative agrees");
      const ids = result.steps.flatMap((s) => s.rows.map((r) => r.id));
      assert.equal(new Set(ids).size, ids.length, "joint source rows contribute only once");
      assert.ok(result.steps.every((s) => Number.isFinite(s.cumulative)), "no NaN or infinity");
      checked++;
    }
  }
  assert.equal(JSON.stringify(bundle), before, "summary must not mutate source or computed inputs");
}
check(fixture);
const sales = clone();
sales.assumptions.find((a) => a.roleKey === "sales_rate")!.value = 45;
check(sales);
const override = clone();
override.assumptions.find((a) => a.roleKey === "biomass_cost_per_kg_override")!.value = 500;
check(override);
const payer = clone();
const reactor = { ...payer.assumptions[0], costAssumptionId: "test-reactor-payer", roleKey: "reactor_customer_borne", value: null, valueText: "off", strain: null, application: null };
payer.assumptions.push(reactor);
check(payer);
const partial = clone();
partial.tasks[0].hoursPerOccurrence = null;
partial.assumptions = partial.assumptions.filter((a) => a.roleKey !== "new_tank_capex");
check(partial);
const zeroVolume = clone();
zeroVolume.assumptions.find((a) => a.roleKey === "batch_volume")!.value = 0;
check(zeroVolume);
const c = computeCostModel(fixture, { strain: "wild" });
const onsite = c.scenarios.find((s) => s.application === "dye" && s.location === "onsite" && s.method === "循環")!;
const summary = computeProcessSummary(fixture, c, { strain: "wild", application: "dye", location: "onsite", method: "循環", tankMode: onsite.tankMode })!;
assert.match(summary.steps[2].title, /カートリッジ/);
assert.ok(summary.steps[2].gaps.some((g) => /未計上/.test(g)), "unregistered filling is visible, not silently zero");
assert.ok(summary.steps[3].rows.some((r) => r.note?.includes("往復")));
assert.ok(summary.steps[4].rows.some((r) => r.note?.includes("搬出")));
const other = clone();
other.items = other.items.filter((i) => i.scenario !== "中央培養");
assert.equal(computeProcessSummary(other, computeCostModel(other), { strain: "wild", application: "dye", location: "onsite", method: "投入", tankMode: "既設" }), null, "unrelated cost models do not receive a cyanobacteria process");
console.log(`Cost process summary: ${checked} scenario checks passed`);
