// Static contract for the workspace_account project read boundary.
// External viewers must pass both the legacy exact-project membership gate and the new
// principal/party/grant publication gate, then see only a sealed publication snapshot.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pwaDir = path.join(scriptDir, "..");
const srcDir = path.join(pwaDir, "src");

const pageSource = readFileSync(
  path.join(srcDir, "app", "(shared-workspace)", "project", "[projectId]", "workspace", "page.tsx"),
  "utf8",
);
const externalSource = readFileSync(path.join(srcDir, "lib", "external-project-workspace.ts"), "utf8");
const serverSource = readFileSync(path.join(srcDir, "lib", "shared-project-control-server.ts"), "utf8");
const dashboardSource = readFileSync(
  path.join(srcDir, "components", "project-workspace", "ExternalProjectWorkspaceDashboard.tsx"),
  "utf8",
);
const migrationSource = readFileSync(
  path.join(pwaDir, "scripts", "migrations", "259_sx_shared_project_control.sql"),
  "utf8",
);

const branchStart = pageSource.indexOf('access.principal === "workspace_account"');
const memberBundleCall = pageSource.indexOf("getProjectWorkspaceBundle(projectId, access)");
assert.ok(branchStart >= 0, "page must branch on the workspace_account principal");
assert.ok(memberBundleCall > branchStart, "the internal bundle call must remain after the external branch");

const externalBranch = pageSource.slice(branchStart, memberBundleCall);
assert.match(externalBranch, /getExternalProjectWorkspacePublication\(\{[\s\S]*accountId: access\.accountId,[\s\S]*projectId,/);
assert.match(externalBranch, /if \(!publication\) notFound\(\)/, "denied publication reads must be generic not-found");
assert.match(externalBranch, /publication\.state === "published"[\s\S]*: "共有PJ"/, "unpublished external pages must not reveal the internal project name");
assert.doesNotMatch(externalBranch, /getProjectWorkspaceBundle|SxManagementBundle|\.from\(/);

assert.match(externalSource, /getSharedProjectControlForWorkspaceAccount/);
assert.doesNotMatch(externalSource, /\.from\(|createAdminClient|getProjectWorkspaceBundle|getSxManagementBundle/);

assert.match(serverSource, /\.rpc\(rpcName, args\)/, "publication read must be one DB RPC");
assert.match(serverSource, /if \(error\) throw new Error/, "DB errors must fail closed");
assert.match(serverSource, /parseSharedProjectControlPublication\(data\)/, "RPC payload must pass the strict parser");
assert.doesNotMatch(serverSource, /\.from\(/, "the publication loader must not read mutable internal tables");

assert.match(dashboardSource, /SharedProjectControlDeck/);
assert.match(dashboardSource, /publication\.state === "published"/);
assert.doesNotMatch(
  dashboardSource,
  /ProjectWorkspaceBundle|SxManagement|member_activities|project_weekly_effort|planned_hours|actual_hours/,
  "external UI must not import or render internal management/member/effort data",
);

for (const table of [
  "projects",
  "value_plan_cycles",
  "value_milestones",
  "milestone_monthly_progress",
]) {
  assert.doesNotMatch(externalSource, new RegExp(`\\.from\\(\\"${table}\\"\\)`));
  assert.doesNotMatch(serverSource, new RegExp(`\\.from\\(\\"${table}\\"\\)`));
}

assert.match(migrationSource, /REVOKE ALL ON FUNCTION public\.project_read_published_revision_for_workspace_account[\s\S]*FROM PUBLIC, anon, authenticated/);
assert.match(migrationSource, /GRANT EXECUTE ON FUNCTION public\.project_read_published_revision_for_workspace_account[\s\S]*TO service_role/);
assert.match(migrationSource, /'project_publication_revisions'[\s\S]*'project_publication_items'[\s\S]*'project_publication_audiences'/);
assert.match(migrationSource, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated, service_role/);

console.log("check_external_project_workspace_contract.mjs: OK");
