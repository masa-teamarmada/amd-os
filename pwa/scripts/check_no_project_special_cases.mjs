#!/usr/bin/env node
/**
 * 特定のPJだけの処理を、OSのコード・自動処理の指示書・Mac/iPhone アプリへ戻さない検査。
 *
 * 2026-10-04 まさ「どれか特定のPJだけの処理は実装しないで。使える機能なら全PJに適用して。
 * OSはあくまでシステムとして開発してるので、特定のPJだけの特例を入れたらシステムにならない。」
 *
 * PJごとに違ってよいのは「設定（データ）」だけ。設定は DB の列（例: projects.task_point_review_from_ym・
 * legacy_task_ledger_read_only・external_research_topics、project_management_milestones.gate_kind、
 * project_knowledge の alias）に置き、コードは全PJ同じ決まりで読む。正本は spec 3-23 §6。
 *
 * 見るもの:
 *   1. pwa/src の .ts / .tsx（コメントの行は見ない）: PJ番号の文字列（"p21" など）と、PJ番号を鍵にした表（p21: …）。
 *   2. pwa/src: PJ名との比較（projectName === "SOL" など）。
 *   3. pwa/scheduled-tasks の指示書: 「p21だけ」「p21 only」のような、特定のPJだけに効く手順（会社そのもの p00 は除く）。
 *   4. Mac / iPhone アプリの Swift: PJ番号との比較（projectId == "p25" など）。
 *
 * 例外は下の ALLOWED に、理由つきで書いたファイルだけ。新しい例外を足すときは、それが「処理」ではなく
 * 「全PJに同じ形で持つ設定の表」であることを理由に書く。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pwaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pwaRoot, "..");

/** PJ番号の文字列・表を持ってよいファイル（理由つき）。 */
const ALLOWED = new Map([
  ["pwa/src/lib/project-formats.ts", "会社そのもの（AMD）を表す AMD_COMPANY_PROJECT_ID の定義（PJタイプ amd）"],
  ["pwa/src/lib/calendar-pj-color.ts", "Google カレンダーの色とPJ略称の対応表。全PJに同じ形で持つ設定の表"],
  ["pwa/src/lib/bzm-2-2-pilot-ui.server.ts", "PJごとに生成した BZM 2.2 の数値ファイルの読み込み口。全PJ同じ形の生成物の目録"],
]);

const PJ_ID_LITERAL = /["'`]p(0[0-9]|[1-3][0-9])["'`]/;
const PJ_ID_KEY = /(^|[{,\s])p(0[0-9]|[1-3][0-9])\s*:/;
const PJ_NAME_COMPARE = /(?<!typeof\s+[\w.?]*)\b(projectName|project_name|displayName|display_name|pjCode|report_local_alias)\b\s*(===|!==|==|!=)\s*["'`]([^"'`]+)["'`]/;
const TYPEOF_RESULTS = new Set(["string", "number", "boolean", "undefined", "object", "function", "bigint", "symbol"]);
function comparesWithProjectName(code) {
  const match = code.match(PJ_NAME_COMPARE);
  return Boolean(match) && !TYPEOF_RESULTS.has(match[3]);
}
const SKILL_PJ_ONLY = /p(0[1-9]|[1-3][0-9])`?\s*(だけ|のみ|専用|only)|(だけ|のみ)\s*[（(]`?p(0[1-9]|[1-3][0-9])/;
const SWIFT_PJ_COMPARE = /projectId\s*(==|!=)\s*"p\d{2}"/;

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.some((ext) => name.endsWith(ext))) out.push(full);
  }
  return out;
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*");
}

const errors = [];
const rel = (file) => path.relative(repoRoot, file).split(path.sep).join("/");

for (const file of walk(path.join(pwaRoot, "src"), [".ts", ".tsx"])) {
  const r = rel(file);
  if (ALLOWED.has(r)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (isCommentLine(line)) return;
    // 行の後ろのコメントは見ない（説明の中の "p21" は処理ではない）
    const code = line.replace(/\s\/\/.*$/, "");
    if (PJ_ID_LITERAL.test(code)) errors.push(`${r}:${i + 1} PJ番号の文字列で分けている: ${line.trim().slice(0, 140)}`);
    else if (PJ_ID_KEY.test(code)) errors.push(`${r}:${i + 1} PJ番号を鍵にした表を持っている: ${line.trim().slice(0, 140)}`);
    if (comparesWithProjectName(code)) errors.push(`${r}:${i + 1} PJ名と比べて分けている: ${line.trim().slice(0, 140)}`);
  });
}

for (const file of walk(path.join(pwaRoot, "scheduled-tasks"), [".md"])) {
  const r = rel(file);
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (SKILL_PJ_ONLY.test(line)) errors.push(`${r}:${i + 1} 特定のPJだけに効く手順: ${line.trim().slice(0, 140)}`);
  });
}

for (const dir of ["macos/AMDOSMac", "ios/AMDOS"]) {
  const abs = path.join(repoRoot, dir);
  let files = [];
  try {
    files = walk(abs, [".swift"]);
  } catch {
    continue;
  }
  for (const file of files) {
    const r = rel(file);
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (isCommentLine(line)) return;
      if (SWIFT_PJ_COMPARE.test(line)) errors.push(`${r}:${i + 1} PJ番号と比べて分けている: ${line.trim().slice(0, 140)}`);
    });
  }
}

if (errors.length) {
  console.error("特定のPJだけの処理が見つかった（spec 3-23 §6。PJごとの違いは DB の設定に置き、コードは全PJ同じ決まりで読む）:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`PJ特例なし契約 OK（例外は設定の表 ${ALLOWED.size} 件だけ）`);
