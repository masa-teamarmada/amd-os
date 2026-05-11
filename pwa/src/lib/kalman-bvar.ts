/**
 * Kalman smoother (BVAR Phase 3) — Triple Helix 隠れ状態 (μ_A, μ_I, μ_G) を
 * 観測量 y_t = (P, B, V, R, I_R, N, C_compete) から RTS smoother で推定する。
 *
 * 状態空間モデル (前提):
 *   x_t = A x_{t-1} + ε,   ε ~ N(0, Q)    // 状態遷移 (persistence)
 *   y_t = C x_t + η,       η ~ N(0, R_obs) // 観測 (C は triple_helix_loading の 7×3 prior)
 *
 * - A: 3×3、対角 0.95、非対角 0 (= 隠れ状態は前期持続)
 * - Q: diag(0.1, 0.1, 0.1) (= 状態ノイズ)
 * - C: triple_helix_loading.mu_a/mu_i/mu_g (= prior loading をそのまま採用)
 * - R_obs: diag(観測量別の標本分散) (= 観測ノイズ)
 *
 * 欠損観測対応: ある quarter で観測量の一部が NaN (= 取れてない) の場合、
 *   その行を C / R / y から除いて Kalman 更新を走らせる (Bayesian "missing-at-random" 前提)。
 *
 * 正本:
 *   - before-zero/theory/state_space_model.md §10
 *   - before-zero/theory/bvar_prior.md
 *   - pwa/HANDOFF_pwa_rebuild.md ★4
 */

export type Matrix = number[][];
export type Vector = number[];

/** N×N 単位行列 */
export function eye(n: number): Matrix {
  const m: Matrix = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = new Array(n).fill(0);
    row[i] = 1;
    m.push(row);
  }
  return m;
}

/** N×N ゼロ行列 */
export function zeros(rows: number, cols: number): Matrix {
  const m: Matrix = [];
  for (let i = 0; i < rows; i++) m.push(new Array(cols).fill(0));
  return m;
}

/** diag(v_1, ..., v_n) */
export function diag(v: Vector): Matrix {
  const n = v.length;
  const m = zeros(n, n);
  for (let i = 0; i < n; i++) m[i][i] = v[i];
  return m;
}

export function matMul(a: Matrix, b: Matrix): Matrix {
  const ar = a.length;
  const ac = a[0].length;
  const bc = b[0].length;
  const out = zeros(ar, bc);
  for (let i = 0; i < ar; i++) {
    for (let k = 0; k < ac; k++) {
      const aik = a[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < bc; j++) {
        out[i][j] += aik * b[k][j];
      }
    }
  }
  return out;
}

export function matVecMul(a: Matrix, v: Vector): Vector {
  const out = new Array(a.length).fill(0);
  for (let i = 0; i < a.length; i++) {
    let s = 0;
    for (let j = 0; j < v.length; j++) s += a[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

export function matAdd(a: Matrix, b: Matrix): Matrix {
  const out = zeros(a.length, a[0].length);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a[0].length; j++) out[i][j] = a[i][j] + b[i][j];
  return out;
}

export function matSub(a: Matrix, b: Matrix): Matrix {
  const out = zeros(a.length, a[0].length);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a[0].length; j++) out[i][j] = a[i][j] - b[i][j];
  return out;
}

export function vecSub(a: Vector, b: Vector): Vector {
  return a.map((v, i) => v - b[i]);
}

export function matT(a: Matrix): Matrix {
  const r = a.length;
  const c = a[0].length;
  const out = zeros(c, r);
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++) out[j][i] = a[i][j];
  return out;
}

/**
 * N×N 行列の逆行列 (Gauss-Jordan)。
 * 数値的に小さい行列 (≤7×7) しか使わないので素朴実装で十分。
 * 特異の場合は擬似逆 (対角に小さい ridge を足してから再試行)。
 */
