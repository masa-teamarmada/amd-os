"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Grid,
  GizmoHelper,
  GizmoViewport,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { VentureRow, XrlLogRow, LaneId } from "@/lib/venture-map-data";
import { HudFrame } from "./HudFrame";
import { SuDetailModal } from "./SuDetailModal";

// ============================================================
// 設計
// ============================================================
// ユーザー軸 → Three.js 軸:
//   X (時間)        → Three.X
//   Y (SU 奥行き)   → Three.Z
//   Z (スコア)      → Three.Y (Y-up)
//
// stacked area (5 RL レイヤー) を ShapeGeometry で描き、
// emissive material + Bloom postprocessing でネオン発光感
// 各 SU は invisible plane で onClick 受け、SuDetailModal を開く
// ============================================================

// 濃いネオン色 (saturated cyber、薄いパステルではない)
const RL_COLORS = {
  trl: "#06b6d4", // cyan-500
  brl: "#f97316", // orange-500
  hrl: "#10b981", // emerald-500
  grl: "#8b5cf6", // violet-500
  srl: "#ec4899", // pink-500
} as const;

const RL_KEYS = ["trl", "brl", "hrl", "grl", "srl"] as const;
type RlKey = (typeof RL_KEYS)[number];

const HUD_INK = "#0a0e15";
const HUD_LINE = "#475569";
const HUD_MUTE = "#64748b";
const NEON_GRAD =
  "linear-gradient(135deg, #22d3ee 0%, #a78bfa 50%, #f472b6 100%)";

const X_LEN = 22;
const Y_GAP = 2.6;
const Z_HEIGHT = 10;

const _LANE_COLORS_RESERVED: Record<LaneId, string> = {
  gx_energy: "#22d3ee",
  gx_circular: "#34d399",
  materials: "#fb923c",
  life: "#f472b6",
  robo: "#a78bfa",
};
void _LANE_COLORS_RESERVED;

export interface VentureWithXrl {
  venture: VentureRow;
  xrl: XrlLogRow[];
}

interface Props {
  data: VentureWithXrl[];
}

