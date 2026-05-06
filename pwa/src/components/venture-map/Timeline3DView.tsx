"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Grid,
  GizmoHelper,
  GizmoViewport,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { VentureRow, XrlLogRow, LaneId } from "@/lib/venture-map-data";

// ============================================================
// 設計
// ============================================================
// ユーザー軸 → Three.js 軸:
//   X (時間)        → Three.X
//   Y (SU 奥行き)   → Three.Z
//   Z (スコア / 高さ) → Three.Y (Three は Y-up が標準)
//
// プリセット名はユーザー軸ベースで命名。
//   "xz"  : 時間 × スコア (重ねた 2D)   → camera (0,0,+dist), look (0,0,0)
//   "yz"  : SU × スコア (棒グラフ)      → camera (+dist,0,0)
//   "xy"  : 時間 × SU (沿革)           → camera (0,+dist,0)
//   "iso" : 3D 等角視点
// ============================================================

const LANE_COLORS: Record<LaneId, string> = {
  gx_energy: "#22d3ee",   // cyan
  gx_circular: "#34d399", // emerald
  materials: "#fb923c",   // orange
  life: "#f472b6",        // pink
  robo: "#a78bfa",        // violet
};

const RL_COLORS = {
  trl: "#22d3ee",
  brl: "#fb923c",
  hrl: "#34d399",
  grl: "#a78bfa",
  srl: "#f472b6",
} as const;

const X_LEN = 24;       // 時間軸の長さ
const Y_GAP = 2.4;      // SU 間距離
const Z_HEIGHT = 4;     // スコア上限 (score=1 → height=Z_HEIGHT)
const TUBE_RADIUS = 0.08;
const TUBE_RADIUS_AMD = 0.13; // AMD 参画期間は太く

export interface VentureWithXrl {
  venture: VentureRow;
  xrl: XrlLogRow[];
}

interface Props {
  data: VentureWithXrl[];
}

function computeScore(r: XrlLogRow): number {
  const sum =
    (r.trl || 0) + (r.brl || 0) + (r.hrl || 0) + (r.grl || 0) + (r.srl || 0);
  return Math.min(1, Math.max(0, sum / 25));
}

