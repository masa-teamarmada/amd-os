// DDパッケージの静的な契約検査（コードの形を固定する）。本番反映前に deploy.sh から必ず走る。
// 実行: npm run test:dd-package
//
// 守ること（pwa/spec/5-17-dd-package-current-spec.md）:
//   - DDへ入れる根拠は dd_package_grants だけ。ワークスペースの所属表を読まない・作らない。
//   - 閲覧者の面（/dd/**）は、データを読む前に毎回 DB を引き直した権限を確かめ、権限が無ければ「見つからない」で閉じる。
//   - 閲覧者には「公開中（is_published）で有効な項目」だけを返す。未公開の項目は管理者のプレビューだけ。
//   - 中身は閲覧のたびに元データの最新から作り、ワークスペースと同じ部品で描く。固定した版（dd_item_publications）は使わない。
//   - 投資家の画面は汎用の API（コスト試算など）を叩かない。サーバが渡した値を手元に置いて部品を描く。
//   - 正式版（PDF）の印刷画面は管理者だけ。出力の記録はサーバが公開中の項目を読み直して残す。
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

// DDは独立した領域。管理部品を社内・共同作業の子タブへ戻さない。
for (const file of ["src/components/cockpit/CockpitView.tsx", "src/components/project-workspace/SxWeeklyControlDashboard.tsx"]) {
  assert.doesNotMatch(code(read(file)), /DdProjectTab|DdAdminPanel/, `${file}: DD管理は独立した画面だけ`);
  assert.match(code(read(file)), /ProjectSurfaceNav/, `${file}: 並列の領域選択を共用する`);
}
assert.doesNotMatch(code(read("src/lib/project-formats.ts")), /group: "dd-group"/, "DDを他領域の分類に含めない");
const adminPage = read("src/app/(app)/project/[projectId]/dd/page.tsx");
const adminGuardIndex = adminPage.indexOf("if (!member?.isAdmin");
assert.ok(adminGuardIndex >= 0 && adminGuardIndex < adminPage.indexOf("getDdPackageSummary(projectId)"), "DD入口もデータを読む前に管理権限を確認する");
assert.doesNotMatch(adminPage, /cockpit\?tab=dd/, "DD入口からコックピットへ戻さない");
assert.match(adminPage, /<DdProjectTab/, "DD管理を独立したDD画面で開く");
assert.match(read("src/app/(app)/project/[projectId]/cockpit/page.tsx"), /legacyDd.*?=/, "旧DD子タブのURLを受け付ける");
const ddNavigation = read("src/components/dd/DdNavigation.tsx");
assert.match(ddNavigation, /DD_ITEM_PAGES\.map/, "DDの資料目録は固定定義から一段で作る");
assert.match(ddNavigation, /item\.label/, "DDの項目名は承認済みの資料名から作る");
assert.doesNotMatch(ddNavigation, /selectedGroup|dd-group-navigation|dd-child-navigation|COCKPIT_GROUP_LABELS/, "DDにグループや子メニューを戻さない");
assert.match(read("src/lib/dd-project-pages-server.ts"), /isDdEmptyPageKey\(page\)\) return/, "未登録の項目も共通空状態で開ける");
assert.match(read("src/components/dd/DdProjectPageBody.tsx"), /ProjectDiligenceSection/, "新規資料区分の空状態を描く");
assert.doesNotMatch(ddNavigation, />一覧</, "DD専用の一覧タブを足さない");
assert.doesNotMatch(read("src/components/dd/DdViewerShell.tsx"), /管理者プレビュー|role="status"/, "DD閲覧へ専用の管理帯を足さない");
assert.doesNotMatch(read("src/components/dd/DdPackageTop.tsx"), /<table|<dl|DD_ITEM_KIND_LABEL/, "ページ選択から一覧を挟まず本文を開く");
const sharedPage = read("src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx");
assert.match(sharedPage, /resolveDdViewerScope\(\)/, "共有画面のDD入口は独立したDD付与を再確認する");
assert.match(sharedPage, /pkg\.projectId === projectId/, "DD入口は現在のPJに限定する");
assert.match(read("src/components/dd/DdViewerShell.tsx"), /resolveSharedWorkspaceAccess\(access\.projectId\)/, "DD画面の共有入口も独立したPJ所属を再確認する");

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
    ...["loadDdPackageView(", "loadDdItemView(", "loadDdItem(", "loadDdPackageRow(", "loadDdPublishedLive(", "deliverDdDocument("]
      .map((call) => source.indexOf(call))
      .filter((index) => index >= 0),
  );
  assert.ok(accessIndex >= 0, `${relative} は resolveDdPackageAccess で権限を確かめる`);
  assert.ok(accessIndex < loadIndex, `${relative} はデータを読む前に権限を確かめる`);
  assert.match(
    source,
    /if \(!access(?: \|\| access\.principal !== "internal_admin")?\) (?:notFound\(\)|return notFound\(\))/,
    `${relative} は権限が無ければ見つからないで閉じる`,
  );
}
const printPage = read("src/app/dd/[slug]/print/page.tsx");
assert.match(printPage, /if \(!access \|\| access\.principal !== "internal_admin"\) notFound\(\);/, "正式版（PDF）の印刷画面は管理者だけ");
const layout = read("src/app/dd/layout.tsx");
assert.ok(!/from\("dd_packages"\)|projectName|project_name/.test(layout), "DD の枠のタイトルにパッケージ名・PJ名を出さない");

