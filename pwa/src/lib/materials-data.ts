export type MaterialFamily = "element" | "mineral" | "polymer";
export type HeatAxis = "heat" | "demand" | "supplyRisk" | "amdFit";
export type HeatLevel = 1 | 2 | 3 | 4 | 5;

export type MaterialSource = {
  label: string;
  href: string;
  asOf: string;
};

export type MarketPoint = {
  period: string;
  value: number;
};

export type SupplyShare = {
  country: string;
  share: number;
};

export type ElementMarketData = {
  benchmark: string;
  unit: string;
  series: MarketPoint[];
  note: string;
  supplyBasis: string;
  supplyShares: SupplyShare[];
  source: MaterialSource;
};

export type PolymerManufacturing = {
  feedstock: string;
  process: string;
};

export type MaterialScores = Record<HeatAxis, HeatLevel>;

export type SupplyDemandDetail = {
  direction: "不足側" | "供給過剰側" | "価格乱高下" | "おおむね均衡";
  severity: HeatLevel;
  cause: string;
  bottleneck: string;
  asOf: string;
  confidence: "高" | "中" | "低";
};

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
  supplyDemand: SupplyDemandDetail;
  sources: MaterialSource[];
  lastReviewed: string;
  market?: ElementMarketData;
  manufacturing?: PolymerManufacturing;
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
  heat: "注目度",
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
  transition: "鉄や銅の仲間（遷移金属）",
  "post-transition": "アルミニウムなどの金属",
  metalloid: "金属と非金属の中間",
  nonmetal: "非金属",
  halogen: "ハロゲン",
  noble: "希ガス",
  lanthanide: "レアアースの仲間",
  actinide: "放射性元素の仲間",
};

const USGS: MaterialSource = {
  label: "米国地質調査所（USGS）鉱物資源概要 2026",
  href: "https://pubs.usgs.gov/publication/mcs2026",
  asOf: "2026-05 v1.3",
};
const IEA: MaterialSource = {
  label: "国際エネルギー機関（IEA）重要鉱物の世界見通し 2025",
  href: "https://www.iea.org/reports/global-critical-minerals-outlook-2025",
  asOf: "2025",
};
const RMIS: MaterialSource = {
  label: "欧州連合（EU）重要・戦略物資データベース",
  href: "https://rmis.jrc.ec.europa.eu/critical-and-strategic-materials",
  asOf: "2026-07確認",
};
const JOGMEC: MaterialSource = {
  label: "エネルギー・金属鉱物資源機構（JOGMEC）鉱物資源の流れ",
  href: "https://mric.jogmec.go.jp/reports/",
  asOf: "2026-07確認",
};
const OECD_PLASTICS: MaterialSource = {
  label: "経済協力開発機構（OECD）世界のプラスチック見通し",
  href: "https://www.oecd.org/environment/plastics/plastics-outlook/",
  asOf: "2026-07確認",
};
const ECHA_POLYMERS: MaterialSource = {
  label: "欧州化学品庁（ECHA）高分子材料情報",
  href: "https://echa.europa.eu/hot-topics/polymers",
  asOf: "2026-07確認",
};

const criticalSources = [USGS, IEA, RMIS, JOGMEC];
const mineralSources = [USGS, RMIS, JOGMEC];
const polymerSources = [OECD_PLASTICS, ECHA_POLYMERS];

const polymerManufacturing: Record<string, PolymerManufacturing> = {
  "polymer-pe": {
    feedstock: "ナフサの分解または天然ガス由来のエタンから得るエチレン",
    process:
      "エチレン分子を長くつなげて作る。高い圧力を使うと柔らかい低密度ポリエチレン、触媒を使うと硬めの高密度ポリエチレンなどになる。",
  },
  "polymer-pp": {
    feedstock: "ナフサ分解またはプロパン脱水素で得るプロピレン",
    process:
      "触媒の力でプロピレン分子を規則正しく長くつなげる。分子の並び方を変えることで、硬さや透明性を調整できる。",
  },
  "polymer-pvc": {
    feedstock: "石油由来のエチレンと、塩から取り出した塩素で作る塩化ビニル",
    process:
      "エチレンと塩素から塩化ビニルを作り、水中で細かな粒のまま分子をつなげて粉末状のポリ塩化ビニルにする。",
  },
  "polymer-pet": {
    feedstock: "石油から作る高純度テレフタル酸とエチレングリコール",
    process:
      "2つの原料を反応させ、水などを取り除きながら分子を長くつなげる。ボトル用は固体のまま追加加熱し、さらに丈夫にする。",
  },
  "polymer-abs": {
    feedstock: "アクリロニトリル、ブタジエン、スチレン",
    process:
      "ゴムのようなブタジエン樹脂に、硬さを出すスチレンと薬品への強さを出すアクリロニトリルを結びつけ、混ぜ合わせる。",
  },
  "polymer-pa": {
    feedstock:
      "ポリアミド6はカプロラクタム、ポリアミド66はヘキサメチレンジアミンとアジピン酸",
    process:
      "ポリアミド6は輪の形をした原料を開いてつなぐ。ポリアミド66は2種類の原料を反応させ、水を取り除きながら長い分子にする。",
  },
  "polymer-pc": {
    feedstock:
      "ビスフェノールAと炭酸原料（ジフェニルカーボネートまたはホスゲン）",
    process:
      "原料を溶かして反応させる方法、または水と有機溶媒の境目で反応させる方法で、分子を長くつなげる。",
  },
  "polymer-pom": {
    feedstock:
      "メタノール由来のホルムアルデヒド、またはそこから作るトリオキサン",
    process:
      "ホルムアルデヒドを直接つなぐか、輪の形をしたトリオキサンを開いてつなぐ。最後に分子の端を安定させ、熱で壊れにくくする。",
  },
  "polymer-pps": {
    feedstock: "パラジクロロベンゼンと硫化ナトリウム系原料",
    process:
      "溶媒の中で2つの原料を高温で反応させ、炭素の輪と硫黄が交互に並ぶ長い分子を作る。",
  },
  "polymer-peek": {
    feedstock: "フッ素化芳香族ケトンと、ハイドロキノン系の芳香族ジオール",
    process:
      "2つの原料を高温で反応させ、水分などを取り除きながら、熱と薬品に強い結びつきを持つ長い分子にする。",
  },
  "polymer-ptfe": {
    feedstock: "蛍石由来のフッ化水素などから作るテトラフルオロエチレン（TFE）",
    process:
      "テトラフルオロエチレン分子を反応させて長くつなぐ。水中での作り方を変えると、粒状の樹脂、細かな粉、液体に分散した製品になる。",
  },
  "polymer-epoxy": {
    feedstock:
      "代表例ではビスフェノールAとエピクロロヒドリン、使用時にはアミンなどの硬化剤",
    process:
      "まず液体または半固体の樹脂を作り、使うときに硬化剤を混ぜる。分子同士が立体的につながって、元に戻らない硬い材料になる。",
  },
  "polymer-pu": {
    feedstock: "イソシアネートという薬品と、植物油や石油から作るポリオール",
    process:
      "2つの原料を反応させて分子を長くつなぐ。泡を作る材料や触媒を変えると、断熱用の発泡体、塗料、ゴム状材料を作り分けられる。",
  },
  "polymer-silicone": {
    feedstock: "金属ケイ素と、メタノール由来の塩化メチル",
    process:
      "金属ケイ素と塩化メチルを反応させて中間原料を作る。そこへ水を加えるなどして、ケイ素と酸素が交互に並ぶ長い分子にする。",
  },
  "polymer-pla": {
    feedstock: "トウモロコシ・サトウキビなどの糖やデンプンから発酵で得る乳酸",
    process:
      "乳酸をいったん輪の形をしたラクチドに変え、その輪を開きながら長くつないでポリ乳酸にする。",
  },
  "polymer-pi": {
    feedstock: "熱に強い輪の構造を持つ2種類の薬品（酸二無水物とジアミン）",
    process:
      "2つの原料を反応させて前段階の樹脂を作り、加熱または薬品処理で耐熱性の高い構造へ変える。薄いフィルムや塗布液として仕上げる。",
  },
};

const SUPPLY_DEMAND_AS_OF = "2025年実績を中心に2026年7月確認";

function supplyDemand(
  direction: SupplyDemandDetail["direction"],
  severity: HeatLevel,
  cause: string,
  bottleneck: string,
  confidence: SupplyDemandDetail["confidence"],
): SupplyDemandDetail {
  return {
    direction,
    severity,
    cause,
    bottleneck,
    confidence,
    asOf: SUPPLY_DEMAND_AS_OF,
  };
}

