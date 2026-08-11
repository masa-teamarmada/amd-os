export const BZM2_PARAMETER_GROUPS = [
  "result",
  "clock",
  "state",
  "context",
  "node",
  "cash",
  "quality",
] as const;

export type Bzm2ParameterGroup = (typeof BZM2_PARAMETER_GROUPS)[number];

export const BZM2_VALUE_STATUSES = [
  "calculated",
  "observed",
  "conditional",
  "estimated",
  "partial",
  "missing",
  "not_started",
] as const;

export type Bzm2ValueStatus = (typeof BZM2_VALUE_STATUSES)[number];

export const BZM2_EVIDENCE_KINDS = [
  "calculation",
  "document",
  "record",
  "hearing",
  "assumption",
  "mixed",
  "none",
] as const;

export type Bzm2EvidenceKind = (typeof BZM2_EVIDENCE_KINDS)[number];

export type Bzm2Revision = {
  revisionId: string;
  revisionKey: string;
  revisionOrder: number;
  theoryVersion: string;
  modelVersion: string;
  measurementStatus: string;
  informationCutoff: string;
  forwardValidationCount: number;
  revisionReason: string;
  sourceRef: string;
  createdAt: string;
};

export type Bzm2Observation = {
  observationId: string;
  revisionId: string;
  revisionKey: string;
  revisionOrder: number;
  informationCutoff: string;
  parameterKey: string;
  symbol: string;
  label: string;
  group: Bzm2ParameterGroup;
  value: unknown;
  displayValue: string;
  valueStatus: Bzm2ValueStatus;
  unit: string | null;
  evidenceKind: Bzm2EvidenceKind;
  evidenceRef: string | null;
  affects: string[];
  condition: Record<string, unknown>;
  note: string | null;
  sortOrder: number;
  createdAt: string;
};

export type Bzm2ParameterSeries = {
  parameterKey: string;
  symbol: string;
  label: string;
  group: Bzm2ParameterGroup;
  description: string;
  sortOrder: number;
  current: Bzm2Observation | null;
  history: Bzm2Observation[];
};

export type Bzm2Observatory = {
  projectId: string;
  storageState: "ready" | "unavailable";
  storageMessage: string | null;
  currentRevision: Bzm2Revision | null;
  revisions: Bzm2Revision[];
  parameters: Bzm2ParameterSeries[];
};

export type Bzm2InitialPotentialProjection = {
  value: number;
  sourceMode: string | null;
};

export const BZM2_POTENTIAL_EVIDENCE_STATUSES = [
  "observed",
  "proxy",
  "imputed",
] as const;

export type Bzm2PotentialEvidenceStatus =
  (typeof BZM2_POTENTIAL_EVIDENCE_STATUSES)[number];

export type Bzm2PotentialAxis = {
  key: string;
  label: string;
  value: number;
  evidenceStatus: Bzm2PotentialEvidenceStatus;
  evidenceRef: string;
  note: string;
};

export type Bzm2PotentialComponent = {
  key: "V_soc" | "V_econ";
  label: string;
  value: number;
  scale: "index_0_100";
  axes: Bzm2PotentialAxis[];
};

export type Bzm2PotentialVector = {
  schema: "bzm2-potential-vector-v0.1";
  components: {
    V_soc: Bzm2PotentialComponent;
    V_econ: Bzm2PotentialComponent;
  };
  scalarProjection: null;
  conditionalOn: string;
  imputationRule: string;
};

export type Bzm2EquityValue = {
  schema: "bzm2-equity-value-v0.1" | "bzm2-path-equity-value-v0.2";
  valueMillionJpy: number;
  valuationDate: string;
  method: string;
  conditionalOn: string;
  currency: "JPY";
  outcomeKey: string | null;
  horizonKey: string | null;
  horizonMonths: number | null;
  horizonDate: string | null;
  informationCutoff: string | null;
};

