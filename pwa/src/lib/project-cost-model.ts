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

export interface CostScenarioResult {
  key: string;
  method: CostMethod;
  tankMode: CostTankMode;
  label: string;

  // --- 現場設備 ---
  siteOpexAnnual: number;
  siteOpexPerUnit: number;
  siteCapexAnnual: number;
  siteCapexPerUnit: number;
  tankAnnual: number;
  tankPerUnit: number;
  siteTotalPerUnit: number;
  /** 初期投資 (顧客工場1拠点あたり、槽込み)。 */
  siteCapexTotal: number;

  // --- 中央培養拠点 ---
  centralCapexAnnual: number;
  centralOpexAnnual: number;
  centralCapexPerUnit: number;
  centralOpexPerUnit: number;
  centralTotalPerUnit: number;

  // --- CAPEX / OPEX の総計 (まさ指摘: それぞれいくらか分かること) ---
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

  // --- 成立ライン ---
  /** 現行コストのままなら、この売価が要る (利益0)。 */
  breakEvenPricePerUnit: number;
  /** 目標利益率を置いた場合に要る売価。目標未設定なら損益分岐と同じ。 */
  requiredPricePerUnit: number;
  /** 現行の売価で成立させるために許される総コスト上限。 */
  allowedTotalCostPerUnit: number;
  /** 許容上限 − 実績。負なら「あとこれだけ下げないと成立しない」。 */
  gapToAllowedPerUnit: number;
  /** 総コスト目標 (target_total_cost) との差。目標未設定なら null。 */
  gapToTargetPerUnit: number | null;

  // --- 人件費 (総コストに含めない前提。判断のため併記する) ---
  referenceLaborPerUnit: number;
  totalWithLaborPerUnit: number;
  profitWithLaborPerUnit: number;

  // --- 精度 ---
  confidenceBreakdown: CostConfidenceSlice[];
  topUncertain: CostUncertainItem[];
}

export interface CostComputation {
  derived: CostDerived;
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

const CONFIDENCE_ORDER: Array<CostConfidence | "未設定"> = ["S", "A", "B", "C", "H", "未設定"];

export const CONFIDENCE_LABEL: Record<string, string> = {
  S: "S 確定",
  A: "A 概算",
  B: "B 見積前",
  C: "C 仮置き",
  H: "H 仮説",
  未設定: "未設定",
};

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

export function computeCostModel(
  bundle: Pick<CostModelBundle, "assumptions" | "items"> & { model?: Partial<CostModel> }
): CostComputation {
  const { assumptions, items } = bundle;
  const targetTotal = bundle.model?.targetTotalCostPerUnit ?? null;
  const targetMargin = bundle.model?.targetMarginRate ?? null;

  const derived = deriveCostBasis(assumptions);
  const volume = derived.annualVolume;
  const perUnit = (annual: number) => safeDiv(annual, volume);

  const live = items.filter((i) => !i.isBreakdown && i.basis !== "内訳");
  const amount = (i: CostItem) => annualAmount(i, assumptions, derived);

  const supplySites = Math.max(roleValue(assumptions, "supply_sites", 1), 1);
  const centralCapexAnnual =
    live.filter((i) => i.scenario === "中央培養" && i.costType === "CAPEX").reduce((s, i) => s + amount(i), 0) /
    supplySites;
  const centralOpexAnnual = live
    .filter((i) => i.scenario === "中央培養" && i.costType === "OPEX")
    .reduce((s, i) => s + amount(i), 0);

  const newTankCapex = roleValue(assumptions, "new_tank_capex", 18_000_000);
  const tankLife = roleValue(assumptions, "tank_life_years", 10);

  const scenarios: CostScenarioResult[] = [];
  for (const method of METHODS) {
    const own = live.filter((i) => i.scenario === method || i.scenario === "共通");
    const central = live.filter((i) => i.scenario === "中央培養");
    const siteOpexAnnual = own.filter((i) => i.costType === "OPEX").reduce((s, i) => s + amount(i), 0);
    const siteCapexAnnual = own.filter((i) => i.costType === "CAPEX").reduce((s, i) => s + amount(i), 0);
    const siteCapexBase = items
      .filter((i) => (i.scenario === method || i.scenario === "共通") && i.costType === "CAPEX" && !i.isBreakdown)
      .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const laborAnnual = own.filter((i) => i.costType === "参考").reduce((s, i) => s + amount(i), 0);

    // 確度別の内訳と、精度を落としている項目。中央培養は供給拠点数で割った後の負担で見る。
    const contributing: Array<{ item: CostItem; annual: number }> = [
      ...own.filter((i) => i.costType !== "参考").map((i) => ({ item: i, annual: amount(i) })),
      ...central.map((i) => ({ item: i, annual: amount(i) / supplySites })),
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

      const marginForRequired = targetMargin ?? 0;
      const allowedTotalCostPerUnit = price * (1 - marginForRequired);

      scenarios.push({
        key: `${method}-${tankMode}`,
        method,
        tankMode,
        label: `${method === "循環" ? "A:循環" : "B:投入"}／${tankMode}`,

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
        centralTotalPerUnit: perUnit(centralCapexAnnual + centralOpexAnnual),

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

        referenceLaborPerUnit: perUnit(laborAnnual),
        totalWithLaborPerUnit: totalPerUnit + perUnit(laborAnnual),
        profitWithLaborPerUnit: price - totalPerUnit - perUnit(laborAnnual),

        confidenceBreakdown,
        topUncertain,
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
