"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  CoupledOscillator,
  NODE_IDS,
  NODE_META,
  BONDS,
  EVENT_PRESETS,
  type NodeId,
  type EventPreset,
} from "@/lib/coupled-oscillator";

/**
 * Before Zero Theory v3 — 連成振動モデル 3D 可視化
 *
 * - 6 ボール (P, B, I_R, N, V, R) を連成振動子として動かす
 * - スクラバーで時刻を操作 (ドラッグで時間を進める/戻す、決定論的)
 * - イベントクリック → そのイベントを年月付きで追加 + スクラバーレンジを 20 年に設定
 */

const START_YEAR = 1990;
const START_MONTH = 1;
const STEPS_PER_MONTH = 20;
const DEFAULT_RANGE_YEARS = 20;

function dateToMonthIndex(year: number, month: number): number {
  return (year - START_YEAR) * 12 + (month - START_MONTH);
}

function monthIndexToLabel(idx: number): string {
  const total = Math.floor(idx);
  const year = START_YEAR + Math.floor((START_MONTH - 1 + total) / 12);
  const month = ((START_MONTH - 1 + total) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

interface EventInstance extends EventPreset {
  /** イベント発生時刻 (月数、START_YEAR-START_MONTH 起点) */
  timeMonths: number;
}

// =====================================================================
// ボール
// =====================================================================

function Ball({
  id,
  position,
  yDisplacement,
  isCenter,
}: {
  id: NodeId;
  position: { x: number; z: number };
  yDisplacement: number;
  isCenter?: boolean;
}) {
  const meta = NODE_META[id];
  const radius = isCenter ? 0.55 : 0.42;

  return (
    <group position={[position.x, yDisplacement, position.z]}>
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={meta.color}
          emissive={meta.color}
          emissiveIntensity={0.35}
          roughness={0.4}
        />
      </mesh>
      <Html
        position={[0, radius + 0.5, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.9)",
            padding: "2px 6px",
            borderRadius: 4,
            border: `1.5px solid ${meta.color}`,
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
            color: meta.color,
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          {meta.label}
          <div style={{ fontSize: 10, color: "#555", fontWeight: 400 }}>
            {meta.description}
          </div>
        </div>
      </Html>
    </group>
  );
}

// =====================================================================
// ばね
// =====================================================================

function Spring({
  fromPos,
  toPos,
  k,
}: {
  fromPos: [number, number, number];
  toPos: [number, number, number];
  k: number;
}) {
  const lineWidth = Math.min(0.08, 0.02 + k * 0.02);

  const mid: [number, number, number] = [
    (fromPos[0] + toPos[0]) / 2,
    (fromPos[1] + toPos[1]) / 2,
    (fromPos[2] + toPos[2]) / 2,
  ];
  const v = new THREE.Vector3(
    toPos[0] - fromPos[0],
    toPos[1] - fromPos[1],
    toPos[2] - fromPos[2],
  );
  const length = v.length();
  if (length < 0.01) return null;
  const yAxis = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(yAxis, v.clone().normalize());
  const euler = new THREE.Euler().setFromQuaternion(quat);

  return (
    <mesh position={mid} rotation={euler}>
      <cylinderGeometry args={[lineWidth, lineWidth, length, 8]} />
      <meshStandardMaterial color="#94a3b8" opacity={0.7} transparent />
    </mesh>
  );
}

// =====================================================================
// シーン
// =====================================================================

function Scene({ oscillator }: { oscillator: CoupledOscillator }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
      <pointLight position={[-10, 5, -10]} intensity={0.5} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#f1f5f9" opacity={0.5} transparent />
      </mesh>
      <gridHelper args={[12, 12, "#cbd5e1", "#e2e8f0"]} position={[0, 0, 0]} />

      {BONDS.map((bond, idx) => {
        const fromPos: [number, number, number] = [
          NODE_META[bond.from].equilibrium.x,
          oscillator.positions[bond.from],
          NODE_META[bond.from].equilibrium.z,
        ];
        const toPos: [number, number, number] = [
          NODE_META[bond.to].equilibrium.x,
          oscillator.positions[bond.to],
          NODE_META[bond.to].equilibrium.z,
        ];
        return <Spring key={idx} fromPos={fromPos} toPos={toPos} k={bond.k} />;
      })}

      {NODE_IDS.map((id) => (
        <Ball
          key={id}
          id={id}
          position={NODE_META[id].equilibrium}
          yDisplacement={oscillator.positions[id]}
          isCenter={id === "N"}
        />
      ))}

      <OrbitControls enablePan={true} target={[0, 0, 0]} />
    </>
  );
}

// =====================================================================
// 全体コンポーネント
// =====================================================================

export function CoupledOscillatorView() {
  const oscillatorRef = useRef<CoupledOscillator>(new CoupledOscillator());

  // スクラバー範囲 (月単位、START_YEAR起点)
  const [rangeStart, setRangeStart] = useState<number>(
    dateToMonthIndex(2007, 1),
  );
  const [rangeEnd, setRangeEnd] = useState<number>(
    dateToMonthIndex(2027, 1),
  );

  // 現在のシミュ時刻 (月)
  const [simTimeMonths, setSimTimeMonths] = useState<number>(
    dateToMonthIndex(2007, 1),
  );

  // 適用済みイベント
  const [events, setEvents] = useState<EventInstance[]>([]);

  // 再描画トリガー
  const [renderTick, setRenderTick] = useState(0);

  // simTime / events 変更で ODE を 0 から再計算
  useEffect(() => {
    const oscillator = oscillatorRef.current;
    oscillator.reset();
    const dt = 1 / STEPS_PER_MONTH;
    const targetSteps = Math.max(
      0,
      Math.round((simTimeMonths - rangeStart) * STEPS_PER_MONTH),
    );

    // 時刻順にソート済みイベントの step インデックス
    const evSteps = events
      .map((ev) => ({
        ev,
        step: Math.round((ev.timeMonths - rangeStart) * STEPS_PER_MONTH),
      }))
      .filter((e) => e.step >= 0 && e.step < targetSteps + STEPS_PER_MONTH);

    let evCursor = 0;
    for (let s = 0; s < targetSteps; s++) {
      // この step で発火すべきイベントを全部適用
      while (evCursor < evSteps.length && evSteps[evCursor].step === s) {
        const { ev } = evSteps[evCursor];
        if (ev.isJump) {
          oscillator.applyJump(ev.target, ev.magnitude);
        } else {
          oscillator.applyImpulse(ev.target, ev.magnitude);
        }
        evCursor++;
      }
      oscillator.step(dt);
    }
    setRenderTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simTimeMonths, events, rangeStart]);

  void renderTick;

  // イベントクリック: そのイベントを追加 + スクラバーレンジを設定
  const handleEvent = (preset: EventPreset) => {
    const evTime = dateToMonthIndex(preset.year, preset.month ?? 1);
    const newRangeStart = evTime;
    const newRangeEnd = evTime + DEFAULT_RANGE_YEARS * 12;

    // 既存イベントから新レンジ外のものを除外し、新イベントを追加
    const filtered = events.filter(
      (ev) => ev.timeMonths >= newRangeStart && ev.timeMonths <= newRangeEnd,
    );
    const newEvent: EventInstance = { ...preset, timeMonths: evTime };
    const merged = [...filtered, newEvent].sort((a, b) => a.timeMonths - b.timeMonths);

    setEvents(merged);
    setRangeStart(newRangeStart);
    setRangeEnd(newRangeEnd);
    setSimTimeMonths(evTime);
  };

  const handleReset = () => {
    setEvents([]);
    setSimTimeMonths(rangeStart);
  };

  const M = oscillatorRef.current.computeM();
  const currentDate = monthIndexToLabel(simTimeMonths);
  const startLabel = monthIndexToLabel(rangeStart);
  const endLabel = monthIndexToLabel(rangeEnd);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.timeMonths - b.timeMonths),
    [events],
  );

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 160px)", minHeight: 600 }}>
      {/* 左: 3D ビュー + スクラバー */}
      <div
        className="flex-1 rounded-lg border bg-white shadow-sm overflow-hidden relative flex flex-col"
        style={{ minWidth: 0, minHeight: 0 }}
      >
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          <Canvas
            camera={{ position: [7, 8, 9], fov: 50 }}
            style={{ width: "100%", height: "100%" }}
          >
            <Scene oscillator={oscillatorRef.current} />
          </Canvas>
          {/* 時刻オーバーレイ */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              background: "rgba(15,23,42,0.85)",
              color: "white",
              padding: "8px 14px",
              borderRadius: 8,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 1,
              pointerEvents: "none",
            }}
          >
            {currentDate}
            <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, letterSpacing: 0 }}>
              スクラバーで操作
            </div>
          </div>
          {/* イベント一覧オーバーレイ */}
          {sortedEvents.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "rgba(255,255,255,0.95)",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 11,
                maxWidth: 280,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>適用中イベント</div>
              {sortedEvents.map((ev, i) => (
                <div key={i} style={{ marginBottom: 2 }}>
                  <span style={{ fontFamily: "ui-monospace", fontWeight: 600 }}>
                    {monthIndexToLabel(ev.timeMonths)}
                  </span>{" "}
                  <span style={{ color: ev.isJump ? "#9333ea" : "#0f172a" }}>
                    {ev.isJump && "⚡"}
                    {ev.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* スクラバー */}
        <div className="border-t bg-slate-50 p-4">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span className="font-mono">{startLabel}</span>
            <span className="font-semibold">時間スクラバー (ドラッグして時刻を移動)</span>
            <span className="font-mono">{endLabel}</span>
          </div>
          <input
            type="range"
            min={rangeStart}
            max={rangeEnd}
            value={simTimeMonths}
            step={1}
            onChange={(e) => setSimTimeMonths(Number(e.target.value))}
            style={{ width: "100%" }}
            className="cursor-pointer"
          />
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-slate-500">
              現在: <span className="font-mono font-semibold">{currentDate}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSimTimeMonths(rangeStart)}
                className="px-2 py-1 rounded border bg-white hover:bg-slate-100"
              >
                ⏮ 開始
              </button>
              <button
                onClick={() => setSimTimeMonths(rangeEnd)}
                className="px-2 py-1 rounded border bg-white hover:bg-slate-100"
              >
                ⏭ 終了
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右: コントロール */}
      <div className="w-80 flex flex-col gap-3 overflow-y-auto" style={{ minHeight: 0 }}>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-2">マクロ指数 M (集約)</h3>
          <div
            className="text-3xl font-bold tabular-nums"
            style={{ color: M > 0 ? "#16a34a" : "#dc2626" }}
          >
            {M.toFixed(3)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            6 ノードの重み付き和。正値 = 立ち上がり、負値 = 沈下
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">外力 E (イベント)</h3>
          <div className="text-[10px] text-muted-foreground mb-2">
            クリックすると該当年から 20 年スパンに設定
          </div>
          <div className="flex flex-col gap-1.5">
            {EVENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleEvent(preset)}
                className={`text-left text-xs px-3 py-2 rounded border transition ${
                  preset.isJump
                    ? "bg-purple-50 border-purple-300 hover:bg-purple-100"
                    : "bg-slate-50 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <div className="font-medium">
                  {preset.isJump && "⚡ "}
                  {preset.label}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  → {preset.target}: {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-2">操作</h3>
          <button
            onClick={handleReset}
            className="w-full text-xs px-3 py-2 rounded border bg-red-50 border-red-300 hover:bg-red-100"
          >
            イベントクリア + 開始時刻に戻す
          </button>
        </div>

        <div className="rounded-lg border bg-blue-50 p-3 shadow-sm text-xs">
          <p className="font-medium text-blue-900 mb-1">使い方</p>
          <ul className="text-blue-800 space-y-1 list-disc list-inside">
            <li>イベントを押すと、その年から 20 年のスパンが設定される</li>
            <li>下のスクラバーをドラッグで時刻を操作</li>
            <li>複数イベントを足すと、レンジ内の全部が時系列で発火</li>
            <li>マウスドラッグで 3D カメラ回転、ホイールでズーム</li>
          </ul>
        </div>

        <div className="rounded-lg border bg-amber-50 p-3 shadow-sm text-xs">
          <p className="font-medium text-amber-900 mb-1">理論背景</p>
          <p className="text-amber-800">
            Before Zero Theory v3 / 論点 V03-O。
            数式: <code className="bg-amber-100 px-1 rounded">M ẍ + C ẋ + K x = F_E + dJ</code>
          </p>
        </div>
      </div>
    </div>
  );
}
