// PJタイプ別の標準フォーマットの契約チェック（静的解析のみ、DB接続なし）。
// Run: npm run test:project-format（pwa/scripts/deploy.sh が本番反映の前に必ず走らせる）
//
// 【なぜこの guard があるか】
// 2026-10-03 まさ「すべてのPJについて、同じフォーマットで表示する設計にして。勝手にそれを書き換えない
// ように制限をかけてほしい。新たなデータが入るときには、新たなグラフを入れるんじゃなくて、フォーマットで
// 生成されているグラフにその数値データを入れる形にしてほしい」。
// それまでは、新しいデータが来るたびに作業者がPJ番号を名指しした専用の表やグラフを足せてしまい、
// SOLの試算表だけが別物になった（試算表の部品だけで名指しが19か所）。
//
// 正本: pwa/spec/3-23-project-format-current-spec.md
//
// --- 契約 ---
// 1. 【鍵】src/lib/project-formats.ts（区画・行・グラフの定義）は、project_format_lock.json の
//    sha256 と一致しなければならない。変えてよいのは、まさが明示で承認したときだけ。
//    承認を得たら approvals に「日付・まさ・承認の言葉・変えた内容」を足してから sha256 を更新する。
// 2. 【ラチェット】PJの画面（コックピット・ワークスペース・DD）の部品で、PJ番号の名指し
//    （"p21" のような文字列）と PJ専用の表示フラグは、project_format_baseline.json の既存分だけ許す。
//    増えたら失敗。減ったら baseline も同じ数へ下げる（下げ忘れると、また増やせてしまうので失敗にする）。
// 3. 試算表タブは標準フォーマット（ProjectFinanceFormat）だけを描く。消したPJ専用の部品を戻さない。

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pwaDir = path.join(scriptDir, "..");
const LOCK_PATH = path.join(scriptDir, "project_format_lock.json");
const BASELINE_PATH = path.join(scriptDir, "project_format_baseline.json");
const FORMAT_FILE = "src/lib/project-formats.ts";

const errors = [];
const rel = (file) => path.relative(pwaDir, file).split(path.sep).join("/");
const read = (relative) => readFileSync(path.join(pwaDir, relative), "utf8");

// --- 1. 鍵 -------------------------------------------------------------------------
const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
const formatSource = read(FORMAT_FILE);
const actualHash = createHash("sha256").update(formatSource).digest("hex");
if (lock.file !== FORMAT_FILE) errors.push(`project_format_lock.json の file が ${FORMAT_FILE} ではない`);
if (!Array.isArray(lock.approvals) || lock.approvals.length === 0) {
  errors.push("project_format_lock.json に承認の記録（approvals）が無い");
} else {
  for (const [index, approval] of lock.approvals.entries()) {
    if (approval.by !== "まさ" || !/^\d{4}-\d{2}-\d{2}$/.test(approval.date ?? "") || !approval.request || !approval.change) {
      errors.push(`project_format_lock.json の approvals[${index}] に 日付・by=まさ・request（承認の言葉）・change（変えた内容）が揃っていない`);
    }
  }
}
if (lock.sha256 !== actualHash) {
  errors.push([
    `標準フォーマットの定義（${FORMAT_FILE}）が、まさの承認済みの版と違う。`,
    "フォーマットは、まさの明示の承認なしに変えない（2026-10-03 まさ確定）。",
    "新しいデータは、定義を変えずに src/lib/project-finance-format.ts で標準の行・グラフへ流し込む。",
    "定義を変える承認をまさから得たときだけ、scripts/project_format_lock.json の approvals に承認の言葉を足し、",
    `sha256 を ${actualHash} に更新する（spec 3-23）。`,
  ].join("\n  "));
}

// --- 2. PJ番号の名指しのラチェット ------------------------------------------------
const SCOPE_DIRS = [
  "src/components/cockpit",
  "src/components/project-workspace",
  "src/components/dd",
  "src/app/(app)/project",
  "src/app/workspace",
];
const SCOPE_FILES = [
  "src/lib/project-formats.ts",
  "src/lib/project-finance-format.ts",
];
const PATTERNS = [
  { label: "PJ番号の名指し", regex: /["'`]p\d{2}["'`]/g },
  { label: "PJ専用の表示フラグ", regex: /\b(?:showSxDetail|hasSxBusinessPlanDetail)\b/g },
];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const counts = {};
const files = [
  ...SCOPE_DIRS.flatMap((dir) => walk(path.join(pwaDir, dir))),
  ...SCOPE_FILES.map((file) => path.join(pwaDir, file)),
];
for (const file of new Set(files)) {
  const source = stripComments(readFileSync(file, "utf8"));
  let total = 0;
  for (const pattern of PATTERNS) total += (source.match(pattern.regex) ?? []).length;
  if (total > 0) counts[rel(file)] = total;
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const allowed = baseline.allowed ?? {};
for (const [file, count] of Object.entries(counts)) {
  const limit = allowed[file] ?? 0;
  if (count > limit) {
    errors.push(`${file}: PJ番号の名指し・PJ専用の表示フラグが ${count} 件（許容 ${limit} 件）。PJで表示を分けず、データで出し分ける（spec 3-23）。`);
  } else if (count < limit) {
    errors.push(`${file}: 名指しが ${count} 件に減った。scripts/project_format_baseline.json の許容数も ${count} へ下げる（減らした分を戻せないようにするため）。`);
  }
}
for (const [file, limit] of Object.entries(allowed)) {
  if (!(file in counts) && limit > 0) {
    errors.push(`${file}: 名指しが 0 件になった（または消えた）。scripts/project_format_baseline.json からこの行を消す。`);
  }
}

// --- 3. 試算表タブは標準フォーマットだけ ----------------------------------------
const financeTab = read("src/components/cockpit/CockpitFinancialProjection.tsx");
const financeImports = [...stripComments(financeTab).matchAll(/^import\s+.*?from\s+["']([^"']+)["']/gm)].map((match) => match[1]);
if (financeImports.length !== 1 || financeImports[0] !== "./ProjectFinanceFormat") {
  errors.push(`試算表タブ（CockpitFinancialProjection.tsx）は ProjectFinanceFormat だけを読み込む。今の読み込み: ${financeImports.join(", ") || "なし"}`);
}
const formatView = read("src/components/cockpit/ProjectFinanceFormat.tsx");
if (!formatView.includes("FINANCE_FORMAT_SECTIONS.map(")) {
  errors.push("ProjectFinanceFormat.tsx は FINANCE_FORMAT_SECTIONS の順に区画を描く（定義の外で区画を足さない）");
}
for (const removed of [
  "src/components/cockpit/CockpitFundingPlan.tsx",
  "src/components/cockpit/Bzm22TimeLedger.tsx",
  "src/components/cockpit/Bzm22TimeLedgerSection.tsx",
  "src/components/cockpit/CockpitPlMonthlySection.tsx",
]) {
  if (existsSync(path.join(pwaDir, removed))) errors.push(`${removed} は標準フォーマットへ統合して消した部品。戻さない（spec 3-23）。`);
}
const ddBodies = read("src/components/dd/DdLiveBodies.tsx");
if (!ddBodies.includes("<FinanceFormatView")) {
  errors.push("DDの資金計画は、ワークスペースの試算表と同じ標準フォーマット（FinanceFormatView）で描く");
}

if (errors.length > 0) {
  console.error("標準フォーマットの契約違反:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
const named = Object.values(counts).reduce((sum, count) => sum + count, 0);
console.log(`標準フォーマット契約 OK（定義は承認済みの版・PJ番号の名指し ${named} 件は baseline 内・試算表は標準フォーマットのみ）`);
