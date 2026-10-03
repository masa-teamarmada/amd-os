// コスト試算タブの標準フォーマット（spec 3-23 §7、定義は src/lib/project-formats.ts）へデータを流し込む。
//
// 2026-10-03 まさ確定「原価計算は、フォーマットは共通させることを前提にcxのもちゃんと入れて」。
// どの計算（エンジン）で出すかは、データの形（project_cost_models.case_kind と明細・作業の有無）だけで決める。PJ番号では分けない。
//   biodiesel                         … 燃料の計算（project-fuel-cost-model.ts）。SX の燃料の試算
//   multi / dye_degradation / metal_recovery … 廃液処理の二段階の計算（project-cost-model.ts）。SX の廃液の試算
//   other（明細か作業がある）         … 汎用の計算（project-cost-items-engine.ts）。標準フォーマットの画面で描く
// SX の2つは、切り替えと式の説明が多いため、標準フォーマットの画面への移行は次の段（spec 3-23 §7「統一の残り」）。
// ここは純関数だけを置く。

import type { CostAssumption, CostItem, CostModelBundle, CostTask } from "./project-cost-model.ts";
import {
  COST_BREAKDOWN_ROWS,
  COST_INPUT_BLOCKS,
  type CostBreakdownRowKey,
  type CostInputBlockKey,
} from "./project-formats.ts";
import { ITEMS_ENGINE_ROLES, itemCounts, type ItemsLine, type ItemsResult } from "./project-cost-items-engine.ts";

export type CostFormatEngine = "items" | "wastewater" | "fuel";

const WASTEWATER_CASE_KINDS = new Set(["multi", "dye_degradation", "metal_recovery"]);

/** データの形から計算を選ぶ。読めない形（明細も作業も無い other）は null。 */
export function costFormatEngineOf(bundle: Pick<CostModelBundle, "model" | "items" | "tasks"> | null): CostFormatEngine | null {
  if (!bundle) return null;
  const kind = bundle.model.caseKind as string;
  if (kind === "biodiesel") return "fuel";
  if (WASTEWATER_CASE_KINDS.has(kind)) return "wastewater";
  if (bundle.items.some((i) => itemCounts(i)) || (bundle.tasks ?? []).length > 0) return "items";
  return null;
}

export const COST_ROW_BY_KEY = new Map(COST_BREAKDOWN_ROWS.map((r) => [r.key as CostBreakdownRowKey, r]));

export interface CostFormatInputGroup {
  key: string;
  block: CostInputBlockKey;
  title: string;
  hint: string;
  assumptions: CostAssumption[];
  items: CostItem[];
  tasks: CostTask[];
  /** 総コスト目標の行をこの小分けに置くか。 */
  target: boolean;
}

/** 条件の小分けに置く前提（表示順）。 */
const CONDITION_ROLES = ["business_annual_volume", "sale_price"];

/**
 * 前提・明細・作業を、条件・CAPEX・OPEX の3つに分け、その中を明細の group_label で小分けにする（2026-09-14 まさ確定の並べ方）。
 * 作業は OPEX の「作業（人件費）」に、作業単価と一緒に置く。
 */
export function costFormatInputGroups(bundle: Pick<CostModelBundle, "assumptions" | "items" | "tasks">): CostFormatInputGroup[] {
  const groups: CostFormatInputGroup[] = [];
  const role = (key: string) => bundle.assumptions.find((a) => a.roleKey === key);
  const conditions = CONDITION_ROLES.map(role).filter((a): a is CostAssumption => !!a);
  groups.push({
    key: "cond-scale",
    block: "conditions",
    title: "量と売価",
    hint: "年間の量で、設備の償却・年額の費用・作業を1単位あたりに割る。売価との差が1単位あたりの利益",
    assumptions: conditions,
    items: [],
    tasks: [],
    target: true,
  });
  const counted = bundle.items.filter((i) => itemCounts(i));
  for (const block of ["capex", "opex"] as const) {
    const rows = counted.filter((i) => (block === "capex" ? i.costType === "CAPEX" : i.costType !== "CAPEX"));
    const labels = [...new Set(rows.map((i) => i.groupLabel ?? "明細"))];
    labels.forEach((label, index) => {
      groups.push({
        key: `${block}-${index + 1}`,
        block,
        title: label,
        hint:
          block === "capex"
            ? "初期投資 ÷ 耐用年数 ÷ 年間の量 が1単位あたりの償却"
            : "1単位あたりの明細は 数量 × 単価。年額の明細は年間の量で割る",
        assumptions: [],
        items: rows.filter((i) => (i.groupLabel ?? "明細") === label),
        tasks: [],
        target: false,
      });
    });
  }
  const laborRate = role("labor_rate");
  const tasks = bundle.tasks ?? [];
  if (tasks.length > 0 || laborRate) {
    groups.push({
      key: "opex-labor",
      block: "opex",
      title: "作業（人件費）",
      hint: "作業単価は共通の1つ。年額 ＝ 年間回数 ×（1回の工数 × 作業単価 ＋ 1回の経費）",
      assumptions: laborRate ? [laborRate] : [],
      items: [],
      tasks,
      target: false,
    });
  }
  return groups;
}

