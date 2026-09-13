// PJコックピット / PJワークスペース「コスト試算」タブの計算エンジン。
//
// 正本は project_cost_assumptions (変数)・project_cost_items (明細)・project_cost_tasks (作業リスト)。
// ここは純関数だけを置く。DB アクセスも React も持たない。
//
// 二段階で計算する (2026-09-13 まさ確定):
//   第1段 菌体の製造原価 (円/kg-DCW) … 株 (強化株 / 自然株) ごとに、菌体の製造拠点の明細と作業から出す
//     生産1kgあたり = (培養設備の償却年額 + 年額固定費 + 製造拠点の作業) ÷ 年間生産能力 + 菌体量に比例する費用
//     売れた1kgあたり = 生産1kgあたり ÷ 販売率。上書き値 (biomass_cost_per_kg_override) があれば生産1kgあたりをそれに置き換える
//   第2段 用途別の処理原価 (円/単位) … 第1段の原価を一定として、色素分解 / 金属回収ごとに出す
//     必要菌体量 (kg-DCW/単位) = 対象物質濃度 × k_ppm ÷ 取り込み効率α ÷ 菌体回収率η ÷ 菌体使用回数 ÷ 1000
//     総コスト = 第1段の原価 × 必要菌体量 + 現場の明細 + 現場の作業 (方式・槽・用途・株で絞る)
//
// 菌体の製造拠点 (DB の scenario 値は '中央培養') = 顧客工場では培養せず、SX側の1拠点でまとめて菌体を育て、
// 濃縮して各工場へ運ぶところ。画面では「中央培養」と書かない (まさ 2026-09-13「中央培養ってなに？」)。
//
// 販売率 (sales_rate, %) は、生産した菌体のうち売れる割合。売れ残りも作った分の費用はかかるので、
// 第1段の全費用を売れた量で割る (まさ 2026-09-13。既定は全量が売れる100%)。
//
// 作業 (人件費) は作業リストで持つ。年額 = 年間回数 × (1回の工数 × 作業単価 + 1回の経費)。
// 「人件費を除くと」の併記はしない (まさ 2026-09-13)。工数と単価を入力して制御する。
//
// 前提・明細・作業は strain / application 列で「どの株・どの用途に効くか」を持つ。null は共通。
// 同じ role_key が複数あるときは、株と用途の両方が一致する行 > 株だけ > 用途だけ > 共通 の順に採る。

export type CostConfidence = "S" | "A" | "B" | "C" | "H";
export type CostVisibility = "amd_internal" | "workspace_shared";
export type CostMethod = "循環" | "投入";
export type CostTankMode = "既設" | "新設";
export type CostStrain = "enhanced" | "wild";
export type CostApplication = "dye" | "metal";
export type CostScenarioScope = "循環" | "投入" | "共通" | "中央培養";

export interface CostSelection {
  strain: CostStrain | null;
  application: CostApplication | null;
}

export const STRAIN_LABEL: Record<CostStrain, string> = { enhanced: "強化株", wild: "自然株" };
export const APPLICATION_LABEL: Record<CostApplication, string> = { dye: "色素分解", metal: "金属回収" };
export const METHOD_LABEL: Record<CostMethod, string> = { 循環: "A:循環", 投入: "B:投入" };
const STRAIN_ORDER: CostStrain[] = ["enhanced", "wild"];
const APPLICATION_ORDER: CostApplication[] = ["dye", "metal"];

/** 画面での呼び名。DB の値 '中央培養' はそのまま使い、表示だけ置き換える。 */
export const PRODUCTION_SITE_LABEL = "菌体の製造拠点";
export const PRODUCTION_SITE_DESCRIPTION =
  "顧客工場では培養せず、SX側の1拠点でまとめて菌体を育て、濃縮して各工場へ運ぶところ。";
export const SCENARIO_SCOPE_LABEL: Record<CostScenarioScope, string> = {
  中央培養: PRODUCTION_SITE_LABEL,
  共通: "現場（方式によらない）",
  循環: "現場（A:循環）",
  投入: "現場（B:投入）",
};

export interface CostAssumption {
  costAssumptionId: string;
  groupLabel: string;
  label: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  confidence: CostConfidence | null;
  sourceKind: string | null;
  owner: string | null;
  isKey: boolean;
  roleKey: string | null;
  note: string | null;
  visibility: CostVisibility;
  sortOrder: number;
  /** どの株に効くか。null は共通。 */
  strain: CostStrain | null;
  /** どの用途に効くか。null は共通。 */
  application: CostApplication | null;
}

export type CostPriceRule =
  | "biomass"
  | "broth"
  | "module_swap"
  | "power_circulation"
  | "power_injection"
  | "spent_disposal";

export interface CostItem {
  costItemId: string;
  scenario: CostScenarioScope;
  costType: "CAPEX" | "OPEX" | "参考";
  groupLabel: string | null;
  midLabel: string | null;
  leafLabel: string | null;
  basis: "初期投資配賦" | "毎m³比例" | "バッチ連動" | "内訳" | "毎kg菌体比例" | "年額固定";
  quantity: number;
  quantityUnit: string | null;
  unitPrice: number;
  unitPriceUnit: string | null;
  priceRule: CostPriceRule | null;
  annualFactor: number;
  usefulLifeYears: number | null;
  isBreakdown: boolean;
  confidence: CostConfidence | null;
  sourceKind: string | null;
  owner: string | null;
  note: string | null;
  visibility: CostVisibility;
  sortOrder: number;
  strain: CostStrain | null;
  application: CostApplication | null;
}

/** 作業の年間回数の決め方。 */
export type CostTaskDriver = "fixed" | "batch" | "visit" | "module_swap" | "membrane_swap";

