#!/usr/bin/env node
/**
 * 技術台帳の QA集 (block_kind = 'qa') の並びの検査。DBにも外部サービスにも触らない。
 *
 *   node --experimental-strip-types scripts/check_tech_qa_sort.mts
 *
 * まさの依頼 (2026-10-03)「質問された回数の多いものから順に。回数が同じ場合には重要度で★、★★、★★★の3段階で」。
 * 並びは画面で毎回計算するので、回数を足せば並びが変わることを守る (spec 3-20 §5.7)。
 */
import process from "node:process";
import { qaAskedCount, qaImportance, qaStars, sortQaEntries } from "../src/lib/project-tech.ts";

const failures: string[] = [];
function check(name: string, condition: boolean, detail?: string) {
  if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

type Row = { row_label: string; value_min: number | null; rating: "excellent" | "good" | "fair" | "poor" | "na" | "unknown" | null; sort_order: number };
const row = (row_label: string, value_min: number | null, rating: Row["rating"], sort_order: number): Row => ({ row_label, value_min, rating, sort_order });

const rows: Row[] = [
  row("B 1回 ★", 1, "fair", 10),
  row("C 2回 ★★", 2, "good", 20),
  row("D 1回 ★★★", 1, "excellent", 30),
  row("E 3回 ★", 3, "fair", 40),
  row("F 2回 ★★★", 2, "excellent", 50),
  row("G 回数なし", null, "excellent", 5),
  row("H 1回 ★★★ 後", 1, "excellent", 60),
];
const sorted = sortQaEntries(rows).map((r) => r.row_label);
check(
  "回数の多い順 → ★の多い順 → sort_order",
  JSON.stringify(sorted) === JSON.stringify(["E 3回 ★", "F 2回 ★★★", "C 2回 ★★", "D 1回 ★★★", "H 1回 ★★★ 後", "B 1回 ★", "G 回数なし"]),
  sorted.join(" / "),
);
check("元の配列は変えない", rows[0].row_label === "B 1回 ★");

// 回数を足すと並びが変わる (sort_order で手で並べ直さない)
const bumped = rows.map((r) => (r.row_label === "B 1回 ★" ? { ...r, value_min: 4 } : r));
check("回数を足すと先頭へ上がる", sortQaEntries(bumped)[0].row_label === "B 1回 ★");

check("★★★ は 3", qaImportance({ rating: "excellent" }) === 3);
check("★★ は 2", qaImportance({ rating: "good" }) === 2);
check("★ は 1", qaImportance({ rating: "fair" }) === 1);
check("未設定は 0", qaImportance({ rating: null }) === 0 && qaImportance({ rating: "unknown" }) === 0);
check("表示は★の数だけ", qaStars({ rating: "excellent" }) === "★★★" && qaStars({ rating: "fair" }) === "★" && qaStars({ rating: null }) === "—");
check("回数が空なら0回", qaAskedCount({ value_min: null }) === 0 && qaAskedCount({ value_min: 2 }) === 2);

if (failures.length > 0) {
  console.error("tech qa sort: NG");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("tech qa sort: ok");
