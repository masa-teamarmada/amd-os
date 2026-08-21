import { NextResponse } from "next/server";

import {
  isWorkspaceDocumentSha256,
  normalizeWorkspaceDocumentHtmlSource,
} from "@/lib/workspace-documents-core";
import {
  loadEditableWorkspaceHtmlDocument,
  replaceWorkspaceHtmlSource,
} from "@/lib/workspace-document-editing";
import { publicWorkspaceDocument } from "@/lib/workspace-documents-server";
import {
  findWorkspaceDocumentRevision,
  loadWorkspaceDocumentRevisionSource,
  publicWorkspaceDocumentRevision,
} from "@/lib/workspace-document-revisions";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function parseRevisionNo(value: string): number | null {
  if (!/^[1-9][0-9]{0,9}$/.test(value)) return null;
  return Number(value);
}

/** 1つの版の本文。プレビューと差分表示のためだけに返す。署名URLは発行しない。 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string; revisionNo: string }> },
) {
  const { documentId, revisionNo: revisionNoParam } = await params;
  const revisionNo = parseRevisionNo(revisionNoParam);
  if (revisionNo == null) return json({ ok: false, error: "版の番号が正しくないよ。" }, 400);

  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);

  const { db } = loaded;
  let revision;
  try {
    revision = await findWorkspaceDocumentRevision(db, documentId, revisionNo);
  } catch (fetchError) {
    console.error("[workspace-documents] revision fetch failed:", fetchError);
    return json({ ok: false, error: "版を読み込めなかったよ。" }, 500);
  }
  if (!revision) return json({ ok: false, error: "Not found" }, 404);

  const source = await loadWorkspaceDocumentRevisionSource(db, revision);
  if (source == null) return json({ ok: false, error: "版の本文を読み込めなかったよ。" }, 500);

  return json({
    ok: true,
    revision: publicWorkspaceDocumentRevision(revision),
    source,
  });
}

/**
 * 版の復元。過去の版を「新しい保存」としてやり直すだけで、履歴は一切消さない。
 * 復元そのものがいまの現物を版として積むので、復元を取り消したくなったらまた復元できる。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string; revisionNo: string }> },
) {
  if (!isSameOriginWorkspaceMutation(request)) {
    return json({ ok: false, error: "この操作元を確認できないよ。画面を再読み込みしてね。" }, 403);
  }

  const { documentId, revisionNo: revisionNoParam } = await params;
  const revisionNo = parseRevisionNo(revisionNoParam);
  if (revisionNo == null) return json({ ok: false, error: "版の番号が正しくないよ。" }, 400);

  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);

  const body = (await request.json().catch(() => null)) as { expectedSha256?: unknown } | null;
  if (!body || !isWorkspaceDocumentSha256(body.expectedSha256)) {
    return json({ ok: false, error: "復元前の版を確認できないよ。画面を再読み込みしてね。" }, 400);
  }

  const { db } = loaded;
  let revision;
  try {
    revision = await findWorkspaceDocumentRevision(db, documentId, revisionNo);
  } catch (fetchError) {
    console.error("[workspace-documents] revision fetch failed:", fetchError);
    return json({ ok: false, error: "版を読み込めなかったよ。" }, 500);
  }
  if (!revision) return json({ ok: false, error: "Not found" }, 404);

  const source = await loadWorkspaceDocumentRevisionSource(db, revision);
  if (source == null) return json({ ok: false, error: "版の本文を読み込めなかったよ。" }, 500);
  // 退避時の上限と現在の上限がずれていても、上限超えの本文を現物へ戻さない。
  const normalized = normalizeWorkspaceDocumentHtmlSource(source);
  if (!normalized) {
    return json({ ok: false, error: "この版は空か、いまの上限を超えているから戻せないよ。" }, 400);
  }

  const replaced = await replaceWorkspaceHtmlSource({
    db,
    row: loaded.row,
    access: loaded.access,
    storageBucket: loaded.storageBucket,
    storagePath: loaded.storagePath,
    nextSource: normalized.source,
    expectedSha256: body.expectedSha256,
    note: `v${revisionNo}へ復元する前の版`,
    auditAction: "restore_revision",
    auditDetail: { restored_from_revision_no: revisionNo },
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
    restoredFromRevisionNo: revisionNo,
    revisionNo: replaced.revisionNo,
    document: publicWorkspaceDocument(replaced.row),
  });
}
