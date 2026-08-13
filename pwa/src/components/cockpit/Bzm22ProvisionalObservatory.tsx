"use client";

import { useEffect, useMemo, useState } from "react";
import { Tex } from "@/components/venture-map/Tex";
import {
  BZM22_FIXED_POLICY,
  BZM22_TOP_METRICS,
  formatMillionJpy,
  type Bzm22PilotApiPayload,
  type Bzm22PilotParameter,
  type Bzm22PilotParameterGroup,
  type Bzm22PilotProject,
  type Bzm22SimulationPolicyOption,
  type Bzm22PilotTimeline,
  type Bzm22Scenario,
  type Bzm22TimelineItem,
} from "@/lib/bzm-2-2-pilot-ui";
import {
  BZM22_FORMULA_CATALOG,
  BZM22_PARAMETER_RELATION_LABELS,
  getBzm22ParameterCatalogEntry,
  type Bzm22ParameterRelation,
} from "@/lib/bzm-2-2-parameter-catalog";

type LoadState =
  | { status: "idle"; projectId: string }
  | { status: "loading"; projectId: string }
  | { status: "ready"; projectId: string; pilot: Bzm22PilotProject }
  | { status: "error"; projectId: string; error: string };

type ParameterFilter = "all" | "used" | "uncertain";

const PILOT_CACHE = new Map<string, Bzm22PilotProject>();
const UNCERTAIN_STATUS = /missing|estimated|partial|imputed|conditional|hearing|unknown|incomplete/i;
const MILLION_JPY_UNIT = /^million_jpy(?:_|$)/i;

const SOURCE_LABELS: Record<string, string> = {
  bzm: "BZMモデル仕様",
  contract: "計算契約",
  drive: "PJ資料室",
  gmail: "Gmail",
  notion: "Notion",
  os_db: "OSデータ",
  slack: "Slack",
  calendar: "カレンダー",
};

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

const RELATION_META: Record<Bzm22ParameterRelation, { className: string; description: string }> = {
  direct: {
    className: "border-[#8bbcaf] bg-[#e8f4ef] text-[#205f52]",
    description: "数値として式へ入る",
  },
  indirect: {
    className: "border-[#9bb7ce] bg-[#eef5fa] text-[#285b7a]",
    description: "状態・遷移を介して効く",
  },
  guard: {
    className: "border-slate-300 bg-slate-50 text-slate-600",
    description: "計算可否・証拠境界を守る",
  },
  output: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    description: "式から算出した結果",
  },
  unused: {
    className: "border-slate-200 bg-slate-100 text-slate-500",
    description: "現pilotの計算には未接続",
  },
  alias: {
    className: "border-amber-200 bg-amber-50 text-amber-900",
    description: "別slotと同じ値・二重加算禁止",
  },
};

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

function sameScenarioValue(parameter: Bzm22PilotParameter) {
  return jsonText(parameter.imputed.low) === jsonText(parameter.imputed.base)
    && jsonText(parameter.imputed.base) === jsonText(parameter.imputed.high);
}

