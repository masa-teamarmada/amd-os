export const WORKSPACE_DOCUMENTS_BUCKET = "workspace-files";
export const WORKSPACE_DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES = 8 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

export type WorkspaceDocumentScopeKind = "institution" | "project";
export type WorkspaceDocumentVisibility = "amd_internal" | "workspace_shared";
export type WorkspaceDocumentEntryKind = "file" | "link" | "folder";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function isWorkspaceDocumentHtml(mimeType: unknown, displayName?: unknown): boolean {
  const normalizedMimeType = typeof mimeType === "string"
    ? mimeType.split(";", 1)[0]?.trim().toLowerCase()
    : null;
  if (normalizedMimeType === "text/html") return true;
  return typeof displayName === "string" && /\.html?$/i.test(displayName.trim());
}

export function workspaceDocumentPdfDownloadName(displayName: string): string {
  return displayName.replace(/\.html?$/i, ".pdf");
}

export function normalizeDocumentName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 240) return null;
  if (normalized === "." || normalized === "..") return null;
  if (normalized.includes("/") || normalized.includes("\\") || CONTROL_CHARACTERS.test(normalized)) return null;
  return normalized;
}

export function normalizeDocumentFolderPath(value: unknown): string | null {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > 1000) return null;
  if (value.startsWith("/") || value.endsWith("/") || value.includes("//") || value.includes("\\")) return null;
  const segments = value.split("/");
  if (segments.length > 32) return null;
  const normalized: string[] = [];
  for (const segment of segments) {
    const safe = normalizeDocumentName(segment);
    if (!safe) return null;
    normalized.push(safe);
  }
  return normalized.join("/");
}

export function joinDocumentFolderPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export function documentParentPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

export function documentBaseName(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? path : path.slice(index + 1);
}

export function normalizeDocumentVisibility(
  value: unknown,
  fallback: WorkspaceDocumentVisibility = "workspace_shared",
): WorkspaceDocumentVisibility | null {
  if (value == null || value === "") return fallback;
  return value === "amd_internal" || value === "workspace_shared" ? value : null;
}

export function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4000) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function workspaceDocumentStoragePath(
  scopeKind: WorkspaceDocumentScopeKind,
  scopeId: string,
  documentId: string,
): string {
  const safeScopeId = scopeId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  if (!safeScopeId || !/^[0-9a-f-]{36}$/i.test(documentId)) throw new Error("invalid document storage identity");
  return `${scopeKind}/${safeScopeId}/${documentId}`;
}

export function workspaceDocumentScopeLabel(kind: WorkspaceDocumentScopeKind) {
  return kind === "institution" ? "機関共有" : "PJ共有";
}
