import type { CostAssumption, CostItem, CostTask } from "./project-cost-model.ts";
import { fuelCarbonOf, fuelQualityOf } from "./project-fuel-supply-quality.ts";

/** 燃料試算の運転条件。未登録の旧モデルは従来の計算を保つ。 */
export const FUEL_OPERATING_CHOICES = {
  fuel_light_source: [{ value: "sunlight", label: "太陽光主体" }, { value: "led", label: "人工照明" }],
  fuel_culture_source: [{ value: "inventory", label: "出荷待ちから回収" }, { value: "dedicated", label: "燃料専用で培養" }],
  inventory_sizing: [{ value: "effluent", label: "排水事業に連動" }, { value: "available", label: "在庫から算定" }],
  fuel_equipment_sizing: [{ value: "whole", label: "必要設備を1基単位で計上" }, { value: "proportional", label: "量産の比例配賦" }],
} satisfies Record<string, Array<{ value: string; label: string }>>;

export const FUEL_OPERATING_NUMERIC_ROLES = [
  "sunlight_productivity_ratio", "sunlight_capex", "sunlight_life_years", "sunlight_opex_annual",
  "inventory_volume_m3", "inventory_wait_days", "inventory_batches_year",
  "inventory_incremental_annual", "inventory_common_allocation_annual",
  "inventory_biomass_concentration", "inventory_recovery_share",
  "inventory_equipment_capex", "inventory_equipment_life_years", "inventory_initial_working_capital",
] as const;

export const FUEL_OPERATING_ROLES = [...Object.keys(FUEL_OPERATING_CHOICES), ...FUEL_OPERATING_NUMERIC_ROLES];

export function fuelOperatingOf(assumptions: CostAssumption[]) {
  const row = (role: string) => assumptions.find((a) => a.roleKey === role);
  const value = (role: string, fallback = 0) => {
    const v = row(role)?.value;
    return typeof v === "number" && Number.isFinite(v) ? Math.max(v, 0) : fallback;
  };
  const sunlight = row("fuel_light_source")?.valueText === "sunlight";
  const inventorySelected = row("fuel_culture_source")?.valueText === "inventory";
  const inventory = inventorySelected && row("lipid_secreting_strain")?.valueText === "on";
  const wholeLines = row("fuel_equipment_sizing")?.valueText === "whole";
  const inventoryTarget = inventory && row("inventory_sizing")?.valueText === "target";
  const inventoryFromEffluent = inventory && row("inventory_sizing")?.valueText === "effluent";
  const inventoryExistingEquipment = inventory && !!row("inventory_equipment_capex");
  const smallBatchEquipment = row("fuel_equipment_basis")?.valueText === "small_batch" && row("lipid_secreting_strain")?.valueText === "on";
  const plantValue = row("fuel_plant_capex_override")?.value;
  const plantCapexOverride = typeof plantValue === "number" && Number.isFinite(plantValue) && plantValue >= 0 ? plantValue : null;
  const lightProductivityFactor = sunlight ? Math.min(value("sunlight_productivity_ratio", 50), 100) / 100 : 1;
  const carbon = fuelCarbonOf(assumptions);
  const quality = fuelQualityOf(assumptions);
  const productivityFactor = lightProductivityFactor * carbon.productivityFactor;
  const missing = [
    ...(wholeLines && !smallBatchEquipment ? ["fuel_plant_capex_override"] : []),
    ...(sunlight && !inventory ? ["sunlight_productivity_ratio", "sunlight_capex", "sunlight_life_years", "sunlight_opex_annual"] : []),
    ...(inventory ? [...(inventoryTarget || inventoryFromEffluent ? [] : ["inventory_volume_m3"]), "inventory_wait_days", ...(inventoryFromEffluent ? ["inventory_biomass_concentration", "inventory_recovery_share"] : ["inventory_batches_year"]), "inventory_incremental_annual"] : []),
    ...(inventoryExistingEquipment ? ["inventory_equipment_capex", "inventory_equipment_life_years", "inventory_initial_working_capital"] : []),
  ].filter((role) => row(role)?.value == null || (["sunlight_life_years", "inventory_biomass_concentration", "inventory_equipment_life_years"].includes(role) && value(role) <= 0) || (role === "fuel_plant_capex_override" && plantCapexOverride === null));
  missing.push(...carbon.missing, ...quality.missing);
  return {
    sunlight, inventory, inventorySelected, inventoryTarget, inventoryFromEffluent, inventoryExistingEquipment, smallBatchEquipment, wholeLines, plantCapexOverride, productivityFactor, lightProductivityFactor, carbon, quality, missing,
    inventoryEquipmentCapex: inventoryExistingEquipment ? value("inventory_equipment_capex") : 0,
    inventoryEquipmentCapexAnnual: inventoryExistingEquipment ? value("inventory_equipment_capex") / Math.max(value("inventory_equipment_life_years", 7), 1) : 0,
    inventoryInitialWorkingCapital: inventoryExistingEquipment ? row("inventory_initial_working_capital")?.value ?? null : null,
    inventoryBiomassConcentration: value("inventory_biomass_concentration"),
    inventoryRecoveryShare: Math.min(value("inventory_recovery_share", 100), 100) / 100,
    inventoryVolumeM3: value("inventory_volume_m3"),
    inventoryWaitDays: value("inventory_wait_days"),
    inventoryBatchesYear: value("inventory_batches_year"),
    solarCapex: sunlight && !inventory ? value("sunlight_capex") : 0,
    solarCapexAnnual: sunlight && !inventory ? value("sunlight_capex") / Math.max(value("sunlight_life_years", 10), 1) : 0,
    solarOpexAnnual: sunlight && !inventory ? value("sunlight_opex_annual") : 0,
    inventoryIncrementalAnnual: inventory ? value("inventory_incremental_annual") : 0,
    commonAllocationAnnual: 0,
  };
}

/** 既存設備利用の追加採算。設備購入・償却と購入額比の保守は手入力の追加費用で数える。 */
export function fuelUsesExistingEquipment(item: Pick<CostItem, "costType" | "basis" | "leafLabel">, assumptions: CostAssumption[]): boolean {
  return fuelOperatingOf(assumptions).inventoryExistingEquipment &&
    (item.costType === "CAPEX" || (item.basis === "年額固定" && /初期投資の[\d.]+%/.test(item.leafLabel ?? "")));
}

/** LEDの電力・器具は太陽光主体で除外。槽や保温・循環まで無料にしない。 */
export function isFuelLightingItem(item: Pick<CostItem, "leafLabel" | "midLabel">): boolean {
  return /LED|照明/.test(`${item.midLabel ?? ""} ${item.leafLabel ?? ""}`);
}

/** 出荷待ちでは全培養費を除外。回収の追加溶媒・追加監視のみを残す。 */
export function fuelCultureChargeFactor(row: Pick<CostItem | CostTask, "strain"> & { leafLabel?: string | null; costTaskId?: string }, assumptions: CostAssumption[]): number {
  if (!fuelOperatingOf(assumptions).inventory) return 1;
  // 回収の溶媒補給と追加監視だけを残す。脂肪酸用LED/CO₂も培養側の負担。
  return row.costTaskId === "ctf_sec_culture_operation" || (row.strain === "secreting" && /溶媒.*補給/.test(row.leafLabel ?? "")) ? 1 : 0;
}

export function fuelLineCount(required: number, whole: boolean): number {
  return required > 0 && Number.isFinite(required) ? (whole ? Math.ceil(required) : required) : 0;
}
