/**
 * 立替精算の領収書を共有ドライブ `ARMADA/a3_backoffice/立替精算領収書/<YYYY-MM>` へ複製する。
 *
 * 一次保管は Supabase Storage (`reimbursement-receipts`) のまま。
 * ここは経理が Drive だけで月次処理を閉じられるようにするための二次保管で、
 * 失敗しても申請そのものは成立させる (呼び出し側で warning 扱い)。
 */

import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { getGoogleAuthAsync } from "@/lib/sources/google";

/** 共有ドライブ `ARMADA/a3_backoffice` の folder id (秘密値ではない。env で上書き可) */
const BACKOFFICE_FOLDER_ID =
  process.env.REIMBURSE_DRIVE_BACKOFFICE_FOLDER_ID || "12ThfaySDtfTiVtJ7WbAp9T2Iqw1Va3if";
const RECEIPT_ROOT_FOLDER_NAME = "立替精算領収書";

export type ReceiptDriveUploadResult = {
  folderId: string | null;
  fileIds: string[];
  links: string[];
  error: string | null;
};

export const EMPTY_RECEIPT_DRIVE_RESULT: ReceiptDriveUploadResult = {
  folderId: null,
  fileIds: [],
  links: [],
  error: null,
};

function driveQueryLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** `2026-08-05` → `2026-08`。壊れた日付は投稿月フォルダへ逃がさず `unknown` にまとめる。 */
function monthFolderName(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : "unknown";
}

/** Drive 上でファイル名に使えない文字とパス区切りだけ落とす (日本語は残す) */
function sanitizeSegment(value: string, maxLength = 60) {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

type Drive = ReturnType<typeof google.drive>;

async function ensureChildFolder(drive: Drive, parentId: string, name: string) {
  const existing = await drive.files.list({
    q: `'${driveQueryLiteral(parentId)}' in parents and name='${driveQueryLiteral(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = existing.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Driveフォルダ「${name}」の作成に失敗した`);
  return created.data.id;
}

/**
 * 領収書を Drive へ複製する。
 * ファイル名は `<発生日>_<PJ名>_<申請者ローカル部>_<金額>円_<元ファイル名>`。
 * 例外は投げず、error 文字列に畳んで返す。
 */
export async function uploadReceiptsToBackofficeDrive(params: {
  files: File[];
  reimbursementId: string;
  projectId: string;
  projectName: string;
  date: string;
  amount: number;
  createdBy: string;
}): Promise<ReceiptDriveUploadResult> {
  if (params.files.length === 0) return EMPTY_RECEIPT_DRIVE_RESULT;

  try {
    const auth = await getGoogleAuthAsync();
    if (!auth) return { ...EMPTY_RECEIPT_DRIVE_RESULT, error: "Google Drive credential が未設定" };

    const drive = google.drive({ version: "v3", auth });
    const rootId = await ensureChildFolder(drive, BACKOFFICE_FOLDER_ID, RECEIPT_ROOT_FOLDER_NAME);
    const folderId = await ensureChildFolder(drive, rootId, monthFolderName(params.date));

    const applicant = sanitizeSegment(params.createdBy.split("@")[0] ?? params.createdBy, 40);
    const project = sanitizeSegment(params.projectName || params.projectId, 40);
    const prefix = `${sanitizeSegment(params.date, 10)}_${project}_${applicant}_${Math.round(params.amount)}円`;

    const fileIds: string[] = [];
    const links: string[] = [];
    for (const [index, file] of params.files.entries()) {
      const original = sanitizeSegment(file.name || `receipt-${index + 1}`, 80);
      const buffer = Buffer.from(await file.arrayBuffer());
      const created = await drive.files.create({
        requestBody: {
          name: `${prefix}_${original}`,
          parents: [folderId],
          description: `AMD OS 立替精算 ${params.reimbursementId} / ${params.projectId}`,
        },
        media: {
          mimeType: file.type || "application/octet-stream",
          body: Readable.from(buffer),
        },
        fields: "id,webViewLink",
        supportsAllDrives: true,
      });
      if (created.data.id) fileIds.push(created.data.id);
      if (created.data.webViewLink) links.push(created.data.webViewLink);
    }

    return { folderId, fileIds, links, error: null };
  } catch (error) {
    return {
      ...EMPTY_RECEIPT_DRIVE_RESULT,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
