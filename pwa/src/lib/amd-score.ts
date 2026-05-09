/**
 * AMD Score — 7 軸 Cobb-Douglas 統合指標
 *
 * 正本: /Users/masa/projects/AMD/before-zero/theory/amd_score.md (Before Zero Theory v3.2)
 *
 * AMD Score = K · Π (X_i + 1)^α_i
 *   X ∈ { σ_SU, TRL, BRL, GRL, SRL, HRL, FRL }, 各軸 0-9
 *   σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1   (Triple Helix CD 統合, 0-9)
 *   K   = IPO_TARGET / 10^Σα                  (全軸 9 で IPO 級 100,000 に校正)
 *
 * Shallow Tech モード (TRL=null): TRL 軸を計算から除外、6 軸 CD で K を再校正。
 *
 * 重み変更時は K を自動再校正して IPO=100,000 を維持する。
 */

export const AMD_SCORE_AXES = [
  "sigma_SU",
  "TRL",
  "BRL",
  "GRL",
  "SRL",
  "HRL",
  "FRL",
] as const;
export type AmdScoreAxis = (typeof AMD_SCORE_AXES)[number];

export const AXIS_LABEL_JP: Record<AmdScoreAxis, string> = {
  sigma_SU: "σ_SU (マクロ追い風)",
  TRL: "TRL (技術)",
  BRL: "BRL (事業)",
  GRL: "GRL (ガバナンス)",
  SRL: "SRL (社会受容)",
  HRL: "HRL (人材)",
  FRL: "FRL (ファウンダー)",
};

export const AXIS_COLOR: Record<AmdScoreAxis, string> = {
  sigma_SU: "#7c3aed",
  TRL: "#0284c7",
  BRL: "#ea580c",
  GRL: "#475569",
  SRL: "#9333ea",
  HRL: "#16a34a",
  FRL: "#dc2626",
};

export type AlphaWeights = Record<AmdScoreAxis, number>;

/** Base case (まさ判断 + Bernstein 2017 + 内閣府 SIP, sum = 6.0). */
export const ALPHA_DEFAULT: AlphaWeights = {
  sigma_SU: 1.3,
  TRL: 1.0,
  BRL: 0.6,
  GRL: 0.3,
  SRL: 0.2,
  HRL: 1.1,
  FRL: 1.5,
};

export const IPO_TARGET = 100_000;

export function sumAlpha(alpha: AlphaWeights, includeTRL = true): number {
  return AMD_SCORE_AXES
    .filter((a) => includeTRL || a !== "TRL")
    .reduce((acc, a) => acc + (alpha[a] ?? 0), 0);
}

/** K = IPO_TARGET / 10^Σα. Shallow Tech は TRL 軸を除いた Σα で再校正。 */
export function computeK(alpha: AlphaWeights, shallowTechMode = false): number {
  const s = sumAlpha(alpha, !shallowTechMode);
  return IPO_TARGET / Math.pow(10, s);
}

/** σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1。範囲 0-9。 */
export function computeSigmaSU(mu_A: number, mu_I: number, mu_G: number): number {
  const product = (mu_A + 1) * (mu_I + 1) * (mu_G + 1);
  return Math.pow(product, 1 / 3) - 1;
}

export interface AmdScoreInput {
  mu_A: number;
  mu_I: number;
  mu_G: number;
  TRL: number | null; // null = Shallow Tech
  BRL: number;
  GRL: number;
  SRL: number;
  HRL: number;
  FRL: number;
}

export type AmdScorePhase =
  | "seed_watch"
  | "seed_emerging"
  | "pre_launch"
  | "launch_prep"
  | "launch_go"
  | "scale"
  | "graduation";

export const PHASE_LABEL_JP: Record<AmdScorePhase, string> = {
  seed_watch: "シーズ察知",
  seed_emerging: "シーズ顕在化",
  pre_launch: "立ち上げ準備期",
  launch_prep: "設立準備スタート",
  launch_go: "設立 GO",
  scale: "スケール期",
  graduation: "卒業期",
};

export const PHASE_COLOR: Record<AmdScorePhase, string> = {
  seed_watch: "#dc2626",
  seed_emerging: "#94a3b8",
  pre_launch: "#f97316",
  launch_prep: "#eab308",
  launch_go: "#0284c7",
  scale: "#16a34a",
  graduation: "#7c3aed",
};

const PHASE_THRESHOLDS: Array<[number, AmdScorePhase]> = [
  [30, "seed_watch"],
  [300, "seed_emerging"],
  [1500, "pre_launch"],
  [3500, "launch_prep"],
  [15000, "launch_go"],
  [50000, "scale"],
  [Infinity, "graduation"],
];

export function classifyPhase(score: number): AmdScorePhase {
  for (const [upper, phase] of PHASE_THRESHOLDS) {
    if (score < upper) return phase;
  }
  return "graduation";
}

