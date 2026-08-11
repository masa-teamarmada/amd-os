import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [originGuard, listRoute, mutateRoute, sourceRoute, externalDto, externalDashboard, hub] = await Promise.all([
  read("../src/lib/workspace-mutation-origin.ts"),
  read("../src/app/api/workspace-documents/route.ts"),
  read("../src/app/api/workspace-documents/[documentId]/route.ts"),
  read("../src/app/api/workspace-documents/[documentId]/source/route.ts"),
  read("../src/lib/external-project-workspace.ts"),
  read("../src/components/project-workspace/ExternalProjectWorkspaceDashboard.tsx"),
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

assert.match(externalDto, /progressPct: number \| null/, "外部DTOは進捗未登録をnullで保持する");
assert.match(externalDto, /progressPct: progress\?\.progress_pct \?\? null/, "進捗行なしを0へ変換しない");
assert.doesNotMatch(externalDto, /progress\?\.progress_pct \|\| 0/, "外部進捗でmissingを0へ変換しない");
assert.match(externalDashboard, /milestone\.progressPct == null/, "外部画面は進捗未登録を分岐表示する");
assert.match(externalDashboard, /進捗は未登録です。/, "外部画面は未登録を明記する");

assert.match(hub, /status: "error"; projects: \[\]/, "workspace hubはPJ取得失敗を別状態で保持する");
assert.match(hub, /projectLoad\.status === "error"/, "workspace hubは取得失敗用UIを持つ");
assert.match(hub, /参加状況が0件になったわけではないよ。/, "workspace hubは取得失敗を参加0件と誤表示しない");

console.log("workspace fact and origin contract: ok");
