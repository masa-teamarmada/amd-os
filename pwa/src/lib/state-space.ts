/**
 * Before Zero Theory v3.1 — 状態空間モデル (Level 4 一般形)
 *
 * 数式 (離散時間):
 *   x_{t+1} = A x_t + B u_t + ε_t
 *   y_t     = C x_t + D u_t + η_t
 *
 * プロトタイプ A: 状態次元 n=2、観測なし、外生 u もインパルスのみ
 * 目的: A 行列を手で動かして固有値と軌道の関係を体感する
 *
 * 詳細仕様: before-zero/theory/state_space_model.md
 */

export interface Matrix2x2 {
  a11: number;
  a12: number;
  a21: number;
  a22: number;
}

export interface Vec2 {
  x1: number;
  x2: number;
}

export interface Eigenvalue {
  /** 実部 */
  re: number;
  /** 虚部 (絶対値、複素ペアの片方として扱う) */
  im: number;
  /** 絶対値 |λ| */
  abs: number;
  /** true なら複素 (虚部 != 0)、false なら実 */
  isComplex: boolean;
}

export interface EigenAnalysis {
  /** 2 つの固有値 */
  lambdas: [Eigenvalue, Eigenvalue];
  /** 系の安定性: stable (|λ| < 1 全部), neutral (= 1), unstable (> 1) */
  stability: "stable" | "neutral" | "unstable";
  /** 振動性 */
  oscillation: "monotone" | "oscillating" | "alternating";
  /** 周期 (複素固有値時、離散時間ステップ単位) */
  period: number | null;
  /** 減衰時定数 (|λ| < 1 のとき、ステップ単位で 1/e に減衰) */
  decayTime: number | null;
}

/**
 * 2x2 行列 A の固有値を解析的に求める。
 *
 * 特性方程式: λ^2 - tr(A) λ + det(A) = 0
 *   λ = (tr ± √(tr² - 4·det)) / 2
 *
 * 判別式が負なら複素ペア (共役)。
 */
export function eigenvalues2x2(A: Matrix2x2): EigenAnalysis {
  const tr = A.a11 + A.a22;
  const det = A.a11 * A.a22 - A.a12 * A.a21;
  const disc = tr * tr - 4 * det;

  let lambdas: [Eigenvalue, Eigenvalue];
  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    const l1 = (tr + sq) / 2;
    const l2 = (tr - sq) / 2;
    lambdas = [
      { re: l1, im: 0, abs: Math.abs(l1), isComplex: false },
      { re: l2, im: 0, abs: Math.abs(l2), isComplex: false },
    ];
  } else {
    const sq = Math.sqrt(-disc);
    const re = tr / 2;
    const im = sq / 2;
    const abs = Math.sqrt(re * re + im * im);
    lambdas = [
      { re, im, abs, isComplex: true },
      { re, im: -im, abs, isComplex: true },
    ];
  }

  const maxAbs = Math.max(lambdas[0].abs, lambdas[1].abs);
  const stability: EigenAnalysis["stability"] =
    maxAbs < 0.999 ? "stable" : maxAbs > 1.001 ? "unstable" : "neutral";

  let oscillation: EigenAnalysis["oscillation"];
  let period: number | null = null;
  if (lambdas[0].isComplex) {
    oscillation = "oscillating";
    // 離散時間: λ = r·e^{iθ} (r=abs, θ=arg)、周期 T = 2π/θ
    const theta = Math.atan2(Math.abs(lambdas[0].im), lambdas[0].re);
    period = theta > 1e-9 ? (2 * Math.PI) / theta : null;
  } else if (lambdas[0].re < 0 || lambdas[1].re < 0) {
    oscillation = "alternating";
  } else {
    oscillation = "monotone";
  }

  // 減衰時定数: |λ|^t = 1/e → t = -1/ln|λ|
  const decayTime =
    maxAbs > 0 && maxAbs < 1 ? -1 / Math.log(maxAbs) : null;

  return { lambdas, stability, oscillation, period, decayTime };
}

/**
 * 1 ステップ進める: x_{t+1} = A x_t + (impulse 等の外力)
 */
export function step(
  A: Matrix2x2,
  x: Vec2,
  impulse: Vec2 = { x1: 0, x2: 0 },
): Vec2 {
  return {
    x1: A.a11 * x.x1 + A.a12 * x.x2 + impulse.x1,
    x2: A.a21 * x.x1 + A.a22 * x.x2 + impulse.x2,
  };
}

/**
 * N ステップ分シミュレーション
 *
 * @param A 状態遷移行列
 * @param x0 初期状態
 * @param steps ステップ数
 * @param impulses 各ステップで与える外力 (省略時はゼロ)
 */
export function simulate(
  A: Matrix2x2,
  x0: Vec2,
  steps: number,
  impulses?: Vec2[],
): Vec2[] {
  const trajectory: Vec2[] = [x0];
  let x = x0;
  for (let t = 0; t < steps; t++) {
    const u = impulses?.[t] ?? { x1: 0, x2: 0 };
    x = step(A, x, u);
    trajectory.push(x);
  }
  return trajectory;
}

/** プリセット: 学習用に効果がわかりやすい A 行列 */
export const PRESETS: Record<string, { A: Matrix2x2; description: string }> = {
  damped: {
    A: { a11: 0.9, a12: 0, a21: 0, a22: 0.85 },
    description: "減衰: 対角のみ、独立に減衰",
  },
  spiral: {
    A: { a11: 0.92, a12: -0.3, a21: 0.3, a22: 0.92 },
    description: "螺旋減衰: 非対称結合 → 複素固有値",
  },
  oscillation: {
    A: { a11: 0.99, a12: -0.2, a21: 0.2, a22: 0.99 },
    description: "持続振動: |λ| ≈ 1 ギリギリ",
  },
  unstable: {
    A: { a11: 1.05, a12: -0.1, a21: 0.1, a22: 1.05 },
    description: "発散: |λ| > 1",
  },
  symmetric: {
    A: { a11: 0.9, a12: 0.2, a21: 0.2, a22: 0.9 },
    description: "対称結合: 実固有値、振動なし",
  },
  unitRoot: {
    A: { a11: 1.0, a12: 0.05, a21: 0.0, a22: 0.95 },
    description: "単位根: 一方向に累積 (例: 累積論文 N)",
  },
};
