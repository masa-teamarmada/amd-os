"use client";

import { Tex } from "@/components/venture-map/Tex";
import {
  BZM21_OBJECTIVE_KINDS,
  type Bzm21Action,
  type Bzm21ActionEvaluation,
  type Bzm21CashflowEvent,
  type Bzm21InputObservation,
  type Bzm21ObjectiveKind,
  type Bzm21PolicyEvaluation,
  type Bzm21PolicyKind,
  type Bzm21PolicyModelLedger,
  type Bzm21Transition,
} from "@/lib/bzm-2-1-policy-model";

const OBJECTIVE_LABEL: Record<Bzm21ObjectiveKind, string> = {
  company: "会社",
  bzsf: "BZSF",
  public: "公的基金",
};

const POLICY_LABEL: Record<Bzm21PolicyKind, string> = {
  fixed_baseline: "固定方針",
  optimized: "選択方針",
};

const ACTION_LABEL: Record<Bzm21Action["actionType"], string> = {
  continue: "続行",
  wait: "待機",
  retry: "再試行",
  pivot: "迂回・ピボット",
  scale_down: "縮小",
  scale_up: "拡張",
  license: "ライセンス",
  abandon: "撤退",
};

type DisplayMode = "primary" | "preview" | "archive";

type StatusTone = "verified" | "estimated" | "missing" | "na" | "neutral";

const STATUS_META: Record<StatusTone, { className: string; label: string }> = {
  verified: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    label: "観測・計算",
  },
  estimated: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    label: "推定・条件付き",
  },
  missing: {
    className: "border-orange-200 bg-orange-50 text-orange-800",
    label: "欠測・未計算",
  },
  na: {
    className: "border-slate-200 bg-slate-100 text-slate-500",
    label: "対象外",
  },
  neutral: {
    className: "border-slate-200 bg-white text-slate-600",
    label: "状態",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatValue(value: number | null | undefined, suffix = "百万円") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "欠測";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value)} ${suffix}`;
}

function formatDelta(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "欠測";
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value)} 百万円`;
}

function formatProbability(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "欠測";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function formatNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "欠測";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "欠測";
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

function compactUnknown(value: unknown): string {
  if (value === null || value === undefined) return "欠測";
  if (typeof value === "string") return value || "欠測";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "欠測";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.length === 0 ? "[]" : `[${value.length}件]`;
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 ? "{}" : `{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "…" : ""}}`;
  }
  return String(value);
}

