import { NextResponse } from "next/server";

import { normalizeWorkspaceDeck } from "@/lib/workspace-deck-model";
import { loadWorkspaceDeckRow, publishWorkspaceDeck } from "@/lib/workspace-document-decks";
import { loadEditableWorkspaceHtmlDocument } from "@/lib/workspace-document-editing";
import { isWorkspaceDocumentSha256 } from "@/lib/workspace-documents-core";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 画像をdata URIへ焼き込むので、スライドの多いデッキでは秒単位かかる。
export const maxDuration = 60;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * モデル → 公開HTML。
 *
 * 出力は資料の現物 (`workspace_documents.storage_path`) をそのまま差し替えるので、
 * 既存の表示 (`/render`)、PDF化 (`/pdf`)、PJ共有の導線がそのまま動く。新しい配布経路を作らない。
 * 差し替え前のHTMLは版履歴へ退避される (`replaceWorkspaceHtmlSource`)。
 *
 * `expectedSha256` は**モデル**のsha256。いま画面で見ているモデルだけを公開する。
 * HTML側の楽観ロックは張らない (生成物なので、モデルに無い手編集は再生成で消えるのが正しい)。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  if (!isSameOriginWorkspaceMutation(request)) {
    return json({ ok: false, error: "この操作元を確認できないよ。画面を再読み込みしてね。" }, 403);
  }

  const { documentId } = await params;
  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);

  const body = (await request.json().catch(() => null)) as { expectedSha256?: unknown } | null;
  if (!body || !isWorkspaceDocumentSha256(body.expectedSha256)) {
    return json({ ok: false, error: "公開するデッキの版を確認できないよ。画面を再読み込みしてね。" }, 400);
  }

  let deckRow;
  try {
    deckRow = await loadWorkspaceDeckRow(loaded.db, documentId);
  } catch {
    return json({ ok: false, error: "デッキを読み込めなかったよ。" }, 500);
  }
  if (!deckRow) return json({ ok: false, error: "この資料にはまだデッキが無いよ。" }, 404);
  if (deckRow.model_sha256 !== body.expectedSha256) {
    return json({
      ok: false,
      conflict: true,
      currentSha256: deckRow.model_sha256,
      error: "別のセッションがこのデッキを更新しているよ。最新を読み込んでから公開してね。",
    }, 409);
  }

  const validation = normalizeWorkspaceDeck(deckRow.model);
  if (!validation.ok) {
    console.error("[workspace-documents] publish blocked by invalid deck:", documentId, validation.path);
    return json({
      ok: false,
      error: `保存されているデッキを読めなかったよ (${validation.path})。版履歴から戻してね。`,
    }, 409);
  }

  const published = await publishWorkspaceDeck({
    db: loaded.db,
    row: loaded.row,
    access: loaded.access,
    storageBucket: loaded.storageBucket,
    storagePath: loaded.storagePath,
    deck: validation.deck,
    deckRow,
  });
  if (!published.ok) {
    return json({
      ok: false,
      error: published.error,
      ...(published.missingAssets ? { missingAssets: published.missingAssets } : {}),
    }, published.status);
  }

  return json({
    ok: true,
    unchanged: published.unchanged,
    sha256: published.sha256,
    byteLength: published.byteLength,
    revisionNo: published.revisionNo,
    publishedAt: published.row.published_at,
  });
}
