"use client";

/**
 * Cyberspace — Before Zero Theory v3.2 を 3D ハードコア可視化
 *
 * 中心アイデア: AMD Score = K · M · X · F (3 大要素の積) を
 * **log 軸 3D 空間**にマッピング。各軸:
 *   - X 軸: log10(σ_SU + 1)        … マクロ追い風 (0-1, 拡大して 0-10)
 *   - Y 軸: log10(XRL5 合成) / 3.2 … 会社の XRL 5 軸合成 (0-1, 拡大して 0-10)
 *   - Z 軸: log10(FRL + 1)         … CEO の FRL (0-1, 拡大して 0-10)
 *
 * 等値面 (S = const) は対数空間で「斜め平面」になる。GO / 設立準備 /
 * IPO 等のフェーズ閾値を半透明シェルとして配置することで、各 PJ が
 * どのフェーズに位置するかが空間的に一目で分かる。
 *
 * 仕様根拠: /Users/masa/projects/AMD/before-zero/theory/amd_score.md
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Line, Html, Sparkles, Stars } from "@react-three/drei";
import { CrystalShaderBg } from "./CrystalShaderBg";
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  AMD_SCORE_AXES,
  ALPHA_DEFAULT,
  AXIS_COLOR,
  AXIS_LABEL_JP,
  PHASE_LABEL_JP,
  calculateAmdScore,
  classifyPhase,
  type AlphaWeights,
  type AmdScoreAxis,
  type AmdScorePhase,
} from "@/lib/amd-score";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";
import { resolveFrl } from "@/lib/amd-score-derived";
import type { VentureRow } from "@/lib/venture-map-data";

// ============================================================
// 定数
// ============================================================

const WORLD = 10; // 各軸 0-WORLD のワールド座標
const AX_MAX_M = 1.3; // α_σ_SU
const AX_MAX_F = 1.5; // α_FRL
const AX_MAX_X = 1.0 + 0.6 + 0.3 + 0.2 + 1.1; // Σ α_xrl5 = 3.2

// 等値面シェル (S = const 平面) の閾値
const ISO_SHELLS: Array<{ score: number; label: string; color: string; opacity: number }> = [
  { score: 300, label: "シーズ顕在化", color: "#475569", opacity: 0.06 },
  { score: 1500, label: "立ち上げ準備期", color: "#f97316", opacity: 0.08 },
  { score: 3500, label: "GO 設立判定", color: "#22d3ee", opacity: 0.12 },
  { score: 15000, label: "スケール期", color: "#a78bfa", opacity: 0.10 },
  { score: 50000, label: "卒業期", color: "#f472b6", opacity: 0.08 },
];

// ============================================================
// データ変換
// ============================================================

interface PjPoint {
  projectId: string;
  displayName: string;
  shortLabel: string;
  evaluatedAt: string;
  score: number;
  bottleneck: AmdScoreAxis;
  phase: AmdScorePhase;
  // log10 寄与 (各軸の値, 0-1 に正規化)
  mNorm: number;
  xNorm: number;
  fNorm: number;
  // ワールド座標 (Three.js)
  pos: [number, number, number];
  // 元データ
  raw: {
    sigmaSU: number;
    xCompositeLog: number;
    frl: number;
    inputs: Record<AmdScoreAxis, number | null>;
  };
}

function buildPoints(
  ventures: VentureRow[],
  inputs: AmdScoreInputRow[],
  alpha: AlphaWeights
): PjPoint[] {
  const byPj = new Map<string, AmdScoreInputRow[]>();
  for (const r of inputs) {
    const list = byPj.get(r.project_id) ?? [];
    list.push(r);
    byPj.set(r.project_id, list);
  }

  const points: PjPoint[] = [];
  for (const v of ventures) {
    const list = byPj.get(v.project_id) ?? [];
    const latest = list[list.length - 1];
    if (!latest) continue;
    const result = calculateAmdScore(
      {
        mu_A: latest.mu_A ?? 0,
        mu_I: latest.mu_I ?? 0,
        mu_G: latest.mu_G ?? 0,
        TRL: latest.shallow_tech_mode ? null : latest.trl ?? 0,
        BRL: latest.brl ?? 0,
        GRL: latest.grl ?? 0,
        SRL: latest.srl ?? 0,
        HRL: latest.hrl ?? 0,
        FRL: resolveFrl(latest),
      },
      alpha
    );

    // 各軸の log 寄与 (0-1 正規化)
    const mNorm = Math.log10(result.sigma_SU + 1); // 0-1
    const xrlContribLog =
      (alpha.TRL ?? 0) * Math.log10(Math.max(0, latest.trl ?? 0) + 1) +
      (alpha.BRL ?? 0) * Math.log10(Math.max(0, latest.brl ?? 0) + 1) +
      (alpha.GRL ?? 0) * Math.log10(Math.max(0, latest.grl ?? 0) + 1) +
      (alpha.SRL ?? 0) * Math.log10(Math.max(0, latest.srl ?? 0) + 1) +
      (alpha.HRL ?? 0) * Math.log10(Math.max(0, latest.hrl ?? 0) + 1);
    const xNorm = AX_MAX_X > 0 ? Math.min(1, xrlContribLog / AX_MAX_X) : 0;
    const fNorm = Math.log10(Math.max(0, resolveFrl(latest)) + 1);

    points.push({
      projectId: v.project_id,
      displayName: v.display_name,
      shortLabel: v.short_label || v.display_name.slice(0, 4),
      evaluatedAt: latest.evaluated_at,
      score: result.score,
      bottleneck: result.bottleneck,
      phase: result.phase,
      mNorm,
      xNorm,
      fNorm,
      pos: [mNorm * WORLD, xNorm * WORLD, fNorm * WORLD],
      raw: {
        sigmaSU: result.sigma_SU,
        xCompositeLog: xrlContribLog,
        frl: resolveFrl(latest),
        inputs: {
          sigma_SU: result.sigma_SU,
          TRL: latest.trl,
          BRL: latest.brl,
          GRL: latest.grl,
          SRL: latest.srl,
          HRL: latest.hrl,
          FRL: resolveFrl(latest),
        },
      },
    });
  }
  return points;
}

// ============================================================
// 等値面シェル: log10(S) = log10(K) + α_σ * mNorm + α_X * xNorm + α_F * fNorm
//
// log10 S - log10 K = AX_MAX_M * mNorm + AX_MAX_X * xNorm + AX_MAX_F * fNorm
// ワールド座標: worldX = mNorm * WORLD ... なので
// 平面方程式: AX_MAX_M/WORLD * x + AX_MAX_X/WORLD * y + AX_MAX_F/WORLD * z = log10 S - log10 K
// ============================================================

function IsoShell({
  score,
  alpha,
  K,
  color,
  opacity,
  label,
}: {
  score: number;
  alpha: AlphaWeights;
  K: number;
  color: string;
  opacity: number;
  label: string;
}) {
  // 平面: a*x + b*y + c*z = d (worldUnit 座標で)
  const a = (alpha.sigma_SU ?? 0) / WORLD;
  const b = AX_MAX_X / WORLD;
  const c = (alpha.FRL ?? 0) / WORLD;
  const d = Math.log10(score) - Math.log10(K);

  const built = useMemo(() => {
    const corners = clipPlaneToBox(a, b, c, d, WORLD);
    if (!corners || corners.length < 3) return null;
    const cx = corners.reduce((acc, p) => acc + p[0], 0) / corners.length;
    const cy = corners.reduce((acc, p) => acc + p[1], 0) / corners.length;
    const cz = corners.reduce((acc, p) => acc + p[2], 0) / corners.length;
    const center: [number, number, number] = [cx, cy, cz];
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 1; i < corners.length - 1; i++) {
      positions.push(...corners[0], ...corners[i], ...corners[i + 1]);
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const lineGeometry = [...corners, corners[0]] as [number, number, number][];
    return { center, geometry, lineGeometry };
  }, [a, b, c, d]);

  if (!built) return null;
  const { center, geometry, lineGeometry } = built;

  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={lineGeometry} color={color} lineWidth={1.5} transparent opacity={0.5} />
      <Html position={center} center distanceFactor={20} occlude={false}>
        <div
          style={{
            color,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: 9,
            letterSpacing: 1.5,
            textShadow: `0 0 6px ${color}`,
            whiteSpace: "nowrap",
            opacity: 0.9,
            pointerEvents: "none",
          }}
        >
          S={score.toLocaleString()} · {label}
        </div>
      </Html>
    </group>
  );
}

// 平面 ax+by+cz=d と立方体 [0,L]^3 の交点ポリゴン (凸多角形, 頂点を平面内で時計回りソート)
function clipPlaneToBox(
  a: number,
  b: number,
  c: number,
  d: number,
  L: number
): [number, number, number][] | null {
  // 12 辺それぞれと平面の交点を求める
  const verts: [number, number, number][] = [
    [0, 0, 0], [L, 0, 0], [L, L, 0], [0, L, 0],
    [0, 0, L], [L, 0, L], [L, L, L], [0, L, L],
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const intersections: [number, number, number][] = [];
  for (const [i, j] of edges) {
    const v0 = verts[i];
    const v1 = verts[j];
    const f0 = a * v0[0] + b * v0[1] + c * v0[2] - d;
    const f1 = a * v1[0] + b * v1[1] + c * v1[2] - d;
    if (f0 * f1 > 0) continue; // 同符号は交点なし
    const denom = f0 - f1;
    if (Math.abs(denom) < 1e-9) continue;
    const t = f0 / denom;
    const x = v0[0] + t * (v1[0] - v0[0]);
    const y = v0[1] + t * (v1[1] - v0[1]);
    const z = v0[2] + t * (v1[2] - v0[2]);
    intersections.push([x, y, z]);
  }
  if (intersections.length < 3) return null;

  // 重心
  const cx = intersections.reduce((acc, p) => acc + p[0], 0) / intersections.length;
  const cy = intersections.reduce((acc, p) => acc + p[1], 0) / intersections.length;
  const cz = intersections.reduce((acc, p) => acc + p[2], 0) / intersections.length;
  const center = new THREE.Vector3(cx, cy, cz);
  const normal = new THREE.Vector3(a, b, c).normalize();
  // 平面内基底を作る
  const tmp = Math.abs(normal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(normal, tmp).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();

  const angled = intersections.map((p) => {
    const rel = new THREE.Vector3(p[0] - cx, p[1] - cy, p[2] - cz);
    return { p, ang: Math.atan2(rel.dot(v), rel.dot(u)) };
  });
  angled.sort((a, b) => a.ang - b.ang);
  // 重複点を間引く
  const out: [number, number, number][] = [];
  for (const { p } of angled) {
    if (out.length === 0) {
      out.push(p);
      continue;
    }
    const last = out[out.length - 1];
    const dx = p[0] - last[0];
    const dy = p[1] - last[1];
    const dz = p[2] - last[2];
    if (dx * dx + dy * dy + dz * dz > 1e-6) out.push(p);
  }
  return out;
}

// ============================================================
// PJ 球
// ============================================================

function PjSphere({
  pj,
  hovered,
  selected,
  onHover,
  onClick,
}: {
  pj: PjPoint;
  hovered: boolean;
  selected: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const radius = useMemo(() => {
    const logS = Math.max(0, Math.log10(Math.max(1, pj.score)));
    return 0.18 + logS * 0.12; // 0.18 (S=1) 〜 0.78 (S=100k)
  }, [pj.score]);
  const color = AXIS_COLOR[pj.bottleneck] ?? "#22d3ee";

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const baseScale = hovered || selected ? 1.35 : 1;
    const pulse = 1 + 0.04 * Math.sin(t * 2 + pj.pos[0]);
    ref.current.scale.setScalar(baseScale * pulse);
  });

  return (
    <group position={pj.pos}>
      <mesh
        ref={ref}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(false);
          document.body.style.cursor = "default";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 2.5 : hovered ? 2.0 : 1.4}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>
      {/* halo */}
      <mesh>
        <sphereGeometry args={[radius * 1.8, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      {/* drop line to floor */}
      <Line
        points={[
          [0, 0, 0],
          [0, -pj.pos[1], 0],
        ]}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.35}
        dashed
        dashSize={0.18}
        gapSize={0.12}
      />
      <Html position={[0, radius + 0.4, 0]} center distanceFactor={12}>
        <div
          style={{
            color,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            textShadow: `0 0 8px ${color}, 0 0 2px #000`,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {pj.shortLabel.toUpperCase()}
        </div>
      </Html>
    </group>
  );
}

// ============================================================
// シーン
// ============================================================

function AxisLine({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  return (
    <>
      <Line points={[start, end]} color={color} lineWidth={3} transparent opacity={1.0} />
      <Line points={[start, end]} color={color} lineWidth={6} transparent opacity={0.25} />
    </>
  );
}

function NeonLabel({ position, color, children, anchor = "left" }: {
  position: [number, number, number];
  color: string;
  children: React.ReactNode;
  anchor?: "left" | "center";
}) {
  return (
    <Html position={position} center distanceFactor={14} occlude={false} style={{ pointerEvents: "none" }}>
      <div
        style={{
          color,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          textShadow: `0 0 8px ${color}, 0 0 16px ${color}, 0 0 2px #000`,
          whiteSpace: "nowrap",
          textAlign: anchor === "center" ? "center" : "left",
          opacity: 0.95,
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </Html>
  );
}

function AxisLabels() {
  return (
    <>
      <AxisLine start={[0, 0, 0]} end={[WORLD * 1.08, 0, 0]} color="#22d3ee" />
      <NeonLabel position={[WORLD * 1.2, 0.2, 0]} color="#22d3ee">
        M · MACRO σ_SU
      </NeonLabel>
      <AxisLine start={[0, 0, 0]} end={[0, WORLD * 1.08, 0]} color="#fb923c" />
      <NeonLabel position={[0, WORLD * 1.2, 0]} color="#fb923c" anchor="center">
        X · XRL5 (TRL/BRL/GRL/SRL/HRL)
      </NeonLabel>
      <AxisLine start={[0, 0, 0]} end={[0, 0, WORLD * 1.08]} color="#f472b6" />
      <NeonLabel position={[0, 0.2, WORLD * 1.2]} color="#f472b6">
        F · CEO FRL
      </NeonLabel>
      {/* origin marker */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color="#22d3ee" />
      </mesh>
      {/* corner: IPO */}
      <mesh position={[WORLD, WORLD, WORLD]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <NeonLabel position={[WORLD, WORLD + 0.7, WORLD]} color="#ffffff" anchor="center">
        IPO · S=100,000
      </NeonLabel>
      {/* bounding box edges (wireframe cube) */}
      <BoundingBox />
    </>
  );
}

// CrystalOfData (icosahedron 流体近似版) は Sabo Sugi 本物の raymarching shader
// (CrystalShaderBg コンポーネント、別ファイル) に置き換え済み。
// 背景レイヤー (CSS absolute, z=0) として CyberspaceView 直下にレンダリングされる。

function BoundingBox() {
  const verts: [number, number, number][] = [
    [0, 0, 0], [WORLD, 0, 0], [WORLD, 0, WORLD], [0, 0, WORLD],
    [0, WORLD, 0], [WORLD, WORLD, 0], [WORLD, WORLD, WORLD], [0, WORLD, WORLD],
  ];
  // 12 edges
  const edges: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return (
    <>
      {edges.map(([a, b], i) => (
        <Line
          key={i}
          points={[verts[a], verts[b]]}
          color="#1e3a5f"
          lineWidth={1}
          transparent
          opacity={0.55}
        />
      ))}
    </>
  );
}

function Scene({
  points,
  alpha,
  K,
  hoveredId,
  selectedId,
  setHovered,
  setSelected,
}: {
  points: PjPoint[];
  alpha: AlphaWeights;
  K: number;
  hoveredId: string | null;
  selectedId: string | null;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
}) {
  return (
    <>
      {/* 背景は外側の CrystalShaderBg (raymarching shader, alpha 透過) に任せる。
          Canvas の clearColor は 0x000000 透過 (gl.alpha=true) */}
      <fog attach="fog" args={["#02030a", 30, 80]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[18, 18, 18]} intensity={1.2} color="#22d3ee" />
      <pointLight position={[-15, 8, -15]} intensity={0.9} color="#f472b6" />
      <pointLight position={[5, 22, -8]} intensity={0.7} color="#fb923c" />
      <pointLight position={[WORLD / 2, WORLD / 2, WORLD / 2]} intensity={0.5} color="#ffffff" distance={20} />
      {/* 星空 (奥行き) */}
      <Stars radius={80} depth={50} count={3000} factor={3} saturation={0.5} fade speed={0.6} />
      {/* 漂うパーティクル (cyan) */}
      <Sparkles
        count={120}
        scale={[WORLD * 1.6, WORLD * 1.6, WORLD * 1.6]}
        position={[WORLD / 2, WORLD / 2, WORLD / 2]}
        size={3}
        speed={0.3}
        opacity={0.7}
        color="#22d3ee"
      />
      {/* 床グリッド (派手) */}
      <Grid
        position={[WORLD / 2, -0.01, WORLD / 2]}
        args={[WORLD * 3, WORLD * 3]}
        cellSize={1}
        cellColor="#0a4a6b"
        cellThickness={1}
        sectionSize={5}
        sectionColor="#22d3ee"
        sectionThickness={1.5}
        fadeDistance={55}
        fadeStrength={1.2}
        infiniteGrid={false}
        followCamera={false}
      />
      <AxisLabels />
      {ISO_SHELLS.map((s) => (
        <IsoShell
          key={s.score}
          score={s.score}
          alpha={alpha}
          K={K}
          color={s.color}
          opacity={s.opacity}
          label={s.label}
        />
      ))}
      {points.map((pj) => (
        <PjSphere
          key={pj.projectId}
          pj={pj}
          hovered={hoveredId === pj.projectId}
          selected={selectedId === pj.projectId}
          onHover={(h) => setHovered(h ? pj.projectId : null)}
          onClick={() => setSelected(selectedId === pj.projectId ? null : pj.projectId)}
        />
      ))}
    </>
  );
}

// ============================================================
// HUD overlay
// ============================================================

type Preset = "iso" | "front" | "side" | "top";

const PRESET_CAM: Record<Preset, [number, number, number]> = {
  iso: [22, 18, 22],
  front: [WORLD / 2, WORLD / 2, 28],
  side: [28, WORLD / 2, WORLD / 2],
  top: [WORLD / 2, 28, WORLD / 2 + 0.001],
};

const PRESET_LABEL: Record<Preset, string> = {
  iso: "ISO",
  front: "M × X",
  side: "X × F",
  top: "M × F",
};

function PresetSwitcher({ value, onChange }: { value: Preset; onChange: (v: Preset) => void }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        display: "flex",
        gap: 6,
        zIndex: 10,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >
      {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: "6px 12px",
            background: value === p ? "rgba(34,211,238,0.18)" : "rgba(0,0,0,0.4)",
            border: `1px solid ${value === p ? "#22d3ee" : "rgba(34,211,238,0.35)"}`,
            color: value === p ? "#22d3ee" : "#94a3b8",
            fontSize: 10,
            letterSpacing: 1.5,
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            textShadow: value === p ? "0 0 6px #22d3ee" : undefined,
          }}
        >
          {PRESET_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

function TitleBar() {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        color: "#22d3ee",
        textShadow: "0 0 8px #22d3ee",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 3, color: "#64748b", textShadow: "none" }}>
        BEFORE ZERO THEORY · v3.2 · CYBERSPACE
      </div>
      <div style={{ fontSize: 18, letterSpacing: 2, marginTop: 2, fontWeight: 700 }}>
        S = K · M · X · F
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, textShadow: "none", letterSpacing: 1 }}>
        Cobb-Douglas 7軸を 3 大要素 (マクロ × 会社 × CEO) に集約。等値面で AMD Score 等高線。
      </div>
    </div>
  );
}

function BottleneckHud({ points }: { points: PjPoint[] }) {
  // bottleneck 軸別カウント
  const counts = useMemo(() => {
    const c: Partial<Record<AmdScoreAxis, number>> = {};
    for (const p of points) c[p.bottleneck] = (c[p.bottleneck] ?? 0) + 1;
    return AMD_SCORE_AXES.map((a) => ({ axis: a, count: c[a] ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [points]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        zIndex: 10,
        background: "rgba(4,6,13,0.7)",
        border: "1px solid rgba(34,211,238,0.35)",
        backdropFilter: "blur(8px)",
        padding: "10px 14px",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: 2, color: "#64748b", marginBottom: 6 }}>
        ⟨ BOTTLENECK DISTRIBUTION ⟩
      </div>
      {counts.length === 0 && (
        <div style={{ fontSize: 10, color: "#94a3b8" }}>no PJ data</div>
      )}
      {counts.map(({ axis, count }) => (
        <div
          key={axis}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 10,
            color: AXIS_COLOR[axis],
            textShadow: `0 0 4px ${AXIS_COLOR[axis]}`,
            marginTop: 2,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              background: AXIS_COLOR[axis],
              boxShadow: `0 0 6px ${AXIS_COLOR[axis]}`,
            }}
          />
          <span style={{ flex: 1 }}>{AXIS_LABEL_JP[axis]}</span>
          <span style={{ color: "#cbd5e1", textShadow: "none" }}>×{count}</span>
        </div>
      ))}
    </div>
  );
}

function ShellLegend() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        zIndex: 10,
        background: "rgba(4,6,13,0.7)",
        border: "1px solid rgba(34,211,238,0.35)",
        backdropFilter: "blur(8px)",
        padding: "10px 14px",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: 2, color: "#64748b", marginBottom: 6 }}>
        ⟨ ISO-SCORE SHELLS ⟩
      </div>
      {ISO_SHELLS.map((s) => (
        <div
          key={s.score}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 10,
            color: s.color,
            textShadow: `0 0 4px ${s.color}`,
            marginTop: 2,
          }}
        >
          <span
            style={{
              width: 16,
              height: 2,
              background: s.color,
              boxShadow: `0 0 6px ${s.color}`,
            }}
          />
          <span style={{ flex: 1 }}>{s.label}</span>
          <span style={{ color: "#cbd5e1", textShadow: "none" }}>S={s.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function PjDetailHud({ pj, onClose }: { pj: PjPoint; onClose: () => void }) {
  const phaseColor =
    {
      seed_watch: "#dc2626",
      seed_emerging: "#94a3b8",
      pre_launch: "#f97316",
      launch_prep: "#eab308",
      launch_go: "#0284c7",
      scale: "#16a34a",
      graduation: "#7c3aed",
    }[pj.phase] || "#22d3ee";
  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        right: 16,
        zIndex: 11,
        background: "rgba(4,6,13,0.85)",
        border: `1px solid ${AXIS_COLOR[pj.bottleneck]}`,
        boxShadow: `0 0 24px ${AXIS_COLOR[pj.bottleneck]}55`,
        backdropFilter: "blur(10px)",
        padding: "14px 18px",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        minWidth: 280,
        color: "#e2e8f0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: "#64748b" }}>⟨ TARGET LOCKED ⟩</div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            fontSize: 14,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: AXIS_COLOR[pj.bottleneck],
          textShadow: `0 0 8px ${AXIS_COLOR[pj.bottleneck]}`,
          marginTop: 2,
        }}
      >
        {pj.shortLabel.toUpperCase()}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>{pj.displayName}</div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 11 }}>
        <span style={{ color: "#64748b" }}>AMD Score</span>
        <span style={{ color: "#fff", fontWeight: 700 }}>
          {pj.score.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span style={{ color: "#64748b" }}>PHASE</span>
        <span style={{ color: phaseColor, textShadow: `0 0 4px ${phaseColor}` }}>
          {PHASE_LABEL_JP[pj.phase]}
        </span>
        <span style={{ color: "#64748b" }}>律速</span>
        <span style={{ color: AXIS_COLOR[pj.bottleneck] }}>{AXIS_LABEL_JP[pj.bottleneck]}</span>
        <span style={{ color: "#64748b" }}>σ_SU</span>
        <span>{pj.raw.sigmaSU.toFixed(2)}</span>
        <span style={{ color: "#64748b" }}>X (XRL5)</span>
        <span>{pj.raw.xCompositeLog.toFixed(2)} log</span>
        <span style={{ color: "#64748b" }}>FRL</span>
        <span>{pj.raw.frl.toFixed(1)}</span>
        <span style={{ color: "#64748b" }}>評価日</span>
        <span style={{ color: "#94a3b8" }}>{pj.evaluatedAt.slice(0, 10)}</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 9, letterSpacing: 1.5, color: "#475569" }}>
        WORLD POS · M={pj.mNorm.toFixed(2)} X={pj.xNorm.toFixed(2)} F={pj.fNorm.toFixed(2)}
      </div>
      <a
        href={`/venture-map/amd-score/${pj.projectId}`}
        style={{
          display: "block",
          marginTop: 10,
          padding: "6px 10px",
          background: "rgba(34,211,238,0.12)",
          border: "1px solid rgba(34,211,238,0.4)",
          color: "#22d3ee",
          fontSize: 10,
          letterSpacing: 2,
          textDecoration: "none",
          textAlign: "center",
          textShadow: "0 0 4px #22d3ee",
        }}
      >
        OPEN PJ COCKPIT →
      </a>
    </div>
  );
}

