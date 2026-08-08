export const WORKSPACE_DOCUMENTS_BUCKET = "workspace-files";
export const WORKSPACE_DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES = 5 * 1024 * 1024;
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

/**
 * HTML本文は入力値として扱うだけで、ここでは実行・整形・sanitizeしない。
 * 保存前のサイズ判定と、ブラウザ側の表示用byte数に同じUTF-8基準を使う。
 */
export function workspaceDocumentHtmlSourceByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function normalizeWorkspaceDocumentHtmlSource(value: unknown): {
  source: string;
  byteLength: number;
} | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const byteLength = workspaceDocumentHtmlSourceByteLength(value);
  if (byteLength > WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES) return null;
  return { source: value, byteLength };
}

export function workspaceDocumentPdfDownloadName(displayName: string): string {
  return displayName.replace(/\.html?$/i, ".pdf");
}

/**
 * 資料室の名前衝突判定は、DBのlower(display_name) unique indexと同じく
 * 表示名の前後空白を除いた大小文字非区別の比較に固定する。
 */
export function workspaceDocumentNameKey(displayName: string): string {
  return displayName.trim().toLocaleLowerCase("ja");
}

/**
 * Finderと同じ読みやすさで、拡張子の直前へ連番を付ける。
 * occupiedNameKeysには現在のfolderのactive entryと、同時追加で予約済みの名前を渡す。
 */
export function workspaceDocumentFinderCopyName(
  displayName: string,
  occupiedNameKeys: ReadonlySet<string>,
): string {
  const normalized = normalizeDocumentName(displayName);
  if (!normalized) throw new Error("invalid workspace document name");

  const extensionIndex = normalized.lastIndexOf(".");
  const hasExtension = extensionIndex > 0 && extensionIndex < normalized.length - 1;
  const stem = hasExtension ? normalized.slice(0, extensionIndex) : normalized;
  const extension = hasExtension ? normalized.slice(extensionIndex) : "";

  for (let sequence = 2; sequence <= 10000; sequence += 1) {
    const candidate = `${stem} ${sequence}${extension}`;
    if (!occupiedNameKeys.has(workspaceDocumentNameKey(candidate))) return candidate;
  }
  throw new Error("workspace document copy name exhausted");
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
