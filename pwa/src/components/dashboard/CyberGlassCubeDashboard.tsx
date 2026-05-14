"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OrbitControls } from "@react-three/drei";
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
  scale: number;
};

type HudMetric = {
  label: string;
  value: string;
  sub: string;
  progress: number;
  accent: string;
};

const projects: ProjectCube[] = [
  { id: "p20", code: "CX", name: "CryoX", subtitle: "Low-temp AI robotics", status: "ACTIVE", accent: "#46f7ff", metric: "X78 F64 M76", lift: "+18", position: [-1.7, -0.16, 2.7], scale: 0.9 },
  { id: "p25", code: "KU", name: "KUTE", subtitle: "Venture ecosystem", status: "ACTIVE", accent: "#61ffb3", metric: "X68 F82 M81", lift: "+24", position: [0, 0.06, 3.18], scale: 1.1 },
  { id: "p06", code: "HZ", name: "Hydrogen Mobility", subtitle: "ZMP hydrogen route", status: "SALES", accent: "#ffad57", metric: "X46 F51 M61", lift: "+09", position: [1.72, -0.14, 2.74], scale: 0.9 },
  { id: "p21", code: "PT", name: "Plant Twin", subtitle: "Agri digital twin", status: "ACTIVE", accent: "#338cff", metric: "X59 F74 M69", lift: "+15", position: [-0.92, -0.72, 2.08], scale: 0.82 },
  { id: "p14", code: "SE", name: "Science Engine", subtitle: "Research scout", status: "DRAFT", accent: "#ffe15c", metric: "X39 F68 M47", lift: "+07", position: [0.96, -0.76, 2.12], scale: 0.78 },
  { id: "p29", code: "SX", name: "Supply X", subtitle: "Industrial protocol", status: "FROZEN", accent: "#c781ff", metric: "X31 F86 M36", lift: "+04", position: [0.02, -1.36, 1.55], scale: 0.78 },
];

const leftMetrics: HudMetric[] = [
  { label: "ACTIVE PJ", value: "14", sub: "+3 / 90D", progress: 78, accent: "#61ffb3" },
  { label: "TOTAL PJ", value: "29", sub: "SINCE FOUNDING", progress: 64, accent: "#46f7ff" },
  { label: "AVG ARC", value: "11.6M", sub: "PROJECT DURATION", progress: 58, accent: "#ffad57" },
];

const rightMetrics: HudMetric[] = [
  { label: "RAISED", value: "8.4B", sub: "JPY PIPELINE", progress: 84, accent: "#ffad57" },
  { label: "SCORE LIFT", value: "+29", sub: "AMD DELTA", progress: 69, accent: "#61ffb3" },
  { label: "MS CLEAR", value: "68%", sub: "MILESTONE HIT", progress: 68, accent: "#c781ff" },
];

export default function CyberGlassCubeDashboard() {
  const [selectedId, setSelectedId] = useState("p25");
  const selected = projects.find((project) => project.id === selectedId) ?? projects[1];

  return (
    <main className="glassdash-page">
      <Canvas
        dpr={[1, 1.35]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ position: [0, -7.8, 4.15], fov: 43, near: 0.1, far: 55 }}
        onPointerMissed={() => setSelectedId("p25")}
      >
        <GlassCubeWorld selected={selected} onSelect={setSelectedId} />
      </Canvas>
      <style jsx global>{`
        .glassdash-page{position:fixed;inset:0;z-index:30;overflow:hidden;background:#020816}
        .glassdash-page canvas{display:block;width:100%;height:100%}
      `}</style>
    </main>
  );
}

