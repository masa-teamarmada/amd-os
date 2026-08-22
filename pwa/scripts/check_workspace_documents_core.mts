import assert from "node:assert/strict";
import {
  documentBaseName,
  documentParentPath,
  isWorkspaceDocumentHtml,
  isWorkspaceDocumentMarkdown,
  joinDocumentFolderPath,
  normalizeWorkspaceDocumentHtmlSource,
  normalizeDocumentFolderPath,
  normalizeDocumentName,
  normalizeDocumentVisibility,
  WORKSPACE_DOCUMENT_ASSET_MAX_BYTES,
  WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX,
  WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES,
  WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION,
  WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES,
  WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES,
  workspaceDocumentAssetStoragePathFromBase,
  WORKSPACE_DOCUMENT_PDF_DOWNLOAD_URL_TTL_SECONDS,
  workspaceDocumentFinderCopyName,
  workspaceDocumentHtmlSourceByteLength,
  workspaceDocumentNameKey,
  workspaceDocumentPdfCacheStoragePath,
  workspaceDocumentPdfDownloadName,
  normalizeHttpUrl,
  workspaceDocumentStoragePath,
} from "../src/lib/workspace-documents-core.ts";
import {
  choosePdfContentWidthPx,
  detectResponsiveCollapse,
  pdfHeightPxForWidth,
} from "../src/lib/workspace-document-html-pdf.ts";

assert.equal(normalizeDocumentName("  月次報告.pdf "), "月次報告.pdf");
assert.equal(normalizeDocumentName("../secret"), null);
assert.equal(normalizeDocumentName("a/b"), null);
assert.equal(normalizeDocumentName("a\\b"), null);
assert.equal(normalizeDocumentName("\u0000file"), null);
assert.equal(workspaceDocumentNameKey("  Report.PDF "), "report.pdf");
assert.equal(
  workspaceDocumentFinderCopyName("Report.pdf", new Set(["report.pdf", "report 2.pdf"])),
  "Report 3.pdf",
);
assert.equal(
  workspaceDocumentFinderCopyName("議事録", new Set(["議事録"])),
  "議事録 2",
);
assert.equal(
  workspaceDocumentFinderCopyName(".env", new Set([".env"])),
  ".env 2",
);

assert.equal(normalizeDocumentFolderPath(""), "");
assert.equal(normalizeDocumentFolderPath("契約/2026"), "契約/2026");
assert.equal(normalizeDocumentFolderPath("/契約"), null);
assert.equal(normalizeDocumentFolderPath("契約//2026"), null);
assert.equal(normalizeDocumentFolderPath("契約/../内部"), null);
assert.equal(normalizeDocumentFolderPath("契約\\内部"), null);

assert.equal(joinDocumentFolderPath("契約", "2026"), "契約/2026");
assert.equal(documentParentPath("契約/2026"), "契約");
assert.equal(documentBaseName("契約/2026"), "2026");

assert.equal(normalizeDocumentVisibility("workspace_shared"), "workspace_shared");
assert.equal(normalizeDocumentVisibility("amd_internal"), "amd_internal");
assert.equal(normalizeDocumentVisibility("public"), null);

assert.equal(normalizeHttpUrl("https://example.com/a")?.startsWith("https://example.com/a"), true);
assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
assert.equal(normalizeHttpUrl("file:///tmp/a"), null);

