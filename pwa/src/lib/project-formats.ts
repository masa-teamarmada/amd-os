/**
 * PJタイプ別の標準フォーマット（正本: spec/3-23-project-format-current-spec.md）。
 *
 * 2026-10-03 まさ確定「すべてのPJについて、同じフォーマットで表示する設計にして。
 * 勝手にそれを書き換えないように制限をかけてほしい。新たなデータが入るときには、新たなグラフを
 * 入れるんじゃなくて、フォーマットで生成されているグラフにその数値データを入れる形にしてほしい」。
 *
 * 2026-10-03 まさ確定「全部統一してないとだめ。OSの大原則。あと中身があるときだけ出るタブってなに？
 * すべてのフォーマットが同じ状態で表示されてないとだめ」。
 *
 * - 画面はこの定義の順にタブと区画を描く。PJ番号で表示を分けない。PJごとの違いはデータだけで出す。
 * - タブは、データの有無にかかわらず全部出す。中身が無いタブは、タブの中で「未登録」と出す。
 * - 新しい種類の数字が来たら、下の行・グラフのどれに入るかを決めてデータ側で渡す。区画やグラフを足さない。
 * - **このファイルは鍵付き**。中身を変えると `scripts/project_format_lock.json` の sha256 と合わなくなり、
 *   `npm run test:project-format`（本番反映の前に必ず走る）が止める。変えてよいのは、まさが明示で
 *   承認したときだけ。承認の言葉を lock の approvals に足してから sha256 を更新する。
 */

/**
 * PJタイプ。`projects.project_category` から決める（顧問PJは会社の試算表なので大学発SUと同じ形）。
 * AMD本体（株式会社チームアルマダ自身のPJ）は、PJタイプではなく会社の経営面なので別の形を持つ。
 * 2026-10-03 まさ確定「全部統一してないとだめ。OSの大原則」。同じタイプのPJは、同じタブ・同じ区画で描く。
 */
export type ProjectFormatType = "su" | "new_business" | "ecosystem" | "amd";

/** AMD本体を表すPJ。PJ番号を名指ししてよいのは、この定義（鍵付き）の中だけ。 */
export const AMD_COMPANY_PROJECT_ID = "p00";

export const PROJECT_FORMAT_TYPES: ReadonlyArray<{
  type: ProjectFormatType;
  label: string;
  categories: readonly string[];
}> = [
  { type: "su", label: "大学発SU", categories: ["dtsu", "advisor"] },
  { type: "new_business", label: "新規事業", categories: ["new_business"] },
  { type: "ecosystem", label: "研究機関エコシステム", categories: ["ecosystem"] },
  { type: "amd", label: "AMD本体", categories: [] },
];

export function projectFormatTypeOf(project: { projectId: string; projectCategory?: string | null }): ProjectFormatType {
  if (project.projectId === AMD_COMPANY_PROJECT_ID) return "amd";
  const category = project.projectCategory || "dtsu";
  return PROJECT_FORMAT_TYPES.find((entry) => entry.categories.includes(category))?.type ?? "su";
}

/**
 * コックピットのタブ。タイプごとに、データの有無にかかわらず全タブを出す（中身が無いタブは空の状態を出す）。
 * DDは並列の独立した領域として入場権限を確認する。PJで出し分けない。
 */
const COCKPIT_STANDARD_TABS = [
  { group: "progress-group", tabs: ["issues", "tasks", "gantt", "progress", "meetings", "slack", "weekly", "partners"] },
  { group: "business-plan-group", tabs: ["score-detail", "technology", "competition", "business-model", "business-plan", "financial-projection", "capital-plan", "cost-model", "ip"] },
  { group: "documents-group", tabs: ["documents"] },
  { group: "project-management-group", tabs: ["overview", "project-contracts", "project-finance", "monthly-reports"] },
  { group: "company-information-group", tabs: ["company", "contracts", "killer-factors", "capital-policy", "activity"] },
] as const;

