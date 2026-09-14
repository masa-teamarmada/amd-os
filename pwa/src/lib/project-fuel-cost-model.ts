// PJコックピット「事業計画」グループの「コスト試算（燃料）」タブの計算エンジン。
//
// 排水処理の「コスト試算」タブ (project-cost-model.ts) と同じテーブル (project_cost_*) に、
// case_kind = 'biodiesel' の試算として載せる (まさ 2026-09-14「OSの技術ページに、新たに『コスト試算（燃料）』を追加してほしい。
// 廃液処理のコスト試算と同様にバイオディーゼル事業のコスト試算シートを作ってほしい」)。
// ここは純関数だけを置く。DB アクセスも React も持たない。
//
// 何を計算するか:
//   シアノバクテリアを燃料のために培養し、脱水して細胞の中の油を回収し、FAME (バイオディーゼル) にして売るときの、燃料1Lあたりの総コスト。
//   第1段 菌体の原価 (円/kg-DCW) … 培養設備1系列の明細と作業から。年に要る菌体の量に合わせて系列を並べる (排水処理の試算と同じ形)
//   第2段 燃料1Lあたりの総コスト … 菌体費 (第1段 × 1Lに要る菌体) ＋ 脱水・油回収 ＋ FAMEにする ＋ 残渣の処理 ＋ 品質確認・出荷 ＋ 燃料化設備の償却
//
// 1Lに要る菌体 (kg-DCW/L) = 燃料の密度 ÷ (FAMEポテンシャル × 菌体回収率 × 脂質抽出回収率 × メチル化反応率 × FAME精製回収率)
//   収率は 2026-09-07 の「シアノ→FAME→SAF 工程とマテバラ推定」の3ケース (低位 / 基準 / 改善) をそのまま前提に持つ。
//   基準の前提 role_key が基準、`_low` / `_high` を付けた role_key が低位 / 改善。無いケースは基準の値を使う。
//
// 年に要る菌体の量は入力ではなく計算で出す (排水処理の試算で まさ 2026-09-14「年間の生産能力は入力値じゃなくて計算結果にしてほしい」)。
//   入力は年間の燃料の量 (事業全体、L/年)。年に要る菌体 = 年間の燃料の量 × 1Lに要る菌体。
//   培養設備の系列数 = 年に要る菌体 ÷ 1系列の年間生産能力、燃料化設備の系列数 = 年に要る菌体 ÷ 1系列で処理できる菌体の量。
//   設備の償却・年額固定費・系列ごとの作業は系列の数だけ増える。量産でまとめて買う値下がりは入れていない。
//
// 切り替えは2つ。
//   FAME転換 … 外部に委託 (事業概要 2026-09-03 の分担「自社工程: 培養・濃縮・脱水・油回収／外部精製: FAME転換」) / 自社で行う
//   収率     … 低位 / 基準 / 改善
// 明細・作業の scenario で、どちらのFAME転換のときに効くかを持つ (fuelScopesFor)。
//   中央培養 = 培養設備 (第1段) / 共通 = 燃料化の工場 (どちらでも) / 外部委託 = 委託するときだけ / 自社精製 = 自社で行うときだけ
//   DB の値 '中央培養' は排水処理の試算と共通の値で、画面では「培養設備」と書く。
//
// 燃料の試算の作業はすべて SX がやり、費用はすべて SX が持つ。委託するときは委託費を SX が払う (委託先の作業時間は数えない)。
// 作業単価は前提の共通の作業単価 (labor_rate) の1つだけ (排水処理の試算で まさ 2026-09-14「工数単価は共通で１つのパラメータで」)。

import type {
  CostAssumption,
  CostConfidence,
  CostItem,
  CostModel,
  CostModelBundle,
  CostTask,
} from "./project-cost-model.ts";
import { quantityPriceTerms, type CalcSegment, type ItemCalc } from "./cost-item-calc.ts";

/** 燃料の試算の case_kind。排水処理のタブはこの試算を読まない。 */
export const FUEL_CASE_KIND = "biodiesel";

export function isFuelModel(model: Pick<CostModel, "caseKind"> | null | undefined): boolean {
  return (model?.caseKind as string | undefined) === FUEL_CASE_KIND;
}

export type FuelYieldCase = "low" | "base" | "high";
export const FUEL_YIELD_CASES: FuelYieldCase[] = ["low", "base", "high"];
export const FUEL_YIELD_CASE_LABEL: Record<FuelYieldCase, string> = { low: "低位", base: "基準", high: "改善" };
export const FUEL_YIELD_CASE_DESCRIPTION: Record<FuelYieldCase, string> = {
  low: "工程とマテバラ推定（2026-09-07）の低位の仮定。油が少なく、回収でも失う側",
  base: "工程とマテバラ推定（2026-09-07）の基準の仮定",
  high: "工程とマテバラ推定（2026-09-07）の改善の仮定。油が多く、回収で失わない側",
};
/** 収率の前提の role_key に付ける、ケースごとの接尾辞。基準は接尾辞なし。 */
const YIELD_SUFFIX: Record<FuelYieldCase, string> = { low: "_low", base: "", high: "_high" };

export type FuelConversion = "outsourced" | "inhouse";
export const FUEL_CONVERSIONS: FuelConversion[] = ["outsourced", "inhouse"];
export const FUEL_CONVERSION_LABEL: Record<FuelConversion, string> = { outsourced: "外部に委託", inhouse: "自社で行う" };
export const FUEL_CONVERSION_DESCRIPTION: Record<FuelConversion, string> = {
  outsourced: "SXは培養から油の回収（原料油）までを行い、FAMEへの転換と精製は外部の精製事業者に委託して委託費を払う",
  inhouse: "油の回収に続けて、メタノールでFAMEに転換し、精製するところまでSXの工場で行う",
};

/** 明細・作業が効く範囲 (DB の scenario の値)。 */
export type FuelScope = "中央培養" | "共通" | "外部委託" | "自社精製";
export const FUEL_SCOPES: FuelScope[] = ["中央培養", "共通", "外部委託", "自社精製"];
export const FUEL_SCOPE_LABEL: Record<FuelScope, string> = {
  中央培養: "培養設備（菌体をつくる）",
  共通: "燃料化の工場（委託でも自社でも）",
  外部委託: "FAME転換を外部に委託するときだけ",
  自社精製: "FAME転換を自社で行うときだけ",
};
/** 画面での培養設備の呼び名。DB の値 '中央培養' を画面に出さない。 */
export const FUEL_CULTURE_LABEL = "培養設備";
export const FUEL_PLANT_LABEL = "燃料化設備";

/** FAME転換の方法ごとに、どの範囲の明細・作業を数えるか。培養設備 (中央培養) は第1段で数える。 */
export function fuelScopesFor(conversion: FuelConversion): FuelScope[] {
  return ["共通", conversion === "outsourced" ? "外部委託" : "自社精製"];
}

/** 明細・作業の1行が、選んだFAME転換で発生するか。培養設備の行はいつも発生する。 */
export function fuelRowApplies(row: { scenario: string }, conversion: FuelConversion): boolean {
  return row.scenario === "中央培養" || (fuelScopesFor(conversion) as string[]).includes(row.scenario);
}

