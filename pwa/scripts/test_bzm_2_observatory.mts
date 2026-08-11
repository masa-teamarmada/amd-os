import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BZM2_ALL_PATH_OUTCOME_KEYS,
  BZM2_CORE_PARAMETERS,
  buildBzm2Observatory,
  deriveBzm2PathContribution,
  isClosedBzm2AllPathValue,
  readBzm2AllPathValue,
  readBzm2CommonHorizonProbability,
  readBzm2EquityValue,
  readBzm2InitialPotentialProjection,
  readBzm2Probability,
  type Bzm2Observation,
  type Bzm2ObservationRow,
  type Bzm2RevisionRow,
} from "../src/lib/bzm-2-observatory.ts";

const TARGET_PROJECTS = [
  "p03",
  "p04",
  "p06",
  "p07",
  "p09",
  "p11",
  "p18",
  "p20",
  "p21",
  "p24",
  "p26",
  "p29",
] as const;

const NEW_MISSING_PARAMETERS = [
  "Q_h",
  "q_G",
  "P_G",
  "SPS_all",
  "O",
  "H_econ",
] as const;

const migrationSql = readFileSync(
  new URL(
    "./migrations/259_bzm_2_multidisciplinary_audit_correction.sql",
    import.meta.url,
  ),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };

const revisions: Bzm2RevisionRow[] = [
  {
    revision_id: "r1",
    revision_key: "v0.1",
    revision_order: 1,
    theory_version: "theory-fixed v1.0",
    model_version: "model-v0.1",
    measurement_status: "measured_hypothesis",
    information_cutoff: "2026-08-01T00:00:00+09:00",
    forward_validation_count: 0,
    revision_reason: "first",
    source_ref: "first.json",
    created_at: "2026-08-01T00:00:00Z",
  },
  {
    revision_id: "r2",
    revision_key: "v0.2",
    revision_order: 2,
    theory_version: "theory-fixed v1.1",
    model_version: "model-v0.2",
    measurement_status: "measured_hypothesis",
    information_cutoff: "2026-08-02T00:00:00+09:00",
    forward_validation_count: 0,
    revision_reason: "second",
    source_ref: "second.json",
    created_at: "2026-08-02T00:00:00Z",
  },
];

