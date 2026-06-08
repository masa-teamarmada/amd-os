import { Readable } from "node:stream";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MARKDOWN_PREVIEW_BYTES = 2 * 1024 * 1024;

interface ProjectDocumentContentRow {
  document_id: string;
  project_id: string;
  drive_file_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  web_view_link: string;
  upload_status: string;
}

function isMarkdownDocument(row: ProjectDocumentContentRow) {
  const name = row.file_name.toLowerCase();
  const mime = row.mime_type.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown") || mime === "text/markdown";
}

function decodeDriveMedia(data: unknown) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof Uint8Array) return Buffer.from(data).toString("utf8");
  return String(data ?? "");
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { documentId } = await context.params;
  if (!documentId) {
    return NextResponse.json({ ok: false, error: "documentId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("project_documents")
    .select("document_id,project_id,drive_file_id,file_name,mime_type,file_size_bytes,web_view_link,upload_status")
    .eq("document_id", documentId)
    .eq("upload_status", "active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "document not found" }, { status: 404 });
  }

  const row = data as ProjectDocumentContentRow;
  if (!isMarkdownDocument(row)) {
    return NextResponse.json({ ok: false, error: "markdown preview is only available for .md files" }, { status: 400 });
  }
  if (Number(row.file_size_bytes) > MAX_MARKDOWN_PREVIEW_BYTES) {
    return NextResponse.json({ ok: false, error: "markdown preview is limited to 2MB" }, { status: 413 });
  }

  const googleAuth = await getGoogleAuthAsync();
  if (!googleAuth) {
    return NextResponse.json({ ok: false, error: "Google Drive credential が未設定だよ" }, { status: 500 });
  }

  const drive = google.drive({ version: "v3", auth: googleAuth });
  const file = await drive.files.get(
    {
      fileId: row.drive_file_id,
      alt: "media",
      supportsAllDrives: true,
    },
    { responseType: "arraybuffer" },
  );

  return NextResponse.json({
    ok: true,
    document: {
      documentId: row.document_id,
      projectId: row.project_id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: Number(row.file_size_bytes) || 0,
      webViewLink: row.web_view_link,
    },
    markdown: decodeDriveMedia(file.data),
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { documentId } = await context.params;
  if (!documentId) {
    return NextResponse.json({ ok: false, error: "documentId is required" }, { status: 400 });
  }

  let body: { markdown?: unknown };
  try {
    body = (await req.json()) as { markdown?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (typeof body.markdown !== "string") {
    return NextResponse.json({ ok: false, error: "markdown is required" }, { status: 400 });
  }

  const bytes = Buffer.byteLength(body.markdown, "utf8");
  if (bytes > MAX_MARKDOWN_PREVIEW_BYTES) {
    return NextResponse.json({ ok: false, error: "markdown edit is limited to 2MB" }, { status: 413 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("project_documents")
    .select("document_id,project_id,drive_file_id,file_name,mime_type,file_size_bytes,web_view_link,upload_status")
    .eq("document_id", documentId)
    .eq("upload_status", "active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "document not found" }, { status: 404 });
  }

  const row = data as ProjectDocumentContentRow;
  if (!isMarkdownDocument(row)) {
    return NextResponse.json({ ok: false, error: "markdown edit is only available for .md files" }, { status: 400 });
  }

  const googleAuth = await getGoogleAuthAsync();
  if (!googleAuth) {
    return NextResponse.json({ ok: false, error: "Google Drive credential が未設定だよ" }, { status: 500 });
  }

  const drive = google.drive({ version: "v3", auth: googleAuth });
  const mimeType = row.mime_type || "text/markdown";
  const updated = await drive.files.update({
    fileId: row.drive_file_id,
    media: {
      mimeType,
      body: Readable.from(Buffer.from(body.markdown, "utf8")),
    },
    fields: "id,name,mimeType,size,webViewLink",
    supportsAllDrives: true,
  });

  const { error: updateError } = await admin
    .from("project_documents")
    .update({
      file_size_bytes: Number(updated.data.size || bytes) || bytes,
      mime_type: updated.data.mimeType || row.mime_type,
      web_view_link: updated.data.webViewLink || row.web_view_link,
      updated_at: new Date().toISOString(),
    })
    .eq("document_id", row.document_id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    document: {
      documentId: row.document_id,
      projectId: row.project_id,
      fileName: updated.data.name || row.file_name,
      mimeType: updated.data.mimeType || row.mime_type,
      fileSizeBytes: Number(updated.data.size || bytes) || bytes,
      webViewLink: updated.data.webViewLink || row.web_view_link,
    },
    markdown: body.markdown,
  });
}
