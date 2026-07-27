"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CircleAlert,
  Factory,
  FlaskConical,
  Landmark,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { CompanyOverviewData } from "@/lib/company-overview";
import {
  SX_BUSINESS_PLAN_ASSUMPTIONS,
  SX_BUSINESS_PLAN_PHASES,
  SX_BUSINESS_PLAN_UPDATED_ON,
  sxAnnualProjectionWithCash,
  type SxBusinessPlanLane,
  type SxXrlTarget,
} from "@/lib/sx-business-plan";
import CapitalPlanWorkspace from "./CapitalPlanWorkspace";

interface CockpitBusinessPlanProps {
  projectId: string;
  projectName: string;
}

interface LaneMeta {
  label: string;
  icon: LucideIcon;
  accent: string;
  iconClass: string;
}

const LANE_ORDER: SxBusinessPlanLane[] = ["business", "technology", "organization", "funding"];

const LANE_META: Record<SxBusinessPlanLane, LaneMeta> = {
  business: {
    label: "事業開発",
    icon: BriefcaseBusiness,
    accent: "bg-cyan-50/70",
    iconClass: "border-cyan-200 bg-cyan-100 text-cyan-800",
  },
  technology: {
    label: "技術開発",
    icon: FlaskConical,
    accent: "bg-indigo-50/60",
    iconClass: "border-indigo-200 bg-indigo-100 text-indigo-800",
  },
  organization: {
    label: "組織開発",
    icon: UsersRound,
    accent: "bg-emerald-50/60",
    iconClass: "border-emerald-200 bg-emerald-100 text-emerald-800",
  },
  funding: {
    label: "資金調達",
    icon: Landmark,
    accent: "bg-amber-50/60",
    iconClass: "border-amber-200 bg-amber-100 text-amber-800",
  },
};

const XRL_LABELS: Record<keyof SxXrlTarget, string> = {
  trl: "TRL",
  brl: "BRL",
  grl: "GRL",
  srl: "SRL",
  hrl: "HRL",
};

