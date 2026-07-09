"use client";

import { Canvas, useThree } from "@react-three/fiber";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { CockpitView } from "@/components/cockpit/CockpitView";
import { fetchCockpitFromSupabase, type CockpitData } from "@/lib/supabase-data";

type ProjectModule = {
  id: string;
  code: string;
  name: string;
  lane: string;
  status: string;
  score: string;
  lift: string;
  next: string;
  accent: string;
  progress: number;
  cockpit?: CockpitData;
  cockpitReady?: boolean;
};

type KpiModule = {
  label: string;
  value: string;
  sub: string;
  progress: number;
  accent: string;
};

type ViewMode = "overview" | "project";
type FocusDock = "status" | "ms" | "monthly" | "actions" | "ops";

type RailPanelProps = {
  children: ReactNode;
  position: [number, number, number];
  scale?: number;
};

const projects: ProjectModule[] = [
  {
    id: "p20",
    code: "CX",
    name: "CryoX",
    lane: "LOW TEMP AI ROBOTICS",
    status: "ACTIVE",
    score: "X78 F64 M76",
    lift: "+18",
    next: "Founder decision checkpoint",
    accent: "#46f7ff",
    progress: 78,
  },
  {
    id: "p25",
    code: "KU",
    name: "KUTE",
    lane: "VENTURE ECOSYSTEM",
    status: "ACTIVE",
    score: "X68 F82 M81",
    lift: "+24",
    next: "MS contract proof",
    accent: "#61ffb3",
    progress: 82,
  },
  {
    id: "p06",
    code: "HZ",
    name: "Hydrogen Mobility",
    lane: "INDUSTRIAL MOBILITY",
    status: "SALES",
    score: "X46 F51 M61",
    lift: "+09",
    next: "University route design",
    accent: "#ffad57",
    progress: 58,
  },
  {
    id: "p21",
    code: "PT",
    name: "Plant Twin",
    lane: "AGRI DIGITAL TWIN",
    status: "ACTIVE",
    score: "X59 F74 M69",
    lift: "+15",
    next: "Value proof package",
    accent: "#338cff",
    progress: 71,
  },
  {
    id: "p14",
    code: "SE",
    name: "Science Engine",
    lane: "RESEARCH SCOUT",
    status: "DRAFT",
    score: "X39 F68 M47",
    lift: "+07",
    next: "Seed intake triage",
    accent: "#ffe15c",
    progress: 49,
  },
  {
    id: "p29",
    code: "SX",
    name: "Supply X",
    lane: "INDUSTRIAL PROTOCOL",
    status: "FROZEN",
    score: "X31 F86 M36",
    lift: "+04",
    next: "Reactivation criteria",
    accent: "#c781ff",
    progress: 36,
  },
];

const coreKpis: KpiModule[] = [
  { label: "ACTIVE PJ", value: "14", sub: "+3 / 90D", progress: 78, accent: "#61ffb3" },
  { label: "TOTAL PJ", value: "29", sub: "SINCE FOUNDING", progress: 64, accent: "#46f7ff" },
  { label: "RAISED", value: "8.4B", sub: "JPY PIPELINE", progress: 84, accent: "#ffad57" },
  { label: "AVG ARC", value: "11.6M", sub: "PROJECT DURATION", progress: 58, accent: "#338cff" },
];

const proofKpis: KpiModule[] = [
  { label: "SCORE LIFT", value: "+29", sub: "AMD DELTA", progress: 69, accent: "#61ffb3" },
  { label: "MS CLEAR", value: "68%", sub: "MILESTONE HIT", progress: 68, accent: "#c781ff" },
  { label: "CYCLES", value: "126", sub: "VALUE PLAN RUNS", progress: 73, accent: "#46f7ff" },
  { label: "EVENTS", value: "312", sub: "PROOF LOGS", progress: 81, accent: "#ffe15c" },
];

const cockpitBackedProjectIds = new Set(["p20", "p25", "p06", "p21", "p14"]);

function mergeCockpitIntoProject(project: ProjectModule, cockpit: CockpitData): ProjectModule {
  const msSnapshot = buildMilestoneSnapshot(cockpit);
  const actionSnapshot = buildActionSnapshot(cockpit);
  return {
    ...project,
    name: cockpit.project.projectName || project.name,
    lane: cockpit.project.projectType || cockpit.project.clientName || project.lane,
    status: cockpit.project.status || project.status,
    progress: msSnapshot.totalProgress || project.progress,
    next: actionSnapshot.primary || msSnapshot.nextTitle || project.next,
    cockpit,
    cockpitReady: true,
  };
}

function latestProgressForMilestone(cockpit: CockpitData, milestoneId: string) {
  const scoped = cockpit.progress
    .filter((progress) => progress.milestoneKey === milestoneId)
    .sort((a, b) => b.ym.localeCompare(a.ym));
  return scoped[0]?.progressPct ?? 0;
}

function buildMilestoneSnapshot(cockpit?: CockpitData) {
  if (!cockpit || !cockpit.milestones.length) {
    return {
      totalProgress: 0,
      nextTitle: "",
      nextPct: 0,
      activeCount: 0,
      totalPoints: 0,
      period: "",
      routineCount: 0,
      owner: "",
    };
  }

  const milestones = cockpit.milestones.filter((m) => m.tag !== "buffer");
  const totalPoints = milestones.reduce((sum, milestone) => sum + milestone.points, 0);
  const weighted = totalPoints
    ? milestones.reduce((sum, milestone) => sum + latestProgressForMilestone(cockpit, milestone.milestoneId) * milestone.points, 0) / totalPoints
    : 0;
  const nextMilestone = milestones.find((milestone) => latestProgressForMilestone(cockpit, milestone.milestoneId) < 100) ?? milestones[0];
  const ownerId = nextMilestone
    ? cockpit.responsibilities.find((responsibility) => responsibility.milestoneId === nextMilestone.milestoneId)?.memberId
    : "";
  return {
    totalProgress: Math.round(weighted),
    nextTitle: nextMilestone?.title || "",
    nextPct: nextMilestone ? latestProgressForMilestone(cockpit, nextMilestone.milestoneId) : 0,
    activeCount: milestones.length,
    totalPoints,
    period: cockpit.planCycle ? `${formatYmShort(cockpit.planCycle.periodStartYm)}-${formatYmShort(cockpit.planCycle.periodEndYm)}` : "",
    routineCount: milestones.filter((m) => m.tag === "routine").length,
    owner: ownerId ? cockpit.memberMap[ownerId] || ownerId : "",
  };
}

function buildMonthlySnapshot(cockpit?: CockpitData) {
  if (!cockpit) return { ym: "", report: "", meeting: "", budget: "", invoice: "", payment: "", note: "" };
  const target = cockpit.billingCycles.find((cycle) => cycle.ym === cockpit.currentYm) ?? cockpit.billingCycles[0];
  const report = target ? cockpit.reports.find((item) => item.ym === target.ym) : null;
  return {
    ym: target?.ym ? formatYmShort(target.ym) : formatYmShort(cockpit.currentYm),
    report: target?.reportFixedAt ? "fixed" : report?.hasDraft ? "draft" : "none",
    meeting: target?.meetingStartAt ? "scheduled" : "open",
    budget: target?.budgetConfirmedAt ? "confirmed" : target?.budgetYen ? yenShort(target.budgetYen) : "open",
    invoice: target?.invoiceSentAt ? "sent" : target?.invoiceIssuedAt ? "issued" : "open",
    payment: target?.paymentConfirmedAt ? "paid" : target?.invoiceSentAt ? "waiting" : "n/a",
    note: report?.finalExcerpt || report?.draftExcerpt || "",
  };
}

function buildActionSnapshot(cockpit?: CockpitData) {
  if (!cockpit) return { primary: "", nudge: "", owner: "", openTasks: 0, blocker: "" };
  const openTasks = cockpit.tasks.filter((task) => !["done", "closed", "complete", "completed"].includes((task.status || "").toLowerCase()));
  const task = openTasks[0];
  const nudge = cockpit.nudges.find((item) => !["done", "sent", "closed"].includes((item.status || "").toLowerCase())) ?? cockpit.nudges[0];
  const ms = buildMilestoneSnapshot(cockpit);
  return {
    primary: task?.title || ms.nextTitle || "no open task",
    nudge: nudge?.message || "no active nudge",
    owner: task?.assignee || ms.owner || cockpit.members[0] || "AMD",
    openTasks: openTasks.length,
    blocker: cockpit.subItems.find((item) => item.status !== "done")?.title || "",
  };
}

function formatYmShort(ym: string) {
  if (!ym || ym.length < 6) return ym || "--";
  return `${ym.slice(2, 4)}.${ym.slice(4, 6)}`;
}

