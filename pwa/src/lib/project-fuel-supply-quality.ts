import type { CostAssumption, CostTask } from "./project-cost-model.ts";

export const FUEL_SUPPLY_CHOICES = {
  fuel_carbon_source: [{ value: "flue_gas", label: "排ガス" }, { value: "air", label: "空気" }, { value: "purchased", label: "購入CO₂" }],
  fuel_quality_mode: [{ value: "hybrid", label: "自社の日常分析＋定期外注" }, { value: "external", label: "各ロットを外注" }],
};
export const FUEL_CARBON_ROLES = ["fuel_carbon_source", "fuel_air_productivity_ratio", "fuel_carbon_delivery_annual", "fuel_air_co2_ppm", "fuel_flue_co2_percent"];
export const FUEL_QUALITY_ROLES = ["fuel_quality_mode", "fuel_qc_routine_hours", "fuel_qc_routine_consumables", "fuel_lab_capex", "fuel_lab_life_years", "fuel_lab_annual"];

const row = (a: CostAssumption[], role: string) => a.find((x) => x.roleKey === role);
const value = (a: CostAssumption[], role: string, fallback = 0) => {
  const v = row(a, role)?.value;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(v, 0) : fallback;
};

export function fuelCarbonOf(a: CostAssumption[]) {
  const enabled = !!row(a, "fuel_carbon_source") && row(a, "lipid_secreting_strain")?.valueText === "on";
  const source = row(a, "fuel_carbon_source")?.valueText ?? "purchased";
  const inventory = row(a, "fuel_culture_source")?.valueText === "inventory";
  const productivityFactor = enabled && !inventory && source === "air" ? Math.min(value(a, "fuel_air_productivity_ratio", 50), 100) / 100 : 1;
  const gasFraction = Math.min(source === "air" ? value(a, "fuel_air_co2_ppm", 400) / 1e6 : source === "flue_gas" ? value(a, "fuel_flue_co2_percent", 5) / 100 : 1, 1);
  const deliveryAnnual = enabled && !inventory && source !== "purchased" ? value(a, "fuel_carbon_delivery_annual") : 0;
  const missing = enabled && !inventory ? [
    ...(source === "air" ? ["fuel_air_productivity_ratio", "fuel_air_co2_ppm"] : []),
    ...(source === "flue_gas" ? ["fuel_flue_co2_percent"] : []),
    ...(source !== "purchased" ? ["fuel_carbon_delivery_annual"] : []),
  ].filter((r) => row(a, r)?.value == null || ((r === "fuel_air_co2_ppm" || r === "fuel_flue_co2_percent") && value(a, r) <= 0)) : [];
  return { enabled, source, productivityFactor, gasFraction, deliveryAnnual, missing };
}

export function fuelQualityOf(a: CostAssumption[]) {
  const enabled = !!row(a, "fuel_quality_mode");
  const hybrid = enabled && row(a, "fuel_quality_mode")?.valueText === "hybrid";
  const capex = hybrid ? value(a, "fuel_lab_capex") : 0;
  const capexAnnual = capex / Math.max(value(a, "fuel_lab_life_years", 7), 1);
  const maintenanceAnnual = hybrid ? value(a, "fuel_lab_annual") : 0;
  const missing = hybrid ? ["fuel_qc_routine_hours", "fuel_qc_routine_consumables", "fuel_lab_capex", "fuel_lab_life_years", "fuel_lab_annual"].filter((r) => row(a, r)?.value == null || (r === "fuel_lab_life_years" && value(a, r) <= 0)) : [];
  return { enabled, hybrid, capex, capexAnnual, maintenanceAnnual, missing,
    routineHours: value(a, "fuel_qc_routine_hours", 0.25), routineExpense: value(a, "fuel_qc_routine_consumables", 1000) };
}

/** 自社の日常分析と外部確認を分ける。旧モデルは作業行の保存値を使う。 */
export function fuelQualityTask(task: CostTask, a: CostAssumption[]) {
  const q = fuelQualityOf(a);
  const routine = q.hybrid && task.costTaskId === "ctf_ship_qc";
  const inactive = q.enabled && !q.hybrid && task.costTaskId === "ctf_periodic_external_qc";
  return { routine, inactive,
    hours: routine ? q.routineHours : task.hoursPerOccurrence,
    expense: routine ? q.routineExpense : task.expensePerOccurrence };
}
