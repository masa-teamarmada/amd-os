// PJコックピット / PJワークスペース「コスト試算」タブの計算エンジン。
//
// 正本は project_cost_assumptions (変数) と project_cost_items (明細)。
// ここは純関数だけを置く。DB アクセスも React も持たない。
//
// 260820 スプレッドシートの式をそのまま移植している:
//   必要吸着菌体量   = 対象物質濃度 × k_ppm ÷ 取り込み効率α
//   ロス込必要菌体量 = ÷ 菌体回収率η
//   必要培養液量     = ÷ 運転時菌体濃度
//   菌体量連動係数   = (ロス込 ÷ 菌体使用回数) ÷ 基準値
// 連動係数を基準値で割る形は原典どおり。基準値は「使い捨て・α=0.05・50ppm」のときの値。

export type CostConfidence = "S" | "A" | "B" | "C" | "H";
export type CostVisibility = "amd_internal" | "workspace_shared";
export type CostMethod = "循環" | "投入";
export type CostTankMode = "既設" | "新設";

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
}

export interface CostItem {
  costItemId: string;
  scenario: "循環" | "投入" | "共通" | "中央培養";
  costType: "CAPEX" | "OPEX" | "参考";
  groupLabel: string | null;
  midLabel: string | null;
  leafLabel: string | null;
  basis: "初期投資配賦" | "毎m³比例" | "バッチ連動" | "内訳";
  quantity: number;
  quantityUnit: string | null;
  unitPrice: number;
  unitPriceUnit: string | null;
  priceRule: "biomass" | "broth" | "module_swap" | "power_circulation" | "power_injection" | null;
  annualFactor: number;
  usefulLifeYears: number | null;
  isBreakdown: boolean;
  confidence: CostConfidence | null;
  sourceKind: string | null;
  owner: string | null;
  note: string | null;
  visibility: CostVisibility;
  sortOrder: number;
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

export interface CostModel {
  costModelId: string;
  projectId: string;
  title: string;
  caseKind: "dye_degradation" | "metal_recovery" | "other";
  caseLabel: string;
  versionLabel: string | null;
  status: "draft" | "active" | "archived";
  sourceUrl: string | null;
  sourceNote: string | null;
  summaryMd: string | null;
  visibility: CostVisibility;
  updatedAt: string | null;
}

export interface CostModelBundle {
  model: CostModel;
  assumptions: CostAssumption[];
  items: CostItem[];
  questions: CostQuestion[];
}

// 「使い捨て・50ppm・α=0.05・η=90%・5g/L」のときの値。原典シートの H15 / H16 の除数。
const BASELINE_BIOMASS_G_PER_M3 = 1111.111111;
const BASELINE_BROTH_L_PER_M3 = 222.222222;

export interface CostDerived {
  salePrice: number;
  annualBatches: number;
  annualVolume: number;
  requiredBiomassPerM3: number;
  biomassWithLossPerM3: number;
  requiredBrothPerM3: number;
  /** 年間に要る菌体量 (kg-DCW)。菌体製造原価の妥当性を見るときの分母。 */
  annualBiomassKg: number;
  biomassFactor: number;
  brothFactor: number;
  reuseCount: number;
}

export interface CostScenarioResult {
  key: string;
  method: CostMethod;
  tankMode: CostTankMode;
  label: string;
  siteOpexPerM3: number;
  siteCapexPerM3: number;
  tankPerM3: number;
  siteTotalPerM3: number;
  centralCapexPerM3: number;
  centralOpexPerM3: number;
  centralTotalPerM3: number;
  totalPerM3: number;
  profitPerM3: number;
  marginRate: number;
  siteCapexTotal: number;
  /** 人件費は総コストに含めない前提 (無人運転)。判断のため参考値だけ持つ。 */
  referenceLaborPerM3: number;
  totalWithLaborPerM3: number;
  profitWithLaborPerM3: number;
}

export interface CostComputation {
  derived: CostDerived;
  scenarios: CostScenarioResult[];
}

function roleValue(assumptions: CostAssumption[], roleKey: string, fallback: number): number {
  const hit = assumptions.find((a) => a.roleKey === roleKey);
  const v = hit?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function safeDiv(a: number, b: number): number {
  return b === 0 || !Number.isFinite(b) ? 0 : a / b;
}

export function deriveCostBasis(assumptions: CostAssumption[]): CostDerived {
  const batchVolume = roleValue(assumptions, "batch_volume", 100);
  const operatingDays = roleValue(assumptions, "operating_days", 300);
  const utilization = roleValue(assumptions, "utilization", 1);
  const annualBatches = operatingDays * utilization;
  const annualVolume = batchVolume * annualBatches;

  const concentration = roleValue(assumptions, "target_concentration", 50);
  const kPpm = roleValue(assumptions, "k_ppm", 1);
  const alpha = roleValue(assumptions, "uptake_alpha", 0.05);
  const eta = roleValue(assumptions, "recovery_eta", 90);
  const cellDensity = roleValue(assumptions, "cell_density", 5);
  const reuseCount = Math.max(roleValue(assumptions, "reuse_count", 1), 1);

  const requiredBiomassPerM3 = safeDiv(concentration * kPpm, alpha);
  const biomassWithLossPerM3 = safeDiv(requiredBiomassPerM3, eta / 100);
  const requiredBrothPerM3 = safeDiv(biomassWithLossPerM3, cellDensity);

  return {
    salePrice: roleValue(assumptions, "sale_price", 500),
    annualBatches,
    annualVolume,
    requiredBiomassPerM3,
    biomassWithLossPerM3,
    requiredBrothPerM3,
    annualBiomassKg: (biomassWithLossPerM3 / reuseCount) * annualVolume / 1000,
    biomassFactor: safeDiv(biomassWithLossPerM3 / reuseCount, BASELINE_BIOMASS_G_PER_M3),
    brothFactor: safeDiv(requiredBrothPerM3 / reuseCount, BASELINE_BROTH_L_PER_M3),
    reuseCount,
  };
}

/** 単価が変数へ連動する行の実効単価。連動しない行は unit_price をそのまま返す。 */
export function effectiveUnitPrice(
  item: CostItem,
  assumptions: CostAssumption[],
  derived: CostDerived
): number {
  const batchVolume = roleValue(assumptions, "batch_volume", 100);
  switch (item.priceRule) {
    case "biomass":
      return item.unitPrice * derived.biomassFactor;
    case "broth":
      return item.unitPrice * derived.brothFactor;
    case "module_swap":
      return safeDiv(
        roleValue(assumptions, "module_unit_price", 1_500_000),
        roleValue(assumptions, "module_durability_batches", 50) * batchVolume
      );
    case "power_circulation":
      return safeDiv(
        roleValue(assumptions, "power_kw_circulation", 1.5) *
          roleValue(assumptions, "hrt_circulation", 4) *
          roleValue(assumptions, "power_unit_price", 27),
        batchVolume
      );
    case "power_injection":
      return safeDiv(
        roleValue(assumptions, "power_kw_injection", 2.5) *
          roleValue(assumptions, "hrt_injection", 4) *
          roleValue(assumptions, "power_unit_price", 27),
        batchVolume
      );
    default:
      return item.unitPrice;
  }
}

/** 1行あたりの年間発生額 (円/年)。内訳行は親の小計に含まれるため 0。 */
export function annualAmount(
  item: CostItem,
  assumptions: CostAssumption[],
  derived: CostDerived
): number {
  if (item.isBreakdown || item.basis === "内訳") return 0;
  const price = effectiveUnitPrice(item, assumptions, derived);
  switch (item.basis) {
    case "初期投資配賦":
      return safeDiv(item.quantity * price * item.annualFactor, item.usefulLifeYears ?? 0);
    case "毎m³比例":
      return item.quantity * price * item.annualFactor * derived.annualVolume;
    case "バッチ連動":
      return item.quantity * price * item.annualFactor;
    default:
      return 0;
  }
}

const METHODS: CostMethod[] = ["循環", "投入"];
const TANK_MODES: CostTankMode[] = ["既設", "新設"];

export function computeCostModel(bundle: Pick<CostModelBundle, "assumptions" | "items">): CostComputation {
  const { assumptions, items } = bundle;
  const derived = deriveCostBasis(assumptions);
  const volume = derived.annualVolume;
  const perM3 = (annual: number) => safeDiv(annual, volume);

  const live = items.filter((i) => !i.isBreakdown && i.basis !== "内訳");
  const amount = (i: CostItem) => annualAmount(i, assumptions, derived);

  const centralCapexAnnual =
    live
      .filter((i) => i.scenario === "中央培養" && i.costType === "CAPEX")
      .reduce((s, i) => s + amount(i), 0) /
    Math.max(roleValue(assumptions, "supply_sites", 1), 1);
  const centralOpexAnnual = live
    .filter((i) => i.scenario === "中央培養" && i.costType === "OPEX")
    .reduce((s, i) => s + amount(i), 0);

  const newTankCapex = roleValue(assumptions, "new_tank_capex", 18_000_000);
  const tankLife = roleValue(assumptions, "tank_life_years", 10);

  const scenarios: CostScenarioResult[] = [];
  for (const method of METHODS) {
    const own = live.filter((i) => i.scenario === method || i.scenario === "共通");
    const siteOpexAnnual = own
      .filter((i) => i.costType === "OPEX")
      .reduce((s, i) => s + amount(i), 0);
    const siteCapexAnnual = own
      .filter((i) => i.costType === "CAPEX")
      .reduce((s, i) => s + amount(i), 0);
    const siteCapexTotalBase = items
      .filter((i) => (i.scenario === method || i.scenario === "共通") && i.costType === "CAPEX" && !i.isBreakdown)
      .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const laborAnnual = own
      .filter((i) => i.costType === "参考")
      .reduce((s, i) => s + amount(i), 0);

    for (const tankMode of TANK_MODES) {
      const tankAnnual = tankMode === "新設" ? safeDiv(newTankCapex, tankLife) : 0;
      const siteTotal = perM3(siteOpexAnnual) + perM3(siteCapexAnnual) + perM3(tankAnnual);
      const centralTotal = perM3(centralCapexAnnual) + perM3(centralOpexAnnual);
      const total = siteTotal + centralTotal;
      const labor = perM3(laborAnnual);
      scenarios.push({
        key: `${method}-${tankMode}`,
        method,
        tankMode,
        label: `${method === "循環" ? "A:循環" : "B:投入"}／${tankMode}`,
        siteOpexPerM3: perM3(siteOpexAnnual),
        siteCapexPerM3: perM3(siteCapexAnnual) + perM3(tankAnnual),
        tankPerM3: perM3(tankAnnual),
        siteTotalPerM3: siteTotal,
        centralCapexPerM3: perM3(centralCapexAnnual),
        centralOpexPerM3: perM3(centralOpexAnnual),
        centralTotalPerM3: centralTotal,
        totalPerM3: total,
        profitPerM3: derived.salePrice - total,
        marginRate: safeDiv(derived.salePrice - total, derived.salePrice),
        siteCapexTotal: siteCapexTotalBase + (tankMode === "新設" ? newTankCapex : 0),
        referenceLaborPerM3: labor,
        totalWithLaborPerM3: total + labor,
        profitWithLaborPerM3: derived.salePrice - total - labor,
      });
    }
  }

  return { derived, scenarios };
}

/** 外部 (workspace_account) へ返す前に internal 行を落とす。 */
export function toSharedBundle(bundle: CostModelBundle): CostModelBundle | null {
  if (bundle.model.visibility !== "workspace_shared") return null;
  return {
    model: bundle.model,
    assumptions: bundle.assumptions.filter((a) => a.visibility === "workspace_shared"),
    items: bundle.items.filter((i) => i.visibility === "workspace_shared"),
    questions: bundle.questions.filter((q) => q.visibility === "workspace_shared"),
  };
}
