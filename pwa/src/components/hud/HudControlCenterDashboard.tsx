"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AllPjIntroductionModal } from "@/components/dashboard/AllPjIntroductionModal";
import { AAA_PROJECT_ID } from "@/lib/demo-aaa-data";
import type { DashBillingStatus, DashProject } from "@/lib/supabase-data";

type Props = {
  projects: DashProject[];
  billingStatus: Record<string, DashBillingStatus>;
  user?: HudUser;
  actionItems?: HudActionItem[];
  scoreHistory?: Record<string, number[]>;
  signalMetrics?: Record<string, { m: number; x: number; f: number }>;
  managementScore?: HudManagementScoreSnapshot | null;
  managementHistory?: HudManagementScoreSnapshot[];
};

type HudUser = {
  codeName: string;
  memberId: string | null;
  email: string | null;
};

type SignalProject = DashProject & {
  initials: string;
  isDemo?: boolean;
  x: number;
  f: number;
  m: number;
  xBar: number;
  fBar: number;
  mBar: number;
  hasSignalScore: boolean;
  health: number;
  initiative: number;
  currentScore: number;
  scoreSpark: number[];
};

export type HudActionItem = {
  title: string;
  meta: string;
  periodLabel: string;
  projectInitials: string;
  tone: "cyan" | "amber" | "red";
};

export type HudManagementScoreSnapshot = {
  ym: string | null;
  total_score: number | null;
  initiative_score: number | null;
  finance_score: number | null;
  retention_score: number | null;
  pipeline_score: number | null;
  direction_score: number | null;
  confidence: number | null;
};

const statusTone: Record<string, { label: string; color: string; glow: string }> = {
  active: { label: "ACTIVE", color: "#32e7ff", glow: "rgba(50,231,255,.42)" },
  sales: { label: "SALES", color: "#ffd15a", glow: "rgba(255,209,90,.35)" },
  draft: { label: "DRAFT", color: "#a78bfa", glow: "rgba(167,139,250,.32)" },
  frozen: { label: "FROZEN", color: "#ff5f7e", glow: "rgba(255,95,126,.38)" },
  ended: { label: "ENDED", color: "#8fb9c6", glow: "rgba(143,185,198,.24)" },
  lost: { label: "LOST", color: "#ff1d25", glow: "rgba(255,29,37,.36)" },
};

const primarySignalStatuses = new Set(["active", "ended"]);

const demoSignalProject: DashProject = {
  projectId: AAA_PROJECT_ID,
  projectName: "AAA",
  displayName: "AAA",
  shortLabel: "AAA",
  roleLine: "PL まさ / PM えいみ / Closer まさ",
  clientName: "Event Demo",
  status: "active",
  startYm: "202405",
  endYm: "202605",
};

function hashProject(projectId: string, offset = 0) {
  let hash = 0;
  for (let i = 0; i < projectId.length; i += 1) hash = (hash * 31 + projectId.charCodeAt(i) + offset) % 997;
  return hash;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function scoreFor(projectId: string, offset: number) {
  return 44 + (hashProject(projectId, offset) % 49);
}

function formatSignalValue(value: number) {
  if (!Number.isFinite(value)) return "--";
  return String(Math.round(value));
}

function scoreValue(value: number | null | undefined, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), 0, 100);
}

function projectInitials(projectName: string, projectId: string) {
  const ascii = projectName.match(/[A-Za-z0-9]+/g)?.join(" ") ?? "";
  if (ascii.trim() && !ascii.includes(" ") && ascii.trim().length <= 5) return ascii.trim().toUpperCase();
  if (ascii.trim()) {
    return ascii
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }
  return projectId.replace(/^p/i, "P").slice(0, 2).toUpperCase();
}

function formatYm() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString("ja-JP", { hour12: false });
}

function parseRoleLine(roleLine?: string | null) {
  const source = roleLine || "";
  const read = (label: "PL" | "PM" | "Closer") => {
    const match = source.match(new RegExp(`${label}\\s*([^/]+)`, "i"));
    return (match?.[1] || "--").trim();
  };
  return {
    pl: read("PL"),
    pm: read("PM"),
    closer: read("Closer"),
  };
}

function getBillingRatio(billingStatus: Record<string, DashBillingStatus>) {
  const values = Object.values(billingStatus);
  if (!values.length) return 0.71;
  const total = values.length * 4;
  const done = values.reduce(
    (sum, b) => sum + Number(b.meetingDone) + Number(b.reportDone) + Number(b.invoiceDone) + Number(b.paymentDone),
    0
  );
  return total ? done / total : 0.71;
}

function buildSignals(
  projects: DashProject[],
  scoreHistory: Record<string, number[]> = {},
  signalMetrics: Record<string, { m: number; x: number; f: number }> = {}
) {
  const sourceProjects = projects.some((p) => p.projectId === demoSignalProject.projectId)
    ? projects
    : [demoSignalProject, ...projects];
  const actualValues = Object.values(signalMetrics);
  const scaleValues = actualValues;
  const maxM = Math.max(1, ...scaleValues.map((v) => v.m).filter(Number.isFinite)) * 1.2;
  const maxX = Math.max(1, ...scaleValues.map((v) => v.x).filter(Number.isFinite)) * 1.2;
  const maxF = Math.max(1, ...scaleValues.map((v) => v.f).filter(Number.isFinite)) * 1.2;

  const signals = sourceProjects.map((p) => {
    if (p.projectId === demoSignalProject.projectId) {
      const actual = signalMetrics[p.projectId];
      const scoreSpark = scoreHistory[p.projectId] ?? [];
      const currentScore = scoreSpark.length ? scoreSpark[scoreSpark.length - 1] : 0;
      const x = actual?.x ?? 0;
      const f = actual?.f ?? 0;
      const m = actual?.m ?? 0;
      return {
        ...p,
        initials: "AAA",
        isDemo: true,
        x,
        f,
        m,
        xBar: actual ? metricBarPct(x, maxX) : 0,
        fBar: actual ? metricBarPct(f, maxF) : 0,
        mBar: actual ? metricBarPct(m, maxM) : 0,
        hasSignalScore: Boolean(actual),
        health: 96,
        initiative: 96,
        currentScore,
        scoreSpark,
      };
    }
    const actual = signalMetrics[p.projectId];
    const hasSignalScore = Boolean(actual);
    const x = actual?.x ?? 0;
    const f = actual?.f ?? 0;
    const m = actual?.m ?? 0;
    const mBar = hasSignalScore ? metricBarPct(m, maxM) : 0;
    const xBar = hasSignalScore ? metricBarPct(x, maxX) : 0;
    const fBar = hasSignalScore ? metricBarPct(f, maxF) : 0;
    const health = hasSignalScore ? clamp(Math.round((xBar + fBar + mBar) / 3), 1, 98) : 0;
    const initiative = hasSignalScore ? clamp(Math.round(health * 0.72 + scoreFor(p.projectId, 23) * 0.28), 12, 98) : scoreFor(p.projectId, 31);
    const scoreSpark = scoreHistory[p.projectId] ?? [];
    const currentScore = scoreSpark.length ? scoreSpark[scoreSpark.length - 1] : 0;
    return { ...p, initials: projectInitials(p.shortLabel || p.projectName, p.projectId), x, f, m, xBar, fBar, mBar, hasSignalScore, health, initiative, currentScore, scoreSpark };
  });
  return signals.sort((a, b) => {
    const scoreDiff = b.currentScore - a.currentScore;
    if (scoreDiff) return scoreDiff;
    const aActive = a.status === "active" ? 0 : 1;
    const bActive = b.status === "active" ? 0 : 1;
    return aActive - bActive || a.projectName.localeCompare(b.projectName, "ja");
  });
}

