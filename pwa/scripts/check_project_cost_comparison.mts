import assert from "node:assert/strict";
import fs from "node:fs";
import { computeCostComparison, readCostComparison } from "../src/lib/project-cost-comparison.ts";
import { computeCostModel, type CostModelBundle } from "../src/lib/project-cost-model.ts";

const raw = JSON.parse(fs.readFileSync(new URL("./data/sol-competitor-process-comparison-20261013.json", import.meta.url), "utf8"));
const comparison = readCostComparison(raw);
assert.ok(comparison);
const before = JSON.stringify(comparison);
const expected = [
  [500000000, 1100000000, 135000000, 276000000, 450, 920, 530, 1100],
  [550000000, 1200000000, 144000000, 291000000, 480, 970, 570, 1170],
  [600000000, 1400000000, 132000000, 255000000, 440, 850, 540, 1080],
  [520000000, 1150000000, 159000000, 345000000, 530, 1150, 620, 1340],
  [300000000, 800000000, 72000000, 207000000, 240, 690, 290, 820],
  [350000000, 900000000, 102000000, 270000000, 340, 900, 400, 1050],
  [350000000, 1000000000, 54000000, 132000000, 180, 440, 240, 610],
  [320000000, 850000000, 84000000, 219000000, 280, 730, 330, 870],
];
let index = 0;
for (const industry of comparison.industries) {
  for (const scenario of industry.scenarios) {
    const result = computeCostComparison(comparison, industry, scenario);
    assert.ok(result);
    assert.equal(result.annualVolumeM3, 300000);
    assert.deepEqual([...result.capexYen, ...result.annualOpexYen, ...result.opexPerM3, ...result.totalPerM3.map((n) => Math.round(n / 10) * 10)], expected[index++]);
  }
}
assert.equal(index, 8);
assert.equal(JSON.stringify(comparison), before, "読み取り計算で前提を書き換えない");
assert.equal(readCostComparison(null), null);
for (const edit of [
  (c: typeof raw) => { c.schemaVersion = 2; },
  (c: typeof raw) => { c.basis.operatingDays = 0; },
  (c: typeof raw) => { c.basis.allocationYears = 0; },
  (c: typeof raw) => { c.industries[0].baseCapexYen = [2, 1]; },
  (c: typeof raw) => { c.industries[0].scenarios[0].methodKey = "missing"; },
  (c: typeof raw) => { c.sources[0].url = "javascript:alert(1)"; },
]) {
  const changed = structuredClone(raw); edit(changed); assert.equal(readCostComparison(changed), null);
}
const zero = structuredClone(comparison);
zero.basis.dailyVolumeM3 = 0;
assert.equal(computeCostComparison(zero, zero.industries[0], zero.industries[0].scenarios[0]), null, "排水量0を無料と扱わない");

// 比較前提を持っても既存の菌体・リアクター・用途別の採算へ混ざらない。
const own = JSON.parse(fs.readFileSync(new URL("./__fixtures__/sol_cost_optimistic_261008.json", import.meta.url), "utf8")) as CostModelBundle;
const withComparison: CostModelBundle = { ...own, comparison };
for (const strain of ["wild", "enhanced"] as const) {
  assert.deepEqual(computeCostModel(withComparison, { strain }), computeCostModel(own, { strain }));
}
console.log("競合コスト比較: 8ケース・ゼロ/不正入力・旧試算不変を確認");
