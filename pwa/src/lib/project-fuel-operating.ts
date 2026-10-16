import type { CostAssumption, CostItem, CostTask } from "./project-cost-model.ts";

/** 燃料試算の運転条件。未登録の旧モデルは従来の計算を保つ。 */
export const FUEL_OPERATING_CHOICES = {
  fuel_light_source: [{ value: "sunlight", label: "太陽光主体" }, { value: "led", label: "人工照明" }],
  fuel_culture_source: [{ value: "inventory", label: "出荷待ちから回収" }, { value: "dedicated", label: "燃料専用で培養" }],
  fuel_equipment_sizing: [{ value: "whole", label: "必要設備を1基単位で計上" }, { value: "proportional", label: "量産の比例配賦" }],
} satisfies Record<string, Array<{ value: string; label: string }>>;

export const FUEL_OPERATING_NUMERIC_ROLES = [
  "sunlight_productivity_ratio", "sunlight_capex", "sunlight_life_years", "sunlight_opex_annual",
  "inventory_volume_m3", "inventory_wait_days", "inventory_batches_year",
  "inventory_incremental_annual", "inventory_common_allocation_annual",
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
  const plantValue = row("fuel_plant_capex_override")?.value;
  const plantCapexOverride = typeof plantValue === "number" && Number.isFinite(plantValue) && plantValue >= 0 ? plantValue : null;
  const productivityFactor = sunlight ? Math.min(value("sunlight_productivity_ratio", 50), 100) / 100 : 1;
  const missing = [
    ...(wholeLines ? ["fuel_plant_capex_override"] : []),
    ...(sunlight ? ["sunlight_productivity_ratio", "sunlight_capex", "sunlight_life_years", "sunlight_opex_annual"] : []),
    ...(inventory ? ["inventory_volume_m3", "inventory_wait_days", "inventory_batches_year", "inventory_incremental_annual", "inventory_common_allocation_annual"] : []),
  ].filter((role) => row(role)?.value == null || (role === "sunlight_life_years" && value(role) <= 0) || (role === "fuel_plant_capex_override" && plantCapexOverride === null));
  return {
    sunlight, inventory, inventorySelected, wholeLines, plantCapexOverride, productivityFactor, missing,
    inventoryVolumeM3: value("inventory_volume_m3"),
    inventoryWaitDays: value("inventory_wait_days"),
    inventoryBatchesYear: value("inventory_batches_year"),
    solarCapex: sunlight ? value("sunlight_capex") : 0,
    solarCapexAnnual: sunlight ? value("sunlight_capex") / Math.max(value("sunlight_life_years", 10), 1) : 0,
    solarOpexAnnual: sunlight ? value("sunlight_opex_annual") : 0,
    inventoryIncrementalAnnual: inventory ? value("inventory_incremental_annual") : 0,
    commonAllocationAnnual: inventory ? value("inventory_common_allocation_annual") : 0,
  };
}

/** LEDの電力・器具は太陽光主体で除外。槽や保温・循環まで無料にしない。 */
export function isFuelLightingItem(item: Pick<CostItem, "leafLabel" | "midLabel">): boolean {
  return /LED|照明/.test(`${item.midLabel ?? ""} ${item.leafLabel ?? ""}`);
}

/** 出荷待ちでは共通培養を再計上せず、分泌用の追加設備・原料を残す。共通費配賦は年額の入力で別計上。 */
export function fuelCultureChargeFactor(row: Pick<CostItem | CostTask, "strain">, assumptions: CostAssumption[]): number {
  return fuelOperatingOf(assumptions).inventory && row.strain !== "secreting" ? 0 : 1;
}

export function fuelLineCount(required: number, whole: boolean): number {
  return required > 0 && Number.isFinite(required) ? (whole ? Math.ceil(required) : required) : 0;
}
