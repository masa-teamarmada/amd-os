import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEETING_ASSETS_BUCKET = "meeting-assets";
const DRIVE_BACKED_BUCKET = "google-drive";
const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const ASSET_KINDS = new Set(["upload", "paste", "screen_capture", "notion_image", "generated"]);

type AdminClient = ReturnType<typeof createAdminClient>;

interface MeetingAssetRow {
  asset_id: string;
  meeting_id: string;
  project_id: string;
  storage_bucket: string;
  storage_path: string;
  drive_file_id: string | null;
  project_drive_folder_id: string | null;
  drive_folder_id: string | null;
  drive_folder_name: string | null;
  drive_folder_web_view_link: string | null;
  web_view_link: string | null;
  folder_display_path: string | null;
  file_name: string;
  media_type: string;
  file_size_bytes: number;
  asset_kind: string;
  caption: string | null;
  extracted_text: string | null;
  source_url: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function requiredText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeAssetKind(value: unknown): string {
  const kind = requiredText(value, 40);
  return ASSET_KINDS.has(kind) ? kind : "upload";
}

function safeFileName(name: string): string {
  return name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 120) || "meeting-asset";
}

function safeDriveNamePart(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#%{}~[\]^`]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/_+/g, "_")
    .trim()
    .replace(/[. ]+$/g, "");
  return normalized.slice(0, 120) || "MTG";
}

function contentTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

function validateFile(file: File): { ok: true; mediaType: string } | { ok: false; error: string } {
  const mediaType = file.type || contentTypeFromName(file.name);
  if (file.size > MAX_ASSET_BYTES) {
    return { ok: false, error: `${file.name}: 50MB 以内にしてね` };
  }
  return { ok: true, mediaType };
}

