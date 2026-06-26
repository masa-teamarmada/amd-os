#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadCalculatorInternals() {
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
  const appended = `${output}\nmodule.exports.__test = { scoreFinance, scoreDirection };\n`;
  new Function("require", "module", "exports", appended)(require, mod, mod.exports);
  return mod.exports.__test;
}

const { scoreFinance, scoreDirection } = loadCalculatorInternals();

const ctx = {
  projectNames: new Map(),
  memberNames: new Map(),
  previousAxisScore: {
    initiative: null,
    finance: null,
    retention: null,
    pipeline: null,
    direction: null,
  },
};

function row(patch) {
  return {
    id: patch.id || "r1",
    ym: "202606",
    axis: patch.axis,
    source_kind: patch.source_kind,
    source_table: patch.source_table,
    source_id: patch.source_id || patch.id || "source",
    signal_key: patch.signal_key,
    signal_value_numeric: patch.signal_value_numeric ?? null,
    signal_value_text: patch.signal_value_text ?? null,
    project_id: patch.project_id ?? null,
    observed_at: patch.observed_at ?? null,
    confidence: patch.confidence ?? 0.7,
    weight_hint: patch.weight_hint ?? 1,
    payload: patch.payload ?? {},
    source_hash: patch.source_hash || `${patch.id || "r1"}-hash`,
  };
}

function budgetActualRow({ id, category = "revenue", budget, actual, actualPayload }) {
  return row({
    id,
    axis: "finance",
    source_kind: "budget_actual_view",
    source_table: "company_budget_actual_monthly",
    source_id: `company:${category}:${id}`,
    signal_key: `budget_actual:${category}`,
    signal_value_numeric: actual - budget,
    confidence: actualPayload == null ? 0.55 : 0.85,
    weight_hint: Math.abs(actual - budget),
    payload: {
      scope: "company",
      project_id: null,
      category,
      budget_amount_yen: budget,
      actual_amount_yen: actual,
      variance_yen: actual - budget,
      budget_version: "test",
      budget_payload: { source: "fixture" },
      actual_payload: actualPayload,
    },
  });
}

const missingActual = scoreFinance([
  budgetActualRow({ id: "missing-revenue", budget: 1_000_000, actual: 0, actualPayload: null }),
], ctx);

assert.equal(missingActual.inputs.actualDataMissingCategories, 1);
assert.ok(
  missingActual.evidence.some((ev) =>
    ev.evidence_kind === "finance_data_missing"
    && ev.impact === 0
    && /未同期/.test(ev.summary)
  )
);
assert.ok(
  !missingActual.evidence.some((ev) =>
    ev.evidence_kind === "budget_variance"
    && /実績 0円|実績 0/.test(ev.summary)
  )
);

const confirmedZeroActual = scoreFinance([
  budgetActualRow({ id: "confirmed-zero-revenue", budget: 1_000_000, actual: 0, actualPayload: { source: "freee", amount: 0 } }),
], ctx);

const zeroActualVariance = confirmedZeroActual.evidence.find((ev) =>
  ev.evidence_kind === "budget_variance"
  && /実績 0円|実績 0/.test(ev.summary)
);
assert.ok(zeroActualVariance, "confirmed actual 0 must stay visible as a budget variance");
assert.ok(zeroActualVariance.impact < 0, "confirmed actual 0 must remain an adverse finance signal");
assert.equal(zeroActualVariance.payload.actual_data_state, "actual_synced");
assert.equal(confirmedZeroActual.inputs.actualDataMissingCategories, 0);

const direction = scoreDirection([
  row({
    id: "funding",
    axis: "direction",
    source_kind: "funding_aggregate",
    source_table: "project_strategy_signals",
    signal_key: "direction:fund_setup_count",
    signal_value_numeric: 0,
  }),
  row({
    id: "partners",
    axis: "direction",
    source_kind: "partner_growth",
    source_table: "project_partners",
    signal_key: "direction:research_partner_count",
    signal_value_numeric: 5,
  }),
  row({
    id: "os-missing",
    axis: "direction",
    source_kind: "direction_data_missing",
    source_table: "amd_os_installations",
    signal_key: "direction:amd_os_install_count:data_missing",
    signal_value_numeric: null,
    signal_value_text: "amd_os_installations テーブル未作成 (= data_missing)",
    confidence: 0.2,
    weight_hint: 0,
    payload: {
      data_state: "data_missing",
      missing_source: "amd_os_installations",
      score_eligible: false,
    },
  }),
  row({
    id: "monetization",
    axis: "direction",
    source_kind: "monetization_aggregate",
    source_table: "project_strategy_signals",
    signal_key: "direction:monetization_decided_count",
    signal_value_numeric: 0,
  }),
  row({
    id: "non-masa",
    axis: "direction",
    source_kind: "non_masa_initiative",
    source_table: "member_activities",
    signal_key: "direction:non_masa_initiative",
    signal_value_numeric: 0,
  }),
  row({
    id: "graduation",
    axis: "direction",
    source_kind: "graduation",
    source_table: "project_ventures",
    signal_key: "direction:success_graduation_count",
    signal_value_numeric: 0,
  }),
], ctx);

assert.equal(direction.inputs.availableWeight, 0.75);
assert.deepEqual(direction.inputs.dataMissingSources, ["amd_os_installations"]);
assert.equal(Math.round(direction.score), 20);
assert.ok(direction.confidence < 0.65);
assert.ok(
  direction.evidence.some((ev) =>
    ev.evidence_kind === "data_missing"
    && ev.source_type === "amd_os_installations"
    && ev.impact === 0
  )
);
assert.ok(
  !direction.evidence.some((ev) =>
    ev.source_type === "amd_os_installations"
    && ev.impact < 0
  )
);

console.log("management score missing-data logic ok");
