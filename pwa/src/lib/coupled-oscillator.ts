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
 *
 * 周期 T = 2π √(m / k_0) で決まる。k_0 = 0.05 と組み合わせると:
 * - m = 5 → T ≈ 63 月 ≈ 5 年 (政策サイクル)
 * - m = 2 → T ≈ 40 月 ≈ 3.3 年
 * - m = 1 → T ≈ 28 月 ≈ 2.3 年 (流行)
 */
export const MASSES: Record<NodeId, number> = {
  P: 5.0,   // T ≈ 5 年 (政策サイクル)
  B: 4.0,   // T ≈ 4.5 年
  I_R: 3.0, // T ≈ 4 年
  N: 6.0,   // T ≈ 5.5 年
  V: 3.5,   // T ≈ 4.2 年 (VC ファンドサイクル前半)
  R: 1.0,   // T ≈ 2.3 年 (流行)
};

/**
 * 減衰係数 (摩擦) — 大きいほど揺れがすぐ収まる
 *
 * クリティカルダンピング: 2√(m k_0)
 * アンダーダンプ (= クリティカル未満) で 2-3 周期で収束するよう調整
 */
export const DAMPING: Record<NodeId, number> = {
  P: 0.20,
  B: 0.25,
  I_R: 0.25,
  N: 0.15,
  V: 0.30,
  R: 0.45,  // 流行は早く減衰
};