export const BZM2_ALL_PATH_OUTCOME_KEYS = [
  "self_sufficiency_plan",
  "self_sufficiency_late",
  "m_and_a",
  "license",
  "ip_sale",
  "pivot",
  "abandon",
  "liquidation",
  "unresolved_continuation",
] as const;

export type Bzm2AllPathOutcomeKey =
  (typeof BZM2_ALL_PATH_OUTCOME_KEYS)[number];

export type Bzm2AllPathOutcome = {
  outcomeKey: Bzm2AllPathOutcomeKey;
  probability: number;
  conditionalValueMillionJpy: number | null;
  contributionMillionJpy: number;
};

export type Bzm2AllPathValue = {
  schema: "bzm2-all-path-value-v0.2";
  valueMillionJpy: number;
  valuationDate: string;
  informationCutoff: string;
  currency: "JPY";
  pricingRoute: "FCFF_WACC" | "FCFE_Ke" | "SDF" | "RISK_NEUTRAL";
  economicHorizonMonths: number;
  economicHorizonDate: string;
  partitionDefinitionRef: string;
  simulationHistoryCount: number;
  outcomes: Bzm2AllPathOutcome[];
};

type CoreParameterDefinition = Omit<Bzm2ParameterSeries, "current" | "history">;

export const BZM2_CORE_PARAMETERS: CoreParameterDefinition[] = [
  {
    parameterKey: "q",
    symbol: "q_plan",
    label: "計画期限内の資本自立到達見込み",
    group: "result",
    description:
      "戦略余力を失う前かつPJ固有の計画期限内に資本自立へ着く経路の割合。会社全体の成功確率ではない。",
    sortOrder: 10,
  },
  {
    parameterKey: "P",
    symbol: "P_G_plan",
    label: "計画期限内の資本自立経路価値",
    group: "result",
    description:
      "計画期限内に資本自立へ着く経路へ条件づけた、評価時点の既存全持分証券に対応するモデル上の総持分価値。単位は円。",
    sortOrder: 20,
  },
  {
    parameterKey: "Q_h",
    symbol: "Q_h",
    label: "共通期間内の資本自立到達見込み",
    group: "result",
    description:
      "全PJで同じ期間hを使い、戦略余力を失う前に資本自立へ着く累積確率。PJ間比較にはこちらを使う。",
    sortOrder: 21,
  },
  {
    parameterKey: "q_G",
    symbol: "q_G",
    label: "共通経済評価地平までの資本自立到達見込み",
    group: "result",
    description:
      "PJ固有の計画期限を条件にせず、共通経済評価地平までの期限後到達を含む資本自立経路全体の確率。",
    sortOrder: 22,
  },
  {
    parameterKey: "P_G",
    symbol: "P_G",
    label: "資本自立経路全体の条件付き価値",
    group: "result",
    description:
      "共通経済評価地平までの資本自立経路全体へ条件づけた、評価時点のモデル上の総持分価値。",
    sortOrder: 23,
  },
  {
    parameterKey: "SPS_all",
    symbol: "SPS_all",
    label: "全価値実現経路のモデル価値",
    group: "result",
    description:
      "計画期限内の資本自立、計画期限後の資本自立、M&A、ライセンス、知財売却、ピボット、撤退、清算、継続中を相互排他的に分けた経路価値の総和。",
    sortOrder: 24,
  },
  {
    parameterKey: "O",
    symbol: "O",
    label: "価値実現経路の分割",
    group: "result",
    description:
      "全経路を重複も漏れもない結果集合へ分ける台帳。分割が閉じるまで全経路価値は計算しない。",
    sortOrder: 25,
  },
  {
    parameterKey: "T_C",
    symbol: "T_C",
    label: "到達時間",
    group: "clock",
    description:
      "共通到達目標へ着くまでの経路ごとの時間。単一の平均値へ潰さない。",
    sortOrder: 30,
  },
  {
    parameterKey: "T_Y",
    symbol: "T_Y",
    label: "戦略余力の喪失時間",
    group: "clock",
    description:
      "次の一手を自律的に選べなくなるまでの時間。資金時計と非資金成分を分ける。",
    sortOrder: 40,
  },
  {
    parameterKey: "H_v",
    symbol: "H_v",
    label: "計画上の期限",
    group: "clock",
    description: "計画版ごとの判定期限。資金の崖とは別の場所で判定する。",
    sortOrder: 50,
  },
  {
    parameterKey: "H_econ",
    symbol: "H_econ",
    label: "共通経済評価地平",
    group: "clock",
    description:
      "全PJで共通に置く価値評価の期限。未決着経路はこの時点で継続中へ分類する。",
    sortOrder: 60,
  },
];

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * P^(0) is deliberately separate from the unmeasured BZM 2.0 value vector.
 * It gives the screen a reproducible initial numeric baseline without claiming
 * that social value and conditional DCF have already been measured.
 */
