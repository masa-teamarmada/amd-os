export type MaterialFamily = "element" | "mineral" | "polymer";
export type HeatAxis = "heat" | "demand" | "supplyRisk" | "amdFit";
export type HeatLevel = 1 | 2 | 3 | 4 | 5;

export type MaterialSource = {
  label: string;
  href: string;
  asOf: string;
};

export type MaterialScores = Record<HeatAxis, HeatLevel>;

export type MaterialDetail = {
  id: string;
  family: MaterialFamily;
  name: string;
  code: string;
  category: string;
  summary: string;
  properties: string[];
  uses: string[];
  supplyCountries: string[];
  reserves: string;
  balance: string;
  circularity: string;
  chain: string[];
  amdFitNote: string;
  scores: MaterialScores;
  scoreReasons: Record<HeatAxis, string>;
  sources: MaterialSource[];
  lastReviewed: string;
};

export type ElementCategory =
  | "alkali"
  | "alkaline"
  | "transition"
  | "post-transition"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble"
  | "lanthanide"
  | "actinide";

export type ElementRecord = {
  atomicNumber: number;
  symbol: string;
  name: string;
  group: number | null;
  period: number;
  displayColumn: number;
  displayRow: number;
  category: ElementCategory;
  glanceUse?: string;
  supplyAlert?: string;
  detail?: MaterialDetail;
};

export const HEAT_AXIS_LABELS: Record<HeatAxis, string> = {
  heat: "総合注目度",
  demand: "需要",
  supplyRisk: "供給不安",
  amdFit: "AMD相性",
};

export const FAMILY_LABELS: Record<MaterialFamily, string> = {
  element: "元素",
  mineral: "鉱物・鉱石",
  polymer: "樹脂・高分子",
};

export const CATEGORY_LABELS: Record<ElementCategory, string> = {
  alkali: "アルカリ金属",
  alkaline: "アルカリ土類金属",
  transition: "遷移金属",
  "post-transition": "ポスト遷移金属",
  metalloid: "半金属",
  nonmetal: "非金属",
  halogen: "ハロゲン",
  noble: "希ガス",
  lanthanide: "ランタノイド",
  actinide: "アクチノイド",
};

const USGS: MaterialSource = {
  label: "USGS Mineral Commodity Summaries 2026",
  href: "https://pubs.usgs.gov/publication/mcs2026",
  asOf: "2026-05 v1.3",
};
const IEA: MaterialSource = {
  label: "IEA Global Critical Minerals Outlook 2025",
  href: "https://www.iea.org/reports/global-critical-minerals-outlook-2025",
  asOf: "2025",
};
const RMIS: MaterialSource = {
  label: "EU RMIS Critical and Strategic Materials",
  href: "https://rmis.jrc.ec.europa.eu/critical-and-strategic-materials",
  asOf: "2026-07確認",
};
const JOGMEC: MaterialSource = {
  label: "JOGMEC 鉱物資源マテリアルフロー",
  href: "https://mric.jogmec.go.jp/reports/",
  asOf: "2026-07確認",
};
const OECD_PLASTICS: MaterialSource = {
  label: "OECD Global Plastics Outlook",
  href: "https://www.oecd.org/environment/plastics/plastics-outlook/",
  asOf: "2026-07確認",
};
const ECHA_POLYMERS: MaterialSource = {
  label: "ECHA Polymers",
  href: "https://echa.europa.eu/hot-topics/polymers",
  asOf: "2026-07確認",
};

const criticalSources = [USGS, IEA, RMIS, JOGMEC];
const mineralSources = [USGS, RMIS, JOGMEC];
const polymerSources = [OECD_PLASTICS, ECHA_POLYMERS];

function detail(
  value: Omit<MaterialDetail, "lastReviewed" | "sources"> & {
    sources?: MaterialSource[];
  }
): MaterialDetail {
  return {
    ...value,
    sources: value.sources ?? criticalSources,
    lastReviewed: "2026-07-15",
  };
}