function GlassCubeWorld({ selected, onSelect }: { selected: ProjectCube; onSelect: (id: string) => void }) {
  const { camera } = useThree();
  const rootRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Group>(null);
  const backgroundTexture = useMemo(() => createReferenceLikeBackdropTexture(), []);
  const titleTexture = useMemo(() => createTitleTexture(), []);
  const selectedTexture = useMemo(() => createSelectedTexture(selected), [selected]);

  useEffect(() => {
    camera.up.set(0, 0, 1);
    camera.position.set(0, -7.8, 4.15);
    camera.lookAt(0, -0.1, 1.95);
  }, [camera]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (rootRef.current) rootRef.current.position.z = Math.sin(t * 0.5) * 0.02;
    if (scanRef.current) scanRef.current.rotation.z = t * 0.12;
  });

  return (
    <>
      <color attach="background" args={["#020816"]} />
      <fog attach="fog" args={["#04172a", 8, 27]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, -0.8, 1.3]} color="#4ff7ff" intensity={8} distance={9} decay={1.8} />
      <pointLight position={[0, -2.4, 3.6]} color="#ffffff" intensity={2.4} distance={9} decay={1.8} />
      <pointLight position={[-3.5, -0.2, 3.4]} color="#46f7ff" intensity={2.5} distance={9} decay={1.8} />
      <pointLight position={[3.4, -0.15, 3.3]} color="#338cff" intensity={2.2} distance={9} decay={1.8} />
      <OrbitControls
        target={[0, -0.1, 1.95]}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        enableZoom
        minDistance={6}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2.08}
        rotateSpeed={0.28}
        zoomSpeed={0.42}
        autoRotate={false}
      />
      <mesh position={[0, 5.0, 3.35]} rotation={[Math.PI / 2, 0, 0]} renderOrder={-10}>
        <planeGeometry args={[15.8, 7.1]} />
        <meshBasicMaterial map={backgroundTexture} transparent opacity={0.96} depthWrite={false} />
      </mesh>
      <mesh position={[-4.2, -1.95, 5.0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={40}>
        <planeGeometry args={[3.65, 0.78]} />
        <meshBasicMaterial map={titleTexture} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group ref={rootRef}>
        <FloorPortal />
        <group ref={scanRef}>
          <FloorScanArcs />
        </group>
        <HudPanel side="left" position={[-3.62, -0.4, 2.66]} title="STUDIO CORE KPI" subtitle="OPERATING HEALTH" metrics={leftMetrics} />
        <HudPanel side="right" position={[3.62, -0.4, 2.66]} title="AMD VALUE PROOF" subtitle="INTERVENTION DELTA" metrics={rightMetrics} />
        <ProjectCubes selectedId={selected.id} onSelect={onSelect} />
        <SelectionBeams project={selected} />
        <mesh position={[2.55, -2.0, 0.92]} rotation={[Math.PI / 2, 0, 0]} renderOrder={32}>
          <planeGeometry args={[2.95, 0.64]} />
          <meshBasicMaterial map={selectedTexture} transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}

function ProjectCubes({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const cubeRotation: [number, number, number] = [0.58, 0.68, -0.16];
  const glassTexture = useMemo(() => createGlassTexture(), []);
  const labelTextures = useMemo(() => new Map(projects.map((project) => [project.id, createCubeLabelTexture(project)])), []);

  return (
    <group>
      {projects.map((project, index) => (
        <GlassCube
          key={project.id}
          project={project}
          index={index}
          selected={selectedId === project.id}
          rotation={cubeRotation}
          glassTexture={glassTexture}
          labelTexture={labelTextures.get(project.id) ?? glassTexture}
          onSelect={() => onSelect(project.id)}
        />
      ))}
    </group>
  );
}

function GlassCube({
  project,
  index,
  selected,
  rotation,
  glassTexture,
  labelTexture,
  onSelect,
}: {
  project: ProjectCube;
  index: number;
  selected: boolean;
  rotation: [number, number, number];
  glassTexture: THREE.Texture;
  labelTexture: THREE.Texture;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const edgeGeometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1), 18), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index * 0.5;
    if (!groupRef.current) return;
    groupRef.current.position.z = project.position[2] + Math.sin(t * 0.9) * 0.08;
    groupRef.current.rotation.x = rotation[0] + Math.sin(t * 0.25) * 0.025;
    groupRef.current.rotation.y = rotation[1] + Math.sin(t * 0.2) * 0.018;
    groupRef.current.rotation.z = rotation[2] + Math.cos(t * 0.18) * 0.018;
    groupRef.current.scale.setScalar(project.scale * (selected ? 1.12 : 1));
  });

  return (
    <group ref={groupRef} position={project.position} rotation={rotation}>
      <pointLight color={project.accent} intensity={selected ? 3.5 : 1.35} distance={4.2} decay={1.7} />
      <mesh
        renderOrder={15}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color={project.accent}
          map={glassTexture}
          transparent
          opacity={selected ? 0.56 : 0.42}
          roughness={0.04}
          metalness={0.05}
          transmission={0.62}
          thickness={0.8}
          ior={1.65}
          reflectivity={0.82}
          emissive={project.accent}
          emissiveIntensity={selected ? 0.22 : 0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -0.506, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={18}>
        <planeGeometry args={[0.82, 0.82]} />
        <meshBasicMaterial map={labelTexture} transparent opacity={0.98} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edgeGeometry} renderOrder={19}>
        <lineBasicMaterial color={selected ? "#f4ffff" : project.accent} transparent opacity={selected ? 0.96 : 0.58} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

function FloorPortal() {
  const circuitGeometry = useMemo(() => {
    const vertices: number[] = [];
    const makeCircuit = (angle: number, inner: number, mid: number, outer: number, bend: number) => {
      const p1 = new THREE.Vector3(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.58, 0.046);
      const p2 = new THREE.Vector3(Math.cos(angle) * mid, Math.sin(angle) * mid * 0.58, 0.046);
      const p3 = new THREE.Vector3(p2.x + Math.cos(angle + Math.PI / 2) * bend, p2.y + Math.sin(angle + Math.PI / 2) * bend * 0.58, 0.046);
      const p4 = new THREE.Vector3(Math.cos(angle) * outer + Math.cos(angle + Math.PI / 2) * bend, Math.sin(angle) * outer * 0.58 + Math.sin(angle + Math.PI / 2) * bend * 0.58, 0.046);
      vertices.push(...p1.toArray(), ...p2.toArray(), ...p2.toArray(), ...p3.toArray(), ...p3.toArray(), ...p4.toArray());
    };
    [
      [-2.72, 1.56, 2.32, 4.2, -0.36],
      [-2.18, 1.48, 2.08, 3.6, 0.28],
      [-1.48, 1.34, 1.96, 3.75, -0.18],
      [-0.72, 1.24, 1.86, 3.35, 0.24],
      [0.74, 1.24, 1.86, 3.35, -0.24],
      [1.46, 1.34, 1.96, 3.75, 0.18],
      [2.16, 1.48, 2.08, 3.6, -0.28],
      [2.7, 1.56, 2.32, 4.2, 0.36],
    ].forEach(([angle, inner, mid, outer, bend]) => makeCircuit(angle, inner, mid, outer, bend));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);
  const nodePositions = useMemo(() => {
    return [-2.72, -2.18, -1.48, -0.72, 0.74, 1.46, 2.16, 2.7].map((angle) => [Math.cos(angle) * 3.55, Math.sin(angle) * 3.55 * 0.58, 0.07] as [number, number, number]);
  }, []);
  const ringTexture = useMemo(() => createPortalDiscTexture(), []);

  return (
    <group position={[0, -0.56, 0]}>
      <mesh position={[0, 0, 0.012]} renderOrder={1}>
        <circleGeometry args={[2.42, 160]} />
        <meshBasicMaterial map={ringTexture} transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <lineSegments geometry={circuitGeometry} renderOrder={2}>
        <lineBasicMaterial color="#86fbff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      {[0.74, 1.0, 1.28, 1.76].map((radius, index) => (
        <mesh key={radius} position={[0, 0, 0.025 + index * 0.003]} renderOrder={3}>
          <torusGeometry args={[radius, index === 0 ? 0.026 : 0.016, 8, 180]} />
          <meshBasicMaterial color={index % 2 ? "#2c8dff" : "#4df7ff"} transparent opacity={0.64 - index * 0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.03]} renderOrder={4}>
        <torusGeometry args={[2.36, 0.045, 10, 180, Math.PI * 1.82]} />
        <meshBasicMaterial color="#46f7ff" transparent opacity={0.62} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.037]} rotation={[0, 0, Math.PI * 0.65]} renderOrder={4}>
        <torusGeometry args={[2.02, 0.035, 10, 150, Math.PI * 1.22]} />
        <meshBasicMaterial color="#2c8dff" transparent opacity={0.58} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.06]} renderOrder={5}>
        <circleGeometry args={[0.86, 96]} />
        <meshBasicMaterial color="#86fbff" transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.09]} renderOrder={6}>
        <circleGeometry args={[0.48, 96]} />
        <meshBasicMaterial color="#f6ffff" transparent opacity={0.62} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight color="#f6ffff" intensity={7.5} distance={4.6} decay={1.6} position={[0, 0, 0.55]} />
      {nodePositions.map((position, index) => (
        <group key={index} position={position}>
          <mesh renderOrder={7}>
            <circleGeometry args={[0.075, 24]} />
            <meshBasicMaterial color={index % 2 ? "#46f7ff" : "#f6ffff"} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <pointLight color={index % 2 ? "#46f7ff" : "#f6ffff"} intensity={1.1} distance={1.2} decay={1.4} />
        </group>
      ))}
    </group>
  );
}