function readableValue(value: unknown, unit: string, maxLength = 78) {
  const formatted = formatUnitValue(value, unit);
  if (Array.isArray(formatted)) return `${formatted.length}件の内訳`;
  if (formatted && typeof formatted === "object") {
    const count = Object.keys(formatted).length;
    return `${count}項目の内訳`;
  }
  const text = compactValue(formatted, maxLength);
  const labels: Record<string, string> = {
    true: "有効",
    false: "無効",
    JPY: "日本円",
    BZM: "BZM",
    "2.2-provisional-full-imputation": "BZM 2.2・全項目推定版",
    not_applicable: "対象外",
    structurally_not_computable: "構造上、計算対象外",
  };
  return labels[text] ?? text;
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

function precisionImpactLabel(value: Bzm22PilotParameter["precisionLossContribution"]) {
  const normalized = compactValue(value).toLowerCase();
  const labels: Record<string, string> = {
    low: "小",
    medium: "中",
    high: "大",
  };
  return labels[normalized] ?? compactValue(value);
}

function isUncertain(parameter: Bzm22PilotParameter) {
  return UNCERTAIN_STATUS.test(parameter.observedStatus) || hasPrecisionLoss(parameter.precisionLossContribution);
}

function parameterSearchText(parameter: Bzm22PilotParameter) {
  const catalog = getBzm22ParameterCatalogEntry(parameter.id);
  return [
    catalog.japaneseName,
    catalog.symbolTex,
    catalog.formulaConnection,
    catalog.roleLabel,
    catalog.relationLabel,
    ...catalog.formulaRefs.flatMap((ref) => [ref, BZM22_FORMULA_CATALOG[ref].title, BZM22_FORMULA_CATALOG[ref].tex]),
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

function ParameterIdentity({ parameter }: { parameter: Bzm22PilotParameter }) {
  const catalog = getBzm22ParameterCatalogEntry(parameter.id);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <div className="text-[11px] font-semibold leading-4 text-[#173f51]">{catalog.japaneseName}</div>
        <span className="border border-[#b9cbd1] bg-[#f3f7f8] px-1.5 py-0.5 text-[8px] font-semibold leading-none text-[#365865]">
          {catalog.roleLabel}
        </span>
      </div>
      {catalog.symbolTex ? (
        <div className="mt-1.5 border-l-2 border-cyan-700 bg-cyan-50/60 px-2 py-1">
          <div className="text-[8px] font-semibold text-slate-500">この項目を表す記号</div>
          <div className="mt-0.5 overflow-x-auto whitespace-nowrap text-[13px] font-semibold text-[#174b60]">
            <Tex tex={catalog.symbolTex} />
          </div>
          <div className="mt-0.5 text-[8px] leading-3 text-slate-600">下の式では、この記号の値として使う。</div>
        </div>
      ) : (
        <div className="mt-1.5 border-l-2 border-slate-300 bg-slate-50 px-2 py-1 text-[9px] font-semibold text-slate-600">
          数式には直接入らない管理項目
        </div>
      )}
      <p className="mt-1.5 text-[9px] leading-4 text-slate-700">{catalog.formulaConnection}</p>
      <div className="mt-1.5 space-y-1 border-t border-slate-100 pt-1.5">
        <div className="text-[8px] font-semibold text-slate-500">関係する式</div>
        {catalog.formulaRefs.map((ref) => {
          const formula = BZM22_FORMULA_CATALOG[ref];
          return (
            <a key={ref} href={`#bzm22-formula-${ref}`} className="flex min-w-0 items-baseline gap-1.5 text-[#285b6b] hover:text-cyan-800">
              <span className="shrink-0 border border-[#9fb8c1] bg-white px-1 py-0.5 font-mono text-[8px] font-bold leading-none">{ref}</span>
              <span className="min-w-0 text-[8px] font-semibold">{formula.title}</span>
            </a>
          );
        })}
      </div>
      <details className="mt-1.5 text-[8px] text-slate-400">
        <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-2 marker:content-none">監査用の内部情報</summary>
        <div className="mt-1 break-all border border-slate-100 bg-slate-50 p-1.5 font-mono leading-3">
          {parameter.id} · {formatUnitLabel(parameter.unit)}
        </div>
      </details>
    </div>
  );
}

function FormulaIndex() {
  return (
    <details id="bzm22-formulas" open className="border-b border-[#b9cbd1] bg-white">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[10px] font-semibold text-[#234d5e] marker:content-none hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-700 sm:px-4">
        <span>接続式一覧 F0–F14</span>
        <span className="text-[8px] font-normal text-slate-500">各入力の「接続式」番号を照合</span>
      </summary>
      <div className="grid border-t border-slate-200 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(BZM22_FORMULA_CATALOG)
          .filter(([ref]) => ref.startsWith("F"))
          .map(([ref, formula]) => (
            <div id={`bzm22-formula-${ref}`} key={ref} className="min-w-0 scroll-mt-20 border-b border-r border-slate-200 px-3 py-2">
              <div className="flex items-baseline gap-1.5">
                <span className="border border-[#9fb8c1] bg-[#edf3f5] px-1 py-0.5 font-mono text-[8px] font-bold leading-none text-[#285b6b]">{ref}</span>
                <span className="text-[9px] font-semibold text-[#234d5e]">{formula.title}</span>
              </div>
              <div className="mt-1 overflow-x-auto whitespace-nowrap text-[9px] text-[#285b6b]"><Tex tex={formula.tex} /></div>
              <div className="mt-1 text-[8px] leading-3 text-slate-500">{formula.description}</div>
            </div>
          ))}
      </div>
      <div className="border-t border-slate-200 px-3 py-1.5 text-[8px] text-slate-500 sm:px-4">
        「—」は管理・再現性または現pilot未接続。J / P / Q / S chipは同名の主出力を示す。
      </div>
    </details>
  );
}

const TIMELINE_CATEGORY_META: Record<Bzm22TimelineItem["category"], { label: string; className: string }> = {
  registered_policy: { label: "登録方針", className: "border-[#77a99c] bg-[#e8f4ef] text-[#205f52]" },
  technical: { label: "技術", className: "border-cyan-200 bg-cyan-50 text-cyan-900" },
  facility: { label: "設備・量産", className: "border-violet-200 bg-violet-50 text-violet-900" },
  commercial: { label: "事業・商流", className: "border-blue-200 bg-blue-50 text-blue-900" },
  funding_external: { label: "資金・外部", className: "border-amber-200 bg-amber-50 text-amber-900" },
};

const TIMELINE_PRECISION_LABELS: Record<string, string> = {
  registered_shadow: "登録shadow",
  observed_or_documented: "観測・文書",
  mixed: "混合根拠",
  imputed_or_assumed: "推定・仮定",
  unknown: "精度未登録",
};

const TIMELINE_OCCURRENCE_LABELS: Record<string, string> = {
  occurred: "過去実績",
  available: "利用可能",
  recorded: "記録済み",
  conditional: "条件付き",
  imputed: "推定",
  unknown: "状態未登録",
};

function timelineStatusLabel(item: Bzm22TimelineItem) {
  if (item.kind === "registered_current_control_shadow") return "固定方針・最適化なし";
  if (item.kind === "confirmed_decision") return "根拠付き実行済み";
  if (item.kind === "future_decision_point") return "将来判断点";
  if (item.status === "liquidity_proxy_not_commitment") return "成立性proxy・確約なし";
  if (item.kind === "confirmed_external_event") return "外部実績・意思決定ではない";
  return "計画・仮定イベント";
}

function axisPercent(dateValue: string, timeline: Bzm22PilotTimeline) {
  const start = Date.parse(`${timeline.axis.startDate}T00:00:00Z`);
  const end = Date.parse(`${timeline.axis.endDate}T00:00:00Z`);
  const point = Date.parse(`${dateValue}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(point) || end <= start) return 0;
  return Math.min(100, Math.max(0, ((point - start) / (end - start)) * 100));
}

function TimelineTrack({ item, timeline }: { item: Bzm22TimelineItem; timeline: Bzm22PilotTimeline }) {
  if (!item.startDate || !item.endDate) {
    return <div className="flex h-7 items-center justify-center border-x border-dashed border-slate-200 text-[8px] text-slate-400">日付未登録</div>;
  }
  const left = axisPercent(item.startDate, timeline);
  const right = axisPercent(item.endDate, timeline);
  const width = Math.max(1.25, right - left);
  const valuation = axisPercent(timeline.axis.valuationDate, timeline);
  return (
    <div className="relative h-7 overflow-hidden border-x border-slate-200 bg-[linear-gradient(to_right,#f8fafc_1px,transparent_1px)] bg-[size:12.5%_100%]">
      <div className="absolute inset-y-0 w-px bg-[#2d7a6a]/50" style={{ left: `${valuation}%` }} title={`評価日 ${timeline.axis.valuationDate}`} />
      <div
        className={`absolute top-2 h-3 min-w-1 border ${TIMELINE_CATEGORY_META[item.category].className}`}
        style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%` }}
        title={`${item.label} · ${item.dateLabel}`}
      />
    </div>
  );
}