const elementDetails: Record<string, MaterialDetail> = {
  Li: detail({ id: "element-li", family: "element", name: "リチウム", code: "Li", category: "アルカリ金属", summary: "軽量・高電位を生かして蓄電池を支える。資源量より、電池品質への精製能力と価格循環を見る材料。", properties: ["最も軽い金属", "反応性が高い", "高い電気化学ポテンシャル"], uses: ["車載・定置用蓄電池", "耐熱ガラス", "グリース・医薬"], supplyCountries: ["1 豪州", "2 中国", "3 チリ", "4 ジンバブエ", "5 アルゼンチン"], reserves: "世界埋蔵量 約3,700万t（Li含有量、USGS 2026）。かん水と鉱石を合算したcommodity値。", balance: "2025年は生産能力増で短期余剰懸念が残る一方、EV・定置蓄電の需要は強い。価格と新規projectの延期を同時に追う。", circularity: "電池回収とLi再資源化は拡大中。回収網・Ni/Coとの同時回収採算が鍵。", chain: ["塩湖かん水 / スポジュメン", "炭酸Li / 水酸化Li", "LFP / NMC / 電解質", "蓄電池"], amdFitNote: "電池材料、資源循環、地方の未利用資源・地熱かん水の事業仮説と接続しやすい。", scores: { heat: 5, demand: 5, supplyRisk: 4, amdFit: 5 }, scoreReasons: { heat: "需要成長と供給投資の振れ幅が大きい", demand: "EV・定置蓄電が牽引", supplyRisk: "精製と電池grade化の地域集中", amdFit: "蓄電・循環・deeptechの横断テーマ" } }),
  C: detail({ id: "element-c", family: "element", name: "炭素", code: "C", category: "非金属", summary: "黒鉛、炭素繊維、活性炭、ダイヤモンドまで構造で機能が激変する基盤元素。", properties: ["同素体が多い", "軽量", "導電・吸着・高強度を設計可能"], uses: ["リチウムイオン電池の負極", "複合材", "吸着・触媒担体", "電極"], supplyCountries: ["天然黒鉛: 中国", "天然黒鉛: マダガスカル", "天然黒鉛: タンザニア"], reserves: "天然黒鉛の世界埋蔵量 約3.1億t（USGS 2026）。炭素全体の埋蔵量ではない。", balance: "電池grade球状黒鉛は採掘量より精製・球状化・被覆の集中がボトルネック。", circularity: "複合材は難しいが、電池黒鉛の再生・バイオ炭・CO2由来炭素は新市場。", chain: ["天然黒鉛 / 石油系原料 / バイオマス", "精製・炭化・黒鉛化", "負極材 / 炭素繊維 / 活性炭", "電池・モビリティ・環境"], amdFitNote: "炭素材料、吸着、藻類・バイオマス炭化、複合材のPJ群へ広く効く。", scores: { heat: 5, demand: 5, supplyRisk: 5, amdFit: 5 }, scoreReasons: { heat: "電池と脱炭素の両方にまたがる", demand: "負極・軽量化・吸着用途", supplyRisk: "電池grade加工が集中", amdFit: "AMDの環境・材料テーマと接点が多い" } }),
  Si: detail({ id: "element-si", family: "element", name: "ケイ素", code: "Si", category: "半金属", summary: "砂・石英から半導体、太陽電池、炭化ケイ素半導体、シリコーンへ枝分かれする巨大材料チェーン。", properties: ["半導体特性", "酸化物が安定", "純度で用途が変わる"], uses: ["半導体", "太陽電池", "電力変換用の炭化ケイ素半導体", "シリコーン"], supplyCountries: ["金属Si: 中国", "ブラジル", "ノルウェー"], reserves: "地殻中に豊富で、commodityとしての埋蔵量不足より高純度石英・精製電力・製造能力が制約。", balance: "汎用品と半導体gradeを分けて見る。太陽電池は設備過剰局面でも高純度原料と先端用途は別市場。", circularity: "太陽光panel・半導体sludge・シリコーンの回収技術が未成熟。", chain: ["石英 / 高純度シリカ", "金属Si / ポリSi", "wafer / SiC / シリコーン", "半導体・太陽電池・医療"], amdFitNote: "半導体だけでなく、センサー、耐熱部材、医療・環境材料まで案件を束ねられる。", scores: { heat: 5, demand: 5, supplyRisk: 4, amdFit: 5 }, scoreReasons: { heat: "複数の成長市場を同じ原料が支える", demand: "電力半導体・PV・電子部材", supplyRisk: "高純度工程と製造能力が集中", amdFit: "deeptechの共通基盤" } }),
  P: detail({ id: "element-p", family: "element", name: "リン", code: "P", category: "非金属", summary: "食料を支える不可欠元素で、LFP電池・難燃材・電子材料にも広がる。", properties: ["生体必須", "反応性が高い", "回収しなければ散逸しやすい"], uses: ["肥料", "リン酸鉄リチウム電池の正極", "難燃剤", "化学品"], supplyCountries: ["リン鉱石: 中国", "モロッコ", "米国", "ロシア"], reserves: "リン鉱石の世界埋蔵量 約730億t（marketable phosphate rock、USGS 2026）。モロッコが約500億t。", balance: "総量より産地集中と肥料価格、LFP拡大、下水・食品系からの回収が焦点。", circularity: "下水汚泥・焼却灰・畜産排水からのリン回収は循環経済の有力テーマ。", chain: ["リン鉱石 / 排水・汚泥", "リン酸 / 回収リン", "肥料 / LFP / 難燃剤", "農業・電池・環境"], amdFitNote: "排水処理、資源回収、農業、電池材料を一つの循環chainで扱える。", scores: { heat: 5, demand: 5, supplyRisk: 4, amdFit: 5 }, scoreReasons: { heat: "食料安全保障とLFPの交点", demand: "肥料の基礎需要＋電池", supplyRisk: "高い産地集中", amdFit: "排水・循環PJとの相性が強い" } }),
  Ti: detail({ id: "element-ti", family: "element", name: "チタン", code: "Ti", category: "遷移金属", summary: "軽量・耐食・生体適合性に優れ、航空宇宙から医療、酸化物光触媒まで用途が広い。", properties: ["高比強度", "耐食性", "生体適合性"], uses: ["航空宇宙", "医療用インプラント", "酸化チタン顔料", "光触媒"], supplyCountries: ["鉱物精鉱: 中国", "モザンビーク", "南アフリカ", "豪州"], reserves: "USGSはイルメナイト・ルチル等のTi鉱物で集計。金属TiとTiO2顔料は別の供給chain。", balance: "鉱石量よりスポンジTi・溶解加工の認証と設備が参入障壁。", circularity: "航空grade scrapは価値が高いが、酸素汚染と合金混合の管理が必要。", chain: ["イルメナイト / ルチル", "TiO2 / スポンジTi", "合金 / 光触媒", "航空・医療・環境"], amdFitNote: "医工連携、表面処理、光触媒、耐食設備のテーマに展開しやすい。", scores: { heat: 4, demand: 4, supplyRisk: 3, amdFit: 5 }, scoreReasons: { heat: "航空・医療・環境で安定した技術余地", demand: "航空回復と医療用途", supplyRisk: "加工・認証が制約", amdFit: "大学発技術との接点が多い" } }),
  Mn: detail({ id: "element-mn", family: "element", name: "マンガン", code: "Mn", category: "遷移金属", summary: "鉄鋼の基礎元素であり、電池grade硫酸マンガンでは別の高純度市場が立つ。", properties: ["脱酸・合金化", "多価数", "比較的低コスト"], uses: ["鉄鋼", "リチウムイオン電池の正極", "化学品"], supplyCountries: ["南アフリカ", "ガボン", "豪州", "ガーナ"], reserves: "USGSのMn commodityを参照。電池grade原料は鉱石埋蔵量と別に精製能力を見る。", balance: "鉄鋼向けは巨大、電池向けは小さいが高純度化投資が焦点。", circularity: "電池black massから回収可能だが、Li/Ni/Coに比べ経済価値が低く工程設計が必要。", chain: ["マンガン鉱石", "フェロMn / 高純度硫酸Mn", "鉄鋼 / 正極材", "建設・モビリティ"], amdFitNote: "低Co正極、資源回収、安価な触媒・酸化物材料の探索に向く。", scores: { heat: 4, demand: 4, supplyRisk: 4, amdFit: 4 }, scoreReasons: { heat: "電池grade化で市場構造が変わる", demand: "鉄鋼＋新正極", supplyRisk: "鉱石と高純度精製の集中", amdFit: "電池・触媒テーマに接続" } }),
  Co: detail({ id: "element-co", family: "element", name: "コバルト", code: "Co", category: "遷移金属", summary: "高性能電池・超合金に不可欠だが、採掘と精製が集中する代表的な供給risk材料。", properties: ["高温強度", "磁性", "電池正極の安定化"], uses: ["高性能蓄電池の正極", "超合金", "硬質工具", "触媒"], supplyCountries: ["1 コンゴ民主共和国 73%", "2 インドネシア 14%", "3 ロシア", "4 豪州"], reserves: "世界埋蔵量 約1,200万t（Co含有量、USGS 2026）。", balance: "2025年は供給過剰と低価格を背景にDRCが輸出規制へ移行。供給量と政策riskが同時に振れる。", circularity: "電池・超合金scrapは高価値。LFP化で新規需要構成が変わる。", chain: ["銅Co鉱 / Ni laterite", "Co hydroxide / metal", "正極材 / 超合金", "電池・航空"], amdFitNote: "供給risk、電池recycling、Co-free材料の比較軸として重要。", scores: { heat: 5, demand: 4, supplyRisk: 5, amdFit: 5 }, scoreReasons: { heat: "政策・価格・技術代替が激しく動く", demand: "電池と超合金", supplyRisk: "DRC採掘と中国精製へ集中", amdFit: "代替・循環の研究テーマが明確" } }),
  Ni: detail({ id: "element-ni", family: "element", name: "ニッケル", code: "Ni", category: "遷移金属", summary: "ステンレスの主力材料。電池grade class 1と大量のlaterite由来供給を分けて見る必要がある。", properties: ["耐食性", "高温強度", "電池高容量化"], uses: ["ステンレス", "高性能蓄電池の正極", "超合金", "めっき"], supplyCountries: ["1 インドネシア", "2 フィリピン", "3 ロシア", "4 カナダ"], reserves: "世界埋蔵量 1.4億t超（Ni含有量、USGS 2026）。", balance: "2022年以降は一次Ni市場が供給超過。大量供給と電池grade適合、環境負荷を切り分ける。", circularity: "ステンレスscrap循環が成熟。電池からのNi回収も経済性が高い。", chain: ["laterite / sulfide ore", "NPI / matte / class 1 Ni", "ステンレス / 正極材", "建設・電池・航空"], amdFitNote: "高圧湿式製錬、低炭素精製、電池循環の技術評価に向く。", scores: { heat: 4, demand: 4, supplyRisk: 4, amdFit: 4 }, scoreReasons: { heat: "供給過剰でもgradeと炭素強度が論点", demand: "ステンレス＋電池", supplyRisk: "インドネシアへの供給集中", amdFit: "製錬・循環・電池を比較可能" } }),
  Cu: detail({ id: "element-cu", family: "element", name: "銅", code: "Cu", category: "遷移金属", summary: "送配電・モーター・電子機器の共通基盤。鉱山の品位低下と許認可の長さが供給拡大を鈍らせる。", properties: ["高導電性", "高熱伝導", "延性・加工性"], uses: ["送配電", "モーター", "電子部品", "配管"], supplyCountries: ["1 チリ", "2 コンゴ民主共和国", "3 ペルー", "4 中国"], reserves: "世界埋蔵量 約9.8億t（Cu含有量、USGS 2026）。", balance: "電化需要が強い一方、新規鉱山のlead timeが長い。scrap供給とAl代替も需給を左右する。", circularity: "品質を保ちやすく高い再資源価値。回収網と不純物管理が鍵。", chain: ["黄銅鉱など", "精鉱 / blister / 電気銅", "wire / foil / alloy", "電力・EV・電子"], amdFitNote: "電化・熱management・資源循環のほぼ全PJに基準材料として効く。", scores: { heat: 5, demand: 5, supplyRisk: 4, amdFit: 5 }, scoreReasons: { heat: "電化の共通制約", demand: "grid・EV・data center", supplyRisk: "鉱山開発の長期化", amdFit: "用途横断の比較基準" } }),
  Ga: detail({ id: "element-ga", family: "element", name: "ガリウム", code: "Ga", category: "ポスト遷移金属", summary: "窒化ガリウムやガリウム砒素として、電力変換、高周波通信、発光ダイオードを支える副産物型の重要材料。", properties: ["低融点", "化合物半導体", "Al/Zn製錬の副産物"], uses: ["電力を高効率に変換する窒化ガリウム半導体", "通信・レーダー用の高周波半導体", "発光ダイオード", "太陽電池"], supplyCountries: ["一次生産: 中国が圧倒的", "日本", "ロシア"], reserves: "独立鉱床でなくbauxite・亜鉛鉱の副産物。埋蔵量より回収率と精製能力で見る。", balance: "需要増に対し副産物供給は価格だけで増えにくく、輸出管理riskが大きい。", circularity: "工程scrap回収は可能。製品中の微量Ga回収は難しい。", chain: ["bauxite / Zn ore", "粗Ga / 高純度Ga", "GaN / GaAs wafer", "power・通信・光"], amdFitNote: "半導体、光、量子・sensor系の研究seed評価に不可欠。", scores: { heat: 5, demand: 5, supplyRisk: 5, amdFit: 5 }, scoreReasons: { heat: "power半導体と輸出管理", demand: "GaN・RF・LED", supplyRisk: "副産物＋精製集中", amdFit: "先端deviceの共通材料" } }),
  Ge: detail({ id: "element-ge", family: "element", name: "ゲルマニウム", code: "Ge", category: "半金属", summary: "赤外光学・光fiber・宇宙用太陽電池を支える、亜鉛製錬等の副産物。", properties: ["赤外透過", "高屈折率", "半導体特性"], uses: ["赤外光学", "光ファイバー", "宇宙用太陽電池", "触媒"], supplyCountries: ["中国", "ベルギー", "カナダ"], reserves: "副産物のため独立した世界埋蔵量の定量が難しい。Zn鉱・石炭灰等の回収可能量を見る。", balance: "防衛・通信需要と輸出管理で供給riskが高い。", circularity: "光学加工scrap・触媒から回収可能。製品回収は用途別。", chain: ["Zn精鉱 / 石炭灰", "GeO2 / 高純度Ge", "lens / fiber / cell", "通信・宇宙・防衛"], amdFitNote: "光学、sensor、宇宙・半導体研究の供給risk評価に使える。", scores: { heat: 5, demand: 4, supplyRisk: 5, amdFit: 4 }, scoreReasons: { heat: "地政学と光・宇宙用途", demand: "赤外・fiber・solar", supplyRisk: "副産物と精製集中", amdFit: "先端光学seedに有効" } }),
  Zr: detail({ id: "element-zr", family: "element", name: "ジルコニウム", code: "Zr", category: "遷移金属", summary: "耐食・耐熱・低中性子吸収を生かし、原子力、耐火物、ceramics、医療で使う。", properties: ["耐食性", "高融点", "低中性子吸収"], uses: ["原子炉被覆管", "耐火物", "ジルコニアセラミックス", "歯科"], supplyCountries: ["鉱物精鉱: 豪州", "南アフリカ", "モザンビーク", "中国"], reserves: "世界埋蔵量 7,000万t超（ZrO2含有量、USGS 2026）。", balance: "zircon砂はTi鉱物と共産。高純度metal・nuclear gradeで追加障壁。", circularity: "耐火物・foundry sand再利用、金属scrap回収。用途別の分離が必要。", chain: ["zircon / baddeleyite", "ZrO2 / sponge Zr", "ceramics / alloy", "原子力・医療・耐火"], amdFitNote: "ceramics、医療、耐熱・耐食process材料の研究評価に強い。", scores: { heat: 4, demand: 3, supplyRisk: 4, amdFit: 4 }, scoreReasons: { heat: "原子力回帰と高機能ceramics", demand: "耐火・原子力・医療", supplyRisk: "mineral sand供給と高純度化", amdFit: "大学材料seedと相性" } }),
  Nb: detail({ id: "element-nb", family: "element", name: "ニオブ", code: "Nb", category: "遷移金属", summary: "少量添加で鋼を高強度化し、超伝導磁石にも使う。供給がBrazilへ極端に集中。", properties: ["鋼の結晶微細化", "超伝導", "高温耐性"], uses: ["高張力鋼", "超伝導磁石", "超合金"], supplyCountries: ["1 ブラジル", "2 カナダ", "3 コンゴ民主共和国"], reserves: "世界埋蔵量 2,100万t超（Nb含有量、USGS 2026）。", balance: "需要は安定だが供給元が少ない。少量添加ゆえ価格転嫁は可能でも代替に性能trade-off。", circularity: "鋼scrapに希釈され個別回収しにくい。超合金・磁石scrapは回収余地。", chain: ["pyrochlore / columbite", "ferroniobium / Nb metal", "高張力鋼 / 超伝導線", "infra・医療・研究"], amdFitNote: "核融合・MRI・高強度構造材など大型deeptechの評価軸。", scores: { heat: 4, demand: 4, supplyRisk: 5, amdFit: 4 }, scoreReasons: { heat: "infraと超伝導の二面性", demand: "高張力鋼が基礎", supplyRisk: "Brazil集中", amdFit: "大型研究設備との接点" } }),
  Nd: detail({ id: "element-nd", family: "element", name: "ネオジム", code: "Nd", category: "ランタノイド", summary: "NdFeB永久磁石の主成分。EV motor、風力、robotで需要が伸びる一方、分離・磁石製造が集中。", properties: ["強力な永久磁石", "酸化しやすい", "rare earth分離が必要"], uses: ["電気自動車用モーター", "風力発電", "ロボットの駆動部", "音響"], supplyCountries: ["鉱山・分離: 中国", "米国", "豪州", "ミャンマー"], reserves: "rare earth全体で7,500万t超（REO換算、USGS 2026）。Nd単独の埋蔵量ではない。", balance: "鉱石より分離・metal化・磁石製造の集中がrisk。Dy/Tb使用量低減も同時に見る。", circularity: "motor・HDD磁石のdirect recyclingと再合金化が有望。", chain: ["bastnäsite / monazite", "分離Nd oxide", "NdFeB magnet", "EV・風力・robot"], amdFitNote: "mobility、robotics、energy deviceの供給chain分析に不可欠。", scores: { heat: 5, demand: 5, supplyRisk: 5, amdFit: 5 }, scoreReasons: { heat: "電動化の核心かつ高集中", demand: "motor・風力", supplyRisk: "分離と磁石製造が集中", amdFit: "robot・energy研究と直結" } }),
  Ta: detail({ id: "element-ta", family: "element", name: "タンタル", code: "Ta", category: "遷移金属", summary: "小型capacitorと耐食・高温部材に強い。紛争鉱物管理と副産物供給が重要。", properties: ["高容量capacitor", "耐食性", "高融点"], uses: ["小型電子機器用コンデンサー", "超合金", "医療用インプラント", "硬質工具"], supplyCountries: ["1 コンゴ民主共和国", "2 ルワンダ", "3 ブラジル", "4 豪州"], reserves: "世界埋蔵量はNA。確認済み資源は豪州・ブラジル・カナダ・中国に多い（USGS 2026）。", balance: "小規模市場でproject停止の影響が大きい。traceabilityと再生材比率を見る。", circularity: "製造scrapと超合金scrapから回収。小型電子部品からの回収は難しい。", chain: ["coltan / tantalite", "Ta2O5 / powder", "capacitor / alloy", "電子・航空・医療"], amdFitNote: "electronicsと医療材料の高機能化、責任ある調達の事業設計に使える。", scores: { heat: 4, demand: 4, supplyRisk: 5, amdFit: 4 }, scoreReasons: { heat: "小型高機能＋責任調達", demand: "electronics・航空", supplyRisk: "小規模・副産物・紛争地域", amdFit: "医療・deviceテーマ" } }),
  W: detail({ id: "element-w", family: "element", name: "タングステン", code: "W", category: "遷移金属", summary: "最高水準の融点・硬度・密度を持ち、切削、半導体、核融合、防衛で代替が難しい。", properties: ["極めて高い融点", "高密度", "炭化物が高硬度"], uses: ["超硬工具", "半導体配線", "高温部材", "放射線遮蔽"], supplyCountries: ["1 中国", "2 カザフスタン", "3 ベトナム", "4 ロシア"], reserves: "世界埋蔵量 470万t超（W含有量、USGS 2026）。", balance: "中国の採掘・加工比率が高く、工具需要と戦略用途で供給riskが続く。", circularity: "超硬工具の回収・zinc process等が実用。回収systemが競争力。", chain: ["wolframite / scheelite", "APT / WC powder", "超硬工具 / alloy", "製造・半導体・energy"], amdFitNote: "製造process、核融合、高温材料、recycling事業の評価に強い。", scores: { heat: 5, demand: 4, supplyRisk: 5, amdFit: 5 }, scoreReasons: { heat: "高温・製造・防衛で代替困難", demand: "工具・半導体・energy", supplyRisk: "中国集中", amdFit: "process・energy研究と直結" } }),
  Pt: detail({ id: "element-pt", family: "element", name: "白金", code: "Pt", category: "遷移金属", summary: "触媒・燃料電池・水電解・医療で使う高価なPGM。南アフリカの鉱山とrecyclingが供給を左右する。", properties: ["高い触媒活性", "耐食性", "高温安定"], uses: ["自動車触媒", "燃料電池・水電解", "化学触媒", "医療"], supplyCountries: ["1 南アフリカ", "2 ロシア", "3 ジンバブエ", "4 カナダ"], reserves: "PGM合計の世界埋蔵量 7.6万t超（USGS 2026）。Pt単独ではなくPGM合算。", balance: "内燃機関触媒の変化と水素用途が相殺。副産物構造とPd/Rh代替を併記する。", circularity: "自動車触媒からの回収が成熟。燃料電池・電解槽は今後の循環設計が重要。", chain: ["PGM ore", "Pt concentrate / metal", "catalyst / MEA", "自動車・水素・化学"], amdFitNote: "水素、触媒、医療の研究seedをコスト・回収込みで見る基準。", scores: { heat: 4, demand: 4, supplyRisk: 5, amdFit: 5 }, scoreReasons: { heat: "水素期待と自動車転換の綱引き", demand: "触媒＋水素", supplyRisk: "南アフリカ集中", amdFit: "触媒・energy・医療に広い" } }),
  Hf: detail({ id: "element-hf", family: "element", name: "ハフニウム", code: "Hf", category: "遷移金属", summary: "zirconium精製の副産物。先端半導体のhigh-k膜、超合金、原子炉制御に使う小規模戦略材料。", properties: ["高中性子吸収", "高融点", "HfO2のhigh-k特性"], uses: ["半導体の絶縁膜", "超合金", "原子炉制御棒", "プラズマ電極"], supplyCountries: ["Zr精製に連動", "フランス", "中国", "ドイツ"], reserves: "定量的な世界埋蔵量は非公表。zircon / baddeleyite中にZrと共存（USGS 2026）。", balance: "Zr需要に供給が連動し、Hf価格だけで増産しにくい典型的な副産物risk。", circularity: "高価だが用途中濃度が低く、超合金scrapなど限定streamが中心。", chain: ["zircon", "Zr/Hf分離", "Hf metal / HfO2", "半導体・航空・原子力"], amdFitNote: "先端半導体・高温材料の『少量だが止まる』riskを可視化できる。", scores: { heat: 5, demand: 4, supplyRisk: 5, amdFit: 4 }, scoreReasons: { heat: "先端半導体と副産物制約", demand: "high-k・superalloy", supplyRisk: "Zr連動の小規模供給", amdFit: "半導体・高温seedに有効" } }),
};

