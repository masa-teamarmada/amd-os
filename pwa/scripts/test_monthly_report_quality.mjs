#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const headings = [
  "概要",
  "今月進んだこと",
  "重要な判断・合意",
  "顧客・共同研究・外部関係者の動き",
  "技術・知財・実験・資料",
  "リスク・未確定事項",
  "来月の焦点",
  "根拠",
];

function report(overrides = {}) {
  return headings.map((heading) => `## ${heading}\n${overrides[heading] || `${heading}を文章で整理した。`}`).join("\n\n");
}

function validate(content, field = "draft_content") {
  const dir = mkdtempSync(path.join(tmpdir(), "amd-os-monthly-quality-"));
  const file = path.join(dir, "input.json");
  writeFileSync(file, JSON.stringify({ monthlyReports: [{ project_id: "p25", ym: "202607", [field]: content }] }));
  try {
    const stdout = execFileSync(process.execPath, ["scripts/ms_progress_review_tool.mjs", "validate-monthly-report", "--file", file], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
    });
    return JSON.parse(stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function externalReport({ short = false } = {}) {
  const sections = [
    "1. 業務概要",
    "2. 当月の実施内容",
    "3. 第一領域：規程策定支援",
    "4. 第二領域：起業シーズ掘り起こし",
    "5. 第三領域：自治体等との連携・ファンド形成",
    "6. 体制および打合せ実施記録",
    "7. 主要成果物",
    "8. その他活動",
    "9. 来月以降の予定",
  ];
  const paragraph = short ? "実施内容を整理した。" : "当月の証跡を業務領域ごとに統合し、経緯、実施内容、判断、未確定事項、次の工程が連続して理解できる報告文として整理した。".repeat(8);
  return [
    "# 月次業務報告書",
    "| 項目 | 内容 |\n|---|---|\n| 件名 | 月次業務報告書 |",
    ...sections.map((section, index) => `## ${section}\n\n${paragraph}\n\n${index === 1 || index === 5 ? "| 項目 | 内容 |\n|---|---|\n| 実施 | 完了 |" : ""}`),
    "以上のとおり報告する。",
  ].join("\n\n");
}

function validateExternal(content) {
  const dir = mkdtempSync(path.join(tmpdir(), "amd-os-monthly-external-quality-"));
  const file = path.join(dir, "input.json");
  writeFileSync(file, JSON.stringify({ monthlyReportsExternal: [{ project_id: "p25", ym: "2026-07", body_md: content }] }));
  try {
    const stdout = execFileSync(process.execPath, ["scripts/ms_progress_review_tool.mjs", "validate-monthly-report-external", "--file", file], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
    });
    return JSON.parse(stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

assert.equal(validate(report()).ok, true, "8見出しのナラティブ本文は通る");
assert.equal(validate(report({ 概要: "既存draft生成後にL2件数を確認した。" })).ok, false, "生成作業ログ入り概要は落ちる");
assert.equal(validate(report({ 今月進んだこと: "決定/確認: 生データを貼った。" })).ok, false, "生の決定行は落ちる");
assert.equal(validate(report({ "重要な判断・合意": "判断を途中まで書いた…" })).ok, false, "省略された本文は落ちる");
assert.equal(validate(report({ "技術・知財・実験・資料": "eLADへの入力内容を確認した。" })).ok, true, "eLADはe-Radへ正規化して通る");

const duplicate = `${report()}\n\n## 概要\n重複。`;
assert.equal(validate(duplicate, "final_content").ok, false, "見出し重複はfinal_contentでも落ちる");
assert.equal(validateExternal(externalReport()).ok, true, "9章・表・十分な本文を持つ提出版は通る");
assert.equal(validateExternal(externalReport({ short: true })).ok, false, "短い要約だけの提出版は落ちる");

const printClient = readFileSync(new URL("../src/app/(app)/project/[projectId]/report/[ym]/print/print-client.tsx", import.meta.url), "utf8");
const printRoute = readFileSync(new URL("../src/app/api/project/monthly-report-print/route.ts", import.meta.url), "utf8");
assert.match(printClient, /isMarkdownTableSeparator/, "提出版のMarkdown表を構造化して描画する");
assert.match(printClient, /className="md-table"/, "提出版の表に印刷用スタイル契約がある");
assert.match(printClient, /replace\(\/\^#\\s\+月次業務報告書/, "帳票タイトルと本文H1を二重表示しない");
assert.match(printClient, /function SubmissionReport/, "提出版は実提出書式専用の連続文書コンポーネントを使う");
assert.match(printClient, /data\.isSubmission\s*\?\s*\([\s\S]{0,120}<SubmissionReport data=\{data\}/, "提出版と社内レビュー帳票を分離する");
assert.match(printClient, /<CoverPage data=\{data\} \/>[\s\S]*<AppendixSection data=\{data\} \/>/, "社内版の既存リッチ帳票構成は維持する");
assert.match(printClient, /\.submission-sheet \{[\s\S]*page-break-after: auto; break-after: auto;/, "提出版は章ごとの強制改頁を入れない");
assert.match(printClient, /\.submission-sheet \.md-body h2/, "提出版の章見出しに専用の視覚階層がある");
assert.match(printRoute, /は\|が\|を\|も\|へ\|の\|から\|より/, "提出版氏名置換は所有の助詞「の」も扱う");
assert.match(printRoute, /A-Za-z0-9/, "提出版氏名置換は助詞直後が英数字でも扱う");

console.log("monthly report quality guard: ok");
