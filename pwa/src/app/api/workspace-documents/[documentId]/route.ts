import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeDocumentFolderPath,
  normalizeDocumentName,
  normalizeDocumentVisibility,
} from "@/lib/workspace-documents-core";
import {
  publicWorkspaceDocument,
  resolveDocumentRowAccess,
  workspaceDocumentDestinationStatus,
  workspaceDocumentFolderHasSharedDescendants,
  WORKSPACE_DOCUMENT_FIELDS,
  type WorkspaceDocumentRow,
} from "@/lib/workspace-documents-server";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request): Promise<Body | null> {
  try {
    const parsed = await request.json();
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Body : null;
  } catch {
    return null;
  }
}

function mutationError(error: { code?: string; message: string }) {
  if (error.code === "23505") return json({ ok: false, error: "移動先に同名の資料があるよ。" }, 409);
  console.error("[workspace-documents] mutation failed:", error.message);
  return json({ ok: false, error: "資料を更新できなかったよ。" }, 500);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const body = await readBody(request);
  if (!body || typeof body.action !== "string") return json({ ok: false, error: "操作内容が不正だよ。" }, 400);

  const db = createAdminClient();
  const { data, error } = await db
    .from("workspace_documents")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .eq("document_id", documentId)
    .maybeSingle();
  if (error) return mutationError(error);
  if (!data) return json({ ok: false, error: "Not found" }, 404);
  const row = data as unknown as WorkspaceDocumentRow;

  const access = await resolveDocumentRowAccess(db, row);
  if (!access) return json({ ok: false, error: "Not found" }, 404);

  if (body.action === "fail_upload") {
    if (!access.canUpload || row.entry_kind !== "file" || row.upload_status !== "pending") {
      return json({ ok: false, error: "このアップロードは終了できないよ。" }, 403);
    }
    if (
      access.principal === "workspace_account"
      && row.created_by_account_id !== access.accountId
      && !access.canManage
    ) {
      return json({ ok: false, error: "このアップロードは終了できないよ。" }, 403);
    }
    const { error: failError } = await db
      .from("workspace_documents")
      .update({ upload_status: "failed" })
      .eq("document_id", documentId)
      .eq("upload_status", "pending");
    if (failError) return mutationError(failError);
    return json({ ok: true });
  }

  if (body.action === "complete_upload") {
    if (!access.canUpload || row.entry_kind !== "file" || row.upload_status !== "pending" || !row.storage_path || !row.storage_bucket) {
      return json({ ok: false, error: "このアップロードは確定できないよ。" }, 403);
    }
    if (
      access.principal === "workspace_account"
      && row.created_by_account_id !== access.accountId
      && !access.canManage
    ) {
      return json({ ok: false, error: "このアップロードは確定できないよ。" }, 403);
    }

    const { data: objectInfo, error: infoError } = await db.storage.from(row.storage_bucket).info(row.storage_path);
    if (infoError || !objectInfo) return json({ ok: false, error: "アップロード済みファイルを確認できなかったよ。" }, 409);

    const objectSize = Number(objectInfo.size || row.file_size_bytes || 0);
    const { data: updated, error: updateError } = await db
      .from("workspace_documents")
      .update({ upload_status: "active", file_size_bytes: objectSize })
      .eq("document_id", documentId)
      .eq("upload_status", "pending")
      .select(WORKSPACE_DOCUMENT_FIELDS)
      .single();
    if (updateError) return mutationError(updateError);

    await recordWorkspaceAuditEvent(db, {
      eventType: "workspace_document_upload_completed",
      userAccountId: access.accountId,
      email: access.accountId ? access.email : null,
      workspaceId: access.workspaceId,
      projectId: access.projectId,
      detail: { document_id: documentId, entry_kind: "file", visibility: row.visibility },
    });
    return json({ ok: true, document: publicWorkspaceDocument(updated as unknown as WorkspaceDocumentRow) });
  }

  if (!access.canManage) return json({ ok: false, error: "この資料は整理できないよ。" }, 403);

  if (body.action === "archive") {
    const { error: archiveError } = await db.rpc("workspace_archive_document", { p_document_id: documentId });
    if (archiveError) return mutationError(archiveError);
    await recordWorkspaceAuditEvent(db, {
      eventType: "workspace_document_mutated",
      userAccountId: access.accountId,
      email: access.accountId ? access.email : null,
      workspaceId: access.workspaceId,
      projectId: access.projectId,
      detail: { document_id: documentId, entry_kind: row.entry_kind, action: "archive" },
    });
    return json({ ok: true });
  }

  if (body.action !== "organize") return json({ ok: false, error: "操作内容が不正だよ。" }, 400);

  const displayName = normalizeDocumentName(body.displayName);
  const folderPath = normalizeDocumentFolderPath(body.folderPath);
  let visibility = normalizeDocumentVisibility(body.visibility, row.visibility);
  if (!displayName || folderPath == null || !visibility) {
    return json({ ok: false, error: "資料名・移動先・共有範囲を確認してね。" }, 400);
  }
  if (access.principal === "workspace_account") visibility = "workspace_shared";

  const destinationStatus = await workspaceDocumentDestinationStatus(db, access, folderPath, visibility);
  if (destinationStatus === "missing_folder") {
    return json({ ok: false, error: "移動先フォルダが見つからないよ。" }, 400);
  }
  if (destinationStatus === "internal_parent") {
    return json({ ok: false, error: "AMD内部フォルダには外部共有資料を置けないよ。" }, 409);
  }
  if (
    row.entry_kind === "folder"
    && visibility === "amd_internal"
    && await workspaceDocumentFolderHasSharedDescendants(db, row)
  ) {
    return json({ ok: false, error: "外部共有中の資料が入ってるため、先に中身の共有範囲を変えてね。" }, 409);
  }

  const { error: organizeError } = await db.rpc("workspace_move_document", {
    p_document_id: documentId,
    p_folder_path: folderPath,
    p_display_name: displayName,
    p_visibility: visibility,
  });
  if (organizeError) return mutationError(organizeError);

  const { data: updated, error: rereadError } = await db
    .from("workspace_documents")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .eq("document_id", documentId)
    .single();
  if (rereadError) return mutationError(rereadError);

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_mutated",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: { document_id: documentId, entry_kind: row.entry_kind, action: "organize", visibility },
  });
  return json({ ok: true, document: publicWorkspaceDocument(updated as unknown as WorkspaceDocumentRow) });
}