export function readBzm2InitialPotentialProjection(
  value: unknown,
): Bzm2InitialPotentialProjection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const initialValue = asFiniteNumber(
    record.initial_value ?? record.source_score_0_to_9,
  );
  if (initialValue === null || initialValue < 0 || initialValue > 9)
    return null;
  return {
    value: initialValue,
    sourceMode:
      typeof record.source_mode === "string" ? record.source_mode : null,
  };
}

function readPotentialAxis(value: unknown): Bzm2PotentialAxis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const axisValue = asFiniteNumber(record.value);
  const evidenceStatus = record.evidence_status;
  if (
    typeof record.key !== "string" ||
    typeof record.label !== "string" ||
    axisValue === null ||
    axisValue < 0 ||
    axisValue > 20 ||
    typeof evidenceStatus !== "string" ||
    !(BZM2_POTENTIAL_EVIDENCE_STATUSES as readonly string[]).includes(
      evidenceStatus,
    )
  ) {
    return null;
  }
  return {
    key: record.key,
    label: record.label,
    value: axisValue,
    evidenceStatus: evidenceStatus as Bzm2PotentialEvidenceStatus,
    evidenceRef:
      typeof record.evidence_ref === "string" ? record.evidence_ref : "未登録",
    note: typeof record.note === "string" ? record.note : "注記なし",
  };
}

function readPotentialComponent(
  value: unknown,
  key: Bzm2PotentialComponent["key"],
): Bzm2PotentialComponent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const componentValue = asFiniteNumber(record.value);
  const axes = Array.isArray(record.axes)
    ? record.axes
        .map(readPotentialAxis)
        .filter((axis): axis is Bzm2PotentialAxis => axis !== null)
    : [];
  if (
    record.key !== key ||
    typeof record.label !== "string" ||
    record.scale !== "index_0_100" ||
    componentValue === null ||
    componentValue < 0 ||
    componentValue > 100 ||
    axes.length !== 5 ||
    Math.abs(axes.reduce((sum, axis) => sum + axis.value, 0) - componentValue) >
      1e-9
  ) {
    return null;
  }
  return {
    key,
    label: record.label,
    value: componentValue,
    scale: "index_0_100",
    axes,
  };
}

export function readBzm2PotentialVector(
  value: unknown,
): Bzm2PotentialVector | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.schema !== "bzm2-potential-vector-v0.1" ||
    !record.components ||
    typeof record.components !== "object" ||
    Array.isArray(record.components)
  ) {
    return null;
  }
  const components = record.components as Record<string, unknown>;
  const V_soc = readPotentialComponent(components.V_soc, "V_soc");
  const V_econ = readPotentialComponent(components.V_econ, "V_econ");
  if (!V_soc || !V_econ || record.scalar_projection !== null) return null;
  return {
    schema: "bzm2-potential-vector-v0.1",
    components: { V_soc, V_econ },
    scalarProjection: null,
    conditionalOn:
      typeof record.conditional_on === "string"
        ? record.conditional_on
        : "未登録",
    imputationRule:
      typeof record.imputation_rule === "string"
        ? record.imputation_rule
        : "未登録",
  };
}

