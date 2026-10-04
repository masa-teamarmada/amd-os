"use client";

/**
 * 事業計画タブ。全PJで同じ「フェーズマトリクス」を描く（spec 3-23）。
 *
 * - 区画・レーン・XRLの並びは src/lib/project-formats.ts の BUSINESS_PLAN_FORMAT（鍵付き）が正本。
 * - 中身（フェーズ・予算・調達・活動・出口条件）は project_business_plans から読む。PJごとにコードへ書かない
 *   （2026-10-03 まさ「全部統一してないとだめ。OSの大原則。中身があるときだけ出るタブってなに？」）。
 * - 中身が未登録のPJでも、表の枠（4レーン）と見出しは同じ形で出し、「未登録」と書く。
 * - 試算表と資本政策表は、更新の目的が異なるため独立タブに分ける。
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  FileSpreadsheet,
  FlaskConical,
  Landmark,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { BUSINESS_PLAN_FORMAT } from "@/lib/project-formats";
import {
  XRL_KEYS,
  formatPlanYen,
  type BusinessPlanLaneKey,
  type BusinessPlanPhase,
  type ProjectBusinessPlan,
  type XrlKey,
  type XrlTarget,
} from "@/lib/project-business-plan";
import { loadProjectBusinessPlan, peekProjectBusinessPlan } from "@/lib/project-business-plan-client";
import { downloadBusinessPlanPhaseMatrixXlsx } from "@/lib/project-business-plan-xlsx";

interface CockpitBusinessPlanProps {
  projectId: string;
  projectName: string;
  initialPlan?: ProjectBusinessPlan | null;
  canDownload?: boolean;
}

const LANE_ICONS: Record<BusinessPlanLaneKey, LucideIcon> = {
  business: BriefcaseBusiness,
  technology: FlaskConical,
  organization: UsersRound,
  funding: Landmark,
};
const LANE_ICON_CLASS = "border-indigo-200 bg-indigo-50 text-indigo-700";
const XRL_LABELS = Object.fromEntries(BUSINESS_PLAN_FORMAT.xrl.map((entry) => [entry.key, entry.label])) as Record<XrlKey, string>;
const MATRIX_LABEL = BUSINESS_PLAN_FORMAT.sections[0].label;

function SectionShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function XrlStrip({ target, keys }: { target: XrlTarget; keys?: readonly XrlKey[] }) {
  const visibleKeys = keys ?? XRL_KEYS;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="到達XRL">
      {visibleKeys.map((key) => (
        <span key={key} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 font-mono text-[10px] font-semibold tracking-tight text-slate-700">
          {XRL_LABELS[key]} {target[key] ?? "—"}
        </span>
      ))}
    </div>
  );
}

function PhaseHeader({ phase }: { phase: BusinessPlanPhase }) {
  return (
    <th className="sticky top-0 z-20 w-[270px] border-b border-r border-slate-700 bg-slate-950 px-4 py-4 align-top text-white last:border-r-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-bold leading-5">{phase.label}</div>
          <div className="mt-1 font-mono text-[10px] text-slate-400">{phase.period}</div>
        </div>
        <span className="shrink-0 rounded-md bg-indigo-200 px-2 py-1 text-[10px] font-black text-indigo-950">{formatPlanYen(phase.budgetYen)}</span>
      </div>
      <div className="mt-3 border-t border-slate-700 pt-3">
        <div className="text-[10px] font-semibold text-indigo-200">{phase.openingRound}</div>
        <div className="mt-1 min-h-8 text-[10px] font-normal leading-4 text-slate-400">{phase.fundingSource}</div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <XrlStrip target={phase.targetXrl} />
      </div>
      <div className="mt-2 text-[10px] font-normal text-slate-400">{phase.burnLabel ?? "固定費バーン上限"} {formatPlanYen(phase.maxFixedBurnMonthlyYen)}/月</div>
    </th>
  );
}

function LaneCell({ phase, laneKey }: { phase: BusinessPlanPhase; laneKey: BusinessPlanLaneKey }) {
  const lane = phase.lanes[laneKey];
  return (
    <td className="border-b border-r border-slate-200 p-0 align-top last:border-r-0">
      <div className="flex min-h-[245px] flex-col px-4 py-4">
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono text-sm font-black tabular-nums text-slate-950" aria-label={`費用 ${formatPlanYen(lane.costYen)}`}>{formatPlanYen(lane.costYen)}</span>
        </div>
        <ul className="mt-3 space-y-2 text-[11px] leading-[1.55] text-slate-700">
          {lane.activities.map((activity) => (
            <li key={activity} className="flex gap-2">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-indigo-500" />
              <span>{activity}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <ShieldCheck className="size-3" /> 次フェーズへの出口条件
            </div>
            <p className="mt-1 text-[11px] font-medium leading-4 text-slate-800">{lane.exitGate || "未登録"}</p>
          </div>
          <div className="mt-2"><XrlStrip target={phase.targetXrl} keys={lane.xrlKeys} /></div>
        </div>
      </div>
    </td>
  );
}

function PhaseMatrix({ projectName, plan, canDownload = true }: { projectName: string; plan: ProjectBusinessPlan | null; canDownload?: boolean }) {
  const phases = plan?.phases ?? [];
  const empty = phases.length === 0;
  return (
    <SectionShell>
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{MATRIX_LABEL}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {empty
            ? "このPJのフェーズ計画は未登録。登録すると、フェーズごとの予算・調達・到達XRLと、4つのレーンの活動・出口条件がこの表に並ぶ。"
            : plan?.matrixNote ?? "フェーズごとの予算・調達・到達XRLと、4つのレーンの活動・出口条件。"}
        </p>
      </div>

      <div className="overflow-x-auto" data-testid="business-plan-phase-matrix" data-phase-count={phases.length}>
        <table className={`w-full border-separate border-spacing-0 text-left ${empty ? "" : "min-w-[1500px]"}`}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-[156px] border-b border-r border-slate-200 bg-slate-950 px-4 py-4 align-bottom text-white">
                <span className="block text-sm font-bold">開発レーン</span>
              </th>
              {empty ? (
                <th className="border-b border-slate-700 bg-slate-950 px-4 py-4 align-bottom text-[13px] font-bold text-slate-300">フェーズ（未登録）</th>
              ) : (
                phases.map((phase) => <PhaseHeader key={phase.id} phase={phase} />)
              )}
            </tr>
          </thead>
          <tbody>
            {BUSINESS_PLAN_FORMAT.lanes.map((lane) => {
              const Icon = LANE_ICONS[lane.key];
              return (
                <tr key={lane.key}>
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-5 align-top">
                    <div className={`flex size-9 items-center justify-center rounded-xl border ${LANE_ICON_CLASS}`}><Icon className="size-4" /></div>
                    <div className="mt-3 text-[13px] font-bold text-slate-950">{lane.label}</div>
                  </th>
                  {empty ? (
                    <td className="border-b border-slate-200 px-4 py-5 align-top text-[12px] text-slate-500">未登録</td>
                  ) : (
                    phases.map((phase) => <LaneCell key={phase.id} phase={phase} laneKey={lane.key} />)
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
        <p className="text-[11px] leading-5 text-slate-500">{plan?.sourceNote ? `出典: ${plan.sourceNote}` : ""}</p>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 sm:min-h-10 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => downloadBusinessPlanPhaseMatrixXlsx(projectName, phases)}
          disabled={empty || !canDownload}
          data-testid="phase-matrix-xlsx-export"
        >
          <FileSpreadsheet className="size-3.5" /> Excel出力
        </button>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] leading-5 text-slate-600 sm:px-6">
        <div>
          <span className="font-semibold text-slate-800">GRL：SIP準拠のガバナンス成熟度（1〜8）</span>{" "}
          <a className="font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900" href="https://www8.cao.go.jp/cstp/stmain/pdf/230201_besshi_13_1.pdf" target="_blank" rel="noreferrer">内閣府SIPの定義</a>
        </div>
      </div>
    </SectionShell>
  );
}

function PhaseMatrixSkeleton() {
  return (
    <SectionShell>
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{MATRIX_LABEL}</h2>
        <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-[420px] animate-pulse bg-slate-50" aria-busy="true" />
    </SectionShell>
  );
}

interface PlanState {
  projectId: string;
  plan: ProjectBusinessPlan | null | undefined;
  error: string | null;
}

export function CockpitBusinessPlan({ projectId, projectName, initialPlan, canDownload = true }: CockpitBusinessPlanProps) {
  const [state, setState] = useState<PlanState>(() => ({ projectId, plan: initialPlan !== undefined ? initialPlan : peekProjectBusinessPlan(projectId), error: null }));
  const current: PlanState = state.projectId === projectId ? state : { projectId, plan: initialPlan !== undefined ? initialPlan : peekProjectBusinessPlan(projectId), error: null };

  useEffect(() => {
    if (initialPlan !== undefined) return;
    let cancelled = false;
    loadProjectBusinessPlan(projectId)
      .then((plan) => { if (!cancelled) setState({ projectId, plan, error: null }); })
      .catch((error: unknown) => {
        if (!cancelled) setState({ projectId, plan: null, error: error instanceof Error ? error.message : "事業計画を読み込めない" });
      });
    return () => { cancelled = true; };
  }, [projectId, initialPlan]);

  return (
    <div className="space-y-5" data-testid="cockpit-business-plan">
      {current.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">{current.error}。再読み込みして。</p>
      ) : null}
      {current.plan === undefined ? <PhaseMatrixSkeleton /> : <PhaseMatrix projectName={projectName} plan={current.plan} canDownload={canDownload} />}
    </div>
  );
}
