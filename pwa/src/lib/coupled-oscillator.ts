/**
 * Before Zero Theory v3 — 連成振動モデル (Coupled Oscillator System)
 *
 * 数式: M ẍ + C ẋ + K x = F_E(t) + dJ
 *
 * - x = (P, B, I_R, N, V, R) ∈ R^6  : 平衡位置からの変位
 * - M : 質量行列 (慣性、変わりにくさ)
 * - C : 減衰行列 (摩擦、戻りやすさ)
 * - K : 剛性行列 (ばね定数) — オフ対角が結合
 * - F_E(t) : 外力 (海外政策・災害・地政学のインパルス)
 * - dJ : ジャンプ項 (ブレークスルー、半外生)
 *
 * 数値積分: Velocity Verlet (シンプル・安定)
 *
 * 詳細仕様: knowledge/before_zero_theory.md の論点 V03-O 参照
 */

export type NodeId = "P" | "B" | "I_R" | "N" | "V" | "R";

export const NODE_IDS: NodeId[] = ["P", "B", "I_R", "N", "V", "R"];

export interface NodeMeta {
  id: NodeId;
  label: string;
  description: string;
  /** 平面上 (xz 面) の平衡位置。N を中心 (0,0)、他を五角形で配置 */
  equilibrium: { x: number; z: number };
  color: string;
}

// 五角形配置 (N が中心、半径 r=2.5)
const r = 2.5;
const pent = (i: number) => ({
  x: r * Math.cos(((i * 72 - 90) * Math.PI) / 180),
  z: r * Math.sin(((i * 72 - 90) * Math.PI) / 180),
});

export const NODE_META: Record<NodeId, NodeMeta> = {
  P: { id: "P", label: "P", description: "政策密度 (年率)", equilibrium: pent(0), color: "#2563eb" },
  B: { id: "B", label: "B", description: "公募予算 (年率)", equilibrium: pent(1), color: "#0891b2" },
  V: { id: "V", label: "V", description: "VC投資 (年率)", equilibrium: pent(2), color: "#16a34a" },
  R: { id: "R", label: "R", description: "言及・PR (年率)", equilibrium: pent(3), color: "#ea580c" },
  I_R: { id: "I_R", label: "I_R", description: "研究費 (年率)", equilibrium: pent(4), color: "#a16207" },
  N: { id: "N", label: "Ṅ", description: "論文 (年率 dN/dt)", equilibrium: { x: 0, z: 0 }, color: "#dc2626" },
};

export interface Bond {
  from: NodeId;
  to: NodeId;
  /** ばね定数 (結合強度) */
  k: number;
  /** ラグ目安 (現状の数値積分では未使用、表示用) */
  lagLabel?: string;
}

/**
 * 結合 (ばね) の定義
 * v0.3 SVG 図の主要矢印に対応する。係数 k は定性 (強=2.5, 中=1.5, 弱=0.8)
 * オフ対角の対称性のため、双方向の結合は 1 本にまとめる。
 */
export const BONDS: Bond[] = [
  { from: "P", to: "B", k: 2.5, lagLabel: "6-12m" },
  { from: "B", to: "I_R", k: 2.5, lagLabel: "0-6m" },
  { from: "I_R", to: "N", k: 1.8, lagLabel: "1-3y" },
  { from: "N", to: "P", k: 1.0, lagLabel: "1-3y (論文先行)" },
  { from: "N", to: "R", k: 1.5, lagLabel: "0-6m" },
  { from: "N", to: "V", k: 1.2, lagLabel: "2-5y" },
  { from: "N", to: "I_R", k: 0.8, lagLabel: "1-2y (追加採択)" },
  { from: "R", to: "V", k: 1.5, lagLabel: "0-12m (PR効果)" },
];

/**
 * 質量 (慣性) — 大きいほど動きにくい
 * - N: 累積論文 → 大 (慣性大)
 * - P: 政策 → 大 (政策は変わりにくい)
 * - B, I_R, V: 中
 * - R: 言及 → 小 (流行はすぐ動く)
 */
export const MASSES: Record<NodeId, number> = {
  P: 3.0,
  B: 2.0,
  I_R: 2.0,
  N: 4.0,
  V: 2.0,
  R: 1.0,
};

/**
 * 減衰係数 (摩擦) — 大きいほど揺れがすぐ収まる
 */
export const DAMPING: Record<NodeId, number> = {
  P: 0.4,
  B: 0.5,
  I_R: 0.5,
  N: 0.3,
  V: 0.6,
  R: 1.0,
};

/**
 * 連成振動シミュレータ
 *
 * 各ノードは平衡位置からの 1 次元変位 (上下方向) を持つ。
 * 平面 (xz) は固定、変位は y 方向のスカラー。
 */
export class CoupledOscillator {
  /** 各ノードの y 方向変位 */
  positions: Record<NodeId, number>;
  /** 各ノードの y 方向速度 */
  velocities: Record<NodeId, number>;
  /** 適用中の外力 F_E (毎ステップでクリアされる) */
  externalForces: Record<NodeId, number>;

  constructor() {
    this.positions = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
    this.velocities = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
    this.externalForces = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
  }

