"use client";

/**
 * Dashboard グリッド (= ダッシュボードの PJ 一覧)。
 *
 * 2026-05-12 まさ指摘の 3 件をまとめて反映:
 *   3. アラート (MTG未設定 / Report未確定 / 支払待ち) 表示を削除
 *   4. サイバー感 + AMD ロゴの六角形を活用したデザイン (白ベース維持)
 *   5. 「📑 全 PJ 紹介資料作成」ボタンをヘッダに新設、押下で AllPjIntroductionModal を開く
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashProject as GasProject, DashBillingStatus as GasBillingStatus } from "@/lib/supabase-data";
import { AllPjIntroductionModal } from "./AllPjIntroductionModal";

const STATUS_STYLE: Record<string, { text: string; ring: string; dot: string; label: string }> = {
  active: { text: "text-emerald-700", ring: "ring-emerald-300/70", dot: "bg-emerald-500", label: "ACTIVE" },
  sales:  { text: "text-cyan-700",    ring: "ring-cyan-300/70",    dot: "bg-cyan-500",    label: "SALES" },
  draft:  { text: "text-violet-700",  ring: "ring-violet-300/70",  dot: "bg-violet-500",  label: "DRAFT" },
  frozen: { text: "text-amber-700",   ring: "ring-amber-300/70",   dot: "bg-amber-500",   label: "FROZEN" },
  ended:  { text: "text-slate-500",   ring: "ring-slate-300/70",   dot: "bg-slate-400",   label: "ENDED" },
  lost:   { text: "text-rose-700",    ring: "ring-rose-300/70",    dot: "bg-rose-500",    label: "LOST" },
};
const STATUS_FALLBACK = { text: "text-slate-500", ring: "ring-slate-300/70", dot: "bg-slate-400", label: "—" };

interface DashboardGridProps {
  projects: GasProject[];
  billingStatus: Record<string, GasBillingStatus>;
}

/** 六角形 SVG (= AMD ロゴモチーフ)。カード装飾 / 背景 / ヘッダ用に使い回し */
function Hex({
  size = 24,
  stroke = "#0ea5e9",
  strokeWidth = 1.4,
  fill = "transparent",
  className,
}: {
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  className?: string;
}) {
  // pointy-top 六角形
  const w = size;
  const h = (size * 2) / Math.sqrt(3);
  const pts = [
    [w / 2, 0],
    [w, h / 4],
    [w, (3 * h) / 4],
    [w / 2, h],
    [0, (3 * h) / 4],
    [0, h / 4],
  ]
    .map((p) => p.join(","))
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className}>
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    </svg>
  );
}

/** ハニカム背景 (= 細い六角形を敷き詰めた SVG パターン)。decorative、pointer-events: none */
function HoneycombBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, opacity: 0.32 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="honeycomb" x="0" y="0" width="56" height="49" patternUnits="userSpaceOnUse">
          <polygon
            points="14,0.5 42,0.5 55.5,24.25 42,48 14,48 0.5,24.25"
            fill="none"
            stroke="#cffafe"
            strokeWidth="0.9"
          />
        </pattern>
        <linearGradient id="honeyfade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#honeycomb)" />
      <rect width="100%" height="100%" fill="url(#honeyfade)" />
    </svg>
  );
}