export function readBzm2Probability(value: unknown): number | null {
  const probability = asFiniteNumber(value);
  if (probability === null || probability < 0 || probability > 1) return null;
  return probability;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

function isIsoInformationCutoff(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Date.parse(value))
  );
}

function addMonthsToIsoDate(value: string, months: number): string | null {
  if (!isIsoDate(value) || !Number.isInteger(months) || months < 0) return null;
  const [year, month, day] = value.split("-").map(Number);
  const firstOfTargetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = firstOfTargetMonth.getUTCFullYear();
  const targetMonth = firstOfTargetMonth.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function informationCutoffDate(value: string): string | null {
  const date = value.slice(0, 10);
  return isIsoDate(date) ? date : null;
}

export function bzm2ObservationInformationCutoff(
  observation: Bzm2Observation,
): string | null {
  if ("effective_information_cutoff" in observation.condition) {
    const effective = observation.condition.effective_information_cutoff;
    return isIsoInformationCutoff(effective) ? effective : null;
  }
  return isIsoInformationCutoff(observation.informationCutoff)
    ? observation.informationCutoff
    : null;
}

export function readBzm2EquityValue(value: unknown): Bzm2EquityValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const valueMillionJpy = asFiniteNumber(record.value_million_jpy);
  const horizonMonths = asFiniteNumber(record.horizon_months);
  if (
    (record.schema !== "bzm2-equity-value-v0.1" &&
      record.schema !== "bzm2-path-equity-value-v0.2") ||
    valueMillionJpy === null ||
    valueMillionJpy < 0 ||
    !isIsoDate(record.valuation_date) ||
    typeof record.method !== "string" ||
    typeof record.conditional_on !== "string" ||
    record.currency !== "JPY"
  ) {
    return null;
  }
  return {
    schema: record.schema,
    valueMillionJpy,
    valuationDate: record.valuation_date,
    method: record.method,
    conditionalOn: record.conditional_on,
    currency: "JPY",
    outcomeKey:
      typeof record.outcome_key === "string" ? record.outcome_key : null,
    horizonKey:
      typeof record.horizon_key === "string" ? record.horizon_key : null,
    horizonMonths:
      horizonMonths !== null &&
      Number.isInteger(horizonMonths) &&
      horizonMonths > 0
        ? horizonMonths
        : null,
    horizonDate: isIsoDate(record.horizon_date) ? record.horizon_date : null,
    informationCutoff:
      typeof record.information_cutoff === "string"
        ? record.information_cutoff
        : null,
  };
}

function readBzm2AllPathOutcome(value: unknown): Bzm2AllPathOutcome | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const outcomeKey = record.outcome_key;
  const probability = asFiniteNumber(record.probability);
  const conditionalValue =
    record.conditional_value_million_jpy === null
      ? null
      : asFiniteNumber(record.conditional_value_million_jpy);
  const contribution = asFiniteNumber(record.contribution_million_jpy);
  if (
    typeof outcomeKey !== "string" ||
    !(BZM2_ALL_PATH_OUTCOME_KEYS as readonly string[]).includes(outcomeKey) ||
    probability === null ||
    probability < 0 ||
    probability > 1 ||
    contribution === null ||
    contribution < 0 ||
    (probability > 0 &&
      (conditionalValue === null || conditionalValue < 0)) ||
    (probability === 0 &&
      conditionalValue !== null &&
      conditionalValue < 0)
  ) {
    return null;
  }
  const expectedContribution =
    probability === 0 ? 0 : probability * (conditionalValue ?? 0);
  if (Math.abs(contribution - expectedContribution) > 1e-6) return null;
  return {
    outcomeKey: outcomeKey as Bzm2AllPathOutcomeKey,
    probability,
    conditionalValueMillionJpy: conditionalValue,
    contributionMillionJpy: contribution,
  };
}