function StatsBar({ points }: { points: PjPoint[] }) {
  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const scores = points.map((p) => p.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const goCount = points.filter((p) => p.score >= 3500).length;
    const goPhase = points.filter((p) => p.score >= 3500 && p.score < 15000).length;
    const phaseCounts: Partial<Record<AmdScorePhase, number>> = {};
    for (const p of points) phaseCounts[p.phase] = (phaseCounts[p.phase] ?? 0) + 1;
    return { avg, max, goCount, goPhase, phaseCounts, total: points.length };
  }, [points]);

  if (!stats) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        display: "flex",
        gap: 18,
        background: "rgba(4,6,13,0.6)",
        border: "1px solid rgba(34,211,238,0.25)",
        padding: "8px 16px",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        backdropFilter: "blur(6px)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontSize: 8, color: "#64748b", letterSpacing: 1.5 }}>TOTAL PJ</span>
        <span style={{ fontSize: 14, color: "#e2e8f0" }}>{stats.total}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontSize: 8, color: "#64748b", letterSpacing: 1.5 }}>AVG SCORE</span>
        <span style={{ fontSize: 14, color: "#e2e8f0" }}>
          {stats.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontSize: 8, color: "#64748b", letterSpacing: 1.5 }}>MAX</span>
        <span style={{ fontSize: 14, color: "#22d3ee", textShadow: "0 0 6px #22d3ee" }}>
          {stats.max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontSize: 8, color: "#64748b", letterSpacing: 1.5 }}>GO+ PJ</span>
        <span style={{ fontSize: 14, color: "#22d3ee", textShadow: "0 0 6px #22d3ee" }}>
          {stats.goCount}/{stats.total}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// メイン