const fileRoute = read("src/app/dd/[slug]/items/[itemId]/file/route.ts");
assert.match(fileRoute, /hasDdCapability\(access, "dd\.download"\)/, "ダウンロードは dd.download を持つ人だけ");
assert.match(fileRoute, /sandbox/, "HTML はサンドボックスで返す");
assert.match(fileRoute, /no-store/, "添付の応答をキャッシュさせない");
assert.match(fileRoute, /if \(!item\.is_published && access\.principal !== "internal_admin"\) return notFound\(\);/, "閲覧者には公開中の資料だけを渡す");
const sources = read("src/lib/dd-sources.ts");
assert.ok((sources.match(/createSignedUrl\([^)]*, 60, signOptions\)/g) ?? []).length >= 3, "資料の署名URLは60秒");

const nextConfig = read("next.config.ts");
assert.match(nextConfig, /source: "\/dd\/:slug\/items\/:itemId\/file",\s*\n\s*headers: ddPublicationFileSecurityHeaders/, "DD の添付表示には全体の CSP を上書きするサンドボックスを当てる");
assert.ok(
  nextConfig.indexOf('source: "/dd/:slug/items/:itemId/file"') > nextConfig.indexOf("headers: securityHeaders"),
  "サンドボックスの設定は全体の設定より後に置く（後の設定が上書きする）",
);

