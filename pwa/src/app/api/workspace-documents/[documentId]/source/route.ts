import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWorkspaceDocumentHtml,
  normalizeWorkspaceDocumentHtmlSource,
} from "@/lib/workspace-documents-core";
import {
  publicWorkspaceDocument,
  resolveDocumentRowAccess,
  WORKSPACE_DOCUMENT_FIELDS,
  type WorkspaceDocumentRow,
} from "@/lib/workspace-documents-server";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function loadEditableHtmlDocument(documentId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("workspace_documents")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .eq("document_id", documentId)
    .eq("upload_status", "active")
    .maybeSingle();
  if (error) {
    console.error("[workspace-documents] html source lookup failed:", error.message);
    return { db, response: json({ ok: false, error: "HTML資料を読み込めなかったよ。" }, 500) } as const;
  }
  if (!data) return { db, response: json({ ok: false, error: "Not found" }, 404) } as const;

  const row = data as unknown as WorkspaceDocumentRow;
  const access = await resolveDocumentRowAccess(db, row);
  if (!access || (row.visibility === "amd_internal" && !access.canReadInternal)) {
    return { db, response: json({ ok: false, error: "Not found" }, 404) } as const;
  }
  if (!access.canUpload) {
    return { db, response: json({ ok: false, error: "このHTML資料は編集できないよ。" }, 403) } as const;
  }
  if (
    row.entry_kind !== "file"
    || !row.storage_bucket
    || !row.storage_path
    || !isWorkspaceDocumentHtml(row.mime_type, row.display_name)
  ) {
    return { db, response: json({ ok: false, error: "HTML資料ではないよ。" }, 400) } as const;
  }

  return { db, row, access, response: null } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const loaded = await loadEditableHtmlDocument(documentId);
  if (loaded.response) return loaded.response;

  const { db, row } = loaded;
  const storageBucket = row.storage_bucket;
  const storagePath = row.storage_path;
  if (!storageBucket || !storagePath) {
    return json({ ok: false, error: "HTML資料の保存先を確認できなかったよ。" }, 500);
  }
  const { data: file, error: downloadError } = await db.storage
    .from(storageBucket)
    .download(storagePath);
  if (downloadError || !file) {
    console.error("[workspace-documents] html source download failed:", downloadError?.message);
    return json({ ok: false, error: "HTML資料を読み込めなかったよ。" }, 500);
  }

  const source = await file.text();
  const normalized = normalizeWorkspaceDocumentHtmlSource(source);
  if (!normalized) {
    return json({ ok: false, error: "HTML編集は空欄にできず、本文は5MBまでだよ。" }, 413);
  }

  // 本文は署名URLで渡さず、同じrequestで再認可したJSON本文だけに載せる。
  return json({
    ok: true,
    source: normalized.source,
    byteLength: normalized.byteLength,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  if (!isSameOriginWorkspaceMutation(request)) {
    return json({ ok: false, error: "この操作元は確認できないよ。画面を再読み込みしてね。" }, 403);
  }

  const { documentId } = await params;
  const loaded = await loadEditableHtmlDocument(documentId);
  if (loaded.response) return loaded.response;

  const { db, row, access } = loaded;
  const storageBucket = row.storage_bucket;
  const storagePath = row.storage_path;
  if (!storageBucket || !storagePath) {
    return json({ ok: false, error: "HTML資料の保存先を確認できなかったよ。" }, 500);
  }
  const normalized = normalizeWorkspaceDocumentHtmlSource(await request.text());
  if (!normalized) {
    return json({ ok: false, error: "HTML編集は空欄にできず、本文は5MBまでだよ。" }, 400);
  }

  const sourceBytes = Buffer.from(normalized.source, "utf8");
  const mimeType = "text/html";
  const { error: uploadError } = await db.storage
    .from(storageBucket)
    .upload(storagePath, sourceBytes, {
      upsert: true,
      contentType: mimeType,
      cacheControl: "0",
    });
  if (uploadError) {
    console.error("[workspace-documents] html source replace failed:", uploadError.message);
    return json({ ok: false, error: "HTML資料を保存できなかったよ。" }, 500);
  }

  const { data: updated, error: updateError } = await db
    .from("workspace_documents")
    .update({
      content_sha256: createHash("sha256").update(sourceBytes).digest("hex"),
      file_size_bytes: sourceBytes.byteLength,
      mime_type: mimeType,
      updated_at: new Date().toISOString(),
    })
    .eq("document_id", documentId)
    .eq("upload_status", "active")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .single();
  if (updateError) {
    console.error("[workspace-documents] html source metadata update failed:", updateError.message);
    return json({ ok: false, error: "HTML資料の保存後確認に失敗したよ。" }, 500);
  }

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_mutated",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: {
      document_id: documentId,
      entry_kind: row.entry_kind,
      action: "replace_html",
      byte_length: sourceBytes.byteLength,
      mime_type: mimeType,
    },
  });

  return json({ ok: true, document: publicWorkspaceDocument(updated as unknown as WorkspaceDocumentRow) });
}
