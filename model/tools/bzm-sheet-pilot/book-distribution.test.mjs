import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedOpinion,
  mixBoundedOpinions,
  boundedCdf,
  boundedQuantile,
  boundedNodes,
} from "./book-distribution.mjs";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

const o1 = { a: 80, q10: 90, q50: 120, q90: 150, b: 160 };
const o2 = { a: 80, q10: 100, q50: 125, q90: 150, b: 160 };

test("教科書 §18.6.7: 個別と混合の CDF", () => {
  near(boundedCdf(o1, 120), 0.5);
  near(boundedCdf(o2, 120), 0.42);
  const mix = mixBoundedOpinions(o1, o2);
  near(boundedCdf(mix, 120), 0.46);
  near(boundedCdf(mix, 150), 0.9);
});

test("教科書 §18.6.7: 混合分位点", () => {
  const mix = mixBoundedOpinions(o1, o2);
  near(mix.p10, 92.72727272727, 1e-6);
  near(mix.p50, 122.72727272727, 1e-6);
  near(mix.p90, 150);
  assert.deepEqual(mix.weights, [0.5, 0.5]);
  // JSON で往復しても同じ結果
  const back = JSON.parse(JSON.stringify(mix));
  near(boundedQuantile(back, 0.5), mix.p50);
});

test("境界: 端の外と端", () => {
  near(boundedCdf(o1, 79.9), 0);
  near(boundedCdf(o1, 80), 0);
  near(boundedCdf(o1, 160), 1);
  near(boundedCdf(o1, 1000), 1);
  assert.equal(boundedQuantile(o1, 0), 80);
  assert.equal(boundedQuantile(o1, 1), 160);
  near(boundedQuantile(o1, 0.1), 90);
  near(boundedQuantile(o1, 0.3), 105);
});

test("点質量: 重複節は右連続、分位点は下側", () => {
  const pm = { a: 10, q10: 10, q50: 10, q90: 20, b: 30 }; // x=10 に 0.5 の質量
  near(boundedCdf(pm, 9.99), 0);
  near(boundedCdf(pm, 10), 0.5);
  assert.equal(boundedQuantile(pm, 0.3), 10);
  assert.equal(boundedQuantile(pm, 0.5), 10);
  near(boundedQuantile(pm, 0.7), 15);
  const all = boundedOpinion({ a: 5, q10: 5, q50: 5, q90: 5, b: 5 });
  near(all.mean, 5);
  assert.equal(all.p50, 5);
});

test("ギャップ: 節の間で確率が増えない区間はない、質量の間は線形", () => {
  const gap = { a: 0, q10: 0, q50: 10, q90: 10, b: 100 }; // 0 と 10 に質量、(0,10) に 0.4
  near(boundedCdf(gap, 0), 0.1);
  near(boundedCdf(gap, 5), 0.3);
  near(boundedCdf(gap, 10), 0.9);
  near(boundedCdf(gap, 55), 0.95);
  assert.equal(boundedQuantile(gap, 0.9), 10);
  near(boundedQuantile(gap, 0.9000001), 10.00009, 1e-3);
  assert.equal(boundedQuantile(gap, 0.05), 0);
});

test("平均", () => {
  near(boundedOpinion(o1).mean, 0.1 * 85 + 0.4 * 105 + 0.4 * 135 + 0.1 * 155);
  const mix = mixBoundedOpinions(o1, o2);
  near(mix.mean, 0.5 * boundedOpinion(o1).mean + 0.5 * boundedOpinion(o2).mean);
});

test("検証: 順序・有限・欠測・領域", () => {
  assert.throws(() => boundedOpinion({ ...o1, q50: 200 }), RangeError);
  assert.throws(() => boundedOpinion({ ...o1, a: NaN }), TypeError);
  assert.throws(() => boundedOpinion({ q10: 1, q50: 2, q90: 3 }), TypeError); // 端を創作しない
  assert.throws(() => boundedOpinion({ ...o1, b: "160" }), TypeError);
  assert.throws(() => boundedOpinion(o1, { min: 85 }), RangeError);
  assert.throws(() => boundedOpinion(o1, { max: 150 }), RangeError);
  assert.doesNotThrow(() => boundedOpinion(o1, { min: 80, max: 160 }));
  assert.throws(() => boundedQuantile(o1, 1.1), RangeError);
  assert.throws(() => boundedCdf(o1, Infinity), TypeError);
});

test("節点: 重み合計 1・平均保存・点質量保持・決定的・近似ラベル", () => {
  const mix = mixBoundedOpinions(o1, o2);
  const r = boundedNodes(mix, 200);
  assert.equal(r.approximate, true);
  near(r.nodes.reduce((t, v) => t + v.weight, 0), 1);
  near(r.nodes.reduce((t, v) => t + v.weight * v.value, 0), mix.mean, 1e-9);
  assert.deepEqual(boundedNodes(mix, 200), r);

  const pm = { a: 10, q10: 10, q50: 10, q90: 20, b: 30 };
  const nodes = boundedNodes(pm, 10).nodes;
  const atom = nodes.find((v) => v.value === 10);
  near(atom.weight, 0.5);
  JSON.stringify(nodes);
});
