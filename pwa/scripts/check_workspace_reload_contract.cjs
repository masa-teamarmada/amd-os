const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const assertIncludes = (relative, source, values) => {
  const missing = values.filter((value) => !source.includes(value));
  if (missing.length) throw new Error(`${relative} missing: ${missing.join(", ")}`);
};
const assertNotIncludes = (relative, source, values) => {
  const present = values.filter((value) => source.includes(value));
  if (present.length) throw new Error(`${relative} must not include: ${present.join(", ")}`);
};

const loadingFile = "src/app/(shared-workspace)/project/[projectId]/workspace/loading.tsx";
const loading = read(loadingFile);
assertIncludes(loadingFile, loading, [
  "amd-workspace-page-skin",
  "bg-[#dbeafe]",
  "border-[#d2d2d7] bg-white",
]);
assertNotIncludes(loadingFile, loading, [
  "amd-desk-page-skin",
  "#e4ddd0",
  "#f8f5ec",
]);

const workspaceFile = "src/lib/project-workspace.ts";
const workspace = read(workspaceFile);
assertIncludes(workspaceFile, workspace, [
  "const getWorkspaceIdentityCached = unstable_cache(",
  '["project-workspace-identity-v1"]',
  "{ revalidate: 60 }",
  "const [identity,",
  "getWorkspaceIdentityCached(projectId)",
  "getSxManagementBundle(projectId, canManage)",
]);
const fanOutStart = workspace.indexOf("const [identity,");
const fanOutEnd = workspace.indexOf("]);", fanOutStart);
const managementCall = workspace.indexOf("getSxManagementBundle(projectId, canManage)", fanOutStart);
if (fanOutStart < 0 || fanOutEnd < 0 || managementCall < fanOutStart || managementCall > fanOutEnd) {
  throw new Error(`${workspaceFile}: management projection must stay inside the initial Promise.all fan-out`);
}

console.log("workspace reload contract: ok");
