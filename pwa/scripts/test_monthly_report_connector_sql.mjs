#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prepareMonthlyReportConnectorSql } from "./prepare_monthly_report_connector_sql.mjs";

const headings = ["概要", "今月進んだこと", "重要な判断・合意", "顧客・共同研究・外部関係者の動き", "技術・知財・実験・資料", "リスク・未確定事項", "来月の焦点", "根拠"];
const overview = "当月は共同研究に向けた実験条件の確認を進め、試験で比較する対象と評価指標を関係者間で確認した。並行して事業化支援の申請資料を作成し、必要な技術データと市場調査の不足を明らかにした。試験日程と外部機関との契約条件は協議中であり、次月は資料の完成と確認事項への回答を進める。";
const paragraph = "共同研究では試験対象と評価条件を研究チームと協議した。既存の実験記録から比較に必要な条件を確認し、未確定の測定方法は関係者間で継続して確認することとした。事業化支援では申請資料に必要な項目を確認し、技術の適用条件と市場の見通しを分けて記載した。これにより、次回の協議で判断する項目と資料の不足が明確になった。";
const content = headings.map((h) => `## ${h}\n\n${h === "概要" ? overview : h === "根拠" ? "10月15日 共同研究の試験条件に関する打合せ。" : `${paragraph}\n\n${paragraph}`}`).join("\n\n");
const item = { project_id: "p00", ym: "209901", final_content: content, draft_content: content };
const outbox = { monthlyReports: [item] };
const result = prepareMonthlyReportConnectorSql(outbox);
if (process.argv[2]) fs.writeFileSync(process.argv[2], result.sql.replace("COMMIT;", "ROLLBACK;"), { mode: 0o600 });
assert.equal(result.reports.length, 1);
assert.match(result.sql, /ON CONFLICT \(project_id, ym\) DO NOTHING/);
assert.match(result.sql, /pg_advisory_xact_lock/);
assert.match(result.sql, /content_matches/);
assert.doesNotMatch(result.sql, /SUPABASE_SERVICE_ROLE_KEY|CREATE |ALTER |DELETE FROM|DO UPDATE/);
for (const patch of [{ ym: "209913" }, { project_id: "p00'; DROP TABLE projects;--" }, { force: true }, { strict: false }, { final_content: "本文不足" }]) {
  assert.throws(() => prepareMonthlyReportConnectorSql({ monthlyReports: [{ ...item, ...patch }] }));
}
assert.throws(() => prepareMonthlyReportConnectorSql({ monthlyReports: [item, item] }), /Duplicate/);
assert.throws(() => prepareMonthlyReportConnectorSql({}), /nonempty/);
assert.throws(() => prepareMonthlyReportConnectorSql({ monthlyReportsExternal: [{ project_id: "p00", ym: "2099-01", reference_project_id: "p19", reference_ym: "2098-12" }] }), /same project/);
const externalBody = `# 月次業務報告書\n\n| 項目 | 内容 |\n|---|---|\n| 件名 | 月次業務報告書 |\n\n## 業務概要\n\n${paragraph.repeat(12)}\n\n## 当月の実施内容\n\n${paragraph.repeat(12)}\n\n以上のとおり報告する。`;
const externalItem = { project_id: "p00", ym: "2099-01", body_md: externalBody,
  reference_project_id: "p00", reference_ym: "2098-12", reference_body_md: externalBody,
  internal_content_md5: result.reports[0].content_md5 };
const externalResult = prepareMonthlyReportConnectorSql({ monthlyReportsExternal: [externalItem] });
assert.equal(externalResult.reports[0].kind, "external");
assert.match(externalResult.sql, /Previous submitted report changed/);
assert.match(externalResult.sql, /Saved internal report does not match/);
assert.throws(() => prepareMonthlyReportConnectorSql({ monthlyReportsExternal: [{ ...externalItem, body_md: externalBody.replace("## 業務概要", "## 異なる書式") }] }), /フォーマット/);
assert.throws(() => prepareMonthlyReportConnectorSql({ monthlyReportsExternal: [{ ...externalItem, body_md: externalBody.replace("## 業務概要", "## 業務概要\n\nAMD Score") }] }), /jargon/);
assert.throws(() => prepareMonthlyReportConnectorSql({ monthlyReportsExternal: [{ ...externalItem, internal_content_md5: null }] }), /hash/);
assert.throws(() => prepareMonthlyReportConnectorSql({ monthlyReportsExternal: [{ ...externalItem, reference_source: "submitted_drive", reference_source_url: "https://untrusted.example" }] }), /source URL/);
// A report may contain SQL-looking source text; it must remain inside JSON data,
// including attempts to close the surrounding procedural block.
const attack = `${content}\n\n$monthly_apply$; SELECT 'inert'; --`;
const escaped = prepareMonthlyReportConnectorSql({ monthlyReports: [{ ...item, final_content: attack, draft_content: attack }] });
const outer = escaped.sql.match(/DO (\$monthly_apply_[a-f0-9]+\$)/)[1];
assert.equal(escaped.sql.split(outer).length, 3);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "amie-monthly-connector-test-"));
try {
  const file = path.join(dir, "outbox.json");
  const sqlFile = path.join(dir, "validated.sql");
  fs.writeFileSync(file, JSON.stringify(outbox));
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", CRON_SECRET: "" };
  const root = path.resolve(import.meta.dirname, "..");
  const validation = JSON.parse(execFileSync(process.execPath, [path.join(import.meta.dirname, "ms_progress_review_tool.mjs"), "validate-monthly-report", "--file", file], { cwd: dir, env, encoding: "utf8" }));
  assert.equal(validation.ok, true);
  const compiled = JSON.parse(execFileSync(process.execPath, [path.join(import.meta.dirname, "prepare_monthly_report_connector_sql.mjs"), "--file", file, "--out", sqlFile], { cwd: dir, env, encoding: "utf8" }));
  assert.equal(compiled.ok, true);
  assert.equal(fs.readFileSync(sqlFile, "utf8"), result.sql);
  assert.throws(() => execFileSync(process.execPath, [path.join(root, "scripts/ms_progress_review_tool.mjs"), "upsert-monthly-reports", "--file", file], { cwd: dir, env, encoding: "utf8", stdio: "pipe" }), /required/);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log("monthly report connector: offline validation, immutable SQL, injection safety, and credential boundaries passed");
