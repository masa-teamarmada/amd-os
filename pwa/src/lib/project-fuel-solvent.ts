import type { CostAssumption, CostItem } from "./project-cost-model.ts";

export const FUEL_SOLVENT_CHOICES = [{ value: "loop", label: "循環回収（設計仮説）" }, { value: "overlay", label: "全槽で保持（比較）" }];
export const FUEL_SOLVENT_EQUIPMENT = [
  { role: "fuel_solvent_contact_capex", label: "既存接触部の改造・分配器" },
  { role: "fuel_solvent_pump_capex", label: "追加の溶媒用ポンプ" },
  { role: "fuel_solvent_pipe_capex", label: "戻り配管・弁・受け皿" },
  { role: "fuel_solvent_control_capex", label: "液面・漏れ検知と制御追加" },
  { role: "fuel_solvent_install_capex", label: "取付・接続・試運転" },
  { role: "fuel_solvent_capacity_capex", label: "既存能力の不足分を補う設備" },
];
export const FUEL_SOLVENT_ROLES = [...FUEL_SOLVENT_EQUIPMENT.map((x) => x.role),"fuel_solvent_mode", "fuel_solvent_overlay_percent", "fuel_solvent_net_loading", "fuel_solvent_cycle_minutes", "fuel_solvent_buffer_m3", "fuel_solvent_hours_day", "fuel_solvent_density", "fuel_solvent_loss_percent", "fuel_solvent_water_drop", "fuel_solvent_water_power", "fuel_solvent_organic_power", "fuel_solvent_strip_power", "fuel_solvent_loop_capex", "fuel_solvent_loop_life", "fuel_solvent_loop_annual", "fuel_solvent_funding_rate"];
export function fuelSolventLoopOn(a: CostAssumption[]) {
  return a.some((x) => x.roleKey === "fuel_solvent_mode" && x.valueText === "loop") && a.some((x) => x.roleKey === "fuel_culture_source" && x.valueText === "inventory") && a.some((x) => x.roleKey === "lipid_secreting_strain" && x.valueText === "on");
}
export function fuelSolventItemKind(item: Pick<CostItem, "strain" | "leafLabel">) {
  if (item.strain !== "secreting") return null;
  if (/溶媒.*補給/.test(item.leafLabel ?? "")) return "makeup";
  if (/溶媒の循環/.test(item.leafLabel ?? "")) return "power";
  return null;
}
export function fuelSolventReplaces(item: Pick<CostItem, "strain" | "leafLabel">, a: CostAssumption[]) {
  return fuelSolventLoopOn(a) && fuelSolventItemKind(item) !== null;
}