function jsonText(value: unknown) {
  if (value === undefined) return "未登録";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toneForStatus(status: string | null | undefined): StatusTone {
  const normalized = (status ?? "").toLowerCase();
  if (["observed", "calculated", "computed", "complete", "ready", "available"].includes(normalized)) {
    return "verified";
  }
  if (
    [
      "estimated",
      "conditional",
      "partial",
      "decision_indeterminate",
      "partial_action_set",
      "evaluated_hypothesis",
      "hypothesis",
    ].includes(normalized)
  ) {
    return "estimated";
  }
  if (
    [
      "missing",
      "not_started",
      "not_computable",
      "unavailable",
      "invalid",
      "unknown",
      "not_registered",
      "incomplete",
    ].includes(normalized)
  ) {
    return "missing";
  }
  if (["not_applicable", "n/a", "na", "excluded", "unavailable_action"].includes(normalized)) {
    return "na";
  }
  return "neutral";
}

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    observed: "観測値",
    calculated: "計算値",
    computed: "計算済み",
    complete: "完了",
    estimated: "推定値",
    conditional: "条件付き",
    partial: "一部のみ",
    decision_indeterminate: "方針未確定",
    partial_action_set: "行動集合が一部",
    evaluated_hypothesis: "推定仮説",
    hypothesis: "仮説",
    missing: "欠測",
    not_started: "未着手",
    not_computable: "計算不能",
    unavailable: "取得不能",
    invalid: "無効",
    unknown: "未確認",
    not_registered: "未登録",
    incomplete: "未完了",
    not_applicable: "対象外",
    ready: "読出し済み",
    available: "利用可能",
  };
  return labels[status ?? ""] ?? status ?? "未登録";
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const tone = toneForStatus(status);
  return (
    <span
      className={`inline-flex min-h-5 items-center whitespace-nowrap border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${STATUS_META[tone].className}`}
      title={`${STATUS_META[tone].label}: ${status ?? "not_registered"}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function JsonDisclosure({ label = "詳細", value }: { label?: string; value: unknown }) {
  return (
    <details className="min-w-0">
      <summary className="cursor-pointer list-none text-[9px] font-semibold text-slate-500 underline decoration-dotted underline-offset-2 hover:text-[#1d536b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1d536b] marker:content-none">
        {label}
      </summary>
      <pre className="mt-1 max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-all border border-slate-200 bg-slate-50 p-2 font-mono text-[9px] leading-4 text-slate-600">
        {jsonText(value)}
      </pre>
    </details>
  );
}

function evaluationFor(
  model: Bzm21PolicyModelLedger,
  objectiveKind: Bzm21ObjectiveKind,
  policyKind: Bzm21PolicyKind,
) {
  return model.policyViews.find(
    (view) => view.objectiveKind === objectiveKind && view.policyKind === policyKind,
  )?.current ?? null;
}

function selectedActionFor(
  model: Bzm21PolicyModelLedger,
  evaluation: Bzm21PolicyEvaluation | null,
) {
  const allActions = model.states.flatMap((state) => state.actions);
  const selectedRefs = Object.values(evaluation?.selectedActionByState ?? {});
  const exact = allActions.find(
    (action) => selectedRefs.includes(action.actionId) || selectedRefs.includes(action.actionKey),
  );
  if (exact) return exact;
  return allActions.find((action) =>
    action.evaluations.some(
      (candidate) => candidate.objectiveKind === "company" && candidate.isSelected,
    ),
  ) ?? null;
}

function allCurrentInputs(model: Bzm21PolicyModelLedger) {
  if (model.currentRevision) {
    return model.inputHistory
      .filter((row) => row.revisionId === model.currentRevision?.revisionId)
      .sort(
        (left, right) =>
          left.scopeKind.localeCompare(right.scopeKind) ||
          left.scopeKey.localeCompare(right.scopeKey) ||
          left.sortOrder - right.sortOrder ||
          left.parameterKey.localeCompare(right.parameterKey),
      );
  }
  const rows: Bzm21InputObservation[] = [...model.revisionInputs];
  model.states.forEach((state) => {
    rows.push(...state.inputs);
    state.actions.forEach((action) => {
      rows.push(...action.inputs);
      action.transitions.forEach((transition) => rows.push(...transition.inputs));
    });
  });
  model.interventions.forEach((intervention) => rows.push(...intervention.inputs));
  return Array.from(new Map(rows.map((row) => [row.observationId, row])).values()).sort(
    (left, right) =>
      left.scopeKind.localeCompare(right.scopeKind) ||
      left.scopeKey.localeCompare(right.scopeKey) ||
      left.sortOrder - right.sortOrder ||
      left.parameterKey.localeCompare(right.parameterKey),
  );
}

function estimateProfile(inputs: Bzm21InputObservation[]) {
  const counts = inputs.reduce<Record<string, number>>((accumulator, input) => {
    accumulator[input.valueStatus] = (accumulator[input.valueStatus] ?? 0) + 1;
    return accumulator;
  }, {});
  const denominator = ["estimated", "conditional", "observed", "calculated"].reduce(
    (sum, key) => sum + (counts[key] ?? 0),
    0,
  );
  return {
    counts,
    ratio: denominator > 0 ? (counts.estimated ?? 0) / denominator : null,
  };
}

function MetricCell({
  label,
  value,
  detail,
  prominent = false,
  tone = "neutral",
}: {
  label: React.ReactNode;
  value: string;
  detail?: string;
  prominent?: boolean;
  tone?: StatusTone;
}) {
  const surfaceClass = tone === "estimated"
    ? "bg-amber-50"
    : tone === "missing"
      ? "bg-orange-50"
      : prominent
        ? "bg-[#f0f6f7]"
        : "bg-white";
  const valueClass = tone === "estimated"
    ? "text-amber-900"
    : tone === "missing"
      ? "text-orange-800"
      : prominent
        ? "text-[#173e50]"
        : "text-slate-800";
  return (
    <div className={`min-w-0 px-2.5 py-2 ${surfaceClass}`}>
      <div className="text-[9px] font-semibold tracking-[0.04em] text-slate-500">{label}</div>
      <div
        className={`${prominent ? "text-[19px]" : "text-[13px]"} ${valueClass} mt-0.5 break-words font-semibold leading-tight tabular-nums`}
      >
        {value}
      </div>
      {detail ? <div className="mt-0.5 text-[9px] leading-3 text-slate-500">{detail}</div> : null}
    </div>
  );
}

function SectionDisclosure({
  title,
  count,
  summary,
  children,
  open = false,
}: {
  title: string;
  count?: number;
  summary?: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="border-t border-slate-200 bg-white" open={open}>
      <summary className="group grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1d536b] sm:min-h-0 marker:content-none">
        <span className="min-w-0">
          <span className="text-[11px] font-semibold text-[#234858]">{title}</span>
          {summary ? <span className="ml-2 text-[9px] text-slate-500">{summary}</span> : null}
        </span>
        <span className="flex items-center gap-2 text-[9px] text-slate-400">
          {count !== undefined ? <span className="font-mono tabular-nums">{count}件</span> : null}
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="border-t border-slate-100">{children}</div>
    </details>
  );
}

function InputLedger({ inputs }: { inputs: Bzm21InputObservation[] }) {
  if (inputs.length === 0) {
    return <div className="px-3 py-3 text-[10px] text-orange-700">入力台帳は未登録。0として扱わない。</div>;
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-[9px] leading-4">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-2 py-1.5">範囲</th>
            <th className="px-2 py-1.5">パラメータ</th>
            <th className="px-2 py-1.5">記号</th>
            <th className="px-2 py-1.5">状態</th>
            <th className="px-2 py-1.5">現在値</th>
            <th className="px-2 py-1.5">単位</th>
            <th className="px-2 py-1.5">根拠</th>
            <th className="px-2 py-1.5">締切</th>
          </tr>
        </thead>
        <tbody>
          {inputs.map((input) => {
            const valueLabel = ["missing", "not_started", "not_computable"].includes(input.valueStatus)
              ? "欠測"
              : input.valueStatus === "not_applicable"
                ? "対象外"
                : input.displayValue || compactUnknown(input.value);
            return (
              <tr key={input.observationId} className="border-t border-slate-100 align-top even:bg-slate-50/40">
                <td className="max-w-[150px] px-2 py-1.5">
                  <div className="font-semibold text-slate-600">{input.scopeKind}</div>
                  <div className="break-all font-mono text-[8px] text-slate-400">{input.scopeKey}</div>
                  <div className="break-all font-mono text-[7px] text-slate-300">rev {input.revisionId}</div>
                </td>
                <td className="max-w-[210px] px-2 py-1.5">
                  <div className="font-semibold text-slate-700">{input.label || input.parameterKey}</div>
                  <div className="break-all font-mono text-[8px] text-slate-400">{input.parameterKey}</div>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-slate-700">
                  {input.symbol ? <Tex tex={input.symbol} /> : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-2 py-1.5"><StatusBadge status={input.valueStatus} /></td>
                <td className="max-w-[220px] px-2 py-1.5 text-slate-700">
                  <div className="break-words font-semibold tabular-nums">{valueLabel}</div>
                  {typeof input.value === "object" && input.value !== null ? (
                    <JsonDisclosure label="値の内訳" value={input.value} />
                  ) : null}
                  {input.note ? <div className="mt-0.5 text-[8px] leading-3 text-slate-500">{input.note}</div> : null}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{input.unit ?? "—"}</td>
                <td className="max-w-[190px] px-2 py-1.5">
                  <div className="font-semibold text-slate-600">{input.evidenceKind || "未登録"}</div>
                  <div className="break-all font-mono text-[8px] text-slate-400">{input.evidenceRef ?? "根拠参照なし"}</div>
                  {Object.keys(input.condition).length > 0 ? <JsonDisclosure label="条件" value={input.condition} /> : null}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[8px] text-slate-500">
                  {formatDateTime(input.informationCutoff)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TransitionRows({ transitions }: { transitions: Bzm21Transition[] }) {
  if (transitions.length === 0) return <div className="px-2 py-2 text-[9px] text-orange-700">遷移は欠測。</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[9px] leading-4">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-2 py-1">遷移</th>
            <th className="px-2 py-1 text-right"><Tex tex="p_{\mathrm{phys}}" /></th>
            <th className="px-2 py-1">次状態 / 終端</th>
            <th className="px-2 py-1 text-right">初到達</th>
            <th className="px-2 py-1 text-right">余力喪失</th>
            <th className="px-2 py-1">CF参照</th>
            <th className="px-2 py-1">根拠</th>
          </tr>
        </thead>
        <tbody>
          {transitions.map((transition) => (
            <tr key={transition.transitionId} className="border-t border-slate-100 align-top even:bg-slate-50/40">
              <td className="max-w-[190px] px-2 py-1.5">
                <div className="font-semibold text-slate-700">{transition.label}</div>
                <div className="break-all font-mono text-[8px] text-slate-400">{transition.transitionKey}</div>
              </td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-700">
                {formatProbability(transition.probability)}
              </td>
              <td className="px-2 py-1.5 text-slate-600">
                {transition.nextStateId ?? transition.terminalOutcome ?? "欠測"}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                {formatNumber(transition.goalReachedAtMonths, "か月")}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                {formatNumber(transition.slackLostAtMonths, "か月")}
              </td>
              <td className="px-2 py-1.5 text-slate-500">
                {transition.cashflowEventKeys.length > 0 ? `${transition.cashflowEventKeys.length}件` : "なし"}
              </td>
              <td className="px-2 py-1.5"><JsonDisclosure label="遷移詳細" value={{ evidence: transition.evidence, inputs: transition.inputs }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionBlock({ action, selected }: { action: Bzm21Action; selected: boolean }) {
  return (
    <details className={`border-t ${selected ? "border-[#9abdc8] bg-[#f2f8f9]" : "border-slate-100 bg-white"}`}>
      <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1d536b] sm:min-h-0 marker:content-none">
        <span className="min-w-0">
          <span className="font-semibold text-slate-700">{ACTION_LABEL[action.actionType]} — {action.label}</span>
          <span className="ml-2 font-mono text-[8px] text-slate-400">{action.actionKey}</span>
        </span>
        <span className="flex flex-wrap items-center justify-end gap-1">
          {selected ? <span className="border border-[#8bb4c1] bg-[#e4f0f2] px-1.5 py-0.5 text-[9px] font-semibold text-[#174b60]">会社方針で選択</span> : null}
          <StatusBadge status={action.availabilityStatus === "unavailable" ? "not_applicable" : action.availabilityStatus} />
          <span className="text-[9px] tabular-nums text-slate-500">{formatValue(action.requiredFundingMillionJpy)}</span>
        </span>
      </summary>
      <div className="grid gap-px border-t border-slate-100 bg-slate-200 sm:grid-cols-4">
        <div className="bg-white px-2 py-1.5"><div className="text-[8px] text-slate-400">所要時間</div><div className="font-semibold tabular-nums text-slate-700">{formatNumber(action.durationMonths, "か月")}</div></div>
        <div className="bg-white px-2 py-1.5"><div className="text-[8px] text-slate-400">部品</div><div className="text-slate-700">{action.componentTypes.map((type) => ACTION_LABEL[type]).join(" + ") || "欠測"}</div></div>
        <div className="bg-white px-2 py-1.5"><div className="text-[8px] text-slate-400">遷移</div><div className="font-semibold tabular-nums text-slate-700">{action.transitions.length}件</div></div>
        <div className="bg-white px-2 py-1.5"><div className="text-[8px] text-slate-400">入力</div><div className="font-semibold tabular-nums text-slate-700">{action.inputs.length}件</div></div>
      </div>
      <div className="grid gap-2 border-t border-slate-100 px-2 py-2 sm:grid-cols-3">
        <JsonDisclosure label="実行可能性・権限" value={{ feasibility: action.feasibilityGate, authority: action.authorityGate, consents: action.consents }} />
        <JsonDisclosure label="資金実行可能性" value={action.financingFeasibility} />
        <JsonDisclosure label="順序・共有資源・情報" value={{ sequence: action.sequence, sharedResources: action.sharedResources, informationGain: action.informationGain, evidence: action.evidence }} />
      </div>
      <TransitionRows transitions={action.transitions} />
    </details>
  );
}

function StateLedger({
  model,
  selectedEvaluation,
}: {
  model: Bzm21PolicyModelLedger;
  selectedEvaluation: Bzm21PolicyEvaluation | null;
}) {
  const selectedRefs = Object.values(selectedEvaluation?.selectedActionByState ?? {});
  if (model.states.length === 0) {
    return <div className="px-3 py-3 text-[10px] text-orange-700">判断状態は未登録。経路を0件として計算しない。</div>;
  }
  return (
    <div>
      {model.states.map((state) => (
        <details key={state.stateId} className="border-t border-slate-100 first:border-t-0" open={state.isInitial}>
          <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-slate-50/60 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1d536b] sm:min-h-0 marker:content-none">
            <span className="min-w-0">
              <span className="font-semibold text-[#244b5b]">{state.isInitial ? "現在地 · " : ""}{state.label}</span>
              <span className="ml-2 break-all font-mono text-[8px] text-slate-400">{state.stateKey}</span>
            </span>
            <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[9px] text-slate-500">
              <span>行動 {state.actions.length}</span>
              <span>残費用 {formatValue(state.remainingCostMillionJpy)}</span>
              <span>残時間 {formatNumber(state.remainingTimeMonths, "か月")}</span>
            </span>
          </summary>
          <div className="grid gap-px border-t border-slate-100 bg-slate-200 sm:grid-cols-4">
            <div className="bg-white px-2 py-1.5"><div className="text-[8px] text-slate-400">経過</div><div className="font-semibold tabular-nums text-slate-700">{formatNumber(state.elapsedMonths, "か月")}</div></div>
            <div className="bg-white px-2 py-1.5"><div className="text-[8px] text-slate-400">投入済み</div><div className="font-semibold tabular-nums text-slate-700">{formatValue(state.sunkCostMillionJpy)}</div></div>
            <div className="bg-white px-2 py-1.5"><div className="text-[8px] text-slate-400">信念状態</div><div className="font-semibold tabular-nums text-slate-700">{state.beliefs.length}件</div></div>
            <div className="bg-white px-2 py-1.5"><div className="text-[8px] text-slate-400">利用可能情報</div><div className="font-semibold tabular-nums text-slate-700">{state.availableInformation.length}件</div></div>
          </div>
          <div className="grid gap-2 border-t border-slate-100 px-2 py-2 sm:grid-cols-4">
            <JsonDisclosure label="現在状態" value={state.currentState} />
            <JsonDisclosure label="到達履歴" value={state.reachabilityHistory} />
            <JsonDisclosure label="意思決定主体" value={state.decisionController} />
            <JsonDisclosure label="信念・情報・根拠" value={{ beliefs: state.beliefs, availableInformation: state.availableInformation, evidence: state.evidence }} />
          </div>
          <div className="border-t border-slate-100 text-[9px]">
            {state.actions.length > 0 ? state.actions.map((action) => (
              <ActionBlock
                key={action.actionId}
                action={action}
                selected={selectedRefs.includes(action.actionId) || selectedRefs.includes(action.actionKey)}
              />
            )) : <div className="px-2 py-2 text-orange-700">利用可能行動は欠測。</div>}
          </div>
        </details>
      ))}
    </div>
  );
}

function CashflowLedger({ events }: { events: Bzm21CashflowEvent[] }) {
  if (events.length === 0) {
    return <div className="px-3 py-3 text-[10px] text-orange-700">単一CF台帳は未登録。金額0とは扱わない。</div>;
  }
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-[9px] leading-4">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-2 py-1.5">経済事象</th>
            <th className="px-2 py-1.5">性質 / 集計</th>
            <th className="px-2 py-1.5">範囲</th>
            <th className="px-2 py-1.5 text-right">時点</th>
            <th className="px-2 py-1.5 text-right">モデル金額</th>
            <th className="px-2 py-1.5">状態</th>
            <th className="px-2 py-1.5">帰属</th>
            <th className="px-2 py-1.5">根拠・条件</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.cashflowEventId} className="border-t border-slate-100 align-top even:bg-slate-50/40">
              <td className="max-w-[220px] px-2 py-1.5">
                <div className="font-semibold text-slate-700">{event.label}</div>
                <div className="break-all font-mono text-[8px] text-slate-400">{event.eventKey}</div>
                <div className="break-all font-mono text-[7px] text-slate-300">rev {event.revisionId}</div>
              </td>
              <td className="px-2 py-1.5 text-slate-600">
                <div>{event.economicNature}</div>
                <div className="text-[8px] text-slate-400">{event.includedIn}</div>
              </td>
              <td className="max-w-[150px] px-2 py-1.5 text-slate-600">
                <div>{event.scopeKind}</div>
                <div className="break-all font-mono text-[8px] text-slate-400">{event.scopeKey}</div>
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-600">
                {formatNumber(event.timingMonths, "か月")}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums text-slate-700">
                {formatValue(event.modelAmountMillionJpy)}
              </td>
              <td className="px-2 py-1.5"><StatusBadge status={event.valueStatus} /></td>
              <td className="px-2 py-1.5 text-slate-600">
                <div>{event.ownerKind} → {event.counterpartyKind}</div>
                <div className="text-[8px] text-slate-400">{event.perspectiveLeg ?? "共通"}</div>
              </td>
              <td className="px-2 py-1.5">
                <JsonDisclosure label="CF詳細" value={{
                  amount: event.amount,
                  currency: event.currency,
                  ownerRef: event.ownerRef,
                  counterpartyRef: event.counterpartyRef,
                  perspectiveAttribution: event.perspectiveAttribution,
                  publicAggregationStatus: event.publicAggregationStatus,
                  publicFiscalAmountMillionJpy: event.publicFiscalAmountMillionJpy,
                  publicSocialBenefitVector: event.publicSocialBenefitVector,
                  evidenceKind: event.evidenceKind,
                  evidenceRef: event.evidenceRef,
                  informationCutoff: event.informationCutoff,
                  condition: event.condition,
                  note: event.note,
                }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyEvaluationLedger({ model }: { model: Bzm21PolicyModelLedger }) {
  const rows = BZM21_OBJECTIVE_KINDS.flatMap((objectiveKind) =>
    (["fixed_baseline", "optimized"] as const).map((policyKind) => ({
      objectiveKind,
      policyKind,
      evaluation: evaluationFor(model, objectiveKind, policyKind),
    })),
  );
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-[9px] leading-4">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-2 py-1.5">視点</th>
            <th className="px-2 py-1.5">方針</th>
            <th className="px-2 py-1.5">状態</th>
            <th className="px-2 py-1.5 text-right"><Tex tex="q^{\pi}" /></th>
            <th className="px-2 py-1.5 text-right"><Tex tex="V^{\pi}" /></th>
            <th className="px-2 py-1.5 text-right">基準線との差</th>
            <th className="px-2 py-1.5 text-right">必要資金</th>
            <th className="px-2 py-1.5 text-right">失敗損失</th>
            <th className="px-2 py-1.5">再現情報</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ objectiveKind, policyKind, evaluation }) => (
            <tr key={`${objectiveKind}-${policyKind}`} className="border-t border-slate-100 align-top even:bg-slate-50/40">
              <td className="px-2 py-1.5 font-semibold text-slate-700">{OBJECTIVE_LABEL[objectiveKind]}</td>
              <td className="px-2 py-1.5 text-slate-600">{POLICY_LABEL[policyKind]}</td>
              <td className="px-2 py-1.5"><StatusBadge status={evaluation?.evaluationStatus} /></td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-700">{formatProbability(evaluation?.goalProbability)}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-700">{formatValue(evaluation?.expectedNetValue)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{formatDelta(evaluation?.valueDifferenceFromBaseline)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{formatValue(evaluation?.expectedCumulativeFundingMillionJpy)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{formatValue(evaluation?.expectedFailureLossMillionJpy)}</td>
              <td className="max-w-[190px] px-2 py-1.5">
                {evaluation ? <JsonDisclosure label="方針・hash・派生値" value={{
                  selectionObjective: evaluation.selectionObjective,
                  actionCoverageStatus: evaluation.actionCoverageStatus,
                  conditionalGoalValue: evaluation.conditionalGoalValue,
                  planDeadlineGoalProbability: evaluation.planDeadlineGoalProbability,
                  controllerOptionValue: evaluation.controllerOptionValue,
                  expectedExitValueMillionJpy: evaluation.expectedExitValueMillionJpy,
                  expectedTerminalValueMillionJpy: evaluation.expectedTerminalValueMillionJpy,
                  expectedCostMillionJpy: evaluation.expectedCostMillionJpy,
                  expectedBenefitMillionJpy: evaluation.expectedBenefitMillionJpy,
                  selectedActionByState: evaluation.selectedActionByState,
                  controllerByState: evaluation.controllerByState,
                  stateDecisions: evaluation.stateDecisions,
                  publicAggregationStatus: evaluation.publicAggregationStatus,
                  publicFiscalValueMillionJpy: evaluation.publicFiscalValueMillionJpy,
                  publicSocialComponents: evaluation.publicSocialComponents,
                  publicSocialMonetizedValueMillionJpy: evaluation.publicSocialMonetizedValueMillionJpy,
                  publicAggregatedValueMillionJpy: evaluation.publicAggregatedValueMillionJpy,
                  uncertainty: evaluation.uncertainty,
                  missingInputs: evaluation.missingInputs,
                  issues: evaluation.issues,
                  engineVersion: evaluation.engineVersion,
                  inputHash: evaluation.inputHash,
                  informationCutoff: evaluation.informationCutoff,
                }} /> : <span className="text-orange-700">未登録</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyHistoryLedger({ evaluations }: { evaluations: Bzm21PolicyEvaluation[] }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-[9px] leading-4">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr><th className="px-2 py-1.5">版</th><th className="px-2 py-1.5">視点</th><th className="px-2 py-1.5">方針</th><th className="px-2 py-1.5">状態</th><th className="px-2 py-1.5 text-right"><Tex tex="q^{\pi}" /></th><th className="px-2 py-1.5 text-right"><Tex tex="V^{\pi}" /></th><th className="px-2 py-1.5 text-right">基準差</th><th className="px-2 py-1.5">再現情報</th></tr>
        </thead>
        <tbody>
          {evaluations.map((evaluation) => (
            <tr key={evaluation.policyEvaluationId} className="border-t border-slate-100 align-top even:bg-slate-50/40">
              <td className="px-2 py-1.5"><div className="font-semibold text-slate-700">{evaluation.revisionKey}</div><div className="font-mono text-[8px] text-slate-400">#{evaluation.revisionOrder}</div></td>
              <td className="px-2 py-1.5 font-semibold text-slate-700">{OBJECTIVE_LABEL[evaluation.objectiveKind]}</td>
              <td className="px-2 py-1.5 text-slate-600">{POLICY_LABEL[evaluation.policyKind]}</td>
              <td className="px-2 py-1.5"><StatusBadge status={evaluation.evaluationStatus} /></td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{formatProbability(evaluation.goalProbability)}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-700">{formatValue(evaluation.expectedNetValue)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{formatDelta(evaluation.valueDifferenceFromBaseline)}</td>
              <td className="px-2 py-1.5"><JsonDisclosure label="hash・方針" value={{ inputHash: evaluation.inputHash, engineVersion: evaluation.engineVersion, selectedActionByState: evaluation.selectedActionByState, issues: evaluation.issues, missingInputs: evaluation.missingInputs, informationCutoff: evaluation.informationCutoff }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionEvaluationLedger({ evaluations }: { evaluations: Bzm21ActionEvaluation[] }) {
  if (evaluations.length === 0) return <div className="px-3 py-3 text-[10px] text-orange-700">行動別評価は未登録。</div>;
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-[9px] leading-4">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr><th className="px-2 py-1.5">行動</th><th className="px-2 py-1.5">視点</th><th className="px-2 py-1.5">状態</th><th className="px-2 py-1.5 text-right"><Tex tex="q_a" /></th><th className="px-2 py-1.5 text-right"><Tex tex="V_a" /></th><th className="px-2 py-1.5 text-right">必要資金</th><th className="px-2 py-1.5">詳細</th></tr>
        </thead>
        <tbody>
          {evaluations.map((evaluation) => (
            <tr key={evaluation.actionEvaluationId} className="border-t border-slate-100 align-top even:bg-slate-50/40">
              <td className="max-w-[180px] px-2 py-1.5"><div className="break-all font-mono text-[8px] text-slate-500">{evaluation.actionId}</div>{evaluation.isSelected ? <div className="font-semibold text-[#1b586d]">選択</div> : null}</td>
              <td className="px-2 py-1.5 font-semibold text-slate-700">{OBJECTIVE_LABEL[evaluation.objectiveKind]}</td>
              <td className="px-2 py-1.5"><StatusBadge status={evaluation.evaluationStatus} /></td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{formatProbability(evaluation.goalProbability)}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-700">{formatValue(evaluation.expectedNetValue)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{formatValue(evaluation.expectedCumulativeFundingMillionJpy)}</td>
              <td className="px-2 py-1.5"><JsonDisclosure label="派生値・診断" value={evaluation} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevisionLedger({ model }: { model: Bzm21PolicyModelLedger }) {
  const current = model.currentRevision;
  if (model.revisions.length === 0) return <div className="px-3 py-3 text-[10px] text-orange-700">版は未登録。</div>;
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-[9px] leading-4">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-2 py-1.5">版</th><th className="px-2 py-1.5">測定状態</th><th className="px-2 py-1.5">モード</th><th className="px-2 py-1.5">価値基準日</th><th className="px-2 py-1.5">情報締切</th><th className="px-2 py-1.5 text-right">前向き検証</th><th className="px-2 py-1.5">計算契約</th></tr></thead>
        <tbody>
          {model.revisions.map((revision) => (
            <tr key={revision.revisionId} className={`border-t border-slate-100 align-top ${revision.revisionId === current?.revisionId ? "bg-[#f1f7f8]" : "even:bg-slate-50/40"}`}>
              <td className="px-2 py-1.5"><div className="font-semibold text-slate-700">{revision.revisionKey}</div><div className="font-mono text-[8px] text-slate-400">#{revision.revisionOrder} · {revision.modelVersion}</div></td>
              <td className="px-2 py-1.5"><StatusBadge status={revision.measurementStatus} /></td>
              <td className="px-2 py-1.5 text-slate-600">{revision.dataMode}</td>
              <td className="px-2 py-1.5 font-mono text-slate-600">{revision.valuationDate ?? "欠測"}</td>
              <td className="px-2 py-1.5 font-mono text-slate-600">{formatDateTime(revision.informationCutoff)}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-700">{revision.forwardValidationCount}件</td>
              <td className="px-2 py-1.5"><JsonDisclosure label="版の全項目" value={revision} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Bzm21DynamicPolicyObservatory({
  model,
  displayMode = "primary",
}: {
  model: Bzm21PolicyModelLedger;
  displayMode?: DisplayMode;
}) {
  const revision = model.currentRevision;
  const companySelected = evaluationFor(model, "company", "optimized");
  const companyBaseline = evaluationFor(model, "company", "fixed_baseline");
  const selectedAction = selectedActionFor(model, companySelected);
  const inputs = allCurrentInputs(model);
  const profile = estimateProfile(inputs);
  const registeredEstimateRatioInput = inputs.find((input) =>
    ["estimation_ratio", "estimation_ratio_numeric_parameters"].includes(input.parameterKey),
  );
  const registeredEstimateRatio =
    typeof registeredEstimateRatioInput?.value === "number" &&
    Number.isFinite(registeredEstimateRatioInput.value)
      ? registeredEstimateRatioInput.value
      : null;
  const sensitivityInput = inputs.find((input) => input.parameterKey === "sensitivity_action_switch");
  const sensitivityValue = isRecord(sensitivityInput?.value)
    && typeof sensitivityInput.value.selectedActionSwitches === "boolean"
      ? sensitivityInput.value.selectedActionSwitches
      : null;
  const revisionTone = revision ? toneForStatus(revision.measurementStatus) : "missing";
  const toneForValue = (value: unknown): StatusTone =>
    value === null || value === undefined ? "missing" : revisionTone;
  const actionEvaluations = model.states.flatMap((state) =>
    state.actions.flatMap((action) => action.evaluations),
  );
  const policyHistory = model.policyViews
    .flatMap((view) => view.history)
    .sort(
      (left, right) =>
        right.revisionOrder - left.revisionOrder ||
        left.objectiveKind.localeCompare(right.objectiveKind) ||
        left.policyKind.localeCompare(right.policyKind),
    );
  const missingCount = ["missing", "not_started", "not_computable", "unknown"].reduce(
    (sum, key) => sum + (profile.counts[key] ?? 0),
    0,
  );

  return (
    <section
      aria-labelledby="bzm21-observatory-title"
      className="min-w-0 overflow-hidden border border-[#aac1ca] bg-[#f6f8f8]"
    >
      <header className="border-b border-[#b9cbd1] bg-[#eaf1f3] px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="bzm21-observatory-title" className="text-[13px] font-semibold tracking-tight text-[#173f51]">
                SPS 2.1 動的方針評価
              </h2>
              <span className={`border px-1.5 py-0.5 text-[9px] font-semibold ${displayMode === "primary" ? "border-[#7fa8b5] bg-[#dcebed] text-[#174b60]" : displayMode === "archive" ? "border-slate-300 bg-slate-100 text-slate-600" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {displayMode === "primary" ? "主表示" : displayMode === "archive" ? "現行運用・比較用" : "切替前プレビュー"}
              </span>
              <StatusBadge status={companySelected?.evaluationStatus ?? model.storageState} />
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-600">
              <Tex tex={String.raw`\pi^{\star}=\arg\max_{\pi\in\Pi}V_{r_c}^{\pi},\qquad \mathrm{SPS}_{2.1}^{(\mathrm{company})}=V_{\mathrm{company}}^{\pi^{\star}}`} />
              <span>会社視点の方針条件付き将来正味PJ価値。投資配分の自動推薦には使わない。</span>
            </div>
          </div>
          <div className="shrink-0 text-right font-mono text-[8px] leading-4 text-slate-500">
            <div>{revision?.revisionKey ?? "版未登録"}</div>
            <div>情報締切 {revision ? formatDateTime(revision.informationCutoff) : "欠測"}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px border-b border-[#b9cbd1] bg-[#c9d5d9] sm:grid-cols-4 xl:grid-cols-8">
        <MetricCell prominent tone={toneForValue(companySelected?.expectedNetValue)} label={<Tex tex={String.raw`\mathrm{SPS}_{2.1}`} />} value={formatValue(companySelected?.expectedNetValue)} detail="会社・選択方針" />
        <MetricCell prominent tone={toneForValue(companySelected?.goalProbability)} label={<Tex tex={String.raw`q^{\pi^{\star}}`} />} value={formatProbability(companySelected?.goalProbability)} detail="資本自立への到達見込み" />
        <MetricCell tone={toneForValue(selectedAction)} label="現在の選択" value={selectedAction ? ACTION_LABEL[selectedAction.actionType] : "欠測"} detail={selectedAction?.label} />
        <MetricCell tone={toneForValue(companySelected?.valueDifferenceFromBaseline)} label="固定方針との差" value={formatDelta(companySelected?.valueDifferenceFromBaseline)} detail={`固定方針 ${formatValue(companyBaseline?.expectedNetValue)}`} />
        <MetricCell tone={toneForValue(companySelected?.expectedCumulativeFundingMillionJpy)} label="累積必要資金" value={formatValue(companySelected?.expectedCumulativeFundingMillionJpy)} detail="経路確率込み" />
        <MetricCell tone={toneForValue(companySelected?.expectedFailureLossMillionJpy)} label="失敗経路損失" value={formatValue(companySelected?.expectedFailureLossMillionJpy)} detail="経路確率込み" />
        <MetricCell
          tone={toneForValue(registeredEstimateRatio ?? profile.ratio)}
          label="推定率（数値入力）"
          value={registeredEstimateRatio === null ? (profile.ratio === null ? "欠測" : formatProbability(profile.ratio)) : formatProbability(registeredEstimateRatio)}
          detail={registeredEstimateRatio === null ? `現行入力台帳 ${inputs.length}件 / 欠測 ${missingCount}件` : `推定器の数値パラメータ基準 / 台帳欠測 ${missingCount}件`}
        />
        <MetricCell
          tone={toneForValue(sensitivityValue)}
          label="感度で行動反転"
          value={sensitivityValue === null ? "欠測" : sensitivityValue ? "あり" : "なし"}
          detail="機械的stress。信頼区間ではない"
        />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-white px-3 py-1.5 text-[9px] text-slate-600">
        <span className="font-semibold text-[#294c5b]">根拠スパイン</span>
        <span className="inline-flex items-center gap-1"><StatusBadge status="observed" /> {profile.counts.observed ?? 0}</span>
        <span className="inline-flex items-center gap-1"><StatusBadge status="calculated" /> {profile.counts.calculated ?? 0}</span>
        <span className="inline-flex items-center gap-1"><StatusBadge status="estimated" /> {profile.counts.estimated ?? 0}</span>
        <span className="inline-flex items-center gap-1"><StatusBadge status="conditional" /> {profile.counts.conditional ?? 0}</span>
        <span className="inline-flex items-center gap-1"><StatusBadge status="missing" /> {missingCount}</span>
        <span className="ml-auto font-semibold text-orange-700">
          前向き検証 {revision ? `${revision.forwardValidationCount}件` : "未登録"}
        </span>
      </div>

      {model.storageState !== "ready" || !revision ? (
        <div className="border-b border-orange-200 bg-orange-50 px-3 py-2 text-[10px] leading-4 text-orange-800">
          SPS 2.1の現行版を読み出せていない。数値は0ではなく欠測。{model.storageMessage ? ` ${model.storageMessage}` : ""}
        </div>
      ) : null}

      <PolicyEvaluationLedger model={model} />

      <SectionDisclosure title="判断状態・行動・遷移" count={model.states.length} summary="何を選び、どの経路がどこへ進むか" open>
        <StateLedger model={model} selectedEvaluation={companySelected} />
      </SectionDisclosure>
      <SectionDisclosure title="全パラメータ入力台帳" count={inputs.length} summary="推定・観測・欠測を同じ列で区別">
        <InputLedger inputs={inputs} />
      </SectionDisclosure>
      {model.inputHistory.length > inputs.length ? (
        <SectionDisclosure title="入力版履歴" count={model.inputHistory.length} summary="過去入力を消さず、未来の値を過去へ補完しない">
          <InputLedger inputs={model.inputHistory} />
        </SectionDisclosure>
      ) : null}
      <SectionDisclosure title="単一キャッシュフロー台帳" count={model.cashflowEvents.length} summary="会社・BZSF・公的の帰属を分離">
        <CashflowLedger events={model.cashflowEvents} />
      </SectionDisclosure>
      {model.cashflowEventHistory.length > model.cashflowEvents.length ? (
        <SectionDisclosure title="キャッシュフロー版履歴" count={model.cashflowEventHistory.length} summary="旧版の経路別金額を保持">
          <CashflowLedger events={model.cashflowEventHistory} />
        </SectionDisclosure>
      ) : null}
      <SectionDisclosure title="行動別評価" count={actionEvaluations.length} summary="選択前の各行動を視点別に確認">
        <ActionEvaluationLedger evaluations={actionEvaluations} />
      </SectionDisclosure>
      <SectionDisclosure title="版台帳" count={model.revisions.length} summary="旧版を消さず情報締切を固定">
        <RevisionLedger model={model} />
      </SectionDisclosure>
      {policyHistory.length > BZM21_OBJECTIVE_KINDS.length * 2 ? (
        <SectionDisclosure title="方針評価版履歴" count={policyHistory.length} summary="値・方針・入力hashの推移">
          <PolicyHistoryLedger evaluations={policyHistory} />
        </SectionDisclosure>
      ) : null}
      <SectionDisclosure title="支援条件・診断" count={model.interventions.length + model.diagnostics.length} summary="介入は外生加点せず経路変更として扱う">
        <div className="grid gap-2 px-3 py-2 text-[9px] sm:grid-cols-2">
          <div>
            <div className="font-semibold text-slate-600">支援条件</div>
            {model.interventions.length > 0 ? model.interventions.map((intervention) => (
              <div key={intervention.interventionId} className="mt-1 border border-slate-200 bg-slate-50 p-2">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-700">{intervention.label}</span><StatusBadge status={intervention.enabled ? "available" : "not_applicable"} /></div>
                <JsonDisclosure label="効果・根拠・入力" value={intervention} />
              </div>
            )) : <div className="mt-1 text-slate-500">登録なし。支援効果0という意味ではない。</div>}
          </div>
          <div>
            <div className="font-semibold text-slate-600">読出し・計算診断</div>
            {model.diagnostics.length > 0 ? (
              <ul className="mt-1 list-disc space-y-1 pl-4 text-orange-800">
                {model.diagnostics.map((diagnostic, index) => <li key={`${index}-${diagnostic}`}>{diagnostic}</li>)}
              </ul>
            ) : <div className="mt-1 text-emerald-700">台帳診断なし</div>}
          </div>
        </div>
      </SectionDisclosure>

      <footer className="border-t border-slate-200 bg-[#edf2f3] px-3 py-1.5 text-[9px] leading-4 text-slate-600">
        <Tex tex={String.raw`q^{\pi}`} /> は物理経路の到達見込み、<Tex tex={String.raw`V_r^{\pi}`} /> は視点 <Tex tex={String.raw`r`} /> の方針条件付き将来正味価値。推定値は観測値へ昇格するまで琥珀色で残す。
      </footer>
    </section>
  );
}