export const COCKPIT_TAB_FORMATS: Record<ProjectFormatType, ReadonlyArray<{ group: string; tabs: readonly string[] }>> = {
  su: COCKPIT_STANDARD_TABS,
  new_business: COCKPIT_STANDARD_TABS,
  // AMD本体はスコアを付けない（AMD Score は支援先の事業の評価）。
  amd: COCKPIT_STANDARD_TABS.map((group) => ({ group: group.group, tabs: group.tabs.filter((tab) => tab !== "score-detail") })),
  ecosystem: [
    { group: "progress-group", tabs: ["issues", "tasks", "gantt", "progress", "meetings", "slack", "weekly", "partners"] },
    { group: "seeds-group", tabs: ["seeds"] },
    { group: "regulations-group", tabs: ["regulations"] },
    { group: "documents-group", tabs: ["documents"] },
    { group: "project-management-group", tabs: ["overview", "project-contracts", "project-finance", "monthly-reports"] },
    { group: "company-information-group", tabs: ["company", "contracts", "killer-factors", "capital-policy", "activity"] },
  ],
};

/** PJワークスペース（PJメンバーと共有する面）のタブ。コックピットと同じく、タイプごとに全タブを出す。 */
const WORKSPACE_STANDARD_TABS = [
  { group: "progress-group", tabs: ["issues", "tasks", "gantt", "meetings", "slack", "weekly", "partners"] },
  { group: "business-plan-group", tabs: ["technology", "competition", "business-model", "business-plan", "financial-projection", "capital-plan", "cost", "ip"] },
  { group: "documents-group", tabs: ["drive"] },
  { group: "company-information-group", tabs: ["company", "contracts", "capital-policy"] },
] as const;

export const WORKSPACE_TAB_FORMATS: Record<ProjectFormatType, ReadonlyArray<{ group: string; tabs: readonly string[] }>> = {
  su: WORKSPACE_STANDARD_TABS,
  new_business: WORKSPACE_STANDARD_TABS,
  amd: WORKSPACE_STANDARD_TABS,
  ecosystem: [
    { group: "progress-group", tabs: ["issues", "tasks", "gantt", "meetings", "slack", "weekly", "partners"] },
    { group: "documents-group", tabs: ["drive"] },
    { group: "company-information-group", tabs: ["company", "contracts", "capital-policy"] },
  ],
};

/** タブ内の役割制限。DDは並列の領域として独立した権限で判定する。 */
export const ROLE_RESTRICTED_TABS: Readonly<Record<string, "amd_admin">> = {};

/** DDも同じページ分類を使う。ページ内では公開を許可された元データだけを表示する。 */
// 従来の共通ページキー。旧URL・正式版PDFとの互換用。左メニューはDD_ITEM_PAGESを使う。
export const DD_TAB_FORMAT = [
  { group: "progress-group", tabs: ["gantt", "partners"] },
  { group: "business-plan-group", tabs: ["technology", "competition", "business-model", "business-plan", "financial-projection", "capital-plan", "cost-model", "ip"] },
  { group: "documents-group", tabs: ["documents"] },
  { group: "company-information-group", tabs: ["company", "capital-policy", "activity"] },
] as const;

/** DDの常設メニュー。資料の有無にかかわらず、16項目を同じ順に並べる。 */
export const DD_ITEM_PAGES = [
  { key: "company", label: "会社基本情報", related: ["activity"] },
  { key: "capital-plan", label: "株主・資本政策・投資条件", related: ["capital-policy"] },
  { key: "governance", label: "総会・取締役会・経営会議の決議", related: ["company"] },
  { key: "business-plan", label: "事業計画・開発計画", related: ["gantt"] },
  { key: "competition", label: "市場・競合", related: ["business-model"] },
  { key: "partners", label: "顧客・販売", related: ["business-model"] },
  { key: "technology", label: "技術・製品", related: [] },
  { key: "technical-evidence", label: "技術実証の証拠", related: ["technology"] },
  { key: "manufacturing", label: "製造・品質・供給", related: ["technology"] },
  { key: "ip", label: "知財・大学の利用権", related: ["technology"] },
  { key: "team", label: "経営陣・人員・雇用", related: ["business-model"] },
  { key: "contracts", label: "契約リスト", related: ["business-model"] },
  { key: "regulatory", label: "法規制・許認可・安全", related: ["technology", "business-model"] },
  { key: "disputes", label: "紛争・関連当事者・利益相反", related: [] },
  { key: "financial-projection", label: "財務・税務・借入・採算", related: ["cost-model"] },
  { key: "documents", label: "証憑・版・開示管理", related: ["business-model"] },
] as const;

