#!/usr/bin/env node
/**
 * 全国全研究機関共通シーズ SPS pure helper (seed-sps.ts) 回帰テスト
 *
 * 検証項目:
 *   1. 全軸が揃っている場合、calculatePrsScore を直接呼んだ結果と 1e-9 以内で一致 (別式・別重みを作っていないことの確認)
 *   2. 個々の必須軸が欠けている場合、それぞれ status:"missing" + missingAxes に該当キーが入る
 *   3. shallow_tech_mode=true のとき trl が null でも missing 扱いにしない
 *   4. f_cap が null でも computeFrlCES の後方互換フォールバックで ready になる
 *
 * 実行: node --experimental-strip-types scripts/check_seed_sps_score.mts
 */
import assert from "node:assert/strict";
import { calculatePrsScore, computeFrlCES, PRS_ALPHA_DEFAULT } from "../src/lib/amd-score.ts";
import {
  calculateSeedSpsScore,
  type SeedSpsAssessmentAxes,
  type SeedSpsAxisKey,
} from "../src/lib/seed-sps.ts";

const REL_TOL = 1e-9;

function assertClose(actual: number, expected: number, label: string) {
  const scale = Math.max(1, Math.abs(expected));
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= REL_TOL * scale, `${label}: |${actual} - ${expected}| = ${diff} > ${REL_TOL * scale}`);
}

function fullAxes(): SeedSpsAssessmentAxes {
  return {
    mu_a: 6,
    mu_i: 5,
    mu_g: 7,
    potential: 6,
    trl: 4,
    brl: 3,
    grl: 2,
    srl: 5,
    hrl: 4,
    f_character: 6,
    f_cap: 5,
    r_net: 3,
    shallow_tech_mode: false,
  };
}

// 1. 全軸が揃っている場合、calculatePrsScore を直接呼んだ結果と完全一致する (別式禁止の確認)
{
  const axes = fullAxes();
  const result = calculateSeedSpsScore(axes);

  const frl = computeFrlCES(axes.f_character as number, axes.f_cap);
  const expected = calculatePrsScore(
    {
      P: axes.potential,
      mu_A: axes.mu_a as number,
      mu_I: axes.mu_i as number,
      mu_G: axes.mu_g as number,
      TRL: axes.trl,
      BRL: axes.brl as number,
      GRL: axes.grl as number,
      SRL: axes.srl as number,
      HRL: axes.hrl as number,
      FRL: frl,
      R_net: axes.r_net,
    },
    PRS_ALPHA_DEFAULT
  );

  assert.equal(result.status, "ready");
  assert.equal(result.status, expected.status);
  assert.equal(result.missingAxes.length, 0);
  assertClose(result.score as number, expected.score as number, "score");
  assertClose(result.K as number, expected.K, "K");
  assertClose(result.alphaSum as number, expected.alphaSum, "alphaSum");
  assertClose(result.components!.macro, expected.components!.macro, "components.macro");
  assertClose(result.components!.potential, expected.components!.potential, "components.potential");
  assertClose(result.components!.reach, expected.components!.reach, "components.reach");
  assertClose(result.components!.survival, expected.components!.survival, "components.survival");
  assertClose(result.frl as number, frl, "frl");
}

// 2. 個々の必須軸欠損 → status:"missing" + 該当キーが missingAxes に入る
{
  const requiredKeys: Exclude<SeedSpsAxisKey, "trl">[] = [
    "mu_a",
    "mu_i",
    "mu_g",
    "potential",
    "brl",
    "grl",
    "srl",
    "hrl",
    "f_character",
    "r_net",
  ];
  for (const key of requiredKeys) {
    const axes = fullAxes();
    axes[key] = null;
    const result = calculateSeedSpsScore(axes);
    assert.equal(result.status, "missing", `${key} が null なのに missing になっていません`);
    assert.equal(result.score, null);
    assert.equal(result.components, null);
    assert.ok(result.missingAxes.includes(key), `missingAxes に ${key} が含まれていません`);
  }

  // trl は shallow_tech_mode=false のときのみ必須
  {
    const axes = fullAxes();
    axes.trl = null;
    const result = calculateSeedSpsScore(axes);
    assert.equal(result.status, "missing");
    assert.ok(result.missingAxes.includes("trl"));
  }
}

// 3. shallow_tech_mode=true のとき trl=null でも missing にしない
{
  const axes = fullAxes();
  axes.trl = null;
  axes.shallow_tech_mode = true;
  const result = calculateSeedSpsScore(axes);
  assert.equal(result.status, "ready", "shallow_tech_mode で trl null なのに ready になっていません");
  assert.equal(result.shallowTechMode, true);
  assert.ok(result.score != null);
}

// 4. f_cap が null でも computeFrlCES の後方互換フォールバックで ready になる
{
  const axes = fullAxes();
  axes.f_cap = null;
  const result = calculateSeedSpsScore(axes);
  assert.equal(result.status, "ready");
  assertClose(result.frl as number, axes.f_character as number, "f_cap null 時の frl フォールバック");
}

// 5. 公開型 SeedPublicSpsAssessment は axes/components を持ち、axis_evidence/evaluator を持たない
{
  const axes = fullAxes();
  const scored = calculateSeedSpsScore(axes);
  const publicAssessment = {
    evaluated_at: "2026-07-20",
    status: scored.status,
    score: scored.score,
    confidence: "low" as const,
    missing_axes: scored.missingAxes,
    axes: { trl: axes.trl, brl: axes.brl, grl: axes.grl, srl: axes.srl, hrl: axes.hrl },
    components: scored.components,
  };
  const keys = Object.keys(publicAssessment);
  assert.ok(keys.includes("axes"), "公開 SPS サマリに axes が無い");
  assert.ok(keys.includes("components"), "公開 SPS サマリに components が無い");
  assert.ok(!keys.includes("axis_evidence"), "公開 SPS サマリに axis_evidence が漏れている");
  assert.ok(!keys.includes("evaluator"), "公開 SPS サマリに evaluator が漏れている");
  assert.deepEqual(Object.keys(publicAssessment.axes), ["trl", "brl", "grl", "srl", "hrl"]);
  assert.deepEqual(Object.keys(publicAssessment.components!), ["macro", "potential", "reach", "survival"]);
}

console.log("check_seed_sps_score.mts: all checks passed");