assert.equal(isWorkspaceDocumentHtml("text/html"), true);
assert.equal(isWorkspaceDocumentHtml("TEXT/HTML; charset=utf-8"), true);
assert.equal(isWorkspaceDocumentHtml("application/octet-stream", "提案資料.HTML"), true);
assert.equal(isWorkspaceDocumentHtml("application/octet-stream", "提案資料.htm"), true);
assert.equal(isWorkspaceDocumentHtml("text/plain"), false);
assert.equal(isWorkspaceDocumentMarkdown("text/markdown"), true);
assert.equal(isWorkspaceDocumentMarkdown("TEXT/X-MARKDOWN; charset=utf-8"), true);
assert.equal(isWorkspaceDocumentMarkdown("application/octet-stream", "議事録.MD"), true);
assert.equal(isWorkspaceDocumentMarkdown("text/plain", "議事録.markdown"), true);
assert.equal(isWorkspaceDocumentMarkdown("text/plain", "議事録.txt"), false);
assert.equal(workspaceDocumentPdfDownloadName("提案資料.html"), "提案資料.pdf");
assert.equal(workspaceDocumentPdfDownloadName("提案資料.HTM"), "提案資料.pdf");
assert.equal(workspaceDocumentHtmlSourceByteLength("あ"), 3);
assert.deepEqual(normalizeWorkspaceDocumentHtmlSource("<h1>資料</h1>"), {
  source: "<h1>資料</h1>",
  byteLength: workspaceDocumentHtmlSourceByteLength("<h1>資料</h1>"),
});
assert.equal(normalizeWorkspaceDocumentHtmlSource("   "), null);
assert.equal(
  normalizeWorkspaceDocumentHtmlSource("a".repeat(WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES + 1)),
  null,
);

const documentId = "7ec59a7f-211a-4670-b3c5-f1a35b5ee7aa";
assert.equal(
  workspaceDocumentStoragePath("project", "p21", documentId),
  `project/p21/${documentId}`,
);
assert.equal(
  workspaceDocumentStoragePath("institution", "d993b78d-cd29-4e24-b381-4f0a229bf687", documentId),
  `institution/d993b78d-cd29-4e24-b381-4f0a229bf687/${documentId}`,
);

// Vercel Node FunctionのレスポンスbodyにPDFを直接載せない設計の裏付け:
// 出力上限はFunctionのbody上限(4.5MB)より十分大きく、Storage直配信前提であることを確認する。
assert.equal(WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES, 16 * 1024 * 1024);
assert.equal(WORKSPACE_DOCUMENT_PDF_DOWNLOAD_URL_TTL_SECONDS, 60);
assert.equal(detectResponsiveCollapse({
  desktopScrollHeightPx: 1000,
  a4ScrollHeightPx: 1450,
  desktopScrollWidthPx: 1280,
}), true);
assert.equal(detectResponsiveCollapse({
  desktopScrollHeightPx: 1000,
  a4ScrollHeightPx: 1150,
  desktopScrollWidthPx: 1280,
}), false);
assert.equal(choosePdfContentWidthPx({ collapsed: false, desktopScrollWidthPx: 1280 }), 794);
assert.equal(choosePdfContentWidthPx({ collapsed: true, desktopScrollWidthPx: 1280 }), 1280);
assert.equal(pdfHeightPxForWidth(1280), 1810);
assert.equal(
  workspaceDocumentPdfCacheStoragePath("project", "p21", documentId),
  `project/p21/${documentId}.pdf`,
);
assert.equal(
  workspaceDocumentPdfCacheStoragePath("institution", "d993b78d-cd29-4e24-b381-4f0a229bf687", documentId),
  `institution/d993b78d-cd29-4e24-b381-4f0a229bf687/${documentId}.pdf`,
);
assert.equal(
  workspaceDocumentPdfCacheStoragePath("project", "p21", documentId),
  `${workspaceDocumentStoragePath("project", "p21", documentId)}.pdf`,
);

// デッキ (spec/2-8 §3.3)。値そのものが仕様なので、変えるなら計画側の記述も一緒に直す。
assert.equal(WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION, 1);
assert.equal(WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES, 2 * 1024 * 1024);
assert.equal(WORKSPACE_DOCUMENT_ASSET_MAX_BYTES, 10 * 1024 * 1024);
assert.equal(WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX, 1920);
// 画像は資料の現物の隣へ置く。過去版 (.revN.html) と同じく、pathを見れば持ち主が分かる。
assert.equal(
  workspaceDocumentAssetStoragePathFromBase(
    workspaceDocumentStoragePath("project", "p21", documentId),
    "8e5c0a26-1111-4222-8333-444455556666",
    "png",
  ),
  `project/p21/${documentId}.asset.8e5c0a26-1111-4222-8333-444455556666.png`,
);

console.log("workspace documents core: ok");
