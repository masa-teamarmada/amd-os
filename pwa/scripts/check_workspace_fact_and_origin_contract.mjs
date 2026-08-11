import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [originGuard, listRoute, mutateRoute, sourceRoute, workspacePage, weeklyControlPage, hub] = await Promise.all([
  read("../src/lib/workspace-mutation-origin.ts"),
  read("../src/app/api/workspace-documents/route.ts"),
  read("../src/app/api/workspace-documents/[documentId]/route.ts"),
  read("../src/app/api/workspace-documents/[documentId]/source/route.ts"),
  read("../src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx"),
  read("../src/app/(app)/project/[projectId]/weekly-control/page.tsx"),
  read("../src/app/workspaces/page.tsx"),
]);

assert.match(originGuard, /new URL\(originHeader\)\.origin !== expectedOrigin/, "Originは完全一致で検証する");
assert.match(originGuard, /fetchSite !== "same-origin"/, "cross-site Fetch Metadataを拒否する");
assert.match(originGuard, /if \(!referer\) return false/, "OriginとFetch Metadataが無いrequestをfail closedにする");

for (const [label, source] of [
  ["POST /api/workspace-documents", listRoute],
  ["PATCH /api/workspace-documents/[documentId]", mutateRoute],
  ["PUT /api/workspace-documents/[documentId]/source", sourceRoute],
]) {
  assert.match(source, /isSameOriginWorkspaceMutation\(request\)/, `${label}はsame-origin guardを通す`);
}
const htmlGetBlock = sourceRoute.slice(sourceRoute.indexOf("export async function GET("), sourceRoute.indexOf("export async function PUT("));
const htmlPutBlock = sourceRoute.slice(sourceRoute.indexOf("export async function PUT("));
assert.doesNotMatch(htmlGetBlock, /isSameOriginWorkspaceMutation/, "HTML本文のreadはmutation origin guardの対象にしない");
assert.match(htmlPutBlock, /isSameOriginWorkspaceMutation\(request\)/, "HTML本文の保存だけをsame-origin guard対象にする");

assert.match(workspacePage, /SxWeeklyControlDashboard/, "PJ workspaceは現行週次管制を本体にする");
assert.match(workspacePage, /access\.principal === "workspace_account"\) notFound\(\)/, "未完成の外部代替画面はfail closedにする");
assert.doesNotMatch(workspacePage, /SharedProjectControlDeck|ExternalProjectWorkspaceDashboard|SharedWorkspaceScopeRibbon|getExternalProjectWorkspacePublication/, "撤回した共通deckや旧帯をworkspaceへ戻さない");
assert.match(weeklyControlPage, /redirect\(`\/project\/\$\{encodeURIComponent\(projectId\)\}\/workspace`\)/, "旧weekly-control URLは正本workspaceへ一本化する");

assert.match(hub, /status: "error"; projects: \[\]/, "workspace hubはPJ取得失敗を別状態で保持する");
assert.match(hub, /projectLoad\.status === "error"/, "workspace hubは取得失敗用UIを持つ");
assert.match(hub, /参加状況が0件になったわけではないよ。/, "workspace hubは取得失敗を参加0件と誤表示しない");

console.log("workspace fact and origin contract: ok");