const elementGlance: Record<string, { use: string; supplyAlert: string }> = {
  Li: { use: "蓄電池", supplyAlert: "電池用の精製工程が集中" },
  C: { use: "電池負極・吸着", supplyAlert: "電池用の加工が中国に集中" },
  Si: { use: "半導体・太陽電池", supplyAlert: "高純度化の工程が集中" },
  P: { use: "肥料・蓄電池", supplyAlert: "埋蔵地域が大きく偏る" },
  Ti: { use: "航空・医療", supplyAlert: "高品質加工と認証が制約" },
  Mn: { use: "鉄鋼・蓄電池", supplyAlert: "電池用の高純度精製が集中" },
  Co: { use: "蓄電池・超合金", supplyAlert: "採掘と精製が極端に集中" },
  Ni: { use: "ステンレス・蓄電池", supplyAlert: "供給がインドネシアに集中" },
  Cu: { use: "電力網・モーター", supplyAlert: "新しい鉱山の開発に長期間" },
  Ga: { use: "電力半導体・通信", supplyAlert: "副産物かつ中国精製に集中" },
  Ge: { use: "赤外光学・光通信", supplyAlert: "副産物かつ中国供給に集中" },
  Zr: { use: "原子力・医療", supplyAlert: "高純度化できる供給元が限定" },
  Nb: { use: "高張力鋼・超伝導", supplyAlert: "供給がブラジルに極端集中" },
  Nd: { use: "EVモーター・風力", supplyAlert: "分離と磁石製造が中国に集中" },
  Ta: { use: "電子部品・医療", supplyAlert: "小規模市場・紛争地域に依存" },
  W: { use: "工具・半導体", supplyAlert: "採掘と加工が中国に集中" },
  Pt: { use: "触媒・水素", supplyAlert: "鉱山が南アフリカに集中" },
  Hf: { use: "半導体・原子力", supplyAlert: "副産物のため増産しにくい" },
};

