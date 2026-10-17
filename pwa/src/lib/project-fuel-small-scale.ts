import type { CostModelBundle } from "./project-cost-model.ts";
import type { FuelEffluentSupply } from "./project-fuel-effluent-supply.ts";
import { computeFuelScenario, type FuelScenarioResult } from "./project-fuel-cost-model.ts";

export function fuelSmallScaleCases(bundle: CostModelBundle, current: FuelScenarioResult, supply?: FuelEffluentSupply | null) {
  if (!current.scale.operating.inventoryFromEffluent || !supply) return null;
  const target = bundle.assumptions.find((x) => x.roleKey === "fuel_small_reference_l")?.value ?? 10000;
  const shareRow = bundle.assumptions.find((x) => x.roleKey === "inventory_recovery_share");
  const qc = bundle.tasks.find((x) => x.costTaskId === "ctf_periodic_external_qc");
  if (!shareRow || !qc || !(target > 0)) return null;
  const full = { ...bundle, assumptions: bundle.assumptions.map((a) => a === shareRow ? { ...a, value: 100 } : a) };
  const availableLiters = computeFuelScenario(full, current.conversion, current.yieldCase, supply).scale.annualLiters;
  if (!(availableLiters > 0)) return { target, availableLiters, share: 0, requiredBiomass: null, cases: [], maxExternalChecks: null };
  const share = Math.min(target / availableLiters * 100, 100);
  const fameCapex = bundle.assumptions.find((x) => x.roleKey === "fuel_physical_fame_capex")?.value ?? 0;
  const water = bundle.assumptions.find((x) => x.roleKey === "fuel_physical_water")?.value ?? 0;
  const configurations = [
    { label: "現在の設備・分析条件", qc: qc.countPerYear ?? 0, fame: fameCapex, water },
    { label: "外部分析を年2回", qc: 2, fame: fameCapex, water },
    ...(current.scale.physical.enabled ? [{ label: "年2回・乾燥する水を1kgに低減", qc: 2, fame: fameCapex, water: 1 }] : []),
    { label: "外部分析を年1回", qc: 1, fame: fameCapex, water },
    ...(current.scale.physical.enabled && current.conversion === "inhouse" ? [{ label: "年2回・FAME設備500万円", qc: 2, fame: 5000000, water }] : []),
  ];
  const compute = (externalChecks: number, fame: number, dryWater = water) => {
    const working = { ...bundle,
      assumptions: bundle.assumptions.map((a) => a === shareRow ? { ...a, value: share } : a.roleKey === "fuel_physical_fame_capex" ? { ...a, value: fame } : a.roleKey === "fuel_physical_water" ? { ...a, value: dryWater } : a),
      tasks: bundle.tasks.map((t) => t === qc ? { ...t, countPerYear: externalChecks } : t),
    };
    return computeFuelScenario(working, current.conversion, current.yieldCase, supply);
  };
  const noExternal = compute(0, fameCapex);
  const oneExternal = compute(1, fameCapex);
  const externalCost = oneExternal.totalAnnual - noExternal.totalAnnual;
  const maxExternalChecks = externalCost > 0 && noExternal.profitAnnual >= 0 ? Math.floor((noExternal.profitAnnual + 1e-7) / externalCost) : noExternal.profitAnnual < 0 ? -1 : null;
  return { target, availableLiters, share, requiredBiomass: supply.annualBiomassKg * target / availableLiters,
    maxExternalChecks,
    cases: configurations.map((c) => ({ ...c, result: compute(c.qc, c.fame, c.water), shareAssumptionId: shareRow.costAssumptionId, qcTaskId: qc.costTaskId,
      waterAssumptionId: bundle.assumptions.find((x) => x.roleKey === "fuel_physical_water")?.costAssumptionId,
      fameAssumptionId: bundle.assumptions.find((x) => x.roleKey === "fuel_physical_fame_capex")?.costAssumptionId })),
  };
}
