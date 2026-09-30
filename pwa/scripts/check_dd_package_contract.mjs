// DDパッケージの静的な契約検査（コードの形を固定する）。本番反映前に deploy.sh から必ず走る。
// 実行: npm run test:dd-package
//
// 守ること（pwa/spec/5-17-dd-package-current-spec.md）:
//   - DDへ入れる根拠は dd_package_grants だけ。ワークスペースの所属表を読まない・作らない。
//   - 閲覧者の面（/dd/**）は、データを読む前に毎回 DB を引き直した権限を確かめ、権限が無ければ「見つからない」で閉じる。
//   - 閲覧者へ返す列に、添付の保存先・確認メモ・公開した人・元データの内部参照を入れない。
//   - 公開版は DB 関数 dd_publish_item だけが作る。画面から送られた payload を公開しない。
//   - 管理 API は requireAdmin と同一サイト確認のあとで動き、停止・失効を作成で復活させない。
//   - 外部アカウントの署名 cookie を認証として通すのは、ワークスペースの面と DD の面だけ。

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
/** 行コメントを除いたコード（コメントに書いた表名・語で誤検知しないため）。 */
const code = (source) => source.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// --- 領域の分離 -------------------------------------------------------------
const access = read("src/lib/dd-access.ts");
for (const table of ["project_access_memberships", "institution_workspace_memberships"]) {
  assert.ok(!code(access).includes(table), `dd-access は ${table} を読まない（DDの権限はワークスペースの所属と独立）`);
}
assert.match(access, /getWorkspaceAccessCandidateSession\(\)/, "外部アカウントは署名 cookie から始める");
assert.match(access, /from\("dd_package_grants"\)/, "DDの根拠は dd_package_grants");
assert.match(access, /member\?\.isAdmin/, "内部メンバーは admin だけが管理者プレビューできる");

const scopeCore = read("src/lib/workspace-access-scope-core.ts");
assert.ok(!code(scopeCore).includes("dd_"), "ワークスペースの範囲判定に DD の付与を混ぜない");

// --- 閲覧者の面 -------------------------------------------------------------
const ddAppDir = path.join(root, "src/app/dd");
const viewerFiles = walk(ddAppDir).filter((file) => /\.(tsx|ts)$/.test(file) && !file.endsWith("layout.tsx"));
assert.ok(viewerFiles.length >= 4, "DD の面のページ・route が揃っている");
for (const file of viewerFiles) {
  const source = readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  if (relative === path.join("src", "app", "dd", "page.tsx")) {
    assert.match(source, /resolveDdViewerScope\(\)/, "/dd は DB を引き直した閲覧範囲から一覧を作る");
    assert.match(source, /if \(!member\.isAdmin\) notFound\(\)/, "admin 以外の内部メンバーは /dd を開けない");
    continue;
  }
  const accessIndex = source.indexOf("resolveDdPackageAccess(");
  const loadIndex = Math.min(
    ...["loadDdPackageView(", "loadDdPublishedItem(", "loadDdPublicationFile("]
      .map((call) => source.indexOf(call))
      .filter((index) => index >= 0),
  );
  assert.ok(accessIndex >= 0, `${relative} は resolveDdPackageAccess で権限を確かめる`);
  assert.ok(accessIndex < loadIndex, `${relative} はデータを読む前に権限を確かめる`);
  assert.match(source, /if \(!access\) (?:notFound\(\)|return notFound\(\))/, `${relative} は権限が無ければ見つからないで閉じる`);
}
const layout = read("src/app/dd/layout.tsx");
assert.ok(!/from\("dd_packages"\)|projectName|project_name/.test(layout), "DD の枠のタイトルにパッケージ名・PJ名を出さない");

const fileRoute = read("src/app/dd/[slug]/items/[itemId]/file/route.ts");
assert.match(fileRoute, /hasDdCapability\(access, "dd\.download"\)/, "ダウンロードは dd.download を持つ人だけ");
assert.match(fileRoute, /sandbox/, "HTML はサンドボックスで返す");
assert.match(fileRoute, /no-store/, "添付の応答をキャッシュさせない");
assert.match(fileRoute, /createSignedUrl\(file\.storagePath, 60\)/, "署名URLは60秒");

const nextConfig = read("next.config.ts");
assert.match(nextConfig, /source: "\/dd\/:slug\/items\/:itemId\/file",\s*\n\s*headers: ddPublicationFileSecurityHeaders/, "DD の添付表示には全体の CSP を上書きするサンドボックスを当てる");
assert.ok(
  nextConfig.indexOf('source: "/dd/:slug/items/:itemId/file"') > nextConfig.indexOf("headers: securityHeaders"),
  "サンドボックスの設定は全体の設定より後に置く（後の設定が上書きする）",
);

