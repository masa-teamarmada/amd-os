"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Tex } from "@/components/venture-map/Tex";
import {
  BZM22_FORMULA_SYMBOLS,
  BZM22_FIXED_POLICY,
  BZM22_TOP_METRICS,
  buildBzm22FormulaTrace,
  calculateBzm22TimingOnlyJ,
  formatMillionJpy,
  type Bzm22CalculationGate,
  type Bzm22PilotApiPayload,
  type Bzm22PilotParameter,
  type Bzm22PilotParameterGroup,
  type Bzm22PilotProject,
  type Bzm22PilotTimeline,
  type Bzm22Scenario,
  type Bzm22SimulationPolicyOption,
  type Bzm22TimelineItem,
} from "@/lib/bzm-2-2-pilot-ui";
import {
  BZM22_FORMULA_CATALOG,
  BZM22_PARAMETER_RELATION_LABELS,
  getBzm22ParameterCatalogEntry,
} from "@/lib/bzm-2-2-parameter-catalog";

type LoadState =
  | { status: "idle" | "loading"; projectId: string }
  | { status: "ready"; projectId: string; pilot: Bzm22PilotProject }
  | { status: "error"; projectId: string; error: string };
type ParameterFilter = "all" | "formula" | "assumption";

const PILOT_CACHE = new Map<string, Bzm22PilotProject>();
const UNCERTAIN_STATUS = /missing|estimated|partial|imputed|conditional|hearing|unknown|incomplete/i;