/** 3領域のページ名。ワークスペースの旧キー cost/drive は同じページへ対応する。 */
export const PROJECT_PAGE_LABELS: Readonly<Record<string, string>> = {
  issues: "ゴールツリー", tasks: "タスク", gantt: "ガント", progress: "MS・月次", meetings: "動向・会議", slack: "Slack", weekly: "週次差分", partners: "関係先",
  "score-detail": "スコア詳細", technology: "技術", competition: "競合比較", "business-model": "ビジネスモデル", "business-plan": "事業計画", "financial-projection": "試算表", "capital-plan": "資本政策表", "cost-model": "コスト試算", cost: "コスト試算", ip: "知財",
  governance: "総会・取締役会・経営会議の決議", "technical-evidence": "技術実証の証拠", manufacturing: "製造・品質・供給", team: "経営陣・人員・雇用", contracts: "契約リスト", regulatory: "法規制・許認可・安全", disputes: "紛争・関連当事者・利益相反",
  documents: "ドライブ", drive: "ドライブ", overview: "PJ概要", "project-contracts": "契約", "project-finance": "収支", "monthly-reports": "月次報告書", company: "会社概要", "killer-factors": "キラー要素", "capital-policy": "資金調達履歴", activity: "沿革", seeds: "シーズ一覧", regulations: "規程一覧",
};

/** 開いたときのタブ。全PJ同じ。 */
export const DEFAULT_TABS = {
  cockpit: "issues",
  workspaceInternal: "weekly",
  workspaceExternal: "issues",
} as const;

/** 事業計画タブ。全PJで同じ「フェーズマトリクス」を描き、中身は project_business_plans のデータから出す。 */
export const BUSINESS_PLAN_FORMAT = {
  sections: [{ key: "phase-matrix", label: "フェーズマトリクス" }],
  lanes: [
    { key: "business", label: "事業開発" },
    { key: "technology", label: "技術開発" },
    { key: "organization", label: "組織開発" },
    { key: "funding", label: "資金調達" },
  ],
  xrl: [
    { key: "trl", label: "TRL" },
    { key: "brl", label: "BRL" },
    { key: "grl", label: "GRL" },
    { key: "srl", label: "SRL" },
    { key: "hrl", label: "HRL" },
  ],
} as const;

/** 試算表タブの区画。画面はこの順に、データの有無にかかわらず全区画を描く（無いところは「未登録」）。 */
export const FINANCE_FORMAT_SECTIONS = [
  { key: "dataset", label: "計画とケース" },
  { key: "summary", label: "要約" },
  { key: "timeline", label: "時間軸" },
  { key: "monthly-table", label: "月次試算表" },
  { key: "monthly-cash-chart", label: "月次の資金推移" },
  { key: "annual-chart", label: "年度別の事業・資金推移" },
  { key: "annual-table", label: "年度別数値" },
  { key: "notes", label: "前提と注記" },
] as const;

export type FinanceFormatSectionKey = (typeof FINANCE_FORMAT_SECTIONS)[number]["key"];

/** 要約の欄。 */
export const FINANCE_SUMMARY_ITEMS = [
  { key: "period", label: "期間" },
  { key: "revenue", label: "売上計" },
  { key: "expense", label: "費用計" },
  { key: "funding", label: "調達計（株式・融資・助成金）" },
  { key: "lowestCash", label: "最低の月末資金" },
  { key: "endingCash", label: "期末の月末資金" },
] as const;

/** 月次試算表 P/L の行。`kind: "calculated"` は他の行から計算する。 */
export const FINANCE_PL_ROWS = [
  { key: "revenue", label: "売上", kind: "input" },
  { key: "cogs", label: "売上原価", kind: "input" },
  { key: "grossProfit", label: "粗利", kind: "calculated" },
  { key: "personnel", label: "人件費", kind: "input" },
  { key: "rd", label: "研究開発費", kind: "input" },
  { key: "marketing", label: "販売促進費", kind: "input" },
  { key: "otherOpex", label: "その他販管費", kind: "input" },
  { key: "preincorporationSpend", label: "設立前PJ支出", kind: "calculated" },
  { key: "operatingProfit", label: "営業利益", kind: "calculated" },
] as const;

