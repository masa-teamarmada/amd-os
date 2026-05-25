"use client";

/**
 * DashboardGrid — /dashboard の PJ 一覧 (= Active / Sales-Draft / Ended-Frozen)
 *
 * 2026-05-25 #71 後段再設計 (= まさ「重複 + しょぼ」指摘):
 *   各 PJ カードに従来情報 (= name + status + client) + 新規 (= PL/PM/Closer + AMD Score + sparkline + M/X/F + billing 5 dot) を merge。
 *   重複表示 (= 旧 ProjectSignalsCard) は廃止、本 ProjectCard に集約。
 *   border 左 4px で status カラー、Score sparkline は背景帯、icon 表示で情報量と読みやすさを両立。
 */
import Link from "next/link";
import { useState } from "react";
import type { DashProject as GasProject, DashBillingStatus as GasBillingStatus } from "@/lib/supabase-data";
import { AllPjIntroductionModal } from "./AllPjIntroductionModal";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-800 border-emerald-300",
  sales: "bg-sky-50 text-sky-800 border-sky-300",
  draft: "bg-sky-50 text-sky-800 border-sky-300",
  ended: "bg-zinc-100 text-zinc-700 border-zinc-300",
  frozen: "bg-amber-50 text-amber-800 border-amber-300",
  advisor: "bg-purple-50 text-purple-800 border-purple-300",
};

const STATUS_LEFT_BORDER: Record<string, string> = {
  active: "border-l-emerald-500",
  sales: "border-l-sky-500",
  draft: "border-l-sky-500",
  ended: "border-l-zinc-400",
  frozen: "border-l-amber-500",
  advisor: "border-l-purple-500",
};

interface DashboardGridProps {
  projects: GasProject[];
  billingStatus: Record<string, GasBillingStatus>;
  projectHrefPrefix?: string;
  variant?: "default" | "hud";
  scoreHistory?: Record<string, number[]>;
  signalMetrics?: Record<string, { m: number; x: number; f: number }>;
}

