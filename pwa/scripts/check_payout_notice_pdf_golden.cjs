#!/usr/bin/env node
"use strict";

/**
 * 支払通知書PDF golden 画像差分テスト
 *
 * 目的: `gas/064_PayoutFreeeNotice.js` の `payoutBuildNoticePdfBlob_` が出す
 * 改善版PDFフォーマット (= 2026-04 にまさと一緒に確定した白地・青アクセント版) が、
 * 別セッションで旧フォーマットや恣意的なレイアウト変更へ巻き戻らないようにする。
 *
 * このスクリプトは `scripts/__fixtures__/payout_notice_golden.png` を正本として、
 * 同じファイルの SHA256 が `payout_notice_golden.png.sha256` と一致するかを検査する。
 * golden を入れ替えたい場合は、まさが目視確認したPNGをコミットし直し、
 * `payout_notice_golden.png.sha256` を再生成する。
 *
 * --diff <input.png> で新規 PNG (= 例えば GAS preview API から取得した PDF を
 * PNG にレンダリングしたもの) を golden と SHA256 で比較するモードも持つ。
 * バイト完全一致を要求するため、新規 PNG が許容範囲ならまさが golden を更新する運用。
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const FIXTURE_DIR = path.join(__dirname, "__fixtures__");
const GOLDEN_PNG = path.join(FIXTURE_DIR, "payout_notice_golden.png");
const GOLDEN_HASH = path.join(FIXTURE_DIR, "payout_notice_golden.png.sha256");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function fail(msg) {
  console.error(`✗ payout-notice-pdf golden: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ payout-notice-pdf golden: ${msg}`);
}

function readGoldenHash() {
  if (!fs.existsSync(GOLDEN_HASH)) {
    fail(`golden hash missing: ${path.relative(process.cwd(), GOLDEN_HASH)}`);
  }
  return fs.readFileSync(GOLDEN_HASH, "utf8").trim();
}

function checkGoldenIntegrity() {
  if (!fs.existsSync(GOLDEN_PNG)) {
    fail(`golden PNG missing: ${path.relative(process.cwd(), GOLDEN_PNG)}`);
  }
  const buf = fs.readFileSync(GOLDEN_PNG);
  if (buf.length < 1024) {
    fail(`golden PNG suspiciously small (${buf.length} bytes)`);
  }
  if (buf.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    fail(`golden PNG not a valid PNG file: ${path.relative(process.cwd(), GOLDEN_PNG)}`);
  }
  const actual = sha256(buf);
  const expected = readGoldenHash();
  if (actual !== expected) {
    fail(`golden PNG hash mismatch. expected=${expected} actual=${actual}. fixture was edited but .sha256 not regenerated. fix with: shasum -a 256 ${path.relative(process.cwd(), GOLDEN_PNG)} | awk '{print $1}' > ${path.relative(process.cwd(), GOLDEN_HASH)}`);
  }
  return { buf, hash: actual };
}

function diffAgainstGolden(inputPath) {
  if (!fs.existsSync(inputPath)) {
    fail(`--diff input not found: ${inputPath}`);
  }
  const inputBuf = fs.readFileSync(inputPath);
  if (inputBuf.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    fail(`--diff input is not a PNG file: ${inputPath}`);
  }
  const golden = checkGoldenIntegrity();
  const inputHash = sha256(inputBuf);
  if (inputHash === golden.hash) {
    ok(`diff against golden: identical (${inputHash.slice(0, 12)}...)`);
    return;
  }
  const inputSize = inputBuf.length;
  const goldenSize = golden.buf.length;
  const sizeDiff = Math.abs(inputSize - goldenSize);
  console.error(`✗ payout-notice-pdf golden: PNG bytes differ from golden`);
  console.error(`    input   : ${path.relative(process.cwd(), inputPath)}`);
  console.error(`    input   sha256 = ${inputHash}`);
  console.error(`    golden  sha256 = ${golden.hash}`);
  console.error(`    input   size = ${inputSize} bytes`);
  console.error(`    golden  size = ${goldenSize} bytes (diff ${sizeDiff})`);
  console.error(`  → 改善版PDFフォーマットが変わった可能性がある。まさが新PNGを目視確認したうえで`);
  console.error(`    cp ${inputPath} ${path.relative(process.cwd(), GOLDEN_PNG)}`);
  console.error(`    shasum -a 256 ${path.relative(process.cwd(), GOLDEN_PNG)} | awk '{print $1}' > ${path.relative(process.cwd(), GOLDEN_HASH)}`);
  console.error(`    で golden を更新してから commit する。`);
  process.exit(1);
}

const args = process.argv.slice(2);
const diffIdx = args.indexOf("--diff");
if (diffIdx !== -1) {
  const inputPath = args[diffIdx + 1];
  if (!inputPath) fail("--diff requires a PNG file path");
  diffAgainstGolden(inputPath);
  process.exit(0);
}

const { hash } = checkGoldenIntegrity();
ok(`fixture present and hash matches: ${hash.slice(0, 12)}...`);
