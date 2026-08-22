import { NextResponse } from "next/server";

import { normalizeWorkspaceDeck } from "@/lib/workspace-deck-model";
import {
  loadWorkspaceDeckRow,
  saveWorkspaceDeckModel,
} from "@/lib/workspace-document-decks";
import { loadEditableWorkspaceHtmlDocument } from "@/lib/workspace-document-editing";
import {
  isWorkspaceDocumentSha256,
  normalizeWorkspaceDocumentRevisionNote,
} from "@/lib/workspace-documents-core";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * デッキモデルの取得。
 *
 * 認可は本文編集と同じ `loadEditableWorkspaceHtmlDocument`。モデルは資料の中身そのものなので、
 * 本文を読めない人に読ませない。返すのは正規化済みのモデルで、DBの生JSONではない
 * (jsonbはキー順を保存しないため、そのまま返すとクライアント側のsha256計算とズレる)。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);

  let row;
  try {
    row = await loadWorkspaceDeckRow(loaded.db, documentId);
  } catch {
    return json({ ok: false, error: "デッキを読み込めなかったよ。" }, 500);
  }
  if (!row) {
    // モデルの無いHTML資料。見たまま編集 (Phase 1) で扱う資料はここに来る。
    return json({ ok: true, hasDeck: false, deck: null, sha256: null, updatedAt: loaded.row.updated_at });
  }

  const validation = normalizeWorkspaceDeck(row.model);
  if (!validation.ok) {
    // 保存済みモデルが今の検査を通らない (検査を後から強めた等)。編集画面が壊れるより、
    // 読めない理由を返して版履歴から戻せるようにする。
    console.error("[workspace-documents] stored deck invalid:", documentId, validation.path, validation.error);
    return json({
      ok: true,
      hasDeck: true,
      deck: null,
      invalid: { path: validation.path, error: validation.error },
      sha256: row.model_sha256,
      schemaVersion: row.schema_version,
      updatedAt: row.updated_at,
    });
  }

  return json({
    ok: true,
    hasDeck: true,
    deck: validation.deck,
    sha256: row.model_sha256,
    schemaVersion: row.schema_version,
    publishedSha256: row.published_sha256,
    publishedAt: row.published_at,
    // モデルとpublish済みHTMLがズレているか。エディタの「未公開の変更があるよ」表示の根拠。
    published: row.published_sha256 === row.model_sha256,
    updatedAt: row.updated_at,
  });
}

/**
 * デッキモデルの保存。HTMLは書き換えない (publishが別にある)。
 * 楽観ロックの鍵は `model_sha256`。まだモデルの無い資料へ最初に付けるときだけ null を許す。
 */
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
    | { deck?: unknown; expectedSha256?: unknown; note?: unknown }
    | null;
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "保存の形式が古いよ。画面を再読み込みしてね。" }, 400);
  }

  // 楽観ロックのキーをクライアント任せにしない。GETで渡した形式でなければ受け付けない。
  const hasExpected = body.expectedSha256 != null && body.expectedSha256 !== "";
  if (hasExpected && !isWorkspaceDocumentSha256(body.expectedSha256)) {
    return json({ ok: false, error: "編集前の版を確認できないよ。画面を再読み込みしてね。" }, 400);
  }

  const validation = normalizeWorkspaceDeck(body.deck, new Date().toISOString());
  if (!validation.ok) {
    return json({ ok: false, error: validation.error, path: validation.path }, 400);
  }

  const saved = await saveWorkspaceDeckModel({
    db: loaded.db,
    documentId,
    access: loaded.access,
    deck: validation.deck,
    expectedSha256: hasExpected ? (body.expectedSha256 as string) : null,
    note: normalizeWorkspaceDocumentRevisionNote(body.note),
  });
  if (!saved.ok) {
    return json({
      ok: false,
      error: saved.error,
      ...(saved.conflict ? { conflict: true, currentSha256: saved.currentSha256 } : {}),
    }, saved.status);
  }

  return json({
    ok: true,
    unchanged: saved.unchanged,
    sha256: saved.sha256,
    revisionNo: saved.revisionNo,
    published: saved.row.published_sha256 === saved.row.model_sha256,
    updatedAt: saved.row.updated_at,
  });
}