export const TASK_DRIVER_LABEL: Record<CostTaskDriver, string> = {
  fixed: "固定の回数",
  batch: "年間バッチ数",
  visit: "訪問回数",
  module_swap: "モジュール交換回数",
  membrane_swap: "膜交換回数",
};
export const TASK_DRIVERS: CostTaskDriver[] = ["fixed", "batch", "visit", "module_swap", "membrane_swap"];

export interface CostTask {
  costTaskId: string;
  scenario: CostScenarioScope;
  groupLabel: string | null;
  label: string;
  /** 1回の工数 (人時)。null は未確認で、0時間として計算する。 */
  hoursPerOccurrence: number | null;
  countDriver: CostTaskDriver;
  /** 固定の回数のときの年間回数。 */
  countPerYear: number | null;
  /** 作業単価 (円/時)。null は前提の共通の作業単価 (labor_rate) を使う。 */
  hourlyRate: number | null;
  /** 1回あたりの経費 (車両費・部材・外注費など)。 */
  expensePerOccurrence: number;
  confidence: CostConfidence | null;
  sourceKind: string | null;
  owner: string | null;
  note: string | null;
  visibility: CostVisibility;
  sortOrder: number;
  strain: CostStrain | null;
  application: CostApplication | null;
}

export interface CostQuestion {
  costQuestionId: string;
  addressee: string;
  question: string;
  whyItMatters: string | null;
  impactLow: number | null;
  impactHigh: number | null;
  status: "open" | "answered" | "dropped";
  answer: string | null;
  answeredOn: string | null;
  linkedAssumptionId: string | null;
  visibility: CostVisibility;
  sortOrder: number;
}

export type CostNoteSection = "caveat" | "benchmark" | "reading_guide" | "history";

export interface CostNote {
  costNoteId: string;
  section: CostNoteSection;
  title: string;
  bodyMd: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  visibility: CostVisibility;
  sortOrder: number;
}

export interface CostModel {
  costModelId: string;
  projectId: string;
  title: string;
  caseKind: "dye_degradation" | "metal_recovery" | "multi" | "other";
  caseLabel: string;
  versionLabel: string | null;
  status: "draft" | "active" | "archived";
  sourceUrl: string | null;
  sourceNote: string | null;
  summaryMd: string | null;
  /** どういう系を想定した試算か。タブの最初に読ませる。 */
  systemScopeMd: string | null;
  /** 成立ラインとして置いている総コスト目標 (円/単位)。null なら損益分岐だけを出す。 */
  targetTotalCostPerUnit: number | null;
  targetMarginRate: number | null;
  targetNote: string | null;
  /** 単位あたり指標の分母。SXは m³、PJによって kg / 台 / 件 など。 */
  unitBasisLabel: string;
  visibility: CostVisibility;
  updatedAt: string | null;
}

export interface CostModelBundle {
  model: CostModel;
  assumptions: CostAssumption[];
  items: CostItem[];
  tasks: CostTask[];
  questions: CostQuestion[];
  notes: CostNote[];
}

/** 計算に要るのは前提・明細・作業だけ。作業を持たない試算もある。 */
export type CostInputs = Pick<CostModelBundle, "assumptions" | "items"> & { tasks?: CostTask[] };

/**
 * 計算エンジンが読む role_key。画面の操作パネルはこの前提だけを並べる
 * (ここに無い前提を動かしても総コストは変わらない)。
 */
export const COST_ROLE_KEYS = new Set([
  "sale_price",
  "batch_volume",
  "operating_days",
  "utilization",
  "target_concentration",
  "k_ppm",
  "uptake_alpha",
  "recovery_eta",
  "reuse_count",
  "culture_capacity_kg_year",
  "sales_rate",
  "biomass_cost_per_kg_override",
  "labor_rate",
  "patrol_batches_per_delivery",
  "module_unit_price",
  "module_durability_batches",
  "hrt_circulation",
  "power_kw_circulation",
  "membrane_life_years",
  "hrt_injection",
  "power_kw_injection",
  "power_unit_price",
  "new_tank_capex",
  "tank_life_years",
  "spent_wet_factor",
  "sludge_disposal_price",
]);

// 旧 price_rule (biomass / broth) の除数。「使い捨て・50ppm・α=0.05・η=90%・5g/L」のときの値。
// 二段階版の SX 明細はもう使っていないが、旧形式の明細を読んでも壊れないように残す。
const BASELINE_BIOMASS_G_PER_M3 = 1111.111111;
const BASELINE_BROTH_L_PER_M3 = 222.222222;

/** 現場の後処理として束ねて見せる group_label。 */
const POST_PROCESS_GROUPS = new Set(["シアノ回収後処理", "使用済み菌体の処分"]);

export interface CostDerived {
  salePrice: number;
  annualBatches: number;
  annualVolume: number;
  targetConcentration: number;
  uptakeAlpha: number;
  recoveryEta: number;
  requiredBiomassPerM3: number;
  biomassWithLossPerM3: number;
  requiredBrothPerM3: number;
  /** 使用回数で割った後、1単位あたりに使い切る菌体量 (kg-DCW)。第1段の原価に掛ける量。 */
  biomassKgPerUnit: number;
  /** 年間に要る菌体量 (kg-DCW)。 */
  annualBiomassKg: number;
  biomassFactor: number;
  brothFactor: number;
  reuseCount: number;
  /** 作業の年間回数: 訪問回数 = 年間バッチ数 ÷ max(菌体使用回数, 1回の搬入でまかなうバッチ数)。 */
  visitsPerYear: number;
  /** 作業の年間回数: モジュール交換回数 = 年間バッチ数 ÷ モジュール耐用バッチ数。 */
  moduleSwapsPerYear: number;
  /** 作業の年間回数: 膜交換回数 = 1 ÷ 膜交換年数。 */
  membraneSwapsPerYear: number;
}

export type CostBiomassRowKey = "capex" | "fixed" | "tasks" | "variable";

