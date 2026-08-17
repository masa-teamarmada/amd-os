import "server-only";

import { Buffer } from "node:buffer";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import type { WorkspaceDocumentRow } from "@/lib/workspace-documents-server";

const ALLOWED_DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

export type WorkspaceDocumentTextResult =
  | { ok: true; text: string; byteLength: number; sourceMimeType: string | null; sourceName: string | null }
  | { ok: false; status: number; error: string };

export function workspaceDocumentDriveFileId(
  row: Pick<WorkspaceDocumentRow, "source_ref" | "external_url">,
): string | null {
  const sourceMatch = row.source_ref?.match(/^drive_file:([A-Za-z0-9_-]{10,})$/);
  if (sourceMatch?.[1]) return sourceMatch[1];
  if (!row.external_url) return null;

  try {
    const url = new URL(row.external_url);
    if (url.protocol !== "https:" || !ALLOWED_DRIVE_HOSTS.has(url.hostname.toLowerCase())) return null;
    const pathMatch = url.pathname.match(/\/(?:file|document)\/d\/([^/]+)/);
    const candidate = pathMatch?.[1] ?? url.searchParams.get("id");
    return candidate && /^[A-Za-z0-9_-]{10,}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function decodeText(data: unknown): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof Uint8Array) return Buffer.from(data).toString("utf8");
  return String(data ?? "");
}

export async function loadWorkspaceDocumentText(
  db: SupabaseClient,
  row: WorkspaceDocumentRow,
  maxBytes: number,
): Promise<WorkspaceDocumentTextResult> {
  if (row.entry_kind === "file") {
    if (!row.storage_bucket || !row.storage_path) {
      return { ok: false, status: 500, error: "資料の保存先を確認できなかったよ。" };
    }
    if (row.file_size_bytes > maxBytes) {
      return { ok: false, status: 413, error: "この資料はプレビュー上限を超えているよ。" };
    }
    const { data: file, error } = await db.storage.from(row.storage_bucket).download(row.storage_path);
    if (error || !file) return { ok: false, status: 500, error: "資料を読み込めなかったよ。" };
    if (file.size > maxBytes) {
      return { ok: false, status: 413, error: "この資料はプレビュー上限を超えているよ。" };
    }
    return {
      ok: true,
      text: await file.text(),
      byteLength: file.size,
      sourceMimeType: row.mime_type,
      sourceName: row.display_name,
    };
  }

  if (row.entry_kind !== "link") {
    return { ok: false, status: 400, error: "この資料は本文表示に対応していないよ。" };
  }
  const fileId = workspaceDocumentDriveFileId(row);
  if (!fileId) {
    return { ok: false, status: 400, error: "Drive上の資料として確認できなかったよ。" };
  }
  const auth = await getGoogleAuthAsync();
  if (!auth) return { ok: false, status: 500, error: "Google Driveへ接続できなかったよ。" };

  try {
    const drive = google.drive({ version: "v3", auth });
    const metadata = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size",
      supportsAllDrives: true,
    });
    const declaredSize = Number(metadata.data.size || 0) || 0;
    if (declaredSize > maxBytes) {
      return { ok: false, status: 413, error: "この資料はプレビュー上限を超えているよ。" };
    }
    const media = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    const text = decodeText(media.data);
    const byteLength = Buffer.byteLength(text, "utf8");
    if (byteLength > maxBytes) {
      return { ok: false, status: 413, error: "この資料はプレビュー上限を超えているよ。" };
    }
    return {
      ok: true,
      text,
      byteLength,
      sourceMimeType: metadata.data.mimeType ?? null,
      sourceName: metadata.data.name ?? null,
    };
  } catch (error) {
    console.error("[workspace-documents] Drive text load failed:", error instanceof Error ? error.message : error);
    return { ok: false, status: 502, error: "Drive上の資料を読み込めなかったよ。" };
  }
}
