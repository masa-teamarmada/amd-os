import type { CapitalEvent, Holder } from "./capital-plan.ts";

export type SxBusinessPlanLane = "business" | "technology" | "organization" | "funding";

export interface SxXrlTarget {
  trl: number;
  brl: number;
  grl: number;
  srl: number;
  hrl: number;
}

export interface SxPhaseLanePlan {
  costYen: number | null;
  activities: string[];
  exitGate: string;
  xrlKeys: Array<keyof SxXrlTarget>;
}

export interface SxBusinessPlanPhase {
  id: string;
  label: string;
  period: string;
  openingRound: string;
  budgetYen: number | null;
  burnLabel?: string;
  fundingSource: string;
  maxFixedBurnMonthlyYen: number;
  targetXrl: SxXrlTarget;
  lanes: Record<SxBusinessPlanLane, SxPhaseLanePlan>;
}

export interface SxAnnualProjection {
  fiscalYear: number;
  revenueYen: number;
  costOfSalesYen: number;
  executiveCompensationYen: number;
  salariesAndBonusesYen: number;
  researchAndDevelopmentYen: number;
  sellingGeneralAdministrativeYen: number;
  subsidySpecialGainYen: number;
  subsidyCompressionLossYen: number;
  capexYen: number;
  equityFundingYen: number;
  subsidyCashReceiptYen: number;
}

// 会社設立日（2026-09-17 まさ「設立は20270401」）。事業計画タブは active 資本政策の設立イベントを優先し、無いときにこの値を使う。
// 月次試算表は FY2027 を 2027-04 から計上し、ゴールツリーの「NewCo設立」の期限も 2027-04-01。
export const SX_INCORPORATION_DATE = "2027-04-01";
export const SX_INCORPORATION_YM = SX_INCORPORATION_DATE.slice(0, 7);

