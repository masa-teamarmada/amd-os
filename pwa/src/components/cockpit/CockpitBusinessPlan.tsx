"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  CircleAlert,
  FileSpreadsheet,
  FlaskConical,
  Landmark,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { CompanyOverviewData } from "@/lib/company-overview";
import {
  SX_BUSINESS_PLAN_PHASES,
  SX_ANNUAL_PROJECTION_FISCAL_YEARS,
  createSxAnnualProjectionParameters,
  sxAnnualProjectionWithCash,
  type SxBusinessPlanLane,
  type SxAnnualProjectionFactoryProject,
  type SxAnnualProjectionParameters,
  type SxAnnualProjectionYearParameters,
  type SxXrlTarget,
} from "@/lib/sx-business-plan";
import { downloadSxBusinessPlanPhaseMatrixXlsx } from "@/lib/sx-business-plan-xlsx";
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
    accent: "bg-white",
    iconClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  technology: {
    label: "技術開発",
    icon: FlaskConical,
    accent: "bg-white",
    iconClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  organization: {
    label: "組織開発",
    icon: UsersRound,
    accent: "bg-white",
    iconClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  funding: {
    label: "資金調達",
    icon: Landmark,
    accent: "bg-white",
    iconClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
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

function formatMillionYenCell(yen: number) {
  const value = Math.round(yen / 1_000_000);
  return value === 0 ? "—" : value.toLocaleString("ja-JP");
}

function SectionShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function XrlStrip({ target, keys }: { target: SxXrlTarget; keys?: Array<keyof SxXrlTarget> }) {
  const visibleKeys = keys ?? (Object.keys(XRL_LABELS) as Array<keyof SxXrlTarget>);
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="到達XRL">
      {visibleKeys.map((key) => (
        <span key={key} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 font-mono text-[10px] font-semibold tracking-tight text-slate-700">
          {XRL_LABELS[key]} {target[key]}
        </span>
      ))}
    </div>
  );
}

function PhaseMatrix({ projectName }: Pick<CockpitBusinessPlanProps, "projectName">) {
  return (
    <SectionShell>
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">フェーズマトリクス</h2>
      </div>

      <div className="overflow-x-auto" data-testid="sx-business-plan-phase-matrix">
        <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-[156px] border-b border-r border-slate-200 bg-slate-950 px-4 py-4 align-bottom text-white">
                <span className="block text-sm font-bold">開発レーン</span>
              </th>
              {SX_BUSINESS_PLAN_PHASES.map((phase) => (
                <th key={phase.id} className="sticky top-0 z-20 w-[270px] border-b border-r border-slate-700 bg-slate-950 px-4 py-4 align-top text-white last:border-r-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-bold leading-5">{phase.label}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400">{phase.period}</div>
                    </div>
                    <span className="shrink-0 rounded-md bg-indigo-200 px-2 py-1 text-[10px] font-black text-indigo-950">{formatOku(phase.budgetYen)}</span>
                  </div>
                  <div className="mt-3 border-t border-slate-700 pt-3">
                    <div className="text-[10px] font-semibold text-indigo-200">{phase.openingRound}</div>
                    <div className="mt-1 min-h-8 text-[10px] font-normal leading-4 text-slate-400">{phase.fundingSource}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <XrlStrip target={phase.targetXrl} />
                  </div>
                  <div className="mt-2 text-[10px] font-normal text-slate-400">固定費バーン上限 {formatOku(phase.maxFixedBurnMonthlyYen)}/月</div>
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
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono text-sm font-black tabular-nums text-slate-950" aria-label={`費用 ${formatOku(lane.costYen)}`}>{formatOku(lane.costYen)}</span>
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
                              <p className="mt-1 text-[11px] font-medium leading-4 text-slate-800">{lane.exitGate}</p>
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

      <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
        <button
          type="button"
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          onClick={() => downloadSxBusinessPlanPhaseMatrixXlsx(projectName)}
          data-testid="sx-phase-matrix-xlsx-export"
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

type AnnualParameterField = keyof SxAnnualProjectionYearParameters;

interface AnnualParameterRow {
  key: AnnualParameterField;
  label: string;
  kind?: "money" | "headcount";
}

function ParameterValueInput({
  label,
  fiscalYear,
  value,
  kind = "money",
  onChange,
}: {
  label: string;
  fiscalYear: number;
  value: number;
  kind?: "money" | "headcount";
  onChange: (value: number) => void;
}) {
  const isMoney = kind === "money";
  const displayValue = isMoney ? value / 1_000_000 : value;
  return (
    <input
      aria-label={`${label} FY${String(fiscalYear).slice(-2)}${isMoney ? "（百万円）" : "（人）"}`}
      className="h-10 w-full min-w-[76px] rounded-lg border border-slate-200 bg-white px-2 text-right font-mono text-xs tabular-nums text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      type="number"
      min="0"
      step={isMoney ? "0.1" : "1"}
      value={displayValue}
      onChange={(event) => {
        const next = event.currentTarget.valueAsNumber;
        onChange(Number.isFinite(next) ? Math.max(0, isMoney ? next * 1_000_000 : Math.round(next)) : 0);
      }}
    />
  );
}

function AnnualParameterTable({
  title,
  rows,
  parameters,
  onChange,
}: {
  title: string;
  rows: AnnualParameterRow[];
  parameters: SxAnnualProjectionParameters;
  onChange: (fiscalYear: number, key: AnnualParameterField, value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] text-xs">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 w-[250px] border-r border-slate-200 bg-slate-100 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.12em]">入力項目</th>
              {SX_ANNUAL_PROJECTION_FISCAL_YEARS.map((fiscalYear) => <th key={fiscalYear} className="min-w-[88px] px-2 py-2.5 text-right font-mono text-[11px]">FY{String(fiscalYear).slice(-2)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row) => (
              <tr key={row.key}>
                <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-2.5 text-left text-[11px] font-semibold text-slate-700">
                  {row.label}<span className="ml-1 font-normal text-slate-400">{row.kind === "headcount" ? "人" : "百万円"}</span>
                </th>
                {SX_ANNUAL_PROJECTION_FISCAL_YEARS.map((fiscalYear) => (
                  <td key={fiscalYear} className="px-2 py-2">
                    <ParameterValueInput
                      label={row.label}
                      fiscalYear={fiscalYear}
                      value={parameters.annualByFiscalYear[fiscalYear][row.key]}
                      kind={row.kind}
                      onChange={(value) => onChange(fiscalYear, row.key, value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const BUSINESS_AND_GRANT_PARAMETER_ROWS: AnnualParameterRow[] = [
  { key: "revenueYen", label: "売上高" },
  { key: "costOfSalesYen", label: "売上原価" },
  { key: "researchAndDevelopmentBaseYen", label: "研究開発費（基礎額）" },
  { key: "otherSellingGeneralAdministrativeBaseYen", label: "その他販管費（基礎額）" },
  { key: "subsidySpecialGainYen", label: "助成金収入（特別利益）" },
  { key: "subsidyCompressionLossYen", label: "圧縮損（特別損失）" },
  { key: "subsidyCashReceiptYen", label: "助成金入金（資金繰り）" },
  { key: "otherCapexYen", label: "工場以外の設備投資" },
];

const WORKFORCE_PARAMETER_ROWS: AnnualParameterRow[] = [
  { key: "executiveHeadcount", label: "役員人数", kind: "headcount" },
  { key: "executiveAnnualCompensationPerPersonYen", label: "役員報酬／人" },
  { key: "executiveAnnualTravelPerPersonYen", label: "役員の旅費／人" },
  { key: "executiveAnnualConsumablesPerPersonYen", label: "役員の消耗品費／人" },
  { key: "employeeHeadcount", label: "社員人数", kind: "headcount" },
  { key: "employeeAnnualCompensationPerPersonYen", label: "給与・賞与／人" },
  { key: "employeeAnnualTravelPerPersonYen", label: "社員の旅費／人" },
  { key: "employeeAnnualConsumablesPerPersonYen", label: "社員の消耗品費／人" },
];

function AnnualProjectionTable() {
  const [parameters, setParameters] = useState<SxAnnualProjectionParameters>(() => createSxAnnualProjectionParameters());
  const projection = sxAnnualProjectionWithCash(parameters);
  const hasParameterChanges = JSON.stringify(parameters) !== JSON.stringify(createSxAnnualProjectionParameters());
  const updateYearParameter = (fiscalYear: number, key: AnnualParameterField, value: number) => {
    setParameters((current) => ({
      ...current,
      annualByFiscalYear: {
        ...current.annualByFiscalYear,
        [fiscalYear]: { ...current.annualByFiscalYear[fiscalYear], [key]: value },
      },
    }));
  };
  const updateFactory = (id: SxAnnualProjectionFactoryProject["id"], update: Partial<SxAnnualProjectionFactoryProject>) => {
    setParameters((current) => ({
      ...current,
      factoryProjects: current.factoryProjects.map((factory) => factory.id === id ? { ...factory, ...update } : factory),
    }));
  };
  const updateNonIpoFunding = (fiscalYear: number, value: number) => {
    setParameters((current) => ({
      ...current,
      nonIpoEquityFundingYenByFiscalYear: { ...current.nonIpoEquityFundingYenByFiscalYear, [fiscalYear]: value },
    }));
  };
  const rows = [
    { key: "revenueYen", label: "売上高", tone: "text-slate-950", emphasis: true },
    { key: "costOfSalesYen", label: "売上原価", tone: "text-slate-700" },
    { key: "grossProfitYen", label: "売上総利益", tone: "text-slate-950", emphasis: true },
    { key: "executiveCompensationYen", label: "役員報酬", tone: "text-slate-700" },
    { key: "salariesAndBonusesYen", label: "給与・賞与", tone: "text-slate-700" },
    { key: "researchAndDevelopmentYen", label: "研究開発費", tone: "text-slate-700" },
    { key: "sellingGeneralAdministrativeYen", label: "販管費（人件費除く）", tone: "text-slate-700" },
    { key: "operatingIncomeYen", label: "営業利益", tone: "text-slate-950", emphasis: true },
    { key: "subsidySpecialGainYen", label: "助成金収入（特別利益）", tone: "text-indigo-700" },
    { key: "subsidyCompressionLossYen", label: "圧縮損（特別損失）", tone: "text-slate-700" },
    { key: "pretaxIncomeYen", label: "税引前利益（簡易）", tone: "text-slate-950", emphasis: true },
    { key: "capexYen", label: "設備投資", tone: "text-indigo-700" },
    { key: "equityFundingYen", label: "株式調達", tone: "text-indigo-700" },
    { key: "subsidyCashReceiptYen", label: "助成金入金（資金繰り）", tone: "text-indigo-700" },
    { key: "closingCashYen", label: "期末現預金（簡易）", tone: "text-slate-950", emphasis: true },
  ] as Array<{ key: keyof (typeof projection)[number]; label: string; tone: string; emphasis?: boolean }>;

  return (
    <SectionShell>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <h2 className="text-lg font-bold tracking-tight text-slate-950">年次試算表</h2>
        <div className="text-[10px] leading-4 text-slate-500">期末現預金 = 前年残 + 営業利益 − 設備投資 + 株式調達 + 助成金入金<br />圧縮損は会計上の特別損失。税金・借入・運転資金増減は未反映</div>
      </div>
      <div className="overflow-x-auto" data-testid="sx-annual-projection-table">
        <table className="w-full min-w-[1080px] text-xs">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="sticky left-0 z-10 w-[220px] border-r border-slate-700 bg-slate-950 px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em]">単位：百万円</th>
              {projection.map((year) => <th key={year.fiscalYear} className="min-w-[96px] border-r border-slate-700 px-3 py-3 text-right font-mono text-[11px] last:border-r-0">FY{String(year.fiscalYear).slice(-2)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key} className={`hover:bg-slate-50/80 ${row.emphasis ? "border-t-2 border-slate-300 bg-indigo-50/40" : ""}`}>
                <th className={`sticky left-0 z-10 border-r border-slate-200 px-5 py-3.5 text-left text-[11px] font-semibold ${row.emphasis ? "bg-indigo-50 text-slate-950" : "bg-white text-slate-700"}`}>{row.label}</th>
                {projection.map((year) => {
                  const value = year[row.key];
                  return <td key={year.fiscalYear} className={`border-r border-slate-100 px-3 py-3.5 text-right font-mono font-semibold tabular-nums last:border-r-0 ${value < 0 ? "text-rose-600" : row.tone}`}>{formatMillionYenCell(value)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="group border-t border-slate-200" data-testid="sx-annual-parameters">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-slate-800 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal className="size-4 text-indigo-700" /> 前提パラメータ {hasParameterChanges && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">変更あり</span>}</span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-indigo-700"><span className="group-open:hidden">開く</span><span className="hidden group-open:inline">閉じる</span> <ChevronDown className="size-4 transition group-open:rotate-180" /></span>
        </summary>
        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-3xl text-xs leading-5 text-slate-600">保存済みの資本政策・株主構成・会社情報は変更しない。再読み込みで初期値に戻る。</p>
            <button type="button" className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => setParameters(createSxAnnualProjectionParameters())} disabled={!hasParameterChanges}><RotateCcw className="size-3.5" /> 初期値に戻す</button>
          </div>

          <div className="mt-5 space-y-5">
            <AnnualParameterTable title="事業・助成金・その他投資" rows={BUSINESS_AND_GRANT_PARAMETER_ROWS} parameters={parameters} onChange={updateYearParameter} />
            <AnnualParameterTable title="人員・単価" rows={WORKFORCE_PARAMETER_ROWS} parameters={parameters} onChange={updateYearParameter} />

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-950">自社工場の段階投資</h3>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {parameters.factoryProjects.map((factory) => (
                  <div key={factory.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-800">{factory.label}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="text-[10px] font-semibold text-slate-500">建設年度
                        <select aria-label={`${factory.label}の建設年度`} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" value={factory.fiscalYear} onChange={(event) => updateFactory(factory.id, { fiscalYear: Number(event.target.value) })}>
                          {SX_ANNUAL_PROJECTION_FISCAL_YEARS.map((fiscalYear) => <option key={fiscalYear} value={fiscalYear}>FY{String(fiscalYear).slice(-2)}</option>)}
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-slate-500">投資額（百万円）
                        <ParameterValueInput label={`${factory.label}の投資額`} fiscalYear={factory.fiscalYear} value={factory.costYen} onChange={(costYen) => updateFactory(factory.id, { costYen })} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-950">株式調達（IPO除く）</h3>
                </div>
                <div className="overflow-x-auto">
                  <div className="grid min-w-[900px] grid-cols-9 gap-2 p-4">
                    {SX_ANNUAL_PROJECTION_FISCAL_YEARS.map((fiscalYear) => (
                      <label key={fiscalYear} className="text-[10px] font-semibold text-slate-500">FY{String(fiscalYear).slice(-2)}<ParameterValueInput label={`IPO以外の株式調達 FY${String(fiscalYear).slice(-2)}`} fiscalYear={fiscalYear} value={parameters.nonIpoEquityFundingYenByFiscalYear[fiscalYear]} onChange={(value) => updateNonIpoFunding(fiscalYear, value)} /></label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                <h3 className="text-sm font-bold text-slate-950">IPOの時期と調達額</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-[10px] font-semibold text-slate-600">IPO年度
                    <select aria-label="IPO年度" className="mt-1 h-10 w-full rounded-lg border border-indigo-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" value={parameters.ipoFiscalYear} onChange={(event) => setParameters((current) => ({ ...current, ipoFiscalYear: Number(event.target.value) }))}>
                      {SX_ANNUAL_PROJECTION_FISCAL_YEARS.map((fiscalYear) => <option key={fiscalYear} value={fiscalYear}>FY{String(fiscalYear).slice(-2)}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-semibold text-slate-600">公募調達額（百万円）
                    <ParameterValueInput label="IPOの公募調達額" fiscalYear={parameters.ipoFiscalYear} value={parameters.ipoProceedsYen} onChange={(ipoProceedsYen) => setParameters((current) => ({ ...current, ipoProceedsYen }))} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </details>
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
      <PhaseMatrix projectName={projectName} />

      <div>
        <div className="mb-3 px-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">株主構成・資本政策</h2>
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
