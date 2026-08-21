import { NextResponse } from "next/server";

import { loadEditableWorkspaceHtmlDocument } from "@/lib/workspace-document-editing";
import {
  listWorkspaceDocumentRevisions,
  publicWorkspaceDocumentRevision,
  workspaceDocumentContentSha256,
} from "@/lib/workspace-document-revisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * HTML資料の版一覧。本文は返さず、いつ・どれくらいの大きさで積まれたかだけを返す。
 * currentSha256 を一緒に返すのは、復元POSTの楽観ロックに使うため。
 * 一覧を見てから復元するまでの間に現物が変わっていたら、そのshaは古くなって409で止まる。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);

  const { db, row, storageBucket, storagePath } = loaded;

  let revisions;
  try {
    revisions = await listWorkspaceDocumentRevisions(db, documentId);
  } catch (listError) {
    console.error("[workspace-documents] revision list failed:", listError);
    return json({ ok: false, error: "版の履歴を読み込めなかったよ。" }, 500);
  }

  // 現物のshaは row.content_sha256 から取らない。未編集資料でNULL、移行資料で古いことがある。
  const { data: currentFile, error: currentError } = await db.storage
    .from(storageBucket)
    .download(storagePath);
  if (currentError || !currentFile) {
    console.error("[workspace-documents] revision list current read failed:", currentError?.message);
    return json({ ok: false, error: "いまの本文を確認できなかったよ。" }, 500);
  }
  const currentSha256 = workspaceDocumentContentSha256(await currentFile.text());

  return json({
    ok: true,
    currentSha256,
    updatedAt: row.updated_at,
    revisions: revisions.map(publicWorkspaceDocumentRevision),
  });
}
