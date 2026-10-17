import type { CostAssumption, CostItem } from "./project-cost-model.ts";

export const CULTURE_LIGHT_CHOICES = [{ value: "sunlight", label: "太陽光主体" }, { value: "led", label: "人工照明" }];
export const CULTURE_LIGHT_ROLES = ["culture_light_source", "culture_sunlight_productivity_ratio"];
export function cultureLightOf(a: CostAssumption[]) {
  const source: "sunlight" | "led" = a.find((x) => x.roleKey === "culture_light_source")?.valueText === "sunlight" ? "sunlight" : "led";
  const ratio = a.find((x) => x.roleKey === "culture_sunlight_productivity_ratio")?.value;
  const productivityFactor = source === "sunlight" ? Math.max(Math.min(typeof ratio === "number" && Number.isFinite(ratio) ? ratio : 50, 100), 0.1) / 100 : 1;
  return { source, productivityFactor };
}
export function cultureLightingExcluded(item: Pick<CostItem, "scenario" | "midLabel" | "leafLabel">, a: CostAssumption[]) {
  return cultureLightOf(a).source === "sunlight" && item.scenario === "中央培養" && /LED|照明/.test(`${item.midLabel ?? ""} ${item.leafLabel ?? ""}`);
}
