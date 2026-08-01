// Static structural contract test for the external (workspace_account) shared-workspace
// read path. No DB, no Next.js runtime — pure source-text checks so the guarantees below
// can never silently regress:
//   1. workspace_account never reaches getProjectWorkspaceBundle (the full internal bundle).
//   2. external-project-workspace.ts only selects its allowlisted columns, table by table.
//   3. forbidden fields (member identity/effort/evidence/internal management/contact) never
//      appear anywhere in the external DTO source or its dashboard component.
// Run: npm run test:external-project-workspace

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(scriptDir, "..", "src");

const dtoSource = readFileSync(path.join(srcDir, "lib", "external-project-workspace.ts"), "utf8");
const pageSource = readFileSync(
  path.join(srcDir, "app", "(shared-workspace)", "project", "[projectId]", "workspace", "page.tsx"),
  "utf8",
);
const dashboardSource = readFileSync(
  path.join(srcDir, "components", "project-workspace", "ExternalProjectWorkspaceDashboard.tsx"),
  "utf8",
);

// --- 1. workspace_account branch structure --------------------------------------------

const branchStart = pageSource.indexOf('access.principal === "workspace_account"');
assert.ok(branchStart >= 0, "page.tsx must branch on access.principal === \"workspace_account\"");
const memberBundleCallIndex = pageSource.indexOf("getProjectWorkspaceBundle(projectId, access)");
assert.ok(memberBundleCallIndex >= 0, "page.tsx must still call getProjectWorkspaceBundle for the member branch");
assert.ok(
  memberBundleCallIndex > branchStart,
  "getProjectWorkspaceBundle must be called only after (outside) the workspace_account branch",
);

const workspaceAccountBranch = pageSource.slice(branchStart, memberBundleCallIndex);
assert.ok(
  !workspaceAccountBranch.includes("getProjectWorkspaceBundle"),
  "the workspace_account branch must never call getProjectWorkspaceBundle",
);
assert.ok(
  workspaceAccountBranch.includes("getExternalProjectWorkspaceBundle"),
  "the workspace_account branch must call getExternalProjectWorkspaceBundle",
);
assert.ok(
  workspaceAccountBranch.includes("ExternalProjectWorkspaceDashboard"),
  "the workspace_account branch must render ExternalProjectWorkspaceDashboard",
);
assert.ok(
  !workspaceAccountBranch.includes("<ProjectWorkspaceDashboard"),
  "the workspace_account branch must never render the internal ProjectWorkspaceDashboard",
);

// --- 2. external-project-workspace.ts never calls into the internal bundle -------------
// (the doc-comment at the top of this file legitimately mentions these names in prose to
// warn against using them — only the import/call forms below are actual violations)

assert.ok(
  !dtoSource.includes('from "@/lib/project-workspace"') && !dtoSource.includes("getProjectWorkspaceBundle("),
  "external-project-workspace.ts must never import or call getProjectWorkspaceBundle",
);
assert.ok(
  !dtoSource.includes("getSxManagementBundle("),
  "external-project-workspace.ts must never call getSxManagementBundle (internal management data)",
);

// --- 3. select() allowlist, table by table ----------------------------------------------

const ALLOWED_SELECTS = {
  projects: ["project_id", "project_name", "status"],
  value_plan_cycles: ["plan_cycle_id", "status", "period_start_ym", "period_end_ym"],
  value_milestones: ["milestone_id", "title", "target_ym", "sort_order", "is_active"],
  milestone_monthly_progress: ["milestone_key", "ym", "progress_pct"],
};

function extractSelect(source, table) {
  const pattern = new RegExp(`\\.from\\("${table}"\\)\\s*\\.select\\("([^"]+)"\\)`, "g");
  const matches = [...source.matchAll(pattern)];
  assert.ok(matches.length > 0, `expected at least one .from("${table}").select(...) in external-project-workspace.ts`);
  return matches.map((match) => match[1].split(","));
}

for (const [table, allowedColumns] of Object.entries(ALLOWED_SELECTS)) {
  const selects = extractSelect(dtoSource, table);
  for (const columns of selects) {
    for (const column of columns) {
      assert.ok(
        allowedColumns.includes(column),
        `column "${column}" selected from "${table}" is not in the allowlist [${allowedColumns.join(", ")}]`,
      );
    }
    assert.equal(
      columns.length,
      allowedColumns.length,
      `select("${columns.join(",")}") on "${table}" must select exactly the allowlisted columns [${allowedColumns.join(", ")}]`,
    );
  }
}

// Every .from(...) call in the file must target one of the four allowed tables — this catches
// a future silent addition of a fifth table (e.g. members, member_activities) that the
// allowlist loop above would otherwise never inspect.
const referencedTables = [...dtoSource.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]);
for (const table of referencedTables) {
  assert.ok(
    Object.prototype.hasOwnProperty.call(ALLOWED_SELECTS, table),
    `external-project-workspace.ts queries table "${table}", which is not in the allowlisted table set`,
  );
}

// --- 4. forbidden terms never appear in the external DTO or its dashboard --------------
// Doc comments legitimately name these terms in prose to warn against them, so the check
// runs against code lines only (comment-only lines are stripped first).

function stripLineComments(source) {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const FORBIDDEN_TERM_PATTERN = new RegExp(
  [
    "member_id", "code_name", "member_name", "display_name", "displayName",
    "evidence", "raw_metadata", "source_cache", "member_activities",
    "project_weekly_effort", "planned_hours", "actual_hours", "calendar_hours", "entered_hours",
    "hypothesis", "\\bissue\\b", "decision", "funding", "contact", "\\bemail\\b",
    "sxManagement", "SxManagement",
  ].join("|"),
  "i",
);

for (const [label, source] of [
  ["external-project-workspace.ts", stripLineComments(dtoSource)],
  ["ExternalProjectWorkspaceDashboard.tsx", stripLineComments(dashboardSource)],
]) {
  const match = source.match(FORBIDDEN_TERM_PATTERN);
  assert.equal(match, null, `${label} must not reference forbidden term "${match?.[0]}"`);
}

console.log("check_external_project_workspace_contract.mjs: OK");