/** 作業の流れの段 (group_label)。この順に並べる。 */
export const FUEL_STEPS = ["菌体をつくる", "脱水・油回収", "FAMEにする", "残渣を処理する", "品質を確かめて出荷する"] as const;

/** 総コストの内訳の区分。並びは積み上げ棒と色の順 (排水処理の試算の色の順と同じ6色。隣り合う色の見分けは検査済み)。 */
export type FuelBreakdownKey = "biomass" | "recovery" | "conversion" | "residue" | "shipping" | "capex";
export const FUEL_BREAKDOWN_ORDER: FuelBreakdownKey[] = ["biomass", "recovery", "conversion", "residue", "shipping", "capex"];
export const FUEL_BREAKDOWN_LABEL: Record<FuelBreakdownKey, string> = {
  biomass: "菌体費（培養）",
  recovery: "脱水・油回収",
  conversion: "FAMEにする",
  residue: "残渣の処理",
  shipping: "品質確認・出荷",
  capex: "燃料化設備の償却",
};
export const FUEL_BREAKDOWN_SHORT_LABEL: Record<FuelBreakdownKey, string> = {
  biomass: "菌体費",
  recovery: "油回収",
  conversion: "FAME化",
  residue: "残渣",
  shipping: "出荷",
  capex: "償却",
};
export const FUEL_BREAKDOWN_HINT: Record<FuelBreakdownKey, string> = {
  biomass: "第1段の菌体1kgの原価 × 燃料1Lに要る菌体。培養設備の償却・原料・作業を含む",
  recovery: "脱水・細胞の破砕・溶媒での油の抽出と溶媒の回収にかかる溶媒・電力・熱・保守と、その運転の作業",
  conversion: "委託するときは委託費と委託先までの原料油の輸送。自社で行うときはメタノール・触媒などの薬品・電力・熱・保守と運転の作業",
  residue: "油を取ったあとの残渣（菌体の大部分）を処理する費用",
  shipping: "品質の分析と、タンクローリーでの出荷",
  capex: "燃料化設備（脱水・油回収、自社で行うときはFAME転換も）の初期投資 ÷ 耐用年数。培養設備の償却は菌体費に入る",
};
const STEP_BREAKDOWN: Record<string, FuelBreakdownKey> = {
  "脱水・油回収": "recovery",
  "FAMEにする": "conversion",
  "残渣を処理する": "residue",
  "品質を確かめて出荷する": "shipping",
};

/** 明細・作業の1行を内訳のどの区分に入れるか。培養設備は菌体費、燃料化設備の CAPEX は償却、残りは段 (group_label) で決める。 */
export function fuelBreakdownKeyOf(row: { scenario: string; groupLabel: string | null; costType?: string }): FuelBreakdownKey {
  if (row.scenario === "中央培養") return "biomass";
  if (row.costType === "CAPEX") return "capex";
  return (row.groupLabel !== null && STEP_BREAKDOWN[row.groupLabel]) || "recovery";
}

/** 作業の年間回数の決め方 (燃料の試算で使うもの)。DB の count_driver の値。 */
export type FuelTaskDriver = "fixed" | "production_line" | "plant_line" | "truck_trip" | "batch";
export const FUEL_TASK_DRIVERS: FuelTaskDriver[] = ["fixed", "production_line", "plant_line", "truck_trip", "batch"];
export const FUEL_TASK_DRIVER_LABEL: Record<FuelTaskDriver, string> = {
  fixed: "固定の回数",
  production_line: "培養設備の系列ごと",
  plant_line: "燃料化設備の系列ごと",
  truck_trip: "出荷の台数",
  batch: "品質確認のロット数",
};
/** 回数を行に入れる決め方 (固定の回数と、1系列あたりの回数)。 */
export function fuelDriverUsesCount(driver: string): boolean {
  return driver === "fixed" || driver === "production_line" || driver === "plant_line";
}

/** 計算エンジンが読む role_key。操作パネルはこの前提だけを並べる。 */
export const FUEL_YIELD_ROLES = ["fame_potential", "harvest_recovery", "extraction_recovery", "methylation_rate", "purification_recovery"] as const;
export type FuelYieldRole = (typeof FUEL_YIELD_ROLES)[number];
export const FUEL_YIELD_ROLE_LABEL: Record<FuelYieldRole, string> = {
  fame_potential: "全菌体のFAMEポテンシャル",
  harvest_recovery: "菌体回収率",
  extraction_recovery: "脂質抽出回収率",
  methylation_rate: "メチル化反応率",
  purification_recovery: "FAME精製回収率",
};
/** 収率の前提の既定値 (%)。前提が無い試算でも落ちないように、マテバラ推定の基準で置く。 */
const YIELD_FALLBACK: Record<FuelYieldRole, number> = {
  fame_potential: 10,
  harvest_recovery: 95,
  extraction_recovery: 90,
  methylation_rate: 97,
  purification_recovery: 98,
};

/** 残渣の行き先。油を取ったあとの残渣は菌体の大部分なので、どう処理するかで燃料1Lあたりの桁が変わる。 */
export type FuelResidueRoute = "digestion" | "disposal";
export const FUEL_RESIDUE_ROUTE_LABEL: Record<FuelResidueRoute, string> = {
  digestion: "発酵などで処理",
  disposal: "産業廃棄物として処分",
};

/** 画面で選択肢から選ぶ前提 (value_text に入れる)。 */
export const FUEL_TEXT_CHOICE_ROLES: Record<string, Array<{ value: string; label: string }>> = {
  residue_route: [
    { value: "digestion", label: FUEL_RESIDUE_ROUTE_LABEL.digestion },
    { value: "disposal", label: FUEL_RESIDUE_ROUTE_LABEL.disposal },
  ],
};

export const FUEL_ROLE_KEYS = new Set<string>([
  "business_annual_volume",
  "sale_price",
  "fame_density",
  ...FUEL_YIELD_ROLES.flatMap((r) => [r, `${r}_low`, `${r}_high`]),
  "biomass_cost_per_kg_override",
  "culture_line_capacity_kg_year",
  "plant_line_capacity_kg_year",
  "labor_rate",
  "residue_dry_kg_per_kg_dcw",
  "residue_route",
  "residue_digestion_cost",
  "residue_wet_factor",
  "residue_disposal_price",
  "truck_capacity_l",
  "lot_size_l",
]);

/* ------------------------------------------------------------------ *
 * 前提・明細・作業の区分 (操作パネルと読み物で同じ並びにする)
 * 排水処理の試算で まさ 2026-09-14「CAPEXとOPEXに分けて、さらにそれぞれのサブグループに分けるなどして整理してほしい」
 * ------------------------------------------------------------------ */

export type FuelParamBlockKey = "conditions" | "capex" | "opex";
export interface FuelParamBlock {
  key: FuelParamBlockKey;
  title: string;
  hint: string;
}
export interface FuelParamGroup {
  key: string;
  block: FuelParamBlockKey;
  title: string;
  hint: string;
  /** この区分に並べる前提の role_key (表示順)。収率の区分は基準の role_key を並べ、低位・改善を横に出す。 */
  roles: string[];
  /** 作業リストをこの区分に出すか。 */
  tasks?: boolean;
}

