import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { DD_PAGE_KEYS, DD_EMPTY_PAGE_KEYS, ddPageForItem, isDdEmptyPageKey, ddPageLabel } from "../src/lib/dd-pages.ts";
import { COCKPIT_TAB_FORMATS, WORKSPACE_TAB_FORMATS, DD_TAB_FORMAT, DD_ITEM_PAGES, PROJECT_PAGE_LABELS, type ProjectFormatType } from "../src/lib/project-formats.ts";
import { DD_SHARED_PAGE_KEYS } from "../src/lib/dd-package-core.ts";
import type { DdLiveData } from "../src/lib/dd-payload.ts";

for (const [kind, page] of [["document", "documents"], ["funding_plan", "financial-projection"], ["capital_policy", "capital-plan"], ["cost_model", "cost-model"], ["tech_topic", "technology"]] as const) {
  assert.equal(ddPageForItem(kind, null), page);
}
for (const [domain, page] of [["競合比較", "competition"], ["ビジネスモデル", "business-model"], ["QA", "technology"]] as const) {
  const live = { kind: "tech_topic", topic: { tech_domain: domain } } as unknown as DdLiveData;
  assert.equal(ddPageForItem("tech_topic", live), page, "DDでも技術台帳と同じ区分で振り分ける");
}
const canonical = (tab: string) => tab === "cost" ? "cost-model" : tab === "drive" ? "documents" : tab;
const dd = new Set<string>(DD_PAGE_KEYS);
assert.equal(dd.size, 23, "18 document entries plus five preserved legacy page URLs");
assert.equal(DD_ITEM_PAGES.length, 18);
assert.deepEqual(DD_ITEM_PAGES.map(page => page.label), [
  "会社概要",
  "資本政策表",
  "株主名簿",
  "次回ラウンドタームシート",
  "総会・取締役会・経営会議議事録",
  "事業計画書・開発計画書",
  "市場調査・競合比較資料",
  "顧客・販売先リスト",
  "技術・製品説明資料",
  "技術実証報告書",
  "製造・品質管理・供給体制資料",
  "知財一覧・大学との権利契約",
  "経営陣略歴・従業員名簿",
  "契約リスト",
  "許認可一覧・安全性評価資料",
  "訴訟・関連当事者取引一覧",
  "収支計画書",
  "開示資料一覧"
]);
assert.equal(new Set(DD_ITEM_PAGES.map(page => page.key)).size, 18);
for (const item of DD_ITEM_PAGES) {
  assert.ok(dd.has(item.key));
  assert.equal(ddPageLabel(item.key), item.label);
  for (const related of item.related) assert.ok(dd.has(related), "related pages remain accessible");
}
assert.ok(dd.has("shareholder-register") && dd.has("next-round-term-sheet"));
assert.ok(isDdEmptyPageKey("shareholder-register") && isDdEmptyPageKey("next-round-term-sheet"), "計画の株主や試算を正式な名簿・タームシートへ読み替えない");
for (const page of DD_EMPTY_PAGE_KEYS) assert.ok(isDdEmptyPageKey(page));
assert.ok(!isDdEmptyPageKey("killer-factors"));
assert.ok(!dd.has("killer-factors"));
for (const page of DD_SHARED_PAGE_KEYS) {
  assert.equal(ddPageForItem("project_page", null, `project_page:${page}`), page);
  assert.equal(ddPageForItem("project_page", { kind: "project_page", page } as DdLiveData), page);
}
assert.throws(() => ddPageForItem("project_page", null, "project_page:slack"));
assert.equal(PROJECT_PAGE_LABELS.activity, "沿革");
assert.equal(dd.has("list"), false);
const allCockpit = new Set(Object.values(COCKPIT_TAB_FORMATS).flatMap(groups => groups.flatMap(g => [...g.tabs])));
for (const key of dd) assert.ok((allCockpit.has(key) || isDdEmptyPageKey(key)) && PROJECT_PAGE_LABELS[key], `${key}は共通ページまたは新しい資料区分`);
let matrix = "# 3つの領域で表示するページ\n\n◯はページを表示する。空欄は表示しない。公開内容が未登録でも、DDのページ入口は残し、本文に未登録と出す。\n\n閲覧者は、コックピット＝社内の許可されたメンバー、ワークスペース＝当該PJの参加者、DD＝当該パッケージの閲覧権限を付与した人。内部管理者のアクセスは既存どおり。\n\n";
for (const [type, label] of [["su", "大学発SU・顧問PJ・新規事業"], ["ecosystem", "研究機関エコシステム"], ["amd", "チームアルマダ本体"]] as const) {
  const groups = COCKPIT_TAB_FORMATS[type as ProjectFormatType];
  const cockpit = new Set(groups.flatMap(g => [...g.tabs]));
  const workspace = new Set(WORKSPACE_TAB_FORMATS[type as ProjectFormatType].flatMap(g => [...g.tabs].map(canonical)));
  const rows = [...new Set([...cockpit, ...workspace, ...dd])];
  matrix += `## ${label}\n\n| ページ | コックピット | ワークスペース | DDパッケージ |\n|---|:---:|:---:|:---:|\n`;
  for (const key of rows) matrix += `| ${PROJECT_PAGE_LABELS[key]} | ${cockpit.has(key) ? "◯" : ""} | ${workspace.has(key) ? "◯" : ""} | ${dd.has(key) ? "◯" : ""} |\n`;
  matrix += "\n";
}
matrix += "DDの技術・競合比較・ビジネスモデルは `CockpitTechnology` でページ全体を表示する。掲載項目への追加や個別公開は本文の表示条件ではない。試算表・資本政策表・コスト試算・会社概要も省略版を作らず、共通ページのデータと部品を使う。キラー要素カタログは会社概要から切り出した独立ページ。全PJでコックピットの会社情報に常設し、ワークスペース・DDにはページを置かない。会社概要の本文と出力は3領域で共通に保つ（2026-10-06、v3.159.9）。契約リストも3領域共通の本文を使用する。DDでは「DDに表示」がオンの採用済み契約だけをserverで取得し、編集操作は表示しない。ドライブの共有ファイル選択、DDの入場権限、書込み・ダウンロードの権限は独立して保つ。\n\n正本は `src/lib/project-formats.ts` の3領域のフォーマットと共通ページ名、元データの対応は `src/lib/dd-pages.ts`。新規事業は大学発SUと同じ定義。project_pageの7キー（migration 469）は正式版PDFの互換項目用に保持する。ワークスペースの動向・会議／Slackは当該PJの参加者の読み取りに限る。理論変更なし。\n";
if (process.argv.includes("--write-matrix")) writeFileSync(new URL("../spec/3-24-project-surface-pages-current-spec.md", import.meta.url), matrix);
console.log("DD page routing and shared page format: ok");