export type FinancePlRowKey = (typeof FINANCE_PL_ROWS)[number]["key"];

/** 月次試算表 C/F の行。 */
export const FINANCE_CASH_ROWS = [
  { key: "opening", label: "月初資金", kind: "balance" },
  { key: "operating", label: "営業C/F", kind: "flow" },
  { key: "investing", label: "設備投資", kind: "flow" },
  { key: "equity", label: "株式調達", kind: "flow" },
  { key: "loanDrawdown", label: "融資実行", kind: "flow" },
  { key: "loanRepayment", label: "融資返済", kind: "flow" },
  { key: "grant", label: "助成金等入金", kind: "flow" },
  { key: "net", label: "月次純C/F", kind: "total" },
  { key: "closing", label: "月末資金", kind: "total" },
  { key: "loanBalance", label: "月末借入残高", kind: "balance" },
] as const;

export type FinanceCashRowKey = (typeof FINANCE_CASH_ROWS)[number]["key"];

/** 月次表の補助行（出所・計上主体・BZM経済CF）。 */
export const FINANCE_AUX_ROWS = [
  { key: "source", label: "出所" },
  { key: "entity", label: "計上主体" },
  { key: "bzmEconomicCf", label: "BZM経済CF" },
] as const;

/** グラフ。どちらも棒は横並び、C/Fと資金は同じ目盛りの折れ線で重ねる（2026-09-30 まさ確定）。 */
export const FINANCE_CHARTS = {
  monthlyCash: {
    title: "月次の資金推移",
    bars: [
      { key: "inflow", label: "入金" },
      { key: "outflow", label: "出金" },
    ],
    line: { key: "closing", label: "月末資金" },
    guide: { key: "reserve", label: "手元資金の目安" },
  },
  annual: {
    title: "年度別の事業・資金推移",
    bars: [
      { key: "revenue", label: "売上" },
      { key: "expense", label: "費用" },
    ],
    line: { key: "net", label: "年次純C/F（調達・助成金を含む）" },
  },
} as const;

/** 年度別数値の行。 */
export const FINANCE_ANNUAL_ROWS = [
  { key: "revenue", label: "売上" },
  { key: "expense", label: "費用計" },
  { key: "cogs", label: "売上原価" },
  { key: "personnel", label: "人件費" },
  { key: "rd", label: "研究開発費" },
  { key: "marketing", label: "販売促進費" },
  { key: "otherOpex", label: "その他販管費" },
  { key: "operatingProfit", label: "営業利益" },
  { key: "equity", label: "株式調達" },
  { key: "loanNet", label: "融資（実行−返済）" },
  { key: "grant", label: "助成金等入金" },
  { key: "net", label: "年次純C/F" },
  { key: "closing", label: "年度末資金" },
  { key: "preincorporationSpend", label: "設立前PJ支出（NewCo P/L外）" },
] as const;

/** 金額の単位。表の外に一度だけ書き、セルには単位を付けない。 */
export const FINANCE_UNIT_LABEL = "単位：百万円";

// ---------------------------------------------------------------------------------------------
// コスト試算タブ（原価計算）の標準フォーマット
//
// 2026-10-03 まさ確定「原価計算は、フォーマットは共通させることを前提にcxのもちゃんと入れて」。
// どのPJのコスト試算も、同じ区画・同じ内訳の行・同じグラフで描く。計算のしかた（エンジン）だけはデータの形
// （project_cost_models.case_kind と明細・作業の有無）で選び、結果をこの標準の形へ流し込む（src/lib/project-cost-format.ts）。
// 画面は src/components/cockpit/ProjectCostFormat.tsx、入口は CockpitCostTab.tsx。
// SX の廃液・燃料の試算は、標準の画面へ移すまでの間だけ、それぞれの画面で描く（spec 3-23 §7「統一の残り」）。
// ---------------------------------------------------------------------------------------------

/**
 * コスト試算タブの区画。画面はこの順に描く。デスクトップでは「前提と作業」と「結果」を左右に並べ、
 * 数字を動かしたときの変化をスクロールせずに見られるようにする（2026-09-13 まさ確定の操作の形を全PJに広げる）。
 */
