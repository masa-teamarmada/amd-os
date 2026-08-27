"use client";

import Link from "next/link";
import { useState } from "react";
import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";
import type { DashBillingStatus as GasBillingStatus, DashProject as GasProject } from "@/lib/supabase-data";
import { AllPjIntroductionModal } from "./AllPjIntroductionModal";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-[var(--desk-green-soft)] text-[var(--desk-green)] border-[rgba(37,108,85,0.22)]",
  sales: "bg-[var(--desk-blue-soft)] text-[var(--desk-blue)] border-[rgba(44,95,131,0.22)]",
  draft: "bg-[var(--desk-blue-soft)] text-[var(--desk-blue)] border-[rgba(44,95,131,0.22)]",
  ended: "bg-[rgba(146,141,130,0.14)] text-[var(--desk-muted)] border-[var(--desk-line)]",
  frozen: "bg-[var(--desk-amber-soft)] text-[var(--desk-amber)] border-[rgba(168,100,22,0.24)]",
  advisor: "bg-[var(--desk-violet-soft)] text-[var(--desk-violet)] border-[rgba(109,82,117,0.24)]",
};
/** PJ台帳の状態は画面では日本語で出す (DBの値をそのまま見せない)。 */
const STATUS_LABEL: Record<string, string> = {
  active: "稼働中", sales: "商談中", draft: "準備中",
  ended: "終了", frozen: "停止中", advisor: "顧問",
};

const STATUS_LEFT_BORDER: Record<string, string> = {
  active: "border-l-[var(--desk-green)]", sales: "border-l-[var(--desk-blue)]", draft: "border-l-[var(--desk-blue)]",
  ended: "border-l-[var(--desk-quiet)]", frozen: "border-l-[var(--desk-amber)]", advisor: "border-l-[var(--desk-violet)]",
};

interface DashboardGridProps {
  projects: GasProject[];
  billingStatus: Record<string, GasBillingStatus>;
  projectHrefPrefix?: string;
  currentSps?: Record<string, CurrentSpsProjectAssessment>;
  myProjectIds?: Set<string>;
}

export function DashboardGrid({ projects, billingStatus, projectHrefPrefix = "/project", currentSps = {}, myProjectIds = new Set() }: DashboardGridProps) {
  const [introOpen, setIntroOpen] = useState(false);
  const sorter = makePjSorter(myProjectIds, currentSps);
  const groups = [
    { title: "稼働中", rows: projects.filter((project) => project.status === "active").sort(sorter), open: true },
    { title: "商談・準備中", rows: projects.filter((project) => ["sales", "draft"].includes(project.status)).sort(sorter), open: true },
    { title: "終了・停止中", rows: projects.filter((project) => !["active", "sales", "draft"].includes(project.status)).sort(sorter), open: false },
  ];
  if (projects.length === 0) return <section className="dashboard-desk-section px-4 py-6 text-sm text-[var(--desk-muted)]">PJ台帳に表示できるPJはまだないよ。</section>;

  return <div className="space-y-4">
    {/* 見出しの無い行にボタンだけを右寄せすると、その行がまるごと余白になる。
        #pj-operations アンカーの着地点でもあるので、見出し行として使う。 */}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-[var(--desk-ink)]">
        PJ運用
        <span className="ml-2 rounded border border-[var(--desk-line)] bg-[var(--desk-panel-raised)] px-2 py-0.5 text-[11px] font-normal text-muted-foreground">{projects.length}件</span>
      </h2>
      <button onClick={() => setIntroOpen(true)} className="rounded-[7px] border border-[var(--desk-line)] bg-[var(--desk-panel-raised)] px-3 py-1.5 text-sm hover:bg-[var(--desk-sheet)]">📑 全PJの紹介資料をまとめて作る</button>
    </div>
    {introOpen ? <AllPjIntroductionModal projects={projects} onClose={() => setIntroOpen(false)} /> : null}
    {groups.filter((group) => group.rows.length > 0).map((group) => group.open ? <section key={group.title} className="dashboard-desk-section"><h2 className="dashboard-desk-section-title">{group.title} ({group.rows.length})</h2><div className="space-y-2">{group.rows.map((project) => <ProjectStripe key={project.projectId} project={project} billing={billingStatus[project.projectId]} assessment={currentSps[project.projectId]} hrefPrefix={projectHrefPrefix} isMine={myProjectIds.has(project.projectId)} />)}</div></section> : <details key={group.title} className="dashboard-desk-section"><summary className="dashboard-desk-section-title cursor-pointer">{group.title} ({group.rows.length})</summary><div className="mt-2 space-y-2">{group.rows.map((project) => <ProjectStripe key={project.projectId} project={project} billing={billingStatus[project.projectId]} assessment={currentSps[project.projectId]} hrefPrefix={projectHrefPrefix} isMine={myProjectIds.has(project.projectId)} />)}</div></details>)}
  </div>;
}

