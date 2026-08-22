import "server-only";

import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import {
  probeWorkspaceDeckImage,
  workspaceDeckAssetDataUri,
  workspaceDeckImageExceedsMaxEdge,
  WORKSPACE_DECK_ASSET_EXTENSIONS,
  type WorkspaceDeckImageProbe,
} from "@/lib/workspace-deck-assets";
import {
  collectWorkspaceDeckAssetIds,
  serializeWorkspaceDeck,
  workspaceDeckByteLength,
  type WorkspaceDeck,
} from "@/lib/workspace-deck-model";
import { renderWorkspaceDeckDocument, type WorkspaceDeckAssetSources } from "@/lib/workspace-deck-render";
import type { WorkspaceDocumentAccess } from "@/lib/workspace-document-access";
import { replaceWorkspaceHtmlSource } from "@/lib/workspace-document-editing";
import {
  archiveDeckModelRevision,
  pruneWorkspaceDocumentRevisions,
  workspaceDocumentContentSha256,
} from "@/lib/workspace-document-revisions";
import {
  WORKSPACE_DOCUMENT_ASSET_MAX_BYTES,
  WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX,
  WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION,
  WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES,
  workspaceDocumentAssetStoragePathFromBase,
} from "@/lib/workspace-documents-core";
import type { WorkspaceDocumentRow } from "@/lib/workspace-documents-server";

/**
 * デッキモデルの読み書きとpublish。3本のAPI route (`deck` / `deck/publish` / `assets`) が
 * 共有する不変条件をここへ集める。routeごとに手順を書き写すと、片方だけ版の退避が抜ける。
 *
 * 守る不変条件:
 * 1. モデルが正本。publishはモデル→HTMLの一方向で、HTMLからモデルへ戻さない。
 * 2. 上書き前のモデルは必ず版として積む (追記のみ)。
 * 3. 楽観ロックの鍵は `workspace_document_decks.model_sha256`。食い違えば409で止める。
 * 4. publish出力は外部参照ゼロの自己完結HTML。画像はdata URIで埋め込む。
 * 5. private Storageの署名URLをモデルにもpublish出力にも残さない。
 */

export const WORKSPACE_DECK_FIELDS = [
  "document_id",
  "schema_version",
  "model",
  "model_sha256",
  "published_sha256",
  "published_at",
  "created_at",
  "updated_at",
  "updated_by_account_id",
].join(",");

export type WorkspaceDeckRow = {
  document_id: string;
  schema_version: number;
  model: unknown;
  model_sha256: string;
  published_sha256: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by_account_id: string | null;
};

export const WORKSPACE_DECK_ASSET_FIELDS = [
  "asset_id",
  "document_id",
  "storage_bucket",
  "storage_path",
  "mime_type",
  "byte_size",
  "width",
  "height",
  "content_sha256",
  "created_at",
].join(",");

export type WorkspaceDeckAssetRow = {
  asset_id: string;
  document_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  content_sha256: string | null;
  created_at: string;
};

