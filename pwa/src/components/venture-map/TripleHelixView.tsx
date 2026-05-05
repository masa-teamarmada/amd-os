"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
 * Etzkowitz & Leydesdorff (1995) の Triple Helix を状態空間モデル化したもの。
 * A 行列が複素固有値を持つとき、3 状態が螺旋的に共進化する (= triple helix 比喩の数学的実体)。
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

// =====================================================================
// 3D 状態軌道 (R3F)
// =====================================================================

function StateTrajectory3D({
  states,
  currentIdx,
}: {
  states: number[][];
  currentIdx: number;
}) {
  // 軌道と現在位置のスケーリング (state 値を 3D 空間に直接マッピング)
  const scale = 1.5;
  const points = useMemo(() => {
    return states.map(
      (s) =>
        new THREE.Vector3(
          s[HELIX.A] * scale,
          s[HELIX.G] * scale, // 縦軸を G (官)、見やすさのため
          s[HELIX.I] * scale,
        ),
    );
  }, [states]);

  const traceUpTo = useMemo(
    () => points.slice(0, Math.max(1, currentIdx + 1)),
    [points, currentIdx],
  );

  const cur = points[Math.min(currentIdx, points.length - 1)];

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

      {/* 軌道 */}
      {traceUpTo.length >= 2 && (
        <Line points={traceUpTo} color="#475569" lineWidth={1.2} />
      )}

      {/* 現在位置 */}
      {cur && (
        <mesh position={cur}>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#fbbf24"
            emissiveIntensity={0.35}
          />
        </mesh>
      )}
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
  currentIdx,
  height,
}: {
  series: number[][]; // [m][T+1]
  colors: string[];
  labels: string[];
  currentIdx: number;
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

    const padL = 32;
    const padR = 12;
    const padT = 8;
    const padB = 18;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // y スケール (絶対値最大で対称、0.5 を最低保証)
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

    // 現在位置
    if (currentIdx >= 0 && currentIdx < T) {
      const px = padL + currentIdx * xScale;
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 凡例
    ctx.font = "11px sans-serif";
    let lx = padL + 4;
    labels.forEach((lbl, k) => {
      ctx.fillStyle = colors[k];
      ctx.fillText(lbl, lx, padT + 12);
      lx += ctx.measureText(lbl).width + 12;
    });

    // 軸ラベル
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.fillText("0", 16, yMid + 3);
    ctx.fillText("t", padL + plotW - 6, h - 4);
  }, [series, colors, labels, currentIdx]);

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

    // 軸
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // 単位円
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

    // 固有値プロット
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
  /** 注入する時刻 t */
  t: number;
  event: EventShock;
}

