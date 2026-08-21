import { NextResponse } from "next/server";

import {
  isWorkspaceDocumentSha256,
  normalizeWorkspaceDocumentHtmlSource,
  normalizeWorkspaceDocumentRevisionNote,
} from "@/lib/workspace-documents-core";
import {
  loadEditableWorkspaceHtmlDocument,
  replaceWorkspaceHtmlSource,
} from "@/lib/workspace-document-editing";
import { publicWorkspaceDocument } from "@/lib/workspace-documents-server";
import { workspaceDocumentContentSha256 } from "@/lib/workspace-document-revisions";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);

  const { db, row, storageBucket, storagePath } = loaded;
  const { data: file, error: downloadError } = await db.storage.from(storageBucket).download(storagePath);
  if (downloadError || !file) {
    console.error("[workspace-documents] html source download failed:", downloadError?.message);
    return json({ ok: false, error: "HTML資料を読み込めなかったよ。" }, 500);
  }

  const normalized = normalizeWorkspaceDocumentHtmlSource(await file.text());
  if (!normalized) {
    return json({ ok: false, error: "HTML本文が空か、編集できる上限を超えているよ。" }, 413);
  }

  // 本文は署名URLで渡さず、同じrequestで再認可したJSON本文だけに載せる。
  // sha256は保存時の競合検知キー。クライアントはこれを保持したままPUTへ返す。
  return json({
    ok: true,
    source: normalized.source,
    byteLength: normalized.byteLength,
    sha256: workspaceDocumentContentSha256(normalized.source),
    updatedAt: row.updated_at,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  if (!isSameOriginWorkspaceMutation(request)) {
    return json({ ok: false, error: "この操作元を確認できないよ。画面を再読み込みしてね。" }, 403);
  }

  const { documentId } = await params;
  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);

  const body = (await request.json().catch(() => null)) as
    | { source?: unknown; expectedSha256?: unknown; note?: unknown }
    | null;
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "保存の形式が古いよ。画面を再読み込みしてね。" }, 400);
  }
  const normalized = normalizeWorkspaceDocumentHtmlSource(body.source);
  if (!normalized) {
    return json({ ok: false, error: "HTML編集は空欄にできず、本文は5MBまでだよ。" }, 400);
  }
  // 楽観ロックのキーはクライアント任せにしない。GETで渡した形式のsha256でなければ受け付けない。
  if (!isWorkspaceDocumentSha256(body.expectedSha256)) {
    return json({ ok: false, error: "編集前の版を確認できないよ。画面を再読み込みしてね。" }, 400);
  }

  const replaced = await replaceWorkspaceHtmlSource({
    db: loaded.db,
    row: loaded.row,
    access: loaded.access,
    storageBucket: loaded.storageBucket,
    storagePath: loaded.storagePath,
    nextSource: normalized.source,
    expectedSha256: body.expectedSha256,
    note: normalizeWorkspaceDocumentRevisionNote(body.note),
    auditAction: "replace_html",
  });
  if (!replaced.ok) {
    return json({
      ok: false,
      error: replaced.error,
      ...(replaced.conflict ? { conflict: true, currentSha256: replaced.currentSha256 } : {}),
    }, replaced.status);
  }

  return json({
    ok: true,
    unchanged: replaced.unchanged,
    sha256: replaced.sha256,
    revisionNo: replaced.revisionNo,
    document: publicWorkspaceDocument(replaced.row),
  });
}
