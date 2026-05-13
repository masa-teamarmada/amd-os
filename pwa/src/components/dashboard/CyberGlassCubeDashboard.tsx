"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type ProjectCube = {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  status: string;
  accent: string;
  metric: string;
  lift: string;
  position: [number, number, number];
  rotation: [number, number, number];
};

type KpiHud = {
  label: string;
  value: string;
  sub: string;
  progress: number;
  tone: "cyan" | "green" | "amber" | "violet";
};

const projects: ProjectCube[] = [
  { id: "p20", code: "CX", name: "CryoX", subtitle: "Low-temp AI robotics", status: "ACTIVE", accent: "#43f5ff", metric: "X78 F64 M76", lift: "+18", position: [-2.05, 0.18, 2.6], rotation: [0.45, 0.58, -0.18] },
  { id: "p25", code: "KU", name: "KUTE", subtitle: "University venture ecosystem", status: "ACTIVE", accent: "#57ffae", metric: "X68 F82 M81", lift: "+24", position: [0.08, 0.62, 3.25], rotation: [0.12, -0.74, 0.38] },
  { id: "p06", code: "HZ", name: "Hydrogen Mobility", subtitle: "ZMP / hydrogen route", status: "SALES", accent: "#ffac57", metric: "X46 F51 M61", lift: "+09", position: [2.18, 0.08, 2.72], rotation: [-0.35, 0.34, 0.2] },
  { id: "p21", code: "PT", name: "Plant Twin", subtitle: "Digital twin agriculture", status: "ACTIVE", accent: "#338cff", metric: "X59 F74 M69", lift: "+15", position: [-1.08, -0.92, 1.96], rotation: [-0.2, -0.28, -0.42] },
  { id: "p14", code: "SE", name: "Science Engine", subtitle: "Research scout agent", status: "DRAFT", accent: "#ffe15c", metric: "X39 F68 M47", lift: "+07", position: [1.12, -1.06, 2.08], rotation: [0.36, 0.28, 0.5] },
  { id: "p29", code: "SX", name: "Supply X", subtitle: "Industrial protocol", status: "FROZEN", accent: "#c781ff", metric: "X31 F86 M36", lift: "+04", position: [0.1, -1.88, 1.46], rotation: [-0.58, 0.16, -0.1] },
];

const leftKpis: KpiHud[] = [
  { label: "ACTIVE PJ", value: "14", sub: "+3 / 90D", progress: 78, tone: "green" },
  { label: "TOTAL PJ", value: "29", sub: "SINCE FOUNDING", progress: 64, tone: "cyan" },
  { label: "AVG ARC", value: "11.6M", sub: "PROJECT DURATION", progress: 58, tone: "amber" },
];

const rightKpis: KpiHud[] = [
  { label: "RAISED", value: "8.4B", sub: "JPY PIPELINE", progress: 84, tone: "amber" },
  { label: "SCORE LIFT", value: "+29", sub: "AMD DELTA", progress: 69, tone: "green" },
  { label: "MS CLEAR", value: "68%", sub: "MILESTONE HIT", progress: 68, tone: "violet" },
];

const accentByTone = {
  cyan: "#46f7ff",
  green: "#61ffb3",
  amber: "#ffad57",
  violet: "#c781ff",
};

export default function CyberGlassCubeDashboard() {
  const [selected, setSelected] = useState<ProjectCube>(projects[1]);

  return (
    <main className="glassdash-page">
      <div className="glassdash-canvas" aria-hidden="true">
        <Canvas
          dpr={[1, 1.35]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, -8.8, 4.8], fov: 48, near: 0.1, far: 70 }}
          onPointerMissed={() => setSelected(projects[1])}
        >
          <GlassDashboardWorld selected={selected} onSelect={setSelected} />
        </Canvas>
      </div>
      <section className="glassdash-overlay">
        <header className="glassdash-brand">
          <span className="glassdash-logo"><Image src="/amd-logo.png" alt="AMD" width={92} height={92} priority /></span>
          <div>
            <p>AMD // OS</p>
            <b>HOLOGRAPHIC PORTFOLIO CHAMBER V2</b>
          </div>
        </header>
        <div className="glassdash-selected">
          <span>SELECTED CUBE</span>
          <strong>{selected.name}</strong>
          <small>{selected.metric} / VALUE LIFT {selected.lift}</small>
        </div>
      </section>
      <GlassDashboardStyles />
    </main>
  );
}

