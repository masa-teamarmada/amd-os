import test from "node:test";
import assert from "node:assert/strict";
import {
  BENCHMARKS,
  NINE_KEYS,
  computePoint,
  computeFull,
  diagnoseAdditionalFunds,
  validateScenario,
  validateNineOutcome,
  normalizeReg,
  toYen,
  runCli,
} from "./book-forward.mjs";

const FULL = process.env.BZM_FORWARD_FULL === "1";
const near = (a, b, tol, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} != ${b} (±${tol})`);
const bench = (type, reg, list) => list.find((r) => r.type === type && r.reg === reg);

// ── 速い検証（計算しない）

test("規制の表記ゆれを正規化し、範囲外は拒否", () => {
  assert.equal(normalizeReg("REG-2"), "REG2");
  assert.equal(normalizeReg(0), "REG0");
  assert.throws(() => normalizeReg("REG3"), RangeError);
  assert.throws(() => validateScenario({ type: "F5", reg: "REG0" }), RangeError);
});

test("入力検証: 未知キー・国内割合・範囲外・不整合を拒否", () => {
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { domesticShare: 0.4 } }), /二重/);
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { phiU: 0.5 } }), /二重/);
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { foo: 1 } }), /未知/);
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { gate: "T9" } }), RangeError);
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { sigma: 2 } }), RangeError);
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { rightsOpen: 3 } }), RangeError);
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { funcs: { f1Observed: 0.5 } } }), RangeError);
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { drUsed: 1 } }), RangeError);
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { cashMan: -1 } }), RangeError);
  assert.throws(() => validateScenario({ type: "F1", reg: "REG0", init: { incorporated: "yes" } }), TypeError);
  const ok = validateScenario({ type: "f1", reg: "REG-0", init: { gate: "T3", funcs: { f2: 0.5 } } });
  assert.equal(ok.type, "F1");
  assert.equal(ok.reg, "REG0");
});

test("9 区分の検証: 合計 1・非負・欠落", () => {
  const good = { indep_in: 0.3, indep_out: 0.02, lic: 0.1, ma: 0.01, ips: 0.03, pivot: 0, exit: 0.5, liq: 0, cont: 0.04 };
  const r = validateNineOutcome(good);
  near(r.sum, 1, 1e-12);
  near(r.domesticValueClasses.total, 0.46, 1e-12);
  assert.throws(() => validateNineOutcome({ ...good, exit: 0.6 }), /合計/);
  assert.throws(() => validateNineOutcome({ ...good, exit: -0.1, cont: 0.64 }), /負/);
  const { cont, ...missing } = good;
  assert.throws(() => validateNineOutcome(missing), TypeError);
});

test("換算: 純増の年額を 1 回だけ掛ける（例 17.1）", () => {
  near(toYen(2.776, 300), 832.8, 1e-9);
  assert.throws(() => toYen(2.7, 0), RangeError);
  assert.throws(() => toYen(NaN, 70), TypeError);
});

test("CLI: benchmark は計算せず JSON を出し、不正入力は例外", () => {
  let text = "";
  runCli(["benchmark"], (s) => (text += s));
  const data = JSON.parse(text);
  assert.equal(data.point.length, 5);
  assert.equal(data.full.length, 12);
  assert.throws(() => runCli(["point", "F1"], () => {}), TypeError);
  assert.throws(() => runCli(["nope"], () => {}), TypeError);
  assert.throws(() => runCli(["point", "F1", "REG0", "--init", "{}", "--init-file", "x"], () => {}), TypeError);
});

// ── 代表 1 点（既定で走る。数秒かかることがある）

test("§17.2.2: 代表 1 点 F1×REG0 = 2.8232、9 区分の合計 1", () => {
  const r = computePoint({ type: "F1", reg: "REG0" });
  near(r.icv, bench("F1", "REG0", BENCHMARKS.point).icv, BENCHMARKS.tolerance.point, "F1 REG0");
  near(r.nineSum, 1, 1e-6);
  for (const k of NINE_KEYS) assert.ok(r.nineOutcome[k] >= -1e-9, k);
  assert.ok(!("icvMean" in r));
  JSON.parse(JSON.stringify(r));
});

test("§17.2.2: 代表 1 点 F1×REG2 = 1.2036", () => {
  const r = computePoint({ type: "F1", reg: "REG2" });
  near(r.icv, bench("F1", "REG2", BENCHMARKS.point).icv, BENCHMARKS.tolerance.point, "F1 REG2");
});

test("§17.5.7: 会社化済み F1×REG0 の追加調達の診断（0.7384 / 回数上限 0 で 0.3210）", () => {
  const b = bench("F1", "REG0", BENCHMARKS.additionalFunds);
  const d = diagnoseAdditionalFunds({ type: "F1", reg: "REG0", init: { incorporated: true } });
  near(d.icvWithAdditionalFunds, b.withDr, BENCHMARKS.tolerance.point, "dr あり");
  near(d.icvWithoutAdditionalFunds, b.noDr, BENCHMARKS.tolerance.point, "dr 0 回");
  assert.ok(d.icvWithoutAdditionalFunds < d.icvWithAdditionalFunds);
  assert.ok(d.drAttempt > 0);
});

test("追加調達の診断は会社化前の入力を拒否、drMax は範囲検査", () => {
  assert.throws(() => diagnoseAdditionalFunds({ type: "F1", reg: "REG0" }), RangeError);
  assert.throws(() => computePoint({ type: "F1", reg: "REG0" }, { drMax: 3 }), RangeError);
});

// ── 外部実測の 81 点の混合（BZM_FORWARD_FULL=1 のときだけ）

for (const [type, reg] of [["F1", "REG0"], ["F3", "REG0"]]) {
  test(`§17.3.1: 81 点の混合 ${type}×${reg}（BZM_FORWARD_FULL=1）`, { skip: !FULL, timeout: 600000 }, () => {
    const b = bench(type, reg, BENCHMARKS.full);
    const r = computeFull({ type, reg });
    near(r.icvQuantiles.q10, b.q10, BENCHMARKS.tolerance.quantile, "q10");
    near(r.icvQuantiles.q50, b.q50, BENCHMARKS.tolerance.quantile, "q50");
    near(r.icvQuantiles.q90, b.q90, BENCHMARKS.tolerance.quantile, "q90");
    near(r.pM4, b.pM4, 0.0015, "pM4");
    if (type === "F1") near(r.m4MeanMonthsGivenReached, b.m4Mean, 0.6, "到達月数");
    near(r.nineSum, 1, 1e-6);
    // 平均は分位点と別の量として持つ（中央値で代用しない）
    assert.ok(Number.isFinite(r.icvMean));
    assert.ok(r.icvMean >= r.icvQuantiles.q10 * 0.5);
  });
}
