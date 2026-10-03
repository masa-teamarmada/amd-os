/**
 * PJタイプ別の標準フォーマット（正本: spec/3-23-project-format-current-spec.md）。
 *
 * 2026-10-03 まさ確定「すべてのPJについて、同じフォーマットで表示する設計にして。
 * 勝手にそれを書き換えないように制限をかけてほしい。新たなデータが入るときには、新たなグラフを
 * 入れるんじゃなくて、フォーマットで生成されているグラフにその数値データを入れる形にしてほしい」。
 *
 * - 画面はこの定義の順に区画を描く。PJ番号で表示を分けない。PJごとの違いはデータだけで出す。
 * - 新しい種類の数字が来たら、下の行・グラフのどれに入るかを決めてデータ側で渡す。区画やグラフを足さない。
 * - **このファイルは鍵付き**。中身を変えると `project-format.lock.json` の sha256 と合わなくなり、
 *   `npm run test:project-format`（本番反映の前に必ず走る）が止める。変えてよいのは、まさが明示で
 *   承認したときだけ。承認の言葉を lock の approvals に足してから sha256 を更新する。
 */

/** PJタイプ。`projects.project_category` から決める（顧問PJは会社の試算表なので大学発SUと同じ形）。 */
export type ProjectFormatType = "su" | "new_business" | "ecosystem";

export const PROJECT_FORMAT_TYPES: ReadonlyArray<{
  type: ProjectFormatType;
  label: string;
  categories: readonly string[];
  hasFinanceTab: boolean;
}> = [
  { type: "su", label: "大学発SU", categories: ["dtsu", "advisor"], hasFinanceTab: true },
  { type: "new_business", label: "新規事業", categories: ["new_business"], hasFinanceTab: true },
  { type: "ecosystem", label: "研究機関エコシステム", categories: ["ecosystem"], hasFinanceTab: false },
];

export function projectFormatTypeOf(projectCategory: string | null | undefined): ProjectFormatType {
  const category = projectCategory || "dtsu";
  return PROJECT_FORMAT_TYPES.find((entry) => entry.categories.includes(category))?.type ?? "su";
}

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