function FloorScanArcs() {
  return (
    <group position={[0, -0.56, 0.08]}>
      <mesh renderOrder={8}>
        <torusGeometry args={[3.15, 0.026, 8, 160, Math.PI * 0.72]} />
        <meshBasicMaterial color="#d8ffff" transparent opacity={0.48} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI * 0.46]} renderOrder={8}>
        <torusGeometry args={[2.72, 0.022, 8, 140, Math.PI * 0.54]} />
        <meshBasicMaterial color="#2c8dff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI * 1.18]} renderOrder={8}>
        <torusGeometry args={[2.38, 0.018, 8, 120, Math.PI * 0.64]} />
        <meshBasicMaterial color="#61ffb3" transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HudPanel({ side, position, title, subtitle, metrics }: { side: "left" | "right"; position: [number, number, number]; title: string; subtitle: string; metrics: HudMetric[] }) {
  const panelTexture = useMemo(() => createHudPanelTexture({ title, subtitle, metrics, side }), [title, subtitle, metrics, side]);
  const width = 2.7;
  const height = 2.22;
  const frame = useMemo(() => createHudFrameGeometry(width, height, side), [side]);
  const detail = useMemo(() => createHudDetailGeometry(width, height, side), [side]);

  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh renderOrder={20}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={panelTexture} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <lineSegments geometry={frame} renderOrder={22}>
        <lineBasicMaterial color={side === "left" ? "#86fbff" : "#ffad57"} transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={detail} renderOrder={23}>
        <lineBasicMaterial color={side === "left" ? "#61ffb3" : "#86fbff"} transparent opacity={0.58} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      {metrics.map((metric, index) => (
        <HudRing key={metric.label} metric={metric} position={[side === "left" ? -0.93 : 0.93, 0.018, 0.64 - index * 0.64]} />
      ))}
    </group>
  );
}

