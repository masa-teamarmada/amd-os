// Static structural contract test for the admin workspace-access management surface.
// No DB, no Next.js runtime — pure source-text checks so these guarantees can never
// silently regress:
//   1. every exported HTTP method calls requireAdmin() before touching createAdminClient().
//   2. POST/PATCH dispatch on an explicit `kind` from a closed allowlist (no generic upsert).
//   3. account lookup always goes through normalizeWorkspaceEmail (never a raw address).
//   4. role/status values always come from the CHECK-constraint-mirroring allowlists.
//   5. every mutation records a workspace audit event whose detail carries metadata only.
//   6. granting an institution workspace membership never creates individual PJ access.
//   7. auth.users ids are never selected, returned, or rendered.
//   8. GET paginates every table instead of silently truncating accounts or grants.
// Run: npm run test:workspace-access-admin

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(scriptDir, "..", "src");

const routePath = path.join(srcDir, "app", "api", "admin", "workspace-access", "route.ts");
const auditPath = path.join(srcDir, "lib", "workspace-access-audit.ts");
const pagePath = path.join(srcDir, "app", "(app)", "admin", "access", "page.tsx");
const panelPath = path.join(srcDir, "components", "admin", "WorkspaceAccessAdminPanel.tsx");

const routeSource = readFileSync(routePath, "utf8");
const auditSource = readFileSync(auditPath, "utf8");
const pageSource = readFileSync(pagePath, "utf8");
const panelSource = readFileSync(panelPath, "utf8");