  /** 全ノードに対するばね力を計算 */
  private computeSpringForces(): Record<NodeId, number> {
    const forces: Record<NodeId, number> = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
    for (const bond of BONDS) {
      // フックの法則: F = k (x_to - x_from)
      const delta = this.positions[bond.to] - this.positions[bond.from];
      forces[bond.from] += bond.k * delta;
      forces[bond.to] -= bond.k * delta;
    }
    return forces;
  }

  /** 各ノードへの全力 (ばね + 減衰 + 外力 + 復元力 -k0 x) */
  private computeAcceleration(): Record<NodeId, number> {
    const spring = this.computeSpringForces();
    const acc: Record<NodeId, number> = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
    // ベース復元力 (= 平衡位置に戻す引力、すべてのノードに k0 = 0.5 程度)
    const k0 = 0.5;
    for (const id of NODE_IDS) {
      const totalForce =
        spring[id] +
        this.externalForces[id] -
        DAMPING[id] * this.velocities[id] -
        k0 * this.positions[id];
      acc[id] = totalForce / MASSES[id];
    }
    return acc;
  }

  /**
   * Velocity Verlet 1 step
   * dt: 時間刻み
   */
  step(dt: number) {
    const acc1 = this.computeAcceleration();
    // x ← x + v dt + 0.5 a dt^2
    for (const id of NODE_IDS) {
      this.positions[id] += this.velocities[id] * dt + 0.5 * acc1[id] * dt * dt;
    }
    const acc2 = this.computeAcceleration();
    // v ← v + 0.5 (a1 + a2) dt
    for (const id of NODE_IDS) {
      this.velocities[id] += 0.5 * (acc1[id] + acc2[id]) * dt;
    }
    // 外力は瞬時 (impulse) なのでステップ後にクリア
    for (const id of NODE_IDS) {
      this.externalForces[id] = 0;
    }
  }

  /**
   * 外力 (E のインパルス) を加える。指定ノードに大きな力を与える
   * (実装簡略化のため、瞬時インパルスとして 1 step 限定で力を入れる)
   */
  applyImpulse(target: NodeId, magnitude: number) {
    this.externalForces[target] += magnitude;
  }

  /**
   * ジャンプ (V03-N) — N に階段状の変位を与える
   * 連続項とは別レイヤーで N に大きな衝撃を与える
   */
  applyJump(target: NodeId = "N", magnitude: number = 5) {
    this.velocities[target] += magnitude;
  }

  /** 全停止 (リセット用) */
  reset() {
    for (const id of NODE_IDS) {
      this.positions[id] = 0;
      this.velocities[id] = 0;
      this.externalForces[id] = 0;
    }
  }

  /** マクロ指数 M = 全ノードの集約 (重み付き和) */
  computeM(): number {
    // 等重みの絶対値平均 (簡略化、実際は重み付き)
    const weights: Record<NodeId, number> = {
      P: 1.0, B: 1.0, I_R: 0.8, N: 1.2, V: 1.0, R: 0.6,
    };
    let sum = 0;
    let wsum = 0;
    for (const id of NODE_IDS) {
      sum += weights[id] * this.positions[id];
      wsum += weights[id];
    }
    return sum / wsum;
  }
}

/**
 * イベントプリセット (E ボタン)
 */
export interface EventPreset {
  id: string;
  label: string;
  description: string;
  target: NodeId;
  magnitude: number;
  /** ジャンプか否か (Nに直接衝撃) */
  isJump?: boolean;
}

export const EVENT_PRESETS: EventPreset[] = [
  {
    id: "earthquake",
    label: "東日本大震災 (2011)",
    description: "P 近傍に当たる。省エネ政策・断熱政策が加速",
    target: "P",
    magnitude: 8,
  },
  {
    id: "hormuz",
    label: "ホルムズ海峡封鎖",
    description: "P 近傍に当たる。エネルギー政策が動く",
    target: "P",
    magnitude: 7,
  },
  {
    id: "epbd",
    label: "EU EPBD recast (2010)",
    description: "P (海外政策模倣) と B (省エネ予算) に当たる",
    target: "P",
    magnitude: 5,
  },
  {
    id: "nakanishi",
    label: "中西先生 PMSQ 発見 (2007)",
    description: "N に階段状ジャンプ (V03-N)。論文蓄積からのブレークスルー",
    target: "N",
    magnitude: 6,
    isJump: true,
  },
  {
    id: "blueled",
    label: "青色 LED 発見 (1993)",
    description: "N に大ジャンプ。最終的に大規模事業化へ",
    target: "N",
    magnitude: 8,
    isJump: true,
  },
  {
    id: "ira",
    label: "米 IRA 成立 (2022)",
    description: "B (海外モチベ予算) に直接当たる",
    target: "B",
    magnitude: 6,
  },
  {
    id: "covid",
    label: "COVID-19 (2020)",
    description: "全ノードに分散インパルス、特に R に大きく",
    target: "R",
    magnitude: 5,
  },
  {
    id: "vc_boom",
    label: "VC ファンドブーム (2021)",
    description: "V に直接インパルス",
    target: "V",
    magnitude: 6,
  },
];