function formatOku(yen: number) {
  if (Math.abs(yen) >= 100_000_000) {
    const value = yen / 100_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}億円`;
  }
  return `${Math.round(yen / 10_000).toLocaleString("ja-JP")}万円`;
}

function formatOkuCell(yen: number) {
  const value = yen / 100_000_000;
  if (value === 0) return "—";
  return value.toFixed(Math.abs(value) >= 10 ? 0 : 1);
}

function SectionShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function XrlStrip({ target, keys }: { target: SxXrlTarget; keys?: Array<keyof SxXrlTarget> }) {
  const visibleKeys = keys ?? (Object.keys(XRL_LABELS) as Array<keyof SxXrlTarget>);
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="到達XRL">
      {visibleKeys.map((key) => (
        <span key={key} className="rounded-md border border-slate-200 bg-white/90 px-1.5 py-1 font-mono text-[9px] font-semibold tracking-tight text-slate-600">
          {XRL_LABELS[key]} {target[key]}
        </span>
      ))}
    </div>
  );
}

function PhaseMatrix() {
  return (
    <SectionShell>
      <div className="border-b border-slate-200 bg-[linear-gradient(120deg,#eef2ff_0%,#ecfeff_55%,#f8fafc_100%)] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">
              <Factory className="size-4" /> SX phase map
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">事業計画｜ラウンド間で何を証明するか</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600 sm:text-[13px]">
              培養は自社ノウハウ・自社工場、製品は包装して顧客拠点へ輸送する前提。金額は各フェーズ内の使途総額で、次列へ進むには出口条件とXRLの両方を満たす。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
            <CircleAlert className="size-4 shrink-0" /> 暫定原案｜{SX_BUSINESS_PLAN_UPDATED_ON}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto" data-testid="sx-business-plan-phase-matrix">
        <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-[156px] border-b border-r border-slate-200 bg-slate-950 px-4 py-4 align-bottom text-white">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">development lane</span>
                <span className="mt-1 block text-sm font-bold">開発レーン</span>
              </th>
              {SX_BUSINESS_PLAN_PHASES.map((phase) => (
                <th key={phase.id} className="sticky top-0 z-20 w-[270px] border-b border-r border-slate-700 bg-slate-950 px-4 py-4 align-top text-white last:border-r-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-bold leading-5">{phase.label}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400">{phase.period}</div>
                    </div>
                    <span className="shrink-0 rounded-md bg-cyan-300 px-2 py-1 text-[10px] font-black text-slate-950">{formatOku(phase.budgetYen)}</span>
                  </div>
                  <div className="mt-3 border-t border-slate-700 pt-3">
                    <div className="text-[10px] font-semibold text-cyan-300">{phase.openingRound}</div>
                    <div className="mt-1 min-h-8 text-[10px] font-normal leading-4 text-slate-400">{phase.fundingSource}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <XrlStrip target={phase.targetXrl} />
                  </div>
                  <div className="mt-2 text-[9px] font-normal text-slate-500">固定費バーン上限 {formatOku(phase.maxFixedBurnMonthlyYen)}/月</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LANE_ORDER.map((laneKey) => {
              const meta = LANE_META[laneKey];
              const Icon = meta.icon;
              return (
                <tr key={laneKey}>
                  <th className={`sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-5 align-top ${meta.accent}`}>
                    <div className={`flex size-9 items-center justify-center rounded-xl border ${meta.iconClass}`}><Icon className="size-4" /></div>
                    <div className="mt-3 text-[13px] font-bold text-slate-950">{meta.label}</div>
                  </th>
                  {SX_BUSINESS_PLAN_PHASES.map((phase) => {
                    const lane = phase.lanes[laneKey];
                    return (
                      <td key={phase.id} className="border-b border-r border-slate-200 p-0 align-top last:border-r-0">
                        <div className="flex min-h-[245px] flex-col px-4 py-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">budget</span>
                            <span className="font-mono text-sm font-black tabular-nums text-slate-950">{formatOku(lane.costYen)}</span>
                          </div>
                          <ul className="mt-3 space-y-2 text-[11px] leading-[1.55] text-slate-700">
                            {lane.activities.map((activity) => (
                              <li key={activity} className="flex gap-2">
                                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-cyan-500" />
                                <span>{activity}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-auto pt-4">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                <ShieldCheck className="size-3" /> 次フェーズへの出口条件
                              </div>
                              <p className="mt-1 text-[10px] font-medium leading-4 text-slate-800">{lane.exitGate}</p>
                            </div>
                            <div className="mt-2"><XrlStrip target={phase.targetXrl} keys={lane.xrlKeys} /></div>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <div className="grid gap-2 lg:grid-cols-2">
          {SX_BUSINESS_PLAN_ASSUMPTIONS.map((assumption) => (
            <div key={assumption} className="flex gap-2 text-[11px] leading-5 text-slate-600">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" />
              <span>{assumption}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function AnnualProjectionTable() {
  const projection = sxAnnualProjectionWithCash();
  const rows = [
    { key: "revenueYen", label: "売上高", tone: "text-slate-950" },
    { key: "operatingExpenseYen", label: "営業費用", tone: "text-slate-700" },
    { key: "operatingIncomeYen", label: "営業利益", tone: "text-slate-950" },
    { key: "capexYen", label: "設備投資", tone: "text-indigo-700" },
    { key: "equityFundingYen", label: "株式調達", tone: "text-cyan-800" },
    { key: "closingCashYen", label: "期末現預金（簡易）", tone: "text-emerald-800" },
  ] as const;

  return (
    <SectionShell>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700"><Building2 className="size-4" /> annual model</div>
          <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-950">年次試算表</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">フェーズ予算と売上仮説を年度へ置き直した暫定PL・投資・資金調達。単位は億円。</p>
        </div>
        <div className="text-[10px] leading-4 text-slate-500">期末現預金 = 前年残 + 営業利益 − 設備投資 + 株式調達<br />税金・借入・運転資金増減は未反映</div>
      </div>
      <div className="overflow-x-auto" data-testid="sx-annual-projection-table">
        <table className="w-full min-w-[1080px] text-xs">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="sticky left-0 z-10 w-[180px] border-r border-slate-700 bg-slate-950 px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em]">単位：億円</th>
              {projection.map((year) => <th key={year.fiscalYear} className="min-w-[96px] border-r border-slate-700 px-3 py-3 text-right font-mono text-[11px] last:border-r-0">FY{String(year.fiscalYear).slice(-2)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-slate-50/80">
                <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-5 py-3.5 text-left text-[11px] font-semibold text-slate-700">{row.label}</th>
                {projection.map((year) => {
                  const value = year[row.key];
                  return <td key={year.fiscalYear} className={`border-r border-slate-100 px-3 py-3.5 text-right font-mono font-semibold tabular-nums last:border-r-0 ${value < 0 ? "text-rose-600" : row.tone}`}>{formatOkuCell(value)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-[10px] leading-5 text-amber-900 sm:px-6">
        Seed 1.5億円はSeries Aを2028年10月までに実行する前提。PoC遅延・設備超過・A調達遅延のいずれかが起きる場合は、非希薄化資金かブリッジを先に設計する。
      </div>
    </SectionShell>
  );
}

export function CockpitBusinessPlan({ projectId, projectName }: CockpitBusinessPlanProps) {
  const [companyData, setCompanyData] = useState<CompanyOverviewData>();
  const [companyDataError, setCompanyDataError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/governance?projectId=${encodeURIComponent(projectId)}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "会社情報を読み込めなかったよ");
        if (!cancelled) setCompanyData(json);
      })
      .catch((cause) => {
        if (!cancelled) setCompanyDataError(cause instanceof Error ? cause.message : "会社情報を読み込めなかったよ");
      });
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <div className="space-y-5">
      <PhaseMatrix />

      <div>
        <div className="mb-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700">ownership & funding</div>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">株主構成・資本政策</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">上段の100%棒グラフで希薄化推移、その下の資本政策表で各ラウンドの条件と株主別持分を確認する。</p>
          </div>
          <div className="text-[10px] text-slate-500">初期持分：CEO 75% / 杉浦先生 20% / まさ・AMD 5%</div>
        </div>
        {companyDataError && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <CircleAlert className="size-4 shrink-0" /> 会社情報の取込だけ失敗したよ：{companyDataError}
          </div>
        )}
        <CapitalPlanWorkspace projectId={projectId} projectName={projectName} companyOverviewData={companyData} />
      </div>

      <AnnualProjectionTable />
    </div>
  );
}
