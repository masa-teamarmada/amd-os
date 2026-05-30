import {
  calculateAmdScore,
  computeFrlCES,
  type AlphaWeights,
  type AmdScoreAxis,
  type AmdScoreResult,
} from "@/lib/amd-score";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";

/**
 * 入力行から最終 FRL (0-9) を導出する。
 * F_capability (frl_cap) があれば CES 合成 (F_character=frl × F_capability=frl_cap)、
 * なければ F_character (frl) をそのまま返す (後方互換)。
 * 全 calculateAmdScore 呼び出し元はこのヘルパー経由で FRL を作ること。
 */
export function resolveFrl(row: Pick<AmdScoreInputRow, "frl" | "frl_cap" | "frl_ces_a" | "frl_ces_rho">): number {
  const fChar = row.frl ?? 0;
  return computeFrlCES(fChar, row.frl_cap, row.frl_ces_a ?? undefined, row.frl_ces_rho ?? undefined);
}
import { AAA_PROJECT_ID } from "@/lib/demo-aaa-data";

export interface AmdScoreBreakdown {
  M: number;
  X: number;
  F: number;
  sigma_su: number;
  K: number;
  bottleneck: AmdScoreAxis;
}

export interface AmdScoreComputedPoint {
  id: string;
  evaluated_at: string;
  score: number;
  result: AmdScoreResult;
  breakdown: AmdScoreBreakdown;
}

export interface AmdSignalMetrics {
  m: number;
  x: number;
  f: number;
}

export function latestVisibleScoreInput(inputs: AmdScoreInputRow[], today = new Date().toISOString().slice(0, 10)) {
  for (let i = inputs.length - 1; i >= 0; i -= 1) {
    if (inputs[i].evaluated_at.slice(0, 10) <= today) return inputs[i];
  }
  return null;
}

export function isScoreInputScorable(row: AmdScoreInputRow) {
  return row.mu_A != null && row.mu_I != null && row.mu_G != null;
}

export function latestVisibleScorableScoreInput(inputs: AmdScoreInputRow[], today = new Date().toISOString().slice(0, 10)) {
  for (let i = inputs.length - 1; i >= 0; i -= 1) {
    const row = inputs[i];
    if (row.evaluated_at.slice(0, 10) <= today && isScoreInputScorable(row)) return row;
  }
  return null;
}

export function calculateAmdScoreForInput(row: AmdScoreInputRow, alpha: AlphaWeights) {
  return calculateAmdScore(
    {
      mu_A: row.mu_A ?? 0,
      mu_I: row.mu_I ?? 0,
      mu_G: row.mu_G ?? 0,
      TRL: row.shallow_tech_mode ? null : row.trl ?? 0,
      BRL: row.brl ?? 0,
      GRL: row.grl ?? 0,
      SRL: row.srl ?? 0,
      HRL: row.hrl ?? 0,
      FRL: resolveFrl(row),
    },
    alpha
  );
}

export function breakdownFromResult(result: AmdScoreResult): AmdScoreBreakdown {
  const xrlAxes: AmdScoreAxis[] = ["TRL", "BRL", "GRL", "SRL", "HRL"];
  const M = result.contributions.sigma_SU ?? 1;
  let X = 1;
  for (const axis of xrlAxes) {
    if (axis === "TRL" && result.shallowTechMode) continue;
    X *= result.contributions[axis] ?? 1;
  }
  const F = result.contributions.FRL ?? 1;
  return { M, X, F, sigma_su: result.sigma_SU, K: result.K, bottleneck: result.bottleneck };
}

export function computeAmdScoreSeries(inputs: AmdScoreInputRow[], alpha: AlphaWeights): AmdScoreComputedPoint[] {
  return inputs
    .filter(isScoreInputScorable)
    .map((row) => {
      const result = calculateAmdScoreForInput(row, alpha);
      return {
        id: row.id,
        evaluated_at: row.evaluated_at.slice(0, 10),
        score: result.score,
        result,
        breakdown: breakdownFromResult(result),
      };
    });
}

