// Pure test: revocation / scope-summary rules in workspace-access-scope-core.ts.
// No DB, no Next.js runtime. Run: npm run test:workspace-access-scope

import assert from "node:assert/strict";
import {
  buildWorkspaceScopeSummary,
  hasAnyUsableMembership,
} from "../src/lib/workspace-access-scope-core.ts";

const ACCOUNT_BASE = {
  id: "acct-1",
  email_normalized: "user@example.com",
  auth_user_id: "auth-1",
  status: "active" as const,
};

// --- buildWorkspaceScopeSummary -------------------------------------------------

// Happy path: active account + active membership + active workspace => included.
{
  const summary = buildWorkspaceScopeSummary(
    ACCOUNT_BASE,
    "user@example.com",
    [{ role: "member", status: "active", workspace: { slug: "ehime", name: "Ehime", status: "active" } }],
    [{ project_id: "p1", role: "contributor", status: "active" }],
  );
  assert.ok(summary);
  assert.equal(summary.institutionWorkspaces.length, 1);
  assert.equal(summary.projects.length, 1);
}

// null account => fail closed.
assert.equal(buildWorkspaceScopeSummary(null, "user@example.com", [], []), null);

// Non-active account status (invited/suspended) must never resolve a live session.
for (const status of ["invited", "suspended"] as const) {
  assert.equal(
    buildWorkspaceScopeSummary({ ...ACCOUNT_BASE, status }, "user@example.com", [], []),
    null,
    `status=${status} must fail closed`,
  );
}

// No auth_user_id linked => fail closed (session cannot be trusted pre-linkage).
assert.equal(
  buildWorkspaceScopeSummary({ ...ACCOUNT_BASE, auth_user_id: null }, "user@example.com", [], []),
  null,
);

// Session email must match the DB-normalized email exactly.
assert.equal(
  buildWorkspaceScopeSummary(ACCOUNT_BASE, "someone-else@example.com", [], []),
  null,
);

// Institution membership status=revoked/invited/suspended, with zero project access,
// leaves zero active scope total => fail closed to null (not a truthy empty-array summary).
{
  const summary = buildWorkspaceScopeSummary(
    ACCOUNT_BASE,
    "user@example.com",
    [
      { role: "member", status: "revoked", workspace: { slug: "a", name: "A", status: "active" } },
      { role: "member", status: "invited", workspace: { slug: "b", name: "B", status: "active" } },
      { role: "member", status: "suspended", workspace: { slug: "c", name: "C", status: "active" } },
    ],
    [],
  );
  assert.equal(summary, null, "revoked/invited/suspended institution memberships with zero project access must resolve to null");
}

// Same revoked/invited/suspended memberships, but paired with one active project membership:
// the institution side still contributes zero workspaces, yet the summary stays non-null
// because total active scope (via the project) is non-zero.
{
  const summary = buildWorkspaceScopeSummary(
    ACCOUNT_BASE,
    "user@example.com",
    [
      { role: "member", status: "revoked", workspace: { slug: "a", name: "A", status: "active" } },
      { role: "member", status: "invited", workspace: { slug: "b", name: "B", status: "active" } },
      { role: "member", status: "suspended", workspace: { slug: "c", name: "C", status: "active" } },
    ],
    [{ project_id: "p1", role: "contributor", status: "active" }],
  );
  assert.ok(summary);
  assert.equal(summary.institutionWorkspaces.length, 0, "only active memberships should be included");
}

// Active membership but paused workspace must be excluded — institution membership alone
// never grants access; the workspace itself must also be active. With zero project access
// too, total active scope is zero => null.
{
  const summary = buildWorkspaceScopeSummary(
    ACCOUNT_BASE,
    "user@example.com",
    [{ role: "member", status: "active", workspace: { slug: "a", name: "A", status: "paused" } }],
    [],
  );
  assert.equal(summary, null, "paused workspace excludes the membership, leaving zero active scope => null");
}

// Same paused-workspace membership, paired with an active project membership: the
// institution side still contributes zero workspaces, but the summary is non-null.
{
  const summary = buildWorkspaceScopeSummary(
    ACCOUNT_BASE,
    "user@example.com",
    [{ role: "member", status: "active", workspace: { slug: "a", name: "A", status: "paused" } }],
    [{ project_id: "p1", role: "contributor", status: "active" }],
  );
  assert.ok(summary);
  assert.equal(summary.institutionWorkspaces.length, 0, "paused workspace must exclude the membership");
}

// Account active, zero institution memberships, zero project memberships at all => null
// (the base "active scope count is 0" case).
assert.equal(
  buildWorkspaceScopeSummary(ACCOUNT_BASE, "user@example.com", [], []),
  null,
  "zero institution and zero project memberships must resolve to null",
);

// Institution membership must never auto-grant project access — project rows are independent.
{
  const summary = buildWorkspaceScopeSummary(
    ACCOUNT_BASE,
    "user@example.com",
    [{ role: "owner", status: "active", workspace: { slug: "a", name: "A", status: "active" } }],
    [],
  );
  assert.ok(summary);
  assert.equal(summary.projects.length, 0, "institution membership must not imply project access");
}

// Project membership status=revoked/invited/suspended, with zero institution access,
// leaves zero active scope total => null.
{
  const summary = buildWorkspaceScopeSummary(
    ACCOUNT_BASE,
    "user@example.com",
    [],
    [
      { project_id: "p1", role: "contributor", status: "revoked" },
      { project_id: "p2", role: "contributor", status: "invited" },
      { project_id: "p3", role: "contributor", status: "suspended" },
    ],
  );
  assert.equal(summary, null, "revoked/invited/suspended project memberships with zero institution access must resolve to null");
}

// Same revoked/invited/suspended project memberships, paired with one active institution
// membership: the project side still contributes zero projects, but the summary stays
// non-null because total active scope (via the institution workspace) is non-zero.
{
  const summary = buildWorkspaceScopeSummary(
    ACCOUNT_BASE,
    "user@example.com",
    [{ role: "member", status: "active", workspace: { slug: "a", name: "A", status: "active" } }],
    [
      { project_id: "p1", role: "contributor", status: "revoked" },
      { project_id: "p2", role: "contributor", status: "invited" },
      { project_id: "p3", role: "contributor", status: "suspended" },
    ],
  );
  assert.ok(summary);
  assert.equal(summary.projects.length, 0);
}

// --- hasAnyUsableMembership ------------------------------------------------------

assert.equal(hasAnyUsableMembership([], []), false);
assert.equal(hasAnyUsableMembership([{ status: "revoked" }], [{ status: "revoked" }]), false);
assert.equal(hasAnyUsableMembership([{ status: "suspended" }], []), false);
assert.equal(hasAnyUsableMembership([{ status: "invited" }], []), true, "invited must be usable (pre-activation gate)");
assert.equal(hasAnyUsableMembership([], [{ status: "active" }]), true);
assert.equal(hasAnyUsableMembership([{ status: "revoked" }], [{ status: "active" }]), true);

console.log("check_workspace_access_scope.mts: OK");