function metricBarPct(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return clamp(Math.round((value / max) * 100), 3, 100);
}

function buildQueue(projects: DashProject[], billingStatus: Record<string, DashBillingStatus>, actionItems: HudActionItem[] = []) {
  if (actionItems.length) return actionItems.slice(0, 5);
  const missing: HudActionItem[] = [];
  for (const project of projects) {
    const b = billingStatus[project.projectId];
    if (!b) continue;
    const base = { projectInitials: projectInitials(project.shortLabel || project.projectName, project.projectId), periodLabel: ymLabel(b.ym) };
    if (!b.reportDone) missing.push({ ...base, title: "月次報告書FIX", meta: `${project.projectId} / report`, tone: "amber" });
    if (!b.invoiceDone) missing.push({ ...base, title: "請求書送付", meta: `${project.projectId} / routine`, tone: "amber" });
    if (!b.paymentDone && b.invoiceDone) missing.push({ ...base, title: "入金確認", meta: `${project.projectId} / cash`, tone: "red" });
  }
  return [
    ...missing,
    { title: "創業者意思決定同期", meta: "CX / SE / SX", periodLabel: formatYm(), projectInitials: "AMD", tone: "red" as const },
    { title: "弱シグナル確認", meta: "policy / papers / news", periodLabel: formatYm(), projectInitials: "AT", tone: "cyan" as const },
    { title: "月次ルーティン実行", meta: formatYm(), periodLabel: formatYm(), projectInitials: "RT", tone: "cyan" as const },
  ].slice(0, 5);
}

function ymLabel(ym?: string | null) {
  if (!ym || ym.length < 6) return formatYm();
  return `${ym.slice(0, 4)}.${ym.slice(4, 6)}`;
}

function managementState(total: number) {
  if (total >= 75) return "GOOD";
  if (total >= 55) return "WATCH";
  return "ALERT";
}

function isLowConfidence(confidence: number | null | undefined) {
  if (confidence == null || !Number.isFinite(Number(confidence))) return false;
  const value = Number(confidence);
  return value <= 1 ? value < 0.6 : value < 60;
}

export function HudControlCenterDashboard({ projects, billingStatus, user, actionItems = [], scoreHistory = {}, signalMetrics = {}, managementScore = null, managementHistory = [] }: Props) {
  const [introOpen, setIntroOpen] = useState(false);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const signals = useMemo(() => buildSignals(projects, scoreHistory, signalMetrics), [projects, scoreHistory, signalMetrics]);
  const queue = useMemo(() => buildQueue(projects, billingStatus, actionItems), [projects, billingStatus, actionItems]);
  const primarySignals = signals
    .filter((p) => primarySignalStatuses.has(p.status))
    .sort((a, b) => b.currentScore - a.currentScore || a.projectName.localeCompare(b.projectName, "ja"));
  const secondarySignals = signals.filter((p) => !primarySignalStatuses.has(p.status));
  const active = projects.filter((p) => p.status === "active").length;
  const frozen = projects.filter((p) => p.status === "frozen").length;
  const sales = projects.filter((p) => p.status === "sales" || p.status === "draft").length;
  const ratio = getBillingRatio(billingStatus);
  const studioHealth = clamp(Math.round(active ? 62 + ratio * 28 - frozen * 3 : 58 + ratio * 18), 42, 98);
  const msFlow = clamp(Math.round(ratio * 100), 0, 100);
  const scoredSignals = signals.filter((p) => p.hasSignalScore);
  const avgX = scoredSignals.length ? Math.round(scoredSignals.reduce((sum, p) => sum + p.x, 0) / scoredSignals.length) : 0;
  const avgF = scoredSignals.length ? Math.round(scoredSignals.reduce((sum, p) => sum + p.f, 0) / scoredSignals.length) : 0;
  const avgM = scoredSignals.length ? Math.round(scoredSignals.reduce((sum, p) => sum + p.m, 0) / scoredSignals.length) : 0;
  const managementTotal = scoreValue(managementScore?.total_score, studioHealth);
  const managementMini = [
    ["先手力", scoreValue(managementScore?.initiative_score, active ? Math.round((active / Math.max(projects.length, 1)) * 100) : 0)],
    ["財務", scoreValue(managementScore?.finance_score, msFlow)],
    ["継続", scoreValue(managementScore?.retention_score, clamp(82 - frozen * 4, 42, 96))],
    ["新規", scoreValue(managementScore?.pipeline_score, clamp(56 + sales * 7, 48, 92))],
    ["方向", scoreValue(managementScore?.direction_score, 0)],
  ] as const;
  const directionScore = scoreValue(managementScore?.direction_score, 0);

  return (
    <div className="hud-control-center relative min-h-[calc(100vh-3.5rem)] overflow-hidden px-3 py-3 text-cyan-50 md:px-4">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(50,231,255,.16),transparent_26%),radial-gradient(circle_at_82%_8%,rgba(255,95,126,.08),transparent_22%),linear-gradient(115deg,#020812_0%,#061827_48%,#020812_100%)]" />
        <HudBackgroundDots />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
          <g fill="none" stroke="rgba(50,231,255,.28)" strokeWidth="1">
            <path d="M20 130H285l18 18h260l22-24h320l20 18h260l12-16h380" />
            <path d="M14 860H360l22 20h295l18-18h230l28 20h620" />
            <path d="M142 330h220l18-18h210l14 14h310l20-20h270" opacity=".55" />
            <path d="M1185 180h36v95h24v135h-28v188h26v118" opacity=".45" />
          </g>
        </svg>
      </div>

      {introOpen && <AllPjIntroductionModal projects={projects} onClose={() => setIntroOpen(false)} />}

      <div className="relative mx-auto flex w-full max-w-[1800px] flex-col gap-3">
        <ControlHeader user={user} onIntro={() => setIntroOpen(true)} />

        <section className="grid min-w-0 gap-2.5 xl:grid-cols-[minmax(292px,0.82fr)_minmax(610px,1.58fr)_minmax(278px,0.8fr)]">
          <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
            <HudPanel title="AMD Management Score" code="LIVE SCORE / AMD OS" variant="studio" className="min-h-[408px]">
              <StudioRing
                value={managementTotal}
                state={managementState(managementTotal)}
                ym={managementScore?.ym ?? null}
                directionScore={directionScore}
                lowConfidence={isLowConfidence(managementScore?.confidence)}
                live={Boolean(managementScore)}
                history={managementHistory}
              />
              <div className="-mt-8 grid grid-cols-5 gap-0">
                {managementMini.map(([label, value]) => (
                  <MiniRing key={label} label={String(label)} value={Number(value)} />
                ))}
              </div>
            </HudPanel>

            <HudPanel title="System Status" code="SYNC" variant="compact">
              <StatusRow label="Data Pipeline" value={projects.length ? "OK" : "WAIT"} dots={projects.length ? 18 : 7} />
              <StatusRow label="Integration" value={`${Object.keys(billingStatus).length} BC`} dots={Math.min(Object.keys(billingStatus).length, 18)} />
              <StatusRow label="Security" value="OK" dots={18} />
              <StatusRow label="Backup" value="OK" dots={16} />
            </HudPanel>
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
              <HudPanel title="Project Signal Board" code="XFM_CORE" variant="signal" className="min-h-[545px]">
                <div className="mb-1 flex justify-end gap-6 pr-8 font-mono text-[10px] font-black uppercase tracking-[0.13em]">
                <span className="text-cyan-200">M : Macrotrend</span>
                <span className="text-sky-300">X : XRL</span>
                <span className="text-rose-300">F : FRL</span>
              </div>
              <div className="hud-signal-scroll max-h-[480px] space-y-[3px] overflow-x-auto overflow-y-auto pr-1.5">
                {primarySignals.map((project, index) => (
                  <ProjectSignalRow key={project.projectId} project={project} index={index + 1} />
                ))}
                {secondarySignals.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setInactiveOpen((v) => !v)}
                      className="relative mb-1 flex h-8 w-full items-center justify-between border border-cyan-300/22 bg-[#020812]/70 px-3 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200/70 hover:bg-cyan-300/8"
                    >
                      <span>{inactiveOpen ? "▼" : "▶"} Other Project Files</span>
                      <span>{secondarySignals.length} FILES</span>
                    </button>
                    {inactiveOpen && secondarySignals.map((project, index) => (
                      <ProjectSignalRow key={project.projectId} project={project} index={primarySignals.length + index + 1} />
                    ))}
                  </div>
                )}
              </div>
            </HudPanel>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
            <HudPanel title="Next Action Queue" code="FILE_STACK" variant="queue" className="min-h-[382px]">
              <div className="space-y-2">
                {queue.map((item, index) => (
                  <ActionQueueItem key={`${item.title}-${index}`} item={item} index={index + 101} />
                ))}
              </div>
            </HudPanel>
            <AlertPanel count={queue.filter((q) => q.tone === "red").length} />
          </div>
        </section>

        <section className="grid min-w-0 gap-3 xl:grid-cols-[1.05fr_1fr_.86fr_1.1fr]">
          <AtlasStrip />
          <SeedsStrip />
          <VcStrip activeFunds={Math.max(12, sales + active)} />
          <ScoreVector x={avgX} f={avgF} m={avgM} />
        </section>

        <footer className="relative min-h-8 border border-cyan-300/20 bg-[#020812]/70 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/75">
          <VcPanelSvg />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <span className="text-cyan-300">Data synchronized</span>
            <span>{formatTime()}</span>
            <span>Team Armada / AMD OS HUD</span>
            <span>Secure Channel / TLS 1.3</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function HudBackgroundDots() {
  const dots = Array.from({ length: 54 }, (_, y) =>
    Array.from({ length: 92 }, (_, x) => {
      const n = (x * 37 + y * 61 + ((x * y) % 29)) % 100;
      return { x: 8 + x * 18, y: 8 + y * 18, o: n < 14 ? 0.04 : n < 38 ? 0.09 : n < 72 ? 0.15 : 0.24 };
    })
  ).flat();
  return (
    <svg className="absolute inset-0 h-full w-full opacity-80" viewBox="0 0 1660 980" preserveAspectRatio="none" aria-hidden="true">
      {dots.map((dot, idx) => (
        <circle key={idx} cx={dot.x} cy={dot.y} r={idx % 17 === 0 ? 1.4 : 1.05} fill="#7cf8ff" opacity={dot.o} />
      ))}
    </svg>
  );
}

