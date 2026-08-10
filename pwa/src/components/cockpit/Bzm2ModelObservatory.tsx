import { Tex } from "@/components/venture-map/Tex";
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
  q: "q",
  P: String.raw`\mathbf P`,
  T_C: String.raw`T_C`,
  T_Y: String.raw`T_Y`,
  H_v: String.raw`H_v`,
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
  return <span>{observation.displayValue}</span>;
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

function FormulaParameter({
  symbol,
  label,
  observation,
}: {
  symbol: string;
  label: string;
  observation: Bzm2Observation | null | undefined;
}) {
  return (
    <div className="min-w-0 border-l-2 border-[#274c68] pl-3">
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
      <div className="mt-1 break-words font-mono text-[14px] font-semibold text-[#222420]">
        <CurrentValue observation={observation} />
      </div>
    </div>
  );
}

function EquationArrow() {
  return (
    <div
      className="flex items-center justify-center text-[#8a867c]"
      aria-hidden="true"
    >
      <span className="hidden text-lg xl:inline">→</span>
      <span className="py-1 text-lg xl:hidden">↓</span>
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
                <div className="mt-1 font-mono text-[16px] font-bold leading-none text-[#274c68]">
                  {observation.displayValue}
                </div>
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
                  <td className="py-1 pr-1 font-mono font-semibold text-[#29302c]">
                    {observation.displayValue}
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
                  <div className="font-mono text-[11px] font-semibold leading-4 text-[#242621]">
                    <CurrentValue observation={current} />
                  </div>
                  {current?.unit && (
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
        <div className="overflow-x-auto rounded-lg border border-[#b9c8cf] bg-[#f4f8f9]">
          <div className="grid min-w-[660px] grid-cols-[0.8fr_1.7fr] divide-x divide-[#c7d2d6]">
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
                qとPは別の証拠で決める。
              </p>
            </div>
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
          </div>
        </div>

        <div className="mt-2 grid items-stretch gap-1.5 xl:grid-cols-[minmax(0,0.9fr)_20px_minmax(0,1.35fr)_20px_minmax(0,0.8fr)]">
          <div className="rounded-lg border border-[#c9b98f] bg-[#fffaf0] px-2.5 py-2">
            <div className="text-[9px] font-semibold text-[#725a28]">
              共通状態（例 <MathSymbol symbol="Z_policy" />）
            </div>
            {stateParameters.length === 0 ? (
              <div className="mt-1.5 text-[10px] text-[#9a5a3c]">Zは未登録</div>
            ) : (
              <div className="mt-1.5 space-y-1.5">
                {stateParameters.map((parameter) => (
                  <div
                    key={parameter.parameterKey}
                    className="border-l-2 border-[#b99446] pl-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <MathSymbol
                        symbol={parameter.symbol}
                        className="text-[10px] font-bold text-[#6f5420]"
                      />
                      <span className="font-mono text-[10px] font-semibold">
                        <CurrentValue observation={parameter.current} />
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {parameter.current?.affects.map((target) => (
                        <span
                          key={target}
                          className="rounded-full border border-[#d4bf8a] px-1.5 py-0.5 font-mono text-[8px] text-[#755b27]"
                        >
                          → <AffectsTarget target={target} />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <EquationArrow />
          <div className="grid gap-2 rounded-lg border border-[#b7c5cc] bg-[#fcfdfb] px-2.5 py-2 sm:grid-cols-3">
            <FormulaParameter
              symbol="T_C"
              label="到達時間"
              observation={currentByKey.get("T_C")}
            />
            <FormulaParameter
              symbol="T_Y"
              label="余力喪失時間"
              observation={currentByKey.get("T_Y")}
            />
            <FormulaParameter
              symbol="H_v"
              label="計画期限"
              observation={currentByKey.get("H_v")}
            />
          </div>
          <EquationArrow />
          <div className="grid gap-2 rounded-lg border border-[#9bb9b1] bg-[#f1f8f4] px-2.5 py-2 sm:grid-cols-2 xl:grid-cols-1">
            <FormulaParameter
              symbol="q"
              label="到達見込み"
              observation={currentByKey.get("q")}
            />
            <FormulaParameter
              symbol="P"
              label="潜在価値"
              observation={currentByKey.get("P")}
            />
          </div>
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
