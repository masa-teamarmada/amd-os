// 全国全研究機関のシーズ共通 SPS (M・P・R・S) pure helper。
// 別式・別重みは作らない。amd-score.ts の calculatePrsScore / PRS_ALPHA_DEFAULT を
// そのまま再利用する (計算式の正本は amd-score.ts に一本化)。
// I/O を持たないため node --experimental-strip-types から直接 import してテストできる。
//
// migration: pwa/scripts/migrations/187_seed_sps_assessments.sql
// 設計: pwa/design/seeds.md

import {
  calculatePrsScore,
  computeFrlCES,
  PRS_ALPHA_DEFAULT,
  type PrsComponentBreakdown,
  type PrsScoreWeights,
} from "./amd-score.ts";

export type SeedSpsAxisKey =
  | "mu_a"
  | "mu_i"
  | "mu_g"
  | "potential"
  | "trl"
  | "brl"
  | "grl"
  | "srl"
  | "hrl"
  | "f_character"
  | "r_net";

/** seed_sps_assessments の生の評価軸 (DB 行の数値/フラグ部分のみ) */
export interface SeedSpsAssessmentAxes {
  mu_a: number | null;
  mu_i: number | null;
  mu_g: number | null;
  potential: number | null;
  trl: number | null;
  brl: number | null;
  grl: number | null;
  srl: number | null;
  hrl: number | null;
  f_character: number | null;
  f_cap: number | null;
  r_net: number | null;
  shallow_tech_mode: boolean;
}

export interface SeedSpsScoreResult {
  status: "ready" | "missing";
  score: number | null;
  missingAxes: SeedSpsAxisKey[];
  frl: number | null;
  K: number | null;
  alphaSum: number | null;
  shallowTechMode: boolean;
  components: PrsComponentBreakdown | null;
}

function isMissing(value: number | null | undefined): boolean {
  return value == null || !Number.isFinite(value);
}

/**
 * 全国全研究機関で共通のシーズ SPS 計算。必要な軸が全て揃った場合のみ
 * calculatePrsScore を呼んでスコアを返す。欠けている軸があれば計算せず
 * missingAxes で報告する (捏造禁止)。
 */
export function calculateSeedSpsScore(
  axes: SeedSpsAssessmentAxes,
  weights: PrsScoreWeights = PRS_ALPHA_DEFAULT
): SeedSpsScoreResult {
  const missingAxes: SeedSpsAxisKey[] = [];
  const required: [SeedSpsAxisKey, number | null][] = [
    ["mu_a", axes.mu_a],
    ["mu_i", axes.mu_i],
    ["mu_g", axes.mu_g],
    ["potential", axes.potential],
    ["brl", axes.brl],
    ["grl", axes.grl],
    ["srl", axes.srl],
    ["hrl", axes.hrl],
    ["f_character", axes.f_character],
    ["r_net", axes.r_net],
  ];
  for (const [key, value] of required) {
    if (isMissing(value)) missingAxes.push(key);
  }
  if (!axes.shallow_tech_mode && isMissing(axes.trl)) {
    missingAxes.push("trl");
  }

  if (missingAxes.length > 0) {
    return {
      status: "missing",
      score: null,
      missingAxes,
      frl: null,
      K: null,
      alphaSum: null,
      shallowTechMode: axes.shallow_tech_mode,
      components: null,
    };
  }

  const frl = computeFrlCES(axes.f_character as number, axes.f_cap);
  const result = calculatePrsScore(
    {
      P: axes.potential,
      mu_A: axes.mu_a as number,
      mu_I: axes.mu_i as number,
      mu_G: axes.mu_g as number,
      TRL: axes.shallow_tech_mode ? null : axes.trl,
      BRL: axes.brl as number,
      GRL: axes.grl as number,
      SRL: axes.srl as number,
      HRL: axes.hrl as number,
      FRL: frl,
      R_net: axes.r_net,
    },
    weights
  );

  return {
    status: result.status,
    score: result.score,
    missingAxes: [],
    frl,
    K: result.K,
    alphaSum: result.alphaSum,
    shallowTechMode: result.shallowTechMode,
    components: result.components,
  };
}
