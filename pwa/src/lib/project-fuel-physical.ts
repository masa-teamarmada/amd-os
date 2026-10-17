import type { CostAssumption, CostItem } from "./project-cost-model.ts";

export const FUEL_PHYSICAL_EQUIPMENT = [
  { role: "fuel_physical_skimmer_capex", label: "すくい取り・集油部" },
  { role: "fuel_physical_filter_capex", label: "ろ過・脱水部" },
  { role: "fuel_physical_receiver_capex", label: "受槽・移送・配管" },
  { role: "fuel_physical_install_capex", label: "計装・接続・試運転" },
];
export const FUEL_PHYSICAL_ROLES = [
  "fuel_physical_secretion_rate", "fuel_physical_secretion_rate_low", "fuel_physical_secretion_rate_high",
  "fuel_physical_recovery", "fuel_physical_recovery_low", "fuel_physical_recovery_high",
  "fuel_physical_points", "fuel_physical_capacity", "fuel_physical_hours", ...FUEL_PHYSICAL_EQUIPMENT.map((x) => x.role),
  "fuel_physical_life", "fuel_physical_annual", "fuel_physical_consumables", "fuel_physical_power",
  "fuel_physical_water", "fuel_physical_heat_per_water", "fuel_physical_heat_efficiency",
  "fuel_physical_monitor_minutes", "fuel_physical_fame_capex", "fuel_physical_fame_life", "fuel_physical_fame_maintenance_percent",
];
export function fuelPhysicalOn(a: CostAssumption[]) {
  return a.some((x) => x.roleKey === "fuel_solvent_mode" && x.valueText === "physical") &&
    a.some((x) => x.roleKey === "fuel_culture_source" && x.valueText === "inventory") &&
    a.some((x) => x.roleKey === "lipid_secreting_strain" && x.valueText === "on");
}
export function fuelPhysicalReplaces(item: Pick<CostItem, "strain" | "midLabel" | "leafLabel" | "scenario">, a: CostAssumption[]) {
  if (!fuelPhysicalOn(a) || item.strain !== "secreting" || (item.scenario as string) === "自社精製") return false;
  return /溶媒|酸で油に戻す/.test(item.midLabel ?? "") || /溶媒|酸析のための加温/.test(item.leafLabel ?? "");
}
/** 回収済みFFA基準で物理回収の消耗品・脱水を計算。既存培養費は加えない。 */
export function fuelPhysicalOf(a: CostAssumption[], items: CostItem[], secretedKg: number, recovery: number, inhouse: boolean) {
  const row = (r: string) => a.find((x) => x.roleKey === r);
  const v = (r: string) => Number.isFinite(row(r)?.value) ? Math.max(row(r)?.value ?? 0, 0) : 0;
  const enabled = fuelPhysicalOn(a);
  const roles = FUEL_PHYSICAL_ROLES.filter((r) => inhouse || !r.startsWith("fuel_physical_fame_"));
  const positive = ["fuel_physical_points", "fuel_physical_capacity", "fuel_physical_hours", "fuel_physical_life", "fuel_physical_heat_efficiency", "fuel_physical_fame_life"];
  const missing = enabled ? roles.filter((r) => !Number.isFinite(row(r)?.value) || (row(r)?.value ?? 0) < 0 || (positive.includes(r) && v(r) <= 0) || ((r === "fuel_physical_heat_efficiency" || r.startsWith("fuel_physical_recovery")) && v(r) > 100) || (r === "fuel_physical_hours" && v(r) > 24)) : [];
  const recoveredKg = enabled ? secretedKg * recovery : 0;
  const requiredPoints = Math.ceil(recoveredKg / Math.max(v("fuel_physical_capacity") * v("fuel_physical_hours") * v("culture_operating_days"), .001));
  const points = Math.max(Math.ceil(v("fuel_physical_points")), requiredPoints);
  const equipment = FUEL_PHYSICAL_EQUIPMENT.map((x) => ({ ...x, amount: enabled ? v(x.role) * points : 0 }));
  const recoveryCapex = equipment.reduce((n, x) => n + x.amount, 0);
  const fameCapex = enabled && inhouse ? v("fuel_physical_fame_capex") : 0;
  const capex = recoveryCapex + fameCapex;
  const capexAnnual = recoveryCapex / Math.max(v("fuel_physical_life"), 1) + fameCapex / Math.max(v("fuel_physical_fame_life"), 1);
  const powerKwh = recoveredKg * v("fuel_physical_power");
  const waterKg = recoveredKg * v("fuel_physical_water");
  const heatMj = waterKg * v("fuel_physical_heat_per_water") / Math.max(v("fuel_physical_heat_efficiency") / 100, .001);
  const electricityPrice = items.find((x) => x.strain === "secreting" && /溶媒の循環/.test(x.leafLabel ?? ""))?.unitPrice ?? 0;
  const heatPrice = items.find((x) => x.strain === "secreting" && /酸析のための加温/.test(x.leafLabel ?? ""))?.unitPrice ?? 0;
  const maintenanceAnnual = enabled ? v("fuel_physical_annual") * points + fameCapex * v("fuel_physical_fame_maintenance_percent") / 100 : 0;
  const consumablesAnnual = recoveredKg * v("fuel_physical_consumables");
  const powerAnnual = powerKwh * electricityPrice, heatAnnual = heatMj * heatPrice;
  if (enabled && (!electricityPrice || !heatPrice)) missing.push("physical_utility_prices");
  const costs = [
    ...equipment.map((x) => ({ role: x.role, label: `${x.label}の償却`, amount: x.amount / Math.max(v("fuel_physical_life"), 1), row: "capex" })),
    { role: "fuel_physical_fame_capex", label: "小規模FAME設備の追加償却", amount: fameCapex / Math.max(v("fuel_physical_fame_life"), 1), row: "capex" },
    { role: "fuel_physical_annual", label: "物理回収・追加FAME設備の保守", amount: maintenanceAnnual, row: "fixed" },
    { role: "fuel_physical_consumables", label: "物理回収のろ材・洗浄・廃棄", amount: consumablesAnnual, row: "variable" },
    { role: "fuel_physical_power", label: "物理回収・脱水の追加電力", amount: powerAnnual, row: "variable" },
    { role: "fuel_physical_water", label: "回収物の脱水・乾燥の熱", amount: heatAnnual, row: "variable" },
  ];
  return { enabled, valid: missing.length === 0, missing, points, requiredPoints, recoveredKg, equipment, recoveryCapex, fameCapex, capex, capexAnnual, powerKwh, waterKg, heatMj, maintenanceAnnual, consumablesAnnual, powerAnnual, heatAnnual, costs, electricityPrice, heatPrice };
}
