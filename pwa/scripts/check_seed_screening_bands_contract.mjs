// Static structural contract test for scripts/migrations/280_seed_screening_infrastructure.sql
// and the external-workspace DTO boundary of the seed screening band tables.
// No DB connection — the migration text and DTO sources are parsed directly.
//
// Contract (BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md §2-8 / §4):
//   1. seeds.status CHECK constraint carries exactly the six design vocabulary values.
//   2. seed_status_transitions and seed_screening_bands both exist and both enable RLS.
//   3. 280 creates NO policies (no anon, no authenticated path — service_role only).
//   4. The external workspace DTO sources (institution-workspace-data.ts,
//      public-workspace-data.ts) never reference the band/transition tables.
//   5. The screening band table stays separate from seed_sps_assessments
//      (280 never touches seed_sps_assessments).
// Run: npm run test:seed-screening-bands

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(scriptDir, "migrations");
const srcDir = path.join(scriptDir, "..", "src");

const migrationSource = readFileSync(
  path.join(migrationsDir, "280_seed_screening_infrastructure.sql"),
  "utf8",
);

function stripSqlComments(source) {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

const sql = stripSqlComments(migrationSource);

// --- 1. status vocabulary ---------------------------------------------------------------
const checkMatch = sql.match(
  /ADD CONSTRAINT seeds_status_check\s+CHECK \(status IN \(([^)]+)\)\)/,
);
assert.ok(checkMatch, "280 must add seeds_status_check via ADD CONSTRAINT ... CHECK (status IN (...))");
const vocabulary = checkMatch[1]
  .split(",")
  .map((token) => token.trim().replace(/^'/, "").replace(/'$/, ""))
  .sort();
assert.deepEqual(
  vocabulary,
  ["candidate", "contacted", "declined", "discussing", "investigating", "spun_off"].sort(),
  "seeds.status vocabulary must be exactly the six design values",
);

// --- 2. both tables exist and enable RLS ------------------------------------------------
for (const table of ["seed_status_transitions", "seed_screening_bands"]) {
  assert.ok(
    new RegExp(`CREATE TABLE public\\.${table}\\b`).test(sql),
    `280 must create public.${table}`,
  );
  assert.ok(
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`).test(sql),
    `280 must enable RLS on public.${table}`,
  );
}

// --- 3. zero policies: service_role only ------------------------------------------------
assert.equal(
  (sql.match(/CREATE POLICY/g) ?? []).length,
  0,
  "280 must not create any RLS policy — with RLS enabled and zero policies, only service_role can read/write",
);
assert.ok(!/TO anon\b/.test(sql), "280 must never grant anything to anon");

// --- 4. external workspace DTOs never read the band tables ------------------------------
for (const dtoFile of ["institution-workspace-data.ts", "public-workspace-data.ts"]) {
  const dtoSource = readFileSync(path.join(srcDir, "lib", dtoFile), "utf8");
  for (const table of ["seed_screening_bands", "seed_status_transitions"]) {
    assert.ok(
      !dtoSource.includes(table),
      `${dtoFile} must not reference ${table} — screening bands are internal-only (design §2-8)`,
    );
  }
}

// --- 5. separation from seed_sps_assessments --------------------------------------------
assert.ok(
  !sql.includes("seed_sps_assessments"),
  "280 must not touch seed_sps_assessments — screening bands live in their own table",
);

// --- 6. transactionality ----------------------------------------------------------------
assert.equal((sql.match(/^\s*BEGIN;/gm) ?? []).length, 1, "280 must open exactly one transaction");
assert.equal((sql.match(/^\s*COMMIT;/gm) ?? []).length, 1, "280 must close exactly one transaction");

console.log("seed screening bands contract: all checks passed");
