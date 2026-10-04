import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { DD_PAGE_KEYS, ddPageForItem } from "../src/lib/dd-pages.ts";
import { COCKPIT_TAB_FORMATS, WORKSPACE_TAB_FORMATS, DD_TAB_FORMAT, PROJECT_PAGE_LABELS, type ProjectFormatType } from "../src/lib/project-formats.ts";
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
assert.equal(dd.size, 14);
for (const page of DD_SHARED_PAGE_KEYS) {
  assert.equal(ddPageForItem("project_page", null, `project_page:${page}`), page);
  assert.equal(ddPageForItem("project_page", { kind: "project_page", page } as DdLiveData), page);
}
assert.throws(() => ddPageForItem("project_page", null, "project_page:slack"));
assert.equal(PROJECT_PAGE_LABELS.activity, "沿革");
assert.equal(dd.has("list"), false);
const allCockpit = new Set(Object.values(COCKPIT_TAB_FORMATS).flatMap(groups => groups.flatMap(g => [...g.tabs])));
for (const key of dd) assert.ok(allCockpit.has(key) && PROJECT_PAGE_LABELS[key], `${key}は他領域と共通のページ`);
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
matrix += "DDの技術ページ内には、公開対象に選んだQAなどの技術台帳の内容を表示する。コスト試算の燃料も同じページ内。ドライブにはDDに公開対象として選んだ資料を表示する。公開設定・停止・失効・正式版PDFは設定画面で扱い、閲覧画面に専用のプレビュー帯や一覧ページを足さない。\n\n正本は `src/lib/project-formats.ts` の3領域のフォーマットと共通ページ名、元データの対応は `src/lib/dd-pages.ts`。新規事業は大学発SUと同じ定義。DD追加7ページは project_page:<ページキー> として選択・公開する。migration 469 で許容キーを7種類に限定。ワークスペースの動向・会議／Slackは当該PJの参加者の読み取りに限る。理論変更なし。\n";
if (process.argv.includes("--write-matrix")) writeFileSync(new URL("../spec/3-24-project-surface-pages-current-spec.md", import.meta.url), matrix);
console.log("DD page routing and shared page format: ok");
