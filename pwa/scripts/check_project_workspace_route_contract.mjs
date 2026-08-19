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
assert.match(workspacePage, /if \(access\.principal === "workspace_account"\) notFound\(\)/);
assert.match(workspacePage, /getProjectWorkspaceBundle\(projectId, access\)/);
assert.match(workspacePage, /<SxWeeklyControlDashboard bundle=\{bundle\} access=\{access\} \/>/);
assert.doesNotMatch(
  workspacePage,
  /ProjectWorkspaceDashboard|ExternalProjectWorkspaceDashboard|SharedProjectControlDeck|SharedWorkspaceScopeRibbon|shared-project-control/,
  "workspace route must not keep the withdrawn substitute surfaces",
);

assert.match(legacyWeeklyPage, /redirect\(`\/project\/\$\{encodeURIComponent\(projectId\)\}\/workspace`\)/);
assert.doesNotMatch(legacyWeeklyPage, /SxWeeklyControlDashboard|getProjectWorkspaceBundle|getCurrentMemberAccess/);

assert.match(sxWorkspaceDashboard, /const supportsDrive = bundle\.project\.projectId === "p21"/);
assert.match(sxWorkspaceDashboard, /key: "drive"; label: string/);
assert.match(sxWorkspaceDashboard, /label: "ドライブ"/);
assert.match(
  sxWorkspaceDashboard,
  /<WorkspaceDocumentRoom[\s\S]*scopeKind="project"[\s\S]*scopeId=\{bundle\.project\.projectId\}[\s\S]*presentation="modal"/,
  "SX drive must reuse the project document room instead of creating a second document surface",
);

console.log("project workspace route contract: ok");
