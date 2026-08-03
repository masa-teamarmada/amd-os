import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  changedMonthlyReportSections,
  diffMonthlyReportLines,
} from "../src/lib/monthly-report-history.ts";

const before = [
  "# 月次報告書",
  "冒頭説明",
  "## 今月の進捗",
  "変更前の本文",
  "## 次月計画",
  "変更なし",
].join("\n");
const after = [
  "# 月次報告書",
  "冒頭説明",
  "## 今月の進捗",
  "変更後の本文",
  "## 次月計画",
  "変更なし",
].join("\n");

assert.deepEqual(
  changedMonthlyReportSections(before, after),
  ["今月の進捗"],
  "同じ見出し内の本文変更を章名で検出する",
);
assert.deepEqual(changedMonthlyReportSections(before, before), [], "無変更は空配列");
assert.deepEqual(
  changedMonthlyReportSections(before, `${after}\n## 新しい章\n追加本文`),
  ["今月の進捗", "新しい章"],
  "変更章と追加章を順序どおり返す",
);

const rows = diffMonthlyReportLines(before, after);
assert(rows.some((row) => row.kind === "removed" && row.text === "変更前の本文"));
assert(rows.some((row) => row.kind === "added" && row.text === "変更後の本文"));
assert.equal(
  rows.filter((row) => row.kind !== "added").map((row) => row.text).join("\n"),
  before,
  "差分から変更前全文を復元できる",
);
assert.equal(
  rows.filter((row) => row.kind !== "removed").map((row) => row.text).join("\n"),
  after,
  "差分から変更後全文を復元できる",
);
assert.deepEqual(
  diffMonthlyReportLines("", "新規本文"),
  [{ kind: "added", beforeLine: null, afterLine: 1, text: "新規本文" }],
  "初回生成では存在しない空行を変更前として表示しない",
);

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const migration = read("scripts/migrations/223_monthly_report_edit_history.sql");
const internalApi = read("src/app/api/monthly-report/manual-update/route.ts");
const externalApi = read("src/app/api/monthly-report/external-manual-update/route.ts");
const fixApi = read("src/app/api/report/fix/route.ts");
const historyApi = read("src/app/api/monthly-report/history/route.ts");
const historyUi = read("src/app/(app)/project/[projectId]/report/[ym]/print/monthly-report-history-panel.tsx");
const printClient = read("src/app/(app)/project/[projectId]/report/[ym]/print/print-client.tsx");

assert.match(migration, /monthly_reports_history_capture/u, "社内版の直接writerもtriggerで捕捉");
assert.match(migration, /monthly_reports_external_history_capture/u, "提出版の直接writerもtriggerで捕捉");
assert.match(migration, /monthly_report_internal_save/u, "社内版はatomic RPC");
assert.match(migration, /monthly_report_external_save/u, "提出版はatomic RPC");
assert.match(migration, /detail_available[^;]+false/iu, "過去分は詳細差分なしでseed");
assert.match(migration, /confirmed_by = p_actor_label/u, "確定者をDBへ保存");
assert.match(migration, /pg_advisory_xact_lock/iu, "同じ月への並行保存を直列化");
assert.match(migration, /monthly_report_edit_history_append_only/iu, "履歴は追記専用");
assert.match(migration, /COALESCE\(public\.is_admin\(\), false\)/iu, "RPC自体もadminまたはservice roleだけを許可");

for (const [name, source] of [["internal", internalApi], ["external", externalApi], ["fix", fixApi]] as const) {
  assert.match(source, /requireAdmin\(\)/u, `${name}保存APIはadmin-only`);
  assert.match(source, /\.rpc\("monthly_report_/u, `${name}保存APIはatomic RPCを使う`);
}
assert.match(historyApi, /detail_available,source,created_at/u, "一覧は全文をselectしない");
assert.match(historyApi, /id,content_before,content_after,detail_available/u, "詳細を開いた時だけ全文を取得");
assert.match(historyUi, /role="dialog"/u, "履歴はdialogとして開く");
assert.match(historyUi, /event\.key === "Escape"/u, "Escapeで閉じる");
assert.match(historyUi, /reportKind === tab/u, "社内版と提出版を分離");
assert.match(printClient, /MonthlyReportHistoryPanel/u, "印刷画面に履歴UIを配置");
assert.match(printClient, /版・発行履歴/u, "印刷物は節目だけの版・発行履歴");

console.log("monthly report history tests: ok");
