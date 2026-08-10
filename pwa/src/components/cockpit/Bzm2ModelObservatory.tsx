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

function formatCutoff(value: string | null | undefined) {
  if (!value) return "未登録";
  return value.replace("T", " ").replace(/:00(?:\.000)?(?:\+09:00|Z)$/, "");
}

function measurementStatusLabel(value: string | undefined) {
  if (value === "measured_hypothesis") return "仮説出力";
  if (value === "preregistration_open") return "事前登録中";
  if (value === "measurement_ready") return "計算準備済み";
  return "測定未登録";
}

function latestByKey(model: Bzm2Observatory) {
  return new Map(model.parameters.map((parameter) => [parameter.parameterKey, parameter.current]));
}

function CurrentValue({ observation }: { observation: Bzm2Observation | null | undefined }) {
  if (!observation) return <span className="text-[#9a5a3c]">欠測</span>;
  return <span>{observation.displayValue}</span>;
}

function StatusBadge({ status }: { status: Bzm2ValueStatus }) {
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${VALUE_STATUS_TONES[status]}`}>
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
        <span className="font-mono text-[12px] font-bold text-[#274c68]">{symbol}</span>
        {observation ? <StatusBadge status={observation.valueStatus} /> : <StatusBadge status="missing" />}
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
    <div className="flex items-center justify-center text-[#8a867c]" aria-hidden="true">
      <span className="hidden text-lg xl:inline">→</span>
      <span className="py-1 text-lg xl:hidden">↓</span>
    </div>
  );
}

function QRevisionRail({ q }: { q: Bzm2ParameterSeries | undefined }) {
  const history = q?.history ?? [];
  return (
    <section className="border-t border-[#ded8cd] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold text-[#252722]">qの版推移</h3>
        <span className="text-[10px] text-[#77736a]">点の上下ではなく、変更理由と出所を一緒に読む</span>
      </div>
      {history.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[#cfc7b9] px-3 py-4 text-[11px] text-[#7f776c]">
          qの計算履歴はまだない。0とは扱わない。
        </div>
      ) : (
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {history.map((observation, index) => (
            <li key={observation.observationId} className="relative min-w-0 rounded-lg border border-[#d9d2c6] bg-[#fffdf8] px-3 py-3">
              {index > 0 && <span className="absolute -left-2 top-1/2 hidden -translate-y-1/2 text-[#9b958a] xl:block">›</span>}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-semibold text-[#5f6870]">{observation.revisionKey}</span>
                <StatusBadge status={observation.valueStatus} />
              </div>
              <div className="mt-2 font-mono text-[20px] font-bold text-[#274c68]">{observation.displayValue}</div>
              <div className="mt-1 text-[10px] text-[#77736a]">{EVIDENCE_LABELS[observation.evidenceKind]}</div>
              {observation.note && <p className="mt-2 text-[10px] leading-4 text-[#5f5b53]">{observation.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ParameterRow({ parameter }: { parameter: Bzm2ParameterSeries }) {
  const current = parameter.current;
  return (
    <details className="group border-b border-[#e4ded3] last:border-b-0">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 marker:content-none sm:grid-cols-[minmax(160px,0.75fr)_minmax(160px,0.8fr)_minmax(0,1.2fr)_auto]">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] font-bold text-[#274c68]">{parameter.symbol}</span>
            <span className="truncate text-[11px] font-semibold text-[#272823]">{parameter.label}</span>
          </div>
          <div className="mt-1 truncate font-mono text-[9px] text-[#9a9489]">{parameter.parameterKey}</div>
        </div>
        <div className="text-right sm:text-left">
          <div className="break-words font-mono text-[12px] font-semibold text-[#242621]">
            <CurrentValue observation={current} />
          </div>
          {current?.unit && <div className="mt-0.5 text-[9px] text-[#8b857a]">{current.unit}</div>}
        </div>
        <div className="col-span-2 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={current?.valueStatus ?? "missing"} />
            <span className="inline-flex min-h-6 items-center rounded-full border border-[#d4cdbf] bg-[#faf7f0] px-2 py-0.5 text-[10px] text-[#68635a]">
              {current ? EVIDENCE_LABELS[current.evidenceKind] : "根拠なし"}
            </span>
            {current?.affects.map((target) => (
              <span key={target} className="inline-flex min-h-6 items-center rounded-full border border-[#a9bfd0] bg-[#eef4f8] px-2 py-0.5 font-mono text-[10px] text-[#285b7a]">
                → {target}
              </span>
            ))}
          </div>
        </div>
        <span className="text-[14px] text-[#8d877c] transition-transform group-open:rotate-45" aria-hidden="true">＋</span>
      </summary>
      <div className="border-t border-[#e8e2d8] bg-[#faf7f0] px-3 py-3 text-[10px] leading-5 text-[#625e56]">
        <p>{parameter.description}</p>
        {current?.note && <p className="mt-2 text-[#3f4944]">現在の注記：{current.note}</p>}
        {current?.evidenceRef && <p className="mt-1 break-all font-mono text-[9px] text-[#77736a]">出所：{current.evidenceRef}</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[620px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#d9d2c6] text-[9px] text-[#888176]">
                <th className="px-2 py-1 font-medium">版</th>
                <th className="px-2 py-1 font-medium">値</th>
                <th className="px-2 py-1 font-medium">状態</th>
                <th className="px-2 py-1 font-medium">出所</th>
                <th className="px-2 py-1 font-medium">情報締切</th>
              </tr>
            </thead>
            <tbody>
              {parameter.history.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-2 text-[#9a5a3c]">観測履歴なし。欠測のまま保持。</td></tr>
              ) : parameter.history.map((observation) => (
                <tr key={observation.observationId} className="border-b border-[#e7e1d7] last:border-b-0">
                  <td className="px-2 py-2 font-mono">{observation.revisionKey}</td>
                  <td className="px-2 py-2 font-mono font-semibold text-[#29302c]">{observation.displayValue}</td>
                  <td className="px-2 py-2">{VALUE_STATUS_LABELS[observation.valueStatus]}</td>
                  <td className="px-2 py-2">{EVIDENCE_LABELS[observation.evidenceKind]}</td>
                  <td className="px-2 py-2 font-mono text-[9px]">{formatCutoff(observation.informationCutoff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export function Bzm2ModelObservatory({ model }: { model: Bzm2Observatory }) {
  const currentByKey = latestByKey(model);
  const qSeries = model.parameters.find((parameter) => parameter.parameterKey === "q");
  const stateParameters = model.parameters.filter((parameter) => parameter.group === "state");
  const visibleGroups = (Object.keys(GROUP_LABELS) as Bzm2ParameterGroup[])
    .map((group) => ({ group, parameters: model.parameters.filter((parameter) => parameter.group === group) }))
    .filter(({ parameters }) => parameters.length > 0);
  const currentRevision = model.currentRevision;

  return (
    <section className="overflow-hidden rounded-xl border border-[#cbc4b8] bg-[#f8f5ed] text-[#282923] shadow-[0_1px_0_rgba(37,39,34,0.04)]" aria-labelledby="bzm2-observatory-title">
      <header className="border-b border-[#354957] bg-[#162a37] px-4 py-4 text-[#edf4f5] sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#91c8c4]">BZM 2.0 / MODEL OBSERVATORY</div>
            <h2 id="bzm2-observatory-title" className="mt-1 text-[18px] font-semibold tracking-tight">到達見込みの数式と現在値</h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#c9d6d9]">
              現行運用SPSとは別の検証中モデル。値、欠測、出所、版の変化を同じ場所で追う。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-[#6c8997] bg-[#213b49] px-2.5 py-1 font-semibold text-[#dce9eb]">
              {measurementStatusLabel(currentRevision?.measurementStatus)}
            </span>
            <span className="rounded-full border border-[#8f7955] bg-[#443924] px-2.5 py-1 font-semibold text-[#f2deb7]">
              前向き検証 {currentRevision?.forwardValidationCount ?? 0}件
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#38505e] pt-3 font-mono text-[9px] text-[#aac0c5]">
          <span>版 {currentRevision?.revisionKey ?? "未登録"}</span>
          <span>理論 {currentRevision?.theoryVersion ?? "theory-fixed v1.1"}</span>
          <span>情報締切 {formatCutoff(currentRevision?.informationCutoff)}</span>
        </div>
      </header>

      {model.storageMessage && (
        <div className="border-b border-[#e2b48f] bg-[#fff0e4] px-4 py-2.5 text-[10px] leading-5 text-[#874328] sm:px-5">
          {model.storageMessage}
        </div>
      )}

      <div className="px-4 py-5 sm:px-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
          <div className="rounded-lg border border-[#b9c8cf] bg-[#f4f8f9] p-4">
            <div className="text-[10px] font-semibold tracking-[0.12em] text-[#365b70]">トップ構造</div>
            <div className="mt-3 overflow-x-auto py-1 text-center text-[#183b50]">
              <Tex tex={String.raw`\mathbf{SPS}=q\mathbf P`} display className="text-[22px]" />
            </div>
            <p className="mt-3 text-[10px] leading-5 text-[#5f6d72]">
              qとPは別の証拠で決める。Pを保ったまま到達条件だけを緩めてqを上げない。
            </p>
          </div>
          <div className="rounded-lg border border-[#b9c8cf] bg-[#f4f8f9] p-4">
            <div className="text-[10px] font-semibold tracking-[0.12em] text-[#365b70]">共通状態を含む到達競争</div>
            <div className="mt-3 overflow-x-auto py-1 text-center text-[#183b50]">
              <Tex
                tex={String.raw`\begin{aligned}q(\mathbf z)=\Pr\!\bigl(&T_C(\mathbf z)<T_Y(\mathbf z),\\[-2pt]&T_C(\mathbf z)\le H_v\mid\mathbf Z_\tau=\mathbf z\bigr)\end{aligned}`}
                display
                className="text-[12px] sm:text-[15px]"
              />
            </div>
            <p className="mt-3 text-[10px] leading-5 text-[#5f6d72]">
              共通状態は別加点しない。影響工程の確率、時間、資金接続をその状態に条件づける。
            </p>
          </div>
        </div>

        <div className="mt-4 grid items-stretch gap-2 xl:grid-cols-[minmax(0,0.9fr)_28px_minmax(0,1.35fr)_28px_minmax(0,0.8fr)]">
          <div className="rounded-lg border border-[#c9b98f] bg-[#fffaf0] p-3">
            <div className="text-[10px] font-semibold text-[#725a28]">共通状態（例 Z_policy）</div>
            {stateParameters.length === 0 ? (
              <div className="mt-2 text-[11px] text-[#9a5a3c]">Zは未登録</div>
            ) : (
              <div className="mt-2 space-y-2">
                {stateParameters.map((parameter) => (
                  <div key={parameter.parameterKey} className="border-l-2 border-[#b99446] pl-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#6f5420]">{parameter.symbol}</span>
                      <span className="font-mono text-[11px] font-semibold"><CurrentValue observation={parameter.current} /></span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {parameter.current?.affects.map((target) => (
                        <span key={target} className="rounded-full border border-[#d4bf8a] px-1.5 py-0.5 font-mono text-[9px] text-[#755b27]">→ {target}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <EquationArrow />
          <div className="grid gap-3 rounded-lg border border-[#b7c5cc] bg-[#fcfdfb] p-3 sm:grid-cols-3">
            <FormulaParameter symbol="T_C" label="到達時間" observation={currentByKey.get("T_C")} />
            <FormulaParameter symbol="T_Y" label="余力喪失時間" observation={currentByKey.get("T_Y")} />
            <FormulaParameter symbol="H_v" label="計画期限" observation={currentByKey.get("H_v")} />
          </div>
          <EquationArrow />
          <div className="grid gap-3 rounded-lg border border-[#9bb9b1] bg-[#f1f8f4] p-3 sm:grid-cols-2 xl:grid-cols-1">
            <FormulaParameter symbol="q" label="到達見込み" observation={currentByKey.get("q")} />
            <FormulaParameter symbol="P" label="潜在価値" observation={currentByKey.get("P")} />
          </div>
        </div>
      </div>

      <QRevisionRail q={qSeries} />

      <section className="border-t border-[#ded8cd] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[12px] font-semibold text-[#252722]">パラメータ台帳</h3>
          <span className="text-[10px] text-[#77736a]">行を開くと、版ごとの値と出所が見える</span>
        </div>
        <div className="mt-3 space-y-3">
          {visibleGroups.map(({ group, parameters }) => (
            <section key={group} className="overflow-hidden rounded-lg border border-[#d6cfc2] bg-[#fffdf8]">
              <div className="border-b border-[#ded7cb] bg-[#f1ede4] px-3 py-2 text-[10px] font-semibold tracking-[0.1em] text-[#5d5a52]">
                {GROUP_LABELS[group]} <span className="ml-1 font-mono text-[#9a9489]">{parameters.length}</span>
              </div>
              {parameters.map((parameter) => <ParameterRow key={parameter.parameterKey} parameter={parameter} />)}
            </section>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#ded8cd] bg-[#f1ede4] px-4 py-3 text-[10px] leading-5 text-[#68635a] sm:px-5">
        qは「定義に従って計算した数」で、当たると確認済みの予測ではない。欠測は0へ変換せず、GO、NO_GO、投資額へ単独利用しない。
      </footer>
    </section>
  );
}
