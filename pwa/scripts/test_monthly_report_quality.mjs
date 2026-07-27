#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

assert.equal(validate(report()).ok, true, "8見出しのナラティブ本文は通る");
assert.equal(validate(report({ 概要: "既存draft生成後にL2件数を確認した。" })).ok, false, "生成作業ログ入り概要は落ちる");
assert.equal(validate(report({ 今月進んだこと: "決定/確認: 生データを貼った。" })).ok, false, "生の決定行は落ちる");
assert.equal(validate(report({ "重要な判断・合意": "判断を途中まで書いた…" })).ok, false, "省略された本文は落ちる");
assert.equal(validate(report({ "技術・知財・実験・資料": "eLADへの入力内容を確認した。" })).ok, true, "eLADはe-Radへ正規化して通る");

const duplicate = `${report()}\n\n## 概要\n重複。`;
assert.equal(validate(duplicate, "final_content").ok, false, "見出し重複はfinal_contentでも落ちる");

console.log("monthly report quality guard: ok");
