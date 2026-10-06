import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
const { loadProjectTechData } = await import("../src/lib/project-tech-server.ts");
const { loadProjectGovernance } = await import("../src/lib/project-governance-server.ts");
const { loadCapitalPlanPage } = await import("../src/lib/project-capital-plan-server.ts");
const { techLedgerTabOf } = await import("../src/lib/project-tech.ts");
const { loadProjectProductDescription } = await import("../src/lib/project-product-description-server.ts");
const { parseProductDescription } = await import("../src/lib/project-product-description.ts");
const productDocument = { version: 1, title: "製品の全体像", summary: "排水処理と在庫からの燃料生産", bodyMd: "## 製品\n本文", sourceRefs: ["技術台帳"] };
// No DD publication exists for the competition topic. It must still come from the canonical PJ ledger.
const tables: Record<string, Record<string, unknown>[]> = {
  project_config: [
    { project_id: "p21", key: "product_description", value: JSON.stringify({ ...productDocument, internalNotes: "DDに出さない" }) },
    { project_id: "p21", key: "private_config", value: "DDに出さない" },
    { project_id: "p34", key: "product_description", value: JSON.stringify({ ...productDocument, title: "他PJの資料" }) },
  ],
  project_tech_topics: [
    { project_id: "p21", tech_topic_id: "qa", tech_domain: "QA", status: "active", sort_order: 2 },
    { project_id: "p21", tech_topic_id: "competition", tech_domain: "競合比較", status: "active", sort_order: 1 },
    { project_id: "p21", tech_topic_id: "archived", status: "archived", sort_order: 0 },
    { project_id: "p34", tech_topic_id: "other-project", status: "active", sort_order: 0 },
  ],
  project_tech_entries: [{ project_id: "p21", tech_topic_id: "competition", row_label: "性能", sort_order: 1 }, { project_id: "p34", tech_topic_id: "other-project" }],
  project_knowledge: [{ project_id: "p21", category: "competitor", status: "active" }, { project_id: "p21", category: "tech", status: "archived" }, { project_id: "p21", category: "internal_strategy", status: "active" }],
  project_company_profiles: [{ project_id: "p21", legal_name: "会社" }],
  project_financial_periods: [{ project_id: "p21", fiscal_year: 2025, revenue_yen: 10 }],
  project_shareholder_meetings: [{ project_id: "p21", meeting_date: "2026-01-01", agenda_summary: "総会" }],
  action_items: [{ project_id: "p21", review_status: "confirmed", status: "open", source: "governance", title: "登記" }],
  project_capital_plans: [{ id: "main", project_id: "p21", name: "現行", status: "active", updated_at: "2026-10-01", document_json: { holders: [{ name: "創業者" }], events: [{ note: "前提を保持" }] } }, { id: "alternative", project_id: "p21", status: "archived", updated_at: "2026-09-01", document_json: {} }, { id: "other", project_id: "p34", document_json: {} }],
  project_capital_plan_versions: [{ project_id: "p21", plan_id: "main", version: 1, document_json: { holders: [] } }],
};
const calls: { table: string; filters: [string, string, unknown][] }[] = [];
function fakeDb(failingTable?: string) {
  return { from(table: string) {
    const call = { table, filters: [] as [string, string, unknown][] }; calls.push(call);
    let single = false; let limit = Infinity;
    const orders: string[] = [];
    const query = {
      select() { return query; },
      eq(field: string, value: unknown) { call.filters.push(["eq", field, value]); return query; },
      neq(field: string, value: unknown) { call.filters.push(["neq", field, value]); return query; },
      in(field: string, value: unknown[]) { call.filters.push(["in", field, value]); return query; },
      order(field: string) { orders.push(field); return query; },
      limit(value: number) { limit = value; return query; },
      maybeSingle() { single = true; return query; },
      then(resolve: (value: unknown) => unknown) {
        const rows = (tables[table] ?? []).filter(row => call.filters.every(([op, field, value]) => op === "eq" ? row[field] === value : op === "neq" ? row[field] !== value : (value as unknown[]).includes(row[field]))).sort((a, b) => { for (const key of orders) { if (a[key] !== b[key]) return String(a[key]).localeCompare(String(b[key])); } return 0; }).slice(0, limit);
        return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: table === failingTable ? { message: "fixture failure" } : null }).then(resolve);
      },
    }; return query;
  } } as unknown as SupabaseClient;
}
const tech = await loadProjectTechData(fakeDb(), "p21");
assert.equal(tech.canEdit, false);
assert.deepEqual(tech.topics.map(t => t.tech_topic_id), ["competition", "qa"]);
assert.equal(tech.topics.filter(t => techLedgerTabOf(t) === "competition").length, 1);
assert.equal(tech.entries.length, 1);
assert.equal(tech.fragments.length, 1);
assert.equal(tech.topics.find(t => t.tech_topic_id === "qa")?.tech_domain, "QA");
assert.equal((await loadProjectTechData(fakeDb(), "p21", true)).canEdit, true);
await assert.rejects(loadProjectTechData(fakeDb("project_tech_entries"), "p21"), /fixture failure/);
const governance = await loadProjectGovernance(fakeDb(), "p21");
assert.equal(governance.financialPeriods[0].revenue_yen, 10);
assert.equal(governance.meetings[0].agenda_summary, "総会");
assert.equal(governance.actionItems[0].title, "登記");
const capital = await loadCapitalPlanPage(fakeDb(), "p21");
assert.equal(capital.plans.length, 2, "all plans, including alternatives, appear in the common selector");
assert.equal(capital.versions.length, 1);
assert.equal(capital.plans.find(p => p.id === "main")?.document_json.events?.[0].note, "前提を保持");
assert.deepEqual(await loadProjectProductDescription(fakeDb(), "p21"), productDocument, "製品説明は認可済みPJの明示登録文書だけ。内部追加項目を返さない");
await assert.rejects(loadProjectProductDescription(fakeDb("project_config"), "p21"), /fixture failure/);
assert.ok(calls.every(call => call.filters.some(([op, field, value]) => op === "eq" && field === "project_id" && value === "p21")), "every read stays within the authorized project");
assert.equal(await loadProjectProductDescription(fakeDb(), "unregistered"), null, "未登録PJへ他PJの本文を出さない");
assert.equal(parseProductDescription(null), null);
for (const bad of ["{broken", {}, { ...productDocument, bodyMd: " " }, { ...productDocument, sourceRefs: [] }, { ...productDocument, version: 2 }]) {
  assert.throws(() => parseProductDescription(bad), /製品説明資料の登録形式/);
}
console.log("DD canonical page data: competition without publication, full technology/governance/capital, PJ scope and query errors OK");

