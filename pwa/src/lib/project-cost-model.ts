// PJコックピット / PJワークスペース「コスト試算」タブの計算エンジン。
//
// 正本は project_cost_assumptions (変数)・project_cost_items (明細)・project_cost_tasks (作業リスト)。
// ここは純関数だけを置く。DB アクセスも React も持たない。
//
// 二段階で計算する (2026-09-13 まさ確定):
//   第1段 菌体の製造原価 (円/kg-DCW) … 株 (強化株 / 自然株) ごとに、菌体の製造拠点の明細と作業から出す
//     生産1kgあたり = (培養設備の償却年額 + 年額固定費 + 製造拠点の作業) ÷ 年に作る量 + 菌体量に比例する費用
//     売れた1kgあたり = 生産1kgあたり ÷ 販売率。上書き値 (biomass_cost_per_kg_override) があれば生産1kgあたりをそれに置き換える
//     年に作る量は入力ではなく計算で出す (まさ 2026-09-14「年間の生産能力は入力値じゃなくて計算結果にしてほしい」)。
//       年に作る量 = (オンサイトの年間処理量 × オンサイトで使い切る菌体量 ＋ オフサイトの年間処理量 × オフサイトで使い切る菌体量) ÷ 販売率。
//       用途ごとに、その用途だけで処理したときの量
//       オフサイトは、売価 (offsite_sale_price) と年間処理量 (offsite_annual_volume) をオンサイトと別に持てる
//       (まさ 2026-09-14「オフサイトは売価も処理量も別に分けて試算したい」「将来的にサイドビジネス的に、オフサイトもやれたらいいかな」)。
//       対象物質の濃さ (offsite_target_concentration) もオフサイトだけ別に持てる。引き取る液は排水より濃いので、
//       使い切る菌体量はオフサイトの濃さで出す (まさ 2026-09-14「置いて」＝オフサイトに別の液の濃さを置く)。
//       同じ製造拠点で両方の菌体を作るので、年に作る量は両方の量を足して出す。前提が無い試算は、オフサイトもオンサイトの値を使う
//       製造拠点の明細は培養設備の1系列 (culture_line_capacity_kg_year で年に作れる量) として、年に作る量 ÷ 1系列の量 だけ並べる。
//       設備の償却・年額固定費・系列ごとの作業 (count_driver = production_line) は系列の数だけ増え、拠点に1つの作業 (fixed) は増えない
//     年間処理量の前提が無い試算は、これまでどおり年間生産能力 (culture_capacity_kg_year) をそのまま年に作る量として使う (系列は1つ)
//   第2段 用途別の処理原価 (円/単位) … 第1段の原価を一定として、色素分解 / 金属回収ごとに出す
//     必要菌体量 (kg-DCW/単位) = 対象物質濃度 × k_ppm ÷ 取り込み効率α ÷ 菌体回収率η ÷ 菌体使用回数 ÷ 1000
//     総コスト = 第1段の原価 × 必要菌体量 + 処理の明細 + SXがやる作業 (方式・装置・槽・用途・株で絞る)
//
// 菌体の製造拠点 (DB の scenario 値は '中央培養') = 顧客工場では培養せず、SX側の1拠点でまとめて菌体を育て、
// 濃縮して各工場へ運ぶところ。画面では「中央培養」と書かない (まさ 2026-09-13「中央培養ってなに？」)。
//
// 販売率 (sales_rate, %) は、生産した菌体のうち売れる割合。売れ残りも作った分の費用はかかるので、
// 第1段の全費用を売れた量で割る (まさ 2026-09-13。既定は全量が売れる100%)。
//
// 作業 (人件費) は作業リストで持つ。年額 = 年間回数 × (1回の工数 × 作業単価 + 1回の経費)。
// 「人件費を除くと」の併記はしない (まさ 2026-09-13)。工数と単価を入力して制御する。
// 作業の group_label は「作業の流れ」の段 (菌体をつくる → 運ぶ → 処理する → 設備を保つ → 後処理 → 閉鎖系の管理) で、
// sort_order の順に並べる。段ごとの年間工数と作業費を出す (computeTaskFlow)。
//
// 方式は、顧客工場で処理するオンサイトと、排液をSX工場まで運んで処理するオフサイトの2つ (まさ 2026-09-14「方式はオンサイトとオフサイトの2種類」)。
// 装置は、菌体と排液の触れさせ方の違いで、循環カートリッジ (菌体を筒に閉じ込めて排液を通す) と直接投入 (菌体を槽に入れて混ぜ、膜でこし取る) の2つ。
// どちらの方式でも両方の装置を選べる。オフサイトの槽は常に SX工場に新設する。
// 明細・作業の scenario で「どこに効くか」を持つ (scopesFor)。
//
// 作業には「誰がやるか」(performer) を持たせる。SX がやる作業だけを SX の原価に入れる。
// 顧客工場での処理の運転は顧客がやる (まさ 2026-09-14「全顧客の工場にSXの社員が張り付くってありえない」)。
// performer = site の作業は、オンサイトなら顧客、オフサイトなら SX がやる。
// 顧客がやる作業は SX の原価にも作業時間にも数えない。顧客側の時間は SX の試算の対象外 (まさ 2026-09-14「知ったこっちゃなくない？SXのコストに含まれないじゃん」)。
//
// 明細には「誰が持つか」(bearer) を持たせる。値と意味は作業の「誰がやるか」と同じで、SX が持つ明細だけを SX の原価に入れる。
// 顧客工場に置くリアクター (処理設備) は顧客が買う (まさ 2026-09-14「リアクターは顧客が買う前提です」)。
// 顧客工場で出る使用済み菌体の汚泥の処分は顧客がやる (まさ 2026-09-14「これは顧客側がやることじゃないの？」)。
// どちらも bearer = site (オンサイトは顧客、オフサイトは SX工場の設備・処分なので SX)。
// オンサイトの槽を誰が持つかは前提 onsite_tank_bearer (value_text: customer / sx)。顧客が持つときは、槽の既設 / 新設は SX の原価に効かない。
//
// 金属回収は酸で菌体を溶かして金属を取り出すので、菌体使用回数は1回で固定する。使い回せるのは色素分解だけ (まさ 2026-09-13)。
//
// 前提・明細・作業は strain / application 列で「どの株・どの用途に効くか」を持つ。null は共通。
// 同じ role_key が複数あるときは、株と用途の両方が一致する行 > 株だけ > 用途だけ > 共通 の順に採る。

import { quantityPriceTerms, type CalcSegment, type ItemCalc } from "./cost-item-calc.ts";

export type CostConfidence = "S" | "A" | "B" | "C" | "H";
export type CostVisibility = "amd_internal" | "workspace_shared";
export type CostMethod = "循環" | "投入";
export type CostTankMode = "既設" | "新設";
/**
 * 株。enhanced / wild は排水処理の試算の選択（強化株 / 自然株）。
 * secreting は燃料の試算だけで使う「脂質分泌株」で、菌体を集めずに培養液へ出た脂肪酸を回収する形の行に付ける
 * (まさ 2026-09-14「脂質を分泌できる株の開発も理論的には可能っていう話を杉浦先生からもらったので、
 * コスト試算表を「脂質分泌株」のスイッチオンオフで切り替えられるようにしてほしい」)。
 * 排水処理の試算の株の切り替え (strainsInModel → STRAIN_ORDER) には出さない。
 */
export type CostStrain = "enhanced" | "wild" | "secreting";
export type CostApplication = "dye" | "metal";
export type CostLocation = "onsite" | "offsite";
/**
 * 明細・作業が効く範囲。
 * 循環 / 投入 = その装置のとき (方式によらない) / 共通 = いつでも /
 * 現場共通 = オンサイトだけ (顧客工場への巡回・顧客工場内の区画など) / オフサイト = オフサイトだけ (排液の輸送・受け入れ・放流など) /
 * 中央培養 = 菌体の製造拠点 (第1段)。
 */
export type CostScenarioScope = "循環" | "投入" | "共通" | "現場共通" | "オフサイト" | "中央培養";

export interface CostSelection {
  strain: CostStrain | null;
  application: CostApplication | null;
}

export const STRAIN_LABEL: Record<CostStrain, string> = { enhanced: "強化株", wild: "自然株", secreting: "脂質分泌株" };
export const APPLICATION_LABEL: Record<CostApplication, string> = { dye: "色素分解", metal: "金属回収" };
/** 装置の呼び名。 */
export const METHOD_LABEL: Record<CostMethod, string> = { 循環: "循環カートリッジ", 投入: "直接投入" };
export const METHOD_DESCRIPTION: Record<CostMethod, string> = {
  循環: "菌体を筒（カートリッジ）に閉じ込め、ポンプで排液を通して槽へ戻す",
  投入: "菌体を排液の槽に直接入れて混ぜ、処理後に膜でこして取り出す",
};
export const LOCATION_SHORT_LABEL: Record<CostLocation, string> = { onsite: "オンサイト", offsite: "オフサイト" };
export const LOCATION_LABEL: Record<CostLocation, string> = {
  onsite: "オンサイト（顧客工場で処理）",
  offsite: "オフサイト（SX工場まで運んで処理）",
};
export const LOCATION_DESCRIPTION: Record<CostLocation, string> = {
  onsite: "顧客工場の槽の横に、顧客が買ったリアクターを置いて処理する。運転・汚泥の処分と、装置の消耗品・電力・点検は顧客が持ち、SXは菌体の搬入・搬出や交換で巡回する",
  offsite: "排液をタンクローリーでSX工場まで運び、SX工場に新設する槽で処理する。設備と運転と汚泥の処分はSXが持ち、処理水はSX工場から流す",
};
export const OFFSITE_DESCRIPTION = LOCATION_DESCRIPTION.offsite;
export const METHODS: CostMethod[] = ["循環", "投入"];
const STRAIN_ORDER: CostStrain[] = ["enhanced", "wild"];
const APPLICATION_ORDER: CostApplication[] = ["dye", "metal"];

/** 方式と装置の組み合わせで、どの範囲の明細・作業を数えるか。 */
export function scopesFor(location: CostLocation, method: CostMethod): CostScenarioScope[] {
  return [method, "共通", location === "offsite" ? "オフサイト" : "現場共通"];
}

/** オンサイトの槽を誰が持つか。 */
export type CostTankBearer = "sx" | "customer";
export const TANK_BEARER_LABEL: Record<CostTankBearer, string> = { customer: "顧客", sx: "SX" };

/**
 * 槽の選択肢。オフサイトは SX工場に槽を新設するので新設だけ。
 * オンサイトの槽を顧客が持つときは、SX の原価に槽が乗らないので「既設」(SX の負担0) の1つだけにする。
 */
export function tankModesFor(location: CostLocation, onsiteTank: CostTankBearer = "sx"): CostTankMode[] {
  if (location === "offsite") return ["新設"];
  return onsiteTank === "customer" ? ["既設"] : ["既設", "新設"];
}

/**
 * シナリオの短い呼び名 (方式は含めない)。例: 直接投入 / 直接投入・新設槽
 * 槽は、選べるとき (オンサイトの槽を SX が持つとき) だけ名前に入れる。オンサイトの槽が顧客の設備のときと、
 * 常に SX工場に新設するオフサイトは、槽を名前に出さない (まさ 2026-09-14「特出しするものでもないと思うので削除して」)。
 */
export function scenarioLabelOf(location: CostLocation, method: CostMethod, tankMode: CostTankMode, onsiteTank: CostTankBearer = "sx"): string {
  return location === "onsite" && onsiteTank === "sx" ? `${METHOD_LABEL[method]}・${tankMode}槽` : METHOD_LABEL[method];
}

/** シナリオの呼び名 (方式つき)。例: オンサイト・直接投入 / オンサイト・直接投入・新設槽 */
export function scenarioFullLabelOf(location: CostLocation, method: CostMethod, tankMode: CostTankMode, onsiteTank: CostTankBearer = "sx"): string {
  return `${LOCATION_SHORT_LABEL[location]}・${scenarioLabelOf(location, method, tankMode, onsiteTank)}`;
}

/** 画面での呼び名。DB の値 '中央培養' はそのまま使い、表示だけ置き換える。 */
export const PRODUCTION_SITE_LABEL = "菌体の製造拠点";
export const PRODUCTION_SITE_DESCRIPTION =
  "顧客工場では培養せず、SOL側の1拠点でまとめて菌体を育て、濃縮して各工場へ運ぶところ。";
export const SCENARIO_SCOPE_LABEL: Record<CostScenarioScope, string> = {
  中央培養: PRODUCTION_SITE_LABEL,
  共通: "処理（方式・装置によらない）",
  現場共通: "オンサイトだけ（顧客工場）",
  循環: "循環カートリッジの装置",
  投入: "直接投入の装置",
  オフサイト: "オフサイトだけ（SX工場）",
};

/** 金属回収は酸で菌体を溶かして金属を取り出すので、菌体を使い回さない。 */
export const METAL_SINGLE_USE_NOTE = "金属回収は酸で菌体を溶かして金属を取り出すので、使用回数は1回で固定";

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
  | "spent_disposal"
  | "co2_supply"
  | "culture_loss"
  | "medium_supply"
  | "heat_supply"
  | "recovery_capex";

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
  /** 誰が持つか。SX が持つ明細だけを SX の原価に入れる。 */
  bearer: CostItemBearer;
}

/** 作業の年間回数の決め方。 */
export type CostTaskDriver = "fixed" | "batch" | "visit" | "module_swap" | "membrane_swap" | "truck_trip" | "production_line";

