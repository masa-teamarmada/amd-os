import assert from "node:assert/strict";
import fs from "node:fs";
import { redactProjectPartnerNames, validatePartnerDisclosure, PARTNER_NAME_WITHHELD } from "../src/lib/project-partner-disclosure.ts";
import { loadProjectTechnicalEvidence } from "../src/lib/project-technical-evidence-server.ts";

const partners = [
  { id: "a", name: "食品会社[非開示]", slug: "private-food", nameDisclosureProhibited: true },
  { id: "b", name: "開示できる会社", slug: "public-company", nameDisclosureProhibited: false },
];
const original = { partners: [
  { ...partners[0], businessArea: "食品製造", sourceRef: "https://private-company.test/note", connectionContext: "食品会社[非開示]と実排液試験", samples: [{ label: "食品会社[非開示]の原水", sourceRef: "original private file" }] },
  { ...partners[1], businessArea: "装置製造", sourceRef: "public source" },
], partnerInteractions: [{ partnerId: "a", summary: "食品会社[非開示]の試験", sourceRef: "private evidence", detailMd: "private-food" }], tasks: [{ title: "食品会社[非開示]の試験準備" }] };
const result = redactProjectPartnerNames(original, partners);
assert.equal(original.partners[0].name, "食品会社[非開示]", "internal canonical names must stay intact");
assert.equal(result.partners[0].name, PARTNER_NAME_WITHHELD);
assert.equal(result.partners[0].businessArea, "食品製造");
assert.equal(result.partners[0].slug, "undisclosed-a");
assert.equal(result.partners[0].sourceRef, null);
assert.equal(result.partnerInteractions[0].sourceRef, null);
assert.ok("samples" in result.partners[0]);
assert.equal(result.partners[0].samples[0].sourceRef, null);
assert.equal(result.partners[1].name, "開示できる会社");
assert.equal(result.partners[1].sourceRef, "public source");
assert.ok(!JSON.stringify(result).includes("食品会社[非開示]"));
assert.ok(!JSON.stringify(result).includes("private-food"));
assert.equal(redactProjectPartnerNames(original, []), original);
assert.throws(() => validatePartnerDisclosure({ name_disclosure_prohibited: true, business_area: "　 " }), /事業領域/);
validatePartnerDisclosure({ name_disclosure_prohibited: true, business_area: "食品製造" });
validatePartnerDisclosure({ name_disclosure_prohibited: false, business_area: null });

const report = { version: 1, title: "試験初稿", summary: "報告と未確認を分ける", bodyMd: "食品会社[非開示]の試験。［杉浦先生追記］", sourceRefs: ["研究者報告"], internalNotes: "private" };
const calls: Array<{ table: string; filters: Record<string, unknown> }> = [];
function fakeDb(fail = false, broken = false) {
  return { from(table: string) {
    const call = { table, filters: {} as Record<string, unknown> }; calls.push(call);
    const query = { select() { return query; }, eq(k: string, v: unknown) { call.filters[k] = v; return query; }, is(k: string, v: unknown) { call.filters[k] = v; return query; }, maybeSingle() { return query; },
      then(resolve: (v: unknown) => unknown) { return Promise.resolve({ data: table === "project_config" ? { value: broken ? "{}" : JSON.stringify(report) } : [{ id: "a", name: partners[0].name, slug: partners[0].slug, name_disclosure_prohibited: true }], error: fail ? { message: "read failed" } : null }).then(resolve); }
    }; return query;
  } };
}
const loaded = await loadProjectTechnicalEvidence(fakeDb() as never, "fixture");
assert.ok(loaded?.bodyMd.includes(PARTNER_NAME_WITHHELD));
assert.ok(loaded?.bodyMd.includes("［杉浦先生追記］"));
assert.equal("internalNotes" in loaded!, false);
assert.ok(calls.every(call => call.filters.project_id === "fixture"));
assert.equal(calls.find(call => call.table === "project_config")?.filters.key, "technical_evidence_report");
await assert.rejects(loadProjectTechnicalEvidence(fakeDb(true) as never, "fixture"), /read failed/);
await assert.rejects(loadProjectTechnicalEvidence(fakeDb(false, true) as never, "fixture"), /登録形式/);
const dd = fs.readFileSync("src/lib/dd-project-pages-server.ts", "utf8");
const workspace = fs.readFileSync("src/lib/project-workspace.ts", "utf8");
assert.ok(dd.includes("redactProjectPartnerNames(management, all.partners)"));
assert.ok(workspace.includes('access.principal === "workspace_account" ? redactProjectPartnerNames'));
console.log("Partner disclosure: shared payload, nested names/slugs/evidence, retained industry, validation and actual report loader OK");
