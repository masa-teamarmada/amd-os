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

// =====================================================================
// 任意次元の状態空間モデル (n-dim state, m-dim obs, p-dim exo)
// プロトタイプ C (Triple Helix, n=3) で利用
// =====================================================================

export interface StateSpaceModel {
  n: number; // 隠れ状態次元
  m: number; // 観測次元
  p: number; // 外生入力次元
  /** 状態名 (UI 表示用) */
  stateNames: string[];
  /** 観測量名 */
  obsNames: string[];
  /** 外生入力名 */
  exoNames: string[];
  /** 状態遷移行列 A (n x n) */
  A: number[][];
  /** 外生→状態 行列 B (n x p) */
  B: number[][];
  /** 観測モデル C (m x n) */
  C: number[][];
  /** 状態ノイズ標準偏差 (対角、長さ n) */
  qSigma: number[];
  /** 観測ノイズ標準偏差 (対角、長さ m) */
  rSigma: number[];
}

/** 行列ベクトル積: y = M v */
function matVec(M: number[][], v: number[]): number[] {
  const rows = M.length;
  const cols = v.length;
  const out = new Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    let s = 0;
    for (let j = 0; j < cols; j++) s += M[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

/** 簡易ガウス乱数 (Box-Muller) */
function randn(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** seed 付き擬似乱数 (Mulberry32) — 再現性のため */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulationResult {
  /** 隠れ状態の時系列 [T+1][n] */
  states: number[][];
  /** 観測量の時系列 [T+1][m] */
  observations: number[][];
  /** 外生入力の時系列 [T][p] */
  inputs: number[][];
}

/**
 * 状態空間モデルを T ステップ シミュレートする
 *
 * x_{t+1} = A x_t + B u_t + ε_t,  ε_t ~ N(0, diag(qSigma²))
 * y_t     = C x_t + η_t,         η_t ~ N(0, diag(rSigma²))
 */
export function simulateStateSpace(
  model: StateSpaceModel,
  x0: number[],
  T: number,
  inputs: number[][],
  seed = 42,
): SimulationResult {
  const rng = mulberry32(seed);
  const states: number[][] = [x0.slice()];
  const observations: number[][] = [];

  // 観測 y_0
  const y0 = matVec(model.C, x0).map(
    (yi, i) => yi + model.rSigma[i] * randn(rng),
  );
  observations.push(y0);

  let x = x0.slice();
  for (let t = 0; t < T; t++) {
    const u = inputs[t] ?? new Array(model.p).fill(0);
    const Ax = matVec(model.A, x);
    const Bu = matVec(model.B, u);
    const xNext = new Array(model.n);
    for (let i = 0; i < model.n; i++) {
      xNext[i] = Ax[i] + Bu[i] + model.qSigma[i] * randn(rng);
    }
    x = xNext;
    states.push(x.slice());
    const y = matVec(model.C, x).map(
      (yi, i) => yi + model.rSigma[i] * randn(rng),
    );
    observations.push(y);
  }

  return { states, observations, inputs };
}

// =====================================================================
// 3x3 固有値 (Cardano 法、外部依存なし)
// =====================================================================

export interface ComplexEigen {
  re: number;
  im: number;
  abs: number;
  isComplex: boolean;
}

export interface EigenAnalysis3 {
  lambdas: ComplexEigen[];
  stability: "stable" | "neutral" | "unstable";
  /** 最大絶対値 (= スペクトル半径) */
  maxAbs: number;
  /** 複素ペアがあれば、その周期 (離散時間 step 単位) */
  period: number | null;
  /** 減衰時定数 (max|λ| < 1 のときのみ) */
  decayTime: number | null;
}

/**
 * 3x3 行列の固有値を Cardano 法で求める
 *
 * 特性多項式: λ³ + b λ² + c λ + d = 0
 *   b = -tr(A)
 *   c = (sum of principal 2x2 minors)
 *   d = -det(A)
 *
 * 置換 λ = t - b/3 で depressed cubic: t³ + p t + q = 0
 */
export function eigenvalues3x3(A: number[][]): EigenAnalysis3 {
  const a11 = A[0][0], a12 = A[0][1], a13 = A[0][2];
  const a21 = A[1][0], a22 = A[1][1], a23 = A[1][2];
  const a31 = A[2][0], a32 = A[2][1], a33 = A[2][2];

  const tr = a11 + a22 + a33;
  // sum of 2x2 principal minors
  const m12 = a11 * a22 - a12 * a21;
  const m13 = a11 * a33 - a13 * a31;
  const m23 = a22 * a33 - a23 * a32;
  const minors = m12 + m13 + m23;
  const det =
    a11 * (a22 * a33 - a23 * a32) -
    a12 * (a21 * a33 - a23 * a31) +
    a13 * (a21 * a32 - a22 * a31);

  // 特性多項式: λ³ - tr λ² + minors λ - det = 0
  // 形を λ³ + b λ² + c λ + d にすると
  const b = -tr;
  const c = minors;
  const d = -det;

  // depressed cubic: t³ + p t + q = 0,  λ = t - b/3
  const shift = b / 3;
  const p = c - (b * b) / 3;
  const q = (2 * b * b * b) / 27 - (b * c) / 3 + d;

  // 判別式 Δ = -(4 p³ + 27 q²)
  const disc = -(4 * p * p * p + 27 * q * q);

  const lambdas: ComplexEigen[] = [];

  if (Math.abs(p) < 1e-12 && Math.abs(q) < 1e-12) {
    // λ = -shift の三重根
    const re = -shift;
    for (let i = 0; i < 3; i++) {
      lambdas.push({ re, im: 0, abs: Math.abs(re), isComplex: false });
    }
  } else if (disc >= 0) {
    // 3 つとも実 (Casus irreducibilis 含む) — trigonometric solution
    const r = Math.sqrt(-(p * p * p) / 27);
    const cosArg = Math.max(-1, Math.min(1, -q / (2 * r)));
    const phi = Math.acos(cosArg);
    const m = 2 * Math.cbrt(r);
    for (let k = 0; k < 3; k++) {
      const t = m * Math.cos(phi / 3 + (2 * Math.PI * k) / 3);
      const re = t - shift;
      lambdas.push({ re, im: 0, abs: Math.abs(re), isComplex: false });
    }
  } else {
    // 1 つ実 + 2 つ複素共役 — Cardano formula
    const sqrtTerm = Math.sqrt((q * q) / 4 + (p * p * p) / 27);
    const u = Math.cbrt(-q / 2 + sqrtTerm);
    const v = Math.cbrt(-q / 2 - sqrtTerm);
    const tReal = u + v;
    const reReal = tReal - shift;
    lambdas.push({
      re: reReal,
      im: 0,
      abs: Math.abs(reReal),
      isComplex: false,
    });
    // 複素ペア: t = -(u+v)/2 ± i(u-v)√3/2
    const reC = -(u + v) / 2 - shift;
    const imC = ((u - v) * Math.sqrt(3)) / 2;
    const absC = Math.sqrt(reC * reC + imC * imC);
    lambdas.push({ re: reC, im: imC, abs: absC, isComplex: true });
    lambdas.push({ re: reC, im: -imC, abs: absC, isComplex: true });
  }

  const maxAbs = Math.max(...lambdas.map((l) => l.abs));
  const stability: EigenAnalysis3["stability"] =
    maxAbs < 0.999 ? "stable" : maxAbs > 1.001 ? "unstable" : "neutral";

  // 周期 (複素ペアがあれば、最も振動的なやつ = 虚部最大)
  const complex = lambdas.filter((l) => l.isComplex && l.im > 0);
  let period: number | null = null;
  if (complex.length > 0) {
    const dom = complex.reduce((a, b) => (a.abs > b.abs ? a : b));
    const theta = Math.atan2(dom.im, dom.re);
    period = theta > 1e-9 ? (2 * Math.PI) / theta : null;
  }

  const decayTime =
    maxAbs > 0 && maxAbs < 1 ? -1 / Math.log(maxAbs) : null;

  return { lambdas, stability, maxAbs, period, decayTime };
}

// =====================================================================
// プロトタイプ A 用の 2x2 プリセット (既存)
// =====================================================================

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