type RawElement = readonly [string, string, number | null, number, ElementCategory];
const rawElements: RawElement[] = [
  ["H","水素",1,1,"nonmetal"],["He","ヘリウム",18,1,"noble"],
  ["Li","リチウム",1,2,"alkali"],["Be","ベリリウム",2,2,"alkaline"],["B","ホウ素",13,2,"metalloid"],["C","炭素",14,2,"nonmetal"],["N","窒素",15,2,"nonmetal"],["O","酸素",16,2,"nonmetal"],["F","フッ素",17,2,"halogen"],["Ne","ネオン",18,2,"noble"],
  ["Na","ナトリウム",1,3,"alkali"],["Mg","マグネシウム",2,3,"alkaline"],["Al","アルミニウム",13,3,"post-transition"],["Si","ケイ素",14,3,"metalloid"],["P","リン",15,3,"nonmetal"],["S","硫黄",16,3,"nonmetal"],["Cl","塩素",17,3,"halogen"],["Ar","アルゴン",18,3,"noble"],
  ["K","カリウム",1,4,"alkali"],["Ca","カルシウム",2,4,"alkaline"],["Sc","スカンジウム",3,4,"transition"],["Ti","チタン",4,4,"transition"],["V","バナジウム",5,4,"transition"],["Cr","クロム",6,4,"transition"],["Mn","マンガン",7,4,"transition"],["Fe","鉄",8,4,"transition"],["Co","コバルト",9,4,"transition"],["Ni","ニッケル",10,4,"transition"],["Cu","銅",11,4,"transition"],["Zn","亜鉛",12,4,"transition"],["Ga","ガリウム",13,4,"post-transition"],["Ge","ゲルマニウム",14,4,"metalloid"],["As","ヒ素",15,4,"metalloid"],["Se","セレン",16,4,"nonmetal"],["Br","臭素",17,4,"halogen"],["Kr","クリプトン",18,4,"noble"],
  ["Rb","ルビジウム",1,5,"alkali"],["Sr","ストロンチウム",2,5,"alkaline"],["Y","イットリウム",3,5,"transition"],["Zr","ジルコニウム",4,5,"transition"],["Nb","ニオブ",5,5,"transition"],["Mo","モリブデン",6,5,"transition"],["Tc","テクネチウム",7,5,"transition"],["Ru","ルテニウム",8,5,"transition"],["Rh","ロジウム",9,5,"transition"],["Pd","パラジウム",10,5,"transition"],["Ag","銀",11,5,"transition"],["Cd","カドミウム",12,5,"transition"],["In","インジウム",13,5,"post-transition"],["Sn","スズ",14,5,"post-transition"],["Sb","アンチモン",15,5,"metalloid"],["Te","テル",16,5,"metalloid"],["I","ヨウ素",17,5,"halogen"],["Xe","キセノン",18,5,"noble"],
  ["Cs","セシウム",1,6,"alkali"],["Ba","バリウム",2,6,"alkaline"],["La","ランタン",3,6,"lanthanide"],["Ce","セリウム",null,6,"lanthanide"],["Pr","プラセオジム",null,6,"lanthanide"],["Nd","ネオジム",null,6,"lanthanide"],["Pm","プロメチウム",null,6,"lanthanide"],["Sm","サマリウム",null,6,"lanthanide"],["Eu","ユウロピウム",null,6,"lanthanide"],["Gd","ガドリニウム",null,6,"lanthanide"],["Tb","テルビウム",null,6,"lanthanide"],["Dy","ジスプロシウム",null,6,"lanthanide"],["Ho","ホルミウム",null,6,"lanthanide"],["Er","エルビウム",null,6,"lanthanide"],["Tm","ツリウム",null,6,"lanthanide"],["Yb","イッテルビウム",null,6,"lanthanide"],["Lu","ルテチウム",null,6,"lanthanide"],["Hf","ハフニウム",4,6,"transition"],["Ta","タンタル",5,6,"transition"],["W","タングステン",6,6,"transition"],["Re","レニウム",7,6,"transition"],["Os","オスミウム",8,6,"transition"],["Ir","イリジウム",9,6,"transition"],["Pt","白金",10,6,"transition"],["Au","金",11,6,"transition"],["Hg","水銀",12,6,"transition"],["Tl","タリウム",13,6,"post-transition"],["Pb","鉛",14,6,"post-transition"],["Bi","ビスマス",15,6,"post-transition"],["Po","ポロニウム",16,6,"post-transition"],["At","アスタチン",17,6,"halogen"],["Rn","ラドン",18,6,"noble"],
  ["Fr","フランシウム",1,7,"alkali"],["Ra","ラジウム",2,7,"alkaline"],["Ac","アクチニウム",3,7,"actinide"],["Th","トリウム",null,7,"actinide"],["Pa","プロトアクチニウム",null,7,"actinide"],["U","ウラン",null,7,"actinide"],["Np","ネプツニウム",null,7,"actinide"],["Pu","プルトニウム",null,7,"actinide"],["Am","アメリシウム",null,7,"actinide"],["Cm","キュリウム",null,7,"actinide"],["Bk","バークリウム",null,7,"actinide"],["Cf","カリホルニウム",null,7,"actinide"],["Es","アインスタイニウム",null,7,"actinide"],["Fm","フェルミウム",null,7,"actinide"],["Md","メンデレビウム",null,7,"actinide"],["No","ノーベリウム",null,7,"actinide"],["Lr","ローレンシウム",null,7,"actinide"],["Rf","ラザホージウム",4,7,"transition"],["Db","ドブニウム",5,7,"transition"],["Sg","シーボーギウム",6,7,"transition"],["Bh","ボーリウム",7,7,"transition"],["Hs","ハッシウム",8,7,"transition"],["Mt","マイトネリウム",9,7,"transition"],["Ds","ダームスタチウム",10,7,"transition"],["Rg","レントゲニウム",11,7,"transition"],["Cn","コペルニシウム",12,7,"transition"],["Nh","ニホニウム",13,7,"post-transition"],["Fl","フレロビウム",14,7,"post-transition"],["Mc","モスコビウム",15,7,"post-transition"],["Lv","リバモリウム",16,7,"post-transition"],["Ts","テネシン",17,7,"halogen"],["Og","オガネソン",18,7,"noble"],
];

