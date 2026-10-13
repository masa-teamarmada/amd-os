/** 競合工程の比較用前提。SOLの原価・料金・菌体量の計算とは独立した登録資料。 */
export type CostRange = [number, number];

export interface CostComparisonMethod {
  key: string;
  label: string;
  steps: string[];
  drivers: string[];
  equipmentNote: string;
}

export interface CostComparisonScenario {
  methodKey: string;
  capexYen: CostRange;
  opexPerM3: CostRange;
  note: string;
}

export interface CostComparisonIndustry {
  key: string;
  label: string;
  influent: string;
  pretreatment: string[];
  baseCapexYen: CostRange;
  baseOpexPerM3: CostRange;
  basisNote: string;
  scenarios: CostComparisonScenario[];
  doses: Array<{ label: string; value: string }>;
}

export interface CostComparison {
  schemaVersion: 1;
  ownTabLabel: string;
  title: string;
  asOf: string;
  summary: string;
  basis: { dailyVolumeM3: number; operatingDays: number; allocationYears: number; note: string };
  methods: CostComparisonMethod[];
  industries: CostComparisonIndustry[];
  unitPrices: Array<{ label: string; value: number; unit: string; note: string }>;
  capexIncludes: string[];
  opexIncludes: string[];
  unpriced: string[];
  limits: string[];
  sources: Array<{ id: string; title: string; url: string; published: string; observed: string; usage: string }>;
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const range = (v: unknown): v is CostRange => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0) && v[0] <= v[1];
const list = (v: unknown, check: (row: Record<string, unknown>) => boolean): boolean => Array.isArray(v) && v.length > 0 && v.every((row) => object(row) && check(row));

/** 旧データ・未登録・不正な比較データが既存の試算を停止させないよう、入口で検証する。 */
export function readCostComparison(value: unknown): CostComparison | null {
  if (!object(value) || value.schemaVersion !== 1 || !text(value.ownTabLabel) || !text(value.title) || !text(value.asOf) || !text(value.summary)) return null;
  const basis = value.basis;
  if (!object(basis) || !positive(basis.dailyVolumeM3) || !positive(basis.operatingDays) || !positive(basis.allocationYears) || !text(basis.note)) return null;
  if (!list(value.methods, (m) => text(m.key) && text(m.label) && strings(m.steps) && strings(m.drivers) && text(m.equipmentNote))) return null;
  const methods = value.methods as unknown as CostComparisonMethod[];
  const methodKeys = new Set(methods.map((m) => m.key));
  if (methodKeys.size !== methods.length) return null;
  if (!list(value.industries, (i) => text(i.key) && text(i.label) && text(i.influent) && strings(i.pretreatment) && range(i.baseCapexYen) && range(i.baseOpexPerM3) && text(i.basisNote)
    && list(i.scenarios, (s) => text(s.methodKey) && methodKeys.has(s.methodKey) && range(s.capexYen) && range(s.opexPerM3) && text(s.note))
    && list(i.doses, (d) => text(d.label) && text(d.value)))) return null;
  const industries = value.industries as unknown as CostComparisonIndustry[];
  if (new Set(industries.map((i) => i.key)).size !== industries.length || industries.some((i) => new Set(i.scenarios.map((s) => s.methodKey)).size !== i.scenarios.length)) return null;
  if (!list(value.unitPrices, (p) => text(p.label) && positive(p.value) && text(p.unit) && text(p.note))) return null;
  if (![value.capexIncludes, value.opexIncludes, value.unpriced, value.limits].every(strings)) return null;
  if (!list(value.sources, (s) => text(s.id) && text(s.title) && text(s.published) && text(s.observed) && text(s.usage) && text(s.url) && /^https:\/\//.test(s.url))) return null;
  return value as unknown as CostComparison;
}

const add = (a: CostRange, b: CostRange): CostRange => [a[0] + b[0], a[1] + b[1]];
const multiply = (a: CostRange, factor: number): CostRange => [a[0] * factor, a[1] * factor];

/** 前段と脱色工程をそれぞれ一度だけ計上。結果をDBへ保存しない。 */
export function computeCostComparison(comparison: CostComparison, industry: CostComparisonIndustry, scenario: CostComparisonScenario) {
  const { dailyVolumeM3, operatingDays, allocationYears } = comparison.basis;
  const annualVolumeM3 = dailyVolumeM3 * operatingDays;
  if (!positive(annualVolumeM3) || !positive(allocationYears)) return null;
  const capexYen = add(industry.baseCapexYen, scenario.capexYen);
  const opexPerM3 = add(industry.baseOpexPerM3, scenario.opexPerM3);
  const annualOpexYen = multiply(opexPerM3, annualVolumeM3);
  const allocatedCapexPerM3 = multiply(capexYen, 1 / allocationYears / annualVolumeM3);
  const totalPerM3 = add(allocatedCapexPerM3, opexPerM3);
  return { annualVolumeM3, capexYen, opexPerM3, annualOpexYen, allocatedCapexPerM3, totalPerM3 };
}