function deriveTimeRange(data: VentureWithXrl[]): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const { venture, xrl } of data) {
    if (venture.founded_at) {
      const f = +new Date(venture.founded_at);
      if (Number.isFinite(f)) {
        if (f < min) min = f;
        if (f > max) max = f;
      }
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
  const span = max - min;
  const minSpan = 365 * 24 * 3600 * 1000;
  if (span < minSpan) return [min, min + minSpan];
  return [min, max];
}

type Preset = "iso" | "xz" | "yz" | "xy";

const PRESET_CAM: Record<Preset, [number, number, number]> = {
  iso: [22, 17, 27],
  xz: [0, Z_HEIGHT / 2, 36],
  yz: [38, Z_HEIGHT / 2, 0.0001],
  xy: [0, 40, 0.0001],
};

const PRESET_LABEL: Record<Preset, string> = {
  iso: "3D",
  xz: "T × SCORE",
  yz: "SU × SCORE",
  xy: "T × SU",
};

// ============================================================
// VentureStackedArea: 1 SU の 5 レイヤー stacked area + onClick
// ============================================================

function VentureStackedArea({
  vd,
  zPos,
  mapTime,
  onClick,
}: {
  vd: VentureWithXrl;
  zPos: number;
  mapTime: (iso: string) => number;
  onClick: () => void;
}) {
  const { layers, bbox } = useMemo(() => {
    if (vd.xrl.length < 2) {
      return { layers: [], bbox: { xMin: 0, xMax: 0, yMax: 0 } };
    }
    const xs = vd.xrl.map((r) => mapTime(r.observed_at));
    const cumY: number[][] = vd.xrl.map((r) => {
      const vals = RL_KEYS.map((k) =>
        Math.min(
          5,
          Math.max(0, (r as unknown as Record<string, number | null>)[k] || 0),
        ),
      );
      const cums: number[] = [];
      let cum = 0;
      for (const v of vals) {
        cum += v;
        cums.push((cum / 25) * Z_HEIGHT);
      }
      return cums;
    });
    const N = vd.xrl.length;
    const result: { key: RlKey; shape: THREE.Shape }[] = [];
    for (let i = 0; i < RL_KEYS.length; i++) {
      const shape = new THREE.Shape();
      const lowerY = (k: number) => (i === 0 ? 0 : cumY[k][i - 1]);
      const upperY = (k: number) => cumY[k][i];
      shape.moveTo(xs[0], lowerY(0));
      for (let k = 1; k < N; k++) shape.lineTo(xs[k], lowerY(k));
      for (let k = N - 1; k >= 0; k--) shape.lineTo(xs[k], upperY(k));
      shape.closePath();
      result.push({ key: RL_KEYS[i], shape });
    }
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMax = Math.max(...cumY.map((c) => c[c.length - 1]));
    return { layers: result, bbox: { xMin, xMax, yMax } };
  }, [vd, mapTime]);

  const [hover, setHover] = useState(false);

  if (layers.length === 0) return null;

  const bboxW = bbox.xMax - bbox.xMin;
  const bboxH = Math.max(0.5, bbox.yMax);

  return (
    <group position={[0, 0, zPos]}>
      {/* 各 RL レイヤー: emissive で発光 */}
      {layers.map((layer, i) => (
        <mesh key={layer.key} renderOrder={i}>
          <shapeGeometry args={[layer.shape]} />
          <meshStandardMaterial
            color={RL_COLORS[layer.key]}
            emissive={RL_COLORS[layer.key]}
            emissiveIntensity={hover ? 0.6 : 0.35}
            transparent
            opacity={hover ? 0.88 : 0.78}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            roughness={0.45}
            metalness={0.0}
          />
        </mesh>
      ))}

      {/* invisible click target (bounding plane) */}
      <mesh
        position={[bbox.xMin + bboxW / 2, bboxH / 2, 0.02]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "default";
        }}
      >
        <planeGeometry args={[Math.max(0.5, bboxW), bboxH]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ============================================================
// VentureEvents
// ============================================================

function VentureEvents({
  xrl,
  zPos,
  mapTime,
  showLabels,
}: {
  xrl: XrlLogRow[];
  zPos: number;
  mapTime: (iso: string) => number;
  showLabels: boolean;
}) {
  const events = xrl.filter((r) => r.milestone_label);
  return (
    <>
      {events.map((r) => {
        const x = mapTime(r.observed_at);
        const sum =
          (r.trl || 0) +
          (r.brl || 0) +
          (r.hrl || 0) +
          (r.grl || 0) +
          (r.srl || 0);
        const y = (sum / 25) * Z_HEIGHT;
        return (
          <group key={r.id} position={[x, y, zPos]}>
            <mesh>
              <sphereGeometry args={[0.13, 16, 16]} />
              <meshStandardMaterial
                color="#f59e0b"
                emissive="#fbbf24"
                emissiveIntensity={0.8}
                toneMapped={false}
              />
            </mesh>
            {showLabels && (
              <Html
                center
                distanceFactor={14}
                position={[0, 0.5, 0]}
                style={{ pointerEvents: "none" }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    color: HUD_INK,
                    background: "rgba(255,255,255,0.95)",
                    border: `1px solid ${HUD_INK}`,
                    padding: "2px 6px",
                    whiteSpace: "nowrap",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    clipPath:
                      "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                  }}
                >
                  ◆ {r.milestone_label}
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
// CameraRig
// ============================================================

function CameraRig({
  preset,
  controlsRef,
}: {
  preset: Preset;
  controlsRef: React.RefObject<{
    enabled: boolean;
    target: THREE.Vector3;
    update: () => void;
  } | null>;
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
    const lookY = preset === "xz" || preset === "yz" ? Z_HEIGHT / 2 : 0;
    camera.lookAt(0, lookY, 0);
    if (camera.position.distanceTo(targetPos.current) < 0.05) {
      camera.position.copy(targetPos.current);
      camera.lookAt(0, lookY, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, lookY, 0);
        controlsRef.current.enabled = true;
        controlsRef.current.update();
      }
      animating.current = false;
    }
  });

  return null;
}

// ============================================================
// Scene
// ============================================================

function Scene({
  data,
  preset,
  onSelectVenture,
}: {
  data: VentureWithXrl[];
  preset: Preset;
  onSelectVenture: (vd: VentureWithXrl) => void;
}) {
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

  return (
    <>
      {data.map((vd, i) => {
        if (vd.xrl.length < 2) return null;
        const zPos = (i - center) * Y_GAP;
        const lastP = vd.xrl[vd.xrl.length - 1];
        const lastSum =
          (lastP.trl || 0) +
          (lastP.brl || 0) +
          (lastP.hrl || 0) +
          (lastP.grl || 0) +
          (lastP.srl || 0);
        const lastX = mapTime(lastP.observed_at);
        const lastY = (lastSum / 25) * Z_HEIGHT;

        return (
          <group key={vd.venture.project_id}>
            <VentureStackedArea
              vd={vd}
              zPos={zPos}
              mapTime={mapTime}
              onClick={() => onSelectVenture(vd)}
            />
            <VentureEvents
              xrl={vd.xrl}
              zPos={zPos}
              mapTime={mapTime}
              showLabels={preset === "xy"}
            />
            <Html
              position={[lastX + 0.4, lastY + 0.1, zPos]}
              style={{ pointerEvents: "none" }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: HUD_INK,
                  background: "rgba(255,255,255,0.85)",
                  border: `1px solid ${HUD_INK}`,
                  padding: "1px 6px",
                  whiteSpace: "nowrap",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  clipPath:
                    "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                }}
              >
                ▸ {(vd.venture.short_label || vd.venture.project_id).toUpperCase()}
              </div>
            </Html>
          </group>
        );
      })}

      <AxesGuide />
      <GridFloor />
    </>
  );
}

function AxesGuide() {
  return (
    <>
      <mesh position={[0, -0.45, 0]}>
        <boxGeometry args={[X_LEN + 2, 0.025, 0.025]} />
        <meshBasicMaterial color={HUD_INK} toneMapped={false} />
      </mesh>
      <mesh position={[-X_LEN / 2 - 0.5, Z_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.025, Z_HEIGHT + 1, 0.025]} />
        <meshBasicMaterial color={HUD_INK} toneMapped={false} />
      </mesh>
      <Html position={[X_LEN / 2 + 1.2, -0.45, 0]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            color: HUD_INK,
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          [ T ▸ ]
        </div>
      </Html>
      <Html position={[-X_LEN / 2 - 0.5, Z_HEIGHT + 0.7, 0]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            color: HUD_INK,
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          [ SCORE ▴ ]
        </div>
      </Html>
    </>
  );
}

function GridFloor() {
  return (
    <Grid
      position={[0, -0.5, 0]}
      args={[60, 60]}
      cellColor="#cbd5e1"
      sectionColor={HUD_LINE}
      cellThickness={0.4}
      sectionThickness={0.9}
      cellSize={1}
      sectionSize={4}
      fadeDistance={75}
      fadeStrength={1.4}
      infiniteGrid
    />
  );
}

// ============================================================
// Top-level
// ============================================================

export default function Timeline3DView({ data }: Props) {
  const [preset, setPreset] = useState<Preset>("iso");
  const [selected, setSelected] = useState<VentureWithXrl | null>(null);
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
          "radial-gradient(ellipse at 30% 20%, #ecfeff 0%, #ffffff 35%, #fdf4ff 70%, #f5f3ff 100%)",
        overflow: "hidden",
      }}
    >
      {/* HUD header */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
        }}
      >
        <HudFrame variant="bar" padding="14px 90px">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: HUD_INK,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                background: NEON_GRAD,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 800,
              }}
            >
              ▶▶▶
            </span>
            <span style={{ fontWeight: 700 }}>VENTURE TIMELINE / 3D</span>
            <span style={{ color: HUD_MUTE }}>│</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {data.length.toString().padStart(2, "0")} SU TRACKED
            </span>
            <span style={{ color: HUD_MUTE }}>│</span>
            <span style={{ color: "#0891b2" }}>● READY</span>
          </div>
        </HudFrame>
      </div>

      {/* preset selector */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 24,
          zIndex: 10,
        }}
      >
        <HudFrame variant="bar" padding="6px 80px">
          <div style={{ display: "flex" }}>
            {(["xz", "iso", "yz", "xy"] as Preset[]).map((p, idx) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                style={{
                  padding: "9px 16px",
                  fontSize: 10,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: preset === p ? "#fff" : HUD_INK,
                  background: preset === p ? NEON_GRAD : "transparent",
                  border: "none",
                  borderLeft:
                    idx === 0 ? "none" : `1px solid rgba(10,14,21,0.4)`,
                  cursor: "pointer",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  transition: "all 0.15s",
                  textShadow:
                    preset === p ? "0 1px 2px rgba(0,0,0,0.18)" : "none",
                }}
              >
                {PRESET_LABEL[p]}
              </button>
            ))}
          </div>
        </HudFrame>
      </div>

      {/* legend */}
      <div
        style={{
          position: "absolute",
          top: 64,
          right: 24,
          zIndex: 10,
        }}
      >
        <HudFrame variant="bar" padding="14px 90px">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 10,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ color: HUD_MUTE, fontWeight: 600 }}>LAYERS ▸</span>
            {RL_KEYS.map((k) => (
              <span
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  color: HUD_INK,
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 10,
                    background: RL_COLORS[k],
                    opacity: 0.7,
                    border: `1px solid ${RL_COLORS[k]}`,
                    boxShadow: `0 0 8px ${RL_COLORS[k]}88`,
                  }}
                />
                {k.toUpperCase()}
              </span>
            ))}
          </div>
        </HudFrame>
      </div>

      {/* hint footer */}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: 24,
          right: 24,
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 9,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: HUD_MUTE,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          <span>[CLICK] OPEN SU</span>
          <span>[DRAG] ROTATE</span>
          <span>[SCROLL] ZOOM</span>
          <span style={{ color: "#d97706" }}>● MILESTONE</span>
        </div>
        <div>SYS // VENTURE-MAP-3D v0.2</div>
      </div>

      <Canvas
        camera={{ position: PRESET_CAM.iso, fov: 45, near: 0.1, far: 500 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#fbfaff"]} />
        <fog attach="fog" args={["#f5f3ff", 38, 100]} />
        <ambientLight intensity={0.85} />
        <directionalLight
          position={[12, 22, 12]}
          intensity={0.4}
          color="#ffffff"
        />

        <Suspense fallback={null}>
          <Scene
            data={data}
            preset={preset}
            onSelectVenture={(vd) => setSelected(vd)}
          />
        </Suspense>

        <OrbitControls
          ref={controlsRef as never}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={100}
        />
        <CameraRig preset={preset} controlsRef={controlsRef} />
        <GizmoHelper alignment="top-right" margin={[80, 130]}>
          <GizmoViewport
            axisColors={[HUD_INK, HUD_INK, HUD_INK]}
            labelColor="#ffffff"
          />
        </GizmoHelper>
        {/* 白背景なので Bloom は控えめ。highlight (emissive 強い部分) だけ薄く滲ませる */}
        <EffectComposer multisampling={2}>
          <Bloom
            intensity={0.35}
            luminanceThreshold={0.85}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      {selected && (
        <SuDetailModal
          venture={selected.venture}
          xrl={selected.xrl}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