export const SX_BUSINESS_PLAN_PHASES: SxBusinessPlanPhase[] = [
  {
    id: "psi",
    label: "Phase 0｜PSI・会社設立準備",
    period: "2026.07–2027.03",
    openingRound: "PSI・非希薄化資金",
    budgetYen: 60_000_000,
    fundingSource: "PSI等 0.6億円（NewCoの株式調達外）",
    maxFixedBurnMonthlyYen: 1_500_000,
    targetXrl: { trl: 4, brl: 3, grl: 1, srl: 3, hrl: 3 },
    lanes: {
      business: {
        costYen: 10_000_000,
        activities: ["優先顧客2業界と最初の用途を固定", "排水基準・環境安全・菌体/包装物の取扱いと顧客設備側の責任分界を整理", "有償PoC候補2社の意向を確認"],
        exitGate: "誰が、何に、いくら払うかを2社で説明できる",
        xrlKeys: ["brl", "grl", "srl"],
      },
      technology: {
        costYen: 40_000_000,
        activities: ["培養株・培養レシピ・品質指標を絞る", "培養→回収→包装→輸送→顧客投入の一連条件を設計", "PoC用リアクター仕様と測定計画を固定"],
        exitGate: "ラボ条件で一連工程の再現性と測定方法を確認",
        xrlKeys: ["trl"],
      },
      organization: {
        costYen: 5_000_000,
        activities: ["設立前DDの技術・法務・財務・知財論点を完了", "NewCo設立とCEO候補の役割確定", "大学・発明者・SX間の知財境界を整理"],
        exitGate: "設立前DDを完了し、2027年4月1日の会社設立へ移れる",
        xrlKeys: ["hrl"],
      },
      funding: {
        costYen: 5_000_000,
        activities: ["シードJ-KISSと15か月の資金使途を準備", "設立前に進められるDD・投資委員会の範囲を確認", "必要DD資料と投資家別の条件を協議"],
        exitGate: "シード1億円・キャップ5億円・ディスカウント20％の条件を協議できる",
        xrlKeys: ["brl"],
      },
    },
  },
  {
    id: "seed",
    label: "Phase 1｜シード → シリーズA",
    period: "2027.04–2028.06",
    openingRound: "シード1億円（J-KISS）",
    budgetYen: 126_088_080,
    fundingSource: "シード1億円＋STS・つなぎ融資。支払予算約1億2,609万円、純改善目標1,000万円は未計上。投資家配分は未定。",
    maxFixedBurnMonthlyYen: 4_358_782,
    burnLabel: "通常支出月平均（税込）",
    targetXrl: { trl: 6, brl: 5, grl: 3, srl: 5, hrl: 5 },
    lanes: {
      business: {
        costYen: null,
        activities: ["顧客拠点で有償PoCを3件実施", "包装単位・納品頻度・顧客側運転手順と既存制度への適合要件を商品仕様化", "単価、粗利、継続条件を顧客別に検証"],
        exitGate: "有償PoC3件と年間契約へ進む顧客1社",
        xrlKeys: ["brl", "grl", "srl"],
      },
      technology: {
        costYen: null,
        activities: ["自社内の小規模培養・包装パイロット設備を構築", "輸送後の活性・保存期限・ロット品質基準を確立", "顧客設備での再現運転とユニットエコノミクスを証明"],
        exitGate: "3ロット連続合格、輸送後性能合格、顧客現場で再現",
        xrlKeys: ["trl", "srl"],
      },
      organization: {
        costYen: null,
        activities: ["製品開発担当を確保し、必要な役割を段階的に補う", "品質記録、出荷判定、顧客障害対応の標準手順を導入", "取締役会・月次資金管理を開始"],
        exitGate: "CEO・開発担当・大学・委託先で培養・出荷・現場対応の役割が埋まる",
        xrlKeys: ["hrl"],
      },
      funding: {
        costYen: null,
        activities: ["シードJ-KISSをクローズしSTS申請とつなぎ融資を協議", "2028年6月末現金約359万円に対して純改善1,000万円を目指す", "2028年7月のシリーズA払込に向けDD・条件交渉を前倒し"],
        exitGate: "有償PoC3件の検証とシリーズA入金。不採択時は2028年1月までのブリッジ払込を目標",
        xrlKeys: ["brl", "hrl"],
      },
    },
  },
  {
    id: "series-a",
    label: "Phase 2｜Series A → Series B",
    period: "2028.07–2031.03",
    openingRound: "シリーズA（調達額再精査）",
    budgetYen: null,
    fundingSource: "調達額・評価額・費用配賦は再精査。以降の事業・工場拡張は長期仮説。",
    maxFixedBurnMonthlyYen: 12_000_000,
    targetXrl: { trl: 7, brl: 7, grl: 5, srl: 7, hrl: 7 },
    lanes: {
      business: {
        costYen: null,
        activities: ["複数顧客との年間供給契約へ移行", "導入設計・運転支援・定期供給を標準商品化", "顧客別採算と回収期間を共通指標で管理"],
        exitGate: "継続顧客3社以上、売上7億円規模、変動粗利黒字",
        xrlKeys: ["brl", "srl"],
      },
      technology: {
        costYen: null,
        activities: ["自社量産実証工場を取得・整備", "培養能力をSeed比10倍へ拡張し包装工程を半自動化", "出荷品質・顧客取扱い・トレーサビリティの標準運用を顧客現場で試行"],
        exitGate: "量産実証工場で6か月連続の供給・品質・原価目標を達成",
        xrlKeys: ["trl", "grl"],
      },
      organization: {
        costYen: null,
        activities: ["工場長、品質保証、営業責任者を採用", "製造・営業・管理の部門別予算と権限を設定", "安全衛生・教育・BCPを運用"],
        exitGate: "15–20名体制でCEO不在でも日次操業が継続",
        xrlKeys: ["hrl"],
      },
      funding: {
        costYen: null,
        activities: ["設備投資を能力増強ゲートごとに分割承認", "借入・補助金を株式資金と併用", "Series Bで本格工場投資を開けるDDパックを整備"],
        exitGate: "工場投資前後の原価実績と需要予約でSeries Bを説明",
        xrlKeys: ["brl"],
      },
    },
  },
  {
    id: "series-b",
    label: "Phase 3｜Series B → Series C",
    period: "2031.04–2033.03",
    openingRound: "Series B 15億円",
    budgetYen: 1_500_000_000,
    fundingSource: "想定 pre 60億円 / post 75億円",
    maxFixedBurnMonthlyYen: 25_000_000,
    targetXrl: { trl: 8, brl: 8, grl: 6, srl: 8, hrl: 8 },
    lanes: {
      business: {
        costYen: 280_000_000,
        activities: ["国内重点産業へ販売網を拡大", "複数年・最低購入量付き契約を増やす", "海外導入候補で規制・物流・価格を検証"],
        exitGate: "売上60億円規模への受注残と上位顧客依存の低下",
        xrlKeys: ["brl", "srl"],
      },
      technology: {
        costYen: 900_000_000,
        activities: ["土地・建屋・複数培養ラインを備えた本格自社工場を建設", "自動培養制御・包装・出荷判定を統合", "複数拠点供給に耐える種株保全と災害復旧系を構築"],
        exitGate: "本格工場の設計能力・歩留まり・原価を12か月安定達成",
        xrlKeys: ["trl", "grl", "srl"],
      },
      organization: {
        costYen: 220_000_000,
        activities: ["製造・品質・サプライチェーン・海外事業の執行体制を整備", "内部統制と月次決算を上場準備水準へ引上げ", "採用・育成を拠点展開に合わせて標準化"],
        exitGate: "40–60名体制と監査可能な業務プロセスを確立",
        xrlKeys: ["hrl"],
      },
      funding: {
        costYen: 100_000_000,
        activities: ["工場建設の予備費・支払条件・借入余力を管理", "Series Cまたはプロジェクトファイナンスを比較", "IPO準備監査のギャップ診断を開始"],
        exitGate: "成長投資と運転資金を分けたSeries C計画を確定",
        xrlKeys: ["brl"],
      },
    },
  },
  {
    id: "series-c",
    label: "Phase 4｜Series C → IPO",
    period: "2033.04–2035.03",
    openingRound: "Series C 20億円",
    budgetYen: 2_000_000_000,
    fundingSource: "想定 pre 150億円 / post 170億円",
    maxFixedBurnMonthlyYen: 45_000_000,
    targetXrl: { trl: 8, brl: 8, grl: 8, srl: 8, hrl: 8 },
    lanes: {
      business: {
        costYen: 650_000_000,
        activities: ["全国供給網と海外初号案件を立上げ", "用途別プロダクトラインと価格体系を展開", "売上200億円規模へ向かう受注・継続率を証明"],
        exitGate: "複数業界・複数地域で再現する成長モデルを確立",
        xrlKeys: ["brl", "srl"],
      },
      technology: {
        costYen: 950_000_000,
        activities: ["第二ライン・自動倉庫・全国物流品質を増強", "培養条件のデータ化と遠隔品質監視を完成", "次世代株・用途別包装の継続開発系を運用"],
        exitGate: "複数ライン・複数物流経路で同等品質を常時供給",
        xrlKeys: ["trl", "grl", "srl"],
      },
      organization: {
        costYen: 300_000_000,
        activities: ["上場会社水準の経営管理・内部監査・開示体制を整備", "海外・製造・研究開発の後継責任者を配置", "安全・品質文化を全拠点へ展開"],
        exitGate: "監査・開示・予算統制が計画どおり反復運用",
        xrlKeys: ["hrl"],
      },
      funding: {
        costYen: 100_000_000,
        activities: ["主幹事・監査法人・証券審査へ対応", "IPO時の公募10億円を成長投資枠として設計", "既存株主・SO・公開市場の希薄化を最終調整"],
        exitGate: "上場審査、資本構成、調達使途の整合が取れる",
        xrlKeys: ["brl", "grl", "hrl"],
      },
    },
  },
];