function HudRing({ metric, position }: { metric: HudMetric; position: [number, number, number] }) {
  const arc = Math.PI * 2 * (metric.progress / 100);
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]} renderOrder={30}>
      <mesh renderOrder={30}>
        <torusGeometry args={[0.18, 0.006, 8, 72]} />
        <meshBasicMaterial color="#bdfdff" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 2]} renderOrder={31}>
        <torusGeometry args={[0.2, 0.016, 8, 96, arc]} />
        <meshBasicMaterial color={metric.accent} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh renderOrder={32}>
        <circleGeometry args={[0.06, 32]} />
        <meshBasicMaterial color={metric.accent} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SelectionBeams({ project }: { project: ProjectCube }) {
  const geometry = useMemo(() => {
    const [x, y, z] = project.position;
    const vertices = [
      x, y, 0.14, x, y, z - 0.58,
      x - 0.36, y, z - 0.34, -3.2, -0.4, 2.74,
      x + 0.36, y, z - 0.34, 3.2, -0.4, 2.74,
    ];
    const line = new THREE.BufferGeometry();
    line.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return line;
  }, [project]);

  return (
    <lineSegments geometry={geometry} renderOrder={34}>
      <lineBasicMaterial color={project.accent} transparent opacity={0.66} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
    </lineSegments>
  );
}