// --- 閲覧者へ返す列 -----------------------------------------------------------
const server = read("src/lib/dd-package-server.ts");
const viewFields = server.match(/DD_PUBLICATION_VIEW_FIELDS =\s*\n?\s*"([^"]+)"/);
assert.ok(viewFields, "閲覧者へ返す列を1か所で定義する");
for (const hidden of ["file_storage_path", "note", "published_by_member_id", "source_refs", "content_hash"]) {
  assert.ok(!viewFields[1].split(",").includes(hidden), `閲覧者へ ${hidden} を返さない`);
}
assert.match(server, /\.eq\("status", "active"\)\s*\n\s*\.not\("published_publication_id", "is", null\)/, "公開版のある有効な項目だけを返す");
assert.match(server, /publication\.item_id !== row\.id \|\| publication\.package_id !== packageId/, "公開版が同じ項目・同じパッケージのものか確かめる");
assert.match(server, /rpc\("dd_publish_item"/, "公開は DB 関数 dd_publish_item だけ");
assert.match(server, /buildDdPublicationDraft\(/, "公開版は元データから作り直す");
assert.match(server, /if \(access\.principal !== "workspace_account"\) return;/, "管理者プレビューは閲覧記録に入れない");

// --- 管理 API ---------------------------------------------------------------
const adminApi = read("src/app/api/admin/dd/route.ts");
const postBody = adminApi.slice(adminApi.indexOf("export async function POST"));
assert.ok(postBody.indexOf("requireAdmin()") < postBody.indexOf("readBody("), "requireAdmin を最初に呼ぶ");
assert.match(postBody, /isSameOriginWorkspaceMutation\(request\)/, "同一サイト確認");
assert.ok(!/\.upsert\(/.test(adminApi), "何でも受け付ける upsert の経路を作らない");
assert.ok(!/body\.payload|p_payload|["']payload["']/.test(code(adminApi)), "画面から payload を受け取らない");
assert.match(adminApi, /grant_already_exists/, "既存の付与（停止・失効を含む）を作成で復活させない");
assert.match(adminApi, /confidential_requires_acknowledgement/, "要秘匿の項目は明示の確認なしに追加しない");
assert.ok(!/project_access_memberships|institution_workspace_memberships/.test(code(adminApi)), "DD の付与でワークスペースの所属を作らない");
assert.match(adminApi, /value\.every\(isDdPartKey\)/, "載せる範囲は既知の形の key だけを受け付ける");
assert.match(adminApi, /DD_PART_ITEM_KINDS\.includes\(item\.item_kind\)/, "載せる範囲は、範囲を選べる種類の項目だけに保存する");
const sources = read("src/lib/dd-sources.ts");
assert.match(sources, /const included = readDdIncludedParts\(input\.sourceOptions\);/, "下書き・公開版は、選ばれた範囲で元データから作る");

// --- 関所・ログイン ------------------------------------------------------------
const middleware = read("src/lib/supabase/middleware.ts");
assert.match(middleware, /if \(isDdViewerPath\(pathname\)\) return true;/, "DD の面だけを外部セッションに開ける");
const emailStart = read("src/app/api/auth/email-start/route.ts");
assert.match(emailStart, /hasLoginEligibleDdGrant\(ddGrants\)/, "DD だけを許可された人にもログインリンクを送る");
assert.match(emailStart, /createPkceAuthClient/, "ログインリンクは PKCE で送る（トークンを URL に載せない）");
assert.ok(!/createServiceClient\(url, anonKey\)/.test(emailStart), "implicit 既定の素の anon クライアントで OTP を送らない");
const callback = read("src/app/auth/callback/route.ts");
assert.match(callback, /from\("dd_package_grants"\)\s*\n\s*\.update\(\{ status: "active" \}\)/, "招待済みの DD 付与をログインで有効化する");
assert.match(callback, /resolveDdViewerScopeForAccount\(/, "ログイン時に DD の閲覧範囲も引き直す");

// --- 内部データの受け口 --------------------------------------------------------
const tsukuyomi = read("src/app/api/tsukuyomi/chat/route.ts");
const tsukuyomiPost = tsukuyomi.slice(tsukuyomi.indexOf("export async function POST"));
assert.ok(
  tsukuyomiPost.indexOf("requireMember()") >= 0 && tsukuyomiPost.indexOf("requireMember()") < tsukuyomiPost.indexOf("loadProjectContext("),
  "つくよみは AMD メンバーのログインを確かめてから PJ の context を読む",
);
for (const route of ["src/app/api/project-tech/route.ts", "src/app/api/project-cost-model/route.ts", "src/app/api/project-ip/route.ts"]) {
  const source = read(route);
  const getBody = source.slice(source.indexOf("export async function GET"));
  assert.match(getBody, /const auth = await requireMember\(\);/, `${route} の読み取りは AMD メンバーか当該PJのワークスペース権限者だけ`);
}

// --- migration ------------------------------------------------------------------
const migration = read("scripts/migrations/455_dd_packages.sql");
assert.match(migration, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.dd_item_publications FROM service_role/, "公開版は DB 関数以外から書けない");
assert.match(migration, /CREATE TRIGGER workspace_reject_update BEFORE UPDATE ON public\.dd_item_publications/, "公開版は書き換えできない");
assert.match(migration, /workspace_reject_hard_delete/, "物理削除しない");
assert.match(migration, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated/, "anon / 一般 authenticated の直接権限を外す");
assert.match(migration, /'dd\.view' = ANY \(capabilities\)/, "dd.view の無い付与を作らない");
assert.match(migration, /dd grants must not create by this migration|dd grants must not be created by this migration/, "migration で閲覧権限を作らない");
assert.match(migration, /'sol',\s*\n\s*'SolvioraX DD資料',[\s\S]*?'draft'/, "SOL のパッケージは未公開で作る");

console.log("dd package contract: ok");