const SUPPLY_DEMAND_BY_ID: Record<string, SupplyDemandDetail> = {
  "element-li": supplyDemand(
    "価格乱高下",
    4,
    "電池需要は伸びる一方、新しい鉱山と精製設備も一気に増えている。",
    "電池に使える高純度品を安定して作る工程",
    "高",
  ),
  "element-c": supplyDemand(
    "不足側",
    5,
    "電池の負極向け需要が増え、加工能力が一部の国に集中している。",
    "黒鉛を丸く整え、高純度化して表面処理する工程",
    "高",
  ),
  "element-si": supplyDemand(
    "価格乱高下",
    3,
    "太陽電池向けは設備過剰だが、半導体向けの高純度品は供給元が限られる。",
    "高純度石英の確保と電力を多く使う精製",
    "中",
  ),
  "element-p": supplyDemand(
    "不足側",
    4,
    "肥料の大きな需要に電池向け需要が加わり、埋蔵地域も偏っている。",
    "鉱石産地の集中と高純度リン酸への精製",
    "高",
  ),
  "element-ti": supplyDemand(
    "おおむね均衡",
    3,
    "鉱石はあるが、航空や医療向けは需要に合わせて急に増産しにくい。",
    "品質認証を受けたスポンジチタンと溶解加工",
    "中",
  ),
  "element-mn": supplyDemand(
    "価格乱高下",
    3,
    "鉄鋼向けは安定しているが、電池向け高純度品の投資量が需要予測で揺れる。",
    "電池に使える硫酸マンガンへの高純度化",
    "中",
  ),
  "element-co": supplyDemand(
    "供給過剰側",
    5,
    "コンゴ民主共和国とインドネシアの増産で余り、産出国が輸出制限で調整している。",
    "少数国の政策と中国に集中する精製",
    "高",
  ),
  "element-ni": supplyDemand(
    "供給過剰側",
    5,
    "インドネシアの大幅な増産が、ステンレスと電池の需要増を上回っている。",
    "高純度品の品質と製造時の環境負荷",
    "高",
  ),
  "element-cu": supplyDemand(
    "不足側",
    4,
    "送配電網や電気自動車の需要増に対し、新しい鉱山の開発に長い時間がかかる。",
    "鉱山の許認可、水の確保、鉱石品位の低下",
    "高",
  ),
  "element-ga": supplyDemand(
    "不足側",
    5,
    "半導体需要は増えても、ほかの金属の副産物なのでガリウムだけを急増産できない。",
    "中国に集中する回収・高純度化と輸出管理",
    "高",
  ),
  "element-ge": supplyDemand(
    "不足側",
    5,
    "赤外線機器や光通信の需要が増え、副産物であるため増産もしにくい。",
    "中国に集中する精製と輸出管理",
    "高",
  ),
  "element-zr": supplyDemand(
    "おおむね均衡",
    3,
    "基礎需要は比較的安定しているが、原子力向け高純度品は供給切替が難しい。",
    "ハフニウムを取り除く高純度分離と品質認証",
    "中",
  ),
  "element-nb": supplyDemand(
    "おおむね均衡",
    4,
    "需要は安定しているが、供給の大半をブラジル一国に頼っている。",
    "供給国の極端な集中",
    "高",
  ),
  "element-nd": supplyDemand(
    "不足側",
    5,
    "電気自動車、風力発電、ロボット向け磁石の需要が増えている。",
    "レアアースの分離、金属化、磁石製造の集中",
    "高",
  ),
  "element-ta": supplyDemand(
    "価格乱高下",
    4,
    "市場が小さく、少数鉱山の停止や輸出政策でも供給量が大きく動く。",
    "小規模採掘の産地確認と製錬能力",
    "中",
  ),
  "element-w": supplyDemand(
    "不足側",
    4,
    "工具や半導体など代替しにくい用途が多く、採掘と加工が中国に集中している。",
    "中国に集中する鉱山と粉末加工",
    "高",
  ),
  "element-pt": supplyDemand(
    "価格乱高下",
    4,
    "自動車触媒の需要減と、水素関連の新需要が同時に進んでいる。",
    "南アフリカに集中する鉱山と副産物としての供給",
    "中",
  ),
  "element-hf": supplyDemand(
    "不足側",
    5,
    "先端半導体の需要が増えても、ジルコニウム精製の副産物なので単独増産できない。",
    "ジルコニウムとの分離と小規模な精製能力",
    "高",
  ),
  "mineral-spodumene": supplyDemand(
    "価格乱高下",
    4,
    "電池需要の伸びと鉱山の増産が交互に先行し、価格で開発計画が止まりやすい。",
    "精鉱から電池用リチウムへ変える精製",
    "高",
  ),
  "mineral-brine": supplyDemand(
    "価格乱高下",
    4,
    "低費用の供給源として期待される一方、立ち上げの遅れと回収率の差が大きい。",
    "水利用、回収率、地域合意",
    "中",
  ),
  "mineral-bauxite": supplyDemand(
    "おおむね均衡",
    3,
    "鉱石は比較的多いが、低炭素なアルミニウムを作れる電力と精製設備に差がある。",
    "アルミナ精製、安価で低炭素な電力、赤泥処理",
    "中",
  ),
  "mineral-graphite": supplyDemand(
    "不足側",
    5,
    "電池向け需要の増加に対し、高純度な負極材への加工が中国に集中している。",
    "球状化、高純度化、表面処理",
    "高",
  ),
  "mineral-quartz": supplyDemand(
    "不足側",
    4,
    "一般の石英は豊富でも、半導体用るつぼに使える高純度品は供給元が少ない。",
    "高純度鉱床、包有物の少なさ、品質認証",
    "高",
  ),
  "mineral-chalcopyrite": supplyDemand(
    "不足側",
    4,
    "銅需要の増加に対し、鉱山開発の長期化と鉱石品位の低下が続く。",
    "許認可、水、ヒ素などの不純物、製錬能力",
    "高",
  ),
  "mineral-nickel-laterite": supplyDemand(
    "供給過剰側",
    5,
    "インドネシアで鉱山と製錬設備が急増し、ニッケル全体の需要を上回っている。",
    "高純度化と廃液・二酸化炭素排出の管理",
    "高",
  ),
  "mineral-copper-cobalt": supplyDemand(
    "供給過剰側",
    4,
    "銅鉱山とインドネシアの増産で、コバルト供給が需要を上回っている。",
    "銅の採算と産出国の輸出政策に左右される副産物供給",
    "高",
  ),
  "mineral-monazite": supplyDemand(
    "不足側",
    4,
    "磁石向けレアアース需要が増える一方、放射性物質を含む残りかすの管理が難しい。",
    "元素ごとの分離と放射性残りかすの処理",
    "中",
  ),
  "mineral-bastnasite": supplyDemand(
    "不足側",
    5,
    "強力磁石に使うレアアースの需要が増え、鉱石から元素を分けて磁石にするまでの工場が一部の国に集中している。",
    "混ざった元素を一つずつ分け、金属にして磁石を作る工程",
    "高",
  ),
  "mineral-coltan": supplyDemand(
    "価格乱高下",
    4,
    "市場が小さく、紛争地域の小規模採掘や政策変更で供給が揺れやすい。",
    "産地追跡、責任ある調達、ニオブとタンタルの分離",
    "中",
  ),
  "mineral-zircon": supplyDemand(
    "おおむね均衡",
    3,
    "基礎需要は安定しているが、チタン鉱物の採掘量に連動する副産物である。",
    "原子力向けのジルコニウムとハフニウムの分離",
    "中",
  ),
  "mineral-ilmenite": supplyDemand(
    "おおむね均衡",
    3,
    "顔料向け需要は安定しているが、金属チタン向けは別の高純度工程が必要になる。",
    "鉱石品質、塩化法・硫酸法、スポンジチタン製造",
    "中",
  ),
  "mineral-fluorite": supplyDemand(
    "不足側",
    5,
    "半導体や電池向け高純度フッ素化学品の需要が増え、産地と精製が集中している。",
    "高純度フッ化水素への精製と環境規制への対応",
    "高",
  ),
  "mineral-phosphate-rock": supplyDemand(
    "不足側",
    4,
    "肥料の大きな需要に電池向け需要が加わり、埋蔵量もモロッコに偏っている。",
    "産地集中と食品・電池向け高純度リン酸の製造",
    "高",
  ),
  "mineral-magnesite": supplyDemand(
    "おおむね均衡",
    3,
    "耐火物の需要は安定し、低炭素建材や二酸化炭素固定の新需要はまだ小さい。",
    "中国に集中する焼成・加工と製造時の熱エネルギー",
    "中",
  ),
  "polymer-pe": supplyDemand(
    "供給過剰側",
    4,
    "大型の新工場が増える一方、包装規制で一部用途の伸びが鈍っている。",
    "種類ごとの需給差と、再生材の臭い・汚れの管理",
    "中",
  ),
  "polymer-pp": supplyDemand(
    "供給過剰側",
    4,
    "中国を中心に新しい生産設備が増え、汎用品の供給競争が激しい。",
    "高機能品の品質認証と再生材の安定品質",
    "中",
  ),
  "polymer-pvc": supplyDemand(
    "価格乱高下",
    3,
    "建設需要と電力価格の影響を受け、地域ごとに生産費用が大きく変わる。",
    "塩素製造に使う電力と添加剤の管理",
    "中",
  ),
  "polymer-pet": supplyDemand(
    "価格乱高下",
    4,
    "新品樹脂は設備過剰だが、食品に使える高品質な再生材は不足しやすい。",
    "使用済みボトルの回収・選別と食品向け再生設備",
    "高",
  ),
  "polymer-abs": supplyDemand(
    "価格乱高下",
    3,
    "家電需要の波と、3種類の石油由来原料の価格変動を受ける。",
    "原料価格と、廃家電から難燃剤を分ける工程",
    "中",
  ),
  "polymer-pa": supplyDemand(
    "不足側",
    4,
    "自動車の軽量化需要が続く一方、一部の中間原料の供給停止が全体へ波及しやすい。",
    "ポリアミド66用の中間原料と品質認証",
    "中",
  ),
  "polymer-pc": supplyDemand(
    "供給過剰側",
    3,
    "中国の生産能力は増えているが、光学・医療向け高機能品は別市場である。",
    "高機能品の品質認証と一貫生産設備",
    "中",
  ),
  "polymer-pom": supplyDemand(
    "おおむね均衡",
    2,
    "燃料系部品は減るが、ロボットや精密機構の需要が補っている。",
    "専用工場と長期の品質認証",
    "中",
  ),
  "polymer-pps": supplyDemand(
    "不足側",
    4,
    "電気自動車の高電圧部品向け需要が増え、品質認証済みの生産能力が限られる。",
    "高品質樹脂とガラス繊維複合材の品質認証",
    "高",
  ),
  "polymer-peek": supplyDemand(
    "不足側",
    5,
    "医療・航空・半導体で需要が増え、原料とメーカーが少数に限られる。",
    "特殊な原料分子、製造技術、長期の品質認証",
    "高",
  ),
  "polymer-ptfe": supplyDemand(
    "価格乱高下",
    5,
    "半導体などで代替が難しい一方、有機フッ素化合物の規制で供給条件が変わっている。",
    "蛍石から原料分子までの供給と、製造時の排出管理",
    "高",
  ),
  "polymer-epoxy": supplyDemand(
    "価格乱高下",
    3,
    "電子機器・風力・航空で需要が異なり、用途ごとの品質認証も必要になる。",
    "電子部品向け高純度品と硬化剤の供給",
    "中",
  ),
  "polymer-pu": supplyDemand(
    "おおむね均衡",
    3,
    "建物の断熱需要は強いが、大手メーカーの生産能力も大きい。",
    "イソシアネート原料と使用済み断熱材の回収",
    "中",
  ),
  "polymer-silicone": supplyDemand(
    "価格乱高下",
    4,
    "電気自動車・電子機器・医療向けの需要増と、電力費用の変化を同時に受ける。",
    "金属ケイ素から高純度シロキサンまでの一貫工程",
    "中",
  ),
  "polymer-pla": supplyDemand(
    "不足側",
    3,
    "包装規制で需要は伸びるが、生産設備と使用後の回収・堆肥化設備が追いつきにくい。",
    "乳酸の生産能力と、回収・工業用堆肥化の仕組み",
    "中",
  ),
  "polymer-pi": supplyDemand(
    "不足側",
    5,
    "人工知能向け半導体や電気自動車モーターで高純度品の需要が増えている。",
    "特殊な原料、熱で伸び縮みしにくい薄膜の製造、顧客が行う品質確認",
    "高",
  ),
};

function detail(
  value: Omit<MaterialDetail, "lastReviewed" | "sources" | "supplyDemand"> & {
    sources?: MaterialSource[];
  },
): MaterialDetail {
  const supplyDemandView = SUPPLY_DEMAND_BY_ID[value.id];
  if (!supplyDemandView) throw new Error(`需給評価が未登録です: ${value.id}`);
  return {
    ...value,
    supplyDemand: supplyDemandView,
    sources: value.sources ?? criticalSources,
    lastReviewed: "2026-07-16",
  };
}

