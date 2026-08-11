import assert from "node:assert/strict";
import {
  buildBzm2Observatory,
  deriveBzm2InitialSps,
  readBzm2InitialPotentialProjection,
  readBzm2Probability,
  type Bzm2ObservationRow,
  type Bzm2RevisionRow,
} from "../src/lib/bzm-2-observatory.ts";

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

function observation(overrides: Partial<Bzm2ObservationRow> & Pick<Bzm2ObservationRow, "observation_id" | "revision_id" | "parameter_key">): Bzm2ObservationRow {
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
  observation({ observation_id: "o1", revision_id: "r1", parameter_key: "q", value_json: 0.1, display_value: "0.1" }),
  observation({ observation_id: "o2", revision_id: "r2", parameter_key: "q", value_json: 0.2, display_value: "0.2", created_at: "2026-08-02T00:00:00Z" }),
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

const model = buildBzm2Observatory({ projectId: "p07", revisionRows: revisions, observationRows: observations });
assert.equal(model.currentRevision?.revisionKey, "v0.2");
assert.equal(model.currentRevision?.forwardValidationCount, 0);

const q = model.parameters.find((parameter) => parameter.parameterKey === "q");
assert.equal(q?.current?.displayValue, "0.2");
assert.deepEqual(q?.history.map((item) => item.revisionKey), ["v0.1", "v0.2"]);

const policy = model.parameters.find((parameter) => parameter.parameterKey === "Z_policy");
assert.equal(policy?.current?.displayValue, "present");
assert.deepEqual(policy?.current?.affects, ["#2", "#6", "q"]);

const lifecycle = model.parameters.find((parameter) => parameter.parameterKey === "context.lifecycle");
assert.equal(lifecycle?.group, "context");
assert.equal(lifecycle?.current?.displayValue, "Active");

const p = model.parameters.find((parameter) => parameter.parameterKey === "P");
assert.ok(p, "core parameter P must stay visible without an observation");
assert.equal(p?.current, null);

const empty = buildBzm2Observatory({ projectId: "p00", storageState: "unavailable", storageMessage: "missing table" });
assert.equal(empty.parameters.length, 5);
assert.ok(empty.parameters.every((parameter) => parameter.current === null));
assert.equal(empty.storageState, "unavailable");

const p0 = readBzm2InitialPotentialProjection({
  score_0_to_100: 88.9,
  source_mode: "legacy_prs_potential",
});
assert.deepEqual(p0, { score0To100: 88.9, sourceMode: "legacy_prs_potential" });
assert.equal(readBzm2InitialPotentialProjection({ score_0_to_100: 101 }), null);
assert.equal(readBzm2Probability(0.0415), 0.0415);
assert.equal(readBzm2Probability(1.01), null);
assert.ok(
  Math.abs(
    (deriveBzm2InitialSps({
      probability: 0.0415,
      potential: { score_0_to_100: 88.9, source_mode: "legacy_prs_potential" },
    }) ?? Number.NaN) - 3.68935,
  ) < 1e-10,
);

console.log("BZM 2.0 observatory contract: OK");
