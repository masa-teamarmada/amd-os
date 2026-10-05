import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// 実際のrouteを実行し、共有アカウントや未認証でDBへ到達しないことを検証する。
const source = readFileSync(new URL("../src/app/api/governance/killer-factors/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
let auth: { ok: boolean; errorResponse: Response | null };
let memberAccess: { scope: "portfolio" | "project" } | null = { scope: "portfolio" };
let dbReads = 0;
let catalogReads = 0;
const exports: { GET?: (req: { nextUrl: URL }) => Promise<Response>; POST?: (req: { nextUrl: URL }) => Promise<Response> } = {};
const mocks: Record<string, unknown> = {
  "next/server": { NextResponse: Response },
  "@/lib/supabase/api-auth": { requireMember: async () => auth },
  "@/lib/project-workspace": { getCurrentMemberAccess: async () => memberAccess },
  "@/lib/supabase/admin": { createAdminClient: () => { dbReads++; return {}; } },
  "@/lib/project-killer-factors-server": { loadProjectKillerFactors: async () => { catalogReads++; return [{ evidenceNote: "CANARY_INTERNAL_EVIDENCE" }]; } },
  "@/lib/killer-factor-risk": { summarizeKillerFactorRisk: () => ({ level: "unknown" }) },
};
new Function("require", "exports", compiled.outputText)((name: string) => {
  assert.ok(name in mocks, `unexpected dependency: ${name}; shared authentication must not be added`);
  return mocks[name];
}, exports);
assert.ok(exports.GET);
const req = { nextUrl: new URL("https://example.test/api/governance/killer-factors?projectId=p21") };
for (const [identity, status] of [["anonymous", 401], ["workspace_only", 401], ["dd_only", 401], ["signed_in_non_member", 403]] as const) {
  auth = { ok: false, errorResponse: Response.json({ error: identity }, { status }) };
  const response = await exports.GET(req);
  assert.equal(response.status, status, identity);
  assert.ok(!(await response.text()).includes("CANARY_INTERNAL"), identity);
  assert.equal(dbReads, 0, `${identity} must be rejected before creating a service-role DB client`);
  assert.equal(catalogReads, 0, `${identity} must not retrieve assessments or summary`);
}
auth = { ok: true, errorResponse: null };
for (const access of [{ scope: "project" } as const, null]) {
  memberAccess = access;
  assert.equal((await exports.GET(req)).status, 403, "project-scoped or inactive member cannot read cockpit data");
  assert.ok(exports.POST);
  assert.equal((await exports.POST(req)).status, 403, "project-scoped or inactive member cannot write cockpit data");
  assert.equal(dbReads, 0);
  assert.equal(catalogReads, 0);
}
memberAccess = { scope: "portfolio" };
const allowed = await exports.GET(req);
assert.equal(allowed.status, 200);
assert.equal(allowed.headers.get("Cache-Control"), "private, no-store");
assert.ok((await allowed.text()).includes("CANARY_INTERNAL_EVIDENCE"), "internal member keeps cockpit access");
assert.equal(catalogReads, 1);
const invalid = await exports.GET({ nextUrl: new URL("https://example.test/api/governance/killer-factors") });
assert.equal(invalid.status, 400);
assert.equal(catalogReads, 1, "invalid project must not read data");
console.log("killer-factor API: workspace/DD/non-member/project-scoped/inactive denied before DB, cockpit member allowed, private no-store OK");