/** アセットの公開形。private Storageのbucket/pathは外へ出さない。 */
export function publicWorkspaceDeckAsset(row: WorkspaceDeckAssetRow) {
  return {
    assetId: row.asset_id,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size || 0),
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

export function workspaceDeckModelSha256(deck: WorkspaceDeck): string {
  return workspaceDocumentContentSha256(serializeWorkspaceDeck(deck));
}

/**
 * 画像のsha256。本文用の `workspaceDocumentContentSha256` はUTF-8文字列前提なので、
 * バイナリを通すと化ける。バイト列はバイト列のまま数える。
 */
function workspaceDeckAssetSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function loadWorkspaceDeckRow(
  db: SupabaseClient,
  documentId: string,
): Promise<WorkspaceDeckRow | null> {
  const { data, error } = await db
    .from("workspace_document_decks")
    .select(WORKSPACE_DECK_FIELDS)
    .eq("document_id", documentId)
    .maybeSingle();
  if (error) {
    console.error("[workspace-document-decks] deck lookup failed:", error.message);
    throw new Error("workspace_document_deck_lookup_failed");
  }
  return (data as unknown as WorkspaceDeckRow) || null;
}

export type SaveWorkspaceDeckInput = {
  db: SupabaseClient;
  documentId: string;
  access: WorkspaceDocumentAccess;
  deck: WorkspaceDeck;
  /** クライアントが編集を始めた時点のmodel_sha256。まだモデルが無い資料ではnull。 */
  expectedSha256: string | null;
  note: string | null;
};

export type SaveWorkspaceDeckResult =
  | { ok: true; unchanged: boolean; sha256: string; revisionNo: number | null; row: WorkspaceDeckRow }
  | { ok: false; status: number; error: string; conflict?: true; currentSha256?: string | null };

/**
 * モデルを保存する唯一の経路。
 *
 * 1. いまのモデルを読み、`expectedSha256` と食い違えば409。別セッションの編集を黙って踏まない
 * 2. 内容が同じなら何もしない。中身の変わらない版で履歴を埋めない
 * 3. 上書き前のモデルを版として積む。積めなければ上書きしない
 * 4. `published_sha256` は触らない。publishしていない変更は「未公開」のまま残す
 */
export async function saveWorkspaceDeckModel(
  input: SaveWorkspaceDeckInput,
): Promise<SaveWorkspaceDeckResult> {
  const { db, documentId, access, deck, expectedSha256, note } = input;

  let current: WorkspaceDeckRow | null;
  try {
    current = await loadWorkspaceDeckRow(db, documentId);
  } catch {
    return { ok: false, status: 500, error: "いまのデッキを確認できなかったよ。" };
  }

  if (!current && expectedSha256) {
    return {
      ok: false,
      status: 409,
      conflict: true,
      currentSha256: null,
      error: "このデッキは別のセッションで消えているよ。画面を再読み込みしてね。",
    };
  }
  if (current && current.model_sha256 !== expectedSha256) {
    return {
      ok: false,
      status: 409,
      conflict: true,
      currentSha256: current.model_sha256,
      error: "別のセッションがこのデッキを更新しているよ。最新を読み込んでから保存してね。",
    };
  }

  const serialized = serializeWorkspaceDeck(deck);
  const nextSha256 = workspaceDocumentContentSha256(serialized);
  if (current && current.model_sha256 === nextSha256) {
    return { ok: true, unchanged: true, sha256: nextSha256, revisionNo: null, row: current };
  }

  let revisionNo: number | null = null;
  if (current) {
    try {
      const archived = await archiveDeckModelRevision(db, {
        documentId,
        model: current.model,
        contentSha256: current.model_sha256,
        byteSize: Buffer.byteLength(JSON.stringify(current.model ?? null), "utf8"),
        note,
        accountId: access.accountId,
      });
      revisionNo = archived?.revisionNo ?? null;
    } catch (archiveError) {
      console.error("[workspace-document-decks] deck revision archive failed:", archiveError);
      return { ok: false, status: 500, error: "上書き前の版を保存できなかったから、変更を中断したよ。" };
    }
  }

  const { data: saved, error: saveError } = await db
    .from("workspace_document_decks")
    .upsert(
      {
        document_id: documentId,
        schema_version: WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION,
        model: JSON.parse(serialized),
        model_sha256: nextSha256,
        updated_at: new Date().toISOString(),
        updated_by_account_id: access.accountId,
      },
      { onConflict: "document_id" },
    )
    .select(WORKSPACE_DECK_FIELDS)
    .single();
  if (saveError) {
    console.error("[workspace-document-decks] deck save failed:", saveError.message);
    return { ok: false, status: 500, error: "デッキを保存できなかったよ。" };
  }

  await pruneWorkspaceDocumentRevisions(db, documentId);

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_mutated",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: {
      document_id: documentId,
      entry_kind: "file",
      action: "edit_deck",
      byte_length: workspaceDeckByteLength(deck),
      slide_count: deck.slides.length,
      revision_no: revisionNo,
    },
  });

  return {
    ok: true,
    unchanged: false,
    sha256: nextSha256,
    revisionNo,
    row: saved as unknown as WorkspaceDeckRow,
  };
}

// ---------------------------------------------------------------------------
// アセット
// ---------------------------------------------------------------------------

export async function listWorkspaceDeckAssets(
  db: SupabaseClient,
  documentId: string,
): Promise<WorkspaceDeckAssetRow[]> {
  const { data, error } = await db
    .from("workspace_document_assets")
    .select(WORKSPACE_DECK_ASSET_FIELDS)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[workspace-document-decks] asset list failed:", error.message);
    throw new Error("workspace_document_deck_asset_list_failed");
  }
  return (data || []) as unknown as WorkspaceDeckAssetRow[];
}

export type CreateWorkspaceDeckAssetResult =
  | { ok: true; asset: WorkspaceDeckAssetRow }
  | { ok: false; status: number; error: string };