/** Doc comments legitimately name forbidden things in prose to warn against them. */
function stripLineComments(source) {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/*"))
    .join("\n");
}

const routeCode = stripLineComments(routeSource);

/** Slices one top-level function, from its declaration to the next top-level function. */
function functionBlock(source, anchor) {
  const start = source.indexOf(anchor);
  assert.ok(start >= 0, `route.ts must declare ${anchor}`);
  const next = [...source.matchAll(/\n(?:export )?async function /g)]
    .map((match) => match.index)
    .find((index) => index > start);
  return source.slice(start, next ?? source.length);
}

// --- 1. requireAdmin gates every exported HTTP method ----------------------------------

for (const requiredImport of [
  ['from "@/lib/supabase/api-auth"', "requireAdmin"],
  ['from "@/lib/supabase/admin"', "createAdminClient"],
  ['from "@/lib/workspace-email"', "normalizeWorkspaceEmail"],
  ['from "@/lib/workspace-access-audit"', "recordWorkspaceAuditEvent"],
]) {
  const [importPath, symbol] = requiredImport;
  assert.ok(routeSource.includes(importPath), `route.ts must import ${symbol} ${importPath}`);
  assert.ok(routeSource.includes(symbol), `route.ts must use ${symbol}`);
}

// The session-scoped client would run under the caller's RLS instead of the admin path.
assert.ok(
  !routeSource.includes('@/lib/supabase/server'),
  "route.ts must not use the session supabase client — admin reads/writes go through createAdminClient",
);

const exportedMethods = [...routeSource.matchAll(/export async function ([A-Z]+)\(/g)].map((match) => match[1]);
assert.deepEqual(
  [...exportedMethods].sort(),
  ["GET", "PATCH", "POST"],
  `route.ts must export exactly GET/POST/PATCH (found: ${exportedMethods.join(", ") || "none"})`,
);

for (const method of exportedMethods) {
  const body = functionBlock(routeCode, `export async function ${method}(`);
  assert.ok(
    body.includes("const auth = await requireAdmin();"),
    `${method} must call requireAdmin() before doing anything else`,
  );
  assert.ok(
    body.includes("if (!auth.ok) return auth.errorResponse;"),
    `${method} must return the requireAdmin() error response when the caller is not an admin`,
  );
  const adminIndex = body.indexOf("requireAdmin(");
  const clientIndex = body.indexOf("createAdminClient(");
  assert.ok(
    clientIndex === -1 || adminIndex < clientIndex,
    `${method} must call requireAdmin() before createAdminClient()`,
  );
}

// --- 2. explicit kinds, closed allowlist ------------------------------------------------

function setMembers(name) {
  const match = routeSource.match(new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]\\)`));
  assert.ok(match, `route.ts must define the ${name} allowlist as a Set literal`);
  return match[1]
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)
    .sort();
}

const EXPECTED_ALLOWLISTS = {
  MUTATION_KINDS: ["account", "institution_membership", "project_membership"],
  ACCOUNT_STATUSES: ["active", "invited", "suspended"],
  MEMBERSHIP_STATUSES: ["active", "invited", "revoked", "suspended"],
  MEMBERSHIP_CREATE_STATUSES: ["active", "invited"],
  INSTITUTION_ROLES: ["member", "owner", "readonly"],
  PROJECT_ROLES: ["contributor", "manager", "readonly"],
  STOPPED_MEMBERSHIP_STATUSES: ["revoked", "suspended"],
};

for (const [name, expected] of Object.entries(EXPECTED_ALLOWLISTS)) {
  assert.deepEqual(setMembers(name), [...expected].sort(), `${name} must mirror the DB CHECK constraint exactly`);
}

for (const method of ["POST", "PATCH"]) {
  const body = functionBlock(routeCode, `export async function ${method}(`);
  assert.ok(
    body.includes("pick(body.kind, MUTATION_KINDS)"),
    `${method} must resolve the mutation kind through the MUTATION_KINDS allowlist`,
  );
  assert.ok(body.includes('return bad("invalid_kind")'), `${method} must reject an unknown kind`);
  assert.ok(body.includes('kind === "account"'), `${method} must branch explicitly on the account kind`);
  assert.ok(
    body.includes('kind === "institution_membership"'),
    `${method} must branch explicitly on the institution_membership kind`,
  );
}

const postBody = functionBlock(routeCode, "export async function POST(");
for (const handler of ["createAccount", "createInstitutionMembership", "createProjectMembership"]) {
  assert.ok(postBody.includes(handler), `POST must dispatch to ${handler}`);
}
const patchBody = functionBlock(routeCode, "export async function PATCH(");
for (const handler of ["patchAccount", "patchInstitutionMembership", "patchProjectMembership"]) {
  assert.ok(patchBody.includes(handler), `PATCH must dispatch to ${handler}`);
}

// Role/status/kind coming off the request body must never be used unvalidated.
for (const match of routeCode.matchAll(/body\.(kind|role|status)/g)) {
  const preceding = routeCode.slice(Math.max(0, match.index - 5), match.index);
  assert.ok(
    preceding.endsWith("pick("),
    `body.${match[1]} must be validated through pick(..., <allowlist>) — found bare use at index ${match.index}`,
  );
}

// --- 3. email normalization --------------------------------------------------------------

const normalizeCount = [...routeCode.matchAll(/normalizeWorkspaceEmail\(/g)].length;
assert.ok(normalizeCount >= 2, "both the account-create and account-lookup paths must call normalizeWorkspaceEmail");

const emailLookups = [...routeCode.matchAll(/\.eq\("email_normalized",\s*([A-Za-z0-9_.]+)\)/g)];
assert.ok(emailLookups.length >= 2, "account lookups must filter on email_normalized");
for (const lookup of emailLookups) {
  assert.equal(
    lookup[1],
    "email",
    "email_normalized lookups must use the normalizeWorkspaceEmail() result, not a raw request value",
  );
}
assert.ok(
  !/\.eq\("email",/.test(routeCode),
  "route.ts must not match accounts on the raw email column (use email_normalized)",
);

// --- 4. no silent reactivation ------------------------------------------------------------

const createAccountBody = functionBlock(routeCode, "async function createAccount(");
assert.ok(
  createAccountBody.includes('existing.status === "suspended"') &&
    createAccountBody.includes('conflict("account_suspended")'),
  "createAccount must return a conflict for a suspended account instead of reactivating it",
);
assert.ok(
  !/status:\s*"active"/.test(createAccountBody),
  "createAccount must never write status 'active' — new accounts start as 'invited'",
);

for (const creator of ["createInstitutionMembership", "createProjectMembership"]) {
  const body = functionBlock(routeCode, `async function ${creator}(`);
  assert.ok(
    body.includes("STOPPED_MEMBERSHIP_STATUSES.has(existing.status)"),
    `${creator} must detect a suspended/revoked existing grant`,
  );
  assert.ok(
    body.includes('"membership_stopped"') && body.includes("conflict("),
    `${creator} must return a conflict (explicit PATCH required) instead of reviving a stopped grant`,
  );
  assert.ok(
    body.includes("MEMBERSHIP_CREATE_STATUSES"),
    `${creator} must restrict the creation status to the MEMBERSHIP_CREATE_STATUSES allowlist`,
  );
  assert.ok(
    body.includes('return bad("invalid_role")') && body.includes('return bad("invalid_status")'),
    `${creator} must reject supplied role/status values outside the allowlists instead of silently defaulting`,
  );
}

for (const patcher of ["patchInstitutionMembership", "patchProjectMembership"]) {
  const body = functionBlock(routeCode, `async function ${patcher}(`);
  assert.ok(
    body.includes('return bad("invalid_role")') && body.includes('return bad("invalid_status")'),
    `${patcher} must reject supplied role/status values outside the allowlists`,
  );
}

// --- 5. audit events: metadata only --------------------------------------------------------

for (const eventType of [
  "admin_account_upsert",
  "admin_institution_membership_mutation",
  "admin_project_membership_mutation",
]) {
  assert.ok(
    auditSource.includes(`| "${eventType}"`),
    `workspace-access-audit.ts must declare the "${eventType}" event type`,
  );
  assert.ok(routeSource.includes(`eventType: "${eventType}"`), `route.ts must record the "${eventType}" event`);
}

for (const mutator of [
  "createAccount",
  "createInstitutionMembership",
  "createProjectMembership",
  "patchAccount",
  "patchInstitutionMembership",
  "patchProjectMembership",
]) {
  const body = functionBlock(routeCode, `async function ${mutator}(`);
  assert.ok(
    body.includes("await recordWorkspaceAuditEvent("),
    `${mutator} must record a workspace audit event on success`,
  );
}

const ALLOWED_DETAIL_KEYS = new Set(["action", "created", "role", "status"]);
const detailLiterals = [...routeCode.matchAll(/detail:\s*\{([^}]*)\}/g)];
assert.ok(detailLiterals.length >= 6, "every mutation must pass an audit detail object");
for (const literal of detailLiterals) {
  const keys = [...literal[1].matchAll(/([A-Za-z0-9_]+)\s*:/g)].map((match) => match[1]);
  for (const key of keys) {
    assert.ok(
      ALLOWED_DETAIL_KEYS.has(key),
      `audit detail key "${key}" is not in the metadata allowlist [${[...ALLOWED_DETAIL_KEYS].join(", ")}]`,
    );
  }
}

// No secrets/URLs anywhere in the audited code path.
const FORBIDDEN_PATTERN = /\btoken\b|\bcookie\b|\bpassword\b|\bsecret\b|\bsignature\b|https?:\/\//i;
const forbidden = routeCode.match(FORBIDDEN_PATTERN);
assert.equal(forbidden, null, `route.ts must not reference "${forbidden?.[0]}" (no tokens/URLs in the admin path)`);

// --- 6. institution membership never implies project membership -----------------------------

const institutionCreate = functionBlock(routeCode, "async function createInstitutionMembership(");
assert.ok(
  !institutionCreate.includes("project"),
  "createInstitutionMembership must not reference project access at all — the two grants are independent",
);
assert.equal(
  [...institutionCreate.matchAll(/\.insert\(/g)].length,
  1,
  "createInstitutionMembership must insert exactly one row (the institution membership)",
);

const institutionPatch = functionBlock(routeCode, "async function patchInstitutionMembership(");
assert.ok(
  !institutionPatch.includes("project_access_memberships"),
  "patchInstitutionMembership must never touch project access rows",
);

const projectTableWrites = [...routeCode.matchAll(/\.from\("project_access_memberships"\)/g)].length;
const projectScopedFns = ["createProjectMembership", "patchProjectMembership"]
  .map((name) => functionBlock(routeCode, `async function ${name}(`))
  .join("\n");
assert.equal(
  [...projectScopedFns.matchAll(/\.from\("project_access_memberships"\)/g)].length,
  projectTableWrites,
  "project_access_memberships may only be touched by the project_membership handlers; GET uses the paginated table helper",
);

// --- 7. auth user ids are never exposed -------------------------------------------------------

for (const [label, source] of [
  ["route.ts", routeCode],
  ["admin/access/page.tsx", stripLineComments(pageSource)],
  ["WorkspaceAccessAdminPanel.tsx", stripLineComments(panelSource)],
]) {
  assert.ok(!source.includes("auth_user_id"), `${label} must never select or render auth_user_id`);
  assert.ok(!source.includes("authUserId"), `${label} must never expose an auth user id`);
}

// --- 8. the admin UI separates the three grants and states the boundary ------------------------

assert.ok(
  pageSource.includes("WorkspaceAccessAdminPanel"),
  "admin/access/page.tsx must render the WorkspaceAccessAdminPanel",
);

for (const heading of ["外部メールアカウント", "研究機関ワークスペース権限", "個別PJ権限"]) {
  assert.ok(panelSource.includes(heading), `the admin panel must have a clearly separated "${heading}" section`);
}
assert.ok(
  panelSource.includes("機関の権限は、個別PJの権限を含まない"),
  "the admin panel must state that institution permission does not include individual PJ permission",
);

const panelFetches = [...panelSource.matchAll(/fetch\(\s*"([^"]+)"/g)].map((match) => match[1]);
assert.ok(panelFetches.length > 0, "the admin panel must call the admin API");
for (const url of panelFetches) {
  assert.equal(url, "/api/admin/workspace-access", `the admin panel must only call its own admin API (found ${url})`);
}

// --- 9. list reads are complete or explicitly fail --------------------------------------------

assert.ok(routeSource.includes("async function listAllRows("), "GET must use a shared paginated list helper");
assert.ok(routeSource.includes(".range(from, from + LIST_PAGE_SIZE - 1)"), "the list helper must page with explicit ranges");
assert.ok(routeSource.includes("row_limit_exceeded"), "an extreme row count must fail explicitly instead of truncating");
assert.ok(!routeSource.includes(".limit(500)"), "accounts must not be silently truncated at 500 rows");
assert.ok(!routeSource.includes(".limit(1000)"), "memberships must not be silently truncated at 1000 rows");
for (const table of [
  "workspace_user_accounts",
  "institution_workspaces",
  "institution_workspace_memberships",
  "projects",
  "project_access_memberships",
]) {
  assert.ok(
    routeSource.includes(`listAllRows(db, "${table}"`),
    `GET must paginate ${table} through listAllRows`,
  );
}

console.log("check_workspace_access_admin_contract.mjs: OK");
