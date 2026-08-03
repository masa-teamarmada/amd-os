import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  access: new URL("../src/lib/workspace-document-access.ts", import.meta.url),
  list: new URL("../src/app/api/workspace-documents/route.ts", import.meta.url),
  mutate: new URL("../src/app/api/workspace-documents/[documentId]/route.ts", import.meta.url),
  open: new URL("../src/app/api/workspace-documents/[documentId]/open/route.ts", import.meta.url),
  render: new URL("../src/app/api/workspace-documents/[documentId]/render/route.ts", import.meta.url),
  pdf: new URL("../src/app/api/workspace-documents/[documentId]/pdf/route.ts", import.meta.url),
  htmlPdf: new URL("../src/lib/workspace-document-html-pdf.ts", import.meta.url),
  serializer: new URL("../src/lib/workspace-documents-server.ts", import.meta.url),
  middleware: new URL("../src/lib/supabase/middleware.ts", import.meta.url),
  institutionPage: new URL("../src/app/workspace/[slug]/files/page.tsx", import.meta.url),
  projectPage: new URL("../src/app/(shared-workspace)/project/[projectId]/workspace/files/page.tsx", import.meta.url),
  room: new URL("../src/components/workspace-documents/WorkspaceDocumentRoom.tsx", import.meta.url),
  cockpit: new URL("../src/components/cockpit/CockpitView.tsx", import.meta.url),
  nextConfig: new URL("../next.config.ts", import.meta.url),
};

const source = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, url]) => [key, await readFile(url, "utf8")])));

assert.match(source.access, /resolveSharedWorkspaceAccess\(projectId\)/, "PJ資料は共有workspaceの明示アクセスを再利用する");
assert.match(source.access, /scope\.institutionWorkspaces\.find/, "機関資料は機関membershipを明示確認する");
assert.doesNotMatch(source.access, /institutionWorkspaces.*project_access/s, "機関membershipからPJ権限を自動生成しない");
assert.match(source.list, /!access\.canReadInternal.*visibility.*workspace_shared/s, "外部一覧は共有資料だけに絞る");
assert.match(source.open, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "open routeも内部資料を404にする");
assert.match(source.open, /createSignedUrl\(row\.storage_path, 60/, "private fileは60秒の署名URLで開く");
assert.match(source.render, /resolveDocumentRowAccess\(db, row\)/, "HTML表示も資料ごとの権限を再確認する");
assert.match(source.render, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "HTML表示も内部資料を404にする");
assert.match(source.render, /isWorkspaceDocumentHtml\(row\.mime_type, row\.display_name\)/, "HTMLだけを専用表示で返す");
assert.match(source.render, /WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES/, "HTML表示の読込量を制限する");
assert.match(source.render, /default-src 'none';[\s\S]*sandbox/, "HTML表示はscriptを許可しないsandbox CSPを返す");
assert.match(source.render, /Content-Type": "text\/html; charset=utf-8"/, "HTML表示は正しいMIMEで返す");
assert.match(source.pdf, /resolveDocumentRowAccess\(db, row\)/, "HTML PDF化も資料ごとの権限を再確認する");
assert.match(source.pdf, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "HTML PDF化も内部資料を404にする");
assert.match(source.pdf, /isWorkspaceDocumentHtml\(row\.mime_type, row\.display_name\)/, "HTMLだけをPDF化する");
assert.match(source.pdf, /WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES/, "HTML PDF化の入力量を制限する");
assert.match(source.pdf, /WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES/, "HTML PDF化の出力量を制限する");
assert.match(source.pdf, /renderWorkspaceDocumentHtmlToPdf/, "HTMLは専用の安全PDF変換を通す");
assert.match(source.pdf, /Content-Type": "application\/pdf"/, "HTML PDF化はPDFとして返す");
assert.match(source.pdf, /Content-Disposition.*attachment/, "HTML PDF化はブラウザ表示でなく保存する");
assert.match(source.htmlPdf, /page\.setJavaScriptEnabled\(false\)/, "HTML PDF化ではscriptを実行しない");
assert.match(source.htmlPdf, /page\.setRequestInterception\(true\)/, "HTML PDF化では外部通信を遮断する");
assert.match(source.htmlPdf, /request\.url\(\)\.startsWith\("data:"\)/, "HTML PDF化は埋込dataだけを許可する");
assert.match(source.htmlPdf, /format: "A4"/, "HTML PDF化はA4で組版する");
assert.match(source.room, /\/render`/, "HTMLの資料名クリックは安全表示を開く");
assert.match(source.room, /async function downloadHtmlAsPdf/, "PDF化ダウンロードはfetchで失敗を検知するhandlerを持つ");
assert.match(source.room, /item\.entryKind === "file" && isWorkspaceDocumentHtml\(item\.mimeType, item\.displayName\)\s*\?\s*\(\s*<a[\s\S]*?\/render`/, "保存済みHTMLの資料名クリックは安全表示を開く");
assert.match(source.room, /"PDF化ダウンロード"/, "HTMLの右端操作はPDF化ダウンロードと明示する");
assert.match(source.room, /open\?download=1/, "非HTMLの右端操作はダウンロードlinkのまま");
assert.match(source.room, /<button[\s\S]*?downloadHtmlAsPdf/, "右端のPDF化ダウンロードだけが変換handlerを呼ぶ");
assert.match(source.room, /setError\(\s*\n?\s*cause instanceof Error \? cause\.message : "PDFを生成できなかったよ。"/, "PDF化失敗はrole=alertへ日本語エラーを出し、JSON画面へは遷移しない");
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

assert.match(
  source.nextConfig,
  /"\/api\/workspace-documents\/\*\/pdf":\s*\[[^\]]*@fontsource-variable\/noto-sans-jp[^\]]*\]/s,
  "HTML PDF化routeはNotoフォント本体をbuildへ明示同梱する",
);
assert.match(
  source.nextConfig,
  /"\/api\/workspace-documents\/\*\/pdf":\s*\[[^\]]*@sparticuz\/chromium\/bin[^\]]*\]/s,
  "HTML PDF化routeは@sparticuz/chromiumの実行バイナリ(bin/*.br)をbuildへ明示同梱する(無いと本番でbrotli展開できずPDF生成が全滅する)",
);
assert.doesNotMatch(source.nextConfig, /workspace-documents\/\[documentId\]\/pdf\/route/, "output tracingはroute source pathでなく実行route globを使う");

console.log("workspace documents contract: ok");
