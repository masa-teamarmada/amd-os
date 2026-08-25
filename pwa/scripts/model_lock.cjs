#!/usr/bin/env node
"use strict";

/**
 * モデル正本ロック (model/LOCK.json) の検査・再生成ツール。
 *
 * 背景: AMD OS の BZM / SPS モデルはまさの承認なしに変更されてはならない正本。
 * model/LOCK.json に列挙したファイルの sha256 と、コード側の凍結版タプル
 * (pwa/src/lib/current-sps-model.ts の CURRENT_SPS_MODEL) が一致することを
 * 機械的に検査する。不一致は「まさの承認を経ない変更が正本へ入った」ことを意味する。
 *
 * サブコマンド:
 *   check                        … LOCK.json と実ファイルの sha256、コード側の版タプルを照合 (既定)
 *   relock --approval <id>       … model/APPROVALS.md の該当エントリを検証してから LOCK.json を再生成
 *   init --approval <id> [--files <path>...] … 初回生成
 *
 * 引数なし (他スクリプトから require された場合も含む) では check が走る。
 * これにより pwa/scripts/check_pwa_critical_ui.cjs から require するだけで
 * 通常のビルド・テスト導線に組み込める (check_payout_notice_pdf_golden.cjs と同じ設計)。
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..", "..");
const MODEL_DIR = path.join(ROOT, "model");
const LOCK_PATH = path.join(MODEL_DIR, "LOCK.json");
const APPROVALS_PATH = path.join(MODEL_DIR, "APPROVALS.md");
const CURRENT_SPS_MODEL_PATH = path.join(
  ROOT,
  "pwa/src/lib/current-sps-model.ts",
);

function fail(msg) {
  console.error(`✗ model lock: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(msg);
}

function sha256File(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function jstTimestamp() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().replace("Z", "+09:00");
}

function readLock() {
  if (!fs.existsSync(LOCK_PATH)) {
    fail(
      "model/LOCK.json が存在しません。node pwa/scripts/model_lock.cjs init --approval <id> " +
        "で初期生成してください。",
    );
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  } catch (e) {
    fail(`model/LOCK.json のJSON解析に失敗しました: ${e.message}`);
  }
  if (!Array.isArray(data.files)) {
    fail("model/LOCK.json の files が配列ではありません。");
  }
  return data;
}

// pwa/src/lib/current-sps-model.ts の CURRENT_SPS_MODEL から、コード側が
// 現行として採用している版タプルを抜き出す。TypeScript コンパイルはせず、
// 単純な正規表現で該当行の文字列リテラルを拾うだけに留める。
function extractCodeFrozenVersions() {
  if (!fs.existsSync(CURRENT_SPS_MODEL_PATH)) {
    fail(
      `凍結版タプルの参照先 ${path.relative(ROOT, CURRENT_SPS_MODEL_PATH)} が見つかりません。`,
    );
  }
  const text = fs.readFileSync(CURRENT_SPS_MODEL_PATH, "utf8");
  const grab = (key) => {
    const m = text.match(new RegExp(`${key}:\\s*"([^"]+)"`));
    return m ? m[1] : null;
  };
  return {
    model_version: grab("modelVersion"),
    measure_version: grab("measureVersion"),
    q_model_version: grab("qModelVersion"),
    q_ruleset_version: grab("qRulesetVersion"),
    p_model_version: grab("pModelVersion"),
  };
}

function runCheck() {
  const lock = readLock();
  const problems = [];

  for (const entry of lock.files) {
    const rel = entry.path;
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      problems.push(
        `モデル正本 ${rel} が存在しません（削除または移動されています）。` +
          "提案は model/proposals/ に置き、承認後に model/APPROVALS.md へ記録してから " +
          "node pwa/scripts/model_lock.cjs relock --approval <id> を実行してください。",
      );
      continue;
    }
    const actual = sha256File(abs);
    if (actual !== entry.sha256) {
      problems.push(
        `モデル正本 ${rel} がまさの承認なしに変更されています。` +
          "提案は model/proposals/ に置き、承認後に model/APPROVALS.md へ記録してから " +
          "node pwa/scripts/model_lock.cjs relock --approval <id> を実行してください。",
      );
    }
  }

  // 承認済みの正本が model/proposals/ (提案中の置き場) に居座ると、モデルページ本体より
  // 先に更新される場所が生まれる。2026-08-24 に実際に起きた: 改訂9点がリンク先の文書だけに
  // 入り、モデルページ本体が6時間半のあいだ古い式のままになった (まさ指摘「本文はこのモデル
  // ページだよ。ここより先に更新されている場所があってはならない」→ APPROVALS #2026-08-24-12)。
  // 正本はモデルページ (model/MODEL_VERSION_LEDGER.md) に一本化し、提案中の文書はロックしない。
  for (const entry of lock.files) {
    if (entry.path.startsWith("model/proposals/")) {
      problems.push(
        `ロック対象に提案中の置き場のファイルが入っています: ${entry.path}。` +
          "承認済みの定義はモデルページ (model/MODEL_VERSION_LEDGER.md) 本体へ統合し、" +
          "model/proposals/ には提案中のものだけを置いてください（同じ定義を二か所に置かない）。",
      );
    }
  }

  if (lock.frozen_versions) {
    const code = extractCodeFrozenVersions();
    for (const [key, expected] of Object.entries(lock.frozen_versions)) {
      const actual = code[key];
      if (actual !== expected) {
        problems.push(
          `凍結版タプル ${key} が不一致です (model/LOCK.json = ${expected} / ` +
            `pwa/src/lib/current-sps-model.ts = ${actual ?? "(見つからず)"})。` +
            "提案中の版がコードへ入っています。",
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error("✗ モデル正本ロック違反:");
    for (const p of problems) {
      console.error(`  - ${p}`);
    }
    process.exit(1);
  }

  ok(`model lock ok (${lock.files.length} files)`);
}

function readApprovalEntry(approvalId) {
  if (!fs.existsSync(APPROVALS_PATH)) {
    fail(`model/APPROVALS.md が存在しません。`);
  }
  const text = fs.readFileSync(APPROVALS_PATH, "utf8");
  const headingRe = new RegExp(`^##\\s+${escapeRegExp(approvalId)}\\s*$`, "m");
  const m = headingRe.exec(text);
  if (!m) {
    fail(
      `model/APPROVALS.md に "## ${approvalId}" の見出しが見つかりません。` +
        "先にまさの承認を APPROVALS.md へ記録してください。",
    );
  }
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const nextHeadingIdx = rest.search(/^##\s+/m);
  return nextHeadingIdx === -1 ? rest : rest.slice(0, nextHeadingIdx);
}

// 承認エントリ本文から「対象ファイル」として列挙された repo 相対パスを拾う。
// 拡張子付きのトークン (.md / .json / .ts / .tsx / .cjs / .mjs / .js) だけを対象にする。
function extractPathsFromApprovalBody(body) {
  const re = /[A-Za-z0-9_.\-/]+\.(?:md|json|ts|tsx|cjs|mjs|js)\b/g;
  const found = new Set();
  let mm;
  while ((mm = re.exec(body))) {
    found.add(mm[0].replace(/^\.\//, ""));
  }
  return Array.from(found);
}

// 承認エントリ本文のうち「削除パス:」見出し以下、次の見出し行（末尾がコロンの行、または
// 空行を挟んだ新セクション）までの範囲だけからパスを拾う。改名・移動でロック対象から
// 外すべき旧パスを、対象ファイル一覧と明確に区別して申告するためのセクション。
// 「対象ファイル:」節と同じ抽出関数 (extractPathsFromApprovalBody) を、
// セクションで絞った部分文字列に適用するだけの構造にしてある。
function extractRemovedPathsFromApprovalBody(body) {
  const headingRe = /^削除パス:\s*$/m;
  const m = headingRe.exec(body);
  if (!m) return [];
  const start = m.index + m[0].length;
  const rest = body.slice(start);
  // 次の既知の見出し行（対象ファイル: / 反映commit: / 次の承認エントリの ## 見出し）で打ち切る。
  const nextHeadingRe = /^(?:対象ファイル|反映commit|##\s)/m;
  const nextIdx = nextHeadingRe.exec(rest);
  const section = nextIdx ? rest.slice(0, nextIdx.index) : rest;
  return extractPathsFromApprovalBody(section);
}

// 「対象ファイル:」節に列挙されたパスだけを拾う。
//
// 本文全体へ正規表現をかけると、経緯や変更の性質を説明する散文に出てくるファイル名まで
// 対象パスとして拾ってしまう（2026-08-22: 説明文中の "CURRENT.json" を repo 相対パスと
// 誤認し、relock が「未作成のため含めず」と誤報した）。承認エントリは人が読む文書なので、
// 本文で正本のファイル名に言及するのは普通のこと。節で区切って拾う。
//
// 「対象ファイル:」節を持たない古い形式のエントリは、後方互換のため本文全体から拾う。
function extractTargetPathsFromApprovalBody(body) {
  const headingRe = /^対象ファイル:\s*$/m;
  const m = headingRe.exec(body);
  if (!m) return extractPathsFromApprovalBody(body);
  const rest = body.slice(m.index + m[0].length);
  const nextHeadingRe = /^(?:削除パス|反映commit|変更の性質|引用|##\s)/m;
  const nextIdx = nextHeadingRe.exec(rest);
  const section = nextIdx ? rest.slice(0, nextIdx.index) : rest;
  return extractPathsFromApprovalBody(section);
}

function parseApprovalArg(args) {
  const idx = args.indexOf("--approval");
  if (idx === -1 || !args[idx + 1]) {
    fail("--approval <id> を指定してください。");
  }
  return args[idx + 1];
}

function parseFilesArg(args) {
  const idx = args.indexOf("--files");
  if (idx === -1) return null;
  const files = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i].startsWith("--")) break;
    files.push(args[i]);
  }
  return files;
}

function writeLock(lock) {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n");
}

function runRelock(args) {
  const approvalId = parseApprovalArg(args);
  const body = readApprovalEntry(approvalId);
  const approvalPaths = extractTargetPathsFromApprovalBody(body);
  if (approvalPaths.length === 0) {
    fail(`model/APPROVALS.md の "## ${approvalId}" に対象ファイルのパスが見つかりません。`);
  }
  // 改名・移動などで承認エントリが明示的に「削除パス:」として申告した旧パスは、
  // 対象ファイル一覧やこれまでの LOCK.json に残っていてもロック対象から除く。
  const removedPaths = new Set(extractRemovedPathsFromApprovalBody(body));
  const keptApprovalPaths = approvalPaths.filter((p) => !removedPaths.has(p));

  const missingFromApproval = keptApprovalPaths.filter(
    (p) => !fs.existsSync(path.join(ROOT, p)),
  );

  let existing = { files: [] };
  if (fs.existsSync(LOCK_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
    } catch (e) {
      fail(`既存の model/LOCK.json の解析に失敗しました: ${e.message}`);
    }
  }
  const existingPaths = (existing.files || []).map((f) => f.path);
  const unionPaths = Array.from(new Set([...existingPaths, ...keptApprovalPaths]))
    .filter((p) => !removedPaths.has(p))
    .filter((p) => fs.existsSync(path.join(ROOT, p)))
    .sort();
  if (unionPaths.length === 0) {
    fail("relock対象のファイルが1つも存在しません。");
  }

  const lock = {
    approval_ref: approvalId,
    locked_at: jstTimestamp(),
    frozen_versions: existing.frozen_versions || extractCodeFrozenVersions(),
    files: unionPaths.map((p) => ({
      path: p,
      sha256: sha256File(path.join(ROOT, p)),
    })),
  };

  writeLock(lock);
  ok(`model lock relocked (${lock.files.length} files, approval_ref=${approvalId})`);
  if (missingFromApproval.length > 0) {
    console.log(
      `  (承認エントリに列挙されているが未作成のため含めず: ${missingFromApproval.join(", ")})`,
    );
  }
}

function runInit(args) {
  const approvalId = parseApprovalArg(args);
  // init も relock と同じ規律で、まさの承認エントリの存在を先に検証する。
  const body = readApprovalEntry(approvalId);

  let files = parseFilesArg(args);
  if (!files) {
    files = extractTargetPathsFromApprovalBody(body);
  }
  if (!files || files.length === 0) {
    fail(
      "init対象ファイルが特定できません。--files で指定するか、" +
        "model/APPROVALS.md の当該エントリにパスを列挙してください。",
    );
  }

  const present = files.filter((p) => fs.existsSync(path.join(ROOT, p)));
  const missing = files.filter((p) => !fs.existsSync(path.join(ROOT, p)));
  if (present.length === 0) {
    fail(`init対象ファイルが1つも存在しません: ${files.join(", ")}`);
  }

  const lock = {
    approval_ref: approvalId,
    locked_at: jstTimestamp(),
    frozen_versions: extractCodeFrozenVersions(),
    files: present
      .slice()
      .sort()
      .map((p) => ({ path: p, sha256: sha256File(path.join(ROOT, p)) })),
  };

  writeLock(lock);
  ok(`model lock initialized (${present.length} files, approval_ref=${approvalId})`);
  if (missing.length > 0) {
    console.log(`  (承認エントリに列挙されているが未作成のため含めず: ${missing.join(", ")})`);
  }
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === "relock") {
  runRelock(args.slice(1));
} else if (cmd === "init") {
  runInit(args.slice(1));
} else {
  runCheck();
}
