import "server-only";

import { Buffer } from "node:buffer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWorkspaceDocumentHtml,
  WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES,
} from "@/lib/workspace-documents-core";
import type { WorkspaceDocumentAccess } from "@/lib/workspace-document-access";
import {
  resolveDocumentRowAccess,
  WORKSPACE_DOCUMENT_FIELDS,
  type WorkspaceDocumentRow,
} from "@/lib/workspace-documents-server";
import {
  archiveHtmlSourceRevision,
  pruneWorkspaceDocumentRevisions,
  workspaceDocumentContentSha256,
} from "@/lib/workspace-document-revisions";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";

/**
 * HTML編集系route (本文の読込・保存・版履歴・復元) が共有する認可ゲート。
 *
 * 同じ資料に対して複数のrouteが本文を触るので、認可条件を各routeへ書き写さない。
 * 1箇所で「activeか」「この人が読めるか」「編集権限があるか」「HTML実体か」を通し、
 * 呼び出し側はstorageBucket/storagePathがnullでない形で受け取る。
 */
export type EditableWorkspaceHtmlDocument =
  | {
      ok: true;
      db: SupabaseClient;
      row: WorkspaceDocumentRow;
      access: WorkspaceDocumentAccess;
      storageBucket: string;
      storagePath: string;
    }
  | { ok: false; db: SupabaseClient; status: number; error: string };

export async function loadEditableWorkspaceHtmlDocument(
  documentId: string,
): Promise<EditableWorkspaceHtmlDocument> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("workspace_documents")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .eq("document_id", documentId)
    .eq("upload_status", "active")
    .maybeSingle();
  if (error) {
    console.error("[workspace-documents] html source lookup failed:", error.message);
    return { ok: false, db, status: 500, error: "HTML資料を読み込めなかったよ。" };
  }
  if (!data) return { ok: false, db, status: 404, error: "Not found" };

  const row = data as unknown as WorkspaceDocumentRow;
  const access = await resolveDocumentRowAccess(db, row);
  if (!access || (row.visibility === "amd_internal" && !access.canReadInternal)) {
    return { ok: false, db, status: 404, error: "Not found" };
  }
  if (!access.canUpload) {
    return { ok: false, db, status: 403, error: "このHTML資料は編集できないよ。" };
  }
  if (row.entry_kind !== "file" || !isWorkspaceDocumentHtml(row.mime_type, row.display_name)) {
    return { ok: false, db, status: 400, error: "HTML資料ではないよ。" };
  }
  // linkでなくfileだと確認済みでも、移行途中の行はstorage参照が欠けることがある。
  // 型の都合ではなく、実体を触れない資料を編集経路へ通さないための検査。
  if (!row.storage_bucket || !row.storage_path) {
    return { ok: false, db, status: 400, error: "HTML資料の保存先を確認できなかったよ。" };
  }

  return { ok: true, db, row, access, storageBucket: row.storage_bucket, storagePath: row.storage_path };
}

export type ReplaceWorkspaceHtmlSourceInput = {
  db: SupabaseClient;
  row: WorkspaceDocumentRow;
  access: WorkspaceDocumentAccess;
  storageBucket: string;
  storagePath: string;
  /** 保存したい新しい本文。normalize済みのものを渡す。 */
  nextSource: string;
  /** クライアントが編集を始めた時点のsha256。現物と食い違えば競合として止める。 */
  expectedSha256: string;
  /**
   * 楽観ロックを通った現物から、保存する本文を組み立て直したいときの差し込み口。
   *
   * 直接操作エディタは資料のscriptとDOCTYPEをフレームへ渡していないので、
   * 現物を見ないと保存できる本文にならない。現物のダウンロードはここで一度きりなので、
   * routeが自前でもう一度ダウンロードして「読んだ現物」を二重に持たないためにここへ置く。
   * 呼ばれるのはsha256が一致したあとだけ。競合中の現物を材料にしない。
   */
  transformNextSource?: (currentSource: string) => string;
  note: string | null;
  /** 監査ログのaction。本文保存と版復元を区別する。 */
  auditAction: "replace_html" | "restore_revision";
  auditDetail?: Record<string, unknown>;
};

export type ReplaceWorkspaceHtmlSourceResult =
  | { ok: true; unchanged: boolean; sha256: string; revisionNo: number | null; row: WorkspaceDocumentRow }
  | { ok: false; status: number; error: string; conflict?: true; currentSha256?: string };