function TimelineItemMeta({ item }: { item: Bzm22TimelineItem }) {
  const category = TIMELINE_CATEGORY_META[item.category];
  return (
    <div className="min-w-0 px-2 py-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <span className="text-[9px] font-semibold leading-4 text-[#173f51]">{item.label}</span>
        <span className={`border px-1 py-0.5 text-[7px] font-semibold leading-none ${category.className}`}>{category.label}</span>
        {item.occurrenceRole ? <span className="border border-slate-200 bg-white px-1 py-0.5 text-[7px] leading-none text-slate-600">{TIMELINE_OCCURRENCE_LABELS[item.occurrenceRole]}</span> : null}
      </div>
      <div className="mt-0.5 text-[8px] leading-3 text-slate-500">{item.dateLabel} · {timelineStatusLabel(item)}</div>
      <div className={`mt-1 border-l-2 px-1.5 text-[8px] font-semibold leading-3 ${item.choiceRole === "not_a_choice" ? "border-slate-300 text-slate-500" : "border-[#2d7a6a] text-[#205f52]"}`}>
        {item.choiceLabel}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[7px] leading-3 text-slate-400">
        <span>{TIMELINE_PRECISION_LABELS[item.precision] ?? "精度未登録"}</span>
        <span>根拠 {item.sourceRefCount}件</span>
        {item.amountMillionJpy !== undefined && item.amountMillionJpy !== null ? <span>{formatMillionJpy(item.amountMillionJpy)}</span> : null}
        {item.probability !== undefined && item.probability !== null ? <span>条件値 {(item.probability * 100).toFixed(0)}%</span> : null}
      </div>
    </div>
  );
}

function DecisionEventTimeline({ timeline }: { timeline: Bzm22PilotTimeline }) {
  const valuation = axisPercent(timeline.axis.valuationDate, timeline);
  return (
    <section aria-labelledby="bzm22-timeline-title" className="border-b border-[#b9cbd1] bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-3 py-2 sm:px-4">
        <div>
          <h3 id="bzm22-timeline-title" className="text-[11px] font-semibold text-[#173f51]">選択と事業イベントの時間軸</h3>
          <p className="mt-0.5 text-[8px] leading-3 text-slate-500">各イベントの時期と、そのイベントの試算で前提にした進め方を並べて確認する。</p>
        </div>
        <div className="text-[8px] text-[#2d7a6a]">評価日線 {timeline.axis.valuationDate}</div>
      </header>

      <div className="hidden lg:block">
        <div className="grid grid-cols-[250px_minmax(0,1fr)] border-b border-slate-200 bg-slate-50">
          <div className="px-2 py-1 text-[8px] font-semibold text-slate-500">イベント / 根拠状態</div>
          <div className="relative h-8 border-x border-slate-200 text-[7px] text-slate-400">
            <span className="absolute left-1 top-1">{timeline.axis.startDate}</span>
            <span className="absolute top-1 -translate-x-1/2 font-semibold text-[#2d7a6a]" style={{ left: `${valuation}%` }}>評価日</span>
            <span className="absolute right-1 top-1">{timeline.axis.endDate}</span>
            <div className="absolute bottom-1 left-0 right-0 h-px bg-slate-300" />
          </div>
        </div>
        {timeline.lanes.map((lane) => (
          <div key={lane.key} className="border-b border-slate-200 last:border-b-0">
            <div className="grid grid-cols-[250px_minmax(0,1fr)] bg-[#f6f8f8]">
              <div className="px-2 py-1 text-[8px] font-bold tracking-wide text-[#365865]">{lane.label}</div>
              <div className="border-x border-slate-200" />
            </div>
            {lane.items.length === 0 ? (
              <div className="grid grid-cols-[250px_minmax(0,1fr)]">
                <div className="px-2 py-2 text-[8px] leading-3 text-slate-400">{lane.emptyMessage}</div>
                <div className="h-8 border-x border-dashed border-slate-200 bg-slate-50/40" />
              </div>
            ) : lane.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[250px_minmax(0,1fr)] border-t border-slate-100 first:border-t-0">
                <TimelineItemMeta item={item} />
                <TimelineTrack item={item} timeline={timeline} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="divide-y divide-slate-200 lg:hidden">
        {timeline.lanes.map((lane) => (
          <section key={lane.key} className="px-3 py-2 sm:px-4">
            <h4 className="text-[9px] font-bold text-[#365865]">{lane.label}</h4>
            {lane.items.length === 0 ? (
              <p className="mt-1 border-l-2 border-slate-200 pl-2 text-[8px] leading-4 text-slate-400">{lane.emptyMessage}</p>
            ) : (
              <div className="mt-1 divide-y divide-slate-100 border border-slate-200">
                {lane.items.map((item) => (
                  <div key={item.id}>
                    <TimelineItemMeta item={item} />
                    <p className="border-t border-slate-100 px-2 py-1 text-[8px] leading-3 text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

function FormulaRelation({ parameter }: { parameter: Bzm22PilotParameter }) {
  const catalog = getBzm22ParameterCatalogEntry(parameter.id);
  const meta = RELATION_META[catalog.relation];
  return (
    <div className="min-w-0">
      <span className={`inline-flex border px-1.5 py-0.5 text-[9px] font-semibold ${meta.className}`}>
        {BZM22_PARAMETER_RELATION_LABELS[catalog.relation]}
      </span>
      <div className="mt-1 text-[8px] leading-3 text-slate-500">{meta.description}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META.find((candidate) => candidate.pattern.test(status)) ?? {
    label: "状態",
    className: "border-slate-200 bg-white text-slate-600",
  };
  return (
    <span
      className={`inline-flex min-h-5 items-center border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${meta.className}`}
      title={meta.label}
    >
      {meta.label}
    </span>
  );
}

function ValueDisclosure({
  value,
  label = "内訳を見る",
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
  symbol,
  label,
  formula,
  value,
  kind,
  note,
}: {
  symbol: keyof typeof BZM22_TOP_METRICS;
  label: string;
  formula: string;
  value: Bzm22Scenario<number | null>;
  kind: "probability" | "million";
  note: string;
}) {
  return (
    <div className="min-w-0 bg-white px-3 py-2.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[16px] font-bold text-[#173f51]">{symbol}</span>
        <span className="text-[9px] font-semibold tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="mt-1 text-[15px] font-semibold tabular-nums text-[#173f51]">
        {formatNumber(value.base, kind)}
      </div>
      <div className="mt-1 overflow-x-auto whitespace-nowrap border-y border-slate-100 py-1 text-[10px] text-[#294c5b]">
        <Tex tex={formula} />
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1 text-[8px] tabular-nums text-slate-500">
        <span>慎重 {formatNumber(value.low, kind)}</span>
        <span>基準 {formatNumber(value.base, kind)}</span>
        <span>強気 {formatNumber(value.high, kind)}</span>
      </div>
      <div className="mt-1 text-[8px] leading-3 text-slate-500">{note}</div>
    </div>
  );
}

function simulationValue(option: Bzm22SimulationPolicyOption, key: keyof NonNullable<Bzm22SimulationPolicyOption["metrics"]>, scenario: keyof Bzm22Scenario<unknown>) {
  return option.metrics?.[key][scenario] ?? null;
}

function SimulationOutput({
  symbol,
  baseline,
  simulated,
  kind,
}: {
  symbol: keyof typeof BZM22_TOP_METRICS;
  baseline: number | null;
  simulated: number | null;
  kind: "probability" | "million";
}) {
  const delta = baseline !== null && simulated !== null ? simulated - baseline : null;
  const format = (value: number | null) => formatNumber(value, kind);
  const deltaText = delta === null
    ? "差分なし"
    : kind === "million"
      ? `${delta >= 0 ? "+" : ""}${formatMillionJpy(delta)}`
      : `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}pt`;
  return (
    <div className="border-l border-slate-200 px-3 first:border-l-0">
      <div className="text-[10px] font-black text-[#173f51]">{symbol}</div>
      <div className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">{format(baseline)}</div>
      <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-[#173f51]">→ {format(simulated)}</div>
      <div className="mt-0.5 text-[8px] font-semibold text-[#2d6b5d]">{deltaText}</div>
    </div>
  );
}

function PolicyWhatIf({ pilot }: { pilot: Bzm22PilotProject }) {
  const [scenario, setScenario] = useState<keyof Bzm22Scenario<unknown>>("base");
  const [selectedId, setSelectedId] = useState(pilot.simulation.currentPolicyId);
  const baseline = pilot.simulation.policyOptions.find((option) => option.id === pilot.simulation.currentPolicyId);
  const selected = pilot.simulation.policyOptions.find((option) => option.id === selectedId) ?? baseline;
  if (!baseline || !selected) return null;
  const changed = selected.id !== baseline.id;
  const metrics = [
    ["J", "jValueMillionJpy", "million"],
    ["P", "conditionalSuccessValueMillionJpy", "million"],
    ["Q", "qGateProductProxy", "probability"],
    ["S", "qStressProxy", "probability"],
  ] as const;
  return (
    <section aria-labelledby="bzm22-what-if-title" className="border-b border-[#8faab4] bg-[#edf3f5]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#b9cbd1] px-3 py-2 sm:px-4">
        <div>
          <h3 id="bzm22-what-if-title" className="text-[11px] font-semibold text-[#173f51]">別の進め方を試す</h3>
          <p className="mt-0.5 text-[8px] text-slate-500">登録済みの計算条件を丸ごと切り替え、J・P・Q・Sの差を見る。この画面を離れると元に戻る。</p>
        </div>
        {changed ? (
          <button type="button" onClick={() => setSelectedId(baseline.id)} className="min-h-8 border border-[#7898a5] bg-white px-2 text-[9px] font-semibold text-[#285b6b] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">
            元の前提に戻す
          </button>
        ) : null}
      </header>
      <div className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)] sm:px-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <label className="min-w-0">
            <span className="block text-[8px] font-semibold text-slate-500">この画面で試す進め方</span>
            <select
              value={selected.id}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1 min-h-10 w-full border border-slate-300 bg-white px-2 text-[10px] font-semibold text-[#173f51] outline-none focus:border-cyan-700 focus:ring-1 focus:ring-cyan-700"
            >
              {pilot.simulation.policyOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={!option.metrics}>
                  {option.label}{option.id === baseline.id ? "（登録中）" : "（比較候補）"}{!option.metrics ? "・計算条件不足" : ""}
                </option>
              ))}
            </select>
          </label>
          <div>
            <div className="text-[8px] font-semibold text-slate-500">前提ケース</div>
            <div className="mt-1 grid grid-cols-3 border border-slate-300 bg-white">
              {(["low", "base", "high"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={scenario === key}
                  onClick={() => setScenario(key)}
                  className={`min-h-10 border-l border-slate-200 px-2 text-[9px] font-semibold first:border-l-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 ${scenario === key ? "bg-[#dcebed] text-[#174b60]" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  {key === "low" ? "慎重" : key === "base" ? "基準" : "強気"}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="text-[8px] font-semibold text-slate-500">登録中の進め方</div>
            <div className="mt-0.5 text-[9px] text-slate-700">{baseline.label}</div>
            <div className="mt-1 text-[8px] font-semibold text-slate-500">試している進め方</div>
            <div className="mt-0.5 text-[10px] font-semibold text-[#174b60]">{selected.label}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-3 border border-[#b9cbd1] bg-white py-3 sm:grid-cols-4">
          {metrics.map(([symbol, key, kind]) => (
            <SimulationOutput
              key={symbol}
              symbol={symbol}
              baseline={simulationValue(baseline, key, scenario)}
              simulated={simulationValue(selected, key, scenario)}
              kind={kind}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function sourceHref(sourceKey: string, refs: string[], projectId: string) {
  if (sourceKey === "drive") return `/project/${projectId}/workspace/files`;
  if (sourceKey === "os_db" || sourceKey === "calendar") return `/project/${projectId}/cockpit?tab=progress`;
  if (sourceKey === "bzm" || sourceKey === "contract" || sourceKey === "calculation") return "#bzm22-formulas";
  if (sourceKey === "gmail") {
    const match = refs.join(" ").match(/gmail:(?:thread|message):([a-z0-9]+)/i);
    return match ? `https://mail.google.com/mail/u/0/#all/${match[1]}` : null;
  }
  if (sourceKey === "slack") {
    const match = refs.join(" ").match(/slack:([A-Z0-9]+):(\d+)\.(\d+)/i);
    return match ? `https://team-armada.slack.com/archives/${match[1]}/p${match[2]}${match[3]}` : null;
  }
  return null;
}

function confidenceExplanation(parameter: Bzm22PilotParameter) {
  const status = parameter.observedStatus;
  if (/missing|estimated|partial|imputed|conditional|hearing|unknown|incomplete/i.test(status)) {
    return "直接確認できない部分を、慎重・基準・強気の3ケースで補っている。";
  }
  if (/observed|document_extracted/i.test(status)) return "資料またはOSデータから確認した値を使っている。";
  if (/calculated|computed|derived|mechanical/i.test(status)) return "ほかの登録値から計算している。";
  if (/design_choice|registered|fixed/i.test(status)) return "BZMの計算仕様として固定している。";
  return "値の決め方を監査情報に記録している。";
}

function ParameterBasis({ parameter, projectId }: { parameter: Bzm22PilotParameter; projectId: string }) {
  const grouped = new Map<string, string[]>();
  parameter.sourceRefs.forEach((ref) => {
    const key = ref.split(":")[0] || "other";
    grouped.set(key, [...(grouped.get(key) ?? []), ref]);
  });
  const groups = [...grouped.entries()];
  return (
    <div className="min-w-0 space-y-1 text-[9px] leading-4 text-slate-600">
      <p>{confidenceExplanation(parameter)}</p>
      <div className="flex flex-wrap gap-1">
        {groups.length > 0 ? groups.map(([key, values]) => {
          const href = sourceHref(key, values, projectId);
          const label = SOURCE_LABELS[key] ?? "その他の根拠";
          return href ? (
            <a
              key={key}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noreferrer noopener" : undefined}
              className="border border-[#9fb8c1] bg-white px-1.5 py-0.5 font-semibold text-[#285b6b] underline decoration-dotted underline-offset-2 hover:bg-cyan-50"
            >
              {label}を開く（{values.length}件）
            </a>
          ) : (
            <span key={key} className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-500">
              {label} {values.length}件・参照先未接続
            </span>
          );
        }) : <span className="text-slate-400">根拠資料は未登録</span>}
      </div>
      <div><span className="font-semibold text-slate-700">この値に使った情報の締切</span> {formatDateTime(parameter.cutoff)}</div>
      <details className="text-[8px] text-slate-400">
        <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-2 marker:content-none">設定規則の監査情報</summary>
        <div className="mt-1 border border-slate-100 bg-slate-50 p-1.5">
          <div>{parameter.rule || "未登録"}</div>
          {parameter.confidenceDriver ? <div className="mt-1">精度要因: {parameter.confidenceDriver}</div> : null}
        </div>
      </details>
    </div>
  );
}

function ScenarioValues({ parameter }: { parameter: Bzm22PilotParameter }) {
  if (sameScenarioValue(parameter)) {
    return (
      <div className="min-w-0 space-y-1">
        <div className="text-[8px] font-semibold text-slate-500">3ケース共通</div>
        <div className="break-words font-mono text-[9px] text-slate-700">{readableValue(parameter.imputed.base, parameter.unit)}</div>
        <ValueDisclosure label="内訳を見る" value={parameter.imputed.base} unit={parameter.unit} />
      </div>
    );
  }
  return (
    <div className="min-w-0 space-y-1">
      <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-1 text-[9px] leading-4 text-slate-600">
        <span className="text-slate-400">慎重</span><span className="break-words font-mono">{readableValue(parameter.imputed.low, parameter.unit)}</span>
        <span className="text-slate-400">基準</span><span className="break-words font-mono">{readableValue(parameter.imputed.base, parameter.unit)}</span>
        <span className="text-slate-400">強気</span><span className="break-words font-mono">{readableValue(parameter.imputed.high, parameter.unit)}</span>
      </div>
      <ValueDisclosure label="3ケースの内訳を見る" value={parameter.imputed} unit={parameter.unit} />
    </div>
  );
}

function ParameterDesktopTable({ parameters, projectId }: { parameters: Bzm22PilotParameter[]; projectId: string }) {
  return (
    <div className="hidden max-w-full overflow-x-auto lg:block">
      <table className="w-full min-w-[1240px] border-collapse text-left text-[9px] leading-4">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="w-10 px-2 py-1.5 text-right">#</th>
            <th className="w-[320px] px-2 py-1.5">項目・記号・式</th>
            <th className="w-[170px] px-2 py-1.5">登録値</th>
            <th className="w-[210px] px-2 py-1.5">3つの前提ケース</th>
            <th className="w-[130px] px-2 py-1.5">値の決め方</th>
            <th className="px-2 py-1.5">根拠資料</th>
            <th className="w-[120px] px-2 py-1.5">数式への入り方</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((parameter) => (
            <tr key={parameter.id} className="border-t border-slate-100 align-top even:bg-slate-50/50">
              <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-400">{parameter.index}</td>
              <td className="px-2 py-2">
                <ParameterIdentity parameter={parameter} />
              </td>
              <td className="px-2 py-2">
                <div className="break-words font-mono text-slate-700">{readableValue(parameter.value, parameter.unit)}</div>
                <ValueDisclosure label="内訳を見る" value={parameter.value} unit={parameter.unit} />
              </td>
              <td className="px-2 py-2"><ScenarioValues parameter={parameter} /></td>
              <td className="px-2 py-2">
                <StatusBadge status={parameter.observedStatus} />
                {hasPrecisionLoss(parameter.precisionLossContribution) ? (
                  <div className="mt-1 text-[8px] leading-3 text-amber-800">精度への影響: {precisionImpactLabel(parameter.precisionLossContribution)}</div>
                ) : null}
              </td>
              <td className="px-2 py-2"><ParameterBasis parameter={parameter} projectId={projectId} /></td>
              <td className="px-2 py-2">
                <FormulaRelation parameter={parameter} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParameterMobileCards({ parameters, projectId }: { parameters: Bzm22PilotParameter[]; projectId: string }) {
  return (
    <div className="divide-y divide-slate-100 lg:hidden">
      {parameters.map((parameter) => (
        <article key={parameter.id} className="min-w-0 px-3 py-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 font-mono text-[8px] tabular-nums text-slate-400">#{parameter.index}</div>
              <ParameterIdentity parameter={parameter} />
            </div>
            <StatusBadge status={parameter.observedStatus} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="min-w-0 border border-slate-100 bg-slate-50 p-2">
              <div className="text-[8px] font-semibold text-slate-500">登録値</div>
              <div className="mt-1 break-words font-mono text-[10px] text-slate-700">{readableValue(parameter.value, parameter.unit, 140)}</div>
              <ValueDisclosure label="内訳を見る" value={parameter.value} unit={parameter.unit} />
            </div>
            <div className="min-w-0 border border-slate-100 p-2">
              <div className="mb-1 text-[8px] font-semibold text-slate-500">3つの前提ケース</div>
              <ScenarioValues parameter={parameter} />
            </div>
          </div>
          <div className="mt-2"><ParameterBasis parameter={parameter} projectId={projectId} /></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px]">
            <FormulaRelation parameter={parameter} />
            {hasPrecisionLoss(parameter.precisionLossContribution) ? (
              <span className="text-amber-800">精度への影響: {precisionImpactLabel(parameter.precisionLossContribution)}</span>
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
  projectId,
}: {
  group: Bzm22PilotParameterGroup;
  parameters: Bzm22PilotParameter[];
  open: boolean;
  onToggle: () => void;
  projectId: string;
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
        </span>
        <span className="text-[9px] text-slate-500">{parameters.length}/{group.count}件 {open ? "閉じる⌃" : "開く⌄"}</span>
      </button>
      {open ? (
        parameters.length > 0 ? (
          <div className="border-t border-slate-200">
            <ParameterDesktopTable parameters={parameters} projectId={projectId} />
            <ParameterMobileCards parameters={parameters} projectId={projectId} />
          </div>
        ) : (
          <div className="border-t border-slate-100 px-3 py-4 text-[10px] text-slate-500">この条件に一致する項目はない。</div>
        )
      ) : null}
    </section>
  );
}

function ParameterLedger({ groups, projectId }: { groups: Bzm22PilotParameterGroup[]; projectId: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ParameterFilter>("all");
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(groups[0] ? [groups[0].key] : []));

  const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP");
  const filtered = useMemo(
    () => groups.map((group) => ({
      group,
      parameters: group.parameters.filter((parameter) => {
        if (filter === "used" && getBzm22ParameterCatalogEntry(parameter.id).relation === "unused") return false;
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
            <p className="mt-0.5 text-[9px] leading-4 text-slate-600">{totalCount}項目を、日本語名・数式の記号・登録値・3つの前提ケース・根拠資料の順に確認できる。</p>
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
              placeholder="日本語名・記号・式・根拠で検索"
              className="min-h-10 w-full border border-slate-300 bg-white px-3 text-[11px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-700 focus:ring-1 focus:ring-cyan-700 md:min-h-8"
            />
          </label>
          <div className="grid grid-cols-3 border border-slate-300 bg-white" aria-label="パラメータ表示条件">
            {([
              ["all", "全項目"],
              ["used", "式に接続"],
              ["uncertain", "精度への影響あり"],
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
          projectId={projectId}
        />
      ))}
    </section>
  );
}

function PilotPanel({ pilot }: { pilot: Bzm22PilotProject }) {
  const parameterCount = pilot.groups.reduce((sum, group) => sum + group.parameters.length, 0);
  const conditionalValueIsNa = /not_applicable|n\/a/i.test(pilot.summary.conditionalSuccessValueStatus);
  const registeredOption = pilot.simulation.policyOptions.find((option) => option.id === pilot.simulation.currentPolicyId);

  return (
    <section
      data-testid="bzm22-provisional-primary"
      aria-labelledby="bzm22-provisional-title"
      className="min-w-0 overflow-hidden border border-[#7898a5] bg-[#f6f8f8]"
    >
      <header className="border-b border-[#365865] bg-[#162f3a] px-3 py-3 text-white sm:px-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="bzm22-provisional-title" className="text-[14px] font-semibold tracking-tight">BZM 2.2</h2>
            <p className="mt-1 max-w-4xl text-[10px] leading-4 text-slate-200">
              現在の進め方、重要イベント、103項目の前提と数式を一つの画面で確認する。
            </p>
          </div>
          <div className="shrink-0 text-right font-mono text-[8px] leading-4 text-slate-300">
            <div>{pilot.projectName} · BZM 2.2</div>
            <div>価値基準日 {pilot.valuationDate}</div>
            <div>情報締切 {formatDateTime(pilot.informationCutoff)}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-px border-b border-[#b9cbd1] bg-[#c9d5d9] sm:grid-cols-2 xl:grid-cols-4">
        <ScenarioMetric symbol="J" label={BZM22_TOP_METRICS.J.title} formula={BZM22_TOP_METRICS.J.formula} value={pilot.summary.jValueMillionJpy} kind="million" note={BZM22_TOP_METRICS.J.description} />
        <ScenarioMetric symbol="P" label={BZM22_TOP_METRICS.P.title} formula={BZM22_TOP_METRICS.P.formula} value={pilot.summary.conditionalSuccessValueMillionJpy} kind="million" note={conditionalValueIsNa ? "このPJは歴史的終端として記録されているため、成功時価値の対象外。" : BZM22_TOP_METRICS.P.description} />
        <ScenarioMetric symbol="Q" label={BZM22_TOP_METRICS.Q.title} formula={BZM22_TOP_METRICS.Q.formula} value={pilot.summary.qGateProductProxy} kind="probability" note={BZM22_TOP_METRICS.Q.description} />
        <ScenarioMetric symbol="S" label={BZM22_TOP_METRICS.S.title} formula={BZM22_TOP_METRICS.S.formula} value={pilot.summary.qStressProxy} kind="probability" note={BZM22_TOP_METRICS.S.description} />
      </div>

      <div className="border-b border-[#b9cbd1] bg-[#edf3f5] px-3 py-1.5 text-[8px] leading-4 text-[#365865] sm:px-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="font-semibold"><Tex tex={BZM22_FIXED_POLICY.formula} /></span>
          <span>この画面で評価している進め方: {registeredOption?.label ?? "未登録"}</span>
        </div>
        <div>
          <span className="font-semibold">記号:</span> CF=月ごとの収支、TV=目標到達後の将来価値、RV=途中で止まった時の残存価値、d=現在価値への割引、s=その月まで計画が続く重み、p=各条件の通過値、m=厳しい状況での補正。
        </div>
      </div>

      <PolicyWhatIf key={pilot.projectId} pilot={pilot} />
      <FormulaIndex />
      <DecisionEventTimeline timeline={pilot.timeline} />

      <div className="grid gap-px border-b border-[#b9cbd1] bg-[#d4dde0] sm:grid-cols-3">
        <div className="bg-white px-3 py-2">
          <div className="text-[8px] font-semibold text-slate-500">現在の試算で使う進め方</div>
          <div className="mt-1 text-[11px] font-semibold text-[#234d5e]">{registeredOption?.label ?? "未登録"}</div>
          <div className="mt-0.5 text-[8px] text-slate-500">評価基準日に固定した行動と投入の組み合わせ</div>
        </div>
        <div className="bg-white px-3 py-2">
          <div className="text-[8px] font-semibold text-slate-500">資金が最初に不足する時期</div>
          <div className="mt-1 text-[11px] font-semibold tabular-nums text-[#234d5e]">{pilot.summary.firstPathLossMonth ?? "経路内なし / 未確認"}</div>
          <div className="mt-0.5 text-[8px] text-slate-500">追加調達がない場合の月次収支から計算</div>
        </div>
        <div className="bg-white px-3 py-2">
          <div className="text-[8px] font-semibold text-slate-500">比較できる進め方 / パラメータ</div>
          <div className="mt-1 text-[11px] font-semibold tabular-nums text-[#234d5e]">比較候補 {pilot.simulation.policyOptions.length}件 · {parameterCount}項目</div>
          <div className="mt-0.5 text-[8px] text-slate-500">選択肢ごとにJ・P・Q・Sを比較</div>
        </div>
      </div>

      <details className="border-b border-slate-200 bg-white text-[8px] text-slate-500">
        <summary className="cursor-pointer list-none px-3 py-2 font-semibold text-[#294c5b] marker:content-none sm:px-4">参照データの範囲</summary>
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 px-3 py-2 sm:px-4">
          {pilot.sourceCoverage.sources.map((source) => (
            <span key={source.key}>
              {SOURCE_LABELS[source.key.toLowerCase()] ?? source.key} · {source.uniqueItems.toLocaleString("ja-JP")}件
            </span>
          ))}
        </div>
      </details>

      <ParameterLedger key={pilot.projectId} groups={pilot.groups} projectId={pilot.projectId} />

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
          throw new Error(json && "error" in json && json.error ? json.error : "BZM 2.2の取得に失敗");
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
            error: error instanceof Error ? error.message : "BZM 2.2の取得に失敗",
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
        BZM 2.2を切り替え中…
      </div>
    );
  }

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div data-testid="bzm22-provisional-primary" className="grid min-h-[220px] place-items-center border border-[#aac1ca] bg-[#f6f8f8] px-4 text-center text-[11px] text-slate-500">
        <div>
          <div className="font-semibold text-[#254c5d]">BZM 2.2</div>
          <div className="mt-1">103項目のPJ別台帳を読み込み中…</div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div data-testid="bzm22-provisional-primary" className="border border-red-200 bg-red-50 px-4 py-3 text-[11px] leading-5 text-red-800">
        <div className="font-semibold">BZM 2.2を読み出せていない</div>
        <div>{state.error}</div>
        <div className="text-[9px]">再読み込み後も続く場合は、生成データとの接続を確認する。</div>
      </div>
    );
  }

  return <PilotPanel pilot={state.pilot} />;
}