// --- 閲覧者へ返す項目と中身 -------------------------------------------------------
const server = read("src/lib/dd-package-server.ts");
assert.match(server, /\.eq\("package_id", packageId\)\.eq\("status", "active"\)/, "有効な項目だけを読む");
assert.match(server, /if \(!options\.includeUnpublished\) query = query\.eq\("is_published", true\);/, "閲覧者には公開中の項目だけを返す");
assert.match(server, /loadActiveItems\(packageId, \{ includeUnpublished: false, itemKind \}\)/, "DDトップと正式版の出力は公開中の項目だけ");
assert.match(server, /if \(!row\.is_published && access\.principal !== "internal_admin"\) return null;/, "未公開の項目は管理者のプレビューだけ");
assert.match(server, /row\.package_id !== access\.packageId/, "別パッケージの項目は開かない");
assert.match(server, /loadDdItemLive\(/, "中身は閲覧のたびに元データの最新から作る");
assert.match(server, /if \(access\.principal !== "workspace_account"\) return;/, "管理者プレビューは閲覧記録に入れない");
for (const [file, source] of [["dd-package-server.ts", server], ["dd-sources.ts", sources]]) {
  assert.ok(!/dd_item_publications|dd_publish_item|published_publication_id/.test(code(source)), `${file} は固定した版の仕組みを使わない`);
}
for (const shape of ["shapeDdTechTopic(", "shapeDdFundingPlan(", "shapeDdCapitalPolicy(", "shapeDdCostModel(", "shapeDdDocument("]) {
  assert.ok(sources.includes(shape), `中身は ${shape} を通して作る（部品が表示しない社内の値を外す）`);
}
const liveBodies = read("src/components/dd/DdLiveBodies.tsx");
assert.ok(!/fetch\(/.test(code(liveBodies)), "DDの中身の部品は汎用の API を叩かない（サーバが渡した値を使う）");
assert.match(liveBodies, /primeProjectCostModel\(|primeProjectFuelCostModel\(/, "コスト試算はサーバが渡した試算を手元に置いてから描く");
assert.match(liveBodies, /canEdit=\{false\}/, "技術台帳のページは見るだけで描く");
assert.match(liveBodies, /allowEdit=\{false\}/, "コスト試算は見るだけで描く");
assert.match(liveBodies, /\breadOnly\b/, "資本政策表は見るだけで描く");

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
const getBody = adminApi.slice(adminApi.indexOf("export async function GET"), adminApi.indexOf("export async function POST"));
assert.ok(getBody.indexOf("requireAdmin()") >= 0 && getBody.indexOf("requireAdmin()") < getBody.indexOf("loadDdAdminState("), "管理画面の読み取りも requireAdmin を最初に呼ぶ");
assert.match(adminApi, /setDdItemPublished\(item\.id, true, actor\)/, "公開は公開中の切り替えだけ");
assert.match(adminApi, /const loaded = await loadDdPublishedLive\(pkg\.id\);/, "出力の記録はサーバが公開中の項目を読み直して残す");
assert.ok(!/dd_item_publications|dd_publish_item|published_publication_id/.test(code(adminApi)), "管理 API は固定した版の仕組みを使わない");
const summaryApi = read("src/app/api/dd/summary/route.ts");
assert.match(summaryApi, /const auth = await requireAdmin\(\);/, "DDパッケージの有無は AMD admin だけに返す");
assert.match(summaryApi, /Cache-Control/, "DDパッケージの有無は参照系（HTTP キャッシュを明示）");

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
const live = read("scripts/migrations/457_dd_live_items.sql");
assert.match(live, /ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE/, "新しい項目は非公開で作る");
assert.match(live, /CHECK \(status = 'active' OR NOT is_published\)/, "外した項目は公開できない");
assert.match(live, /RAISE EXCEPTION 'sol の DD パッケージに閲覧権限がある/, "migration で閲覧権限を作らない（SOL は付与0件のまま）");
const drop = read("scripts/migrations/458_dd_drop_fixed_publications.sql");
assert.match(drop, /DROP FUNCTION IF EXISTS public\.dd_publish_item\(/, "固定した版を作る関数を外す");
assert.match(drop, /DROP COLUMN IF EXISTS published_publication_id/, "固定した版への参照を外す");
const migration = read("scripts/migrations/455_dd_packages.sql");
assert.match(migration, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.dd_item_publications FROM service_role/, "公開版は DB 関数以外から書けない");
assert.match(migration, /CREATE TRIGGER workspace_reject_update BEFORE UPDATE ON public\.dd_item_publications/, "公開版は書き換えできない");
assert.match(migration, /workspace_reject_hard_delete/, "物理削除しない");
assert.match(migration, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated/, "anon / 一般 authenticated の直接権限を外す");
assert.match(migration, /'dd\.view' = ANY \(capabilities\)/, "dd.view の無い付与を作らない");
assert.match(migration, /dd grants must not create by this migration|dd grants must not be created by this migration/, "migration で閲覧権限を作らない");
assert.match(migration, /'sol',\s*\n\s*'SolvioraX DD資料',[\s\S]*?'draft'/, "SOL のパッケージは未公開で作る");

console.log("dd package contract: ok");