function ControlHeader({ user, onIntro }: { user?: HudUser; onIntro: () => void }) {
  const [time, setTime] = useState(formatTime());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Tokyo" ? "JST" : "LOCAL";
  const displayUser = user?.codeName || "ONLINE";
  const memberCode = user?.memberId || "AUTH";
  return (
    <header className="relative grid min-h-[116px] grid-cols-[298px_minmax(520px,1fr)_390px] items-center gap-3 overflow-hidden bg-[#020812] px-1 font-mono shadow-[inset_0_0_42px_rgba(50,231,255,.10)] max-xl:grid-cols-[270px_minmax(360px,1fr)_330px] max-lg:grid-cols-1 max-lg:gap-2 max-lg:py-2">
      <ControlBrandFrame version="v2.6.0" />

      <div className="relative h-[112px] min-w-0 overflow-visible max-lg:order-first">
        <img
          src="/hud/control-center-rail-backplate-v2.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-auto w-full max-w-[1040px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-100"
        />
        <button
          onClick={onIntro}
          className="absolute bottom-[18px] left-1/2 z-10 h-5 w-36 -translate-x-1/2 opacity-0 focus:opacity-100 focus:outline focus:outline-1 focus:outline-cyan-300"
        >
          PJ Intro Export
        </button>
      </div>

      <ControlUserFrame time={time} tz={tz} userName={displayUser} memberCode={memberCode} />
    </header>
  );
}

function ControlBrandFrame({ version }: { version: string }) {
  return (
    <div className="relative h-[76px] min-w-0 overflow-hidden px-6 py-3">
      <BrandFrameSvg />
      <div className="relative">
        <p className="text-[25px] font-black uppercase leading-[0.88] tracking-[0.04em] text-cyan-100 drop-shadow-[0_0_12px_rgba(50,231,255,.86)]">
          AMD OS
        </p>
        <p className="mt-1 text-[8px] font-black uppercase leading-[0.9] tracking-[0.13em] text-cyan-300/82">Studio Operating System</p>
        <p className="mt-[3px] text-[8px] font-black uppercase leading-[0.9] tracking-[0.11em] text-cyan-300/78">{version} HUD</p>
      </div>
    </div>
  );
}

