import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("./migrations/264_workspace_project_publication_access_rpc.sql", import.meta.url), "utf8");

for (const required of [
  "workspace_admin_grant_institution_project_access",
  "workspace_admin_project_publication_context",
  "SECURITY DEFINER",
  "project_access_memberships",
  "workspace_principals",
  "workspace_organizations",
  "workspace_organization_memberships",
  "project_organization_parties",
  "project_principal_grants",
  "publication.view",
  "publication.approve",
  "workspace_access_audit_logs",
  "workspace_control_audit_logs",
  "request_fingerprint",
  "GRANT EXECUTE",
]) {
  assert.ok(sql.includes(required), `missing migration contract: ${required}`);
}

assert.match(sql, /v_institution_membership_status NOT IN \('invited', 'active'\)/);
assert.match(sql, /p_membership_status NOT IN \('invited', 'active'\)/);
assert.match(sql, /v_existing_status <> 'active'[\s\S]*publication view grant is revoked/);
assert.match(sql, /p\.project_id = p_project_id[\s\S]*p\.organization_id = v_amd_organization_id/);
assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
assert.match(sql, /ARRAY\['publication\.view', 'publication\.approve'\]/);
assert.match(sql, /project_active_publication_parties\([\s\S]*'publication\.approve'/);
assert.match(sql, /workspace_admin_project_publication_context\([\s\S]*active exact-project AMD admin is required/);
assert.doesNotMatch(sql, /institution_workspace_project_scopes[\s\S]*(INSERT|UPDATE)/i);
assert.doesNotMatch(sql, /p_project_id\s*=\s*'p21'/i);

console.log("workspace project publication access migration contract: ok");