/**
 * 画像を1枚受け取ってアセットにする。
 *
 * 名乗られたMIMEを使わず、バイト列を自分で読んで形式と寸法を決める
 * (`probeWorkspaceDeckImage`)。長辺の上限を超える画像は断る。縮小はブラウザ側の仕事で、
 * ここで黙って原寸を通すと publish後のHTMLが5MB上限を越えて資料ごと開けなくなる。
 *
 * Storageへ先に置いてからDB行を作る。逆順だと、uploadに失敗したときに
 * 実体の無いアセット行が残り、デッキが「画像が見つからない」を抱えたまま publish される。
 * 行の作成に失敗したときは置いたobjectを消す (誰からも参照されない孤児にしない)。
 */
export async function createWorkspaceDeckAsset(input: {
  db: SupabaseClient;
  row: WorkspaceDocumentRow;
  access: WorkspaceDocumentAccess;
  storageBucket: string;
  storagePath: string;
  bytes: Buffer;
}): Promise<CreateWorkspaceDeckAssetResult> {
  const { db, row, access, storageBucket, storagePath, bytes } = input;

  if (!bytes.byteLength) return { ok: false, status: 400, error: "画像が空だよ。" };
  if (bytes.byteLength > WORKSPACE_DOCUMENT_ASSET_MAX_BYTES) {
    return { ok: false, status: 413, error: "画像は10MBまでだよ。" };
  }

  const probe: WorkspaceDeckImageProbe | null = probeWorkspaceDeckImage(bytes);
  if (!probe) {
    return { ok: false, status: 400, error: "PNG / JPEG / WebP / GIF の画像だけ置けるよ。" };
  }
  if (workspaceDeckImageExceedsMaxEdge(probe)) {
    return {
      ok: false,
      status: 400,
      error: `画像の長辺は${WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX}pxまでだよ。小さくしてから入れてね。`,
    };
  }

  const assetId = randomUUID();
  const assetPath = workspaceDocumentAssetStoragePathFromBase(
    storagePath,
    assetId,
    WORKSPACE_DECK_ASSET_EXTENSIONS[probe.mimeType],
  );

  const { error: uploadError } = await db.storage
    .from(storageBucket)
    .upload(assetPath, bytes, { upsert: false, contentType: probe.mimeType, cacheControl: "0" });
  if (uploadError) {
    console.error("[workspace-document-decks] asset upload failed:", uploadError.message);
    return { ok: false, status: 500, error: "画像を保存できなかったよ。" };
  }

  const { data: inserted, error: insertError } = await db
    .from("workspace_document_assets")
    .insert({
      asset_id: assetId,
      document_id: row.document_id,
      storage_bucket: storageBucket,
      storage_path: assetPath,
      mime_type: probe.mimeType,
      byte_size: bytes.byteLength,
      width: probe.width,
      height: probe.height,
      content_sha256: workspaceDeckAssetSha256(bytes),
      created_by_account_id: access.accountId,
    })
    .select(WORKSPACE_DECK_ASSET_FIELDS)
    .single();
  if (insertError) {
    console.error("[workspace-document-decks] asset insert failed:", insertError.message);
    await db.storage.from(storageBucket).remove([assetPath]);
    return { ok: false, status: 500, error: "画像を登録できなかったよ。" };
  }

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_mutated",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: {
      document_id: row.document_id,
      entry_kind: "file",
      action: "add_deck_asset",
      mime_type: probe.mimeType,
      byte_length: bytes.byteLength,
    },
  });

  return { ok: true, asset: inserted as unknown as WorkspaceDeckAssetRow };
}

/**
 * publish用に、モデルが参照しているアセットだけをdata URIへ変換する。
 * 参照されていないアセットは読まない。過去に置いた画像がpublish出力を太らせない。
 */
