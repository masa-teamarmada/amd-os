import { biomassOf, computeCostModel, STRAIN_LABEL, type CostApplication, type CostModelBundle, type CostStrain } from "./project-cost-model.ts";
import { cultureLightOf } from "./project-cost-light.ts";

/** 排水処理で年に使用する新しい菌体。色素/金属は選択ケースなので合算しない。 */
export interface FuelEffluentSupply {
  modelId: string;
  application: CostApplication | null;
  strainLabel: string;
  annualBiomassKg: number;
  onsiteVolume: number;
  offsiteVolume: number;
  draft: boolean;
  lightSource?: "sunlight" | "led";
  lightProductivityFactor?: number;
  carbonSource?: "flue_gas" | "purchased";
}

export function deriveFuelEffluentSupply(
  bundle: CostModelBundle | null,
  selection: { strain?: CostStrain | null; application?: CostApplication | null; draft?: boolean } = {},
): FuelEffluentSupply | null {
  if (!bundle || (bundle.model.caseKind as string) === "biodiesel") return null;
  const computed = computeCostModel(bundle, { strain: selection.strain });
  const application = selection.application && computed.applications.includes(selection.application)
    ? selection.application : computed.applications[0] ?? null;
  const biomass = biomassOf(computed, application);
  return {
    modelId: bundle.model.costModelId,
    application,
    strainLabel: computed.strain ? STRAIN_LABEL[computed.strain] : "共通株",
    // 年産能力や販売ロス分ではなく、排水処理へ出荷・使用する新しい菌体量。
    annualBiomassKg: biomass.onsiteVolume * biomass.onsiteBiomassKgPerUnit + biomass.offsiteVolume * biomass.offsiteBiomassKgPerUnit,
    onsiteVolume: biomass.onsiteVolume,
    offsiteVolume: biomass.offsiteVolume,
    draft: !!selection.draft,
    ...(bundle.assumptions.some((a) => a.roleKey === "culture_light_source") ? {
    lightSource: cultureLightOf(bundle.assumptions).source,
    lightProductivityFactor: cultureLightOf(bundle.assumptions).productivityFactor,
    carbonSource: bundle.assumptions.some((a) => a.roleKey === "co2_flue_gas" && a.valueText === "on") ? "flue_gas" as const : "purchased" as const,
    } : {}),
  };
}

/** 出荷待ちでは排水側の培養条件を参照。燃料側に独立した光源や培養費を作らない。 */
export function inheritFuelCulture<T extends Pick<CostModelBundle, "assumptions">>(bundle: T, supply?: FuelEffluentSupply | null): T {
  if (!supply?.lightSource || !bundle.assumptions.some((a) => a.roleKey === "fuel_culture_source" && a.valueText === "inventory")) return bundle;
  return { ...bundle, assumptions: bundle.assumptions.map((a) => {
    if (a.roleKey === "fuel_light_source") return { ...a, valueText: supply.lightSource! };
    if (a.roleKey === "sunlight_productivity_ratio") return { ...a, value: (supply.lightProductivityFactor ?? 1) * 100 };
    if (a.roleKey === "fuel_carbon_source" && supply.carbonSource) return { ...a, valueText: supply.carbonSource };
    return a;
  }) };
}