function makePjSorter(myProjectIds: Set<string>, currentSps: Record<string, CurrentSpsProjectAssessment>) {
  return (a: GasProject, b: GasProject) => {
    const mine = Number(!myProjectIds.has(a.projectId)) - Number(!myProjectIds.has(b.projectId));
    if (mine) return mine;
    const aScore = midpoint(currentSps[a.projectId]);
    const bScore = midpoint(currentSps[b.projectId]);
    if (aScore == null && bScore != null) return 1;
    if (aScore != null && bScore == null) return -1;
    return (bScore ?? 0) - (aScore ?? 0) || a.projectId.localeCompare(b.projectId);
  };
}

function midpoint(assessment?: CurrentSpsProjectAssessment) {
  if (!assessment || assessment.status !== "assessed" || assessment.sps_lower_yen == null || assessment.sps_upper_yen == null) return null;
  return (assessment.sps_lower_yen + assessment.sps_upper_yen) / 2;
}

function formatOku(value: number | null) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: value < 1_000_000_000 ? 1 : 0 }).format(value / 100_000_000)}億`;
}

function ProjectStripe({ project, billing, assessment, hrefPrefix, isMine }: { project: GasProject; billing?: GasBillingStatus; assessment?: CurrentSpsProjectAssessment; hrefPrefix: string; isMine: boolean }) {
  const roles = parseRoleLine(project.roleLine);
  const assessed = assessment?.status === "assessed";
  return <Link href={`${hrefPrefix}/${project.projectId}/cockpit`} className={`block overflow-hidden rounded-[8px] border border-[var(--desk-line)] border-l-4 ${STATUS_LEFT_BORDER[project.status] ?? "border-l-zinc-300"} ${isMine ? "bg-[rgba(223,238,230,0.52)]" : "bg-[rgba(255,253,247,0.86)]"} transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(55,47,32,0.12)]`}>
    <div className="grid grid-cols-12 items-center gap-3 px-3 py-2">
      <div className="col-span-4 min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-[10px] text-muted-foreground">{project.projectId}</span><h3 className="truncate text-sm font-semibold">{project.projectName}</h3><span className={`rounded border px-1.5 py-0.5 text-[9px] ${STATUS_BADGE[project.status] ?? ""}`}>{STATUS_LABEL[project.status] ?? project.status}</span>{isMine ? <span className="rounded border border-sky-300 bg-sky-100 px-1.5 py-0.5 text-[9px] text-sky-800">参画</span> : null}</div><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{project.clientName ?? "—"}</p></div>
      <div className="col-span-2 min-w-0 border-l border-[var(--desk-line)] pl-3 text-[10px]"><div className="text-[10px] text-muted-foreground">担当</div><div className="truncate">{[roles.pl !== "--" && `PL ${roles.pl}`, roles.pm !== "--" && `PM ${roles.pm}`, roles.closer !== "--" && `Closer ${roles.closer}`].filter(Boolean).join(" / ") || "—"}</div></div>
      <div className="col-span-4 border-l border-[var(--desk-line)] pl-3" title={assessment?.assessment_id ? `評価ID ${assessment.assessment_id}` : "現行版の評価がまだありません"}><div className="text-[10px] text-muted-foreground">現行SPS｜産業創出価値</div><div className={`mt-0.5 text-[13px] font-semibold ${assessed ? "text-[#174b42]" : "text-amber-700"}`}>{assessed ? `${formatOku(assessment?.sps_lower_yen ?? null)}〜${formatOku(assessment?.sps_upper_yen ?? null)}` : "最新版はまだ評価していません"}</div></div>
      <div className="col-span-2 border-l border-[var(--desk-line)] pl-3">{billing ? <><div className="mb-1 font-mono text-[9px] text-muted-foreground">{billing.ym?.slice(0, 4)}.{billing.ym?.slice(4, 6)}</div><div className="flex justify-between"><BillingStep done={billing.budgetDone} label="確" full="確定" /><BillingStep done={billing.reportDone} label="報" full="報告" /><BillingStep done={billing.invoiceDone} label="請" full="請求" /><BillingStep done={billing.paymentDone} label="入" full="入金" /></div></> : <div className="text-center text-[10px] text-muted-foreground">—</div>}</div>
    </div>
  </Link>;
}

function BillingStep({ done, label, full }: { done: boolean; label: string; full: string }) { return <span className="flex flex-col items-center gap-0.5" title={full}><span className={`h-2 w-2 rounded-full ${done ? "bg-emerald-500" : "bg-zinc-300"}`} /><span className="text-[8px] leading-none text-muted-foreground">{label}</span></span>; }
function parseRoleLine(roleLine?: string) { if (!roleLine) return { pl: "--", pm: "--", closer: "--" }; return { pl: (roleLine.match(/PL\s+([^/]+)/)?.[1] || "--").trim(), pm: (roleLine.match(/PM\s+([^/]+)/)?.[1] || "--").trim(), closer: (roleLine.match(/Closer\s+(.+)$/)?.[1] || "--").trim() }; }
