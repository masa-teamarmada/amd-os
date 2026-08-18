import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, nav, seedsDesign, institutionDesign] = await Promise.all([
  readFile(new URL("./migrations/288_ehm_sawazaki_nep_and_project_activation.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/supabase-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../design/seeds.md", import.meta.url), "utf8"),
  readFile(new URL("../design/institution_seed_project_model.md", import.meta.url), "utf8"),
]);

assert.match(migration, /NEDO NEP 開拓コース/);
assert.match(migration, /status = 'awarded'/);
assert.match(migration, /採択年度・金額・実施期間は未確認/);
assert.match(migration, /project_id = 'p30'[\s\S]*status = 'active'/);
assert.match(migration, /institution_id = 'inst_ehime'[\s\S]*engagement_scope = 'university_wide'/);
assert.match(nav, /fetchActiveProjectsForNav[\s\S]*\.eq\("status", "active"\)/);
assert.match(seedsDesign, /助成金・採択[\s\S]*seed_funding/);
assert.match(institutionDesign, /p30 EHM[\s\S]*projects\.status='active'/);

console.log("EHM Sawazaki grant and project activation contract: OK");