function ControlUserFrame({
  time,
  tz,
  userName,
  memberCode,
}: {
  time: string;
  tz: string;
  userName: string;
  memberCode: string;
}) {
  return (
    <div className="relative h-[96px] min-w-0 overflow-hidden px-6 py-4">
      <UserStatusFrameSvg />
      <div className="relative grid h-full grid-cols-[1fr_108px] gap-4">
        <div className="min-w-0 pt-1">
          <div className="mb-3 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-300/72">
            <span className="h-2.5 w-2.5 bg-cyan-300 shadow-[0_0_12px_rgba(50,231,255,.9)]" />
            <span>Online</span>
            <span className="text-cyan-500/60">/</span>
            <span className="truncate text-cyan-100">{userName}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 pr-1">
            {["ID:001", "admin ON", "db OK", memberCode].map((label, index) => (
              <div key={label} className="relative h-7 overflow-hidden border border-cyan-300/22 bg-cyan-300/6 px-1.5 pt-1">
                <span className={`absolute bottom-1 left-1 h-1 ${index === 0 ? "w-4" : index === 1 ? "w-6" : index === 2 ? "w-8" : "w-5"} bg-cyan-300/55 shadow-[0_0_8px_rgba(50,231,255,.65)]`} />
                <span className="relative block truncate text-[9px] font-black uppercase leading-none tracking-[0.02em] text-cyan-100/88">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[25px] font-black leading-none tracking-[0.08em] text-cyan-100 drop-shadow-[0_0_12px_rgba(50,231,255,.78)]">{time}</div>
          <div className="mt-2 inline-block border border-cyan-300/35 bg-cyan-300/8 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">{tz}</div>
          <div className="mt-2 truncate text-[10px] font-black uppercase tracking-[0.12em] text-cyan-300/65">{memberCode}</div>
        </div>
      </div>
    </div>
  );
}

function HudPanel({
  title,
  code,
  children,
  variant = "panel",
  className = "",
}: {
  title: string;
  code: string;
  children: React.ReactNode;
  variant?: "panel" | "studio" | "signal" | "queue" | "compact";
  className?: string;
}) {
  return (
    <section className={`relative min-w-0 overflow-hidden bg-[#020812]/72 p-2.5 shadow-[inset_0_0_34px_rgba(50,231,255,.08)] ${className}`}>
      <PanelFrameSvg variant={variant} />
      <div className="relative mb-1.5 flex items-center justify-between gap-3">
        <h2 className="font-mono text-[12px] font-black uppercase tracking-[0.12em] text-[#32e7ff] drop-shadow-[0_0_10px_rgba(50,231,255,.55)]">
          {title}
        </h2>
        <span className={`border border-cyan-300/30 bg-cyan-300/8 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200/75 ${variant === "signal" ? "opacity-0" : ""}`}>
          {code}
        </span>
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

function BrandFrameSvg() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 350 96" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="brandDots" width="14" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="rgba(50,231,255,.22)" />
        </pattern>
      </defs>
      <path d="M3 5H329L347 23V88H4Z" fill="rgba(2,8,18,.34)" stroke="rgba(50,231,255,.78)" strokeWidth=".8" />
      <path d="M4 5H28M331 6l16 17M4 88h24M347 72v16h-24" stroke="#32e7ff" strokeWidth=".82" filter="drop-shadow(0 0 2px rgba(50,231,255,.9))" />
      <rect x="16" y="14" width="302" height="65" fill="url(#brandDots)" opacity=".7" />
      <path d="M246 15h38M292 15h11M312 15h20M230 83h46M286 83h18" stroke="rgba(50,231,255,.36)" strokeWidth=".7" />
      <path d="M12 22h2M22 22h2M32 22h2M42 22h2" stroke="rgba(255,95,126,.66)" strokeWidth="1" />
    </svg>
  );
}

function UserStatusFrameSvg() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 390 96" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="userTicks" width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 1H4" stroke="rgba(50,231,255,.2)" strokeWidth="1" />
        </pattern>
      </defs>
      <path d="M26 4H386V80L369 93H27L4 70V20Z" fill="rgba(2,8,18,.34)" stroke="rgba(50,231,255,.72)" strokeWidth=".68" />
      <rect x="44" y="13" width="188" height="18" fill="url(#userTicks)" opacity=".7" />
      <path d="M23 5H76M338 4h48M5 20l21-16M369 93l17-13" stroke="#32e7ff" strokeWidth=".62" filter="drop-shadow(0 0 2px rgba(50,231,255,.9))" />
      <path d="M244 18h34M284 18h8M298 18h20M328 18h34M228 79h44M281 79h20M310 79h38" stroke="rgba(50,231,255,.44)" strokeWidth=".6" />
      <path d="M309 38h21M337 38h9M355 38h20M306 50h38M352 50h22" stroke="rgba(124,248,255,.40)" strokeWidth=".7" />
    </svg>
  );
}

function PanelFrameSvg({ variant: _variant }: { variant: "panel" | "studio" | "signal" | "queue" | "compact" }) {
  if (_variant === "studio") return <KpiPanelFrameSvg />;
  if (_variant === "signal") return <ProjectBoardFrameSvg />;
  if (_variant === "queue") return <QueueBoardFrameSvg />;
  return <VcPanelSvg />;
}

function KpiPanelFrameSvg() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 top-3 h-[calc(100%-12px)] w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="kpiPanelDots" width="4.8" height="4.8" patternUnits="userSpaceOnUse">
          <circle cx=".85" cy=".85" r=".26" fill="rgba(50,231,255,.23)" />
        </pattern>
      </defs>
      <path d="M1.3 4H94.2L98.6 9.4V95.8H5.8L1.3 90.6Z" fill="rgba(2,8,18,.20)" stroke="rgba(50,231,255,.34)" strokeWidth=".32" />
      <rect x="3.2" y="6.6" width="93.6" height="87" fill="url(#kpiPanelDots)" opacity=".24" />
      <path d="M1.4 4H18.5M94.2 4l4.4 5.4M1.4 90.6l4.4 5.2H20M78 95.8h20.5" stroke="rgba(50,231,255,.56)" strokeWidth=".5" />
      <path d="M5 4H12M33 4H47M72 4H76M2 89H4M11 95.8H24M83 95.8H96" stroke="rgba(124,248,255,.72)" strokeWidth=".62" />
    </svg>
  );
}

function ProjectBoardFrameSvg() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="signalBoardDots" width="4.2" height="4.2" patternUnits="userSpaceOnUse">
          <circle cx=".75" cy=".75" r=".22" fill="rgba(50,231,255,.22)" />
        </pattern>
      </defs>
      <path d="M1.2 6.2H34.2L38.4 2.8H72.8L77.2 6.2H97.2L99 8.8V94.2L96.2 97.2H3.4L1.2 94.4Z" fill="rgba(2,8,18,.20)" stroke="rgba(50,231,255,.34)" strokeWidth=".22" />
      <rect x="2.4" y="8" width="95.4" height="87.5" fill="url(#signalBoardDots)" opacity=".16" />
      <path d="M1.2 6.2H14.8M28.6 6.2H34.2L38.4 2.8H72.8L77.2 6.2H97.2L99 8.8M1.2 94.4L3.4 97.2H18.8M77 97.2H96.2L99 94.2" stroke="rgba(50,231,255,.54)" strokeWidth=".46" />
      <path d="M7 6.2H13M42 2.8H55M73 6.2H78M93 6.2H96M2 93H5M79 97.2H90M95 95H97" stroke="rgba(124,248,255,.72)" strokeWidth=".56" />
      <path d="M5.2 18H39M50 18H94M5.2 91H31M43 91H87M5.5 25.5H94.5M5.5 34H94.5M5.5 42.5H94.5M5.5 51H94.5M5.5 59.5H94.5M5.5 68H94.5M5.5 76.5H94.5M5.5 85H94.5" stroke="rgba(50,231,255,.105)" strokeWidth=".22" />
      <path d="M0 28h2.6M0 48h2.6M0 68h2.6M99 29h2.8M99 49h2.8M99 69h2.8" stroke="rgba(50,231,255,.66)" strokeWidth=".48" />
      <path d="M20 4.2h16M39 4.2h5M58 4.2h10M72 4.2h10M88 4.2h7M24 98.8h14M41 98.8h5M60 98.8h22" stroke="rgba(50,231,255,.42)" strokeWidth=".5" />
    </svg>
  );
}

