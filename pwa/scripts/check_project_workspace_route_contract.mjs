import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(scriptsDir, "..");
const read = (relativePath) => readFileSync(path.join(srcDir, relativePath), "utf8");

const workspacePage = read("src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx");
const legacyWeeklyPage = read("src/app/(app)/project/[projectId]/weekly-control/page.tsx");
const sxWorkspaceDashboard = read("src/components/project-workspace/SxWeeklyControlDashboard.tsx");

assert.match(workspacePage, /resolveSharedWorkspaceAccess\(projectId\)/);
assert.match(workspacePage, /if \(!access\) notFound\(\)/);
assert.match(workspacePage, /access\.principal === "workspace_account" && \(/);
assert.match(workspacePage, /externalWorkspaceRoleCapabilityLabel\(access\.role\)/);
assert.match(workspacePage, /getProjectWorkspaceBundle\(projectId, access\)/);
assert.match(workspacePage, /<SxWeeklyControlDashboard bundle=\{bundle\} access=\{access\} \/>/);
assert.match(workspacePage, /<SharedWorkspaceScopeRibbon[\s\S]*?principal="workspace_account"/);
assert.doesNotMatch(workspacePage, /if \(access\.principal === "workspace_account"\) notFound\(\)/);

assert.match(legacyWeeklyPage, /redirect\(`\/project\/\$\{encodeURIComponent\(projectId\)\}\/workspace`\)/);
assert.doesNotMatch(legacyWeeklyPage, /SxWeeklyControlDashboard|getProjectWorkspaceBundle|getCurrentMemberAccess/);

assert.doesNotMatch(sxWorkspaceDashboard, /supportsDrive/);
assert.match(sxWorkspaceDashboard, /PROJECT_WORKSPACE_GROUPS/);
assert.match(sxWorkspaceDashboard, /label: "実行"/);
assert.match(sxWorkspaceDashboard, /label: "計画・根拠"/);
assert.match(sxWorkspaceDashboard, /label: "経営・会社"/);
assert.match(sxWorkspaceDashboard, /label: "資料"/);
assert.match(sxWorkspaceDashboard, /key: "objective-structure", label: "目的構造"/);
assert.doesNotMatch(sxWorkspaceDashboard, /key: "overview", label: "PJ概要"/, "PJ概要 must remain cockpit-only");
assert.doesNotMatch(sxWorkspaceDashboard, /CockpitProjectOverview/, "PJ概要 component must not be mounted in the workspace");
assert.match(sxWorkspaceDashboard, /key: "company", label: "会社概要"/);
assert.match(sxWorkspaceDashboard, /key: "capital-policy", label: "資本政策"/);
assert.match(sxWorkspaceDashboard, /\{ key: "drive", label: "ドライブ" \}/);
assert.match(sxWorkspaceDashboard, /access\.principal === "workspace_account"/);
assert.match(sxWorkspaceDashboard, /EXTERNAL_WORKSPACE_TABS/);
assert.match(sxWorkspaceDashboard, /"themes",[\s\S]*?"gantt",[\s\S]*?"partners",[\s\S]*?"drive"/);
const externalAllowlist = sxWorkspaceDashboard.match(/const EXTERNAL_WORKSPACE_TABS = new Set<SxWeeklyControlView>\(\[([\s\S]*?)\]\);/);
assert.ok(externalAllowlist, "external workspace tab allowlist must exist");
assert.doesNotMatch(externalAllowlist[1], /"overview"|"technology"|"business-plan"|"company"|"capital-policy"|"cost"|"ip"/, "external allowlist must not include internal planning or company tabs");
assert.match(sxWorkspaceDashboard, /bundle\.themes\.length > 0 \? "themes" : "gantt"/);
assert.match(
  sxWorkspaceDashboard,
  /<WorkspaceDocumentRoom[\s\S]*scopeKind="project"[\s\S]*scopeId=\{bundle\.project\.projectId\}[\s\S]*presentation="modal"/,
  "all project drives must reuse the project document room instead of creating a second document surface",
);
assert.match(sxWorkspaceDashboard, /surface="workspace"/);
assert.match(sxWorkspaceDashboard, /aria-label="PJドライブ"/);

console.log("project workspace route contract: ok");