export const ELEMENTS: ElementRecord[] = rawElements.map(([symbol, name, group, period, category], index) => {
  const atomicNumber = index + 1;
  const isLanthanideSeries = atomicNumber >= 58 && atomicNumber <= 71;
  const isActinideSeries = atomicNumber >= 90 && atomicNumber <= 103;
  return {
    atomicNumber,
    symbol,
    name,
    group,
    period,
    displayColumn: isLanthanideSeries ? atomicNumber - 54 : isActinideSeries ? atomicNumber - 86 : group ?? 3,
    displayRow: isLanthanideSeries ? 8 : isActinideSeries ? 9 : period,
    category,
    glanceUse: elementGlance[symbol]?.use,
    supplyAlert: elementGlance[symbol]?.supplyAlert,
    detail: elementDetails[symbol],
  };
});

function material(
  family: "mineral" | "polymer",
  value: Omit<MaterialDetail, "family" | "lastReviewed" | "sources"> & { sources?: MaterialSource[] }
) {
  return detail({ ...value, family, sources: value.sources ?? (family === "mineral" ? mineralSources : polymerSources) });
}

export const MINERALS: MaterialDetail[] = [
  material("mineral", { id:"mineral-spodumene", name:"スポジュメン（リチア輝石）", code:"LiAlSi₂O₆", category:"Li鉱石", summary:"hard-rock lithiumの主力鉱物。高品位精鉱から電池grade Li化合物へつなぐ。", properties:["pegmatite鉱物","選鉱・焙焼が必要"], uses:["炭酸Li","水酸化Li","耐熱ceramics"], supplyCountries:["豪州","中国","ジンバブエ","カナダ","マリ"], reserves:"Li全体の世界埋蔵量 約3,700万t（Li含有量）。かん水を含むため鉱物単独値ではない。", balance:"価格低下局面では高cost鉱山が延期されやすいが、短い増産lead timeが強み。", circularity:"採掘tailings活用と電池recyclingを別に評価。", chain:["pegmatite","spodumene concentrate","LiOH / Li₂CO₃","battery"], amdFitNote:"鉱物処理、未利用鉱物、電池材料の技術評価に向く。", scores:{heat:5,demand:5,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"Li価格循環の中心",demand:"電池",supplyRisk:"鉱山＋精製集中",amdFit:"電池・資源PJ"} }),
  material("mineral", { id:"mineral-brine", name:"塩湖かん水", code:"Li-rich brine", category:"Li原料", summary:"鉱物ではないがLi供給を理解するため不可欠な原料lane。蒸発・DLE・水管理が競争軸。", properties:["溶存資源","Mg/Li比が工程に影響"], uses:["炭酸Li","水酸化Li"], supplyCountries:["チリ","アルゼンチン","中国","ボリビア"], reserves:"Li commodity値に含まれる。資源量と経済的埋蔵量、水収支を分けて見る。", balance:"低costの可能性がある一方、立上げ期間・回収率・地域水利用が制約。", circularity:"水・薬剤の循環と地域環境impactが主論点。", chain:["salt lake / geothermal brine","concentration / DLE","Li₂CO₃ / LiOH","battery"], amdFitNote:"DLE、膜、吸着材、水処理の研究seedと接続。", scores:{heat:5,demand:5,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"DLE投資が活発",demand:"電池",supplyRisk:"地域・水・立上げrisk",amdFit:"水処理・吸着技術"} }),
  material("mineral", { id:"mineral-bauxite", name:"ボーキサイト", code:"Al ore", category:"Al鉱石", summary:"aluminumの主原料。鉱石量よりalumina精製、電力、red mud処理が競争力を決める。", properties:["Al hydroxide主体","不純物差が大きい"], uses:["alumina","aluminum metal","耐火材"], supplyCountries:["Guinea","豪州","中国","Brazil","India"], reserves:"USGS bauxite/alumina commodityを参照。鉱石→alumina→metalで供給国が変わる。", balance:"軽量化需要は強いが、製錬電力costと炭素強度が供給選別を進める。", circularity:"Al scrap循環は成熟。red mudからの金属回収は余地大。", chain:["bauxite","alumina","primary / recycled Al","mobility・建材"], amdFitNote:"軽量化、低炭素製錬、red mud資源化に展開。", scores:{heat:4,demand:5,supplyRisk:3,amdFit:4}, scoreReasons:{heat:"低炭素metal化",demand:"mobility・infra",supplyRisk:"鉱石より精製電力",amdFit:"循環・process"} }),
  material("mineral", { id:"mineral-graphite", name:"天然黒鉛", code:"C", category:"炭素鉱物", summary:"LIB負極の主原料。採掘後の球状化・高純度化・coatingまで見ないと供給riskを誤る。", properties:["層状結晶","導電性","潤滑性"], uses:["battery anode","耐火物","潤滑材"], supplyCountries:["中国","Madagascar","Tanzania","Mozambique","Brazil"], reserves:"世界埋蔵量 約3.1億t（天然黒鉛、USGS 2026）。", balance:"鉱石は複数国にあるが電池grade加工は中国集中。synthetic graphiteとのcost/CO₂比較が必要。", circularity:"電池からの負極再生、直接再利用、精製工程scrap回収が開発中。", chain:["flake graphite","spherical purified graphite","coated anode","LIB"], amdFitNote:"電池、炭素材料、精製・recyclingを一体で評価。", scores:{heat:5,demand:5,supplyRisk:5,amdFit:5}, scoreReasons:{heat:"電池負極の中核",demand:"LIB",supplyRisk:"加工集中",amdFit:"炭素・電池PJ"} }),
  material("mineral", { id:"mineral-quartz", name:"石英・高純度石英", code:"SiO₂", category:"Si原料", summary:"ありふれた石英と、半導体crucibleに使える高純度石英は別市場。純度・包有物・加工know-howが価値。", properties:["硬度7","熱安定","高純度化で電子用途"], uses:["glass","semiconductor crucible","silicon feedstock","optics"], supplyCountries:["米国","Norway","Brazil","中国","India"], reserves:"一般石英は豊富。高純度石英は品質条件で実質的な供給源が限定。", balance:"半導体・solarの設備循環に影響されるが、qualified source追加には時間。", circularity:"crucible・glass・Si kerfの再資源化は用途別純度管理が必要。", chain:["quartz ore","high-purity silica","metal Si / crucible","semiconductor・solar"], amdFitNote:"高純度化、分析、結晶・半導体seedの入口。", scores:{heat:4,demand:4,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"高純度品は別市場",demand:"半導体・PV",supplyRisk:"qualified source限定",amdFit:"材料分析・半導体"} }),
  material("mineral", { id:"mineral-chalcopyrite", name:"黄銅鉱", code:"CuFeS₂", category:"Cu鉱石", summary:"世界のCu供給を支える代表的硫化鉱。品位低下、arsenic、不純物、製錬capacityが論点。", properties:["Cu硫化鉱","浮選可能"], uses:["Cu精鉱","電気銅"], supplyCountries:["Chile","Peru","DRC","中国","米国"], reserves:"Cu全体の世界埋蔵量 約9.8億t（Cu含有量、USGS 2026）。鉱物別ではない。", balance:"新鉱山の許認可・水・grade低下で供給lead timeが長い。", circularity:"Cu scrapは高価値。鉱山tailings再処理も候補。", chain:["chalcopyrite ore","concentrate","smelting / refining","wire・foil"], amdFitNote:"選鉱、sensor sorting、tailings、都市鉱山の比較に。", scores:{heat:5,demand:5,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"電化の制約",demand:"grid・EV",supplyRisk:"鉱山lead time",amdFit:"process・循環"} }),
  material("mineral", { id:"mineral-nickel-laterite", name:"ニッケルlaterite", code:"Ni laterite", category:"Ni鉱石", summary:"Ni資源の過半を占める酸化鉱。NPI、matte、HPALで製品gradeと環境負荷が大きく変わる。", properties:["低品位・大規模","高圧酸浸出が選択肢"], uses:["stainless","battery-grade Ni"], supplyCountries:["Indonesia","Philippines","New Caledonia","豪州"], reserves:"Ni世界埋蔵量 1.4億t超。世界資源の54%がlateriteとUSGS推計。", balance:"Indonesia増産でNi全体は余剰だが、carbon intensityとclass 1品質を分ける。", circularity:"鉱滓・acid管理と製品scrap循環を別に評価。", chain:["laterite","NPI / matte / MHP","stainless / cathode","infra・battery"], amdFitNote:"hydrometallurgy、廃液、低炭素化の技術seedに直結。", scores:{heat:5,demand:4,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"供給急増と環境制約",demand:"stainless＋battery",supplyRisk:"Indonesia集中",amdFit:"製錬・環境"} }),
  material("mineral", { id:"mineral-copper-cobalt", name:"銅・コバルト層状鉱床", code:"Cu-Co ore", category:"Co鉱石", summary:"DRC/Zambiaに集中し、CoがCu採掘の副産物として供給される代表的鉱床。", properties:["sediment-hosted","CuとCoの共産"], uses:["Cu","battery-grade Co"], supplyCountries:["DRC","Zambia"], reserves:"Co世界埋蔵量 約1,200万t。DRCが約600万t（USGS 2026）。", balance:"Co価格だけでは採掘量が決まらず、Cu economicsと輸出政策が供給を左右。", circularity:"鉱山side ESGと電池recyclingを供給portfolioで比較。", chain:["Cu-Co ore","hydroxide / concentrate","refined Co","cathode・alloy"], amdFitNote:"副産物economics、責任調達、recyclingの教材性が高い。", scores:{heat:5,demand:4,supplyRisk:5,amdFit:5}, scoreReasons:{heat:"政策・副産物構造",demand:"battery・alloy",supplyRisk:"DRC集中",amdFit:"事業model評価"} }),
  material("mineral", { id:"mineral-monazite", name:"モナザイト", code:"(Ce,La,Nd,Th)PO₄", category:"rare earth鉱物", summary:"light rare earthとPを含む。Th/U管理、分離cost、放射性残渣が事業成立性を決める。", properties:["phosphate mineral","LREE-rich","放射性元素を伴う場合"], uses:["Nd/Pr oxide","Ce/La products"], supplyCountries:["中国","豪州","India","Brazil","Madagascar"], reserves:"rare earth全体の世界埋蔵量 7,500万t超（REO換算）。鉱物単独値ではない。", balance:"鉱石より分離・廃棄物管理とmagnet supply chainが制約。", circularity:"磁石recyclingが一次採掘を補完。残渣処理が必須。", chain:["monazite sand","cracking / separation","NdPr oxide","magnet"], amdFitNote:"分離、放射性残渣、磁石chainの技術評価に。", scores:{heat:5,demand:5,supplyRisk:5,amdFit:5}, scoreReasons:{heat:"magnet需要",demand:"EV・robot",supplyRisk:"分離集中",amdFit:"分離・環境・device"} }),
  material("mineral", { id:"mineral-bastnasite", name:"バストネサイト", code:"(Ce,La)(CO₃)F", category:"rare earth鉱物", summary:"light rare earthの主力鉱物。採掘国より分離・metal・magnet工程の集中を見る。", properties:["LREE-rich","carbonate-fluoride"], uses:["NdPr","Ce","La"], supplyCountries:["中国","米国","Vietnam"], reserves:"rare earth全体で7,500万t超（REO換算、USGS 2026）。", balance:"mine production増でも磁石grade供給の多様化は遅い。", circularity:"磁石direct recyclingと一次原料のblendが有望。", chain:["bastnäsite","mixed RE concentrate","separated oxides","magnet・catalyst"], amdFitNote:"EV/roboticsと分離processの両面で重要。", scores:{heat:5,demand:5,supplyRisk:5,amdFit:5}, scoreReasons:{heat:"magnet chain",demand:"motor",supplyRisk:"分離・磁石集中",amdFit:"robot・energy"} }),
  material("mineral", { id:"mineral-coltan", name:"columbite–tantalite（coltan）", code:"(Fe,Mn)(Nb,Ta)₂O₆", category:"Nb/Ta鉱物", summary:"NbとTaの固溶鉱物。artisanal mining、traceability、Sn副産物chainを含めて見る。", properties:["Nb/Ta solid solution","高密度"], uses:["Ta capacitor","Nb alloy"], supplyCountries:["DRC","Rwanda","Brazil","Nigeria","豪州"], reserves:"Taは世界埋蔵量NA、Nbは2,100万t超。鉱床typeとcommodityを分ける。", balance:"小規模市場で供給shockが大きく、certified materialのpremiumが発生。", circularity:"electronics製造scrapと超合金scrapが主要回収源。", chain:["coltan","Ta/Nb separation","powder / ferroniobium","electronics・steel"], amdFitNote:"責任調達と高機能electronicsの事業設計に。", scores:{heat:4,demand:4,supplyRisk:5,amdFit:4}, scoreReasons:{heat:"traceability",demand:"electronics・steel",supplyRisk:"小規模・地域risk",amdFit:"材料＋ESG"} }),
  material("mineral", { id:"mineral-zircon", name:"ジルコン", code:"ZrSiO₄", category:"Zr/Hf鉱物", summary:"Zrの主原料でHfを伴う。mineral sandの副産物構造と高純度分離が価値を作る。", properties:["耐熱","耐薬品","Hfを含む"], uses:["ceramics","foundry sand","Zr/Hf metal"], supplyCountries:["豪州","南アフリカ","Mozambique","Senegal"], reserves:"Zr世界埋蔵量 7,000万t超（ZrO₂換算、USGS 2026）。Hf定量値はなし。", balance:"Ti mineral sand操業に連動。nuclear gradeではZr/Hf分離が追加制約。", circularity:"foundry sand・refractory再利用、metal scrap回収。", chain:["heavy mineral sand","zircon concentrate","ZrO₂ / Zr-Hf separation","ceramic・nuclear"], amdFitNote:"ceramics、医療、原子力・半導体の共通入口。", scores:{heat:4,demand:3,supplyRisk:4,amdFit:4}, scoreReasons:{heat:"Hf副産物chain",demand:"ceramic・nuclear",supplyRisk:"mineral sand連動",amdFit:"高機能ceramics"} }),
  material("mineral", { id:"mineral-ilmenite", name:"イルメナイト", code:"FeTiO₃", category:"Ti鉱物", summary:"TiO₂顔料とTi metalの主要原料。chloride/sulfate processとslag化で用途が分かれる。", properties:["Ti-Fe oxide","大規模mineral sand"], uses:["TiO₂ pigment","Ti slag","Ti metal feed"], supplyCountries:["中国","Mozambique","南アフリカ","豪州","Canada"], reserves:"USGS Titanium Mineral Concentratesのcommodity表を参照。rutileとのgrade差に注意。", balance:"顔料景気と航空Ti需要が別cycle。電力・塩素・廃液処理がcostを左右。", circularity:"Ti metal scrapは回収価値が高い。顔料は製品中に散逸。", chain:["ilmenite sand","Ti slag / synthetic rutile","TiO₂ / TiCl₄","pigment・metal"], amdFitNote:"process化学、廃液、光触媒・Ti合金seedに。", scores:{heat:4,demand:4,supplyRisk:3,amdFit:5}, scoreReasons:{heat:"顔料と高機能Ti",demand:"pigment・aerospace",supplyRisk:"加工設備",amdFit:"材料・環境process"} }),
  material("mineral", { id:"mineral-fluorite", name:"蛍石", code:"CaF₂", category:"F鉱物", summary:"fluorochemicalの起点。半導体etch、battery electrolyte、refrigerantなど下流が広い。", properties:["F-rich","acid-gradeで高純度"], uses:["HF","fluoropolymer","semiconductor chemicals","battery electrolyte"], supplyCountries:["中国","Mexico","Mongolia","South Africa","Vietnam"], reserves:"USGS Fluorspar commodityの世界埋蔵量・生産を参照。acid-grade供給を分ける。", balance:"中国・Mexico集中と下流高純度化、環境規制が同時に効く。", circularity:"Fは製品中で散逸しやすい。etch排水・LiPF₆系からの回収が研究課題。", chain:["fluorite","HF","fluorochemical / monomer","semiconductor・battery・PTFE"], amdFitNote:"半導体、電池、排水処理、PFAS代替をつなぐ。", scores:{heat:5,demand:5,supplyRisk:5,amdFit:5}, scoreReasons:{heat:"半導体・電池・規制",demand:"HF系高純度用途",supplyRisk:"産地・精製集中",amdFit:"環境と先端製造"} }),
  material("mineral", { id:"mineral-phosphate-rock", name:"リン鉱石", code:"apatite-rich rock", category:"P鉱石", summary:"食料安全保障を支える肥料原料。Moroccoへの埋蔵集中と副産F/U/Cd、LFP需要を見る。", properties:["apatite主体","wet-process phosphoric acid"], uses:["fertilizer","LFP","food/industrial phosphate"], supplyCountries:["中国","Morocco","米国","Russia","Jordan"], reserves:"世界埋蔵量 約730億t（marketable rock、USGS 2026）。Morocco約500億t。", balance:"肥料需要が圧倒的。LFPは新しい高純度laneで、食品・工業gradeと競争。", circularity:"下水・manure・焼却灰からのP回収が重要。", chain:["phosphate rock / waste P","phosphoric acid / recovered P","fertilizer / LFP","food・agri・battery"], amdFitNote:"水処理・農業・電池を一つの循環事業に束ねられる。", scores:{heat:5,demand:5,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"食料＋LFP",demand:"肥料基礎需要",supplyRisk:"埋蔵集中",amdFit:"排水・農業・battery"} }),
  material("mineral", { id:"mineral-magnesite", name:"マグネサイト", code:"MgCO₃", category:"Mg鉱物", summary:"耐火物とMg化学品の原料。軽量metal、CO₂ mineralization、熱storageでも再注目。", properties:["carbonate mineral","calcinationでMgO"], uses:["refractory","Mg metal/chemicals","cement additives"], supplyCountries:["中国","Turkey","Brazil","Russia","Austria"], reserves:"USGS Magnesium Compounds commodityを参照。metal Mgは別のelectrolytic/thermal chain。", balance:"耐火物の基礎需要に、低炭素cement・CO₂固定の新用途が重なる。", circularity:"耐火brick再利用、Mg系cementの循環設計。", chain:["magnesite","MgO / MgCl₂","refractory / Mg metal","steel・mobility・carbon"], amdFitNote:"CO₂ mineralization、低炭素建材、軽量化seedに。", scores:{heat:4,demand:3,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"carbon mineralization",demand:"耐火＋新用途",supplyRisk:"中国加工集中",amdFit:"環境・建材"} }),
];