function observation(
  overrides: Partial<Bzm2ObservationRow> &
    Pick<
      Bzm2ObservationRow,
      "observation_id" | "revision_id" | "parameter_key"
    >,
): Bzm2ObservationRow {
  return {
    symbol: overrides.parameter_key,
    label: overrides.parameter_key,
    parameter_group: "result",
    value_json: 0.1,
    display_value: "0.1",
    value_status: "calculated",
    unit: "probability",
    evidence_kind: "calculation",
    evidence_ref: "result.json",
    affects: [],
    condition_json: {},
    note: null,
    sort_order: 10,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const observations: Bzm2ObservationRow[] = [
  observation({
    observation_id: "o1",
    revision_id: "r1",
    parameter_key: "q",
    value_json: 0.1,
    display_value: "0.1",
  }),
  observation({
    observation_id: "o2",
    revision_id: "r2",
    parameter_key: "q",
    value_json: 0.2,
    display_value: "0.2",
    condition_json: {
      event_key: "G_self_plan",
      horizon_key: "H_v",
      effective_information_cutoff: "2026-08-02T00:00:00+09:00",
      valuation_date: "2026-08-02",
    },
    created_at: "2026-08-02T00:00:00Z",
  }),
  observation({
    observation_id: "o5",
    revision_id: "r2",
    parameter_key: "P",
    symbol: "P_G_plan",
    label: "計画期限内の資本自立経路価値",
    value_json: {
      schema: "bzm2-path-equity-value-v0.2",
      value_million_jpy: 12_000,
      valuation_date: "2026-08-02",
      method: "conditional FCFE",
      conditional_on: "G_self_plan",
      currency: "JPY",
      outcome_key: "G_self_plan",
      horizon_key: "H_v",
      information_cutoff: "2026-08-02T00:00:00+09:00",
    },
    display_value: "120億円",
    value_status: "estimated",
    unit: "million JPY",
    evidence_kind: "mixed",
    evidence_ref: "valuation.json",
    condition_json: {
      event_key: "G_self_plan",
      horizon_key: "H_v",
      effective_information_cutoff: "2026-08-02T00:00:00+09:00",
      valuation_date: "2026-08-02",
      valuation_date_must_match_probability: true,
    },
    sort_order: 20,
    created_at: "2026-08-02T00:00:00Z",
  }),
  observation({
    observation_id: "o4",
    revision_id: "r2",
    parameter_key: "context.lifecycle",
    symbol: "status_PJ",
    label: "PJの現行状態",
    parameter_group: "context",
    value_json: { status: "active" },
    display_value: "Active",
    value_status: "observed",
    evidence_kind: "record",
    evidence_ref: "projects",
    sort_order: 70,
    created_at: "2026-08-02T00:00:00Z",
  }),
  observation({
    observation_id: "o3",
    revision_id: "r2",
    parameter_key: "Z_policy",
    symbol: "Z_policy",
    label: "政策支援状態",
    parameter_group: "state",
    value_json: "present",
    display_value: "present",
    value_status: "conditional",
    evidence_kind: "hearing",
    evidence_ref: "preregistration.md",
    affects: ["#2", "#6", "q"],
    condition_json: { conditioned_inputs: { "#2": 0.9, "#6": 0.6 } },
    note: "独立加点しない",
    sort_order: 60,
    created_at: "2026-08-02T00:00:00Z",
  }),
];

const model = buildBzm2Observatory({
  projectId: "p07",
  revisionRows: revisions,
  observationRows: observations,
});
assert.equal(model.currentRevision?.revisionKey, "v0.2");
assert.equal(model.currentRevision?.forwardValidationCount, 0);

const q = model.parameters.find((parameter) => parameter.parameterKey === "q");
assert.equal(q?.current?.displayValue, "0.2");
assert.equal(q?.symbol, "q_plan");
assert.ok(q?.current);
assert.deepEqual(
  q?.history.map((item) => item.revisionKey),
  ["v0.1", "v0.2"],
);

const policy = model.parameters.find(
  (parameter) => parameter.parameterKey === "Z_policy",
);
assert.equal(policy?.current?.displayValue, "present");
assert.deepEqual(policy?.current?.affects, ["#2", "#6", "q"]);

const lifecycle = model.parameters.find(
  (parameter) => parameter.parameterKey === "context.lifecycle",
);
assert.equal(lifecycle?.group, "context");
assert.equal(lifecycle?.current?.displayValue, "Active");

const p = model.parameters.find((parameter) => parameter.parameterKey === "P");
assert.ok(p, "core parameter P must stay visible without an observation");
assert.equal(p?.current?.displayValue, "120億円");
assert.equal(p?.symbol, "P_G_plan");
assert.ok(p.current);

const empty = buildBzm2Observatory({
  projectId: "p00",
  storageState: "unavailable",
  storageMessage: "missing table",
});
assert.equal(empty.parameters.length, BZM2_CORE_PARAMETERS.length);
assert.ok(empty.parameters.every((parameter) => parameter.current === null));
assert.ok(
  empty.parameters.some(
    (parameter) =>
      parameter.parameterKey === "H_econ" && parameter.current === null,
  ),
);
assert.equal(empty.storageState, "unavailable");

const p0 = readBzm2InitialPotentialProjection({
  initial_value: 8,
  source_mode: "legacy_prs_potential",
});
assert.deepEqual(p0, { value: 8, sourceMode: "legacy_prs_potential" });
assert.equal(readBzm2InitialPotentialProjection({ initial_value: 10 }), null);
assert.equal(readBzm2Probability(0.0415), 0.0415);
assert.equal(readBzm2Probability(1.01), null);
const equityValue = readBzm2EquityValue({
  schema: "bzm2-path-equity-value-v0.2",
  value_million_jpy: 12_000,
  valuation_date: "2026-08-11",
  method: "conditional DCF",
  conditional_on: "G_self_plan",
  currency: "JPY",
  outcome_key: "G_self_plan",
  horizon_key: "H_v",
  information_cutoff: "2026-08-02T00:00:00+09:00",
});
assert.equal(equityValue?.valueMillionJpy, 12_000);
assert.equal(
  deriveBzm2PathContribution({
    probability: q?.current,
    potential: p?.current,
  }),
  2_400,
);
const allCapitalProbability: Bzm2Observation = {
  ...q.current,
  observationId: "o-q-g",
  parameterKey: "q_G",
  symbol: "q_G",
  label: "期限を問わない資本自立到達見込み",
  value: 0.3,
  displayValue: "0.3",
  condition: {
    ...q.current.condition,
    event_key: "G_self_all",
    horizon_key: "H_econ",
    economic_horizon_months: 120,
    economic_horizon_date: "2036-08-02",
    valuation_date: "2026-08-02",
  },
};
const allCapitalPotential: Bzm2Observation = {
  ...p.current,
  observationId: "o-p-g",
  parameterKey: "P_G",
  symbol: "P_G",
  label: "資本自立経路全体の条件付き価値",
  value: {
    schema: "bzm2-path-equity-value-v0.2",
    value_million_jpy: 12_000,
    valuation_date: "2026-08-02",
    method: "conditional FCFE",
    conditional_on: "G_self_all",
    currency: "JPY",
      outcome_key: "G_self_all",
      horizon_key: "H_econ",
      horizon_months: 120,
      horizon_date: "2036-08-02",
      information_cutoff: "2026-08-02T00:00:00+09:00",
  },
  condition: {
    ...p.current.condition,
    event_key: "G_self_all",
    horizon_key: "H_econ",
    economic_horizon_months: 120,
    economic_horizon_date: "2036-08-02",
    valuation_date: "2026-08-02",
  },
};
assert.equal(
  deriveBzm2PathContribution({
    probability: allCapitalProbability,
    potential: allCapitalPotential,
  }),
  3_600,
);
assert.equal(
  deriveBzm2PathContribution({
    probability: {
      ...allCapitalProbability,
      condition: {
        ...allCapitalProbability.condition,
        horizon_key: "no_plan_deadline",
      },
    },
    potential: allCapitalPotential,
  }),
  null,
  "q_G and P_G must use H_econ",
);
assert.equal(
  deriveBzm2PathContribution({
    probability: {
      ...allCapitalProbability,
      condition: {
        ...allCapitalProbability.condition,
        economic_horizon_months: 119,
      },
    },
    potential: allCapitalPotential,
  }),
  null,
  "q_G and P_G must use the same common elapsed H_econ",
);
assert.equal(isClosedBzm2AllPathValue(null), false);

const commonHorizonObservation: Bzm2Observation = {
  ...q.current,
  observationId: "o-q-h",
  parameterKey: "Q_h",
  symbol: "Q_h",
  label: "共通期間内の資本自立到達見込み",
  value: 0.25,
  displayValue: "0.25",
  condition: {
    event_key: "G_self_common_horizon",
    horizon_key: "common_h",
    horizon_months: 60,
    economic_horizon_months: 120,
    economic_horizon_date: "2036-08-02",
    valuation_date: "2026-08-02",
    information_cutoff: q.current.informationCutoff,
  },
};
assert.deepEqual(readBzm2CommonHorizonProbability(commonHorizonObservation), {
  probability: 0.25,
  horizonMonths: 60,
  economicHorizonMonths: 120,
  economicHorizonDate: "2036-08-02",
  valuationDate: "2026-08-02",
});
assert.equal(
  readBzm2CommonHorizonProbability({
    ...commonHorizonObservation,
    condition: {
      ...commonHorizonObservation.condition,
      horizon_months: null,
    },
  }),
  null,
  "Q(h) must not become numeric before h is fixed",
);
assert.equal(
  readBzm2CommonHorizonProbability({
    ...commonHorizonObservation,
    condition: {
      ...commonHorizonObservation.condition,
      horizon_months: 121,
    },
  }),
  null,
  "Q(h) must stay inside the common economic horizon",
);
assert.equal(
  readBzm2CommonHorizonProbability({
    ...commonHorizonObservation,
    condition: {
      ...commonHorizonObservation.condition,
      economic_horizon_date: "2036-08-03",
    },
  }),
  null,
  "the corresponding H_econ date must be derived from the information cutoff",
);

assert.deepEqual(BZM2_ALL_PATH_OUTCOME_KEYS, [
  "self_sufficiency_plan",
  "self_sufficiency_late",
  "m_and_a",
  "license",
  "ip_sale",
  "pivot",
  "abandon",
  "liquidation",
  "unresolved_continuation",
]);
const allPathValueInput = {
  schema: "bzm2-all-path-value-v0.2",
  value_million_jpy: 900,
  valuation_date: "2026-08-02",
  information_cutoff: q.current.informationCutoff,
  currency: "JPY",
  pricing_route: "FCFE_Ke",
  economic_horizon_months: 120,
  economic_horizon_date: "2036-08-02",
  partition_definition_ref: "audit-partition-v0.1",
  simulation_history_count: 90,
  unassigned_history_count: 0,
  multiply_assigned_history_count: 0,
  outcomes: BZM2_ALL_PATH_OUTCOME_KEYS.map((outcomeKey) => ({
    outcome_key: outcomeKey,
    probability: 1 / BZM2_ALL_PATH_OUTCOME_KEYS.length,
    conditional_value_million_jpy: 900,
    contribution_million_jpy: 100,
  })),
};
const allPathValue = readBzm2AllPathValue(allPathValueInput);
assert.equal(allPathValue?.outcomes.length, 9);
assert.equal(allPathValue?.valueMillionJpy, 900);
assert.equal(allPathValue?.economicHorizonMonths, 120);
assert.equal(allPathValue?.economicHorizonDate, "2036-08-02");
assert.equal(
  readBzm2AllPathValue({
    ...allPathValueInput,
    economic_horizon_months: null,
  }),
  null,
  "the all-path value must include the common elapsed economic horizon",
);
assert.equal(
  readBzm2AllPathValue({
    ...allPathValueInput,
    outcomes: allPathValueInput.outcomes.slice(0, -1),
  }),
  null,
  "the all-path value must reject an incomplete outcome partition",
);
assert.equal(
  readBzm2AllPathValue({
    ...allPathValueInput,
    outcomes: [
      ...allPathValueInput.outcomes.slice(0, -1),
      allPathValueInput.outcomes[0],
    ],
  }),
  null,
  "the all-path value must reject a duplicated outcome key",
);
assert.equal(
  readBzm2AllPathValue({
    ...allPathValueInput,
    outcomes: allPathValueInput.outcomes.map((outcome, index) =>
      index === 0
        ? {
            ...outcome,
            probability: 0.2,
            contribution_million_jpy: 180,
          }
        : outcome,
    ),
  }),
  null,
  "the all-path value must reject probabilities that do not sum to one",
);
assert.equal(
  readBzm2AllPathValue({
    ...allPathValueInput,
    outcomes: allPathValueInput.outcomes.map((outcome, index) =>
      index === 0
        ? { ...outcome, contribution_million_jpy: 99 }
        : outcome,
    ),
  }),
  null,
  "the all-path value must recompute every q times P contribution",
);
assert.equal(
  readBzm2AllPathValue({
    ...allPathValueInput,
    unassigned_history_count: 1,
  }),
  null,
  "the all-path value must reject unassigned simulation histories",
);
assert.equal(
  isClosedBzm2AllPathValue({
    ...q.current,
    observationId: "o-sps-all",
    parameterKey: "SPS_all",
    symbol: "SPS_all",
    label: "全価値実現経路のモデル価値",
    value: allPathValueInput,
    displayValue: "9億円",
    unit: "million JPY",
    condition: {
      ...q.current.condition,
      valuation_date: "2026-08-02",
      economic_horizon_months: 120,
      economic_horizon_date: "2036-08-02",
      pricing_route: "FCFE_Ke",
    },
  }),
  true,
);
assert.equal(
  isClosedBzm2AllPathValue({
    ...q.current,
    observationId: "o-sps-all-horizon-mismatch",
    parameterKey: "SPS_all",
    symbol: "SPS_all",
    label: "全価値実現経路のモデル価値",
    value: allPathValueInput,
    displayValue: "9億円",
    unit: "million JPY",
    condition: {
      ...q.current.condition,
      valuation_date: "2026-08-02",
      economic_horizon_months: 120,
      economic_horizon_date: "2035-08-02",
      pricing_route: "FCFE_Ke",
    },
  }),
  false,
  "the stored H_econ must match the value payload",
);

assert.equal(
  deriveBzm2PathContribution({
    probability: {
      ...q.current,
      condition: {
        ...q.current.condition,
        effective_information_cutoff: "2026-08-01T00:00:00+09:00",
      },
    },
    potential: p.current,
  }),
  null,
  "a copied probability must not be multiplied across information cutoffs",
);

const projectScopeMatches = [
  ...migrationSql.matchAll(
    /ARRAY\[\s*((?:'p\d{2}'[\s,]*)+)\]::text\[\]/g,
  ),
  ...migrationSql.matchAll(
    /project_id IN \(\s*((?:'p\d{2}'[\s,]*)+)\)/g,
  ),
];
assert.equal(projectScopeMatches.length, 5);
for (const projectScopeMatch of projectScopeMatches) {
  assert.deepEqual(
    [...projectScopeMatch[1].matchAll(/'(p\d{2})'/g)].map(
      (match) => match[1],
    ),
    TARGET_PROJECTS,
  );
}

assert.equal(
  (
    migrationSql.match(
      /source_revisions\.information_cutoff AS effective_information_cutoff/g,
    ) ?? []
  ).length,
  2,
);
assert.match(
  migrationSql,
  /'effective_information_cutoff', q_sources\.effective_information_cutoff/,
);
assert.match(
  migrationSql,
  /'effective_information_cutoff', p_sources\.effective_information_cutoff/,
);
assert.equal(
  (migrationSql.match(/'valuation_date', NULL/g) ?? []).length,
  3,
  "Q(h), q and q_G must start without a fabricated valuation date",
);

const missingSeedSql = migrationSql.match(
  /\), missing_seed\([\s\S]*?\) AS \(\s*VALUES([\s\S]*?)\n\)\nINSERT INTO public\.bzm_2_parameter_observations/,
)?.[1];
assert.ok(missingSeedSql);
for (const parameterKey of NEW_MISSING_PARAMETERS) {
  assert.match(missingSeedSql, new RegExp(`\\n\\s*'${parameterKey}',`));
}
assert.match(missingSeedSql, /'Q_h'[\s\S]*?'horizon_months', NULL/);
assert.match(missingSeedSql, /'horizon_months_required', true/);
assert.match(
  missingSeedSql,
  /'Q_h'[\s\S]*?'economic_horizon_months', NULL[\s\S]*?'economic_horizon_date', NULL/,
);
assert.match(missingSeedSql, /'q_G'[\s\S]*?'horizon_key', 'H_econ'/);
assert.match(missingSeedSql, /'P_G'[\s\S]*?'horizon_key', 'H_econ'/);
assert.match(
  missingSeedSql,
  /'H_econ'[\s\S]*?'horizon_months', NULL[\s\S]*?'corresponding_date', NULL/,
);
assert.match(missingSeedSql, /'same_elapsed_months_across_projects', true/);
assert.match(migrationSql, /^BEGIN;$/m);
assert.match(migrationSql, /^COMMIT;$/m);
assert.match(migrationSql, /'bzm2-all-path-value-v0\.2'/);
assert.match(
  migrationSql,
  /Copied q\/P must not change source values or evidence for project %/,
);
assert.match(
  migrationSql,
  /SELECT\s+target_revisions\.revision_id,[\s\S]*?NULL::jsonb,[\s\S]*?'none',[\s\S]*?FROM target_revisions\s+CROSS JOIN missing_seed/,
  "all new parameters must be seeded with NULL value_json and no evidence",
);
const requiredPathsSql = missingSeedSql.match(
  /'required_paths', jsonb_build_array\(([\s\S]*?)\)\s*,\s*'economic_horizon_key'/,
)?.[1];
assert.ok(requiredPathsSql);
assert.deepEqual(
  [...requiredPathsSql.matchAll(/'([^']+)'/g)].map((match) => match[1]),
  BZM2_ALL_PATH_OUTCOME_KEYS,
);
assert.equal(
  packageJson.scripts?.["test:bzm-2-observatory"],
  "node --experimental-strip-types scripts/test_bzm_2_observatory.mts",
);

console.log("BZM 2.0 observatory contract: OK");
