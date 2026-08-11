import { Tex } from "@/components/venture-map/Tex";
import {
  deriveBzm2InitialSps,
  readBzm2InitialPotentialProjection,
  readBzm2Probability,
} from "@/lib/bzm-2-observatory";
import type {
  Bzm2EvidenceKind,
  Bzm2Observation,
  Bzm2Observatory,
  Bzm2ParameterGroup,
  Bzm2ParameterSeries,
  Bzm2ValueStatus,
} from "@/lib/bzm-2-observatory";

const GROUP_LABELS: Record<Bzm2ParameterGroup, string> = {
  result: "出力と価値",
  clock: "時計と期限",
  state: "共通状態",
  context: "PJの観測状態",
  node: "工程入力",
  cash: "資金入力",
  quality: "測定品質",
};

const VALUE_STATUS_LABELS: Record<Bzm2ValueStatus, string> = {
  calculated: "計算値",
  observed: "観測済み",
  conditional: "条件つき",
  estimated: "推定",
  partial: "部分実装",
  missing: "欠測",
  not_started: "未着手",
};

const VALUE_STATUS_TONES: Record<Bzm2ValueStatus, string> = {
  calculated: "border-[#8bbcaf] bg-[#e8f4ef] text-[#205f52]",
  observed: "border-[#8bbcaf] bg-[#e8f4ef] text-[#205f52]",
  conditional: "border-[#9bb7ce] bg-[#eef5fa] text-[#285b7a]",
  estimated: "border-[#d8bb7c] bg-[#fbf2dd] text-[#78571d]",
  partial: "border-[#d8bb7c] bg-[#fbf2dd] text-[#78571d]",
  missing: "border-[#dfa27d] bg-[#fff0e7] text-[#8a3f25]",
  not_started: "border-[#c9c5bd] bg-[#f4f2ed] text-[#68645c]",
};

const EVIDENCE_LABELS: Record<Bzm2EvidenceKind, string> = {
  calculation: "計算",
  document: "文書",
  record: "記録",
  hearing: "ヒアリング",
  assumption: "仮定",
  mixed: "複合",
  none: "根拠なし",
};

const SYMBOL_TEX: Record<string, string> = {
  SPS: String.raw`\mathbf{SPS}`,
  SPS_0: String.raw`\mathbf{SPS}^{(0)}`,
  q: "q",
  P: String.raw`\mathbf P`,
  P_0: String.raw`\mathbf P^{(0)}`,
  T_C: String.raw`T_C`,
  T_Y: String.raw`T_Y`,
  H_v: String.raw`H_v`,
  Z_tau: String.raw`\mathbf Z_\tau`,
  Z_policy: String.raw`Z_{\mathrm{policy}}`,
  C_0: String.raw`C_0`,
  p_1: String.raw`p_1`,
  p_2: String.raw`p_2`,
  p_3: String.raw`p_3`,
  p_4: String.raw`p_4`,
  p_5: String.raw`p_5`,
  p_6: String.raw`p_6`,
  p_7: String.raw`p_7`,
  p_8: String.raw`p_8`,
  w_7: String.raw`w_7`,
  C_1: String.raw`C_1`,
  b_1: String.raw`b_1`,
  t_0: String.raw`t_0`,
  status_PJ: String.raw`\mathrm{status}_{\mathrm{PJ}}`,
  AMD_role: String.raw`\mathrm{AMD}_{\mathrm{role}}`,
  XRL_legacy: String.raw`\mathrm{XRL}_{\mathrm{legacy}}`,
  F_hist: String.raw`F_{\mathrm{hist}}`,
  F_plan: String.raw`F_{\mathrm{plan}}`,
  coverage: String.raw`\mathrm{coverage}`,
};

