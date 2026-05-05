"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  eigenvalues3x3,
  simulateStateSpace,
  type EigenAnalysis3,
  type SimulationResult,
  type StateSpaceModel,
} from "@/lib/state-space";
import {
  DEFAULT_TRIPLE_HELIX,
  EVENT_PRESETS,
  HELIX,
  type EventShock,
} from "@/lib/triple-helix";

/**
 * Before Zero Theory v3.1 — Triple Helix 状態空間モデル sandbox
 *
 * 隠れ状態 (n=3): Academia / Industry / Government のモメンタム
 * 観測量 (m=6):  P, B, V, R, I_R, N
 * 外生 (p=3):    海外政策 / 災害 / 地政学
 *
 * 2026-05-05 改修: アニメーション廃止 + 全軌跡描画 + σ_SU 強調表示
 *   - σ_SU(t) = min(μ_A, μ_I, μ_G) を曲線色 / ピーク球で表現
 *   - 立ち上げ好機 (σ_SU 高い区間) を緑バンドでハイライト
 */

const SIM_STEPS = 240;
const HELIX_COLORS = ["#2563eb", "#16a34a", "#dc2626"]; // 学=青, 産=緑, 官=赤
const OBS_COLORS = [
  "#dc2626", // P  red
  "#ea580c", // B  orange
  "#16a34a", // V  green
  "#a16207", // R  amber
  "#0891b2", // I_R cyan
  "#7c3aed", // N  purple
];

// σ_SU = min(μ_A, μ_I, μ_G) の閾値
const SIGMA_GO_THRESHOLD = 0.4;

// =====================================================================
// σ_SU 計算とピーク検出
// =====================================================================

function computeSigmaSU(states: number[][]): number[] {
  return states.map((s) => Math.min(s[HELIX.A], s[HELIX.I], s[HELIX.G]));
}

interface PeakInfo {
  t: number;
  sigma: number;
  position: THREE.Vector3;
}

function detectPeaks(
  sigmaSU: number[],
  positions: THREE.Vector3[],
  threshold: number,
  windowSize = 4,
  maxPeaks = 5,
): PeakInfo[] {
  const peaks: PeakInfo[] = [];
  for (let t = windowSize; t < sigmaSU.length - windowSize; t++) {
    const v = sigmaSU[t];
    if (v < threshold) continue;
    let isPeak = true;
    for (let dt = -windowSize; dt <= windowSize; dt++) {
      if (dt === 0) continue;
      if (sigmaSU[t + dt] > v) {
        isPeak = false;
        break;
      }
    }
    if (isPeak) {
      peaks.push({ t, sigma: v, position: positions[t] });
    }
  }
  // ピーク同士が近すぎたら高い方だけ残す
  peaks.sort((a, b) => a.t - b.t);
  const dedup: PeakInfo[] = [];
  for (const p of peaks) {
    const last = dedup[dedup.length - 1];
    if (last && p.t - last.t < 8) {
      if (p.sigma > last.sigma) dedup[dedup.length - 1] = p;
    } else {
      dedup.push(p);
    }
  }
  // σ_SU 大きい順にトップ N
  return dedup.sort((a, b) => b.sigma - a.sigma).slice(0, maxPeaks);
}

// σ_SU の値で色を決める (グレー→緑のグラデーション)
function sigmaToColor(sigma: number): THREE.Color {
  const norm = Math.max(0, Math.min(1, (sigma + 0.3) / 1.0));
  const lowR = 0.6, lowG = 0.6, lowB = 0.65; // gray
  const highR = 0.06, highG = 0.73, highB = 0.31; // green-600
  return new THREE.Color(
    lowR + (highR - lowR) * norm,
    lowG + (highG - lowG) * norm,
    lowB + (highB - lowB) * norm,
  );
}

// =====================================================================
// 3D 状態軌道 (R3F)
// =====================================================================

