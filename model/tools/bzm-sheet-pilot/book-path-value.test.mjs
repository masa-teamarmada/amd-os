import test from "node:test";
import assert from "node:assert/strict";
import { valueBookPaths, discountFactor, PathValueError } from "./book-path-value.mjs";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const rates = { industrial: 0.05, private: 0.12 };
const absent = { absent: true };
const one = (extra = {}) => ({
  evaluationMonth: 0, freeCash: 0, rates, terminal: absent,
  draws: [{ id: "d1", weight: 1, scenarios: [{ id: "s", probability: 1, industrial: [], project: [] }] }],
  ...extra,
});
const withFlows = (industrial, project, extra = {}) => one({
  draws: [{ id: "d1", weight: 1, scenarios: [{ id: "s", probability: 1, industrial, project }] }], ...extra,
});

test("§9.2.6 の設備投資 3 億円を 39 か月目に置く: 月数/12 乗の割引", () => {
  const r = valueBookPaths(withFlows([], [{ month: 39, amount: -3 }]));
  near(r.rnpv, -3 * (1.12) ** (-39 / 12));
  near(r.icv, 0);
});

test("§9.5.5 型: 月 150 万円（0.015 億円）× 6 か月の待機費用の現在価値を別立てで合計", () => {
  const flows = [1, 2, 3, 4, 5, 6].map((m) => ({ month: m, amount: -0.015 }));
  const r = valueBookPaths(withFlows([], flows));
  let expect = 0;
  for (let m = 1; m <= 6; m++) expect -= 0.015 * 1.12 ** (-m / 12);
  near(r.rnpv, expect);
});

test("産業の増分と事業の正味 CF は別の年率で割り引く", () => {
  const r = valueBookPaths(withFlows([{ month: 12, amount: 1 }], [{ month: 12, amount: 1 }]));
  near(r.icv, 1 / 1.05);
  near(r.rnpv, 1 / 1.12);
});

test("自由資金だけを加算し、使途限定資金は別掲で合計に入れない", () => {
  const r = valueBookPaths(withFlows([], [], { freeCash: 2.5, restrictedCash: 9 }));
  near(r.rnpv, 2.5);
  assert.equal(r.restrictedCash, 9);
});

test("将来の出資は事業の将来価値に入れられない／評価月以前の流れも拒否", () => {
  assert.throws(() => valueBookPaths(withFlows([], [{ month: 3, amount: 5, kind: "equity" }])), { code: "future_equity_in_operating_pv" });
  assert.throws(() => valueBookPaths(withFlows([], [{ month: 0, amount: 1 }])), { code: "flow_not_after_evaluation" });
});

test("金額の欠けは 0 にせず止まる", () => {
  assert.throws(() => valueBookPaths(withFlows([], [{ month: 3 }])), (e) => e instanceof PathValueError && e.code === "amount_missing");
  assert.throws(() => valueBookPaths(one({ freeCash: undefined })), { code: "free_cash_missing" });
  assert.throws(() => valueBookPaths(one({ rates: { industrial: 0.05 } })), { code: "rates_missing" });
});

test("経路確率は合計 1 が必要。組の内側で期待値 → 外側で重み付き平均", () => {
  const sc = (id, p, amt) => ({ id, probability: p, industrial: [{ month: 12, amount: amt }], project: [{ month: 12, amount: amt }] });
  assert.throws(() => valueBookPaths(one({ draws: [{ weight: 1, scenarios: [sc("a", 0.5, 1)] }] })), { code: "bad_path_probabilities" });
  const r = valueBookPaths(one({
    draws: [
      { id: "lo", weight: 0.25, scenarios: [sc("u", 0.5, 2), sc("d", 0.5, 0)] },
      { id: "hi", weight: 0.75, scenarios: [sc("u", 0.8, 4), sc("d", 0.2, 0)] },
    ],
  }));
  near(r.perDraw[0].icv, 1 / 1.05);
  near(r.perDraw[1].icv, 3.2 / 1.05);
  near(r.icv, (0.25 * 1 + 0.75 * 3.2) / 1.05);
  assert.equal(r.quantiles.status, "calculated");
  near(r.quantiles.icv.p10, 1 / 1.05);   // 重み 0.25 の組が最小
  near(r.quantiles.icv.p50, 3.2 / 1.05);
});

