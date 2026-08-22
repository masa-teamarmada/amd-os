export const WORKSPACE_DOCUMENTS_BUCKET = "workspace-files";
export const WORKSPACE_DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_MARKDOWN_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES = 5 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES = 8 * 1024 * 1024;
// Vercel Node Function のレスポンスbody上限(4.5MB)を避けるため、生成したPDFは
// Function responseで直接返さずStorageへ置いて署名URLで返す。この上限はFunctionの
// メモリ/実行時間と両立する出力サイズの目安であり、body制限そのものの回避ではない。
export const WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_PDF_DOWNLOAD_URL_TTL_SECONDS = 60;

// 版履歴 (workspace_document_revisions)。
// 1資料あたりこの件数までを自動保持し、超過分は古い順に消す。pinned=true は対象外。
export const WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT = 50;
export const WORKSPACE_DOCUMENT_REVISION_LIST_LIMIT = 100;
export const WORKSPACE_DOCUMENT_REVISION_NOTE_MAX_LENGTH = 200;

// デッキモデル (workspace_document_decks)。モデルJSONが正本で、HTML/PDFはそこからの生成物。
export const WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION = 1;
export const WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES = 2 * 1024 * 1024;
// デッキが参照する画像 (workspace_document_assets)。
// publish後のHTMLは5MB上限で、base64は約1.33倍に膨らむ。画像実バイトの合計は約3.5MBが天井。
export const WORKSPACE_DOCUMENT_ASSET_MAX_BYTES = 10 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX = 1920;

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

export function isWorkspaceDocumentMarkdown(mimeType: unknown, displayName?: unknown): boolean {
  const normalizedMimeType = typeof mimeType === "string"
    ? mimeType.split(";", 1)[0]?.trim().toLowerCase()
    : null;
  if (normalizedMimeType === "text/markdown" || normalizedMimeType === "text/x-markdown") return true;
  return typeof displayName === "string" && /\.(?:md|markdown)$/i.test(displayName.trim());
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
 * 署名URLへダウンロード名を付ける。
 *
 * supabase-jsの`createSignedUrl(..., { download })`は使わない。渡した名前をライブラリ側が
 * URLエンコードし、Storageがそのクエリ生値をそのままContent-Dispositionへ入れるため、
 * 日本語名が `SE_%25E6%258A%2580….pdf` と二重エンコードで保存される (2026-08-21)。
 * こちらで1回だけエンコードして付けると `filename*=UTF-8''%E6%8A%80…` になり、
 * ブラウザは日本語名のまま保存する。
 */
export function withWorkspaceDownloadFileName(signedUrl: string, fileName: string): string {
  // RFC 5987のattr-charに含まれない ' ( ) * も逃がす。Storageはクエリの値をそのまま
  // filename*へ入れるため、ここで残すとヘッダの区切りとして誤読される余地がある。
  const encoded = encodeURIComponent(fileName)
    .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  const separator = signedUrl.includes("?") ? "&" : "?";
  return `${signedUrl}${separator}download=${encoded}`;
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

/**
 * HTML→PDF変換の出力先。元資料のstorage_path (拡張子なし) に `.pdf` を足すだけの
 * 決定的なpathにして、documentIdごとに常に同じ場所を安全に上書きできるようにする。
 */
export function workspaceDocumentPdfCacheStoragePath(
  scopeKind: WorkspaceDocumentScopeKind,
  scopeId: string,
  documentId: string,
): string {
  return `${workspaceDocumentStoragePath(scopeKind, scopeId, documentId)}.pdf`;
}

/**
 * 版履歴で退避したHTMLソースの置き場。現物のstorage_pathを上書きする前に、
 * 直前の内容をここへコピーしてから差し替える。revision_no は追記のみで再利用しないので、
 * このpathは一度書いたら二度と別の内容にならない。
 */
export function workspaceDocumentRevisionStoragePath(
  scopeKind: WorkspaceDocumentScopeKind,
  scopeId: string,
  documentId: string,
  revisionNo: number,
): string {
  return workspaceDocumentRevisionStoragePathFromBase(
    workspaceDocumentStoragePath(scopeKind, scopeId, documentId),
    revisionNo,
  );
}

/**
 * 実行時はDBのstorage_pathをそのまま基点にする。過去のuploadが別の形式で作られていても、
 * 退避先が現物の隣に並ぶことを保証できる。
 */
export function workspaceDocumentRevisionStoragePathFromBase(
  basePath: string,
  revisionNo: number,
): string {
  if (!Number.isInteger(revisionNo) || revisionNo < 1) throw new Error("invalid revision number");
  if (!basePath || basePath.includes("..")) throw new Error("invalid document storage path");
  return `${basePath}.rev${revisionNo}.html`;
}

/**
 * デッキが参照する画像の置き場。版の退避と同じく現物のstorage_pathを基点にして、
 * 資料の実体・過去版・アセットが同じprivate bucketの隣同士に並ぶようにする。
 *
 * asset_id はDBが払い出すuuidなので、このpathは一度書いたら別の画像で上書きされない。
 * (`workspace_document_assets` の (storage_bucket, storage_path) unique制約と対で効く)
 */
export function workspaceDocumentAssetStoragePathFromBase(
  basePath: string,
  assetId: string,
  extension: string,
): string {
  if (!basePath || basePath.includes("..")) throw new Error("invalid document storage path");
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) throw new Error("invalid asset identity");
  if (!/^[a-z0-9]{1,8}$/.test(extension)) throw new Error("invalid asset extension");
  return `${basePath}.asset.${assetId}.${extension}`;
}

export function normalizeWorkspaceDocumentRevisionNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || CONTROL_CHARACTERS.test(trimmed)) return null;
  return trimmed.slice(0, WORKSPACE_DOCUMENT_REVISION_NOTE_MAX_LENGTH);
}

export function isWorkspaceDocumentSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function workspaceDocumentScopeLabel(kind: WorkspaceDocumentScopeKind) {
  return kind === "institution" ? "機関共有" : "PJ共有";
}
