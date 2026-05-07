/**
 * Google Drive 生データ抽出。
 * env: 共通 google.ts (OAuth or Service Account)
 *
 * Drive API:
 *   - files.list で query 検索
 *   - files.export で Google Docs/Sheets/Slides を text 化
 *   - files.get (alt=media) で PDF などをダウンロード (text 化はスキップ、メタのみ)
 */

import { google } from "googleapis";
import { getGoogleAuthAsync } from "./google";

export interface DriveHit {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  webViewLink: string | null;
  text: string;          // 簡易テキスト化したファイル内容 (最初の数千文字)
}

const MAX_FILE_TEXT = 4000;
const EXPORTABLE_TEXT: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

export async function fetchDriveContext(query: string, limit = 10): Promise<DriveHit[]> {
  const auth = await getGoogleAuthAsync();
  if (!auth) {
    console.warn("[drive] no Google auth — skipping");
    return [];
  }
  const drive = google.drive({ version: "v3", auth });
  try {
    // fullText 検索 (Drive 内全文)
    const r = await drive.files.list({
      q: `(fullText contains '${escapeQuery(query)}' or name contains '${escapeQuery(query)}') and trashed=false`,
      pageSize: Math.min(limit, 50),
      orderBy: "modifiedTime desc",
      fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const out: DriveHit[] = [];
    for (const f of r.data.files ?? []) {
      const text = await tryExtractText(drive, f.id ?? "", f.mimeType ?? "");
      out.push({
        id: f.id ?? "",
        name: f.name ?? "(?)",
        mimeType: f.mimeType ?? "",
        modifiedTime: f.modifiedTime ?? null,
        webViewLink: f.webViewLink ?? null,
        text,
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
  fileId: string,
  mimeType: string,
): Promise<string> {
  if (!fileId) return "";
  try {
    const exportMime = EXPORTABLE_TEXT[mimeType];
    if (exportMime) {
      const exp = await drive.files.export({ fileId, mimeType: exportMime }, { responseType: "text" });
      const txt = typeof exp.data === "string" ? exp.data : String(exp.data);
      return txt.slice(0, MAX_FILE_TEXT);
    }
    // PDF/その他はメタ情報のみ (download すると重い)
    return `[file: ${mimeType}]`;
  } catch (e) {
    console.warn(`[drive] extract failed for ${fileId}:`, e);
    return "";
  }
}