export function TripleHelixView() {
  const [model, setModel] = useState<StateSpaceModel>(() => ({
    ...DEFAULT_TRIPLE_HELIX,
    A: DEFAULT_TRIPLE_HELIX.A.map((row) => [...row]),
    B: DEFAULT_TRIPLE_HELIX.B.map((row) => [...row]),
    C: DEFAULT_TRIPLE_HELIX.C.map((row) => [...row]),
  }));
  const [shocks, setShocks] = useState<ScheduledShock[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  // シミュレーション (shocks や model が変わると再計算)
  const sim: SimulationResult = useMemo(() => {
    const inputs: number[][] = new Array(SIM_STEPS)
      .fill(null)
      .map(() => new Array(model.p).fill(0));
    // shocks を inputs に注入
    let x0 = new Array(model.n).fill(0);
    for (const s of shocks) {
      if (s.t < 0 || s.t >= SIM_STEPS) continue;
      for (let j = 0; j < model.p; j++) {
        inputs[s.t][j] += s.event.uVector[j];
      }
      // ジャンプ (state を直接動かす) は t=0 のときだけ初期状態に入れる
      if (s.event.stateJump && s.t === 0) {
        for (let i = 0; i < model.n; i++) {
          x0[i] += s.event.stateJump[i];
        }
      }
    }
    let result = simulateStateSpace(model, x0, SIM_STEPS, inputs, 1234);
    // ジャンプ (t > 0 の場合) はシミュレーション後に直接状態に加える形で再実行
    const jumps = shocks.filter((s) => s.event.stateJump && s.t > 0);
    if (jumps.length > 0) {
      // 再シミュレーションを step ごとに行う (ジャンプ反映)
      const states: number[][] = [x0.slice()];
      const observations: number[][] = [];
      const matVecLocal = (M: number[][], v: number[]) =>
        M.map((row) =>
          row.reduce((s, mij, j) => s + mij * v[j], 0),
        );
      const c0 = matVecLocal(model.C, x0);
      observations.push(c0);
      let x = x0.slice();
      // 再現性のため簡易乱数列を使い回す
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
        // ジャンプ反映
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

  // 観測時系列を [m][T+1] に転置
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

  // アニメーション
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      if (dt > 50) {
        last = now;
        setCurrentIdx((idx) => {
          if (idx >= SIM_STEPS - 1) {
            setPlaying(false);
            return idx;
          }
          return idx + 1;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const reset = useCallback(() => {
    setShocks([]);
    setCurrentIdx(0);
    setPlaying(false);
  }, []);

  const fireShock = useCallback(
    (event: EventShock) => {
      setShocks((prev) => [...prev, { t: currentIdx, event }]);
    },
    [currentIdx],
  );

  const updateA = useCallback(
    (i: number, j: number, v: number) => {
      setModel((m) => {
        const A = m.A.map((row) => [...row]);
        A[i][j] = v;
        return { ...m, A };
      });
    },
    [],
  );

  const resetModel = useCallback(() => {
    setModel({
      ...DEFAULT_TRIPLE_HELIX,
      A: DEFAULT_TRIPLE_HELIX.A.map((row) => [...row]),
      B: DEFAULT_TRIPLE_HELIX.B.map((row) => [...row]),
      C: DEFAULT_TRIPLE_HELIX.C.map((row) => [...row]),
    });
    setShocks([]);
    setCurrentIdx(0);
  }, []);

  return (
    <div className="space-y-4">
      {/* 上段: 隠れ状態時系列 + 観測量時系列 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="隠れ状態 μ_A (学), μ_I (産), μ_G (官) — 灰色領域 = 直接観測できない">
          <div
            style={{
              background:
                "repeating-linear-gradient(45deg, #f8fafc, #f8fafc 8px, #f1f5f9 8px, #f1f5f9 16px)",
            }}
          >
            <TimeSeriesCanvas
              series={stateByVar}
              colors={HELIX_COLORS}
              labels={["μ_A (学)", "μ_I (産)", "μ_G (官)"]}
              currentIdx={currentIdx}
              height={140}
            />
          </div>
        </Card>
        <Card title="観測量 P, B, V, R, I_R, N — データから取れるもの">
          <TimeSeriesCanvas
            series={obsByVar}
            colors={OBS_COLORS}
            labels={model.obsNames}
            currentIdx={currentIdx}
            height={140}
          />
        </Card>
      </div>

      {/* 中段: 3D 軌道 + 固有値 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="状態軌道 (3D) — μ_A × μ_I × μ_G 空間、Triple Helix の螺旋">
            <div
              style={{ height: 380, minHeight: 0 }}
              className="rounded bg-slate-50 border border-slate-200"
            >
              <Canvas camera={{ position: [5, 4, 5], fov: 45 }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[5, 8, 5]} intensity={0.6} />
                <StateTrajectory3D
                  states={sim.states}
                  currentIdx={currentIdx}
                />
                <OrbitControls />
              </Canvas>
            </div>
          </Card>
        </div>
        <div>
          <Card title="A 行列の固有値 (複素平面)">
            <div className="aspect-square">
              <EigenCanvas eig={eig} />
            </div>
            <EigenSummary eig={eig} />
          </Card>
        </div>
      </div>

      {/* 操作 + ショック */}
      <Card title="操作">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-3 py-1.5 rounded border border-slate-300 text-sm hover:bg-slate-50"
          >
            Shocks Reset
          </button>
          <button
            type="button"
            onClick={resetModel}
            className="px-3 py-1.5 rounded border border-slate-300 text-sm hover:bg-slate-50"
          >
            Model Reset
          </button>
          <input
            type="range"
            min={0}
            max={SIM_STEPS - 1}
            step={1}
            value={currentIdx}
            onChange={(e) => {
              setPlaying(false);
              setCurrentIdx(Number(e.target.value));
            }}
            className="flex-1 min-w-[200px]"
          />
          <div className="text-xs text-slate-500 tabular-nums w-16 text-right">
            t = {currentIdx}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-600 self-center mr-1">
            t={currentIdx} に外生ショック注入:
          </span>
          {EVENT_PRESETS.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => fireShock(ev)}
              title={ev.description}
              className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50"
            >
              {ev.emoji} {ev.label}
            </button>
          ))}
        </div>

        {shocks.length > 0 && (
          <div className="mt-2 text-[11px] text-slate-500">
            投入済み: {shocks.map((s) => `${s.event.emoji}@t=${s.t}`).join(", ")}
          </div>
        )}
      </Card>

      {/* A 行列マトリクス UI */}
      <Card title="A 行列 (3×3) — 各 helix の慣性 (対角) と役割交差 (非対角)">
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-1.5"></th>
                {[0, 1, 2].map((j) => (
                  <th key={j} className="p-1.5 font-medium text-slate-600">
                    ← {model.stateNames[j]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i}>
                  <th className="p-1.5 text-right font-medium text-slate-600 whitespace-nowrap">
                    {model.stateNames[i]} →
                  </th>
                  {[0, 1, 2].map((j) => (
                    <td key={j} className="p-1.5">
                      <div className="flex flex-col items-center min-w-[100px]">
                        <span className="tabular-nums text-[11px]">
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
                          className="w-full"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
          対角 (a_ii) = 各 helix の慣性 / persistence。非対角 (a_ij, i≠j) = 「j
          → i」の役割交差係数 (Etzkowitz の意味で「役割の引き受け合い」)。
          非対角を非対称にすると複素固有値が出て、軌道が螺旋になる。
        </p>
      </Card>
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
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-700 mb-2">{title}</div>
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
    <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 font-mono">
      {eig.lambdas.map((l, i) => (
        <div key={i}>
          λ{i + 1} = {l.re.toFixed(3)}
          {l.isComplex
            ? ` ${l.im >= 0 ? "+" : "−"} ${Math.abs(l.im).toFixed(3)}i`
            : ""}{" "}
          (|λ|={l.abs.toFixed(3)})
        </div>
      ))}
      <div className="font-sans pt-1">
        <span className={stabColor[eig.stability]}>
          {eig.stability === "stable"
            ? "安定 (減衰)"
            : eig.stability === "neutral"
              ? "境界 (持続)"
              : "不安定 (発散)"}
        </span>
        {eig.period && ` / 周期 ≈ ${eig.period.toFixed(1)} step`}
        {eig.decayTime && ` / 減衰 ≈ ${eig.decayTime.toFixed(1)} step`}
      </div>
    </div>
  );
}
