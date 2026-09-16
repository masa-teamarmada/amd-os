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
const sharedWorkspaceAccess = read("src/lib/project-shared-workspace-access.ts");
const sharedWorkspaceReadAccess = read("src/lib/shared-workspace-project-read-access.ts");

assert.match(workspacePage, /resolveSharedWorkspaceAccess\(projectId\)/);
assert.match(workspacePage, /if \(!access\) notFound\(\)/);
assert.match(workspacePage, /access\.principal === "workspace_account" && \(/);
assert.match(workspacePage, /externalWorkspaceRoleCapabilityLabel\(access\.role\)/);
assert.match(workspacePage, /getProjectWorkspaceBundle\(projectId, access\)/);
assert.match(workspacePage, /<SxWeeklyControlDashboard bundle=\{bundle\} access=\{access\} \/>/);
assert.match(workspacePage, /<SharedWorkspaceScopeRibbon[\s\S]*?principal="workspace_account"/);
assert.doesNotMatch(workspacePage, /if \(access\.principal === "workspace_account"\) notFound\(\)/);
assert.match(sharedWorkspaceAccess, /getCurrentMemberAccess/);
assert.match(sharedWorkspaceAccess, /resolveWorkspaceAccess/);
assert.match(sharedWorkspaceAccess, /InternalMemberViewerAccess \| ExternalProjectViewerAccess/);
assert.match(sharedWorkspaceReadAccess, /resolveWorkspaceAccess/);
assert.match(sharedWorkspaceReadAccess, /project\.projectId === projectId/);

for (const route of ["project-tech", "project-cost-model", "project-ip", "governance"]) {
  const source = read(`src/app/api/${route}/route.ts`);
  assert.match(source, /hasSharedWorkspaceProjectReadAccess\(projectId\)/, `${route} must recheck explicit PJ membership for shared reads`);
}

assert.match(legacyWeeklyPage, /redirect\(`\/project\/\$\{encodeURIComponent\(projectId\)\}\/workspace`\)/);
assert.doesNotMatch(legacyWeeklyPage, /SxWeeklyControlDashboard|getProjectWorkspaceBundle|getCurrentMemberAccess/);

assert.doesNotMatch(sxWorkspaceDashboard, /supportsDrive/);
assert.match(sxWorkspaceDashboard, /PROJECT_WORKSPACE_GROUPS/);
assert.match(sxWorkspaceDashboard, /label: COCKPIT_GROUP_LABELS\.progress/);
assert.match(sxWorkspaceDashboard, /label: COCKPIT_GROUP_LABELS\.businessPlan/);
assert.match(sxWorkspaceDashboard, /label: COCKPIT_GROUP_LABELS\.projectManagement/);
assert.match(sxWorkspaceDashboard, /label: COCKPIT_GROUP_LABELS\.documents/);
assert.doesNotMatch(sxWorkspaceDashboard, /label: "実行"|label: "計画・根拠"|label: "経営・会社"|label: "資料"/);
assert.doesNotMatch(sxWorkspaceDashboard, /key: "objective-structure", label: "目的構造"/);
assert.match(sxWorkspaceDashboard, /normalized === "objective-structure"\) return "gantt"/);
assert.doesNotMatch(sxWorkspaceDashboard, /key: "overview", label: "PJ概要"/, "PJ概要 must remain cockpit-only");
assert.doesNotMatch(sxWorkspaceDashboard, /CockpitProjectOverview/, "PJ概要 component must not be mounted in the workspace");
assert.match(sxWorkspaceDashboard, /key: "company", label: "会社概要"/);
assert.match(sxWorkspaceDashboard, /key: "capital-policy", label: "資本政策"/);
assert.match(sxWorkspaceDashboard, /\{ key: "drive", label: "ドライブ" \}/);
assert.match(sxWorkspaceDashboard, /access\.principal === "workspace_account"/);
assert.match(sxWorkspaceDashboard, /EXTERNAL_WORKSPACE_TABS/);
const externalAllowlist = sxWorkspaceDashboard.match(/const EXTERNAL_WORKSPACE_TABS = new Set<SxWeeklyControlView>\(\[([\s\S]*?)\]\);/);
assert.ok(externalAllowlist, "external workspace tab allowlist must exist");
for (const tab of ["technology", "competition", "business-model", "business-plan", "cost", "cost-fuel", "ip", "capital-policy"]) {
  assert.match(externalAllowlist[1], new RegExp(`"${tab}"`), `external workspace must expose ${tab}`);
}
assert.doesNotMatch(externalAllowlist[1], /"overview"|"company"/, "PJ概要と会社概要は cockpit-only");
assert.match(sxWorkspaceDashboard, /\(externalViewer \|\| isZmpWorkspace \? "issues" : "weekly"\)/);
assert.doesNotMatch(sxWorkspaceDashboard, /"themes"/, "retired theme tab must not return");
assert.match(
  sxWorkspaceDashboard,
  /<WorkspaceDocumentRoom[\s\S]*scopeKind="project"[\s\S]*scopeId=\{bundle\.project\.projectId\}[\s\S]*presentation="modal"/,
  "all project drives must reuse the project document room instead of creating a second document surface",
);
assert.match(sxWorkspaceDashboard, /surface="workspace"/);
assert.match(sxWorkspaceDashboard, /aria-label="PJドライブ"/);

console.log("project workspace route contract: ok");
