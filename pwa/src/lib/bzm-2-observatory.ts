export const BZM2_PARAMETER_GROUPS = [
  "result",
  "clock",
  "state",
  "context",
  "node",
  "cash",
  "quality",
] as const;

export type Bzm2ParameterGroup = typeof BZM2_PARAMETER_GROUPS[number];

export const BZM2_VALUE_STATUSES = [
  "calculated",
  "observed",
  "conditional",
  "estimated",
  "partial",
  "missing",
  "not_started",
] as const;

export type Bzm2ValueStatus = typeof BZM2_VALUE_STATUSES[number];

export const BZM2_EVIDENCE_KINDS = [
  "calculation",
  "document",
  "record",
  "hearing",
  "assumption",
  "mixed",
  "none",
] as const;

export type Bzm2EvidenceKind = typeof BZM2_EVIDENCE_KINDS[number];

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
  score0To100: number;
  sourceMode: string | null;
};

type CoreParameterDefinition = Omit<Bzm2ParameterSeries, "current" | "history">;

export const BZM2_CORE_PARAMETERS: CoreParameterDefinition[] = [
  {
    parameterKey: "q",
    symbol: "q",
    label: "期限内到達見込み",
    group: "result",
    description: "戦略余力を失う前かつ計画期限内に共通到達目標へ着く経路の割合。",
    sortOrder: 10,
  },
  {
    parameterKey: "P",
    symbol: "P",
    label: "潜在価値ベクトル",
    group: "result",
    description: "共通到達目標に対応する社会的価値とPJ自身の経済的価値。",
    sortOrder: 20,
  },
  {
    parameterKey: "T_C",
    symbol: "T_C",
    label: "到達時間",
    group: "clock",
    description: "共通到達目標へ着くまでの経路ごとの時間。単一の平均値へ潰さない。",
    sortOrder: 30,
  },
  {
    parameterKey: "T_Y",
    symbol: "T_Y",
    label: "戦略余力の喪失時間",
    group: "clock",
    description: "次の一手を自律的に選べなくなるまでの時間。資金時計と非資金成分を分ける。",
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
  const score0To100 = asFiniteNumber(record.score_0_to_100);
  if (score0To100 === null || score0To100 < 0 || score0To100 > 100) return null;
  return {
    score0To100,
    sourceMode: typeof record.source_mode === "string" ? record.source_mode : null,
  };
}

export function readBzm2Probability(value: unknown): number | null {
  const probability = asFiniteNumber(value);
  if (probability === null || probability < 0 || probability > 1) return null;
  return probability;
}

export function deriveBzm2InitialSps(args: {
  probability: unknown;
  potential: unknown;
}): number | null {
  const probability = readBzm2Probability(args.probability);
  const potential = readBzm2InitialPotentialProjection(args.potential);
  if (probability === null || potential === null) return null;
  return probability * potential.score0To100;
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
  if (a.revisionOrder !== b.revisionOrder) return a.revisionOrder - b.revisionOrder;
  return a.createdAt.localeCompare(b.createdAt);
}

function compareObservation(a: Bzm2Observation, b: Bzm2Observation) {
  if (a.revisionOrder !== b.revisionOrder) return a.revisionOrder - b.revisionOrder;
  return a.createdAt.localeCompare(b.createdAt);
}

function asGroup(value: string): Bzm2ParameterGroup {
  return (BZM2_PARAMETER_GROUPS as readonly string[]).includes(value)
    ? value as Bzm2ParameterGroup
    : "quality";
}

function asValueStatus(value: string): Bzm2ValueStatus {
  return (BZM2_VALUE_STATUSES as readonly string[]).includes(value)
    ? value as Bzm2ValueStatus
    : "missing";
}

function asEvidenceKind(value: string): Bzm2EvidenceKind {
  return (BZM2_EVIDENCE_KINDS as readonly string[]).includes(value)
    ? value as Bzm2EvidenceKind
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

function mapObservation(row: Bzm2ObservationRow, revision: Bzm2Revision): Bzm2Observation {
  const affects = Array.isArray(row.affects)
    ? row.affects.filter((value): value is string => typeof value === "string")
    : [];
  const condition = row.condition_json && typeof row.condition_json === "object" && !Array.isArray(row.condition_json)
    ? row.condition_json as Record<string, unknown>
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
  const revisions = (args.revisionRows ?? []).map(mapRevision).sort(compareRevision);
  const revisionById = new Map(revisions.map((revision) => [revision.revisionId, revision]));
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

  const definitions = new Map(BZM2_CORE_PARAMETERS.map((definition) => [definition.parameterKey, definition]));
  for (const observation of observations) {
    definitions.set(observation.parameterKey, {
      parameterKey: observation.parameterKey,
      symbol: observation.symbol,
      label: observation.label,
      group: observation.group,
      description: observation.note ?? "版ごとに値と出所を追跡するBZM 2.0パラメータ。",
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
    .sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ja"));

  return {
    projectId: args.projectId,
    storageState: args.storageState ?? "ready",
    storageMessage: args.storageMessage ?? null,
    currentRevision: revisions[revisions.length - 1] ?? null,
    revisions,
    parameters,
  };
}