export function DashboardGrid({
  projects,
  billingStatus,
  projectHrefPrefix = "/project",
  variant = "default",
  scoreHistory = {},
  signalMetrics = {},
}: DashboardGridProps) {
  const [introOpen, setIntroOpen] = useState(false);

  const active = projects.filter((p) => p.status === "active");
  const sales = projects.filter((p) => p.status === "sales" || p.status === "draft");
  const other = projects.filter((p) => !["active", "sales", "draft"].includes(p.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setIntroOpen(true)}
          className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
            variant === "hud"
              ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/15"
              : "border-border bg-white hover:bg-muted/40"
          }`}
          title="チェックを入れた PJ のエグゼクティブサマリーを 1 つの HTML として出力"
        >
          📑 全 PJ 紹介資料作成
        </button>
      </div>

      {introOpen && <AllPjIntroductionModal projects={projects} onClose={() => setIntroOpen(false)} />}

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Active ({active.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {active.map((pj) => (
              <ProjectCard
                key={pj.projectId}
                project={pj}
                billing={billingStatus[pj.projectId]}
                hrefPrefix={projectHrefPrefix}
                scoreHistory={scoreHistory[pj.projectId] || []}
                metrics={signalMetrics[pj.projectId]}
              />
            ))}
          </div>
        </section>
      )}

      {sales.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Sales / Draft ({sales.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sales.map((pj) => (
              <ProjectCard
                key={pj.projectId}
                project={pj}
                billing={billingStatus[pj.projectId]}
                hrefPrefix={projectHrefPrefix}
                scoreHistory={scoreHistory[pj.projectId] || []}
                metrics={signalMetrics[pj.projectId]}
              />
            ))}
          </div>
        </section>
      )}

      {other.length > 0 && (
        <details className="group">
          <summary className="text-sm font-medium text-muted-foreground mb-3 cursor-pointer">
            Ended / Frozen ({other.length})
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
            {other.map((pj) => (
              <ProjectCard
                key={pj.projectId}
                project={pj}
                billing={billingStatus[pj.projectId]}
                hrefPrefix={projectHrefPrefix}
                scoreHistory={scoreHistory[pj.projectId] || []}
                metrics={signalMetrics[pj.projectId]}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  billing,
  hrefPrefix,
  scoreHistory,
  metrics,
}: {
  project: GasProject;
  billing?: GasBillingStatus;
  hrefPrefix: string;
  scoreHistory: number[];
  metrics?: { m: number; x: number; f: number };
}) {
  const roles = parseRoleLine(project.roleLine);
  const leftBorder = STATUS_LEFT_BORDER[project.status] ?? "border-l-zinc-300";
  const badgeClass = STATUS_BADGE[project.status] ?? "bg-zinc-50 text-zinc-700 border-zinc-300";
  const lastScore = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null;
  const prevScore = scoreHistory.length > 1 ? scoreHistory[scoreHistory.length - 2] : null;
  const trend = lastScore != null && prevScore != null ? (lastScore > prevScore ? "↗" : lastScore < prevScore ? "↘" : "→") : "";
  const trendColor = lastScore != null && prevScore != null ? (lastScore > prevScore ? "text-emerald-600" : lastScore < prevScore ? "text-rose-600" : "text-zinc-500") : "text-zinc-400";

  return (
    <Link
      href={`${hrefPrefix}/${project.projectId}/cockpit`}
      className={`relative block rounded-lg border border-border border-l-4 ${leftBorder} bg-card overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5`}
    >
      {/* sparkline 背景帯 */}
      {scoreHistory.length >= 2 && (
        <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none opacity-[0.08]">
          <Sparkline values={scoreHistory} className="w-full h-full" />
        </div>
      )}

      <div className="relative p-3 space-y-2">
        {/* 上段: code + name + status + client */}
        <div className="flex items-start gap-2">
          <span className="font-mono text-[10px] text-muted-foreground mt-0.5">{project.projectId}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold truncate">{project.projectName}</h3>
              <span className={`text-[10px] rounded border px-1.5 py-0.5 ${badgeClass}`}>{project.status}</span>
            </div>
            {project.clientName && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{project.clientName}</p>
            )}
          </div>
        </div>

        {/* 中段: PL/PM/Closer */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-y border-border/50 py-1">
          <RoleBadge label="PL" value={roles.pl} />
          <RoleBadge label="PM" value={roles.pm} />
          <RoleBadge label="Closer" value={roles.closer} />
        </div>

        {/* 下段: AMD Score + メトリクス */}
        <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
          <div>
            <div className="text-[9px] text-muted-foreground font-mono uppercase">AMD Score</div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-tight">{lastScore != null ? formatScore(lastScore) : "—"}</span>
              {trend && <span className={`text-xs font-bold ${trendColor}`}>{trend}</span>}
            </div>
          </div>
          {metrics && (
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <MetricCell label="M" value={metrics.m} />
              <MetricCell label="X" value={metrics.x} />
              <MetricCell label="F" value={metrics.f} />
            </div>
          )}
        </div>

        {/* billing 5 dot */}
        {billing && (
          <div className="flex items-center gap-1 text-[9px] pt-1">
            <span className="text-muted-foreground font-mono">{billing.ym?.slice(0, 4)}.{billing.ym?.slice(4, 6)}</span>
            <BillingDot done={billing.budgetDone} label="確定" />
            <BillingDot done={billing.meetingDone} label="報告" />
            <BillingDot done={billing.reportDone} label="月次" />
            <BillingDot done={billing.invoiceDone} label="請求" />
            <BillingDot done={billing.paymentDone} label="入金" />
          </div>
        )}
      </div>
    </Link>
  );
}

function RoleBadge({ label, value }: { label: string; value: string }) {
  const isUnset = !value || value === "--";
  return (
    <span className="flex items-center gap-1 min-w-0">
      <span className="font-mono text-[9px] uppercase opacity-60">{label}</span>
      <span className={`truncate ${isUnset ? "text-muted-foreground/50" : "text-foreground font-medium"}`}>{isUnset ? "—" : value}</span>
    </span>
  );
}

function MetricCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-muted/40 px-1.5 py-1 text-center">
      <div className="font-mono text-[9px] text-muted-foreground">{label}</div>
      <div className="text-[11px] font-semibold tabular-nums">{formatMetric(value)}</div>
    </div>
  );
}

function BillingDot({ done, label }: { done: boolean; label: string }) {
  return (
    <span className="flex items-center gap-0.5" title={label}>
      <span className={`inline-block w-2 h-2 rounded-full ${done ? "bg-emerald-500" : "bg-zinc-300"}`} />
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </span>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (!values || values.length < 2) {
    return <div className={className} />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" className="text-sky-600" />
    </svg>
  );
}

function parseRoleLine(roleLine?: string): { pl: string; pm: string; closer: string } {
  if (!roleLine) return { pl: "--", pm: "--", closer: "--" };
  const plMatch = roleLine.match(/PL\s+([^/]+)/);
  const pmMatch = roleLine.match(/PM\s+([^/]+)/);
  const closerMatch = roleLine.match(/Closer\s+(.+)$/);
  return {
    pl: (plMatch?.[1] || "--").trim(),
    pm: (pmMatch?.[1] || "--").trim(),
    closer: (closerMatch?.[1] || "--").trim(),
  };
}

function formatScore(v: number): string {
  if (Number.isNaN(v)) return "—";
  if (Math.abs(v) >= 10000) return Math.round(v).toLocaleString();
  return v.toFixed(0);
}

function formatMetric(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) >= 10) return v.toFixed(0);
  return v.toFixed(1);
}