export const FUEL_PARAM_BLOCKS: FuelParamBlock[] = [
  { key: "conditions", title: "事業と製造の条件", hint: "燃料の量と売価、菌体から燃料がどれだけ取れるか。CAPEX と OPEX を燃料1Lあたりに割る元になる数字" },
  { key: "capex", title: "CAPEX（初期投資）", hint: "培養設備と燃料化設備の初期投資。耐用年数で割って年額にし、必要な系列の数だけ並べる" },
  { key: "opex", title: "OPEX（毎年の費用）", hint: "人件費・培養の原料・溶媒と電力・FAMEにする費用・残渣の処理・品質確認と出荷など、毎年かかる費用" },
];

export const FUEL_PARAM_GROUPS: FuelParamGroup[] = [
  { key: "cond-scale", block: "conditions", title: "事業の規模と売価", hint: "事業全体の年間の燃料の量から、売上と、年に要る菌体の量・設備の系列数が決まる", roles: ["business_annual_volume", "sale_price"] },
  { key: "cond-yield", block: "conditions", title: "菌体から取れる燃料（収率）", hint: "低位・基準・改善の3ケース。掛け合わせて、燃料1Lに要る菌体の量が決まる", roles: [...FUEL_YIELD_ROLES, "fame_density"] },
  { key: "cond-biomass", block: "conditions", title: "菌体の原価", hint: "空欄なら培養設備の明細と作業から計算する", roles: ["biomass_cost_per_kg_override"] },
  { key: "capex-culture", block: "capex", title: "培養設備（菌体をつくる）", hint: "培養設備1系列の明細と、1系列で年に作れる菌体の量。年に要る菌体に合わせて系列を並べる", roles: ["culture_line_capacity_kg_year"] },
  { key: "capex-plant", block: "capex", title: "燃料化設備：脱水・油回収", hint: "燃料化設備1系列の明細と、1系列で処理できる菌体の量。委託でも自社でも要る", roles: ["plant_line_capacity_kg_year"] },
  { key: "capex-conversion", block: "capex", title: "燃料化設備：FAME転換（自社で行うときだけ）", hint: "FAMEへの転換と精製の設備。燃料化設備1系列あたり", roles: [] },
  { key: "capex-shipping", block: "capex", title: "燃料化設備：製品の貯蔵・出荷", hint: "FAMEの貯槽と出荷の設備。燃料化設備1系列あたり", roles: [] },
  { key: "opex-labor", block: "opex", title: "人件費（作業）", hint: "作業単価は共通の1つ。作業ごとに1回の工数・年間回数・1回の経費を入れる", roles: ["labor_rate"], tasks: true },
  { key: "opex-culture", block: "opex", title: "培養の原料・品質確認", hint: "培地・CO2・濃縮など菌体1kgあたりの費用と、培養設備1系列あたりの品質確認", roles: [] },
  { key: "opex-recovery", block: "opex", title: "脱水・油回収の溶媒・電力・熱・保守", hint: "菌体1kgあたりの溶媒の補給・電力・熱・水と、燃料化設備1系列あたりの保守", roles: [] },
  { key: "opex-outsourced", block: "opex", title: "FAME転換の委託（委託するときだけ）", hint: "燃料1Lあたりの委託費と、委託先までの原料油の輸送", roles: [] },
  { key: "opex-inhouse", block: "opex", title: "FAME転換の薬品・電力（自社で行うときだけ）", hint: "燃料1Lあたりのメタノール・触媒・中和剤・吸着剤・電力・熱と、燃料化設備1系列あたりの保守", roles: [] },
  { key: "opex-residue", block: "opex", title: "残渣の処理", hint: "油を取ったあとの残渣の量と行き先。産業廃棄物として処分すると、燃料1Lあたりの桁が変わる", roles: ["residue_route", "residue_dry_kg_per_kg_dcw", "residue_digestion_cost", "residue_wet_factor", "residue_disposal_price"] },
  { key: "opex-shipping", block: "opex", title: "品質確認・出荷", hint: "出荷の台数と品質確認のロット数を決める前提。分析と運賃は人件費の作業の1回の経費で動かす", roles: ["truck_capacity_l", "lot_size_l"] },
];

const FUEL_PARAM_GROUP_BY_KEY = new Map(FUEL_PARAM_GROUPS.map((g) => [g.key, g]));
const FUEL_PARAM_GROUP_BY_ROLE = new Map(
  FUEL_PARAM_GROUPS.flatMap((g) => g.roles.flatMap((r) => [[r, g] as const, [`${r}_low`, g] as const, [`${r}_high`, g] as const]))
);

/** 前提の置き場所。 */
export function fuelParamGroupOfRole(roleKey: string | null): FuelParamGroup | undefined {
  return roleKey ? FUEL_PARAM_GROUP_BY_ROLE.get(roleKey) : undefined;
}

/** 明細の置き場所。参考の行は計算に入らないので置かない (undefined)。 */
export function fuelParamGroupOfItem(item: { costType: string; scenario: string; groupLabel: string | null }): FuelParamGroup | undefined {
  // DB の scenario の型は排水処理の試算の値の集合なので、燃料の値 (外部委託 / 自社精製) は文字列として比べる。
  const group = (key: string) => FUEL_PARAM_GROUP_BY_KEY.get(key);
  if (item.costType === "CAPEX") {
    if (item.scenario === "中央培養") return group("capex-culture");
    if (item.scenario === "自社精製") return group("capex-conversion");
    if (item.groupLabel === "品質を確かめて出荷する") return group("capex-shipping");
    return group("capex-plant");
  }
  if (item.costType !== "OPEX") return undefined;
  if (item.scenario === "中央培養") return group("opex-culture");
  if (item.scenario === "外部委託") return group("opex-outsourced");
  if (item.scenario === "自社精製") return group("opex-inhouse");
  if (item.groupLabel === "残渣を処理する") return group("opex-residue");
  if (item.groupLabel === "品質を確かめて出荷する") return group("opex-shipping");
  return group("opex-recovery");
}

/* ------------------------------------------------------------------ *
 * 前提の読み方
 * ------------------------------------------------------------------ */

function safeDiv(a: number, b: number): number {
  return b === 0 || !Number.isFinite(b) ? 0 : a / b;
}

/** 燃料の試算の前提は株・用途を持たない。同じ role_key が複数あれば、株・用途が空の行を優先する。 */
export function fuelAssumptionOf(assumptions: CostAssumption[], roleKey: string): CostAssumption | undefined {
  let best: CostAssumption | undefined;
  for (const a of assumptions) {
    if (a.roleKey !== roleKey) continue;
    if (!best || (!a.strain && !a.application && (best.strain || best.application))) best = a;
  }
  return best;
}

