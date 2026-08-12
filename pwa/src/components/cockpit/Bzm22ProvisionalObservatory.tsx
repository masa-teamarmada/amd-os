"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatMillionJpy,
  type Bzm22PilotApiPayload,
  type Bzm22PilotParameter,
  type Bzm22PilotParameterGroup,
  type Bzm22PilotProject,
  type Bzm22Scenario,
} from "@/lib/bzm-2-2-pilot-ui";

type LoadState =
  | { status: "idle"; projectId: string }
  | { status: "loading"; projectId: string }
  | { status: "ready"; projectId: string; pilot: Bzm22PilotProject }
  | { status: "error"; projectId: string; error: string };

type ParameterFilter = "all" | "used" | "uncertain";

const PILOT_CACHE = new Map<string, Bzm22PilotProject>();
const UNCERTAIN_STATUS = /missing|estimated|partial|imputed|conditional|hearing|unknown|incomplete/i;
const MILLION_JPY_UNIT = /^million_jpy(?:_|$)/i;

const STATUS_META: Array<{
  pattern: RegExp;
  label: string;
  className: string;
}> = [
  {
    pattern: /observed|document_extracted|calculated|computed|derived/i,
    label: "観測・計算",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    pattern: /missing|estimated|partial|imputed|conditional|hearing|unknown|incomplete/i,
    label: "推定・欠測",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    pattern: /not_applicable|n\/a|excluded/i,
    label: "対象外",
    className: "border-slate-200 bg-slate-100 text-slate-500",
  },
  {
    pattern: /design_choice|mechanical|registered|fixed/i,
    label: "設計・機械",
    className: "border-cyan-200 bg-cyan-50 text-cyan-900",
  },
];

function compactValue(value: unknown, maxLength = 78) {
  if (value === null || value === undefined || value === "") return "未登録";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 6 }).format(value)
      : "未登録";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "未登録";
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function isMillionJpyUnit(unit: string) {
  return MILLION_JPY_UNIT.test(unit);
}

function formatUnitLabel(unit: string) {
  if (!isMillionJpyUnit(unit)) return unit || "単位なし";
  if (/or_not_applicable/i.test(unit)) return "¥M / 対象外";
  if (/pv/i.test(unit)) return "¥M（現在価値）";
  return "¥M";
}

function formatUnitValue(value: unknown, unit: string): unknown {
  if (!isMillionJpyUnit(unit)) return value;
  if (typeof value === "number" && Number.isFinite(value)) return formatMillionJpy(value);
  if (Array.isArray(value)) return value.map((entry) => formatUnitValue(entry, unit));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, formatUnitValue(entry, unit)]),
    );
  }
  return value;
}

