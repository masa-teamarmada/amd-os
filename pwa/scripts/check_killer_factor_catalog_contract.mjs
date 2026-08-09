import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const expectAll = (source, needles, label) => {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${label}: missing ${needle}`);
  }
};

const baseMigration = read("scripts/migrations/246_killer_factor_catalog.sql");
const operatingMigration = read("scripts/migrations/249_killer_factor_operating_model.sql");
const route = read("src/app/api/governance/killer-factors/route.ts");
const component = read("src/components/cockpit/CockpitKillerFactorCatalog.tsx");
const risk = read("src/lib/killer-factor-risk.ts");
const overview = read("src/components/cockpit/CockpitCompanyOverview.tsx");
const designCode = read("spec/2-7-ui-design-code-current-spec.md");

expectAll(baseMigration, [
  "CREATE TABLE IF NOT EXISTS public.killer_factor_catalog",
  "CREATE TABLE IF NOT EXISTS public.project_killer_factor_states",
  "UNIQUE (project_id, killer_factor_id)",
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
], "base migration");

expectAll(operatingMigration, [
  "operating_mode text NOT NULL DEFAULT 'monitoring'",
  "preventive_action text",
  "timing_guidance text",
  "status_on date",
  "target_on date",
  "status = 'unchecked'",
  "project_killer_factor_state_guard",
  "status NOT IN ('unchecked', 'clear', 'warning', 'occurred')",
  "status NOT IN ('unchecked', 'not_started', 'in_progress', 'controlled', 'breached')",
  "会社設立・外部資金受入の前",
], "operating model migration");

expectAll(route, [
  "requireMember",
  ".from(\"killer_factor_catalog\")",
  ".from(\"project_killer_factor_states\")",
  'body.action === "create_factor"',
  'body.action === "update_state"',
  'body.action === "mark_occurred"',
  "isKillerFactorStatusAllowed",
  "summarizeKillerFactorRisk",
  "recorded_by_member_id: actor.member_id",
], "API route");

for (const forbidden of ["anthropic", "gemini", "openai", "notification", "success_probability"]) {
  assert.ok(!route.toLowerCase().includes(forbidden), `API route must not invoke ${forbidden}`);
}

expectAll(risk, [
  "KILLER_FACTOR_OPERATING_MODES",
  "MONITORING_STATUSES",
  "PREVENTION_STATUSES",
  '"critical" | "attention" | "unknown" | "stable"',
  "criticalCount > 0",
  "actionCount > 0",
  "unknownCount > 0 || items.length === 0",
], "risk summary");

expectAll(component, [
  'data-testid="killer-factor-catalog"',
  'data-testid="killer-factor-risk-overview"',
  'data-testid="killer-factor-density-table"',
  'data-testid="killer-factor-density-row"',
  "このPJの全体判定",
  "危険",
  "要対応",
  "要確認",
  "安定",
  "予防統制",
  "常時監視",
  "未確認は安全扱いしない",
  "AMDの打ち手 / 見るもの",
  "状態を保存",
  "根拠メモ",
  "観測の手がかり",
  'h-11 w-full shrink-0 sm:h-9 sm:w-auto',
  'min-h-11 rounded-md',
  'lg:min-h-8',
  'h-11 w-full min-w-0',
  'lg:h-9',
  "CEO本人の自己申告だけでは平常・兆候・発生を確定しない",
  'timeZone: "Asia/Tokyo"',
  "todayInJapan()",
], "catalog component");

for (const forbidden of [
  "発生を記録",
  "未発生",
  'lg:grid-cols-[9rem_minmax(16rem,1.15fr)_minmax(18rem,1.35fr)_15rem]',
]) {
  assert.ok(!component.includes(forbidden), `catalog component must not contain old low-density UI: ${forbidden}`);
}

expectAll(designCode, [
  "情報密度",
  "10件以下なら全件",
  "44〜64px",
  "未確認を安全扱いしない",
  "desktop 1440×900",
  "mobile 390×844",
], "UI design code");

expectAll(overview, [
  'import { CockpitKillerFactorCatalog } from "@/components/cockpit/CockpitKillerFactorCatalog";',
  "<CockpitKillerFactorCatalog projectId={projectId} />",
], "company overview wiring");

console.log("killer factor catalog contract: OK");