function QueueBoardFrameSvg() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 top-3 h-[calc(100%-12px)] w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 5H94L98 10V93L94 97H6L3 94Z" fill="rgba(2,8,18,.22)" stroke="rgba(50,231,255,.34)" strokeWidth=".32" />
      <path d="M3 5H24M76 5H94L98 10M3 94L6 97H24M76 97H94L98 93" stroke="rgba(50,231,255,.56)" strokeWidth=".52" />
      <path d="M8 5H17M80 5H93M4 95H19M78 97H91" stroke="rgba(124,248,255,.72)" strokeWidth=".58" />
      <path d="M8 16H92M8 29H92M8 42H92M8 55H92M8 68H92M8 81H92" stroke="rgba(50,231,255,.11)" strokeWidth=".34" />
      <path d="M9 12h16M29 12h5M78 9h8M89 9h5" stroke="rgba(50,231,255,.28)" strokeWidth=".38" />
    </svg>
  );
}

function StudioRing({
  value,
  state,
  ym,
  directionScore,
  lowConfidence,
  live,
  history,
}: {
  value: number;
  state: "GOOD" | "WATCH" | "ALERT";
  ym: string | null;
  directionScore: number;
  lowConfidence: boolean;
  live: boolean;
  history: HudManagementScoreSnapshot[];
}) {
  const radius = 118;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  const stateTone = state === "ALERT" ? "text-rose-300" : state === "WATCH" ? "text-amber-200" : "text-cyan-300";
  const trendValues = history
    .map((snapshot) => scoreValue(snapshot.total_score, Number.NaN))
    .filter((score) => Number.isFinite(score));
  const trendPoints = trendValues.length >= 2 ? buildTrendPoints(trendValues, 98, 224, 116, 46) : "";
  return (
    <div className="relative mx-auto -mt-1 aspect-square max-w-[310px]">
      <svg viewBox="0 0 320 320" className="h-full w-full drop-shadow-[0_0_18px_rgba(50,231,255,.42)]" aria-hidden="true">
        <circle cx="160" cy="160" r="128" fill="rgba(6,24,39,.58)" stroke="rgba(50,231,255,.22)" strokeWidth="2" />
        {Array.from({ length: 72 }, (_, i) => {
          const a = (i / 72) * Math.PI * 2;
          const r1 = i % 6 === 0 ? 110 : 116;
          const r2 = 126;
          return (
            <line
              key={i}
              x1={160 + Math.cos(a) * r1}
              y1={160 + Math.sin(a) * r1}
              x2={160 + Math.cos(a) * r2}
              y2={160 + Math.sin(a) * r2}
              stroke={i % 9 === 0 ? "#ff5f7e" : "#32e7ff"}
              strokeWidth={i % 6 === 0 ? 3 : 1.4}
              opacity={i < 62 ? 0.9 : 0.28}
            />
          );
        })}
        <circle
          cx="160"
          cy="160"
          r={radius}
          fill="none"
          stroke="#32e7ff"
          strokeWidth="16"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="butt"
          transform="rotate(-90 160 160)"
        />
        <circle
          cx="160"
          cy="160"
          r="92"
          fill="none"
          stroke="rgba(124,248,255,.45)"
          strokeWidth="2"
          strokeDasharray="8 8"
        />
        {trendPoints && (
          <polyline points={trendPoints} fill="none" stroke="#32e7ff" strokeWidth="2.4" opacity=".82" />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center font-mono">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.2em] text-cyan-200/75">AMD Health</p>
          <p className="mt-2 text-5xl font-black leading-none text-cyan-50 drop-shadow-[0_0_18px_rgba(124,248,255,.8)]">{value}%</p>
          <p className={`mt-1 text-lg font-black uppercase tracking-[0.18em] ${stateTone}`}>{state}</p>
          <p className="mt-3 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-200/58">
            DIR {directionScore || "--"} / {ym ? ymLabel(ym) : "NO YM"}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-200/65">
            {live ? "Live score / AMD OS" : "Fallback / AMD OS"}
            {lowConfidence ? " / LOW CONF" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function buildTrendPoints(values: number[], x: number, y: number, width: number, height: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const px = x + (index / Math.max(values.length - 1, 1)) * width;
      const py = y - ((value - min) / span) * height;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
}

function MiniRing({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center font-mono">
      <svg viewBox="0 0 74 74" className="mx-auto h-12 w-12 sm:h-14 sm:w-14" aria-hidden="true">
        <circle cx="37" cy="37" r="28" fill="rgba(6,24,39,.55)" stroke="rgba(50,231,255,.2)" strokeWidth="2" />
        <circle
          cx="37"
          cy="37"
          r="25"
          fill="none"
          stroke="#32e7ff"
          strokeWidth="6"
          strokeDasharray={`${(value / 100) * 157} 157`}
          transform="rotate(-90 37 37)"
        />
        <text x="37" y="42" textAnchor="middle" fill="#e7fbff" fontSize="12" fontWeight="800">
          {value}%
        </text>
      </svg>
      <p className="mt-0 text-[8px] font-black uppercase leading-none tracking-[0.04em] text-cyan-200/72 sm:text-[9px]">{label}</p>
    </div>
  );
}

function StatusRow({ label, value, dots }: { label: string; value: string; dots: number }) {
  return (
    <div className="grid grid-cols-[110px_1fr_42px] items-center gap-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.08em]">
      <span className="text-cyan-200/80">{label}</span>
      <span className="flex gap-1">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className={`h-1.5 w-1.5 ${i < dots ? "bg-cyan-300 shadow-[0_0_8px_rgba(50,231,255,.8)]" : "bg-cyan-900/50"}`} />
        ))}
      </span>
      <span className="text-right text-cyan-100/80">{value}</span>
    </div>
  );
}

function ProjectSignalRow({ project, index }: { project: SignalProject; index: number }) {
  const tone = statusTone[project.status] ?? statusTone.ended;
  const roles = parseRoleLine(project.roleLine);
  return (
    <Link href={`/hud/project/${project.projectId}/cockpit`} className="group block">
      <div className="relative grid min-h-[78px] w-full min-w-[640px] grid-cols-[112px_minmax(0,1fr)_84px] items-center gap-x-2 gap-y-1 overflow-hidden px-3 py-2 transition hover:bg-cyan-300/6 lg:block lg:h-[78px] lg:min-w-[720px] lg:px-0 lg:py-0">
        <ProjectRowFrameSvg />
        <div className="relative row-span-2 grid h-[60px] place-items-center px-3 text-center font-mono text-[15px] font-black uppercase leading-none tracking-[0.02em] text-cyan-100 drop-shadow-[0_0_12px_rgba(50,231,255,.84)] lg:absolute lg:left-[3.9%] lg:top-[10px] lg:row-span-1 lg:h-[58px] lg:w-[14.3%] lg:px-2">
          <span className="block w-full translate-x-[1px] text-center">{project.projectId.toUpperCase()}-{project.initials}</span>
        </div>
        {project.hasSignalScore ? (
          <div className="relative col-start-2 row-start-2 space-y-0 self-start lg:absolute lg:left-[21.0%] lg:top-[14px] lg:w-[20.4%]">
            <MetricBar label="M" value={project.m} bar={project.mBar} color="#32e7ff" />
            <MetricBar label="X" value={project.x} bar={project.xBar} color="#2a9dff" />
            <MetricBar label="F" value={project.f} bar={project.fBar} color="#ff5f7e" />
          </div>
        ) : (
          <div className="relative col-start-2 row-start-2 grid h-[34px] place-items-center border border-cyan-300/16 bg-[#020812]/54 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200/38 lg:absolute lg:left-[21.0%] lg:top-[18px] lg:h-[42px] lg:w-[55.8%] lg:text-[10px] lg:tracking-[0.22em]">
            NO SCORE
          </div>
        )}
        {project.hasSignalScore && (
          <div className="hidden min-w-0 lg:absolute lg:left-[43.2%] lg:top-[13px] lg:grid lg:h-[52px] lg:w-[34.0%] lg:grid-cols-[minmax(0,1fr)_76px] lg:items-center lg:gap-2">
            <div className="min-w-0">
              <Sparkline values={project.scoreSpark} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[7px] font-black uppercase tracking-[0.16em] text-cyan-200/58">AMD SCORE</p>
              <p className="truncate font-mono text-[15px] font-black leading-none text-cyan-50 drop-shadow-[0_0_12px_rgba(50,231,255,.7)] lg:text-[16px]">
                {project.currentScore ? formatSparkValue(project.currentScore) : "--"}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase leading-none" style={{ color: tone.color, textShadow: `0 0 10px ${tone.glow}` }}>
                {tone.label}
              </p>
            </div>
          </div>
        )}
        <div className="relative col-start-3 row-span-2 min-w-0 self-center text-right lg:hidden">
          <p className="text-[7px] font-black uppercase tracking-[0.16em] text-cyan-200/58">AMD SCORE</p>
          <p className="truncate font-mono text-[15px] font-black leading-none text-cyan-50 drop-shadow-[0_0_12px_rgba(50,231,255,.7)] lg:text-[16px]">
            {project.currentScore ? formatSparkValue(project.currentScore) : "--"}
          </p>
          <p className="mt-1 text-[9px] font-black uppercase leading-none" style={{ color: tone.color, textShadow: `0 0 10px ${tone.glow}` }}>
            {tone.label}
          </p>
        </div>
        <div className="relative hidden justify-center lg:absolute lg:left-[74.8%] lg:top-[12px] lg:flex lg:w-[62px]">
          <ProjectInitiativeRing value={project.initiative} />
        </div>
        <div className="relative z-10 hidden min-w-0 font-mono text-[9px] font-black uppercase leading-[1.30] tracking-[0] text-cyan-100/82 lg:absolute lg:left-[82.6%] lg:top-[18px] lg:block lg:w-[13.6%]">
          <p className="truncate"><span className="text-cyan-300/70">PL:</span> {roles.pl}</p>
          <p className="truncate"><span className="text-cyan-300/70">PM:</span> {roles.pm}</p>
          <p className="truncate"><span className="text-cyan-300/70">CLOSER:</span> {roles.closer}</p>
        </div>
        <div className="absolute right-2 top-1 min-w-[60px] border border-cyan-300/46 bg-[#020812]/90 px-2 py-0.5 text-right font-mono text-[8px] font-black text-cyan-200/78 [clip-path:polygon(0_0,100%_0,100%_100%,10px_100%)] lg:min-w-[62px]">
          FILE_{String(index).padStart(3, "0")}
        </div>
      </div>
    </Link>
  );
}

function ProjectInitiativeRing({ value }: { value: number }) {
  const pct = clamp(value, 0, 100);
  return (
    <div className="relative hidden h-[54px] place-items-center font-mono lg:grid">
      <svg viewBox="0 0 64 64" className="h-[56px] w-[56px] drop-shadow-[0_0_12px_rgba(50,231,255,.34)]" aria-hidden="true">
        <circle cx="32" cy="32" r="24" fill="rgba(6,24,39,.48)" stroke="rgba(50,231,255,.20)" strokeWidth="2" />
        <circle
          cx="32"
          cy="32"
          r="21"
          fill="none"
          stroke="#32e7ff"
          strokeWidth="7"
          strokeDasharray={`${(pct / 100) * 132} 132`}
          strokeLinecap="butt"
          transform="rotate(-90 32 32)"
        />
        <circle cx="32" cy="32" r="13.5" fill="rgba(2,8,18,.92)" stroke="rgba(124,248,255,.30)" strokeWidth="1" />
        <text x="32" y="36" textAnchor="middle" fill="#e7fbff" fontSize="11" fontWeight="900">
          {pct}
        </text>
      </svg>
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[7px] font-black uppercase tracking-[0.08em] text-cyan-200/60">
        先手力
      </span>
    </div>
  );
}

function ProjectRowFrameSvg() {
  return (
    <img
      src="/hud/hud_project_row_integrated_frame_alpha_cropped_20260517.png"
      alt=""
      className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-95 mix-blend-screen"
      aria-hidden="true"
    />
  );
}

function InitialsBayFrameSvg() {
  return (
    <img
      src="/hud/hud_initials_frame_integrated_crop_lines_alpha_20260517.png"
      alt=""
      className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-95 mix-blend-screen"
      aria-hidden="true"
    />
  );
}

function MetricBar({ label, value, bar, color }: { label: string; value: number; bar: number; color: string }) {
  return (
    <div className="grid h-[14px] w-full grid-cols-[10px_minmax(0,1fr)_24px] items-center gap-1 font-mono text-[9px] font-black leading-none">
      <span style={{ color }}>{label}</span>
      <span className="h-[6px] border border-cyan-300/24 bg-[#020812]/60">
        <span className="block h-full" style={{ width: `${bar}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
      </span>
      <span className="text-left text-[9px] text-cyan-100/72">{formatSignalValue(value)}</span>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="relative h-10 w-full max-lg:hidden" aria-hidden="true">
        <path d="M0 52H100 M0 36H100 M0 20H100 M0 4H100" stroke="rgba(50,231,255,.10)" strokeWidth="1" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${52 - ((v - min) / span) * 44}`).join(" ");
  return (
    <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="relative h-10 w-full max-lg:hidden" aria-hidden="true">
      <path d="M0 52H100 M0 36H100 M0 20H100 M0 4H100" stroke="rgba(50,231,255,.12)" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="#32e7ff" strokeWidth="2" />
      <path d={`M${points} L100 56 L0 56 Z`} fill="rgba(50,231,255,.1)" />
    </svg>
  );
}

function formatSparkValue(value: number) {
  if (!Number.isFinite(value)) return "--";
  return Math.round(value).toLocaleString("en-US");
}

function ActionQueueItem({
  item,
  index,
}: {
  item: HudActionItem;
  index: number;
}) {
  const tone = item.tone === "red" ? "#ff5f7e" : item.tone === "amber" ? "#ffd15a" : "#32e7ff";
  return (
    <div className="relative min-h-[58px] bg-[#061827]/50 px-3 py-2 pl-[78px] font-mono">
      <QueueItemFrameSvg />
      <div className="absolute left-2 top-[12px] grid h-9 w-[62px] place-items-center px-1.5 font-mono text-[15px] font-black leading-none text-cyan-100 drop-shadow-[0_0_9px_rgba(50,231,255,.8)]">
        <InitialsBayFrameSvg />
        {item.projectInitials}
      </div>
      <div className="truncate text-sm font-black text-cyan-50">{item.title}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-cyan-300/70">{item.meta}</span>
        <span className="text-sm font-black" style={{ color: tone, textShadow: `0 0 10px ${tone}` }}>
          {item.periodLabel}
        </span>
      </div>
      <div className="absolute right-3 top-0 border border-cyan-300/25 bg-[#020812] px-2 py-0.5 text-[9px] font-black text-cyan-200/72">
        FILE_{index}
      </div>
    </div>
  );
}

function QueueItemFrameSvg() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 360 58" preserveAspectRatio="none" aria-hidden="true">
      <path d="M5 5H305L317 15H356V53H5Z" fill="rgba(4,20,32,.34)" stroke="rgba(50,231,255,.62)" strokeWidth=".48" />
      <path d="M5 5H108M238 5H305L317 15H356M5 53H318" stroke="#32e7ff" strokeWidth=".63" />
      <path d="M252 2H342L354 13H282L274 7H252Z" fill="rgba(2,8,18,.72)" stroke="rgba(50,231,255,.66)" strokeWidth=".45" />
      <path d="M45 16H220M45 34H190" stroke="rgba(50,231,255,.16)" strokeWidth=".4" />
    </svg>
  );
}

function AlertPanel({ count }: { count: number }) {
  const displayCount = Math.max(count, 1);
  return (
    <section className="relative min-h-[112px] overflow-hidden bg-[#120000]/78 p-2.5 text-red-50 shadow-[inset_0_0_34px_rgba(255,29,37,.14)]">
      <AlertFrameSvg />
      <div className="relative grid min-h-[88px] grid-cols-[44px_1fr_66px] gap-2.5 px-2 py-1">
        <svg viewBox="0 0 64 64" className="mt-[20px] h-8 w-8 drop-shadow-[0_0_13px_rgba(255,29,37,.75)]" aria-hidden="true">
          <path d="M32 9 57 54H7Z" fill="rgba(255,29,37,.05)" stroke="#ff1d25" strokeWidth="2.1" />
          <path d="M32 21.5v17" stroke="#ff3347" strokeWidth="3.4" strokeLinecap="square" />
          <circle cx="32" cy="47" r="2.3" fill="#ff3347" />
        </svg>
        <div className="min-w-0 font-mono">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ff1d25] drop-shadow-[0_0_8px_rgba(255,29,37,.65)]">System Alert</p>
          <div className="mt-1 border-y border-[#ff1d25]/24 py-1.5">
            <p className="text-[18px] font-black leading-none tracking-[0.02em] text-[#ff3347] drop-shadow-[0_0_12px_rgba(255,29,37,.7)]">{displayCount}件のアラート</p>
          </div>
          <div className="mt-2 space-y-0.5 text-[9px] font-black uppercase tracking-[0.05em] text-[#ff3347]/88">
            <p>予算超過リスク: PLANT TWIN</p>
            <p>検収遅延: SUPPLY X</p>
          </div>
        </div>
        <Link href="/hud/notifications" className="mt-7 grid h-7 place-items-center border border-[#ff1d25]/64 bg-[#ff1d25]/8 px-2 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#ff3347] hover:bg-[#ff1d25]/18">
          View
        </Link>
      </div>
    </section>
  );
}

function AlertFrameSvg() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M7 6H88L98 18V88L90 96H8L2 89V17Z" fill="rgba(24,0,0,.22)" stroke="rgba(255,29,37,.82)" strokeWidth=".42" />
      <path d="M7 6H36M53 6H88L98 18M2 17V34M2 72V89L8 96M72 96H90L98 88M98 18V36" stroke="#ff1d25" strokeWidth="1.18" />
      <path d="M13 27H88M13 63H88" stroke="rgba(255,51,71,.32)" strokeWidth=".42" />
      <path d="M39 20H88M39 56H88" stroke="rgba(255,29,37,.24)" strokeWidth=".32" />
      <g fill="#ff3347" opacity=".92">
        {Array.from({ length: 9 }, (_, i) => (
          <polygon key={`alert-hatch-${i}`} points={`${48 + i * 5.1},88 ${52 + i * 5.1},88 ${48.7 + i * 5.1},92 ${44.7 + i * 5.1},92`} />
        ))}
      </g>
      <path d="M31 8h8M42 8h4M54 94h26M84 94h10M5 6v10M2 84h5" stroke="rgba(255,51,71,.54)" strokeWidth=".45" />
      <path d="M42 10H52L55 7M86 7h8M90 94h8" stroke="rgba(255,95,126,.36)" strokeWidth=".42" />
    </svg>
  );
}