export function matInv(a: Matrix): Matrix {
  const n = a.length;
  const m = zeros(n, 2 * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) m[i][j] = a[i][j];
    m[i][n + i] = 1;
  }
  for (let i = 0; i < n; i++) {
    let pivot = i;
    let pivotAbs = Math.abs(m[i][i]);
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(m[r][i]) > pivotAbs) {
        pivot = r;
        pivotAbs = Math.abs(m[r][i]);
      }
    }
    if (pivotAbs < 1e-12) {
      // ridge を足して再帰 (実用上の robust 化)
      const ridge = zeros(n, n);
      for (let k = 0; k < n; k++) ridge[k][k] = 1e-6;
      return matInv(matAdd(a, ridge));
    }
    if (pivot !== i) {
      [m[i], m[pivot]] = [m[pivot], m[i]];
    }
    const div = m[i][i];
    for (let j = 0; j < 2 * n; j++) m[i][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = m[r][i];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) m[r][j] -= factor * m[i][j];
    }
  }
  const out = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) out[i][j] = m[i][n + j];
  }
  return out;
}

// ============================================================================
// Kalman smoother (RTS)
// ============================================================================

export interface KalmanInput {
  /** 観測 y_t (T × m)。欠損は NaN または null。各 t で長さは観測量数 (固定) */
  observations: (number | null)[][];
  /** C 行列 (m × n) — m=観測量数、n=隠れ状態次元 (3) */
  C: Matrix;
  /** R_obs 対角値 (m). 観測ノイズの分散 (推定不可なら 1.0 で OK) */
  Rdiag: Vector;
  /** 状態次元 n (= 3 for Triple Helix) */
  stateDim: number;
  /** A 対角 persistence (default 0.95) */
  aDiag?: number;
  /** Q 対角 (default 0.1) */
  qDiag?: number;
  /** 初期状態平均 (default 全 0) */
  x0?: Vector;
  /** 初期共分散 (default 単位 × 1.0) */
  P0scale?: number;
}

export interface KalmanResult {
  /** smoothed states (T × n) */
  states: Vector[];
  /** smoothed covariances (T × n × n) */
  covariances: Matrix[];
}

/**
 * Kalman filter forward + RTS smoother backward。
 * observations の各時刻で観測量の一部が null/NaN の場合、その行を除外して更新。
 */
