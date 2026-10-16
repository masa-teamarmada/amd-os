import { biomassOf, computeCostModel, STRAIN_LABEL, type CostApplication, type CostModelBundle, type CostStrain } from "./project-cost-model.ts";

/** 排水処理で年に使用する新しい菌体。色素/金属は選択ケースなので合算しない。 */
export interface FuelEffluentSupply {
  modelId: string;
  application: CostApplication | null;
  strainLabel: string;
  annualBiomassKg: number;
  onsiteVolume: number;
  offsiteVolume: number;
  draft: boolean;
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
  };
}