function yyMMdd(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

function meetingFolderName(meetingDate: string, title: string): string {
  const datePart = yyMMdd(meetingDate);
  if (!datePart) throw new Error("会議日が未確定なのでDrive保存先フォルダを作れないよ");
  return `${datePart}_${safeDriveNamePart(title || "MTG")}`;
}

function driveQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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

async function getProjectDriveFolder(admin: AdminClient, projectId: string) {
  const { data, error } = await admin
    .from("projects")
    .select("project_id,drive_folder_id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false as const, status: 404, error: "project not found" };
  const folderId = requiredText(data.drive_folder_id, 220);
  if (!folderId) return { ok: false as const, status: 400, error: "このPJに Drive folder id が未設定だよ" };
  return { ok: true as const, folderId };
}

async function ensureMeetingFolder(projectDriveFolderId: string, folderName: string) {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("Google Drive credential が未設定だよ");

  const drive = google.drive({ version: "v3", auth });
  const escapedName = driveQueryLiteral(folderName);
  const escapedParent = driveQueryLiteral(projectDriveFolderId);
  const existing = await drive.files.list({
    q: `'${escapedParent}' in parents and name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name,webViewLink)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const folder = existing.data.files?.[0];
  if (folder?.id) {
    return { id: folder.id, webViewLink: folder.webViewLink ?? null };
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [projectDriveFolderId],
    },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error("Drive MTGフォルダの作成に失敗したよ");
  return { id: created.data.id, webViewLink: created.data.webViewLink ?? null };
}

async function uploadDriveFile(params: {
  folderId: string;
  file: File;
  mimeType: string;
}) {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("Google Drive credential が未設定だよ");

  const drive = google.drive({ version: "v3", auth });
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const created = await drive.files.create({
    requestBody: {
      name: params.file.name || "meeting-asset",
      parents: [params.folderId],
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

async function toClientAsset(admin: AdminClient, row: MeetingAssetRow) {
  if (row.drive_file_id || row.storage_bucket === DRIVE_BACKED_BUCKET) {
    const fileUrl = `/api/meeting-assets/file/${row.asset_id}`;
    return {
      assetId: row.asset_id,
      meetingId: row.meeting_id,
      projectId: row.project_id,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
      driveFileId: row.drive_file_id ?? null,
      projectDriveFolderId: row.project_drive_folder_id ?? null,
      driveFolderId: row.drive_folder_id ?? null,
      driveFolderName: row.drive_folder_name ?? null,
      driveFolderUrl: row.drive_folder_web_view_link ?? null,
      folderDisplayPath: row.folder_display_path ?? (row.drive_folder_name ? `PJフォルダ / ${row.drive_folder_name}` : null),
      webViewLink: row.web_view_link ?? null,
      fileName: row.file_name,
      mediaType: row.media_type,
      fileSizeBytes: row.file_size_bytes,
      assetKind: row.asset_kind,
      caption: row.caption ?? "",
      extractedText: row.extracted_text ?? "",
      sourceUrl: row.source_url ?? row.web_view_link ?? null,
      sortOrder: row.sort_order,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      signedUrl: fileUrl,
      fileUrl,
    };
  }

  const { data } = await admin.storage
    .from(row.storage_bucket || MEETING_ASSETS_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

  return {
    assetId: row.asset_id,
    meetingId: row.meeting_id,
    projectId: row.project_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    driveFileId: null,
    projectDriveFolderId: null,
    driveFolderId: null,
    driveFolderName: null,
    driveFolderUrl: null,
    folderDisplayPath: null,
    webViewLink: null,
    fileName: row.file_name,
    mediaType: row.media_type,
    fileSizeBytes: row.file_size_bytes,
    assetKind: row.asset_kind,
    caption: row.caption ?? "",
    extractedText: row.extracted_text ?? "",
    sourceUrl: row.source_url ?? null,
    sortOrder: row.sort_order,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signedUrl: data?.signedUrl ?? `/api/meeting-assets/file/${row.asset_id}`,
    fileUrl: `/api/meeting-assets/file/${row.asset_id}`,
  };
}

async function listAssets(admin: AdminClient, meetingId: string) {
  const { data, error } = await admin
    .from("meeting_assets")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return Promise.all(((data ?? []) as MeetingAssetRow[]).map((row) => toClientAsset(admin, row)));
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const meetingId = requiredText(url.searchParams.get("meeting_id"), 300);
  if (!meetingId) {
    return NextResponse.json({ ok: false, error: "meeting_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const assets = await listAssets(admin, meetingId);
    return NextResponse.json({ ok: true, assets });
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

  const meetingId = requiredText(form.get("meeting_id"), 300);
  const assetKind = normalizeAssetKind(form.get("asset_kind"));
  const caption = nullableText(form.get("caption"), 1000);
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!meetingId || files.length === 0) {
    return NextResponse.json({ ok: false, error: "meeting_id and files are required" }, { status: 400 });
  }

  for (const file of files) {
    const validation = validateFile(file);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data: meeting, error: meetingError } = await admin
    .from("project_meeting_summaries")
    .select("meeting_id,project_id,meeting_date,title")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (meetingError) {
    return NextResponse.json({ ok: false, error: meetingError.message }, { status: 500 });
  }
  if (!meeting) {
    return NextResponse.json({ ok: false, error: "meeting not found" }, { status: 404 });
  }

  const projectId = String(meeting.project_id);
  const projectFolder = await getProjectDriveFolder(admin, projectId);
  if (!projectFolder.ok) {
    return NextResponse.json({ ok: false, error: projectFolder.error }, { status: projectFolder.status });
  }

  const { data: lastAsset } = await admin
    .from("meeting_assets")
    .select("sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSortOrder = typeof lastAsset?.sort_order === "number" ? lastAsset.sort_order + 10 : 10;
  const rows: Array<Record<string, unknown>> = [];

  try {
    const folderName = meetingFolderName(String(meeting.meeting_date || ""), String(meeting.title || ""));
    let meetingFolder: Awaited<ReturnType<typeof ensureMeetingFolder>>;
    try {
      meetingFolder = await ensureMeetingFolder(projectFolder.folderId, folderName);
    } catch (error) {
      return NextResponse.json({ ok: false, error: googleDriveWriteError(error) }, { status: 502 });
    }

    for (const [index, file] of files.entries()) {
      const validation = validateFile(file);
      if (!validation.ok) throw new Error(validation.error);

      const assetId = crypto.randomUUID();
      const safeName = safeFileName(file.name || `${assetKind}-${index + 1}.png`);
      let uploaded: Awaited<ReturnType<typeof uploadDriveFile>>;
      try {
        uploaded = await uploadDriveFile({
          folderId: meetingFolder.id,
          file,
          mimeType: validation.mediaType,
        });
      } catch (error) {
        return NextResponse.json({ ok: false, error: googleDriveWriteError(error) }, { status: 502 });
      }

      rows.push({
        asset_id: assetId,
        meeting_id: meetingId,
        project_id: projectId,
        storage_bucket: DRIVE_BACKED_BUCKET,
        storage_path: uploaded.id,
        drive_file_id: uploaded.id,
        project_drive_folder_id: projectFolder.folderId,
        drive_folder_id: meetingFolder.id,
        drive_folder_name: folderName,
        drive_folder_web_view_link: meetingFolder.webViewLink,
        web_view_link: uploaded.webViewLink,
        folder_display_path: `PJフォルダ / ${folderName}`,
        file_name: file.name || safeName,
        media_type: uploaded.mimeType || validation.mediaType,
        file_size_bytes: Number(uploaded.size || file.size) || file.size,
        asset_kind: assetKind,
        caption,
        source_url: uploaded.webViewLink,
        sort_order: nextSortOrder,
        created_by: auth.user.email,
      });
      nextSortOrder += 10;
    }

    const { error: insertError } = await admin.from("meeting_assets").insert(rows);
    if (insertError) throw insertError;

    const assets = await listAssets(admin, meetingId);
    return NextResponse.json({ ok: true, assets });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const assetId = requiredText(body.asset_id, 80);
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "asset_id is required" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("caption" in body) update.caption = nullableText(body.caption, 1000);
  if ("sort_order" in body) {
    const order = Number(body.sort_order);
    if (Number.isFinite(order)) update.sort_order = Math.round(order);
  }
  if ("extracted_text" in body) update.extracted_text = nullableText(body.extracted_text, 12000);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("meeting_assets")
    .update(update)
    .eq("asset_id", assetId)
    .select("*")
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, asset: await toClientAsset(admin, data as MeetingAssetRow) });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const assetId = requiredText(url.searchParams.get("asset_id"), 80);
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "asset_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: asset, error: selectError } = await admin
    .from("meeting_assets")
    .select("*")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ ok: false, error: selectError.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ ok: false, error: "asset not found" }, { status: 404 });
  }

  const row = asset as MeetingAssetRow;
  if (!row.drive_file_id && row.storage_bucket !== DRIVE_BACKED_BUCKET) {
    const { error: storageError } = await admin.storage.from(row.storage_bucket || MEETING_ASSETS_BUCKET).remove([row.storage_path]);
    if (storageError) {
      return NextResponse.json({ ok: false, error: storageError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await admin.from("meeting_assets").delete().eq("asset_id", assetId);
  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedAssetId: assetId, meetingId: row.meeting_id });
}
