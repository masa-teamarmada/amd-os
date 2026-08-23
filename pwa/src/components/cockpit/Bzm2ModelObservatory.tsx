import { Tex } from "@/components/venture-map/Tex";
import {
  bzm2ObservationInformationCutoff,
  deriveBzm2PathContribution,
  isClosedBzm2AllPathValue,
  readBzm2AllPathValue,
  readBzm2CommonHorizonProbability,
  readBzm2EquityValue,
  readBzm2InitialPotentialProjection,
  readBzm2PotentialVector,
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
  SPS: String.raw`\mathrm{SPS}`,
  SPS_tau: String.raw`\mathrm{SPS}_{\tau}`,
  SPS_all: String.raw`\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})`,
  SPS_G: String.raw`\mathrm{SPS}_{G,\tau}(H_{\mathrm{econ}})`,
  SPS_plan: String.raw`\mathrm{SPS}_{G,\mathrm{plan},\tau}(H_v)`,
  SPS_0: String.raw`\mathrm{SPS}^{(0)}`,
  q: "q",
  q_tau: String.raw`q_{\tau}`,
  q_plan: String.raw`q_{\mathrm{plan},\tau}(H_v)`,
  q_G: String.raw`q_{G,\tau}(H_{\mathrm{econ}})`,
  q_o: String.raw`q_{o,\tau}(H_{\mathrm{econ}})`,
  Q_h: String.raw`Q_{\tau}(h)`,
  P: "P",
  P_tau: String.raw`P_{\tau}`,
  P_o: String.raw`P_{o,\tau}(H_{\mathrm{econ}})`,
  P_G: String.raw`P_{G,\tau}(H_{\mathrm{econ}})`,
  P_G_plan: String.raw`P_{G,\mathrm{plan},\tau}(H_v)`,
  P_0: String.raw`P^{(0)}`,
  V_soc: String.raw`V_{\mathrm{soc}}`,
  V_econ: String.raw`V_{\mathrm{econ}}`,
  SPS_soc: String.raw`\mathrm{SPS}_{\mathrm{soc}}`,
  SPS_econ: String.raw`\mathrm{SPS}_{\mathrm{econ}}`,
  T_C: String.raw`T_C`,
  T_Y: String.raw`T_Y`,
  H_v: String.raw`H_v`,
  H_econ: String.raw`H_{\mathrm{econ}}`,
  A_v: String.raw`A_v`,
  m_tau_u: String.raw`m_{\tau,u}`,
  V_eq_TC: String.raw`V^{\mathrm{eq}}_{T_C}`,
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
  O: String.raw`\mathcal O`,
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
  /(SPS_all|SPS_G|SPS_plan|q_plan|q_G|Q_h|P_G_plan|P_G|T_C|T_Y|H_econ|H_v|Z_policy|C_0|C_1|b_1|p_[1-8]|w_7|t_0|status_PJ|AMD_role|XRL_legacy|F_hist|F_plan)/g;

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
  if (observation.parameterKey === "Q_h") {
    const commonHorizon = readBzm2CommonHorizonProbability(observation);
    if (commonHorizon !== null) {
      return <span>{formatPercent(commonHorizon.probability)}</span>;
    }
    if (observation.value !== null) {
      return <span className="text-[#8a3f25]">期間条件が不整合</span>;
    }
  }
  if (
    observation.parameterKey === "q" ||
    observation.parameterKey === "q_G"
  ) {
    const probability = readBzm2Probability(observation.value);
    if (probability !== null) return <span>{formatPercent(probability)}</span>;
  }
  if (observation.parameterKey === "P" || observation.parameterKey === "P_G") {
    const equityValue = readBzm2EquityValue(observation.value);
    if (equityValue) {
      return <span>{formatMillionJpy(equityValue.valueMillionJpy)}</span>;
    }
    const vector = readBzm2PotentialVector(observation.value);
    if (vector) {
      return (
        <span className="text-[#9a5a3c]">
          撤回済み指数 ({formatIndex(vector.components.V_soc.value)},{" "}
          {formatIndex(vector.components.V_econ.value)})
        </span>
      );
    }
    const potential = readBzm2InitialPotentialProjection(observation.value);
    if (potential) {
      return (
        <span className="text-[#8b7566]">
          撤回済み初期値 {formatInitialValue(potential.value)}
        </span>
      );
    }
  }
  if (observation.parameterKey === "SPS_all") {
    const allPathValue = isClosedBzm2AllPathValue(observation)
      ? readBzm2AllPathValue(observation.value)
      : null;
    if (allPathValue) {
      return <span>{formatMillionJpy(allPathValue.valueMillionJpy)}</span>;
    }
    if (observation.value !== null) {
      return <span className="text-[#8a3f25]">閉鎖検査不通過</span>;
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

function formatIndex(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMillionJpy(value: number) {
  if (value >= 100) {
    return `${new Intl.NumberFormat("ja-JP", {
      maximumFractionDigits: 1,
    }).format(value / 100)}億円`;
  }
  return `${new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 1,
  }).format(value)}百万円`;
}

function commonHorizonDetail(
  observation: Bzm2Observation | null | undefined,
) {
  const horizonMonths = observation?.condition.horizon_months;
  const economicHorizonMonths =
    observation?.condition.economic_horizon_months;
  const economicHorizonDate = observation?.condition.economic_horizon_date;
  if (
    typeof horizonMonths === "number" &&
    Number.isInteger(horizonMonths) &&
    horizonMonths > 0
  ) {
    return `比較期間 h = ${horizonMonths}か月 / 共通経済評価地平 ${
      typeof economicHorizonMonths === "number"
        ? `${economicHorizonMonths}か月`
        : "未登録"
    } / 対応日 ${
      typeof economicHorizonDate === "string"
        ? economicHorizonDate
        : "未登録"
    }`;
  }
  return "比較期間 h = 未登録。期間をそろえるまでPJ間比較しない。";
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
  if (
    !observation ||
    observation.parameterKey !== "q" &&
    observation.parameterKey !== "q_G" &&
    observation.parameterKey !== "Q_h"
  )
    return null;
  const interval = parseConfidenceInterval(observation.displayValue);
  if (!interval) return null;
  return (
    <div
      className={`mt-1 text-[9px] leading-3 text-[#665f55] ${className ?? ""}`}
    >
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

function DerivedPathContribution({
  q,
  potential,
  symbol,
  label,
}: {
  q: Bzm2Observation | null | undefined;
  potential: Bzm2Observation | null | undefined;
  symbol: "SPS_G" | "SPS_plan";
  label: string;
}) {
  const equityValue = potential ? readBzm2EquityValue(potential.value) : null;
  const pathValue =
    q && potential
      ? deriveBzm2PathContribution({ probability: q, potential })
      : null;

  if (equityValue && pathValue !== null) {
    return (
      <div className="min-w-0 bg-[#fffdf8] px-2.5 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <MathSymbol
            symbol={symbol}
            className="text-[12px] font-bold text-[#274c68]"
          />
          <StatusBadge status="calculated" />
        </div>
        <div className="mt-1 text-[10px] text-[#77736a]">{label}</div>
        <div className="mt-1 text-[15px] font-semibold tabular-nums text-[#285b7a]">
          {formatMillionJpy(pathValue)}
        </div>
        <div className="mt-1 text-[9px] leading-3 text-[#665f55]">
          この経路だけの円建て寄与。会社全体の価値ではない。
        </div>
      </div>
    );
  }

  const blockers: string[] = [];
  if (!q || q.valueStatus === "missing") blockers.push("到達見込みが欠測");
  else if (q.valueStatus === "not_started")
    blockers.push("到達見込みが未着手");
  if (!potential || potential.valueStatus === "missing") {
    blockers.push("経路価値が欠測");
  } else if (potential.valueStatus === "not_started") {
    blockers.push("経路価値が未着手");
  } else if (!equityValue) {
    blockers.push("円建て評価入力が未登録");
  }
  if (q && equityValue && pathValue === null) {
    blockers.push("版・情報締切・条件事象・期間が一致していない");
  }
  const status =
    q?.valueStatus === "not_started" ||
    potential?.valueStatus === "not_started"
      ? "not_started"
      : "missing";

  return (
    <div className="min-w-0 bg-[#fffdf8] px-2.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <MathSymbol
          symbol={symbol}
          className="text-[12px] font-bold text-[#274c68]"
        />
        <StatusBadge status={status} />
      </div>
      <div className="mt-1 text-[10px] text-[#77736a]">{label}</div>
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

const EXTRACTION_RULES = [
  {
    tex: String.raw`\tau,\ v,\ \pi,\ e`,
    label: "測定条件",
    source: "測定実行記録・承認済み計画・契約・制度文書",
    method: "情報締切、計画版、支援方針、外部環境を固定し、後知恵を遮断する。",
  },
  {
    tex: String.raw`G_{\mathrm{self}},\ X_G^*`,
    label: "到達境界",
    source: "理論正本・事業計画・契約・技術/供給要件",
    method: "12か月の自給に必要な技術、製造、顧客、権利、収支条件を列挙する。",
  },
  {
    tex: String.raw`\mathbf Z_\tau,\ \mathcal G_v`,
    label: "共通状態・依存グラフ",
    source: "制度・契約・工程表・構造化ヒアリング",
    method:
      "各工程が何と並行し、何の後に来るか、共通状態がどこへ効くかを結線する。",
  },
  {
    tex: String.raw`p_i,\ (a_i,m_i,b_i),\ F_i,\ R_i`,
    label: "工程入力",
    source: "実績参照クラス・観測頻度・複数評価者・試験計画",
    method:
      "条件付き成功率、時間三点、失敗範囲、迂回、再試行を別々に取得する。",
  },
  {
    tex: String.raw`C_j,\ b_j,\ L_j`,
    label: "資金経路",
    source: "残高・入出金・契約・交付決定・月次数値計画",
    method:
      "利用可能資金、純燃焼、条件付き入金を月次経路へ置く。未契約調達は成立ノードにする。",
  },
  {
    tex: String.raw`T_C,\ T_Y,\ q_{\mathrm{plan},\tau}(H_v),\ Q_\tau(h)`,
    label: "計画診断・共通期間比較",
    source: "共同経路シミュレーション",
    method:
      "到達と余力喪失を共同生成する。PJ固有期限の計画診断と、全PJ共通期間の累積曲線を分ける。",
  },
  {
    tex: String.raw`u_{s,t},\ n_{s,t},\ \rho_{s,t},\ R_t`,
    label: "売上",
    source: "契約・受注・見積・取引価格・供給能力",
    method:
      "セグメント別に単価、数量、反復率へ分解し、TAM比率だけの売上を置かない。",
  },
  {
    tex: String.raw`\mathrm{COGS}_t,\ \mathrm{OPEX}_t,\ \mathrm{CAPEX}_t`,
    label: "費用・投資",
    source: "原価実績・BOM・雇用/外注契約・設備見積",
    method: "数量、歩留まり、人員、設備能力へ接続してボトムアップで積む。",
  },
  {
    tex: String.raw`\Delta\mathrm{NWC}_t,\ \mathrm{Tax}_t,\ \mathrm{FCF}_t`,
    label: "自由キャッシュフロー",
    source: "回収/支払条件・在庫計画・税務条件",
    method:
      "到達前の開発費から残存価値までを含める。企業価値方式と株主価値方式を混ぜない。",
  },
  {
    tex: String.raw`\mathcal O,\ q_{o,\tau},\ P_{o,\tau}`,
    label: "価値実現経路",
    source: "事業計画・M&A/ライセンス/IP契約・清算・継続計画",
    method:
      "計画期限内の資本自立、期限後の資本自立、M&A、ライセンス、知財売却、ピボット、撤退、清算、継続中を重複なく分ける。",
  },
  {
    tex: String.raw`V^{\mathrm{enterprise}},\ D,\ V^{\mathrm{equity}}`,
    label: "企業価値から株主価値への橋",
    source: "借入・現金・非株主請求・資本政策・証券別契約",
    method:
      "負債等だけを企業価値から控除する。優先株・転換・希薄化は総持分価値内の証券別配分として扱う。",
  },
  {
    tex: String.raw`m_{\tau,u},\ D_{\mathrm{soc}}`,
    label: "現在価値への変換",
    source: "金利・市場リスク・比較企業・取引価格・投資家需要",
    method:
      "実確率と確率的割引係数、またはリスク中立評価、またはリスク調整DCFの一方式だけを選び、リスクを二重計上しない。",
  },
  {
    tex: String.raw`\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}}),\ \mathrm{SPS}_{G,\mathrm{plan},\tau}(H_v)`,
    label: "最終出力",
    source: "相互排他的な全経路の確率と条件付き価値",
    method:
      "全経路価値は経路寄与の和で出す。計画期限内の資本自立経路の積は内訳として残し、会社全体価値と呼ばない。",
  },
] as const;

function ExtractionRuleLedger() {
  return (
    <section className="border-t border-[#ded8cd] px-3 py-2.5 sm:px-4">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 py-1 marker:content-none hover:bg-[#f2eee5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#274c68]">
          <div>
            <h3 className="text-[11px] font-semibold text-[#252722]">
              全パラメータの抽出規則
            </h3>
            <p className="mt-0.5 text-[9px] text-[#77736a]">
              {EXTRACTION_RULES.length}群の要約。値・出所・補完規則・反映先を同じ版で保存する。
            </p>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-[#5f6870]">
            {EXTRACTION_RULES.length}群{" "}
            <span className="ml-1 inline-block transition-transform group-open:rotate-180">
              ⌄
            </span>
          </span>
        </summary>
        <div className="mt-2 overflow-x-auto rounded-md border border-[#d6cfc2] bg-[#fffdf8]">
          <table className="min-w-[900px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#d7d0c4] bg-[#f1ede4] text-[9px] text-[#777168]">
                <th className="w-[19%] px-2.5 py-1.5 font-medium">記号 / 群</th>
                <th className="w-[30%] px-2.5 py-1.5 font-medium">
                  優先する出所
                </th>
                <th className="w-[51%] px-2.5 py-1.5 font-medium">抽出方法</th>
              </tr>
            </thead>
            <tbody>
              {EXTRACTION_RULES.map((rule) => (
                <tr
                  key={rule.label}
                  className="border-b border-[#e8e2d8] align-top last:border-b-0"
                >
                  <td className="px-2.5 py-1.5">
                    <Tex
                      tex={rule.tex}
                      className="text-[10px] font-bold text-[#274c68]"
                    />
                    <div className="mt-0.5 text-[9px] font-semibold text-[#494940]">
                      {rule.label}
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5 text-[9px] leading-4 text-[#5f5b53]">
                    {rule.source}
                  </td>
                  <td className="px-2.5 py-1.5 text-[9px] leading-4 text-[#4c504a]">
                    {rule.method}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[8px] leading-3.5 text-[#756f65]">
          詳細正本:
          bzm/BZM_2_0_PARAMETER_EXTRACTION_REGISTER.md。参照クラスも機械的規則も無い推測は、数字を発明せず欠測にする。
        </p>
      </details>
    </section>
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
              <MathSymbol symbol="q_plan" />
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
            <MathSymbol symbol="q_plan" />の計算履歴はまだない。0とは扱わない。
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
                    {formatCutoff(
                      bzm2ObservationInformationCutoff(observation),
                    )}
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
  const currentPlanQ = currentByKey.get("q");
  const currentPlanValue = currentByKey.get("P");
  const currentCommonQ = currentByKey.get("Q_h");
  const currentCapitalQ = currentByKey.get("q_G");
  const currentCapitalValue = currentByKey.get("P_G");
  const storedAllPathValue = currentByKey.get("SPS_all");
  const currentAllPathValue = storedAllPathValue;
  const allPathIsClosed = isClosedBzm2AllPathValue(storedAllPathValue);
  const allPathDetail =
    storedAllPathValue &&
    storedAllPathValue.valueStatus !== "missing" &&
    storedAllPathValue.valueStatus !== "not_started" &&
    !allPathIsClosed
      ? "保存値は経路の排反・網羅、確率和、評価基準、再計算の検査前なので表示を止めている。"
      : allPathIsClosed
        ? "全経路の再計算と閉鎖検査を通った、モデル上の総持分価値。市場価格・時価総額ではない。"
        : "全経路の値はまだ未測定。欠測を0へ置き換えない。";
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
              全経路価値と到達診断の現在値
            </h2>
            <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-[#c9d6d9]">
              現行運用SPSと同じBZMから出る、別の検証中の出力。値、欠測、出所、版の変化を同じ場所で追う。
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[9px]">
            <span className="rounded-full border border-[#6c8997] bg-[#213b49] px-2 py-0.5 font-semibold text-[#dce9eb]">
              {measurementStatusLabel(currentRevision?.measurementStatus)}
            </span>
            <span className="rounded-full border border-[#8f7955] bg-[#443924] px-2 py-0.5 font-semibold text-[#f2deb7]">
              前向き検証 {currentRevision?.forwardValidationCount ?? 0}件
            </span>
            <span className="rounded-full border border-[#7f8892] bg-[#293743] px-2 py-0.5 font-semibold text-[#dce5ea]">
              AI模擬監査 / 予測用途不通過
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#38505e] pt-2 font-mono text-[9px] text-[#aac0c5]">
          <span>版 {currentRevision?.revisionKey ?? "未登録"}</span>
          <span>
            理論 {currentRevision?.theoryVersion ?? "未登録"}
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
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-lg border border-[#b9c8cf] bg-[#f4f8f9]">
            <div className="px-3 py-2.5">
              <div className="text-[9px] font-semibold tracking-[0.12em] text-[#365b70]">
                全価値実現経路のモデル価値
              </div>
              <div className="mt-1 overflow-x-auto text-[#183b50]">
                <Tex
                  tex={String.raw`\mathrm{SPS}_{\mathrm{all},\tau}(H_{\mathrm{econ}})=\sum_{o\in\mathcal O}q_{o,\tau}(H_{\mathrm{econ}})P_{o,\tau}(H_{\mathrm{econ}})`}
                  display
                  className="text-[17px] sm:text-[20px]"
                />
              </div>
              <p className="mt-1 text-[9px] leading-4 text-[#5f6d72]">
                計画期限内の資本自立、期限後の資本自立、M&amp;A、ライセンス、知財売却、ピボット、撤退、清算、継続中を重複なく分け、各経路の円建て寄与を足す。
              </p>
            </div>
            <div className="border-t border-[#c7d2d6] px-3 py-2">
              <div className="text-[9px] font-semibold tracking-[0.1em] text-[#365b70]">
                全経路の現在値
              </div>
              <div className="mt-1 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-[#c9d4d7] bg-[#c9d4d7] sm:grid-cols-2">
                <FormulaValueCell
                  symbol="SPS_all"
                  label="全経路のモデル価値"
                  observation={currentAllPathValue}
                  detail={allPathDetail}
                />
                <FormulaValueCell
                  symbol="O"
                  label="価値実現経路"
                  observation={currentByKey.get("O")}
                  detail="経路の漏れ・重複が無いことを確認してから総和する。"
                />
              </div>
            </div>
            <div className="border-t border-[#c7d2d6] px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[9px] font-semibold tracking-[0.1em] text-[#365b70]">
                  期限後を含む資本自立経路の内訳
                </div>
                <Tex
                  tex={String.raw`\mathrm{SPS}_{G,\tau}(H_{\mathrm{econ}})=q_{G,\tau}(H_{\mathrm{econ}})P_{G,\tau}(H_{\mathrm{econ}})`}
                  className="text-[10px] text-[#365b70]"
                />
              </div>
              <div className="mt-1 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-[#c9d4d7] bg-[#c9d4d7] sm:grid-cols-[minmax(0,0.8fr)_12px_minmax(0,0.8fr)_12px_minmax(0,1fr)]">
                <FormulaValueCell
                  symbol="q_G"
                  label="共通経済評価地平までの資本自立到達見込み"
                  observation={currentCapitalQ}
                />
                <EquationMark mark="×" />
                <FormulaValueCell
                  symbol="P_G"
                  label="資本自立経路全体の条件付き価値"
                  observation={currentCapitalValue}
                />
                <EquationMark mark="=" />
                <DerivedPathContribution
                  q={currentCapitalQ}
                  potential={currentCapitalValue}
                  symbol="SPS_G"
                  label="資本自立経路全体の価値寄与"
                />
              </div>
            </div>
            <div className="border-t border-[#c7d2d6] px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[9px] font-semibold tracking-[0.1em] text-[#365b70]">
                  PJ固有の計画期限に間に合う内訳
                </div>
                <Tex
                  tex={String.raw`\mathrm{SPS}_{G,\mathrm{plan},\tau}(H_v)=q_{\mathrm{plan},\tau}(H_v)P_{G,\mathrm{plan},\tau}(H_v)`}
                  className="text-[9px] text-[#365b70]"
                />
              </div>
              <div className="mt-1 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-[#c9d4d7] bg-[#c9d4d7] sm:grid-cols-[minmax(0,0.8fr)_12px_minmax(0,0.8fr)_12px_minmax(0,1fr)]">
                <FormulaValueCell
                  symbol="q_plan"
                  label="計画期限内の到達見込み"
                  observation={currentPlanQ}
                />
                <EquationMark mark="×" />
                <FormulaValueCell
                  symbol="P_G_plan"
                  label="期限内到達経路の条件付き価値"
                  observation={currentPlanValue}
                  detail="旧Pの対象を明確化。旧指数は履歴のみ。"
                />
                <EquationMark mark="=" />
                <DerivedPathContribution
                  q={currentPlanQ}
                  potential={currentPlanValue}
                  symbol="SPS_plan"
                  label="期限内資本自立経路の価値寄与"
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
                  tex={String.raw`q_{\mathrm{plan},\tau}(H_v\mid\mathbf z)=\Pr\!\bigl(T_C(\mathbf z)<T_Y(\mathbf z),\ T_C(\mathbf z)\le H_v\mid\mathbf Z_\tau=\mathbf z,\mathcal I_\tau\bigr)`}
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
              <div className="mt-1 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#c9d4d7] bg-[#c9d4d7] sm:grid-cols-4">
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
                  symbol="H_econ"
                  label="共通経済評価地平"
                  observation={currentByKey.get("H_econ")}
                />
                <FormulaValueCell
                  symbol="q_plan"
                  label="計画期限内の到達見込み"
                  observation={currentByKey.get("q")}
                />
                <FormulaValueCell
                  symbol="Q_h"
                  label="共通期間内の比較値"
                  observation={currentCommonQ}
                  detail={commonHorizonDetail(currentCommonQ)}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <QRevisionRail q={qSeries} />

      <ExtractionRuleLedger />

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
        計画到達見込みは前向き検証前のモデル出力。
        {allPathIsClosed
          ? "全経路価値は構造検査を通過しているが、前向き妥当性はまだ未確認。"
          : "全経路価値は未測定。"}
        外部の実在専門家による署名監査も未実施。現段階ではGO、NO_GO、投資額へ単独利用しない。
      </footer>
    </section>
  );
}