function symbolTex(symbol: string) {
  if (SYMBOL_TEX[symbol]) return SYMBOL_TEX[symbol];
  const match = symbol.match(/^([A-Za-z]+)_([A-Za-z0-9]+)$/);
  if (!match)
    return String.raw`\mathrm{${symbol.replace(/[^A-Za-z0-9]/g, "") || "?"}}`;
  const [, base, subscript] = match;
  return /^\d+$/.test(subscript)
    ? String.raw`\mathrm{${base}}_${subscript}`
    : String.raw`\mathrm{${base}}_{\mathrm{${subscript}}}`;
}

function MathSymbol({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  return <Tex tex={symbolTex(symbol)} className={className} />;
}

function AffectsTarget({ target }: { target: string }) {
  const isMathSymbol =
    target in SYMBOL_TEX || /^[A-Za-z]+_[A-Za-z0-9]+$/.test(target);
  return isMathSymbol ? <MathSymbol symbol={target} /> : <>{target}</>;
}

const INLINE_SYMBOL_PATTERN =
  /(T_C|T_Y|H_v|Z_policy|C_0|C_1|b_1|p_[1-8]|w_7|t_0|status_PJ|AMD_role|XRL_legacy|F_hist|F_plan)/g;

function InlineMathText({ children }: { children: string }) {
  const parts = children.split(INLINE_SYMBOL_PATTERN);
  return (
    <>
      {parts.map(
        (part, index) =>
          part &&
          (part in SYMBOL_TEX ? (
            <MathSymbol key={`${part}-${index}`} symbol={part} />
          ) : (
            <span key={`${part}-${index}`}>{part}</span>
          )),
      )}
    </>
  );
}

function formatCutoff(value: string | null | undefined) {
  if (!value) return "未登録";
  return value.replace("T", " ").replace(/:00(?:\.000)?(?:\+09:00|Z)$/, "");
}

function measurementStatusLabel(value: string | undefined) {
  if (value === "measured_hypothesis") return "仮説出力";
  if (value === "preregistration_open") return "事前登録中";
  if (value === "measurement_ready") return "計算準備済み";
  if (value === "data_collection") return "観測収集中";
  return "測定未登録";
}

function latestByKey(model: Bzm2Observatory) {
  return new Map(
    model.parameters.map((parameter) => [
      parameter.parameterKey,
      parameter.current,
    ]),
  );
}

function CurrentValue({
  observation,
}: {
  observation: Bzm2Observation | null | undefined;
}) {
  if (!observation) return <span className="text-[#9a5a3c]">欠測</span>;
  if (observation.parameterKey === "q") {
    const probability = readBzm2Probability(observation.value);
    if (probability !== null) return <span>{formatPercent(probability)}</span>;
  }
  if (observation.parameterKey === "P") {
    const potential = readBzm2InitialPotentialProjection(observation.value);
    if (potential) {
      return <span>{formatInitialValue(potential.value)}</span>;
    }
  }
  return <span>{observation.displayValue}</span>;
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatInitialValue(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

function parseConfidenceInterval(displayValue: string) {
  const match = displayValue.match(
    /95%CI\s+(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/i,
  );
  if (!match) return null;
  const lower = Number(match[1]);
  const upper = Number(match[2]);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  return { lower, upper };
}

function ConfidenceInterval({
  observation,
  className,
}: {
  observation: Bzm2Observation | null | undefined;
  className?: string;
}) {
  if (!observation || observation.parameterKey !== "q") return null;
  const interval = parseConfidenceInterval(observation.displayValue);
  if (!interval) return null;
  return (
    <div className={`mt-1 text-[9px] leading-3 text-[#665f55] ${className ?? ""}`}>
      95%信頼区間（計算上のぶれ）: {formatPercent(interval.lower)}〜
      {formatPercent(interval.upper)}
    </div>
  );
}

function StatusBadge({ status }: { status: Bzm2ValueStatus }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${VALUE_STATUS_TONES[status]}`}
    >
      {VALUE_STATUS_LABELS[status]}
    </span>
  );
}

function FormulaValueCell({
  symbol,
  label,
  observation,
  className,
  detail,
}: {
  symbol: string;
  label: string;
  observation: Bzm2Observation | null | undefined;
  className?: string;
  detail?: string;
}) {
  return (
    <div className={`min-w-0 bg-[#fffdf8] px-2.5 py-2 ${className ?? ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <MathSymbol
          symbol={symbol}
          className="text-[12px] font-bold text-[#274c68]"
        />
        {observation ? (
          <StatusBadge status={observation.valueStatus} />
        ) : (
          <StatusBadge status="missing" />
        )}
      </div>
      <div className="mt-1 text-[10px] text-[#77736a]">{label}</div>
      <div className="mt-1 break-words font-sans text-[15px] font-semibold tabular-nums text-[#222420]">
        <CurrentValue observation={observation} />
      </div>
      <ConfidenceInterval observation={observation} />
      {detail && (
        <div className="mt-1 text-[9px] leading-3 text-[#665f55]">{detail}</div>
      )}
    </div>
  );
}

function EquationMark({ mark }: { mark: "×" | "=" }) {
  return (
    <div
      className="flex min-h-4 items-center justify-center py-0.5 text-[15px] font-semibold text-[#8a867c] sm:min-h-0 sm:py-0"
      aria-hidden="true"
    >
      {mark}
    </div>
  );
}

function DerivedSpsResult({
  q,
  potential,
}: {
  q: Bzm2Observation | null | undefined;
  potential: Bzm2Observation | null | undefined;
}) {
  const initialPotential = potential
    ? readBzm2InitialPotentialProjection(potential.value)
    : null;
  const initialSps =
    q && potential
      ? deriveBzm2InitialSps({ probability: q.value, potential: potential.value })
      : null;

  if (initialPotential && initialSps !== null) {
    return (
      <div className="min-w-0 bg-[#fffdf8] px-2.5 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <MathSymbol
            symbol="SPS_0"
            className="text-[12px] font-bold text-[#274c68]"
          />
          <StatusBadge status="estimated" />
        </div>
        <div className="mt-1 text-[10px] text-[#77736a]">SPSの初期投影</div>
        <div className="mt-1 font-sans text-[15px] font-semibold tabular-nums text-[#222420]">
          {formatInitialValue(initialSps)}
        </div>
        <div className="mt-1 text-[9px] leading-3 text-[#7c5541]">
          <MathSymbol symbol="q" /> × <MathSymbol symbol="P_0" />。価値ベクトルの本測定前の基準線
        </div>
      </div>
    );
  }

  const blockers: string[] = [];
  if (!q || q.valueStatus === "missing") blockers.push("qが欠測");
  if (!potential || potential.valueStatus === "missing") {
    blockers.push("Pが欠測");
  } else if (potential.valueStatus === "not_started") {
    blockers.push("Pが未着手");
  } else if (!initialPotential) {
    blockers.push("Pの尺度・合成規則が未登録");
  }
  const status =
    potential?.valueStatus === "not_started" ? "not_started" : "missing";

  return (
    <div className="min-w-0 bg-[#fffdf8] px-2.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <MathSymbol
          symbol="SPS_0"
          className="text-[12px] font-bold text-[#274c68]"
        />
        <StatusBadge status={status} />
      </div>
      <div className="mt-1 text-[10px] text-[#77736a]">SPSの初期投影</div>
      <div className="mt-1 font-sans text-[14px] font-semibold text-[#8a3f25]">
        未計算
      </div>
      <div className="mt-1 text-[9px] leading-3 text-[#7c5541]">
        {blockers.join(" / ")}
      </div>
    </div>
  );
}

function StateFormulaValue({
  parameters,
}: {
  parameters: Bzm2ParameterSeries[];
}) {
  const current = parameters.find((parameter) => parameter.current)?.current;
  return (
    <div className="min-w-0 bg-[#fffdf8] px-2.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <MathSymbol
          symbol="Z_tau"
          className="text-[12px] font-bold text-[#274c68]"
        />
        <StatusBadge status={current?.valueStatus ?? "missing"} />
      </div>
      <div className="mt-1 text-[10px] text-[#77736a]">共通状態</div>
      {parameters.length === 0 ? (
        <div className="mt-1 text-[12px] font-semibold text-[#9a5a3c]">
          未登録
        </div>
      ) : (
        <div className="mt-1 space-y-1 text-[10px] font-semibold tabular-nums text-[#242621]">
          {parameters.map((parameter) => (
            <div key={parameter.parameterKey} className="break-words">
              <MathSymbol symbol={parameter.symbol} /> ={" "}
              <CurrentValue observation={parameter.current} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QRevisionRail({ q }: { q: Bzm2ParameterSeries | undefined }) {
  const history = q?.history ?? [];
  return (
    <section className="border-t border-[#ded8cd] px-3 py-2.5 sm:px-4">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 py-1 marker:content-none hover:bg-[#f2eee5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#274c68]">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="text-[11px] font-semibold text-[#252722]">
              <MathSymbol symbol="q" />
              の版推移
            </h3>
            <span className="truncate text-[10px] text-[#77736a]">
              変更理由と出所を一緒に読む
            </span>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-[#5f6870]">
            {history.length}版{" "}
            <span className="ml-1 inline-block transition-transform group-open:rotate-180">
              ⌄
            </span>
          </span>
        </summary>
        {history.length === 0 ? (
          <div className="mt-2 rounded-md border border-dashed border-[#cfc7b9] px-3 py-2 text-[10px] text-[#7f776c]">
            qの計算履歴はまだない。0とは扱わない。
          </div>
        ) : (
          <ol className="mt-2 grid gap-px overflow-hidden rounded-md border border-[#d9d2c6] bg-[#d9d2c6] sm:grid-cols-2 xl:grid-cols-4">
            {history.map((observation) => (
              <li
                key={observation.observationId}
                className="min-w-0 bg-[#fffdf8] px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] font-semibold text-[#5f6870]">
                    {observation.revisionKey}
                  </span>
                  <StatusBadge status={observation.valueStatus} />
                </div>
                <div className="mt-1 text-[16px] font-semibold leading-none tabular-nums text-[#274c68]">
                  <CurrentValue observation={observation} />
                </div>
                <ConfidenceInterval observation={observation} />
                <div className="mt-1 text-[9px] text-[#77736a]">
                  {EVIDENCE_LABELS[observation.evidenceKind]}
                </div>
                {observation.note && (
                  <p className="mt-1 text-[9px] leading-4 text-[#5f5b53]">
                    {observation.note}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}

function ParameterHistoryToggle({
  parameter,
}: {
  parameter: Bzm2ParameterSeries;
}) {
  const current = parameter.current;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 font-mono text-[9px] text-[#52636c] hover:bg-[#e8f0f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#274c68] marker:content-none">
        詳細 {parameter.history.length}版{" "}
        <span className="transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-[min(28rem,calc(100vw-3rem))] rounded-md border border-[#cfc7b9] bg-[#fffdf8] p-2.5 text-[10px] leading-4 text-[#625e56] shadow-[0_8px_24px_rgba(51,46,38,0.14)]">
        <p>
          <InlineMathText>{parameter.description}</InlineMathText>
        </p>
        {current?.note && (
          <p className="mt-1.5 text-[#3f4944]">
            現在の注記：<InlineMathText>{current.note}</InlineMathText>
          </p>
        )}
        {current?.evidenceRef && (
          <p className="mt-1 break-all font-mono text-[9px] text-[#77736a]">
            出所：{current.evidenceRef}
          </p>
        )}
        <table className="mt-2 w-full border-collapse text-left text-[9px]">
          <thead>
            <tr className="border-b border-[#d9d2c6] text-[#888176]">
              <th className="py-1 pr-1 font-medium">版</th>
              <th className="py-1 pr-1 font-medium">値</th>
              <th className="py-1 pr-1 font-medium">状態</th>
              <th className="py-1 font-medium">締切</th>
            </tr>
          </thead>
          <tbody>
            {parameter.history.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-1.5 text-[#9a5a3c]">
                  観測履歴なし。欠測のまま保持。
                </td>
              </tr>
            ) : (
              parameter.history.map((observation) => (
                <tr
                  key={observation.observationId}
                  className="border-b border-[#e7e1d7] last:border-b-0"
                >
                  <td className="py-1 pr-1 font-mono">
                    {observation.revisionKey}
                  </td>
                  <td className="py-1 pr-1 font-sans font-semibold tabular-nums text-[#29302c]">
                    <CurrentValue observation={observation} />
                  </td>
                  <td className="py-1 pr-1">
                    {VALUE_STATUS_LABELS[observation.valueStatus]}・
                    {EVIDENCE_LABELS[observation.evidenceKind]}
                  </td>
                  <td className="py-1 font-mono text-[8px]">
                    {formatCutoff(observation.informationCutoff)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ParameterLedgerTable({
  parameters,
}: {
  parameters: Bzm2ParameterSeries[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[840px] w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[#d7d0c4] bg-[#f6f2e9] text-[9px] font-medium tracking-[0.06em] text-[#777168]">
            <th className="w-[29%] px-2.5 py-1.5 font-medium">記号 / 変数</th>
            <th className="w-[20%] px-2.5 py-1.5 font-medium">現在値</th>
            <th className="w-[20%] px-2.5 py-1.5 font-medium">測定 / 出所</th>
            <th className="w-[21%] px-2.5 py-1.5 font-medium">反映先</th>
            <th className="w-[10%] px-2.5 py-1.5 text-right font-medium">
              履歴
            </th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((parameter) => {
            const current = parameter.current;
            return (
              <tr
                key={parameter.parameterKey}
                className="border-b border-[#e8e2d8] align-top last:border-b-0 hover:bg-[#fffcf5]"
              >
                <td className="px-2.5 py-1.5">
                  <div className="flex items-baseline gap-2">
                    <MathSymbol
                      symbol={parameter.symbol}
                      className="shrink-0 text-[11px] font-bold text-[#274c68]"
                    />
                    <span className="text-[10px] font-semibold text-[#272823]">
                      {parameter.label}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[8px] text-[#9a9489]">
                    {parameter.parameterKey}
                  </div>
                </td>
                <td className="px-2.5 py-1.5">
                  <div className="font-sans text-[11px] font-semibold leading-4 tabular-nums text-[#242621]">
                    <CurrentValue observation={current} />
                  </div>
                  <ConfidenceInterval observation={current} />
                  {current?.unit &&
                    !(
                      current.parameterKey === "P" &&
                      readBzm2InitialPotentialProjection(current.value)
                    ) && (
                    <div className="text-[8px] leading-3 text-[#8b857a]">
                      {current.unit}
                    </div>
                  )}
                </td>
                <td className="px-2.5 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={current?.valueStatus ?? "missing"} />
                    <span className="inline-flex min-h-6 items-center rounded-full border border-[#d4cdbf] bg-[#faf7f0] px-1.5 py-0.5 text-[9px] text-[#68635a]">
                      {current
                        ? EVIDENCE_LABELS[current.evidenceKind]
                        : "根拠なし"}
                    </span>
                  </div>
                </td>
                <td className="px-2.5 py-1.5">
                  {current?.affects.length ? (
                    <div className="flex flex-wrap gap-1">
                      {current.affects.map((target) => (
                        <span
                          key={target}
                          className="inline-flex min-h-6 items-center rounded-full border border-[#a9bfd0] bg-[#eef4f8] px-1.5 py-0.5 font-mono text-[9px] text-[#285b7a]"
                        >
                          → <AffectsTarget target={target} />
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#9a9489]">—</span>
                  )}
                </td>
                <td className="relative px-2.5 py-1.5 text-right">
                  <ParameterHistoryToggle parameter={parameter} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Bzm2ModelObservatory({ model }: { model: Bzm2Observatory }) {
  const currentByKey = latestByKey(model);
  const currentQ = currentByKey.get("q");
  const currentPotential = currentByKey.get("P");
  const hasInitialPotential = Boolean(
    currentPotential && readBzm2InitialPotentialProjection(currentPotential.value),
  );
  const qSeries = model.parameters.find(
    (parameter) => parameter.parameterKey === "q",
  );
  const stateParameters = model.parameters.filter(
    (parameter) => parameter.group === "state",
  );
  const visibleGroups = (Object.keys(GROUP_LABELS) as Bzm2ParameterGroup[])
    .map((group) => ({
      group,
      parameters: model.parameters.filter(
        (parameter) => parameter.group === group,
      ),
    }))
    .filter(({ parameters }) => parameters.length > 0);
  const currentRevision = model.currentRevision;

  return (
    <section
      className="overflow-hidden rounded-xl border border-[#cbc4b8] bg-[#f8f5ed] text-[#282923] shadow-[0_1px_0_rgba(37,39,34,0.04)]"
      aria-labelledby="bzm2-observatory-title"
    >
      <header className="border-b border-[#354957] bg-[#162a37] px-3 py-3 text-[#edf4f5] sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#91c8c4]">
              BZM 2.0 / MODEL OBSERVATORY
            </div>
            <h2
              id="bzm2-observatory-title"
              className="mt-0.5 text-[16px] font-semibold tracking-tight"
            >
              到達見込みの数式と現在値
            </h2>
            <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-[#c9d6d9]">
              現行運用SPSとは別の検証中モデル。値、欠測、出所、版の変化を同じ場所で追う。
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[9px]">
            <span className="rounded-full border border-[#6c8997] bg-[#213b49] px-2 py-0.5 font-semibold text-[#dce9eb]">
              {measurementStatusLabel(currentRevision?.measurementStatus)}
            </span>
            <span className="rounded-full border border-[#8f7955] bg-[#443924] px-2 py-0.5 font-semibold text-[#f2deb7]">
              前向き検証 {currentRevision?.forwardValidationCount ?? 0}件
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#38505e] pt-2 font-mono text-[9px] text-[#aac0c5]">
          <span>版 {currentRevision?.revisionKey ?? "未登録"}</span>
          <span>
            理論 {currentRevision?.theoryVersion ?? "theory-fixed v1.1"}
          </span>
          <span>
            情報締切 {formatCutoff(currentRevision?.informationCutoff)}
          </span>
        </div>
      </header>

      {model.storageMessage && (
        <div className="border-b border-[#e2b48f] bg-[#fff0e4] px-4 py-2.5 text-[10px] leading-5 text-[#874328] sm:px-5">
          {model.storageMessage}
        </div>
      )}

      <div className="px-3 py-3 sm:px-4">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.35fr)]">
          <section className="overflow-hidden rounded-lg border border-[#b9c8cf] bg-[#f4f8f9]">
            <div className="px-3 py-2.5">
              <div className="text-[9px] font-semibold tracking-[0.12em] text-[#365b70]">
                トップ構造
              </div>
              <div className="mt-1 overflow-x-auto text-[#183b50]">
                <Tex
                  tex={String.raw`\mathbf{SPS}=q\mathbf P`}
                  display
                  className="text-[20px]"
                />
              </div>
              <p className="mt-1 text-[9px] leading-4 text-[#5f6d72]">
                qとPは別の証拠で決める。下の数値は、価値ベクトルの本測定前に置く初期投影。
              </p>
            </div>
            <div className="border-t border-[#c7d2d6] px-3 py-2">
              <div className="text-[9px] font-semibold tracking-[0.1em] text-[#365b70]">
                現在の代入{hasInitialPotential ? "（初期投影）" : ""}
              </div>
              <div className="mt-1 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-[#c9d4d7] bg-[#c9d4d7] sm:grid-cols-[minmax(0,0.8fr)_12px_minmax(0,0.8fr)_12px_minmax(0,1fr)]">
                <FormulaValueCell
                  symbol="q"
                  label="到達見込み"
                  observation={currentQ}
                />
                <EquationMark mark="×" />
                <FormulaValueCell
                  symbol={hasInitialPotential ? "P_0" : "P"}
                  label={hasInitialPotential ? "価値の初期投影" : "潜在価値"}
                  observation={currentPotential}
                  detail={
                    hasInitialPotential
                      ? "旧SPSのPを換算せず、そのまま使用。社会・経済価値は別測定。"
                      : undefined
                  }
                />
                <EquationMark mark="=" />
                <DerivedSpsResult
                  q={currentQ}
                  potential={currentPotential}
                />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[#b9c8cf] bg-[#f4f8f9]">
            <div className="px-3 py-2.5">
              <div className="text-[9px] font-semibold tracking-[0.12em] text-[#365b70]">
                共通状態を含む到達競争
              </div>
              <div className="mt-1 overflow-x-auto text-[#183b50]">
                <Tex
                  tex={String.raw`q(\mathbf z)=\Pr\!\bigl(T_C(\mathbf z)<T_Y(\mathbf z),\ T_C(\mathbf z)\le H_v\mid\mathbf Z_\tau=\mathbf z\bigr)`}
                  display
                  className="text-[11px] sm:text-[14px]"
                />
              </div>
              <p className="mt-1 text-[9px] leading-4 text-[#5f6d72]">
                共通状態は別加点せず、影響工程・時間・資金を条件づける。
              </p>
            </div>
            <div className="border-t border-[#c7d2d6] px-3 py-2">
              <div className="text-[9px] font-semibold tracking-[0.1em] text-[#365b70]">
                現在の判定値
              </div>
              <div className="mt-1 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#c9d4d7] bg-[#c9d4d7] sm:grid-cols-5">
                <StateFormulaValue parameters={stateParameters} />
                <FormulaValueCell
                  symbol="T_C"
                  label="到達時間"
                  observation={currentByKey.get("T_C")}
                />
                <FormulaValueCell
                  symbol="T_Y"
                  label="余力喪失時間"
                  observation={currentByKey.get("T_Y")}
                />
                <FormulaValueCell
                  symbol="H_v"
                  label="計画期限"
                  observation={currentByKey.get("H_v")}
                />
                <FormulaValueCell
                  symbol="q"
                  label="到達見込み"
                  observation={currentByKey.get("q")}
                  className="col-span-2 sm:col-span-1"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <QRevisionRail q={qSeries} />

      <section className="border-t border-[#ded8cd] px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold text-[#252722]">
            パラメータ台帳
          </h3>
          <span className="text-[9px] text-[#77736a]">
            現在値・根拠・反映先を横比較。詳細は各行から開く。
          </span>
        </div>
        <div className="mt-2 space-y-2">
          {visibleGroups.map(({ group, parameters }) => (
            <section
              key={group}
              className="overflow-hidden rounded-lg border border-[#d6cfc2] bg-[#fffdf8]"
            >
              <div className="border-b border-[#ded7cb] bg-[#f1ede4] px-2.5 py-1.5 text-[9px] font-semibold tracking-[0.1em] text-[#5d5a52]">
                {GROUP_LABELS[group]}{" "}
                <span className="ml-1 font-mono text-[#9a9489]">
                  {parameters.length}
                </span>
              </div>
              <ParameterLedgerTable parameters={parameters} />
            </section>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#ded8cd] bg-[#f1ede4] px-3 py-2 text-[9px] leading-4 text-[#68635a] sm:px-4">
        qは「定義に従って計算した数」で、当たると確認済みの予測ではない。欠測は0へ変換せず、GO、NO_GO、投資額へ単独利用しない。
      </footer>
    </section>
  );
}
