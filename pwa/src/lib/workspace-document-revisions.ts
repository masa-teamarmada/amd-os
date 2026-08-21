import "server-only";

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT,
  WORKSPACE_DOCUMENT_REVISION_LIST_LIMIT,
  workspaceDocumentRevisionStoragePathFromBase,
} from "@/lib/workspace-documents-core";
import type { WorkspaceDocumentRow } from "@/lib/workspace-documents-server";

export const WORKSPACE_DOCUMENT_REVISION_FIELDS = [
  "revision_id",
  "document_id",
  "revision_no",
  "kind",
  "storage_bucket",
  "storage_path",
  "content_sha256",
  "byte_size",
  "note",
  "pinned",
  "created_at",
].join(",");

export type WorkspaceDocumentRevisionRow = {
  revision_id: string;
  document_id: string;
  revision_no: number;
  kind: "deck_model" | "html_source";
  storage_bucket: string | null;
  storage_path: string | null;
  content_sha256: string;
  byte_size: number;
  note: string | null;
  pinned: boolean;
  created_at: string;
};

/**
 * 資料本文のsha256。`workspace_documents.content_sha256` を書く既存経路と同じく
 * UTF-8へ直列化してから計算する。GET(=lock token発行)とPUT(=競合検知)で必ずこの関数を通し、
 * 「読んだ時のsha」と「保存直前に計算したsha」が同じ規則で並ぶようにする。
 */
export function workspaceDocumentContentSha256(source: string): string {
  return createHash("sha256").update(Buffer.from(source, "utf8")).digest("hex");
}

/** 版履歴の公開形。private Storageのbucket/pathは外へ出さない。 */
export function publicWorkspaceDocumentRevision(row: WorkspaceDocumentRevisionRow) {
  return {
    revisionId: row.revision_id,
    revisionNo: row.revision_no,
    kind: row.kind,
    contentSha256: row.content_sha256,
    byteSize: Number(row.byte_size || 0),
    note: row.note,
    pinned: row.pinned,
    createdAt: row.created_at,
  };
}

async function latestRevisionNo(db: SupabaseClient, documentId: string): Promise<number> {
  const { data, error } = await db
    .from("workspace_document_revisions")
    .select("revision_no")
    .eq("document_id", documentId)
    .order("revision_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[workspace-document-revisions] revision_no lookup failed:", error.message);
    throw new Error("workspace_document_revision_lookup_failed");
  }
  return Number((data as { revision_no?: number } | null)?.revision_no || 0);
}

export type ArchiveHtmlSourceRevisionInput = {
  row: WorkspaceDocumentRow;
  /** 退避する内容 = 上書きされる直前の現物。保存後の新しい内容ではない。 */
  source: string;
  contentSha256: string;
  note: string | null;
  accountId: string | null;
};

/**
 * 現物HTMLを上書きする前に、その直前の内容を版として積む。
 *
 * 行を先に入れてからStorageへ書く。逆順にすると、revision_noが競合したときに
 * 別の版の内容を同じobjectへ上書きしてしまい、先に入った行が別内容を指す。
 * 追記のみで、既存の版は書き換えない。
 */
export async function archiveHtmlSourceRevision(
  db: SupabaseClient,
  input: ArchiveHtmlSourceRevisionInput,
): Promise<{ revisionNo: number; storagePath: string } | null> {
  const { row, source, contentSha256, note, accountId } = input;
  const storageBucket = row.storage_bucket;
  const basePath = row.storage_path;
  if (!storageBucket || !basePath) return null;

  const bytes = Buffer.from(source, "utf8");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const revisionNo = (await latestRevisionNo(db, row.document_id)) + 1 + attempt;
    const storagePath = workspaceDocumentRevisionStoragePathFromBase(basePath, revisionNo);
    const { data: inserted, error: insertError } = await db
      .from("workspace_document_revisions")
      .insert({
        document_id: row.document_id,
        revision_no: revisionNo,
        kind: "html_source",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        content_sha256: contentSha256,
        byte_size: bytes.byteLength,
        note,
        created_by_account_id: accountId,
      })
      .select("revision_id")
      .single();
    if (insertError) {
      // 23505 = 別セッションが同じrevision_noを先に取った。番号を進めて取り直す。
      if (insertError.code === "23505") continue;
      console.error("[workspace-document-revisions] revision insert failed:", insertError.message);
      throw new Error("workspace_document_revision_insert_failed");
    }

    const { error: uploadError } = await db.storage
      .from(storageBucket)
      .upload(storagePath, bytes, { upsert: true, contentType: "text/html", cacheControl: "0" });
    if (uploadError) {
      console.error("[workspace-document-revisions] revision upload failed:", uploadError.message);
      // 本文の無い版行を残さない。行だけ消えても現物と他の版は壊れない。
      await db
        .from("workspace_document_revisions")
        .delete()
        .eq("revision_id", (inserted as { revision_id: string }).revision_id);
      throw new Error("workspace_document_revision_upload_failed");
    }

    return { revisionNo, storagePath };
  }

  throw new Error("workspace_document_revision_number_conflict");
}