const {loadProjectMarketResearch}=await import('../src/lib/project-market-research-server.ts');
const {parseMarketResearch}=await import('../src/lib/project-market-research.ts');
const research={version:1,summaryMd:'調査概要',records:[{id:'interview',title:'回答',date:'2026-04-17',kind:'専門家インタビュー',sourceUrl:'https://example.com/source',notice:'概算',bodyMd:'回答本文',internal:'除外'}]};
tables.project_config.push({project_id:'p21',key:'market_research',value:JSON.stringify(research)},{project_id:'p34',key:'market_research',value:JSON.stringify({...research,summaryMd:'他PJ'})});
const loaded=await loadProjectMarketResearch(fakeDb(),'p21');
assert.equal(loaded!.summaryMd,'調査概要');
assert.equal((loaded!.records[0] as any).internal,undefined);
assert.equal(await loadProjectMarketResearch(fakeDb(),'unregistered'),null);
await assert.rejects(loadProjectMarketResearch(fakeDb('project_config'),'p21'),/fixture failure/);
assert.ok(calls.filter(c=>c.table==='project_config'&&c.filters.some(f=>f[2]==='market_research')).every(c=>c.filters.some(f=>f[1]==='project_id')));
assert.throws(()=>parseMarketResearch({...research,records:[research.records[0],research.records[0]]}),/登録形式/);
assert.throws(()=>parseMarketResearch({...research,records:[{...research.records[0],sourceUrl:'javascript:alert(1)'}]}),/登録形式/);
console.log('Market research: authorized PJ/key, unregistered, query failure, internal DTO exclusion and unsafe source rejection: PASS');

// 設立案は認可済みPJだけから取得し、実績の株式へ混ぜない。
const { parseCompanyIncorporationPlan } = await import("../src/lib/company-incorporation-plan.ts");
const { buildCapTableSnapshots } = await import("../src/lib/company-overview.ts");
const { loadProjectFoundingBackground } = await import("../src/lib/project-founding-background-server.ts");
const plan = { version: 1, capitalYen: 1080000, issuedShares: 108000, dilutedShares: 120000, firstFiscalPeriod: "2027年度", organizationRows: [{ label: "CEO", value: "山地（予定）", internal: "除外" }], capitalRows: [], operationRows: [], sourceRef: "設立案" };
tables.project_config.push({ project_id: "p21", key: "company_incorporation_plan", value: JSON.stringify(plan) }, { project_id: "p34", key: "company_incorporation_plan", value: "{}" });
const withPlan = await loadProjectGovernance(fakeDb(), "p21");
assert.equal(withPlan.incorporationPlan!.issuedShares, 108000);
assert.equal(buildCapTableSnapshots(withPlan).length, 0, "設立予定株式を発行実績に加算しない");
assert.equal((withPlan.incorporationPlan!.organizationRows[0] as any).internal, undefined);
assert.equal(parseCompanyIncorporationPlan(null), null);
assert.throws(() => parseCompanyIncorporationPlan({ ...plan, dilutedShares: 100 }), /登録形式/);
assert.throws(() => parseCompanyIncorporationPlan({ ...plan, capitalYen: -1 }), /登録形式/);
tables.project_config.push({ project_id: "p21", key: "founding_background", value: JSON.stringify({ ...productDocument, title: "創業背景" }) }, { project_id: "p34", key: "founding_background", value: JSON.stringify({ ...productDocument, title: "他PJ" }) });
assert.equal((await loadProjectFoundingBackground(fakeDb(), "p21"))!.title, "創業背景");
assert.equal(await loadProjectFoundingBackground(fakeDb(), "unregistered"), null);
await assert.rejects(loadProjectFoundingBackground(fakeDb("project_config"), "p21"), /fixture failure/);
assert.ok(calls.filter(c => c.table === "project_config").every(c => c.filters.some(f => f[1] === "project_id")), "文書・設立案の取得はすべてPJ限定");
console.log("Company incorporation plans stay separate from issued shares; founding document scope OK");
