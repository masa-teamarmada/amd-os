"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Cpu, Network, ShieldCheck, TerminalSquare } from "lucide-react";
import * as THREE from "three";

type Project = {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  status: string;
  accent: string;
  signal: string;
  score: string;
  field: string;
  phase: string;
  next: string;
  log: string[];
};

const projects: Project[] = [
  { id: "p20", code: "CX", name: "CryoX", subtitle: "低温AIロボティクス", status: "ACTIVE", accent: "#46f7ff", signal: "94%", score: "78", field: "8.4M", phase: "MS-3 / Demo Integration", next: "Review / Decide", log: ["Slack sync", "Drive scan", "Calendar pulse"] },
  { id: "p25", code: "KU", name: "KUTE", subtitle: "工学院大エコシステム", status: "ACTIVE", accent: "#56ff9c", signal: "88%", score: "81", field: "11.0M", phase: "MS-1 / Partner Mesh", next: "Spec cockpit", log: ["Lab map", "Budget lane", "MS design"] },
  { id: "p06", code: "HZ", name: "Hydrogen Mobility", subtitle: "ZMP / 水素モビリティ", status: "SALES", accent: "#ff9b42", signal: "71%", score: "62", field: "3.2M", phase: "Pitch / URA bridge", next: "Route proposal", log: ["Messenger", "産連 contact", "Unit econ"] },
  { id: "p21", code: "PT", name: "Plant Twin", subtitle: "香川大デジタルツイン", status: "ACTIVE", accent: "#2d9cff", signal: "83%", score: "70", field: "6.6M", phase: "Value model", next: "Data business", log: ["MEMS", "Cultivation", "Forecast"] },
  { id: "p14", code: "SE", name: "Science Engine", subtitle: "研究探索エージェント", status: "DRAFT", accent: "#ffd84c", signal: "59%", score: "46", field: "2.1M", phase: "Seed cluster", next: "Lane scoring", log: ["Papers", "KAKEN", "Themes"] },
  { id: "p29", code: "SX", name: "Supply X", subtitle: "産業供給網プロトコル", status: "FROZEN", accent: "#c46cff", signal: "42%", score: "38", field: "1.8M", phase: "Archive scan", next: "Hold", log: ["Risk", "Partner", "Market"] },
];

const panelSlots = [
  { x: -8.1, y: 5, z: 1.55, w: 3.55, h: 1.16 },
  { x: -5.35, y: 9, z: 2.45, w: 3.3, h: 1.1 },
  { x: -7.25, y: 7, z: 1.1, w: 3.75, h: 1.22 },
  { x: -1.45, y: 11, z: 2.05, w: 4.05, h: 1.18 },
  { x: -3.95, y: 13, z: 1.36, w: 3.45, h: 1.12 },
  { x: 6.45, y: 15, z: 2.28, w: 3.3, h: 1.1 },
];

const auxSlots = {
  visualizer: { x: 0.7, y: 10, z: 1.56, w: 6.35, h: 2.45 },
  monitor: { x: 7.55, y: 12, z: 2.4, w: 3.75, h: 1.18 },
  alert: { x: 7.75, y: 14, z: 1.55, w: 3.75, h: 1.14 },
  user: { x: 7.95, y: 16, z: 0.82, w: 3.75, h: 1.08 },
};

export default function Cyber3DLab() {
  const [selected, setSelected] = useState<Project | null>(null);

  function selectProject(project: Project | null) {
    setSelected((current) => {
      if (!project) return null;
      return current?.id === project.id ? null : project;
    });
  }

  return (
    <main className="cyber3d-page">
      <div className="cyber3d-canvas" aria-hidden="true">
        <Canvas
          dpr={[1, 1.25]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, -12.5, 4.8], fov: 48, near: 0.1, far: 90 }}
          onPointerMissed={() => selectProject(null)}
        >
          <CyberWorld selectedId={selected?.id ?? null} onProjectSelect={selectProject} />
        </Canvas>
      </div>
      <section className="cyber3d-shell">
        <header className="cyber3d-header">
          <div className="cyber3d-brand-mark">
            <Image src="/amd-logo.png" alt="AMD" width={96} height={96} priority />
          </div>
          <div>
            <p>AMD // OS</p>
            <span>CYBERNETIC STUDIO COCKPIT V3.1</span>
          </div>
        </header>
        <div className="cyber3d-status">SYS_STATUS: <strong>OPTIMAL</strong></div>
        <div className="cyber3d-docking-line" aria-hidden="true"><span>GRIDLINE Y-03 / CONTENT DOCK</span></div>
      </section>
      <CyberStyles />
    </main>
  );
}