export function costFormatBlockTitle(block: CostInputBlockKey): string {
  return COST_INPUT_BLOCKS.find((b) => b.key === block)?.label ?? block;
}

/** 計算に使っていない前提（参考として残している）。 */
export function unusedAssumptions(bundle: Pick<CostModelBundle, "assumptions">): CostAssumption[] {
  return bundle.assumptions.filter((a) => !a.roleKey || !ITEMS_ENGINE_ROLES.has(a.roleKey));
}

/** 行の小分け（操作パネルの移り先）。 */
export function groupKeyOfLine(groups: CostFormatInputGroup[], line: Pick<ItemsLine, "entity" | "id">): string | null {
  for (const g of groups) {
    if (line.entity === "item" && g.items.some((i) => i.costItemId === line.id)) return g.key;
    if (line.entity === "task" && g.tasks.some((t) => t.costTaskId === line.id)) return g.key;
  }
  return null;
}

export interface CostFormatBreakdownRow {
  key: CostBreakdownRowKey;
  label: string;
  shortLabel: string;
  color: string;
  hint: string;
  amount: number;
  share: number;
  parts: Array<{ label: string; amount: number; groupKey: string | null }>;
}

/** 標準の内訳の行（全行。額が0の行も並びを保つために返す）。 */
export function costFormatBreakdown(result: ItemsResult, groups: CostFormatInputGroup[]): CostFormatBreakdownRow[] {
  const total = result.totalPerUnit;
  return COST_BREAKDOWN_ROWS.map((row) => {
    const lines = result.lines.filter((l) => l.row === row.key).sort((a, b) => b.perUnit - a.perUnit);
    const amount = lines.reduce((s, l) => s + l.perUnit, 0);
    return {
      key: row.key,
      label: row.label,
      shortLabel: row.shortLabel,
      color: row.color,
      hint: row.hint,
      amount,
      share: total > 0 ? amount / total : 0,
      parts: lines.map((l) => ({ label: l.label, amount: l.perUnit, groupKey: groupKeyOfLine(groups, l) })),
    };
  });
}

export type CostFormatStatus = { label: "赤字" | "上限超" | "目標超" | "目標内" | "黒字" | "売価未登録"; tone: "bad" | "warn" | "ok" | "none" };

/** 総コストが売価・目標のどこにあるか。色だけで伝えず、必ず言葉を添える（SX の試算と同じ決まり）。 */
export function costFormatStatus(total: number, price: number, target: number | null, marginRate: number | null): CostFormatStatus {
  // 売価も目標も無い試算（部分試算など）は、黒字・赤字を言わない。
  if (!(price > 0) && target === null) return { label: "売価未登録", tone: "none" };
  const allowed = marginRate !== null && marginRate > 0 ? price * (1 - marginRate) : price;
  if (price > 0 && total > allowed) return { label: marginRate !== null && marginRate > 0 ? "上限超" : "赤字", tone: "bad" };
  if (target !== null && total > target) return { label: "目標超", tone: "warn" };
  return { label: target !== null ? "目標内" : "黒字", tone: "ok" };
}

export interface CostFormatConfidenceSlice {
  grade: string;
  amount: number;
  share: number;
}

const CONFIDENCE_ORDER = ["S", "A", "B", "C", "H", "未設定"];

/** 総コストのうち、確度ごとの額。 */
export function costFormatConfidence(result: ItemsResult): CostFormatConfidenceSlice[] {
  const total = result.totalPerUnit;
  const m = new Map<string, number>();
  for (const l of result.lines) m.set(l.confidence ?? "未設定", (m.get(l.confidence ?? "未設定") ?? 0) + l.perUnit);
  return CONFIDENCE_ORDER.filter((g) => (m.get(g) ?? 0) > 0).map((g) => ({ grade: g, amount: m.get(g) ?? 0, share: total > 0 ? (m.get(g) ?? 0) / total : 0 }));
}

/** 精度を下げている行（確度が C・H・未設定の行を額の大きい順に）。 */
export function costFormatUncertain(result: ItemsResult, limit = 10): ItemsLine[] {
  return result.lines
    .filter((l) => l.confidence === null || l.confidence === "C" || l.confidence === "H")
    .sort((a, b) => b.perUnit - a.perUnit)
    .slice(0, limit);
}
