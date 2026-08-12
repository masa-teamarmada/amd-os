/**
 * Google Drive 生データ抽出。
 * env: 共通 google.ts (OAuth or Service Account)
 *
 * Drive API:
 *   - files.list で query 検索
 *   - files.export で Google Docs/Sheets/Slides を text 化
 *   - files.get (alt=media) で PDF / Word / Excel / PowerPoint 等を取得して text 化
 *   - scan PDF/image は missing にせず needsOcr を返し、呼び出し側のOCRへ接続できる
 */

import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { getGoogleAuthAsync } from "./google";
import {
  extractSourceText,
  type SourceOcr,
  type SourcePageMarker,
  type SourceTextMethod,
  type SourceTextStatus,
} from "./source-material-text";

export interface DriveHit {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  webViewLink: string | null;
  parentFolders: string[];
  text: string;
  contentSha256: string | null;
  textMethod: SourceTextMethod;
  textStatus: SourceTextStatus;
  pageMarkers: SourcePageMarker[];
  needsOcr: boolean;
  extractionWarning: string | null;
}

const MAX_FILE_TEXT = 40_000;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const EXPORTABLE_TEXT: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

export async function fetchDriveContext(query: string, limit = 10, options: { ocr?: SourceOcr } = {}): Promise<DriveHit[]> {
  const auth = await getGoogleAuthAsync();
  if (!auth) {
    console.warn("[drive] no Google auth — skipping");
    return [];
  }
  const drive = google.drive({ version: "v3", auth });
  try {
    // fullText 検索 (Drive 内全文)
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;
    do {
      const r = await drive.files.list({
        q: `(fullText contains '${escapeQuery(query)}' or name contains '${escapeQuery(query)}') and trashed=false`,
        pageSize: Math.min(100, Math.max(1, limit - files.length)),
        pageToken,
        orderBy: "modifiedTime desc",
        fields: "nextPageToken,files(id, name, mimeType, modifiedTime, webViewLink, parents, size)",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      files.push(...(r.data.files ?? []));
      pageToken = r.data.nextPageToken || undefined;
    } while (pageToken && files.length < limit);
    const out: DriveHit[] = [];
    for (const f of files) {
      const fileId = f.id ?? "";
      const parentFolders = await resolveParentFolderNames(drive, f.parents || []);
      const extracted = await tryExtractText(drive, {
        fileId,
        filename: f.name ?? "(?)",
        mimeType: f.mimeType ?? "",
        size: Number(f.size || 0),
        ocr: options.ocr,
      });
      out.push({
        id: fileId,
        name: f.name ?? "(?)",
        mimeType: f.mimeType ?? "",
        modifiedTime: f.modifiedTime ?? null,
        webViewLink: f.webViewLink ?? null,
        parentFolders,
        text: extracted.text.slice(0, MAX_FILE_TEXT),
        contentSha256: extracted.contentSha256,
        textMethod: extracted.method,
        textStatus: extracted.status,
        pageMarkers: extracted.pageMarkers,
        needsOcr: extracted.needsOcr,
        extractionWarning: extracted.warning,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch (e) {
    console.error("[drive] search failed:", e);
    return [];
  }
}

function escapeQuery(s: string): string {
  return s.replace(/'/g, "\\'");
}

async function tryExtractText(
  drive: ReturnType<typeof google.drive>,
  input: { fileId: string; filename: string; mimeType: string; size: number; ocr?: SourceOcr },
) {
  if (!input.fileId) return missingExtract("file_id_missing");
  try {
    const exportMime = EXPORTABLE_TEXT[input.mimeType];
    if (exportMime) {
      const exp = await drive.files.export({ fileId: input.fileId, mimeType: exportMime }, { responseType: "text" });
      const txt = typeof exp.data === "string" ? exp.data : String(exp.data);
      return {
        text: txt,
        contentSha256: null,
        method: "native_text" as const,
        status: txt.trim() ? "available" as const : "missing" as const,
        pageMarkers: [] as SourcePageMarker[],
        needsOcr: false,
        warning: txt.trim() ? null : "native_text_missing",
      };
    }
    if (input.size > MAX_DOWNLOAD_BYTES) return missingExtract("file_too_large");
    const file = await drive.files.get({ fileId: input.fileId, alt: "media" }, { responseType: "arraybuffer" });
    const bytes = new Uint8Array(file.data as ArrayBuffer);
    return extractSourceText({ bytes, mimeType: input.mimeType, filename: input.filename, ocr: input.ocr });
  } catch (e) {
    console.warn(`[drive] extract failed for ${input.fileId}:`, e);
    return missingExtract("drive_extract_failed");
  }
}

async function resolveParentFolderNames(drive: ReturnType<typeof google.drive>, parentIds: string[]): Promise<string[]> {
  const names: string[] = [];
  for (const parentId of parentIds.slice(0, 8)) {
    try {
      const parent = await drive.files.get({ fileId: parentId, fields: "id,name", supportsAllDrives: true });
      if (parent.data.name) names.push(parent.data.name);
    } catch {
      names.push(`folder:${parentId}`);
    }
  }
  return names;
}

function missingExtract(warning: string) {
  return {
    text: "",
    contentSha256: null,
    method: "unavailable" as const,
    status: "missing" as const,
    pageMarkers: [] as SourcePageMarker[],
    needsOcr: false,
    warning,
  };
}