function StateTrajectory3D({
  states,
  sigmaSU,
}: {
  states: number[][];
  sigmaSU: number[];
}) {
  const scale = 1.5;

  const points = useMemo(
    () =>
      states.map(
        (s) =>
          new THREE.Vector3(
            s[HELIX.A] * scale,
            s[HELIX.G] * scale, // 縦軸を G (官)
            s[HELIX.I] * scale,
          ),
      ),
    [states],
  );

  const segmentColors = useMemo(
    () => sigmaSU.map((v) => sigmaToColor(v)),
    [sigmaSU],
  );

  const peaks = useMemo(
    () => detectPeaks(sigmaSU, points, SIGMA_GO_THRESHOLD),
    [sigmaSU, points],
  );

  return (
    <group>
      {/* 軸 */}
      <Axis dir="x" color="#2563eb" label="μ_A (学)" length={4} />
      <Axis dir="y" color="#dc2626" label="μ_G (官)" length={4} />
      <Axis dir="z" color="#16a34a" label="μ_I (産)" length={4} />

      {/* 原点 */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#94a3b8" />
      </mesh>

      {/* 軌道全体 (色付き) */}
      {points.length >= 2 && (
        <Line
          points={points}
          vertexColors={segmentColors}
          lineWidth={1.6}
        />
      )}

      {/* σ_SU ピーク (光る球 + ラベル) */}
      {peaks.map((p, idx) => (
        <PeakMarker
          key={`${p.t}-${idx}`}
          position={p.position}
          sigma={p.sigma}
          t={p.t}
        />
      ))}
    </group>
  );
}

function PeakMarker({
  position,
  sigma,
  t,
}: {
  position: THREE.Vector3;
  sigma: number;
  t: number;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#34d399"
          emissiveIntensity={0.7}
        />
      </mesh>
      <Html position={[0, 0.3, 0]} center distanceFactor={9} occlude={false}>
        <div
          style={{
            background: "rgba(16, 185, 129, 0.95)",
            color: "white",
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 5px",
            borderRadius: 3,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          σ={sigma.toFixed(2)} @t={t}
        </div>
      </Html>
    </group>
  );
}

function Axis({
  dir,
  color,
  label,
  length,
}: {
  dir: "x" | "y" | "z";
  color: string;
  label: string;
  length: number;
}) {
  const start = new THREE.Vector3(0, 0, 0);
  const end =
    dir === "x"
      ? new THREE.Vector3(length, 0, 0)
      : dir === "y"
        ? new THREE.Vector3(0, length, 0)
        : new THREE.Vector3(0, 0, length);
  const labelPos = end.clone().multiplyScalar(1.08);

  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={1.5} />
      <Html position={labelPos} center distanceFactor={10} occlude={false}>
        <div
          style={{
            color,
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "sans-serif",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

// =====================================================================
// 時系列 (Canvas)
// =====================================================================

function TimeSeriesCanvas({
  series,
  colors,
  labels,
  goRanges,
  height,
}: {
  series: number[][]; // [m][T+1]
  colors: string[];
  labels: string[];
  /** σ_SU が threshold を超える時間帯 (緑バンド) */
  goRanges: Array<[number, number]>;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 24;
    const padR = 8;
    const padT = 14;
    const padB = 12;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    let maxAbs = 0.5;
    for (const s of series) {
      for (const v of s) {
        if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
      }
    }
    const yScale = plotH / 2 / (maxAbs * 1.1);
    const yMid = padT + plotH / 2;

    const T = series[0]?.length ?? 0;
    const xScale = plotW / Math.max(1, T - 1);

    // GO バンド (σ_SU が高い時間帯を緑でハイライト)
    ctx.fillStyle = "rgba(16, 185, 129, 0.18)";
    for (const [start, end] of goRanges) {
      const x1 = padL + start * xScale;
      const x2 = padL + end * xScale;
      ctx.fillRect(x1, padT, x2 - x1, plotH);
    }

    // ゼロ線
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, yMid);
    ctx.lineTo(padL + plotW, yMid);
    ctx.stroke();

    // 系列描画
    series.forEach((s, k) => {
      ctx.strokeStyle = colors[k];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < s.length; i++) {
        const px = padL + i * xScale;
        const py = yMid - s[i] * yScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });

    // 凡例
    ctx.font = "10px sans-serif";
    let lx = padL + 2;
    labels.forEach((lbl, k) => {
      ctx.fillStyle = colors[k];
      ctx.fillText(lbl, lx, 10);
      lx += ctx.measureText(lbl).width + 8;
    });

    // 軸ラベル
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.fillText("0", 12, yMid + 3);
    ctx.fillText("t", padL + plotW - 4, h - 2);
  }, [series, colors, labels, goRanges]);

  return <canvas ref={ref} className="w-full" style={{ height }} />;
}

// =====================================================================
// σ_SU 専用時系列 (太線、GO 閾値線あり)
// =====================================================================

function SigmaSUCanvas({
  sigma,
  goRanges,
  threshold,
  height,
}: {
  sigma: number[];
  goRanges: Array<[number, number]>;
  threshold: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 24;
    const padR = 8;
    const padT = 14;
    const padB = 12;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    let maxAbs = 0.5;
    for (const v of sigma) if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    const yScale = plotH / 2 / (maxAbs * 1.1);
    const yMid = padT + plotH / 2;
    const xScale = plotW / Math.max(1, sigma.length - 1);

    // GO バンド
    ctx.fillStyle = "rgba(16, 185, 129, 0.22)";
    for (const [start, end] of goRanges) {
      const x1 = padL + start * xScale;
      const x2 = padL + end * xScale;
      ctx.fillRect(x1, padT, x2 - x1, plotH);
    }

    // ゼロ線
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, yMid);
    ctx.lineTo(padL + plotW, yMid);
    ctx.stroke();

    // 閾値線
    const thY = yMid - threshold * yScale;
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, thY);
    ctx.lineTo(padL + plotW, thY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#10b981";
    ctx.font = "9px sans-serif";
    ctx.fillText(`θ=${threshold}`, padL + 2, thY - 2);

    // σ_SU 曲線 (色を値で変える)
    for (let i = 0; i < sigma.length - 1; i++) {
      const c = sigmaToColor(sigma[i]);
      ctx.strokeStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(padL + i * xScale, yMid - sigma[i] * yScale);
      ctx.lineTo(padL + (i + 1) * xScale, yMid - sigma[i + 1] * yScale);
      ctx.stroke();
    }

    // 凡例
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText("σ_SU = min(μ_A, μ_I, μ_G)", padL + 2, 10);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.fillText("0", 12, yMid + 3);
    ctx.fillText("t", padL + plotW - 4, h - 2);
  }, [sigma, goRanges, threshold]);

  return <canvas ref={ref} className="w-full" style={{ height }} />;
}

// =====================================================================
// 固有値プロット (Canvas)
// =====================================================================

function EigenCanvas({ eig }: { eig: EigenAnalysis3 }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 24;

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    const ringColor =
      eig.stability === "unstable"
        ? "#ef4444"
        : eig.stability === "neutral"
          ? "#f59e0b"
          : "#10b981";
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    eig.lambdas.forEach((l) => {
      const px = cx + l.re * r;
      const py = cy - l.im * r;
      ctx.fillStyle = l.isComplex ? "#8b5cf6" : "#0ea5e9";
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.fillStyle = "#475569";
    ctx.font = "10px sans-serif";
    ctx.fillText("|λ|=1", cx + r * 0.72, cy - r * 0.72);
    ctx.fillText("Re", w - 18, cy - 4);
    ctx.fillText("Im", cx + 4, 12);
  }, [eig]);

  return <canvas ref={ref} className="w-full h-full" />;
}

// =====================================================================
// メインビュー
// =====================================================================

interface ScheduledShock {
  id: string;
  t: number;
  event: EventShock;
}

let shockCounter = 0;
const newShockId = () => `s-${++shockCounter}`;

export function TripleHelixView() {
  const [model, setModel] = useState<StateSpaceModel>(() => ({
    ...DEFAULT_TRIPLE_HELIX,
    A: DEFAULT_TRIPLE_HELIX.A.map((row) => [...row]),
    B: DEFAULT_TRIPLE_HELIX.B.map((row) => [...row]),
    C: DEFAULT_TRIPLE_HELIX.C.map((row) => [...row]),
  }));
  const [shocks, setShocks] = useState<ScheduledShock[]>([
    { id: newShockId(), t: 30, event: EVENT_PRESETS[0] }, // IRA
  ]);
  const [shockTime, setShockTime] = useState(120);

  const sim: SimulationResult = useMemo(() => {
    const inputs: number[][] = new Array(SIM_STEPS)
      .fill(null)
      .map(() => new Array(model.p).fill(0));
    const x0 = new Array(model.n).fill(0);

    for (const s of shocks) {
      if (s.t < 0 || s.t >= SIM_STEPS) continue;
      for (let j = 0; j < model.p; j++) {
        inputs[s.t][j] += s.event.uVector[j];
      }
      if (s.event.stateJump && s.t === 0) {
        for (let i = 0; i < model.n; i++) {
          x0[i] += s.event.stateJump[i];
        }
      }
    }

    let result = simulateStateSpace(model, x0, SIM_STEPS, inputs, 1234);

    const jumps = shocks.filter((s) => s.event.stateJump && s.t > 0);
    if (jumps.length > 0) {
      const states: number[][] = [x0.slice()];
      const observations: number[][] = [];
      const matVecLocal = (M: number[][], v: number[]) =>
        M.map((row) => row.reduce((s, mij, j) => s + mij * v[j], 0));
      observations.push(matVecLocal(model.C, x0));
      let x = x0.slice();
      let seed = 1234;
      const rng = () => {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const rn = () => {
        const u1 = Math.max(rng(), 1e-12);
        const u2 = rng();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      };
      for (let t = 0; t < SIM_STEPS; t++) {
        const u = inputs[t];
        const Ax = matVecLocal(model.A, x);
        const Bu = matVecLocal(model.B, u);
        const xNext = new Array(model.n);
        for (let i = 0; i < model.n; i++) {
          xNext[i] = Ax[i] + Bu[i] + model.qSigma[i] * rn();
        }
        for (const j of jumps) {
          if (j.t === t + 1 && j.event.stateJump) {
            for (let i = 0; i < model.n; i++) {
              xNext[i] += j.event.stateJump[i];
            }
          }
        }
        x = xNext;
        states.push(x.slice());
        const y = matVecLocal(model.C, x).map(
          (yi, i) => yi + model.rSigma[i] * rn(),
        );
        observations.push(y);
      }
      result = { states, observations, inputs };
    }
    return result;
  }, [model, shocks]);

  const sigmaSU = useMemo(() => computeSigmaSU(sim.states), [sim.states]);

  // GO バンド (σ_SU > threshold が連続する区間)
  const goRanges = useMemo<Array<[number, number]>>(() => {
    const out: Array<[number, number]> = [];
    let start: number | null = null;
    for (let t = 0; t < sigmaSU.length; t++) {
      if (sigmaSU[t] >= SIGMA_GO_THRESHOLD) {
        if (start === null) start = t;
      } else {
        if (start !== null) {
          out.push([start, t]);
          start = null;
        }
      }
    }
    if (start !== null) out.push([start, sigmaSU.length - 1]);
    return out;
  }, [sigmaSU]);

  const obsByVar = useMemo(() => {
    const T = sim.observations.length;
    const arr: number[][] = Array.from({ length: model.m }, () =>
      new Array(T).fill(0),
    );
    for (let t = 0; t < T; t++) {
      for (let i = 0; i < model.m; i++) arr[i][t] = sim.observations[t][i];
    }
    return arr;
  }, [sim, model.m]);

  const stateByVar = useMemo(() => {
    const T = sim.states.length;
    const arr: number[][] = Array.from({ length: model.n }, () =>
      new Array(T).fill(0),
    );
    for (let t = 0; t < T; t++) {
      for (let i = 0; i < model.n; i++) arr[i][t] = sim.states[t][i];
    }
    return arr;
  }, [sim, model.n]);

  const eig = useMemo(() => eigenvalues3x3(model.A), [model.A]);

  const fireShock = useCallback(
    (event: EventShock) => {
      setShocks((prev) => [
        ...prev,
        { id: newShockId(), t: shockTime, event },
      ]);
    },
    [shockTime],
  );

  const removeShock = useCallback((id: string) => {
    setShocks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateShockTime = useCallback((id: string, t: number) => {
    setShocks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, t } : s)),
    );
  }, []);

  const resetShocks = useCallback(() => {
    setShocks([]);
  }, []);

  const updateA = useCallback((i: number, j: number, v: number) => {
    setModel((m) => {
      const A = m.A.map((row) => [...row]);
      A[i][j] = v;
      return { ...m, A };
    });
  }, []);

  const resetModel = useCallback(() => {
    setModel({
      ...DEFAULT_TRIPLE_HELIX,
      A: DEFAULT_TRIPLE_HELIX.A.map((row) => [...row]),
      B: DEFAULT_TRIPLE_HELIX.B.map((row) => [...row]),
      C: DEFAULT_TRIPLE_HELIX.C.map((row) => [...row]),
    });
  }, []);

  return (
    <div className="space-y-2">
      {/* 上段: 隠れ状態時系列 + σ_SU + 観測量時系列 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Card title="隠れ状態 μ_A (学), μ_I (産), μ_G (官)">
          <div
            style={{
              background:
                "repeating-linear-gradient(45deg, #f8fafc, #f8fafc 8px, #f1f5f9 8px, #f1f5f9 16px)",
            }}
          >
            <TimeSeriesCanvas
              series={stateByVar}
              colors={HELIX_COLORS}
              labels={["μ_A", "μ_I", "μ_G"]}
              goRanges={goRanges}
              height={90}
            />
          </div>
        </Card>
        <Card title="σ_SU = min(μ_A, μ_I, μ_G) — 立ち上げマクロシグナル">
          <SigmaSUCanvas
            sigma={sigmaSU}
            goRanges={goRanges}
            threshold={SIGMA_GO_THRESHOLD}
            height={90}
          />
        </Card>
        <Card title="観測量 P, B, V, R, I_R, N">
          <TimeSeriesCanvas
            series={obsByVar}
            colors={OBS_COLORS}
            labels={model.obsNames}
            goRanges={goRanges}
            height={90}
          />
        </Card>
      </div>

      {/* 中段: 3D 軌道 + 固有値 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        <div className="lg:col-span-8">
          <Card title="状態軌道 (3D) — σ_SU で着色、緑ピーク = 立ち上げ好機">
            <div
              style={{ height: 280, minHeight: 0 }}
              className="rounded bg-slate-50 border border-slate-200"
            >
              <Canvas camera={{ position: [5, 4, 5], fov: 45 }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[5, 8, 5]} intensity={0.6} />
                <StateTrajectory3D states={sim.states} sigmaSU={sigmaSU} />
                <OrbitControls />
              </Canvas>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-4">
          <Card title="A 行列の固有値">
            <div style={{ height: 220 }}>
              <EigenCanvas eig={eig} />
            </div>
            <EigenSummary eig={eig} />
          </Card>
        </div>
      </div>

      {/* 下段: ショック投入 + A 行列 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        <div className="lg:col-span-5">
          <Card title="外生ショック (時刻指定)">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-slate-600 whitespace-nowrap">
                時刻 t=
              </span>
              <input
                type="range"
                min={0}
                max={SIM_STEPS - 1}
                step={1}
                value={shockTime}
                onChange={(e) => setShockTime(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-[10px] tabular-nums w-8 text-right">
                {shockTime}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {EVENT_PRESETS.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => fireShock(ev)}
                  title={ev.description}
                  className="px-1.5 py-1 rounded border border-slate-300 text-[10px] hover:bg-slate-50 whitespace-nowrap"
                >
                  {ev.emoji} {ev.label}
                </button>
              ))}
              <button
                type="button"
                onClick={resetShocks}
                className="px-1.5 py-1 rounded border border-slate-300 text-[10px] hover:bg-slate-50 ml-auto"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={resetModel}
                className="px-1.5 py-1 rounded border border-slate-300 text-[10px] hover:bg-slate-50"
              >
                Reset A
              </button>
            </div>
            {shocks.length === 0 ? (
              <div className="text-[10px] text-slate-400">
                ショック未投入
              </div>
            ) : (
              <div className="space-y-1 max-h-[110px] overflow-y-auto">
                {shocks
                  .slice()
                  .sort((a, b) => a.t - b.t)
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5">
                      <span className="text-[10px] whitespace-nowrap w-[110px] truncate">
                        {s.event.emoji} {s.event.label}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={SIM_STEPS - 1}
                        step={1}
                        value={s.t}
                        onChange={(e) =>
                          updateShockTime(s.id, Number(e.target.value))
                        }
                        className="flex-1 h-1"
                      />
                      <span className="text-[10px] tabular-nums w-7 text-right">
                        {s.t}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeShock(s.id)}
                        className="text-[10px] text-slate-400 hover:text-rose-500 px-1"
                        aria-label="remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card title="A 行列 (3×3) — 対角=慣性、非対角=役割交差 (非対称→螺旋)">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="px-1 py-0.5 w-12"></th>
                  {[0, 1, 2].map((j) => (
                    <th
                      key={j}
                      className="px-1 py-0.5 font-medium text-slate-500 text-[10px]"
                    >
                      ← {model.stateNames[j]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2].map((i) => (
                  <tr key={i}>
                    <th className="px-1 py-0.5 text-right font-medium text-slate-500 text-[10px] whitespace-nowrap">
                      {model.stateNames[i]} →
                    </th>
                    {[0, 1, 2].map((j) => (
                      <td key={j} className="px-1 py-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums text-[10px] w-9 text-right">
                            {model.A[i][j].toFixed(2)}
                          </span>
                          <input
                            type="range"
                            min={i === j ? 0 : -0.5}
                            max={i === j ? 1.1 : 0.5}
                            step={0.01}
                            value={model.A[i][j]}
                            onChange={(e) =>
                              updateA(i, j, Number(e.target.value))
                            }
                            className="flex-1 h-1"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 共通
// =====================================================================

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <div className="text-[10px] font-medium text-slate-600 mb-1 uppercase tracking-wide">
        {title}
      </div>
      {children}
    </div>
  );
}

function EigenSummary({ eig }: { eig: EigenAnalysis3 }) {
  const stabColor: Record<EigenAnalysis3["stability"], string> = {
    stable: "text-emerald-600",
    neutral: "text-amber-600",
    unstable: "text-rose-600",
  };
  return (
    <div className="mt-1 text-[10px] text-slate-600 font-mono leading-tight">
      {eig.lambdas.map((l, i) => (
        <div key={i}>
          λ{i + 1}={l.re.toFixed(2)}
          {l.isComplex
            ? `${l.im >= 0 ? "+" : "−"}${Math.abs(l.im).toFixed(2)}i`
            : ""}{" "}
          |λ|={l.abs.toFixed(2)}
        </div>
      ))}
      <div className="font-sans pt-0.5">
        <span className={stabColor[eig.stability]}>
          {eig.stability === "stable"
            ? "安定"
            : eig.stability === "neutral"
              ? "境界"
              : "発散"}
        </span>
        {eig.period && ` / T≈${eig.period.toFixed(1)}`}
        {eig.decayTime && ` / τ≈${eig.decayTime.toFixed(1)}`}
      </div>
    </div>
  );
}