function GlassDashboardWorld({ selected, onSelect }: { selected: ProjectCube; onSelect: (project: ProjectCube) => void }) {
  const rootRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const backdropTexture = useMemo(() => createCyberBackdropTexture(), []);

  useEffect(() => {
    camera.up.set(0, 0, 1);
    camera.position.set(0, -8.8, 4.8);
    camera.lookAt(0, 0, 2.1);
  }, [camera]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (rootRef.current) rootRef.current.position.z = Math.sin(t * 0.68) * 0.045;
    if (scanRef.current) {
      scanRef.current.rotation.z = t * 0.18;
      scanRef.current.position.z = 0.04 + Math.sin(t * 1.6) * 0.035;
    }
    if (controlsRef.current) controlsRef.current.update();
  });

  return (
    <>
      <color attach="background" args={["#020711"]} />
      <fog attach="fog" args={["#03101b", 7, 28]} />
      <ambientLight intensity={0.22} />
      <pointLight color="#46f7ff" intensity={4.2} distance={13} position={[0, -1.2, 2.2]} />
      <pointLight color="#ff5f96" intensity={2.8} distance={8} position={[-2.4, -0.2, 3.6]} />
      <pointLight color="#57ffae" intensity={2.1} distance={8} position={[2.2, 0.4, 3.8]} />
      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 2.1]}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={5.4}
        maxDistance={13.5}
        maxPolarAngle={Math.PI / 2.05}
        rotateSpeed={0.44}
        zoomSpeed={0.65}
        autoRotate={false}
      />
      <mesh position={[0, 5.4, 4.1]} rotation={[Math.PI / 2, 0, 0]} renderOrder={-20}>
        <planeGeometry args={[24, 10]} />
        <meshBasicMaterial map={backdropTexture} transparent opacity={0.74} depthWrite={false} />
      </mesh>
      <group ref={rootRef}>
        <HolographicFloor />
        <group ref={scanRef}>
          <ScanningRings />
        </group>
        <ProjectCubeCluster selectedId={selected.id} onSelect={onSelect} />
        <HudWing side="left" position={[-4.3, -0.28, 2.5]} metrics={leftKpis} title="STUDIO CORE KPI" subtitle="OPERATING HEALTH" />
        <HudWing side="right" position={[4.3, -0.28, 2.5]} metrics={rightKpis} title="AMD VALUE PROOF" subtitle="INTERVENTION DELTA" />
        <SelectedCubeBeams project={selected} />
      </group>
    </>
  );
}

