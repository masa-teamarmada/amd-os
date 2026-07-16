#!/usr/bin/env node
/**
 * SPS (シーズ有望度) M·P·R·S 4因子グルーピング回帰テスト
 *
 * 呼称は SPS = Seed Prospect Score (旧 PRS は 2026-07-11 廃止、glossary §1.5)。
 * ファイル名・識別子の prs/mprs は内部名として据え置き。
 *
 * 2026-07-16 まさ確定: σ_SU を S から分離して独立項 M へ格上げ。
 * この変更は breakdown のグルーピング・表示のみで、総合スコア数値は
 * フラット Cobb-Douglas の結合則により完全不変でなければならない。
 *
 * 検証項目:
 *   1. 旧実装 (グルーピング前) と同じ式で独立計算したスコアと 1e-9 以内で一致
 *   2. score = K × M × P × R × S の結合則が成立 (1e-9 以内)
 *   3. M × S_new = 旧 S (σ_SU × FRL × R_net の contribution 積) が成立
 *   4. P / R_net missing 時は score=null / components=null
 *
 * 実行: npm run test:prs-mprs-grouping
 */
import assert from "node:assert/strict";
import {
  calculatePrsScore,
  computeSigmaSU,
  PRS_ALPHA_DEFAULT,
  PRS_SCORE_AXES,
  type PrsScoreInput,
  type PrsScoreWeights,
} from "../src/lib/amd-score.ts";

const REL_TOL = 1e-9;

function assertClose(actual: number, expected: number, label: string) {
  const scale = Math.max(1, Math.abs(expected));
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= REL_TOL * scale,
    `${label}: |${actual} - ${expected}| = ${diff} > ${REL_TOL * scale}`
  );
}

/**
 * 旧実装 (2e4fc022 時点の calculatePrsScore) と同一の総合スコア式を独立再実装。
 * グルーピングに依存しないフラット Cobb-Douglas: Score = K · Π (X_i+1)^α_i
 */
function legacyFlatScore(input: PrsScoreInput, weights: PrsScoreWeights): number {
  const shallow = input.TRL === null;
  const sigma = computeSigmaSU(input.mu_A, input.mu_I, input.mu_G);
  const values: Record<string, number | null> = {
    P: input.P,
    TRL: input.TRL,
    BRL: input.BRL,
    GRL: input.GRL,
    SRL: input.SRL,
    HRL: input.HRL,
    sigma_SU: sigma,
    FRL: input.FRL,
    R_net: input.R_net,
  };
  const activeAxes = PRS_SCORE_AXES.filter((axis) => !(shallow && axis === "TRL"));
  const alphaSum = activeAxes.reduce((acc, axis) => acc + (weights[axis] ?? 0), 0);
  const K = 100_000 / Math.pow(10, alphaSum);
  let product = 1;
  for (const axis of activeAxes) {
    const value = values[axis];
    if (value == null) continue;
    const clipped = Math.max(0, Math.min(9, value));
    product *= Math.pow(clipped + 1, weights[axis] ?? 0);
  }
  return K * product;
}

/** 旧 breakdown の survival (= σ_SU · FRL · R_net の contribution 積) を contributions から再構成 */
function legacySurvival(contributions: Partial<Record<string, number>>): number {
  return (
    (contributions.sigma_SU ?? 1) * (contributions.FRL ?? 1) * (contributions.R_net ?? 1)
  );
}

interface Case {
  name: string;
  input: PrsScoreInput;
  weights?: PrsScoreWeights;
}