test("組が 1 つなら分位点は未計算（被覆を主張しない）", () => {
  const r = valueBookPaths(withFlows([{ month: 6, amount: 1 }], []));
  assert.deepEqual(r.quantiles, { status: "uncalculated", reason: "single_fixed_input" });
});

test("終端: 最終月の金額を置く／終端なしを明示／未指定は算出不能", () => {
  const withTerm = valueBookPaths(withFlows([], [], { terminal: { month: 24, industrial: 10, project: 6 } }));
  near(withTerm.icv, 10 / 1.05 ** 2);
  near(withTerm.rnpv, 6 / 1.12 ** 2);
  const none = valueBookPaths(withFlows([{ month: 12, amount: 1 }], []));
  near(none.icv, 1 / 1.05);
  const unknown = valueBookPaths(withFlows([{ month: 12, amount: 1 }], [], { terminal: undefined }));
  assert.equal(unknown.available, false);
  assert.equal(unknown.icv, null);
  assert.equal(unknown.rnpv, null);
  assert.equal(unknown.quantiles.status, "unavailable");
  assert.throws(() => valueBookPaths(withFlows([], [], { terminal: { month: 0, industrial: 1, project: 1 } })), { code: "bad_terminal" });
});

test("一部の組の終端が不明なら、外側の平均を出さない", () => {
  const sc = { id: "s", probability: 1, industrial: [{ month: 12, amount: 1 }], project: [] };
  const r = valueBookPaths(one({
    terminal: undefined,
    draws: [{ id: "a", weight: 0.5, terminal: absent, scenarios: [sc] }, { id: "b", weight: 0.5, scenarios: [sc] }],
  }));
  assert.equal(r.available, false);
  assert.deepEqual(r.unavailableDraws, ["b"]);
  assert.equal(r.perDraw[0].available, true);
});

test("対照の経路は同じ入力の組（同じ割引率・終端）で評価され、組に結び付く", () => {
  const r = valueBookPaths(one({
    draws: [{ id: "d", weight: 1, rates: { industrial: 0.1, private: 0.2 },
      scenarios: [{ id: "s", probability: 1, industrial: [{ month: 12, amount: 2 }], project: [{ month: 12, amount: 2 }] }],
      counterpart: { id: "stop", industrial: [{ month: 12, amount: 1 }], project: [{ month: 12, amount: -1 }] } }],
  }));
  near(r.perDraw[0].counterpart.icv, 1 / 1.1);
  near(r.perDraw[0].counterpart.rnpv, -1 / 1.2);
  near(r.perDraw[0].icv, 2 / 1.1);
});

test("§13.5 時間整合: 月 0 の値 = 1 か月割引 ×（月 1 の流れ + 月 1 時点の値）の確率平均", () => {
  const up = { f1: 1.5, later: [{ month: 7, amount: 4 }, { month: 20, amount: -1 }] };
  const dn = { f1: -0.5, later: [{ month: 9, amount: 1 }] };
  const p = 0.4;
  const mk = (s, t) => ({ id: "x", probability: 1,
    industrial: [...(t === 0 ? [{ month: 1, amount: s.f1 }] : []), ...s.later],
    project: [...(t === 0 ? [{ month: 1, amount: s.f1 }] : []), ...s.later] });
  const v0 = valueBookPaths({ evaluationMonth: 0, freeCash: 0, rates: { industrial: 0.1, private: 0.1 }, terminal: absent,
    draws: [{ id: "d", weight: 1, scenarios: [{ ...mk(up, 0), id: "u", probability: p }, { ...mk(dn, 0), id: "d", probability: 1 - p }] }] });
  const at1 = (s) => valueBookPaths({ evaluationMonth: 1, freeCash: 0, rates: { industrial: 0.1, private: 0.1 }, terminal: absent,
    draws: [{ id: "d", weight: 1, scenarios: [mk(s, 1)] }] }).rnpv;
  const d1 = discountFactor(0.1, 1, 0);
  near(v0.rnpv, d1 * (p * (up.f1 + at1(up)) + (1 - p) * (dn.f1 + at1(dn))));
  near(v0.icv, v0.rnpv);
});