export const TASK_DRIVER_LABEL: Record<CostTaskDriver, string> = {
  fixed: "固定の回数",
  batch: "年間バッチ数",
  visit: "訪問回数",
  module_swap: "モジュール交換回数",
  membrane_swap: "膜交換回数",
  truck_trip: "輸送の回数",
  production_line: "系列ごと",
};
export const TASK_DRIVERS: CostTaskDriver[] = ["fixed", "batch", "visit", "module_swap", "membrane_swap", "truck_trip", "production_line"];
/** 菌体の製造拠点の作業が選べる回数の決め方。拠点に1つの作業は固定の回数、培養設備ごとの作業は系列ごと (1系列あたりの回数 × 系列数)。 */
export const PRODUCTION_TASK_DRIVERS: CostTaskDriver[] = ["fixed", "production_line"];
/** 回数を行に入力する決め方 (固定の回数と、1系列あたりの回数)。 */
export function driverUsesCount(driver: CostTaskDriver): boolean {
  return driver === "fixed" || driver === "production_line";
}

/** 作業を誰がやるか。sx = SX / customer = 顧客 / site = 処理する場所の人 (オンサイトは顧客、オフサイトは SX)。 */
export type CostTaskPerformer = "sx" | "customer" | "site";
export const TASK_PERFORMERS: CostTaskPerformer[] = ["sx", "customer", "site"];
export const TASK_PERFORMER_LABEL: Record<CostTaskPerformer, string> = {
  sx: "SX",
  customer: "顧客",
  site: "処理する場所の人（オンサイトは顧客・オフサイトはSX）",
};
export const TASK_PERFORMER_SHORT_LABEL: Record<CostTaskPerformer, string> = { sx: "SX", customer: "顧客", site: "場所による" };

function resolveWho(value: CostTaskPerformer, scenario: CostScenarioScope, location: CostLocation): "sx" | "customer" {
  if (scenario === "中央培養") return "sx";
  if (value === "customer") return "customer";
  if (value === "site") return location === "onsite" ? "customer" : "sx";
  return "sx";
}

/** その方式で、作業を実際に誰がやるか。製造拠点の作業は常に SX。 */
export function resolvePerformer(task: Pick<CostTask, "performer" | "scenario">, location: CostLocation): "sx" | "customer" {
  return resolveWho(task.performer, task.scenario, location);
}

/** 明細の費用を誰が持つか。値と意味は「誰がやるか」と同じ (site = オンサイトは顧客、オフサイトは SX)。 */
export type CostItemBearer = CostTaskPerformer;
export const ITEM_BEARERS: CostItemBearer[] = ["sx", "customer", "site"];
export const ITEM_BEARER_LABEL: Record<CostItemBearer, string> = {
  sx: "SX",
  customer: "顧客",
  site: "処理する場所の持ち主（オンサイトは顧客・オフサイトはSX）",
};
export const ITEM_BEARER_SHORT_LABEL: Record<CostItemBearer, string> = { sx: "SX", customer: "顧客", site: "場所による" };

/** その方式で、明細の費用を実際に誰が持つか。菌体の製造拠点の明細は常に SX。 */
export function resolveBearer(item: Pick<CostItem, "bearer" | "scenario">, location: CostLocation): "sx" | "customer" {
  return resolveWho(item.bearer, item.scenario, location);
}

/** 「運ぶ」に数える作業 (菌体の巡回と、排液の輸送)。内訳ではほかの作業と分けて出す。 */
export function isTransportTask(task: Pick<CostTask, "countDriver">): boolean {
  return task.countDriver === "visit" || task.countDriver === "truck_trip";
}

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
  // 作業単価は作業ごとに持たず、前提の共通の作業単価 (labor_rate) の1つだけを使う
  // (まさ 2026-09-14「工数単価は共通で１つのパラメータで入力するようにして」)。DB の hourly_rate 列は使わない。
  /** 1回あたりの経費 (車両費・部材・外注費など)。 */
  expensePerOccurrence: number;
  /** 誰がやるか。SX がやる作業だけを SX の原価に入れる。 */
  performer: CostTaskPerformer;
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
  "offsite_target_concentration",
  "effluent_target_concentration",
  "k_ppm",
  "uptake_alpha",
  "recovery_eta",
  "reuse_count",
  "business_annual_volume",
  "offsite_sale_price",
  "offsite_annual_volume",
  "culture_capacity_kg_year",
  "culture_line_capacity_kg_year",
  "recovery_facility_capex",
  "recovery_facility_life_years",
  "recovery_line_capacity_kg_year",
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
  "onsite_tank_bearer",
  "spent_wet_factor",
  "sludge_disposal_price",
  "truck_capacity_m3",
  "co2_flue_gas",
  "waste_medium",
  "waste_medium_reduction",
  "waste_medium_growth_factor",
  "waste_heat",
]);

// 旧 price_rule (biomass / broth) の除数。「使い捨て・50ppm・α=0.05・η=90%・5g/L」のときの値。
// 二段階版の SX 明細はもう使っていないが、旧形式の明細を読んでも壊れないように残す。
const BASELINE_BIOMASS_G_PER_M3 = 1111.111111;
const BASELINE_BROTH_L_PER_M3 = 222.222222;

/** 現場の後処理として束ねて見せる group_label。 */
const POST_PROCESS_GROUPS = new Set(["シアノ回収後処理", "使用済み菌体の処分"]);

export interface CostDerived {
  /** 売価 (オンサイト)。 */
  salePrice: number;
  /** オフサイトの売価。前提 offsite_sale_price が無ければオンサイトと同じ。 */
  offsiteSalePrice: number;
  /** オフサイトの売価をオンサイトと別に持っているか。持っているとき、総コスト目標はオフサイトに当てない。 */
  offsitePriceSeparate: boolean;
  annualBatches: number;
  annualVolume: number;
  /** この物量を出した方式。対象物質の濃さだけが方式で変わる (オフサイトは offsite_target_concentration を別に持てる)。 */
  location: CostLocation;
  /** 使い切る菌体量の元にした対象物質の濃さ。オフサイトで別に持つときはオフサイトの濃さ。 */
  targetConcentration: number;
  /** オフサイトの対象物質の濃さをオンサイトと別に持っているか。 */
  offsiteConcentrationSeparate: boolean;
  /** 目標放流水濃度 Cout (effluent_target_concentration。無ければ0で、全量を取り除く)。方式によらず同じ。 */
  effluentConcentration: number;
  /** 取り除く濃さ = max(流入の濃さ − 目標放流水濃度, 0)。 */
  removedConcentration: number;
  uptakeAlpha: number;
  /** 菌体回収率η (%)。処理のあと回収して、次のバッチへ回せる菌体の割合。 */
  recoveryEta: number;
  /** 1バッチの処理に要る菌体量 (g/単位) = 取り除く濃さ × k_ppm ÷ 取り込み効率α。回収率では割らない (中島先生 2026-08-28)。 */
  requiredBiomassPerM3: number;
  /** 新しく入れる菌体の割合 = 新しく入れる菌体 ÷ 1バッチに要る菌体 (freshBiomassShare)。 */
  freshShare: number;
  /** 1バッチごとに新しく入れる菌体量 (g/単位)。回収できなかった分と、使用回数を使い切って入れ替える分の補充。 */
  freshBiomassPerM3: number;
  /** うち、回収できずに次のバッチへ回らない菌体 (g/単位)。 */
  lostBiomassPerM3: number;
  /** うち、使用回数を使い切って入れ替える菌体 (g/単位)。 */
  retiredBiomassPerM3: number;
  requiredBrothPerM3: number;
  /** 1単位あたりに使い切る菌体量 (kg-DCW) = 新しく入れる菌体量 ÷ 1000。第1段の原価に掛ける量。 */
  biomassKgPerUnit: number;
  /** 年間に要る菌体量 (kg-DCW)。 */
  annualBiomassKg: number;
  biomassFactor: number;
  brothFactor: number;
  reuseCount: number;
  /** 金属回収は使用回数を1回で固定する (前提の値を読まない)。 */
  reuseFixed: boolean;
  /** 作業の年間回数: 訪問回数 = 年間バッチ数 ÷ max(菌体使用回数, 1回の搬入でまかなうバッチ数)。 */
  visitsPerYear: number;
  /** 作業の年間回数: モジュール交換回数 = 年間バッチ数 ÷ モジュール耐用バッチ数。 */
  moduleSwapsPerYear: number;
  /** 作業の年間回数: 膜交換回数 = 1 ÷ 膜交換年数。 */
  membraneSwapsPerYear: number;
  /** 作業の年間回数: 輸送の回数 = 年間処理量 ÷ 1台の積載量 (オフサイト)。 */
  truckTripsPerYear: number;
  /** 1台の積載量 (m³/台)。 */
  truckCapacity: number;
  /**
   * 作業の年間回数: 菌体の製造拠点の培養設備の系列数 (端数も比例で数える)。count_driver = production_line の作業が使う。
   * 物量だけからは決まらない (年に作る量が株・用途・販売率で変わる) ので、deriveCostBasis は 1 を返し、computeCostModel が用途ごとに入れる。
   */
  productionLines: number;
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
  /** 年に作る量を決めた用途。年間処理量から作る量を出す試算では、用途ごとに使い切る菌体量が違うので原価も用途ごとに出す。 */
  application: CostApplication | null;
  /** 年間処理量から年に作る量を計算しているか。false は年間生産能力の前提をそのまま使う試算 (系列は1つ)。 */
  fromVolume: boolean;
  /** 年に作る量の元にした年間処理量 (単位/年) = オンサイト ＋ オフサイト (別に持つとき)。fromVolume でない試算は 0。 */
  businessVolume: number;
  /** うちオンサイトの年間処理量 (business_annual_volume)。 */
  onsiteVolume: number;
  /** うちオフサイトの年間処理量 (offsite_annual_volume)。別に持たない試算は 0。 */
  offsiteVolume: number;
  /** オフサイトの年間処理量をオンサイトと別に持っているか。持たない試算は、オフサイトの事業全体の年額もオンサイトの年間処理量で出す。 */
  offsiteVolumeSeparate: boolean;
  /** オンサイトの処理1単位で使い切る菌体量 (kg-DCW)。年に作る量の割り算に出す。 */
  onsiteBiomassKgPerUnit: number;
  /** オフサイトの処理1単位で使い切る菌体量 (kg-DCW)。オフサイトの濃さを別に持たなければオンサイトと同じ。 */
  offsiteBiomassKgPerUnit: number;
  /** 年に作る量 (kg-DCW/年)。CAPEX・年額固定費・作業はこの量で割って1kgあたりにする。 */
  capacityKgYear: number;
  /** 培養設備1系列で年に作れる量 (kg-DCW/年)。fromVolume でない試算は年に作る量と同じ。 */
  lineCapacityKgYear: number;
  /** 培養設備の系列数 = 年に作る量 ÷ 1系列の量 (端数も比例で数える)。fromVolume でない試算は 1。 */
  productionLines: number;
  /** 販売率 (0〜1)。生産した菌体のうち売れる割合。 */
  salesRate: number;
  /** 売れる量 (kg-DCW/年) = 年に作る量 × 販売率。年間処理量から出す試算では 年間処理量 × 使い切る菌体量。 */
  soldKgYear: number;
  /** 製造拠点の初期投資 (円、系列の数だけ並べた総額)。償却年額 = 初期投資 ÷ 耐用年数。 */
  capexInitial: number;
  /** 培養設備1系列あたりの初期投資 (円)。 */
  lineCapexInitial: number;
  /** 製造拠点 CAPEX 行の耐用年数の最小・最大 (年)。行ごとに違うことがある。 */
  usefulLifeMinYears: number | null;
  usefulLifeMaxYears: number | null;
  capexAnnual: number;
  fixedOpexAnnual: number;
  /** 製造拠点の作業の年額 (安全委員会・検査・フィルター交換など)。= 系列ごとの作業 + 拠点に1つの作業。 */
  tasksAnnual: number;
  /** うち培養設備の系列ごとの作業 (count_driver = production_line。系列の数だけ増える)。 */
  lineTasksAnnual: number;
  /** うち拠点に1つの作業 (固定の回数。作る量が増えても増えないので、1kgあたりは薄まる)。 */
  siteTasksAnnual: number;
  /** 製造拠点の作業の年間工数 (人時、拠点全体)。 */
  taskHoursAnnual: number;
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

/**
 * 総コストの内訳の区分。並び順は積み上げ棒の順で、画面の色の順とそろえる (色覚の見分けやすさを検査済みの並び)。
 * 足すと総コストに一致する。
 */
export type CostBreakdownKey = "biomass" | "transport" | "labor" | "postProcess" | "consumables" | "capex";

export const BREAKDOWN_LABEL: Record<CostBreakdownKey, string> = {
  biomass: "菌体費",
  transport: "運ぶ（巡回・輸送）",
  labor: "運転・保守・管理",
  postProcess: "菌体の後処理",
  consumables: "消耗品・電力・放流",
  capex: "設備と槽の償却",
};
export const BREAKDOWN_HINT: Record<CostBreakdownKey, string> = {
  biomass: "第1段の菌体1kgの原価 × 使い切る菌体量",
  transport: "オンサイトは菌体の搬入・搬出と移動、オフサイトは排液の輸送。工数 × 作業単価 ＋ 経費",
  labor: "SXがやる、運ぶ以外の作業（オフサイトの処理の運転、設備の交換、閉鎖系の管理など）。工数 × 作業単価 ＋ 経費",
  postProcess: "SXが持つ使用済み菌体の後処理。金属回収は酸処理。色素分解の汚泥の処分は、オンサイトでは顧客が持つので入らない",
  consumables: "処理に使う消耗品・電力・分析と、オフサイトの放流費",
  capex: "SXが持つ処理設備と槽、金属回収の中央回収設備の初期投資 ÷ 耐用年数。オンサイトのリアクターと槽は顧客が買うので入らない",
};
export const BREAKDOWN_ORDER: CostBreakdownKey[] = ["biomass", "transport", "labor", "postProcess", "consumables", "capex"];

export interface CostBreakdownPart {
  label: string;
  perUnit: number;
  /**
   * この中身を動かす操作パネルの小分け (COST_PARAM_GROUPS の key)。操作パネルの一番上の内訳から、その小分けへ移るのに使う
   * (まさ 2026-09-14「この棒グラフで一番大きく占めているところを減らしていかないといけないんだけど、その部分が左カラムのどこにあるのかが分かりにくい」)。
   */
  groupKey: string | null;
}

export interface CostBreakdownSlice {
  key: CostBreakdownKey;
  label: string;
  perUnit: number;
  /** 区分の中身 (大きい順)。足すと perUnit になる。 */
  parts: CostBreakdownPart[];
}

export interface CostScenarioResult {
  key: string;
  application: CostApplication | null;
  applicationLabel: string;
  method: CostMethod;
  tankMode: CostTankMode;
  location: CostLocation;
  label: string;