export function DashboardGrid({ projects, billingStatus }: DashboardGridProps) {
  const [introOpen, setIntroOpen] = useState(false);

  // Group by status
  const groups = useMemo(() => {
    const active = projects.filter((p) => p.status === "active");
    const sales = projects.filter((p) => p.status === "sales" || p.status === "draft");
    const other = projects.filter((p) => !["active", "sales", "draft"].includes(p.status));
    return { active, sales, other };
  }, [projects]);

  const stats = useMemo(() => {
    const meetingDone = projects.filter((p) => billingStatus[p.projectId]?.meetingDone).length;
    const reportDone = projects.filter((p) => billingStatus[p.projectId]?.reportDone).length;
    const invoiceDone = projects.filter((p) => billingStatus[p.projectId]?.invoiceDone).length;
    const paymentDone = projects.filter((p) => billingStatus[p.projectId]?.paymentDone).length;
    return {
      total: projects.length,
      active: groups.active.length,
      meetingDone,
      reportDone,
      invoiceDone,
      paymentDone,
    };
  }, [projects, billingStatus, groups]);

  return (
    <div className="relative">
      <HoneycombBg />

      <div className="relative z-10 space-y-6">
        {/* === ヘッダ === */}
        <header className="border border-slate-200 rounded-2xl bg-white/85 backdrop-blur-sm shadow-sm overflow-hidden">
          {/* サイバーアクセント上ライン */}
          <div className="h-[3px] bg-gradient-to-r from-cyan-400 via-sky-500 to-cyan-400" />
          <div className="px-5 py-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Hex size={32} stroke="#0ea5e9" strokeWidth={1.6} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Hex size={12} stroke="#0ea5e9" strokeWidth={1.2} fill="#0ea5e9" />
                </div>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.2em] text-cyan-700 font-mono">AMD · OS</div>
                <div className="text-[16px] font-semibold tracking-tight">Operations Cockpit</div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-5 ml-3 text-[10.5px] font-mono">
              <Stat k="PJ_TOTAL" v={stats.total} />
              <Stat k="ACTIVE" v={stats.active} accent="emerald" />
              <Stat k="MTG_DONE" v={`${stats.meetingDone}/${stats.total}`} />
              <Stat k="RPT_DONE" v={`${stats.reportDone}/${stats.total}`} />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setIntroOpen(true)}
                className="group relative text-[12px] font-medium px-3.5 py-1.5 rounded-md text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.4),0_4px_16px_-4px_rgba(14,165,233,0.5)] transition-all"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>📑</span>
                  <span>全 PJ 紹介資料作成</span>
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* === Active === */}
        {groups.active.length > 0 && (
          <SectionHeader title="Active" count={groups.active.length} accent="emerald">
            {groups.active.map((pj) => (
              <CyberProjectCard key={pj.projectId} project={pj} billing={billingStatus[pj.projectId]} />
            ))}
          </SectionHeader>
        )}

        {/* === Sales / Draft === */}
        {groups.sales.length > 0 && (
          <SectionHeader title="Sales / Draft" count={groups.sales.length} accent="cyan">
            {groups.sales.map((pj) => (
              <CyberProjectCard key={pj.projectId} project={pj} billing={billingStatus[pj.projectId]} />
            ))}
          </SectionHeader>
        )}

        {/* === Ended / Frozen 等 === */}
        {groups.other.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer flex items-center gap-2 text-[11.5px] font-mono uppercase tracking-[0.18em] text-slate-500 hover:text-slate-700 mb-3">
              <Hex size={14} stroke="#94a3b8" strokeWidth={1.2} />
              Ended / Frozen ({groups.other.length})
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {groups.other.map((pj) => (
                <CyberProjectCard key={pj.projectId} project={pj} billing={billingStatus[pj.projectId]} />
              ))}
            </div>
          </details>
        )}
      </div>

      {introOpen && (
        <AllPjIntroductionModal projects={projects} onClose={() => setIntroOpen(false)} />
      )}
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string | number; accent?: "emerald" }) {
  const color =
    accent === "emerald"
      ? "text-emerald-600 border-emerald-300/60"
      : "text-slate-600 border-slate-300/60";
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${color} bg-white/60`}>
      <span className="text-[9px] uppercase tracking-wider text-slate-500">{k}</span>
      <span className="font-semibold tabular-nums">{v}</span>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: "emerald" | "cyan";
  children: React.ReactNode;
}) {
  const hex = accent === "emerald" ? "#10b981" : "#06b6d4";
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Hex size={16} stroke={hex} strokeWidth={1.5} fill="#fff" />
        <Hex size={16} stroke={hex} strokeWidth={1.5} fill={hex} className="opacity-60" />
        <h2 className="text-[11.5px] font-mono uppercase tracking-[0.18em] text-slate-700">
          {title}
          <span className="ml-2 text-slate-400">[{count}]</span>
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 via-slate-200 to-transparent" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

function CyberProjectCard({
  project,
  billing,
}: {
  project: GasProject;
  billing?: GasBillingStatus;
}) {
  const st = STATUS_STYLE[project.status] ?? STATUS_FALLBACK;

  return (
    <Link href={`/project/${project.projectId}/cockpit`} className="block group">
      <div className="relative bg-white rounded-lg border border-slate-200 hover:border-cyan-400 transition-all overflow-hidden group-hover:shadow-[0_0_0_1px_rgba(6,182,212,0.35),0_8px_24px_-12px_rgba(6,182,212,0.45)]">
        {/* 左サイドのアクセントバー (status color) */}
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${st.dot}`} />

        {/* 右上の六角形装飾 */}
        <div className="absolute -top-1.5 -right-1.5 opacity-25 group-hover:opacity-50 transition-opacity">
          <Hex size={42} stroke="#0ea5e9" strokeWidth={1.2} />
        </div>

        {/* 内容 */}
        <div className="relative px-4 pt-3 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-slate-400">
                  {project.projectId.toUpperCase()}
                </span>
                <span className={`inline-flex items-center gap-1 text-[9.5px] font-mono uppercase tracking-wider ${st.text}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>
              <h3 className="text-[14.5px] font-semibold mt-0.5 truncate group-hover:text-cyan-700 transition-colors">
                {project.projectName}
              </h3>
              {project.clientName && (
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{project.clientName}</p>
              )}
            </div>
          </div>

          {/* フッタ: 月次ルーティンの進捗を 4 ドットで表示 (= アラートテキストの代わり) */}
          <div className="mt-3 flex items-center gap-1.5">
            <RoutineDot label="MTG" done={!!billing?.meetingDone} />
            <RoutineDot label="RPT" done={!!billing?.reportDone} />
            <RoutineDot label="INV" done={!!billing?.invoiceDone} />
            <RoutineDot label="PAY" done={!!billing?.paymentDone} />
            <span className="ml-auto text-[9.5px] font-mono text-slate-400 group-hover:text-cyan-500 transition-colors">
              OPEN ▸
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RoutineDot({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[9px] font-mono ${
        done
          ? "border-emerald-300/70 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-400"
      }`}
      title={done ? `${label} 完了` : `${label} 未完`}
    >
      <span className={`inline-block w-1 h-1 rounded-full ${done ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span>{label}</span>
    </div>
  );
}
