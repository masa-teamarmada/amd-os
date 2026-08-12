import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const institutionPage = read("src", "app", "workspace", "[slug]", "project", "[projectId]", "page.tsx");
const institutionReader = read("src", "lib", "institution-project-control-server.ts");
const institutionView = read("src", "components", "workspace", "InstitutionProjectControlView.tsx");
const institutionIndex = read("src", "app", "workspace", "[slug]", "page.tsx");
const cockpit = read("src", "components", "cockpit", "CockpitView.tsx");
const cockpitControl = read("src", "components", "cockpit", "CockpitSharedProjectControl.tsx");
const publicationRoute = read("src", "app", "api", "project", "[projectId]", "shared-publication", "route.ts");
const cockpitCss = read("src", "components", "cockpit", "cockpit-shared-project-control.module.css");
const institutionCss = read("src", "components", "workspace", "institution-project-control.module.css");

// Institution route is an independent role lens, not the PJ workspace mounted elsewhere.
assert.match(institutionPage, /getInstitutionProjectControl\(slug, projectId\)/);
assert.doesNotMatch(institutionPage, /getProjectWorkspaceBundle|SxWeeklyControlDashboard|SxExecutiveControlDeck/);
assert.match(institutionReader, /scope\.institutionWorkspaces\.find\([\s\S]*candidate\.slug === slug/);
assert.match(institutionReader, /scope\.projects\.find\([\s\S]*candidate\.projectId === projectId/);
assert.match(institutionReader, /project_read_published_revision_for_workspace_account/);
assert.match(institutionReader, /parseSharedProjectControlPublication\(rawPublication\)/);
assert.match(institutionReader, /parsed\.state === "unauthorized"/);

// External content must stop at the immutable publication boundary.
assert.match(institutionView, /AMD内部の最新値や下書きは代わりに表示していない/);
assert.match(institutionView, /古い版や内部データへ切り替えず表示を止めている/);
assert.match(institutionView, /data-decision-frame="institution-project-control"/);
assert.doesNotMatch(institutionView, /internalDraft|SxManagementBundle|fetch\(|project_management_/);

// Every rich PJ link in an institution workspace enters the institution lens.
assert.match(institutionIndex, /href={`\/workspace\/\$\{encodeURIComponent\(slug\)\}\/project\/\$\{encodeURIComponent\(project\.projectId\)\}`}/);
assert.doesNotMatch(institutionIndex, /href={`\/project\/\$\{encodeURIComponent\(project\.projectId\)\}\/workspace`}/);

// AMD cockpit consumes the same live management source as the existing PJ workspace,
// while preserving the existing workspace as the editing/detail surface.
assert.match(cockpit, /project\.projectId === "p21"[\s\S]*CockpitSharedProjectControl/);
assert.match(cockpitControl, /\/api\/project-workspace\/\$\{encodeURIComponent\(projectId\)\}/);
for (const source of ["milestones", "issues", "decisions", "actions", "partnerWorkItems", "tracks"]) {
  assert.ok(cockpitControl.includes(`bundle.${source}`), `cockpit must derive ${source} from the canonical workspace bundle`);
}
assert.match(cockpitControl, /href={`\/project\/\$\{encodeURIComponent\(projectId\)\}\/workspace`}/);
assert.match(cockpitControl, /大学・SU側には、ここから承認された共有版だけを表示する/);
assert.match(publicationRoute, /canAccessWorkspaceProject\(access, projectId\)/);
assert.match(publicationRoute, /if \(!access\.isAdmin\) return invalid\("forbidden", 403\)/);
assert.match(publicationRoute, /workspace_admin_project_publication_context/);
assert.match(publicationRoute, /project_publish_control_revision/);
assert.match(publicationRoute, /new Set\(\[\.\.\.context\.actorPartyIds, \.\.\.audiencePartyIds\]\)/);
assert.match(publicationRoute, /context\.latestRevision\?\.id \?\? null/);
assert.doesNotMatch(publicationRoute, /\.from\("project_publication_(revisions|items|audiences)"\)\.(insert|update|delete)/);

// The new surfaces have explicit mobile/tablet contracts and no legacy amber shell.
assert.match(cockpitCss, /@media \(max-width: 980px\)/);
assert.match(cockpitCss, /@media \(max-width: 560px\)/);
assert.match(institutionCss, /@media \(max-width: 860px\)/);
assert.match(institutionCss, /@media \(max-width: 520px\)/);
assert.doesNotMatch(institutionCss, /#f59e0b|amber/i);

console.log("three-lens project control runtime contract: ok");
