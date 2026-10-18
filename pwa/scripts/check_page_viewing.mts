import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { parsePageViewingInput, allowedProjectPageLabel, deduplicatePageViewers } from "../src/lib/page-viewing-core.ts";

const project = { projectId: "fixture", projectCategory: "dtsu" };
assert.equal(parsePageViewingInput({ pathname: "https://example.com", pageLabel: "" }), null);
for (const path of ["/dashboard?token=secret", "/dashboard#secret", "/../admin", "//example.com", "/project/%2f/cockpit"]) assert.equal(parsePageViewingInput({ pathname: path, pageLabel: "" }), null);
assert.deepEqual(parsePageViewingInput({ pathname: "/project/fixture/workspace/", pageLabel: "技術" }), { pathname: "/project/fixture/workspace", pageLabel: "技術" });
assert.equal(allowedProjectPageLabel("cockpit", "技術", project), "技術");
assert.equal(allowedProjectPageLabel("workspace", "週次差分", project, true), null, "外部にないページを履歴経由で開かない");
assert.equal(allowedProjectPageLabel("workspace", "技術", project, true), "技術");
assert.equal(allowedProjectPageLabel("dd", "開示資料一覧", project, true), "開示資料一覧");
assert.equal(allowedProjectPageLabel("workspace", "社内の秘密", project), null);
const viewers = deduplicatePageViewers([
  { actor_key: "other", actor_label: "共同メンバー" },
  { actor_key: "self", actor_label: "自分" },
  { actor_key: "self", actor_label: "自分" },
], "self");
assert.equal(viewers.length, 2);
assert.equal(viewers[0].self, true);
console.log("page viewing: safe page identities, surface labels, external boundary, duplicate tabs passed");

// 実際のresolverを通し、新版の資料・旧版・失効・未許可資料を分ける。
let permitted = true, report = true, external = false, editionReads = 0, indexReads = 0;
const access = { packageId: "package", projectId: "fixture", title: "DD資料", preview: false };
const mocks: Record<string, unknown> = {
  "server-only": {},
  "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: "閲覧者" } }) }) }) }) }) },
  "@/lib/project-workspace": { getCurrentMemberAccess: async () => external ? null : { memberId: "member", codeName: "本人" } },
  "@/lib/project-shared-workspace-access": {}, "@/lib/project-surface-permissions": {}, "@/lib/surface-catalog": {},
  "@/lib/page-viewing-core": { allowedProjectPageLabel },
  "@/lib/dd-access": { resolveDdPackageAccess: async () => permitted ? { ...access, principal: external ? "workspace_account" : "internal_admin", accountId: "viewer" } : null },
  "@/lib/dd-report-server": {
    loadDdReportEdition: async (a: typeof access) => { editionReads++; assert.equal(a.packageId, "package"); return report ? { id: "allowed-edition" } : null; },
    loadDdReportChapterIndex: async (id: string) => { indexReads++; assert.equal(id, "allowed-edition"); return [{ slug: "financial-plan", title: "損益・資金繰" }, { slug: "organization", title: "組織図" }]; },
  },
};
const compiled = ts.transpileModule(readFileSync("src/lib/page-viewing-server.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const resolver: Record<string, Function> = {};
new Function("require", "exports", compiled)((name: string) => { assert.ok(name in mocks, name); return mocks[name]; }, resolver);
const resolve = (pageLabel: string, pathname = "/dd/fixture") => resolver.resolvePageViewingContext({ pathname, pageLabel });
const financial = await resolve("損益・資金繰"), organization = await resolve("組織図");
assert.ok(financial); assert.ok(organization);
assert.notEqual(financial.resourceKey, organization.resourceKey, "別資料の閲覧者を混ぜない");
assert.equal(await resolve("別パッケージの資料"), null);
external = true;
const viewer = await resolve("損益・資金繰");
assert.equal(viewer.ownHistoryOnly, true);
assert.equal(viewer.resourceKey, financial.resourceKey, "同じ資料の社内・社外閲覧者を表示する");
permitted = false;
const before = [editionReads, indexReads];
assert.equal(await resolve("損益・資金繰"), null);
assert.deepEqual([editionReads, indexReads], before, "失効時は目録を読まない");
permitted = true; external = false;
const legacy = await resolve("会社概要", "/dd/fixture/legacy");
assert.ok(legacy); assert.deepEqual([editionReads, indexReads], before, "旧版は固定目録で検証する");
assert.equal(await resolve("損益・資金繰", "/dd/fixture/legacy"), null);
report = false;
assert.ok(await resolve("会社概要"));
assert.equal(await resolve("損益・資金繰"), null);
console.log("DD presence: authorized report index, chapter separation, external history boundary, revocation, legacy and packages without reports PASS");