  /** 現場の明細のうち OPEX (後処理を含む)。 */
  siteItemOpexAnnual: number;
  siteItemOpexPerUnit: number;
  /** SX がやる作業 (巡回・輸送・交換・管理、オフサイトの処理の運転など)。製造拠点の作業は菌体費に入るので含まない。 */
  siteTaskAnnual: number;
  siteTaskPerUnit: number;
  /** SX がやる作業の年間工数 (人時)。製造拠点の作業は含まない (拠点全体の工数は biomass.taskHoursAnnual)。 */
  siteTaskHours: number;
  /** うち「運ぶ」(巡回・輸送) の作業。 */
  transportPerUnit: number;
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
  /** この方式の売価 (オフサイトは offsite_sale_price を別に持てる)。 */
  salePricePerUnit: number;
  revenueAnnual: number;
  profitPerUnit: number;
  profitAnnual: number;
  marginRate: number;

  /**
   * 事業全体 (年間処理量) での年額。年間処理量の前提が無い試算はどれも 0。
   * オフサイトの年間処理量を別に持つ試算は、オンサイトはオンサイトの量、オフサイトはオフサイトの量で出す。
   */
  businessVolume: number;
  /** businessVolume がどの量か。total はオンサイトとオフサイトを分けていない試算。 */
  businessScope: "total" | "onsite" | "offsite";
  /** 年間処理量 ÷ 顧客1社あたりの年間処理量。 */
  customerCount: number;
  businessRevenueAnnual: number;
  businessTotalAnnual: number;
  businessProfitAnnual: number;

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
  /** 用途ごとの物量。derived はオンサイト、offsiteDerived はオフサイト (対象物質の濃さだけが違う)。画面は derivedOf で引く。 */
  derivedByApplication: Array<{ application: CostApplication | null; derived: CostDerived; offsiteDerived: CostDerived }>;
  strain: CostStrain | null;
  strains: CostStrain[];
  applications: CostApplication[];
  /** データに現れる方式。オフサイトの明細・作業が1行も無い試算はオンサイトだけ。 */
  locations: CostLocation[];
  /** オンサイトの槽を誰が持つか (前提 onsite_tank_bearer)。顧客のとき、オンサイトの槽は「既設」(SX の負担0) だけになる。 */
  onsiteTankBearer: CostTankBearer;
  /** 選択中の株と、最初の用途の第1段。用途ごとの値は biomassByApplication (biomassOf で引く)。 */
  biomass: CostBiomassCost;
  /** 選択中の株の、用途ごとの第1段。年に作る量が用途ごとに違うので、1kgあたりの原価も用途ごとに出す。 */
  biomassByApplication: Array<{ application: CostApplication | null; biomass: CostBiomassCost }>;
  /** 株 × 用途ごとの第1段 (株の切り替えの表示用)。 */
  biomassByStrain: CostBiomassCost[];
  scenarios: CostScenarioResult[];
}

/** 用途ごとの第1段を引く。無ければ最初の用途の値。 */
export function biomassOf(computed: Pick<CostComputation, "biomass" | "biomassByApplication">, application: CostApplication | null): CostBiomassCost {
  return computed.biomassByApplication.find((b) => b.application === application)?.biomass ?? computed.biomass;
}

/** 用途と方式の物量を引く。オフサイトは対象物質の濃さを別に持てるので、使い切る菌体量が方式で変わる。無ければ最初の用途の値。 */
export function derivedOf(
  computed: Pick<CostComputation, "derived" | "derivedByApplication">,
  application: CostApplication | null,
  location: CostLocation
): CostDerived {
  const hit = computed.derivedByApplication.find((d) => d.application === application) ?? computed.derivedByApplication[0];
  if (!hit) return computed.derived;
  return location === "offsite" ? hit.offsiteDerived : hit.derived;
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

/** オフサイトの明細・作業があるか。無い試算 (他PJ) にはオフサイトを出さない。 */
export function hasOffsite(bundle: CostInputs): boolean {
  return [...bundle.items, ...(bundle.tasks ?? [])].some((r) => r.scenario === "オフサイト");
}

/** データに現れる方式。表示順は オンサイト → オフサイト。 */
export function listLocations(bundle: CostInputs): CostLocation[] {
  return hasOffsite(bundle) ? ["onsite", "offsite"] : ["onsite"];
}

/**
 * 明細・作業の1行が、選んだ方式・装置・株・用途で発生するか。
 * 製造拠点の行は第1段で数えるので、方式・装置・用途によらず株だけで決まる。
 */
export function rowAppliesTo(
  row: { scenario: CostScenarioScope; strain: CostStrain | null; application: CostApplication | null },
  location: CostLocation,
  method: CostMethod,
  sel: CostSelection
): boolean {
  if (row.scenario === "中央培養") return scopeApplies(row, { strain: sel.strain, application: null });
  return scopesFor(location, method).includes(row.scenario) && scopeApplies(row, sel);
}

/**
 * 培養の CO2 を工場の排ガスでまかなえるか。前提 co2_flue_gas の value_text が on なら使える (無い・off は使えない)。
 * まさ 2026-09-14「「排ガス利用可能」のスイッチをCO2コストのところに設置してほしい。それがONのときはCO2コストがゼロになるようにして」。
 * 使えるとき、単価の連動のしかたが co2_supply の明細 (CO2) の単価を0円にする。明細の単価の欄は液化炭酸ガスの買値のまま持ち、切ると戻る。
 * スイッチは前提の区分の一覧には出さず、CO2 の明細の行に出す (ITEM_INLINE_ROLES)。燃料の試算も同じ前提と連動のしかたを使う。
 */
export const CO2_FLUE_GAS_ROLE = "co2_flue_gas";
export const CO2_FLUE_GAS_LABEL = "排ガス利用可能";
export const CO2_FLUE_GAS_CHOICES: Array<{ value: "off" | "on"; label: string }> = [
  { value: "off", label: "使えない（液化炭酸ガスを買う）" },
  { value: "on", label: "使える（CO2は0円）" },
];
export function flueGasOn(assumption: Pick<CostAssumption, "valueText"> | null | undefined): boolean {
  return assumption?.valueText === "on";
}
/**
 * 培養の培地を、工場の排液でまかなえるか。前提 waste_medium の value_text が on なら使える (無い・off は使えない)。
 * まさ 2026-09-15「顧客の工場のCO2と排熱、排ガスをフル活用してやる方向」。
 * 使えるとき、単価の連動のしかたが medium_supply の明細 (窒素源・リン源・カリウムなどの培地の原料) の単価を、
 * 前提 waste_medium_reduction (減る割合、%) だけ引いた額にする。明細の単価の欄は試薬を買う買値のまま持ち、切ると戻る。
 * スイッチは前提の区分の一覧には出さず、培地の原料の行に出す (ITEM_INLINE_ROLES)。燃料の試算も同じ前提と連動のしかたを使う。
 * 出どころ: ちこさんの試算シート 2026-07-30版の前提「培地原料低減率 80%（排液利用で大幅低減）」。
 */
export const WASTE_MEDIUM_ROLE = "waste_medium";
export const WASTE_MEDIUM_REDUCTION_ROLE = "waste_medium_reduction";
/**
 * 工場の排液で培養したときに増える速さの倍率 (前提 waste_medium_growth_factor、倍)。
 * 排液を培地に使えるとき (waste_medium が on) だけ効き、培養設備1系列で年に作れる菌体の量にこの倍率を掛ける。
 * 同じ設備で年に作れる量が増えるので、系列の数がその分だけ減り、設備の償却・年ごとの固定費・系列ごとの作業が1kgあたりで薄まる。
 * 出どころ: 杉浦先生 2026-09-15 (BNV定例)「排液を入れると今まで見たことのない速度で細胞が増え始めた。1日でできるくらい、4倍くらい速い」。
 * 実験室の観察で、大きな槽では光が律速になりそのまま4倍にはならない可能性がある (前提の説明に書く)。
 */
export const WASTE_MEDIUM_GROWTH_ROLE = "waste_medium_growth_factor";
export function wasteMediumGrowthFactor(assumptions: CostAssumption[], sel?: CostSelection): number {
  if (!wasteMediumOn(resolveAssumption(assumptions, WASTE_MEDIUM_ROLE, sel))) return 1;
  const v = roleValue(assumptions, WASTE_MEDIUM_GROWTH_ROLE, 1, sel);
  return Number.isFinite(v) && v > 0 ? v : 1;
}
export const WASTE_MEDIUM_LABEL = "工場の排液を培地に使える";
export const WASTE_MEDIUM_CHOICES: Array<{ value: "off" | "on"; label: string }> = [
  { value: "off", label: "使えない（試薬を買う）" },
  { value: "on", label: "使える（培地の原料がその分だけ減る）" },
];
export function wasteMediumOn(assumption: Pick<CostAssumption, "valueText"> | null | undefined): boolean {
  return assumption?.valueText === "on";
}
/** 排液を培地に使えるときに、培地の原料の買値に掛ける倍率 (減る割合 80% なら 0.2)。 */
export function mediumPriceFactor(on: boolean, reductionPct: number): number {
  if (!on) return 1;
  return Math.min(Math.max(1 - reductionPct / 100, 0), 1);
}

/**
 * 培養の加温を、工場の排熱でまかなえるか。前提 waste_heat の value_text が on なら使える (無い・off は使えない)。
 * まさ 2026-09-15「顧客の工場のCO2と排熱、排ガスをフル活用してやる方向」。
 * 使えるとき、単価の連動のしかたが heat_supply の明細 (加温の熱) の単価を0円にする。熱の量と買う熱の単価は行に残る。
 * SX の株は好熱性で運転温度が45〜70℃なので、加温は他の藻の事業より重い。工場の排熱はちょうどこの温度帯。
 */
export const WASTE_HEAT_ROLE = "waste_heat";
export const WASTE_HEAT_LABEL = "排熱利用可能";
export const WASTE_HEAT_CHOICES: Array<{ value: "off" | "on"; label: string }> = [
  { value: "off", label: "使えない（熱を買う）" },
  { value: "on", label: "使える（加温の熱は0円）" },
];
export function wasteHeatOn(assumption: Pick<CostAssumption, "valueText"> | null | undefined): boolean {
  return assumption?.valueText === "on";
}

/** 前提の区分の一覧に出さず、その前提で単価が決まる明細の行に出す前提。 */
export const ITEM_INLINE_ROLES = new Set<string>([CO2_FLUE_GAS_ROLE, WASTE_MEDIUM_ROLE, WASTE_HEAT_ROLE]);

/**
 * 培養ロス補充 (単価の連動のしかた culture_loss) の単価の元にする行: 同じ群・同じ効く範囲の、菌体1kgあたりの原料の行。
 * 作り直す割合は数量に持ち、単価はこの行の菌体1kgあたりの額の合計にする。原料の行を書き換える・CO2 を排ガスにすると一緒に動く。
 */
export function cultureLossSources<T extends Pick<CostItem, "costItemId" | "scenario" | "costType" | "groupLabel" | "basis" | "isBreakdown" | "priceRule" | "strain" | "application">>(
  item: T,
  items: T[],
  sel: CostSelection = NO_SELECTION
): T[] {
  return items.filter(
    (x) =>
      x.costItemId !== item.costItemId &&
      x.priceRule !== "culture_loss" &&
      x.scenario === item.scenario &&
      x.costType === item.costType &&
      x.groupLabel === item.groupLabel &&
      x.basis === "毎kg菌体比例" &&
      !x.isBreakdown &&
      scopeApplies(x, sel)
  );
}

/** 画面で選択肢から選ぶ前提 (value_text に入れる)。 */
export const TEXT_CHOICE_ROLES: Record<string, Array<{ value: string; label: string }>> = {
  onsite_tank_bearer: [
    { value: "customer", label: TANK_BEARER_LABEL.customer },
    { value: "sx", label: TANK_BEARER_LABEL.sx },
  ],
  [CO2_FLUE_GAS_ROLE]: CO2_FLUE_GAS_CHOICES,
  [WASTE_MEDIUM_ROLE]: WASTE_MEDIUM_CHOICES,
  [WASTE_HEAT_ROLE]: WASTE_HEAT_CHOICES,
};

/**
 * 金属回収の中央回収設備 (酸処理・中和・固液分離) の償却を、使用済み菌体1kgあたりにする前提。
 * 中島先生 2026-08-28「金属回収設備CAPEXがない | 酸処理OPEXのみ | 酸処理・中和・分離には設備が必要 | 中央回収設備として別CAPEX化」。
 * 単価 (円/kg-DCW) = 1系列の初期投資 ÷ 耐用年数 ÷ 1系列が1年に処理する使用済み菌体。系列は処理する量に合わせて並べる (培養設備と同じ)。
 */
export const RECOVERY_CAPEX_ROLES = ["recovery_facility_capex", "recovery_facility_life_years", "recovery_line_capacity_kg_year"];

/** 明細の単価の連動のしかたが読む前提。 */
const ROLES_BY_PRICE_RULE: Record<string, string[]> = {
  module_swap: ["module_unit_price", "module_durability_batches"],
  power_circulation: ["power_unit_price", "power_kw_circulation", "hrt_circulation"],
  power_injection: ["power_unit_price", "power_kw_injection", "hrt_injection"],
  spent_disposal: ["spent_wet_factor", "sludge_disposal_price"],
  co2_supply: [CO2_FLUE_GAS_ROLE],
  medium_supply: [WASTE_MEDIUM_ROLE, WASTE_MEDIUM_REDUCTION_ROLE],
  heat_supply: [WASTE_HEAT_ROLE],
  recovery_capex: RECOVERY_CAPEX_ROLES,
};
/** 作業の年間回数の決め方が読む前提 (年間バッチ数・系列数のように、どの組み合わせでも効く前提は除く)。 */
const ROLES_BY_TASK_DRIVER: Partial<Record<CostTaskDriver, string[]>> = {
  visit: ["patrol_batches_per_delivery"],
  module_swap: ["module_durability_batches"],
  membrane_swap: ["membrane_life_years"],
  truck_trip: ["truck_capacity_m3"],
};
const NEW_TANK_ROLES = ["new_tank_capex", "tank_life_years"];

/**
 * 選んだ組み合わせによって、効いたり効かなかったりする前提。これ以外の計算用の前提 (COST_ROLE_KEYS) は、どの組み合わせでも効く。
 * 画面は、選んだ組み合わせで効かない前提を薄く出す (まさ 2026-09-14「新設槽CAPEX（コンクリート地下タンク100m³）→これってオフサイトの場合のみ使うやつですね？
 * オンサイトを選んだときもグレーアウトしてないのでグレーアウトさせて」)。
 */
export const CONDITIONAL_ROLE_KEYS = new Set<string>([
  ...Object.values(ROLES_BY_PRICE_RULE).flat(),
  ...Object.values(ROLES_BY_TASK_DRIVER).flat(),
  ...NEW_TANK_ROLES,
  "onsite_tank_bearer",
  "labor_rate",
  "sale_price",
  "offsite_sale_price",
  // 回収率は次のバッチへ回す量に使うので、使い回すとき (色素分解) だけ効く。金属回収は使用回数1回で固定なので効かない
  "recovery_eta",
  // 排液で増える速さの倍率は、排液を培地に使うとき (waste_medium が on) だけ効く
  WASTE_MEDIUM_GROWTH_ROLE,
]);

/** 前提が効くかを見る組み合わせ。 */
export interface CostEffectSelection extends CostSelection {
  location: CostLocation;
  method: CostMethod;
  tankMode: CostTankMode;
}

/**
 * 選んだ組み合わせ (株・用途・方式・装置・槽) で、値を変えると SX の数字 (総コスト・内訳・作業工数) が動く計算用の前提の role_key。
 * 効くかどうかは、その組み合わせで数える明細の単価の連動のしかた、作業の年間回数の決め方と工数、槽から決める。
 * 数えるのは SX が持つ明細と SX がやる作業だけで、製造拠点の明細と作業は菌体の製造原価を上書きしていないときだけ。
 * 契約チェックで、効かないとした前提を動かしても数字が変わらず、効くとした前提を動かすと数字が変わることを確かめている。
 */
export function rolesInEffect(bundle: CostInputs, view: CostEffectSelection): Set<string> {
  const sel: CostSelection = { strain: view.strain, application: view.application };
  const centralSel: CostSelection = { strain: view.strain, application: null };
  const inEffect = new Set([...COST_ROLE_KEYS].filter((role) => !CONDITIONAL_ROLE_KEYS.has(role)));
  const add = (roles: string[] | undefined) => roles?.forEach((role) => inEffect.add(role));
  const overridden = typeof resolveAssumption(bundle.assumptions, "biomass_cost_per_kg_override", centralSel)?.value === "number";
  const counted = (row: { scenario: CostScenarioScope; strain: CostStrain | null; application: CostApplication | null }) =>
    row.scenario === "中央培養" ? !overridden && scopeApplies(row, centralSel) : rowAppliesTo(row, view.location, view.method, sel);

  for (const i of bundle.items) {
    if (!i.priceRule || i.isBreakdown || i.basis === "内訳" || i.costType === "参考" || i.quantity * i.annualFactor === 0) continue;
    if (!counted(i) || (i.scenario !== "中央培養" && resolveBearer(i, view.location) !== "sx")) continue;
    // 液化炭酸ガスの買値が0円なら、排ガスを使えるかを切り替えても数字は動かない
    if (i.priceRule === "co2_supply" && i.unitPrice === 0) continue;
    if (i.priceRule === "heat_supply" && i.unitPrice === 0) continue;
    // 排液を培地に使う切り替えが OFF なら、減る割合を変えても数字は動かない
    if (i.priceRule === "medium_supply" && !wasteMediumOn(resolveAssumption(bundle.assumptions, WASTE_MEDIUM_ROLE, centralSel))) {
      inEffect.add(WASTE_MEDIUM_ROLE);
      continue;
    }
    add(ROLES_BY_PRICE_RULE[i.priceRule]);
  }
  for (const t of bundle.tasks ?? []) {
    if (!counted(t) || (t.scenario !== "中央培養" && resolvePerformer(t, view.location) !== "sx")) continue;
    const hours = t.hoursPerOccurrence ?? 0;
    if (hours > 0) inEffect.add("labor_rate");
    if (hours > 0 || t.expensePerOccurrence > 0) add(ROLES_BY_TASK_DRIVER[t.countDriver]);
  }
  if (view.location === "onsite") inEffect.add("onsite_tank_bearer");
  // 回収率は、次のバッチへ回すとき (使用回数が1回より多い) だけ効く
  const basis = deriveCostBasis(bundle.assumptions, sel, view.location);
  if (basis.reuseCount > 1 && basis.requiredBiomassPerM3 > 0) inEffect.add("recovery_eta");
  // 売価は選んだ方式のものだけが効く。オフサイトの売価を別に持たない試算は、オフサイトもオンサイトの売価で出す
  const offsitePriceSeparate = typeof resolveAssumption(bundle.assumptions, "offsite_sale_price", sel)?.value === "number";
  inEffect.add(view.location === "offsite" && offsitePriceSeparate ? "offsite_sale_price" : "sale_price");
  // 槽の償却が乗るのは、SX が槽を新設するとき (オフサイトは常に。オンサイトは槽を SX が持ち、新設を選んだとき)。
  const tank = view.location === "offsite" ? "新設" : onsiteTankBearer(bundle.assumptions) === "customer" ? "既設" : view.tankMode;
  if (tank === "新設") add(NEW_TANK_ROLES);
  // 排液で増える速さの倍率は、排液を培地に使うときに培養設備の系列数を通して効く (菌体の原価を上書きしているときは効かない)
  if (!overridden && wasteMediumOn(resolveAssumption(bundle.assumptions, WASTE_MEDIUM_ROLE, centralSel))) inEffect.add(WASTE_MEDIUM_GROWTH_ROLE);
  return inEffect;
}

/**
 * 前提・明細・作業を並べる区分。操作パネルと読み物で同じ並びにする。
 * まさ 2026-09-14「前提となるパラメータについて、ページのあちこちに散らばってて、どこにあるか分からん。
 * CAPEXとOPEXに分けて、さらにそれぞれのサブグループに分けるなどして整理してほしい」。
 * 前提は role_key、明細は CAPEX / OPEX・効く範囲・群・連動のしかた、作業は人件費に振り分ける。
 */
export type CostParamBlockKey = "conditions" | "capex" | "opex";

export interface CostParamBlock {
  key: CostParamBlockKey;
  title: string;
  hint: string;
}

export interface CostParamGroup {
  key: string;
  block: CostParamBlockKey;
  title: string;
  hint: string;
  /** この区分に並べる前提の role_key (表示順)。 */
  roles: string[];
  /** 作業リストをこの区分に出すか。 */
  tasks?: boolean;
}

export const COST_PARAM_BLOCKS: CostParamBlock[] = [
  { key: "conditions", title: "事業と処理の条件", hint: "量と売価。CAPEX と OPEX を1単位あたりに割る元になる数字" },
  { key: "capex", title: "CAPEX（初期投資）", hint: "設備と槽の初期投資。耐用年数で割って年額にする" },
  { key: "opex", title: "OPEX（毎年の費用）", hint: "人件費・運ぶ・菌体の原料・交換部品・電力・消耗品・後処理など、毎年かかる費用" },
];

export const COST_PARAM_GROUPS: CostParamGroup[] = [
  { key: "cond-scale", block: "conditions", title: "事業の規模と売価", hint: "オンサイトとオフサイトの年間処理量と売価から、売上・顧客の数が決まる。年に作る菌体の量は、両方の年間処理量にそれぞれの濃さで使い切る菌体の量を掛けて足す", roles: ["business_annual_volume", "sale_price", "offsite_annual_volume", "offsite_sale_price"] },
  { key: "cond-site", block: "conditions", title: "顧客1社の処理", hint: "顧客1社あたりの年間処理量と年間バッチ数が決まる", roles: ["batch_volume", "operating_days", "utilization"] },
  { key: "cond-substance", block: "conditions", title: "対象物質と菌体の量", hint: "流入の濃さと目標放流水濃度の差から1バッチに要る菌体の量が、回収率と使用回数から新しく入れる菌体の量が決まる。オフサイトで引き取る液の濃さは別に置ける", roles: ["target_concentration", "offsite_target_concentration", "effluent_target_concentration", "uptake_alpha", "recovery_eta", "reuse_count", "k_ppm"] },
  { key: "cond-biomass", block: "conditions", title: "菌体の製造量と原価", hint: "年に作る菌体の量と、菌体1kgの原価の割り算", roles: ["sales_rate", "biomass_cost_per_kg_override"] },
  { key: "capex-production", block: "capex", title: "菌体の製造拠点（培養設備）", hint: "培養設備1系列の明細と、1系列で年に作れる量。年に作る量に合わせて系列を並べる", roles: ["culture_line_capacity_kg_year", "culture_capacity_kg_year"] },
  { key: "capex-recovery", block: "capex", title: "金属の回収設備（酸処理・中和・固液分離）", hint: "金属回収だけ。使用済み菌体を集めて酸で溶かし、金属を取り出す中央の設備。1系列の初期投資 ÷ 耐用年数 ÷ 1系列が1年に処理する使用済み菌体を、使い切る菌体1kgあたりに乗せる", roles: RECOVERY_CAPEX_ROLES },
  { key: "capex-circulation", block: "capex", title: "処理設備：循環カートリッジ", hint: "顧客工場（オンサイト）では顧客が買い、SX工場（オフサイト）ではSXが持つ", roles: [] },
  { key: "capex-injection", block: "capex", title: "処理設備：直接投入", hint: "顧客工場（オンサイト）では顧客が買い、SX工場（オフサイト）ではSXが持つ", roles: [] },
  { key: "capex-tank", block: "capex", title: "槽", hint: "オンサイトの槽は顧客の設備。オフサイトはSX工場に新設する", roles: ["onsite_tank_bearer", "new_tank_capex", "tank_life_years"] },
  { key: "capex-offsite", block: "capex", title: "排液の受け入れ設備（オフサイト）", hint: "オフサイトだけ。SX工場で排液を受け入れる設備", roles: [] },
  { key: "capex-closed", block: "capex", title: "閉鎖系の追加（強化株のみ）", hint: "強化株のときだけ乗る設備", roles: [] },
  { key: "capex-other", block: "capex", title: "その他の設備", hint: "上の区分に入らない設備", roles: [] },
  { key: "opex-labor", block: "opex", title: "人件費（作業）", hint: "作業単価は共通の1つ。作業ごとに1回の工数・年間回数・1回の経費を入れる", roles: ["labor_rate"], tasks: true },
  { key: "opex-transport", block: "opex", title: "運ぶ", hint: "菌体を運ぶ回数と排液を運ぶ台数を決める前提と、顧客工場への菌体の保管・梱包。移動と輸送の工数・経費は人件費の作業で動かす", roles: ["patrol_batches_per_delivery", "truck_capacity_m3"] },
  { key: "opex-production", block: "opex", title: "菌体の製造拠点（原料・品質確認）", hint: "培地・CO2・濃縮など菌体1kgあたりの費用と、培養設備1系列あたりの品質確認。工場の排ガスを使えるかは CO2 の行、工場の排液を培地に使えるかは培地の原料の行、工場の排熱を使えるかは加温の熱の行で切り替える", roles: [CO2_FLUE_GAS_ROLE, WASTE_MEDIUM_ROLE, WASTE_MEDIUM_REDUCTION_ROLE, WASTE_MEDIUM_GROWTH_ROLE, WASTE_HEAT_ROLE] },
  { key: "opex-parts", block: "opex", title: "交換部品", hint: "循環カートリッジの菌体保持モジュールと、直接投入の膜の交換", roles: ["module_unit_price", "module_durability_batches", "membrane_life_years"] },
  { key: "opex-power", block: "opex", title: "電力", hint: "装置を動かす電力。動力 × 反応時間 × 電力単価 ÷ バッチ容量", roles: ["power_unit_price", "power_kw_circulation", "hrt_circulation", "power_kw_injection", "hrt_injection"] },
  { key: "opex-consumables", block: "opex", title: "消耗品・点検・分析", hint: "洗浄・監視・点検・分析・菌体の補充など", roles: [] },
  { key: "opex-post", block: "opex", title: "使用済み菌体の後処理", hint: "金属回収の酸処理と、色素分解の汚泥の処分", roles: ["spent_wet_factor", "sludge_disposal_price"] },
  { key: "opex-discharge", block: "opex", title: "処理水の放流（オフサイト）", hint: "オフサイトだけ。SX工場から処理水を流す費用", roles: [] },
  { key: "opex-closed", block: "opex", title: "閉鎖系の追加（強化株のみ）", hint: "強化株のときだけ乗る薬剤など", roles: [] },
];

const PARAM_GROUP_BY_KEY = new Map(COST_PARAM_GROUPS.map((g) => [g.key, g]));
const PARAM_GROUP_BY_ROLE = new Map(COST_PARAM_GROUPS.flatMap((g) => g.roles.map((r) => [r, g] as const)));

/** 前提の置き場所。計算に使う前提 (COST_ROLE_KEYS) で、区分が決まっていないものは「その他」ではなく undefined を返す。 */
export function paramGroupOfRole(roleKey: string | null): CostParamGroup | undefined {
  return roleKey ? PARAM_GROUP_BY_ROLE.get(roleKey) : undefined;
}

/** 明細の置き場所。参考の行は計算に入らないので置かない (undefined)。 */
export function paramGroupOfItem(
  item: Pick<CostItem, "costType" | "scenario" | "groupLabel" | "priceRule">
): CostParamGroup | undefined {
  const group = (key: string) => PARAM_GROUP_BY_KEY.get(key);
  const closed = (item.groupLabel ?? "").startsWith("閉鎖系の追加");
  if (item.costType === "CAPEX") {
    if (closed) return group("capex-closed");
    if (item.priceRule === "recovery_capex") return group("capex-recovery");
    if (item.scenario === "中央培養") return group("capex-production");
    if (item.scenario === "循環") return group("capex-circulation");
    if (item.scenario === "投入") return group("capex-injection");
    if (item.scenario === "オフサイト") return group("capex-offsite");
    return group("capex-other");
  }
  if (item.costType !== "OPEX") return undefined;
  if (closed) return group("opex-closed");
  if (item.scenario === "中央培養") return group("opex-production");
  if (item.groupLabel !== null && POST_PROCESS_GROUPS.has(item.groupLabel)) return group("opex-post");
  if (item.priceRule === "power_circulation" || item.priceRule === "power_injection") return group("opex-power");
  if (item.priceRule === "module_swap") return group("opex-parts");
  if (item.scenario === "オフサイト") return group("opex-discharge");
  // 現場共通 (オンサイトだけ) の OPEX は、顧客工場へ運ぶ菌体の保管容器・梱包など。
  if (item.scenario === "現場共通") return group("opex-transport");
  // 残り (循環・投入・共通) は、処理設備の洗浄・監視・点検と、処理水の分析・菌体の補充。
  return group("opex-consumables");
}

/** オンサイトの槽を誰が持つか。前提が無い試算は、これまでどおり SX。 */
export function onsiteTankBearer(assumptions: CostAssumption[]): CostTankBearer {
  return resolveAssumption(assumptions, "onsite_tank_bearer")?.valueText === "customer" ? "customer" : "sx";
}

/** 販売率 (0.01〜1)。前提が無ければ全量が売れる 1。 */
export function salesRateOf(assumptions: CostAssumption[], sel: CostSelection = NO_SELECTION): number {
  const pct = roleValue(assumptions, "sales_rate", 100, sel);
  return Math.min(Math.max(pct, 1), 100) / 100;
}

/**
 * 1バッチに要る菌体のうち、新しく入れる菌体の割合 (菌体のバッチ間のマスバランス。中島先生 2026-08-28)。
 * 回収率 η は「処理のあと回収して次のバッチへ回せる菌体の割合」、使用回数 N は「同じ菌体を何バッチ使ったら入れ替えるか」。
 * 毎バッチ、前のバッチから回した菌体 (N回に達していないもの) に新しい菌体 F を足して、要る菌体 B にそろえる。
 * 回した菌体は1回ごとに η 倍になるので B = F × (1 + η + … + η^(N−1)) で、F ÷ B = (1 − η) ÷ (1 − η^N)。
 * η = 100% なら 1/N (使用回数で割るだけ)、N = 1 (使い捨て) なら η によらず 1。
 * 新しく入れた菌体は、回収できずに失う (F × (1 − η^N)) か、N回使って入れ替える (F × η^N) かのどちらかで出ていく。
 */
export function freshBiomassShare(etaPct: number, uses: number): number {
  const n = Math.max(Number.isFinite(uses) ? uses : 1, 1);
  const eta = Math.min(Math.max(Number.isFinite(etaPct) ? etaPct / 100 : 0, 0), 1);
  if (eta >= 1 - 1e-12) return 1 / n;
  return (1 - eta) / (1 - Math.pow(eta, n));
}

/**
 * 1単位の処理に使う物量。方式 (location) で変わるのは対象物質の濃さだけで、オフサイトは前提 offsite_target_concentration が
 * あればそれを使う (引き取る液は顧客工場の排水より濃い。まさ 2026-09-14「置いて」)。無ければオンサイトの濃さ。
 * 1バッチに要る菌体 = (流入の濃さ − 目標放流水濃度) × k_ppm ÷ 取り込み効率α、新しく入れる菌体 = それ × freshBiomassShare。
 * 2026-09-15 までは「流入の濃さ全量 ÷ α ÷ 回収率 ÷ 使用回数」だった (中島先生 2026-08-28 の指摘で改めた。ちこさん 2026-09-15)。
 */
export function deriveCostBasis(
  assumptions: CostAssumption[],
  sel: CostSelection = NO_SELECTION,
  location: CostLocation = "onsite"
): CostDerived {
  const batchVolume = roleValue(assumptions, "batch_volume", 100, sel);
  const operatingDays = roleValue(assumptions, "operating_days", 300, sel);
  const utilization = roleValue(assumptions, "utilization", 1, sel);
  const annualBatches = operatingDays * utilization;
  const annualVolume = batchVolume * annualBatches;

  const onsiteConcentration = roleValue(assumptions, "target_concentration", 50, sel);
  const offsiteConcentration = resolveAssumption(assumptions, "offsite_target_concentration", sel)?.value;
  const offsiteConcentrationSeparate = typeof offsiteConcentration === "number" && Number.isFinite(offsiteConcentration);
  const concentration = location === "offsite" && offsiteConcentrationSeparate ? offsiteConcentration : onsiteConcentration;
  // 目標放流水濃度 (中島先生 2026-08-28「(Cin−Cout)×水量に変更」)。前提が無い試算は0で、これまでどおり全量を取り除く。
  const effluentConcentration = Math.max(roleValue(assumptions, "effluent_target_concentration", 0, sel), 0);
  const removedConcentration = Math.max(concentration - effluentConcentration, 0);
  const kPpm = roleValue(assumptions, "k_ppm", 1, sel);
  const alpha = roleValue(assumptions, "uptake_alpha", 0.05, sel);
  const eta = roleValue(assumptions, "recovery_eta", 90, sel);
  const cellDensity = roleValue(assumptions, "cell_density", 5, sel);
  // 金属回収は酸で菌体を溶かして金属を取り出すので、使い回さない (まさ 2026-09-13)。前提の値があっても読まない。
  const reuseFixed = sel.application === "metal";
  const reuseCount = reuseFixed ? 1 : Math.max(roleValue(assumptions, "reuse_count", 1, sel), 1);

  const requiredBiomassPerM3 = safeDiv(removedConcentration * kPpm, alpha);
  const freshShare = freshBiomassShare(eta, reuseCount);
  const freshBiomassPerM3 = requiredBiomassPerM3 * freshShare;
  const retiredBiomassPerM3 = freshBiomassPerM3 * Math.pow(Math.min(Math.max(eta / 100, 0), 1), reuseCount);
  const lostBiomassPerM3 = freshBiomassPerM3 - retiredBiomassPerM3;
  const requiredBrothPerM3 = safeDiv(freshBiomassPerM3, cellDensity);
  const biomassKgPerUnit = freshBiomassPerM3 / 1000;

  const perDelivery = Math.max(roleValue(assumptions, "patrol_batches_per_delivery", 5, sel), 1);
  const truckCapacity = roleValue(assumptions, "truck_capacity_m3", 10, sel);
  const salePrice = roleValue(assumptions, "sale_price", 500, sel);
  const offsitePrice = resolveAssumption(assumptions, "offsite_sale_price", sel)?.value;
  const offsitePriceSeparate = typeof offsitePrice === "number" && Number.isFinite(offsitePrice);

  return {
    salePrice,
    offsiteSalePrice: offsitePriceSeparate ? offsitePrice : salePrice,
    offsitePriceSeparate,
    annualBatches,
    annualVolume,
    location,
    targetConcentration: concentration,
    offsiteConcentrationSeparate,
    effluentConcentration,
    removedConcentration,
    uptakeAlpha: alpha,
    recoveryEta: eta,
    requiredBiomassPerM3,
    freshShare,
    freshBiomassPerM3,
    lostBiomassPerM3,
    retiredBiomassPerM3,
    requiredBrothPerM3,
    biomassKgPerUnit,
    annualBiomassKg: biomassKgPerUnit * annualVolume,
    biomassFactor: safeDiv(freshBiomassPerM3, BASELINE_BIOMASS_G_PER_M3),
    brothFactor: safeDiv(requiredBrothPerM3, BASELINE_BROTH_L_PER_M3),
    reuseCount,
    reuseFixed,
    visitsPerYear: safeDiv(annualBatches, Math.max(reuseCount, perDelivery)),
    moduleSwapsPerYear: safeDiv(annualBatches, roleValue(assumptions, "module_durability_batches", 50, sel)),
    membraneSwapsPerYear: safeDiv(1, roleValue(assumptions, "membrane_life_years", 3, sel)),
    truckTripsPerYear: truckCapacity > 0 ? annualVolume / truckCapacity : 0,
    truckCapacity,
    productionLines: 1,
  };
}

/**
 * 単価が変数へ連動する行の実効単価。連動しない行は unit_price をそのまま返す。
 * 培養ロス補充 (culture_loss) はほかの行から単価を出すので、明細の束 (items) を渡す。渡さなければ入力の単価。
 */
export function effectiveUnitPrice(
  item: CostItem,
  assumptions: CostAssumption[],
  derived: CostDerived,
  sel: CostSelection = NO_SELECTION,
  items?: CostItem[]
): number {
  const batchVolume = roleValue(assumptions, "batch_volume", 100, sel);
  switch (item.priceRule) {
    case "co2_supply":
      return flueGasOn(resolveAssumption(assumptions, CO2_FLUE_GAS_ROLE, sel)) ? 0 : item.unitPrice;
    case "heat_supply":
      return wasteHeatOn(resolveAssumption(assumptions, WASTE_HEAT_ROLE, sel)) ? 0 : item.unitPrice;
    case "medium_supply":
      return item.unitPrice * mediumPriceFactor(
        wasteMediumOn(resolveAssumption(assumptions, WASTE_MEDIUM_ROLE, sel)),
        roleValue(assumptions, WASTE_MEDIUM_REDUCTION_ROLE, 0, sel)
      );
    case "culture_loss":
      return items
        ? cultureLossSources(item, items, sel).reduce((t, x) => t + x.quantity * effectiveUnitPrice(x, assumptions, derived, sel, items) * x.annualFactor, 0)
        : item.unitPrice;
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
    case "recovery_capex":
      // 使用済み菌体 1kg を処理するときの設備の償却 = 1系列の初期投資 ÷ 耐用年数 ÷ 1系列が1年に処理する使用済み菌体
      return safeDiv(
        safeDiv(roleValue(assumptions, "recovery_facility_capex", 0, sel), roleValue(assumptions, "recovery_facility_life_years", 10, sel)),
        roleValue(assumptions, "recovery_line_capacity_kg_year", 0, sel)
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
  sel: CostSelection = NO_SELECTION,
  items?: CostItem[]
): number {
  if (item.isBreakdown || item.basis === "内訳") return 0;
  const price = effectiveUnitPrice(item, assumptions, derived, sel, items);
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

/** 製造拠点の1行が、生産1kgあたりに乗せる額 (販売率で割る前)。明細表の円/kg列にも使う。培養ロス補充の単価を出すため明細の束を渡す。 */
export function centralItemPerKg(item: CostItem, assumptions: CostAssumption[], capacity: number, sel: CostSelection, items?: CostItem[]): number {
  if (item.isBreakdown || item.basis === "内訳") return 0;
  const derived = deriveCostBasis(assumptions, sel);
  const price = effectiveUnitPrice(item, assumptions, derived, sel, items);
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

/** CO2 の行の単価の出し方。工場の排ガスを使えるときだけ出す (使えないときは入力の買値をそのまま使うので null)。燃料の試算と共通。 */
export function co2SupplyCalc(item: Pick<CostItem, "unitPrice" | "unitPriceUnit">, on: boolean): CalcSegment | null {
  if (!on) return null;
  const priceUnit = item.unitPriceUnit ?? "円";
  return {
    continues: false,
    terms: [
      { op: null, value: item.unitPrice, unit: priceUnit, label: "液化炭酸ガスの買値" },
      { op: "×", value: 0, unit: "", label: "工場の排ガスを使うので" },
    ],
    result: { value: 0, unit: priceUnit },
  };
}

/** 加温の熱の行の単価の出し方。工場の排熱を使えるときだけ出す (使えないときは入力の買値をそのまま使うので null)。燃料の試算と共通。 */
export function heatSupplyCalc(item: Pick<CostItem, "unitPrice" | "unitPriceUnit">, on: boolean): CalcSegment | null {
  if (!on) return null;
  const priceUnit = item.unitPriceUnit ?? "円";
  return {
    continues: false,
    terms: [
      { op: null, value: item.unitPrice, unit: priceUnit, label: "熱を買う単価" },
      { op: "×", value: 0, unit: "", label: "工場の排熱を使うので" },
    ],
    result: { value: 0, unit: priceUnit },
  };
}

/** 培地の原料の行の単価の出し方。工場の排液を培地に使えるときだけ出す (使えないときは入力の買値をそのまま使うので null)。燃料の試算と共通。 */
export function mediumSupplyCalc(item: Pick<CostItem, "unitPrice" | "unitPriceUnit">, on: boolean, reductionPct: number): CalcSegment | null {
  if (!on) return null;
  const priceUnit = item.unitPriceUnit ?? "円";
  const factor = mediumPriceFactor(on, reductionPct);
  return {
    continues: false,
    terms: [
      { op: null, value: item.unitPrice, unit: priceUnit, label: "試薬を買う買値" },
      { op: "×", value: factor, unit: "", label: `工場の排液で${reductionPct}%減るので` },
    ],
    result: { value: item.unitPrice * factor, unit: priceUnit },
  };
}

/** 培養ロス補充の単価の出し方: 元にする原料の行の、菌体1kgあたりの額を足す。燃料の試算と共通。 */
export function cultureLossCalc(item: Pick<CostItem, "unitPriceUnit">, sources: Array<{ label: string; perKg: number }>): CalcSegment {
  return {
    continues: false,
    terms: sources.map((s, index) => ({ op: index === 0 ? null : "+", value: s.perKg, unit: "円", label: s.label })),
    result: { value: sources.reduce((t, s) => t + s.perKg, 0), unit: item.unitPriceUnit ?? "円" },
  };
}

/** 式の先頭の「数量 × 単価」で、単価を計算で出した行の単価の呼び名。 */
export function priceLabelOf(item: Pick<CostItem, "priceRule">): string {
  if (item.priceRule === "co2_supply") return "単価（排ガスを使う）";
  if (item.priceRule === "medium_supply") return "単価（排液を培地に使う）";
  if (item.priceRule === "heat_supply") return "単価（排熱を使う）";
  if (item.priceRule === "culture_loss") return "単価（原料の合計）";
  return "単価（前提から計算）";
}

/** 式の中で、培養の原料の行を短く呼ぶ名前 (小項目)。 */
export function cultureSourceLabel(item: Pick<CostItem, "groupLabel" | "midLabel" | "leafLabel">): string {
  return item.leafLabel?.trim() || item.midLabel?.trim() || costItemLabel(item);
}

/** 単価を前提から計算する行の、単価の出し方 (effectiveUnitPrice と同じ前提と既定値)。単価をそのまま使う行は null。 */
function priceRuleCalc(item: CostItem, assumptions: CostAssumption[], derived: CostDerived, sel: CostSelection, unit: string, items?: CostItem[]): CalcSegment | null {
  const batchVolume = roleValue(assumptions, "batch_volume", 100, sel);
  const price = effectiveUnitPrice(item, assumptions, derived, sel, items);
  const priceUnit = item.unitPriceUnit ?? "円";
  // 画面は「単価 ＝ …」と書き出すので、答えに「単価」の名前を付けない
  const result = { value: price, unit: priceUnit };
  const power = (kwRole: string, kwFallback: number, hrtRole: string, hrtFallback: number): CalcSegment => ({
    continues: false,
    terms: [
      { op: null, value: roleValue(assumptions, kwRole, kwFallback, sel), unit: "kW", label: "動力" },
      { op: "×", value: roleValue(assumptions, hrtRole, hrtFallback, sel), unit: "時間", label: "反応時間" },
      { op: "×", value: roleValue(assumptions, "power_unit_price", 27, sel), unit: "円/kWh", label: "電力単価" },
      { op: "÷", value: batchVolume, unit, label: "1バッチの量" },
    ],
    result,
  });
  switch (item.priceRule) {
    case "co2_supply":
      return co2SupplyCalc(item, flueGasOn(resolveAssumption(assumptions, CO2_FLUE_GAS_ROLE, sel)));
    case "heat_supply":
      return heatSupplyCalc(item, wasteHeatOn(resolveAssumption(assumptions, WASTE_HEAT_ROLE, sel)));
    case "medium_supply":
      return mediumSupplyCalc(
        item,
        wasteMediumOn(resolveAssumption(assumptions, WASTE_MEDIUM_ROLE, sel)),
        roleValue(assumptions, WASTE_MEDIUM_REDUCTION_ROLE, 0, sel)
      );
    case "culture_loss":
      if (!items) return null;
      return cultureLossCalc(
        item,
        cultureLossSources(item, items, sel).map((x) => ({
          label: cultureSourceLabel(x),
          perKg: x.quantity * effectiveUnitPrice(x, assumptions, derived, sel, items) * x.annualFactor,
        }))
      );
    case "biomass":
      return { continues: false, terms: [{ op: null, value: item.unitPrice, unit: priceUnit, label: "基準の単価" }, { op: "×", value: derived.biomassFactor, unit: "倍", label: "菌体の量の倍率" }], result };
    case "broth":
      return { continues: false, terms: [{ op: null, value: item.unitPrice, unit: priceUnit, label: "基準の単価" }, { op: "×", value: derived.brothFactor, unit: "倍", label: "培養液の量の倍率" }], result };
    case "module_swap":
      return {
        continues: false,
        terms: [
          { op: null, value: roleValue(assumptions, "module_unit_price", 1_500_000, sel), unit: "円", label: "モジュール一式" },
          { op: "÷", value: roleValue(assumptions, "module_durability_batches", 50, sel), unit: "バッチ", label: "耐用" },
          { op: "÷", value: batchVolume, unit, label: "1バッチの量" },
        ],
        result,
      };
    case "power_circulation":
      return power("power_kw_circulation", 1.5, "hrt_circulation", 4);
    case "power_injection":
      return power("power_kw_injection", 2.5, "hrt_injection", 4);
    case "spent_disposal":
      return {
        continues: false,
        terms: [
          { op: null, value: roleValue(assumptions, "spent_wet_factor", 5, sel), unit: "倍", label: "脱水後の湿重量倍率" },
          { op: "×", value: roleValue(assumptions, "sludge_disposal_price", 35, sel), unit: "円/kg", label: "汚泥の処分単価" },
        ],
        result,
      };
    case "recovery_capex":
      return {
        continues: false,
        terms: [
          { op: null, value: roleValue(assumptions, "recovery_facility_capex", 0, sel), unit: "円", label: "1系列の初期投資" },
          { op: "÷", value: roleValue(assumptions, "recovery_facility_life_years", 10, sel), unit: "年", label: "耐用" },
          { op: "÷", value: roleValue(assumptions, "recovery_line_capacity_kg_year", 0, sel), unit: "kg", label: "1系列が1年に処理する使用済み菌体" },
        ],
        result,
      };
    default:
      return null;
  }
}

/**
 * 明細1行の右端の額を、画面に出す式にする。数量 × 単価 は行の「〜あたり」の額で、そこから右端の単位へ直す。
 * 菌体の製造拠点の行は 円/kg (centralItemPerKg と同じ値)。初期投資・年額は 1系列の1年あたり → ÷ 1系列が1年に作る菌体。
 * それ以外の行は 円/処理量 (annualAmount ÷ 年間処理量 と同じ値)。菌体に比例する行は × 処理量1単位に使う菌体。
 * 同じ値になることは契約チェック (check_project_fuel_cost_model.mts) で確かめる。年間処理量が0の行は null。
 */
export function costItemCalc(
  item: CostItem,
  assumptions: CostAssumption[],
  derived: CostDerived,
  sel: CostSelection,
  central: { capacity: number; sel: CostSelection },
  unit: string,
  items?: CostItem[]
): ItemCalc | null {
  if (item.isBreakdown || item.basis === "内訳") return null;
  if (item.scenario === "中央培養") {
    const centralDerived = deriveCostBasis(assumptions, central.sel);
    const price = effectiveUnitPrice(item, assumptions, centralDerived, central.sel, items);
    const priceCalc = priceRuleCalc(item, assumptions, centralDerived, central.sel, unit, items);
    const head = quantityPriceTerms(item, price, priceCalc ? priceLabelOf(item) : undefined);
    const base = item.quantity * price * item.annualFactor;
    const toPerKg = (annual: number): CalcSegment => ({
      continues: true,
      terms: [{ op: "÷", value: central.capacity, unit: "kg", label: "1系列が1年に作る菌体" }],
      result: { value: safeDiv(annual, central.capacity), unit: "円/kg" },
    });
    switch (item.basis) {
      case "初期投資配賦": {
        const annual = safeDiv(base, item.usefulLifeYears ?? 0);
        return {
          price: priceCalc,
          excluded: null,
          segments: [{ continues: false, terms: [...head, { op: "÷", value: item.usefulLifeYears ?? 0, unit: "年", label: "耐用" }], result: { value: annual, unit: "円", label: "1系列の1年あたり" } }, toPerKg(annual)],
        };
      }
      case "年額固定":
        return { price: priceCalc, excluded: null, segments: [{ continues: false, terms: head, result: { value: base, unit: "円", label: "1系列の1年あたり" } }, toPerKg(base)] };
      case "毎kg菌体比例":
        return { price: priceCalc, excluded: null, segments: [{ continues: false, terms: head, result: { value: base, unit: "円/kg" } }] };
      default:
        return null;
    }
  }
  if (derived.annualVolume <= 0) return null;
  const price = effectiveUnitPrice(item, assumptions, derived, sel, items);
  const priceCalc = priceRuleCalc(item, assumptions, derived, sel, unit, items);
  const head = quantityPriceTerms(item, price, priceCalc ? priceLabelOf(item) : undefined);
  const base = item.quantity * price * item.annualFactor;
  const perUnit = `円/${unit}`;
  const toPerUnit = (annual: number): CalcSegment => ({
    continues: true,
    terms: [{ op: "÷", value: derived.annualVolume, unit, label: "顧客1社の年間処理量" }],
    result: { value: annual / derived.annualVolume, unit: perUnit },
  });
  switch (item.basis) {
    case "初期投資配賦": {
      const annual = safeDiv(base, item.usefulLifeYears ?? 0);
      return {
        price: priceCalc,
        excluded: null,
        segments: [{ continues: false, terms: [...head, { op: "÷", value: item.usefulLifeYears ?? 0, unit: "年", label: "耐用" }], result: { value: annual, unit: "円", label: "1年あたり" } }, toPerUnit(annual)],
      };
    }
    case "毎m³比例":
      return { price: priceCalc, excluded: null, segments: [{ continues: false, terms: head, result: { value: base, unit: perUnit } }] };
    case "バッチ連動":
    case "年額固定":
      return { price: priceCalc, excluded: null, segments: [{ continues: false, terms: head, result: { value: base, unit: "円", label: "1年あたり" } }, toPerUnit(base)] };
    case "毎kg菌体比例":
      return {
        price: priceCalc,
        excluded: null,
        segments: [
          { continues: false, terms: head, result: { value: base, unit: "円", label: "菌体1kgあたり" } },
          { continues: true, terms: [{ op: "×", value: derived.biomassKgPerUnit, unit: "kg", label: `処理量1${unit}で使い切る菌体` }], result: { value: base * derived.biomassKgPerUnit, unit: perUnit } },
        ],
      };
    default:
      return null;
  }
}

export interface CostTaskAmount {
  /** 年間回数。 */
  occurrences: number;
  /** 使った作業単価 (円/時)。いつも前提の共通の作業単価 (labor_rate)。 */
  rate: number;
  hours: number;
  /** 年間の工数 (人時)。 */
  annualHours: number;
  laborAnnual: number;
  expenseAnnual: number;
  annual: number;
}

/**
 * 作業1行の年額。年額 = 年間回数 × (1回の工数 × 作業単価 + 1回の経費)。
 * 作業単価は前提の共通の作業単価 (labor_rate) の1つだけ。作業ごとの単価は持たない (まさ 2026-09-14)。
 * 製造拠点の作業は、拠点に1つの作業は固定の回数、培養設備の系列ごとの作業は 1系列あたりの回数 × 系列数 で数える。
 */
export function taskAmount(
  task: CostTask,
  assumptions: CostAssumption[],
  derived: CostDerived,
  sel: CostSelection = NO_SELECTION
): CostTaskAmount {
  const fixedCount = Math.max(task.countPerYear ?? 0, 0);
  const occurrences =
    task.countDriver === "production_line" ? fixedCount * Math.max(derived.productionLines ?? 1, 0)
    : task.scenario === "中央培養" || task.countDriver === "fixed" ? fixedCount
    : task.countDriver === "batch" ? derived.annualBatches
    : task.countDriver === "visit" ? derived.visitsPerYear
    : task.countDriver === "module_swap" ? derived.moduleSwapsPerYear
    : task.countDriver === "membrane_swap" ? derived.membraneSwapsPerYear
    : task.countDriver === "truck_trip" ? derived.truckTripsPerYear
    : 0;
  const rate = roleValue(assumptions, "labor_rate", 4000, sel);
  const hours = typeof task.hoursPerOccurrence === "number" && Number.isFinite(task.hoursPerOccurrence) ? Math.max(task.hoursPerOccurrence, 0) : 0;
  const expense = Number.isFinite(task.expensePerOccurrence) ? Math.max(task.expensePerOccurrence, 0) : 0;
  const laborAnnual = occurrences * hours * rate;
  const expenseAnnual = occurrences * expense;
  return {
    occurrences,
    rate,
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
    bearer: "sx",
  };
}

/** 第1段: 株ごとの菌体の製造原価 (円/kg-DCW)。用途には依存しない。 */
/**
 * 年に作る量と培養設備の系列数。
 * 年間処理量 (business_annual_volume ＋ 別に持つときは offsite_annual_volume) があれば、
 * 年に作る量 = (オンサイトの年間処理量 × オンサイトで使い切る菌体量 ＋ オフサイトの年間処理量 × オフサイトで使い切る菌体量) ÷ 販売率 で計算し、
 * 1系列の量 (culture_line_capacity_kg_year。無ければ culture_capacity_kg_year) で割った数だけ系列を並べる。
 * オフサイトで使い切る菌体量は、オフサイトの濃さ (offsite_target_concentration) を別に持つときはその濃さで出す。
 * 無ければ、これまでどおり年間生産能力 (culture_capacity_kg_year) をそのまま年に作る量とし、系列は1つ。
 */
export function productionScaleOf(
  assumptions: CostAssumption[],
  strain: CostStrain | null,
  application: CostApplication | null,
  salesRate: number
): {
  fromVolume: boolean;
  businessVolume: number;
  onsiteVolume: number;
  offsiteVolume: number;
  offsiteVolumeSeparate: boolean;
  /** オンサイトの処理1単位で使い切る菌体量 (kg-DCW)。 */
  onsiteBiomassKgPerUnit: number;
  /** オフサイトの処理1単位で使い切る菌体量 (kg-DCW)。オフサイトの濃さを別に持たなければオンサイトと同じ。 */
  offsiteBiomassKgPerUnit: number;
  capacityKgYear: number;
  lineCapacityKgYear: number;
  productionLines: number;
} {
  const sel: CostSelection = { strain, application: null };
  const appSel: CostSelection = { strain, application };
  const onsiteVolume = Math.max(roleValue(assumptions, "business_annual_volume", 0, appSel), 0);
  const offsiteValue = resolveAssumption(assumptions, "offsite_annual_volume", appSel)?.value;
  const offsiteVolumeSeparate = typeof offsiteValue === "number" && Number.isFinite(offsiteValue);
  const offsiteVolume = offsiteVolumeSeparate ? Math.max(offsiteValue, 0) : 0;
  // オフサイトはオンサイトに足すサイドビジネスとして、同じ製造拠点で菌体を作る (まさ 2026-09-14)
  const volume = onsiteVolume + offsiteVolume;
  const onsiteBiomassKgPerUnit = deriveCostBasis(assumptions, appSel, "onsite").biomassKgPerUnit;
  const offsiteBiomassKgPerUnit = deriveCostBasis(assumptions, appSel, "offsite").biomassKgPerUnit;
  const legacyCapacity = roleValue(assumptions, "culture_capacity_kg_year", 0, sel);
  // 排液を培地に使えるときは増える速さの倍率を掛ける (同じ設備で年に作れる量が増える)
  const lineCapacity = roleValue(assumptions, "culture_line_capacity_kg_year", legacyCapacity, sel) * wasteMediumGrowthFactor(assumptions, sel);
  if (!(volume > 0)) {
    const capacity = legacyCapacity > 0 ? legacyCapacity : lineCapacity;
    return { fromVolume: false, businessVolume: 0, onsiteVolume: 0, offsiteVolume: 0, offsiteVolumeSeparate, onsiteBiomassKgPerUnit, offsiteBiomassKgPerUnit, capacityKgYear: capacity, lineCapacityKgYear: capacity, productionLines: 1 };
  }
  // 引き取る液の濃さが違うので、オンサイトとオフサイトは別々に菌体の量を掛けてから足す
  const capacity = safeDiv(onsiteVolume * onsiteBiomassKgPerUnit + offsiteVolume * offsiteBiomassKgPerUnit, salesRate);
  return {
    fromVolume: true,
    businessVolume: volume,
    onsiteVolume,
    offsiteVolume,
    offsiteVolumeSeparate,
    onsiteBiomassKgPerUnit,
    offsiteBiomassKgPerUnit,
    capacityKgYear: capacity,
    lineCapacityKgYear: lineCapacity,
    productionLines: safeDiv(capacity, lineCapacity),
  };
}

export function computeBiomassCost(
  bundle: CostInputs,
  strain: CostStrain | null,
  application: CostApplication | null = null
): CostBiomassCost {
  const sel: CostSelection = { strain, application: null };
  const { assumptions, items } = bundle;
  const tasks = bundle.tasks ?? [];
  const salesRate = salesRateOf(assumptions, sel);
  const scale = productionScaleOf(assumptions, strain, application, salesRate);
  const capacity = scale.capacityKgYear;
  const lines = scale.productionLines;
  // 製造拠点の作業は系列ごとの作業に系列数を掛けるので、物量に系列数を入れて数える。
  const derived: CostDerived = { ...deriveCostBasis(assumptions, sel), productionLines: lines };
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
  let lineCapexInitial = 0;
  let fixedOpexAnnual = 0;
  let lineTasksAnnual = 0;
  let siteTasksAnnual = 0;
  let taskHoursAnnual = 0;
  let variablePerKg = 0;
  const lives: number[] = [];
  for (const i of central) {
    // 明細は培養設備1系列ぶん。系列の数だけ並べるので、1kgあたりは「1系列の年額 ÷ 1系列の量」になる。
    const perKg = centralItemPerKg(i, assumptions, scale.lineCapacityKgYear, sel, items);
    const row = rowOf(i.basis === "初期投資配賦" ? "capex" : i.basis === "年額固定" ? "fixed" : "variable");
    row.perKg += perKg;
    if (i.strain) row.strainSpecificPerKg += perKg;
    if (i.basis === "初期投資配賦") {
      capexAnnual += safeDiv(i.quantity * i.unitPrice * i.annualFactor, i.usefulLifeYears ?? 0) * lines;
      lineCapexInitial += i.quantity * i.unitPrice;
      if (i.usefulLifeYears && i.quantity * i.unitPrice > 0) lives.push(i.usefulLifeYears);
    }
    else if (i.basis === "年額固定") fixedOpexAnnual += i.quantity * i.unitPrice * i.annualFactor * lines;
    else if (i.basis === "毎kg菌体比例") variablePerKg += perKg;
  }
  for (const t of centralTasks) {
    const amount = taskAmount(t, assumptions, derived, sel);
    const annual = amount.annual;
    if (t.countDriver === "production_line") lineTasksAnnual += annual;
    else siteTasksAnnual += annual;
    taskHoursAnnual += amount.annualHours;
    const perKg = safeDiv(annual, capacity);
    rowOf("tasks").perKg += perKg;
    if (t.strain) rowOf("tasks").strainSpecificPerKg += perKg;
  }
  const tasksAnnual = lineTasksAnnual + siteTasksAnnual;

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
    application,
    fromVolume: scale.fromVolume,
    businessVolume: scale.businessVolume,
    onsiteVolume: scale.onsiteVolume,
    offsiteVolume: scale.offsiteVolume,
    offsiteVolumeSeparate: scale.offsiteVolumeSeparate,
    onsiteBiomassKgPerUnit: scale.onsiteBiomassKgPerUnit,
    offsiteBiomassKgPerUnit: scale.offsiteBiomassKgPerUnit,
    capacityKgYear: capacity,
    lineCapacityKgYear: scale.lineCapacityKgYear,
    productionLines: lines,
    salesRate,
    soldKgYear: capacity * salesRate,
    capexInitial: lineCapexInitial * lines,
    lineCapexInitial,
    usefulLifeMinYears: lives.length > 0 ? Math.min(...lives) : null,
    usefulLifeMaxYears: lives.length > 0 ? Math.max(...lives) : null,
    capexAnnual,
    fixedOpexAnnual,
    tasksAnnual,
    lineTasksAnnual,
    siteTasksAnnual,
    taskHoursAnnual,
    variablePerKg,
    productionPerKg,
    computedPerKg: productionPerKg / salesRate,
    overridePerKg,
    perKg: (overridePerKg ?? productionPerKg) / salesRate,
    strainSpecificPerKg: overridePerKg !== null ? 0 : productionStrainSpecificPerKg / salesRate,
    rows,
  };
}

/** 内訳の中身に出す、明細1行の短い呼び名。CAPEX は中項目、OPEX は中項目と小項目のうち具体的な方 (長い方)。 */
function partLabelOfItem(item: Pick<CostItem, "costType" | "groupLabel" | "midLabel" | "leafLabel">): string {
  const mid = item.midLabel?.trim() || "";
  const leaf = item.leafLabel?.trim() || "";
  if (item.costType === "CAPEX") return mid || leaf || item.groupLabel || "(名称なし)";
  const specific = leaf.length >= mid.length ? leaf : mid;
  return specific || item.groupLabel || "(名称なし)";
}

/** 同じ呼び名・同じ小分けを足し合わせ、大きい順に並べる。0円の中身は出さない。 */
function sumParts(entries: CostBreakdownPart[]): CostBreakdownPart[] {
  const m = new Map<string, CostBreakdownPart>();
  for (const e of entries) {
    const k = `${e.label} ${e.groupKey ?? ""}`;
    const hit = m.get(k);
    if (hit) hit.perUnit += e.perUnit;
    else m.set(k, { ...e });
  }
  return [...m.values()].filter((p) => Math.abs(p.perUnit) > 1e-9).sort((a, b) => b.perUnit - a.perUnit);
}

const BIOMASS_PART_LABEL: Record<CostBiomassRowKey, string> = {
  capex: "培養設備の償却",
  fixed: "年ごとの固定費",
  tasks: "製造拠点の作業",
  variable: "培地・CO2・濃縮など",
};
/** 第1段の行を動かす小分け。設備は CAPEX の製造拠点、原料と品質確認は OPEX の製造拠点、作業は人件費。 */
const BIOMASS_PART_GROUP: Record<CostBiomassRowKey, string> = {
  capex: "capex-production",
  fixed: "opex-production",
  tasks: "opex-labor",
  variable: "opex-production",
};

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
  const locations = listLocations(bundle);
  const strain = options.strain !== undefined && options.strain !== null && strains.includes(options.strain)
    ? options.strain
    : strains[0] ?? null;
  const appList: Array<CostApplication | null> = applications.length > 0 ? applications : [null];

  // 年に作る量は用途ごとに違う (使い切る菌体量が違う) ので、第1段も用途ごとに出す。
  const biomassByApplication = appList.map((application) => ({ application, biomass: computeBiomassCost(bundle, strain, application) }));
  const biomassByStrain = (strains.length > 0 ? strains : [null]).flatMap((s) => appList.map((application) => computeBiomassCost(bundle, s, application)));
  const centralSel: CostSelection = { strain, application: null };

  const live = items.filter((i) => !i.isBreakdown && i.basis !== "内訳");
  const newTankCapex = roleValue(assumptions, "new_tank_capex", 18_000_000);
  const tankLife = roleValue(assumptions, "tank_life_years", 10);
  const tankBearer = onsiteTankBearer(assumptions);

  const scenarios: CostScenarioResult[] = [];
  const derivedByApplication: CostComputation["derivedByApplication"] = [];

  for (const application of appList) {
    const sel: CostSelection = { strain, application };
    const biomass = (biomassByApplication.find((b) => b.application === application) ?? biomassByApplication[0]).biomass;
    const capexRow = biomass.rows.find((r) => r.key === "capex");
    const capexShare = biomass.overridePerKg !== null ? 0 : safeDiv(capexRow?.perKg ?? 0, biomass.perKg);
    // 製造拠点の系列ごとの作業は、この用途で年に作る量から出した系列数で数える。
    const onsiteDerived: CostDerived = { ...deriveCostBasis(assumptions, sel, "onsite"), productionLines: biomass.productionLines };
    // オフサイトは対象物質の濃さを別に持てるので、使い切る菌体量 (と、それに比例する明細) が方式で変わる。
    const offsiteDerived: CostDerived = { ...deriveCostBasis(assumptions, sel, "offsite"), productionLines: biomass.productionLines };
    const centralDerived: CostDerived = { ...deriveCostBasis(assumptions, centralSel), productionLines: biomass.productionLines };
    derivedByApplication.push({ application, derived: onsiteDerived, offsiteDerived });
    const volume = onsiteDerived.annualVolume;
    const perUnit = (annual: number) => safeDiv(annual, volume);

    for (const location of locations) for (const method of METHODS) {
      const derived = location === "offsite" ? offsiteDerived : onsiteDerived;
      const amount = (i: CostItem) => annualAmount(i, assumptions, derived, sel, items);
      const taskAnnualOf = (t: CostTask) => taskAmount(t, assumptions, derived, sel);

      const biomassAnnual = biomass.perKg * derived.biomassKgPerUnit * volume;
      const centralCapexAnnual = biomassAnnual * capexShare;
      const centralOpexAnnual = biomassAnnual - centralCapexAnnual;
      const centralStrainSpecificAnnual = biomass.strainSpecificPerKg * derived.biomassKgPerUnit * volume;
      const biomassParts = biomass.overridePerKg !== null
        ? [{ label: "菌体の製造原価（上書き値）", perUnit: perUnit(biomassAnnual), groupKey: "cond-biomass" }]
        : biomass.rows.map((r) => ({ label: BIOMASS_PART_LABEL[r.key], perUnit: r.perKg * derived.biomassKgPerUnit, groupKey: BIOMASS_PART_GROUP[r.key] }));

      // 第1段の各行が、この用途・方式で1単位あたりいくらを乗せているか。確度の帯グラフ用。
      const centralContrib: Array<{ item: CostItem; annual: number }> = biomass.overridePerKg !== null
        ? []
        : [
            ...live
              .filter((i) => i.scenario === "中央培養" && i.costType !== "参考" && scopeApplies(i, centralSel))
              .map((i) => ({
                item: i,
                annual: (centralItemPerKg(i, assumptions, biomass.lineCapacityKgYear, centralSel, items) / biomass.salesRate) * derived.biomassKgPerUnit * volume,
              })),
            ...tasks
              .filter((t) => t.scenario === "中央培養" && scopeApplies(t, centralSel))
              .map((t) => ({
                item: taskAsItem(t),
                annual: (safeDiv(taskAmount(t, assumptions, centralDerived, centralSel).annual, biomass.capacityKgYear) / biomass.salesRate) *
                  derived.biomassKgPerUnit * volume,
              })),
          ];

      const scopes = scopesFor(location, method);
      const own = live.filter((i) => scopes.includes(i.scenario) && scopeApplies(i, sel));
      // SX の原価に入れるのは SX が持つ明細だけ。顧客が持つ明細 (オンサイトのリアクター・汚泥の処分など) は数えない。
      const counted = own.filter((i) => i.costType !== "参考" && resolveBearer(i, location) === "sx");
      const applicableTasks = tasks.filter((t) => scopes.includes(t.scenario) && scopeApplies(t, sel));
      // SX の原価と作業時間に入れるのは SX がやる作業だけ。顧客がやる作業は数えない。
      const siteTaskAmounts = applicableTasks
        .filter((t) => resolvePerformer(t, location) === "sx")
        .map((t) => ({ task: t, amount: taskAnnualOf(t) }));
      const siteItemOpexAnnual = counted.filter((i) => i.costType === "OPEX").reduce((s, i) => s + amount(i), 0);
      const siteTaskAnnual = siteTaskAmounts.reduce((s, x) => s + x.amount.annual, 0);
      const siteTaskHours = siteTaskAmounts.reduce((s, x) => s + x.amount.annualHours, 0);
      const transportAnnual = siteTaskAmounts.filter((x) => isTransportTask(x.task)).reduce((s, x) => s + x.amount.annual, 0);
      const siteOpexAnnual = siteItemOpexAnnual + siteTaskAnnual;
      const siteCapexAnnual = counted.filter((i) => i.costType === "CAPEX").reduce((s, i) => s + amount(i), 0);
      const siteCapexBase = items
        .filter((i) => scopes.includes(i.scenario) && i.costType === "CAPEX" && !i.isBreakdown && scopeApplies(i, sel) && resolveBearer(i, location) === "sx")
        .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const siteStrainSpecificAnnual =
        counted.filter((i) => i.strain).reduce((s, i) => s + amount(i), 0) +
        siteTaskAmounts.filter((x) => x.task.strain).reduce((s, x) => s + x.amount.annual, 0);
      const postItems = counted.filter((i) => i.costType === "OPEX" && i.groupLabel !== null && POST_PROCESS_GROUPS.has(i.groupLabel));
      const postAnnual = postItems.reduce((s, i) => s + amount(i), 0);
      const consumableItems = counted.filter((i) => i.costType === "OPEX" && !(i.groupLabel !== null && POST_PROCESS_GROUPS.has(i.groupLabel)));
      const capexItems = counted.filter((i) => i.costType === "CAPEX");

      const contributing: Array<{ item: CostItem; annual: number }> = [
        ...counted.map((i) => ({ item: i, annual: amount(i) })),
        ...siteTaskAmounts.map((x) => ({ item: taskAsItem(x.task), annual: x.amount.annual })),
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

      for (const tankMode of tankModesFor(location, tankBearer)) {
        const tankAnnual = tankMode === "新設" ? safeDiv(newTankCapex, tankLife) : 0;
        const tankLabel = location === "offsite" ? "SX工場の槽（新設）" : "新設槽（コンクリート地下タンク）";
        const opexTotalAnnual = siteOpexAnnual + centralOpexAnnual;
        const capexTotalAnnual = siteCapexAnnual + tankAnnual + centralCapexAnnual;
        const totalAnnual = opexTotalAnnual + capexTotalAnnual;
        const totalPerUnit = perUnit(totalAnnual);
        const offsitePriced = location === "offsite" && derived.offsitePriceSeparate;
        const price = location === "offsite" ? derived.offsiteSalePrice : derived.salePrice;
        const businessScope: CostScenarioResult["businessScope"] = biomass.offsiteVolumeSeparate ? location : "total";
        const businessVolume = !biomass.fromVolume ? 0 : businessScope === "offsite" ? biomass.offsiteVolume : businessScope === "onsite" ? biomass.onsiteVolume : biomass.businessVolume;

        const rows = [
          ...contributing,
          ...(tankMode === "新設"
            ? [{
                item: {
                  costItemId: `${location}-${method}-tank`,
                  scenario: "共通",
                  costType: "CAPEX",
                  leafLabel: tankLabel,
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

        const parts: Record<CostBreakdownKey, CostBreakdownPart[]> = {
          biomass: sumParts(biomassParts),
          transport: sumParts(
            siteTaskAmounts.filter((x) => isTransportTask(x.task)).map((x) => ({ label: x.task.label, perUnit: perUnit(x.amount.annual), groupKey: "opex-labor" }))
          ),
          labor: sumParts(
            siteTaskAmounts.filter((x) => !isTransportTask(x.task)).map((x) => ({ label: x.task.groupLabel ?? "作業", perUnit: perUnit(x.amount.annual), groupKey: "opex-labor" }))
          ),
          postProcess: sumParts(postItems.map((i) => ({ label: partLabelOfItem(i), perUnit: perUnit(amount(i)), groupKey: paramGroupOfItem(i)?.key ?? null }))),
          consumables: sumParts(consumableItems.map((i) => ({ label: partLabelOfItem(i), perUnit: perUnit(amount(i)), groupKey: paramGroupOfItem(i)?.key ?? null }))),
          capex: sumParts([
            ...capexItems.map((i) => ({ label: partLabelOfItem(i), perUnit: perUnit(amount(i)), groupKey: paramGroupOfItem(i)?.key ?? null })),
            ...(tankAnnual > 0 ? [{ label: tankLabel, perUnit: perUnit(tankAnnual), groupKey: "capex-tank" }] : []),
          ]),
        };
        const slices: Record<CostBreakdownKey, number> = {
          biomass: perUnit(biomassAnnual),
          transport: perUnit(transportAnnual),
          labor: perUnit(siteTaskAnnual - transportAnnual),
          postProcess: perUnit(postAnnual),
          consumables: perUnit(siteItemOpexAnnual - postAnnual),
          capex: perUnit(siteCapexAnnual + tankAnnual),
        };

        const marginForRequired = targetMargin ?? 0;
        const allowedTotalCostPerUnit = price * (1 - marginForRequired);
        const appLabel = application ? APPLICATION_LABEL[application] : "";

        scenarios.push({
          key: `${application ?? "all"}:${location === "offsite" ? "オフサイト-" : ""}${method}-${tankMode}`,
          application,
          applicationLabel: appLabel,
          method,
          tankMode,
          location,
          label: scenarioLabelOf(location, method, tankMode, tankBearer),

          siteItemOpexAnnual,
          siteItemOpexPerUnit: perUnit(siteItemOpexAnnual),
          siteTaskAnnual,
          siteTaskPerUnit: perUnit(siteTaskAnnual),
          siteTaskHours,
          transportPerUnit: perUnit(transportAnnual),
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
          salePricePerUnit: price,
          revenueAnnual: price * volume,
          profitPerUnit: price - totalPerUnit,
          profitAnnual: (price - totalPerUnit) * volume,
          marginRate: safeDiv(price - totalPerUnit, price),

          businessVolume,
          businessScope,
          customerCount: safeDiv(businessVolume, volume),
          businessRevenueAnnual: price * businessVolume,
          businessTotalAnnual: totalPerUnit * businessVolume,
          businessProfitAnnual: (price - totalPerUnit) * businessVolume,

          breakEvenPricePerUnit: totalPerUnit,
          requiredPricePerUnit: safeDiv(totalPerUnit, 1 - marginForRequired),
          allowedTotalCostPerUnit,
          gapToAllowedPerUnit: allowedTotalCostPerUnit - totalPerUnit,
          // 総コスト目標はオンサイトの売価に対して置いた値なので、売価を別に持つオフサイトには当てない
          gapToTargetPerUnit: targetTotal === null || offsitePriced ? null : targetTotal - totalPerUnit,

          strainSpecificPerUnit: perUnit(siteStrainSpecificAnnual + centralStrainSpecificAnnual),
          postProcessPerUnit: perUnit(postAnnual),
          breakdown: BREAKDOWN_ORDER.map((key) => ({ key, label: BREAKDOWN_LABEL[key], perUnit: slices[key], parts: parts[key] })),

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
    locations,
    onsiteTankBearer: tankBearer,
    biomass: biomassByApplication[0].biomass,
    biomassByApplication,
    biomassByStrain,
    scenarios,
  };
}

export interface CostFlowTaskRow {
  task: CostTask;
  amount: CostTaskAmount;
  /** 製造拠点の作業か (年額と工数は拠点全体。1単位あたりは菌体費に配った額)。 */
  isProduction: boolean;
  /** 選んだ方式で、誰がやるか。customer の作業は段の工数・年額・1単位に数えない。 */
  performer: "sx" | "customer";
  /** 処理1単位あたり。製造拠点の作業は「年額 ÷ 生産能力 ÷ 販売率 × 使い切る菌体量」。 */
  perUnit: number;
}

export interface CostFlowStep {
  /** group_label。作業の流れの段の名前。 */
  label: string;
  rows: CostFlowTaskRow[];
  /** 段に含まれる作業の範囲 (製造拠点 / 顧客工場 / SX工場 など)。 */
  scopes: CostScenarioScope[];
  /** SX がやる作業の、顧客1社分の年間工数 (製造拠点の作業を除く)。 */
  siteHours: number;
  /** 製造拠点の年間工数 (拠点全体)。 */
  productionHours: number;
  /** SX がやる作業のうち、工数が未確認 (空欄) の作業の数。 */
  unknownCount: number;
  /** SX がやる作業の、顧客1社分の年額 (製造拠点の作業を除く)。 */
  siteAnnual: number;
  /** SX の原価のうち処理1単位あたり。製造拠点の作業は菌体費に配った額を含む。顧客がやる作業は含まない。 */
  perUnit: number;
}

export interface CostTaskFlow {
  steps: CostFlowStep[];
  /** SX がやる作業の、顧客1社分の年間工数 (製造拠点の作業を除く)。シナリオの siteTaskHours と一致する。 */
  siteHours: number;
  /** 製造拠点の年間工数 (拠点全体)。 */
  productionHours: number;
  unknownCount: number;
  /** 顧客1社分の作業の年額。シナリオの siteTaskAnnual と一致する。 */
  siteAnnual: number;
  /** 顧客1社分の作業の1単位あたり。シナリオの siteTaskPerUnit と一致する。 */
  sitePerUnit: number;
  /** 製造拠点の作業のうち、この処理の菌体費に入っている1単位あたり。 */
  productionPerUnit: number;
}

/**
 * 作業の流れ。選んだ株・用途・方式で発生する作業を、group_label (段) ごとに sort_order の順で束ねる。
 * 段の順は、段に含まれる作業の最小の sort_order。
 */
export function computeTaskFlow(
  bundle: CostInputs,
  computed: CostComputation,
  selection: { application: CostApplication | null; location: CostLocation; method: CostMethod }
): CostTaskFlow {
  const tasks = [...(bundle.tasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const sel: CostSelection = { strain: computed.strain, application: selection.application };
  const centralSel: CostSelection = { strain: computed.strain, application: null };
  // 製造拠点の作業を処理1単位に配る量は、選んだ方式で使い切る菌体量 (オフサイトは濃さを別に持てる)。
  const derived = derivedOf(computed, selection.application, selection.location);
  const b = biomassOf(computed, selection.application);
  const centralDerived: CostDerived = { ...deriveCostBasis(bundle.assumptions, centralSel), productionLines: b.productionLines };

  const steps: CostFlowStep[] = [];
  for (const task of tasks) {
    if (!rowAppliesTo(task, selection.location, selection.method, sel)) continue;
    const isProduction = task.scenario === "中央培養";
    const performer = resolvePerformer(task, selection.location);
    const amount = taskAmount(task, bundle.assumptions, isProduction ? centralDerived : derived, isProduction ? centralSel : sel);
    const perUnit = isProduction
      ? b.overridePerKg !== null ? 0 : (safeDiv(amount.annual, b.capacityKgYear) / b.salesRate) * derived.biomassKgPerUnit
      : safeDiv(amount.annual, derived.annualVolume);
    const label = task.groupLabel ?? "作業";
    let step = steps.find((s) => s.label === label);
    if (!step) {
      step = { label, rows: [], scopes: [], siteHours: 0, productionHours: 0, unknownCount: 0, siteAnnual: 0, perUnit: 0 };
      steps.push(step);
    }
    step.rows.push({ task, amount, isProduction, performer, perUnit });
    if (!step.scopes.includes(task.scenario)) step.scopes.push(task.scenario);
    // 顧客がやる作業は、行として流れに残すだけで、工数・年額・1単位・未確認の数には入れない。
    if (performer === "customer") continue;
    if (task.hoursPerOccurrence === null || task.hoursPerOccurrence === undefined) step.unknownCount += 1;
    if (isProduction) step.productionHours += amount.annualHours;
    else {
      step.siteHours += amount.annualHours;
      step.siteAnnual += amount.annual;
    }
    step.perUnit += perUnit;
  }

  const siteHours = steps.reduce((t, s) => t + s.siteHours, 0);
  const siteAnnual = steps.reduce((t, s) => t + s.siteAnnual, 0);
  return {
    steps,
    siteHours,
    productionHours: steps.reduce((t, s) => t + s.productionHours, 0),
    unknownCount: steps.reduce((t, s) => t + s.unknownCount, 0),
    siteAnnual,
    sitePerUnit: safeDiv(siteAnnual, derived.annualVolume),
    productionPerUnit: steps.reduce((t, s) => t + s.rows.filter((r) => r.isProduction).reduce((u, r) => u + r.perUnit, 0), 0),
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