/**
 * HTML資料の現物を、旧版を版履歴へ退避してから差し替える唯一の経路。
 *
 * 本文保存も版復元も同じ不変条件で動かすためにここへ集約する。
 * 1. 現物をダウンロードしてsha256を取る (row.content_sha256 は未編集資料でNULL、移行資料で古い)
 * 2. expectedSha256 と食い違えば409。別セッションの変更を黙って踏まない
 * 3. transformNextSource があれば、ここで現物から保存本文を組み立て直す
 * 4. 内容が同じなら何もしない。中身の変わらない版で履歴を埋めない
 * 5. 旧版の退避に失敗したら上書きせず中断する。履歴の無い差し替えを作らない
 */
export async function replaceWorkspaceHtmlSource(
  input: ReplaceWorkspaceHtmlSourceInput,
): Promise<ReplaceWorkspaceHtmlSourceResult> {
  const {
    db, row, access, storageBucket, storagePath,
    nextSource, expectedSha256, note, auditAction, auditDetail, transformNextSource,
  } = input;

  const { data: currentFile, error: currentError } = await db.storage
    .from(storageBucket)
    .download(storagePath);
  if (currentError || !currentFile) {
    console.error("[workspace-documents] html source precheck failed:", currentError?.message);
    return { ok: false, status: 500, error: "HTML資料の現在の内容を確認できなかったよ。" };
  }
  const currentSource = await currentFile.text();
  const currentSha256 = workspaceDocumentContentSha256(currentSource);
  if (currentSha256 !== expectedSha256) {
    return {
      ok: false,
      status: 409,
      conflict: true,
      currentSha256,
      error: "別のセッションがこの資料を更新しているよ。最新を読み込んでから保存してね。",
    };
  }

  // 現物と照合が済んだこの位置でだけ組み立て直す。競合していたら既に409で返している。
  const finalSource = transformNextSource ? transformNextSource(currentSource) : nextSource;
  const sourceBytes = Buffer.from(finalSource, "utf8");
  // 組み立て直しで本文は伸びる (退避したscriptが戻る)。受信時の検査は上限を保証しない。
  if (sourceBytes.byteLength > WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES) {
    return { ok: false, status: 413, error: "保存できるHTMLは5MBまでだよ。" };
  }

  const nextSha256 = workspaceDocumentContentSha256(finalSource);
  if (nextSha256 === currentSha256) {
    return { ok: true, unchanged: true, sha256: nextSha256, revisionNo: null, row };
  }

  let revisionNo: number | null = null;
  try {
    const archived = await archiveHtmlSourceRevision(db, {
      row,
      source: currentSource,
      contentSha256: currentSha256,
      note,
      accountId: access.accountId,
    });
    revisionNo = archived?.revisionNo ?? null;
  } catch (archiveError) {
    console.error("[workspace-documents] html revision archive failed:", archiveError);
    return { ok: false, status: 500, error: "上書き前の版を保存できなかったから、変更を中断したよ。" };
  }

  const mimeType = "text/html";
  const { error: uploadError } = await db.storage
    .from(storageBucket)
    .upload(storagePath, sourceBytes, { upsert: true, contentType: mimeType, cacheControl: "0" });
  if (uploadError) {
    console.error("[workspace-documents] html source replace failed:", uploadError.message);
    return { ok: false, status: 500, error: "HTML資料を保存できなかったよ。" };
  }

  const { data: updated, error: updateError } = await db
    .from("workspace_documents")
    .update({
      content_sha256: nextSha256,
      file_size_bytes: sourceBytes.byteLength,
      mime_type: mimeType,
      updated_at: new Date().toISOString(),
    })
    .eq("document_id", row.document_id)
    .eq("upload_status", "active")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .single();
  if (updateError) {
    console.error("[workspace-documents] html source metadata update failed:", updateError.message);
    return { ok: false, status: 500, error: "HTML資料の保存後確認に失敗したよ。" };
  }

  await pruneWorkspaceDocumentRevisions(db, row.document_id);

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_mutated",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: {
      document_id: row.document_id,
      entry_kind: row.entry_kind,
      action: auditAction,
      byte_length: sourceBytes.byteLength,
      mime_type: mimeType,
      revision_no: revisionNo,
      ...auditDetail,
    },
  });

  return {
    ok: true,
    unchanged: false,
    sha256: nextSha256,
    revisionNo,
    row: updated as unknown as WorkspaceDocumentRow,
  };
}
