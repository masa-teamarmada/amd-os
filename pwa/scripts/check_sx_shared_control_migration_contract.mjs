import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  path.join(scriptDir, "migrations", "259_sx_shared_project_control.sql"),
  "utf8",
);

assert.ok(!/CREATE\s+SCHEMA\s+amd_private/i.test(sql), "shared kernel must stay in public schema");
assert.ok(!/CREATE\s+TABLE[^;]+sx_(actions|decisions)/is.test(sql), "must not create a second action/decision writer");
assert.ok(!/ALTER TABLE public\.project_management_(action_items|decisions)/.test(sql));

for (const required of [
  "workspace_principals_exactly_one_source",
  "organization_membership_id UUID NOT NULL",
  "project_party_id UUID NOT NULL",
  "publication.view",
  "publication.approve",
  "project_publication_audiences",
  "project_read_published_revision_for_workspace_account",
  "project_read_published_revision_for_member",
  "project_access_memberships pam",
  "project_members pm",
  "request_fingerprint",
  "project_publish_control_revision",
  "project_control_item_from_source_ref",
  "CREATE EXTENSION IF NOT EXISTS pgcrypto",
  "workspace_record_control_mutation",
]) {
  assert.ok(sql.includes(required), `missing security contract: ${required}`);
}

assert.ok(
  /UNIQUE \(project_id, principal_id, capability\)/.test(sql),
  "phase A must prevent capability union across multiple parties",
);
assert.ok(
  /FOREIGN KEY \(organization_membership_id, organization_id, principal_id\)/.test(sql),
  "grant must bind membership, organization and principal",
);
assert.ok(
  /FOREIGN KEY \(project_party_id, project_id, organization_id\)/.test(sql),
  "grant must bind party, project and organization",
);
assert.ok(
  /FOREIGN KEY \(publication_id, project_id\)[\s\S]+project_publication_revisions/.test(sql),
  "publication children must stay in the publication project",
);
assert.ok(
  /FOREIGN KEY \(project_party_id, project_id\)[\s\S]+project_organization_parties/.test(sql),
  "publication audience must stay in the same project",
);

assert.ok(!/UPDATE\s+public\.project_publication_(revisions|items|audiences)/i.test(sql));
assert.ok(!/detail[^;]+to_jsonb\((OLD|NEW)|to_jsonb\(COALESCE\(NEW, OLD\)\)/is.test(sql));
assert.ok(!/SELECT\s+count\(\*\)\s+INTO\s+v_(principal|membership|grant)_count/i.test(sql));
assert.ok(!/p_capability/i.test(sql), "required capability must never be caller-controlled");
assert.ok(!/p_items\s+JSONB/i.test(sql), "publisher must accept source refs, not caller-authored payloads");
assert.ok(
  /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated, service_role/.test(sql),
  "service_role must not have direct table writes",
);
assert.ok(
  sql.includes("WHEN 'unassessed' THEN 'unknown'") && sql.includes("ELSE 'unknown' END"),
  "source status must be explicitly mapped and future values must fail closed to unknown",
);
assert.ok(
  /v_pillar_key IS NULL[\s\S]+v_joint IS NULL/.test(sql),
  "nullable structural publication fields must be rejected",
);

const projectLock = sql.indexOf("pg_advisory_xact_lock(hashtext('project-publication:' || p_project_id))");
const supersedesCheck = sql.indexOf("later publications must supersede the latest revision");
const revisionNumbering = sql.indexOf("SELECT COALESCE(MAX(revision), 0) + 1 INTO v_next_revision");
assert.ok(
  projectLock >= 0 && projectLock < supersedesCheck && supersedesCheck < revisionNumbering,
  "project lock must cover both lineage validation and revision numbering",
);
for (const hardeningContract of [
  "ballPartyIds must contain unique canonical UUIDs",
  "dependencyItemIds must contain unique non-empty IDs",
  "audience party IDs must be unique",
  "NOT isfinite(p_as_of)",
  "publication party display label is missing or too long",
  "project is missing or its publication name is invalid",
  "audiencePartyIds",
]) {
  assert.ok(sql.includes(hardeningContract), `missing publication hardening: ${hardeningContract}`);
}

for (const forbiddenSeed of ["ID001", "ID002", "ID003", "ID007"]) {
  assert.ok(!sql.includes(`'${forbiddenSeed}'`), `phase A foundation must not grant people implicitly: ${forbiddenSeed}`);
}

console.log("check_sx_shared_control_migration_contract.mjs: OK");
