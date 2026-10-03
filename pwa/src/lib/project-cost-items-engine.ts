// コスト試算の標準フォーマット（spec 3-23 §7）の汎用の計算。明細・作業から1単位あたりの原価を出す。
//
// SX の廃液処理（二段階の菌体の原価）と燃料（収率から1Lに要る菌体）は、それぞれの計算エンジン
// （project-cost-model.ts / project-fuel-cost-model.ts）を使う。それ以外の試算（CX の冷凍機1台、
// LiSTie の膜＋電力など）はこの計算を使う。ここは純関数だけを置く。DB アクセスも React も持たない。
//
// 1単位あたりの原価 = 1単位あたりの明細
//                   ＋ (年額の明細 ＋ 設備の初期投資 ÷ 耐用年数 ＋ 作業の年額) ÷ 年間の量
//
// 前提（role_key）:
//   sale_price              売価（円/単位）
//   business_annual_volume  年間の量（単位/年）。1単位あたりに割る分母
//   labor_rate              作業単価（円/時）。作業は 年間回数 ×（1回の工数 × 作業単価 ＋ 1回の経費）
//   compare_volumes         比べる年間の量（value_text に「2:2028年の計画,12:2031年の計画」のように並べる）
//
// 明細の basis:
//   毎m³比例（DB の値。画面では「1単位あたり」）・バッチ連動 … 1単位あたり = 数量 × 単価
//   年額固定 … 年額 = 数量 × 単価 × 年の回数
//   初期投資配賦（CAPEX）… 年額 = 数量 × 単価 ÷ 耐用年数
//   内訳・参考 … 計算に入れない（読むだけ）
// 作業の count_driver:
//   fixed … 年間回数をそのまま使う / batch … 1単位ごとに1回（年間の量と同じ回数）

import { quantityPriceTerms, type CalcSegment, type ItemCalc } from "./cost-item-calc.ts";
import type { CostAssumption, CostItem, CostModelBundle, CostTask } from "./project-cost-model.ts";
import { COST_BREAKDOWN_ROWS, type CostBreakdownRowKey } from "./project-formats.ts";

/** この計算が読む前提。ここに無い前提は画面の「計算に使っていない前提（参考）」に出す。 */
export const ITEMS_ENGINE_ROLES = new Set(["sale_price", "business_annual_volume", "labor_rate", "compare_volumes"]);

export interface ItemsVolumeCase {
  /** 量そのものの文字列（ケースの識別子）。 */
  key: string;
  volume: number;
  label: string;
}

export interface ItemsLine {
  id: string;
  entity: "item" | "task";
  costType: "CAPEX" | "OPEX";
  row: CostBreakdownRowKey;
  /** 操作パネルの小分け（明細は group_label、作業は「作業」）。 */
  group: string;
  label: string;
  /** 1単位あたり（円/単位）。 */
  perUnit: number;
  /** 年額（円/年）。1単位あたりの明細は 年間の量 × 1単位あたり。 */
  annual: number;
  /** CAPEX の初期投資（円）。OPEX と作業は 0。 */
  initial: number;
  /** 作業の年間工数（時間）。明細は 0。 */
  hours: number;
  /** 作業の年間回数。明細は 0。 */
  occurrences: number;
  /** 数量 × 単価 から右端の額までの式（画面の「計算」の行）。 */
  calc: ItemCalc;
  confidence: string | null;
  sourceKind: string | null;
  owner: string | null;
  note: string | null;
}

export interface ItemsResult {
  volume: number;
  salePrice: number;
  laborRate: number;
  lines: ItemsLine[];
  totalPerUnit: number;
  capexInitial: number;
  capexAnnual: number;
  opexAnnual: number;
  totalAnnual: number;
  hoursAnnual: number;
  revenueAnnual: number;
  profitPerUnit: number;
  profitAnnual: number;
  marginRate: number;
  byRow: Record<CostBreakdownRowKey, number>;
}

const ROW_KEYS = COST_BREAKDOWN_ROWS.map((r) => r.key) as CostBreakdownRowKey[];
const ROW_SET = new Set<string>(ROW_KEYS);

export function emptyRowAmounts(): Record<CostBreakdownRowKey, number> {
  return Object.fromEntries(ROW_KEYS.map((k) => [k, 0])) as Record<CostBreakdownRowKey, number>;
}

const safeDiv = (a: number, b: number) => (b === 0 || !Number.isFinite(b) ? 0 : a / b);