export interface CostBiomassRow {
  key: CostBiomassRowKey;
  label: string;
  /** 売れた1kgあたり (販売率で割った後)。 */
  perKg: number;
  /** うち株固有 (閉鎖系の追加など) の分。 */
  strainSpecificPerKg: number;
}

export interface CostBiomassCost {
  strain: CostStrain | null;
  strainLabel: string;
  /** 年間生産能力 (kg-DCW/年)。CAPEX・年額固定費・作業はこの量で割って1kgあたりにする。 */
  capacityKgYear: number;
  /** 販売率 (0〜1)。生産した菌体のうち売れる割合。 */
  salesRate: number;
  /** 売れる量 (kg-DCW/年) = 年間生産能力 × 販売率。 */
  soldKgYear: number;
  /** 製造拠点の初期投資 (円)。償却年額 = 初期投資 ÷ 耐用年数。 */
  capexInitial: number;
  /** 製造拠点 CAPEX 行の耐用年数の最小・最大 (年)。行ごとに違うことがある。 */
  usefulLifeMinYears: number | null;
  usefulLifeMaxYears: number | null;
  capexAnnual: number;
  fixedOpexAnnual: number;
  /** 製造拠点の作業の年額 (安全委員会・検査・フィルター交換など)。 */
  tasksAnnual: number;
  /** 菌体量に比例する費用 (生産1kgあたり)。 */
  variablePerKg: number;
  /** 明細と作業から計算した、生産1kgあたりの原価 (販売率で割る前)。 */
  productionPerKg: number;
  /** 明細と作業から計算した、売れた1kgあたりの原価。 */
  computedPerKg: number;
  /** 上書き値 (生産1kgあたり)。 */
  overridePerKg: number | null;
  /** 第2段で使う原価 (売れた1kgあたり)。上書き値があれば それ ÷ 販売率。 */
  perKg: number;
  /** 株固有の行 (閉鎖系の追加など) が 売れた1kg あたりに乗せている額。 */
  strainSpecificPerKg: number;
  rows: CostBiomassRow[];
}

export interface CostConfidenceSlice {
  grade: CostConfidence | "未設定";
  perUnit: number;
  share: number;
}

export interface CostUncertainItem {
  costItemId: string;
  label: string;
  scenario: string;
  costType: string;
  perUnit: number;
  confidence: CostConfidence | null;
  sourceKind: string | null;
  owner: string | null;
}

export type CostBreakdownKey = "biomass" | "tasks" | "postProcess" | "siteOpex" | "siteCapex" | "tank";

export const BREAKDOWN_LABEL: Record<CostBreakdownKey, string> = {
  biomass: "菌体費（第1段の原価 × 使い切る菌体量）",
  tasks: "現場と巡回の作業（工数 × 単価 ＋ 経費）",
  postProcess: "使用済み菌体の後処理",
  siteOpex: "現場の消耗品・電力など",
  siteCapex: "現場設備の償却",
  tank: "新設槽の償却",
};
const BREAKDOWN_ORDER: CostBreakdownKey[] = ["biomass", "tasks", "postProcess", "siteOpex", "siteCapex", "tank"];

export interface CostBreakdownSlice {
  key: CostBreakdownKey;
  label: string;
  perUnit: number;
}

export interface CostScenarioResult {
  key: string;
  application: CostApplication | null;
  applicationLabel: string;
  method: CostMethod;
  tankMode: CostTankMode;
  label: string;

  /** 現場の明細のうち OPEX (後処理を含む)。 */
  siteItemOpexAnnual: number;
  siteItemOpexPerUnit: number;
  /** 現場と巡回の作業。 */
  siteTaskAnnual: number;
  siteTaskPerUnit: number;
  /** 現場の OPEX 合計 = 明細 + 作業。 */
  siteOpexAnnual: number;
  siteOpexPerUnit: number;
  siteCapexAnnual: number;
  siteCapexPerUnit: number;
  tankAnnual: number;
  tankPerUnit: number;
  siteTotalPerUnit: number;
  siteCapexTotal: number;

  /** 第1段の原価 × 必要菌体量。旧版の「中央培養コスト」に当たる。 */
  centralCapexAnnual: number;
  centralOpexAnnual: number;
  centralCapexPerUnit: number;
  centralOpexPerUnit: number;
  centralTotalPerUnit: number;
  biomassKgPerUnit: number;

  opexTotalAnnual: number;
  opexTotalPerUnit: number;
  capexTotalAnnual: number;
  capexTotalPerUnit: number;

  totalAnnual: number;
  totalPerUnit: number;
  revenueAnnual: number;
  profitPerUnit: number;
  profitAnnual: number;
  marginRate: number;

  breakEvenPricePerUnit: number;
  requiredPricePerUnit: number;
  allowedTotalCostPerUnit: number;
  gapToAllowedPerUnit: number;
  gapToTargetPerUnit: number | null;

  /** 株固有の行 (閉鎖系の追加など)。現場の明細・作業と、第1段から配った分の合計。 */
  strainSpecificPerUnit: number;
  /** 使用済み菌体の後処理 (酸処理・処分など)。総コストに含む。 */
  postProcessPerUnit: number;
  /** 総コストの内訳。足すと totalPerUnit になる。 */
  breakdown: CostBreakdownSlice[];

  confidenceBreakdown: CostConfidenceSlice[];
  topUncertain: CostUncertainItem[];
}

export interface CostComputation {
  /** 選択中の株と、最初の用途で導いた物量。明細表の円/単位の分母に使う。 */
  derived: CostDerived;
  derivedByApplication: Array<{ application: CostApplication | null; derived: CostDerived }>;
  strain: CostStrain | null;
  strains: CostStrain[];
  applications: CostApplication[];
  biomass: CostBiomassCost;
  biomassByStrain: CostBiomassCost[];
  scenarios: CostScenarioResult[];
}

