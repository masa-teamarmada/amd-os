import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  access: new URL("../src/lib/workspace-document-access.ts", import.meta.url),
  list: new URL("../src/app/api/workspace-documents/route.ts", import.meta.url),
  mutate: new URL("../src/app/api/workspace-documents/[documentId]/route.ts", import.meta.url),
  open: new URL("../src/app/api/workspace-documents/[documentId]/open/route.ts", import.meta.url),
  render: new URL("../src/app/api/workspace-documents/[documentId]/render/route.ts", import.meta.url),
  serializer: new URL("../src/lib/workspace-documents-server.ts", import.meta.url),
  middleware: new URL("../src/lib/supabase/middleware.ts", import.meta.url),
  institutionPage: new URL("../src/app/workspace/[slug]/files/page.tsx", import.meta.url),
  projectPage: new URL("../src/app/(shared-workspace)/project/[projectId]/workspace/files/page.tsx", import.meta.url),
  room: new URL("../src/components/workspace-documents/WorkspaceDocumentRoom.tsx", import.meta.url),
  cockpit: new URL("../src/components/cockpit/CockpitView.tsx", import.meta.url),
};

const source = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, url]) => [key, await readFile(url, "utf8")])));

assert.match(source.access, /resolveSharedWorkspaceAccess\(projectId\)/, "PJ資料は共有workspaceの明示アクセスを再利用する");
assert.match(source.access, /scope\.institutionWorkspaces\.find/, "機関資料は機関membershipを明示確認する");
assert.doesNotMatch(source.access, /institutionWorkspaces.*project_access/s, "機関membershipからPJ権限を自動生成しない");
assert.match(source.list, /!access\.canReadInternal.*visibility.*workspace_shared/s, "外部一覧は共有資料だけに絞る");
assert.match(source.open, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "open routeも内部資料を404にする");
assert.match(source.open, /createSignedUrl\(row\.storage_path, 60/, "private fileは60秒の署名URLで開く");
assert.match(source.render, /resolveDocumentRowAccess\(db, row\)/, "HTML previewも資料ごとの権限を再確認する");
assert.match(source.render, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "HTML previewも内部資料を404にする");
assert.match(source.render, /isWorkspaceDocumentHtml\(row\.mime_type\)/, "HTMLだけを専用previewで返す");
assert.match(source.render, /WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES/, "HTML previewの読込量を制限する");
assert.match(source.render, /default-src 'none';[\s\S]*sandbox/, "HTML previewはscriptを許可しないsandbox CSPを返す");
assert.match(source.render, /Content-Type": "text\/html; charset=utf-8"/, "HTML previewは正しいMIMEで返す");
assert.match(source.room, /\/render`/, "HTMLの資料名クリックは安全previewを開く");
assert.match(source.room, /isWorkspaceDocumentHtml\(item\.mimeType\)[\s\S]*\/render`[\s\S]*open\?download=1/, "HTMLの右端操作も安全previewを開く");
assert.match(source.room, /item\.entryKind === "link" \|\| isWorkspaceDocumentHtml\(item\.mimeType\)/, "HTMLの右端操作はダウンロードでなく開くと明示する");
assert.doesNotMatch(source.serializer.split("export function publicWorkspaceDocument")[1], /storage_path|external_url/, "一覧DTOに保存先や外部URLを含めない");
assert.doesNotMatch(source.mutate, /\.remove\(/, "archiveで実ファイルを削除しない");
assert.match(source.list, /workspaceDocumentDestinationStatus/, "作成時に保存先folderと共有境界を検証する");
assert.match(source.mutate, /workspaceDocumentDestinationStatus/, "整理時に保存先folderと共有境界を検証する");
assert.match(source.mutate, /workspaceDocumentFolderHasSharedDescendants/, "共有資料を含むfolderの内部化を一括露出変更なしで止める");
assert.match(source.institutionPage, /resolveInstitutionDocumentAccess\(slug\)/, "機関資料pageはslug accessを再検証する");
assert.match(source.projectPage, /resolveProjectDocumentAccess\(projectId\)/, "PJ資料pageはproject accessを再検証する");
assert.match(source.projectPage, /access\.principal === "internal_member"[\s\S]*\/cockpit/, "内部メンバーは資料室からcockpitへ戻る");
assert.match(source.projectPage, /PJ概要へ戻る/, "外部メンバーは資料室から共有PJ概要へ戻る");
assert.match(source.middleware, /workspace\(\?:\\\/files\)\?/, "外部workspace sessionでPJ資料室routeへ到達できる");
assert.match(source.cockpit, /<WorkspaceDocumentLauncher/, "cockpitは資料一覧でなく資料室launcherを置く");
assert.doesNotMatch(source.cockpit, /WorkspaceDocumentSummary/, "cockpitの資料サマリ一覧を復活させない");
assert.match(source.room, /data-testid="workspace-document-launcher"/, "資料室launcherを操作契約として固定する");
assert.match(source.room, /data-testid="workspace-document-modal"/, "資料室はcockpit内modalで開く");
assert.match(source.room, /presentation="modal"/, "modal内の資料室は専用presentationを使う");
assert.doesNotMatch(source.room, /const latest =|slice\(0, 3\)/, "cockpit launcherで最新資料一覧を先読みしない");

console.log("workspace documents contract: ok");
