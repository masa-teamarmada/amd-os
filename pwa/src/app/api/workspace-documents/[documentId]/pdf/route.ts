import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWorkspaceDocumentHtml,
  WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES,
  WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES,
  workspaceDocumentPdfDownloadName,
} from "@/lib/workspace-documents-core";
import {
  resolveDocumentRowAccess,
  WORKSPACE_DOCUMENT_FIELDS,
  type WorkspaceDocumentRow,
} from "@/lib/workspace-documents-server";
import { renderWorkspaceDocumentHtmlToPdf } from "@/lib/workspace-document-html-pdf";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    console.error("[workspace-documents] pdf lookup failed:", error.message);
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
    || !isWorkspaceDocumentHtml(row.mime_type, row.display_name)
  ) {
    return json({ ok: false, error: "HTML資料ではないよ。" }, 400);
  }
  if (row.file_size_bytes > WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES) {
    return json({ ok: false, error: "HTML資料は8MBまでPDF化できるよ。" }, 413);
  }

  const { data: file, error: downloadError } = await db.storage
    .from(row.storage_bucket)
    .download(row.storage_path);
  if (downloadError || !file) {
    console.error("[workspace-documents] pdf download failed:", downloadError?.message);
    return json({ ok: false, error: "資料を開けなかったよ。" }, 500);
  }
  if (file.size > WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES) {
    return json({ ok: false, error: "HTML資料は8MBまでPDF化できるよ。" }, 413);
  }

  let pdf: Buffer;
  try {
    pdf = await renderWorkspaceDocumentHtmlToPdf(await file.text());
  } catch (conversionError) {
    console.error("[workspace-documents] pdf conversion failed:", conversionError);
    return json({ ok: false, error: "PDFを生成できなかったよ。時間をおいてもう一度試してね。" }, 502);
  }
  if (pdf.byteLength > WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES) {
    return json({ ok: false, error: "PDFが4MBを超えたためダウンロードできないよ。" }, 413);
  }

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_opened",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: { document_id: documentId, entry_kind: row.entry_kind, action: "download_html_as_pdf" },
  });

  const responseBytes = new Uint8Array(pdf.byteLength);
  responseBytes.set(pdf);
  return new NextResponse(responseBytes, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename*=UTF-8''${contentDispositionFilename(workspaceDocumentPdfDownloadName(row.display_name))}`,
      "Content-Length": String(pdf.byteLength),
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