export function scoreInputToSignalMetrics(row: AmdScoreInputRow, alpha: AlphaWeights): AmdSignalMetrics | null {
  if (row.mu_A == null || row.mu_I == null || row.mu_G == null) return null;
  const result = calculateAmdScoreForInput(row, alpha);
  const breakdown = breakdownFromResult(result);
  return {
    m: roundSignalValue(breakdown.M),
    x: roundSignalValue(breakdown.X),
    f: roundSignalValue(breakdown.F),
  };
}

export function buildAaaScoreInputsFromSx(sourceRows: AmdScoreInputRow[], alpha: AlphaWeights): AmdScoreInputRow[] {
  return sourceRows.map((row, index) => cloneRowWithScaledMxf(row, alpha, index));
}

function cloneRowWithScaledMxf(row: AmdScoreInputRow, alpha: AlphaWeights, index: number): AmdScoreInputRow {
  const sigma = Math.max(0, Math.min(9, resultSafeSigma(row)));
  const nextSigma = scaleInputValueByContribution(sigma, alpha.sigma_SU ?? 0, 1.05);
  const activeXAxes: Array<Exclude<AmdScoreAxis, "sigma_SU" | "FRL">> = ["TRL", "BRL", "GRL", "SRL", "HRL"].filter((axis) => {
    if (axis === "TRL" && row.shallow_tech_mode) return false;
    return true;
  }) as Array<Exclude<AmdScoreAxis, "sigma_SU" | "FRL">>;
  const xScale = Math.pow(1.05, 1 / Math.max(1, activeXAxes.length));

  return {
    ...row,
    id: `${AAA_PROJECT_ID}-from-sx-${index + 1}`,
    project_id: AAA_PROJECT_ID,
    mu_A: nextSigma,
    mu_I: nextSigma,
    mu_G: nextSigma,
    trl: row.shallow_tech_mode ? null : scaleInputValueByContribution(row.trl ?? 0, alpha.TRL ?? 0, xScale),
    brl: scaleInputValueByContribution(row.brl ?? 0, alpha.BRL ?? 0, xScale),
    grl: scaleInputValueByContribution(row.grl ?? 0, alpha.GRL ?? 0, xScale),
    srl: scaleInputValueByContribution(row.srl ?? 0, alpha.SRL ?? 0, xScale),
    hrl: scaleInputValueByContribution(row.hrl ?? 0, alpha.HRL ?? 0, xScale),
    frl: scaleInputValueByContribution(resolveFrl(row), alpha.FRL ?? 0, 1.05),
    alq_self_awareness: null,
    alq_relational_transparency: null,
    alq_balanced_processing: null,
    alq_internalized_moral: null,
    frl_grit: null,
    frl_resilience: null,
    frl_cap: null,
    frl_cap_amd: null,
    frl_cap_notes: null,
    frl_ces_a: null,
    frl_ces_rho: null,
    evaluator: "sx-derived-demo",
    notes: "P99-AAA demo score data cloned from SX with M/X/F contributions scaled by 1.05.",
  };
}

function resultSafeSigma(row: AmdScoreInputRow) {
  const a = row.mu_A ?? 0;
  const i = row.mu_I ?? 0;
  const g = row.mu_G ?? 0;
  return Math.pow((a + 1) * (i + 1) * (g + 1), 1 / 3) - 1;
}

function scaleInputValueByContribution(value: number, axisAlpha: number, multiplier: number) {
  if (!Number.isFinite(value) || !Number.isFinite(axisAlpha) || axisAlpha <= 0) return value;
  const clipped = Math.max(0, Math.min(9, value));
  const contribution = Math.pow(clipped + 1, axisAlpha);
  const next = Math.pow(contribution * multiplier, 1 / axisAlpha) - 1;
  return Math.max(0, Math.min(9, next));
}

function roundSignalValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}