/** ベース復元力 (全ノード共通)。これで周期スケールを年単位にする */
export const K0 = 0.05;

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
  /**
   * 平衡点シフト q_i (恒久的変化)
   * 復元力は -k_0 (x_i - q_i) で計算され、振動はこの新平衡点中心になる
   * 例: 中西PMSQ発見 → q_N += 5、N の振動中心が +5 に移動 (戻らない)
   */
  equilibriumShifts: Record<NodeId, number>;

  constructor() {
    this.positions = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
    this.velocities = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
    this.externalForces = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
    this.equilibriumShifts = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
  }

  /** 全ノードに対するばね力を計算 */
  private computeSpringForces(): Record<NodeId, number> {
    const forces: Record<NodeId, number> = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
    for (const bond of BONDS) {
      // フックの法則: F = k (x_to - x_from)
      // ただし「平衡からの相対変位」で結合を計算 (q シフトを差し引く)
      const xFromRel = this.positions[bond.from] - this.equilibriumShifts[bond.from];
      const xToRel = this.positions[bond.to] - this.equilibriumShifts[bond.to];
      const delta = xToRel - xFromRel;
      forces[bond.from] += bond.k * delta;
      forces[bond.to] -= bond.k * delta;
    }
    return forces;
  }

  /** 各ノードへの全力 (ばね + 減衰 + 外力 + 復元力 -k0 (x - q)) */
  private computeAcceleration(): Record<NodeId, number> {
    const spring = this.computeSpringForces();
    const acc: Record<NodeId, number> = { P: 0, B: 0, I_R: 0, N: 0, V: 0, R: 0 };
    for (const id of NODE_IDS) {
      const totalForce =
        spring[id] +
        this.externalForces[id] -
        DAMPING[id] * this.velocities[id] -
        K0 * (this.positions[id] - this.equilibriumShifts[id]);
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
   * 一時的インパルス (例: 震災・ホルムズ封鎖)
   * 速度に瞬時の力を加え、揺り戻しで元の平衡 (またはシフト後平衡) に戻る
   */
  applyImpulse(target: NodeId, magnitude: number) {
    this.externalForces[target] += magnitude;
  }

  /**
   * 恒久的シフト (例: 青色LED発見・コロナ後オフィス需要・IRA成立)
   * 平衡点 q_i を永続的に変更する。振動はその新平衡中心に。
   * V03-N (ジャンプ過程) と V03-? (恒久変化) を統合した実装。
   */
  applyShift(target: NodeId, magnitude: number) {
    this.equilibriumShifts[target] += magnitude;
  }

  /** ジャンプ (V03-N) — applyShift のエイリアス (後方互換) */
  applyJump(target: NodeId = "N", magnitude: number = 5) {
    this.applyShift(target, magnitude);
  }

  /** 全停止 (リセット用) */
  reset() {
    for (const id of NODE_IDS) {
      this.positions[id] = 0;
      this.velocities[id] = 0;
      this.externalForces[id] = 0;
      this.equilibriumShifts[id] = 0;
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
  /**
   * 効果のタイプ:
   * - "impulse": 一時的な力 (揺り戻しで元 or 新平衡に戻る)
   * - "shift": 恒久的な平衡点シフト (戻らない、新平衡中心で振動)
   */
  effectType: "impulse" | "shift";
  /** 発生年 */
  year: number;
  /** 発生月 (1-12、デフォルト 1) */
  month?: number;
}

export const EVENT_PRESETS: EventPreset[] = [
  {
    id: "blueled",
    label: "青色 LED 発見 (1993)",
    description: "N の平衡を恒久シフト。発光ダイオード分野が新次元へ",
    target: "N",
    magnitude: 8,
    effectType: "shift",
    year: 1993,
    month: 11,
  },
  {
    id: "nakanishi",
    label: "中西先生 PMSQ 発見 (2007)",
    description: "N の平衡を恒久シフト。透明モノリスエアロゲルの基盤論文",
    target: "N",
    magnitude: 6,
    effectType: "shift",
    year: 2007,
    month: 1,
  },
  {
    id: "lehman",
    label: "リーマンショック (2008)",
    description: "V に大マイナスインパルス (一時的、回復に数年)",
    target: "V",
    magnitude: -10,
    effectType: "impulse",
    year: 2008,
    month: 9,
  },
  {
    id: "epbd",
    label: "EU EPBD recast (2010)",
    description: "P (海外政策模倣) を恒久シフト。建築物省エネ義務化の流れ",
    target: "P",
    magnitude: 4,
    effectType: "shift",
    year: 2010,
    month: 5,
  },
  {
    id: "earthquake",
    label: "東日本大震災 (2011)",
    description: "P に一時的大インパルス (省エネ政策が一時的に強化)",
    target: "P",
    magnitude: 10,
    effectType: "impulse",
    year: 2011,
    month: 3,
  },
  {
    id: "paris",
    label: "パリ協定 (2015)",
    description: "P を恒久シフト。GX 系の長期レジーム確立",
    target: "P",
    magnitude: 5,
    effectType: "shift",
    year: 2015,
    month: 12,
  },
  {
    id: "covid",
    label: "COVID-19 (2020)",
    description: "R に大インパルス (流行) + R 平衡微シフト (DX 新常態)",
    target: "R",
    magnitude: 8,
    effectType: "impulse",
    year: 2020,
    month: 3,
  },
  {
    id: "covid_shift",
    label: "└ コロナ後 DX 常態化",
    description: "R を恒久シフト (情報発信量の新常態)。covid と一緒に押す",
    target: "R",
    magnitude: 2,
    effectType: "shift",
    year: 2020,
    month: 6,
  },
  {
    id: "vc_boom",
    label: "VC ファンドブーム (2021)",
    description: "V に大インパルス (一時的ピーク、2022 で冷え込み)",
    target: "V",
    magnitude: 8,
    effectType: "impulse",
    year: 2021,
    month: 6,
  },
  {
    id: "ira",
    label: "米 IRA 成立 (2022)",
    description: "B を恒久シフト (海外モチベ予算の新レジーム)",
    target: "B",
    magnitude: 5,
    effectType: "shift",
    year: 2022,
    month: 8,
  },
  {
    id: "hormuz",
    label: "ホルムズ海峡封鎖 (仮想)",
    description: "P に一時的大インパルス (エネルギー安保政策が動く)",
    target: "P",
    magnitude: 8,
    effectType: "impulse",
    year: 2024,
    month: 6,
  },
];