export function readBzm2AllPathValue(
  value: unknown,
): Bzm2AllPathValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const valueMillionJpy = asFiniteNumber(record.value_million_jpy);
  const simulationHistoryCount = asFiniteNumber(
    record.simulation_history_count,
  );
  const economicHorizonMonths = asFiniteNumber(
    record.economic_horizon_months,
  );
  const outcomes = Array.isArray(record.outcomes)
    ? record.outcomes
        .map(readBzm2AllPathOutcome)
        .filter((outcome): outcome is Bzm2AllPathOutcome => outcome !== null)
    : [];
  const pricingRoute = record.pricing_route;
  if (
    record.schema !== "bzm2-all-path-value-v0.2" ||
    valueMillionJpy === null ||
    valueMillionJpy < 0 ||
    !isIsoDate(record.valuation_date) ||
    !isIsoInformationCutoff(record.information_cutoff) ||
    record.currency !== "JPY" ||
    (pricingRoute !== "FCFF_WACC" &&
      pricingRoute !== "FCFE_Ke" &&
      pricingRoute !== "SDF" &&
      pricingRoute !== "RISK_NEUTRAL") ||
    economicHorizonMonths === null ||
    !Number.isInteger(economicHorizonMonths) ||
    economicHorizonMonths <= 0 ||
    !isIsoDate(record.economic_horizon_date) ||
    record.economic_horizon_date < record.valuation_date ||
    addMonthsToIsoDate(
      informationCutoffDate(record.information_cutoff) ?? "",
      economicHorizonMonths,
    ) !== record.economic_horizon_date ||
    typeof record.partition_definition_ref !== "string" ||
    record.partition_definition_ref.trim() === "" ||
    simulationHistoryCount === null ||
    !Number.isInteger(simulationHistoryCount) ||
    simulationHistoryCount <= 0 ||
    record.unassigned_history_count !== 0 ||
    record.multiply_assigned_history_count !== 0 ||
    outcomes.length !== BZM2_ALL_PATH_OUTCOME_KEYS.length
  ) {
    return null;
  }
  const outcomeKeys = outcomes.map((outcome) => outcome.outcomeKey);
  if (
    new Set(outcomeKeys).size !== BZM2_ALL_PATH_OUTCOME_KEYS.length ||
    BZM2_ALL_PATH_OUTCOME_KEYS.some((key) => !outcomeKeys.includes(key))
  ) {
    return null;
  }
  const probabilitySum = outcomes.reduce(
    (sum, outcome) => sum + outcome.probability,
    0,
  );
  const contributionSum = outcomes.reduce(
    (sum, outcome) => sum + outcome.contributionMillionJpy,
    0,
  );
  if (
    Math.abs(probabilitySum - 1) > 1e-9 ||
    Math.abs(contributionSum - valueMillionJpy) > 1e-6
  ) {
    return null;
  }
  return {
    schema: "bzm2-all-path-value-v0.2",
    valueMillionJpy,
    valuationDate: record.valuation_date,
    informationCutoff: record.information_cutoff,
    currency: "JPY",
    pricingRoute,
    economicHorizonMonths,
    economicHorizonDate: record.economic_horizon_date,
    partitionDefinitionRef: record.partition_definition_ref,
    simulationHistoryCount,
    outcomes,
  };
}

