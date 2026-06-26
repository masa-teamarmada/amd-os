#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadCalculatorModule() {
  const sourcePath = path.join(process.cwd(), "src/lib/management-score/calculate.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", output)(require, mod, mod.exports);
  return mod.exports;
}

function rawSignal(overrides) {
  return {
    id: overrides.id || "raw-1",
    ym: "202606",
    axis: overrides.axis || "initiative",
    source_kind: overrides.source_kind || "os_internal",
    source_table: overrides.source_table || "member_activities",
    source_id: overrides.source_id || overrides.id || "source-1",
    signal_key: overrides.signal_key || "initiative_origin:unknown",
    signal_value_numeric: overrides.signal_value_numeric ?? 1,
    signal_value_text: overrides.signal_value_text ?? null,
    project_id: overrides.project_id ?? "p01",
    observed_at: overrides.observed_at ?? "2026-06-10T00:00:00.000Z",
    confidence: overrides.confidence ?? 0.7,
    weight_hint: overrides.weight_hint ?? 1,
    payload: overrides.payload || {},
    source_hash: overrides.source_hash || `${overrides.id || "raw-1"}-hash`,
  };
}

const { __managementScoreTestHooks } = loadCalculatorModule();
const ctx = {
  projectNames: new Map([["p01", "KUTE"]]),
  memberNames: new Map([["ID001", "まさ"]]),
  previousAxisScore: {
    initiative: null,
    finance: null,
    retention: null,
    pipeline: null,
    direction: null,
  },
};

const unknownHeavyInitiativeRows = [
  ...Array.from({ length: 8 }, (_, index) => rawSignal({
    id: `unknown-${index}`,
    signal_key: "initiative_origin:unknown",
    payload: { member_id: "ID001", initiative_origin: "unknown", impact: 3, depth: 1, title: `unknown ${index}` },
  })),
  ...Array.from({ length: 2 }, (_, index) => rawSignal({
    id: `amd-${index}`,
    signal_key: "initiative_origin:amd_proposed",
    payload: { member_id: "ID001", initiative_origin: "amd_proposed", impact: 3, depth: 1, title: `amd ${index}` },
  })),
];
const unknownHeavy = __managementScoreTestHooks.scoreInitiative(unknownHeavyInitiativeRows, ctx);
assert.equal(unknownHeavy.inputs.totalEvents, 10);
assert.equal(unknownHeavy.inputs.unknownCount, 8);
assert.equal(unknownHeavy.inputs.classifiedEvents, 2);
assert.equal(unknownHeavy.inputs.scoreSource, "current_unclassified");
assert.equal(unknownHeavy.score, 100, `unknown-heavy initiative should not be score-capped, got ${unknownHeavy.score}`);
assert.ok(unknownHeavy.confidence < 0.6, `unknown-heavy confidence should drop, got ${unknownHeavy.confidence}`);

const carryForwardCtx = {
  ...ctx,
  previousAxisScore: {
    ...ctx.previousAxisScore,
    initiative: 96,
  },
};
const unknownCarryForward = __managementScoreTestHooks.scoreInitiative(unknownHeavyInitiativeRows, carryForwardCtx);
assert.equal(unknownCarryForward.score, 96);
assert.equal(unknownCarryForward.inputs.scoreSource, "previous_carry_forward");
assert.ok(unknownCarryForward.confidence < 0.6, `carried initiative confidence should stay low, got ${unknownCarryForward.confidence}`);

const unconfirmedModifier = __managementScoreTestHooks.computeInitiativeModifier(80, 0.35, {
  classifiedEvents: 2,
  passiveEvents: 1,
});
assert.equal(unconfirmedModifier.modifier, 1);
assert.equal(unconfirmedModifier.zone, "unconfirmed");

const confirmedCrisisModifier = __managementScoreTestHooks.computeInitiativeModifier(80, 0.75, {
  classifiedEvents: 10,
  passiveEvents: 2,
});
assert.equal(confirmedCrisisModifier.modifier, 0.3);
assert.equal(confirmedCrisisModifier.zone, "critical");

const duplicatePipelineRows = [
  rawSignal({
    id: "sig-a",
    axis: "pipeline",
    source_kind: "commercial_progress",
    source_table: "project_strategy_signals",
    source_id: "sig-a",
    signal_key: "commercial:high_confidence",
    signal_value_text: "KUTE 受託ミッション",
    project_id: "p01",
    confidence: 0.8,
    weight_hint: 3,
    payload: {
      project_id: "p01",
      pipeline_status: "high_confidence",
      pipeline_probability: 0.95,
      expected_contract_ym: "202606",
      expected_amount_yen: 1000000,
      title: "KUTE 受託ミッション",
    },
  }),
  rawSignal({
    id: "sig-b",
    axis: "pipeline",
    source_kind: "commercial_progress",
    source_table: "project_strategy_signals",
    source_id: "sig-b",
    signal_key: "commercial:high_confidence",
    signal_value_text: "KUTE 受託ミッション follow-up",
    project_id: "p01",
    confidence: 0.9,
    weight_hint: 3,
    payload: {
      project_id: "p01",
      pipeline_status: "high_confidence",
      pipeline_probability: 0.95,
      expected_contract_ym: "202606",
      expected_amount_yen: 1000000,
      title: "KUTE 受託ミッション follow-up",
    },
  }),
];
const dedupedPipeline = __managementScoreTestHooks.scorePipeline(duplicatePipelineRows, ctx);
const commercialEvidence = dedupedPipeline.evidence.filter((row) => row.evidence_kind === "commercial_progress");
assert.equal(dedupedPipeline.inputs.rawCommercialSignals, 2);
assert.equal(dedupedPipeline.inputs.commercials, 1);
assert.equal(dedupedPipeline.inputs.duplicateCommercialSignals, 1);
assert.equal(commercialEvidence.length, 1);
assert.equal(commercialEvidence[0].payload.raw_signal_count, 2);
assert.deepEqual(commercialEvidence[0].payload.merged_source_ids.sort(), ["sig-a", "sig-b"]);

console.log("management score P0/P2 guards ok");
