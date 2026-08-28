#!/usr/bin/env node
// Guard: 「＋<PJコード> <タスク>」の作業枠を、その PJ の色で書く恒久仕様を守る。
//
// 背景: 2026-08-29、まさから「タスクをカレンダーに入れてくれるのはうれしいが、
// どの PJ か分からなくなる。＋のあとに PJ 名を入れ、色が割り当たっている PJ は
// 色も付けてほしい」。色 → PJ の判定 (manual 3-2) は既に恒久仕様なので、
// OS 自身が書く枠が無色・PJ 名なしだと、自分で書いた予定を自分で読めなくなる。
//
// 実行: node --experimental-strip-types scripts/check_calendar_pj_color.mts
//       (npm run test:calendar-pj-color)

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COLOR_PJ_HISTORY,
  normalizePjCode,
  resolveColorIdForProject,
  resolveProjectForColorId,
} from "../src/lib/calendar-pj-color.ts";
import { buildTaskCalendarSchedulePlan } from "../src/lib/task-calendar-schedule-plan.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// --- PJ → 色 (現在の割当) ---
const TODAY = "2026-08-29";
const EXPECTED_NOW: Array<[string, string | null]> = [
  ["SX", "4"],
  ["p21", "4"],
  ["KUTE", "11"],
  ["p25", "11"],
  ["CX", "9"],
  ["CLG", "7"],
  ["VSX", "6"],
  ["VasculaX", "6"],
  ["LST", "1"],
  ["SE", "10"],
  ["ZMP", "3"],
  ["UST", "5"],
  // AMD の 21 はカレンダー単位の色で、event colorId (1-11) には使えない = 色なしで書く
  ["AMD", null],
  ["p00", null],
  // 色が割り当たっていない PJ は色なし。別の色で代用しない
  ["NIMS", null],
  ["KENQ", null],
  ["EHM", null],
];
for (const [project, expected] of EXPECTED_NOW) {
  assert.equal(
    resolveColorIdForProject(project, TODAY),
    expected,
    `${project} の色が ${expected ?? "なし"} でない`,
  );
}

// --- 履歴方式であること (過去の割当を今の割当で塗り替えない) ---
assert.equal(resolveColorIdForProject("KUTE", "2026-04-30"), null, "KUTE の色は 2026-05-01 から");
assert.equal(resolveProjectForColorId("11", "2026-04-30"), "private", "colorId 11 は 2026-05-01 より前は private");
assert.equal(resolveProjectForColorId("11", "2026-05-01"), "KUTE");
assert.equal(resolveProjectForColorId("6", "2026-05-27"), "JC", "colorId 6 は 2026-05-28 より前は JC");
assert.equal(resolveProjectForColorId("6", "2026-05-28"), "VSX");
assert.equal(resolveColorIdForProject("SX", "2025-05-31"), null, "SX の色は 2025-06-01 から");
assert.equal(resolveProjectForColorId("4", "2025-05-31"), "AER");

// --- 色 → PJ と PJ → 色 が同じ表から出ていること ---
for (const colorId of [...new Set(COLOR_PJ_HISTORY.map((row) => row.colorId))]) {
  if (Number(colorId) > 11) continue;
  const pjCode = resolveProjectForColorId(colorId, TODAY);
  if (!pjCode || pjCode === "private") continue;
  assert.equal(
    resolveColorIdForProject(pjCode, TODAY),
    colorId,
    `colorId ${colorId} → ${pjCode} → 色 の往復が合わない`,
  );
}

assert.equal(normalizePjCode("p26"), "VSX");
assert.equal(normalizePjCode(""), null);

// --- ＋枠の plan が PJ 名と色を必ず持つこと ---
const plan = buildTaskCalendarSchedulePlan(
  {
    task_id: "guard-001",
    project_id: "p21",
    title: "JSTのSU設立審査依頼を開始",
    owner_calendar_id: "masa@team-armada.jp",
    estimated_minutes: 60,
  },
  [],
  [],
  new Date("2026-08-29T00:00:00+09:00"),
);
assert.ok(plan.title.startsWith("+SX "), `＋枠のタイトルに PJ コードが無い: ${plan.title}`);
assert.equal(plan.color_id, "4", "＋枠に PJ の色が付いていない");
assert.ok(
  plan.calendar_writes.every((write) => write.colorId === "4"),
  "Calendar へ書く1件ごとに色が乗っていない",
);
// project_code が無くても project_id から PJ コードへ落とす (「+p21」や「+AMD」に化けない)
assert.ok(!plan.title.startsWith("+p21"), "project_id がそのままタイトルへ出ている");

// --- 正本 md から仕様が消えていないこと ---
const manual = fs.readFileSync(path.join(root, "manual", "3-2-data-and-extraction.md"), "utf8");
for (const needle of [
  "PJ → カレンダー色",
  "＋<PJコード>",
  "削除禁止",
]) {
  assert.ok(manual.includes(needle), `manual 3-2 から「${needle}」が消えている`);
}

console.log("✅ PJ → カレンダー色 guard OK (＋枠は PJ コード + PJ の色で書く)");
