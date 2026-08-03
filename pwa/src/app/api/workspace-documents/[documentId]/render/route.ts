import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWorkspaceDocumentHtml,
  WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES,
} from "@/lib/workspace-documents-core";
import {
  resolveDocumentRowAccess,
  WORKSPACE_DOCUMENT_FIELDS,
  type WorkspaceDocumentRow,
} from "@/lib/workspace-documents-server";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function contentDispositionFilename(name: string) {
  return encodeURIComponent(name).replace(/'/g, "%27");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const db = createAdminClient();
  const { data, error } = await db
    .from("workspace_documents")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .eq("document_id", documentId)
    .eq("upload_status", "active")
    .maybeSingle();
  if (error) {
    console.error("[workspace-documents] render lookup failed:", error.message);
    return json({ ok: false, error: "資料を開けなかったよ。" }, 500);
  }
  if (!data) return json({ ok: false, error: "Not found" }, 404);

  const row = data as unknown as WorkspaceDocumentRow;
  const access = await resolveDocumentRowAccess(db, row);
  if (!access || (row.visibility === "amd_internal" && !access.canReadInternal)) {
    return json({ ok: false, error: "Not found" }, 404);
  }
  if (
    row.entry_kind !== "file"
    || !row.storage_bucket
    || !row.storage_path
    || !isWorkspaceDocumentHtml(row.mime_type)
  ) {
    return json({ ok: false, error: "HTML資料ではないよ。" }, 400);
  }
  if (row.file_size_bytes > WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES) {
    return json({ ok: false, error: "HTMLプレビューは5MBまでだよ。ダウンロードして開いてね。" }, 413);
  }

  const { data: file, error: downloadError } = await db.storage
    .from(row.storage_bucket)
    .download(row.storage_path);
  if (downloadError || !file) {
    console.error("[workspace-documents] render download failed:", downloadError?.message);
    return json({ ok: false, error: "資料を開けなかったよ。" }, 500);
  }
  if (file.size > WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES) {
    return json({ ok: false, error: "HTMLプレビューは5MBまでだよ。ダウンロードして開いてね。" }, 413);
  }

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_opened",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: { document_id: documentId, entry_kind: row.entry_kind, action: "render_html" },
  });

  return new NextResponse(await file.text(), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `inline; filename*=UTF-8''${contentDispositionFilename(row.display_name)}`,
      "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; img-src data:; style-src 'unsafe-inline'; font-src data:; sandbox",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