export const COST_FORMAT_SECTIONS = [
  { key: "selection", label: "試算とケース" },
  { key: "summary", label: "要約" },
  { key: "inputs", label: "前提と作業" },
  { key: "results", label: "ケースの比較と原価の内訳" },
  { key: "about", label: "この試算について" },
  { key: "cases", label: "ケースごとの内訳" },
  { key: "confidence", label: "この数字の確からしさ" },
  { key: "questions", label: "確認事項と出典" },
  { key: "lines", label: "前提・作業・費用明細" },
  { key: "history", label: "版の履歴と、この試算が答えていないこと" },
] as const;

export type CostFormatSectionKey = (typeof COST_FORMAT_SECTIONS)[number]["key"];

/** 要約の欄。金額は「円/単位」。単位（m³・L・台・kg など）はデータが持つ。 */
export const COST_SUMMARY_ITEMS = [
  { key: "total", label: "1単位あたりの総コスト" },
  { key: "price", label: "売価" },
  { key: "profit", label: "1単位あたりの利益（利益率）" },
  { key: "target", label: "成立ライン（総コスト目標）" },
  { key: "capex", label: "初期投資（CAPEX）" },
  { key: "opex", label: "毎年の費用（OPEX）" },
  { key: "volume", label: "年間の量" },
  { key: "hours", label: "作業工数（年）" },
] as const;

export type CostSummaryItemKey = (typeof COST_SUMMARY_ITEMS)[number]["key"];

/**
 * 原価の内訳の行（全PJ共通）。積み上げ棒もこの順・この色で描く。並びと色は SX の試算で色覚の見分けを
 * 検査済みの順をそのまま使う。PJごとの工程の呼び名（菌体費・FAMEにする・部材費など）は、行の「中身」としてデータが持つ。
 */
export const COST_BREAKDOWN_ROWS = [
  { key: "materials", label: "原料・部材", shortLabel: "原料", color: "#2a78d6", hint: "製品や処理に使う原料・部材。自社でつくる中間品（菌体など）は、その原価を量で掛けて入れる" },
  { key: "logistics", label: "運ぶ（物流）", shortLabel: "運ぶ", color: "#eb6834", hint: "巡回・輸送・出荷など、ものを運ぶ作業と経費" },
  { key: "labor", label: "作業（運転・保守・管理）", shortLabel: "作業", color: "#4a3aa7", hint: "運ぶ以外の作業。工数 × 作業単価 ＋ 1回の経費" },
  { key: "post", label: "後処理・外注", shortLabel: "後処理", color: "#e87ba4", hint: "使い終わったものの処理と、外部に委託する工程" },
  { key: "supplies", label: "消耗品・電力・施設", shortLabel: "消耗品など", color: "#eda100", hint: "消耗品・交換部品・電力・熱・分析と、工場の賃料・光熱費" },
  { key: "equipment", label: "設備の償却", shortLabel: "償却", color: "#16a3b8", hint: "設備の初期投資 ÷ 耐用年数を、年間の量で割った額" },
  { key: "other", label: "その他", shortLabel: "その他", color: "#8e8e93", hint: "上の行に入らない費用" },
] as const;

export type CostBreakdownRowKey = (typeof COST_BREAKDOWN_ROWS)[number]["key"];

/** グラフ。どちらも金額は「円/単位」で、売価は破線、総コスト目標は点線で重ねる。 */
export const COST_CHARTS = {
  comparison: {
    title: "ケースの比較",
    bars: "breakdownRows",
    lines: [
      { key: "price", label: "売価", style: "dashed" },
      { key: "target", label: "総コスト目標", style: "dotted" },
    ],
  },
  breakdown: {
    title: "原価の内訳",
    bars: "breakdownRows",
  },
} as const;

/** 前提と作業の並べ方。前提・明細・作業を、条件・CAPEX・OPEX の3つに分け、その中を小分けにする（2026-09-14 まさ確定）。 */
export const COST_INPUT_BLOCKS = [
  { key: "conditions", label: "条件（量と売価）" },
  { key: "capex", label: "CAPEX（初期投資）" },
  { key: "opex", label: "OPEX（毎年の費用）" },
] as const;