export function readBzm2CommonHorizonProbability(
  observation: Bzm2Observation | null | undefined,
): {
  probability: number;
  horizonMonths: number;
  economicHorizonMonths: number;
  economicHorizonDate: string;
  valuationDate: string;
} | null {
  if (!observation || observation.parameterKey !== "Q_h") return null;
  const probability = readBzm2Probability(observation.value);
  const horizonMonths = asFiniteNumber(observation.condition.horizon_months);
  const economicHorizonMonths = asFiniteNumber(
    observation.condition.economic_horizon_months,
  );
  const economicHorizonDate = observation.condition.economic_horizon_date;
  const valuationDate = observation.condition.valuation_date;
  const effectiveCutoff = bzm2ObservationInformationCutoff(observation);
  const cutoffDate = effectiveCutoff
    ? informationCutoffDate(effectiveCutoff)
    : null;
  const comparisonEnd = cutoffDate
    ? addMonthsToIsoDate(cutoffDate, horizonMonths ?? -1)
    : null;
  const expectedEconomicHorizonDate = cutoffDate
    ? addMonthsToIsoDate(cutoffDate, economicHorizonMonths ?? -1)
    : null;
  if (
    probability === null ||
    horizonMonths === null ||
    !Number.isInteger(horizonMonths) ||
    horizonMonths <= 0 ||
    economicHorizonMonths === null ||
    !Number.isInteger(economicHorizonMonths) ||
    economicHorizonMonths <= 0 ||
    horizonMonths > economicHorizonMonths ||
    !isIsoDate(economicHorizonDate) ||
    !isIsoDate(valuationDate) ||
    effectiveCutoff === null ||
    comparisonEnd === null ||
    expectedEconomicHorizonDate !== economicHorizonDate ||
    comparisonEnd > economicHorizonDate
  ) {
    return null;
  }
  return {
    probability,
    horizonMonths,
    economicHorizonMonths,
    economicHorizonDate,
    valuationDate,
  };
}

export function deriveBzm2PathContribution(args: {
  probability: Bzm2Observation | null | undefined;
  potential: Bzm2Observation | null | undefined;
}): number | null {
  if (!args.probability || !args.potential) return null;
  const probability = readBzm2Probability(args.probability.value);
  const potential = readBzm2EquityValue(args.potential.value);
  if (probability === null || potential === null) return null;
  const probabilityEvent = args.probability.condition.event_key;
  const valueEvent = args.potential.condition.event_key;
  const probabilityHorizon = args.probability.condition.horizon_key;
  const valueHorizon = args.potential.condition.horizon_key;
  const probabilityValuationDate = args.probability.condition.valuation_date;
  const valueValuationDate = args.potential.condition.valuation_date;
  const probabilityEconomicHorizonMonths =
    args.probability.condition.economic_horizon_months;
  const valueEconomicHorizonMonths =
    args.potential.condition.economic_horizon_months;
  const probabilityEconomicHorizonDate =
    args.probability.condition.economic_horizon_date;
  const valueEconomicHorizonDate =
    args.potential.condition.economic_horizon_date;
  const probabilityCutoff = bzm2ObservationInformationCutoff(args.probability);
  const valueCutoff = bzm2ObservationInformationCutoff(args.potential);
  const isPlanPair =
    args.probability.parameterKey === "q" &&
    args.potential.parameterKey === "P" &&
    probabilityEvent === "G_self_plan" &&
    probabilityHorizon === "H_v";
  const isAllCapitalPair =
    args.probability.parameterKey === "q_G" &&
    args.potential.parameterKey === "P_G" &&
    probabilityEvent === "G_self_all" &&
    probabilityHorizon === "H_econ";
  if (
    (!isPlanPair && !isAllCapitalPair) ||
    args.probability.revisionId !== args.potential.revisionId ||
    probabilityCutoff === null ||
    probabilityCutoff !== valueCutoff ||
    typeof probabilityEvent !== "string" ||
    probabilityEvent !== valueEvent ||
    typeof probabilityHorizon !== "string" ||
    probabilityHorizon !== valueHorizon ||
    potential.schema !== "bzm2-path-equity-value-v0.2" ||
    potential.outcomeKey !== probabilityEvent ||
    potential.horizonKey !== probabilityHorizon ||
    potential.informationCutoff !== probabilityCutoff ||
    potential.conditionalOn !== probabilityEvent ||
    (isAllCapitalPair &&
      (typeof probabilityEconomicHorizonMonths !== "number" ||
        !Number.isInteger(probabilityEconomicHorizonMonths) ||
        probabilityEconomicHorizonMonths <= 0 ||
        probabilityEconomicHorizonMonths !== valueEconomicHorizonMonths ||
        potential.horizonMonths !== probabilityEconomicHorizonMonths ||
        !isIsoDate(probabilityEconomicHorizonDate) ||
        probabilityEconomicHorizonDate !== valueEconomicHorizonDate ||
        potential.horizonDate !== probabilityEconomicHorizonDate)) ||
    !isIsoDate(probabilityValuationDate) ||
    probabilityValuationDate !== valueValuationDate ||
    potential.valuationDate !== probabilityValuationDate
  ) {
    return null;
  }
  return probability * potential.valueMillionJpy;
}

