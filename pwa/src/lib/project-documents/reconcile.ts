/**
 * PJ cockpit「資料室」(= project_documents) と Google Drive の資料室 folder の
 * additive-only 同期。folder 直下 (サブフォルダ除く) にあるファイルのうち
 * project_documents に行が無い drive_file_id だけを source_kind='drive_folder_sync' で追加する。
 * 既存行は一切触らない。削除方向の同期はしない (Drive側で消えても project_documents からは消さない)。
 *
 * 2026-08-16: Drive folder名を `AMD OS 資料` → `AMD OS資料室` へ改名した際に追加。
 * 呼び出し元:
 *   - GET /api/project-documents (project単位、スロットル付き)
 *   - POST /api/project-documents/reconcile (全PJ一括、Bearer CRON_SECRET)
 */

import { google } from "googleapis";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import type { createAdminClient } from "@/lib/supabase/admin";

export const PROJECT_DOCUMENTS_FOLDER_NAME = "AMD OS資料室";

type AdminClient = ReturnType<typeof createAdminClient>;

function driveQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** projectDriveFolderId 配下の資料室 folder を find-or-create する。 */
export async function ensureDocumentsFolder(projectDriveFolderId: string): Promise<string> {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("Google Drive credential が未設定だよ");

  const drive = google.drive({ version: "v3", auth });
  const escapedName = driveQueryLiteral(PROJECT_DOCUMENTS_FOLDER_NAME);
  const escapedParent = driveQueryLiteral(projectDriveFolderId);
  const existing = await drive.files.list({
    q: `'${escapedParent}' in parents and name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name,webViewLink)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const folder = existing.data.files?.[0];
  if (folder?.id) return folder.id;

  const created = await drive.files.create({
    requestBody: {
      name: PROJECT_DOCUMENTS_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: [projectDriveFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error("Drive資料フォルダの作成に失敗したよ");
  return created.data.id;
}

type DriveListedFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  webViewLink: string | null;
};

async function listFolderFiles(documentsFolderId: string): Promise<DriveListedFile[]> {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("Google Drive credential が未設定だよ");

  const drive = google.drive({ version: "v3", auth });
  const escapedParent = driveQueryLiteral(documentsFolderId);
  const files: DriveListedFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${escapedParent}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
      fields: "nextPageToken, files(id,name,mimeType,size,webViewLink)",
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (!f.id) continue;
      files.push({
        id: f.id,
        name: f.name || "untitled",
        mimeType: f.mimeType || "application/octet-stream",
        size: f.size ?? null,
        webViewLink: f.webViewLink ?? null,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

export type ReconcileResult = {
  documentsFolderId: string;
  scanned: number;
  added: number;
};

/** 資料室 folder 直下のファイルを project_documents へ additive-only で反映する。 */
export async function reconcileProjectDocuments(
  admin: AdminClient,
  projectId: string,
  projectDriveFolderId: string,
): Promise<ReconcileResult> {
  const documentsFolderId = await ensureDocumentsFolder(projectDriveFolderId);
  const files = await listFolderFiles(documentsFolderId);
  if (files.length === 0) return { documentsFolderId, scanned: 0, added: 0 };

  const rows = files.map((f) => ({
    project_id: projectId,
    drive_file_id: f.id,
    project_drive_folder_id: projectDriveFolderId,
    drive_folder_id: documentsFolderId,
    web_view_link: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view?usp=drivesdk`,
    file_name: f.name,
    mime_type: f.mimeType,
    file_size_bytes: Number(f.size || 0) || 0,
    upload_status: "active",
    source_kind: "drive_folder_sync",
    uploaded_by: "folder_sync",
  }));

  // onConflict + ignoreDuplicates: 既存 drive_file_id は触らず、無い行だけ追加する。
  // Postgres の ON CONFLICT DO NOTHING RETURNING は実際に insert された行だけを返すので
  // 返り値の件数がそのまま「今回追加した件数」になる。
  const { data, error } = await admin
    .from("project_documents")
    .upsert(rows, { onConflict: "drive_file_id", ignoreDuplicates: true })
    .select("document_id");
  if (error) throw error;

  return { documentsFolderId, scanned: files.length, added: (data ?? []).length };
}

const lastReconcileAtByProject = new Map<string, number>();
const THROTTLE_MS = 5 * 60 * 1000;

/**
 * GET /api/project-documents 用の軽量版。プロジェクトごとに直近5分以内の呼び出しはskipする。
 * serverless instance ごとの in-memory throttle なので厳密ではないが、実装の単純さを優先する。
 * skip した場合は null を返す。
 */
export async function reconcileProjectDocumentsThrottled(
  admin: AdminClient,
  projectId: string,
  projectDriveFolderId: string,
): Promise<ReconcileResult | null> {
  const now = Date.now();
  const last = lastReconcileAtByProject.get(projectId) || 0;
  if (now - last < THROTTLE_MS) return null;
  lastReconcileAtByProject.set(projectId, now);
  return reconcileProjectDocuments(admin, projectId, projectDriveFolderId);
}
