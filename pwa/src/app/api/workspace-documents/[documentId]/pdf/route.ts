import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWorkspaceDocumentHtml,
  WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES,
  WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES,
  WORKSPACE_DOCUMENT_PDF_DOWNLOAD_URL_TTL_SECONDS,
  workspaceDocumentPdfCacheStoragePath,
  workspaceDocumentPdfDownloadName,
} from "@/lib/workspace-documents-core";
import { loadWorkspaceDocumentText } from "@/lib/workspace-document-text";
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

// 署名Storage URLへ即転送する。旧クライアント(v3.82.5未満)はこのURLをresponse.blob()化して
// 保存するため、JSONを返すとPDFではなくJSON本文をPDF名で保存してしまう(2026-08-19発覚)。
// リダイレクトなら旧クライアントもfetchのredirect追跡で実PDF bytesを受け取れる。
function redirectToSignedPdf(signedUrl: string) {
  return NextResponse.redirect(signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  // 新クライアントは`?delivery=json`を明示し、資料室内のエラーUIを維持したままJSONで署名URLを受け取る。
  // 既定(クエリなし)は旧クライアント互換のためredirectにする。
  const wantsJson = new URL(request.url).searchParams.get("delivery") === "json";
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
    (row.entry_kind !== "file" && row.entry_kind !== "link")
    || !isWorkspaceDocumentHtml(row.mime_type, row.display_name)
  ) {
    return json({ ok: false, error: "HTML資料ではないよ。" }, 400);
  }
  if (row.file_size_bytes > WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES) {
    return json({ ok: false, error: "HTML資料は8MBまでPDF化できるよ。" }, 413);
  }

  const loaded = await loadWorkspaceDocumentText(db, row, WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);

  let pdf: Buffer;
  try {
    pdf = await renderWorkspaceDocumentHtmlToPdf(loaded.text);
  } catch (conversionError) {
    console.error("[workspace-documents] pdf conversion failed:", conversionError);
    return json({ ok: false, error: "PDFを生成できなかったよ。時間をおいてもう一度試してね。" }, 502);
  }
  const maxOutputMb = Math.round(WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES / (1024 * 1024));
  if (pdf.byteLength > WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES) {
    return json({ ok: false, error: `PDFが${maxOutputMb}MBを超えたためダウンロードできないよ。` }, 413);
  }

  // Vercel Node FunctionのレスポンスbodyにはPDFを直接載せない (4.5MBのplatform上限に
  // ぶつかるため)。生成物は既存のprivate Storageへ置き、短命の署名URLだけを返す。
  const pdfStoragePath = workspaceDocumentPdfCacheStoragePath(access.scopeKind, access.scopeId, documentId);
  const { error: uploadError } = await db.storage
    .from(row.storage_bucket ?? "workspace-files")
    .upload(pdfStoragePath, pdf, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "0",
    });
  if (uploadError) {
    console.error("[workspace-documents] pdf cache upload failed:", uploadError.message);
    return json({ ok: false, error: "PDFを保存できなかったよ。時間をおいてもう一度試してね。" }, 500);
  }

  const downloadName = workspaceDocumentPdfDownloadName(row.display_name);
  const { data: signed, error: signedError } = await db.storage
    .from(row.storage_bucket ?? "workspace-files")
    .createSignedUrl(pdfStoragePath, WORKSPACE_DOCUMENT_PDF_DOWNLOAD_URL_TTL_SECONDS, { download: downloadName });
  if (signedError || !signed?.signedUrl) {
    console.error("[workspace-documents] pdf signed url failed:", signedError?.message);
    return json({ ok: false, error: "PDFのダウンロードURLを発行できなかったよ。" }, 500);
  }

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_opened",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: { document_id: documentId, entry_kind: row.entry_kind, action: "download_html_as_pdf" },
  });

  if (!wantsJson) return redirectToSignedPdf(signed.signedUrl);

  return json({
    ok: true,
    downloadUrl: signed.signedUrl,
    fileName: downloadName,
    byteLength: pdf.byteLength,
    expiresInSeconds: WORKSPACE_DOCUMENT_PDF_DOWNLOAD_URL_TTL_SECONDS,
  });
}
