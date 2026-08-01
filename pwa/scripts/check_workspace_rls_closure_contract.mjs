// Static structural contract test for scripts/migrations/213_workspace_access_security_closure.sql.
// No DB connection — the migration text itself is parsed, so the closure below can never
// silently regress (a table quietly dropped from a target group, an anon policy sneaking
// back in, a member gate replaced by the old generic auth.uid() IS NOT NULL check):
//   1. the five target groups cover exactly the 15 expected tables, no more, no fewer.
//   2. the four tables read by the external (workspace_account) server DTOs are closed here.
//   3. no policy created by 213 is readable by anon (no TO anon, no USING (true), no *anon* name).
//   4. every authenticated policy is gated by amd_os_is_member().
//   5. every group keeps a service_role path (the external DTOs read via service role).
//   6. 213 never writes ECR/SPS values — it only swaps policies.
// Run: npm run test:workspace-rls-closure

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(scriptDir, "migrations");
const srcDir = path.join(scriptDir, "..", "src");

const closureSource = readFileSync(
  path.join(migrationsDir, "213_workspace_access_security_closure.sql"),
  "utf8",
);
const foundationSource = readFileSync(
  path.join(migrationsDir, "212_workspace_access_foundation.sql"),
  "utf8",
);

/** SQL line comments legitimately name anon / auth.uid() in prose to warn against them. */
function stripSqlComments(source) {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

const closureCode = stripSqlComments(closureSource);

// --- 0. transactionality -----------------------------------------------------------------
// The whole file drops every existing policy before recreating it, so a partial run would
// leave some tables wide open and others closed. One BEGIN/COMMIT keeps that all-or-nothing.

assert.equal(
  (closureCode.match(/^\s*BEGIN;/gm) ?? []).length,
  1,
  "213 must open exactly one explicit transaction (BEGIN;)",
);
assert.equal(
  (closureCode.match(/^\s*COMMIT;/gm) ?? []).length,
  1,
  "213 must close exactly one explicit transaction (COMMIT;)",
);
const beginIndex = closureCode.search(/^\s*BEGIN;/m);
const commitIndex = closureCode.search(/^\s*COMMIT;/m);
assert.ok(beginIndex < commitIndex, "BEGIN; must come before COMMIT; in 213");

// --- 1. the five target groups, table by table -------------------------------------------

/**
 * Each executable DO $$ ... END $$ block in 213 is one target group. Blocks are sliced from
 * the transaction body only, so any commented-out example below COMMIT can never be counted.
 */
function parseGroups(source) {
  const body = source.slice(beginIndex, commitIndex);
  const blocks = [...body.matchAll(/DO \$\$([\s\S]*?)END \$\$;/g)].map((match) => match[1]);
  return blocks.map((block) => {
    // Either FOR t IN SELECT unnest(ARRAY['a','b']) or the single-table DECLARE t TEXT := 'a'.
    const arrayMatch = block.match(/unnest\(ARRAY\[([\s\S]*?)\]\)/);
    const singleMatch = block.match(/DECLARE\s+t\s+TEXT\s*:=\s*'([^']+)'/);
    let tables;
    if (arrayMatch) {
      tables = [...arrayMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
    } else {
      assert.ok(singleMatch, "every DO block in 213 must declare its target table(s) literally");
      tables = [singleMatch[1]];
    }
    const policies = [...block.matchAll(/CREATE POLICY ([\s\S]*?)(?=',\s*$|'\s*\n)/gm)].map((m) => m[1]);
    return { block, tables, policies };
  });
}

const groups = parseGroups(closureCode);

const EXPECTED_GROUPS = [
  {
    label: "1. existing 5 tables (anon shutdown)",
    tables: ["institutions", "institution_assessments", "projects", "members", "project_members"],
    memberGatedWrites: false,
    adminAll: true,
  },
  {
    label: "2. institution_projects / seed_projects",
    tables: ["institution_projects", "seed_projects"],
    memberGatedWrites: false,
    adminAll: true,
  },
  {
    label: "3. seeds family",
    tables: ["seeds", "seed_funding", "seed_news", "seed_contact_log"],
    memberGatedWrites: true,
    adminAll: false,
  },
  {
    label: "4. seed_sps_assessments (SPS)",
    tables: ["seed_sps_assessments"],
    memberGatedWrites: true,
    adminAll: false,
  },
  {
    label: "5. MS plan / progress tables",
    tables: ["value_plan_cycles", "value_milestones", "milestone_monthly_progress"],
    memberGatedWrites: false,
    adminAll: true,
  },
];

assert.equal(
  groups.length,
  EXPECTED_GROUPS.length,
  `213 must contain exactly ${EXPECTED_GROUPS.length} policy groups (found ${groups.length})`,
);

const seenTables = new Set();
for (const [index, expected] of EXPECTED_GROUPS.entries()) {
  const actual = groups[index];
  assert.deepEqual(
    actual.tables,
    expected.tables,
    `group ${expected.label} must target exactly [${expected.tables.join(", ")}] (found [${actual.tables.join(", ")}])`,
  );
  for (const table of actual.tables) {
    assert.ok(!seenTables.has(table), `table "${table}" is targeted by more than one group in 213`);
    seenTables.add(table);
  }
}

const ALL_CLOSED_TABLES = EXPECTED_GROUPS.flatMap((group) => group.tables);
assert.equal(ALL_CLOSED_TABLES.length, 15, "213 must close exactly 15 tables");
assert.equal(
  seenTables.size,
  15,
  `213 must close exactly 15 distinct tables (found ${seenTables.size})`,
);

// The header comment must state the same count, so prose and SQL cannot drift apart.
assert.ok(
  /計15テーブル/.test(closureSource),
  "213's header comment must state the current table count (計15テーブル)",
);

// --- 2. per-group policy shape -------------------------------------------------------------

const MEMBER_GATE = /(?:public\.)?amd_os_is_member\(\)/;
const ADMIN_GATE = /(?:public\.)?is_admin\(\)/;
const SERVICE_ROLE_GATE = /auth\.role\(\) = ''service_role''/;

for (const [index, expected] of EXPECTED_GROUPS.entries()) {
  const { block } = groups[index];
  const label = expected.label;

  // RLS must actually be on, otherwise the policies below are decorative.
  assert.ok(
    /ALTER TABLE public\.%I ENABLE ROW LEVEL SECURITY/.test(block),
    `group ${label} must ENABLE ROW LEVEL SECURITY on every target table`,
  );

  // Pre-existing (unknown-named) policies must be swept via pg_policies, not guessed at.
  assert.ok(
    /FROM pg_policies WHERE schemaname = 'public' AND tablename = t/.test(block)
      && /DROP POLICY IF EXISTS %I ON public\.%I/.test(block),
    `group ${label} must drop every pre-existing policy via a pg_policies scan`,
  );

  // Gated authenticated read.
  const readPolicyLine = block
    .split("\n")
    .find((line) => /CREATE POLICY [^\n]*FOR SELECT TO authenticated/.test(line));
  assert.ok(readPolicyLine, `group ${label} must create a FOR SELECT TO authenticated policy`);
  assert.ok(
    MEMBER_GATE.test(readPolicyLine),
    `group ${label}'s authenticated read must be gated by amd_os_is_member() (found "${readPolicyLine.trim()}")`,
  );

  // Service role path — the external workspace server DTOs read through it.
  assert.ok(
    SERVICE_ROLE_GATE.test(block),
    `group ${label} must keep a service_role policy (external workspace DTOs read via service role)`,
  );

  if (expected.adminAll) {
    const adminPolicyLine = block
      .split("\n")
      .find((line) => /CREATE POLICY [^\n]*FOR ALL TO public/.test(line));
    assert.ok(adminPolicyLine, `group ${label} must create an admin FOR ALL policy`);
    assert.ok(
      ADMIN_GATE.test(adminPolicyLine),
      `group ${label}'s admin policy must be gated by is_admin()`,
    );
  }

  if (expected.memberGatedWrites) {
    for (const verb of ["INSERT", "UPDATE", "DELETE"]) {
      const writePolicy = block.match(new RegExp(`CREATE POLICY [^\\n]*FOR ${verb} TO authenticated[^\\n]*`));
      assert.ok(writePolicy, `group ${label} must create a FOR ${verb} TO authenticated policy`);
      assert.ok(
        MEMBER_GATE.test(writePolicy[0]),
        `group ${label}'s ${verb} policy must be gated by amd_os_is_member()`,
      );
    }
  } else {
    // Writes go through is_admin()/service_role only — no authenticated write policy at all.
    for (const verb of ["INSERT", "UPDATE", "DELETE"]) {
      assert.ok(
        !new RegExp(`FOR ${verb} TO authenticated`).test(block),
        `group ${label} must not grant authenticated ${verb} (writes are admin/service_role only)`,
      );
    }
  }

  // Every authenticated-facing policy in the block carries the member gate — this catches a
  // future policy added to the block that forgets the gate entirely.
  for (const policyLine of block.split("\n").filter((line) => line.includes("TO authenticated"))) {
    assert.ok(
      MEMBER_GATE.test(policyLine),
      `group ${label} has an authenticated policy without an amd_os_is_member() gate: ${policyLine.trim()}`,
    );
  }
}

// --- 3. nothing anon-readable, and no fallback to the old generic auth check ---------------

assert.ok(!/TO anon/i.test(closureCode), "213 must never create a policy granted TO anon");
assert.ok(
  !/CREATE POLICY[^\n]*anon/i.test(closureCode),
  "213 must never create a policy whose name contains \"anon\"",
);
assert.ok(
  !/CREATE POLICY[^\n]*USING \(true\)/i.test(closureCode),
  "213 must never create an unconditional USING (true) policy",
);
assert.ok(
  !/auth\.uid\(\) IS NOT NULL/i.test(closureCode),
  "213 must never fall back to the generic auth.uid() IS NOT NULL check (use amd_os_is_member())",
);
assert.ok(
  !/DISABLE ROW LEVEL SECURITY/i.test(closureSource),
  "213 must never disable RLS, not even in the commented rollback section",
);

// --- 4. the external DTO source tables are closed ------------------------------------------

const EXTERNAL_DTO_SOURCE_TABLES = [
  "seed_sps_assessments",
  "value_plan_cycles",
  "value_milestones",
  "milestone_monthly_progress",
];
for (const table of EXTERNAL_DTO_SOURCE_TABLES) {
  assert.ok(
    seenTables.has(table),
    `external DTO source table "${table}" must be closed by 213`,
  );
}

// Derived check: every table the external server DTOs actually read must be covered by 213,
// by 212 (the new workspace tables, which are admin/service_role only), or be a knowingly
// deferred exception listed here. Adding a fifth source table to a DTO fails this test until
// its RLS is decided.
const foundationTables = [
  ...new Set(
    [...foundationSource.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((match) => match[1]),
  ),
];
assert.equal(foundationTables.length, 7, "212 must still create exactly 7 new workspace tables");

// Rubric/definition tables (axis names and level descriptions only — no per-institution
// scores, no PJ data). Out of scope for this change by explicit instruction; listed so the
// residual anon read stays visible instead of silently passing.
const DEFERRED_ANON_TABLES = ["institution_capability_axes", "institution_capability_criteria"];

const covered = new Set([...seenTables, ...foundationTables, ...DEFERRED_ANON_TABLES]);
for (const libFile of ["external-project-workspace.ts", "institution-workspace-data.ts", "public-workspace-data.ts"]) {
  const libSource = readFileSync(path.join(srcDir, "lib", libFile), "utf8");
  const tables = [...new Set([...libSource.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]))];
  for (const table of tables) {
    assert.ok(
      covered.has(table),
      `${libFile} reads "${table}", whose RLS is neither closed by 213, created by 212, nor listed as a known deferred exception`,
    );
  }
}

// --- 5. 213 never touches ECR/SPS values ----------------------------------------------------
// Policy DDL only. Any DML against the assessment tables, or any mention of an SPS axis
// column, would mean this migration is recalculating scores — explicitly forbidden.

for (const table of ["seed_sps_assessments", "institution_assessments"]) {
  for (const pattern of [
    new RegExp(`INSERT\\s+INTO\\s+(?:public\\.)?${table}`, "i"),
    new RegExp(`UPDATE\\s+(?:public\\.)?${table}`, "i"),
    new RegExp(`DELETE\\s+FROM\\s+(?:public\\.)?${table}`, "i"),
  ]) {
    assert.ok(
      !pattern.test(closureCode),
      `213 must never run DML against ${table} (ECR/SPS values are never combined or recalculated here)`,
    );
  }
}

const SPS_AXIS_COLUMNS = [
  "mu_a", "mu_i", "mu_g", "potential", "trl", "brl", "grl", "srl", "hrl",
  "f_character", "f_cap", "r_net", "sps_score", "ecr_score", "readiness_score",
];
for (const column of SPS_AXIS_COLUMNS) {
  assert.ok(
    !new RegExp(`\\b${column}\\b`, "i").test(closureCode),
    `213 must not reference the score column "${column}" — it only swaps policies`,
  );
}

console.log(
  `check_workspace_rls_closure_contract.mjs: OK (${EXPECTED_GROUPS.length} groups, ${seenTables.size} tables closed, ` +
    `deferred anon tables: ${DEFERRED_ANON_TABLES.join(", ")})`,
);