/**
 * 明細行の表示名。原典スプレッドシートは行によって「中項目」と「小項目」の
 * どちらが具体名かが入れ替わっている (CAPEXは中項目が具体名、OPEXは小項目が具体名)。
 * 片方だけ拾うと「分離設備」「交換部品」のような分類名だけが並ぶので、両方を出す。
 */
export function costItemLabel(item: Pick<CostItem, "groupLabel" | "midLabel" | "leafLabel">): string {
  const parts = [item.midLabel, item.leafLabel].filter((v): v is string => !!v && v.trim() !== "");
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join(" / ") : item.groupLabel || "(名称なし)";
}

export const CONFIDENCE_LABEL: Record<string, string> = {
  S: "S 確定",
  A: "A 概算",
  B: "B 見積前",
  C: "C 仮置き",
  H: "H 仮説",
  未設定: "未設定",
};

const CONFIDENCE_ORDER: Array<CostConfidence | "未設定"> = ["S", "A", "B", "C", "H", "未設定"];
const NO_SELECTION: CostSelection = { strain: null, application: null };

function safeDiv(a: number, b: number): number {
  return b === 0 || !Number.isFinite(b) ? 0 : a / b;
}

export function scopeApplies(
  row: { strain: CostStrain | null; application: CostApplication | null },
  sel: CostSelection
): boolean {
  const strainOk = row.strain === null || row.strain === undefined || row.strain === sel.strain;
  const appOk = row.application === null || row.application === undefined || row.application === sel.application;
  return strainOk && appOk;
}