export function roleAssumption(assumptions: CostAssumption[], roleKey: string): CostAssumption | undefined {
  return assumptions.find((x) => x.roleKey === roleKey);
}

export function roleNumber(assumptions: CostAssumption[], roleKey: string, fallback: number): number {
  const a = roleAssumption(assumptions, roleKey);
  return a && a.value !== null && Number.isFinite(a.value) ? a.value : fallback;
}

/** 比べる年間の量。前提 compare_volumes（「量:呼び名」をカンマで並べる）に、前提の年間の量を足して量の小さい順に並べる。 */
export function itemsVolumeCases(assumptions: CostAssumption[]): ItemsVolumeCase[] {
  const base = roleNumber(assumptions, "business_annual_volume", 0);
  const raw = roleAssumption(assumptions, "compare_volumes")?.valueText ?? "";
  const cases: ItemsVolumeCase[] = [];
  for (const part of raw.split(/[,、，]/)) {
    const [v, ...rest] = part.split(/[:：]/);
    const volume = Number((v ?? "").replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(volume) || volume <= 0 || cases.some((c) => c.volume === volume)) continue;
    cases.push({ key: String(volume), volume, label: rest.join(":").trim() });
  }
  if (base > 0 && !cases.some((c) => c.volume === base)) cases.push({ key: String(base), volume: base, label: "前提の年間の量" });
  return cases.sort((a, b) => a.volume - b.volume);
}

/** 明細・作業を、標準の内訳の行のどれに入れるか。データの format_row があればそれ。無ければ種類から決める。 */
export function itemsRowOf(row: { formatRow?: string | null; costType?: string; entity: "item" | "task" }): CostBreakdownRowKey {
  if (row.formatRow && ROW_SET.has(row.formatRow)) return row.formatRow as CostBreakdownRowKey;
  if (row.entity === "task") return "labor";
  if (row.costType === "CAPEX") return "equipment";
  return "other";
}

/** 計算に入る明細か。参考・内訳の行は読むだけ。 */
export function itemCounts(item: Pick<CostItem, "costType" | "isBreakdown" | "basis">): boolean {
  return item.costType !== "参考" && !item.isBreakdown && item.basis !== "内訳";
}

export function itemsItemLabel(item: Pick<CostItem, "groupLabel" | "midLabel" | "leafLabel">): string {
  return [item.midLabel, item.leafLabel].filter(Boolean).join("・") || item.groupLabel || "明細";
}

function itemCalc(item: CostItem, volume: number, unit: string): { calc: ItemCalc; perUnit: number; annual: number; initial: number } {
  const base = quantityPriceTerms(item);
  const baseValue = item.quantity * item.unitPrice * (item.annualFactor || 1);
  if (item.costType === "CAPEX") {
    const life = item.usefulLifeYears && item.usefulLifeYears > 0 ? item.usefulLifeYears : 1;
    const initial = item.quantity * item.unitPrice;
    const annual = initial / life;
    const segments: CalcSegment[] = [
      { continues: false, terms: quantityPriceTerms({ ...item, annualFactor: 1 }), result: { value: initial, unit: "円", label: "初期投資" } },
      { continues: true, terms: [{ op: "÷", value: life, unit: "年", label: "耐用年数" }, { op: "÷", value: volume, unit: `${unit}/年`, label: "年間の量" }], result: { value: safeDiv(annual, volume), unit: `円/${unit}` } },
    ];
    return { calc: { price: null, segments, excluded: null }, perUnit: safeDiv(annual, volume), annual, initial };
  }
  if (item.basis === "年額固定") {
    const annual = baseValue;
    const segments: CalcSegment[] = [
      { continues: false, terms: base, result: { value: annual, unit: "円/年", label: "年額" } },
      { continues: true, terms: [{ op: "÷", value: volume, unit: `${unit}/年`, label: "年間の量" }], result: { value: safeDiv(annual, volume), unit: `円/${unit}` } },
    ];
    return { calc: { price: null, segments, excluded: null }, perUnit: safeDiv(annual, volume), annual, initial: 0 };
  }
  const perUnit = baseValue;
  const segments: CalcSegment[] = [{ continues: false, terms: base, result: { value: perUnit, unit: `円/${unit}` } }];
  return { calc: { price: null, segments, excluded: null }, perUnit, annual: perUnit * volume, initial: 0 };
}