const STATUS_META = [
  { pattern: /calculated|computed|derived|mechanical/i, label: "計算結果", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { pattern: /observed|document_extracted/i, label: "観測", className: "border-cyan-200 bg-cyan-50 text-cyan-900" },
  { pattern: /design_choice|registered|fixed/i, label: "計算条件", className: "border-blue-200 bg-blue-50 text-blue-900" },
  { pattern: UNCERTAIN_STATUS, label: "推定", className: "border-amber-200 bg-amber-50 text-amber-900" },
  { pattern: /not_applicable|n\/a|excluded/i, label: "対象外", className: "border-slate-200 bg-slate-100 text-slate-500" },
];

const VALUE_LABELS: Record<string, string> = {
  JPY: "日本円", nominal: "名目値", real: "実質値", low: "慎重", base: "基準", high: "強気",
  true: "はい", false: "いいえ", shadow_only: "比較計算のみ", registered: "登録済み",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "未登録";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日付形式を確認中";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "対象外";
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number | null, kind: "probability" | "million") {
  if (value === null || !Number.isFinite(value)) return "対象外";
  return kind === "probability" ? formatRate(value) : formatMillionJpy(value);
}

function formatUnitLabel(unit: string) {
  if (/million_jpy/i.test(unit)) return "¥M";
  const labels: Record<string, string> = {
    months: "か月", month: "月", annual_decimal: "年率", probability: "通過値・比率", decimal: "比率",
    date: "日付", count: "件", boolean: "はい／いいえ", text: "文字列", JPY: "日本円",
  };
  return labels[unit] ?? (unit ? "登録単位" : "単位なし");
}

function formatUnitValue(value: unknown, unit: string): string {
  if (value === null || value === undefined || value === "") return "未登録";
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "未登録";
    if (/million_jpy/i.test(unit)) return formatMillionJpy(value);
    if (/probability|annual_decimal|decimal/i.test(unit)) return formatRate(value);
    return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value)}${formatUnitLabel(unit) === "登録単位" ? "" : formatUnitLabel(unit)}`;
  }
  if (typeof value === "string") {
    if (VALUE_LABELS[value]) return VALUE_LABELS[value];
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
    if (/[ぁ-んァ-ヶ一-龠]/.test(value)) return value.length > 100 ? `${value.slice(0, 100)}…` : value;
    return "登録値あり（日本語表示未接続）";
  }
  if (Array.isArray(value)) {
    if (value.length <= 4 && value.every((entry) => typeof entry !== "object")) {
      return value.map((entry) => formatUnitValue(entry, unit)).join("、");
    }
    return `${value.length}期間・件の登録データ`;
  }
  return `${Object.keys(value as Record<string, unknown>).length}項目の登録データ`;
}

function statusMeta(status: string) {
  return STATUS_META.find((entry) => entry.pattern.test(status)) ?? {
    label: "状態確認中", className: "border-slate-200 bg-white text-slate-600",
  };
}

function basisDescription(status: string) {
  if (/calculated|computed|derived|mechanical/i.test(status)) return "登録済みの入力から計算して算出";
  if (/observed|document_extracted/i.test(status)) return "確認できた資料・記録から登録";
  if (/design_choice|registered|fixed/i.test(status)) return "この計算で固定する条件として設定";
  if (UNCERTAIN_STATUS.test(status)) return "不足情報を明示した上で仮定・推定";
  if (/not_applicable|n\/a|excluded/i.test(status)) return "このPJ・計算では対象外";
  return "設定方法の日本語説明を確認中";
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return <span className={`inline-flex border px-1.5 py-0.5 text-[9px] font-semibold ${meta.className}`}>{meta.label}</span>;
}

function sameScenario(value: Bzm22Scenario<unknown>) {
  return JSON.stringify(value.low) === JSON.stringify(value.base) && JSON.stringify(value.base) === JSON.stringify(value.high);
}

function ScenarioValues({ parameter }: { parameter: Bzm22PilotParameter }) {
  if (sameScenario(parameter.imputed)) {
    return (
      <div>
        <div className="text-[8px] font-semibold text-[#376274]">3ケース共通</div>
        <div className="mt-0.5 text-[10px] font-semibold text-slate-700">{formatUnitValue(parameter.imputed.base, parameter.unit)}</div>
      </div>
    );
  }
  return (
    <div className="grid gap-1 text-[9px] leading-4">
      {(["low", "base", "high"] as const).map((key) => (
        <div key={key} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 border-b border-slate-100 last:border-0">
          <span className="text-slate-500">{key === "low" ? "慎重な仮定" : key === "base" ? "基準の仮定" : "強気の仮定"}</span>
          <span className="font-semibold text-slate-700">{formatUnitValue(parameter.imputed[key], parameter.unit)}</span>
        </div>
      ))}
    </div>
  );
}

function EvidenceLinks({ parameter, projectId }: { parameter: Bzm22PilotParameter; projectId: string }) {
  const refs = parameter.sourceRefs;
  if (!refs.length) return <span className="text-slate-500">根拠資料は未接続</span>;
  const hasDrive = refs.some((ref) => ref.startsWith("drive:"));
  const gmailIds = refs.flatMap((ref) => {
    const match = ref.match(/^gmail:(?:thread|message):([a-zA-Z0-9]+)/);
    return match ? [match[1]] : [];
  });
  const hasOsDb = refs.some((ref) => /^os_db:(?:project_meeting_summaries|meeting_summary)/.test(ref));
  const unconnected = refs.filter((ref) => !ref.startsWith("drive:") && !/^gmail:(?:thread|message):/.test(ref) && !/^os_db:(?:project_meeting_summaries|meeting_summary)/.test(ref)).length;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px]">
      {hasDrive ? <Link className="font-semibold text-[#236c79] underline underline-offset-2" href={`/project/${encodeURIComponent(projectId)}/workspace/files`}>PJ資料室を開く</Link> : null}
      {gmailIds.slice(0, 2).map((id) => <a key={id} className="font-semibold text-[#236c79] underline underline-offset-2" href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Gmailで開く</a>)}
      {hasOsDb ? <Link className="font-semibold text-[#236c79] underline underline-offset-2" href={`/project/${encodeURIComponent(projectId)}/cockpit?tab=progress`}>進捗記録を開く</Link> : null}
      {unconnected > 0 ? <span className="text-slate-500">{unconnected}件の参照先はOS未接続</span> : null}
    </div>
  );
}

function FormulaRelation({ parameter }: { parameter: Bzm22PilotParameter }) {
  const catalog = getBzm22ParameterCatalogEntry(parameter.id);
  return <span className="text-[9px] text-slate-500">{BZM22_PARAMETER_RELATION_LABELS[catalog.relation]}</span>;
}

function ParameterIdentity({ parameter }: { parameter: Bzm22PilotParameter }) {
  const catalog = getBzm22ParameterCatalogEntry(parameter.id);
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold text-[#173f51]">{catalog.japaneseName}</div>
      {catalog.symbolTex ? (
        <div className="mt-1">
          <div className="text-[8px] font-semibold text-slate-500">この項目を表す記号</div>
          <span className="mt-0.5 inline-flex border border-[#6f9e94] bg-[#e8f4ef] px-2 py-1 text-[12px] font-semibold text-[#174f45]"><Tex tex={catalog.symbolTex} /></span>
        </div>
      ) : <div className="mt-1 text-[9px] font-semibold text-slate-500">計算を再現・監査するための管理情報</div>}
      <div className="mt-1 text-[9px] leading-4 text-slate-600">{catalog.formulaConnection}</div>
      {catalog.symbolTex ? (
        <div className="mt-1 space-y-1">
          {catalog.formulaRefs.map((ref) => {
            const formula = BZM22_FORMULA_CATALOG[ref];
            return (
              <div key={ref} className="flex min-w-0 items-center gap-1.5 border-l-2 border-[#5f9a8d] pl-1.5">
                <span className="shrink-0 border border-[#8bbcaf] bg-[#e8f4ef] px-1.5 py-0.5 text-[10px] font-bold text-[#174f45]"><Tex tex={catalog.symbolTex} /></span>
                <span className="shrink-0 text-[8px] font-bold text-slate-400">{ref}</span>
                <span className="min-w-0 overflow-x-auto whitespace-nowrap text-[9px] text-[#285b6b]"><Tex tex={formula.tex} /></span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AuditDetail({ parameter, projectId }: { parameter: Bzm22PilotParameter; projectId: string }) {
  const catalog = getBzm22ParameterCatalogEntry(parameter.id);
  return (
    <details className="mt-2 border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer list-none px-2 py-1.5 text-[9px] font-semibold text-[#376274] marker:content-none">監査詳細を開く</summary>
      <div className="space-y-1 border-t border-slate-200 px-2 py-2 text-[9px] leading-4 text-slate-600">
        <div>値の決め方: {basisDescription(parameter.observedStatus)}</div>
        <EvidenceLinks parameter={parameter} projectId={projectId} />
        <div>情報締切: {formatDate(parameter.cutoff)}</div>
        <div>式との関係: <FormulaRelation parameter={parameter} /></div>
        <div>単位: {formatUnitLabel(parameter.unit)}</div>
        <details className="border-t border-slate-200 pt-1">
          <summary className="cursor-pointer text-slate-500">内部識別子を表示</summary>
          <div className="mt-1 break-all font-mono text-[8px] text-slate-400">{parameter.id} / {catalog.dataNameTex}</div>
        </details>
      </div>
    </details>
  );
}

function ParameterDesktopTable({ parameters, projectId }: { parameters: Bzm22PilotParameter[]; projectId: string }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[1040px] border-collapse text-left">
        <thead className="bg-slate-50 text-[9px] text-slate-500"><tr><th className="w-10 px-2 py-2 text-right">#</th><th className="w-[360px] px-2 py-2">日本語名・数式との接続</th><th className="px-2 py-2">意味</th><th className="w-[250px] px-2 py-2">入力値</th><th className="w-[170px] px-2 py-2">状態・根拠</th></tr></thead>
        <tbody>{parameters.map((parameter) => {
          const catalog = getBzm22ParameterCatalogEntry(parameter.id);
          return <tr key={parameter.id} className="border-t border-slate-100 align-top even:bg-slate-50/40">
            <td className="px-2 py-2 text-right font-mono text-[8px] text-slate-400">{parameter.index}</td>
            <td className="px-2 py-2"><ParameterIdentity parameter={parameter} /></td>
            <td className="px-2 py-2 text-[9px] leading-4 text-slate-600">{catalog.formulaConnection}</td>
            <td className="px-2 py-2"><ScenarioValues parameter={parameter} /></td>
            <td className="px-2 py-2"><StatusBadge status={parameter.observedStatus} /><AuditDetail parameter={parameter} projectId={projectId} /></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function ParameterMobileCards({ parameters, projectId }: { parameters: Bzm22PilotParameter[]; projectId: string }) {
  return <div className="divide-y divide-slate-200 lg:hidden">{parameters.map((parameter) => (
    <article key={parameter.id} className="px-3 py-3">
      <div className="flex items-start justify-between gap-2"><span className="font-mono text-[8px] text-slate-400">#{parameter.index}</span><StatusBadge status={parameter.observedStatus} /></div>
      <div className="mt-1"><ParameterIdentity parameter={parameter} /></div>
      <div className="mt-2 border border-slate-200 bg-white p-2"><div className="mb-1 text-[8px] font-semibold text-slate-500">入力値・3つの前提ケース</div><ScenarioValues parameter={parameter} /></div>
      <AuditDetail parameter={parameter} projectId={projectId} />
    </article>
  ))}</div>;
}

function FormulaIndex() {
  return <details className="border-t border-slate-200"><summary className="cursor-pointer list-none px-3 py-2 text-[9px] font-semibold text-[#376274] marker:content-none">接続式一覧 F0–F14</summary><div className="grid border-t border-slate-200 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(BZM22_FORMULA_CATALOG).filter(([ref]) => ref.startsWith("F")).map(([ref, formula]) => <div key={ref} className="border-b border-r border-slate-200 p-2"><div className="text-[9px] font-semibold text-[#234d5e]">{ref} {formula.title}</div><div className="mt-1 overflow-x-auto whitespace-nowrap text-[9px] text-[#285b6b]"><Tex tex={formula.tex} /></div></div>)}</div></details>;
}

function ParameterLedger({ groups, projectId }: { groups: Bzm22PilotParameterGroup[]; projectId: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ParameterFilter>("all");
  const normalized = query.trim().toLocaleLowerCase("ja-JP");
  const filtered = useMemo(() => groups.map((group) => ({ ...group, parameters: group.parameters.filter((parameter) => {
    const catalog = getBzm22ParameterCatalogEntry(parameter.id);
    if (filter === "formula" && catalog.relation === "unused") return false;
    if (filter === "assumption" && !UNCERTAIN_STATUS.test(parameter.observedStatus)) return false;
    return !normalized || `${catalog.japaneseName} ${catalog.symbolTex} ${catalog.formulaConnection}`.toLocaleLowerCase("ja-JP").includes(normalized);
  }) })), [filter, groups, normalized]);
  const total = groups.reduce((sum, group) => sum + group.parameters.length, 0);
  return (
    <details data-testid="bzm22-parameter-ledger" className="border-t border-[#7898a5] bg-white">
      <summary className="cursor-pointer list-none bg-[#edf3f5] px-3 py-3 marker:content-none sm:px-4"><span className="text-[12px] font-semibold text-[#173f51]">103項目の監査台帳</span><span className="ml-2 text-[9px] text-slate-500">最下部の監査用。開いて確認</span></summary>
      <div className="border-t border-slate-200 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <input aria-label="項目を検索" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="日本語名・数式記号・意味で検索" className="min-h-10 border border-slate-300 px-3 text-[11px] outline-none focus:border-cyan-700 md:min-h-8" />
          <div className="grid grid-cols-3 border border-slate-300">{([['all','全項目'],['formula','数式に関係'],['assumption','仮定を含む']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-10 border-l border-slate-200 px-2 text-[9px] first:border-0 md:min-h-8 ${filter === value ? "bg-[#dcebed] font-semibold text-[#174b60]" : "text-slate-500"}`}>{label}</button>)}</div>
        </div>
      </div>
      {filtered.map((group) => <details key={group.key} className="border-t border-slate-200"><summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-semibold text-[#254c5d] marker:content-none">{group.label}<span className="ml-2 font-normal text-slate-500">{group.parameters.length}/{group.count}件</span></summary><div className="border-t border-slate-100"><ParameterDesktopTable parameters={group.parameters} projectId={projectId} /><ParameterMobileCards parameters={group.parameters} projectId={projectId} /></div></details>)}
      <FormulaIndex />
      <div className="px-3 py-2 text-[8px] text-slate-500">全{total}項目。内部識別子は各行の監査詳細のさらに内側にだけ表示する。</div>
    </details>
  );
}

function ScenarioMetric({ symbol, value, kind }: { symbol: keyof typeof BZM22_TOP_METRICS; value: Bzm22Scenario<number | null>; kind: "probability" | "million" }) {
  const metric = BZM22_TOP_METRICS[symbol];
  return <div className="min-w-0 bg-white px-3 py-3"><div className="flex items-baseline gap-2"><span className="text-[18px] font-bold text-[#173f51]">{symbol}</span><span className="text-[10px] font-semibold text-slate-600">{metric.title}</span></div><div className="mt-1 text-[16px] font-semibold tabular-nums text-[#173f51]">{formatNumber(value.base, kind)}</div><div className="mt-2 grid grid-cols-3 gap-1 text-[8px] text-slate-500"><span>慎重 {formatNumber(value.low, kind)}</span><span>基準 {formatNumber(value.base, kind)}</span><span>強気 {formatNumber(value.high, kind)}</span></div><div className="mt-2 text-[8px] leading-3 text-slate-500">{metric.description}</div></div>;
}

function FormulaTerm({ tex, label, value, detail }: { tex: string; label: string; value: string; detail?: string }) {
  return (
    <div className="w-full min-w-0 lg:flex-1">
      <div className="flex min-h-9 items-end justify-start overflow-x-auto whitespace-nowrap border-b-2 border-[#2b6c82] px-2 pb-1 text-left text-[11px] text-[#285b6b] lg:justify-center lg:text-center">
        <Tex tex={tex} />
      </div>
      <div aria-hidden="true" className="mx-auto h-3 w-px bg-[#2b6c82]" />
      <div className="border border-[#a9c5cf] bg-[#eaf2f4] px-2.5 py-2 text-center">
        <div className="text-[8px] font-semibold text-[#426573]">{label}</div>
        <div className="mt-1 break-words font-mono text-[11px] font-semibold tabular-nums text-[#173f51]">{value}</div>
        {detail ? <div className="mt-1 text-[8px] leading-3 text-slate-500">{detail}</div> : null}
      </div>
    </div>
  );
}

function FormulaJoin({ children }: { children: string }) {
  return <div aria-hidden="true" className="flex h-7 shrink-0 items-center justify-center px-1 font-serif text-[18px] text-slate-400 lg:h-9 lg:items-end lg:pb-1 xl:px-2">{children}</div>;
}

function AnnotatedFormula({
  symbol,
  title,
  scenarioLabel,
  formula,
  result,
  children,
}: {
  symbol: "J" | "P" | "Q" | "S";
  title: string;
  scenarioLabel: string;
  formula: string;
  result: string;
  children: ReactNode;
}) {
  return (
    <article data-testid={`bzm22-annotated-formula-${symbol.toLowerCase()}`} aria-label={`${symbol}の数式と代入値`} className="border border-slate-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[18px] font-bold text-[#173f51]">{symbol}</span>
          <span className="text-[10px] font-semibold text-slate-600">{title}</span>
          <span className="text-[8px] text-slate-400">{scenarioLabel}</span>
        </div>
        <strong className="font-mono text-[14px] tabular-nums text-[#173f51]">{result}</strong>
      </header>
      <div className="px-3 py-3 lg:overflow-x-auto">
        <div className="w-full min-w-0 lg:min-w-[720px]">
          <div className="overflow-x-auto whitespace-nowrap text-[12px] text-[#285b6b]"><Tex tex={formula} /></div>
          <div className="mt-3 flex flex-col items-stretch lg:flex-row lg:items-start">{children}</div>
        </div>
      </div>
    </article>
  );
}

function CalculationTrace({ pilot }: { pilot: Bzm22PilotProject }) {
  const trace = pilot.calculationTrace;
  const [scenario, setScenario] = useState<"low" | "base" | "high">("base");
  const output = trace.outputs[scenario];
  const values = buildBzm22FormulaTrace(trace, scenario);
  const scenarioLabel = scenario === "low" ? "慎重" : scenario === "base" ? "基準" : "強気";
  const firstMonth = values.months[0];
  const lastMonth = values.months.at(-1);
  const qFactors = values.gates.map((gate) => formatRate(gate.probability)).join(" × ");
  const stressValues = values.stresses.map((family) => `${family.label} ${formatRate(family.product)}`).join(" / ");
  const cashFlowRange = firstMonth && lastMonth
    ? `dₜ ${firstMonth.discountFactor.toFixed(6)}→${lastMonth.discountFactor.toFixed(6)} / Wₜ ${formatRate(firstMonth.pathWeight)}→${formatRate(lastMonth.pathWeight)}`
    : "月次系列なし";
  const fullCashFlowDetail = firstMonth && lastMonth
    ? `t=1〜${values.horizonMonths} / dₜ ${firstMonth.discountFactor.toFixed(6)}→${lastMonth.discountFactor.toFixed(6)}`
    : "月次系列なし";
  return (
    <section className="border-b border-[#b9cbd1] bg-[#f6f8f8]" aria-labelledby="calculation-trace-title">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-4"><div><h3 id="calculation-trace-title" className="text-[12px] font-semibold text-[#173f51]">式と入力のつながり</h3><p className="mt-0.5 text-[9px] text-slate-500">各項の直下に、このPJで代入した数値を表示。評価に用いた登録方針: {trace.policyLabel}</p></div><div className="grid grid-cols-3 border border-slate-300">{([['low','慎重'],['base','基準'],['high','強気']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setScenario(key)} className={`min-h-8 border-l border-slate-200 px-3 text-[9px] first:border-0 ${scenario === key ? "bg-[#dcebed] font-semibold text-[#174b60]" : "bg-white text-slate-500"}`}>{label}</button>)}</div></header>
      <div data-testid="bzm22-formula-substitution-board" className="grid gap-2 bg-[#f6f8f8] p-2">
        <AnnotatedFormula symbol="J" title={BZM22_TOP_METRICS.J.title} scenarioLabel={scenarioLabel} formula={BZM22_TOP_METRICS.J.formula} result={formatMillionJpy(output.J)}>
          <FormulaTerm tex={String.raw`\sum_{t=1}^{H}d_tW_t(a)CF_t(a)`} label="経路中の月次収支" value={formatMillionJpy(output.pathPV)} detail={cashFlowRange} />
          <FormulaJoin>+</FormulaJoin>
          <FormulaTerm tex={String.raw`d_HQ(a)TV(a)`} label="全条件通過時の寄与" value={`${values.terminal.discountFactor.toFixed(6)} × ${formatRate(output.Q)} × ${formatMillionJpy(values.terminal.valueMillionJpy)}`} detail={`≈ ${formatMillionJpy(output.successContribution)}`} />
          <FormulaJoin>+</FormulaJoin>
          <FormulaTerm tex={String.raw`\sum_{i\in G}d_{t_i}W_{t_i^-}(a)(1-p_i(a))RV_i(a)`} label={`${values.gates.length}条件の停止寄与`} value={formatMillionJpy(output.failureContribution)} detail="条件別の値は直下の表で展開" />
          <FormulaJoin>≈</FormulaJoin>
          <FormulaTerm tex={String.raw`J(a)`} label="全分岐込み" value={formatMillionJpy(output.J)} />
        </AnnotatedFormula>
        <AnnotatedFormula symbol="P" title={BZM22_TOP_METRICS.P.title} scenarioLabel={scenarioLabel} formula={BZM22_TOP_METRICS.P.formula} result={output.P === null ? "対象外" : formatMillionJpy(output.P)}>
          <FormulaTerm tex={String.raw`\sum_{t=1}^{H}d_tCF_t(a)`} label="全条件通過時の月次収支" value={formatMillionJpy(output.fullPathPV)} detail={fullCashFlowDetail} />
          <FormulaJoin>+</FormulaJoin>
          <FormulaTerm tex={String.raw`d_HTV(a)`} label="最終月の将来価値" value={`${values.terminal.discountFactor.toFixed(6)} × ${formatMillionJpy(values.terminal.valueMillionJpy)}`} detail={`≈ ${formatMillionJpy(output.terminalPV)}`} />
          <FormulaJoin>≈</FormulaJoin>
          <FormulaTerm tex={String.raw`P(a)`} label="全条件通過時" value={output.P === null ? "対象外" : formatMillionJpy(output.P)} />
        </AnnotatedFormula>
        <AnnotatedFormula symbol="Q" title={BZM22_TOP_METRICS.Q.title} scenarioLabel={scenarioLabel} formula={BZM22_TOP_METRICS.Q.formula} result={formatRate(output.Q)}>
          <FormulaTerm tex={String.raw`\prod_{i\in G}p_i(a)`} label={`${values.gates.length}条件の通過値`} value={qFactors || "条件なし"} detail={`≈ ${formatRate(output.Q)}`} />
          <FormulaJoin>≈</FormulaJoin>
          <FormulaTerm tex={String.raw`Q(a)`} label="基準到達指数" value={formatRate(output.Q)} />
        </AnnotatedFormula>
        <AnnotatedFormula symbol="S" title={BZM22_TOP_METRICS.S.title} scenarioLabel={scenarioLabel} formula={BZM22_TOP_METRICS.S.formula} result={formatRate(output.S)}>
          <FormulaTerm tex={String.raw`\min_{\delta\in\Delta_{\mathrm{reg}}}\prod_{i\in G}(p_i(a)m_{i\delta}(a))`} label={`${values.stresses.length}逆風の計算結果`} value={stressValues || "対象なし"} detail={`最小値 ${formatRate(output.S)}`} />
          <FormulaJoin>≈</FormulaJoin>
          <FormulaTerm tex={String.raw`S(a)`} label="逆風耐久指数" value={formatRate(output.S)} />
        </AnnotatedFormula>
      </div>
      <div className="border-t border-slate-200 bg-white px-3 py-2 text-[9px] leading-4 text-slate-600 sm:px-4"><strong>Q × P はJではない。</strong> {output.qTimesP === null ? "このPJではPが対象外。" : `このケースのQ × Pは ${formatMillionJpy(output.qTimesP)}、Jは ${formatMillionJpy(output.J)}。`} Jは毎月の収支を各時点の生存率で重み付けし、途中停止時の価値も足すため。</div>
      <AlgebraInputs pilot={pilot} scenario={scenario} />
    </section>
  );
}

const SYMBOL_KIND_LABEL = { policy: "固定方針", primitive: "入力", set_index: "集合・番号", derived: "計算途中", output: "出力" } as const;

function AlgebraInputs({ pilot, scenario }: { pilot: Bzm22PilotProject; scenario: "low" | "base" | "high" }) {
  const values = buildBzm22FormulaTrace(pilot.calculationTrace, scenario);
  const output = values.outputs;
  const symbolValue: Record<string, string> = {
    a: values.policy.label,
    H: `${values.horizonMonths}か月`,
    r_d: formatRate(values.discountRate),
    t: `1〜${values.horizonMonths}月`,
    T: `{1, …, ${values.horizonMonths}}`,
    CF_t: `${values.months.length}か月・単純合計 ${formatMillionJpy(pilot.calculationTrace.inputs.cashFlow.totalMillionJpy[scenario])}`,
    d_t: `${values.months[0]?.discountFactor.toFixed(6)}〜${values.months.at(-1)?.discountFactor.toFixed(6)}`,
    d_H: values.terminal.discountFactor.toFixed(6),
    i: `1〜${values.gates.length}`,
    G: values.gates.map((gate) => `${gate.index}. ${gate.label}`).join(" / "),
    t_i: values.gates.map((gate) => `${gate.month}月`).join("、"),
    d_t_i: values.gates.map((gate) => gate.discountFactor.toFixed(6)).join("、"),
    p_i: values.gates.map((gate) => formatRate(gate.probability)).join(" × "),
    W_t: `${formatRate(values.months[0]?.pathWeight)}〜${formatRate(values.months.at(-1)?.pathWeight)}`,
    W_before: values.gates.map((gate) => formatRate(gate.priorPathWeight)).join("、"),
    failure_probability: values.gates.map((gate) => formatRate(gate.failureValue)).join("、"),
    branch_weight: values.gates.map((gate) => formatRate(gate.failureBranchWeight)).join("、"),
    RV_i: values.gates.map((gate) => formatMillionJpy(gate.signedFailureSettlementMillionJpy)).join("、"),
    TV: formatMillionJpy(values.terminal.valueMillionJpy),
    delta: `1〜${values.stresses.length}`,
    Delta: values.stresses.map((stress) => `${stress.index}. ${stress.label}`).join(" / "),
    m_i_delta: `${values.stresses.length}逆風 × ${values.gates.length}条件`,
    Q: formatRate(output.Q),
    S: formatRate(output.S),
    P: output.P === null ? "対象外" : formatMillionJpy(output.P),
    J: formatMillionJpy(output.J),
  };
  return <div className="border-t border-slate-200 bg-white"><div className="px-3 py-2 sm:px-4"><h4 className="text-[11px] font-semibold text-[#173f51]">式に出てくる全記号</h4><p className="mt-0.5 text-[8px] text-slate-500">26記号を、入力・計算途中・集合・方針・出力に分け、選択中のケースの実値で表示。</p></div><div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">{BZM22_FORMULA_SYMBOLS.map((symbol) => <div key={symbol.key} className="min-w-0 bg-white p-2.5"><div className="flex items-start justify-between gap-2"><div><span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[7px] font-semibold text-slate-500">{SYMBOL_KIND_LABEL[symbol.kind]}</span><div className="mt-1 text-[9px] text-slate-500">{symbol.label}</div></div><span className="shrink-0 text-[12px] font-semibold text-[#285b6b]"><Tex tex={symbol.tex} /></span></div><div className="mt-2 break-words text-[10px] font-semibold leading-4 text-[#173f51]">{symbolValue[symbol.key]}</div></div>)}</div>
    <details className="border-t border-slate-200"><summary className="cursor-pointer list-none px-3 py-2 text-[9px] font-semibold text-[#376274] marker:content-none sm:px-4">条件ごとの実数を開く（{values.gates.length}条件）</summary><div className="overflow-x-auto border-t border-slate-200"><table className="min-w-[980px] w-full text-left text-[8px]"><thead className="bg-slate-50 text-slate-500"><tr>{["i / 条件", "tᵢ", "pᵢ", "W(tᵢ−)", "1−pᵢ", "停止分岐重み", "d(tᵢ)", "RVᵢ", "停止寄与PV"].map((label) => <th key={label} className="border-b border-r border-slate-200 px-2 py-1.5 font-semibold">{label}</th>)}</tr></thead><tbody>{values.gates.map((gate) => <tr key={gate.id}>{[`${gate.index}. ${gate.label}`, `${gate.month}月`, formatRate(gate.probability), formatRate(gate.priorPathWeight), formatRate(gate.failureValue), formatRate(gate.failureBranchWeight), gate.discountFactor.toFixed(6), formatMillionJpy(gate.signedFailureSettlementMillionJpy), formatMillionJpy(gate.discountedFailureContributionMillionJpy)].map((value, index) => <td key={`${gate.id}-${index}`} className="border-b border-r border-slate-100 px-2 py-1.5 text-slate-700">{value}</td>)}</tr>)}</tbody></table></div></details>
    <details className="border-t border-slate-200"><summary className="cursor-pointer list-none px-3 py-2 text-[9px] font-semibold text-[#376274] marker:content-none sm:px-4">逆風ごとの補正値を開く（{values.stresses.length}逆風 × {values.gates.length}条件）</summary><div className="overflow-x-auto border-t border-slate-200"><table className="min-w-[760px] w-full text-left text-[8px]"><thead className="bg-slate-50 text-slate-500"><tr><th className="border-b border-r border-slate-200 px-2 py-1.5">δ / 逆風</th>{values.gates.map((gate) => <th key={gate.id} className="border-b border-r border-slate-200 px-2 py-1.5">{gate.label}</th>)}<th className="border-b border-slate-200 px-2 py-1.5">積</th></tr></thead><tbody>{values.stresses.map((stress) => <tr key={stress.id}><td className="border-b border-r border-slate-100 px-2 py-1.5 font-semibold">{stress.index}. {stress.label}</td>{stress.multipliers.map((entry) => <td key={entry.gateId} className="border-b border-r border-slate-100 px-2 py-1.5">{formatRate(entry.value)}</td>)}<td className="border-b border-slate-100 px-2 py-1.5 font-semibold">{formatRate(stress.product)}</td></tr>)}</tbody></table></div></details>
    <details className="border-t border-slate-200"><summary className="cursor-pointer list-none px-3 py-2 text-[9px] font-semibold text-[#376274] marker:content-none sm:px-4">60か月すべての CFₜ・dₜ・Wₜ を開く</summary><div className="max-h-[480px] overflow-auto border-t border-slate-200"><table className="min-w-[720px] w-full text-right text-[8px]"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr>{["t", "CFₜ", "dₜ", "Wₜ", "dₜCFₜ", "dₜWₜCFₜ"].map((label) => <th key={label} className="border-b border-r border-slate-200 px-2 py-1.5">{label}</th>)}</tr></thead><tbody>{values.months.map((month) => <tr key={month.month}>{[`${month.month}月`, formatMillionJpy(month.cashFlowMillionJpy), month.discountFactor.toFixed(6), formatRate(month.pathWeight), formatMillionJpy(month.discountedFullPathCashFlowMillionJpy), formatMillionJpy(month.discountedWeightedCashFlowMillionJpy)].map((value, index) => <td key={`${month.month}-${index}`} className="border-b border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-700">{value}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}

const TIMELINE_CATEGORY: Record<Bzm22TimelineItem["category"], string> = { registered_policy: "登録方針", technical: "技術", facility: "設備・量産", commercial: "事業・商流", funding_external: "資金" };

function TimelineItemMeta({ item, gate }: { item: Bzm22TimelineItem; gate?: Bzm22CalculationGate }) {
  return <div className="px-2 py-2"><div className="flex flex-wrap items-center gap-1"><span className="text-[9px] font-semibold text-[#173f51]">{item.label}</span><span className="border border-slate-200 bg-white px-1 py-0.5 text-[7px] text-slate-500">{TIMELINE_CATEGORY[item.category]}</span></div><div className="mt-1 border-l-2 border-[#5f9a8d] pl-2 text-[8px] font-semibold text-[#205f52]">{item.choiceLabel}</div><div className="mt-1 text-[8px] text-slate-500">{item.dateLabel}</div>{gate ? <div className="mt-1 grid grid-cols-3 gap-1 text-[8px] text-slate-600"><span>pᵢ {formatRate(gate.probabilities.base)}</span><span>累積生存 {formatRate(gate.cumulativeSurvival.base)}</span><span>停止分岐 {formatRate(gate.failureBranchWeight.base)}</span><span className="col-span-3">停止時価値 {formatMillionJpy(gate.signedFailureSettlementMillionJpy.base)}</span></div> : null}</div>;
}

function TimelineTrack({ item, timeline }: { item: Bzm22TimelineItem; timeline: Bzm22PilotTimeline }) {
  const start = Date.parse(timeline.axis.startDate); const end = Date.parse(timeline.axis.endDate); const point = Date.parse(item.startDate ?? timeline.axis.startDate); const widthEnd = Date.parse(item.endDate ?? item.startDate ?? timeline.axis.startDate);
  const left = end > start ? Math.max(0, Math.min(100, ((point - start) / (end - start)) * 100)) : 0; const width = end > start ? Math.max(1.5, ((widthEnd - point) / (end - start)) * 100) : 1.5;
  return <div className="relative h-8 border-x border-slate-200 bg-slate-50"><div className="absolute top-2 h-3 border border-[#77a99c] bg-[#dcebed]" style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%` }} /></div>;
}

function DecisionEventTimeline({ pilot }: { pilot: Bzm22PilotProject }) {
  const timeline = pilot.timeline;
  return <section data-testid="bzm22-decision-event-timeline" className="border-b border-[#b9cbd1] bg-white"><header className="border-b border-slate-200 px-3 py-2 sm:px-4"><h3 className="text-[11px] font-semibold text-[#173f51]">選択と事業イベントの時間軸</h3><p className="mt-0.5 text-[8px] text-slate-500">意思決定、評価に用いた登録方針、計画イベントを区別。イベント発生日を意思決定日へ読み替えない。</p></header><div className="hidden lg:block">{timeline.lanes.map((lane) => <div key={lane.key} className="border-b border-slate-200"><div className="bg-slate-50 px-2 py-1 text-[8px] font-semibold text-[#365865]">{lane.label}</div>{lane.items.length ? lane.items.map((item) => { const gate = pilot.calculationTrace.inputs.gates.find((row) => row.label === item.label); return <div key={item.id} className="grid grid-cols-[280px_1fr] border-t border-slate-100"><TimelineItemMeta item={item} gate={gate} /><TimelineTrack item={item} timeline={timeline} /></div>; }) : <div className="px-2 py-2 text-[8px] text-slate-400">{lane.emptyMessage}</div>}</div>)}</div><div className="divide-y divide-slate-200 lg:hidden">{timeline.lanes.map((lane) => <div key={lane.key} className="px-3 py-2"><div className="text-[9px] font-semibold text-[#365865]">{lane.label}</div>{lane.items.length ? lane.items.map((item) => <div key={item.id} className="mt-1 border border-slate-200"><TimelineItemMeta item={item} gate={pilot.calculationTrace.inputs.gates.find((row) => row.label === item.label)} /></div>) : <div className="mt-1 text-[8px] text-slate-400">{lane.emptyMessage}</div>}</div>)}</div></section>;
}

function SimulationMetric({ option }: { option: Bzm22SimulationPolicyOption }) {
  return <div className="grid grid-cols-4 gap-px bg-slate-200">{(["J", "P", "Q", "S"] as const).map((key) => { const metric = option.metrics[key]; const value = metric.values?.base ?? null; return <div key={key} className="bg-white p-2"><div className="text-[10px] font-bold text-[#173f51]">{key}</div><div className="mt-1 text-[10px] font-semibold">{metric.status === "precomputed" ? (key === "Q" || key === "S" ? formatRate(value) : formatMillionJpy(value as number)) : metric.status === "not_applicable_historical_terminal" ? "対象外" : "計算結果なし"}</div></div>; })}</div>;
}

function BrowserSimulator({ pilot }: { pilot: Bzm22PilotProject }) {
  const simulation = pilot.simulation;
  const [policyId, setPolicyId] = useState(simulation.currentPolicyId);
  const [gateMonths, setGateMonths] = useState<Record<string, number>>(() => Object.fromEntries(pilot.calculationTrace.inputs.gates.map((gate) => [gate.id, gate.month])));
  const selected = simulation.policyOptions.find((option) => option.id === policyId) ?? simulation.policyOptions[0];
  const timingResult = useMemo(
    () => calculateBzm22TimingOnlyJ(pilot.calculationTrace, gateMonths, "base"),
    [gateMonths, pilot.calculationTrace],
  );
  const originalJ = pilot.calculationTrace.outputs.base.J;
  const gateTimingChanged = pilot.calculationTrace.inputs.gates.some((gate) => gateMonths[gate.id] !== gate.month);
  const reset = () => {
    setPolicyId(simulation.currentPolicyId);
    setGateMonths(Object.fromEntries(pilot.calculationTrace.inputs.gates.map((gate) => [gate.id, gate.month])));
  };
  return (
    <section className="border-b border-[#b9cbd1] bg-white" aria-labelledby="execution-judgement-title">
      <header className="border-b border-slate-200 bg-[#edf3f5] px-3 py-2 sm:px-4">
        <h3 id="execution-judgement-title" className="text-[12px] font-semibold text-[#173f51]">実行可能性と経営判断</h3>
        <p className="mt-0.5 text-[8px] text-slate-500">ブラウザ内シミュレーター。この画面内の変更は保存されない。</p>
      </header>
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        <div>
          <label className="block text-[9px] font-semibold text-slate-600">評価日固定の方針比較
            <select value={policyId} onChange={(event) => setPolicyId(event.target.value)} className="mt-1 min-h-10 w-full border border-slate-300 bg-white px-2 text-[10px]">
              {simulation.policyOptions.map((option) => <option key={option.id} value={option.id}>{option.label}（{option.registrationRole === "registered_current" ? "評価に用いた登録方針" : option.registrationRole === "historical_terminal_shadow" ? "歴史分類" : "未登録の比較案"}）</option>)}
            </select>
          </label>
          <div className="mt-2 text-[8px] text-slate-500">評価日時点に凍結済みの値を切り替える。未登録案を実行推奨へ読み替えない。</div>
          <div className="mt-2"><SimulationMetric option={selected} /></div>
        </div>
        <div className="border border-slate-200 bg-slate-50 p-2">
          <div className="text-[9px] font-semibold text-[#365865]">登録方針の条件判定月を試す（基準ケース）</div>
          <div className="mt-1 text-[8px] leading-3 text-slate-500">時期だけを変え、条件付き通過値・月次収支・将来価値は固定。経路重み、停止時価値の割引、Jだけを再計算する。</div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {pilot.calculationTrace.inputs.gates.map((gate, index, gates) => {
              const minimumMonth = index > 0 ? (gateMonths[gates[index - 1].id] ?? gates[index - 1].month) : 0;
              const maximumMonth = index < gates.length - 1 ? (gateMonths[gates[index + 1].id] ?? gates[index + 1].month) : pilot.calculationTrace.inputs.horizonMonths;
              return (
              <label key={gate.id} className="grid grid-cols-[1fr_72px] items-center gap-2 border border-slate-200 bg-white px-2 py-1.5 text-[8px] text-slate-600">
                <span>{gate.label}<span className="block text-[7px] text-slate-400">pᵢ {formatRate(gate.probabilities.base)} / RVᵢ {formatMillionJpy(gate.signedFailureSettlementMillionJpy.base)}</span></span>
                <span className="flex items-center gap-1"><input aria-label={`${gate.label}の判定月`} type="number" min={minimumMonth} max={maximumMonth} value={gateMonths[gate.id] ?? gate.month} onChange={(event) => setGateMonths((current) => ({ ...current, [gate.id]: Math.max(minimumMonth, Math.min(maximumMonth, Number(event.target.value) || 0)) }))} className="min-h-8 w-14 border border-slate-300 px-1 text-right text-[9px]" />月</span>
              </label>
              );
            })}
          </div>
          {timingResult.status === "calculated" ? <div className="mt-2 grid grid-cols-3 gap-px bg-slate-200 text-center"><div className="bg-white p-2"><div className="text-[7px] text-slate-500">登録値 J</div><div className="text-[10px] font-semibold">{formatMillionJpy(originalJ)}</div></div><div className="bg-white p-2"><div className="text-[7px] text-slate-500">時期変更後 J</div><div className="text-[10px] font-semibold text-[#174f45]">{formatMillionJpy(timingResult.J)}</div></div><div className="bg-white p-2"><div className="text-[7px] text-slate-500">差</div><div className="text-[10px] font-semibold">{formatMillionJpy(timingResult.J - originalJ)}</div></div></div> : <div className="mt-2 border-l-2 border-amber-400 pl-2 text-[9px] text-amber-900">gate順序が逆転するため計算できない。条件付き通過値の順序を維持して。</div>}
          <div className="mt-1 text-[8px] text-slate-500">Q・S・Pは不変。条件付き通過値の意味を守るため、gate順序は固定し、同月だけを許す。{gateTimingChanged ? "判定月を変更中。" : "登録月を表示中。"}</div>
        </div>
      </div>
      <div className="px-3 pb-3"><button type="button" onClick={reset} className="min-h-9 border border-slate-300 px-3 text-[9px] font-semibold text-slate-600">元の前提に戻す</button></div>
    </section>
  );
}

function CalculationConditions({ pilot }: { pilot: Bzm22PilotProject }) {
  return <details className="border-b border-[#b9cbd1] bg-[#f8fafb]"><summary className="cursor-pointer list-none px-3 py-2 text-[9px] font-semibold text-[#376274] marker:content-none sm:px-4">計算条件</summary><div className="space-y-1 border-t border-slate-200 px-3 py-2 text-[8px] leading-4 text-slate-500 sm:px-4"><div><Tex tex={BZM22_FIXED_POLICY.formula} /> — {BZM22_FIXED_POLICY.label}</div><div>価値基準日 {formatDate(pilot.valuationDate)} / 情報締切 {formatDate(pilot.informationCutoff)}</div><div>前向き照合 {pilot.claimBoundary.forwardValidationCount}件。計算入力の状態は103項目の監査台帳で確認できる。</div><div>情報源走査: {pilot.sourceCoverage.sources.map((source) => `${source.key} ${source.paginationComplete ? "完了" : "継続中"}`).join(" / ")}</div></div></details>;
}

function PilotPanel({ pilot }: { pilot: Bzm22PilotProject }) {
  return <section data-testid="bzm22-provisional-primary" aria-labelledby="bzm22-title" className="min-w-0 overflow-hidden border border-[#7898a5] bg-[#f6f8f8]"><header className="border-b border-[#365865] bg-[#162f3a] px-3 py-3 text-white sm:px-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="bzm22-title" className="text-[15px] font-semibold">BZM 2.2</h2><p className="mt-1 text-[10px] text-slate-200">{pilot.projectName}の事業価値と、条件を通り切る強さを式から確認する。</p></div><div className="text-right text-[8px] text-slate-300">価値基準日 {formatDate(pilot.valuationDate)}</div></div></header><div className="grid gap-px border-b border-[#b9cbd1] bg-[#c9d5d9] sm:grid-cols-2 xl:grid-cols-4"><ScenarioMetric symbol="J" value={pilot.summary.jValueMillionJpy} kind="million" /><ScenarioMetric symbol="P" value={pilot.summary.conditionalSuccessValueMillionJpy} kind="million" /><ScenarioMetric symbol="Q" value={pilot.summary.qGateProductProxy} kind="probability" /><ScenarioMetric symbol="S" value={pilot.summary.qStressProxy} kind="probability" /></div><CalculationConditions pilot={pilot} /><CalculationTrace pilot={pilot} /><BrowserSimulator key={pilot.projectId} pilot={pilot} /><DecisionEventTimeline pilot={pilot} /><ParameterLedger groups={pilot.groups} projectId={pilot.projectId} /></section>;
}

export function Bzm22ProvisionalObservatory({ projectId, active = true }: { projectId: string; active?: boolean }) {
  const [state, setState] = useState<LoadState>(() => PILOT_CACHE.has(projectId) ? { status: "ready", projectId, pilot: PILOT_CACHE.get(projectId)! } : { status: "idle", projectId });
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const cached = PILOT_CACHE.get(projectId);
    const request = cached ? Promise.resolve<Bzm22PilotApiPayload>({ pilot: cached }) : fetch(`/api/project/${encodeURIComponent(projectId)}/bzm-2-2-pilot`, { cache: "no-store" }).then(async (response) => {
      const json = await response.json().catch(() => null) as Bzm22PilotApiPayload | { error?: string } | null;
      if (!response.ok || !json || !("pilot" in json)) throw new Error(json && "error" in json && json.error ? json.error : "BZM 2.2の取得に失敗");
      return json;
    });
    request.then((json) => { PILOT_CACHE.set(projectId, json.pilot); if (!cancelled) setState({ status: "ready", projectId, pilot: json.pilot }); }).catch((error) => { if (!cancelled) setState({ status: "error", projectId, error: error instanceof Error ? error.message : "BZM 2.2の取得に失敗" }); });
    return () => { cancelled = true; };
  }, [active, projectId]);
  if (state.projectId !== projectId) return <div data-testid="bzm22-provisional-primary" className="grid min-h-56 place-items-center border border-[#aac1ca] bg-[#f6f8f8] text-[11px] text-slate-500">BZM 2.2を切り替え中…</div>;
  if (state.status === "idle" || state.status === "loading") return <div data-testid="bzm22-provisional-primary" className="grid min-h-56 place-items-center border border-[#aac1ca] bg-[#f6f8f8] text-[11px] text-slate-500">BZM 2.2を読み込み中…</div>;
  if (state.status === "error") return <div data-testid="bzm22-provisional-primary" className="border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-800"><div className="font-semibold">BZM 2.2を読み出せていない</div><div>{state.error}</div></div>;
  if (state.status === "ready") return <PilotPanel pilot={state.pilot} />;
  return null;
}