function AtlasStrip() {
  const nodes = [
    [14, 54, 9],
    [28, 66, 5],
    [38, 42, 15],
    [53, 68, 8],
    [67, 39, 11],
    [82, 55, 6],
  ];
  return (
    <HudPanel title="Atlas Signal Map" code="VIEW ATLAS">
      <Link href="/hud/atlas/macrotrends" className="absolute right-4 top-4 z-10 border border-cyan-300/35 bg-cyan-300/8 px-2 py-1 font-mono text-[10px] font-black uppercase text-cyan-100 hover:bg-cyan-300/15">
        Open
      </Link>
      <svg viewBox="0 0 100 72" className="h-40 w-full" aria-hidden="true">
        <path d="M14 54 28 66 38 42 53 68 67 39 82 55 M14 54 53 68 M28 66 67 39 M38 42 82 55" stroke="rgba(50,231,255,.32)" strokeWidth="1" />
        {nodes.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r / 2} fill={i === 2 ? "#ff5f7e" : "#32e7ff"} opacity=".92" filter="url(#atlasGlow)" />
        ))}
        <defs>
          <filter id="atlasGlow">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div className="flex flex-wrap gap-2 font-mono text-[10px] font-black text-cyan-200/75">
        <span className="text-rose-300">● バイオ</span>
        <span className="text-amber-300">● エネルギー</span>
        <span className="text-sky-300">● AI/ICT</span>
        <span>+ more</span>
      </div>
    </HudPanel>
  );
}