const READY_CASES: Case[] = [
  {
    name: "typical deep-tech PJ",
    input: { P: 6, mu_A: 5, mu_I: 4, mu_G: 6, TRL: 4, BRL: 3, GRL: 2, SRL: 3, HRL: 5, FRL: 6, R_net: 3 },
  },
  {
    name: "shallow tech mode (TRL=null)",
    input: { P: 4, mu_A: 3, mu_I: 5, mu_G: 2, TRL: null, BRL: 5, GRL: 3, SRL: 4, HRL: 4, FRL: 5, R_net: 4 },
  },
  {
    name: "all-nine IPO calibration",
    input: { P: 9, mu_A: 9, mu_I: 9, mu_G: 9, TRL: 9, BRL: 9, GRL: 9, SRL: 9, HRL: 9, FRL: 9, R_net: 9 },
  },
  {
    name: "all-zero floor",
    input: { P: 0, mu_A: 0, mu_I: 0, mu_G: 0, TRL: 0, BRL: 0, GRL: 0, SRL: 0, HRL: 0, FRL: 0, R_net: 0 },
  },
  {
    name: "out-of-range inputs are clipped",
    input: { P: 12, mu_A: 5, mu_I: 5, mu_G: 5, TRL: -3, BRL: 10, GRL: 4, SRL: 4, HRL: 4, FRL: 11, R_net: -1 },
  },
  {
    name: "fractional values",
    input: { P: 5.5, mu_A: 4.2, mu_I: 3.7, mu_G: 6.1, TRL: 4.5, BRL: 2.8, GRL: 1.5, SRL: 3.3, HRL: 5.9, FRL: 6.4, R_net: 2.5 },
  },
  {
    name: "custom alpha weights",
    input: { P: 6, mu_A: 5, mu_I: 4, mu_G: 6, TRL: 4, BRL: 3, GRL: 2, SRL: 3, HRL: 5, FRL: 6, R_net: 3 },
    weights: {
      P: 1.2,
      TRL: 0.9,
      BRL: 0.7,
      GRL: 0.4,
      SRL: 0.3,
      HRL: 1.0,
      sigma_SU: 1.5,
      FRL: 1.3,
      R_net: 0.6,
    },
  },
];

let checks = 0;

for (const testCase of READY_CASES) {
  const weights = testCase.weights ?? PRS_ALPHA_DEFAULT;
  const result = calculatePrsScore(testCase.input, weights);

  assert.equal(result.status, "ready", `${testCase.name}: status should be ready`);
  assert.ok(result.score != null, `${testCase.name}: score should exist`);
  assert.ok(result.components != null, `${testCase.name}: components should exist`);
  const { score, components, contributions, K } = result;

  // 1. 旧実装と同一式の独立計算に対する回帰 (スコア数値の完全不変)
  const expected = legacyFlatScore(testCase.input, weights);
  assertClose(score!, expected, `${testCase.name}: score vs legacy flat formula`);

  // 2. 結合則: score = K × M × P × R × S
  const recomposed =
    K * components!.macro * components!.potential * components!.reach * components!.survival;
  assertClose(recomposed, score!, `${testCase.name}: K·M·P·R·S recomposition`);

  // 3. M × S_new = 旧 S (σ_SU が macro へ移っただけでグルーピング積は不変)
  assertClose(
    components!.macro * components!.survival,
    legacySurvival(contributions),
    `${testCase.name}: macro × survival == legacy survival`
  );

  // 4. macro / survival の定義確認
  assertClose(
    components!.macro,
    contributions.sigma_SU ?? 1,
    `${testCase.name}: macro == sigma_SU contribution`
  );
  assertClose(
    components!.survival,
    (contributions.FRL ?? 1) * (contributions.R_net ?? 1),
    `${testCase.name}: survival == FRL × R_net contributions`
  );

  checks += 1;
}

// 5. missing ケース: P / R_net 未入力なら score も components も出さない
const MISSING_CASES: Array<{ name: string; input: PrsScoreInput; missing: string[] }> = [
  {
    name: "P missing",
    input: { P: null, mu_A: 5, mu_I: 4, mu_G: 6, TRL: 4, BRL: 3, GRL: 2, SRL: 3, HRL: 5, FRL: 6, R_net: 3 },
    missing: ["P"],
  },
  {
    name: "R_net missing",
    input: { P: 6, mu_A: 5, mu_I: 4, mu_G: 6, TRL: 4, BRL: 3, GRL: 2, SRL: 3, HRL: 5, FRL: 6, R_net: null },
    missing: ["R_net"],
  },
  {
    name: "both missing",
    input: { P: null, mu_A: 5, mu_I: 4, mu_G: 6, TRL: 4, BRL: 3, GRL: 2, SRL: 3, HRL: 5, FRL: 6, R_net: null },
    missing: ["P", "R_net"],
  },
];

for (const testCase of MISSING_CASES) {
  const result = calculatePrsScore(testCase.input, PRS_ALPHA_DEFAULT);
  assert.equal(result.status, "missing", `${testCase.name}: status should be missing`);
  assert.equal(result.score, null, `${testCase.name}: score should be null`);
  assert.equal(result.components, null, `${testCase.name}: components should be null`);
  assert.deepEqual(result.missingAxes, testCase.missing, `${testCase.name}: missingAxes`);
  checks += 1;
}

console.log(
  `check_prs_mprs_grouping: OK (${checks} cases — score invariance / K·M·P·R·S recomposition / macro×survival==legacy survival / missing handling)`
);