export const SX_ANNUAL_PROJECTION: SxAnnualProjection[] = [
  { fiscalYear: 2027, revenueYen: 11_550_000, costOfSalesYen: 12_732_492, executiveCompensationYen: 25_200_000, salariesAndBonusesYen: 16_800_000, researchAndDevelopmentYen: 36_000_000, sellingGeneralAdministrativeYen: 3_515_496, subsidySpecialGainYen: 0, subsidyCompressionLossYen: 0, capexYen: 34_900_000, equityFundingYen: 150_000_000, subsidyCashReceiptYen: 0 },
  { fiscalYear: 2028, revenueYen: 71_850_000, costOfSalesYen: 62_417_988, executiveCompensationYen: 25_200_000, salariesAndBonusesYen: 37_800_000, researchAndDevelopmentYen: 36_000_000, sellingGeneralAdministrativeYen: 14_118_492, subsidySpecialGainYen: 0, subsidyCompressionLossYen: 0, capexYen: 27_300_000, equityFundingYen: 300_000_000, subsidyCashReceiptYen: 0 },
  { fiscalYear: 2029, revenueYen: 338_400_000, costOfSalesYen: 278_088_984, executiveCompensationYen: 25_200_000, salariesAndBonusesYen: 126_000_000, researchAndDevelopmentYen: 36_000_000, sellingGeneralAdministrativeYen: 49_283_988, subsidySpecialGainYen: 0, subsidyCompressionLossYen: 0, capexYen: 27_300_000, equityFundingYen: 600_000_000, subsidyCashReceiptYen: 0 },
  { fiscalYear: 2030, revenueYen: 670_800_000, costOfSalesYen: 516_031_980, executiveCompensationYen: 25_200_000, salariesAndBonusesYen: 126_000_000, researchAndDevelopmentYen: 48_000_000, sellingGeneralAdministrativeYen: 61_107_984, subsidySpecialGainYen: 0, subsidyCompressionLossYen: 0, capexYen: 85_800_000, equityFundingYen: 0, subsidyCashReceiptYen: 0 },
  { fiscalYear: 2031, revenueYen: 973_200_000, costOfSalesYen: 710_876_288, executiveCompensationYen: 25_200_000, salariesAndBonusesYen: 126_000_000, researchAndDevelopmentYen: 48_000_000, sellingGeneralAdministrativeYen: 64_131_984, subsidySpecialGainYen: 0, subsidyCompressionLossYen: 0, capexYen: 622_300_000, equityFundingYen: 1_500_000_000, subsidyCashReceiptYen: 0 },
  { fiscalYear: 2032, revenueYen: 3_000_000_000, costOfSalesYen: 900_000_000, executiveCompensationYen: 24_000_000, salariesAndBonusesYen: 480_000_000, researchAndDevelopmentYen: 300_000_000, sellingGeneralAdministrativeYen: 496_000_000, subsidySpecialGainYen: 200_000_000, subsidyCompressionLossYen: 200_000_000, capexYen: 500_000_000, equityFundingYen: 0, subsidyCashReceiptYen: 200_000_000 },
  { fiscalYear: 2033, revenueYen: 6_000_000_000, costOfSalesYen: 1_800_000_000, executiveCompensationYen: 30_000_000, salariesAndBonusesYen: 900_000_000, researchAndDevelopmentYen: 450_000_000, sellingGeneralAdministrativeYen: 820_000_000, subsidySpecialGainYen: 500_000_000, subsidyCompressionLossYen: 500_000_000, capexYen: 800_000_000, equityFundingYen: 2_000_000_000, subsidyCashReceiptYen: 500_000_000 },
  { fiscalYear: 2034, revenueYen: 12_000_000_000, costOfSalesYen: 3_600_000_000, executiveCompensationYen: 36_000_000, salariesAndBonusesYen: 1_700_000_000, researchAndDevelopmentYen: 700_000_000, sellingGeneralAdministrativeYen: 1_464_000_000, subsidySpecialGainYen: 0, subsidyCompressionLossYen: 0, capexYen: 1_000_000_000, equityFundingYen: 0, subsidyCashReceiptYen: 0 },
  { fiscalYear: 2035, revenueYen: 20_000_000_000, costOfSalesYen: 6_000_000_000, executiveCompensationYen: 45_000_000, salariesAndBonusesYen: 3_300_000_000, researchAndDevelopmentYen: 900_000_000, sellingGeneralAdministrativeYen: 3_755_000_000, subsidySpecialGainYen: 0, subsidyCompressionLossYen: 0, capexYen: 1_500_000_000, equityFundingYen: 10_000_000_000, subsidyCashReceiptYen: 0 },
];