function SeedsStrip() {
  return (
    <HudPanel title="Seeds Pipeline" code="TOTAL_128">
      <div className="grid grid-cols-5 gap-2 font-mono">
        {[
          ["Discover", 42],
          ["Evaluate", 28],
          ["Validate", 19],
          ["Incubate", 11],
          ["Scale", 8],
        ].map(([label, value]) => (
          <div key={label} className="text-center">
            <p className="text-[10px] font-black uppercase text-cyan-200/70">{label}</p>
            <p className="mt-1 text-xl font-black text-cyan-100">{value}</p>
            <div className="mt-2 h-2 border border-cyan-300/20 bg-[#020812]/60">
              <div className="h-full bg-cyan-300 shadow-[0_0_10px_rgba(50,231,255,.65)]" style={{ width: `${Number(value) * 2}%` }} />
            </div>
          </div>
        ))}
      </div>
      <Link href="/hud/seeds" className="mt-5 inline-block border border-cyan-300/28 bg-cyan-300/8 px-2 py-1 font-mono text-[10px] font-black uppercase text-cyan-100">
        Hot topics / quantum sensing / AI robotics
      </Link>
    </HudPanel>
  );
}

function VcStrip({ activeFunds }: { activeFunds: number }) {
  const partners = ["Microsoft", "Google", "AWS", "NVIDIA"];
  return (
    <section className="relative min-w-0 overflow-hidden bg-[#020812]/76 p-4 font-mono shadow-[inset_0_0_34px_rgba(50,231,255,.08)]">
      <VcPanelSvg />
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black uppercase tracking-[0.13em] text-cyan-100 drop-shadow-[0_0_12px_rgba(50,231,255,.72)]">VC / Partner Network</h2>
        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-300/72">Active Fund {activeFunds}</span>
      </div>
      <div className="relative grid grid-cols-3 gap-3">
        {[
          ["Meetings", 12],
          ["Term Sheet", 5],
          ["Invested", 3],
        ].map(([label, value]) => (
          <VcRing key={label} label={String(label)} value={Number(value)} progress={Number(value) * 8} />
        ))}
      </div>
      <div className="relative my-4 h-px bg-cyan-300/16" />
      <p className="relative mb-3 text-[12px] font-black uppercase tracking-[0.12em] text-cyan-200/76">Top Partners</p>
      <Link href="/hud/vcs" className="relative flex flex-wrap gap-2 text-cyan-100/86">
        {partners.map((name) => (
          <span key={name} className="grid min-h-9 place-items-center border border-cyan-300/24 bg-[#041727]/72 px-3 text-sm font-black shadow-[0_0_10px_rgba(50,231,255,.08),inset_0_0_10px_rgba(50,231,255,.06)]">
            {name}
          </span>
        ))}
        <span className="grid min-h-9 w-11 place-items-center border border-cyan-300/24 bg-[#041727]/72 text-base font-black">...</span>
      </Link>
    </section>
  );
}

