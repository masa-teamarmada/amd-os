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
  countWorkspaceDocumentSharedDescendants,
  WORKSPACE_DOCUMENT_FIELDS,
  type WorkspaceDocumentRow,
} from "@/lib/workspace-documents-server";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

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

function mimeType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 240 ? normalized : null;
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
  if (!isSameOriginWorkspaceMutation(request)) {
    return json({ ok: false, error: "この操作元は確認できないよ。画面を再読み込みしてね。" }, 403);
  }

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

  if (body.action === "complete_replace") {
    if (!access.canUpload || row.entry_kind !== "file" || row.upload_status !== "active" || !row.storage_path || !row.storage_bucket) {
      return json({ ok: false, error: "このファイルは置き換えを確定できないよ。" }, 403);
    }
    const replacementMimeType = mimeType(body.mimeType);
    if (!replacementMimeType) return json({ ok: false, error: "ファイル形式を確認できないよ。" }, 400);

    const { data: objectInfo, error: infoError } = await db.storage.from(row.storage_bucket).info(row.storage_path);
    if (infoError || !objectInfo) return json({ ok: false, error: "置き換えたファイルを確認できなかったよ。" }, 409);

    const objectSize = Number(objectInfo.size || 0);
    const { data: updated, error: updateError } = await db
      .from("workspace_documents")
      .update({
        mime_type: replacementMimeType,
        file_size_bytes: objectSize,
        source_kind: "manual_upload",
        source_ref: null,
        content_sha256: null,
        source_updated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("document_id", documentId)
      .eq("entry_kind", "file")
      .eq("upload_status", "active")
      .select(WORKSPACE_DOCUMENT_FIELDS)
      .single();
    if (updateError) return mutationError(updateError);

    await recordWorkspaceAuditEvent(db, {
      eventType: "workspace_document_mutated",
      userAccountId: access.accountId,
      email: access.accountId ? access.email : null,
      workspaceId: access.workspaceId,
      projectId: access.projectId,
      detail: { document_id: documentId, entry_kind: "file", action: "replace_file" },
    });
    return json({ ok: true, document: publicWorkspaceDocument(updated as unknown as WorkspaceDocumentRow) });
  }

  if (body.action === "archive") {
    if (!access.canUpload) return json({ ok: false, error: "この資料は削除できないよ。" }, 403);
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

  if (!access.canManage) return json({ ok: false, error: "この資料は整理できないよ。" }, 403);

  if (body.action !== "organize") return json({ ok: false, error: "操作内容が不正だよ。" }, 400);

  const displayName = normalizeDocumentName(body.displayName);
  const folderPath = normalizeDocumentFolderPath(body.folderPath);
  let visibility = normalizeDocumentVisibility(body.visibility, row.visibility);
  if (!displayName || folderPath == null || !visibility) {
    return json({ ok: false, error: "資料名・移動先・共有範囲を確認してね。" }, 400);
  }
  if (access.principal === "workspace_account") visibility = "workspace_shared";
  // externalアカウントは常にworkspace_sharedへ固定されるため、この時点でvisibilityが
  // amd_internalになり得るのはinternal_memberだけ。cascade分岐もこの前提の上に乗る。
  const cascadeVisibility = body.cascadeVisibility === true;

  if (
    row.folder_path === folderPath
    && row.display_name === displayName
    && row.visibility === visibility
  ) {
    return json({ ok: true, document: publicWorkspaceDocument(row) });
  }

  const destinationStatus = await workspaceDocumentDestinationStatus(db, access, folderPath, visibility);
  if (destinationStatus === "missing_folder") {
    return json({ ok: false, error: "移動先フォルダが見つからないよ。" }, 400);
  }
  if (destinationStatus === "internal_parent") {
    return json({ ok: false, error: "AMD内部フォルダには外部共有資料を置けないよ。" }, 409);
  }

  let cascadeAffected = 0;
  if (row.entry_kind === "folder" && visibility === "amd_internal") {
    cascadeAffected = await countWorkspaceDocumentSharedDescendants(db, row);
    if (cascadeAffected > 0) {
      if (!cascadeVisibility) {
        return json({
          ok: false,
          error: "外部共有中の資料が入ってるため、先に中身の共有範囲を変えてね。",
          code: "shared_descendants",
          affected: cascadeAffected,
        }, 409);
      }

      // 配下ごとの一括内部化は既存rename/move経路と分け、専用RPCで1トランザクションにする。
      // workspace_sharedへの一括変更はここでは呼ばない(内部化専用)。
      const { error: cascadeError } = await db.rpc("workspace_set_folder_visibility_cascade", {
        p_document_id: documentId,
        p_visibility: visibility,
      });
      if (cascadeError) return mutationError(cascadeError);

      await recordWorkspaceAuditEvent(db, {
        eventType: "workspace_document_mutated",
        userAccountId: access.accountId,
        email: access.accountId ? access.email : null,
        workspaceId: access.workspaceId,
        projectId: access.projectId,
        detail: {
          document_id: documentId,
          entry_kind: row.entry_kind,
          action: "organize_cascade",
          affected: cascadeAffected,
        },
      });
    }
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
  return json({
    ok: true,
    document: publicWorkspaceDocument(updated as unknown as WorkspaceDocumentRow),
    ...(cascadeAffected > 0 ? { affected: cascadeAffected } : {}),
  });
}
