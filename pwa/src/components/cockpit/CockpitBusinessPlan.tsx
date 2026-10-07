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

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  FileSpreadsheet,
  FlaskConical,
  Landmark,
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
const XRL_LABELS = Object.fromEntries(BUSINESS_PLAN_FORMAT.xrl.map((entry) => [entry.key, entry.label])) as Record<XrlKey, string>;
const MATRIX_LABEL = BUSINESS_PLAN_FORMAT.sections[0].label;

function SectionShell({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <section className={`min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`} style={style}>{children}</section>;
}

function XrlStrip({ target, keys }: { target: XrlTarget; keys?: readonly XrlKey[] }) {
  const visibleKeys = keys ?? XRL_KEYS;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5" aria-label="到達XRL">
      {visibleKeys.map((key) => (
        <span key={key} className="whitespace-nowrap font-mono text-[11px] font-medium tabular-nums text-slate-600">
          {XRL_LABELS[key]} {target[key] ?? "—"}
        </span>
      ))}
    </div>
  );
}

function PhaseHeader({ phase }: { phase: BusinessPlanPhase }) {
  return (
    <th scope="col" className="sticky top-0 z-20 border-b border-r border-slate-300 bg-slate-100 px-3 py-2 align-top text-slate-900 last:border-r-0">
      <div className="text-[12px] font-semibold leading-[18px]">{phase.label}</div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px] leading-4">
        <span className="tabular-nums text-slate-600">{phase.period}</span>
        <span className="font-semibold tabular-nums">{formatPlanYen(phase.budgetYen)}</span>
      </div>
      <div className="mt-2 border-t border-slate-300 pt-1.5 text-[12px] font-normal leading-[18px]">
        <div className="font-medium text-slate-800">{phase.openingRound}</div>
        <div className="mt-0.5 text-slate-600">{phase.fundingSource}</div>
      </div>
      <div className="mt-1.5"><XrlStrip target={phase.targetXrl} /></div>
      <div className="mt-1 text-[11px] font-normal leading-4 text-slate-600">{phase.burnLabel ?? "固定費バーン上限"} {formatPlanYen(phase.maxFixedBurnMonthlyYen)}/月</div>
    </th>
  );
}

function LaneCell({ phase, laneKey }: { phase: BusinessPlanPhase; laneKey: BusinessPlanLaneKey }) {
  const lane = phase.lanes[laneKey];
  return (
    <td className="border-r border-slate-200 p-0 align-top last:border-r-0">
      <div className="space-y-2 px-3 py-2 text-[12px] leading-[18px]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-slate-500">費用</span>
          <span className="font-semibold tabular-nums text-slate-900" aria-label={`費用 ${formatPlanYen(lane.costYen)}`}>{formatPlanYen(lane.costYen)}</span>
        </div>
        <ul className="space-y-1 text-slate-700">
          {lane.activities.map((activity) => <li key={activity} className="flex gap-1.5"><span aria-hidden="true" className="shrink-0 text-slate-400">•</span><span>{activity}</span></li>)}
        </ul>
      </div>
    </td>
  );
}

function LaneExitCell({ phase, laneKey }: { phase: BusinessPlanPhase; laneKey: BusinessPlanLaneKey }) {
  const lane = phase.lanes[laneKey];
  return <td className="border-b border-r border-slate-300 bg-slate-50/50 px-3 py-1.5 align-top text-[12px] leading-[18px] last:border-r-0">
    <p className="text-slate-800"><span className="mr-1 font-semibold text-sky-800">出口条件</span>{lane.exitGate || "未登録"}</p>
    <div className="mt-1"><XrlStrip target={phase.targetXrl} keys={lane.xrlKeys} /></div>
  </td>;
}

function PhaseMatrix({ projectName, plan, canDownload = true }: { projectName: string; plan: ProjectBusinessPlan | null; canDownload?: boolean }) {
  const phases = plan?.phases ?? [];
  const empty = phases.length === 0;
  return (
    <SectionShell style={{ maxWidth: empty ? 640 : 104 + phases.length * 260 }}>
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h2 className="text-base font-semibold text-slate-950">{MATRIX_LABEL}</h2>
        <p className="mt-1 max-w-5xl text-[12px] leading-[18px] text-slate-600">
          {empty
            ? "このPJのフェーズ計画は未登録。登録すると、フェーズごとの予算・調達・到達XRLと、4つのレーンの活動・出口条件がこの表に並ぶ。"
            : plan?.matrixNote ?? "フェーズごとの予算・調達・到達XRLと、4つのレーンの活動・出口条件。"}
        </p>
      </div>

      <div className="overflow-x-auto" data-testid="business-plan-phase-matrix" data-phase-count={phases.length}>
        <table className="w-full table-fixed border-separate border-spacing-0 text-left" style={{ minWidth: empty ? undefined : `${104 + phases.length * 260}px` }}>
          <colgroup><col style={{ width: 104 }} />{Array.from({ length: empty ? 1 : phases.length }, (_, i) => <col key={i} />)}</colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 border-b border-r border-slate-300 bg-slate-100 px-2 py-2 align-bottom text-slate-900">
                <span className="block text-[12px] font-semibold">開発レーン</span>
              </th>
              {empty ? (
                <th className="border-b border-slate-300 bg-slate-100 px-3 py-2 align-bottom text-[12px] font-semibold text-slate-600">フェーズ（未登録）</th>
              ) : (
                phases.map((phase) => <PhaseHeader key={phase.id} phase={phase} />)
              )}
            </tr>
          </thead>
          {BUSINESS_PLAN_FORMAT.lanes.map((lane) => {
            const Icon = LANE_ICONS[lane.key];
            return (
              <tbody key={lane.key}>
                <tr>
                  <th scope="rowgroup" rowSpan={empty ? 1 : 2} className="sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-50 px-2 py-2 align-top">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900"><Icon className="size-3.5 shrink-0 text-slate-500" />{lane.label}</div>
                  </th>
                  {empty
                    ? <td className="border-b border-slate-200 px-3 py-2 align-top text-[12px] text-slate-500">未登録</td>
                    : phases.map((phase) => <LaneCell key={phase.id} phase={phase} laneKey={lane.key} />)}
                </tr>
                {!empty && <tr>{phases.map((phase) => <LaneExitCell key={phase.id} phase={phase} laneKey={lane.key} />)}</tr>}
              </tbody>
            );
          })}
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
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

      <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] leading-4 text-slate-600">
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
    <SectionShell className="max-w-[1404px]">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h2 className="text-base font-semibold text-slate-950">{MATRIX_LABEL}</h2>
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
    <div className="min-w-0 space-y-2" data-testid="cockpit-business-plan">
      {current.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">{current.error}。再読み込みして。</p>
      ) : null}
      {current.plan === undefined ? <PhaseMatrixSkeleton /> : <PhaseMatrix projectName={projectName} plan={current.plan} canDownload={canDownload} />}
    </div>
  );
}
