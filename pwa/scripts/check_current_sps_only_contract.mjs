import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const requireAll = (source, values, label) => {
  for (const value of values) assert.ok(source.includes(value), `${label}: missing ${value}`);
};
const forbidAll = (source, values, label) => {
  for (const value of values) assert.ok(!source.includes(value), `${label}: retired path remains active: ${value}`);
};

const model = read("src/lib/current-sps-model.ts");
requireAll(model, [
  'modelVersion: "sps-ind-tier0-v1"',
  'formula: "SPS = Σ q_o P^ind_o"',
  'measureVersion: "sps-ind-v1"',
  'qModelVersion: "q-eval-v2"',
  'qRulesetVersion: "rubric-v1.1"',
  'pModelVersion: "p-ind-v1"',
  'assessmentRulesetVersion: "rubric-v1.1+ind-v1"',
], "current model tuple");

const loader = read("src/lib/seed-screening-bands.ts");
requireAll(loader, [
  '.eq("measure_version", CURRENT_SPS_MODEL.measureVersion)',
  '.eq("ruleset_version", CURRENT_SPS_MODEL.assessmentRulesetVersion)',
  '.eq("frozen", true)',
  'status: "unassessed"',
], "current assessment loader");
forbidAll(loader, ["seed_sps_assessments", "project_pl_monthly"], "current assessment loader");

const retiredTableNames = ["amd_score_inputs", "amd_score_alpha", "seed_sps_assessments"];
const activeSurfaces = [
  "src/app/(app)/dashboard/page.tsx",
  "src/app/(app)/hud/dashboard/page.tsx",
  "src/app/(app)/venture-map/amd-score/page.tsx",
  "src/app/api/hud/dashboard/route.ts",
  "src/app/api/dashboard/portfolio-pulse/route.ts",
  "src/lib/institution-workspace-data.ts",
  "src/lib/seeds-data.ts",
  "src/components/dashboard/DashboardGrid.tsx",
  "src/components/cockpit/CockpitKuteSeeds.tsx",
];
for (const file of activeSurfaces) forbidAll(read(file), retiredTableNames, file);

const currentApi = read("src/app/api/sps/current/route.ts");
requireAll(currentApi, ["fetchCurrentSpsProjectAssessments"], "current SPS API");
const compatibilityApi = read("src/app/api/project/[projectId]/amd-score-detail/route.ts");
requireAll(compatibilityApi, ["fetchCurrentSpsProjectAssessments", 'Deprecation', 'Sunset'], "retired API compatibility boundary");

for (const file of [
  "src/app/api/cron/amd-score-l2-refresh/route.ts",
  "src/app/api/cron/frl-grit-resilience-extract/route.ts",
]) {
  const source = read(file);
  requireAll(source, ["status: 410", "retired"], file);
  forbidAll(source, ["createAdminClient", "getBackgroundAnthropic"], file);
}

const tsukuyomi = read("src/app/api/tsukuyomi/chat/route.ts");
requireAll(tsukuyomi, [
  "RETIRED_SCORE_TOOL_NAMES",
  "ACTIVE_TOOLS = TOOLS.filter",
  "if (RETIRED_SCORE_TOOL_NAMES.has(name))",
], "Tsukuyomi retired-writer guard");

requireAll(read("src/lib/amd-score-data.ts"), [
  "retired score access",
  "retired score writer",
  "retired alpha writer",
], "retired browser data boundary");
requireAll(read("src/lib/amd-score-l2-extract.ts"), [
  "retired score extractor",
  "source updates create reassessment candidates only",
], "retired L2 extractor boundary");
requireAll(read("src/lib/sps-primary-model-data.ts"), [
  "retired SPS registry access",
  "sps-ind-tier0-v1",
], "retired primary registry boundary");

const migration = read("scripts/migrations/283_current_sps_model_governance.sql");
requireAll(migration, [
  "CREATE TABLE IF NOT EXISTS public.sps_model_versions",
  "sps_model_versions_one_current_idx",
  "ALTER COLUMN measure_version DROP DEFAULT",
  "seed_screening_bands_frozen_immutable",
  "BEFORE UPDATE OR DELETE",
], "SPS model governance migration");

const macClient = read("../macos/AMDOSMac/AMDOSCore/SupabaseRESTClient.swift");
requireAll(macClient, ["retiredScoreTables", ...retiredTableNames, "rejectRetiredScoreTable(table)"], "macOS transport guard");
const macRoutes = read("../macos/AMDOSMac/Features/ScreenViews.swift");
requireAll(macRoutes, [
  "case .amdScore: AMDOSCurrentSpsView",
  "case .amdScoreDetail: AMDOSCurrentSpsDetailView",
  "case .amdScoreRetrofit: AMDOSRetiredScoreRouteView",
], "macOS current routes");

console.log("current SPS only contract: all checks passed");