function yenShort(value: number) {
  if (!value) return "0";
  if (value >= 1000000) return `${Math.round(value / 100000) / 10}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

function clipText(value: string, fallback = "--") {
  const clean = (value || "").replace(/\s+/g, " ").trim();
  return clean || fallback;
}

export default function CyberHudWallDashboard() {
  const [projectsState, setProjectsState] = useState<ProjectModule[]>(projects);
  const [selectedId, setSelectedId] = useState("p25");
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [activeFocusDock, setActiveFocusDock] = useState<FocusDock>("status");
  const [workspaceDock, setWorkspaceDock] = useState<FocusDock | null>(null);
  const selected = projectsState.find((project) => project.id === selectedId) ?? projectsState[1];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get("project");
      const dock = params.get("dock") as FocusDock | null;
      const shouldOpenWorkspace = params.get("workspace") === "1";
      if (projectId && projects.some((project) => project.id === projectId)) {
        setSelectedId(projectId);
        setViewMode("project");
      }
      if (dock && focusDockOrder.includes(dock)) {
        setActiveFocusDock(dock);
        if (shouldOpenWorkspace) setWorkspaceDock(dock);
      } else if (shouldOpenWorkspace) {
        setWorkspaceDock("status");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orderedProjects = [...projects].sort((a, b) => (a.id === "p25" ? -1 : b.id === "p25" ? 1 : 0));
      for (const project of orderedProjects) {
        if (!cockpitBackedProjectIds.has(project.id)) {
          continue;
        }
        try {
          const cockpit = await fetchCockpitFromSupabase(project.id);
          if (!cancelled) {
            const nextProject = mergeCockpitIntoProject(project, cockpit);
            setProjectsState((current) => current.map((item) => (item.id === nextProject.id ? nextProject : item)));
          }
        } catch (error) {
          console.warn(`[CyberHudWall] cockpit fetch failed: ${project.id}`, error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="hudwall-page" data-testid="cyber-hud-wall">
      <Canvas
        dpr={[1, 1.45]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 8.6], fov: 42, near: 0.1, far: 40 }}
      >
        <HudWallWorld
          selected={selected}
          projects={projectsState}
          selectedId={selectedId}
          viewMode={viewMode}
          onSelect={(id) => {
            setSelectedId(id);
            setActiveFocusDock("status");
            setWorkspaceDock(null);
            setViewMode("project");
          }}
          onModeChange={(mode) => {
            setViewMode(mode);
            if (mode === "overview") setWorkspaceDock(null);
          }}
          activeFocusDock={activeFocusDock}
          onFocusDockChange={(dock) => {
            setActiveFocusDock(dock);
            setWorkspaceDock(dock);
          }}
          onOpenWorkspace={(dock) => {
            setActiveFocusDock(dock);
            setWorkspaceDock(dock);
          }}
        />
      </Canvas>
      {viewMode === "project" && (
        <CockpitSpatialCommand
          project={selected}
          activeDock={activeFocusDock}
          workspaceOpen={!!workspaceDock}
          onDockChange={(dock) => {
            setActiveFocusDock(dock);
            setWorkspaceDock(dock);
          }}
          onCloseProject={() => {
            setWorkspaceDock(null);
            setViewMode("overview");
          }}
        />
      )}
      {workspaceDock && (
        <CockpitSpatialWorkspace
          project={selected}
          activeDock={workspaceDock}
          onDockChange={(dock) => {
            setActiveFocusDock(dock);
            setWorkspaceDock(dock);
          }}
          onClose={() => setWorkspaceDock(null)}
        />
      )}
      <style jsx global>{`
        .hudwall-page{position:fixed;inset:0;z-index:30;overflow:hidden;background:#020714}
        .hudwall-page canvas{display:block;width:100%;height:100%}
        .hud-spatial-command{position:fixed;left:18px;right:18px;bottom:16px;z-index:42;display:flex;align-items:center;justify-content:space-between;gap:12px;pointer-events:none}
        .hud-spatial-command__rail{display:flex;align-items:center;gap:8px;min-width:0;padding:8px 10px;background:rgba(1,12,24,.72);border:1px solid rgba(105,244,255,.42);box-shadow:0 0 24px rgba(70,247,255,.16),inset 0 0 18px rgba(70,247,255,.08);backdrop-filter:blur(10px);pointer-events:auto}
        .hud-spatial-command__title{font:800 11px/1 Orbitron,Arial,sans-serif;color:#cfffff;letter-spacing:.08em;white-space:nowrap;text-shadow:0 0 10px rgba(70,247,255,.7)}
        .hud-spatial-command__tabs{display:flex;align-items:center;gap:6px;min-width:0;overflow:auto}
        .hud-spatial-command__button{height:28px;padding:0 10px;border:1px solid rgba(92,223,255,.34);background:rgba(5,26,44,.82);color:rgba(218,255,255,.8);font:800 10px/1 Orbitron,Arial,sans-serif;white-space:nowrap;cursor:pointer;box-shadow:inset 0 0 12px rgba(70,247,255,.06)}
        .hud-spatial-command__button[data-active="true"]{border-color:rgba(111,255,255,.92);background:rgba(20,86,112,.88);color:#ffffff;box-shadow:0 0 18px rgba(70,247,255,.35),inset 0 0 16px rgba(70,247,255,.18)}
        .hud-spatial-command__close{height:30px;padding:0 12px;border:1px solid rgba(255,95,145,.48);background:rgba(44,8,24,.82);color:#ffd8e8;font:800 10px/1 Orbitron,Arial,sans-serif;cursor:pointer;pointer-events:auto}
        .hud-spatial-workspace{position:fixed;inset:18px;z-index:50;display:grid;grid-template-rows:auto 1fr;background:linear-gradient(180deg,rgba(1,8,18,.94),rgba(1,10,20,.89));border:1px solid rgba(125,245,255,.58);box-shadow:0 0 46px rgba(70,247,255,.22),0 0 0 1px rgba(255,255,255,.08) inset;backdrop-filter:blur(14px);overflow:hidden}
        .hud-spatial-workspace::before{content:"";position:absolute;inset:10px;pointer-events:none;border:1px solid rgba(70,247,255,.24);clip-path:polygon(0 24px,24px 0,calc(100% - 24px) 0,100% 24px,100% calc(100% - 24px),calc(100% - 24px) 100%,24px 100%,0 calc(100% - 24px));box-shadow:inset 0 0 28px rgba(70,247,255,.08)}
        .hud-spatial-workspace__header{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px 12px;border-bottom:1px solid rgba(87,225,255,.26);background:linear-gradient(90deg,rgba(4,30,52,.88),rgba(4,18,33,.6))}
        .hud-spatial-workspace__meta{min-width:0}
        .hud-spatial-workspace__eyebrow{font:900 11px/1 Orbitron,Arial,sans-serif;color:rgba(136,244,255,.78);letter-spacing:.12em}
        .hud-spatial-workspace__name{margin-top:6px;font:900 clamp(28px,3.2vw,48px)/.95 Orbitron,Arial,sans-serif;color:#f7ffff;text-shadow:0 0 22px rgba(70,247,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hud-spatial-workspace__sub{margin-top:6px;font:800 12px/1.2 Arial,sans-serif;color:rgba(218,255,255,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hud-spatial-workspace__tabs{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}
        .hud-spatial-workspace__tab,.hud-spatial-workspace__close{height:32px;padding:0 11px;border:1px solid rgba(112,236,255,.32);background:rgba(3,23,42,.84);color:rgba(224,255,255,.82);font:900 10px/1 Orbitron,Arial,sans-serif;cursor:pointer}
        .hud-spatial-workspace__tab[data-active="true"]{border-color:rgba(111,255,255,.95);background:rgba(20,90,118,.92);color:#fff;box-shadow:0 0 18px rgba(70,247,255,.34),inset 0 0 18px rgba(70,247,255,.14)}
        .hud-spatial-workspace__close{border-color:rgba(255,95,145,.56);background:rgba(50,10,28,.86);color:#ffe1ec}
        .hud-spatial-workspace__body{position:relative;z-index:1;min-height:0;overflow:auto;padding:18px;background:radial-gradient(circle at 50% 0,rgba(70,247,255,.1),transparent 36%),linear-gradient(180deg,rgba(2,14,26,.7),rgba(1,7,16,.88))}
        .hud-spatial-workspace__body[data-empty="true"]{display:grid;place-items:center;color:#dfffff;font:800 15px/1.5 Arial,sans-serif}
        .hud-spatial-workspace__cockpit{min-width:1080px;width:max-content;margin:0 auto;padding:16px;background:rgba(247,250,255,.96);box-shadow:0 0 30px rgba(70,247,255,.12)}
        .hud-spatial-workspace__hint{position:sticky;top:0;z-index:5;margin:-18px -18px 14px;padding:8px 18px;background:rgba(2,16,31,.92);border-bottom:1px solid rgba(70,247,255,.22);color:rgba(213,255,255,.82);font:800 11px/1.35 Arial,sans-serif}
        @media (max-width:900px){
          .hud-spatial-command{left:10px;right:10px;bottom:10px;align-items:flex-end}
          .hud-spatial-command__rail{max-width:calc(100vw - 20px)}
          .hud-spatial-command__title{display:none}
          .hud-spatial-workspace{inset:8px}
          .hud-spatial-workspace__header{align-items:flex-start;flex-direction:column}
          .hud-spatial-workspace__tabs{justify-content:flex-start}
          .hud-spatial-workspace__body{padding:12px}
          .hud-spatial-workspace__cockpit{min-width:1060px}
        }
      `}</style>
    </main>
  );
}

const focusDockLabels: Record<FocusDock, string> = {
  status: "PJ STATUS",
  ms: "MS / GOALS",
  monthly: "MONTHLY",
  actions: "ACTIONS",
  ops: "OPS",
};

const focusDockOrder: FocusDock[] = ["status", "ms", "monthly", "actions", "ops"];

function CockpitSpatialCommand({
  project,
  activeDock,
  workspaceOpen,
  onDockChange,
  onCloseProject,
}: {
  project: ProjectModule;
  activeDock: FocusDock;
  workspaceOpen: boolean;
  onDockChange: (dock: FocusDock) => void;
  onCloseProject: () => void;
}) {
  return (
    <div className="hud-spatial-command">
      <div className="hud-spatial-command__rail">
        <span className="hud-spatial-command__title">
          {project.code} SPATIAL COCKPIT {workspaceOpen ? "/ WORKSPACE OPEN" : "/ TAP DOCK TO OPEN"}
        </span>
        <div className="hud-spatial-command__tabs">
          {focusDockOrder.map((dock) => (
            <button
              key={dock}
              type="button"
              className="hud-spatial-command__button"
              data-active={activeDock === dock}
              onClick={() => onDockChange(dock)}
            >
              {focusDockLabels[dock]}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="hud-spatial-command__close" onClick={onCloseProject}>
        OVERVIEW
      </button>
    </div>
  );
}

function CockpitSpatialWorkspace({
  project,
  activeDock,
  onDockChange,
  onClose,
}: {
  project: ProjectModule;
  activeDock: FocusDock;
  onDockChange: (dock: FocusDock) => void;
  onClose: () => void;
}) {
  const cockpit = project.cockpit;

  return (
    <section className="hud-spatial-workspace" aria-label={`${project.name} cockpit workspace`}>
      <header className="hud-spatial-workspace__header">
        <div className="hud-spatial-workspace__meta">
          <div className="hud-spatial-workspace__eyebrow">NO PAGE TRANSITION / LIVE PJ COCKPIT</div>
          <div className="hud-spatial-workspace__name">{project.name}</div>
          <div className="hud-spatial-workspace__sub">
            {project.code} / {project.lane} / {project.cockpitReady ? "Supabase cockpit data" : "mock fallback waiting for DB row"}
          </div>
        </div>
        <div className="hud-spatial-workspace__tabs">
          {focusDockOrder.map((dock) => (
            <button
              key={dock}
              type="button"
              className="hud-spatial-workspace__tab"
              data-active={activeDock === dock}
              onClick={() => onDockChange(dock)}
            >
              {focusDockLabels[dock]}
            </button>
          ))}
          <button type="button" className="hud-spatial-workspace__close" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </header>
      <div className="hud-spatial-workspace__body" data-empty={!cockpit}>
        {cockpit ? (
          <>
            <div className="hud-spatial-workspace__hint">
              ACTIVE DOCK / {focusDockLabels[activeDock]}。この前景workspaceは元PJコックピットを同一画面内にマウントしているので、MS、月次、資料、経営ハイライト、MTGサマリをそのまま確認できる。
            </div>
            <div className="hud-spatial-workspace__cockpit">
              <CockpitView
                cockpit={cockpit}
                tasks={cockpit.tasks}
              />
            </div>
          </>
        ) : (
          <div>
            <div>LIVE COCKPIT DATA IS NOT AVAILABLE YET</div>
            <div>{project.id} has no cockpit row, so HUD overview stays on mock fallback.</div>
          </div>
        )}
      </div>
    </section>
  );
}

function HudWallWorld({
  selected,
  projects,
  selectedId,
  viewMode,
  activeFocusDock,
  onSelect,
  onModeChange,
  onFocusDockChange,
  onOpenWorkspace,
}: {
  selected: ProjectModule;
  projects: ProjectModule[];
  selectedId: string;
  viewMode: ViewMode;
  activeFocusDock: FocusDock;
  onSelect: (id: string) => void;
  onModeChange: (mode: ViewMode) => void;
  onFocusDockChange: (dock: FocusDock) => void;
  onOpenWorkspace: (dock: FocusDock) => void;
}) {
  const { camera } = useThree();
  const backgroundTexture = useMemo(() => createBackdropTexture(), []);
  const titleTexture = useMemo(() => createTitleTexture(), []);
  const alertTexture = useMemo(() => createAlertTexture(), []);
  const selectedTexture = useMemo(() => createSelectedCockpitTexture(selected), [selected]);

  useEffect(() => {
    camera.position.set(0, 0, 8.6);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <color attach="background" args={["#020714"]} />
      <fog attach="fog" args={["#04162b", 8, 24]} />
      <ambientLight intensity={0.38} />
      <pointLight position={[0, 0, 3.4]} color="#8cffff" intensity={3.2} distance={12} decay={1.4} />
      <pointLight position={[-4.8, 2.6, 2.2]} color="#46f7ff" intensity={2.4} distance={9} decay={1.6} />
      <pointLight position={[4.8, -2.1, 1.9]} color="#ff5f91" intensity={1.6} distance={8} decay={1.6} />

      <mesh position={[0, 0, -6.8]} renderOrder={-20}>
        <planeGeometry args={[20, 11.4]} />
        <meshBasicMaterial map={backgroundTexture} transparent opacity={0.98} depthWrite={false} />
      </mesh>

      <DepthRailField />

      <RailPanel position={[-4.05, 3.02, -1.5]}>
        <TexturePanel texture={titleTexture} width={3.8} height={0.82} opacity={0.96} />
      </RailPanel>

      {viewMode === "overview" && (
        <>
          <RailPanel position={[-4.72, 1.86, -0.7]}>
            <CoreStatusPanel />
          </RailPanel>

          <RailPanel position={[4.68, 2.1, -1.05]}>
            <KpiBank title="AMD VALUE PROOF" subtitle="INTERVENTION DELTA" metrics={proofKpis} align="right" />
          </RailPanel>

          <RailPanel position={[4.78, 0.34, -1.75]}>
            <TexturePanel texture={alertTexture} width={2.42} height={0.96} opacity={0.88} />
            <PanelFrame width={2.42} height={0.96} color="#ff5f91" opacity={0.64} />
          </RailPanel>

          <RailPanel position={[-4.82, -1.52, -1.15]}>
            <KpiBank title="STUDIO CORE KPI" subtitle="OPERATING HEALTH" metrics={coreKpis} align="left" />
          </RailPanel>
        </>
      )}

      <ProjectModuleGrid projects={projects} selectedId={selectedId} viewMode={viewMode} onSelect={onSelect} />

      {viewMode === "overview" && (
        <>
          <RailPanel position={[0, -2.78, -0.6]}>
            <TickerPanel />
          </RailPanel>

          <RailPanel position={[3.9, -2.18, -0.35]}>
            <TexturePanel texture={selectedTexture} width={3.2} height={1.36} opacity={0.95} />
            <PanelFrame width={3.2} height={1.36} color={selected.accent} />
          </RailPanel>
        </>
      )}

      {viewMode === "project" ? (
        <ProjectFocusLayer
          selected={selected}
          activeDock={activeFocusDock}
          onDockChange={onFocusDockChange}
          onOpenWorkspace={onOpenWorkspace}
          onBack={() => onModeChange("overview")}
        />
      ) : (
        <ValueFlowCore selected={selected} />
      )}
      {viewMode === "overview" && <InterventionLanes selected={selected} />}
    </>
  );
}

function RailPanel({ children, position, scale = 1 }: RailPanelProps) {
  return (
    <group position={position} scale={scale}>
      {children}
    </group>
  );
}

function TexturePanel({
  texture,
  width,
  height,
  opacity = 0.92,
  blend = "additive",
}: {
  texture: THREE.Texture;
  width: number;
  height: number;
  opacity?: number;
  blend?: "additive" | "normal";
}) {
  return (
    <mesh renderOrder={20}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        blending={blend === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function CoreStatusPanel() {
  const texture = useMemo(() => createSystemStatusTexture(), []);
  return (
    <>
      <TexturePanel texture={texture} width={2.62} height={1.1} opacity={0.95} />
      <PanelFrame width={2.62} height={1.1} color="#61ffb3" />
      <SegmentBars count={12} lit={10} position={[0.55, -0.27, 0.04]} color="#61ffb3" />
    </>
  );
}

function ProjectModuleGrid({
  projects,
  selectedId,
  viewMode,
  onSelect,
}: {
  projects: ProjectModule[];
  selectedId: string;
  viewMode: ViewMode;
  onSelect: (id: string) => void;
}) {
  const positions: [number, number, number][] = [
    [-1.95, 1.45, -0.2],
    [0, 1.56, -0.82],
    [1.95, 1.45, -0.38],
    [-1.95, 0.16, -0.95],
    [0, 0.04, -0.1],
    [1.95, 0.16, -1.05],
  ];

  return (
    <group>
      {projects.map((project, index) => (
        <RailPanel key={project.id} position={positions[index]} scale={viewMode === "project" ? 0.98 : selectedId === project.id ? 1.1 : 1}>
          <ProjectModuleCard
            project={project}
            selected={selectedId === project.id}
            dimmed={viewMode === "project"}
            onSelect={() => onSelect(project.id)}
          />
        </RailPanel>
      ))}
    </group>
  );
}

function ProjectModuleCard({
  project,
  selected,
  dimmed,
  onSelect,
}: {
  project: ProjectModule;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  const texture = useMemo(() => createProjectModuleTexture(project), [project]);
  const width = 1.72;
  const height = 0.92;

  return (
    <group>
      <pointLight color={project.accent} intensity={dimmed ? 0.18 : selected ? 1.8 : 0.6} distance={2.8} decay={1.4} position={[0, 0, 0.35]} />
      <mesh
        renderOrder={34}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} transparent opacity={dimmed ? 0.22 : selected ? 1 : 0.86} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <ProgressRail progress={project.progress} width={1.28} position={[0.04, -0.31, 0.055]} color={project.accent} />
    </group>
  );
}

function ProjectFocusLayer({
  selected,
  activeDock,
  onDockChange,
  onOpenWorkspace,
  onBack,
}: {
  selected: ProjectModule;
  activeDock: FocusDock;
  onDockChange: (dock: FocusDock) => void;
  onOpenWorkspace: (dock: FocusDock) => void;
  onBack: () => void;
}) {
  const focusTexture = useMemo(() => createProjectFocusTexture(selected, activeDock), [selected, activeDock]);
  const statusTexture = useMemo(() => createSpatialDockTexture("PJ STATUS", selected, getDockRows(selected, "status"), activeDock === "status"), [selected, activeDock]);
  const msTexture = useMemo(() => createSpatialDockTexture("MS / GOALS", selected, getDockRows(selected, "ms"), activeDock === "ms"), [selected, activeDock]);
  const monthlyTexture = useMemo(() => createSpatialDockTexture("MONTHLY", selected, getDockRows(selected, "monthly"), activeDock === "monthly"), [selected, activeDock]);
  const actionsTexture = useMemo(() => createSpatialDockTexture("ACTIONS", selected, getDockRows(selected, "actions"), activeDock === "actions"), [selected, activeDock]);
  const opsTexture = useMemo(() => createSpatialDockTexture("OPS", selected, getDockRows(selected, "ops"), activeDock === "ops"), [selected, activeDock]);
  const modeTexture = useMemo(() => createModeTexture(selected), [selected]);

  return (
    <group>
      <FocusBackdropShields accent={selected.accent} />
      <RailPanel position={[0, -0.88, 0.42]}>
        <TexturePanel texture={focusTexture} width={4.38} height={1.82} opacity={1} blend="normal" />
        <mesh
          position={[0, 0, 0.12]}
          renderOrder={92}
          onClick={(event) => {
            event.stopPropagation();
            onOpenWorkspace(activeDock);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <planeGeometry args={[4.38, 1.82]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.001} depthWrite={false} />
        </mesh>
      </RailPanel>
      <RailPanel position={[-3.38, -0.04, 0.08]}>
        <DockPanel texture={statusTexture} width={2.42} height={1.46} active={activeDock === "status"} color="#46f7ff" onClick={() => {
          onDockChange("status");
          onOpenWorkspace("status");
        }} />
      </RailPanel>
      <RailPanel position={[3.38, -0.04, 0.08]}>
        <DockPanel texture={actionsTexture} width={2.42} height={1.46} active={activeDock === "actions"} color="#61ffb3" onClick={() => {
          onDockChange("actions");
          onOpenWorkspace("actions");
        }} />
      </RailPanel>
      <RailPanel position={[-2.34, -2.18, 0.28]}>
        <DockPanel texture={msTexture} width={2.48} height={1.12} active={activeDock === "ms"} color={selected.accent} onClick={() => {
          onDockChange("ms");
          onOpenWorkspace("ms");
        }} />
      </RailPanel>
      <RailPanel position={[0.3, -2.2, 0.34]}>
        <DockPanel texture={monthlyTexture} width={2.48} height={1.12} active={activeDock === "monthly"} color="#ff5f91" onClick={() => {
          onDockChange("monthly");
          onOpenWorkspace("monthly");
        }} />
      </RailPanel>
      <RailPanel position={[2.94, -2.18, 0.28]}>
        <DockPanel texture={opsTexture} width={2.48} height={1.12} active={activeDock === "ops"} color="#ffad57" onClick={() => {
          onDockChange("ops");
          onOpenWorkspace("ops");
        }} />
      </RailPanel>
      <RailPanel position={[-2.98, -2.88, 0.18]}>
        <group>
          <TexturePanel texture={modeTexture} width={1.72} height={0.38} opacity={0.9} />
          <mesh
            position={[0, 0, 0.08]}
            renderOrder={80}
            onClick={(event) => {
              event.stopPropagation();
              onBack();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <planeGeometry args={[1.72, 0.38]} />
            <meshBasicMaterial color="#07182a" transparent opacity={0.02} depthWrite={false} />
          </mesh>
        </group>
      </RailPanel>
      <FocusConnectors color={selected.accent} />
    </group>
  );
}

function FocusConnectors({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const vertices = [
      -2.02, -0.92, 0.18, -2.18, -0.46, 0.06,
      2.02, -0.92, 0.18, 2.18, -0.46, 0.06,
      -1.1, -1.64, 0.18, -1.18, -1.88, 0.12,
      1.1, -1.64, 0.18, 1.34, -1.9, 0.12,
    ];
    const line = new THREE.BufferGeometry();
    line.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return line;
  }, []);

  return (
    <lineSegments geometry={geometry} renderOrder={17}>
      <lineBasicMaterial color={color} transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function DockPanel({
  texture,
  width,
  height,
  active,
  color,
  onClick,
}: {
  texture: THREE.Texture;
  width: number;
  height: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <group>
      <TexturePanel texture={texture} width={width} height={height} opacity={1} blend="normal" />
      {active && (
        <>
          <mesh position={[0, height / 2 - 0.07, 0.09]} renderOrder={74}>
            <boxGeometry args={[width * 0.72, 0.028, 0.012]} />
            <meshBasicMaterial color={color} transparent opacity={0.86} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh position={[width / 2 - 0.1, 0, 0.09]} renderOrder={74}>
            <boxGeometry args={[0.03, height * 0.74, 0.012]} />
            <meshBasicMaterial color="#f3ffff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </>
      )}
      <mesh
        position={[0, 0, 0.12]}
        renderOrder={90}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.001} depthWrite={false} />
      </mesh>
    </group>
  );
}

function FocusBackdropShields({ accent }: { accent: string }) {
  const veilTexture = useMemo(() => createFocusVeilTexture(), []);

  return (
    <group>
      <mesh position={[0, -1.03, -0.02]} renderOrder={14}>
        <planeGeometry args={[9.65, 5.12]} />
        <meshBasicMaterial map={veilTexture} transparent opacity={1} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.92, 0.2]} renderOrder={16}>
        <planeGeometry args={[4.82, 2.08]} />
        <meshBasicMaterial color={accent} transparent opacity={0.045} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HeavyHudFrame({ width, height, color, opacity = 0.72 }: { width: number; height: number; color: string; opacity?: number }) {
  const bar = 0.034;
  const cap = 0.18;
  const x = width / 2;
  const y = height / 2;
  const material = (
    <meshBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
  );

  return (
    <group>
      <mesh position={[0, y, 0.09]} renderOrder={56}>
        <boxGeometry args={[width - cap * 1.6, bar, 0.012]} />
        {material}
      </mesh>
      <mesh position={[0, -y, 0.09]} renderOrder={56}>
        <boxGeometry args={[width - cap * 1.3, bar, 0.012]} />
        {material}
      </mesh>
      <mesh position={[-x, 0, 0.09]} renderOrder={56}>
        <boxGeometry args={[bar, height - cap * 1.4, 0.012]} />
        {material}
      </mesh>
      <mesh position={[x, 0, 0.09]} renderOrder={56}>
        <boxGeometry args={[bar, height - cap * 1.4, 0.012]} />
        {material}
      </mesh>
      {[
        [-x + cap * 0.55, y - cap * 0.55, 1],
        [x - cap * 0.55, y - cap * 0.55, -1],
        [-x + cap * 0.55, -y + cap * 0.55, -1],
        [x - cap * 0.55, -y + cap * 0.55, 1],
      ].map(([cx, cy, dir], index) => (
        <mesh key={index} position={[cx, cy, 0.1]} rotation={[0, 0, Number(dir) * Math.PI * 0.25]} renderOrder={57}>
          <boxGeometry args={[cap * 1.2, bar * 1.15, 0.012]} />
          <meshBasicMaterial color="#d8ffff" transparent opacity={opacity * 0.72} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function KpiBank({
  title,
  subtitle,
  metrics,
  align,
}: {
  title: string;
  subtitle: string;
  metrics: KpiModule[];
  align: "left" | "right";
}) {
  const texture = useMemo(() => createKpiBankTexture({ title, subtitle, metrics, align }), [title, subtitle, metrics, align]);
  const width = 3.08;
  const height = 2.24;
  return (
    <group>
      <TexturePanel texture={texture} width={width} height={height} opacity={0.92} />
      <PanelFrame width={width} height={height} color={align === "left" ? "#46f7ff" : "#ffad57"} />
      {metrics.map((metric, index) => (
        <HudLoadIndicator
          key={metric.label}
          progress={metric.progress}
          color={metric.accent}
          position={[align === "left" ? -1.08 : 1.08, 0.58 - index * 0.42, 0.055]}
        />
      ))}
    </group>
  );
}

function ValueFlowCore({ selected }: { selected: ProjectModule }) {
  const texture = useMemo(() => createValueFlowTexture(selected), [selected]);

  return (
    <group position={[0, -1.18, -0.42]}>
      <pointLight color={selected.accent} intensity={2.2} distance={4} decay={1.6} position={[0, 0, 0.4]} />
      <TexturePanel texture={texture} width={2.95} height={1.42} opacity={0.94} />
      <PanelFrame width={2.95} height={1.42} color={selected.accent} opacity={0.72} />
      <mesh position={[-0.86, -0.02, 0.09]} renderOrder={47}>
        <boxGeometry args={[0.48, 0.05, 0.018]} />
        <meshBasicMaterial color="#46f7ff" transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.02, 0.1]} renderOrder={48}>
        <boxGeometry args={[0.56, 0.07, 0.018]} />
        <meshBasicMaterial color={selected.accent} transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0.86, -0.02, 0.09]} renderOrder={47}>
        <boxGeometry args={[0.48, 0.05, 0.018]} />
        <meshBasicMaterial color="#61ffb3" transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function InterventionLanes({ selected }: { selected: ProjectModule }) {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const add = (a: [number, number, number], b: [number, number, number]) => vertices.push(...a, ...b);
    add([-0.78, -1.2, -0.28], [-3.25, -1.53, -0.88]);
    add([0.78, -1.2, -0.28], [3.25, -2.16, -0.38]);
    add([0, -0.2, -0.18], [0, 1.12, -0.56]);
    add([-0.42, -0.62, -0.18], [-1.95, 0.16, -0.95]);
    add([0.42, -0.62, -0.18], [1.95, 0.16, -1.05]);
    const line = new THREE.BufferGeometry();
    line.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return line;
  }, []);

  return (
    <lineSegments geometry={geometry} renderOrder={12}>
      <lineBasicMaterial color={selected.accent} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function DepthRailField() {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    for (let z = -6; z <= 0; z += 1.2) {
      vertices.push(-6.8, -3.35, z, 6.8, -3.35, z);
      vertices.push(-6.8, 3.35, z, 6.8, 3.35, z);
      vertices.push(-6.8, -3.35, z, -6.8, 3.35, z);
      vertices.push(6.8, -3.35, z, 6.8, 3.35, z);
    }
    for (let x = -6; x <= 6; x += 1.2) {
      vertices.push(x, -3.35, -6.2, x, -3.35, 0.2);
      vertices.push(x, 3.35, -6.2, x, 3.35, 0.2);
    }
    const line = new THREE.BufferGeometry();
    line.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return line;
  }, []);

  return (
    <lineSegments geometry={geometry} renderOrder={-5}>
      <lineBasicMaterial color="#46f7ff" transparent opacity={0.11} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function PanelFrame({ width, height, color, opacity = 0.76 }: { width: number; height: number; color: string; opacity?: number }) {
  const geometry = useMemo(() => createPanelFrameGeometry(width, height), [width, height]);
  const detailGeometry = useMemo(() => createPanelDetailGeometry(width, height), [width, height]);
  return (
    <>
      <lineSegments geometry={geometry} renderOrder={50}>
        <lineBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={detailGeometry} renderOrder={51}>
        <lineBasicMaterial color="#d8ffff" transparent opacity={opacity * 0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
    </>
  );
}

function HudLoadIndicator({ progress, color, position }: { progress: number; color: string; position: [number, number, number] }) {
  const litSegments = Math.max(1, Math.round((progress / 100) * 18));
  const litBars = Math.max(1, Math.round((progress / 100) * 12));

  return (
    <group position={position}>
      {Array.from({ length: 18 }).map((_, index) => (
        <mesh key={`arc-${index}`} rotation={[0, 0, -Math.PI / 2 + index * (Math.PI * 2 / 18)]} renderOrder={58}>
          <torusGeometry args={[0.14, 0.008, 6, 10, Math.PI * 0.066]} />
          <meshBasicMaterial
            color={index < litSegments ? color : "#2c6a7a"}
            transparent
            opacity={index < litSegments ? 0.9 : 0.24}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      <mesh renderOrder={59}>
        <ringGeometry args={[0.074, 0.085, 42]} />
        <meshBasicMaterial color={color} transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 12 }).map((_, index) => (
        <mesh key={`bar-${index}`} position={[0.22 + index * 0.035, -0.055, 0]} renderOrder={60}>
          <boxGeometry args={[0.022, 0.1 + (index % 3) * 0.018, 0.01]} />
          <meshBasicMaterial
            color={index < litBars ? color : "#244f64"}
            transparent
            opacity={index < litBars ? 0.86 : 0.24}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      <mesh position={[0.44, -0.055, 0.002]} renderOrder={57}>
        <boxGeometry args={[0.55, 0.012, 0.006]} />
        <meshBasicMaterial color="#8efcff" transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SegmentBars({ count, lit, position, color }: { count: number; lit: number; position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, index) => (
        <mesh key={index} position={[index * 0.06, 0, 0]} renderOrder={60}>
          <boxGeometry args={[0.032, 0.22 + (index % 4) * 0.04, 0.012]} />
          <meshBasicMaterial color={index < lit ? color : "#28566f"} transparent opacity={index < lit ? 0.88 : 0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function ProgressRail({ progress, width, position, color }: { progress: number; width: number; position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh renderOrder={61}>
        <boxGeometry args={[width, 0.028, 0.01]} />
        <meshBasicMaterial color="#1a526a" transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[-width * (1 - progress / 100) * 0.5, 0, 0.012]} renderOrder={62}>
        <boxGeometry args={[width * (progress / 100), 0.038, 0.01]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function TickerPanel() {
  const texture = useMemo(() => createTickerTexture(), []);
  return (
    <>
      <TexturePanel texture={texture} width={5.9} height={0.78} opacity={0.92} />
      <PanelFrame width={5.9} height={0.78} color="#46f7ff" opacity={0.58} />
    </>
  );
}

function createPanelFrameGeometry(width: number, height: number) {
  const x = width / 2;
  const y = height / 2;
  const n = Math.min(width, height) * 0.12;
  const points: [number, number, number][] = [
    [-x + n, y, 0.05],
    [x - n * 1.6, y, 0.05],
    [x, y - n, 0.05],
    [x, -y + n * 1.4, 0.05],
    [x - n, -y, 0.05],
    [-x + n * 1.2, -y, 0.05],
    [-x, -y + n, 0.05],
    [-x, y - n * 1.3, 0.05],
  ];
  const vertices: number[] = [];
  points.forEach((point, index) => vertices.push(...point, ...points[(index + 1) % points.length]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function createPanelDetailGeometry(width: number, height: number) {
  const x = width / 2;
  const y = height / 2;
  const vertices: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const yy = y - 0.18 - i * (height / 5);
    vertices.push(-x + 0.18, yy, 0.06, x - 0.24 - (i % 2) * 0.28, yy, 0.06);
  }
  vertices.push(-x + 0.18, -y + 0.16, 0.06, -x + 0.78, -y + 0.16, 0.06);
  vertices.push(x - 0.18, y - 0.16, 0.06, x - 0.78, y - 0.16, 0.06);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function createTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void) {
  if (typeof document === "undefined") return createFallbackTexture([10, 35, 60, 255]);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return createFallbackTexture([10, 35, 60, 255]);
  draw(ctx, canvas);
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

function createBackdropTexture() {
  return createTexture(1920, 1080, (ctx) => {
    const bg = ctx.createRadialGradient(960, 560, 40, 960, 520, 900);
    bg.addColorStop(0, "#0b7eb8");
    bg.addColorStop(0.25, "#063f73");
    bg.addColorStop(0.62, "#02152c");
    bg.addColorStop(1, "#01040e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1920, 1080);

    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(70,247,255,0.14)";
    ctx.lineWidth = 2;
    for (let y = 60; y < 1040; y += 46) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1920, y + Math.sin(y * 0.01) * 18);
      ctx.stroke();
    }
    for (let x = 80; x < 1880; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.cos(x * 0.01) * 22, 1080);
      ctx.stroke();
    }

    const drawCircuit = (x: number, y: number, width: number, flip = 1) => {
      ctx.strokeStyle = "rgba(77,247,255,0.38)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + width * 0.34 * flip, y);
      ctx.lineTo(x + width * 0.42 * flip, y + 38);
      ctx.lineTo(x + width * 0.76 * flip, y + 38);
      ctx.lineTo(x + width * 0.84 * flip, y - 6);
      ctx.lineTo(x + width * flip, y - 6);
      ctx.stroke();
      ctx.fillStyle = "rgba(150,255,255,0.68)";
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillRect(x + width * flip - 8, y - 14, 16, 16);
    };
    drawCircuit(120, 160, 420, 1);
    drawCircuit(1780, 170, 460, -1);
    drawCircuit(160, 860, 520, 1);
    drawCircuit(1700, 820, 440, -1);

    ctx.strokeStyle = "rgba(255,95,145,0.34)";
    ctx.lineWidth = 5;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(1540, 250, 58 + i * 24, i * 0.3, Math.PI * 1.5 + i * 0.1);
      ctx.stroke();
    }

    for (let i = 0; i < 260; i += 1) {
      const x = (i * 149) % 1920;
      const y = (i * 83) % 1080;
      ctx.fillStyle = `rgba(160,245,255,${0.04 + (i % 6) * 0.018})`;
      ctx.fillRect(x, y, i % 7 === 0 ? 4 : 1, i % 5 === 0 ? 4 : 1);
    }
  });
}

function createFocusVeilTexture() {
  return createTexture(1200, 720, (ctx) => {
    ctx.clearRect(0, 0, 1200, 720);
    const center = ctx.createRadialGradient(600, 390, 120, 600, 390, 620);
    center.addColorStop(0, "rgba(0,4,12,0.98)");
    center.addColorStop(0.58, "rgba(0,5,14,0.9)");
    center.addColorStop(0.82, "rgba(0,5,14,0.54)");
    center.addColorStop(1, "rgba(0,5,14,0)");
    ctx.fillStyle = center;
    ctx.fillRect(0, 0, 1200, 720);

    const band = ctx.createLinearGradient(0, 0, 0, 720);
    band.addColorStop(0, "rgba(0,5,14,0)");
    band.addColorStop(0.25, "rgba(0,5,14,0.72)");
    band.addColorStop(0.72, "rgba(0,5,14,0.82)");
    band.addColorStop(1, "rgba(0,5,14,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, 1200, 720);
  });
}

function createTitleTexture() {
  return createTexture(1000, 230, (ctx) => {
    ctx.clearRect(0, 0, 1000, 230);
    ctx.fillStyle = "rgba(5,22,42,0.32)";
    ctx.fillRect(0, 0, 1000, 230);
    ctx.strokeStyle = "rgba(77,247,255,0.78)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(32, 184);
    ctx.lineTo(472, 184);
    ctx.lineTo(526, 214);
    ctx.lineTo(942, 214);
    ctx.stroke();
    ctx.fillStyle = "#f6ffff";
    ctx.shadowColor = "#46f7ff";
    ctx.shadowBlur = 28;
    ctx.font = "900 96px Orbitron, Arial";
    ctx.fillText("AMD // OS", 36, 104);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#8efcff";
    ctx.font = "800 30px Orbitron, Arial";
    ctx.fillText("HUD TACTICAL WALL  V0.1", 42, 154);
    ctx.fillStyle = "rgba(255,95,145,0.92)";
    ctx.fillRect(760, 74, 130, 12);
    ctx.fillStyle = "rgba(97,255,179,0.86)";
    ctx.fillRect(760, 98, 88, 12);
  });
}

function createSystemStatusTexture() {
  return createTexture(720, 300, (ctx) => {
    ctx.clearRect(0, 0, 720, 300);
    fillPanelBase(ctx, 720, 300, "#61ffb3");
    ctx.fillStyle = "rgba(210,255,255,0.76)";
    ctx.font = "800 32px Arial";
    ctx.fillText("SYS_STATUS:", 54, 88);
    ctx.fillStyle = "#7dffb8";
    ctx.shadowColor = "#61ffb3";
    ctx.shadowBlur = 18;
    ctx.font = "900 54px Orbitron, Arial";
    ctx.fillText("OPTIMAL", 54, 154);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(220,255,255,0.64)";
    ctx.font = "700 22px Arial";
    ctx.fillText("SCANLINE STABLE / KPI STREAM LOCKED", 58, 220);
  });
}

function createProjectModuleTexture(project: ProjectModule) {
  return createTexture(760, 420, (ctx) => {
    ctx.clearRect(0, 0, 760, 420);
    fillPanelBase(ctx, 760, 420, project.accent);
    drawModuleFrameArt(ctx, 760, 420, project.accent);
    ctx.fillStyle = hexToRgba(project.accent, 0.18);
    ctx.fillRect(42, 72, 154, 270);
    ctx.strokeStyle = hexToRgba(project.accent, 0.74);
    ctx.lineWidth = 5;
    ctx.strokeRect(42, 72, 154, 270);
    ctx.fillStyle = "#f7ffff";
    ctx.shadowColor = project.accent;
    ctx.shadowBlur = 24;
    ctx.font = "900 76px Orbitron, Arial";
    ctx.fillText(project.code, 62, 164);
    ctx.shadowBlur = 0;
    ctx.font = "800 34px Arial";
    ctx.fillStyle = "rgba(220,255,255,0.94)";
    ctx.fillText(project.name, 226, 104);
    ctx.font = "700 18px Arial";
    ctx.fillStyle = "rgba(160,238,255,0.74)";
    ctx.fillText(project.lane, 228, 140);
    ctx.fillStyle = hexToRgba(project.accent, 0.86);
    ctx.font = "900 22px Orbitron, Arial";
    ctx.fillText(project.status, 228, 190);
    ctx.fillText(project.score, 228, 234);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 42px Orbitron, Arial";
    ctx.fillText(project.lift, 594, 194);
    ctx.fillStyle = "rgba(230,255,255,0.72)";
    ctx.font = "700 20px Arial";
    ctx.fillText(project.next, 228, 312);
    for (let i = 0; i < 14; i += 1) {
      ctx.fillStyle = i < Math.round(project.progress / 7.2) ? hexToRgba(project.accent, 0.9) : "rgba(90,155,170,0.24)";
      ctx.fillRect(228 + i * 28, 352, 18, 34 + (i % 3) * 10);
    }
  });
}

function drawModuleFrameArt(ctx: CanvasRenderingContext2D, width: number, height: number, accent: string) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const edge = "#58f7ff";
  const dim = hexToRgba(accent, 0.32);
  const hot = "rgba(235,255,255,0.86)";
  const path = new Path2D();
  path.moveTo(42, 34);
  path.lineTo(width - 132, 34);
  path.lineTo(width - 72, 86);
  path.lineTo(width - 34, 86);
  path.lineTo(width - 34, height - 74);
  path.lineTo(width - 84, height - 34);
  path.lineTo(96, height - 34);
  path.lineTo(34, height - 92);
  path.lineTo(34, 86);
  path.closePath();

  ctx.shadowColor = "#4df7ff";
  ctx.shadowBlur = 24;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.lineWidth = 18;
  ctx.strokeStyle = "rgba(49,240,255,0.18)";
  ctx.stroke(path);
  ctx.shadowBlur = 14;
  ctx.lineWidth = 11;
  ctx.strokeStyle = edge;
  ctx.stroke(path);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(235,255,255,0.94)";
  ctx.stroke(path);

  ctx.lineWidth = 2;
  ctx.strokeStyle = dim;
  for (let i = 0; i < 7; i += 1) {
    const y = 58 + i * 42;
    ctx.beginPath();
    ctx.moveTo(70, y);
    ctx.lineTo(width - 118 - (i % 2) * 44, y);
    ctx.lineTo(width - 88 - (i % 2) * 44, y + 18);
    ctx.stroke();
  }

  ctx.fillStyle = edge;
  ctx.fillRect(72, 44, 76, 10);
  ctx.fillRect(width - 248, 44, 54, 10);
  ctx.fillRect(width - 166, 62, 90, 8);
  ctx.fillRect(62, height - 62, 112, 8);
  ctx.fillRect(width - 190, height - 58, 128, 8);

  ctx.strokeStyle = hot;
  ctx.lineWidth = 3;
  const corners: [number, number, number, number][] = [
    [50, 48, 56, 0],
    [width - 112, 48, -56, 0],
    [50, height - 52, 56, 0],
    [width - 112, height - 52, -56, 0],
  ];
  corners.forEach(([x, y, dx]) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y);
    ctx.stroke();
    ctx.fillStyle = hot;
    ctx.fillRect(x - 5, y - 5, 10, 10);
  });

  for (let i = 0; i < 18; i += 1) {
    ctx.fillStyle = i % 4 === 0 ? hot : dim;
    ctx.fillRect(width - 58, 108 + i * 12, 14, 4);
  }
  for (let i = 0; i < 13; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? edge : dim;
    ctx.fillRect(70 + i * 34, 24, 16, 5);
  }
  ctx.restore();
}

function createValueFlowTexture(project: ProjectModule) {
  return createTexture(1000, 480, (ctx) => {
    ctx.clearRect(0, 0, 1000, 480);
    fillPanelBase(ctx, 1000, 480, project.accent);
    ctx.fillStyle = "rgba(205,255,255,0.7)";
    ctx.font = "900 24px Arial";
    ctx.fillText("VALUE CONVERSION CORE", 58, 64);
    ctx.fillStyle = "#f6ffff";
    ctx.shadowColor = project.accent;
    ctx.shadowBlur = 18;
    ctx.font = "900 48px Orbitron, Arial";
    ctx.fillText(project.code, 62, 124);
    ctx.fillText(project.lift, 820, 124);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(220,255,255,0.72)";
    ctx.font = "800 22px Arial";
    ctx.fillText("INPUT SIGNAL", 92, 214);
    ctx.fillText("AMD INTERVENTION", 372, 214);
    ctx.fillText("VALUE PROOF", 720, 214);
    const blocks = [
      { x: 82, w: 210, label: project.score, color: "#46f7ff" },
      { x: 364, w: 260, label: project.next, color: project.accent },
      { x: 704, w: 216, label: `LIFT ${project.lift}`, color: "#61ffb3" },
    ];
    blocks.forEach((block) => {
      ctx.strokeStyle = hexToRgba(block.color, 0.82);
      ctx.fillStyle = hexToRgba(block.color, 0.13);
      ctx.lineWidth = 4;
      ctx.fillRect(block.x, 242, block.w, 92);
      ctx.strokeRect(block.x, 242, block.w, 92);
      ctx.fillStyle = "#f6ffff";
      ctx.font = "800 22px Arial";
      ctx.fillText(block.label, block.x + 24, 296);
    });
    ctx.strokeStyle = hexToRgba(project.accent, 0.88);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(300, 288);
    ctx.lineTo(350, 288);
    ctx.moveTo(632, 288);
    ctx.lineTo(692, 288);
    ctx.stroke();
    ctx.fillStyle = hexToRgba(project.accent, 0.9);
    ctx.beginPath();
    ctx.moveTo(350, 288);
    ctx.lineTo(328, 272);
    ctx.lineTo(328, 304);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(692, 288);
    ctx.lineTo(670, 272);
    ctx.lineTo(670, 304);
    ctx.fill();
    for (let i = 0; i < 20; i += 1) {
      ctx.fillStyle = i < Math.round(project.progress / 5) ? hexToRgba(project.accent, 0.85) : "rgba(90,155,170,0.2)";
      ctx.fillRect(84 + i * 40, 388, 22, 20 + (i % 4) * 8);
    }
  });
}

function getFocusDockContent(project: ProjectModule, dock: FocusDock) {
  const ms = buildMilestoneSnapshot(project.cockpit);
  const monthly = buildMonthlySnapshot(project.cockpit);
  const actions = buildActionSnapshot(project.cockpit);
  const ready = project.cockpitReady ? "LIVE COCKPIT DATA" : "MOCK FALLBACK";
  const common = {
    status: {
      label: "PJ STATUS",
      title: "venture state / AMD score",
      subtitle: `${ready} / ${project.status}`,
      color: "#46f7ff",
      blocks: [
        { title: "STATUS", value: project.status, sub: "current operating state" },
        { title: "TYPE", value: project.lane, sub: "project type / client" },
        { title: "MEMBERS", value: `${project.cockpit?.members.length ?? 0}`, sub: "active cockpit members" },
        { title: "PERIOD", value: ms.period || "--", sub: "current plan cycle" },
      ],
    },
    ms: {
      label: "MS / GOALS",
      title: "milestone flow / value plan",
      subtitle: ms.period ? `active cycle ${ms.period}` : "value plan cycle",
      color: project.accent,
      blocks: [
        { title: "MS FLOW", value: `${ms.totalProgress || project.progress}%`, sub: `${ms.activeCount || 0} milestones` },
        { title: "NEXT", value: clipText(ms.nextTitle || project.next), sub: `${Math.round(ms.nextPct || 0)}% current` },
        { title: "POINTS", value: `${ms.totalPoints || 0}pt`, sub: "planned total" },
        { title: "OWNER", value: ms.owner || "AMD", sub: "responsibility map" },
      ],
    },
    monthly: {
      label: "MONTHLY",
      title: "monthly report / proof log",
      subtitle: `${monthly.ym} / ${clipText(monthly.note, "monthly cockpit")}`,
      color: "#ff5f91",
      blocks: [
        { title: "MONTH", value: monthly.ym, sub: "current billing cycle" },
        { title: "REPORT", value: monthly.report, sub: "monthly report state" },
        { title: "NUDGE", value: monthly.report, sub: "PM report check" },
        { title: "ADMIN", value: monthly.invoice, sub: "billing status" },
      ],
    },
    actions: {
      label: "ACTIONS",
      title: "kanban / nudge / founder decision",
      subtitle: `${actions.openTasks} open tasks / ${clipText(actions.nudge, "no nudge")}`,
      color: "#61ffb3",
      blocks: [
        { title: "KANBAN", value: clipText(actions.primary), sub: "front task" },
        { title: "NUDGE", value: clipText(actions.nudge, "none"), sub: "follow-up queue" },
        { title: "BLOCKER", value: clipText(actions.blocker, "clear"), sub: "open sub item" },
        { title: "OWNER", value: clipText(actions.owner, "AMD"), sub: "execution owner" },
      ],
    },
    ops: {
      label: "OPS",
      title: "invoice ops / cash state",
      subtitle: `${monthly.ym} report ${monthly.report} / invoice ${monthly.invoice}`,
      color: "#ffad57",
      blocks: [
        { title: "REPORT", value: monthly.report, sub: "report state" },
        { title: "INVOICE", value: monthly.invoice, sub: "invoice ops" },
        { title: "PAYMENT", value: monthly.payment, sub: "cash status" },
        { title: "BUDGET", value: monthly.budget, sub: "exception status" },
      ],
    },
  } satisfies Record<FocusDock, {
    label: string;
    title: string;
    subtitle: string;
    color: string;
    blocks: { title: string; value: string; sub: string }[];
  }>;

  return common[dock];
}

function getDockRows(project: ProjectModule, dock: FocusDock) {
  const ms = buildMilestoneSnapshot(project.cockpit);
  const monthly = buildMonthlySnapshot(project.cockpit);
  const actions = buildActionSnapshot(project.cockpit);
  switch (dock) {
    case "status":
      return [
        { label: "STATUS", value: project.status },
        { label: "TYPE", value: project.lane },
        { label: "MEMBERS", value: `${project.cockpit?.members.length ?? 0}` },
        { label: "PERIOD", value: ms.period || "--" },
        { label: "SOURCE", value: project.cockpitReady ? "Supabase cockpit" : "mock fallback" },
      ];
    case "ms":
      return [
        { label: "FLOW", value: `${ms.totalProgress || project.progress}%` },
        { label: "NEXT", value: ms.nextTitle || project.next },
        { label: "POINTS", value: `${ms.totalPoints || 0}pt` },
        { label: "OWNER", value: ms.owner || "AMD" },
      ];
    case "monthly":
      return [
        { label: "MONTH", value: monthly.ym },
        { label: "REPORT", value: monthly.report },
        { label: "NUDGE", value: monthly.report },
        { label: "ADMIN", value: monthly.invoice },
      ];
    case "actions":
      return [
        { label: "KANBAN", value: actions.primary },
        { label: "NUDGE", value: actions.nudge },
        { label: "BLOCKER", value: actions.blocker || "clear" },
        { label: "OWNER", value: actions.owner },
      ];
    case "ops":
      return [
        { label: "REPORT", value: monthly.report },
        { label: "INVOICE", value: monthly.invoice },
        { label: "PAYMENT", value: monthly.payment },
        { label: "BUDGET", value: monthly.budget },
      ];
  }
}

function createProjectFocusTexture(project: ProjectModule, activeDock: FocusDock) {
  return createTexture(1300, 600, (ctx) => {
    const focus = getFocusDockContent(project, activeDock);
    ctx.clearRect(0, 0, 1300, 600);
    fillPanelBase(ctx, 1300, 600, project.accent, true);

    ctx.fillStyle = "rgba(205,255,255,0.72)";
    ctx.font = "900 32px Arial";
    ctx.fillText("PJ COCKPIT SPATIAL VIEW", 74, 84);
    ctx.fillStyle = hexToRgba(focus.color, 0.96);
    ctx.font = "900 24px Orbitron, Arial";
    ctx.fillText(`ACTIVE DOCK / ${focus.label}`, 862, 84);

    ctx.fillStyle = "#f8ffff";
    ctx.shadowColor = project.accent;
    ctx.shadowBlur = 28;
    fitHudText(ctx, project.name.toUpperCase(), 72, 172, 760, 78, 52, "900", "Orbitron, Arial");
    ctx.shadowBlur = 0;

    ctx.fillStyle = hexToRgba(project.accent, 0.9);
    ctx.font = "900 34px Orbitron, Arial";
    ctx.fillText(`${project.code} / ${project.lane}`, 76, 226);
    ctx.fillStyle = "rgba(225,255,255,0.72)";
    ctx.font = "900 24px Arial";
    wrapHudText(ctx, focus.title.toUpperCase(), 760, 174, 430, 28, 1);
    ctx.fillStyle = hexToRgba(focus.color, 0.9);
    ctx.font = "800 20px Arial";
    wrapHudText(ctx, focus.subtitle, 762, 216, 430, 24, 1);

    const modules = [
      { x: 76, y: 292, w: 248, h: 154, ...focus.blocks[0] },
      { x: 364, y: 292, w: 286, h: 154, ...focus.blocks[1] },
      { x: 690, y: 292, w: 246, h: 154, ...focus.blocks[2] },
      { x: 974, y: 292, w: 238, h: 154, ...focus.blocks[3] },
    ];

    modules.forEach((module, index) => {
      ctx.fillStyle = hexToRgba(index === 1 ? focus.color : project.accent, index === 1 ? 0.18 : 0.1);
      ctx.strokeStyle = hexToRgba(index === 1 ? focus.color : project.accent, 0.82);
      ctx.lineWidth = 4;
      drawChamferRect(ctx, module.x, module.y, module.w, module.h, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(210,255,255,0.7)";
      ctx.font = "900 24px Arial";
      ctx.fillText(module.title, module.x + 26, module.y + 44);
      ctx.fillStyle = "#ffffff";
      fitHudText(ctx, module.value, module.x + 26, module.y + 94, module.w - 52, index === 1 ? 30 : 44, 20, "900", index === 1 ? "Arial" : "Orbitron, Arial");
      ctx.fillStyle = "rgba(220,255,255,0.52)";
      ctx.font = "800 20px Arial";
      ctx.fillText(module.sub.toUpperCase(), module.x + 26, module.y + module.h - 28);
    });

    ctx.strokeStyle = hexToRgba(project.accent, 0.86);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(100, 490);
    ctx.lineTo(392, 490);
    ctx.lineTo(422, 514);
    ctx.lineTo(780, 514);
    ctx.lineTo(812, 490);
    ctx.lineTo(1168, 490);
    ctx.stroke();

    const barCount = 30;
    for (let i = 0; i < barCount; i += 1) {
      const active = i < Math.round((project.progress / 100) * barCount);
      ctx.fillStyle = active ? hexToRgba(project.accent, 0.94) : "rgba(92,155,172,0.22)";
      ctx.fillRect(112 + i * 34, 526, 22, 18);
    }

    ctx.fillStyle = hexToRgba(project.accent, 0.9);
    ctx.font = "900 20px Orbitron, Arial";
    ctx.fillText("PJ COCKPIT CONTENT / NO PAGE TRANSITION", 742, 556);
  });
}

function createSpatialDockTexture(title: string, project: ProjectModule, rows: { label: string; value: string }[], active = false) {
  return createTexture(1100, 620, (ctx) => {
    ctx.clearRect(0, 0, 1100, 620);
    fillPanelBase(ctx, 1100, 620, active ? project.accent : "#46f7ff", active);

    ctx.fillStyle = "rgba(205,255,255,0.7)";
    ctx.font = "900 38px Arial";
    ctx.fillText(title, 74, 82);
    if (active) {
      ctx.fillStyle = hexToRgba(project.accent, 0.94);
      ctx.font = "900 22px Orbitron, Arial";
      ctx.fillText("LINKED TO CENTER COCKPIT", 646, 84);
    }

    ctx.fillStyle = "#f8ffff";
    ctx.shadowColor = project.accent;
    ctx.shadowBlur = 24;
    ctx.font = "900 68px Orbitron, Arial";
    ctx.fillText(project.code, 74, 166);
    ctx.shadowBlur = 0;

    rows.forEach((row, index) => {
      const y = 238 + index * (rows.length > 4 ? 66 : 76);
      const progress = Math.min(1, Math.max(0.14, (project.progress + index * 8) / 118));
      ctx.fillStyle = "rgba(210,255,255,0.64)";
      ctx.font = "900 26px Arial";
      ctx.fillText(row.label.toUpperCase(), 78, y);
      ctx.fillStyle = "#ffffff";
      fitHudText(ctx, row.value, 300, y, 590, 34, 20, "900", "Arial");
      ctx.fillStyle = "rgba(30,245,255,0.1)";
      ctx.fillRect(78, y + 32, 790, 20);
      ctx.fillStyle = hexToRgba(project.accent, 0.82);
      ctx.fillRect(78, y + 32, 790 * progress, 20);
      ctx.fillStyle = index % 2 === 0 ? "#ff5f8c" : hexToRgba(project.accent, 0.86);
      ctx.fillRect(914, y - 24, 112, 14);
      ctx.fillRect(914, y + 10, 72 + index * 22, 10);
    });

    ctx.strokeStyle = hexToRgba(project.accent, 0.86);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(74, 542);
    ctx.lineTo(348, 542);
    ctx.lineTo(390, 506);
    ctx.lineTo(780, 506);
    ctx.lineTo(822, 542);
    ctx.lineTo(1018, 542);
    ctx.stroke();
  });
}

function createModeTexture(project: ProjectModule) {
  return createTexture(520, 150, (ctx) => {
    ctx.clearRect(0, 0, 520, 150);
    fillPanelBase(ctx, 520, 150, project.accent);
    ctx.fillStyle = hexToRgba(project.accent, 0.88);
    ctx.font = "900 20px Orbitron, Arial";
    ctx.fillText(`FOCUS: ${project.code}`, 42, 54);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = project.accent;
    ctx.shadowBlur = 12;
    ctx.font = "900 36px Orbitron, Arial";
    ctx.fillText("OVERVIEW", 42, 102);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(220,255,255,0.58)";
    ctx.font = "800 16px Arial";
    ctx.fillText("TAP PANEL TO RETURN", 274, 100);
  });
}

function createKpiBankTexture({
  title,
  subtitle,
  metrics,
  align,
}: {
  title: string;
  subtitle: string;
  metrics: KpiModule[];
  align: "left" | "right";
}) {
  return createTexture(920, 660, (ctx) => {
    ctx.clearRect(0, 0, 920, 660);
    fillPanelBase(ctx, 920, 660, align === "left" ? "#46f7ff" : "#ffad57");
    ctx.textAlign = align;
    const x = align === "left" ? 70 : 850;
    ctx.fillStyle = "rgba(200,255,255,0.72)";
    ctx.font = "800 24px Arial";
    ctx.fillText(subtitle, x, 74);
    ctx.fillStyle = "#f6ffff";
    ctx.shadowColor = align === "left" ? "#46f7ff" : "#ffad57";
    ctx.shadowBlur = 18;
    ctx.font = "900 48px Orbitron, Arial";
    ctx.fillText(title, x, 126);
    ctx.shadowBlur = 0;
    metrics.forEach((metric, index) => {
      const y = 218 + index * 104;
      const labelX = align === "left" ? 248 : 766;
      const valueX = align === "left" ? 416 : 598;
      ctx.strokeStyle = hexToRgba(metric.accent, 0.72);
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (align === "left") {
        ctx.moveTo(250, y - 34);
        ctx.lineTo(748, y - 34);
        ctx.lineTo(816, y - 10);
      } else {
        ctx.moveTo(670, y - 34);
        ctx.lineTo(172, y - 34);
        ctx.lineTo(104, y - 10);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(210,255,255,0.75)";
      ctx.font = "800 21px Arial";
      ctx.fillText(metric.label, labelX, y);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = metric.accent;
      ctx.shadowBlur = 16;
      ctx.font = "900 48px Orbitron, Arial";
      ctx.fillText(metric.value, valueX, y + 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(210,255,255,0.58)";
      ctx.font = "700 18px Arial";
      ctx.fillText(metric.sub, labelX, y + 32);
    });
    ctx.textAlign = "left";
  });
}

function createAlertTexture() {
  return createTexture(760, 300, (ctx) => {
    ctx.clearRect(0, 0, 760, 300);
    fillPanelBase(ctx, 760, 300, "#ff5f91");
    ctx.fillStyle = "#ffb1ca";
    ctx.font = "900 28px Orbitron, Arial";
    ctx.fillText("NEXT ACTIONS", 44, 66);
    ctx.fillStyle = "rgba(235,255,255,0.8)";
    ctx.font = "700 24px Arial";
    ctx.fillText("Founder decision sync", 52, 126);
    ctx.fillText("Member bias required", 52, 174);
    ctx.fillText("Funding data source map", 52, 222);
  });
}

function createTickerTexture() {
  return createTexture(1500, 220, (ctx) => {
    ctx.clearRect(0, 0, 1500, 220);
    fillPanelBase(ctx, 1500, 220, "#46f7ff");
    ctx.fillStyle = "#8efcff";
    ctx.font = "900 28px Orbitron, Arial";
    ctx.fillText("PORTFOLIO STREAM", 58, 62);
    ctx.fillStyle = "rgba(235,255,255,0.9)";
    ctx.font = "800 34px Arial";
    ctx.fillText("CX: founder checkpoint  /  KUTE: MS proof  /  HZ: academic route  /  PT: value package  /  SE: seed intake", 58, 128);
    ctx.strokeStyle = "rgba(255,95,145,0.72)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(60, 174);
    ctx.lineTo(460, 174);
    ctx.lineTo(520, 198);
    ctx.lineTo(1440, 198);
    ctx.stroke();
  });
}

function createSelectedCockpitTexture(project: ProjectModule) {
  return createTexture(1000, 430, (ctx) => {
    ctx.clearRect(0, 0, 1000, 430);
    fillPanelBase(ctx, 1000, 430, project.accent);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(205,255,255,0.66)";
    ctx.font = "900 24px Arial";
    ctx.fillText("SELECTED MODULE", 900, 72);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = project.accent;
    ctx.shadowBlur = 22;
    ctx.font = "900 68px Orbitron, Arial";
    ctx.fillText(project.name.toUpperCase(), 900, 144);
    ctx.shadowBlur = 0;
    ctx.fillStyle = hexToRgba(project.accent, 0.9);
    ctx.font = "900 26px Orbitron, Arial";
    ctx.fillText(`${project.score} / VALUE LIFT ${project.lift}`, 900, 198);
    ctx.fillStyle = "rgba(230,255,255,0.78)";
    ctx.font = "700 28px Arial";
    ctx.fillText(project.next, 900, 266);
    ctx.fillStyle = "rgba(230,255,255,0.58)";
    ctx.font = "700 22px Arial";
    ctx.fillText("CLICK MODULES TO RE-ROUTE COCKPIT FOCUS", 900, 326);
    ctx.textAlign = "left";
  });
}

function drawChamferRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cut: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + width - cut, y);
  ctx.lineTo(x + width, y + cut);
  ctx.lineTo(x + width, y + height - cut);
  ctx.lineTo(x + width - cut, y + height);
  ctx.lineTo(x + cut, y + height);
  ctx.lineTo(x, y + height - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

function wrapHudText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;

  words.forEach((word, index) => {
    const testLine = line ? `${line} ${word}` : word;
    const isLast = index === words.length - 1;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount += 1;
    } else {
      line = testLine;
    }

    if ((isLast || lineCount >= maxLines - 1) && lineCount < maxLines) {
      const suffix = !isLast && lineCount === maxLines - 1 ? "..." : "";
      ctx.fillText(`${line}${suffix}`, x, y + lineCount * lineHeight);
      line = "";
      lineCount += 1;
    }
  });
}

function fitHudText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  startSize: number,
  minSize: number,
  weight: string,
  family: string,
) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  let display = text;
  if (ctx.measureText(display).width > maxWidth) {
    while (display.length > 1 && ctx.measureText(`${display}...`).width > maxWidth) {
      display = display.slice(0, -1);
    }
    display = `${display}...`;
  }
  ctx.fillText(display, x, y);
}

function fillPanelBase(ctx: CanvasRenderingContext2D, width: number, height: number, accent: string, active = false) {
  ctx.save();
  const inset = Math.max(18, Math.min(width, height) * 0.075);
  const notch = Math.max(18, Math.min(width, height) * 0.11);
  const panelPath = new Path2D();
  panelPath.moveTo(inset + notch, inset);
  panelPath.lineTo(width - inset - notch * 1.35, inset);
  panelPath.lineTo(width - inset, inset + notch);
  panelPath.lineTo(width - inset, height - inset - notch);
  panelPath.lineTo(width - inset - notch, height - inset);
  panelPath.lineTo(inset + notch, height - inset);
  panelPath.lineTo(inset, height - inset - notch);
  panelPath.lineTo(inset, inset + notch);
  panelPath.closePath();

  ctx.fillStyle = "rgba(0,4,12,0.98)";
  ctx.fill(panelPath);

  ctx.shadowColor = accent;
  ctx.shadowBlur = active ? 38 : 26;
  ctx.lineJoin = "miter";
  ctx.lineCap = "square";
  ctx.strokeStyle = hexToRgba(accent, active ? 0.52 : 0.34);
  ctx.lineWidth = active ? 30 : 22;
  ctx.stroke(panelPath);
  ctx.shadowBlur = active ? 20 : 12;
  ctx.strokeStyle = hexToRgba(accent, active ? 0.96 : 0.82);
  ctx.lineWidth = active ? 15 : 10;
  ctx.stroke(panelPath);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(232,255,255,0.92)";
  ctx.lineWidth = active ? 4 : 3;
  ctx.stroke(panelPath);

  ctx.clip(panelPath);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, hexToRgba(accent, active ? 0.36 : 0.24));
  gradient.addColorStop(0.26, "rgba(1,20,36,0.96)");
  gradient.addColorStop(0.68, "rgba(1,10,24,0.98)");
  gradient.addColorStop(1, "rgba(0,4,12,0.98)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = hexToRgba(accent, active ? 0.38 : 0.28);
  ctx.lineWidth = active ? 3 : 2;
  for (let y = inset + 26; y < height - inset - 18; y += 24) {
    ctx.beginPath();
    ctx.moveTo(inset + 34, y);
    ctx.lineTo(width - inset - 86 - ((Math.floor(y) / 24) % 3) * 34, y);
    ctx.stroke();
  }

  ctx.strokeStyle = hexToRgba(accent, active ? 0.74 : 0.5);
  ctx.lineWidth = active ? 6 : 4;
  ctx.beginPath();
  ctx.moveTo(inset + 52, height - inset - 34);
  ctx.lineTo(width * 0.36, height - inset - 34);
  ctx.lineTo(width * 0.41, height - inset - 60);
  ctx.lineTo(width * 0.66, height - inset - 60);
  ctx.lineTo(width * 0.72, height - inset - 34);
  ctx.lineTo(width - inset - 70, height - inset - 34);
  ctx.stroke();

  const topY = inset + 18;
  ctx.fillStyle = hexToRgba(accent, active ? 0.9 : 0.72);
  ctx.fillRect(inset + 32, topY, width * 0.16, active ? 12 : 8);
  ctx.fillRect(width - inset - width * 0.22, topY, width * 0.16, active ? 12 : 8);
  ctx.fillStyle = "rgba(240,255,255,0.82)";
  ctx.fillRect(inset + 34, topY + 3, width * 0.16, active ? 3 : 2);
  ctx.fillRect(width - inset - width * 0.22, topY + 3, width * 0.16, active ? 3 : 2);

  for (let i = 0; i < 18; i += 1) {
    ctx.fillStyle = i % 4 === 0 ? hexToRgba(accent, 0.82) : "rgba(160,245,255,0.2)";
    ctx.fillRect(inset + 34 + i * (width * 0.032), height - inset - 24, width * 0.018, 8 + (i % 4) * 5);
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(230,255,255,0.72)";
  const plates: [number, number, number, number][] = [
    [inset - 10, inset + notch * 0.26, 14, 62],
    [width - inset - 4, inset + notch * 0.3, 14, 72],
    [inset + 22, height - inset - 10, 82, 14],
    [width - inset - 122, inset - 10, 110, 14],
  ];
  plates.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