export function fuelRoleValue(assumptions: CostAssumption[], roleKey: string, fallback: number): number {
  const v = fuelAssumptionOf(assumptions, roleKey)?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** 収率の前提のうち、そのケースで採る行。ケースの行が無ければ基準の行。 */
export function fuelYieldAssumptionOf(assumptions: CostAssumption[], role: FuelYieldRole, yieldCase: FuelYieldCase): CostAssumption | undefined {
  return fuelAssumptionOf(assumptions, `${role}${YIELD_SUFFIX[yieldCase]}`) ?? fuelAssumptionOf(assumptions, role);
}

export interface FuelYield {
  yieldCase: FuelYieldCase;
  /** 0〜1 に直した値。 */
  famePotential: number;
  harvestRecovery: number;
  extractionRecovery: number;
  methylationRate: number;
  purificationRecovery: number;
  /** 燃料 (FAME) の密度 (kg/L)。 */
  density: number;
  /** 培養出口の乾燥菌体1kgから取れる精製FAME (kg)。 */
  fameKgPerKgDcw: number;
  /** 乾燥菌体1kgから取れる燃料 (L)。 */
  litersPerKgDcw: number;
  /** 燃料1Lに要る乾燥菌体 (kg-DCW/L)。 */
  kgDcwPerLiter: number;
}

const toRatio = (pct: number) => Math.min(Math.max(pct, 0), 100) / 100;

export function fuelYieldOf(assumptions: CostAssumption[], yieldCase: FuelYieldCase): FuelYield {
  const pct = (role: FuelYieldRole) => {
    const v = fuelYieldAssumptionOf(assumptions, role, yieldCase)?.value;
    return typeof v === "number" && Number.isFinite(v) ? v : YIELD_FALLBACK[role];
  };
  const famePotential = toRatio(pct("fame_potential"));
  const harvestRecovery = toRatio(pct("harvest_recovery"));
  const extractionRecovery = toRatio(pct("extraction_recovery"));
  const methylationRate = toRatio(pct("methylation_rate"));
  const purificationRecovery = toRatio(pct("purification_recovery"));
  const density = Math.max(fuelRoleValue(assumptions, "fame_density", 0.88), 0);
  const fameKgPerKgDcw = famePotential * harvestRecovery * extractionRecovery * methylationRate * purificationRecovery;
  const litersPerKgDcw = safeDiv(fameKgPerKgDcw, density);
  return {
    yieldCase,
    famePotential,
    harvestRecovery,
    extractionRecovery,
    methylationRate,
    purificationRecovery,
    density,
    fameKgPerKgDcw,
    litersPerKgDcw,
    kgDcwPerLiter: safeDiv(1, litersPerKgDcw),
  };
}

export interface FuelScale {
  /** 年間の燃料の量 (事業全体、L/年)。 */
  annualLiters: number;
  /** 年に要る乾燥菌体 (kg-DCW/年) = 年間の燃料の量 × 1Lに要る菌体。 */
  biomassKgYear: number;
  cultureLineCapacityKgYear: number;
  /** 培養設備の系列数 (端数も比例で数える)。 */
  cultureLines: number;
  plantLineCapacityKgYear: number;
  /** 燃料化設備の系列数 (端数も比例で数える)。 */
  plantLines: number;
  truckCapacityLiters: number;
  /** 出荷の台数 = 年間の燃料の量 ÷ 1台の積載量。 */
  shipmentsPerYear: number;
  lotSizeLiters: number;
  /** 品質確認のロット数 = 年間の燃料の量 ÷ 1ロットの量。 */
  lotsPerYear: number;
}

export function fuelScaleOf(assumptions: CostAssumption[], y: FuelYield): FuelScale {
  const annualLiters = Math.max(fuelRoleValue(assumptions, "business_annual_volume", 0), 0);
  const biomassKgYear = annualLiters * y.kgDcwPerLiter;
  const cultureLineCapacityKgYear = fuelRoleValue(assumptions, "culture_line_capacity_kg_year", 0);
  const plantLineCapacityKgYear = fuelRoleValue(assumptions, "plant_line_capacity_kg_year", 0);
  const truckCapacityLiters = fuelRoleValue(assumptions, "truck_capacity_l", 0);
  const lotSizeLiters = fuelRoleValue(assumptions, "lot_size_l", 0);
  return {
    annualLiters,
    biomassKgYear,
    cultureLineCapacityKgYear,
    cultureLines: safeDiv(biomassKgYear, cultureLineCapacityKgYear),
    plantLineCapacityKgYear,
    plantLines: safeDiv(biomassKgYear, plantLineCapacityKgYear),
    truckCapacityLiters,
    shipmentsPerYear: safeDiv(annualLiters, truckCapacityLiters),
    lotSizeLiters,
    lotsPerYear: safeDiv(annualLiters, lotSizeLiters),
  };
}

export interface FuelTaskAmount {
  occurrences: number;
  /** 作業単価 (円/時)。いつも前提の共通の作業単価。 */
  rate: number;
  hours: number;
  annualHours: number;
  laborAnnual: number;
  expenseAnnual: number;
  annual: number;
}

/** 作業1行の年額。年額 = 年間回数 × (1回の工数 × 作業単価 + 1回の経費)。工数が空欄 (未確認) の行は0時間で数える。 */
export function fuelTaskAmount(task: CostTask, assumptions: CostAssumption[], scale: FuelScale): FuelTaskAmount {
  const count = Math.max(task.countPerYear ?? 0, 0);
  const driver = task.countDriver as string;
  const occurrences =
    driver === "production_line" ? count * scale.cultureLines
    : driver === "plant_line" ? count * scale.plantLines
    : driver === "truck_trip" ? scale.shipmentsPerYear
    : driver === "batch" ? scale.lotsPerYear
    : count;
  const rate = fuelRoleValue(assumptions, "labor_rate", 4000);
  const hours = typeof task.hoursPerOccurrence === "number" && Number.isFinite(task.hoursPerOccurrence) ? Math.max(task.hoursPerOccurrence, 0) : 0;
  const expense = Number.isFinite(task.expensePerOccurrence) ? Math.max(task.expensePerOccurrence, 0) : 0;
  const laborAnnual = occurrences * hours * rate;
  const expenseAnnual = occurrences * expense;
  return { occurrences, rate, hours, annualHours: occurrences * hours, laborAnnual, expenseAnnual, annual: laborAnnual + expenseAnnual };
}

/**
 * 明細1行の年間発生額 (円/年)。培養設備の行は第1段で1kgあたりへ畳むので、ここでは燃料化設備・委託・出荷の行だけを扱う。
 * 初期投資配賦と年額固定は燃料化設備1系列あたりで、系列の数だけ並べる。毎kg菌体比例は処理する菌体の量、毎m³比例は燃料1Lあたり
 * (DB の basis の値は排水処理の試算と共通で、燃料の試算では「単位 = L」として読む)、バッチ連動は品質確認のロットあたり。
 */
export function fuelItemAnnual(item: CostItem, scale: FuelScale): number {
  if (item.isBreakdown || item.basis === "内訳" || item.costType === "参考") return 0;
  const base = item.quantity * item.unitPrice * item.annualFactor;
  switch (item.basis) {
    case "初期投資配賦":
      return safeDiv(base, item.usefulLifeYears ?? 0) * scale.plantLines;
    case "年額固定":
      return base * scale.plantLines;
    case "毎kg菌体比例":
      return base * scale.biomassKgYear;
    case "毎m³比例":
      return base * scale.annualLiters;
    case "バッチ連動":
      return base * scale.lotsPerYear;
    default:
      return 0;
  }
}

export interface FuelResidue {
  route: FuelResidueRoute;
  /** 乾燥菌体1kgあたりの残渣 (乾燥、kg)。 */
  dryKgPerKgDcw: number;
  /** 残渣の乾燥1kgあたりの処理費 (円)。発酵などは正味の費用、処分は 湿重量倍率 × 処分単価。 */
  pricePerKgDry: number;
  /** 乾燥菌体1kgあたりの残渣の処理費 (円/kg-DCW)。 */
  perKgDcw: number;
  label: string;
  /** 確度の帯グラフで使う、効いている単価の前提。 */
  priceAssumption: CostAssumption | undefined;
}

/** 残渣の処理費。前提が無い試算は0円。 */
export function fuelResidueOf(assumptions: CostAssumption[]): FuelResidue {
  const route: FuelResidueRoute = fuelAssumptionOf(assumptions, "residue_route")?.valueText === "disposal" ? "disposal" : "digestion";
  const dry = Math.max(fuelRoleValue(assumptions, "residue_dry_kg_per_kg_dcw", 0), 0);
  const pricePerKgDry = route === "disposal"
    ? Math.max(fuelRoleValue(assumptions, "residue_wet_factor", 0), 0) * Math.max(fuelRoleValue(assumptions, "residue_disposal_price", 0), 0)
    : fuelRoleValue(assumptions, "residue_digestion_cost", 0);
  return {
    route,
    dryKgPerKgDcw: dry,
    pricePerKgDry,
    perKgDcw: dry * pricePerKgDry,
    label: route === "disposal" ? "抽出残渣を産業廃棄物として処分" : "抽出残渣を発酵などで処理",
    priceAssumption: fuelAssumptionOf(assumptions, route === "disposal" ? "residue_disposal_price" : "residue_digestion_cost"),
  };
}

/** 明細の basis を燃料の試算の言葉で。 */
export const FUEL_BASIS_LABEL: Record<string, string> = {
  "初期投資配賦": "初期投資（1系列）",
  "年額固定": "年額（1系列）",
  "毎kg菌体比例": "菌体1kgあたり",
  "毎m³比例": "燃料1Lあたり",
  "バッチ連動": "品質確認1ロットあたり",
  "内訳": "内訳",
};

export type FuelBiomassRowKey = "capex" | "fixed" | "tasks" | "variable";
export interface FuelBiomassRow {
  key: FuelBiomassRowKey;
  label: string;
  perKg: number;
}

export interface FuelBiomassCost {
  /** 培養設備の系列数と、1系列の年間生産能力。 */
  cultureLines: number;
  lineCapacityKgYear: number;
  biomassKgYear: number;
  /** 培養設備の初期投資 (系列の数だけ並べた総額)。 */
  capexInitial: number;
  lineCapexInitial: number;
  usefulLifeMinYears: number | null;
  usefulLifeMaxYears: number | null;
  capexAnnual: number;
  fixedOpexAnnual: number;
  tasksAnnual: number;
  taskHoursAnnual: number;
  variablePerKg: number;
  /** 明細と作業から計算した菌体1kgの原価。 */
  computedPerKg: number;
  overridePerKg: number | null;
  /** 第2段で使う原価。上書き値があればそれ。 */
  perKg: number;
  rows: FuelBiomassRow[];
}

/** 明細1行が、培養設備で菌体1kgあたりに乗せる額。 */
export function fuelCultureItemPerKg(item: CostItem, lineCapacityKgYear: number): number {
  if (item.isBreakdown || item.basis === "内訳" || item.costType === "参考") return 0;
  const base = item.quantity * item.unitPrice * item.annualFactor;
  switch (item.basis) {
    case "初期投資配賦":
      return safeDiv(safeDiv(base, item.usefulLifeYears ?? 0), lineCapacityKgYear);
    case "年額固定":
      return safeDiv(base, lineCapacityKgYear);
    case "毎kg菌体比例":
      return base;
    default:
      return 0;
  }
}

/**
 * 明細1行の右端の額 (円/L) を、画面に出す式にする。数量 × 単価 は行の「〜あたり」の額で、そこから燃料1Lあたりへ直す。
 * 培養設備と燃料化設備の初期投資・年額は 1系列の1年あたり → ÷ 1系列が1年に作る(処理する)菌体 → × 燃料1Lに要る菌体。
 * 系列の数は 年に要る菌体 ÷ 1系列 なので、fuelItemAnnual ÷ 年間の燃料の量 と同じ値になる (契約チェックで確かめる)。
 * 右端に額を出さない行 (発生しない・内訳・参考) と、年間の燃料の量が0の燃料化の工場の行は null。
 */
export function fuelItemCalc(item: CostItem, scenario: FuelScenarioResult): ItemCalc | null {
  if (item.isBreakdown || item.basis === "内訳" || item.costType === "参考") return null;
  const s = scenario.scale;
  const kgPerLiter = scenario.yield.kgDcwPerLiter;
  const isCulture = item.scenario === "中央培養";
  if (!isCulture && s.annualLiters <= 0) return null;
  const base = item.quantity * item.unitPrice * item.annualFactor;
  const head = quantityPriceTerms(item);
  const lineCapacity = isCulture ? s.cultureLineCapacityKgYear : s.plantLineCapacityKgYear;
  const lineLabel = isCulture ? "1系列が1年に作る菌体" : "1系列が1年に処理する菌体";
  const toPerKg = (annual: number): CalcSegment => ({
    continues: true,
    terms: [{ op: "÷", value: lineCapacity, unit: "kg", label: lineLabel }],
    result: { value: safeDiv(annual, lineCapacity), unit: "円", label: "菌体1kgあたり" },
  });
  const toPerLiter = (perKg: number): CalcSegment => ({
    continues: true,
    terms: [{ op: "×", value: kgPerLiter, unit: "kg", label: "燃料1Lに要る菌体" }],
    result: { value: perKg * kgPerLiter, unit: "円/L" },
  });
  const excluded = isCulture && scenario.biomass.overridePerKg !== null ? "菌体の原価を上書きしているので、この行は燃料の原価に入らない" : null;
  switch (item.basis) {
    case "初期投資配賦": {
      const annual = safeDiv(base, item.usefulLifeYears ?? 0);
      return {
        price: null,
        excluded,
        segments: [
          { continues: false, terms: [...head, { op: "÷", value: item.usefulLifeYears ?? 0, unit: "年", label: "耐用" }], result: { value: annual, unit: "円", label: "1系列の1年あたり" } },
          toPerKg(annual),
          toPerLiter(safeDiv(annual, lineCapacity)),
        ],
      };
    }
    case "年額固定":
      return {
        price: null,
        excluded,
        segments: [
          { continues: false, terms: head, result: { value: base, unit: "円", label: "1系列の1年あたり" } },
          toPerKg(base),
          toPerLiter(safeDiv(base, lineCapacity)),
        ],
      };
    case "毎kg菌体比例":
      return {
        price: null,
        excluded,
        segments: [{ continues: false, terms: head, result: { value: base, unit: "円", label: "菌体1kgあたり" } }, toPerLiter(base)],
      };
    case "毎m³比例":
      if (isCulture) return null;
      return { price: null, excluded: null, segments: [{ continues: false, terms: head, result: { value: base, unit: "円/L" } }] };
    case "バッチ連動":
      if (isCulture) return null;
      return {
        price: null,
        excluded: null,
        segments: [
          { continues: false, terms: head, result: { value: base, unit: "円", label: "品質確認1ロットあたり" } },
          { continues: true, terms: [{ op: "÷", value: s.lotSizeLiters, unit: "L", label: "1ロットの燃料" }], result: { value: safeDiv(base, s.lotSizeLiters), unit: "円/L" } },
        ],
      };
    default:
      return null;
  }
}

/** 第1段: 燃料のための菌体1kgの原価。年に要る菌体の量に合わせて培養設備を並べる。 */
export function computeFuelBiomassCost(bundle: Pick<CostModelBundle, "assumptions" | "items" | "tasks">, scale: FuelScale): FuelBiomassCost {
  const { assumptions } = bundle;
  const items = bundle.items.filter((i) => i.scenario === "中央培養" && !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考");
  const tasks = (bundle.tasks ?? []).filter((t) => t.scenario === "中央培養");
  const lineCap = scale.cultureLineCapacityKgYear;
  const rows: FuelBiomassRow[] = [
    { key: "capex", label: "培養設備の償却", perKg: 0 },
    { key: "fixed", label: "年ごとの固定費（品質確認など）", perKg: 0 },
    { key: "tasks", label: "培養の作業", perKg: 0 },
    { key: "variable", label: "菌体量に比例する費用（培地・CO2・濃縮など）", perKg: 0 },
  ];
  const rowOf = (key: FuelBiomassRowKey) => rows.find((r) => r.key === key) as FuelBiomassRow;
  let lineCapexInitial = 0;
  let variablePerKg = 0;
  const lives: number[] = [];
  for (const i of items) {
    const perKg = fuelCultureItemPerKg(i, lineCap);
    if (i.basis === "初期投資配賦") {
      rowOf("capex").perKg += perKg;
      lineCapexInitial += i.quantity * i.unitPrice;
      if (i.usefulLifeYears && i.quantity * i.unitPrice > 0) lives.push(i.usefulLifeYears);
    } else if (i.basis === "年額固定") rowOf("fixed").perKg += perKg;
    else if (i.basis === "毎kg菌体比例") {
      rowOf("variable").perKg += perKg;
      variablePerKg += perKg;
    }
  }
  let tasksAnnual = 0;
  let taskHoursAnnual = 0;
  for (const t of tasks) {
    const amount = fuelTaskAmount(t, assumptions, scale);
    tasksAnnual += amount.annual;
    taskHoursAnnual += amount.annualHours;
  }
  rowOf("tasks").perKg = safeDiv(tasksAnnual, scale.biomassKgYear);
  const computedPerKg = rows.reduce((s, r) => s + r.perKg, 0);
  const overrideValue = fuelAssumptionOf(assumptions, "biomass_cost_per_kg_override")?.value;
  const overridePerKg = typeof overrideValue === "number" && Number.isFinite(overrideValue) && overrideValue >= 0 ? overrideValue : null;
  return {
    cultureLines: scale.cultureLines,
    lineCapacityKgYear: lineCap,
    biomassKgYear: scale.biomassKgYear,
    capexInitial: lineCapexInitial * scale.cultureLines,
    lineCapexInitial,
    usefulLifeMinYears: lives.length > 0 ? Math.min(...lives) : null,
    usefulLifeMaxYears: lives.length > 0 ? Math.max(...lives) : null,
    capexAnnual: rowOf("capex").perKg * scale.biomassKgYear,
    fixedOpexAnnual: rowOf("fixed").perKg * scale.biomassKgYear,
    tasksAnnual,
    taskHoursAnnual,
    variablePerKg,
    computedPerKg,
    overridePerKg,
    perKg: overridePerKg ?? computedPerKg,
    rows,
  };
}

export interface FuelBreakdownPart {
  label: string;
  perLiter: number;
  /**
   * この中身を動かす操作パネルの小分け (FUEL_PARAM_GROUPS の key)。操作パネルの一番上の内訳から、その小分けへ移るのに使う
   * (まさ 2026-09-14「この棒グラフで一番大きく占めているところを減らしていかないといけないんだけど、その部分が左カラムのどこにあるのかが分かりにくい」)。
   */
  groupKey: string | null;
}

/** 第1段の行を動かす小分け。設備は CAPEX の培養設備、原料と品質確認は OPEX の培養、作業は人件費。 */
const FUEL_BIOMASS_PART_GROUP: Record<FuelBiomassRow["key"], string> = {
  capex: "capex-culture",
  fixed: "opex-culture",
  tasks: "opex-labor",
  variable: "opex-culture",
};
export interface FuelBreakdownSlice {
  key: FuelBreakdownKey;
  label: string;
  perLiter: number;
  /** 区分の中身 (大きい順)。足すと perLiter になる。 */
  parts: FuelBreakdownPart[];
}

export interface FuelConfidenceSlice {
  grade: CostConfidence | "未設定";
  perLiter: number;
  share: number;
}

export interface FuelUncertainRow {
  id: string;
  label: string;
  scope: string;
  perLiter: number;
  confidence: CostConfidence | null;
  sourceKind: string | null;
  owner: string | null;
}

export interface FuelScenarioResult {
  key: string;
  conversion: FuelConversion;
  yieldCase: FuelYieldCase;
  label: string;
  yield: FuelYield;
  scale: FuelScale;
  biomass: FuelBiomassCost;
  residue: FuelResidue;

  salePrice: number;
  /** 菌体費 (円/L) = 菌体1kgの原価 × 1Lに要る菌体。 */
  biomassPerLiter: number;
  /** 燃料化の工場 (脱水・油回収・FAMEにする・残渣・出荷・燃料化設備の償却) の合計 (円/L)。 */
  processPerLiter: number;
  /** CAPEX (培養設備と燃料化設備の償却) の合計 (円/L)。 */
  capexPerLiter: number;
  opexPerLiter: number;
  totalPerLiter: number;
  breakdown: FuelBreakdownSlice[];

  /** 燃料化設備の初期投資 (系列の数だけ並べた総額) と、培養設備を足した総額。 */
  plantCapexInitial: number;
  plantLineCapexInitial: number;
  capexInitial: number;

  /** 燃料化の工場の作業の年間工数 (人時)。培養の作業は biomass.taskHoursAnnual。 */
  plantTaskHours: number;
  plantTaskAnnual: number;
  unknownTaskCount: number;

  revenueAnnual: number;
  totalAnnual: number;
  profitAnnual: number;
  profitPerLiter: number;
  marginRate: number;
  gapToPricePerLiter: number;
  gapToTargetPerLiter: number | null;

  /** 売価で損益ゼロになる菌体1kgの原価の上限 (円/kg)。負なら菌体がタダでも赤字。 */
  breakEvenBiomassPerKg: number;
  /** 総コスト目標に収まる菌体1kgの原価の上限 (円/kg)。目標が無ければ null。 */
  targetBiomassPerKg: number | null;

  confidenceBreakdown: FuelConfidenceSlice[];
  topUncertain: FuelUncertainRow[];
}

export interface FuelComputation {
  scenarios: FuelScenarioResult[];
  targetTotalPerLiter: number | null;
}

const CONFIDENCE_ORDER: Array<CostConfidence | "未設定"> = ["S", "A", "B", "C", "H", "未設定"];

/**
 * 明細の短い呼び名。CAPEX は中項目。
 * OPEX のうち培養設備の行 (排水処理の試算からコピーした行) は、小項目が具体名 (中項目は「原料」「ユーティリティ」などの分類) なので小項目。
 * 長い方を選ぶと「ユーティリティ」が CO2 と補給水の2行に並んで見分けられなかった (2026-09-14)。
 * 燃料化の工場の行は、中項目が具体名 (電力・抽出溶媒の補給など) で小項目が中身なので「中項目（小項目）」。
 */
export function fuelItemLabel(item: { costType: string; scenario: string; groupLabel: string | null; midLabel: string | null; leafLabel: string | null }): string {
  const mid = item.midLabel?.trim() || "";
  const leaf = item.leafLabel?.trim() || "";
  if (item.costType === "CAPEX") return mid || leaf || item.groupLabel || "(名称なし)";
  if (item.scenario === "中央培養") return leaf || mid || item.groupLabel || "(名称なし)";
  if (mid && leaf && mid !== leaf) return `${mid}（${leaf}）`;
  return mid || leaf || item.groupLabel || "(名称なし)";
}

/** 同じ呼び名・同じ小分けを足し合わせ、大きい順に並べる。0円の中身は出さない。 */
function sumParts(entries: FuelBreakdownPart[]): FuelBreakdownPart[] {
  const m = new Map<string, FuelBreakdownPart>();
  for (const e of entries) {
    const k = `${e.label} ${e.groupKey ?? ""}`;
    const hit = m.get(k);
    if (hit) hit.perLiter += e.perLiter;
    else m.set(k, { ...e });
  }
  return [...m.values()].filter((p) => Math.abs(p.perLiter) > 1e-9).sort((a, b) => b.perLiter - a.perLiter);
}

export function fuelScenarioLabelOf(conversion: FuelConversion, yieldCase: FuelYieldCase): string {
  return `FAME転換を${FUEL_CONVERSION_LABEL[conversion]}・収率${FUEL_YIELD_CASE_LABEL[yieldCase]}`;
}

/** 選んだFAME転換と収率の1通りを計算する。 */
export function computeFuelScenario(
  bundle: Pick<CostModelBundle, "assumptions" | "items" | "tasks"> & { model?: Partial<CostModel> },
  conversion: FuelConversion,
  yieldCase: FuelYieldCase
): FuelScenarioResult {
  const { assumptions } = bundle;
  const tasks = bundle.tasks ?? [];
  const y = fuelYieldOf(assumptions, yieldCase);
  const scale = fuelScaleOf(assumptions, y);
  const biomass = computeFuelBiomassCost(bundle, scale);
  const liters = scale.annualLiters;
  const perLiter = (annual: number) => safeDiv(annual, liters);
  const scopes = fuelScopesFor(conversion) as string[];

  const items = bundle.items.filter((i) => scopes.includes(i.scenario) && !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考");
  const itemRows = items.map((i) => ({ item: i, annual: fuelItemAnnual(i, scale), key: fuelBreakdownKeyOf(i) }));
  const taskRows = tasks
    .filter((t) => scopes.includes(t.scenario))
    .map((t) => ({ task: t, amount: fuelTaskAmount(t, assumptions, scale), key: fuelBreakdownKeyOf(t) }));

  const biomassPerLiter = biomass.perKg * y.kgDcwPerLiter;
  const biomassParts: FuelBreakdownPart[] = biomass.overridePerKg !== null
    ? [{ label: "菌体の原価（上書き値）", perLiter: biomassPerLiter, groupKey: "cond-biomass" }]
    : biomass.rows.map((r) => ({ label: r.label, perLiter: r.perKg * y.kgDcwPerLiter, groupKey: FUEL_BIOMASS_PART_GROUP[r.key] }));

  const partsOf: Record<FuelBreakdownKey, FuelBreakdownPart[]> = {
    biomass: biomassParts,
    recovery: [],
    conversion: [],
    residue: [],
    shipping: [],
    capex: [],
  };
  for (const r of itemRows) partsOf[r.key].push({ label: fuelItemLabel(r.item), perLiter: perLiter(r.annual), groupKey: fuelParamGroupOfItem(r.item)?.key ?? null });
  for (const r of taskRows) partsOf[r.key].push({ label: r.task.label, perLiter: perLiter(r.amount.annual), groupKey: "opex-labor" });
  // 残渣の処理は前提から計算する (明細の行は持たない)。処理する菌体の量に比例する。
  const residue = fuelResidueOf(assumptions);
  const residuePerLiter = residue.perKgDcw * y.kgDcwPerLiter;
  partsOf.residue.push({ label: residue.label, perLiter: residuePerLiter, groupKey: "opex-residue" });
  const breakdown: FuelBreakdownSlice[] = FUEL_BREAKDOWN_ORDER.map((key) => {
    const parts = sumParts(partsOf[key]);
    const value = key === "biomass" ? biomassPerLiter : partsOf[key].reduce((s, p) => s + p.perLiter, 0);
    return { key, label: FUEL_BREAKDOWN_LABEL[key], perLiter: value, parts };
  });
  const totalPerLiter = breakdown.reduce((s, b) => s + b.perLiter, 0);
  const processPerLiter = totalPerLiter - biomassPerLiter;
  const plantCapexPerLiter = breakdown.find((b) => b.key === "capex")?.perLiter ?? 0;
  const cultureCapexPerLiter = biomass.overridePerKg !== null ? 0 : (biomass.rows.find((r) => r.key === "capex")?.perKg ?? 0) * y.kgDcwPerLiter;
  const capexPerLiter = plantCapexPerLiter + cultureCapexPerLiter;

  const plantLineCapexInitial = items.filter((i) => i.costType === "CAPEX").reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const plantCapexInitial = plantLineCapexInitial * scale.plantLines;

  const salePrice = fuelRoleValue(assumptions, "sale_price", 0);
  const target = bundle.model?.targetTotalCostPerUnit ?? null;
  const nonBiomass = processPerLiter;

  // 確度の帯グラフ: 明細・作業を行ごとに数え、培養設備の各行は「1kgあたりの額 × 1Lに要る菌体」で配る。
  const cultureRows: Array<{ id: string; label: string; scope: string; confidence: CostConfidence | null; sourceKind: string | null; owner: string | null; perLiter: number }> =
    biomass.overridePerKg !== null
      ? [{
          id: "biomass-override",
          label: "菌体の原価（上書き値）",
          scope: "中央培養",
          confidence: fuelAssumptionOf(assumptions, "biomass_cost_per_kg_override")?.confidence ?? null,
          sourceKind: fuelAssumptionOf(assumptions, "biomass_cost_per_kg_override")?.sourceKind ?? null,
          owner: fuelAssumptionOf(assumptions, "biomass_cost_per_kg_override")?.owner ?? null,
          perLiter: biomassPerLiter,
        }]
      : [
          ...bundle.items
            .filter((i) => i.scenario === "中央培養" && !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考")
            .map((i) => ({
              id: i.costItemId,
              label: fuelItemLabel(i),
              scope: i.scenario,
              confidence: i.confidence,
              sourceKind: i.sourceKind,
              owner: i.owner,
              perLiter: fuelCultureItemPerKg(i, scale.cultureLineCapacityKgYear) * y.kgDcwPerLiter,
            })),
          ...tasks
            .filter((t) => t.scenario === "中央培養")
            .map((t) => ({
              id: t.costTaskId,
              label: t.label,
              scope: t.scenario,
              confidence: t.confidence,
              sourceKind: t.sourceKind,
              owner: t.owner,
              perLiter: safeDiv(fuelTaskAmount(t, assumptions, scale).annual, scale.biomassKgYear) * y.kgDcwPerLiter,
            })),
        ];
  const allRows = [
    ...cultureRows,
    ...itemRows.map((r) => ({ id: r.item.costItemId, label: fuelItemLabel(r.item), scope: r.item.scenario, confidence: r.item.confidence, sourceKind: r.item.sourceKind, owner: r.item.owner, perLiter: perLiter(r.annual) })),
    ...taskRows.map((r) => ({ id: r.task.costTaskId, label: r.task.label, scope: r.task.scenario, confidence: r.task.confidence, sourceKind: r.task.sourceKind, owner: r.task.owner, perLiter: perLiter(r.amount.annual) })),
    {
      id: "residue",
      label: residue.label,
      scope: "共通",
      confidence: residue.priceAssumption?.confidence ?? null,
      sourceKind: residue.priceAssumption?.sourceKind ?? null,
      owner: residue.priceAssumption?.owner ?? null,
      perLiter: residuePerLiter,
    },
  ];
  const byGrade = new Map<CostConfidence | "未設定", number>();
  for (const r of allRows) {
    const g = (r.confidence ?? "未設定") as CostConfidence | "未設定";
    byGrade.set(g, (byGrade.get(g) ?? 0) + r.perLiter);
  }
  const confidenceBreakdown = CONFIDENCE_ORDER.filter((g) => (byGrade.get(g) ?? 0) !== 0).map((g) => ({
    grade: g,
    perLiter: byGrade.get(g) ?? 0,
    share: safeDiv(byGrade.get(g) ?? 0, totalPerLiter),
  }));
  const topUncertain = allRows
    .filter((r) => r.confidence === "H" || r.confidence === "C")
    .sort((a, b) => b.perLiter - a.perLiter)
    .slice(0, 8);

  return {
    key: `${conversion}:${yieldCase}`,
    conversion,
    yieldCase,
    label: fuelScenarioLabelOf(conversion, yieldCase),
    yield: y,
    scale,
    biomass,
    residue,
    salePrice,
    biomassPerLiter,
    processPerLiter,
    capexPerLiter,
    opexPerLiter: totalPerLiter - capexPerLiter,
    totalPerLiter,
    breakdown,
    plantCapexInitial,
    plantLineCapexInitial,
    capexInitial: plantCapexInitial + biomass.capexInitial,
    plantTaskHours: taskRows.reduce((s, r) => s + r.amount.annualHours, 0),
    plantTaskAnnual: taskRows.reduce((s, r) => s + r.amount.annual, 0),
    unknownTaskCount: [...taskRows.map((r) => r.task), ...tasks.filter((t) => t.scenario === "中央培養")].filter((t) => t.hoursPerOccurrence === null || t.hoursPerOccurrence === undefined).length,
    revenueAnnual: salePrice * liters,
    totalAnnual: totalPerLiter * liters,
    profitAnnual: (salePrice - totalPerLiter) * liters,
    profitPerLiter: salePrice - totalPerLiter,
    marginRate: safeDiv(salePrice - totalPerLiter, salePrice),
    gapToPricePerLiter: salePrice - totalPerLiter,
    gapToTargetPerLiter: target === null ? null : target - totalPerLiter,
    breakEvenBiomassPerKg: safeDiv(salePrice - nonBiomass, y.kgDcwPerLiter),
    targetBiomassPerKg: target === null ? null : safeDiv(target - nonBiomass, y.kgDcwPerLiter),
    confidenceBreakdown,
    topUncertain,
  };
}

/** FAME転換 × 収率 の6通りをすべて計算する。 */
export function computeFuelCostModel(bundle: Pick<CostModelBundle, "assumptions" | "items" | "tasks"> & { model?: Partial<CostModel> }): FuelComputation {
  return {
    scenarios: FUEL_CONVERSIONS.flatMap((c) => FUEL_YIELD_CASES.map((y) => computeFuelScenario(bundle, c, y))),
    targetTotalPerLiter: bundle.model?.targetTotalCostPerUnit ?? null,
  };
}

export function findFuelScenario(c: FuelComputation, conversion: FuelConversion, yieldCase: FuelYieldCase): FuelScenarioResult | undefined {
  return c.scenarios.find((s) => s.conversion === conversion && s.yieldCase === yieldCase);
}

export interface FuelFlowRow {
  task: CostTask;
  amount: FuelTaskAmount;
  isCulture: boolean;
  perLiter: number;
}
export interface FuelFlowStep {
  label: string;
  rows: FuelFlowRow[];
  hours: number;
  annual: number;
  perLiter: number;
  unknownCount: number;
  scopes: string[];
}
export interface FuelTaskFlow {
  steps: FuelFlowStep[];
  /** 燃料化の工場の作業の年間工数 (事業全体)。 */
  plantHours: number;
  /** 培養設備の作業の年間工数 (事業全体)。 */
  cultureHours: number;
  unknownCount: number;
  annual: number;
  perLiter: number;
}

/** 作業の流れ。選んだFAME転換と収率で発生する作業を、段 (group_label) ごとに sort_order の順で束ねる。 */
export function computeFuelTaskFlow(bundle: Pick<CostModelBundle, "assumptions" | "tasks">, scenario: FuelScenarioResult): FuelTaskFlow {
  const tasks = [...(bundle.tasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const steps: FuelFlowStep[] = [];
  for (const task of tasks) {
    if (!fuelRowApplies(task, scenario.conversion)) continue;
    const isCulture = task.scenario === "中央培養";
    const amount = fuelTaskAmount(task, bundle.assumptions, scenario.scale);
    const perLiter = isCulture
      ? scenario.biomass.overridePerKg !== null ? 0 : safeDiv(amount.annual, scenario.scale.biomassKgYear) * scenario.yield.kgDcwPerLiter
      : safeDiv(amount.annual, scenario.scale.annualLiters);
    const label = task.groupLabel ?? "作業";
    let step = steps.find((s) => s.label === label);
    if (!step) {
      step = { label, rows: [], hours: 0, annual: 0, perLiter: 0, unknownCount: 0, scopes: [] };
      steps.push(step);
    }
    step.rows.push({ task, amount, isCulture, perLiter });
    if (!step.scopes.includes(task.scenario)) step.scopes.push(task.scenario);
    step.hours += amount.annualHours;
    step.annual += amount.annual;
    step.perLiter += perLiter;
    if (task.hoursPerOccurrence === null || task.hoursPerOccurrence === undefined) step.unknownCount += 1;
  }
  const cultureHours = steps.reduce((s, st) => s + st.rows.filter((r) => r.isCulture).reduce((u, r) => u + r.amount.annualHours, 0), 0);
  const allHours = steps.reduce((s, st) => s + st.hours, 0);
  return {
    steps,
    plantHours: allHours - cultureHours,
    cultureHours,
    unknownCount: steps.reduce((s, st) => s + st.unknownCount, 0),
    annual: steps.reduce((s, st) => s + st.annual, 0),
    perLiter: steps.reduce((s, st) => s + st.perLiter, 0),
  };
}
