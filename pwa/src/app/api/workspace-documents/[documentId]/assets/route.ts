import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";

import {
  createWorkspaceDeckAsset,
  listWorkspaceDeckAssets,
  publicWorkspaceDeckAsset,
  type WorkspaceDeckAssetRow,
} from "@/lib/workspace-document-decks";
import { loadEditableWorkspaceHtmlDocument } from "@/lib/workspace-document-editing";
import { WORKSPACE_DOCUMENT_ASSET_MAX_BYTES } from "@/lib/workspace-documents-core";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 編集画面のプレビュー用URLの寿命。資料を開く既存経路 (`open` route) と同じ60秒。 */
const ASSET_PREVIEW_URL_TTL_SECONDS = 60;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * デッキが使える画像の一覧。
 *
 * 編集中の表示には短命の署名URLを付ける。publish出力のようにdata URIで返すと、
 * 一覧を開くだけで数MBのJSONが飛ぶ。逆にpublishでは署名URLを使わない
 * (期限切れで資料の画像が消え、外部参照ゼロも崩れる)。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status);

  let assets: WorkspaceDeckAssetRow[];
  try {
    assets = await listWorkspaceDeckAssets(loaded.db, documentId);
  } catch {
    return json({ ok: false, error: "画像の一覧を読み込めなかったよ。" }, 500);
  }

  const previews = await Promise.all(assets.map(async (asset) => {
    const { data } = await loaded.db.storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, ASSET_PREVIEW_URL_TTL_SECONDS);
    return { ...publicWorkspaceDeckAsset(asset), previewUrl: data?.signedUrl ?? null };
  }));

  return json({ ok: true, assets: previews });
}

/**
 * 画像の追加。本文をJSONへ包まず、リクエストのbodyをそのままバイト列として受ける。
 *
 * MIMEはヘッダを信じず、バイト列を読んで決める (`probeWorkspaceDeckImage`)。
 * Vercelのfunctionはrequest bodyが4.5MBを超えると関数へ届く前に落ちる。
 * エディタは長辺1920pxへ縮小してから送るので実用上は当たらないが、
 * 10MB上限 (`WORKSPACE_DOCUMENT_ASSET_MAX_BYTES`) より先にこの壁が来ることは覚えておく。
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

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > WORKSPACE_DOCUMENT_ASSET_MAX_BYTES) {
    return json({ ok: false, error: "画像は10MBまでだよ。" }, 413);
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await request.arrayBuffer());
  } catch {
    return json({ ok: false, error: "画像を受け取れなかったよ。" }, 400);
  }

  const created = await createWorkspaceDeckAsset({
    db: loaded.db,
    row: loaded.row,
    access: loaded.access,
    storageBucket: loaded.storageBucket,
    storagePath: loaded.storagePath,
    bytes,
  });
  if (!created.ok) return json({ ok: false, error: created.error }, created.status);

  const { data } = await loaded.db.storage
    .from(created.asset.storage_bucket)
    .createSignedUrl(created.asset.storage_path, ASSET_PREVIEW_URL_TTL_SECONDS);

  return json({
    ok: true,
    asset: { ...publicWorkspaceDeckAsset(created.asset), previewUrl: data?.signedUrl ?? null },
  });
}
