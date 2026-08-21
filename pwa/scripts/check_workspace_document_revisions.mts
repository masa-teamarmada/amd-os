/**
 * HTML資料の版履歴 (workspace_document_revisions) の契約テスト。
 *
 * 版履歴は「上書きされる前の内容」を残す最後の防波堤なので、壊れても画面には出ない。
 * だから挙動 (core の純粋関数) と、実装の不変条件 (source 文字列) の両方をここで固める。
 *
 * server-only を import する lib は素の Node から読み込めないため、
 * workspace-document-revisions.ts と route/UI は source を読んで assert する。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isWorkspaceDocumentSha256,
  normalizeWorkspaceDocumentRevisionNote,
  WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT,
  WORKSPACE_DOCUMENT_REVISION_LIST_LIMIT,
  WORKSPACE_DOCUMENT_REVISION_NOTE_MAX_LENGTH,
  workspaceDocumentRevisionStoragePath,
  workspaceDocumentRevisionStoragePathFromBase,
} from "../src/lib/workspace-documents-core.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

// ---------------------------------------------------------------------------
// 1. 退避先パス — 現物を上書きしない、版ごとに必ず別のobjectになる
// ---------------------------------------------------------------------------

const documentId = "7ec59a7f-211a-4670-b3c5-f1a35b5ee7aa";
const basePath = `project/p10_se/${documentId}`;

assert.equal(
  workspaceDocumentRevisionStoragePathFromBase(basePath, 1),
  `${basePath}.rev1.html`,
);
assert.equal(
  workspaceDocumentRevisionStoragePathFromBase(basePath, 42),
  `${basePath}.rev42.html`,
);
// 版ごとに別path。1つのobjectを版が共有したら、古い版の本文が黙って消える。
assert.notEqual(
  workspaceDocumentRevisionStoragePathFromBase(basePath, 1),
  workspaceDocumentRevisionStoragePathFromBase(basePath, 2),
);
// 退避先が現物のpathそのものになったら、退避が上書きになる。
assert.notEqual(workspaceDocumentRevisionStoragePathFromBase(basePath, 1), basePath);

assert.throws(() => workspaceDocumentRevisionStoragePathFromBase(basePath, 0));
assert.throws(() => workspaceDocumentRevisionStoragePathFromBase(basePath, -1));
assert.throws(() => workspaceDocumentRevisionStoragePathFromBase(basePath, 1.5));
assert.throws(() => workspaceDocumentRevisionStoragePathFromBase("", 1));
// path traversal。bucket内の別資料を退避先に指名させない。
assert.throws(() => workspaceDocumentRevisionStoragePathFromBase("project/../secret/x", 1));

assert.equal(
  workspaceDocumentRevisionStoragePath("project", "p10_se", documentId, 3),
  `project/p10_se/${documentId}.rev3.html`,
);
assert.equal(
  workspaceDocumentRevisionStoragePath("institution", "kagawa-u", documentId, 1),
  `institution/kagawa-u/${documentId}.rev1.html`,
);
assert.throws(() => workspaceDocumentRevisionStoragePath("project", "p10_se", "not-a-uuid", 1));

// ---------------------------------------------------------------------------
// 2. 版のメモ
// ---------------------------------------------------------------------------

assert.equal(normalizeWorkspaceDocumentRevisionNote("  保存前の内容  "), "保存前の内容");
assert.equal(normalizeWorkspaceDocumentRevisionNote(""), null);
assert.equal(normalizeWorkspaceDocumentRevisionNote("   "), null);
assert.equal(normalizeWorkspaceDocumentRevisionNote(null), null);
assert.equal(normalizeWorkspaceDocumentRevisionNote(123), null);
// 制御文字はログ・UIの表示を壊すので落とす。
assert.equal(normalizeWorkspaceDocumentRevisionNote("v1\u0007へ復元"), null);
assert.equal(normalizeWorkspaceDocumentRevisionNote("行\n跨ぎ"), null);
assert.equal(
  normalizeWorkspaceDocumentRevisionNote("あ".repeat(400))?.length,
  WORKSPACE_DOCUMENT_REVISION_NOTE_MAX_LENGTH,
);

// ---------------------------------------------------------------------------
// 3. sha256 — 楽観ロックのtokenはここでしか検査されない
// ---------------------------------------------------------------------------

assert.equal(isWorkspaceDocumentSha256("a".repeat(64)), true);
assert.equal(isWorkspaceDocumentSha256("0123456789abcdef".repeat(4)), true);
assert.equal(isWorkspaceDocumentSha256("A".repeat(64)), false, "大文字hexは既存書き込みと並ばない");
assert.equal(isWorkspaceDocumentSha256("a".repeat(63)), false);
assert.equal(isWorkspaceDocumentSha256("a".repeat(65)), false);
assert.equal(isWorkspaceDocumentSha256(""), false);
assert.equal(isWorkspaceDocumentSha256(null), false);
assert.equal(isWorkspaceDocumentSha256(undefined), false);
assert.equal(isWorkspaceDocumentSha256({}), false);
assert.equal(isWorkspaceDocumentSha256("g".repeat(64)), false);

assert.equal(WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT, 50);
assert.ok(WORKSPACE_DOCUMENT_REVISION_LIST_LIMIT >= WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT);

// ---------------------------------------------------------------------------
// 4. workspace-document-revisions.ts の不変条件
// ---------------------------------------------------------------------------

const lib = read("src/lib/workspace-document-revisions.ts");

// 行を先に入れてからStorageへ書く。逆順だと revision_no 競合時に
// 別の版の内容で同じobjectを潰し、先に入った行が別内容を指す。
const insertIndex = lib.indexOf(".insert({");
const uploadIndex = lib.indexOf(".upload(storagePath");
assert.ok(insertIndex > 0, "revision insert が無い");
assert.ok(uploadIndex > 0, "revision upload が無い");
assert.ok(insertIndex < uploadIndex, "版はDB insertを先に済ませてからStorageへ書く");

// 23505 = 別セッションが同じ番号を先に取った。番号を進めて取り直す。
assert.match(lib, /insertError\.code === "23505"[\s\S]{0,40}continue/);
// 本文の無い版行を残さない。
assert.match(
  lib,
  /uploadError[\s\S]*?\.from\("workspace_document_revisions"\)\s*\.delete\(\)\s*\.eq\("revision_id"/,
);
// 既存の版を書き換えない (追記のみ)。
assert.doesNotMatch(lib, /\.from\("workspace_document_revisions"\)\s*\.update\(/);
// private Storage の署名URLを発行しない。
assert.doesNotMatch(lib, /createSignedUrl|getPublicUrl/);
// bucket/path を公開形へ出さない。
const publicShape = lib.slice(
  lib.indexOf("export function publicWorkspaceDocumentRevision"),
  lib.indexOf("async function latestRevisionNo"),
);
assert.ok(publicShape.length > 0, "publicWorkspaceDocumentRevision が無い");
assert.doesNotMatch(publicShape, /storage_bucket|storage_path|storageBucket|storagePath/);
// content_sha256 は既存の書き込み経路と同じくUTF-8バイト列から取る。
assert.match(lib, /createHash\("sha256"\)\.update\(Buffer\.from\(source, "utf8"\)\)\.digest\("hex"\)/);
// 掃除はpinnedを触らない。
const pruneStart = lib.indexOf("export async function pruneWorkspaceDocumentRevisions");
assert.ok(pruneStart > 0, "pruneWorkspaceDocumentRevisions が無い");
const pruneBody = lib.slice(pruneStart, lib.indexOf("export async function listWorkspaceDocumentRevisions"));
assert.match(pruneBody, /\.eq\("pinned", false\)/);
assert.match(pruneBody, /\.range\(\s*WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT,/);
// 掃除の失敗で保存そのものを失敗させない。
assert.doesNotMatch(pruneBody, /throw new Error/, "版の掃除は失敗しても保存を巻き込まない");

// ---------------------------------------------------------------------------
// 5. migration 310 の不変条件
// ---------------------------------------------------------------------------

const migration = read("scripts/migrations/310_workspace_document_decks.sql");

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.workspace_document_revisions/);
// 版番号の重複をDBで止める。アプリのリトライはこの制約が前提。
assert.match(
  migration,
  /workspace_document_revisions_unique_no\s+UNIQUE\s*\(document_id, revision_no\)/,
);
// 資料を消したら版も消える。孤児の版行を残さない。
for (const table of [
  "workspace_document_decks",
  "workspace_document_revisions",
  "workspace_document_assets",
]) {
  const block = migration.slice(migration.indexOf(`CREATE TABLE IF NOT EXISTS public.${table}`));
  assert.match(
    block.slice(0, block.indexOf(");")),
    /REFERENCES public\.workspace_documents\(document_id\) ON DELETE CASCADE/,
    `${table} が workspace_documents に従属していない`,
  );
  assert.match(
    migration,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
    `${table} の RLS が有効化されていない`,
  );
}
// kind ごとに本文の置き場が決まる。deck_model は model、html_source は Storage。
assert.match(migration, /kind = 'deck_model'\s+AND model IS NOT NULL/);
assert.match(migration, /kind = 'html_source'[\s\S]{0,160}storage_path IS NOT NULL/);
assert.match(migration, /content_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
// private Storage の生URLを持たない。
assert.doesNotMatch(migration, /signed_url|public_url/);

// ---------------------------------------------------------------------------
// 6. 資料室UI — 楽観ロックと版履歴の導線
// ---------------------------------------------------------------------------

const room = read("src/components/workspace-documents/WorkspaceDocumentRoom.tsx");

// 読んだ時のshaを保存へ持ち込む。持ち込まなければ競合は永久に検知されない。
assert.match(room, /body: JSON\.stringify\(\{ source: draftHtmlSource, expectedSha256 \}\)/);
assert.match(room, /body: JSON\.stringify\(\{ expectedSha256: revisionsCurrentSha256 \}\)/);
// 409を握り潰さない。ユーザーが読み直すか上書きするかを選べる状態にする。
assert.match(room, /response\.status === 409 && payload\.conflict[\s\S]{0,200}setHtmlConflictSha256/);
assert.match(
  room,
  /response\.status === 409 && payload\.conflict[\s\S]{0,200}setRevisionsCurrentSha256/,
);
assert.match(room, /最新を読み込み直す/);
assert.match(room, /このまま上書き保存/);
// 版履歴への導線と、版ごとの操作。
assert.match(room, /dialog === "html_revisions"/);
assert.match(room, /void openHtmlRevisions\(\)/);
assert.match(room, /void previewRevision\(revision\.revisionNo\)/);
assert.match(room, /void restoreRevision\(revision\.revisionNo\)/);
// 復元前のshaが無いまま復元させない。
assert.match(room, /disabled=\{busy \|\| !revisionsCurrentSha256\}/);
// 現物のshaは必ずサーバが返したものを使う。クライアントで作らない。
assert.doesNotMatch(room, /createHash|crypto\.subtle/);

console.log("workspace document revisions: ok");