function createHudFrameGeometry(width: number, height: number, side: "left" | "right") {
  const notch = 0.26;
  const left = -width / 2;
  const right = width / 2;
  const top = height / 2;
  const bottom = -height / 2;
  const points: [number, number, number][] = [
    [left, 0, top - notch],
    [left + notch, 0, top],
    [right - notch * 0.75, 0, top],
    [right, 0, top - notch],
    [right, 0, bottom + notch],
    [right - notch, 0, bottom],
    [left + notch * 0.8, 0, bottom],
    [left, 0, bottom + notch],
  ];
  if (side === "right") points.reverse();
  const vertices: number[] = [];
  points.forEach((point, index) => vertices.push(...point, ...points[(index + 1) % points.length]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function createHudDetailGeometry(width: number, height: number, side: "left" | "right") {
  const vertices: number[] = [];
  const left = -width / 2 + 0.22;
  const right = width / 2 - 0.22;
  const sign = side === "left" ? 1 : -1;
  for (let i = 0; i < 6; i += 1) {
    const z = height / 2 - 0.42 - i * 0.36;
    vertices.push(left, 0.01, z, right - (i % 2) * 0.34 * sign, 0.01, z);
  }
  vertices.push(left, 0.012, -height / 2 + 0.18, right, 0.012, -height / 2 + 0.18);
  vertices.push(sign * 0.5, 0.012, height / 2 + 0.14, sign * 1.65, 0.012, height / 2 + 0.42);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function createTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (typeof document === "undefined") return createFallbackTexture([10, 40, 70, 255]);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return createFallbackTexture([10, 40, 70, 255]);
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createFallbackTexture(color: [number, number, number, number]) {
  const texture = new THREE.DataTexture(new Uint8Array(color), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function createReferenceLikeBackdropTexture() {
  return createTexture(1800, 900, (ctx) => {
    const gradient = ctx.createRadialGradient(900, 610, 40, 900, 490, 820);
    gradient.addColorStop(0, "#0ea7e7");
    gradient.addColorStop(0.16, "#0c5f9d");
    gradient.addColorStop(0.5, "#062346");
    gradient.addColorStop(1, "#010713");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1800, 900);

    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(77,247,255,0.26)";
    ctx.lineWidth = 3;
    const drawCircuit = (x: number, y: number, flip = 1) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 210 * flip, y);
      ctx.lineTo(x + 270 * flip, y + 48);
      ctx.lineTo(x + 420 * flip, y + 48);
      ctx.stroke();
      ctx.fillStyle = "rgba(105,255,255,0.65)";
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillRect(x + 420 * flip - 8, y + 40, 16, 16);
    };
    drawCircuit(140, 180, 1);
    drawCircuit(1480, 142, -1);
    drawCircuit(260, 600, 1);
    drawCircuit(1550, 610, -1);

    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(380 + i * 74, 92, 28 + i * 2, 0, Math.PI * 1.7);
      ctx.strokeStyle = i % 2 ? "rgba(55,150,255,0.42)" : "rgba(75,247,255,0.58)";
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(55,150,255,0.22)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 40; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 690 + i * 10);
      ctx.lineTo(1800, 760 + i * 5);
      ctx.stroke();
    }

    for (let i = 0; i < 210; i += 1) {
      const x = (i * 137) % 1800;
      const y = (i * 73) % 820;
      ctx.fillStyle = `rgba(120,235,255,${0.06 + (i % 5) * 0.025})`;
      ctx.fillRect(x, y, i % 6 === 0 ? 3 : 1, i % 7 === 0 ? 3 : 1);
    }
  });
}

function createPortalDiscTexture() {
  return createTexture(768, 768, (ctx) => {
    const cx = 384;
    const cy = 384;
    ctx.clearRect(0, 0, 768, 768);
    const gradient = ctx.createRadialGradient(cx, cy, 16, cx, cy, 360);
    gradient.addColorStop(0, "rgba(245,255,255,0.92)");
    gradient.addColorStop(0.15, "rgba(78,247,255,0.7)");
    gradient.addColorStop(0.45, "rgba(36,140,255,0.26)");
    gradient.addColorStop(1, "rgba(36,140,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, 360, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(165,255,255,0.72)";
    for (let i = 0; i < 9; i += 1) {
      ctx.lineWidth = i % 2 ? 3 : 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 70 + i * 31, i * 0.22, Math.PI * 2 - i * 0.18);
      ctx.stroke();
    }
  });
}

function createGlassTexture() {
  return createTexture(512, 512, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, "rgba(255,95,145,0.88)");
    gradient.addColorStop(0.26, "rgba(52,235,255,0.72)");
    gradient.addColorStop(0.52, "rgba(5,24,56,0.72)");
    gradient.addColorStop(0.76, "rgba(255,116,102,0.8)");
    gradient.addColorStop(1, "rgba(255,217,82,0.82)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 16; i += 1) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.12)" : "rgba(66,247,255,0.12)";
      ctx.fillRect((i * 61) % 512, (i * 97) % 512, 34 + (i % 4) * 18, 96 + (i % 3) * 32);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 80 + i * 64);
      ctx.lineTo(512, 12 + i * 76);
      ctx.stroke();
    }
  });
}

