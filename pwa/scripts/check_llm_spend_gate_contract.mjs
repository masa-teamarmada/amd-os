#!/usr/bin/env node
/**
 * 従量課金 LLM (Anthropic / Gemini / OpenAI) の「勝手な利用」を構造的に止める契約検査。
 *
 * まさ確定 2026-07-01: 定額枠 (Codex automation) があるのに従量課金 API を背景処理で使わない。
 * まさ確定 2026-09-04: 「おれが認めてないのに勝手に従量課金を使うことが絶対起きないようにして」。
 *
 * 2026-07-01 の封鎖 (src/lib/anthropic-client.ts の getBackgroundAnthropic) は Anthropic だけを
 * 覆っていて、Gemini を直接呼ぶ cron や、`new Anthropic()` を直書きした route には効いていなかった。
 * この検査は deploy.sh から毎回走り、次を守る:
 *
 *   1. `src/app/api/cron/**` (Vercel cron = 人の操作なしに動く) で従量課金 LLM に触れるファイルは、
 *      必ず封鎖ゲート (getBackgroundAnthropic / isBackgroundLlmAllowed) を通す。通していなければ落とす。
 *   2. それ以外で従量課金 LLM を直接呼ぶファイルは、`scripts/llm_spend_gate_baseline.json` に
 *      「人の操作起点 (person-triggered)」として登録済みのものだけ許す。新しく増えたら落とす。
 *      = 新しい課金経路は、まさの承認を得て baseline に書き足さない限り本番へ出ない。
 *   3. baseline にあるのに実体が無くなったファイルは警告する (baseline を掃除する合図)。
 *
 * 使い方:
 *   node scripts/check_llm_spend_gate_contract.mjs             # 検査 (deploy.sh が呼ぶ)
 *   node scripts/check_llm_spend_gate_contract.mjs --list      # 従量課金に触れるファイル一覧を表示
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PWA_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SRC_DIR = path.join(PWA_ROOT, "src");
const BASELINE_FILE = path.join(PWA_ROOT, "scripts", "llm_spend_gate_baseline.json");
const GATE_FILE = "src/lib/anthropic-client.ts";
const BACKGROUND_PREFIXES = ["src/app/api/cron/"];

// 従量課金 LLM に触れている印。SDK 生成、API ホスト直叩き、鍵の直接参照のどれか。
const DIRECT_PATTERNS = [
  { label: "new Anthropic()", re: /new Anthropic\(/ },
  { label: "new GoogleGenerativeAI()", re: /new GoogleGenerativeAI\(/ },
  { label: "new GoogleGenAI()", re: /new GoogleGenAI\(/ },
  { label: "new OpenAI()", re: /new OpenAI\(/ },
  { label: "api.anthropic.com", re: /api\.anthropic\.com/ },
  { label: "generativelanguage.googleapis.com", re: /generativelanguage\.googleapis\.com/ },
  { label: "api.openai.com", re: /api\.openai\.com/ },
  { label: "ANTHROPIC_API_KEY", re: /process\.env\.ANTHROPIC_API_KEY/ },
  { label: "GEMINI_API_KEY", re: /process\.env\.GEMINI_API_KEY/ },
  { label: "OPENAI_API_KEY", re: /process\.env\.OPENAI_API_KEY/ },
];
// 封鎖ゲートを通している印。
const GATE_PATTERNS = [/getBackgroundAnthropic\(/, /isBackgroundLlmAllowed\(/, /isBackgroundAnthropicAllowed\(/];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|mts|js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function loadBaseline() {
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
    return Array.isArray(parsed?.files) ? parsed.files : [];
  } catch {
    return [];
  }
}

const listOnly = process.argv.includes("--list");
const baseline = loadBaseline();
const baselineByFile = new Map(baseline.map((b) => [b.file, b]));

const direct = [];
for (const full of walk(SRC_DIR)) {
  const rel = path.relative(PWA_ROOT, full).split(path.sep).join("/");
  const text = fs.readFileSync(full, "utf8");
  const hits = DIRECT_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
  if (hits.length === 0) continue;
  const gated = GATE_PATTERNS.some((re) => re.test(text));
  direct.push({ file: rel, hits, gated });
}

if (listOnly) {
  for (const d of direct) {
    console.log(`${d.gated ? "[gated]   " : "[direct]  "}${d.file}  (${d.hits.join(", ")})`);
  }
  process.exit(0);
}

const violations = [];
const warnings = [];
let gatedBackground = 0;
let baselined = 0;

for (const d of direct) {
  if (d.file === GATE_FILE) continue;
  const isBackground = BACKGROUND_PREFIXES.some((prefix) => d.file.startsWith(prefix));
  if (isBackground) {
    if (d.gated) {
      gatedBackground += 1;
    } else {
      violations.push(
        `${d.file}: cron (人の操作なしに動く) が封鎖ゲートを通さずに従量課金 LLM に触れている (${d.hits.join(", ")})。` +
          ` getBackgroundAnthropic() か isBackgroundLlmAllowed() で封鎖してから出すこと。baseline では免除できない。`,
      );
    }
    continue;
  }
  if (d.gated && d.hits.every((h) => h === "ANTHROPIC_API_KEY")) {
    // 封鎖ゲート経由で鍵の有無だけ見ているファイル (例: 背景 lib)。直呼びではない。
    gatedBackground += 1;
    continue;
  }
  const entry = baselineByFile.get(d.file);
  if (entry) {
    baselined += 1;
    continue;
  }
  violations.push(
    `${d.file}: 従量課金 LLM の新しい直接利用 (${d.hits.join(", ")})。` +
      ` 背景処理なら getBackgroundAnthropic() / isBackgroundLlmAllowed() で封鎖する。` +
      ` 人の操作起点なら、まさの承認を得てから scripts/llm_spend_gate_baseline.json に理由付きで登録する。`,
  );
}

const present = new Set(direct.map((d) => d.file));
for (const b of baseline) {
  if (!present.has(b.file)) warnings.push(`baseline に残っているが従量課金に触れていない: ${b.file} (baseline から外してよい)`);
}

for (const w of warnings) console.warn(`warn: ${w}`);
if (violations.length > 0) {
  console.error("llm spend gate contract: NG");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(
  `llm spend gate contract: ok (封鎖済み背景 ${gatedBackground} 件, 人の操作起点として登録済み ${baselined} 件, 直接利用の新規 0 件)`,
);