export interface AmdScoreResult {
  score: number;
  sigma_SU: number;
  K: number;
  alphaSum: number;
  shallowTechMode: boolean;
  /** 各軸の (X+1)^α 値。score = K × Π contributions[axis]。 */
  contributions: Partial<Record<AmdScoreAxis, number>>;
  /** 軸ごとの寄与シェア (Σ=1)。可視化用 (律速判定には使わない)。 */
  contributionShares: Partial<Record<AmdScoreAxis, number>>;
  /**
   * 軸ごとの marginal sensitivity = α_i / (X_i + 1)。∂S/∂X_i = sensitivity × S。
   * 律速判定はこの値の argmax で行う (Cobb-Douglas の偏微分根拠)。
   */
  sensitivities: Partial<Record<AmdScoreAxis, number>>;
  /**
   * 律速軸 = argmax_i (α_i / (X_i + 1))。
   * 「1 段階上げたとき S が最も大きく増える軸」 = 経営アクションで最初に手当てすべき軸。
   * 根拠: Cobb & Douglas (1928), American Economic Review, 18(1), 139-165.
   */
  bottleneck: AmdScoreAxis;
  phase: AmdScorePhase;
}

/**
 * 7 軸 (Shallow Tech モードでは 6 軸) Cobb-Douglas 計算。
 *
 * 重み変更時は K = IPO_TARGET / 10^Σα で再校正する。
 * 入力値は 0-9 にクリップ (それ以上は理論で未定義)。
 */
export function calculateAmdScore(
  input: AmdScoreInput,
  alpha: AlphaWeights = ALPHA_DEFAULT
): AmdScoreResult {
  const shallowTechMode = input.TRL === null;
  const K = computeK(alpha, shallowTechMode);
  const alphaSum = sumAlpha(alpha, !shallowTechMode);

  const sigma_SU = computeSigmaSU(input.mu_A, input.mu_I, input.mu_G);

  const axisValues: Record<AmdScoreAxis, number | null> = {
    sigma_SU,
    TRL: input.TRL,
    BRL: input.BRL,
    GRL: input.GRL,
    SRL: input.SRL,
    HRL: input.HRL,
    FRL: input.FRL,
  };

  const contributions: Partial<Record<AmdScoreAxis, number>> = {};
  let product = 1;
  for (const axis of AMD_SCORE_AXES) {
    if (shallowTechMode && axis === "TRL") continue;
    const value = axisValues[axis];
    if (value == null) continue;
    const clipped = Math.max(0, Math.min(9, value));
    const contribution = Math.pow(clipped + 1, alpha[axis] ?? 0);
    contributions[axis] = contribution;
    product *= contribution;
  }

  const score = K * product;

  const totalLogContribution = Object.values(contributions).reduce(
    (acc, c) => acc + Math.log(c ?? 1),
    0
  );
  const contributionShares: Partial<Record<AmdScoreAxis, number>> = {};
  for (const axis of AMD_SCORE_AXES) {
    const c = contributions[axis];
    if (c == null) continue;
    contributionShares[axis] = totalLogContribution > 0 ? Math.log(c) / totalLogContribution : 0;
  }

  // 律速判定: ∂S/∂X_i = α_i · S / (X_i + 1) なので、argmax(α_i / (X_i + 1)) が律速。
  // 「1 段階上げたときに S が最も大きく増える軸」= 経営アクションで最初に手当てすべき軸。
  // 旧実装は argmin(contribution_share) で「α が小さい軸が常に律速」になるバグだった。
  // 根拠: Cobb & Douglas (1928), American Economic Review, 18(1), 139-165.
  const sensitivities: Partial<Record<AmdScoreAxis, number>> = {};
  let bottleneck: AmdScoreAxis = "sigma_SU";
  let maxSensitivity = -Infinity;
  for (const axis of AMD_SCORE_AXES) {
    if (shallowTechMode && axis === "TRL") continue;
    const value = axisValues[axis];
    if (value == null) continue;
    const clipped = Math.max(0, Math.min(9, value));
    const sensitivity = (alpha[axis] ?? 0) / (clipped + 1);
    sensitivities[axis] = sensitivity;
    if (sensitivity > maxSensitivity) {
      maxSensitivity = sensitivity;
      bottleneck = axis;
    }
  }

  const phase = classifyPhase(score);

  return {
    score,
    sigma_SU,
    K,
    alphaSum,
    shallowTechMode,
    contributions,
    contributionShares,
    sensitivities,
    bottleneck,
    phase,
  };
}

/** UI で score を log scale バー表示するときの 0-1 正規化。 */
export function logScaleNormalize(score: number, max = IPO_TARGET): number {
  if (score <= 1) return 0;
  return Math.min(1, Math.log10(score) / Math.log10(max));
}

/** alpha JSON (DB 由来) を strict typed にして欠損は default で埋める。 */
export function normalizeAlpha(raw: unknown): AlphaWeights {
  const out: AlphaWeights = { ...ALPHA_DEFAULT };
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    for (const axis of AMD_SCORE_AXES) {
      const v = r[axis];
      if (typeof v === "number" && Number.isFinite(v)) out[axis] = v;
    }
  }
  return out;
}