function ProjectCubeCluster({ selectedId, onSelect }: { selectedId: string; onSelect: (project: ProjectCube) => void }) {
  const prismTexture = useMemo(() => createPrismTexture(), []);
  return (
    <group>
      {projects.map((project, index) => (
        <GlassProjectCube
          key={project.id}
          project={project}
          index={index}
          prismTexture={prismTexture}
          selected={selectedId === project.id}
          onSelect={() => onSelect(project)}
        />
      ))}
      <mesh position={[0, -0.24, 0.92]} rotation={[Math.PI / 2, 0, 0]} renderOrder={3}>
        <torusGeometry args={[2.75, 0.012, 8, 160]} />
        <meshBasicMaterial color="#e7ffff" transparent opacity={0.46} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.24, 0.95]} rotation={[Math.PI / 2, 0, 0]} renderOrder={3}>
        <torusGeometry args={[1.55, 0.01, 8, 128]} />
        <meshBasicMaterial color="#46f7ff" transparent opacity={0.68} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function GlassProjectCube({ project, index, prismTexture, selected, onSelect }: { project: ProjectCube; index: number; prismTexture: THREE.Texture; selected: boolean; onSelect: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const edgeGeometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.98, 0.98, 0.98), 18), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index * 0.47;
    if (groupRef.current) {
      groupRef.current.position.z = project.position[2] + Math.sin(t * 1.15) * 0.16;
      groupRef.current.rotation.x = project.rotation[0] + Math.sin(t * 0.36) * 0.08;
      groupRef.current.rotation.y = project.rotation[1] + t * 0.13;
      groupRef.current.rotation.z = project.rotation[2] + Math.cos(t * 0.42) * 0.06;
      groupRef.current.scale.setScalar(selected ? 1.18 + Math.sin(t * 7.5) * 0.025 : 1);
    }
    if (innerRef.current) innerRef.current.rotation.y = -t * 0.22;
  });

  return (
    <group position={project.position} ref={groupRef}>
      <pointLight color={project.accent} intensity={selected ? 3.8 : 1.65} distance={4.8} decay={1.7} />
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        renderOrder={12}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color={project.accent}
          map={prismTexture}
          transparent
          opacity={selected ? 0.58 : 0.42}
          roughness={0.08}
          metalness={0.08}
          transmission={0.62}
          thickness={0.74}
          ior={1.65}
          reflectivity={0.78}
          emissive={project.accent}
          emissiveIntensity={selected ? 0.32 : 0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edgeGeometry} renderOrder={14}>
        <lineBasicMaterial color={selected ? "#ffffff" : project.accent} transparent opacity={selected ? 0.95 : 0.58} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <mesh ref={innerRef} scale={0.58} renderOrder={13}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#020b14" transparent opacity={0.48} depthWrite={false} />
      </mesh>
      <Html transform center position={[0, -0.526, 0.01]} rotation={[Math.PI / 2, 0, 0]} distanceFactor={4.2} zIndexRange={[42, 0]} style={{ pointerEvents: "auto" }}>
        <button
          className={`cube-face-label ${selected ? "active" : ""}`}
          type="button"
          style={{ "--cube-accent": project.accent } as CSSProperties}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <b>{project.code}</b>
          <span>{project.name}</span>
        </button>
      </Html>
      <Html transform center position={[0, 0, 0.74]} distanceFactor={5.2} zIndexRange={[32, 0]}>
        <span className="cube-air-label" style={{ "--cube-accent": project.accent } as CSSProperties}>{project.metric}</span>
      </Html>
    </group>
  );
}

