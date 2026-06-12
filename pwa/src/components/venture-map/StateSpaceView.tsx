"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PRESETS,
  eigenvalues2x2,
  simulate,
  type EigenAnalysis,
  type Matrix2x2,
  type Vec2,
} from "@/lib/state-space";

/**
 * Before Zero Theory v3.1 — 状態空間モデル sandbox (プロトタイプ A)
 *
 * 状態方程式: x_{t+1} = A x_t + impulse_t
 *
 * - 隠れ状態は 2 次元
 * - A 行列をスライダーで操作
 * - ショックボタンで impulse を打つ
 * - 軌道・固有値・時系列の 3 ビューで状態の動きを把握
 */

const STEPS = 200;
const TRACE_LIMIT = 600;

// =====================================================================
// 軌道描画 (x1-x2 平面)
// =====================================================================

function TrajectoryView({
  trajectory,
  currentIdx,
}: {
  trajectory: Vec2[];
  currentIdx: number;
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

    // 軌道の自動スケーリング (はみ出さないように)
    let maxAbs = 1.5;
    for (const p of trajectory) {
      maxAbs = Math.max(maxAbs, Math.abs(p.x1), Math.abs(p.x2));
    }
    const scale = Math.min(w, h) / 2 / (maxAbs * 1.2);
    const cx = w / 2;
    const cy = h / 2;
    const toX = (x: number) => cx + x * scale;
    const toY = (y: number) => cy - y * scale;

    // グリッド
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(toX(i), 0);
      ctx.lineTo(toX(i), h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toY(i));
      ctx.lineTo(w, toY(i));
      ctx.stroke();
    }

    // 軸
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // 軸ラベル
    ctx.fillStyle = "#475569";
    ctx.font = "12px sans-serif";
    ctx.fillText("x₁", w - 18, cy - 6);
    ctx.fillText("x₂", cx + 6, 14);

    // 軌道 (現在位置までの履歴)
    const traceStart = Math.max(0, currentIdx - TRACE_LIMIT);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = traceStart; i <= currentIdx; i++) {
      const p = trajectory[i];
      if (!p) continue;
      const px = toX(p.x1);
      const py = toY(p.x2);
      if (i === traceStart) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 現在位置
    const cur = trajectory[currentIdx];
    if (cur) {
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(toX(cur.x1), toY(cur.x2), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [trajectory, currentIdx]);

  return <canvas ref={ref} className="w-full h-full" />;
}

// =====================================================================
// 固有値プロット (複素平面 + 単位円)
// =====================================================================

function EigenView({ eig }: { eig: EigenAnalysis }) {
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

    // グリッド
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // 単位円 (|λ|=1)
    const stableColor = "#10b981";
    const unstableColor = "#ef4444";
    const ringColor =
      eig.stability === "unstable" ? unstableColor : stableColor;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText("|λ|=1", cx + r * 0.72, cy - r * 0.72);
    ctx.fillText("Re", w - 22, cy - 6);
    ctx.fillText("Im", cx + 6, 14);

    // 固有値プロット
    for (const l of eig.lambdas) {
      const px = cx + l.re * r;
      const py = cy - l.im * r;
      ctx.fillStyle = l.isComplex ? "#8b5cf6" : "#0ea5e9";
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [eig]);

  return <canvas ref={ref} className="w-full h-full" />;
}

// =====================================================================
// 時系列 x1(t), x2(t)
// =====================================================================

function TimeSeriesView({
  trajectory,
  currentIdx,
}: {
  trajectory: Vec2[];
  currentIdx: number;
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

    const padL = 30;
    const padR = 12;
    const padT = 10;
    const padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // y スケール
    let maxAbs = 1.5;
    for (const p of trajectory) {
      maxAbs = Math.max(maxAbs, Math.abs(p.x1), Math.abs(p.x2));
    }
    const yScale = plotH / 2 / (maxAbs * 1.1);
    const yMid = padT + plotH / 2;
    const xScale = plotW / Math.max(1, trajectory.length - 1);

    // ゼロ線
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, yMid);
    ctx.lineTo(padL + plotW, yMid);
    ctx.stroke();

    ctx.fillStyle = "#475569";
    ctx.font = "10px sans-serif";
    ctx.fillText("0", 14, yMid + 3);
    ctx.fillText("t", padL + plotW - 6, h - 6);

    // 系列描画
    const drawSeries = (key: "x1" | "x2", color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < trajectory.length; i++) {
        const px = padL + i * xScale;
        const py = yMid - trajectory[i][key] * yScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    drawSeries("x1", "#3b82f6");
    drawSeries("x2", "#f59e0b");

    // 現在位置の縦線
    if (currentIdx >= 0 && currentIdx < trajectory.length) {
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
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("x₁", padL + 6, padT + 12);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("x₂", padL + 28, padT + 12);
  }, [trajectory, currentIdx]);

  return <canvas ref={ref} className="w-full h-full" />;
}

// =====================================================================
// メインビュー
// =====================================================================

export function StateSpaceView() {
  const [A, setA] = useState<Matrix2x2>(PRESETS.spiral.A);
  const [x0, setX0] = useState<Vec2>({ x1: 1, x2: 0 });
  const [impulses, setImpulses] = useState<Map<number, Vec2>>(new Map());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  const trajectory = useMemo(() => {
    const arr: Vec2[] = new Array(STEPS).fill(null).map(() => ({
      x1: 0,
      x2: 0,
    }));
    for (let t = 0; t < STEPS; t++) {
      arr[t] = impulses.get(t) ?? { x1: 0, x2: 0 };
    }
    return simulate(A, x0, STEPS, arr);
  }, [A, x0, impulses]);

  const eig = useMemo(() => eigenvalues2x2(A), [A]);

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
          if (idx >= STEPS - 1) {
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
    setCurrentIdx(0);
    setImpulses(new Map());
    setPlaying(false);
  }, []);

  const fireImpulse = useCallback(
    (axis: "x1" | "x2", magnitude: number) => {
      setImpulses((prev) => {
        const next = new Map(prev);
        const t = currentIdx;
        const cur = next.get(t) ?? { x1: 0, x2: 0 };
        next.set(t, { ...cur, [axis]: cur[axis] + magnitude });
        return next;
      });
    },
    [currentIdx],
  );

  const applyPreset = useCallback((key: keyof typeof PRESETS) => {
    setA({ ...PRESETS[key].A });
    setCurrentIdx(0);
    setImpulses(new Map());
    setPlaying(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* 上段: 軌道 + 固有値 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="1 状態軌道 (x₁ – x₂ 平面)">
          <div className="aspect-square">
            <TrajectoryView
              trajectory={trajectory}
              currentIdx={currentIdx}
            />
          </div>
        </Card>
        <Card title="2 固有値 λ₁, λ₂ (複素平面)">
          <div className="aspect-square">
            <EigenView eig={eig} />
          </div>
          <EigenSummary eig={eig} />
        </Card>
      </div>

      {/* 中段: 時系列 */}
      <Card title="3 状態時系列 x₁(t), x₂(t)">
        <div className="h-40">
          <TimeSeriesView trajectory={trajectory} currentIdx={currentIdx} />
        </div>
      </Card>

      {/* 操作: タイムスクラブ + プレイ */}
      <Card title="時間操作">
        <div className="flex items-center gap-3">
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
            Reset
          </button>
          <input
            type="range"
            min={0}
            max={STEPS - 1}
            step={1}
            value={currentIdx}
            onChange={(e) => {
              setPlaying(false);
              setCurrentIdx(Number(e.target.value));
            }}
            className="flex-1"
          />
          <div className="text-xs text-slate-500 tabular-nums w-16 text-right">
            t = {currentIdx}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-600">
            現在 t={currentIdx} にショック投入:
          </span>
          <button
            type="button"
            onClick={() => fireImpulse("x1", 1)}
            className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs hover:bg-blue-100"
          >
            x₁ +1
          </button>
          <button
            type="button"
            onClick={() => fireImpulse("x1", -1)}
            className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs hover:bg-blue-100"
          >
            x₁ −1
          </button>
          <button
            type="button"
            onClick={() => fireImpulse("x2", 1)}
            className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs hover:bg-amber-100"
          >
            x₂ +1
          </button>
          <button
            type="button"
            onClick={() => fireImpulse("x2", -1)}
            className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs hover:bg-amber-100"
          >
            x₂ −1
          </button>
        </div>
      </Card>

      {/* 下段: A 行列スライダー + プリセット + 初期値 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="A 行列 (状態遷移)">
          <div className="grid grid-cols-2 gap-3">
            <MatrixSlider
              label="a₁₁ (x₁ 自己持続)"
              value={A.a11}
              onChange={(v) => setA({ ...A, a11: v })}
            />
            <MatrixSlider
              label="a₁₂ (x₂ → x₁ 結合)"
              value={A.a12}
              onChange={(v) => setA({ ...A, a12: v })}
            />
            <MatrixSlider
              label="a₂₁ (x₁ → x₂ 結合)"
              value={A.a21}
              onChange={(v) => setA({ ...A, a21: v })}
            />
            <MatrixSlider
              label="a₂₂ (x₂ 自己持続)"
              value={A.a22}
              onChange={(v) => setA({ ...A, a22: v })}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="px-2 py-1 rounded border border-slate-300 text-xs hover:bg-slate-50"
                  title={PRESETS[key].description}
                >
                  {key}
                </button>
              ),
            )}
          </div>
        </Card>
        <Card title="初期状態 x₀">
          <div className="grid grid-cols-2 gap-3">
            <MatrixSlider
              label="x₁(0)"
              value={x0.x1}
              onChange={(v) => {
                setX0({ ...x0, x1: v });
                setCurrentIdx(0);
              }}
              min={-2}
              max={2}
            />
            <MatrixSlider
              label="x₂(0)"
              value={x0.x2}
              onChange={(v) => {
                setX0({ ...x0, x2: v });
                setCurrentIdx(0);
              }}
              min={-2}
              max={2}
            />
          </div>
          <div className="mt-3 text-xs text-slate-600 leading-relaxed">
            <strong>遊び方:</strong>{" "}
            プリセット <code>spiral</code> から始めて、<code>a₁₂</code> と{" "}
            <code>a₂₁</code> の符号を同じにすると振動が消える (実固有値)。{" "}
            <code>a₁₁</code> や <code>a₂₂</code> を 1 超に上げると発散する
            (固有値が単位円外)。
          </div>
        </Card>
      </div>
    </div>
  );
}

// =====================================================================
// 共通コンポーネント
// =====================================================================

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-700 mb-2">{title}</div>
      {children}
    </div>
  );
}

function MatrixSlider({
  label,
  value,
  onChange,
  min = -1.2,
  max = 1.2,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function EigenSummary({ eig }: { eig: EigenAnalysis }) {
  const stabilityColor: Record<EigenAnalysis["stability"], string> = {
    stable: "text-emerald-600",
    neutral: "text-amber-600",
    unstable: "text-rose-600",
  };
  const oscLabel: Record<EigenAnalysis["oscillation"], string> = {
    monotone: "単調",
    oscillating: "振動",
    alternating: "符号交互",
  };

  return (
    <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 font-mono">
      <div>
        λ₁ = {eig.lambdas[0].re.toFixed(3)}
        {eig.lambdas[0].isComplex
          ? ` ± ${Math.abs(eig.lambdas[0].im).toFixed(3)}i`
          : ""}{" "}
        (|λ₁|={eig.lambdas[0].abs.toFixed(3)})
      </div>
      {!eig.lambdas[0].isComplex && (
        <div>
          λ₂ = {eig.lambdas[1].re.toFixed(3)} (|λ₂|=
          {eig.lambdas[1].abs.toFixed(3)})
        </div>
      )}
      <div className="font-sans">
        <span className={stabilityColor[eig.stability]}>
          {eig.stability === "stable"
            ? "安定 (減衰)"
            : eig.stability === "neutral"
              ? "境界 (持続)"
              : "不安定 (発散)"}
        </span>
        {" / "}
        {oscLabel[eig.oscillation]}
        {eig.period && ` / 周期 ≈ ${eig.period.toFixed(1)} step`}
        {eig.decayTime && ` / 減衰時定数 ≈ ${eig.decayTime.toFixed(1)} step`}
      </div>
    </div>
  );
}
