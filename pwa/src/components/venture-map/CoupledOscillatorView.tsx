"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
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
 * シンプル版: Text (drei) を使わず HTML オーバーレイでラベル表示
 */

// =====================================================================
// 1 つのボール (HTML ラベル付き)
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
// ばね (cylinder)
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
// メインシーン
// =====================================================================

interface SceneProps {
  oscillator: CoupledOscillator;
  isPaused: boolean;
}

function Scene({ oscillator, isPaused }: SceneProps) {
  const [, forceRender] = useState(0);

  useFrame((_, delta) => {
    if (isPaused) return;
    const subSteps = 4;
    const dt = Math.min(delta, 0.05) / subSteps;
    for (let i = 0; i < subSteps; i++) {
      oscillator.step(dt);
    }
    forceRender((n) => n + 1);
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
      <pointLight position={[-10, 5, -10]} intensity={0.5} />

      {/* 平面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#f1f5f9" opacity={0.5} transparent />
      </mesh>

      {/* グリッド */}
      <gridHelper args={[12, 12, "#cbd5e1", "#e2e8f0"]} position={[0, 0, 0]} />

      {/* ばね */}
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

      {/* 6 ボール */}
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
  const [isPaused, setIsPaused] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(interval);
  }, []);

  const handleEvent = (preset: EventPreset) => {
    if (preset.isJump) {
      oscillatorRef.current.applyJump(preset.target, preset.magnitude);
    } else {
      oscillatorRef.current.applyImpulse(preset.target, preset.magnitude);
    }
  };

  const handleReset = () => {
    oscillatorRef.current.reset();
  };

  const M = oscillatorRef.current.computeM();
  void tick;

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 160px)", minHeight: 600 }}>
      {/* 左: 3D ビュー */}
      <div
        className="flex-1 rounded-lg border bg-white shadow-sm overflow-hidden relative"
        style={{ minWidth: 0, minHeight: 0 }}
      >
        <Canvas
          camera={{ position: [7, 8, 9], fov: 50 }}
          style={{ width: "100%", height: "100%" }}
        >
          <Scene oscillator={oscillatorRef.current} isPaused={isPaused} />
        </Canvas>
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
          <div className="flex gap-2">
            <button
              onClick={() => setIsPaused((p) => !p)}
              className="flex-1 text-xs px-3 py-2 rounded border bg-slate-50 hover:bg-slate-100"
            >
              {isPaused ? "▶ 再生" : "⏸ 一時停止"}
            </button>
            <button
              onClick={handleReset}
              className="flex-1 text-xs px-3 py-2 rounded border bg-red-50 border-red-300 hover:bg-red-100"
            >
              リセット
            </button>
          </div>
        </div>

        <div className="rounded-lg border bg-blue-50 p-3 shadow-sm text-xs">
          <p className="font-medium text-blue-900 mb-1">使い方</p>
          <ul className="text-blue-800 space-y-1 list-disc list-inside">
            <li>マウスドラッグでカメラ回転</li>
            <li>ホイールでズーム</li>
            <li>イベントボタンで外力を投入、揺れの伝播を観察</li>
            <li>⚡ はジャンプ (V03-N、ブレークスルー)</li>
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