// ============================================================

interface Props {
  ventures: VentureRow[];
  inputs: AmdScoreInputRow[];
  alpha: AlphaWeights;
}

export function CyberspaceView({ ventures, inputs, alpha }: Props) {
  const [hoveredId, setHovered] = useState<string | null>(null);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("iso");

  const points = useMemo(() => buildPoints(ventures, inputs, alpha ?? ALPHA_DEFAULT), [
    ventures,
    inputs,
    alpha,
  ]);

  const K = useMemo(() => {
    const sumAlpha = Object.values(alpha ?? ALPHA_DEFAULT).reduce((a, b) => a + (b ?? 0), 0);
    return 100000 / Math.pow(10, sumAlpha);
  }, [alpha]);

  const selected = points.find((p) => p.projectId === selectedId) ?? null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 64px)",
        background: "#000000",
        overflow: "hidden",
      }}
    >
      {/* 背景: Sabo Sugi raymarching shader (透過 canvas, z=0) */}
      <CrystalShaderBg
        rotationSpeed={0.25}
        shapeStretch={0.65}
        shapeSize={2.7}
        plasmaDensity={0.05}
        plasmaColor={0xb8d4ff}
        frameColor={0xeef1ff}
        opacity={0.85}
      />
      <Canvas
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
        camera={{ position: PRESET_CAM[preset], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <Scene
            points={points}
            alpha={alpha ?? ALPHA_DEFAULT}
            K={K}
            hoveredId={hoveredId}
            selectedId={selectedId}
            setHovered={setHovered}
            setSelected={setSelected}
          />
        </Suspense>
        <CameraRig preset={preset} />
        <OrbitControls
          target={[WORLD / 2, WORLD / 2, WORLD / 2]}
          enablePan
          minDistance={6}
          maxDistance={70}
          enableDamping
          dampingFactor={0.08}
        />
        <EffectComposer multisampling={4}>
          <Bloom
            intensity={1.6}
            luminanceThreshold={0.08}
            luminanceSmoothing={0.7}
            mipmapBlur
            radius={0.85}
          />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={[0.0006, 0.0006] as unknown as [number, number]}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette eskil={false} offset={0.2} darkness={0.7} />
        </EffectComposer>
      </Canvas>
      <TitleBar />
      <PresetSwitcher value={preset} onChange={setPreset} />
      <StatsBar points={points} />
      <BottleneckHud points={points} />
      <ShellLegend />
      {selected && <PjDetailHud pj={selected} onClose={() => setSelected(null)} />}
      {points.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#94a3b8",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: 12,
            letterSpacing: 2,
            textAlign: "center",
          }}
        >
          ⟨ NO AMD_SCORE_INPUTS DATA ⟩
          <br />
          <span style={{ fontSize: 10 }}>amd_score_inputs テーブルに評価値を投入してください</span>
        </div>
      )}
    </div>
  );
}

function CameraRig({ preset }: { preset: Preset }) {
  const target = useRef(new THREE.Vector3(...PRESET_CAM[preset]));
  useFrame(({ camera }) => {
    target.current.set(...PRESET_CAM[preset]);
    camera.position.lerp(target.current, 0.05);
  });
  return null;
}