export const SX_ANNUAL_PROJECTION_FISCAL_YEARS = SX_ANNUAL_PROJECTION.map((year) => year.fiscalYear);

export interface SxAnnualProjectionYearParameters {
  revenueYen: number;
  costOfSalesYen: number;
  executiveHeadcount: number;
  executiveAnnualCompensationPerPersonYen: number;
  employeeHeadcount: number;
  employeeAnnualCompensationPerPersonYen: number;
  executiveAnnualTravelPerPersonYen: number;
  employeeAnnualTravelPerPersonYen: number;
  executiveAnnualConsumablesPerPersonYen: number;
  employeeAnnualConsumablesPerPersonYen: number;
  researchAndDevelopmentBaseYen: number;
  otherSellingGeneralAdministrativeBaseYen: number;
  otherCapexYen: number;
  subsidySpecialGainYen: number;
  subsidyCompressionLossYen: number;
  subsidyCashReceiptYen: number;
}

export interface SxAnnualProjectionFactoryProject {
  id: "pilot" | "seed-expansion" | "demonstration" | "pre-factory" | "full-scale" | "second-line";
  label: string;
  fiscalYear: number;
  costYen: number;
}

export interface SxAnnualProjectionParameters {
  annualByFiscalYear: Record<number, SxAnnualProjectionYearParameters>;
  nonIpoEquityFundingYenByFiscalYear: Record<number, number>;
  factoryProjects: SxAnnualProjectionFactoryProject[];
  ipoFiscalYear: number;
  ipoProceedsYen: number;
}

const DEFAULT_EXECUTIVE_HEADCOUNTS = [3, 3, 3, 3, 3, 3, 4, 5, 5] as const;
const DEFAULT_EXECUTIVE_COMPENSATION_PER_PERSON_YEN = [8_400_000, 8_400_000, 8_400_000, 8_400_000, 8_400_000, 8_000_000, 7_500_000, 7_200_000, 9_000_000] as const;
const DEFAULT_EMPLOYEE_HEADCOUNTS = [2, 3, 15, 15, 15, 30, 50, 80, 120] as const;
const DEFAULT_EMPLOYEE_COMPENSATION_PER_PERSON_YEN = [8_400_000, 12_600_000, 8_400_000, 8_400_000, 8_400_000, 16_000_000, 18_000_000, 21_250_000, 27_500_000] as const;
const DEFAULT_EXECUTIVE_TRAVEL_PER_PERSON_YEN = 600_000;
const DEFAULT_EMPLOYEE_TRAVEL_PER_PERSON_YEN = 300_000;
const DEFAULT_EXECUTIVE_CONSUMABLES_PER_PERSON_YEN = 200_000;
const DEFAULT_EMPLOYEE_CONSUMABLES_PER_PERSON_YEN = 150_000;
const DEFAULT_FACTORY_COST_BY_FISCAL_YEAR: Record<number, number> = {
  2027: 34_900_000,
  2028: 27_300_000,
  2029: 27_300_000,
  2030: 85_800_000,
  2031: 622_300_000,
  2033: 800_000_000,
};