const elementDetails: Record<string, MaterialDetail> = {
  Li: detail({"id":"element-li","family":"element","name":"リチウム","code":"Li","category":"アルカリ金属","summary":"軽量・高電位を生かして蓄電池を支える。資源量より、電池品質への精製能力と価格循環を見る材料。","properties":["最も軽い金属","反応性が高い","電池で高い電圧を生みやすい"],"uses":["車載・定置用蓄電池","耐熱ガラス","グリース・医薬"],"supplyCountries":["1 豪州","2 中国","3 チリ","4 ジンバブエ","5 アルゼンチン"],"reserves":"世界埋蔵量約3,700万t（リチウム含有量、米国地質調査所（USGS） 2026）。かん水と鉱石を合算した資源統計値。","balance":"2025年は生産能力増で短期余剰懸念が残る一方、電気自動車・定置蓄電の需要は強い。価格と新規計画の延期を同時に追う。","circularity":"電池回収とリチウム再資源化は拡大中。回収網・ニッケル・コバルトとの同時回収採算が鍵。","chain":["塩湖かん水・スポジュメン","炭酸リチウム・水酸化リチウム","リン酸鉄リチウム電池・ニッケル・マンガン・コバルト系電池・電解質","蓄電池"],"amdFitNote":"電池材料、資源循環、地方の未利用資源・地熱かん水の事業仮説と接続しやすい。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"需要成長と供給投資の振れ幅が大きい","demand":"電気自動車・定置蓄電が牽引","supplyRisk":"精製と電池品質化の地域集中","amdFit":"蓄電・循環・高度な科学技術の横断テーマ"}}),
  C: detail({"id":"element-c","family":"element","name":"炭素","code":"C","category":"非金属","summary":"黒鉛、炭素繊維、活性炭、ダイヤモンドまで構造で機能が激変する基盤元素。","properties":["原子の並び方で性質が大きく変わる","軽量","電気を通す、物質を吸着する、強くするなどの性質を設計できる"],"uses":["リチウムイオン電池の負極","複合材","吸着・触媒担体","電極"],"supplyCountries":["天然黒鉛: 中国","天然黒鉛: マダガスカル","天然黒鉛: タンザニア"],"reserves":"天然黒鉛の世界埋蔵量約3.1億t（米国地質調査所（USGS） 2026）。炭素全体の埋蔵量ではない。","balance":"電池品質球状黒鉛は採掘量より精製・球状化・被覆の集中がボトルネック。","circularity":"複合材は難しいが、電池黒鉛の再生・バイオ炭・CO2由来炭素は新市場。","chain":["天然黒鉛・石油系原料・バイオマス","精製・炭化・黒鉛化","負極材・炭素繊維・活性炭","電池・モビリティ・環境"],"amdFitNote":"炭素材料、吸着、藻類・バイオマス炭化、複合材のプロジェクト群へ広く効く。","scores":{"heat":5,"demand":5,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"電池と脱炭素の両方にまたがる","demand":"負極・軽量化・吸着用途","supplyRisk":"電池品質加工が集中","amdFit":"AMDの環境・材料テーマと接点が多い"}}),
  Si: detail({"id":"element-si","family":"element","name":"ケイ素","code":"Si","category":"金属と非金属の中間","summary":"砂・石英から半導体、太陽電池、炭化ケイ素半導体、シリコーンへ枝分かれする巨大材料チェーン。","properties":["半導体特性","酸化物が安定","純度で用途が変わる"],"uses":["半導体","太陽電池","電力変換用の炭化ケイ素半導体","シリコーン"],"supplyCountries":["金属ケイ素: 中国","ブラジル","ノルウェー"],"reserves":"地殻中に豊富で、資源統計としての埋蔵量不足より高純度石英・精製電力・製造能力が制約。","balance":"汎用品と半導体品質を分けて見る。太陽電池は設備過剰局面でも高純度原料と先端用途は別市場。","circularity":"太陽光パネル・半導体汚泥・シリコーンの回収技術が未成熟。","chain":["石英・高純度シリカ","金属ケイ素・ポリケイ素","ウエハー・炭化ケイ素（SiC）・シリコーン","半導体・太陽電池・医療"],"amdFitNote":"半導体だけでなく、センサー、耐熱部材、医療・環境材料まで案件を束ねられる。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"複数の成長市場を同じ原料が支える","demand":"電力半導体・太陽光発電・電子部材","supplyRisk":"高純度工程と製造能力が集中","amdFit":"高度な科学技術の共通基盤"}}),
  P: detail({"id":"element-p","family":"element","name":"リン","code":"P","category":"非金属","summary":"食料を支える不可欠元素で、リン酸鉄リチウム電池・難燃材・電子材料にも広がる。","properties":["生体必須","反応性が高い","回収しなければ散逸しやすい"],"uses":["肥料","リン酸鉄リチウム電池の正極","難燃剤","化学品"],"supplyCountries":["リン鉱石: 中国","モロッコ","米国","ロシア"],"reserves":"リン鉱石の世界埋蔵量約730億t（販売できる品質のリン鉱石、米国地質調査所（USGS） 2026）。モロッコが約500億t。","balance":"総量より産地集中と肥料価格、リン酸鉄リチウム電池拡大、下水・食品系からの回収が焦点。","circularity":"下水汚泥・焼却灰・畜産排水からのリン回収は循環経済の有力テーマ。","chain":["リン鉱石・排水・汚泥","リン酸・回収リン","肥料・リン酸鉄リチウム電池・難燃剤","農業・電池・環境"],"amdFitNote":"排水処理、資源回収、農業、電池材料を一つの循環供給の流れで扱える。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"食料安全保障とリン酸鉄リチウム電池の交点","demand":"肥料の基礎需要＋電池","supplyRisk":"高い産地集中","amdFit":"排水・循環プロジェクトとの相性が強い"}}),
  Ti: detail({"id":"element-ti","family":"element","name":"チタン","code":"Ti","category":"鉄や銅の仲間（遷移金属）","summary":"軽量・耐食・生体適合性に優れ、航空宇宙から医療、酸化物光触媒まで用途が広い。","properties":["高比強度","耐食性","生体適合性"],"uses":["航空宇宙","医療用インプラント","酸化チタン顔料","光触媒"],"supplyCountries":["鉱物精鉱: 中国","モザンビーク","南アフリカ","豪州"],"reserves":"米国地質調査所（USGS）はイルメナイト・ルチル等のチタン鉱物で集計。金属チタンと酸化チタン（TiO₂）顔料は別の供給の流れ。","balance":"鉱石量よりスポンジチタン・溶解加工の認証と設備が参入障壁。","circularity":"航空品質製造くず・使用済み材は価値が高いが、酸素汚染と合金混合の管理が必要。","chain":["イルメナイト・ルチル","酸化チタン（TiO₂）・スポンジチタン","合金・光触媒","航空・医療・環境"],"amdFitNote":"医工連携、表面処理、光触媒、耐食設備のテーマに展開しやすい。","scores":{"heat":4,"demand":4,"supplyRisk":3,"amdFit":5},"scoreReasons":{"heat":"航空・医療・環境で安定した技術余地","demand":"航空回復と医療用途","supplyRisk":"加工・認証が制約","amdFit":"大学発技術との接点が多い"}}),
  Mn: detail({"id":"element-mn","family":"element","name":"マンガン","code":"Mn","category":"鉄や銅の仲間（遷移金属）","summary":"鉄鋼の基礎元素であり、電池品質硫酸マンガンでは別の高純度市場が立つ。","properties":["脱酸・合金化","反応相手によって電気的な状態が変わる","比較的低コスト"],"uses":["鉄鋼","リチウムイオン電池の正極","化学品"],"supplyCountries":["南アフリカ","ガボン","豪州","ガーナ"],"reserves":"米国地質調査所（USGS）のマンガン資源統計を参照。電池品質原料は鉱石埋蔵量と別に精製能力を見る。","balance":"鉄鋼向けは巨大、電池向けは小さいが高純度化投資が焦点。","circularity":"使用済み電池を砕いた黒い粉から回収可能だが、リチウム・ニッケル・コバルトに比べ経済価値が低く工程設計が必要。","chain":["マンガン鉱石","フェロマンガン・高純度硫酸マンガン","鉄鋼・正極材","建設・モビリティ"],"amdFitNote":"低コバルト正極、資源回収、安価な触媒・酸化物材料の探索に向く。","scores":{"heat":4,"demand":4,"supplyRisk":4,"amdFit":4},"scoreReasons":{"heat":"電池品質化で市場構造が変わる","demand":"鉄鋼＋新正極","supplyRisk":"鉱石と高純度精製の集中","amdFit":"電池・触媒テーマに接続"}}),
  Co: detail({"id":"element-co","family":"element","name":"コバルト","code":"Co","category":"鉄や銅の仲間（遷移金属）","summary":"高性能電池・超合金に不可欠だが、採掘と精製が集中する代表的な供給不安材料。","properties":["高温強度","磁性","電池正極の安定化"],"uses":["高性能蓄電池の正極","超合金","硬質工具","触媒"],"supplyCountries":["1 コンゴ民主共和国 73%","2 インドネシア 14%","3 ロシア","4 豪州"],"reserves":"世界埋蔵量約1,200万t（コバルト含有量、米国地質調査所（USGS） 2026）。","balance":"2025年は供給過剰と低価格を背景にコンゴ民主共和国が輸出規制へ移行。供給量と政策不安が同時に振れる。","circularity":"電池・超合金製造くず・使用済み材は高価値。リン酸鉄リチウム電池化で新規需要構成が変わる。","chain":["銅コバルト鉱・ニッケルラテライト鉱（ニッケル酸化鉱）","コバルト水酸化物・金属","正極材・超合金","電池・航空"],"amdFitNote":"供給不安、電池再利用、コバルトを使わない材料の比較軸として重要。","scores":{"heat":5,"demand":4,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"政策・価格・技術代替が激しく動く","demand":"電池と超合金","supplyRisk":"コンゴ民主共和国採掘と中国精製へ集中","amdFit":"代替・循環の研究テーマが明確"}}),
  Ni: detail({"id":"element-ni","family":"element","name":"ニッケル","code":"Ni","category":"鉄や銅の仲間（遷移金属）","summary":"ステンレスの主力材料。電池向けの高純度ニッケルと、大量に作られるラテライト鉱（ニッケル酸化鉱）由来のニッケルは、品質と用途を分けて見る必要がある。","properties":["さびにくい","高温でも強い","電池の容量を増やせる"],"uses":["ステンレス","高性能蓄電池の正極","航空機用の耐熱合金","めっき"],"supplyCountries":["1 インドネシア","2 フィリピン","3 ロシア","4 カナダ"],"reserves":"世界埋蔵量 1.4億t超（ニッケル含有量、米国地質調査所（USGS） 2026）。","balance":"2022年以降は一次ニッケル市場が供給超過。大量供給と電池向け品質、環境負荷を切り分ける。","circularity":"ステンレスの製造くず・使用済み材の再利用が進んでいる。電池からのニッケル回収も採算を取りやすい。","chain":["ラテライト鉱（ニッケル酸化鉱）・硫化物鉱石","ニッケル銑鉄・製錬途中の中間品（マット）・高純度ニッケル","ステンレス・電池の正極材","建設・電池・航空"],"amdFitNote":"高圧で鉱石を薬液処理する製錬、二酸化炭素を減らす精製、電池の再利用技術を比べるのに向く。","scores":{"heat":4,"demand":4,"supplyRisk":4,"amdFit":4},"scoreReasons":{"heat":"供給過剰でも品質と二酸化炭素排出量が論点","demand":"ステンレスと電池","supplyRisk":"インドネシアへの供給集中","amdFit":"製錬・再利用・電池を比べられる"}}),
  Cu: detail({"id":"element-cu","family":"element","name":"銅","code":"Cu","category":"鉄や銅の仲間（遷移金属）","summary":"送配電・モーター・電子機器の共通基盤。鉱山の品位低下と許認可の長さが供給拡大を鈍らせる。","properties":["高導電性","高熱伝導","延性・加工性"],"uses":["送配電","モーター","電子部品","配管"],"supplyCountries":["1 チリ","2 コンゴ民主共和国","3 ペルー","4 中国"],"reserves":"世界埋蔵量約9.8億t（銅含有量、米国地質調査所（USGS） 2026）。","balance":"電化需要が強い一方、新規鉱山の供給開始までの期間が長い。製造くず・使用済み材供給とアルミニウム代替も需給を左右する。","circularity":"品質を保ちやすく高い再資源価値。回収網と不純物管理が鍵。","chain":["黄銅鉱など","精鉱・粗銅・電気銅","電線・薄い金属箔・合金","電力・電気自動車・電子"],"amdFitNote":"電化・熱管理・資源循環のほぼ全プロジェクトに基準材料として効く。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"電化の共通制約","demand":"送配電網・電気自動車・データセンター","supplyRisk":"鉱山開発の長期化","amdFit":"用途横断の比較基準"}}),
  Ga: detail({"id":"element-ga","family":"element","name":"ガリウム","code":"Ga","category":"アルミニウムなどの金属","summary":"窒化ガリウムやヒ化ガリウムとして、電力変換、高周波通信、発光ダイオードを支える副産物型の重要材料。","properties":["低融点","化合物半導体","アルミニウム・亜鉛製錬の副産物"],"uses":["電力を高効率に変換する窒化ガリウム半導体","通信・レーダー用の高周波半導体","発光ダイオード","太陽電池"],"supplyCountries":["一次生産: 中国が圧倒的","日本","ロシア"],"reserves":"独立鉱床でなくボーキサイト・亜鉛鉱の副産物。埋蔵量より回収率と精製能力で見る。","balance":"需要増に対し副産物供給は価格だけで増えにくく、輸出管理不安が大きい。","circularity":"製造工程のくず回収は可能。製品中の微量ガリウム回収は難しい。","chain":["ボーキサイト・亜鉛鉱石","粗ガリウム・高純度ガリウム","窒化ガリウム・ヒ化ガリウムウエハー","電力・通信・光"],"amdFitNote":"半導体、光、量子・センサー系の研究の種評価に不可欠。","scores":{"heat":5,"demand":5,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"電力半導体と輸出管理","demand":"窒化ガリウム・高周波通信・発光ダイオード","supplyRisk":"副産物＋精製集中","amdFit":"先端機器の共通材料"}}),
  Ge: detail({"id":"element-ge","family":"element","name":"ゲルマニウム","code":"Ge","category":"金属と非金属の中間","summary":"赤外光学・光繊維・宇宙用太陽電池を支える、亜鉛製錬等の副産物。","properties":["赤外透過","高屈折率","半導体特性"],"uses":["赤外光学","光ファイバー","宇宙用太陽電池","触媒"],"supplyCountries":["中国","ベルギー","カナダ"],"reserves":"副産物のため独立した世界埋蔵量の定量が難しい。亜鉛鉱・石炭灰等の回収可能量を見る。","balance":"防衛・通信需要と輸出管理で供給不安が高い。","circularity":"光学加工製造くず・使用済み材・触媒から回収可能。製品回収は用途別。","chain":["亜鉛精鉱・石炭灰","二酸化ゲルマニウム（GeO₂）・高純度ゲルマニウム","レンズ・繊維・セル","通信・宇宙・防衛"],"amdFitNote":"光学、センサー、宇宙・半導体研究の供給不安評価に使える。","scores":{"heat":5,"demand":4,"supplyRisk":5,"amdFit":4},"scoreReasons":{"heat":"地政学と光・宇宙用途","demand":"赤外・繊維・太陽光発電","supplyRisk":"副産物と精製集中","amdFit":"先端光学研究の種に有効"}}),
  Zr: detail({"id":"element-zr","family":"element","name":"ジルコニウム","code":"Zr","category":"鉄や銅の仲間（遷移金属）","summary":"耐食・耐熱・低中性子吸収を生かし、原子力、耐火物、セラミックス、医療で使う。","properties":["耐食性","高融点","低中性子吸収"],"uses":["原子炉被覆管","耐火物","ジルコニアセラミックス","歯科"],"supplyCountries":["鉱物精鉱: 豪州","南アフリカ","モザンビーク","中国"],"reserves":"世界埋蔵量 7,000万t超（酸化ジルコニウム（ZrO₂）含有量、米国地質調査所（USGS） 2026）。","balance":"ジルコン砂はチタン鉱物と共産。高純度金属・原子力品質で追加障壁。","circularity":"耐火物・鋳造砂再利用、金属製造くず・使用済み材回収。用途別の分離が必要。","chain":["ジルコン・バデレアイト","酸化ジルコニウム（ZrO₂）・スポンジ状のジルコニウム","セラミックス・合金","原子力・医療・耐火"],"amdFitNote":"セラミックス、医療、耐熱・耐食工程材料の研究評価に強い。","scores":{"heat":4,"demand":3,"supplyRisk":4,"amdFit":4},"scoreReasons":{"heat":"原子力回帰と高機能セラミックス","demand":"耐火・原子力・医療","supplyRisk":"鉱物を含む砂供給と高純度化","amdFit":"大学材料研究の種と相性"}}),
  Nb: detail({"id":"element-nb","family":"element","name":"ニオブ","code":"Nb","category":"鉄や銅の仲間（遷移金属）","summary":"少量添加で鋼を高強度化し、超伝導磁石にも使う。供給がブラジルへ極端に集中。","properties":["鋼の結晶微細化","超伝導","高温耐性"],"uses":["高張力鋼","超伝導磁石","超合金"],"supplyCountries":["1 ブラジル","2 カナダ","3 コンゴ民主共和国"],"reserves":"世界埋蔵量 2,100万t超（ニオブ含有量、米国地質調査所（USGS） 2026）。","balance":"需要は安定だが供給元が少ない。少量添加ゆえ価格転嫁は可能でも、代替すると性能が変わる。","circularity":"鋼製造くず・使用済み材に希釈され個別回収しにくい。超合金・磁石製造くず・使用済み材は回収余地。","chain":["パイロクロア・コルンブ石","フェロニオブ・ニオブ金属","高張力鋼・超伝導線","社会基盤・医療・研究"],"amdFitNote":"核融合・磁気共鳴画像装置（MRI）・高強度構造材など大型研究設備の評価軸。","scores":{"heat":4,"demand":4,"supplyRisk":5,"amdFit":4},"scoreReasons":{"heat":"社会基盤と超伝導の二面性","demand":"高張力鋼が基礎","supplyRisk":"ブラジル集中","amdFit":"大型研究設備との接点"}}),
  Nd: detail({"id":"element-nd","family":"element","name":"ネオジム","code":"Nd","category":"レアアースの仲間","summary":"ネオジム・鉄・ホウ素永久磁石の主成分。電気自動車のモーター、風力、ロボットで需要が伸びる一方、分離・磁石製造が集中。","properties":["強力な永久磁石","酸化しやすい","レアアース（希土類）分離が必要"],"uses":["電気自動車用モーター","風力発電","ロボットの駆動部","音響"],"supplyCountries":["鉱山・分離: 中国","米国","豪州","ミャンマー"],"reserves":"レアアース（希土類）全体で7,500万t超（レアアース酸化物換算、米国地質調査所（USGS） 2026）。ネオジム単独の埋蔵量ではない。","balance":"鉱石より分離・金属化・磁石製造の集中が不安。ジスプロシウム・テルビウム使用量低減も同時に見る。","circularity":"モーター・ハードディスク磁石の材料の性質を保ったまま再利用する方法と再合金化が有望。","chain":["バストネサイト・モナザイト","分離した酸化ネオジム","ネオジム・鉄・ホウ素磁石","電気自動車・風力・ロボット"],"amdFitNote":"移動機器、ロボット、エネルギー機器の供給の流れ分析に不可欠。","scores":{"heat":5,"demand":5,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"電動化の核心かつ高集中","demand":"モーター・風力","supplyRisk":"分離と磁石製造が集中","amdFit":"ロボット・エネルギー研究と直結"}}),
  Hf: detail({"id":"element-hf","family":"element","name":"ハフニウム","code":"Hf","category":"鉄や銅の仲間（遷移金属）","summary":"ジルコニウム精製の副産物。先端半導体の高い絶縁性能膜、超合金、原子炉制御に使う小規模戦略材料。","properties":["中性子を吸収しやすい","高融点","酸化ハフニウムは、薄い膜でも電気を通しにくい"],"uses":["半導体の絶縁膜","超合金","原子炉制御棒","プラズマ電極"],"supplyCountries":["ジルコニウム精製に連動","フランス","中国","ドイツ"],"reserves":"定量的な世界埋蔵量は非公表。ジルコン・バデレアイト中にジルコニウムと共存（米国地質調査所（USGS） 2026）。","balance":"ジルコニウム需要に供給が連動し、ハフニウム価格だけで増産しにくい典型的な副産物不安。","circularity":"高価だが用途中濃度が低く、超合金製造くず・使用済み材など限定回収経路が中心。","chain":["ジルコン","ジルコニウム・ハフニウム分離","ハフニウム金属・酸化ハフニウム（HfO₂）","半導体・航空・原子力"],"amdFitNote":"先端半導体・高温材料の『少量だが止まる』不安を可視化できる。","scores":{"heat":5,"demand":4,"supplyRisk":5,"amdFit":4},"scoreReasons":{"heat":"先端半導体と副産物制約","demand":"高い絶縁性能・超合金","supplyRisk":"ジルコニウム連動の小規模供給","amdFit":"半導体・高温研究の種に有効"}}),
  Ta: detail({"id":"element-ta","family":"element","name":"タンタル","code":"Ta","category":"鉄や銅の仲間（遷移金属）","summary":"小型コンデンサーと耐食・高温部材に強い。紛争鉱物管理と副産物供給が重要。","properties":["高容量コンデンサー","耐食性","高融点"],"uses":["小型電子機器用コンデンサー","超合金","医療用インプラント","硬質工具"],"supplyCountries":["1 コンゴ民主共和国","2 ルワンダ","3 ブラジル","4 豪州"],"reserves":"世界埋蔵量はデータなし。確認済み資源は豪州・ブラジル・カナダ・中国に多い（米国地質調査所（USGS） 2026）。","balance":"小規模市場で計画停止の影響が大きい。産地を追跡できる仕組みと再生材比率を見る。","circularity":"製造くずと使用済み超合金から回収。小型電子部品からの回収は難しい。","chain":["コルタン・タンタライト","五酸化タンタル（タンタル₂O₅）・粉末","コンデンサー・合金","電子・航空・医療"],"amdFitNote":"電子機器と医療材料の高機能化、責任ある調達の事業設計に使える。","scores":{"heat":4,"demand":4,"supplyRisk":5,"amdFit":4},"scoreReasons":{"heat":"小型高機能＋責任調達","demand":"電子機器・航空","supplyRisk":"小規模・副産物・紛争地域","amdFit":"医療・機器テーマ"}}),
  W: detail({"id":"element-w","family":"element","name":"タングステン","code":"W","category":"鉄や銅の仲間（遷移金属）","summary":"最高水準の融点・硬度・密度を持ち、切削、半導体、核融合、防衛で代替が難しい。","properties":["極めて高い融点","高密度","炭化物が高硬度"],"uses":["超硬工具","半導体配線","高温部材","放射線遮蔽"],"supplyCountries":["1 中国","2 カザフスタン","3 ベトナム","4 ロシア"],"reserves":"世界埋蔵量 470万t超（タングステン含有量、米国地質調査所（USGS） 2026）。","balance":"中国の採掘・加工比率が高く、工具需要と戦略用途で供給不安が続く。","circularity":"超硬工具の回収・亜鉛工程等が実用。回収の仕組みが競争力。","chain":["鉄マンガン重石・灰重石","タングステン精製の中間原料・炭化タングステン（WC）粉末","超硬工具・合金","製造・半導体・エネルギー"],"amdFitNote":"製造工程、核融合、高温材料、再利用事業の評価に強い。","scores":{"heat":5,"demand":4,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"高温・製造・防衛で代替困難","demand":"工具・半導体・エネルギー","supplyRisk":"中国集中","amdFit":"工程・エネルギー研究と直結"}}),
  Pt: detail({"id":"element-pt","family":"element","name":"白金","code":"Pt","category":"鉄や銅の仲間（遷移金属）","summary":"触媒・燃料電池・水電解・医療で使う高価な白金族金属。南アフリカの鉱山と再利用が供給を左右する。","properties":["高い触媒活性","耐食性","高温安定"],"uses":["自動車触媒","燃料電池・水電解","化学触媒","医療"],"supplyCountries":["1 南アフリカ","2 ロシア","3 ジンバブエ","4 カナダ"],"reserves":"白金族金属合計の世界埋蔵量 7.6万t超（米国地質調査所（USGS） 2026）。白金単独ではなく白金族金属合算。","balance":"内燃機関触媒の変化と水素用途が相殺。副産物構造とPd・Rh代替を併記する。","circularity":"自動車触媒からの回収が成熟。燃料電池・電解槽は今後の循環設計が重要。","chain":["白金族金属鉱石","白金精鉱・金属","触媒・膜と電極を一体化した部品","自動車・水素・化学"],"amdFitNote":"水素、触媒、医療の研究の種をコスト・回収込みで見る基準。","scores":{"heat":4,"demand":4,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"水素期待と自動車転換の綱引き","demand":"触媒＋水素","supplyRisk":"南アフリカ集中","amdFit":"触媒・エネルギー・医療に広い"}}),
};

const MARKET_PERIODS = ["2021", "2022", "2023", "2024", "2025"] as const;

function usgsMarket(
  slug: string,
  benchmark: string,
  unit: string,
  values: number[],
  note: string,
  supplyBasis: string,
  supplyShares: SupplyShare[],
): ElementMarketData {
  return {
    benchmark,
    unit,
    series: MARKET_PERIODS.map((period, index) => ({
      period,
      value: values[index],
    })),
    note,
    supplyBasis,
    supplyShares,
    source: {
      label: "米国地質調査所（USGS）鉱物資源概要 2026",
      href: `https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-${slug}.pdf`,
      asOf: "2025年平均・推計（2026年2月公表）",
    },
  };
}

export const ELEMENT_MARKETS: Record<string, ElementMarketData> = {
  Li: usgsMarket(
    "lithium",
    "電池級炭酸リチウム",
    "米ドル / t",
    [11700, 63700, 39000, 11800, 9000],
    "固定契約を含む米国年間平均。スポット価格とは一致しない。",
    "2025年 世界鉱山生産（Li含有量）",
    [
      { country: "豪州", share: 31.7 },
      { country: "中国", share: 21.4 },
      { country: "チリ", share: 19.3 },
      { country: "ジンバブエ", share: 9.7 },
      { country: "アルゼンチン", share: 7.9 },
      { country: "その他", share: 10.0 },
    ],
  ),
  C: usgsMarket(
    "graphite",
    "天然黒鉛フレーク",
    "米ドル / t",
    [1330, 1200, 1080, 1050, 1000],
    "輸入単価の平均。電池用球状黒鉛や人造黒鉛とは別市場。",
    "2025年 世界天然黒鉛生産",
    [
      { country: "中国", share: 77.8 },
      { country: "マダガスカル", share: 4.4 },
      { country: "タンザニア", share: 4.2 },
      { country: "ブラジル", share: 3.6 },
      { country: "モザンビーク", share: 3.3 },
      { country: "その他", share: 6.7 },
    ],
  ),
  Si: usgsMarket(
    "silicon",
    "金属シリコン",
    "米セント / ポンド",
    [220.31, 361.86, 179.69, 170.34, 130],
    "米国輸入価格の月次平均を年平均化。半導体級・太陽電池級ポリシリコンとは別市場。",
    "2025年 世界金属シリコン生産",
    [
      { country: "中国", share: 87.0 },
      { country: "ブラジル", share: 3.9 },
      { country: "ノルウェー", share: 2.8 },
      { country: "フランス", share: 1.5 },
      { country: "豪州", share: 1.0 },
      { country: "その他", share: 3.8 },
    ],
  ),
  P: usgsMarket(
    "phosphate",
    "リン鉱石",
    "米ドル / t",
    [83, 99, 101, 96, 100],
    "米国鉱山渡しの全品位加重平均。精製リンや肥料価格とは異なる。",
    "2025年 世界リン鉱石生産",
    [
      { country: "中国", share: 44.0 },
      { country: "モロッコ", share: 14.4 },
      { country: "米国", share: 8.0 },
      { country: "ロシア", share: 5.6 },
      { country: "ヨルダン", share: 4.8 },
      { country: "その他", share: 23.2 },
    ],
  ),
  Ti: usgsMarket(
    "titanium",
    "チタンスポンジ",
    "米ドル / kg",
    [11.1, 11.1, 12.3, 13.3, 12],
    "米国輸入の関税込み単価。酸化チタン顔料とは別市場。",
    "2025年 世界チタンスポンジ生産",
    [
      { country: "中国", share: 70.3 },
      { country: "日本", share: 14.3 },
      { country: "ロシア", share: 6.8 },
      { country: "カザフスタン", share: 4.3 },
      { country: "サウジアラビア", share: 3.2 },
      { country: "その他", share: 1.1 },
    ],
  ),
  Mn: usgsMarket(
    "manganese",
    "マンガン鉱石（44%品位）",
    "米ドル / 鉱石1トン・含有量1%分",
    [5.27, 5.97, 4.8, 5.53, 4.5],
    "中国着の金属含有量単価。電池級硫酸マンガンとは別市場。",
    "2025年 世界鉱山生産（Mn含有量）",
    [
      { country: "南アフリカ", share: 38.0 },
      { country: "ガボン", share: 25.0 },
      { country: "ガーナ", share: 10.0 },
      { country: "豪州", share: 8.0 },
      { country: "ブラジル", share: 4.0 },
      { country: "その他", share: 15.0 },
    ],
  ),
  Co: usgsMarket(
    "cobalt",
    "コバルト地金",
    "米ドル / ポンド",
    [24.21, 30.78, 17.2, 16.77, 21],
    "米国の市場でその場で売買するコバルト地金の価格。水酸化物や硫酸塩とは別市場。",
    "2025年 世界鉱山生産",
    [
      { country: "コンゴ民主共和国", share: 73.0 },
      { country: "インドネシア", share: 14.0 },
      { country: "その他", share: 13.0 },
    ],
  ),
  Ni: usgsMarket(
    "nickel",
    "ロンドン金属取引所（LME）ニッケル現金価格",
    "米ドル / t",
    [18476, 25815, 21495, 16812, 15000],
    "一次ニッケルの年間平均。電池級中間品やフェロニッケルとは異なる。",
    "2025年 世界鉱山生産",
    [
      { country: "インドネシア", share: 66.7 },
      { country: "フィリピン", share: 6.9 },
      { country: "ロシア", share: 5.1 },
      { country: "カナダ", share: 3.6 },
      { country: "ニューカレドニア", share: 3.6 },
      { country: "その他", share: 14.1 },
    ],
  ),
  Cu: usgsMarket(
    "copper",
    "電気銅",
    "米セント / ポンド",
    [432.3, 410.8, 395.3, 431.8, 490],
    "米国の先物市場価格に上乗せ分を加えた年間平均。",
    "2025年 世界鉱山生産",
    [
      { country: "チリ", share: 23.0 },
      { country: "コンゴ民主共和国", share: 13.9 },
      { country: "ペルー", share: 11.7 },
      { country: "中国", share: 7.8 },
      { country: "ロシア", share: 5.7 },
      { country: "その他", share: 37.9 },
    ],
  ),
  Ga: usgsMarket(
    "gallium",
    "ガリウム地金",
    "米ドル / kg",
    [277, 432, 365, 439, 580],
    "米国輸入の平均通関単価。高純度品・化合物半導体ウエハーとは別市場。",
    "2025年 世界低純度一次生産",
    [
      { country: "中国", share: 99.0 },
      { country: "ロシア", share: 0.7 },
      { country: "日本", share: 0.3 },
    ],
  ),
  Ge: usgsMarket(
    "germanium",
    "高純度ゲルマニウム地金",
    "米ドル / kg",
    [1187, 1294, 1392, 1991, 4100],
    "欧州の純度99.999%以上の年間平均。世界生産量が非公表のため供給元は米国輸入構成。",
    "2021–24年 米国輸入供給元（地金・二酸化物合計）",
    [
      { country: "ベルギー", share: 41 },
      { country: "中国", share: 23 },
      { country: "カナダ", share: 17 },
      { country: "ドイツ", share: 14 },
      { country: "その他", share: 5 },
    ],
  ),
  Zr: usgsMarket(
    "zirconium-hafnium",
    "プレミアムジルコン",
    "米ドル / t",
    [1530, 2300, 2160, 2000, 1800],
    "中国着のジルコン価格。原子力級ジルコニウム金属とは別市場。",
    "2025年 世界ジルコン精鉱生産",
    [
      { country: "豪州", share: 33.3 },
      { country: "南アフリカ", share: 22.5 },
      { country: "モザンビーク", share: 13.3 },
      { country: "米国", share: 8.3 },
      { country: "中国", share: 8.3 },
      { country: "その他", share: 14.3 },
    ],
  ),
  Nb: usgsMarket(
    "niobium",
    "フェロニオブ",
    "米ドル / kg",
    [21, 25, 25, 26, 26],
    "米国貿易の加重平均単価。純ニオブ金属や超伝導線材とは別市場。",
    "2025年 世界鉱山生産",
    [
      { country: "ブラジル", share: 92.9 },
      { country: "カナダ", share: 5.4 },
      { country: "コンゴ民主共和国", share: 0.9 },
      { country: "その他", share: 0.8 },
    ],
  ),
  Nd: usgsMarket(
    "rare-earths",
    "酸化ネオジム",
    "米ドル / kg",
    [98, 134, 78, 56, 73],
    "純度99.5%以上の年間平均。産出国構成はネオジム単独ではなくレアアース鉱山生産の代替指標。",
    "2025年 世界レアアース鉱山生産（酸化物換算）",
    [
      { country: "中国", share: 69.2 },
      { country: "米国", share: 13.1 },
      { country: "豪州", share: 7.4 },
      { country: "ミャンマー", share: 5.6 },
      { country: "その他", share: 4.7 },
    ],
  ),
  Ta: usgsMarket(
    "tantalum",
    "タンタライト鉱石",
    "米ドル / 酸化タンタル1kg",
    [158, 196, 170, 167, 180],
    "鉱石中の酸化タンタル含有量あたりの年間平均。地金・コンデンサー粉末とは別市場。",
    "2025年 世界鉱山生産",
    [
      { country: "コンゴ民主共和国", share: 52.0 },
      { country: "ルワンダ", share: 16.0 },
      { country: "ナイジェリア", share: 15.6 },
      { country: "ブラジル", share: 7.6 },
      { country: "中国", share: 3.2 },
      { country: "その他", share: 5.6 },
    ],
  ),
  W: usgsMarket(
    "tungsten",
    "タングステン精鉱",
    "米ドル / 鉱石1トン・酸化物1%分",
    [225, 275, 258, 252, 380],
    "ロッテルダムの倉庫で引き渡す価格。単位は、乾燥鉱石1トンに酸化タングステンが1%含まれる量。",
    "2025年 世界鉱山生産",
    [
      { country: "中国", share: 78.8 },
      { country: "ベトナム", share: 3.5 },
      { country: "カザフスタン", share: 2.8 },
      { country: "ロシア", share: 2.4 },
      { country: "北朝鮮", share: 2.4 },
      { country: "その他", share: 10.1 },
    ],
  ),
  Pt: usgsMarket(
    "platinum-group",
    "白金",
    "米ドル / トロイオンス",
    [1094.31, 966.54, 973, 960.7, 1200],
    "年間平均の白金地金価格。触媒向け契約価格とは一致しない。",
    "2025年 世界鉱山生産",
    [
      { country: "南アフリカ", share: 70.6 },
      { country: "ロシア", share: 11.8 },
      { country: "ジンバブエ", share: 10.6 },
      { country: "カナダ", share: 2.9 },
      { country: "米国", share: 1.1 },
      { country: "その他", share: 3.0 },
    ],
  ),
  Hf: usgsMarket(
    "zirconium-hafnium",
    "ハフニウム地金",
    "米ドル / kg",
    [781, 1590, 6130, 4560, 3800],
    "未加工ハフニウムの年間平均。世界生産量が非公表のため供給元は米国輸入構成。",
    "2021–24年 米国輸入供給元（未加工品）",
    [
      { country: "ドイツ", share: 54 },
      { country: "中国", share: 21 },
      { country: "フランス", share: 12 },
      { country: "英国", share: 8 },
      { country: "その他", share: 5 },
    ],
  ),
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

type RawElement = readonly [
  string,
  string,
  number | null,
  number,
  ElementCategory,
];
const rawElements: RawElement[] = [
  ["H", "水素", 1, 1, "nonmetal"],
  ["He", "ヘリウム", 18, 1, "noble"],
  ["Li", "リチウム", 1, 2, "alkali"],
  ["Be", "ベリリウム", 2, 2, "alkaline"],
  ["B", "ホウ素", 13, 2, "metalloid"],
  ["C", "炭素", 14, 2, "nonmetal"],
  ["N", "窒素", 15, 2, "nonmetal"],
  ["O", "酸素", 16, 2, "nonmetal"],
  ["F", "フッ素", 17, 2, "halogen"],
  ["Ne", "ネオン", 18, 2, "noble"],
  ["Na", "ナトリウム", 1, 3, "alkali"],
  ["Mg", "マグネシウム", 2, 3, "alkaline"],
  ["Al", "アルミニウム", 13, 3, "post-transition"],
  ["Si", "ケイ素", 14, 3, "metalloid"],
  ["P", "リン", 15, 3, "nonmetal"],
  ["S", "硫黄", 16, 3, "nonmetal"],
  ["Cl", "塩素", 17, 3, "halogen"],
  ["Ar", "アルゴン", 18, 3, "noble"],
  ["K", "カリウム", 1, 4, "alkali"],
  ["Ca", "カルシウム", 2, 4, "alkaline"],
  ["Sc", "スカンジウム", 3, 4, "transition"],
  ["Ti", "チタン", 4, 4, "transition"],
  ["V", "バナジウム", 5, 4, "transition"],
  ["Cr", "クロム", 6, 4, "transition"],
  ["Mn", "マンガン", 7, 4, "transition"],
  ["Fe", "鉄", 8, 4, "transition"],
  ["Co", "コバルト", 9, 4, "transition"],
  ["Ni", "ニッケル", 10, 4, "transition"],
  ["Cu", "銅", 11, 4, "transition"],
  ["Zn", "亜鉛", 12, 4, "transition"],
  ["Ga", "ガリウム", 13, 4, "post-transition"],
  ["Ge", "ゲルマニウム", 14, 4, "metalloid"],
  ["As", "ヒ素", 15, 4, "metalloid"],
  ["Se", "セレン", 16, 4, "nonmetal"],
  ["Br", "臭素", 17, 4, "halogen"],
  ["Kr", "クリプトン", 18, 4, "noble"],
  ["Rb", "ルビジウム", 1, 5, "alkali"],
  ["Sr", "ストロンチウム", 2, 5, "alkaline"],
  ["Y", "イットリウム", 3, 5, "transition"],
  ["Zr", "ジルコニウム", 4, 5, "transition"],
  ["Nb", "ニオブ", 5, 5, "transition"],
  ["Mo", "モリブデン", 6, 5, "transition"],
  ["Tc", "テクネチウム", 7, 5, "transition"],
  ["Ru", "ルテニウム", 8, 5, "transition"],
  ["Rh", "ロジウム", 9, 5, "transition"],
  ["Pd", "パラジウム", 10, 5, "transition"],
  ["Ag", "銀", 11, 5, "transition"],
  ["Cd", "カドミウム", 12, 5, "transition"],
  ["In", "インジウム", 13, 5, "post-transition"],
  ["Sn", "スズ", 14, 5, "post-transition"],
  ["Sb", "アンチモン", 15, 5, "metalloid"],
  ["Te", "テル", 16, 5, "metalloid"],
  ["I", "ヨウ素", 17, 5, "halogen"],
  ["Xe", "キセノン", 18, 5, "noble"],
  ["Cs", "セシウム", 1, 6, "alkali"],
  ["Ba", "バリウム", 2, 6, "alkaline"],
  ["La", "ランタン", 3, 6, "lanthanide"],
  ["Ce", "セリウム", null, 6, "lanthanide"],
  ["Pr", "プラセオジム", null, 6, "lanthanide"],
  ["Nd", "ネオジム", null, 6, "lanthanide"],
  ["Pm", "プロメチウム", null, 6, "lanthanide"],
  ["Sm", "サマリウム", null, 6, "lanthanide"],
  ["Eu", "ユウロピウム", null, 6, "lanthanide"],
  ["Gd", "ガドリニウム", null, 6, "lanthanide"],
  ["Tb", "テルビウム", null, 6, "lanthanide"],
  ["Dy", "ジスプロシウム", null, 6, "lanthanide"],
  ["Ho", "ホルミウム", null, 6, "lanthanide"],
  ["Er", "エルビウム", null, 6, "lanthanide"],
  ["Tm", "ツリウム", null, 6, "lanthanide"],
  ["Yb", "イッテルビウム", null, 6, "lanthanide"],
  ["Lu", "ルテチウム", null, 6, "lanthanide"],
  ["Hf", "ハフニウム", 4, 6, "transition"],
  ["Ta", "タンタル", 5, 6, "transition"],
  ["W", "タングステン", 6, 6, "transition"],
  ["Re", "レニウム", 7, 6, "transition"],
  ["Os", "オスミウム", 8, 6, "transition"],
  ["Ir", "イリジウム", 9, 6, "transition"],
  ["Pt", "白金", 10, 6, "transition"],
  ["Au", "金", 11, 6, "transition"],
  ["Hg", "水銀", 12, 6, "transition"],
  ["Tl", "タリウム", 13, 6, "post-transition"],
  ["Pb", "鉛", 14, 6, "post-transition"],
  ["Bi", "ビスマス", 15, 6, "post-transition"],
  ["Po", "ポロニウム", 16, 6, "post-transition"],
  ["At", "アスタチン", 17, 6, "halogen"],
  ["Rn", "ラドン", 18, 6, "noble"],
  ["Fr", "フランシウム", 1, 7, "alkali"],
  ["Ra", "ラジウム", 2, 7, "alkaline"],
  ["Ac", "アクチニウム", 3, 7, "actinide"],
  ["Th", "トリウム", null, 7, "actinide"],
  ["Pa", "プロトアクチニウム", null, 7, "actinide"],
  ["U", "ウラン", null, 7, "actinide"],
  ["Np", "ネプツニウム", null, 7, "actinide"],
  ["Pu", "プルトニウム", null, 7, "actinide"],
  ["Am", "アメリシウム", null, 7, "actinide"],
  ["Cm", "キュリウム", null, 7, "actinide"],
  ["Bk", "バークリウム", null, 7, "actinide"],
  ["Cf", "カリホルニウム", null, 7, "actinide"],
  ["Es", "アインスタイニウム", null, 7, "actinide"],
  ["Fm", "フェルミウム", null, 7, "actinide"],
  ["Md", "メンデレビウム", null, 7, "actinide"],
  ["No", "ノーベリウム", null, 7, "actinide"],
  ["Lr", "ローレンシウム", null, 7, "actinide"],
  ["Rf", "ラザホージウム", 4, 7, "transition"],
  ["Db", "ドブニウム", 5, 7, "transition"],
  ["Sg", "シーボーギウム", 6, 7, "transition"],
  ["Bh", "ボーリウム", 7, 7, "transition"],
  ["Hs", "ハッシウム", 8, 7, "transition"],
  ["Mt", "マイトネリウム", 9, 7, "transition"],
  ["Ds", "ダームスタチウム", 10, 7, "transition"],
  ["Rg", "レントゲニウム", 11, 7, "transition"],
  ["Cn", "コペルニシウム", 12, 7, "transition"],
  ["Nh", "ニホニウム", 13, 7, "post-transition"],
  ["Fl", "フレロビウム", 14, 7, "post-transition"],
  ["Mc", "モスコビウム", 15, 7, "post-transition"],
  ["Lv", "リバモリウム", 16, 7, "post-transition"],
  ["Ts", "テネシン", 17, 7, "halogen"],
  ["Og", "オガネソン", 18, 7, "noble"],
];

export const ELEMENTS: ElementRecord[] = rawElements.map(
  ([symbol, name, group, period, category], index) => {
    const atomicNumber = index + 1;
    const isLanthanideSeries = atomicNumber >= 58 && atomicNumber <= 71;
    const isActinideSeries = atomicNumber >= 90 && atomicNumber <= 103;
    return {
      atomicNumber,
      symbol,
      name,
      group,
      period,
      displayColumn: isLanthanideSeries
        ? atomicNumber - 54
        : isActinideSeries
          ? atomicNumber - 86
          : (group ?? 3),
      displayRow: isLanthanideSeries ? 8 : isActinideSeries ? 9 : period,
      category,
      glanceUse: elementGlance[symbol]?.use,
      supplyAlert: elementGlance[symbol]?.supplyAlert,
      detail: elementDetails[symbol]
        ? { ...elementDetails[symbol], market: ELEMENT_MARKETS[symbol] }
        : undefined,
    };
  },
);

function material(
  family: "mineral" | "polymer",
  value: Omit<
    MaterialDetail,
    "family" | "lastReviewed" | "sources" | "supplyDemand"
  > & { sources?: MaterialSource[] },
) {
  return detail({
    ...value,
    family,
    manufacturing:
      family === "polymer" ? polymerManufacturing[value.id] : undefined,
    sources:
      value.sources ?? (family === "mineral" ? mineralSources : polymerSources),
  });
}

export const MINERALS: MaterialDetail[] = [
  material("mineral", {"id":"mineral-spodumene","name":"スポジュメン（リチア輝石）","code":"LiAlSi₂O₆","category":"リチウム鉱石","summary":"硬い岩石から採るリチウムの主力鉱物。高品位精鉱から電池品質リチウム化合物へつなぐ。","properties":["ペグマタイト鉱物","選鉱・焙焼が必要"],"uses":["炭酸リチウム","水酸化リチウム","耐熱セラミックス"],"supplyCountries":["豪州","中国","ジンバブエ","カナダ","マリ"],"reserves":"リチウム全体の世界埋蔵量約3,700万t（リチウム含有量）。かん水を含むため鉱物単独値ではない。","balance":"価格低下局面では高費用鉱山が延期されやすいが、短い増産供給開始までの期間が強み。","circularity":"採掘後に残る鉱石くずの活用と電池再利用を別に評価。","chain":["ペグマタイト","リチア輝石の精鉱","水酸化リチウム（LiOH）・炭酸リチウム（Li₂CO₃）","蓄電池"],"amdFitNote":"鉱物処理、未利用鉱物、電池材料の技術評価に向く。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"リチウム価格循環の中心","demand":"電池","supplyRisk":"鉱山＋精製集中","amdFit":"電池・資源プロジェクト"}}),
  material("mineral", {"id":"mineral-brine","name":"塩湖かん水","code":"リチウムを含む塩水","category":"リチウム原料","summary":"鉱物ではないが、リチウム供給を理解するために欠かせない塩水原料。水を蒸発させる方法、リチウムを直接取り出す方法、水資源の管理が競争軸。","properties":["溶存資源","マグネシウム・リチウム比が工程に影響"],"uses":["炭酸リチウム","水酸化リチウム"],"supplyCountries":["チリ","アルゼンチン","中国","ボリビア"],"reserves":"リチウム資源統計値に含まれる。資源量と経済的埋蔵量、水収支を分けて見る。","balance":"低費用の可能性がある一方、立上げ期間・回収率・地域水利用が制約。","circularity":"水・薬剤の循環と地域環境影響が主論点。","chain":["塩湖・地熱塩水","濃縮・リチウムを塩水から直接取り出す技術","炭酸リチウム（Li₂CO₃）・水酸化リチウム（LiOH）","蓄電池"],"amdFitNote":"リチウムを塩水から直接取り出す技術、膜、吸着材、水処理の研究の種と接続。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"リチウムを塩水から直接取り出す技術投資が活発","demand":"電池","supplyRisk":"地域・水・立上げ不安","amdFit":"水処理・吸着技術"}}),
  material("mineral", {"id":"mineral-bauxite","name":"ボーキサイト","code":"アルミニウム鉱石","category":"アルミニウム鉱石","summary":"アルミニウムの主原料。鉱石量よりアルミナ精製、電力、アルミナ精製で出る赤い泥状廃棄物処理が競争力を決める。","properties":["アルミニウム水酸化物主体","不純物差が大きい"],"uses":["アルミナ","アルミニウム金属","耐火材"],"supplyCountries":["ギニア","豪州","中国","ブラジル","インド"],"reserves":"米国地質調査所（USGS）ボーキサイト・アルミナ資源統計を参照。鉱石→アルミナ→金属で供給国が変わる。","balance":"軽量化需要は強いが、製錬電力費用と炭素強度が供給選別を進める。","circularity":"アルミニウム製造くず・使用済み材循環は成熟。アルミナ精製で出る赤い泥状廃棄物からの金属回収は余地大。","chain":["ボーキサイト","アルミナ","一次生産品・再生アルミニウム","移動機器・建材"],"amdFitNote":"軽量化、低炭素製錬、アルミナ精製で出る赤い泥状廃棄物資源化に展開。","scores":{"heat":4,"demand":5,"supplyRisk":3,"amdFit":4},"scoreReasons":{"heat":"低炭素金属化","demand":"移動機器・社会基盤","supplyRisk":"鉱石より精製電力","amdFit":"循環・工程"}}),
  material("mineral", {"id":"mineral-graphite","name":"天然黒鉛","code":"C","category":"炭素鉱物","summary":"リチウムイオン電池負極の主原料。採掘後の球状化・高純度化・表面処理まで見ないと供給不安を誤る。","properties":["層状結晶","導電性","潤滑性"],"uses":["電池の負極","耐火物","潤滑材"],"supplyCountries":["中国","マダガスカル","タンザニア","モザンビーク","ブラジル"],"reserves":"世界埋蔵量約3.1億t（天然黒鉛、米国地質調査所（USGS） 2026）。","balance":"鉱石は複数国にあるが電池品質加工は中国集中。人造黒鉛との費用・CO₂比較が必要。","circularity":"電池からの負極再生、直接再利用、精製製造工程のくず回収が開発中。","chain":["薄片状黒鉛","球状に加工した高純度黒鉛","表面を覆った電池の負極材","リチウムイオン電池"],"amdFitNote":"電池、炭素材料、精製・再利用を一体で評価。","scores":{"heat":5,"demand":5,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"電池負極の中核","demand":"リチウムイオン電池","supplyRisk":"加工集中","amdFit":"炭素・電池プロジェクト"}}),
  material("mineral", {"id":"mineral-quartz","name":"石英・高純度石英","code":"SiO₂","category":"ケイ素原料","summary":"ありふれた石英と、半導体るつぼに使える高純度石英は別市場。純度・包有物・加工の知識と経験が価値。","properties":["硬度7","熱安定","高純度化で電子用途"],"uses":["ガラス","半導体るつぼ","ケイ素原料","光学"],"supplyCountries":["米国","ノルウェー","ブラジル","中国","インド"],"reserves":"一般石英は豊富。高純度石英は品質条件で実質的な供給源が限定。","balance":"半導体・太陽光発電の設備循環に影響されるが、品質認証を受けた供給元追加には時間。","circularity":"るつぼ・ガラス・ケイ素切削くずの再資源化は用途別純度管理が必要。","chain":["石英鉱石","高純度シリカ（二酸化ケイ素）","金属ケイ素・るつぼ","半導体・太陽光発電"],"amdFitNote":"高純度化、分析、結晶・半導体研究の種の入口。","scores":{"heat":4,"demand":4,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"高純度品は別市場","demand":"半導体・太陽光発電","supplyRisk":"品質認証を受けた供給元限定","amdFit":"材料分析・半導体"}}),
  material("mineral", {"id":"mineral-chalcopyrite","name":"黄銅鉱","code":"CuFeS₂","category":"銅鉱石","summary":"世界の銅供給を支える代表的硫化鉱。品位低下、ヒ素、不純物、製錬生産能力が論点。","properties":["銅硫化鉱","浮選可能"],"uses":["銅精鉱","電気銅"],"supplyCountries":["チリ","ペルー","コンゴ民主共和国","中国","米国"],"reserves":"銅全体の世界埋蔵量約9.8億t（銅含有量、米国地質調査所（USGS） 2026）。鉱物別ではない。","balance":"新鉱山の許認可・水・品質低下で供給開始までの期間が長い。","circularity":"銅製造くず・使用済み材は高価値。鉱山採掘後に残る鉱石くず再処理も候補。","chain":["黄銅鉱鉱石","精鉱","製錬・精製","電線・薄い金属箔"],"amdFitNote":"選鉱、センサー選別、採掘後に残る鉱石くず、都市鉱山の比較に。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"電化の制約","demand":"送配電網・電気自動車","supplyRisk":"鉱山供給開始までの期間","amdFit":"工程・循環"}}),
  material("mineral", {"id":"mineral-nickel-laterite","name":"ニッケルラテライト鉱（ニッケル酸化鉱）","code":"ニッケル酸化鉱","category":"ニッケル鉱石","summary":"ニッケル資源の過半を占める酸化鉱。ニッケル銑鉄、製錬途中の中間品（マット）、高温・高圧の酸で金属を取り出す方法で製品品質と環境負荷が大きく変わる。","properties":["低品位・大規模","高圧酸浸出が選択肢"],"uses":["ステンレス","電池に使える高純度品ニッケル"],"supplyCountries":["インドネシア","フィリピン","ニューカレドニア","豪州"],"reserves":"ニッケル世界埋蔵量 1.4億t超。世界資源の54%がラテライト鉱（ニッケル酸化鉱）と米国地質調査所（USGS）推計。","balance":"インドネシア増産でニッケル全体は余剰だが、製造時の二酸化炭素排出量と高純度ニッケル品質を分ける。","circularity":"鉱滓・酸管理と製品製造くず・使用済み材循環を別に評価。","chain":["ラテライト鉱（ニッケル酸化鉱）","ニッケル銑鉄・製錬途中の中間品（マット）・ニッケルとコバルトの混合水酸化物","ステンレス・正極","社会基盤・蓄電池"],"amdFitNote":"水溶液で金属を取り出す製錬法、廃液、低炭素化の技術研究の種に直結。","scores":{"heat":5,"demand":4,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"供給急増と環境制約","demand":"ステンレス＋蓄電池","supplyRisk":"インドネシア集中","amdFit":"製錬・環境"}}),
  material("mineral", {"id":"mineral-copper-cobalt","name":"銅・コバルト層状鉱床","code":"銅・コバルト鉱","category":"コバルト鉱石","summary":"コンゴ民主共和国・ザンビアに集中し、コバルトが銅採掘の副産物として供給される代表的鉱床。","properties":["堆積岩中にできた鉱床","銅とコバルトの共産"],"uses":["銅","電池に使える高純度品コバルト"],"supplyCountries":["コンゴ民主共和国","ザンビア"],"reserves":"コバルト世界埋蔵量約1,200万t。コンゴ民主共和国が約600万t（米国地質調査所（USGS） 2026）。","balance":"コバルト価格だけでは採掘量が決まらず、銅採算と輸出政策が供給を左右。","circularity":"鉱山側環境・人権・企業統治と電池再利用を供給組み合わせで比較。","chain":["銅-コバルト鉱石","水酸化物・精鉱","精製したコバルト","正極・合金"],"amdFitNote":"副産物採算、責任調達、再利用の教材性が高い。","scores":{"heat":5,"demand":4,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"政策・副産物構造","demand":"蓄電池・合金","supplyRisk":"コンゴ民主共和国集中","amdFit":"事業モデル評価"}}),
  material("mineral", {"id":"mineral-monazite","name":"モナザイト","code":"(Ce,La,Nd,Th)PO₄","category":"レアアース（希土類）鉱物","summary":"軽いレアアース（希土類）とリンを含む。トリウム・ウラン管理、分離費用、放射性残渣が事業成立性を決める。","properties":["リン酸塩鉱物","軽いレアアースが多い","放射性元素を伴う場合"],"uses":["ネオジム・プラセオジム酸化物","セリウム・ランタン製品"],"supplyCountries":["中国","豪州","インド","ブラジル","マダガスカル"],"reserves":"レアアース（希土類）全体の世界埋蔵量 7,500万t超（レアアース酸化物換算）。鉱物単独値ではない。","balance":"鉱石より分離・廃棄物管理と磁石供給の流れが制約。","circularity":"磁石再利用が一次採掘を補完。残渣処理が必須。","chain":["モナザイト砂","鉱石を酸などで分解する工程・分離","ネオジムとプラセオジムの酸化物","磁石"],"amdFitNote":"分離、放射性残渣、磁石供給の流れの技術評価に。","scores":{"heat":5,"demand":5,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"磁石需要","demand":"電気自動車・ロボット","supplyRisk":"分離集中","amdFit":"分離・環境・機器"}}),
  material("mineral", {"id":"mineral-bastnasite","name":"バストネサイト","code":"(Ce,La)(CO₃)F","category":"レアアース（希土類）を取り出す鉱物","summary":"電気自動車やロボットの強力磁石に必要なレアアースを多く含む。鉱山だけでなく、元素を分けて磁石にする工場が一部の国に集中している。","properties":["軽い種類のレアアースを多く含む","炭酸塩とフッ素を含む"],"uses":["電気自動車・ロボット用の強力磁石","排気ガスをきれいにする触媒","ガラスの研磨材"],"supplyCountries":["中国","米国","ベトナム"],"reserves":"レアアース（希土類）全体で7,500万t超（酸化物に換算した量、米国地質調査所 2026）。バストネサイトだけの量ではない。","balance":"鉱山の生産が増えても、磁石に使える品質へ加工できる国はなかなか増えていない。","circularity":"使用済み磁石を、磁力を生む材料の性質を保ったまま再利用する方法が有望。新しい鉱石から取った材料と混ぜて使う方法もある。","chain":["バストネサイト","鉱石から不要な部分を減らした原料","元素ごとに分けたレアアース化合物","磁石・排気ガスをきれいにする触媒"],"amdFitNote":"電気自動車・ロボットと、レアアースを元素ごとに分ける技術の両面で重要。","scores":{"heat":5,"demand":5,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"強力磁石の供給網","demand":"電気自動車・ロボット用モーター","supplyRisk":"元素を分けて磁石にする工程が集中","amdFit":"ロボット・エネルギー"}}),
  material("mineral", {"id":"mineral-coltan","name":"コルタン（コロンバイト・タンタライト）","code":"コルタン","category":"ニオブ・タンタル鉱物","summary":"ニオブとタンタルの固溶鉱物。小規模な手掘り採掘、産地を追跡できる仕組み、スズ副産物供給の流れを含めて見る。","properties":["ニオブ・タンタル複数の元素が一つの結晶に混ざった固溶体","高密度"],"uses":["タンタルコンデンサー","ニオブ合金"],"supplyCountries":["コンゴ民主共和国","ルワンダ","ブラジル","ナイジェリア","豪州"],"reserves":"タンタルは世界埋蔵量データなし、ニオブは2,100万t超。鉱床種類と資源統計を分ける。","balance":"小規模市場で供給急変が大きく、産地証明のある材料の高い付加価値が発生。","circularity":"電子機器製造くずと使用済み超合金が主要回収源。","chain":["コルタン","タンタル・ニオブ分離","粉末・フェロニオブ","電子機器・鉄鋼"],"amdFitNote":"責任調達と高機能電子機器の事業設計に。","scores":{"heat":4,"demand":4,"supplyRisk":5,"amdFit":4},"scoreReasons":{"heat":"産地を追跡できる仕組み","demand":"電子機器・鉄鋼","supplyRisk":"小規模・地域不安","amdFit":"材料＋環境・人権・企業統治"}}),
  material("mineral", {"id":"mineral-zircon","name":"ジルコン","code":"ZrSiO₄","category":"ジルコニウム・ハフニウム鉱物","summary":"ジルコニウムの主原料でハフニウムを伴う。鉱物を含む砂の副産物構造と高純度分離が価値を作る。","properties":["耐熱","耐薬品","ハフニウムを含む"],"uses":["セラミックス","鋳造砂","ジルコニウム・ハフニウム金属"],"supplyCountries":["豪州","南アフリカ","モザンビーク","セネガル"],"reserves":"ジルコニウム世界埋蔵量 7,000万t超（酸化ジルコニウム（ZrO₂）換算、米国地質調査所（USGS） 2026）。ハフニウム定量値はなし。","balance":"チタン鉱物を含む砂操業に連動。原子力品質ではジルコニウム・ハフニウム分離が追加制約。","circularity":"鋳造砂・高温に耐える炉材再利用、金属製造くず・使用済み材回収。","chain":["比重の大きい鉱物を含む砂","ジルコン精鉱","酸化ジルコニウム（ZrO₂）・ジルコニウム-ハフニウム分離","セラミックス・原子力"],"amdFitNote":"セラミックス、医療、原子力・半導体の共通入口。","scores":{"heat":4,"demand":3,"supplyRisk":4,"amdFit":4},"scoreReasons":{"heat":"ハフニウム副産物供給の流れ","demand":"セラミックス・原子力","supplyRisk":"鉱物を含む砂連動","amdFit":"高機能セラミックス"}}),
  material("mineral", {"id":"mineral-ilmenite","name":"イルメナイト","code":"FeTiO₃","category":"チタン鉱物","summary":"酸化チタン（TiO₂）顔料とチタン金属の主要原料。塩化法・硫酸法と製錬かす（スラグ）化で用途が分かれる。","properties":["チタンと鉄の酸化物","大規模鉱物を含む砂"],"uses":["酸化チタン（TiO₂）顔料","チタン製錬かす（スラグ）","チタン金属原料"],"supplyCountries":["中国","モザンビーク","南アフリカ","豪州","カナダ"],"reserves":"米国地質調査所（USGS）チタン鉱物精鉱の資源統計表を参照。ルチルとの品質差に注意。","balance":"顔料景気と航空チタン需要が別景気の波。電力・塩素・廃液処理が費用を左右。","circularity":"チタン金属製造くず・使用済み材は回収価値が高い。顔料は製品中に散逸。","chain":["イルメナイト砂","チタン製錬かす（スラグ）・人工的に高純度化したルチル","酸化チタン（TiO₂）・四塩化チタン（TiCl₄）","顔料・金属"],"amdFitNote":"工程化学、廃液、光触媒・チタン合金研究の種に。","scores":{"heat":4,"demand":4,"supplyRisk":3,"amdFit":5},"scoreReasons":{"heat":"顔料と高機能チタン","demand":"顔料・航空宇宙","supplyRisk":"加工設備","amdFit":"材料・環境工程"}}),
  material("mineral", {"id":"mineral-fluorite","name":"蛍石","code":"CaF₂","category":"フッ素鉱物","summary":"フッ素系化学品の起点。半導体の薬液加工、蓄電池電解液、冷媒など下流が広い。","properties":["フッ素が多い","高純度品は化学工業に使う"],"uses":["フッ化水素（HF）","フッ素樹脂","半導体化学品","蓄電池電解液"],"supplyCountries":["中国","メキシコ","モンゴル","南アフリカ","ベトナム"],"reserves":"米国地質調査所（USGS）蛍石資源統計の世界埋蔵量・生産を参照。化学工業向けの高純度品供給を分ける。","balance":"中国・メキシコ集中と下流高純度化、環境規制が同時に効く。","circularity":"フッ素は製品中で散逸しやすい。薬液などで表面を削る加工排水・六フッ化リン酸リチウム（LiPF₆）系からの回収が研究課題。","chain":["蛍石","フッ化水素（HF）","フッ素系化学品・樹脂のもとになる小さな分子","半導体・蓄電池・ポリテトラフルオロエチレン（PTFE）"],"amdFitNote":"半導体、電池、排水処理、分解されにくい有機フッ素化合物（PFAS）代替をつなぐ。","scores":{"heat":5,"demand":5,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"半導体・電池・規制","demand":"フッ化水素（HF）系高純度用途","supplyRisk":"産地・精製集中","amdFit":"環境と先端製造"}}),
  material("mineral", {"id":"mineral-phosphate-rock","name":"リン鉱石","code":"リン灰石を多く含む岩石","category":"リン鉱石","summary":"食料安全保障を支える肥料原料。モロッコへの埋蔵集中と副産フッ素・ウラン・カドミウム、リン酸鉄リチウム電池需要を見る。","properties":["アパタイト主体","鉱石を酸で溶かして作るリン酸"],"uses":["肥料","リン酸鉄リチウム電池","食品・工業用リン酸塩"],"supplyCountries":["中国","モロッコ","米国","ロシア","ヨルダン"],"reserves":"世界埋蔵量約730億t（販売できる品質の鉱石、米国地質調査所（USGS） 2026）。モロッコ約500億t。","balance":"肥料需要が圧倒的。リン酸鉄リチウム電池は新しい高純度用途別の市場で、食品・工業品質と競争。","circularity":"下水・家畜ふん尿・焼却灰からのリン回収が重要。","chain":["リン酸塩岩石・廃棄物に含まれるリン","リン酸・回収したリン","肥料・リン酸鉄リチウム電池","食品・農業・蓄電池"],"amdFitNote":"水処理・農業・電池を一つの循環事業に束ねられる。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"食料＋リン酸鉄リチウム電池","demand":"肥料基礎需要","supplyRisk":"埋蔵集中","amdFit":"排水・農業・蓄電池"}}),
  material("mineral", {"id":"mineral-magnesite","name":"マグネサイト","code":"MgCO₃","category":"マグネシウム鉱物","summary":"耐火物とマグネシウム化学品の原料。軽量金属、二酸化炭素を鉱物として固定する技術、蓄熱でも再注目。","properties":["炭酸塩鉱物","高温で焼く処理で酸化マグネシウム（MgO）"],"uses":["高温に耐える炉材","マグネシウム金属・化学品","セメント添加材"],"supplyCountries":["中国","トルコ","ブラジル","ロシア","オーストリア"],"reserves":"米国地質調査所（USGS）マグネシウム化合物資源統計を参照。金属マグネシウムは別の電解法・熱還元法による供給工程。","balance":"耐火物の基礎需要に、低炭素セメント・CO₂固定の新用途が重なる。","circularity":"耐火れんが再利用、マグネシウム系セメントの循環設計。","chain":["マグネサイト","酸化マグネシウム（MgO）・塩化マグネシウム（MgCl₂）","高温に耐える炉材・マグネシウム金属","鉄鋼・移動機器・炭素"],"amdFitNote":"二酸化炭素を鉱物として固定する技術、低炭素建材、軽量化研究の種に。","scores":{"heat":4,"demand":3,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"二酸化炭素を鉱物として固定する技術","demand":"耐火＋新用途","supplyRisk":"中国加工集中","amdFit":"環境・建材"}}),
];

export const POLYMERS: MaterialDetail[] = [
  material("polymer", {"id":"polymer-pe","name":"ポリエチレン","code":"PE","category":"広く使われる、加熱すると成形し直せる樹脂","summary":"世界で最も多く使われる樹脂の一つ。密度と分岐でフィルムから配管まで広がり、循環設計の基準材。","properties":["軽量","耐薬品","電気絶縁"],"uses":["フィルム・包装","配管","容器","電線の被覆"],"supplyCountries":["原料・樹脂: 中国","米国","中東","韓国"],"reserves":"石油や天然ガスから作るエチレンの生産能力と、再生原料の確保量で見る。","balance":"大型生産能力増と包装規制が同時進行。品質別需給を分ける。","circularity":"溶かして作り直す再利用が主力。フィルム回収、臭い・汚れ・異物、食品に触れる用途が課題。","chain":["ナフサ・エタン・生物由来の原料","エチレン","高密度ポリエチレン・低密度ポリエチレン・直鎖状低密度ポリエチレン","フィルム・配管・容器"],"amdFitNote":"包装循環、膜、再生材品質、生物由来の原料の事業比較に。","scores":{"heat":4,"demand":5,"supplyRisk":2,"amdFit":4},"scoreReasons":{"heat":"生産量と規制影響が大きい","demand":"包装・社会基盤","supplyRisk":"供給元は広い","amdFit":"循環・膜"}}),
  material("polymer", {"id":"polymer-pp","name":"ポリプロピレン","code":"PP","category":"広く使われる、加熱すると成形し直せる樹脂","summary":"軽量・耐熱・成形性のバランスがよく、自動車・包装・医療で大量使用。","properties":["低密度","何度も曲げられる一体型の薄いヒンジ","耐熱性"],"uses":["自動車","包装","医療","繊維"],"supplyCountries":["中国","米国","中東","韓国"],"reserves":"プロピレン生産能力と石油精製・プロパンからプロピレンを作る設備採算で見る。","balance":"中国生産能力増で汎用品は競争激化。高機能複合材料と再生品質は別市場。","circularity":"溶かして作り直す再利用可能。充填材・塗料・異材接着が品質を下げる。","chain":["ナフサ・プロパン","プロピレン","PP・複合材料","自動車・包装"],"amdFitNote":"軽量化、医療、再生複合材料、植物繊維を混ぜた複合材料に。","scores":{"heat":4,"demand":5,"supplyRisk":2,"amdFit":4},"scoreReasons":{"heat":"高生産量＋高機能化","demand":"自動車・包装","supplyRisk":"供給多様","amdFit":"複合材料・循環"}}),
  material("polymer", {"id":"polymer-pvc","name":"ポリ塩化ビニル","code":"PVC","category":"広く使われる、加熱すると成形し直せる樹脂","summary":"耐久・難燃・費用に強く建材で長寿命。添加剤、塩素、回収時の混合管理が論点。","properties":["難燃","耐候","可塑化可能"],"uses":["配管","窓枠","ケーブル","医療用チューブ"],"supplyCountries":["中国","米国","欧州","インド"],"reserves":"塩を電気分解して塩素などを作る工程とエチレンの生産能力、電力費用で見る。","balance":"建設景気の波の影響が大きく、耐久用途では代替時の製造から廃棄までの環境負荷（LCA）比較が必要。","circularity":"硬質ポリ塩化ビニル（PVC）は回収しやすい。添加剤履歴と軟質材の分離が課題。","chain":["塩とエチレン","塩化ビニル","硬質・曲げられるポリ塩化ビニル（PVC）","建築・医療"],"amdFitNote":"長寿命建材、医療チューブ、添加剤・再利用技術に。","scores":{"heat":3,"demand":4,"supplyRisk":3,"amdFit":3},"scoreReasons":{"heat":"規制と耐久価値の両面","demand":"建設基礎需要","supplyRisk":"エネルギー・塩素","amdFit":"建材・医療"}}),
  material("polymer", {"id":"polymer-pet","name":"ポリエチレンテレフタレート","code":"PET","category":"ポリエステル系樹脂","summary":"ボトル・繊維の大市場を持ち、溶かして作り直す方法・化学反応で原料まで戻す再利用の商用化が最も進む樹脂の一つ。","properties":["透明","気体や水分を通しにくい性質","高強度"],"uses":["ボトル","繊維","フィルム","高機能シート"],"supplyCountries":["中国","インド","米国","東南アジア"],"reserves":"PX・高純度テレフタル酸とエチレングリコール生産能力、回収ボトル供給で見る。","balance":"新品の原料生産能力と再生ポリエチレンテレフタレート義務化需要が競合。食品に使える品質再生能力が高い付加価値。","circularity":"使用済みボトルから新しいボトルを作る再利用が実用。色・多層品・繊維回収が課題。","chain":["PXとエチレン","高純度テレフタル酸とエチレングリコール","ポリエチレンテレフタレート・再生ポリエチレンテレフタレート","ボトル・繊維・フィルム"],"amdFitNote":"選別、分子を原料へ戻す技術、食品に使える品質再生の事業化に。","scores":{"heat":5,"demand":5,"supplyRisk":3,"amdFit":5},"scoreReasons":{"heat":"循環材市場が成立","demand":"包装・繊維","supplyRisk":"原料より再生品質制約","amdFit":"再利用実証向き"}}),
  material("polymer", {"id":"polymer-abs","name":"アクリロニトリル・ブタジエン・スチレン樹脂（ABS樹脂）","code":"ABS","category":"加熱すると成形し直せる高機能樹脂","summary":"外観・剛性・衝撃性のバランスで家電・自動車・立体印刷（3Dプリンター）に使う多相高分子。","properties":["耐衝撃","表面外観","めっき適性"],"uses":["電子機器外装","自動車内装","玩具","立体印刷（3Dプリンター）"],"supplyCountries":["中国","韓国","台湾","日本"],"reserves":"アクリロニトリル・ブタジエン・スチレンの三原料と原料から製品までの一貫生産で見る。","balance":"家電景気の波とブタジエン価格に影響。再生 ABS樹脂は難燃剤・色の履歴が課題。","circularity":"廃家電・電子機器由来回収が可能。臭素系難燃剤選別と材料の種類を見分ける技術が重要。","chain":["ANとBDとスチレン","ABS樹脂の製造","複合材料","電子機器・自動車"],"amdFitNote":"廃家電・電子機器循環、立体印刷（3Dプリンター）、表面機能化に。","scores":{"heat":4,"demand":4,"supplyRisk":3,"amdFit":4},"scoreReasons":{"heat":"電子機器循環","demand":"家電・自動車","supplyRisk":"三原料価格変動","amdFit":"デジタル設計によるものづくり"}}),
  material("polymer", {"id":"polymer-pa","name":"ポリアミド","code":"PA6 / PA66","category":"加熱すると成形し直せる高機能樹脂","summary":"強度・耐摩耗・耐熱に優れ、繊維と自動車部材の両市場を持つ。水を吸う性質と原料供給が、材料設計の注意点。","properties":["高強度","耐摩耗","吸水性"],"uses":["自動車","歯車・軸受","繊維","電気部品"],"supplyCountries":["中国","欧州","米国","日本"],"reserves":"カプロラクタムまたはアジポニトリル・ヘキサメチレンジアミン生産能力で見る。","balance":"PA66は一部中間体の供給障害が波及しやすい。金属から樹脂への置き換え需要は継続。","circularity":"古い繊維から新しい繊維を作る再利用と高機能製造くず・使用済み材回収。品質混合と水分管理が課題。","chain":["ベンゼン・ブタジエン","樹脂のもとになる小さな分子","PA6・PA66・複合材料","繊維・自動車"],"amdFitNote":"軽量化、摩擦や摩耗を扱う技術、植物など生物由来ナイロン、再利用に。","scores":{"heat":4,"demand":4,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"金属から樹脂への置き換え","demand":"自動車・繊維","supplyRisk":"中間体集中","amdFit":"機械・生物由来材料"}}),
  material("polymer", {"id":"polymer-pc","name":"ポリカーボネート","code":"PC","category":"加熱すると成形し直せる高機能樹脂","summary":"透明・耐衝撃・耐熱を両立し、光学・電子機器・移動機器で使う。","properties":["高透明","高耐衝撃","寸法安定"],"uses":["光学レンズ","電子機器","自動車窓材","医療"],"supplyCountries":["中国","韓国","欧州","米国","日本"],"reserves":"ビスフェノールAと炭酸塩中間原料、一貫生産の工場生産能力で見る。","balance":"中国生産能力増と高機能品質の認証市場が併存。","circularity":"溶かして作り直す方法・化学反応で原料まで戻す再利用可能。表面を覆う材料・混合材・ビスフェノールA管理が課題。","chain":["フェノールとアセトン","ビスフェノールA","PC・PC 混合材","光学・電子機器"],"amdFitNote":"光学、医療、透明なセンサー外装、再利用に。","scores":{"heat":4,"demand":4,"supplyRisk":3,"amdFit":5},"scoreReasons":{"heat":"透明高機能材","demand":"電子機器・移動機器","supplyRisk":"生産能力は拡大","amdFit":"光・医療"}}),
  material("polymer", {"id":"polymer-pom","name":"ポリアセタール","code":"POM","category":"加熱すると成形し直せる高機能樹脂","summary":"摺動・疲労・寸法精度に強い小型歯車・精密部品材料。","properties":["低摩擦","高剛性","寸法安定"],"uses":["歯車","燃料系部品","留め具","家電などの機構部品"],"supplyCountries":["中国","欧州","米国","日本","韓国"],"reserves":"メタノール・ホルムアルデヒドと専用の分子を長くつなぐ反応生産能力で見る。","balance":"電気自動車化で一部燃料用途は減るが、精密機構・ロボットは伸びる。","circularity":"熱分解・ホルムアルデヒド発生に注意。混ざり物の少ない製造くず中心。","chain":["メタノール","ホルムアルデヒド・トリオキサン","ポリアセタール","精密機構"],"amdFitNote":"ロボット、微小な機械機構、摩擦や摩耗を扱う技術研究の種に。","scores":{"heat":3,"demand":3,"supplyRisk":3,"amdFit":4},"scoreReasons":{"heat":"精密機構の基準材","demand":"ロボット・機構部品","supplyRisk":"専用の製造工場","amdFit":"ロボット"}}),
  material("polymer", {"id":"polymer-pps","name":"ポリフェニレンサルファイド","code":"PPS","category":"特に耐熱性が高い高機能樹脂","summary":"耐熱・耐薬品・難燃・寸法安定に強く、電気自動車の電装・ポンプ・半導体周辺で使う。","properties":["高耐熱","耐薬品","難燃"],"uses":["電気自動車電気部品","ポンプ・バルブ","電子機器","ろ過材"],"supplyCountries":["中国","日本","米国","韓国"],"reserves":"パラジクロロベンゼンと硫化ナトリウム、高品質高分子・複合材料生産能力で見る。","balance":"電気自動車高電圧化で需要増。品質認証が供給切替を遅くする。","circularity":"ガラス繊維複合材料が多く同じ製品へ戻す再利用困難。製造くず・使用済み材再利用が中心。","chain":["芳香族化合物と硫黄原料","ポリフェニレンサルファイド","ガラス繊維・無機物複合材料","電気自動車・電子機器"],"amdFitNote":"電動化、耐薬品機器、ろ過材・膜支持材に。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"電気自動車・高温電気部品","demand":"電装","supplyRisk":"品質生産能力限定","amdFit":"機器・移動機器"}}),
  material("polymer", {"id":"polymer-peek","name":"ポリエーテルエーテルケトン（PEEK）","code":"PEEK","category":"特に耐熱性が高い高機能樹脂","summary":"高耐熱・耐薬品・耐疲労・生体適合を備える高価格材料。金属から樹脂への置き換えと体内に入れる医療部品で価値。","properties":["連続耐熱","耐薬品","生体適合"],"uses":["航空宇宙","半導体装置","体内に入れる医療部品","石油・ガス"],"supplyCountries":["英国・欧州","中国","米国"],"reserves":"フッ素を含む芳香族化合物樹脂のもとになる小さな分子と少数の品質認証を受けたメーカー・材料を混ぜ合わせる会社で見る。","balance":"生産量は小さいが品質認証と製造の知識と経験が強い参入障壁。","circularity":"高価な混ざり物の少ない製造くず・使用済み材は回収価値あり。複合材料は分離困難。","chain":["特殊用途の樹脂のもとになる小さな分子","PEEK樹脂","炭素繊維・ガラス繊維複合材料","航空宇宙・医療"],"amdFitNote":"体内に入れる医療部品、航空、半導体装置、立体印刷（3Dプリンター）の大学研究の種に極めて相性がよい。","scores":{"heat":5,"demand":4,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"高付加価値・認証市場","demand":"医療・航空・半導体","supplyRisk":"メーカー・樹脂のもとになる小さな分子限定","amdFit":"高度な科学技術の事業化"}}),
  material("polymer", {"id":"polymer-ptfe","name":"ポリテトラフルオロエチレン（PTFE）","code":"PTFE","category":"フッ素樹脂","summary":"極低摩擦・高耐薬品・耐熱で代替困難。分解されにくい有機フッ素化合物（PFAS）規制は用途必要性と排出管理を分けて見る。","properties":["非粘着","耐薬品","高耐熱"],"uses":["半導体を薬液で洗浄・加工する工程","密封材・内張り","電線","医療"],"supplyCountries":["中国","米国","欧州","日本","インド"],"reserves":"蛍石からフッ化水素、フッ素樹脂の原料分子までを作れる量と、製造時の排出管理で見る。","balance":"半導体など重要用途では代替が難しい一方、用途制限・製造排出管理が市場を再編。","circularity":"焼却・再粉砕の制約が大きい。長寿命化と外へ漏らさない製造工程が重要。","chain":["蛍石","フッ化水素（HF）・テトラフルオロエチレン","ポリテトラフルオロエチレン（PTFE）","半導体・化学工業"],"amdFitNote":"半導体、化学装置、分解されにくい有機フッ素化合物（PFAS）代替・無排出工程を同時評価。","scores":{"heat":5,"demand":4,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"代替が難しい重要用途と規制の衝突","demand":"半導体・化学工業","supplyRisk":"フッ素原料の供給＋規制","amdFit":"環境・先端製造"}}),
  material("polymer", {"id":"polymer-epoxy","name":"エポキシ樹脂","code":"EP","category":"熱で固まり元に戻らない樹脂","summary":"接着・絶縁・複合材料の土台となる樹脂。硬化後の再溶融不可が循環の最大課題。","properties":["高接着","電気絶縁","低収縮"],"uses":["プリント基板","接着剤","風力発電の羽根","炭素繊維強化プラスチック"],"supplyCountries":["中国","韓国","台湾","欧州","日本"],"reserves":"ビスフェノールA・エピクロロヒドリン、硬化剤、電子部品に使える高品質生産能力で見る。","balance":"風力発電・電子機器・航空宇宙で品質が分かれ、品質認証が参入障壁。","circularity":"再成形できる硬化樹脂、やり直し可能な接着剤、溶剤で分解する方法、繊維回収が注目されている。","chain":["フェノール・プロピレン・塩素","エポキシ樹脂と硬化剤","積層板・接着剤","電子機器・複合材料"],"amdFitNote":"炭素繊維強化プラスチック、接着、電子機器、再利用研究の中核。","scores":{"heat":5,"demand":5,"supplyRisk":3,"amdFit":5},"scoreReasons":{"heat":"複合材料循環が未解決","demand":"電子機器・風力発電","supplyRisk":"品質別生産能力","amdFit":"材料研究の種が豊富"}}),
  material("polymer", {"id":"polymer-pu","name":"ポリウレタン","code":"PU","category":"熱で固まる樹脂・ゴム状材料","summary":"発泡体、表面を覆う材料、接着剤、ゴム状材料へ自在に設計できる反面、配合が複雑で回収しにくい。","properties":["設計自由度","断熱","弾力"],"uses":["断熱用の発泡体","座席・クッション","表面を覆う材料","接着剤"],"supplyCountries":["中国","欧州","米国","韓国","日本"],"reserves":"イソシアネート原料（MDI・TDI）とポリオール生産能力、エネルギー・建築需要で見る。","balance":"断熱需要は強い。建築改修と使用済み発泡体が次の市場。","circularity":"グリコールで原料へ戻す方法等化学反応で原料まで戻す再利用、植物などから作るポリオール、再利用設計が開発中。","chain":["ベンゼンとプロピレン","イソシアネートとポリオール","発泡体・表面を覆う材料・ゴム状材料","建築・移動機器"],"amdFitNote":"断熱、生物由来原料、廃発泡体回収、医療ゴム状材料に。","scores":{"heat":5,"demand":5,"supplyRisk":3,"amdFit":5},"scoreReasons":{"heat":"エネルギー 節約＋循環課題","demand":"断熱・移動機器","supplyRisk":"大手のメーカー集中","amdFit":"環境・生物由来"}}),
  material("polymer", {"id":"polymer-silicone","name":"シリコーン","code":"シリコーン","category":"ケイ素と有機物からできる高分子","summary":"ケイ素と酸素が交互につながる骨格で耐熱・柔軟・生体適合を両立。すき間を埋める密封材から医療、電子機器、製品を型からはがしやすくする材料まで広い。","properties":["耐熱・耐寒","柔軟","撥水・生体適合"],"uses":["すき間を埋める密封材","医療機器","電子部品の保護材","はがれやすくする表面材"],"supplyCountries":["中国","欧州","米国","日本"],"reserves":"金属ケイ素→クロロシラン→シロキサンの生産能力とエネルギー費用で見る。","balance":"電気自動車・電子機器・医療で高機能品質需要。汎用品は生産能力景気の波の影響。","circularity":"分子同士が網目状につながった品は難しい。分子を原料へ戻す技術とシロキサン回収が開発中。","chain":["石英","金属ケイ素・クロロシラン","シロキサン高分子","電子機器・医療"],"amdFitNote":"医療、センサー封止、柔らかい材料で動くロボット、ケイ素材料の供給の流れをつなぐ。","scores":{"heat":5,"demand":5,"supplyRisk":4,"amdFit":5},"scoreReasons":{"heat":"医療・電子機器・柔らかい材料","demand":"電気自動車・機器","supplyRisk":"ケイ素・エネルギー・工程","amdFit":"AMDの横断プロジェクトに強い"}}),
  material("polymer", {"id":"polymer-pla","name":"ポリ乳酸","code":"PLA","category":"植物など生物由来ポリエステル系樹脂","summary":"糖由来の代表的植物など生物由来樹脂。工業用の堆肥化施設で分解できる性質と耐熱・気体や水分を通しにくい性質・回収の仕組みを分けて評価。","properties":["植物など生物由来","透明","工業用の堆肥化施設で分解できる種類"],"uses":["包装","立体印刷（3Dプリンター）","繊維","医療"],"supplyCountries":["米国","タイ","中国","欧州"],"reserves":"トウモロコシ・糖原料、乳酸、分子を長くつなぐ反応生産能力で見る。","balance":"政策需要は強いが、既存再利用回収経路混入と使用済み設備が制約。","circularity":"溶かして作り直す方法・化学反応で原料まで戻す再利用と工業用の堆肥化施設での分解。自然環境で即分解する意味ではない。","chain":["糖・でんぷん","乳酸","ポリ乳酸","包装・立体印刷（3Dプリンター）"],"amdFitNote":"地域の生物資源、発酵、医療、立体印刷（3Dプリンター）の事業化に。","scores":{"heat":5,"demand":4,"supplyRisk":3,"amdFit":5},"scoreReasons":{"heat":"生物資源を活用する産業と規制","demand":"包装・印刷","supplyRisk":"原料・生産能力","amdFit":"地域資源を生かす高度な科学技術"}}),
  material("polymer", {"id":"polymer-pi","name":"ポリイミド","code":"PI","category":"熱にとても強い高機能樹脂","summary":"薄いフィルムにしても熱に強く、電気を通さず、温度が変わっても形が変わりにくい。曲げられる電子回路や半導体に欠かせない。","properties":["高温に強い","電気を通さない","薄いフィルムにできる"],"uses":["曲げられる電子回路","半導体を衝撃から守る薄い膜","モーター内部の電気を通さない部材","航空機・宇宙機器"],"supplyCountries":["日本","米国","韓国","中国"],"reserves":"原料となる特殊な薬品と、高純度なフィルムや塗布材を作れる工場の数で供給力を見る。","balance":"人工知能向け半導体、半導体チップを高密度につなぐ部品、電気自動車のモーターで需要が増えている。高純度で、熱による伸び縮みが小さい製品は供給元を替えにくい。","circularity":"熱で固まる樹脂に近く、原料へ戻して再利用するのは難しい。長く使う、薄くする、製造時の廃材を減らす取り組みが中心。","chain":["熱に強い輪の構造を持つ2種類の薬品","フィルムになる前段階の液体樹脂","ポリイミドのフィルム・塗布液","半導体・航空機・宇宙機器"],"amdFitNote":"半導体の保護材、曲げられるセンサー、宇宙材料の研究候補になる。","scores":{"heat":5,"demand":5,"supplyRisk":5,"amdFit":5},"scoreReasons":{"heat":"半導体チップを高密度につなぐ技術","demand":"人工知能（AI）・電気自動車・曲げられる部品","supplyRisk":"高純度品を作れる会社が少ない","amdFit":"先端機器"}}),
];

export const MATERIALS: MaterialDetail[] = [
  ...ELEMENTS.flatMap((element) => (element.detail ? [element.detail] : [])),
  ...MINERALS,
  ...POLYMERS,
];

export function materialTotalScore(item: Pick<MaterialDetail, "scores">) {
  return (
    item.scores.heat +
    item.scores.demand +
    item.scores.supplyRisk +
    item.scores.amdFit
  );
}

export function compareMaterialTotalScore(
  a: MaterialDetail,
  b: MaterialDetail,
) {
  return (
    materialTotalScore(b) - materialTotalScore(a) ||
    b.scores.supplyRisk - a.scores.supplyRisk ||
    a.name.localeCompare(b.name, "ja")
  );
}

export function getMaterialById(id: string) {
  return MATERIALS.find((item) => item.id === id);
}