export type CostInputBlockKey = (typeof COST_INPUT_BLOCKS)[number]["key"];

/** 確度の段階（project_cost_* の confidence）。S が一番確かで、H は仮説。 */
export const COST_CONFIDENCE_GRADES = [
  { key: "S", label: "S 確定" },
  { key: "A", label: "A 概算" },
  { key: "B", label: "B 見積前" },
  { key: "C", label: "C 仮置き" },
  { key: "H", label: "H 仮説" },
] as const;

// ---------------------------------------------------------------------------------------------
// PJ概要タブ（PJ管理）の標準フォーマット
//
// 2026-10-04 まさ確定「1で進めて」（PJ概要に載せる項目の案: PJの定義5項目・今の状態4項目）。
// 前段の指摘「これは会社の概要じゃなくてPJの概要なわけだから、もっとPJとしての情報が必要なのでは？」
// 「そもそも概要って、PJ作ったときに作ったら、それ以降書き換えることはないのでは？」。
// - PJの定義は、PJを作るときに決めて、めったに変えない。直せるのは管理者だけ。
// - 今の状態は、ほかのタブ（ゴールツリー・契約・収支・動向）のデータから自動で出す。このタブでは書かない。
// - 事業の一言（何をする事業か）は会社の話なので、会社情報 > 会社概要の「事業の概要」に置く。
// 画面は src/components/cockpit/ProjectOverviewFormat.tsx。AMD本体の PJ概要は会社の経営スコアのまま。
// ---------------------------------------------------------------------------------------------

/** PJ概要の2つのまとまり。画面はこの順に描く。 */
export const PROJECT_OVERVIEW_GROUPS = [
  { key: "definition", label: "PJの定義", hint: "PJを作るときに決めて、めったに変えない。直せるのは管理者だけ" },
  { key: "status", label: "今の状態", hint: "ほかのタブのデータから自動で出す。ここでは書かない" },
] as const;

export type ProjectOverviewGroupKey = (typeof PROJECT_OVERVIEW_GROUPS)[number]["key"];

/** PJ概要の項目（9つ）。画面はこの順に、データの有無にかかわらず全項目を描く（無いところは「未登録」）。 */
export const PROJECT_OVERVIEW_SECTIONS = [
  { key: "purpose", group: "definition", label: "PJの目的", hint: "何ができたらこのPJは成功か。ゴールツリーのいちばん上（到達点）" },
  { key: "counterpart", group: "definition", label: "相手", hint: "契約先、出身の研究機関と研究者、元になる技術" },
  { key: "involvement", group: "definition", label: "AMDの関わり方", hint: "自分たちで会社を創る・受託・顧問 など" },
  { key: "revenue", group: "definition", label: "AMDの報酬形態", hint: "業務委託料・顧問料・成功報酬・株式 など。金額と時期は契約・収支・資本政策表から出す" },
  { key: "team", group: "definition", label: "期間と体制", hint: "AMDが関わる期間、AMD側の担当、先方の窓口" },
  { key: "stage", group: "status", label: "今の段階と次の節目", hint: "段階と設立、ゴールツリーの次のMS" },
  { key: "contract", group: "status", label: "契約と収支", hint: "「契約」と「収支」のタブの要約" },
  { key: "open", group: "status", label: "まだ決まっていないこと", hint: "開いている論点と、承認待ちの数" },
  { key: "signals", group: "status", label: "最近の重要な動き", hint: "「動向・会議」で確かめた重要な動き" },
] as const;

export type ProjectOverviewSectionKey = (typeof PROJECT_OVERVIEW_SECTIONS)[number]["key"];

/**
 * AMDの報酬形態の種類（project_definitions.revenue_streams の kind）。
 * DB の CHECK（migration 468 の project_revenue_streams_valid）と同じ並び。
 */
export const AMD_REVENUE_KINDS = [
  { key: "contract_fee", label: "業務委託料" },
  { key: "advisory_fee", label: "顧問料" },
  { key: "success_fee", label: "成功報酬" },
  { key: "os_fee", label: "AMD OSの利用料" },
  { key: "equity", label: "株式" },
  { key: "other", label: "その他" },
] as const;

export type AmdRevenueKindKey = (typeof AMD_REVENUE_KINDS)[number]["key"];