function defaultAnnualParameters(year: SxAnnualProjection, index: number): SxAnnualProjectionYearParameters {
  const executiveHeadcount = DEFAULT_EXECUTIVE_HEADCOUNTS[index];
  const employeeHeadcount = DEFAULT_EMPLOYEE_HEADCOUNTS[index];
  const executiveAnnualTravelYen = executiveHeadcount * DEFAULT_EXECUTIVE_TRAVEL_PER_PERSON_YEN;
  const employeeAnnualTravelYen = employeeHeadcount * DEFAULT_EMPLOYEE_TRAVEL_PER_PERSON_YEN;
  const executiveAnnualConsumablesYen = executiveHeadcount * DEFAULT_EXECUTIVE_CONSUMABLES_PER_PERSON_YEN;
  const employeeAnnualConsumablesYen = employeeHeadcount * DEFAULT_EMPLOYEE_CONSUMABLES_PER_PERSON_YEN;

  return {
    revenueYen: year.revenueYen,
    costOfSalesYen: year.costOfSalesYen,
    executiveHeadcount,
    executiveAnnualCompensationPerPersonYen: DEFAULT_EXECUTIVE_COMPENSATION_PER_PERSON_YEN[index],
    employeeHeadcount,
    employeeAnnualCompensationPerPersonYen: DEFAULT_EMPLOYEE_COMPENSATION_PER_PERSON_YEN[index],
    executiveAnnualTravelPerPersonYen: DEFAULT_EXECUTIVE_TRAVEL_PER_PERSON_YEN,
    employeeAnnualTravelPerPersonYen: DEFAULT_EMPLOYEE_TRAVEL_PER_PERSON_YEN,
    executiveAnnualConsumablesPerPersonYen: DEFAULT_EXECUTIVE_CONSUMABLES_PER_PERSON_YEN,
    employeeAnnualConsumablesPerPersonYen: DEFAULT_EMPLOYEE_CONSUMABLES_PER_PERSON_YEN,
    researchAndDevelopmentBaseYen: year.researchAndDevelopmentYen,
    otherSellingGeneralAdministrativeBaseYen: year.sellingGeneralAdministrativeYen - executiveAnnualTravelYen - employeeAnnualTravelYen - executiveAnnualConsumablesYen - employeeAnnualConsumablesYen,
    otherCapexYen: year.capexYen - (DEFAULT_FACTORY_COST_BY_FISCAL_YEAR[year.fiscalYear] ?? 0),
    subsidySpecialGainYen: year.subsidySpecialGainYen,
    subsidyCompressionLossYen: year.subsidyCompressionLossYen,
    subsidyCashReceiptYen: year.subsidyCashReceiptYen,
  };
}

const DEFAULT_ANNUAL_BY_FISCAL_YEAR = Object.fromEntries(
  SX_ANNUAL_PROJECTION.map((year, index) => [year.fiscalYear, defaultAnnualParameters(year, index)]),
) as Record<number, SxAnnualProjectionYearParameters>;

export const SX_ANNUAL_PROJECTION_DEFAULT_PARAMETERS: SxAnnualProjectionParameters = {
  annualByFiscalYear: DEFAULT_ANNUAL_BY_FISCAL_YEAR,
  nonIpoEquityFundingYenByFiscalYear: Object.fromEntries(
    SX_ANNUAL_PROJECTION.map((year) => [year.fiscalYear, year.fiscalYear === 2035 ? 0 : year.equityFundingYen]),
  ),
  factoryProjects: [
    { id: "pilot", label: "小規模パイロット設備", fiscalYear: 2027, costYen: 34_900_000 },
    { id: "seed-expansion", label: "設備増強", fiscalYear: 2028, costYen: 27_300_000 },
    { id: "demonstration", label: "量産実証設備", fiscalYear: 2029, costYen: 27_300_000 },
    { id: "pre-factory", label: "工場設備", fiscalYear: 2030, costYen: 85_800_000 },
    { id: "full-scale", label: "本格自社工場", fiscalYear: 2031, costYen: 622_300_000 },
    { id: "second-line", label: "第二ライン・自動倉庫", fiscalYear: 2033, costYen: 800_000_000 },
  ],
  ipoFiscalYear: 2035,
  ipoProceedsYen: 10_000_000_000,
};