export const POLYMERS: MaterialDetail[] = [
  material("polymer", { id:"polymer-pe", name:"ポリエチレン", code:"PE", category:"汎用thermoplastic", summary:"最大級のvolume resin。密度と分岐でfilmからpipeまで広がり、循環設計の基準材。", properties:["軽量","耐薬品","電気絶縁"], uses:["film/packaging","pipe","container","wire coating"], supplyCountries:["原料・樹脂: 中国","米国","中東","韓国"], reserves:"埋蔵量ではなくethylene capacity、naphtha/ethane、recycled feedstockで見る。", balance:"大型capacity増と包装規制が同時進行。grade別需給を分ける。", circularity:"mechanical recyclingが主力。film回収、odor/contamination、food-contactが課題。", chain:["naphtha / ethane / bio-feedstock","ethylene","HDPE / LDPE / LLDPE","film・pipe・container"], amdFitNote:"包装循環、膜、再生材quality、bio-feedstockの事業比較に。", scores:{heat:4,demand:5,supplyRisk:2,amdFit:4}, scoreReasons:{heat:"volumeと規制impactが大きい",demand:"包装・infra",supplyRisk:"供給baseは広い",amdFit:"循環・膜"} }),
  material("polymer", { id:"polymer-pp", name:"ポリプロピレン", code:"PP", category:"汎用thermoplastic", summary:"軽量・耐熱・成形性のbalanceがよく、自動車・包装・医療で大量使用。", properties:["低密度","living hinge","耐熱性"], uses:["automotive","packaging","medical","fiber"], supplyCountries:["中国","米国","中東","韓国"], reserves:"propylene capacityとrefinery/PDH economicsで見る。", balance:"中国capacity増で汎用品は競争激化。高機能compoundとrecycled gradeは別市場。", circularity:"mechanical recycling可能。filler・paint・異材接着が品質を下げる。", chain:["naphtha / propane","propylene","PP / compound","automotive・packaging"], amdFitNote:"軽量化、医療、再生compound、natural fiber compositeに。", scores:{heat:4,demand:5,supplyRisk:2,amdFit:4}, scoreReasons:{heat:"高volume＋高機能化",demand:"auto・packaging",supplyRisk:"供給多様",amdFit:"composite・循環"} }),
  material("polymer", { id:"polymer-pvc", name:"ポリ塩化ビニル", code:"PVC", category:"汎用thermoplastic", summary:"耐久・難燃・costに強く建材で長寿命。添加剤、塩素、回収時の混合管理が論点。", properties:["難燃","耐候","可塑化可能"], uses:["pipe","window frame","cable","medical tubing"], supplyCountries:["中国","米国","Europe","India"], reserves:"chlor-alkaliとethyleneのcapacity、電力costで見る。", balance:"建設cycleの影響が大きく、耐久用途では代替時のLCA比較が必要。", circularity:"硬質PVCは回収しやすい。添加剤履歴と軟質材の分離が課題。", chain:["salt + ethylene","VCM","rigid / flexible PVC","construction・medical"], amdFitNote:"長寿命建材、医療tube、添加剤・recycling技術に。", scores:{heat:3,demand:4,supplyRisk:3,amdFit:3}, scoreReasons:{heat:"規制と耐久価値の両面",demand:"建設基礎需要",supplyRisk:"energy・chlorine",amdFit:"建材・医療"} }),
  material("polymer", { id:"polymer-pet", name:"ポリエチレンテレフタレート", code:"PET", category:"polyester", summary:"bottle・fiberの大市場を持ち、mechanical/chemical recyclingの商用化が最も進む樹脂の一つ。", properties:["透明","barrier","高強度"], uses:["bottle","fiber","film","engineering sheet"], supplyCountries:["中国","India","米国","東南Asia"], reserves:"PX/PTAとMEG capacity、回収bottle供給で見る。", balance:"virgin capacityとrPET義務化需要が競合。food-grade再生能力がpremium。", circularity:"bottle-to-bottleが実用。color・multilayer・fiber回収が課題。", chain:["PX + ethylene","PTA + MEG","PET / rPET","bottle・fiber・film"], amdFitNote:"sorting、depolymerization、food-grade再生の事業化に。", scores:{heat:5,demand:5,supplyRisk:3,amdFit:5}, scoreReasons:{heat:"循環材市場が成立",demand:"包装・繊維",supplyRisk:"原料より再生grade制約",amdFit:"recycling実証向き"} }),
  material("polymer", { id:"polymer-abs", name:"ABS樹脂", code:"ABS", category:"engineering thermoplastic", summary:"外観・剛性・衝撃性のbalanceで家電・自動車・3D printingに使う多相polymer。", properties:["耐衝撃","表面外観","めっき適性"], uses:["electronics housing","automotive interior","toys","3D printing"], supplyCountries:["中国","韓国","台湾","日本"], reserves:"acrylonitrile/butadiene/styreneの三原料とplant integrationで見る。", balance:"家電cycleとbutadiene価格に影響。recycled ABSは難燃剤・色の履歴が課題。", circularity:"WEEE由来回収が可能。BFR選別とmaterial identificationが重要。", chain:["AN + BD + styrene","ABS polymerization","compound","electronics・auto"], amdFitNote:"WEEE循環、3D printing、表面機能化に。", scores:{heat:4,demand:4,supplyRisk:3,amdFit:4}, scoreReasons:{heat:"electronics循環",demand:"家電・auto",supplyRisk:"三原料volatility",amdFit:"digital fabrication"} }),
  material("polymer", { id:"polymer-pa", name:"ポリアミド", code:"PA6 / PA66", category:"engineering thermoplastic", summary:"強度・耐摩耗・耐熱に優れ、繊維と自動車部材の両市場を持つ。吸水と原料riskが設計point。", properties:["高強度","耐摩耗","吸水性"], uses:["automotive","gear/bearing","fiber","electrical"], supplyCountries:["中国","Europe","米国","日本"], reserves:"caprolactamまたはadiponitrile/hexamethylenediamine capacityで見る。", balance:"PA66は一部中間体の供給障害が波及しやすい。metal replacement需要は継続。", circularity:"fiber-to-fiberとengineering scrap回収。grade混合とmoisture管理が課題。", chain:["benzene / butadiene","monomer","PA6 / PA66 / compound","fiber・auto"], amdFitNote:"軽量化、tribology、bio-based nylon、recyclingに。", scores:{heat:4,demand:4,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"metal replacement",demand:"auto・fiber",supplyRisk:"中間体集中",amdFit:"機械・bio材料"} }),
  material("polymer", { id:"polymer-pc", name:"ポリカーボネート", code:"PC", category:"engineering thermoplastic", summary:"透明・耐衝撃・耐熱を両立し、optics・electronics・mobilityで使う。", properties:["高透明","高耐衝撃","寸法安定"], uses:["optical lens","electronics","automotive glazing","medical"], supplyCountries:["中国","韓国","Europe","米国","日本"], reserves:"BPAとcarbonate intermediate、integrated plant capacityで見る。", balance:"中国capacity増と高機能gradeの認証marketが併存。", circularity:"mechanical/chemical recycling可能。coating・blend・BPA管理が課題。", chain:["phenol + acetone","BPA","PC / PC blend","optics・electronics"], amdFitNote:"optics、医療、透明sensor housing、recyclingに。", scores:{heat:4,demand:4,supplyRisk:3,amdFit:5}, scoreReasons:{heat:"透明高機能材",demand:"electronics・mobility",supplyRisk:"capacityは拡大",amdFit:"光・医療"} }),
  material("polymer", { id:"polymer-pom", name:"ポリアセタール", code:"POM", category:"engineering thermoplastic", summary:"摺動・疲労・寸法精度に強いsmall gear/precision part材料。", properties:["低摩擦","高剛性","寸法安定"], uses:["gear","fuel system","fastener","consumer mechanics"], supplyCountries:["中国","Europe","米国","日本","韓国"], reserves:"methanol/formaldehydeとspecialized polymerization capacityで見る。", balance:"EV化で一部fuel用途は減るが、精密機構・roboticsは伸びる。", circularity:"熱分解・formaldehyde発生に注意。clean production scrap中心。", chain:["methanol","formaldehyde / trioxane","POM","precision mechanics"], amdFitNote:"robotics、micro-mechanism、tribology seedに。", scores:{heat:3,demand:3,supplyRisk:3,amdFit:4}, scoreReasons:{heat:"精密機構の基準材",demand:"robot・機構部品",supplyRisk:"specialized plant",amdFit:"robotics"} }),
  material("polymer", { id:"polymer-pps", name:"ポリフェニレンサルファイド", code:"PPS", category:"super engineering plastic", summary:"耐熱・耐薬品・難燃・寸法安定に強く、EV電装・pump・semiconductor周辺で使う。", properties:["高耐熱","耐薬品","難燃"], uses:["EV electrical","pump/valve","electronics","filter"], supplyCountries:["中国","日本","米国","韓国"], reserves:"p-dichlorobenzeneとsodium sulfide、high-quality polymer/compound capacityで見る。", balance:"EV高電圧化で需要増。quality qualificationが供給切替を遅くする。", circularity:"glass fiber compoundが多くclosed-loop困難。production scrap再利用が中心。", chain:["aromatic + sulfur feedstocks","PPS","GF/mineral compound","EV・electronics"], amdFitNote:"電動化、耐薬品device、filter・膜supportに。", scores:{heat:5,demand:5,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"EV・高温electrical",demand:"電装",supplyRisk:"quality capacity限定",amdFit:"device・mobility"} }),
  material("polymer", { id:"polymer-peek", name:"PEEK", code:"PEEK", category:"super engineering plastic", summary:"高耐熱・耐薬品・耐疲労・生体適合を備える高価格material。metal replacementとimplantで価値。", properties:["連続耐熱","耐薬品","生体適合"], uses:["aerospace","semiconductor equipment","medical implant","oil & gas"], supplyCountries:["英国/Europe","中国","米国"], reserves:"fluoroaromatic monomerと少数のqualified producer/compounderで見る。", balance:"volumeは小さいがcertificationとprocess know-howが強い参入障壁。", circularity:"高価なclean scrapは回収価値あり。compositeは分離困難。", chain:["specialty monomer","PEEK polymer","CF/GF compound","aerospace・medical"], amdFitNote:"implant、航空、半導体装置、3D printingの大学seedに極めて相性がよい。", scores:{heat:5,demand:4,supplyRisk:5,amdFit:5}, scoreReasons:{heat:"高付加価値・認証市場",demand:"医療・航空・semi",supplyRisk:"producer/monomer限定",amdFit:"deeptech commercialization"} }),
  material("polymer", { id:"polymer-ptfe", name:"PTFE", code:"PTFE", category:"fluoropolymer", summary:"極低摩擦・高耐薬品・耐熱で代替困難。PFAS規制は用途必要性と排出管理を分けて見る。", properties:["非粘着","耐薬品","高耐熱"], uses:["semiconductor wet process","seal/lining","wire","medical"], supplyCountries:["中国","米国","Europe","日本","India"], reserves:"fluorspar→HF→fluoromonomer chainとemission control capacityで見る。", balance:"critical用途の代替は難しい一方、用途制限・製造排出管理が市場を再編。", circularity:"焼却・再粉砕の制約が大きい。長寿命化とclosed processが重要。", chain:["fluorite","HF / TFE","PTFE","semiconductor・chemical"], amdFitNote:"半導体、化学装置、PFAS代替・無排出processを同時評価。", scores:{heat:5,demand:4,supplyRisk:5,amdFit:5}, scoreReasons:{heat:"critical useと規制の衝突",demand:"semi・chemical",supplyRisk:"F chain＋regulation",amdFit:"環境・先端製造"} }),
  material("polymer", { id:"polymer-epoxy", name:"エポキシ樹脂", code:"EP", category:"thermoset", summary:"接着・絶縁・複合材matrixの基盤。硬化後の再溶融不可が循環の最大課題。", properties:["高接着","電気絶縁","低収縮"], uses:["PCB","adhesive","wind blade","CFRP"], supplyCountries:["中国","韓国","台湾","Europe","日本"], reserves:"BPA/epichlorohydrin、curing agent、electronics-grade capacityで見る。", balance:"wind・electronics・aerospaceでgradeが分かれ、certificationが参入障壁。", circularity:"vitrimer、reworkable adhesive、solvolysis、fiber recoveryがhot。", chain:["phenol / propylene / chlorine","epoxy resin + hardener","laminate / adhesive","electronics・composite"], amdFitNote:"CFRP、接着、electronics、recycling研究の中核。", scores:{heat:5,demand:5,supplyRisk:3,amdFit:5}, scoreReasons:{heat:"composite循環が未解決",demand:"electronics・wind",supplyRisk:"grade別capacity",amdFit:"材料seedが豊富"} }),
  material("polymer", { id:"polymer-pu", name:"ポリウレタン", code:"PU", category:"thermoset / elastomer", summary:"foam、coating、adhesive、elastomerへ自在に設計できる反面、配合が複雑で回収しにくい。", properties:["設計自由度","断熱","elasticity"], uses:["insulation foam","seat/cushion","coating","adhesive"], supplyCountries:["中国","Europe","米国","韓国","日本"], reserves:"isocyanate（MDI/TDI）とpolyol capacity、energy/building demandで見る。", balance:"断熱需要は強い。building renovationとend-of-life foamが次の市場。", circularity:"glycolysis等chemical recycling、bio-polyol、reuse設計が開発中。", chain:["benzene + propylene","isocyanate + polyol","foam / coating / elastomer","building・mobility"], amdFitNote:"断熱、bio原料、廃foam回収、medical elastomerに。", scores:{heat:5,demand:5,supplyRisk:3,amdFit:5}, scoreReasons:{heat:"energy saving＋循環課題",demand:"断熱・mobility",supplyRisk:"large producer集中",amdFit:"environment・bio"} }),
  material("polymer", { id:"polymer-silicone", name:"シリコーン", code:"Silicone", category:"inorganic-organic polymer", summary:"Si-O骨格で耐熱・柔軟・生体適合を両立。sealantから医療、electronics、release materialまで広い。", properties:["耐熱・耐寒","柔軟","撥水・生体適合"], uses:["sealant","medical device","electronics encapsulation","release coating"], supplyCountries:["中国","Europe","米国","日本"], reserves:"metal silicon→chlorosilane→siloxane capacityとenergy costで見る。", balance:"EV/electronics/medicalで高機能grade需要。汎用品はcapacity cycleの影響。", circularity:"crosslinked品は難しい。depolymerizationとsiloxane回収が開発中。", chain:["quartz","metal Si / chlorosilane","siloxane polymer","electronics・medical"], amdFitNote:"医療、sensor封止、soft robotics、Si material chainをつなぐ。", scores:{heat:5,demand:5,supplyRisk:4,amdFit:5}, scoreReasons:{heat:"medical・electronics・soft material",demand:"EV・device",supplyRisk:"Si/energy/process",amdFit:"AMDの横断PJに強い"} }),
  material("polymer", { id:"polymer-pla", name:"ポリ乳酸", code:"PLA", category:"bio-based polyester", summary:"糖由来の代表的bio-based resin。industrial compostabilityと耐熱・barrier・回収systemを分けて評価。", properties:["bio-based","透明","industrial compostable grade"], uses:["packaging","3D printing","fiber","medical"], supplyCountries:["米国","Thailand","中国","Europe"], reserves:"corn/sugar feedstock、lactic acid、polymerization capacityで見る。", balance:"政策需要は強いが、既存recycling stream混入とend-of-life設備が制約。", circularity:"mechanical/chemical recyclingとindustrial composting。自然環境で即分解する意味ではない。", chain:["sugar / starch","lactic acid","PLA","packaging・3D printing"], amdFitNote:"regional biomass、fermentation、medical、3D printingの事業化に。", scores:{heat:5,demand:4,supplyRisk:3,amdFit:5}, scoreReasons:{heat:"bioeconomyと規制",demand:"packaging・printing",supplyRisk:"feedstock/capacity",amdFit:"regional deeptech"} }),
  material("polymer", { id:"polymer-pi", name:"ポリイミド", code:"PI", category:"high-performance polymer", summary:"極薄filmでも高耐熱・電気絶縁・寸法安定を持ち、flexible electronicsと半導体に不可欠。", properties:["高耐熱","絶縁","薄膜形成"], uses:["flex circuit","semiconductor buffer","motor insulation","aerospace"], supplyCountries:["日本","米国","韓国","中国"], reserves:"aromatic dianhydride/diamine、高純度film/coatingのqualified capacityで見る。", balance:"AI/HPC、advanced packaging、EV motorで需要。高純度・低CTE gradeは供給切替が難しい。", circularity:"thermoset-likeで回収困難。長寿命・薄膜化・process scrap低減が中心。", chain:["specialty aromatic monomer","polyamic acid","PI film / varnish","semiconductor・aerospace"], amdFitNote:"半導体packaging、flexible sensor、宇宙材料のseedに。", scores:{heat:5,demand:5,supplyRisk:5,amdFit:5}, scoreReasons:{heat:"advanced packaging",demand:"AI・EV・flex",supplyRisk:"高純度grade限定",amdFit:"先端device"} }),
];

export const MATERIALS: MaterialDetail[] = [
  ...ELEMENTS.flatMap((element) => (element.detail ? [element.detail] : [])),
  ...MINERALS,
  ...POLYMERS,
];

export function getMaterialById(id: string) {
  return MATERIALS.find((item) => item.id === id);
}