export async function loadWorkspaceDeckAssetSources(
  db: SupabaseClient,
  assets: WorkspaceDeckAssetRow[],
  assetIds: string[],
): Promise<{ sources: WorkspaceDeckAssetSources; missing: string[] }> {
  const wanted = new Set(assetIds);
  const sources: WorkspaceDeckAssetSources = {};
  const missing: string[] = [];

  for (const asset of assets) {
    if (!wanted.has(asset.asset_id)) continue;
    const { data, error } = await db.storage.from(asset.storage_bucket).download(asset.storage_path);
    if (error || !data) {
      console.error("[workspace-document-decks] asset download failed:", error?.message);
      missing.push(asset.asset_id);
      continue;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    sources[asset.asset_id] = workspaceDeckAssetDataUri(asset.mime_type, buffer.toString("base64"));
    wanted.delete(asset.asset_id);
  }
  return { sources, missing: [...missing, ...wanted] };
}

// ---------------------------------------------------------------------------
// publish
// ---------------------------------------------------------------------------

export type PublishWorkspaceDeckResult =
  | { ok: true; unchanged: boolean; sha256: string; byteLength: number; revisionNo: number | null; row: WorkspaceDeckRow }
  | { ok: false; status: number; error: string; missingAssets?: string[] };

/**
 * モデル → HTML → 現物の差し替え。
 *
 * 現物の楽観ロックは張らず、いまの現物のsha256をそのまま渡す。publish出力は生成物であって、
 * HTML側を直接直した内容はモデルに存在しない = 再生成で消えるのが正しい。
 * 消える分は `replaceWorkspaceHtmlSource` が版として退避するので、取り戻せる。
 * (モデルの側の競合は `saveWorkspaceDeckModel` の楽観ロックで止まっている)
 */
export async function publishWorkspaceDeck(input: {
  db: SupabaseClient;
  row: WorkspaceDocumentRow;
  access: WorkspaceDocumentAccess;
  storageBucket: string;
  storagePath: string;
  deck: WorkspaceDeck;
  deckRow: WorkspaceDeckRow;
}): Promise<PublishWorkspaceDeckResult> {
  const { db, row, access, storageBucket, storagePath, deck, deckRow } = input;

  let assets: WorkspaceDeckAssetRow[];
  try {
    assets = await listWorkspaceDeckAssets(db, row.document_id);
  } catch {
    return { ok: false, status: 500, error: "デッキの画像を読み込めなかったよ。" };
  }

  const assetIds = collectWorkspaceDeckAssetIds(deck);
  const { sources, missing } = await loadWorkspaceDeckAssetSources(db, assets, assetIds);
  if (missing.length) {
    // 画像が抜けたまま配らない。抜けたことに気づけるのは publish の瞬間だけ。
    return {
      ok: false,
      status: 409,
      error: "デッキが参照している画像を読み込めなかったよ。画像を置き直してね。",
      missingAssets: missing,
    };
  }

  const html = await renderWorkspaceDeckDocument(deck, sources);
  const byteLength = Buffer.byteLength(html, "utf8");
  if (byteLength > WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "公開HTMLが5MBを超えるよ。画像を減らすか小さくしてね。",
    };
  }

  // 現物のshaは row.content_sha256 から取らない。未編集資料でNULL、移行資料で古いことがある。
  const { data: currentFile, error: currentError } = await db.storage
    .from(storageBucket)
    .download(storagePath);
  if (currentError || !currentFile) {
    console.error("[workspace-document-decks] publish precheck failed:", currentError?.message);
    return { ok: false, status: 500, error: "いまの資料を確認できなかったよ。" };
  }
  const currentSha256 = workspaceDocumentContentSha256(await currentFile.text());

  const replaced = await replaceWorkspaceHtmlSource({
    db,
    row,
    access,
    storageBucket,
    storagePath,
    nextSource: html,
    expectedSha256: currentSha256,
    note: "デッキから公開",
    auditAction: "replace_html",
    // action は「HTMLを差し替えた」事実のまま置き、なぜ差し替えたかを deck_action へ逃がす。
    // audit action名を増やすと既存の契約テストが要求するリテラルの意味が薄まる。
    auditDetail: { editor: "deck", deck_action: "publish_deck", model_sha256: deckRow.model_sha256 },
  });
  if (!replaced.ok) {
    return { ok: false, status: replaced.status, error: replaced.error };
  }

  const publishedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await db
    .from("workspace_document_decks")
    .update({ published_sha256: deckRow.model_sha256, published_at: publishedAt })
    .eq("document_id", row.document_id)
    .select(WORKSPACE_DECK_FIELDS)
    .single();
  if (updateError) {
    console.error("[workspace-document-decks] publish flag update failed:", updateError.message);
    // HTMLは差し替わっている。ここで500を返すと利用者は「公開できなかった」と読むので、
    // 未公開扱いのまま成功を返さない。次のpublishでやり直せる。
    return { ok: false, status: 500, error: "公開はできたけど、公開済みの印を付けられなかったよ。もう一度publishしてね。" };
  }

  return {
    ok: true,
    unchanged: replaced.unchanged,
    sha256: replaced.sha256,
    byteLength,
    revisionNo: replaced.revisionNo,
    row: updated as unknown as WorkspaceDeckRow,
  };
}