export function isClosedBzm2AllPathValue(
  observation: Bzm2Observation | null | undefined,
): observation is Bzm2Observation {
  if (!observation || observation.parameterKey !== "SPS_all") return false;
  const value = readBzm2AllPathValue(observation.value);
  const effectiveCutoff = bzm2ObservationInformationCutoff(observation);
  return Boolean(
    value &&
      effectiveCutoff !== null &&
      value.informationCutoff === effectiveCutoff &&
      value.valuationDate === observation.condition.valuation_date &&
      value.economicHorizonMonths ===
        observation.condition.economic_horizon_months &&
      value.economicHorizonDate ===
        observation.condition.economic_horizon_date &&
      value.pricingRoute === observation.condition.pricing_route,
  );
}

const GROUP_ORDER: Record<Bzm2ParameterGroup, number> = {
  result: 0,
  clock: 1,
  state: 2,
  context: 3,
  node: 4,
  cash: 5,
  quality: 6,
};

function compareRevision(a: Bzm2Revision, b: Bzm2Revision) {
  if (a.revisionOrder !== b.revisionOrder)
    return a.revisionOrder - b.revisionOrder;
  return a.createdAt.localeCompare(b.createdAt);
}

function compareObservation(a: Bzm2Observation, b: Bzm2Observation) {
  if (a.revisionOrder !== b.revisionOrder)
    return a.revisionOrder - b.revisionOrder;
  return a.createdAt.localeCompare(b.createdAt);
}

function asGroup(value: string): Bzm2ParameterGroup {
  return (BZM2_PARAMETER_GROUPS as readonly string[]).includes(value)
    ? (value as Bzm2ParameterGroup)
    : "quality";
}

function asValueStatus(value: string): Bzm2ValueStatus {
  return (BZM2_VALUE_STATUSES as readonly string[]).includes(value)
    ? (value as Bzm2ValueStatus)
    : "missing";
}

function asEvidenceKind(value: string): Bzm2EvidenceKind {
  return (BZM2_EVIDENCE_KINDS as readonly string[]).includes(value)
    ? (value as Bzm2EvidenceKind)
    : "none";
}

export type Bzm2RevisionRow = {
  revision_id: string;
  revision_key: string;
  revision_order: number;
  theory_version: string;
  model_version: string;
  measurement_status: string;
  information_cutoff: string;
  forward_validation_count: number;
  revision_reason: string;
  source_ref: string;
  created_at: string;
};

export type Bzm2ObservationRow = {
  observation_id: string;
  revision_id: string;
  parameter_key: string;
  symbol: string;
  label: string;
  parameter_group: string;
  value_json: unknown;
  display_value: string;
  value_status: string;
  unit: string | null;
  evidence_kind: string;
  evidence_ref: string | null;
  affects: unknown;
  condition_json: unknown;
  note: string | null;
  sort_order: number;
  created_at: string;
};

