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
  costYen: number;
  activities: string[];
  exitGate: string;
  xrlKeys: Array<keyof SxXrlTarget>;
}

export interface SxBusinessPlanPhase {
  id: string;
  label: string;
  period: string;
  openingRound: string;
  budgetYen: number;
  fundingSource: string;
  maxFixedBurnMonthlyYen: number;
  targetXrl: SxXrlTarget;
  lanes: Record<SxBusinessPlanLane, SxPhaseLanePlan>;
}

export interface SxAnnualProjection {
  fiscalYear: number;
  revenueYen: number;
  operatingExpenseYen: number;
  capexYen: number;
  equityFundingYen: number;
}

export const SX_BUSINESS_PLAN_UPDATED_ON = "2026-07-27";

export const SX_BUSINESS_PLAN_ASSUMPTIONS = [
  "シアノバクテリアの培養条件・品質管理・包装条件はSXの中核ノウハウとして自社保有する",
  "培養したシアノバクテリアをパッケージングして顧客拠点へ輸送し、顧客設備で使用してもらう",
  "自社工場は一括投資せず、Seedの小規模パイロット設備、Series Aの自社量産実証工場、Series Bの本格工場へ段階投資する",
  "中島先生は株主計画に含めず、設立時持分はCEO 75%・杉浦先生 20%・まさ／AMD 5%を原案とする",
] as const;