function taskCalc(task: CostTask, volume: number, laborRate: number, unit: string) {
  const occurrences = task.countDriver === "batch" ? volume : task.countPerYear ?? 0;
  const hoursEach = task.hoursPerOccurrence ?? 0;
  const hours = hoursEach * occurrences;
  const annual = hours * laborRate + task.expensePerOccurrence * occurrences;
  const terms = [
    { op: null, value: occurrences, unit: "回/年", label: "年間回数" },
    { op: "×" as const, value: hoursEach, unit: "時間", label: "1回の工数" },
    { op: "×" as const, value: laborRate, unit: "円/時", label: "作業単価" },
  ];
  const segments: CalcSegment[] = [{ continues: false, terms, result: { value: hours * laborRate, unit: "円/年", label: "作業の年額" } }];
  if (task.expensePerOccurrence > 0) {
    segments.push({
      continues: true,
      terms: [{ op: "+", value: task.expensePerOccurrence * occurrences, unit: "円/年", label: "経費（1回の経費 × 年間回数）" }],
      result: { value: annual, unit: "円/年", label: "年額" },
    });
  }
  segments.push({ continues: true, terms: [{ op: "÷", value: volume, unit: `${unit}/年`, label: "年間の量" }], result: { value: safeDiv(annual, volume), unit: `円/${unit}` } });
  return { calc: { price: null, segments, excluded: null } as ItemCalc, occurrences, hours, annual, perUnit: safeDiv(annual, volume) };
}

/** 汎用の計算。volume を渡すと、その年間の量で割る（ケースの比較）。 */
export function computeItemsCost(
  bundle: Pick<CostModelBundle, "assumptions" | "items" | "tasks"> & { model?: { unitBasisLabel?: string | null } },
  volumeOverride?: number | null
): ItemsResult {
  const unit = bundle.model?.unitBasisLabel || "単位";
  const volume = volumeOverride && volumeOverride > 0 ? volumeOverride : roleNumber(bundle.assumptions, "business_annual_volume", 0);
  const salePrice = roleNumber(bundle.assumptions, "sale_price", 0);
  const laborRate = roleNumber(bundle.assumptions, "labor_rate", 0);
  const lines: ItemsLine[] = [];

  for (const item of bundle.items) {
    if (!itemCounts(item)) continue;
    const { calc, perUnit, annual, initial } = itemCalc(item, volume, unit);
    lines.push({
      id: item.costItemId,
      entity: "item",
      costType: item.costType === "CAPEX" ? "CAPEX" : "OPEX",
      row: itemsRowOf({ formatRow: item.formatRow ?? null, costType: item.costType, entity: "item" }),
      group: item.groupLabel ?? "明細",
      label: itemsItemLabel(item),
      perUnit,
      annual,
      initial,
      hours: 0,
      occurrences: 0,
      calc,
      confidence: item.confidence,
      sourceKind: item.sourceKind,
      owner: item.owner,
      note: item.note,
    });
  }

  for (const task of bundle.tasks ?? []) {
    const t = taskCalc(task, volume, laborRate, unit);
    lines.push({
      id: task.costTaskId,
      entity: "task",
      costType: "OPEX",
      row: itemsRowOf({ formatRow: task.formatRow ?? null, entity: "task" }),
      group: task.groupLabel ?? "作業",
      label: task.label,
      perUnit: t.perUnit,
      annual: t.annual,
      initial: 0,
      hours: t.hours,
      occurrences: t.occurrences,
      calc: t.calc,
      confidence: task.confidence,
      sourceKind: task.sourceKind,
      owner: task.owner,
      note: task.note,
    });
  }

  const byRow = emptyRowAmounts();
  for (const line of lines) byRow[line.row] += line.perUnit;
  const totalPerUnit = lines.reduce((s, l) => s + l.perUnit, 0);
  const capexInitial = lines.reduce((s, l) => s + l.initial, 0);
  const capexAnnual = lines.filter((l) => l.costType === "CAPEX").reduce((s, l) => s + l.annual, 0);
  const opexAnnual = lines.filter((l) => l.costType === "OPEX").reduce((s, l) => s + l.annual, 0);
  const hoursAnnual = lines.reduce((s, l) => s + l.hours, 0);
  const profitPerUnit = salePrice - totalPerUnit;
  return {
    volume,
    salePrice,
    laborRate,
    lines,
    totalPerUnit,
    capexInitial,
    capexAnnual,
    opexAnnual,
    totalAnnual: capexAnnual + opexAnnual,
    hoursAnnual,
    revenueAnnual: salePrice * volume,
    profitPerUnit,
    profitAnnual: profitPerUnit * volume,
    marginRate: salePrice > 0 ? profitPerUnit / salePrice : 0,
    byRow,
  };
}
