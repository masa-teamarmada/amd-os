import assert from "node:assert/strict";
import {
  documentBaseName,
  documentParentPath,
  isWorkspaceDocumentHtml,
  joinDocumentFolderPath,
  normalizeDocumentFolderPath,
  normalizeDocumentName,
  normalizeDocumentVisibility,
  normalizeHttpUrl,
  workspaceDocumentStoragePath,
} from "../src/lib/workspace-documents-core.ts";

assert.equal(normalizeDocumentName("  月次報告.pdf "), "月次報告.pdf");
assert.equal(normalizeDocumentName("../secret"), null);
assert.equal(normalizeDocumentName("a/b"), null);
assert.equal(normalizeDocumentName("a\\b"), null);
assert.equal(normalizeDocumentName("\u0000file"), null);

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
assert.equal(isWorkspaceDocumentHtml("text/plain"), false);

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