/** 設計用の物質収支。濃度差・滞留時間・機器予算は株別実測/見積で更新する。 */
export function fuelSolventOf(a: CostAssumption[], items: CostItem[], annualKg: number, days: number, cultureM3: number) {
  const row = (r: string) => a.find((x) => x.roleKey === r);
  const v = (r: string) => Number.isFinite(row(r)?.value) ? Math.max(row(r)?.value ?? 0, 0) : 0;
  const enabled = !!row("fuel_solvent_mode") && row("fuel_culture_source")?.valueText === "inventory" && row("lipid_secreting_strain")?.valueText === "on";
  const loop = enabled && row("fuel_solvent_mode")?.valueText === "loop";
  const itemized = !!row("fuel_solvent_contact_capex");
  const roles = enabled ? loop ? FUEL_SOLVENT_ROLES.filter((r) => r !== "fuel_solvent_mode" && r !== "fuel_solvent_overlay_percent" && (itemized ? r !== "fuel_solvent_loop_capex" : !FUEL_SOLVENT_EQUIPMENT.some((x) => x.role === r))) : ["fuel_solvent_overlay_percent", "fuel_solvent_density", "fuel_solvent_funding_rate"] : [];
  const positive = ["fuel_solvent_net_loading", "fuel_solvent_cycle_minutes", "fuel_solvent_hours_day", "fuel_solvent_density", "fuel_solvent_water_drop", "fuel_solvent_loop_life"];
  const missing = roles.filter((r) => !Number.isFinite(row(r)?.value) || (row(r)?.value ?? 0) < 0 || (positive.includes(r) && v(r) <= 0) || (r === "fuel_solvent_hours_day" && v(r) > 24) || ((r === "fuel_solvent_loss_percent" || r === "fuel_solvent_overlay_percent") && v(r) > 100));
  const solventPrice = items.find((x) => fuelSolventItemKind(x) === "makeup")?.unitPrice ?? 0;
  const electricityPrice = items.find((x) => fuelSolventItemKind(x) === "power")?.unitPrice ?? 0;
  if (enabled && !items.some((x) => fuelSolventItemKind(x) === "makeup")) missing.push("solvent_price_source");
  if (loop && !items.some((x) => fuelSolventItemKind(x) === "power")) missing.push("solvent_power_source");
  const active = enabled && annualKg > 0 && missing.length === 0 && days > 0;
  const hours = days * v("fuel_solvent_hours_day");
  const solventM3Year = active && loop ? annualKg / v("fuel_solvent_net_loading") : 0;
  const waterM3Year = active && loop ? annualKg / (v("fuel_solvent_water_drop") / 1000) : 0;
  const solventM3Hour = hours > 0 ? solventM3Year / hours : 0;
  const waterM3Hour = hours > 0 ? waterM3Year / hours : 0;
  const stockM3 = active ? loop ? solventM3Hour * v("fuel_solvent_cycle_minutes") / 60 + v("fuel_solvent_buffer_m3") : cultureM3 * v("fuel_solvent_overlay_percent") / 100 : 0;
  const workingCapital = stockM3 * v("fuel_solvent_density") * solventPrice;
  const makeupKgYear = solventM3Year * v("fuel_solvent_density") * Math.min(v("fuel_solvent_loss_percent"), 100) / 100;
  const powerKwhYear = loop && active ? waterM3Year * v("fuel_solvent_water_power") + solventM3Year * v("fuel_solvent_organic_power") + annualKg * v("fuel_solvent_strip_power") : 0;
  const equipment = itemized ? FUEL_SOLVENT_EQUIPMENT.map((x) => ({ ...x, amount: v(x.role) })) : [{ role: "fuel_solvent_loop_capex", label: "循環回収の追加装置一式", amount: v("fuel_solvent_loop_capex") }];
  const capex = loop && enabled ? equipment.reduce((n, x) => n + x.amount, 0) : 0;
  const capexAnnual = capex / Math.max(v("fuel_solvent_loop_life"), 1);
  const makeupAnnual = makeupKgYear * solventPrice;
  const powerAnnual = powerKwhYear * electricityPrice;
  const maintenanceAnnual = loop && enabled ? v("fuel_solvent_loop_annual") : 0;
  const fundingAnnual = workingCapital * v("fuel_solvent_funding_rate") / 100;
  const costs = [
    ...equipment.map((x) => ({ role: x.role, label: `${x.label}の償却`, amount: loop && enabled ? x.amount / Math.max(v("fuel_solvent_loop_life"), 1) : 0, row: "capex" })),
    { role: "fuel_solvent_loss_percent", label: "循環回収の溶媒補給", amount: makeupAnnual, row: "variable" },
    { role: "fuel_solvent_water_power", label: "循環送液・回収の電力", amount: powerAnnual, row: "variable" },
    { role: "fuel_solvent_loop_annual", label: "循環回収の追加保守・交換", amount: maintenanceAnnual, row: "fixed" },
    { role: "fuel_solvent_funding_rate", label: "初回溶媒の資金コスト（比較用）", amount: fundingAnnual, row: "fixed" },
  ];
  return { enabled, loop, equipment, itemized, valid: missing.length === 0, missing, solventM3Year, waterM3Year, solventM3Hour, waterM3Hour, stockM3, workingCapital, makeupKgYear, powerKwhYear, capex, capexAnnual, makeupAnnual, powerAnnual, maintenanceAnnual, fundingAnnual, costs, solventPrice, electricityPrice };
}