export const SX_BUSINESS_PLAN_PHASES: SxBusinessPlanPhase[] = [
  {
    id: "psi",
    label: "Phase 0｜PSI・会社設立準備",
    period: "2026.07–2027.03",
    openingRound: "PSI・非希薄化資金",
    budgetYen: 60_000_000,
    fundingSource: "PSI等 0.6億円（NewCoの株式調達外）",
    maxFixedBurnMonthlyYen: 1_500_000,
    targetXrl: { trl: 4, brl: 3, grl: 2, srl: 3, hrl: 3 },
    lanes: {
      business: {
        costYen: 10_000_000,
        activities: ["優先顧客2業界と最初の用途を固定", "PoC価格・供給形態・顧客設備側の責任分界を仮決め", "有償PoC候補2社の意向を確認"],
        exitGate: "誰が、何に、いくら払うかを2社で説明できる",
        xrlKeys: ["brl", "srl"],
      },
      technology: {
        costYen: 40_000_000,
        activities: ["培養株・培養レシピ・品質指標を絞る", "培養→回収→包装→輸送→顧客投入の一連条件を設計", "PoC用リアクター仕様と測定計画を固定"],
        exitGate: "ラボ条件で一連工程の再現性と測定方法を確認",
        xrlKeys: ["trl"],
      },
      organization: {
        costYen: 5_000_000,
        activities: ["NewCo設立とCEO候補の役割確定", "大学・発明者・SX間の知財境界を整理", "培養・装置・顧客実装の責任者を仮置き"],
        exitGate: "設立、知財、意思決定の未決事項をSeed DDへ渡せる",
        xrlKeys: ["grl", "hrl"],
      },
      funding: {
        costYen: 5_000_000,
        activities: ["Seed投資委員会資料と18か月資金使途を作成", "パートナーズファンドをリード候補に条件調整", "いよぎんキャピタル・DAVPの参加条件を整理"],
        exitGate: "Seed 1.5億円の投資条件と次回調達条件が合意可能",
        xrlKeys: ["brl", "grl"],
      },
    },
  },
  {
    id: "seed",
    label: "Phase 1｜Seed → Series A",
    period: "2027.04–2028.09",
    openingRound: "Seed 1.5億円",
    budgetYen: 150_000_000,
    fundingSource: "PF 0.75億円 / いよぎん 0.40億円 / DAVP 0.35億円",
    maxFixedBurnMonthlyYen: 5_000_000,
    targetXrl: { trl: 6, brl: 5, grl: 4, srl: 5, hrl: 5 },
    lanes: {
      business: {
        costYen: 20_000_000,
        activities: ["顧客拠点で有償PoCを2–3件実施", "包装単位・納品頻度・顧客側運転手順を商品仕様化", "単価、粗利、継続条件を顧客別に検証"],
        exitGate: "有償PoC2件以上と年間契約へ進む顧客1社",
        xrlKeys: ["brl", "srl"],
      },
      technology: {
        costYen: 80_000_000,
        activities: ["自社内の小規模培養・包装パイロット設備を構築", "輸送後の活性・保存期限・ロット品質基準を確立", "顧客設備での再現運転とユニットエコノミクスを証明"],
        exitGate: "3ロット連続合格、輸送後性能合格、顧客現場で再現",
        xrlKeys: ["trl", "srl"],
      },
      organization: {
        costYen: 30_000_000,
        activities: ["培養プロセス責任者・フィールド担当を採用", "品質記録、出荷判定、顧客障害対応の標準手順を導入", "取締役会・月次資金管理を開始"],
        exitGate: "CEOを含む5–7名で培養・出荷・現場対応を回せる",
        xrlKeys: ["grl", "hrl"],
      },
      funding: {
        costYen: 20_000_000,
        activities: ["SeedをクローズしSOプール10%を確保", "固定費バーン月500万円以下を維持", "2028年上期からSeries A DDを開始"],
        exitGate: "最低6か月の現預金を残してSeries Aの条件合意",
        xrlKeys: ["brl", "hrl"],
      },
    },
  },
  {
    id: "series-a",
    label: "Phase 2｜Series A → Series B",
    period: "2028.10–2031.03",
    openingRound: "Series A 6億円",
    budgetYen: 600_000_000,
    fundingSource: "想定 pre 25億円 / post 31億円",
    maxFixedBurnMonthlyYen: 12_000_000,
    targetXrl: { trl: 7, brl: 7, grl: 6, srl: 7, hrl: 7 },
    lanes: {
      business: {
        costYen: 120_000_000,
        activities: ["複数顧客との年間供給契約へ移行", "導入設計・運転支援・定期供給を標準商品化", "顧客別採算と回収期間を共通指標で管理"],
        exitGate: "継続顧客3社以上、売上7億円規模、変動粗利黒字",
        xrlKeys: ["brl", "srl"],
      },
      technology: {
        costYen: 330_000_000,
        activities: ["自社量産実証工場を取得・整備", "培養能力をSeed比10倍へ拡張し包装工程を半自動化", "原料受入から出荷までの品質保証とトレーサビリティを実装"],
        exitGate: "量産実証工場で6か月連続の供給・品質・原価目標を達成",
        xrlKeys: ["trl", "grl"],
      },
      organization: {
        costYen: 100_000_000,
        activities: ["工場長、品質保証、営業責任者を採用", "製造・営業・管理の部門別予算と権限を設定", "安全衛生・教育・BCPを運用"],
        exitGate: "15–20名体制でCEO不在でも日次操業が継続",
        xrlKeys: ["grl", "hrl"],
      },
      funding: {
        costYen: 50_000_000,
        activities: ["設備投資を能力増強ゲートごとに分割承認", "借入・補助金を株式資金と併用", "Series Bで本格工場投資を開けるDDパックを整備"],
        exitGate: "工場投資前後の原価実績と需要予約でSeries Bを説明",
        xrlKeys: ["brl", "grl"],
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
    targetXrl: { trl: 8, brl: 8, grl: 8, srl: 8, hrl: 8 },
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
        xrlKeys: ["grl", "hrl"],
      },
      funding: {
        costYen: 100_000_000,
        activities: ["工場建設の予備費・支払条件・借入余力を管理", "Series Cまたはプロジェクトファイナンスを比較", "IPO準備監査のギャップ診断を開始"],
        exitGate: "成長投資と運転資金を分けたSeries C計画を確定",
        xrlKeys: ["brl", "grl"],
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
    targetXrl: { trl: 9, brl: 9, grl: 9, srl: 9, hrl: 9 },
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
        xrlKeys: ["grl", "hrl"],
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
  { fiscalYear: 2027, revenueYen: 30_000_000, operatingExpenseYen: 100_000_000, capexYen: 40_000_000, equityFundingYen: 150_000_000 },
  { fiscalYear: 2028, revenueYen: 120_000_000, operatingExpenseYen: 220_000_000, capexYen: 120_000_000, equityFundingYen: 600_000_000 },
  { fiscalYear: 2029, revenueYen: 300_000_000, operatingExpenseYen: 350_000_000, capexYen: 160_000_000, equityFundingYen: 0 },
  { fiscalYear: 2030, revenueYen: 700_000_000, operatingExpenseYen: 650_000_000, capexYen: 140_000_000, equityFundingYen: 0 },
  { fiscalYear: 2031, revenueYen: 1_500_000_000, operatingExpenseYen: 1_200_000_000, capexYen: 600_000_000, equityFundingYen: 1_500_000_000 },
  { fiscalYear: 2032, revenueYen: 3_000_000_000, operatingExpenseYen: 2_200_000_000, capexYen: 500_000_000, equityFundingYen: 0 },
  { fiscalYear: 2033, revenueYen: 6_000_000_000, operatingExpenseYen: 4_000_000_000, capexYen: 800_000_000, equityFundingYen: 2_000_000_000 },
  { fiscalYear: 2034, revenueYen: 12_000_000_000, operatingExpenseYen: 7_500_000_000, capexYen: 1_000_000_000, equityFundingYen: 0 },
  { fiscalYear: 2035, revenueYen: 20_000_000_000, operatingExpenseYen: 14_000_000_000, capexYen: 1_500_000_000, equityFundingYen: 10_000_000_000 },
];

export function sxAnnualProjectionWithCash() {
  let closingCashYen = 0;
  return SX_ANNUAL_PROJECTION.map((year) => {
    const operatingIncomeYen = year.revenueYen - year.operatingExpenseYen;
    closingCashYen += operatingIncomeYen - year.capexYen + year.equityFundingYen;
    return { ...year, operatingIncomeYen, closingCashYen };
  });
}

export function sxPhaseBudgetVariance(phase: SxBusinessPlanPhase): number {
  return Object.values(phase.lanes).reduce((sum, lane) => sum + lane.costYen, 0) - phase.budgetYen;
}

const input = (value: number) => ({ value, source: "input" as const });
const calculated = () => ({ value: 0, source: "calculated" as const });

export const SX_CAPITAL_PLAN_HOLDERS: Holder[] = [
  { id: "sx-ceo", name: "CEO", kind: "founder" },
  { id: "sx-sugiura", name: "杉浦先生", kind: "founder" },
  { id: "sx-amd", name: "まさ／AMD", kind: "founder" },
  { id: "sx-esop", name: "SOプール", kind: "esop_pool" },
  { id: "sx-partners-fund", name: "パートナーズファンド", kind: "investor" },
  { id: "sx-iyogin", name: "いよぎんキャピタル", kind: "investor" },
  { id: "sx-davp", name: "ダイキアクシスベンチャーパートナーズ", kind: "investor" },
  { id: "sx-series-a", name: "Series A投資家", kind: "investor" },
  { id: "sx-series-b", name: "Series B投資家", kind: "investor" },
  { id: "sx-series-c", name: "Series C投資家", kind: "investor" },
  { id: "sx-public", name: "公開市場", kind: "other" },
];

export const SX_CAPITAL_PLAN_EVENTS: CapitalEvent[] = [
  {
    id: "sx-incorporation",
    type: "incorporation",
    label: "設立",
    order: 1,
    date: "2027-04-01",
    status: "planned",
    calculationBasis: "manual",
    allocations: [
      { id: "sx-inc-ceo", holderId: "sx-ceo", shareClass: "common", shares: input(81_000) },
      { id: "sx-inc-sugiura", holderId: "sx-sugiura", shareClass: "common", shares: input(21_600) },
      { id: "sx-inc-amd", holderId: "sx-amd", shareClass: "common", shares: input(5_400) },
    ],
    note: "中島先生は含めない。設立時持分の暫定原案。",
  },
  {
    id: "sx-option-pool",
    type: "option_pool",
    label: "Seed前SOプール",
    order: 2,
    date: "2027-04-01",
    status: "planned",
    calculationBasis: "manual",
    poolSize: input(12_000),
    allocations: [{ id: "sx-so-allocation", holderId: "sx-esop", shareClass: "option", shares: input(12_000) }],
    note: "Seed直前の完全希薄化後株式数に対して10%。",
  },
  {
    id: "sx-seed",
    type: "equity_issue",
    label: "Seed",
    order: 3,
    date: "2027-04-01",
    status: "planned",
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: input(600_000_000),
    allocations: [
      { id: "sx-seed-pf", holderId: "sx-partners-fund", shareClass: "preferred", shares: calculated(), amount: input(75_000_000), pricePerShare: calculated() },
      { id: "sx-seed-iyogin", holderId: "sx-iyogin", shareClass: "preferred", shares: calculated(), amount: input(40_000_000), pricePerShare: calculated() },
      { id: "sx-seed-davp", holderId: "sx-davp", shareClass: "preferred", shares: calculated(), amount: input(35_000_000), pricePerShare: calculated() },
    ],
    note: "パートナーズファンドをリード候補とする暫定原案。",
  },
  {
    id: "sx-series-a-event",
    type: "equity_issue",
    label: "Series A",
    order: 4,
    date: "2028-10-01",
    status: "planned",
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: input(2_500_000_000),
    allocations: [{ id: "sx-a-allocation", holderId: "sx-series-a", shareClass: "preferred", shares: calculated(), amount: input(600_000_000), pricePerShare: calculated() }],
  },
  {
    id: "sx-series-b-event",
    type: "equity_issue",
    label: "Series B",
    order: 5,
    date: "2031-04-01",
    status: "planned",
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: input(6_000_000_000),
    allocations: [{ id: "sx-b-allocation", holderId: "sx-series-b", shareClass: "preferred", shares: calculated(), amount: input(1_500_000_000), pricePerShare: calculated() }],
  },
  {
    id: "sx-series-c-event",
    type: "equity_issue",
    label: "Series C",
    order: 6,
    date: "2033-04-01",
    status: "planned",
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: input(15_000_000_000),
    allocations: [{ id: "sx-c-allocation", holderId: "sx-series-c", shareClass: "preferred", shares: calculated(), amount: input(2_000_000_000), pricePerShare: calculated() }],
  },
  {
    id: "sx-ipo-event",
    type: "ipo",
    label: "IPO",
    order: 7,
    date: "2035-04-01",
    status: "planned",
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: input(90_000_000_000),
    allocations: [{ id: "sx-ipo-allocation", holderId: "sx-public", shareClass: "common", shares: calculated(), amount: input(10_000_000_000), pricePerShare: calculated() }],
  },
];

export const SX_CAPITAL_PLAN_DOCUMENT = {
  holders: SX_CAPITAL_PLAN_HOLDERS,
  events: SX_CAPITAL_PLAN_EVENTS,
};