function deriveTimeRange(data: VentureWithXrl[]): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const { venture, xrl } of data) {
    const f = +new Date(venture.founded_at);
    if (Number.isFinite(f)) {
      if (f < min) min = f;
      if (f > max) max = f;
    }
    for (const r of xrl) {
      const t = +new Date(r.observed_at);
      if (Number.isFinite(t)) {
        if (t < min) min = t;
        if (t > max) max = t;
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    const now = Date.now();
    return [now - 365 * 24 * 3600 * 1000, now];
  }
  // 最低 1 年幅は確保
  const span = max - min;
  const minSpan = 365 * 24 * 3600 * 1000;
  if (span < minSpan) {
    return [min, min + minSpan];
  }
  return [min, max];
}

type Preset = "iso" | "xz" | "yz" | "xy";

const PRESET_CAM: Record<Preset, [number, number, number]> = {
  iso: [18, 13, 22],
  xz: [0, 0, 30],
  yz: [30, 0, 0.0001],
  xy: [0, 30, 0.0001],
};

const PRESET_LABEL: Record<Preset, string> = {
  iso: "3D",
  xz: "時間 × スコア",
  yz: "SU × スコア",
  xy: "時間 × SU (沿革)",
};

// ============================================================
// VentureTube: 1 SU の折れ線 (CatmullRom + Tube geometry)
// 期間内 (AMD 参画) は太く emissive 強め、期間外は細く暗く
// ============================================================

function VentureTube({
  points,
  color,
  intensity,
  radius,
}: {
  points: THREE.Vector3[];
  color: string;
  intensity: number;
  radius: number;
}) {
  const { curve, segments } = useMemo(() => {
    if (points.length < 2) return { curve: null, segments: 0 };
    const c = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
    return { curve: c, segments: Math.max(48, points.length * 16) };
  }, [points]);

  if (!curve) return null;

  return (
    <mesh>
      <tubeGeometry args={[curve, segments, radius, 10, false]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        roughness={0.25}
        metalness={0.55}
        toneMapped={false}
      />
    </mesh>
  );
}

// ============================================================
// VentureBars: 5 RL の積層棒 (Y-Z 視点で映える)
// 各 SU の最新観測点を SU 位置に立てる
// ============================================================

function VentureBars({
  vd,
  z,
  xPos,
}: {
  vd: VentureWithXrl;
  z: number;
  xPos: number;
}) {
  if (vd.xrl.length === 0) return null;
  const latest = vd.xrl[vd.xrl.length - 1];
  const vals = [
    { key: "trl" as const, val: (latest.trl || 0) / 5 },
    { key: "brl" as const, val: (latest.brl || 0) / 5 },
    { key: "hrl" as const, val: (latest.hrl || 0) / 5 },
    { key: "grl" as const, val: (latest.grl || 0) / 5 },
    { key: "srl" as const, val: (latest.srl || 0) / 5 },
  ];
  const segH = Z_HEIGHT / 5;
  let cum = 0;
  return (
    <group position={[xPos, 0, z]}>
      {vals.map((rl) => {
        const h = Math.max(0.01, rl.val * segH);
        const yCenter = cum + h / 2;
        cum += h;
        return (
          <mesh key={rl.key} position={[0, yCenter, 0]}>
            <boxGeometry args={[0.45, h, 0.45]} />
            <meshStandardMaterial
              color={RL_COLORS[rl.key]}
              emissive={RL_COLORS[rl.key]}
              emissiveIntensity={0.9}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ============================================================
// VentureEvents: milestone_label を持つ点に光る球 + Html ラベル
// X-Y view (沿革) のときだけ Html を表示する
// ============================================================

function VentureEvents({
  vd,
  z,
  mapTime,
  showLabels,
}: {
  vd: VentureWithXrl;
  z: number;
  mapTime: (iso: string) => number;
  showLabels: boolean;
}) {
  const events = vd.xrl.filter((r) => r.milestone_label);
  return (
    <>
      {events.map((r) => {
        const x = mapTime(r.observed_at);
        const y = computeScore(r) * Z_HEIGHT;
        return (
          <group key={r.id} position={[x, y, z]}>
            <mesh>
              <sphereGeometry args={[0.13, 16, 16]} />
              <meshStandardMaterial
                color="#fef3c7"
                emissive="#fbbf24"
                emissiveIntensity={1.6}
                toneMapped={false}
              />
            </mesh>
            {showLabels && (
              <Html
                center
                distanceFactor={14}
                position={[0, 0.4, 0]}
                style={{ pointerEvents: "none" }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    color: "#fde68a",
                    background: "rgba(8,12,20,0.7)",
                    border: "1px solid rgba(251,191,36,0.4)",
                    padding: "2px 6px",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.milestone_label}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

// ============================================================
// CameraRig: preset 切替で camera position を smooth lerp
// 完了したら OrbitControls の自由回転に戻す
// ============================================================

function CameraRig({
  preset,
  controlsRef,
}: {
  preset: Preset;
  controlsRef: React.RefObject<{ enabled: boolean; target: THREE.Vector3; update: () => void } | null>;
}) {
  const targetPos = useRef(new THREE.Vector3(...PRESET_CAM[preset]));
  const animating = useRef(true);
  const { camera } = useThree();

  useEffect(() => {
    targetPos.current.set(...PRESET_CAM[preset]);
    animating.current = true;
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, [preset, controlsRef]);

  useFrame(() => {
    if (!animating.current) return;
    camera.position.lerp(targetPos.current, 0.08);
    camera.lookAt(0, 0, 0);
    if (camera.position.distanceTo(targetPos.current) < 0.05) {
      camera.position.copy(targetPos.current);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.enabled = true;
        controlsRef.current.update();
      }
      animating.current = false;
    }
  });

  return null;
}

// ============================================================
// Scene: 全 SU を組み立てる
// ============================================================

function Scene({ data, preset }: { data: VentureWithXrl[]; preset: Preset }) {
  const tRange = useMemo(() => deriveTimeRange(data), [data]);
  const mapTime = useMemo(() => {
    const span = tRange[1] - tRange[0] || 1;
    return (iso: string) => {
      const t = +new Date(iso);
      const ratio = (t - tRange[0]) / span;
      return (ratio - 0.5) * X_LEN;
    };
  }, [tRange]);

  const center = (data.length - 1) / 2;
  const now = Date.now();

  return (
    <>
      {data.map((vd, i) => {
        if (vd.xrl.length < 2) return null;
        const z = (i - center) * Y_GAP;
        const color = LANE_COLORS[vd.venture.lane];

        // AMD 参画期間: founded_at 〜 (active なら今日 / それ以外は最終 xrl)
        const amdStart = +new Date(vd.venture.founded_at);
        const amdEnd =
          vd.venture.status === "active"
            ? now
            : +new Date(vd.xrl[vd.xrl.length - 1].observed_at);

        // 観測点を期間内 / 期間外に分ける
        const inAmd: THREE.Vector3[] = [];
        const outAmd: THREE.Vector3[] = [];
        vd.xrl.forEach((r) => {
          const t = +new Date(r.observed_at);
          const v = new THREE.Vector3(
            mapTime(r.observed_at),
            computeScore(r) * Z_HEIGHT,
            z,
          );
          if (t >= amdStart && t <= amdEnd) {
            inAmd.push(v);
          } else {
            outAmd.push(v);
          }
        });

        const lastP = vd.xrl[vd.xrl.length - 1];
        const lastV = new THREE.Vector3(
          mapTime(lastP.observed_at),
          computeScore(lastP) * Z_HEIGHT,
          z,
        );

        return (
          <group key={vd.venture.id}>
            {outAmd.length >= 2 && (
              <VentureTube
                points={outAmd}
                color={color}
                intensity={0.4}
                radius={TUBE_RADIUS}
              />
            )}
            {inAmd.length >= 2 && (
              <VentureTube
                points={inAmd}
                color={color}
                intensity={1.8}
                radius={TUBE_RADIUS_AMD}
              />
            )}
            {/* 最新点に光る球 */}
            <mesh position={lastV.toArray()}>
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={2.2}
                toneMapped={false}
              />
            </mesh>
            {/* SU ラベル (折れ線の右端) */}
            <Html
              position={[lastV.x + 0.5, lastV.y, z]}
              style={{ pointerEvents: "none" }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color,
                  textShadow: "0 0 6px rgba(0,0,0,0.8)",
                  whiteSpace: "nowrap",
                }}
              >
                {vd.venture.short_label || vd.venture.id}
              </div>
            </Html>
            {/* Y-Z 視点用 内訳棒 (常時描画、X 軸右端に出すので X-Z 視点では端っこに見える) */}
            <VentureBars vd={vd} z={z} xPos={X_LEN / 2 + 1.4} />
            {/* milestone events */}
            <VentureEvents
              vd={vd}
              z={z}
              mapTime={mapTime}
              showLabels={preset === "xy"}
            />
          </group>
        );
      })}

      {/* 軸ガイド */}
      <AxesGuide />
      <GridFloor />
    </>
  );
}

function AxesGuide() {
  return (
    <>
      {/* X 軸線 (時間) */}
      <mesh position={[0, -0.45, 0]}>
        <boxGeometry args={[X_LEN + 2, 0.02, 0.02]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
      {/* Y 軸線 (スコア) */}
      <mesh position={[-X_LEN / 2 - 0.5, Z_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.02, Z_HEIGHT + 1, 0.02]} />
        <meshBasicMaterial color="#a78bfa" toneMapped={false} />
      </mesh>
      <Html position={[X_LEN / 2 + 1.2, -0.45, 0]} style={{ pointerEvents: "none" }}>
        <div style={{ color: "#22d3ee", fontFamily: "monospace", fontSize: 10 }}>TIME →</div>
      </Html>
      <Html
        position={[-X_LEN / 2 - 0.5, Z_HEIGHT + 0.7, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div style={{ color: "#a78bfa", fontFamily: "monospace", fontSize: 10 }}>SCORE ↑</div>
      </Html>
    </>
  );
}

function GridFloor() {
  return (
    <Grid
      position={[0, -0.5, 0]}
      args={[60, 60]}
      cellColor="#1e293b"
      sectionColor="#0e7490"
      cellThickness={0.5}
      sectionThickness={1}
      cellSize={1}
      sectionSize={4}
      fadeDistance={60}
      fadeStrength={1.5}
      infiniteGrid
    />
  );
}

// ============================================================
// Top-level component
// ============================================================

export default function Timeline3DView({ data }: Props) {
  const [preset, setPreset] = useState<Preset>("iso");
  const controlsRef = useRef<{
    enabled: boolean;
    target: THREE.Vector3;
    update: () => void;
  } | null>(null);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 84px)",
        minHeight: 600,
        background:
          "radial-gradient(ellipse at center, #0a0f1a 0%, #050810 60%, #02040a 100%)",
      }}
    >
      {/* preset selector */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          display: "flex",
          gap: 8,
          padding: 8,
          background: "rgba(8,12,20,0.8)",
          border: "1px solid rgba(34,211,238,0.3)",
          borderRadius: 6,
          backdropFilter: "blur(8px)",
        }}
      >
        {(["xz", "iso", "yz", "xy"] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: preset === p ? "#0a0f1a" : "#67e8f9",
              background: preset === p ? "#22d3ee" : "transparent",
              border: `1px solid ${preset === p ? "#22d3ee" : "rgba(34,211,238,0.4)"}`,
              borderRadius: 4,
              cursor: "pointer",
              textShadow: preset === p ? "none" : "0 0 6px rgba(34,211,238,0.5)",
            }}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>

      {/* hint */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 16,
          zIndex: 10,
          fontSize: 10,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: "rgba(103,232,249,0.5)",
        }}
      >
        DRAG: rotate · SCROLL: zoom · 太線 = AMD 参画期間 · 黄球 = milestone
      </div>

      <Canvas
        camera={{ position: PRESET_CAM.iso, fov: 45, near: 0.1, far: 500 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#02040a"]} />
        <fog attach="fog" args={["#02040a", 30, 80]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[0, 12, 12]} intensity={1.2} color="#22d3ee" />
        <pointLight position={[12, -8, -12]} intensity={0.9} color="#a78bfa" />
        <directionalLight position={[-10, 20, 10]} intensity={0.4} color="#fff" />

        <Suspense fallback={null}>
          <Scene data={data} preset={preset} />
        </Suspense>

        <OrbitControls
          ref={controlsRef as never}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={80}
        />
        <CameraRig preset={preset} controlsRef={controlsRef} />
        <GizmoHelper alignment="top-right" margin={[60, 60]}>
          <GizmoViewport
            axisColors={["#22d3ee", "#a78bfa", "#fb923c"]}
            labelColor="#0a0f1a"
          />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
