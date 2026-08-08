import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const expectAll = (source, needles, label) => {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${label}: missing ${needle}`);
  }
};

const migration = read("scripts/migrations/246_killer_factor_catalog.sql");
const route = read("src/app/api/governance/killer-factors/route.ts");
const component = read("src/components/cockpit/CockpitKillerFactorCatalog.tsx");
const overview = read("src/components/cockpit/CockpitCompanyOverview.tsx");

expectAll(migration, [
  "CREATE TABLE IF NOT EXISTS public.killer_factor_catalog",
  "CREATE TABLE IF NOT EXISTS public.project_killer_factor_states",
  "UNIQUE (project_id, killer_factor_id)",
  "status IN ('not_occurred', 'occurred')",
  "project_killer_factor_states_occurrence_check",
  "killer_factor_catalog_after_insert",
  "projects_after_insert_killer_factor_states",
  "public.amd_os_is_member()",
  "経営整合",
  "ガバナンス",
  "管理体制",
  "金銭感覚",
  "経営チーム",
  "社会的信用",
  "出自機関",
], "migration");

expectAll(route, [
  "requireMember",
  ".from(\"killer_factor_catalog\")",
  ".from(\"project_killer_factor_states\")",
  'body.action === "create_factor"',
  'body.action === "mark_occurred"',
  "recorded_by_member_id: actor.member_id",
], "API route");

for (const forbidden of ["anthropic", "gemini", "openai", "notification", "success_probability"]) {
  assert.ok(!route.toLowerCase().includes(forbidden), `API route must not invoke ${forbidden}`);
}

expectAll(component, [
  'data-testid="killer-factor-catalog"',
  "型",
  "事象",
  "観測の手がかり",
  "このPJでの状態",
  "要素を追加",
  "発生を記録",
  "発生日",
  "根拠メモ",
  "記録者",
  "CEO本人の自己申告は発生判定の根拠に使わない",
], "catalog component");

expectAll(overview, [
  'import { CockpitKillerFactorCatalog } from "@/components/cockpit/CockpitKillerFactorCatalog";',
  "<CockpitKillerFactorCatalog projectId={projectId} />",
], "company overview wiring");

console.log("killer factor catalog contract: OK");
