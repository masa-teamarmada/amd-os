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
  WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES,
  workspaceDocumentFinderCopyName,
  workspaceDocumentHtmlSourceByteLength,
  workspaceDocumentNameKey,
  workspaceDocumentPdfDownloadName,
  normalizeHttpUrl,
  workspaceDocumentStoragePath,
} from "../src/lib/workspace-documents-core.ts";

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

console.log("workspace documents core: ok");
