/**
 * Before Zero Theory v3.1 — Triple Helix (n=3) 状態空間モデル
 *
 * Etzkowitz & Leydesdorff (1995) の Triple Helix を状態空間モデルで定式化。
 * 隠れ状態 = (Academia, Industry, Government) の 3 つのモメンタム。
 *
 * 詳細仕様: before-zero/theory/state_space_model.md (Triple Helix 拡張)
 */

import type { StateSpaceModel } from "./state-space";

/** 隠れ状態のインデックス */
export const HELIX = {
  A: 0, // Academia momentum (大学・研究)
  I: 1, // Industry momentum (産業・市場)
  G: 2, // Government momentum (政策・予算)
} as const;

/** 観測量のインデックス */
export const OBS = {
  P: 0, // 政策密度 (年率)
  B: 1, // 公募予算 (年率)
  V: 2, // VC 投資 (年率)
  R: 3, // 言及・PR (年率)
  IR: 4, // 研究費投入 (年率)
  N: 5, // 論文 (年率 dN/dt)
} as const;

/** 外生入力のインデックス */
export const EXO = {
  POLICY: 0, // 海外政策 (IRA, EU EPBD など)
  DISASTER: 1, // 災害 (震災など)
  GEOPOL: 2, // 地政学 (ホルムズ, ウクライナ)
} as const;

/**
 * デフォルトの Triple Helix モデル (先験的、materials レーンを想定)
 *
 * - A 行列: 各 helix の慣性 (対角) + 役割交差係数 (非対角)
 *   Etzkowitz の主張する「役割の引き受け合い」が非対角に現れる
 * - C 行列: 観測量 6 個の loadings、MLP/Triple Helix の分類に従う
 *   - P, B → 官 G
 *   - V → 産 I
 *   - I_R → 学 A 主、官 G 副
 *   - N → 学 A
 *   - R → 全層 (両義的観測量)
 * - 外生 u: Landscape 層からのショック
 *
 * 固有値が複素ペアを持つように非対角を非対称に設計 → 軌道が triple helix 的に螺旋
 */
export const DEFAULT_TRIPLE_HELIX: StateSpaceModel = {
  n: 3,
  m: 6,
  p: 3,
  stateNames: ["μ_A (学)", "μ_I (産)", "μ_G (官)"],
  obsNames: ["P", "B", "V", "R", "I_R", "N"],
  exoNames: ["海外政策", "災害", "地政学"],
  // 状態遷移 A (3x3)
  //   行 = 「次期どこに入るか」、列 = 「今期どこから来るか」
  //
  // 設計: 学 → 産 → 官 → 学 の正方向サイクル (a_ji 強く正)、
  //       逆方向 (産 → 学、官 → 産、学 → 官) を弱く負にすることで
  //       「時間遅延的な伝播」を表現し、強い非対称性 = 強い複素固有値モード
  //       = 立体的な triple helix 螺旋を生む。
  //
  // 固有値 (このデフォルトで):
  //   λ_real ≈ 0.99 (実、ほぼ単位根 = 累積トレンドモード)
  //   λ_complex ≈ 0.89 ± 0.32i  (|λ| ≈ 0.94, 周期 ≈ 18 step)
  //   → 安定 (発散しない) かつ強い螺旋
  A: [
    // ←学    ←産    ←官      (列 j: from)
    [0.92, -0.10, 0.20], // → 学  (官 → 学=0.20 正、産 → 学=-0.10 弱負)
    [0.20, 0.92, -0.08], // → 産  (学 → 産=0.20 正、官 → 産=-0.08 弱負)
    [-0.06, 0.18, 0.92], // → 官  (産 → 官=0.18 正、学 → 官=-0.06 弱負)
  ],
  // 外生→状態 B (3x3)
  //   政策ショックは G に強く、災害は G/I に複合、地政学は G に
  B: [
    // 海外政策  災害    地政学
    [0.0,    0.05,   0.0], // → A
    [0.1,    0.4,    0.2], // → I
    [0.6,    0.5,    0.5], // → G
  ],
  // 観測モデル C (6x3)
  //   行 = 観測量、列 = 隠れ状態
  C: [
    //   学    産    官
    [0.05, 0.05, 0.95], // P (政策) — 官駆動
    [0.10, 0.05, 0.85], // B (予算) — 官駆動
    [0.10, 0.85, 0.10], // V (VC)   — 産駆動
    [0.40, 0.35, 0.30], // R (言及) — 全層
    [0.70, 0.10, 0.40], // I_R (研究費) — 学主・官副
    [0.90, 0.05, 0.05], // N (論文) — 学駆動
  ],
  // ノイズ標準偏差 (螺旋を見やすくするため少し抑える)
  qSigma: [0.025, 0.03, 0.025], // 状態ノイズ
  rSigma: [0.05, 0.05, 0.06, 0.10, 0.05, 0.05], // 観測ノイズ
};

// =====================================================================
// 現実的なイベント (外生ショック) のプリセット
// =====================================================================

export interface EventShock {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** B 行列に従って各 helix に伝播する外生ベクトル (length p) */
  uVector: number[];
  /** ジャンプ的に隠れ状態を直接動かす場合 (例: 中西 PMSQ ブレークスルー) */
  stateJump?: number[];
}

export const EVENT_PRESETS: EventShock[] = [
  {
    id: "ira",
    emoji: "🇺🇸",
    label: "IRA / 海外政策",
    description: "海外で大型政策 → 国内政府が反応 → 産業も追随",
    uVector: [2.0, 0, 0],
  },
  {
    id: "earthquake",
    emoji: "🌊",
    label: "震災",
    description: "災害ショック → 政府が緊急予算、産業が再編",
    uVector: [0, 2.0, 0],
  },
  {
    id: "hormuz",
    emoji: "⛽",
    label: "ホルムズ封鎖",
    description: "地政学ショック → エネルギー政策が動く",
    uVector: [0, 0, 2.0],
  },
  {
    id: "breakthrough",
    emoji: "⚡",
    label: "ブレークスルー (中西 PMSQ 等)",
    description: "学アカデミアで突発的発明 → 学モメンタムにジャンプ",
    uVector: [0, 0, 0],
    stateJump: [1.8, 0, 0],
  },
];