/**
 * 保持件数を超えた古い版を落とす。pinned=true は対象外。
 * 掃除の失敗で保存そのものを失敗させない (呼び出し側はawaitするがthrowしない)。
 */
export async function pruneWorkspaceDocumentRevisions(
  db: SupabaseClient,
  documentId: string,
): Promise<number> {
  const { data, error } = await db
    .from("workspace_document_revisions")
    .select("revision_id,storage_bucket,storage_path")
    .eq("document_id", documentId)
    .eq("pinned", false)
    .order("revision_no", { ascending: false })
    .range(WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT, WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT + 499);
  if (error) {
    console.error("[workspace-document-revisions] prune lookup failed:", error.message);
    return 0;
  }
  const stale = (data || []) as Array<{
    revision_id: string;
    storage_bucket: string | null;
    storage_path: string | null;
  }>;
  if (!stale.length) return 0;

  const byBucket = new Map<string, string[]>();
  for (const revision of stale) {
    if (!revision.storage_bucket || !revision.storage_path) continue;
    const paths = byBucket.get(revision.storage_bucket) || [];
    paths.push(revision.storage_path);
    byBucket.set(revision.storage_bucket, paths);
  }
  for (const [bucket, paths] of byBucket) {
    const { error: removeError } = await db.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error("[workspace-document-revisions] prune remove failed:", removeError.message);
      return 0;
    }
  }

  const { error: deleteError } = await db
    .from("workspace_document_revisions")
    .delete()
    .in("revision_id", stale.map((revision) => revision.revision_id));
  if (deleteError) {
    console.error("[workspace-document-revisions] prune delete failed:", deleteError.message);
    return 0;
  }
  return stale.length;
}

export async function listWorkspaceDocumentRevisions(
  db: SupabaseClient,
  documentId: string,
  limit = WORKSPACE_DOCUMENT_REVISION_LIST_LIMIT,
): Promise<WorkspaceDocumentRevisionRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, WORKSPACE_DOCUMENT_REVISION_LIST_LIMIT));
  const { data, error } = await db
    .from("workspace_document_revisions")
    .select(WORKSPACE_DOCUMENT_REVISION_FIELDS)
    .eq("document_id", documentId)
    .order("revision_no", { ascending: false })
    .limit(safeLimit);
  if (error) {
    console.error("[workspace-document-revisions] list failed:", error.message);
    throw new Error("workspace_document_revision_list_failed");
  }
  return (data || []) as unknown as WorkspaceDocumentRevisionRow[];
}

export async function findWorkspaceDocumentRevision(
  db: SupabaseClient,
  documentId: string,
  revisionNo: number,
): Promise<WorkspaceDocumentRevisionRow | null> {
  if (!Number.isInteger(revisionNo) || revisionNo < 1) return null;
  const { data, error } = await db
    .from("workspace_document_revisions")
    .select(WORKSPACE_DOCUMENT_REVISION_FIELDS)
    .eq("document_id", documentId)
    .eq("revision_no", revisionNo)
    .maybeSingle();
  if (error) {
    console.error("[workspace-document-revisions] fetch failed:", error.message);
    throw new Error("workspace_document_revision_fetch_failed");
  }
  return (data as unknown as WorkspaceDocumentRevisionRow) || null;
}

/** 退避済みHTMLの本文。署名URLを発行せず、再認可済みのserver内でだけ読む。 */
export async function loadWorkspaceDocumentRevisionSource(
  db: SupabaseClient,
  revision: WorkspaceDocumentRevisionRow,
): Promise<string | null> {
  if (revision.kind !== "html_source" || !revision.storage_bucket || !revision.storage_path) return null;
  const { data, error } = await db.storage.from(revision.storage_bucket).download(revision.storage_path);
  if (error || !data) {
    console.error("[workspace-document-revisions] revision download failed:", error?.message);
    return null;
  }
  const source = await data.text();
  if (workspaceDocumentContentSha256(source) !== revision.content_sha256) {
    console.error(
      "[workspace-document-revisions] revision content sha mismatch:",
      `${revision.document_id}#${revision.revision_no}`,
    );
  }
  return source;
}
