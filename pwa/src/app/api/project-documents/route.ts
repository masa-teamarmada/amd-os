import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROJECT_DOCUMENTS_FOLDER_NAME = "AMD OS 資料";
const MAX_FILE_BYTES = 50 * 1024 * 1024;

type AdminClient = ReturnType<typeof createAdminClient>;

interface ProjectDocumentRow {
  document_id: string;
  project_id: string;
  drive_file_id: string;
  project_drive_folder_id: string;
  drive_folder_id: string;
  web_view_link: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  upload_status: string;
  source_kind: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

function requiredText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function contentTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

function validateFile(file: File): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: `${file.name}: 50MB 以内にしてね` };
  return { ok: true, mimeType: file.type || contentTypeFromName(file.name) };
}

function driveQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function toClientDocument(row: ProjectDocumentRow) {
  return {
    documentId: row.document_id,
    projectId: row.project_id,
    driveFileId: row.drive_file_id,
    projectDriveFolderId: row.project_drive_folder_id,
    driveFolderId: row.drive_folder_id,
    webViewLink: row.web_view_link,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes) || 0,
    uploadStatus: row.upload_status,
    sourceKind: row.source_kind,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listDocuments(admin: AdminClient, projectId: string) {
  const { data, error } = await admin
    .from("project_documents")
    .select("*")
    .eq("project_id", projectId)
    .eq("upload_status", "active")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return ((data ?? []) as ProjectDocumentRow[]).map(toClientDocument);
}

async function getProjectDriveFolder(admin: AdminClient, projectId: string) {
  const { data, error } = await admin
    .from("projects")
    .select("project_id,drive_folder_id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false as const, status: 404, error: "project not found" };
  const folderId = requiredText(data.drive_folder_id, 220);
  if (!folderId) {
    return { ok: false as const, status: 400, error: "このPJに Drive folder id が未設定だよ" };
  }
  return { ok: true as const, folderId };
}

async function ensureDocumentsFolder(projectDriveFolderId: string) {
  const auth = await getGoogleAuthAsync();
  if (!auth) {
    throw new Error("Google Drive credential が未設定だよ");
  }

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

async function uploadDriveFile(params: {
  documentsFolderId: string;
  file: File;
  mimeType: string;
}) {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("Google Drive credential が未設定だよ");

  const drive = google.drive({ version: "v3", auth });
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const created = await drive.files.create({
    requestBody: {
      name: params.file.name || "project-document",
      parents: [params.documentsFolderId],
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(buffer),
    },
    fields: "id,name,mimeType,size,webViewLink",
    supportsAllDrives: true,
  });

  if (!created.data.id || !created.data.webViewLink) {
    throw new Error(`${params.file.name}: Drive upload response が不完全だよ`);
  }
  return created.data;
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  if (typeof error === "object" && error !== null) {
    const detail = error as {
      code?: number | string;
      response?: { status?: number; data?: { error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> } } };
    };
    const googleMessage = detail.response?.data?.error?.message;
    if (googleMessage) return googleMessage;
    const firstReason = detail.response?.data?.error?.errors?.find((item) => item.message || item.reason);
    if (firstReason?.message) return firstReason.message;
    if (firstReason?.reason) return firstReason.reason;
  }
  return message;
}

function googleDriveWriteError(error: unknown) {
  const message = errorMessage(error);
  const status = typeof error === "object" && error !== null
    ? (error as { code?: number | string; response?: { status?: number } }).response?.status ?? (error as { code?: number | string }).code
    : null;

  if (/File not found|not found|404/i.test(message) || status === 404) {
    return "Google Drive のPJフォルダが見つからないよ。projects.drive_folder_id が正しいか、そのGoogle credentialにフォルダが共有されているか確認が必要";
  }
  if (/insufficient authentication scopes|insufficientPermissions|insufficient/i.test(message)) {
    return "Google OAuth refresh token に Drive write scope が足りないよ。`https://www.googleapis.com/auth/drive` でrefresh tokenを再発行してVercel production envへ入れ直す必要がある";
  }
  if (/forbidden|permission|PERMISSION_DENIED|403/i.test(message) || status === 403) {
    return "Google Drive のPJフォルダへの書き込み権限が足りないよ。OAuthユーザーまたはService Accountを当該PJフォルダに編集者として共有してね";
  }
  if (/credential|auth|token/i.test(message)) {
    return `Google Drive credential を確認してね: ${message}`;
  }
  return message;
}

function databaseSaveError(error: unknown) {
  return `Drive保存後のOSリンク保存に失敗したよ。project_documents / service_role / RLS を確認してね: ${errorMessage(error)}`;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const projectId = requiredText(url.searchParams.get("project_id"), 80);
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const projectFolder = await getProjectDriveFolder(admin, projectId);
    const documents = await listDocuments(admin, projectId);
    return NextResponse.json({
      ok: true,
      documents,
      driveConfigured: projectFolder.ok,
      projectDriveFolderId: projectFolder.ok ? projectFolder.folderId : null,
      documentsFolderName: PROJECT_DOCUMENTS_FOLDER_NAME,
      warning: projectFolder.ok ? null : projectFolder.error,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "invalid form data" }, { status: 400 });
  }

  const projectId = requiredText(form.get("project_id"), 80);
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!projectId || files.length === 0) {
    return NextResponse.json({ ok: false, error: "project_id and files are required" }, { status: 400 });
  }

  for (const file of files) {
    const validation = validateFile(file);
    if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const admin = createAdminClient();
  const projectFolder = await getProjectDriveFolder(admin, projectId);
  if (!projectFolder.ok) {
    return NextResponse.json({ ok: false, error: projectFolder.error }, { status: projectFolder.status });
  }

  try {
    let documentsFolderId: string;
    try {
      documentsFolderId = await ensureDocumentsFolder(projectFolder.folderId);
    } catch (error) {
      return NextResponse.json({ ok: false, error: googleDriveWriteError(error) }, { status: 502 });
    }

    const rows: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.ok) throw new Error(validation.error);

      let uploaded: Awaited<ReturnType<typeof uploadDriveFile>>;
      try {
        uploaded = await uploadDriveFile({
          documentsFolderId,
          file,
          mimeType: validation.mimeType,
        });
      } catch (error) {
        return NextResponse.json({ ok: false, error: googleDriveWriteError(error) }, { status: 502 });
      }
      rows.push({
        project_id: projectId,
        drive_file_id: uploaded.id,
        project_drive_folder_id: projectFolder.folderId,
        drive_folder_id: documentsFolderId,
        web_view_link: uploaded.webViewLink,
        file_name: uploaded.name || file.name,
        mime_type: uploaded.mimeType || validation.mimeType,
        file_size_bytes: Number(uploaded.size || file.size) || file.size,
        source_kind: "manual_upload",
        uploaded_by: auth.user.email,
      });
    }

    const { error: insertError } = await admin.from("project_documents").insert(rows);
    if (insertError) {
      return NextResponse.json({ ok: false, error: databaseSaveError(insertError) }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      documents: await listDocuments(admin, projectId),
      documentsFolderId,
      documentsFolderName: PROJECT_DOCUMENTS_FOLDER_NAME,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}