/** 株と用途の選択に対して、同じ role_key のうち最も具体的な行を返す。 */
export function resolveAssumption(
  assumptions: CostAssumption[],
  roleKey: string,
  sel: CostSelection = NO_SELECTION
): CostAssumption | undefined {
  let best: CostAssumption | undefined;
  let bestScore = -1;
  for (const a of assumptions) {
    if (a.roleKey !== roleKey || !scopeApplies(a, sel)) continue;
    const score = (a.strain ? 2 : 0) + (a.application ? 1 : 0);
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}

function roleValue(assumptions: CostAssumption[], roleKey: string, fallback: number, sel: CostSelection = NO_SELECTION): number {
  const v = resolveAssumption(assumptions, roleKey, sel)?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** データに現れる株。表示順は 強化株 → 自然株。 */
export function listStrains(bundle: CostInputs): CostStrain[] {
  const seen = new Set<string>();
  for (const r of [...bundle.assumptions, ...bundle.items, ...(bundle.tasks ?? [])]) if (r.strain) seen.add(r.strain);
  return STRAIN_ORDER.filter((s) => seen.has(s));
}

/** データに現れる用途。表示順は 色素分解 → 金属回収。 */
export function listApplications(bundle: CostInputs): CostApplication[] {
  const seen = new Set<string>();
  for (const r of [...bundle.assumptions, ...bundle.items, ...(bundle.tasks ?? [])]) if (r.application) seen.add(r.application);
  return APPLICATION_ORDER.filter((a) => seen.has(a));
}

/** 販売率 (0.01〜1)。前提が無ければ全量が売れる 1。 */
export function salesRateOf(assumptions: CostAssumption[], sel: CostSelection = NO_SELECTION): number {
  const pct = roleValue(assumptions, "sales_rate", 100, sel);
  return Math.min(Math.max(pct, 1), 100) / 100;
}

export function deriveCostBasis(assumptions: CostAssumption[], sel: CostSelection = NO_SELECTION): CostDerived {
  const batchVolume = roleValue(assumptions, "batch_volume", 100, sel);
  const operatingDays = roleValue(assumptions, "operating_days", 300, sel);
  const utilization = roleValue(assumptions, "utilization", 1, sel);
  const annualBatches = operatingDays * utilization;
  const annualVolume = batchVolume * annualBatches;

  const concentration = roleValue(assumptions, "target_concentration", 50, sel);
  const kPpm = roleValue(assumptions, "k_ppm", 1, sel);
  const alpha = roleValue(assumptions, "uptake_alpha", 0.05, sel);
  const eta = roleValue(assumptions, "recovery_eta", 90, sel);
  const cellDensity = roleValue(assumptions, "cell_density", 5, sel);
  const reuseCount = Math.max(roleValue(assumptions, "reuse_count", 1, sel), 1);

  const requiredBiomassPerM3 = safeDiv(concentration * kPpm, alpha);
  const biomassWithLossPerM3 = safeDiv(requiredBiomassPerM3, eta / 100);
  const requiredBrothPerM3 = safeDiv(biomassWithLossPerM3, cellDensity);
  const biomassKgPerUnit = biomassWithLossPerM3 / reuseCount / 1000;

  const perDelivery = Math.max(roleValue(assumptions, "patrol_batches_per_delivery", 5, sel), 1);

  return {
    salePrice: roleValue(assumptions, "sale_price", 500, sel),
    annualBatches,
    annualVolume,
    targetConcentration: concentration,
    uptakeAlpha: alpha,
    recoveryEta: eta,
    requiredBiomassPerM3,
    biomassWithLossPerM3,
    requiredBrothPerM3,
    biomassKgPerUnit,
    annualBiomassKg: biomassKgPerUnit * annualVolume,
    biomassFactor: safeDiv(biomassWithLossPerM3 / reuseCount, BASELINE_BIOMASS_G_PER_M3),
    brothFactor: safeDiv(requiredBrothPerM3 / reuseCount, BASELINE_BROTH_L_PER_M3),
    reuseCount,
    visitsPerYear: safeDiv(annualBatches, Math.max(reuseCount, perDelivery)),
    moduleSwapsPerYear: safeDiv(annualBatches, roleValue(assumptions, "module_durability_batches", 50, sel)),
    membraneSwapsPerYear: safeDiv(1, roleValue(assumptions, "membrane_life_years", 3, sel)),
  };
}

/** 単価が変数へ連動する行の実効単価。連動しない行は unit_price をそのまま返す。 */
export function effectiveUnitPrice(
  item: CostItem,
  assumptions: CostAssumption[],
  derived: CostDerived,
  sel: CostSelection = NO_SELECTION
): number {
  const batchVolume = roleValue(assumptions, "batch_volume", 100, sel);
  switch (item.priceRule) {
    case "biomass":
      return item.unitPrice * derived.biomassFactor;
    case "broth":
      return item.unitPrice * derived.brothFactor;
    case "module_swap":
      return safeDiv(
        roleValue(assumptions, "module_unit_price", 1_500_000, sel),
        roleValue(assumptions, "module_durability_batches", 50, sel) * batchVolume
      );
    case "power_circulation":
      return safeDiv(
        roleValue(assumptions, "power_kw_circulation", 1.5, sel) *
          roleValue(assumptions, "hrt_circulation", 4, sel) *
          roleValue(assumptions, "power_unit_price", 27, sel),
        batchVolume
      );
    case "power_injection":
      return safeDiv(
        roleValue(assumptions, "power_kw_injection", 2.5, sel) *
          roleValue(assumptions, "hrt_injection", 4, sel) *
          roleValue(assumptions, "power_unit_price", 27, sel),
        batchVolume
      );
    case "spent_disposal":
      // 乾燥菌体 1kg を処分するときの額 = 脱水後の湿重量倍率 × 汚泥の処分単価
      return (
        roleValue(assumptions, "spent_wet_factor", 5, sel) * roleValue(assumptions, "sludge_disposal_price", 35, sel)
      );
    default:
      return item.unitPrice;
  }
}

/**
 * 1行あたりの年間発生額 (円/年)。内訳行は親の小計に含まれるため 0。
 * 製造拠点の「毎kg菌体比例」行は第1段で1kgあたりへ畳むので、ここでは現場で使う菌体量を掛けた額を返す。
 */
export function annualAmount(
  item: CostItem,
  assumptions: CostAssumption[],
  derived: CostDerived,
  sel: CostSelection = NO_SELECTION
): number {
  if (item.isBreakdown || item.basis === "内訳") return 0;
  const price = effectiveUnitPrice(item, assumptions, derived, sel);
  switch (item.basis) {
    case "初期投資配賦":
      return safeDiv(item.quantity * price * item.annualFactor, item.usefulLifeYears ?? 0);
    case "毎m³比例":
      return item.quantity * price * item.annualFactor * derived.annualVolume;
    case "バッチ連動":
      return item.quantity * price * item.annualFactor;
    case "毎kg菌体比例":
      return item.quantity * price * item.annualFactor * derived.biomassKgPerUnit * derived.annualVolume;
    case "年額固定":
      return item.quantity * price * item.annualFactor;
    default:
      return 0;
  }
}

/** 製造拠点の1行が、生産1kgあたりに乗せる額 (販売率で割る前)。明細表の円/kg列にも使う。 */
export function centralItemPerKg(item: CostItem, assumptions: CostAssumption[], capacity: number, sel: CostSelection): number {
  if (item.isBreakdown || item.basis === "内訳") return 0;
  const derived = deriveCostBasis(assumptions, sel);
  const price = effectiveUnitPrice(item, assumptions, derived, sel);
  switch (item.basis) {
    case "初期投資配賦":
      return safeDiv(safeDiv(item.quantity * price * item.annualFactor, item.usefulLifeYears ?? 0), capacity);
    case "年額固定":
      return safeDiv(item.quantity * price * item.annualFactor, capacity);
    case "毎kg菌体比例":
      return item.quantity * price * item.annualFactor;
    default:
      return 0;
  }
}

export interface CostTaskAmount {
  /** 年間回数。 */
  occurrences: number;
  /** 使った作業単価 (円/時)。 */
  rate: number;
  /** 行に単価が無く、共通の作業単価を使ったか。 */
  usesCommonRate: boolean;
  hours: number;
  /** 年間の工数 (人時)。 */
  annualHours: number;
  laborAnnual: number;
  expenseAnnual: number;
  annual: number;
}

/**
 * 作業1行の年額。年額 = 年間回数 × (1回の工数 × 作業単価 + 1回の経費)。
 * 製造拠点の作業は第1段の固定費に入るので、回数の決め方によらず固定の回数で数える。
 */
export function taskAmount(
  task: CostTask,
  assumptions: CostAssumption[],
  derived: CostDerived,
  sel: CostSelection = NO_SELECTION
): CostTaskAmount {
  const fixedCount = Math.max(task.countPerYear ?? 0, 0);
  const occurrences =
    task.scenario === "中央培養" || task.countDriver === "fixed" ? fixedCount
    : task.countDriver === "batch" ? derived.annualBatches
    : task.countDriver === "visit" ? derived.visitsPerYear
    : task.countDriver === "module_swap" ? derived.moduleSwapsPerYear
    : task.countDriver === "membrane_swap" ? derived.membraneSwapsPerYear
    : 0;
  const usesCommonRate = task.hourlyRate === null || task.hourlyRate === undefined || !Number.isFinite(task.hourlyRate);
  const rate = usesCommonRate ? roleValue(assumptions, "labor_rate", 4000, sel) : (task.hourlyRate as number);
  const hours = typeof task.hoursPerOccurrence === "number" && Number.isFinite(task.hoursPerOccurrence) ? Math.max(task.hoursPerOccurrence, 0) : 0;
  const expense = Number.isFinite(task.expensePerOccurrence) ? Math.max(task.expensePerOccurrence, 0) : 0;
  const laborAnnual = occurrences * hours * rate;
  const expenseAnnual = occurrences * expense;
  return {
    occurrences,
    rate,
    usesCommonRate,
    hours,
    annualHours: occurrences * hours,
    laborAnnual,
    expenseAnnual,
    annual: laborAnnual + expenseAnnual,
  };
}

/** 作業を、確度の帯グラフや「精度を下げている項目」で明細と同じ形に並べるための変換。 */
function taskAsItem(task: CostTask): CostItem {
  return {
    costItemId: task.costTaskId,
    scenario: task.scenario,
    costType: "OPEX",
    groupLabel: task.groupLabel,
    midLabel: null,
    leafLabel: task.label,
    basis: "年額固定",
    quantity: 1,
    quantityUnit: null,
    unitPrice: 0,
    unitPriceUnit: null,
    priceRule: null,
    annualFactor: 1,
    usefulLifeYears: null,
    isBreakdown: false,
    confidence: task.confidence,
    sourceKind: task.sourceKind,
    owner: task.owner,
    note: task.note,
    visibility: task.visibility,
    sortOrder: task.sortOrder,
    strain: task.strain,
    application: task.application,
  };
}

/** 第1段: 株ごとの菌体の製造原価 (円/kg-DCW)。用途には依存しない。 */
export function computeBiomassCost(bundle: CostInputs, strain: CostStrain | null): CostBiomassCost {
  const sel: CostSelection = { strain, application: null };
  const { assumptions, items } = bundle;
  const tasks = bundle.tasks ?? [];
  const capacity = roleValue(assumptions, "culture_capacity_kg_year", 0, sel);
  const salesRate = salesRateOf(assumptions, sel);
  const derived = deriveCostBasis(assumptions, sel);
  const central = items.filter(
    (i) => i.scenario === "中央培養" && !i.isBreakdown && i.basis !== "内訳" && i.costType !== "参考" && scopeApplies(i, sel)
  );
  const centralTasks = tasks.filter((t) => t.scenario === "中央培養" && scopeApplies(t, sel));

  const rows: CostBiomassRow[] = [
    { key: "capex", label: "培養設備の償却", perKg: 0, strainSpecificPerKg: 0 },
    { key: "fixed", label: "年ごとの固定費（品質確認など）", perKg: 0, strainSpecificPerKg: 0 },
    { key: "tasks", label: "製造拠点の作業（安全委員会・検査・交換など）", perKg: 0, strainSpecificPerKg: 0 },
    { key: "variable", label: "菌体量に比例する費用（培地・CO2・濃縮など）", perKg: 0, strainSpecificPerKg: 0 },
  ];
  const rowOf = (key: CostBiomassRowKey) => rows.find((r) => r.key === key) as CostBiomassRow;
  let capexAnnual = 0;
  let capexInitial = 0;
  let fixedOpexAnnual = 0;
  let tasksAnnual = 0;
  let variablePerKg = 0;
  const lives: number[] = [];
  for (const i of central) {
    const perKg = centralItemPerKg(i, assumptions, capacity, sel);
    const row = rowOf(i.basis === "初期投資配賦" ? "capex" : i.basis === "年額固定" ? "fixed" : "variable");
    row.perKg += perKg;
    if (i.strain) row.strainSpecificPerKg += perKg;
    if (i.basis === "初期投資配賦") {
      capexAnnual += safeDiv(i.quantity * i.unitPrice * i.annualFactor, i.usefulLifeYears ?? 0);
      capexInitial += i.quantity * i.unitPrice;
      if (i.usefulLifeYears && i.quantity * i.unitPrice > 0) lives.push(i.usefulLifeYears);
    }
    else if (i.basis === "年額固定") fixedOpexAnnual += i.quantity * i.unitPrice * i.annualFactor;
    else if (i.basis === "毎kg菌体比例") variablePerKg += perKg;
  }
  for (const t of centralTasks) {
    const annual = taskAmount(t, assumptions, derived, sel).annual;
    tasksAnnual += annual;
    const perKg = safeDiv(annual, capacity);
    rowOf("tasks").perKg += perKg;
    if (t.strain) rowOf("tasks").strainSpecificPerKg += perKg;
  }

  const productionPerKg = rows.reduce((t, r) => t + r.perKg, 0);
  const productionStrainSpecificPerKg = rows.reduce((t, r) => t + r.strainSpecificPerKg, 0);
  // 売れ残りも作った分の費用はかかるので、全行を販売率で割る。
  for (const r of rows) {
    r.perKg = r.perKg / salesRate;
    r.strainSpecificPerKg = r.strainSpecificPerKg / salesRate;
  }
  const overrideValue = resolveAssumption(assumptions, "biomass_cost_per_kg_override", sel)?.value;
  const overridePerKg = typeof overrideValue === "number" && Number.isFinite(overrideValue) && overrideValue > 0 ? overrideValue : null;

  return {
    strain,
    strainLabel: strain ? STRAIN_LABEL[strain] : "",
    capacityKgYear: capacity,
    salesRate,
    soldKgYear: capacity * salesRate,
    capexInitial,
    usefulLifeMinYears: lives.length > 0 ? Math.min(...lives) : null,
    usefulLifeMaxYears: lives.length > 0 ? Math.max(...lives) : null,
    capexAnnual,
    fixedOpexAnnual,
    tasksAnnual,
    variablePerKg,
    productionPerKg,
    computedPerKg: productionPerKg / salesRate,
    overridePerKg,
    perKg: (overridePerKg ?? productionPerKg) / salesRate,
    strainSpecificPerKg: overridePerKg !== null ? 0 : productionStrainSpecificPerKg / salesRate,
    rows,
  };
}

const METHODS: CostMethod[] = ["循環", "投入"];
const TANK_MODES: CostTankMode[] = ["既設", "新設"];

export function computeCostModel(
  bundle: CostInputs & { model?: Partial<CostModel> },
  options: { strain?: CostStrain | null } = {}
): CostComputation {
  const { assumptions, items } = bundle;
  const tasks = bundle.tasks ?? [];
  const targetTotal = bundle.model?.targetTotalCostPerUnit ?? null;
  const targetMargin = bundle.model?.targetMarginRate ?? null;

  const strains = listStrains(bundle);
  const applications = listApplications(bundle);
  const strain = options.strain !== undefined && options.strain !== null && strains.includes(options.strain)
    ? options.strain
    : strains[0] ?? null;
  const appList: Array<CostApplication | null> = applications.length > 0 ? applications : [null];

  const biomass = computeBiomassCost(bundle, strain);
  const biomassByStrain = (strains.length > 0 ? strains : [null]).map((s) => computeBiomassCost(bundle, s));
  const capexRow = biomass.rows.find((r) => r.key === "capex");
  const capexShare = biomass.overridePerKg !== null ? 0 : safeDiv(capexRow?.perKg ?? 0, biomass.perKg);
  const centralSel: CostSelection = { strain, application: null };
  const centralDerived = deriveCostBasis(assumptions, centralSel);

  const live = items.filter((i) => !i.isBreakdown && i.basis !== "内訳");
  const newTankCapex = roleValue(assumptions, "new_tank_capex", 18_000_000);
  const tankLife = roleValue(assumptions, "tank_life_years", 10);

  const scenarios: CostScenarioResult[] = [];
  const derivedByApplication: CostComputation["derivedByApplication"] = [];

  for (const application of appList) {
    const sel: CostSelection = { strain, application };
    const derived = deriveCostBasis(assumptions, sel);
    derivedByApplication.push({ application, derived });
    const volume = derived.annualVolume;
    const perUnit = (annual: number) => safeDiv(annual, volume);
    const amount = (i: CostItem) => annualAmount(i, assumptions, derived, sel);
    const taskAnnual = (t: CostTask) => taskAmount(t, assumptions, derived, sel).annual;

    const biomassAnnual = biomass.perKg * derived.biomassKgPerUnit * volume;
    const centralCapexAnnual = biomassAnnual * capexShare;
    const centralOpexAnnual = biomassAnnual - centralCapexAnnual;
    const centralStrainSpecificAnnual = biomass.strainSpecificPerKg * derived.biomassKgPerUnit * volume;

    // 第1段の各行が、この用途で1単位あたりいくらを乗せているか。確度の帯グラフ用。
    const centralContrib: Array<{ item: CostItem; annual: number }> = biomass.overridePerKg !== null
      ? []
      : [
          ...live
            .filter((i) => i.scenario === "中央培養" && i.costType !== "参考" && scopeApplies(i, centralSel))
            .map((i) => ({
              item: i,
              annual: (centralItemPerKg(i, assumptions, biomass.capacityKgYear, centralSel) / biomass.salesRate) * derived.biomassKgPerUnit * volume,
            })),
          ...tasks
            .filter((t) => t.scenario === "中央培養" && scopeApplies(t, centralSel))
            .map((t) => ({
              item: taskAsItem(t),
              annual: (safeDiv(taskAmount(t, assumptions, centralDerived, centralSel).annual, biomass.capacityKgYear) / biomass.salesRate) *
                derived.biomassKgPerUnit * volume,
            })),
        ];

    for (const method of METHODS) {
      const own = live.filter((i) => (i.scenario === method || i.scenario === "共通") && scopeApplies(i, sel));
      const counted = own.filter((i) => i.costType !== "参考");
      const siteTasks = tasks.filter((t) => (t.scenario === method || t.scenario === "共通") && scopeApplies(t, sel));
      const siteItemOpexAnnual = counted.filter((i) => i.costType === "OPEX").reduce((s, i) => s + amount(i), 0);
      const siteTaskAnnual = siteTasks.reduce((s, t) => s + taskAnnual(t), 0);
      const siteOpexAnnual = siteItemOpexAnnual + siteTaskAnnual;
      const siteCapexAnnual = counted.filter((i) => i.costType === "CAPEX").reduce((s, i) => s + amount(i), 0);
      const siteCapexBase = items
        .filter((i) => (i.scenario === method || i.scenario === "共通") && i.costType === "CAPEX" && !i.isBreakdown && scopeApplies(i, sel))
        .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const siteStrainSpecificAnnual =
        counted.filter((i) => i.strain).reduce((s, i) => s + amount(i), 0) +
        siteTasks.filter((t) => t.strain).reduce((s, t) => s + taskAnnual(t), 0);
      const postAnnual = counted
        .filter((i) => i.costType === "OPEX" && i.groupLabel !== null && POST_PROCESS_GROUPS.has(i.groupLabel))
        .reduce((s, i) => s + amount(i), 0);

      const contributing: Array<{ item: CostItem; annual: number }> = [
        ...counted.map((i) => ({ item: i, annual: amount(i) })),
        ...siteTasks.map((t) => ({ item: taskAsItem(t), annual: taskAnnual(t) })),
        ...centralContrib,
        ...(biomass.overridePerKg !== null
          ? [{
              item: {
                costItemId: "biomass-override",
                scenario: "中央培養",
                costType: "OPEX",
                leafLabel: "菌体の製造原価（上書き値）",
                midLabel: null,
                groupLabel: "第1段",
                confidence: resolveAssumption(assumptions, "biomass_cost_per_kg_override", centralSel)?.confidence ?? null,
                sourceKind: resolveAssumption(assumptions, "biomass_cost_per_kg_override", centralSel)?.sourceKind ?? null,
                owner: null,
              } as unknown as CostItem,
              annual: biomassAnnual,
            }]
          : []),
      ];

      for (const tankMode of TANK_MODES) {
        const tankAnnual = tankMode === "新設" ? safeDiv(newTankCapex, tankLife) : 0;
        const opexTotalAnnual = siteOpexAnnual + centralOpexAnnual;
        const capexTotalAnnual = siteCapexAnnual + tankAnnual + centralCapexAnnual;
        const totalAnnual = opexTotalAnnual + capexTotalAnnual;
        const totalPerUnit = perUnit(totalAnnual);
        const price = derived.salePrice;

        const rows = [
          ...contributing,
          ...(tankMode === "新設"
            ? [{
                item: {
                  costItemId: `${method}-tank`,
                  scenario: "共通",
                  costType: "CAPEX",
                  leafLabel: "新設槽（コンクリート地下タンク）",
                  midLabel: null,
                  groupLabel: "槽",
                  confidence: "B" as CostConfidence,
                  sourceKind: "先生回答",
                  owner: "ダイキアクシス",
                } as unknown as CostItem,
                annual: tankAnnual,
              }]
            : []),
        ];

        const byGrade = new Map<CostConfidence | "未設定", number>();
        for (const r of rows) {
          const g = (r.item.confidence ?? "未設定") as CostConfidence | "未設定";
          byGrade.set(g, (byGrade.get(g) ?? 0) + r.annual);
        }
        const confidenceBreakdown: CostConfidenceSlice[] = CONFIDENCE_ORDER
          .filter((g) => (byGrade.get(g) ?? 0) !== 0)
          .map((g) => ({
            grade: g,
            perUnit: perUnit(byGrade.get(g) ?? 0),
            share: safeDiv(byGrade.get(g) ?? 0, totalAnnual),
          }));

        const topUncertain: CostUncertainItem[] = rows
          .filter((r) => r.item.confidence === "H" || r.item.confidence === "C")
          .map((r) => ({
            costItemId: r.item.costItemId,
            label: costItemLabel(r.item),
            scenario: r.item.scenario,
            costType: r.item.costType,
            perUnit: perUnit(r.annual),
            confidence: r.item.confidence,
            sourceKind: r.item.sourceKind,
            owner: r.item.owner,
          }))
          .sort((a, b) => b.perUnit - a.perUnit)
          .slice(0, 8);

        const slices: Record<CostBreakdownKey, number> = {
          biomass: perUnit(biomassAnnual),
          tasks: perUnit(siteTaskAnnual),
          postProcess: perUnit(postAnnual),
          siteOpex: perUnit(siteItemOpexAnnual - postAnnual),
          siteCapex: perUnit(siteCapexAnnual),
          tank: perUnit(tankAnnual),
        };

        const marginForRequired = targetMargin ?? 0;
        const allowedTotalCostPerUnit = price * (1 - marginForRequired);
        const appLabel = application ? APPLICATION_LABEL[application] : "";

        scenarios.push({
          key: `${application ?? "all"}:${method}-${tankMode}`,
          application,
          applicationLabel: appLabel,
          method,
          tankMode,
          label: `${METHOD_LABEL[method]}／${tankMode}`,

          siteItemOpexAnnual,
          siteItemOpexPerUnit: perUnit(siteItemOpexAnnual),
          siteTaskAnnual,
          siteTaskPerUnit: perUnit(siteTaskAnnual),
          siteOpexAnnual,
          siteOpexPerUnit: perUnit(siteOpexAnnual),
          siteCapexAnnual: siteCapexAnnual + tankAnnual,
          siteCapexPerUnit: perUnit(siteCapexAnnual + tankAnnual),
          tankAnnual,
          tankPerUnit: perUnit(tankAnnual),
          siteTotalPerUnit: perUnit(siteOpexAnnual + siteCapexAnnual + tankAnnual),
          siteCapexTotal: siteCapexBase + (tankMode === "新設" ? newTankCapex : 0),

          centralCapexAnnual,
          centralOpexAnnual,
          centralCapexPerUnit: perUnit(centralCapexAnnual),
          centralOpexPerUnit: perUnit(centralOpexAnnual),
          centralTotalPerUnit: perUnit(biomassAnnual),
          biomassKgPerUnit: derived.biomassKgPerUnit,

          opexTotalAnnual,
          opexTotalPerUnit: perUnit(opexTotalAnnual),
          capexTotalAnnual,
          capexTotalPerUnit: perUnit(capexTotalAnnual),

          totalAnnual,
          totalPerUnit,
          revenueAnnual: price * volume,
          profitPerUnit: price - totalPerUnit,
          profitAnnual: (price - totalPerUnit) * volume,
          marginRate: safeDiv(price - totalPerUnit, price),

          breakEvenPricePerUnit: totalPerUnit,
          requiredPricePerUnit: safeDiv(totalPerUnit, 1 - marginForRequired),
          allowedTotalCostPerUnit,
          gapToAllowedPerUnit: allowedTotalCostPerUnit - totalPerUnit,
          gapToTargetPerUnit: targetTotal === null ? null : targetTotal - totalPerUnit,

          strainSpecificPerUnit: perUnit(siteStrainSpecificAnnual + centralStrainSpecificAnnual),
          postProcessPerUnit: perUnit(postAnnual),
          breakdown: BREAKDOWN_ORDER.map((key) => ({ key, label: BREAKDOWN_LABEL[key], perUnit: slices[key] })),

          confidenceBreakdown,
          topUncertain,
        });
      }
    }
  }

  return {
    derived: derivedByApplication[0]?.derived ?? deriveCostBasis(assumptions, { strain, application: null }),
    derivedByApplication,
    strain,
    strains,
    applications,
    biomass,
    biomassByStrain,
    scenarios,
  };
}

/** 外部 (workspace_account) へ返す前に internal 行を落とす。 */
export function toSharedBundle(bundle: CostModelBundle): CostModelBundle | null {
  if (bundle.model.visibility !== "workspace_shared") return null;
  return {
    model: bundle.model,
    assumptions: bundle.assumptions.filter((a) => a.visibility === "workspace_shared"),
    items: bundle.items.filter((i) => i.visibility === "workspace_shared"),
    tasks: (bundle.tasks ?? []).filter((t) => t.visibility === "workspace_shared"),
    questions: bundle.questions.filter((q) => q.visibility === "workspace_shared"),
    notes: bundle.notes.filter((n) => n.visibility === "workspace_shared"),
  };
}