function SelectedCubeBeams({ project }: { project: ProjectCube }) {
  const beamGeometry = useMemo(() => {
    const vertices = [
      project.position[0], project.position[1], 0.2, project.position[0], project.position[1], project.position[2] - 0.68,
      project.position[0] - 0.42, project.position[1], project.position[2] - 0.42, -4.05, -0.32, 2.5,
      project.position[0] + 0.42, project.position[1], project.position[2] - 0.42, 4.05, -0.32, 2.5,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, [project]);

  return (
    <group>
      <lineSegments geometry={beamGeometry} renderOrder={28}>
        <lineBasicMaterial color={project.accent} transparent opacity={0.72} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
      </lineSegments>
      <mesh position={[project.position[0], project.position[1], 0.18]} rotation={[Math.PI / 2, 0, 0]} renderOrder={8}>
        <torusGeometry args={[0.62, 0.016, 8, 96]} />
        <meshBasicMaterial color={project.accent} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HudWing({ side, position, metrics, title, subtitle }: { side: "left" | "right"; position: [number, number, number]; metrics: KpiHud[]; title: string; subtitle: string }) {
  const width = 2.78;
  const height = 3.48;
  const frameGeometry = useMemo(() => createWingFrameGeometry(width, height, side), [side]);
  const detailGeometry = useMemo(() => createWingDetailGeometry(width, height, side), [side]);
  const rotation: [number, number, number] = [Math.PI / 2, 0, side === "left" ? -0.13 : 0.13];

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={frameGeometry.fill} renderOrder={6}>
        <meshBasicMaterial color="#08263a" transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={frameGeometry.outline} renderOrder={7}>
        <lineBasicMaterial color="#6df9ff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={detailGeometry} renderOrder={8}>
        <lineBasicMaterial color={side === "left" ? "#57ffae" : "#ffad57"} transparent opacity={0.62} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <Html transform center distanceFactor={4.1} zIndexRange={[36, 0]} style={{ width: "340px", pointerEvents: "auto" }}>
        <KpiPanel title={title} subtitle={subtitle} metrics={metrics} align={side} />
      </Html>
    </group>
  );
}

function KpiPanel({ title, subtitle, metrics, align }: { title: string; subtitle: string; metrics: KpiHud[]; align: "left" | "right" }) {
  return (
    <section className={`glass-kpi-panel align-${align}`}>
      <div className="glass-kpi-head">
        <span>{subtitle}</span>
        <h2>{title}</h2>
      </div>
      <div className="glass-kpi-list">
        {metrics.map((metric) => (
          <article className={`glass-kpi-row tone-${metric.tone}`} key={metric.label}>
            <HudGauge metric={metric} />
            <div>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
              <span>{metric.sub}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HudGauge({ metric }: { metric: KpiHud }) {
  const accent = accentByTone[metric.tone];
  const progress = Math.max(0, Math.min(100, metric.progress));
  return (
    <svg className="glass-hud-gauge" viewBox="0 0 92 92" aria-hidden="true" style={{ "--gauge-accent": accent } as CSSProperties}>
      <path className="gauge-shell" d="M46 4 L58 9 L74 8 L84 21 L88 38 L82 55 L84 72 L70 84 L52 87 L36 82 L19 84 L8 70 L5 52 L10 36 L8 20 L22 8 Z" />
      <circle className="gauge-track" cx="46" cy="46" r="28" pathLength="100" />
      <circle className="gauge-progress" cx="46" cy="46" r="28" pathLength="100" strokeDasharray={`${progress} ${100 - progress}`} />
      {Array.from({ length: 18 }, (_, index) => (
        <line key={index} className={index * 5.56 <= progress ? "gauge-tick active" : "gauge-tick"} x1="46" y1="10" x2="46" y2="17" transform={`rotate(${index * 20} 46 46)`} />
      ))}
      <path className="gauge-cross" d="M28 46 H16 M64 46 H76 M46 28 V16 M46 64 V76" />
      <circle className="gauge-core" cx="46" cy="46" r="6" />
    </svg>
  );
}

function HolographicFloor() {
  const gridGeometry = useMemo(() => {
    const vertices: number[] = [];
    for (let i = -18; i <= 18; i += 1) {
      vertices.push(i, -8, 0, i, 12, 0);
      vertices.push(-18, i * 0.55, 0, 18, i * 0.55, 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);

  const radialGeometry = useMemo(() => {
    const vertices: number[] = [];
    for (let i = 0; i < 42; i += 1) {
      const a = (i / 42) * Math.PI * 2;
      vertices.push(Math.cos(a) * 0.45, Math.sin(a) * 0.45 - 0.24, 0.02, Math.cos(a) * 5.2, Math.sin(a) * 2.7 - 0.24, 0.02);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);

  return (
    <group>
      <lineSegments geometry={gridGeometry} renderOrder={1}>
        <lineBasicMaterial color="#4ff7ff" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={radialGeometry} renderOrder={2}>
        <lineBasicMaterial color="#9ffcff" transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <mesh position={[0, -0.24, 0.012]} rotation={[Math.PI / 2, 0, 0]} renderOrder={3}>
        <circleGeometry args={[1.18, 96]} />
        <meshBasicMaterial color="#46f7ff" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {[1.65, 2.08, 2.56, 3.28, 4.2].map((radius, index) => (
        <mesh key={radius} position={[0, -0.24, 0.018 + index * 0.004]} rotation={[Math.PI / 2, 0, 0]} renderOrder={4}>
          <torusGeometry args={[radius, index % 2 ? 0.01 : 0.018, 8, 160]} />
          <meshBasicMaterial color={index % 2 ? "#338cff" : "#46f7ff"} transparent opacity={0.42 - index * 0.045} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function ScanningRings() {
  return (
    <group position={[0, -0.24, 0.09]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={9}>
        <torusGeometry args={[3.72, 0.022, 8, 160, Math.PI * 1.5]} />
        <meshBasicMaterial color="#e9ffff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI * 0.72]} renderOrder={9}>
        <torusGeometry args={[2.92, 0.018, 8, 128, Math.PI * 1.18]} />
        <meshBasicMaterial color="#ff6fa4" transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI * 1.18]} renderOrder={9}>
        <torusGeometry args={[2.18, 0.014, 8, 128, Math.PI * 1.32]} />
        <meshBasicMaterial color="#57ffae" transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function createWingFrameGeometry(width: number, height: number, side: "left" | "right") {
  const s = side === "left" ? -1 : 1;
  const left = -width / 2;
  const right = width / 2;
  const bottom = -height / 2;
  const top = height / 2;
  const notch = 0.36;
  const points = [
    [left, 0, top - notch],
    [left + notch, 0, top],
    [right - notch * 1.45, 0, top],
    [right, 0, top - notch * 1.2],
    [right, 0, bottom + notch],
    [right - notch, 0, bottom],
    [left + notch * 1.25, 0, bottom],
    [left, 0, bottom + notch * 1.45],
  ].map(([x, y, z]) => [x + s * 0.16 * Math.abs(z / height), y, z]);
  const fill = new THREE.BufferGeometry();
  fill.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  fill.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 7, 7, 4, 5, 7, 5, 6]);
  const outlineVertices: number[] = [];
  points.forEach((point, index) => outlineVertices.push(...point, ...points[(index + 1) % points.length]));
  const outline = new THREE.BufferGeometry();
  outline.setAttribute("position", new THREE.Float32BufferAttribute(outlineVertices, 3));
  return { fill, outline };
}

function createWingDetailGeometry(width: number, height: number, side: "left" | "right") {
  const s = side === "left" ? -1 : 1;
  const vertices: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const z = -height / 2 + 0.62 + i * 0.45;
    vertices.push(-width / 2 + 0.28, 0.01, z, width / 2 - 0.48 - (i % 2) * 0.28, 0.01, z);
  }
  vertices.push(s * 0.4, 0.012, height / 2 - 0.35, s * 2.25, 0.012, height / 2 + 0.26);
  vertices.push(s * 1.1, 0.012, -height / 2 + 0.36, s * 2.42, 0.012, -height / 2 - 0.1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function createFallbackTexture(color: [number, number, number, number]) {
  const texture = new THREE.DataTexture(new Uint8Array(color), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function createPrismTexture() {
  if (typeof document === "undefined") return createFallbackTexture([70, 247, 255, 180]);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return createFallbackTexture([70, 247, 255, 180]);
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, "rgba(255,118,164,0.95)");
  gradient.addColorStop(0.28, "rgba(62,247,255,0.72)");
  gradient.addColorStop(0.52, "rgba(7,23,48,0.86)");
  gradient.addColorStop(0.74, "rgba(255,97,137,0.82)");
  gradient.addColorStop(1, "rgba(255,198,88,0.9)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 34; i += 1) {
    ctx.fillStyle = `rgba(${120 + (i * 19) % 120}, ${210 + (i * 7) % 45}, 255, ${0.05 + (i % 4) * 0.025})`;
    ctx.fillRect((i * 47) % 512, (i * 83) % 512, 28 + (i % 5) * 16, 80 + (i % 3) * 42);
  }
  for (let i = 0; i < 8; i += 1) {
    ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.22)" : "rgba(62,247,255,0.22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 70 + i * 54);
    ctx.lineTo(512, 18 + i * 64);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createCyberBackdropTexture() {
  if (typeof document === "undefined") return createFallbackTexture([2, 7, 17, 255]);
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return createFallbackTexture([2, 7, 17, 255]);
  const gradient = ctx.createRadialGradient(800, 520, 40, 800, 420, 780);
  gradient.addColorStop(0, "#0c8dce");
  gradient.addColorStop(0.28, "#07375f");
  gradient.addColorStop(0.72, "#031426");
  gradient.addColorStop(1, "#010713");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 220; i += 1) {
    const x = (i * 139) % canvas.width;
    const y = (i * 73) % canvas.height;
    const alpha = 0.08 + ((i * 17) % 40) / 280;
    ctx.fillStyle = `rgba(98,235,255,${alpha})`;
    ctx.fillRect(x, y, i % 5 === 0 ? 3 : 1, i % 7 === 0 ? 3 : 1);
  }
  ctx.strokeStyle = "rgba(78,247,255,0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i += 1) {
    const y = 118 + i * 34;
    ctx.beginPath();
    ctx.moveTo(120 + i * 11, y);
    ctx.lineTo(420 + i * 21, y);
    ctx.lineTo(470 + i * 21, y + 28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1080 - i * 18, y + 12);
    ctx.lineTo(1460 - i * 9, y + 12);
    ctx.lineTo(1510 - i * 9, y + 42);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function GlassDashboardStyles() {
  return (
    <style jsx global>{`
      @import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800&family=Share+Tech+Mono&display=swap");
      .glassdash-page{--ice:#eaffff;--cyan:#46f7ff;--green:#61ffb3;--amber:#ffad57;position:fixed;inset:0;z-index:30;overflow:hidden;color:var(--ice);background:#020711;font-family:"Share Tech Mono",ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em}
      .glassdash-canvas{position:absolute;inset:0}.glassdash-page:before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 5px),radial-gradient(circle at 50% 67%,rgba(70,247,255,.16),transparent 28%);mix-blend-mode:screen;opacity:.62}
      .glassdash-overlay{position:relative;z-index:2;min-height:100%;padding:clamp(20px,3vw,42px);pointer-events:none}.glassdash-brand{display:flex;align-items:center;gap:18px;width:fit-content;text-shadow:0 0 18px rgba(70,247,255,.78),0 0 44px rgba(31,128,255,.48)}.glassdash-logo{display:grid;place-items:center;width:clamp(66px,7vw,96px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(70,247,255,.22),rgba(30,112,255,.08) 56%,transparent 72%);filter:drop-shadow(0 0 18px rgba(70,247,255,.95))}.glassdash-logo img{width:72%;height:auto;filter:drop-shadow(0 0 10px rgba(70,247,255,.9))}
      .glassdash-brand p{margin:0;font-family:"Orbitron",sans-serif;font-size:clamp(33px,4.3vw,62px);font-weight:800;line-height:.95}.glassdash-brand b{display:block;margin-top:9px;color:#9ff9ff;font-size:clamp(11px,1.2vw,17px)}.glassdash-selected{position:absolute;right:clamp(20px,4vw,58px);bottom:clamp(20px,4vw,54px);min-width:min(360px,calc(100vw - 40px));padding:14px 18px;border-top:1px solid rgba(70,247,255,.78);border-bottom:1px solid rgba(70,247,255,.35);background:linear-gradient(90deg,rgba(70,247,255,.16),rgba(4,16,28,.42),transparent);text-align:right;text-shadow:0 0 14px rgba(70,247,255,.62)}.glassdash-selected span{display:block;color:rgba(193,253,255,.72);font-size:11px;font-weight:900}.glassdash-selected strong{display:block;margin-top:4px;font-family:"Orbitron",sans-serif;font-size:clamp(22px,2.5vw,34px);line-height:1}.glassdash-selected small{display:block;margin-top:7px;color:rgba(225,253,255,.76);font-size:11px}
      .cube-face-label{--cube-accent:#46f7ff;display:grid;gap:2px;place-items:center;width:138px;height:82px;appearance:none;border:1px solid color-mix(in srgb,var(--cube-accent),white 22%);background:linear-gradient(135deg,color-mix(in srgb,var(--cube-accent),transparent 62%),rgba(2,8,18,.46) 54%,rgba(255,255,255,.12));color:#fff;text-align:center;cursor:pointer;pointer-events:auto;clip-path:polygon(8% 0,100% 0,92% 100%,0 100%);box-shadow:inset 0 0 20px color-mix(in srgb,var(--cube-accent),transparent 66%),0 0 18px color-mix(in srgb,var(--cube-accent),transparent 24%);backdrop-filter:blur(8px) saturate(1.35)}.cube-face-label b{font-family:"Orbitron",sans-serif;font-size:20px;line-height:1;text-shadow:0 0 14px var(--cube-accent)}.cube-face-label span{font-size:11px;line-height:1.1;color:#eaffff}.cube-face-label.active{animation:cubeFacePulse 980ms ease-in-out infinite alternate;filter:brightness(1.38)}
      .cube-air-label{--cube-accent:#46f7ff;display:inline-block;min-width:118px;padding:4px 8px;border:1px solid color-mix(in srgb,var(--cube-accent),transparent 48%);background:rgba(0,12,22,.48);color:#eaffff;font-size:10px;text-align:center;text-shadow:0 0 10px var(--cube-accent);box-shadow:inset 0 0 12px color-mix(in srgb,var(--cube-accent),transparent 78%),0 0 14px color-mix(in srgb,var(--cube-accent),transparent 42%)}
      .glass-kpi-panel{box-sizing:border-box;width:340px;min-height:420px;padding:18px 20px;color:#eaffff;background:linear-gradient(90deg,rgba(70,247,255,.1),rgba(3,15,28,.38) 45%,rgba(7,30,44,.22));text-shadow:0 0 12px rgba(70,247,255,.52)}.glass-kpi-panel.align-right{text-align:right;background:linear-gradient(270deg,rgba(255,173,87,.13),rgba(3,15,28,.4) 46%,rgba(7,30,44,.2))}.glass-kpi-head{margin-bottom:15px;padding-bottom:11px;border-bottom:1px solid rgba(130,252,255,.42)}.glass-kpi-head span{display:block;color:rgba(194,253,255,.7);font-size:9px;font-weight:900;letter-spacing:.18em}.glass-kpi-head h2{margin:6px 0 0;font-family:"Orbitron",sans-serif;font-size:21px;line-height:1.08;text-shadow:0 0 18px rgba(70,247,255,.88)}
      .glass-kpi-list{display:grid;gap:11px}.glass-kpi-row{--row-accent:#46f7ff;display:grid;grid-template-columns:78px 1fr;gap:12px;align-items:center;min-height:90px;padding:9px 10px;border:1px solid color-mix(in srgb,var(--row-accent),transparent 58%);background:linear-gradient(90deg,color-mix(in srgb,var(--row-accent),transparent 86%),rgba(0,10,20,.34));box-shadow:inset 0 0 20px color-mix(in srgb,var(--row-accent),transparent 88%),0 0 20px color-mix(in srgb,var(--row-accent),transparent 82%);clip-path:polygon(0 0,calc(100% - 15px) 0,100% 15px,100% 100%,15px 100%,0 calc(100% - 15px))}.align-right .glass-kpi-row{grid-template-columns:1fr 78px}.align-right .glass-kpi-row .glass-hud-gauge{grid-column:2}.align-right .glass-kpi-row div{grid-row:1;grid-column:1}.tone-cyan{--row-accent:#46f7ff}.tone-green{--row-accent:#61ffb3}.tone-amber{--row-accent:#ffad57}.tone-violet{--row-accent:#c781ff}.glass-kpi-row small{display:block;color:rgba(202,253,255,.68);font-size:9px;font-weight:900}.glass-kpi-row strong{display:block;margin-top:3px;color:#fff;font-family:"Orbitron",sans-serif;font-size:27px;line-height:1;text-shadow:0 0 18px var(--row-accent)}.glass-kpi-row span{display:block;margin-top:6px;color:rgba(222,252,255,.7);font-size:9px}
      .glass-hud-gauge{width:74px;height:74px;overflow:visible;filter:drop-shadow(0 0 7px var(--gauge-accent)) drop-shadow(0 0 16px color-mix(in srgb,var(--gauge-accent),transparent 48%))}.gauge-shell{fill:rgba(4,19,31,.38);stroke:var(--gauge-accent);stroke-width:1.15;vector-effect:non-scaling-stroke}.gauge-track{fill:none;stroke:rgba(190,255,255,.2);stroke-width:2}.gauge-progress{fill:none;stroke:var(--gauge-accent);stroke-width:6;stroke-linecap:butt;transform:rotate(-90deg);transform-origin:46px 46px}.gauge-tick,.gauge-cross{stroke:rgba(210,255,255,.32);stroke-width:1.25;vector-effect:non-scaling-stroke}.gauge-tick.active,.gauge-cross{stroke:var(--gauge-accent);filter:drop-shadow(0 0 4px var(--gauge-accent))}.gauge-core{fill:var(--gauge-accent);filter:drop-shadow(0 0 7px var(--gauge-accent))}
      @keyframes cubeFacePulse{from{box-shadow:inset 0 0 20px color-mix(in srgb,var(--cube-accent),transparent 66%),0 0 18px color-mix(in srgb,var(--cube-accent),transparent 24%)}to{box-shadow:inset 0 0 34px color-mix(in srgb,var(--cube-accent),transparent 44%),0 0 38px color-mix(in srgb,var(--cube-accent),transparent 6%),0 0 100px color-mix(in srgb,var(--cube-accent),transparent 34%)}}
      @media (max-width: 820px){.glassdash-selected{left:20px;right:20px;text-align:left}.glass-kpi-panel{width:340px;padding:18px}.glass-kpi-head h2{font-size:20px}.glass-kpi-row{grid-template-columns:76px 1fr}.glass-hud-gauge{width:72px;height:72px}.cube-face-label{width:116px;height:70px}}
    `}</style>
  );
}