export function createSxAnnualProjectionParameters(): SxAnnualProjectionParameters {
  return {
    annualByFiscalYear: Object.fromEntries(
      Object.entries(SX_ANNUAL_PROJECTION_DEFAULT_PARAMETERS.annualByFiscalYear).map(([fiscalYear, values]) => [fiscalYear, { ...values }]),
    ),
    nonIpoEquityFundingYenByFiscalYear: { ...SX_ANNUAL_PROJECTION_DEFAULT_PARAMETERS.nonIpoEquityFundingYenByFiscalYear },
    factoryProjects: SX_ANNUAL_PROJECTION_DEFAULT_PARAMETERS.factoryProjects.map((factory) => ({ ...factory })),
    ipoFiscalYear: SX_ANNUAL_PROJECTION_DEFAULT_PARAMETERS.ipoFiscalYear,
    ipoProceedsYen: SX_ANNUAL_PROJECTION_DEFAULT_PARAMETERS.ipoProceedsYen,
  };
}

function nonNegativeYen(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function nonNegativeHeadcount(value: number | undefined): number {
  return Math.round(nonNegativeYen(value));
}

export function sxAnnualProjectionWithCash(parameters: SxAnnualProjectionParameters = SX_ANNUAL_PROJECTION_DEFAULT_PARAMETERS) {
  let closingCashYen = 0;
  return SX_ANNUAL_PROJECTION.map((baseline, index) => {
    const values = parameters.annualByFiscalYear[baseline.fiscalYear] ?? defaultAnnualParameters(baseline, index);
    const executiveHeadcount = nonNegativeHeadcount(values.executiveHeadcount);
    const employeeHeadcount = nonNegativeHeadcount(values.employeeHeadcount);
    const executiveCompensationYen = executiveHeadcount * nonNegativeYen(values.executiveAnnualCompensationPerPersonYen);
    const salariesAndBonusesYen = employeeHeadcount * nonNegativeYen(values.employeeAnnualCompensationPerPersonYen);
    const travelAndConsumablesYen = (
      executiveHeadcount * (nonNegativeYen(values.executiveAnnualTravelPerPersonYen) + nonNegativeYen(values.executiveAnnualConsumablesPerPersonYen))
      + employeeHeadcount * (nonNegativeYen(values.employeeAnnualTravelPerPersonYen) + nonNegativeYen(values.employeeAnnualConsumablesPerPersonYen))
    );
    const capexYen = nonNegativeYen(values.otherCapexYen) + parameters.factoryProjects
      .filter((factory) => factory.fiscalYear === baseline.fiscalYear)
      .reduce((sum, factory) => sum + nonNegativeYen(factory.costYen), 0);
    const equityFundingYen = nonNegativeYen(parameters.nonIpoEquityFundingYenByFiscalYear[baseline.fiscalYear])
      + (parameters.ipoFiscalYear === baseline.fiscalYear ? nonNegativeYen(parameters.ipoProceedsYen) : 0);
    const year = {
      fiscalYear: baseline.fiscalYear,
      revenueYen: nonNegativeYen(values.revenueYen),
      costOfSalesYen: nonNegativeYen(values.costOfSalesYen),
      executiveCompensationYen,
      salariesAndBonusesYen,
      researchAndDevelopmentYen: nonNegativeYen(values.researchAndDevelopmentBaseYen),
      sellingGeneralAdministrativeYen: nonNegativeYen(values.otherSellingGeneralAdministrativeBaseYen) + travelAndConsumablesYen,
      subsidySpecialGainYen: nonNegativeYen(values.subsidySpecialGainYen),
      subsidyCompressionLossYen: nonNegativeYen(values.subsidyCompressionLossYen),
      capexYen,
      equityFundingYen,
      subsidyCashReceiptYen: nonNegativeYen(values.subsidyCashReceiptYen),
    };
    const sellingGeneralAdministrativeTotalYen = year.executiveCompensationYen + year.salariesAndBonusesYen + year.researchAndDevelopmentYen + year.sellingGeneralAdministrativeYen;
    const operatingExpenseYen = year.costOfSalesYen + sellingGeneralAdministrativeTotalYen;
    const grossProfitYen = year.revenueYen - year.costOfSalesYen;
    const operatingIncomeYen = grossProfitYen - sellingGeneralAdministrativeTotalYen;
    const pretaxIncomeYen = operatingIncomeYen + year.subsidySpecialGainYen - year.subsidyCompressionLossYen;
    closingCashYen += operatingIncomeYen - year.capexYen + year.equityFundingYen + year.subsidyCashReceiptYen;
    return { ...year, sellingGeneralAdministrativeTotalYen, operatingExpenseYen, grossProfitYen, operatingIncomeYen, pretaxIncomeYen, closingCashYen };
  });
}

export function sxPhaseBudgetVariance(phase: SxBusinessPlanPhase): number | null {
  if (phase.budgetYen === null || Object.values(phase.lanes).some(lane => lane.costYen === null)) return null;
  return Object.values(phase.lanes).reduce((sum, lane) => sum + (lane.costYen ?? 0), 0) - phase.budgetYen;
}

// Default draft mirrors the adopted SOL working plan; unknown Series A terms remain incomplete.
export const SX_CAPITAL_PLAN_HOLDERS: Holder[] = [
  {
    "id": "sx-ceo",
    "kind": "founder",
    "name": "CEO"
  },
  {
    "id": "sx-sugiura",
    "kind": "founder",
    "name": "杉浦先生"
  },
  {
    "id": "sx-amd",
    "kind": "founder",
    "name": "経営陣"
  },
  {
    "id": "sx-esop",
    "kind": "esop_pool",
    "name": "SOプール"
  },
  {
    "id": "sx-partners-fund",
    "kind": "investor",
    "name": "シードA"
  },
  {
    "id": "sx-iyogin",
    "kind": "investor",
    "name": "シードB"
  },
  {
    "id": "sx-davp",
    "kind": "investor",
    "name": "シードC"
  },
  {
    "id": "sx-series-a",
    "kind": "investor",
    "name": "Series A投資家"
  },
  {
    "id": "sx-series-b",
    "kind": "investor",
    "name": "Series B投資家"
  },
  {
    "id": "sx-series-c",
    "kind": "investor",
    "name": "Series C投資家"
  },
  {
    "id": "sx-public",
    "kind": "other",
    "name": "公開市場"
  },
  {
    "id": "sol-seed-unallocated",
    "name": "シード投資家（配分未定）",
    "kind": "investor",
    "note": "出資総額1億円。各投資家への割当・出資額は未定。"
  }
];

export const SX_CAPITAL_PLAN_EVENTS: CapitalEvent[] = [
  {
    "id": "sx-incorporation",
    "date": "2027-04-01",
    "note": "中島先生は含めない。設立時持分の暫定原案。",
    "type": "incorporation",
    "label": "設立",
    "order": 1,
    "status": "planned",
    "newShares": {
      "value": 108000,
      "source": "calculated"
    },
    "allocations": [
      {
        "id": "sx-inc-ceo",
        "shares": {
          "value": 81000,
          "source": "input"
        },
        "holderId": "sx-ceo",
        "shareClass": "common"
      },
      {
        "id": "sx-inc-sugiura",
        "shares": {
          "value": 21600,
          "source": "input"
        },
        "holderId": "sx-sugiura",
        "shareClass": "common"
      },
      {
        "id": "sx-inc-amd",
        "shares": {
          "value": 5400,
          "source": "input"
        },
        "holderId": "sx-amd",
        "shareClass": "common"
      }
    ],
    "calculationBasis": "manual"
  },
  {
    "id": "sx-option-pool",
    "date": "2027-04-01",
    "note": "既存の仮定を継続。J-KISS発行前の完全希薄化後株式数に対して10％。",
    "type": "option_pool",
    "label": "シード前SOプール",
    "order": 2,
    "status": "planned",
    "poolSize": {
      "value": 12000,
      "source": "input"
    },
    "allocations": [
      {
        "id": "sx-so-allocation",
        "shares": {
          "value": 12000,
          "source": "input"
        },
        "holderId": "sx-esop",
        "shareClass": "option"
      }
    ],
    "calculationBasis": "manual"
  },
  {
    "id": "sx-seed",
    "type": "convertible_issue",
    "label": "シード（J-KISS）",
    "date": "2027-04-01",
    "order": 3,
    "status": "planned",
    "calculationBasis": "manual",
    "conversionCap": {
      "value": 500000000,
      "source": "input"
    },
    "conversionDiscount": {
      "value": 0.2,
      "source": "input"
    },
    "allocations": [
      {
        "id": "sol-seed-jkiss-allocation",
        "holderId": "sol-seed-unallocated",
        "shareClass": "convertible",
        "shares": {
          "value": 30000,
          "source": "input",
          "note": "既存FD12万株、キャップ適用・追加転換証券なしの場合の転換想定株数。新株予約権の個数や確定株数ではない。"
        },
        "amount": {
          "value": 100000000,
          "source": "input"
        }
      }
    ],
    "note": "2026-09-30計画改定。J-KISS 2.0／総額1億円／ポストマネー・キャップ5億円／ディスカウント20％。投資家別の金額・配分は未定。2028年7月のシリーズAで新規株式調達1億円以上を転換条件とする案。FDはキャップ適用時の20％を示す仮の転換株数。発行済株式へは計上しない。キャップは今回の確定評価額ではない。シード・ブリッジ累計25％以内を目標とし、STS不採択時は約5,000万円の枠から必要額・条件を再精査する。設立前のDD・投資委員会の可否と必要資料を確認する。"
  },
  {
    "id": "sx-series-a-event",
    "date": "2028-07-01",
    "type": "equity_issue",
    "label": "シリーズA（金額再精査）",
    "order": 4,
    "status": "planned",
    "allocations": [],
    "calculationBasis": "manual",
    "note": "2028年7月の払込を目標に前倒し。新規調達額・評価額・投資家配分は未定。旧資本政策6億円と旧数値計画3億円の不一致を解消するため、必要額を再精査する。1億円以上はJ-KISS転換条件の案で、シリーズAの調達目標額ではない。J-KISS転換は条件確定後に消込・株式発行を計上する。後続の持分比率はシリーズAの希薄化を含まない暫定参考。"
  },
  {
    "id": "sx-series-b-event",
    "date": "2031-04-01",
    "type": "equity_issue",
    "label": "Series B",
    "order": 5,
    "status": "planned",
    "newShares": {
      "value": 46500,
      "source": "calculated"
    },
    "allocations": [
      {
        "id": "sx-b-allocation",
        "amount": {
          "value": 1500000000,
          "source": "input"
        },
        "shares": {
          "value": 46500,
          "source": "calculated"
        },
        "holderId": "sx-series-b",
        "shareClass": "preferred",
        "pricePerShare": {
          "value": 32258.064516129034,
          "source": "calculated"
        }
      }
    ],
    "primaryRaise": {
      "value": 1500000000,
      "source": "calculated"
    },
    "pricePerShare": {
      "value": 32258.064516129034,
      "source": "calculated"
    },
    "calculationBasis": "valuation_and_investment",
    "preMoneyValuation": {
      "value": 6000000000,
      "source": "input"
    },
    "postMoneyValuation": {
      "value": 7500000000,
      "source": "calculated"
    },
    "note": "シリーズA以降の金額・評価額・時期は既存の長期仮説を保持した参考値。今回未精査。シリーズAの調達・転換条件決定後に再計算する。"
  },
  {
    "id": "sx-series-c-event",
    "date": "2033-04-01",
    "type": "equity_issue",
    "label": "Series C",
    "order": 6,
    "status": "planned",
    "newShares": {
      "value": 31000,
      "source": "calculated"
    },
    "allocations": [
      {
        "id": "sx-c-allocation",
        "amount": {
          "value": 2000000000,
          "source": "input"
        },
        "shares": {
          "value": 31000,
          "source": "calculated"
        },
        "holderId": "sx-series-c",
        "shareClass": "preferred",
        "pricePerShare": {
          "value": 64516.12903225807,
          "source": "calculated"
        }
      }
    ],
    "primaryRaise": {
      "value": 2000000000,
      "source": "calculated"
    },
    "pricePerShare": {
      "value": 64516.12903225807,
      "source": "calculated"
    },
    "calculationBasis": "valuation_and_investment",
    "preMoneyValuation": {
      "value": 15000000000,
      "source": "input"
    },
    "postMoneyValuation": {
      "value": 17000000000,
      "source": "calculated"
    },
    "note": "シリーズA以降の金額・評価額・時期は既存の長期仮説を保持した参考値。今回未精査。シリーズAの調達・転換条件決定後に再計算する。"
  },
  {
    "id": "sx-ipo-event",
    "date": "2035-04-01",
    "type": "ipo",
    "label": "IPO",
    "order": 7,
    "status": "planned",
    "newShares": {
      "value": 29278,
      "source": "calculated"
    },
    "allocations": [
      {
        "id": "sx-ipo-allocation",
        "amount": {
          "value": 10000000000,
          "source": "input"
        },
        "shares": {
          "value": 29278,
          "source": "calculated"
        },
        "holderId": "sx-public",
        "shareClass": "common",
        "pricePerShare": {
          "value": 341555.9772296015,
          "source": "calculated"
        }
      }
    ],
    "primaryRaise": {
      "value": 10000000000,
      "source": "calculated"
    },
    "pricePerShare": {
      "value": 341555.9772296015,
      "source": "calculated"
    },
    "calculationBasis": "valuation_and_investment",
    "preMoneyValuation": {
      "value": 90000000000,
      "source": "input"
    },
    "postMoneyValuation": {
      "value": 100000000000,
      "source": "calculated"
    },
    "note": "シリーズA以降の金額・評価額・時期は既存の長期仮説を保持した参考値。今回未精査。シリーズAの調達・転換条件決定後に再計算する。"
  }
];

export const SX_CAPITAL_PLAN_DOCUMENT = {holders: SX_CAPITAL_PLAN_HOLDERS, events: SX_CAPITAL_PLAN_EVENTS};