function createCubeLabelTexture(project: ProjectCube) {
  return createTexture(512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, hexToRgba(project.accent, 0.55));
    gradient.addColorStop(0.6, "rgba(0,12,28,0.52)");
    gradient.addColorStop(1, "rgba(255,255,255,0.12)");
    ctx.fillStyle = gradient;
    ctx.fillRect(34, 44, 444, 424);
    ctx.strokeStyle = hexToRgba(project.accent, 0.95);
    ctx.lineWidth = 7;
    ctx.strokeRect(34, 44, 444, 424);
    ctx.fillStyle = "#f6ffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 92px Orbitron, Arial";
    ctx.shadowColor = project.accent;
    ctx.shadowBlur = 22;
    ctx.fillText(project.code, 256, 198);
    ctx.font = "700 38px Arial";
    ctx.fillText(project.name, 256, 282);
    ctx.font = "500 24px Arial";
    ctx.fillStyle = "rgba(230,255,255,0.82)";
    ctx.fillText(project.metric, 256, 342);
  });
}

function createHudPanelTexture({ title, subtitle, metrics, side }: { title: string; subtitle: string; metrics: HudMetric[]; side: "left" | "right" }) {
  return createTexture(900, 720, (ctx) => {
    ctx.clearRect(0, 0, 900, 720);
    const alignRight = side === "right";
    const gradient = ctx.createLinearGradient(alignRight ? 900 : 0, 0, alignRight ? 0 : 900, 0);
    gradient.addColorStop(0, side === "left" ? "rgba(70,247,255,0.18)" : "rgba(255,173,87,0.2)");
    gradient.addColorStop(0.55, "rgba(2,18,34,0.52)");
    gradient.addColorStop(1, "rgba(2,18,34,0.1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 900, 720);
    ctx.textAlign = alignRight ? "right" : "left";
    ctx.fillStyle = "rgba(205,255,255,0.72)";
    ctx.font = "800 26px Arial";
    ctx.fillText(subtitle, alignRight ? 810 : 90, 90);
    ctx.fillStyle = "#f4ffff";
    ctx.font = "800 58px Orbitron, Arial";
    ctx.shadowColor = side === "left" ? "#46f7ff" : "#ffad57";
    ctx.shadowBlur = 18;
    ctx.fillText(title, alignRight ? 810 : 90, 148);
    ctx.shadowBlur = 0;
    metrics.forEach((metric, index) => {
      const y = 252 + index * 150;
      ctx.strokeStyle = hexToRgba(metric.accent, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(alignRight ? 120 : 260, y - 55);
      ctx.lineTo(alignRight ? 640 : 780, y - 55);
      ctx.lineTo(alignRight ? 720 : 850, y - 30);
      ctx.stroke();
      ctx.fillStyle = "rgba(210,255,255,0.7)";
      ctx.font = "800 24px Arial";
      ctx.fillText(metric.label, alignRight ? 600 : 300, y - 14);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 64px Orbitron, Arial";
      ctx.shadowColor = metric.accent;
      ctx.shadowBlur = 18;
      ctx.fillText(metric.value, alignRight ? 600 : 300, y + 44);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(220,255,255,0.72)";
      ctx.font = "600 20px Arial";
      ctx.fillText(metric.sub, alignRight ? 600 : 300, y + 88);
    });
  });
}

function createTitleTexture() {
  return createTexture(760, 180, (ctx) => {
    ctx.clearRect(0, 0, 760, 180);
    ctx.fillStyle = "#f4ffff";
    ctx.font = "800 72px Orbitron, Arial";
    ctx.shadowColor = "#46f7ff";
    ctx.shadowBlur = 24;
    ctx.fillText("AMD // OS", 22, 88);
    ctx.fillStyle = "#9ffbff";
    ctx.font = "800 24px Arial";
    ctx.fillText("HOLOGRAPHIC PORTFOLIO CHAMBER V2", 26, 132);
  });
}

function createSelectedTexture(project: ProjectCube) {
  return createTexture(760, 180, (ctx) => {
    ctx.clearRect(0, 0, 760, 180);
    ctx.strokeStyle = hexToRgba(project.accent, 0.65);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(760, 22);
    ctx.moveTo(0, 152);
    ctx.lineTo(760, 152);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(190,255,255,0.72)";
    ctx.font = "800 22px Arial";
    ctx.fillText("SELECTED CUBE", 700, 64);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 54px Orbitron, Arial";
    ctx.shadowColor = project.accent;
    ctx.shadowBlur = 20;
    ctx.fillText(project.name, 700, 118);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(220,255,255,0.75)";
    ctx.font = "600 18px Arial";
    ctx.fillText(`${project.metric} / VALUE LIFT ${project.lift}`, 700, 146);
  });
}

function hexToRgba(hex: string, alpha: number) {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