export function kalmanSmooth(input: KalmanInput): KalmanResult {
  const T = input.observations.length;
  const n = input.stateDim;
  const m = input.C.length; // 観測量数
  const aDiag = input.aDiag ?? 0.95;
  const qDiag = input.qDiag ?? 0.1;

  const A = zeros(n, n);
  for (let i = 0; i < n; i++) A[i][i] = aDiag;
  const Q = zeros(n, n);
  for (let i = 0; i < n; i++) Q[i][i] = qDiag;

  let xFilt: Vector = input.x0 ? [...input.x0] : new Array(n).fill(0);
  let PFilt: Matrix = (() => {
    const s = input.P0scale ?? 1.0;
    const P = zeros(n, n);
    for (let i = 0; i < n; i++) P[i][i] = s;
    return P;
  })();

  const xFiltAll: Vector[] = [];
  const PFiltAll: Matrix[] = [];
  const xPredAll: Vector[] = [];
  const PPredAll: Matrix[] = [];

  // ========== Forward pass ==========
  for (let t = 0; t < T; t++) {
    // 1-step prediction
    const xPred = matVecMul(A, xFilt);
    const PPred = matAdd(matMul(matMul(A, PFilt), matT(A)), Q);

    // 観測 y_t (有効行のみ)
    const yObs = input.observations[t];
    const validIdx: number[] = [];
    const yEff: number[] = [];
    for (let i = 0; i < m; i++) {
      const v = yObs[i];
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      validIdx.push(i);
      yEff.push(v as number);
    }

    if (validIdx.length === 0) {
      // 観測なし → predict のみ
      xFilt = xPred;
      PFilt = PPred;
    } else {
      // 有効観測でのみ更新 (C_eff, R_eff)
      const Ceff: Matrix = validIdx.map((i) => input.C[i]);
      const Reff = zeros(validIdx.length, validIdx.length);
      for (let i = 0; i < validIdx.length; i++) {
        Reff[i][i] = input.Rdiag[validIdx[i]];
      }

      // S = C_eff P_pred C_eff^T + R_eff
      const CP = matMul(Ceff, PPred);
      const CPCt = matMul(CP, matT(Ceff));
      const S = matAdd(CPCt, Reff);
      const Sinv = matInv(S);

      // K = P_pred C_eff^T S^{-1}
      const PCt = matMul(PPred, matT(Ceff));
      const K = matMul(PCt, Sinv);

      // innovation = y_eff - C_eff x_pred
      const yPred = matVecMul(Ceff, xPred);
      const innov = vecSub(yEff, yPred);

      // x_filt = x_pred + K innov
      const Kinnov = matVecMul(K, innov);
      xFilt = xPred.map((v, i) => v + Kinnov[i]);

      // P_filt = (I - K C_eff) P_pred
      const KC = matMul(K, Ceff);
      const IminusKC = matSub(eye(n), KC);
      PFilt = matMul(IminusKC, PPred);
    }

    xFiltAll.push([...xFilt]);
    PFiltAll.push(PFilt.map((row) => [...row]));
    xPredAll.push(xPred);
    PPredAll.push(PPred);
  }

  // ========== Backward pass (RTS) ==========
  const xSmoothAll: Vector[] = new Array(T);
  const PSmoothAll: Matrix[] = new Array(T);
  xSmoothAll[T - 1] = [...xFiltAll[T - 1]];
  PSmoothAll[T - 1] = PFiltAll[T - 1].map((row) => [...row]);

  for (let t = T - 2; t >= 0; t--) {
    // G_t = P_filt_t A^T (P_pred_{t+1})^{-1}
    const PfAT = matMul(PFiltAll[t], matT(A));
    const PpredNextInv = matInv(PPredAll[t + 1]);
    const G = matMul(PfAT, PpredNextInv);

    // x_smooth_t = x_filt_t + G (x_smooth_{t+1} - x_pred_{t+1})
    const diff = vecSub(xSmoothAll[t + 1], xPredAll[t + 1]);
    const adj = matVecMul(G, diff);
    xSmoothAll[t] = xFiltAll[t].map((v, i) => v + adj[i]);

    // P_smooth_t = P_filt_t + G (P_smooth_{t+1} - P_pred_{t+1}) G^T
    const Pdiff = matSub(PSmoothAll[t + 1], PPredAll[t + 1]);
    const Padj = matMul(matMul(G, Pdiff), matT(G));
    PSmoothAll[t] = matAdd(PFiltAll[t], Padj);
  }

  return { states: xSmoothAll, covariances: PSmoothAll };
}

// ============================================================================
// 観測量 + loading から Kalman 用入力を組み立てるヘルパー
// ============================================================================

export interface ObservationSeries {
  /** 観測量キー ("P", "B", ...) */
  key: string;
  /** loading 行 [mu_a, mu_i, mu_g] (= C 行列の1行) */
  loading: [number, number, number];
  /** time series of value (T 長、null=欠損) */
  values: (number | null)[];
}

/**
 * 観測量系列のリストと長さ T から KalmanInput を構築。
 * 各観測量の history が min/max 正規化済 (0-9) で渡る前提。
 * R_obs は history の標本分散 (= 観測ノイズ大小に効かせる)、最小値 0.25 でクリップ。
 */
export function buildKalmanInput(
  series: ObservationSeries[],
  T: number,
  options?: { aDiag?: number; qDiag?: number }
): KalmanInput {
  // C 行列 (m × 3)
  const C: Matrix = series.map((s) => [...s.loading]);
  // R diag (m)
  const Rdiag: Vector = series.map((s) => {
    const valid = s.values.filter(
      (v): v is number => v !== null && Number.isFinite(v)
    );
    if (valid.length < 2) return 1.0;
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const variance =
      valid.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (valid.length - 1);
    return Math.max(0.25, variance);
  });

  // observations (T × m)
  const observations: (number | null)[][] = [];
  for (let t = 0; t < T; t++) {
    const row: (number | null)[] = series.map((s) => s.values[t] ?? null);
    observations.push(row);
  }

  return {
    observations,
    C,
    Rdiag,
    stateDim: 3,
    aDiag: options?.aDiag ?? 0.95,
    qDiag: options?.qDiag ?? 0.1,
  };
}