function jsonText(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? "未登録";
  } catch {
    return String(value);
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "未登録";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number | null, kind: "probability" | "million") {
  if (value === null || !Number.isFinite(value)) return "欠測";
  if (kind === "probability") {
    return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value * 100)}%`;
  }
  return formatMillionJpy(value);
}

function hasPrecisionLoss(value: Bzm22PilotParameter["precisionLossContribution"]) {
  if (value === null || value === false || value === 0 || value === "") return false;
  if (typeof value === "string" && /^(none|false|not_applicable|n\/a)$/i.test(value)) return false;
  return true;
}

function isUncertain(parameter: Bzm22PilotParameter) {
  return UNCERTAIN_STATUS.test(parameter.observedStatus) || hasPrecisionLoss(parameter.precisionLossContribution);
}

function parameterSearchText(parameter: Bzm22PilotParameter) {
  return [
    parameter.id,
    parameter.section,
    parameter.key,
    parameter.observedStatus,
    parameter.unit,
    parameter.rule,
    parameter.confidenceDriver,
    ...parameter.sourceRefs,
    compactValue(parameter.value, 400),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ja-JP");
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META.find((candidate) => candidate.pattern.test(status)) ?? {
    label: "状態",
    className: "border-slate-200 bg-white text-slate-600",
  };
  return (
    <span
      className={`inline-flex min-h-5 items-center border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${meta.className}`}
      title={`${meta.label}: ${status}`}
    >
      {status || "未登録"}
    </span>
  );
}

function ValueDisclosure({
  value,
  label = "全値",
  unit = "",
}: {
  value: unknown;
  label?: string;
  unit?: string;
}) {
  return (
    <details className="min-w-0">
      <summary className="cursor-pointer list-none text-[9px] font-semibold text-[#376274] underline decoration-dotted underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-700 marker:content-none">
        {label}
      </summary>
      <pre className="mt-1 max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-all border border-slate-200 bg-slate-50 p-2 font-mono text-[9px] leading-4 text-slate-600">
        {jsonText(formatUnitValue(value, unit))}
      </pre>
    </details>
  );
}

function ScenarioMetric({
  label,
  value,
  kind,
  note,
}: {
  label: string;
  value: Bzm22Scenario<number | null>;
  kind: "probability" | "million";
  note: string;
}) {
  return (
    <div className="min-w-0 bg-white px-3 py-2.5">
      <div className="text-[9px] font-semibold tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-[15px] font-semibold tabular-nums text-[#173f51]">
        {formatNumber(value.base, kind)}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1 font-mono text-[8px] tabular-nums text-slate-500">
        <span>L {formatNumber(value.low, kind)}</span>
        <span>B {formatNumber(value.base, kind)}</span>
        <span>H {formatNumber(value.high, kind)}</span>
      </div>
      <div className="mt-1 text-[8px] leading-3 text-slate-500">{note}</div>
    </div>
  );
}

function ParameterBasis({ parameter }: { parameter: Bzm22PilotParameter }) {
  return (
    <div className="min-w-0 space-y-1 text-[9px] leading-4 text-slate-600">
      <div><span className="font-semibold text-slate-700">規則</span> {parameter.rule || "未登録"}</div>
      <div><span className="font-semibold text-slate-700">根拠</span> {parameter.sourceRefs.length > 0 ? parameter.sourceRefs.join(" / ") : "未登録"}</div>
      <div><span className="font-semibold text-slate-700">精度要因</span> {parameter.confidenceDriver || "なし"}</div>
      <div><span className="font-semibold text-slate-700">締切</span> {formatDateTime(parameter.cutoff)}</div>
    </div>
  );
}

function ScenarioValues({ parameter }: { parameter: Bzm22PilotParameter }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-1 font-mono text-[9px] leading-4 text-slate-600">
        <span className="text-slate-400">L</span><span className="break-words">{compactValue(formatUnitValue(parameter.imputed.low, parameter.unit))}</span>
        <span className="text-slate-400">B</span><span className="break-words">{compactValue(formatUnitValue(parameter.imputed.base, parameter.unit))}</span>
        <span className="text-slate-400">H</span><span className="break-words">{compactValue(formatUnitValue(parameter.imputed.high, parameter.unit))}</span>
      </div>
      <ValueDisclosure label="L/B/H 全値" value={parameter.imputed} unit={parameter.unit} />
    </div>
  );
}

function ParameterDesktopTable({ parameters }: { parameters: Bzm22PilotParameter[] }) {
  return (
    <div className="hidden max-w-full overflow-x-auto lg:block">
      <table className="w-full min-w-[1120px] border-collapse text-left text-[9px] leading-4">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="w-10 px-2 py-1.5 text-right">#</th>
            <th className="w-[210px] px-2 py-1.5">パラメータ</th>
            <th className="w-[170px] px-2 py-1.5">現在値</th>
            <th className="w-[210px] px-2 py-1.5">L / B / H</th>
            <th className="w-[130px] px-2 py-1.5">状態</th>
            <th className="px-2 py-1.5">設定根拠</th>
            <th className="w-[92px] px-2 py-1.5">計算</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((parameter) => (
            <tr key={parameter.id} className="border-t border-slate-100 align-top even:bg-slate-50/50">
              <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-400">{parameter.index}</td>
              <td className="px-2 py-2">
                <div className="break-all font-mono text-[9px] font-semibold text-[#234d5e]">{parameter.id}</div>
                <div className="mt-0.5 text-slate-500">{formatUnitLabel(parameter.unit)}</div>
              </td>
              <td className="px-2 py-2">
                <div className="break-words font-mono text-slate-700">{compactValue(formatUnitValue(parameter.value, parameter.unit))}</div>
                <ValueDisclosure value={parameter.value} unit={parameter.unit} />
              </td>
              <td className="px-2 py-2"><ScenarioValues parameter={parameter} /></td>
              <td className="px-2 py-2">
                <StatusBadge status={parameter.observedStatus} />
                {hasPrecisionLoss(parameter.precisionLossContribution) ? (
                  <div className="mt-1 text-[8px] leading-3 text-amber-800">精度低下: {compactValue(parameter.precisionLossContribution)}</div>
                ) : null}
              </td>
              <td className="px-2 py-2"><ParameterBasis parameter={parameter} /></td>
              <td className="px-2 py-2">
                <span className={`inline-flex border px-1.5 py-0.5 font-semibold ${parameter.usedInCalculation ? "border-cyan-200 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                  {parameter.usedInCalculation ? "使用中" : "未使用"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParameterMobileCards({ parameters }: { parameters: Bzm22PilotParameter[] }) {
  return (
    <div className="divide-y divide-slate-100 lg:hidden">
      {parameters.map((parameter) => (
        <article key={parameter.id} className="min-w-0 px-3 py-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[9px] font-semibold text-[#234d5e]">#{parameter.index} {parameter.id}</div>
              <div className="mt-0.5 text-[9px] text-slate-500">{formatUnitLabel(parameter.unit)}</div>
            </div>
            <StatusBadge status={parameter.observedStatus} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="min-w-0 border border-slate-100 bg-slate-50 p-2">
              <div className="text-[8px] font-semibold text-slate-500">現在値</div>
              <div className="mt-1 break-words font-mono text-[10px] text-slate-700">{compactValue(formatUnitValue(parameter.value, parameter.unit), 140)}</div>
              <ValueDisclosure value={parameter.value} unit={parameter.unit} />
            </div>
            <div className="min-w-0 border border-slate-100 p-2">
              <div className="mb-1 text-[8px] font-semibold text-slate-500">仮定束 L / B / H</div>
              <ScenarioValues parameter={parameter} />
            </div>
          </div>
          <div className="mt-2"><ParameterBasis parameter={parameter} /></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px]">
            <span className={`border px-1.5 py-0.5 font-semibold ${parameter.usedInCalculation ? "border-cyan-200 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              {parameter.usedInCalculation ? "計算に使用" : "計算には未使用"}
            </span>
            {hasPrecisionLoss(parameter.precisionLossContribution) ? (
              <span className="text-amber-800">精度低下: {compactValue(parameter.precisionLossContribution)}</span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ParameterGroup({
  group,
  parameters,
  open,
  onToggle,
}: {
  group: Bzm22PilotParameterGroup;
  parameters: Bzm22PilotParameter[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="min-w-0 border-t border-slate-200 first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-white px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-700"
      >
        <span className="min-w-0">
          <span className="text-[11px] font-semibold text-[#254c5d]">{group.label}</span>
          <span className="ml-2 font-mono text-[9px] text-slate-500">{group.key}</span>
        </span>
        <span className="text-[9px] text-slate-500">{parameters.length}/{group.count}件 {open ? "閉じる⌃" : "開く⌄"}</span>
      </button>
      {open ? (
        parameters.length > 0 ? (
          <div className="border-t border-slate-200">
            <ParameterDesktopTable parameters={parameters} />
            <ParameterMobileCards parameters={parameters} />
          </div>
        ) : (
          <div className="border-t border-slate-100 px-3 py-4 text-[10px] text-slate-500">この条件に一致する項目はない。</div>
        )
      ) : null}
    </section>
  );
}

function ParameterLedger({ groups }: { groups: Bzm22PilotParameterGroup[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ParameterFilter>("all");
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(groups[0] ? [groups[0].key] : []));

  const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP");
  const filtered = useMemo(
    () => groups.map((group) => ({
      group,
      parameters: group.parameters.filter((parameter) => {
        if (filter === "used" && !parameter.usedInCalculation) return false;
        if (filter === "uncertain" && !isUncertain(parameter)) return false;
        return !normalizedQuery || parameterSearchText(parameter).includes(normalizedQuery);
      }),
    })),
    [filter, groups, normalizedQuery],
  );
  const visibleCount = filtered.reduce((sum, row) => sum + row.parameters.length, 0);
  const totalCount = groups.reduce((sum, group) => sum + group.parameters.length, 0);

  return (
    <section aria-labelledby="bzm22-parameter-ledger-title" className="min-w-0 border-t border-[#aac1ca] bg-white">
      <div className="border-b border-slate-200 bg-[#f3f7f8] px-3 py-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="bzm22-parameter-ledger-title" className="text-[12px] font-semibold text-[#173f51]">全パラメータ台帳</h3>
            <p className="mt-0.5 text-[9px] leading-4 text-slate-600">{totalCount}項目の現在値、L/B/H仮定束、状態、設定規則、根拠、情報締切を同じ表で確認する。</p>
          </div>
          <div className="font-mono text-[9px] tabular-nums text-slate-500">表示 {visibleCount} / {totalCount}</div>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto_auto] md:items-center">
          <label className="min-w-0">
            <span className="sr-only">パラメータ検索</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ID・規則・根拠・状態で検索"
              className="min-h-10 w-full border border-slate-300 bg-white px-3 text-[11px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-700 focus:ring-1 focus:ring-cyan-700 md:min-h-8"
            />
          </label>
          <div className="grid grid-cols-3 border border-slate-300 bg-white" aria-label="パラメータ表示条件">
            {([
              ["all", "全項目"],
              ["used", "計算使用"],
              ["uncertain", "精度低下"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-10 border-l border-slate-200 px-2 text-[9px] font-semibold first:border-l-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-700 md:min-h-8 ${filter === value ? "bg-[#dcebed] text-[#174b60]" : "text-slate-500 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 border border-slate-300 bg-white">
            <button type="button" onClick={() => setOpenGroups(new Set(groups.map((group) => group.key)))} className="min-h-10 px-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-700 md:min-h-8">全て開く</button>
            <button type="button" onClick={() => setOpenGroups(new Set())} className="min-h-10 border-l border-slate-200 px-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-700 md:min-h-8">全て閉じる</button>
          </div>
        </div>
      </div>
      {filtered.map(({ group, parameters }) => (
        <ParameterGroup
          key={group.key}
          group={group}
          parameters={parameters}
          open={openGroups.has(group.key)}
          onToggle={() => setOpenGroups((current) => {
            const next = new Set(current);
            if (next.has(group.key)) next.delete(group.key);
            else next.add(group.key);
            return next;
          })}
        />
      ))}
    </section>
  );
}

function PilotPanel({ pilot }: { pilot: Bzm22PilotProject }) {
  const incompleteSources = pilot.sourceCoverage.sources.filter((source) => !source.paginationComplete);
  const parameterCount = pilot.groups.reduce((sum, group) => sum + group.parameters.length, 0);
  const conditionalValueIsNa = /not_applicable|n\/a/i.test(pilot.summary.conditionalSuccessValueStatus);

  return (
    <section
      data-testid="bzm22-provisional-primary"
      aria-labelledby="bzm22-provisional-title"
      className="min-w-0 overflow-hidden border border-[#7898a5] bg-[#f6f8f8]"
    >
      <header className="border-b border-[#365865] bg-[#162f3a] px-3 py-3 text-white sm:px-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="bzm22-provisional-title" className="text-[14px] font-semibold tracking-tight">BZM 2.2 暫定主表示</h2>
              <span className="border border-amber-300/70 bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">未検証・低精度</span>
              <span className="border border-cyan-200/40 bg-cyan-50/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-50">影の比較のみ</span>
            </div>
            <p className="mt-1 max-w-4xl text-[10px] leading-4 text-slate-200">
              valuationに出にくい戦略余力を、状態・行動・遷移・CF・介入の103項目で暫定可視化する。順位付け、資源配分、撤退判断には使わない。
            </p>
          </div>
          <div className="shrink-0 text-right font-mono text-[8px] leading-4 text-slate-300">
            <div>{pilot.projectName} · BZM {pilot.modelVersion}</div>
            <div>価値基準日 {pilot.valuationDate}</div>
            <div>情報締切 {formatDateTime(pilot.informationCutoff)}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-px border-b border-[#b9cbd1] bg-[#c9d5d9] sm:grid-cols-2 xl:grid-cols-4">
        <ScenarioMetric label="J · 動的正味PJ価値" value={pilot.summary.jValueMillionJpy} kind="million" note="支出と将来の戦略余力寄与を同じ動学で扱う暫定値" />
        <ScenarioMetric label="P · 成功時条件付き価値" value={pilot.summary.conditionalSuccessValueMillionJpy} kind="million" note={conditionalValueIsNa ? "歴史的終端などのため対象外" : "Jとは別の条件付き出力。二重計上しない"} />
        <ScenarioMetric label="gate積 proxy" value={pilot.summary.qGateProductProxy} kind="probability" note="校正済み到達確率ではない" />
        <ScenarioMetric label="stress最小 gate積 proxy" value={pilot.summary.qStressProxy} kind="probability" note="理論上のq_robでも信頼区間でもない" />
      </div>

      <div className="grid gap-px border-b border-[#b9cbd1] bg-[#d4dde0] sm:grid-cols-3">
        <div className="bg-white px-3 py-2">
          <div className="text-[8px] font-semibold text-slate-500">登録済み現在方針</div>
          <div className="mt-1 text-[11px] font-semibold text-[#234d5e]">{pilot.summary.registeredCurrentControl || "未登録"}</div>
          <div className="mt-0.5 text-[8px] text-slate-500">argmaxではなくshadow上の登録方針</div>
        </div>
        <div className="bg-white px-3 py-2">
          <div className="text-[8px] font-semibold text-slate-500">最初の資金経路喪失</div>
          <div className="mt-1 text-[11px] font-semibold tabular-nums text-[#234d5e]">{pilot.summary.firstPathLossMonth ?? "経路内なし / 未確認"}</div>
          <div className="mt-0.5 text-[8px] text-slate-500">no-financing CFのfirst passage</div>
        </div>
        <div className="bg-white px-3 py-2">
          <div className="text-[8px] font-semibold text-slate-500">行動境界 / パラメータ</div>
          <div className="mt-1 text-[11px] font-semibold tabular-nums text-[#234d5e]">承認 {pilot.summary.actionBoundaryCounts.authorityApproved} / shadow {pilot.summary.actionBoundaryCounts.shadow} · {parameterCount}項目</div>
          <div className="mt-0.5 text-[8px] text-slate-500">権限承認0件の行動を実行推奨へ昇格しない</div>
        </div>
      </div>

      <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[9px] leading-4 text-amber-950 sm:px-4">
        <span className="font-semibold">読取境界:</span> 前向き検証 {pilot.claimBoundary.forwardValidationCount}件。L/B/Hは信頼区間ではなく仮定束。gate積 proxyは到達見込みではない。情報源は {incompleteSources.length > 0 ? `${incompleteSources.length}系統で走査未完了` : "走査完了"}。
      </div>

      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 border-b border-slate-200 bg-white px-3 py-1.5 text-[8px] text-slate-500 sm:px-4">
        <span className="font-semibold text-[#294c5b]">情報源走査</span>
        {pilot.sourceCoverage.sources.map((source) => (
          <span key={source.key} className={source.paginationComplete ? "text-emerald-700" : "text-amber-800"}>
            {source.key} {source.paginationComplete ? "完了" : "未完了"} · {source.uniqueItems.toLocaleString("ja-JP")}/{source.fetchedItems.toLocaleString("ja-JP")}
          </span>
        ))}
      </div>

      <ParameterLedger key={pilot.projectId} groups={pilot.groups} />

      <footer className="border-t border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[8px] leading-4 text-slate-500 sm:px-4">
        artifact SHA-256 <span className="break-all">{pilot.artifactSha256}</span>
      </footer>
    </section>
  );
}

export function Bzm22ProvisionalObservatory({
  projectId,
  active = true,
}: {
  projectId: string;
  active?: boolean;
}) {
  const [state, setState] = useState<LoadState>(() => {
    const cached = PILOT_CACHE.get(projectId);
    return cached
      ? { status: "ready", projectId, pilot: cached }
      : { status: "idle", projectId };
  });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const cached = PILOT_CACHE.get(projectId);
    const request = cached
      ? Promise.resolve<Bzm22PilotApiPayload>({ pilot: cached })
      : fetch(`/api/project/${encodeURIComponent(projectId)}/bzm-2-2-pilot`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => null) as Bzm22PilotApiPayload | { error?: string } | null;
        if (!response.ok || !json || !("pilot" in json)) {
          throw new Error(json && "error" in json && json.error ? json.error : "BZM 2.2 暫定試算の取得に失敗");
        }
        return json;
      });
    request
      .then((json) => {
        PILOT_CACHE.set(projectId, json.pilot);
        if (!cancelled) setState({ status: "ready", projectId, pilot: json.pilot });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            projectId,
            error: error instanceof Error ? error.message : "BZM 2.2 暫定試算の取得に失敗",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, projectId]);

  if (state.projectId !== projectId) {
    return (
      <div data-testid="bzm22-provisional-primary" className="grid min-h-[220px] place-items-center border border-[#aac1ca] bg-[#f6f8f8] px-4 text-center text-[11px] text-slate-500">
        BZM 2.2 暫定試算を切り替え中…
      </div>
    );
  }

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div data-testid="bzm22-provisional-primary" className="grid min-h-[220px] place-items-center border border-[#aac1ca] bg-[#f6f8f8] px-4 text-center text-[11px] text-slate-500">
        <div>
          <div className="font-semibold text-[#254c5d]">BZM 2.2 暫定主表示</div>
          <div className="mt-1">103項目のPJ別台帳を読み込み中…</div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div data-testid="bzm22-provisional-primary" className="border border-red-200 bg-red-50 px-4 py-3 text-[11px] leading-5 text-red-800">
        <div className="font-semibold">BZM 2.2 暫定主表示を読み出せていない</div>
        <div>{state.error}</div>
        <div className="text-[9px]">旧モデルの値へ自動置換せず、この表示だけを欠測として止める。</div>
      </div>
    );
  }

  return <PilotPanel pilot={state.pilot} />;
}
