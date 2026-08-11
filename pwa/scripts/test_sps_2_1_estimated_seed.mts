import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PWA_DIR = path.resolve(SCRIPT_DIR, "..");
const GENERATOR = path.join(SCRIPT_DIR, "generate_sps_2_1_estimated_seed.mts");
const MIGRATION = path.join(SCRIPT_DIR, "migrations/263_sps_2_1_estimated_v0_1.sql");
const ARTIFACT = path.resolve(
  SCRIPT_DIR,
  "../bzm/pilot/sps-2-1-estimated-v0-1.json",
);
const PROJECT_IDS = [
  "p03", "p04", "p06", "p07", "p09", "p11",
  "p18", "p20", "p21", "p24", "p26", "p29",
] as const;

const generatedCheck = spawnSync(
  process.execPath,
  ["--experimental-strip-types", GENERATOR, "--check"],
  { cwd: PWA_DIR, encoding: "utf8" },
);
assert.equal(
  generatedCheck.status,
  0,
  `seed generator --check failed:\n${generatedCheck.stderr}\n${generatedCheck.stdout}`,
);
const report = JSON.parse(generatedCheck.stdout) as {
  status: string;
  projects: number;
  revisionInputsPerProject: number;
  optionalRevisionInputsPerProject: number;
  stateInputsPerState: number;
  actionInputsPerAction: number;
  transitionInputsPerTransition: number;
  rowsPerProject: Record<string, number>;
  perspectiveIndependentActionQRowsPerProject: number;
  canonicalInputHashes: Record<string, string>;
  migrationSha256: string;
};
assert.equal(report.status, "verified");
assert.equal(report.projects, 12);
assert.equal(report.revisionInputsPerProject, 27);
assert.equal(report.optionalRevisionInputsPerProject, 2);
assert.equal(report.stateInputsPerState, 8);
assert.equal(report.actionInputsPerAction, 11);
assert.equal(report.transitionInputsPerTransition, 5);
assert.deepEqual(report.rowsPerProject, {
  states: 1,
  actions: 2,
  transitions: 3,
  cashflows: 13,
  inputs: 74,
  actionEvaluations: 6,
  policyEvaluations: 6,
});
assert.equal(report.perspectiveIndependentActionQRowsPerProject, 6);
assert.deepEqual(Object.keys(report.canonicalInputHashes), [...PROJECT_IDS]);
for (const hash of Object.values(report.canonicalInputHashes)) {
  assert.match(hash, /^[0-9a-f]{64}$/);
}
assert.match(report.migrationSha256, /^[0-9a-f]{64}$/);

const [migration, artifactText] = await Promise.all([
  readFile(MIGRATION, "utf8"),
  readFile(ARTIFACT, "utf8"),
]);
const artifact = JSON.parse(artifactText) as {
  contentHashSha256: string;
  projects: Array<{
    projectId: string;
    estimationRatio: number;
    sensitivity: { selectedActionSwitches: boolean };
    outputs: {
      expectedFutureNetProjectValueMillionJpy: number;
      qSelectedPolicy: number;
    };
  }>;
};
assert.deepEqual(artifact.projects.map((project) => project.projectId), [...PROJECT_IDS]);
assert.ok(migration.includes(`Artifact content hash: ${artifact.contentHashSha256}`));

assert.match(migration, /^-- 263_sps_2_1_estimated_v0_1\.sql/m);
assert.equal((migration.match(/^BEGIN;$/gm) ?? []).length, 1);
assert.equal((migration.match(/^COMMIT;$/gm) ?? []).length, 1);
assert.equal(
  (migration.match(/^UPDATE public\.sps_primary_model_registry AS registry$/gm) ?? []).length,
  1,
  "primary switch must be one set-based UPDATE",
);
assert.ok(
  migration.indexOf("INSERT INTO public.bzm_2_1_policy_evaluations") <
    migration.indexOf("UPDATE public.sps_primary_model_registry AS registry"),
  "primary switch must occur after all persisted evaluations",
);

for (const table of [
  "bzm_2_1_model_revisions",
  "bzm_2_1_decision_states",
  "bzm_2_1_actions",
  "bzm_2_1_transitions",
  "bzm_2_1_input_observations",
  "bzm_2_1_cashflow_events",
  "bzm_2_1_action_evaluations",
  "bzm_2_1_policy_evaluations",
]) {
  assert.equal(
    (migration.match(new RegExp(`INSERT INTO public\\.${table} \\(`, "g")) ?? []).length,
    1,
    `${table}: exactly one generated bulk insert`,
  );
}

assert.doesNotMatch(
  migration,
  /(?:UPDATE|DELETE\s+FROM)\s+public\.(?:amd_score_inputs|amd_score_revisions|amd_score_alpha|amd_score_alpha_proposals|bzm_2_model_revisions|bzm_2_parameter_observations)\b/i,
  "legacy source tables must remain immutable",
);
assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE\s+TABLE/i);
assert.ok(migration.includes("12 legacy archives are not complete and hash/count valid"));
assert.ok(migration.includes("27/8/11/5 input coverage is incomplete"));
assert.ok(migration.includes("estimation_ratio_numeric_parameters"));
assert.ok(migration.includes("sensitivity_action_switch"));
assert.ok(migration.includes("canonical input hash mismatch"));
assert.ok(migration.includes("company/BZSF/public evaluation contract is incomplete"));
assert.ok(migration.includes("primary switch was not atomic for all 12 projects"));
assert.ok(migration.includes("p.objective_kind IN ('bzsf', 'public')"));
assert.ok(migration.includes("p.evaluation_status = 'not_computable'"));
assert.ok(migration.includes("p.goal_probability IS NOT NULL"));
assert.ok(migration.includes("ae.goal_probability IS NOT NULL"));
assert.ok(migration.includes("p.selected_action_by_state_json <> '{}'::jsonb"));
assert.doesNotMatch(
  migration,
  /\bjsonb_object_length\s*\(/,
  "production Postgres does not provide jsonb_object_length",
);

for (const project of artifact.projects) {
  assert.ok(migration.includes(`'${project.projectId}'`), `${project.projectId}: project scope`);
  assert.ok(
    migration.includes(String(project.outputs.expectedFutureNetProjectValueMillionJpy)),
    `${project.projectId}: expected company value is frozen in postflight manifest`,
  );
  assert.ok(
    migration.includes(String(project.outputs.qSelectedPolicy)),
    `${project.projectId}: selected-policy q is frozen in postflight manifest`,
  );
  assert.ok(
    migration.includes(report.canonicalInputHashes[project.projectId]),
    `${project.projectId}: canonical hash is frozen in postflight manifest`,
  );
  assert.ok(
    migration.includes(String(project.estimationRatio)),
    `${project.projectId}: estimation ratio is persisted`,
  );
}

process.stdout.write(
  JSON.stringify(
    {
      status: "ok",
      projects: PROJECT_IDS.length,
      generatorCheck: report.status,
      migrationSha256: report.migrationSha256,
      legacyMutationCount: 0,
      atomicRegistryUpdateCount: 1,
      canonicalInputHashes: report.canonicalInputHashes,
    },
    null,
    2,
  ) + "\n",
);
