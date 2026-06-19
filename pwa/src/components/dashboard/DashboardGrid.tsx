"use client";

/**
 * DashboardGrid — /dashboard の PJ 一覧 (= Active / Sales-Draft / Ended-Frozen)
 *
 * 2026-05-25 #71 後段再々設計 (= まさ「横長 stripe + ソート」確定):
 *  - 縦長 grid 3 列 → 横長 stripe 1 行 1 PJ (= HUD 版風の比較検討しやすさ)
 *  - ソート: ユーザー参画 PJ を上、その中で AMD Score 降順
 *  - 1 行に集約: code + name + status + client | PL/PM/Closer | AMD Score + sparkline | M/X/F | billing 5 dot
 *  - 左 4px border カラーで status 判別、hover で背景強調
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
  scoreHistory?: Record<string, number[]>;
  primarySnapshots?: Record<string, DashboardPrimarySnapshot>;
  /** ログインユーザーが参画してる project_id の Set (= 上位表示) */
  myProjectIds?: Set<string>;
}

export interface DashboardPrimarySnapshot {
  score: number | null;
  status: "ready" | "missing";
  missingAxes: string[];
  legacyScore: number | null;
  components: {
    potential: number | null;
    reach: number | null;
    survival: number | null;
  };
}

export function DashboardGrid({
  projects,
  billingStatus,
  projectHrefPrefix = "/project",
  scoreHistory = {},
  primarySnapshots = {},
  myProjectIds = new Set(),
}: DashboardGridProps) {
  const [introOpen, setIntroOpen] = useState(false);

  const sorter = makePjSorter(myProjectIds, scoreHistory);
  const active = projects.filter((p) => p.status === "active").sort(sorter);
  const sales = projects.filter((p) => p.status === "sales" || p.status === "draft").sort(sorter);
  const other = projects.filter((p) => !["active", "sales", "draft"].includes(p.status)).sort(sorter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setIntroOpen(true)}
          className="text-sm px-3 py-1.5 rounded-md border border-border bg-white hover:bg-muted/40 transition-colors"
          title="チェックを入れた PJ のエグゼクティブサマリーを 1 つの HTML として出力"
        >
          📑 全 PJ 紹介資料作成
        </button>
      </div>

      {introOpen && <AllPjIntroductionModal projects={projects} onClose={() => setIntroOpen(false)} />}

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Active ({active.length})</h2>
          <div className="space-y-2">
            {active.map((pj) => (
              <ProjectStripe
                key={pj.projectId}
                project={pj}
                billing={billingStatus[pj.projectId]}
                hrefPrefix={projectHrefPrefix}
                scoreHistory={scoreHistory[pj.projectId] || []}
                primarySnapshot={primarySnapshots[pj.projectId]}
                isMine={myProjectIds.has(pj.projectId)}
              />
            ))}
          </div>
        </section>
      )}

      {sales.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Sales / Draft ({sales.length})</h2>
          <div className="space-y-2">
            {sales.map((pj) => (
              <ProjectStripe
                key={pj.projectId}
                project={pj}
                billing={billingStatus[pj.projectId]}
                hrefPrefix={projectHrefPrefix}
                scoreHistory={scoreHistory[pj.projectId] || []}
                primarySnapshot={primarySnapshots[pj.projectId]}
                isMine={myProjectIds.has(pj.projectId)}
              />
            ))}
          </div>
        </section>
      )}

      {other.length > 0 && (
        <details className="group">
          <summary className="text-sm font-medium text-muted-foreground mb-2 cursor-pointer">
            Ended / Frozen ({other.length})
          </summary>
          <div className="space-y-2 mt-2">
            {other.map((pj) => (
              <ProjectStripe
                key={pj.projectId}
                project={pj}
                billing={billingStatus[pj.projectId]}
                hrefPrefix={projectHrefPrefix}
                scoreHistory={scoreHistory[pj.projectId] || []}
                primarySnapshot={primarySnapshots[pj.projectId]}
                isMine={myProjectIds.has(pj.projectId)}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function makePjSorter(myProjectIds: Set<string>, scoreHistory: Record<string, number[]>) {
  return (a: GasProject, b: GasProject) => {
    // 1. 自分が参画してる PJ を上 (= true=0, false=1 → 小さい方が前)
    const aMine = myProjectIds.has(a.projectId) ? 0 : 1;
    const bMine = myProjectIds.has(b.projectId) ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    // 2. AMD Score 降順 (= 大きい方が前、null は最後)
    const aScore = lastScore(scoreHistory[a.projectId]);
    const bScore = lastScore(scoreHistory[b.projectId]);
    if (aScore == null && bScore == null) return a.projectId.localeCompare(b.projectId);
    if (aScore == null) return 1;
    if (bScore == null) return -1;
    return bScore - aScore;
  };
}

function lastScore(history?: number[]): number | null {
  if (!history || history.length === 0) return null;
  return history[history.length - 1];
}

function ProjectStripe({
  project,
  billing,
  hrefPrefix,
  scoreHistory,
  primarySnapshot,
  isMine,
}: {
  project: GasProject;
  billing?: GasBillingStatus;
  hrefPrefix: string;
  scoreHistory: number[];
  primarySnapshot?: DashboardPrimarySnapshot;
  isMine: boolean;
}) {
  const roles = parseRoleLine(project.roleLine);
  const leftBorder = STATUS_LEFT_BORDER[project.status] ?? "border-l-zinc-300";
  const badgeClass = STATUS_BADGE[project.status] ?? "bg-zinc-50 text-zinc-700 border-zinc-300";
  const prsReady = primarySnapshot?.status === "ready" && primarySnapshot.score != null;
  const lastScoreV = prsReady ? primarySnapshot.score : null;
  const prevScore = prsReady && scoreHistory.length > 1 ? scoreHistory[scoreHistory.length - 2] : null;
  const trend = lastScoreV != null && prevScore != null ? (lastScoreV > prevScore ? "↗" : lastScoreV < prevScore ? "↘" : "→") : "";
  const trendColor = lastScoreV != null && prevScore != null ? (lastScoreV > prevScore ? "text-emerald-600" : lastScoreV < prevScore ? "text-rose-600" : "text-zinc-500") : "text-zinc-400";
  const primaryStatusLabel =
    primarySnapshot?.status === "missing"
      ? "P / R_net 入力待ち"
      : primarySnapshot?.status === "ready"
        ? "ready"
        : "review 待ち";

  // 2026-05-25 #71 v3 まさ確定: PL/PM/Closer を 1 行 inline (= 「PL まさ / PM かる / Closer ちこ」)、スペース節約
  const rolesInline = [
    roles.pl !== "--" && `PL ${roles.pl}`,
    roles.pm !== "--" && `PM ${roles.pm}`,
    roles.closer !== "--" && `Closer ${roles.closer}`,
  ].filter(Boolean).join(" / ") || "—";

  return (
    <Link
      href={`${hrefPrefix}/${project.projectId}/cockpit`}
      className={`relative block rounded-lg border border-border border-l-4 ${leftBorder} ${isMine ? "bg-sky-50/30 ring-1 ring-sky-200/60" : "bg-card"} overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5`}
    >
      {/* 固定 12 列 grid: 各列幅は project 間で揃う。col-span 再配分 (= 3/2/3/2/2 = 12)
          M/X/F と billing が狭くて縦書き化してたので幅増やす */}
      <div className="grid grid-cols-12 gap-3 items-center px-3 py-2">
        {/* === 識別: col-span-3 === */}
        <div className="col-span-3 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground">{project.projectId}</span>
            <h3 className="text-sm font-semibold truncate">{project.projectName}</h3>
            <span className={`text-[9px] rounded border px-1.5 py-0.5 ${badgeClass}`}>{project.status}</span>
            {isMine && <span className="text-[9px] rounded border border-sky-300 bg-sky-100 text-sky-800 px-1.5 py-0.5">参画</span>}
          </div>
          {project.clientName && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{project.clientName}</p>}
        </div>

        {/* === 担当: col-span-2 (= inline 1 行で省スペース) === */}
        <div className="col-span-2 border-l border-border/50 pl-3 text-[10px] min-w-0">
          <div className="text-[9px] text-muted-foreground font-mono uppercase">担当</div>
          <div className="truncate text-foreground" title={rolesInline}>{rolesInline}</div>
        </div>

        {/* === PRS primary + sparkline: col-span-3 === */}
        <div className="col-span-3 flex items-center gap-2 border-l border-border/50 pl-3 min-w-0">
          <div className="flex flex-col shrink-0">
            <div className="text-[9px] text-muted-foreground font-mono uppercase">PRS Primary</div>
            <div className="flex items-baseline gap-1 min-h-[28px]">
              <span className="text-lg font-bold leading-none">{lastScoreV != null ? formatScore(lastScoreV) : "—"}</span>
              {trend && <span className={`text-xs font-bold ${trendColor}`}>{trend}</span>}
            </div>
            <div className="text-[9px] text-muted-foreground">{primaryStatusLabel}</div>
            {primarySnapshot?.legacyScore != null && (
              <div className="text-[9px] text-muted-foreground font-mono uppercase">
                legacy {formatScore(primarySnapshot.legacyScore)}
              </div>
            )}
          </div>
          <Sparkline values={prsReady ? scoreHistory : []} className="h-7 flex-1 min-w-[60px] text-sky-500" />
        </div>

        {/* === P/R/S components: col-span-2 === */}
        <div className="col-span-2 border-l border-border/50 pl-3">
          {primarySnapshot?.components ? (
            <>
              <div className="mb-1 text-[9px] text-muted-foreground font-mono uppercase">PRS P/R/S</div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <MetricCell label="P" value={primarySnapshot.components.potential} />
                <MetricCell label="R" value={primarySnapshot.components.reach} />
                <MetricCell label="S" value={primarySnapshot.components.survival} />
              </div>
            </>
          ) : (
            <div className="text-[10px] text-muted-foreground text-center">—</div>
          )}
        </div>

        {/* === billing 4 dot: col-span-2 === */}
        <div className="col-span-2 border-l border-border/50 pl-3">
          {billing ? (
            <>
              <div className="text-[9px] text-muted-foreground font-mono mb-1">{billing.ym?.slice(0, 4)}.{billing.ym?.slice(4, 6)}</div>
              <div className="flex items-center justify-between gap-0.5">
                <BillingStep done={billing.budgetDone} label="確" full="確定" />
                <BillingStep done={billing.reportDone} label="報" full="報告" />
                <BillingStep done={billing.invoiceDone} label="請" full="請求" />
                <BillingStep done={billing.paymentDone} label="入" full="入金" />
              </div>
            </>
          ) : (
            <div className="text-[10px] text-muted-foreground text-center">—</div>
          )}
        </div>
      </div>
    </Link>
  );
}

function MetricCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded bg-muted/40 px-1 py-0.5 text-center leading-tight">
      <div className="font-mono text-[8px] text-muted-foreground">{label}</div>
      <div className="text-[10px] font-semibold">{value == null ? "—" : formatMetric(value)}</div>
    </div>
  );
}

/** billing 5 step (= 縦書き化を回避: 1 文字短縮ラベル + title で full 表示) */
function BillingStep({ done, label, full }: { done: boolean; label: string; full: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5" title={full}>
      <span className={`inline-block w-2 h-2 rounded-full ${done ? "bg-emerald-500" : "bg-zinc-300"}`} />
      <span className="text-[8px] text-muted-foreground leading-none">{label}</span>
    </span>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  // 2026-05-25 #71 v3 まさ「線の太さがバラバラで気持ち悪い」確定:
  // preserveAspectRatio="none" + 異なる横幅 container で stroke が non-uniform scale されてた
  // → vector-effect="non-scaling-stroke" を polyline に追加して常に 2.5px 均一に
  if (!values || values.length < 2) return <div className={className} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 90 - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
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
  return Math.round(v).toLocaleString();
}

function formatMetric(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString();
}
