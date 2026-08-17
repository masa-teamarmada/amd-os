import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveDocumentRowAccess,
  WORKSPACE_DOCUMENT_FIELDS,
  type WorkspaceDocumentRow,
} from "@/lib/workspace-documents-server";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import {
  isWorkspaceDocumentHtml,
  isWorkspaceDocumentMarkdown,
} from "@/lib/workspace-documents-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  request: Request,
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
    console.error("[workspace-documents] open lookup failed:", error.message);
    return json({ ok: false, error: "資料を開けなかったよ。" }, 500);
  }
  if (!data) return json({ ok: false, error: "Not found" }, 404);
  const row = data as unknown as WorkspaceDocumentRow;
  const access = await resolveDocumentRowAccess(db, row);
  if (!access || (row.visibility === "amd_internal" && !access.canReadInternal)) {
    return json({ ok: false, error: "Not found" }, 404);
  }
  if (row.entry_kind === "folder") return json({ ok: false, error: "フォルダは一覧から開いてね。" }, 400);

  const download = new URL(request.url).searchParams.get("download") !== "0";
  if (!download && isWorkspaceDocumentHtml(row.mime_type, row.display_name)) {
    return NextResponse.redirect(
      new URL(`/api/workspace-documents/${encodeURIComponent(documentId)}/render`, request.url),
      303,
    );
  }
  if (!download && isWorkspaceDocumentMarkdown(row.mime_type, row.display_name)) {
    return NextResponse.redirect(
      new URL(`/workspace-document/${encodeURIComponent(documentId)}`, request.url),
      303,
    );
  }

  let destination: string | null = null;
  if (row.entry_kind === "link") {
    destination = row.external_url;
  } else if (row.storage_bucket && row.storage_path) {
    const { data: signed, error: signedError } = await db.storage
      .from(row.storage_bucket)
      .createSignedUrl(row.storage_path, 60, { download: download ? row.display_name : false });
    if (signedError) {
      console.error("[workspace-documents] signed read failed:", signedError.message);
      return json({ ok: false, error: "資料を開けなかったよ。" }, 500);
    }
    destination = signed?.signedUrl ?? null;
  }
  if (!destination) return json({ ok: false, error: "資料の保存先を確認できなかったよ。" }, 500);

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_opened",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: { document_id: documentId, entry_kind: row.entry_kind, action: "open" },
  });

  return NextResponse.redirect(destination, 303);
}