function VcRing({ label, value, progress }: { label: string; value: number; progress: number }) {
  const dash = (progress / 100) * 188;
  return (
    <div className="text-center">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.1em] text-cyan-200/78">{label}</p>
      <svg viewBox="0 0 88 88" className="mx-auto h-[72px] w-[72px] drop-shadow-[0_0_8px_rgba(50,231,255,.18)]" aria-hidden="true">
        <circle cx="44" cy="44" r="32" fill="rgba(2,8,18,.55)" stroke="rgba(50,231,255,.11)" strokeWidth="3" />
        <circle cx="44" cy="44" r="30" fill="none" stroke="rgba(50,231,255,.14)" strokeWidth=".8" />
        <circle cx="44" cy="44" r="30" fill="none" stroke="#32e7ff" strokeWidth="4" strokeDasharray={`${dash} ${188 - dash}`} strokeLinecap="butt" transform="rotate(-90 44 44)" opacity=".82" />
        <circle cx="44" cy="44" r="21" fill="rgba(2,8,18,.70)" stroke="rgba(124,248,255,.14)" strokeWidth=".8" />
        <text x="44" y="51" textAnchor="middle" fill="#e7fbff" fontSize="22" fontWeight="900">
          {value}
        </text>
      </svg>
    </div>
  );
}

function VcPanelSvg() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="vcPanelGlow">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="vcPanelDots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx=".8" cy=".8" r=".28" fill="rgba(50,231,255,.22)" />
        </pattern>
      </defs>
      <rect x="1.7" y="2" width="96.6" height="96" fill="rgba(2,8,18,.20)" stroke="rgba(50,231,255,.56)" strokeWidth=".52" />
      <rect x="3.2" y="4.8" width="93.6" height="90.4" fill="url(#vcPanelDots)" opacity=".14" />
      <path d="M2.2 10.5V2.5H14.5 M97.8 89.5v8H85.5 M2.2 89.5v8H14.5 M97.8 10.5V2.5H85.5" stroke="rgba(50,231,255,.72)" strokeWidth=".82" />
      <path d="M3.7 14.8H96.3 M3.7 62.5H96.3 M3.7 71.2H96.3" stroke="rgba(50,231,255,.14)" strokeWidth=".36" />
      <path d="M5 17H95 M5 27.5H95 M5 38H95 M5 48.5H95 M5 59H95" stroke="rgba(50,231,255,.052)" strokeWidth=".3" />
      <path d="M4 96.2h8M88 96.2h8M4 3.8h8M88 3.8h8" stroke="rgba(124,248,255,.58)" strokeWidth=".88" />
      <path d="M36 5.4h19M59 5.4h4M67 5.4h18" stroke="rgba(50,231,255,.24)" strokeWidth=".58" />
      <path d="M5 91.6h7M15 91.6h4M22 91.6h12M88 8.6h4M94 8.6h2" stroke="rgba(255,95,126,.42)" strokeWidth=".46" />
    </svg>
  );
}

function ScoreVector({ x, f, m }: { x: number; f: number; m: number }) {
  const px = 50 + Math.cos(-Math.PI / 2) * (x / 100) * 34;
  const py = 52 + Math.sin(-Math.PI / 2) * (x / 100) * 34;
  const pfX = 50 + Math.cos((Math.PI * 5) / 6) * (f / 100) * 34;
  const pfY = 52 + Math.sin((Math.PI * 5) / 6) * (f / 100) * 34;
  const pmX = 50 + Math.cos(Math.PI / 6) * (m / 100) * 34;
  const pmY = 52 + Math.sin(Math.PI / 6) * (m / 100) * 34;
  return (
    <HudPanel title="AMD Score Vector" code="DETAIL">
      <Link href="/hud/venture-map/amd-score/retrofit" className="absolute right-4 top-4 z-10 border border-cyan-300/35 bg-cyan-300/8 px-2 py-1 font-mono text-[10px] font-black uppercase text-cyan-100 hover:bg-cyan-300/15">
        Detail
      </Link>
      <div className="grid grid-cols-[150px_1fr] items-center gap-3">
        <svg viewBox="0 0 100 100" className="h-40 w-full" aria-hidden="true">
          <circle cx="50" cy="52" r="38" fill="rgba(6,24,39,.45)" stroke="rgba(50,231,255,.2)" strokeWidth="1.5" />
          <circle cx="50" cy="52" r="30" fill="none" stroke="rgba(50,231,255,.38)" strokeDasharray="4 3" />
          <polygon points={`${px},${py} ${pfX},${pfY} ${pmX},${pmY}`} fill="rgba(50,231,255,.18)" stroke="#32e7ff" strokeWidth="2" />
          <line x1="50" y1="52" x2={px} y2={py} stroke="#32e7ff" />
          <line x1="50" y1="52" x2={pfX} y2={pfY} stroke="#2a9dff" />
          <line x1="50" y1="52" x2={pmX} y2={pmY} stroke="#ff5f7e" />
          <text x="50" y="15" textAnchor="middle" fill="#32e7ff" fontSize="13" fontWeight="900">
            {x} X
          </text>
          <text x="18" y="88" textAnchor="middle" fill="#2a9dff" fontSize="13" fontWeight="900">
            {f} F
          </text>
          <text x="82" y="88" textAnchor="middle" fill="#ff5f7e" fontSize="13" fontWeight="900">
            {m} M
          </text>
        </svg>
        <div className="space-y-3">
          <TinyTrend color="#32e7ff" value="+8" />
          <TinyTrend color="#2a9dff" value="+5" />
          <TinyTrend color="#ff5f7e" value="+6" />
        </div>
      </div>
    </HudPanel>
  );
}

function TinyTrend({ color, value }: { color: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_34px] items-center gap-2">
      <svg viewBox="0 0 120 24" className="h-7 w-full" aria-hidden="true">
        <path d="M0 20 12 15 22 16 32 8 43 13 55 7 67 11 78 5 91 14 106 9 120 12" fill="none" stroke={color} strokeWidth="2" />
        <path d="M0 20 12 15 22 16 32 8 43 13 55 7 67 11 78 5 91 14 106 9 120 12 V24 H0Z" fill={color} opacity=".12" />
      </svg>
      <span className="font-mono text-sm font-black" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