function CyberWorld({ selectedId, onProjectSelect }: { selectedId: string | null; onProjectSelect: (project: Project | null) => void }) {
  const rootRef = useRef<THREE.Group>(null);
  const laserRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);
  const selectedIdRef = useRef<string | null>(null);
  const focusUntilRef = useRef(0);
  const { camera } = useThree();
  const selectedIndex = selectedId ? projects.findIndex((project) => project.id === selectedId) : -1;
  const selectedSlot = selectedIndex >= 0 ? panelSlots[selectedIndex] : null;

  useEffect(() => {
    camera.up.set(0, 0, 1);
    camera.position.set(0, -12.5, 4.8);
    camera.lookAt(0, 9, 1.4);
  }, [camera]);

  const gridGeometry = useMemo(() => {
    const vertices: number[] = [];
    for (let y = -6; y <= 52; y += 1) vertices.push(-24, y, 0, 24, y, 0);
    for (let x = -24; x <= 24; x += 1) vertices.push(x, -6, 0, x, 52, 0);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);

  const laneGeometry = useMemo(() => {
    const vertices: number[] = [];
    const lanes = [...panelSlots.map((slot) => slot.y), auxSlots.visualizer.y, auxSlots.monitor.y, auxSlots.alert.y, auxSlots.user.y];
    for (const y of lanes) vertices.push(-18, y, 0.018, 18, y, 0.018);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);

  const cityGeometry = useMemo(() => {
    const vertices: number[] = [];
    for (const [x, y, w, h] of [[-14, 7, 1.8, 4.2], [-10, 11, 2.4, 6.4], [-6, 8.5, 1.7, 3.7], [-2, 14, 2.8, 7.4], [3, 10, 2.2, 5.6], [8, 13, 3.2, 8.2], [13, 9, 2.4, 5.3]]) {
      const left = x - w / 2, right = x + w / 2, z0 = 0, z1 = h;
      vertices.push(left, y, z0, right, y, z0, right, y, z0, right, y, z1, right, y, z1, left, y, z1, left, y, z1, left, y, z0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);

  const panelGeometry = useMemo(() => {
    const vertices: number[] = [];
    for (const { x, y, z, w, h } of [...panelSlots, auxSlots.visualizer, auxSlots.monitor, auxSlots.alert, auxSlots.user]) {
      const left = x - w / 2, right = x + w / 2, bottom = z - h / 2, top = z + h / 2;
      vertices.push(left, y, bottom, right, y, bottom, right, y, bottom, right, y, top, right, y, top, left, y, top, left, y, top, left, y, bottom);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);

  const starGeometry = useMemo(() => {
    const vertices: number[] = [];
    for (let i = 0; i < 260; i += 1) vertices.push(((i * 37) % 420) / 10 - 21, ((i * 61) % 560) / 10 - 4, ((i * 43) % 78) / 10 + 0.5);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (selectedIdRef.current !== selectedId) {
      selectedIdRef.current = selectedId;
      focusUntilRef.current = t + 1.35;
    }
    if (controlsRef.current && t < focusUntilRef.current) {
      const focus = selectedSlot ? new THREE.Vector3(selectedSlot.x, selectedSlot.y, selectedSlot.z) : new THREE.Vector3(0, 9, 1.4);
      const desired = selectedSlot ? new THREE.Vector3(selectedSlot.x * 0.72, selectedSlot.y - 12.8, selectedSlot.z + 3.3) : new THREE.Vector3(0, -12.5, 4.8);
      camera.position.lerp(desired, 0.075);
      controlsRef.current.target.lerp(focus, 0.095);
      controlsRef.current.update();
    }
    if (rootRef.current) rootRef.current.position.z = Math.sin(t * 0.8) * 0.03;
    if (laserRef.current) {
      laserRef.current.position.y = ((t * 10) % 24) - 2;
      laserRef.current.visible = (t % 2.7) < 0.92;
    }
  });

  return (
    <>
      <fog attach="fog" args={["#02070b", 8, 34]} />
      <OrbitControls
        ref={controlsRef}
        target={[0, 9, 1.4]}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        enableZoom
        rotateSpeed={0.55}
        zoomSpeed={0.75}
        minDistance={4.2}
        maxDistance={28}
        maxPolarAngle={Math.PI / 2.04}
        autoRotate={false}
      />
      <group ref={rootRef}>
        <lineSegments geometry={gridGeometry}><lineBasicMaterial color="#4ff7ff" transparent opacity={0.46} blending={THREE.AdditiveBlending} /></lineSegments>
        <lineSegments geometry={laneGeometry}><lineBasicMaterial color="#9fffff" transparent opacity={0.86} blending={THREE.AdditiveBlending} /></lineSegments>
        <lineSegments geometry={cityGeometry}><lineBasicMaterial color="#35e6ff" transparent opacity={0.28} blending={THREE.AdditiveBlending} /></lineSegments>
        <lineSegments geometry={panelGeometry}><lineBasicMaterial color="#8afcff" transparent opacity={0.72} blending={THREE.AdditiveBlending} /></lineSegments>
        <points geometry={starGeometry}><pointsMaterial color="#58f8ff" size={0.035} transparent opacity={0.68} blending={THREE.AdditiveBlending} depthWrite={false} /></points>
        <group ref={laserRef}>
          <mesh position={[0, 0, 0.025]}><planeGeometry args={[34, 0.035]} /><meshBasicMaterial color="#82ffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
          <mesh position={[0, 0, 0.09]}><planeGeometry args={[22, 0.12]} /><meshBasicMaterial color="#ffad55" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
        </group>
        {projects.map((project, index) => {
          const slot = panelSlots[index];
          return (
            <group key={project.id} position={[slot.x, slot.y - 0.015, slot.z]} rotation={[Math.PI / 2, 0, 0]}>
              <Html transform center distanceFactor={4.4} zIndexRange={[40, 0]} style={{ width: `${slot.w * 128}px`, pointerEvents: "auto" }}>
                <ProjectCard project={project} index={index} selectedId={selectedId} onSelect={onProjectSelect} />
              </Html>
            </group>
          );
        })}
        <HtmlFrame position={[auxSlots.visualizer.x, auxSlots.visualizer.y - 0.015, auxSlots.visualizer.z]} width={auxSlots.visualizer.w * 124}><VisualizerPanel /></HtmlFrame>
        <HtmlFrame position={[auxSlots.monitor.x, auxSlots.monitor.y - 0.015, auxSlots.monitor.z]} width={auxSlots.monitor.w * 104}><MetricFrame title="SYS MONITOR" rows={["CPU 67", "MEM 82", "NET 94"]} /></HtmlFrame>
        <HtmlFrame position={[auxSlots.alert.x, auxSlots.alert.y - 0.015, auxSlots.alert.z]} width={auxSlots.alert.w * 104}><MetricFrame title="ALERT_LOG" rows={["Unauthorized: none", "Network sync active", "PWA lab route armed"]} warn /></HtmlFrame>
        <HtmlFrame position={[auxSlots.user.x, auxSlots.user.y - 0.015, auxSlots.user.z]} width={auxSlots.user.w * 104}><MetricFrame title="USER_INFO" rows={["PROFILE", "ADMINISTRATOR", "AUTHENTICATED"]} /></HtmlFrame>
        {selectedSlot && (
          <HtmlFrame position={[selectedSlot.x + 2.5, selectedSlot.y - 1, Math.max(selectedSlot.z + 0.28, 1.35)]} width={560} className="cockpit-html-frame">
            <CockpitWindow project={projects[selectedIndex]} />
          </HtmlFrame>
        )}
      </group>
    </>
  );
}

function ProjectCard({ project, index, selectedId, onSelect }: { project: Project; index: number; selectedId: string | null; onSelect: (project: Project | null) => void }) {
  const icon = index % 3 === 0 ? <Cpu size={22} /> : index % 3 === 1 ? <Network size={22} /> : <ShieldCheck size={22} />;
  const style = { "--accent": project.accent, "--z-index": index } as CSSProperties;

  return (
    <button
      className={`cyber3d-project-card ${selectedId === project.id ? "focused-card" : ""}`}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        event.currentTarget.blur();
        onSelect(project);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      type="button"
    >
      <div className="card-row">
        <div className="card-code">{project.code}</div>
        <div>
          <div className="card-meta">{icon}<span>{project.id.toUpperCase()}</span><span>/</span><span>{project.status}</span></div>
          <h2 className="card-name">{project.name}</h2>
          <p className="card-subtitle">{project.subtitle}</p>
        </div>
      </div>
    </button>
  );
}

function HtmlFrame({ position, width, children, className = "" }: { position: [number, number, number]; width: number; children: ReactNode; className?: string }) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <Html transform center distanceFactor={4.4} zIndexRange={[30, 0]} className={className} style={{ width: `${width}px`, pointerEvents: "auto" }}>
        {children}
      </Html>
    </group>
  );
}

function MetricFrame({ title, rows, warn = false }: { title: string; rows: string[]; warn?: boolean }) {
  return (
    <section className={`cyber3d-frame metric-frame ${warn ? "warn" : ""}`}>
      <h2>{title}</h2>
      {rows.map((row) => <p key={row}>{row}</p>)}
    </section>
  );
}

function VisualizerPanel() {
  return (
    <section className="cyber3d-frame cyber3d-visualizer">
      <div className="frame-title">
        <span>REAL-TIME VISUALIZER</span>
        <small>Y-LINE 03 / ACTIVE PROJECT ORBIT</small>
      </div>
      <div className="visual-core">
        <div className="core-orb"><span /><i /></div>
        <div className="scan-label scan-label-a">DATA CORE</div>
        <div className="scan-label scan-label-b">DATA SCORE</div>
        <div className="scan-label scan-label-c">PROJECT MASS</div>
      </div>
      <div className="console-strip"><TerminalSquare size={18} /><span>AETHER::CONSOLE&gt;</span><b>waiting_for_input...</b></div>
    </section>
  );
}

function CockpitWindow({ project }: { project: Project }) {
  const style = { "--accent": project.accent } as CSSProperties;
  return (
    <section className="cyber3d-frame cockpit-window" style={style} onPointerDown={(event) => event.stopPropagation()}>
      <div className="cockpit-topline"><span>{project.id.toUpperCase()} // COCKPIT</span><b>{project.status}</b></div>
      <div className="cockpit-head">
        <div className="card-code">{project.code}</div>
        <div>
          <h2>{project.name}</h2>
          <p>{project.subtitle}</p>
        </div>
      </div>
      <div className="cockpit-grid">
        <div><small>AMD SCORE</small><b>{project.score}</b></div>
        <div><small>SIGNAL</small><b>{project.signal}</b></div>
        <div><small>FIELD</small><b>{project.field}</b></div>
      </div>
      <div className="cockpit-brief">
        <span>CURRENT_LAYER</span><strong>{project.phase}</strong>
        <span>NEXT_VECTOR</span><strong>{project.next}</strong>
      </div>
    </section>
  );
}

function CyberStyles() {
  return (
    <style jsx global>{`
      @import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800&family=Share+Tech+Mono&display=swap");
      .cyber3d-page{--cyber-ice:#d8fbff;--cyber-cyan:#47f3ff;--cyber-amber:#ffac57;--cyber-green:#64ffb1;position:fixed;inset:0;z-index:30;overflow:hidden;color:var(--cyber-ice);background:radial-gradient(circle at 51% 44%,rgba(16,160,255,.18),transparent 23%),radial-gradient(circle at 82% 67%,rgba(255,139,62,.13),transparent 25%),linear-gradient(180deg,#02060b 0%,#02070b 46%,#000204 100%);font-family:"Share Tech Mono",ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em}
      .cyber3d-canvas{position:absolute;inset:0;opacity:.98}.cyber3d-page:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(71,243,255,.04),transparent 14%,transparent 84%,rgba(71,243,255,.05)),repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px);mix-blend-mode:screen;opacity:.55}
      .cyber3d-shell{position:relative;z-index:2;min-height:100%;padding:clamp(20px,3vw,46px);pointer-events:none}.cyber3d-header{display:flex;align-items:center;gap:20px;width:fit-content;text-shadow:0 0 16px rgba(71,243,255,.75),0 0 38px rgba(20,135,255,.5)}.cyber3d-brand-mark{display:grid;place-items:center;width:clamp(74px,8vw,112px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(71,243,255,.22),rgba(20,135,255,.08) 58%,transparent 72%);filter:drop-shadow(0 0 18px rgba(71,243,255,.95)) drop-shadow(0 0 42px rgba(20,135,255,.7))}.cyber3d-brand-mark img{width:72%;height:auto;object-fit:contain;filter:drop-shadow(0 0 10px rgba(71,243,255,.95))}
      .cyber3d-header p{margin:0;font-family:"Orbitron",sans-serif;font-size:clamp(36px,5vw,68px);font-weight:800;line-height:.92;color:#f0feff}.cyber3d-header span{display:block;margin-top:10px;color:#9ff7ff;font-size:clamp(12px,1.3vw,18px);font-weight:800}.cyber3d-status{margin-top:clamp(22px,5vh,48px);font-size:clamp(18px,2.3vw,32px);font-weight:900;color:#dbfbff;text-shadow:0 0 15px rgba(216,251,255,.75)}.cyber3d-status strong{color:var(--cyber-green);text-shadow:0 0 16px rgba(100,255,177,.9),0 0 34px rgba(100,255,177,.5)}
      .cyber3d-docking-line{position:absolute;left:clamp(24px,5vw,84px);right:clamp(24px,5vw,84px);bottom:4.2vh;height:2px;z-index:3;background:linear-gradient(90deg,transparent,rgba(71,243,255,.96) 12%,rgba(255,172,87,.78) 50%,rgba(71,243,255,.96) 88%,transparent);box-shadow:0 0 18px rgba(71,243,255,.9),0 0 54px rgba(20,135,255,.48)}.cyber3d-docking-line span{position:absolute;right:0;bottom:9px;color:rgba(186,253,255,.72);font-size:11px;text-shadow:0 0 10px rgba(71,243,255,.9)}
      .cyber3d-project-card,.cyber3d-frame{position:relative;color:var(--cyber-ice);border:1px solid rgba(92,241,255,.72);background:linear-gradient(90deg,rgba(71,243,255,.16),rgba(4,16,28,.54) 44%,rgba(5,20,36,.32)),radial-gradient(circle at 12% 45%,color-mix(in srgb,var(--accent,#47f3ff),transparent 70%),transparent 30%);box-shadow:inset 0 0 22px rgba(71,243,255,.16),0 0 16px rgba(71,243,255,.42),0 0 42px rgba(20,135,255,.16);clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px));backdrop-filter:blur(14px) saturate(1.25)}
      .cyber3d-project-card:before,.cyber3d-frame:before{content:"";position:absolute;inset:-2px;pointer-events:none;border:2px solid color-mix(in srgb,var(--accent,#47f3ff),white 10%);clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px));opacity:.72;filter:drop-shadow(0 0 7px var(--accent,#47f3ff)) drop-shadow(0 0 18px var(--accent,#47f3ff))}
      .cyber3d-project-card{width:100%;min-height:76px;padding:10px 12px;appearance:none;cursor:pointer;text-align:left;pointer-events:auto;transition:filter 240ms ease,box-shadow 240ms ease,border-color 240ms ease}.cyber3d-project-card:hover{border-color:rgba(224,253,255,.96);filter:brightness(1.28) saturate(1.25);box-shadow:inset 0 0 28px color-mix(in srgb,var(--accent),transparent 68%),0 0 22px color-mix(in srgb,var(--accent),transparent 10%),0 0 70px color-mix(in srgb,var(--accent),transparent 38%)}.cyber3d-project-card.focused-card{border-color:#f3ffff;filter:brightness(1.52) saturate(1.45);box-shadow:inset 0 0 36px color-mix(in srgb,var(--accent),transparent 54%),0 0 30px color-mix(in srgb,var(--accent),white 8%),0 0 110px color-mix(in srgb,var(--accent),transparent 28%);animation:focusLock 920ms ease-out both}
      .card-row{display:flex;align-items:center;gap:10px}.card-code{display:grid;place-items:center;width:38px;aspect-ratio:1;background:color-mix(in srgb,var(--accent),transparent 72%);clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);color:#f4feff;font-family:"Orbitron",sans-serif;font-size:12px;font-weight:800;text-shadow:0 0 12px var(--accent)}.card-meta{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-bottom:4px;color:#b9faff;font-size:9px;font-weight:900}.card-name{margin:0;color:#fff;font-family:"Orbitron",sans-serif;font-size:clamp(14px,1.35vw,20px);line-height:1;text-shadow:0 0 15px var(--accent)}.card-subtitle{margin:6px 0 0;color:rgba(220,250,255,.78);font-size:11px}
      .cyber3d-visualizer{width:100%;height:300px;min-height:0;padding:clamp(16px,1.8vw,24px)}.frame-title span{display:block;font-family:"Orbitron",sans-serif;font-size:clamp(22px,2.25vw,36px);font-weight:800;color:#e3fdff;text-shadow:0 0 22px rgba(71,243,255,.82)}.frame-title small{display:block;margin-top:7px;color:rgba(155,246,255,.78);font-size:10px}.visual-core{position:relative;display:grid;place-items:center;height:178px}.core-orb{position:relative;width:min(16vw,170px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(71,243,255,.68);background:radial-gradient(circle,rgba(71,243,255,.2),transparent 35%),conic-gradient(from 30deg,rgba(71,243,255,.12),rgba(255,172,87,.4),rgba(100,255,177,.22),rgba(71,243,255,.12));box-shadow:inset 0 0 44px rgba(71,243,255,.22),0 0 46px rgba(71,243,255,.46);animation:coreSpin 12s linear infinite}.core-orb span,.core-orb i{position:absolute;inset:18%;border:2px solid rgba(255,172,87,.86);transform:rotate(24deg);box-shadow:0 0 24px rgba(255,172,87,.7)}.core-orb i{inset:28%;border-color:rgba(100,255,177,.9);transform:rotate(-18deg)}.scan-label{position:absolute;color:rgba(220,255,255,.86);font-size:10px;text-shadow:0 0 12px rgba(71,243,255,.8)}.scan-label-a{left:11%;top:55%}.scan-label-b{right:14%;top:28%}.scan-label-c{right:12%;bottom:20%}
      .console-strip{display:flex;align-items:center;gap:10px;border-top:1px solid rgba(71,243,255,.42);padding-top:10px;color:#dffcff;font-size:12px}.console-strip b{color:var(--cyber-amber);font-weight:900;text-shadow:0 0 12px rgba(255,172,87,.7)}.metric-frame{padding:12px 14px;min-height:84px}.metric-frame h2{margin:0 0 8px;font-family:"Orbitron",sans-serif;font-size:clamp(15px,1.55vw,22px);color:#dffcff;text-shadow:0 0 16px rgba(71,243,255,.85)}.metric-frame p{margin:5px 0;color:rgba(222,255,255,.88);font-size:12px}.metric-frame.warn p{color:#ffbf82;text-shadow:0 0 12px rgba(255,172,87,.45)}
      .cockpit-html-frame{animation:cockpitSummon 720ms cubic-bezier(.16,1,.24,1) both}.cockpit-window{--accent:#47f3ff;min-height:220px;padding:16px 18px;background:linear-gradient(90deg,color-mix(in srgb,var(--accent),transparent 80%),rgba(2,10,20,.66) 36%,rgba(6,18,36,.48)),radial-gradient(circle at 18% 58%,color-mix(in srgb,var(--accent),transparent 62%),transparent 34%);box-shadow:inset 0 0 36px color-mix(in srgb,var(--accent),transparent 72%),0 0 34px color-mix(in srgb,var(--accent),transparent 18%),0 0 120px color-mix(in srgb,var(--accent),transparent 48%)}.cockpit-topline{display:flex;justify-content:space-between;gap:14px;margin-bottom:12px;color:#b8fbff;font-size:10px;font-weight:900}.cockpit-topline b{color:var(--cyber-green);text-shadow:0 0 12px rgba(100,255,177,.85)}.cockpit-head{display:flex;align-items:center;gap:14px}.cockpit-head h2{margin:0;color:#fff;font-family:"Orbitron",sans-serif;font-size:31px;line-height:1;text-shadow:0 0 18px var(--accent)}.cockpit-head p{margin:7px 0 0;color:rgba(229,252,255,.78);font-size:13px}.cockpit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:18px}.cockpit-grid div,.cockpit-brief{border:1px solid color-mix(in srgb,var(--accent),transparent 58%);background:rgba(0,14,25,.62);box-shadow:inset 0 0 18px rgba(71,243,255,.12);padding:10px}.cockpit-grid small,.cockpit-brief span{display:block;color:rgba(206,253,255,.7);font-size:9px}.cockpit-grid b{display:block;margin-top:4px;color:#fff;font-family:"Orbitron",sans-serif;font-size:22px;text-shadow:0 0 12px var(--accent)}.cockpit-brief{display:grid;grid-template-columns:110px 1fr;gap:8px 12px;margin-top:10px;align-items:center}.cockpit-brief strong{color:#fff;font-size:13px;line-height:1.25;text-shadow:0 0 10px var(--accent)}
      @keyframes focusLock{0%{filter:brightness(1.1)}32%{filter:brightness(2.2) saturate(1.8)}58%{filter:brightness(1.18)}100%{filter:brightness(1.52) saturate(1.45)}}@keyframes coreSpin{to{transform:rotate(360deg)}}@keyframes cockpitSummon{0%{opacity:0;filter:brightness(2.2) blur(8px);transform:translateY(26px) scale(.92)}42%{opacity:1;filter:brightness(2.9) blur(1px);transform:translateY(-4px) scale(1.035)}100%{opacity:1;filter:brightness(1);transform:translateY(0) scale(1)}}
    `}</style>
  );
}
