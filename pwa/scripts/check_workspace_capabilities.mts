import assert from "node:assert/strict";
import {
  externalWorkspaceRoleCapabilityLabel,
  hasWorkspaceCapability,
  workspaceCapabilities,
} from "../src/lib/workspace-capabilities.ts";

const projectManager = workspaceCapabilities({ principal: "workspace_account", scopeKind: "project", role: "manager" });
assert.equal(hasWorkspaceCapability(projectManager, "document.upload"), true);
assert.equal(hasWorkspaceCapability(projectManager, "document.manage"), true);
assert.equal(hasWorkspaceCapability(projectManager, "project.manage_shared"), false);
assert.equal(hasWorkspaceCapability(projectManager, "membership.manage"), false);

const projectContributor = workspaceCapabilities({ principal: "workspace_account", scopeKind: "project", role: "contributor" });
assert.equal(hasWorkspaceCapability(projectContributor, "document.upload"), true);
assert.equal(hasWorkspaceCapability(projectContributor, "document.manage"), false);
assert.equal(externalWorkspaceRoleCapabilityLabel("manager"), "資料管理・PJ閲覧");
assert.equal(externalWorkspaceRoleCapabilityLabel("contributor"), "資料追加・PJ閲覧");

const institutionOwner = workspaceCapabilities({ principal: "workspace_account", scopeKind: "institution", role: "owner" });
assert.equal(hasWorkspaceCapability(institutionOwner, "document.manage"), true);
assert.equal(hasWorkspaceCapability(institutionOwner, "organization.confirm_sovereign"), false);

for (const scopeKind of ["institution", "project"] as const) {
  const readonly = workspaceCapabilities({ principal: "workspace_account", scopeKind, role: "readonly" });
  assert.equal(hasWorkspaceCapability(readonly, "workspace.view"), true);
  assert.equal(hasWorkspaceCapability(readonly, "document.view_shared"), true);
  assert.equal(hasWorkspaceCapability(readonly, "document.upload"), false);
  assert.equal(hasWorkspaceCapability(readonly, "document.view_internal"), false);
}

const amdAdmin = workspaceCapabilities({ principal: "internal_member", scopeKind: "project", role: "admin" });
assert.equal(hasWorkspaceCapability(amdAdmin, "document.view_internal"), true);
assert.equal(hasWorkspaceCapability(amdAdmin, "membership.manage"), true);

const portfolioMember = workspaceCapabilities({ principal: "internal_member", scopeKind: "project", role: "portfolio_member" });
assert.equal(hasWorkspaceCapability(portfolioMember, "document.view_internal"), true);
assert.equal(hasWorkspaceCapability(portfolioMember, "document.upload"), false);

console.log("workspace capabilities: ok");
