#!/usr/bin/env node
// Guard: カレンダー色→PJ 判定 (CFG_ColorPJHistory) が H-1 MTG 抽出ランナーと
// マニュアル正本から消えていないことを検査する。
//
// 背景: 2026-05-29、#71 の Claude routine 移植時に色→PJ 判定が無断削除され
// project_name の substring match だけに簡略化されていた事故が発覚。
// 「移植・リファクタで既存判定ロジックを勝手に簡略化・削除しない」(AGENTS.common.md)
// を executable に守るための guard。
//
// 実行: node scripts/check_color_pj_resolution.cjs  (npm run test:color-pj-resolution)

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const errors = [];

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    errors.push(`MISSING FILE: ${rel}`);
    return null;
  }
  return fs.readFileSync(p, "utf8");
}

function expectIncludes(rel, needles) {
  const text = read(rel);
  if (text == null) return;
  const missing = needles.filter((n) => !text.includes(n));
  if (missing.length > 0) {
    errors.push(`${rel} から色→PJ判定マーカーが欠落: ${missing.join(", ")}`);
  }
}

function expectNotIncludes(rel, needles) {
  const text = read(rel);
  if (text == null) return;
  const present = needles.filter((n) => text.includes(n));
  if (present.length > 0) {
    errors.push(`${rel} に廃止済みの簡略化マーカーが復活: ${present.join(", ")} (= 色判定を再度削除した疑い)`);
  }
}

// H-1 MTG 抽出ランナー (Claude routine, git 管理コピー) に色判定が在ること
const SKILL = "scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md";
expectIncludes(SKILL, [
  "CFG_ColorPJHistory",
  "CFG_PJAlias",
  "色優先",
  "colorId",
  "COLOR_PJ_CONFIG_SPREADSHEET_ID",
]);
// 旧・簡略化版 (= 事故時の文言) が復活していないこと
expectNotIncludes(SKILL, ["外部スプシ CFG は使わない"]);

// マニュアル正本に恒久仕様として記載が在ること
const MANUAL = "manual/3-2-data-and-extraction.md";
expectIncludes(MANUAL, [
  "カレンダー色 → PJ 判定",
  "CFG_ColorPJHistory",
  "色優先",
  "削除禁止",
]);

if (errors.length > 0) {
  console.error("❌ color→PJ 判定 guard 失敗:");
  for (const e of errors) console.error("  - " + e);
  console.error("\n色→PJ 判定は AMD OS の恒久仕様 (manual 3-2 §カレンダー色→PJ判定)。移植・簡略化で消さないこと。");
  process.exit(1);
}

console.log("✅ color→PJ 判定 guard OK (SKILL + manual に色判定が存在)");