function mapRevision(row: Bzm2RevisionRow): Bzm2Revision {
  return {
    revisionId: row.revision_id,
    revisionKey: row.revision_key,
    revisionOrder: row.revision_order,
    theoryVersion: row.theory_version,
    modelVersion: row.model_version,
    measurementStatus: row.measurement_status,
    informationCutoff: row.information_cutoff,
    forwardValidationCount: row.forward_validation_count,
    revisionReason: row.revision_reason,
    sourceRef: row.source_ref,
    createdAt: row.created_at,
  };
}

function mapObservation(
  row: Bzm2ObservationRow,
  revision: Bzm2Revision,
): Bzm2Observation {
  const affects = Array.isArray(row.affects)
    ? row.affects.filter((value): value is string => typeof value === "string")
    : [];
  const condition =
    row.condition_json &&
    typeof row.condition_json === "object" &&
    !Array.isArray(row.condition_json)
      ? (row.condition_json as Record<string, unknown>)
      : {};
  return {
    observationId: row.observation_id,
    revisionId: row.revision_id,
    revisionKey: revision.revisionKey,
    revisionOrder: revision.revisionOrder,
    informationCutoff: revision.informationCutoff,
    parameterKey: row.parameter_key,
    symbol: row.symbol,
    label: row.label,
    group: asGroup(row.parameter_group),
    value: row.value_json,
    displayValue: row.display_value,
    valueStatus: asValueStatus(row.value_status),
    unit: row.unit,
    evidenceKind: asEvidenceKind(row.evidence_kind),
    evidenceRef: row.evidence_ref,
    affects,
    condition,
    note: row.note,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export function buildBzm2Observatory(args: {
  projectId: string;
  revisionRows?: Bzm2RevisionRow[];
  observationRows?: Bzm2ObservationRow[];
  storageState?: Bzm2Observatory["storageState"];
  storageMessage?: string | null;
}): Bzm2Observatory {
  const revisions = (args.revisionRows ?? [])
    .map(mapRevision)
    .sort(compareRevision);
  const revisionById = new Map(
    revisions.map((revision) => [revision.revisionId, revision]),
  );
  const observations = (args.observationRows ?? [])
    .map((row) => {
      const revision = revisionById.get(row.revision_id);
      return revision ? mapObservation(row, revision) : null;
    })
    .filter((value): value is Bzm2Observation => value !== null)
    .sort(compareObservation);

  const historyByKey = new Map<string, Bzm2Observation[]>();
  for (const observation of observations) {
    const history = historyByKey.get(observation.parameterKey) ?? [];
    history.push(observation);
    historyByKey.set(observation.parameterKey, history);
  }

  const definitions = new Map(
    BZM2_CORE_PARAMETERS.map((definition) => [
      definition.parameterKey,
      definition,
    ]),
  );
  for (const observation of observations) {
    if (definitions.has(observation.parameterKey)) continue;
    definitions.set(observation.parameterKey, {
      parameterKey: observation.parameterKey,
      symbol: observation.symbol,
      label: observation.label,
      group: observation.group,
      description:
        observation.note ?? "版ごとに値と出所を追跡するBZM 2.0パラメータ。",
      sortOrder: observation.sortOrder,
    });
  }

  const parameters = [...definitions.values()]
    .map((definition): Bzm2ParameterSeries => {
      const history = historyByKey.get(definition.parameterKey) ?? [];
      return {
        ...definition,
        current: history[history.length - 1] ?? null,
        history,
      };
    })
    .sort(
      (a, b) =>
        GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
        a.sortOrder - b.sortOrder ||
        a.label.localeCompare(b.label, "ja"),
    );

  return {
    projectId: args.projectId,
    storageState: args.storageState ?? "ready",
    storageMessage: args.storageMessage ?? null,
    currentRevision: revisions[revisions.length - 1] ?? null,
    revisions,
    parameters,
  };
}
