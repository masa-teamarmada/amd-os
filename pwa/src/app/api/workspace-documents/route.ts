import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWorkspaceDocumentAccess } from "@/lib/workspace-document-access";
import {
  normalizeDocumentFolderPath,
  normalizeDocumentName,
  normalizeDocumentVisibility,
  normalizeHttpUrl,
  workspaceDocumentStoragePath,
  WORKSPACE_DOCUMENT_MAX_BYTES,
  WORKSPACE_DOCUMENTS_BUCKET,
  type WorkspaceDocumentScopeKind,
} from "@/lib/workspace-documents-core";
import {
  publicWorkspaceDocument,
  workspaceDocumentDestinationStatus,
  workspaceDocumentOwnerInsert,
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

function text(value: unknown, max = 4000) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function parseScope(request: Request): { kind: WorkspaceDocumentScopeKind; id: string } | null {
  const url = new URL(request.url);
  const kind = url.searchParams.get("scope_kind");
  const id = url.searchParams.get("scope_id")?.trim();
  if ((kind !== "institution" && kind !== "project") || !id || id.length > 160) return null;
  return { kind, id };
}

async function readBody(request: Request): Promise<Body | null> {
  try {
    const parsed = await request.json();
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Body : null;
  } catch {
    return null;
  }
}

function safeInsertError(error: { code?: string; message: string }) {
  if (error.code === "23505") return json({ ok: false, error: "同じ場所に同名の資料があるよ。" }, 409);
  console.error("[workspace-documents] insert failed:", error.message);
  return json({ ok: false, error: "資料を保存できなかったよ。" }, 500);
}

export async function GET(request: Request) {
  const scope = parseScope(request);
  if (!scope) return json({ ok: false, error: "資料室の指定が不正だよ。" }, 400);

  const access = await resolveWorkspaceDocumentAccess(scope.kind, scope.id);
  if (!access) return json({ ok: false, error: "Not found" }, 404);

  const db = createAdminClient();
  let query = db
    .from("workspace_documents")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .eq("scope_kind", scope.kind)
    .eq("upload_status", "active")
    .order("entry_kind", { ascending: false })
    .order("display_name")
    .limit(3000);

  query = scope.kind === "project"
    ? query.eq("project_id", access.projectId)
    : query.eq("institution_workspace_id", access.workspaceId);
  if (!access.canReadInternal) query = query.eq("visibility", "workspace_shared");

  const { data, error } = await query;
  if (error) {
    console.error("[workspace-documents] list failed:", error.message);
    return json({ ok: false, error: "資料一覧を読み込めなかったよ。" }, 500);
  }

  return json({
    ok: true,
    documents: ((data ?? []) as unknown as WorkspaceDocumentRow[]).map(publicWorkspaceDocument),
    permissions: {
      principal: access.principal,
      role: access.role,
      canReadInternal: access.canReadInternal,
      canUpload: access.canUpload,
      canManage: access.canManage,
    },
  });
}

export async function POST(request: Request) {
  const scope = parseScope(request);
  if (!scope) return json({ ok: false, error: "資料室の指定が不正だよ。" }, 400);

  const access = await resolveWorkspaceDocumentAccess(scope.kind, scope.id);
  if (!access) return json({ ok: false, error: "Not found" }, 404);
  if (!access.canUpload) return json({ ok: false, error: "この資料室には追加できないよ。" }, 403);

  const body = await readBody(request);
  if (!body) return json({ ok: false, error: "入力内容を読み取れなかったよ。" }, 400);

  const action = text(body.action, 40);
  const displayName = normalizeDocumentName(body.displayName);
  const folderPath = normalizeDocumentFolderPath(body.folderPath);
  let visibility = normalizeDocumentVisibility(body.visibility);
  if (!action || !displayName || folderPath == null || !visibility) {
    return json({ ok: false, error: "資料名・保存先・共有範囲を確認してね。" }, 400);
  }
  if (access.principal === "workspace_account") visibility = "workspace_shared";

  const db = createAdminClient();
  const owner = workspaceDocumentOwnerInsert(access);
  const actor = {
    created_by_account_id: access.accountId,
    created_by_member_id: access.memberId,
  };
  const destinationStatus = await workspaceDocumentDestinationStatus(db, access, folderPath, visibility);
  if (destinationStatus === "missing_folder") {
    return json({ ok: false, error: "保存先フォルダが見つからないよ。" }, 400);
  }
  if (destinationStatus === "internal_parent") {
    return json({ ok: false, error: "AMD内部フォルダには外部共有資料を置けないよ。" }, 409);
  }

  if (action === "create_folder") {
    const { data, error } = await db.from("workspace_documents").insert({
      ...owner,
      ...actor,
      entry_kind: "folder",
      visibility,
      folder_path: folderPath,
      display_name: displayName,
      storage_bucket: null,
      storage_path: null,
      external_url: null,
      mime_type: "application/x-directory",
      upload_status: "active",
      source_kind: "manual_folder",
      published_at: visibility === "workspace_shared" ? new Date().toISOString() : null,
    }).select(WORKSPACE_DOCUMENT_FIELDS).single();
    if (error) return safeInsertError(error);
    const created = data as unknown as WorkspaceDocumentRow;
    await recordWorkspaceAuditEvent(db, {
      eventType: "workspace_document_created",
      userAccountId: access.accountId,
      email: access.accountId ? access.email : null,
      workspaceId: access.workspaceId,
      projectId: access.projectId,
      detail: { document_id: created.document_id, entry_kind: "folder", visibility },
    });
    return json({ ok: true, document: publicWorkspaceDocument(created) }, 201);
  }

  if (action === "create_link") {
    const externalUrl = normalizeHttpUrl(body.externalUrl);
    if (!externalUrl) return json({ ok: false, error: "http または https のURLを入れてね。" }, 400);
    const { data, error } = await db.from("workspace_documents").insert({
      ...owner,
      ...actor,
      entry_kind: "link",
      visibility,
      folder_path: folderPath,
      display_name: displayName,
      external_url: externalUrl,
      storage_bucket: null,
      storage_path: null,
      mime_type: "text/uri-list",
      upload_status: "active",
      source_kind: "manual_link",
      published_at: visibility === "workspace_shared" ? new Date().toISOString() : null,
    }).select(WORKSPACE_DOCUMENT_FIELDS).single();
    if (error) return safeInsertError(error);
    const created = data as unknown as WorkspaceDocumentRow;
    await recordWorkspaceAuditEvent(db, {
      eventType: "workspace_document_created",
      userAccountId: access.accountId,
      email: access.accountId ? access.email : null,
      workspaceId: access.workspaceId,
      projectId: access.projectId,
      detail: { document_id: created.document_id, entry_kind: "link", visibility },
    });
    return json({ ok: true, document: publicWorkspaceDocument(created) }, 201);
  }

  if (action !== "create_upload") return json({ ok: false, error: "操作が不正だよ。" }, 400);

  const fileSizeBytes = Number(body.fileSizeBytes);
  if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > WORKSPACE_DOCUMENT_MAX_BYTES) {
    return json({ ok: false, error: "ファイルは1件100MBまでだよ。" }, 400);
  }
  const mimeType = text(body.mimeType, 240) ?? "application/octet-stream";
  const documentId = randomUUID();
  const storagePath = workspaceDocumentStoragePath(scope.kind, access.workspaceId ?? access.projectId ?? scope.id, documentId);
  const { error: insertError } = await db.from("workspace_documents").insert({
    document_id: documentId,
    ...owner,
    ...actor,
    entry_kind: "file",
    visibility,
    folder_path: folderPath,
    display_name: displayName,
    storage_bucket: WORKSPACE_DOCUMENTS_BUCKET,
    storage_path: storagePath,
    external_url: null,
    mime_type: mimeType,
    file_size_bytes: fileSizeBytes,
    upload_status: "pending",
    source_kind: "manual_upload",
    published_at: visibility === "workspace_shared" ? new Date().toISOString() : null,
  });
  if (insertError) return safeInsertError(insertError);

  const { data: signed, error: signedError } = await db.storage
    .from(WORKSPACE_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (signedError || !signed?.token) {
    await db.from("workspace_documents").update({ upload_status: "failed" }).eq("document_id", documentId);
    console.error("[workspace-documents] signed upload failed:", signedError?.message);
    return json({ ok: false, error: "アップロードの準備に失敗したよ。" }, 500);
  }

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_created",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: { document_id: documentId, entry_kind: "file", visibility },
  });

  return json({
    ok: true,
    documentId,
    storagePath,
    uploadToken: signed.token,
    mimeType,
  }, 201);
}
