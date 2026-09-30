// 純関数の検査: DDパッケージの閲覧範囲・ログイン可否・関所の path・公開版の直列化。
// DB・Next.js は使わない。実行: npm run test:dd-package

import assert from "node:assert/strict";
import {
  DD_SECTIONS,
  buildDdViewerScope,
  canonicalJson,
  hasDdCapability,
  hasLoginEligibleDdGrant,
  isDdSlug,
  isDdViewerPath,
  isUuid,
  normalizeDdCapabilities,
  normalizeDdUnverifiedNotes,
  type DdGrantRow,
} from "../src/lib/dd-package-core.ts";

const NOW = Date.parse("2026-09-30T06:00:00Z");
const ACCOUNT = { id: "acct-1", email_normalized: "investor@example.com", auth_user_id: "auth-1", status: "active" as const };
const OPEN_PACKAGE = { id: "pkg-1", slug: "sol", project_id: "p21", title: "SolvioraX DD資料", status: "open" as const };

function grant(overrides: Partial<DdGrantRow> = {}): DdGrantRow {
  return {
    id: "grant-1",
    status: "active",
    capabilities: ["dd.view"],
    expires_at: null,
    package: OPEN_PACKAGE,
    ...overrides,
  };
}

// --- 7区分はこの順で固定 ------------------------------------------------------
assert.deepEqual(
  DD_SECTIONS.map((section) => section.label),
  ["事業概要", "技術・製品", "顧客・市場", "採算・数値計画", "資本政策", "知財・契約・体制", "証憑一覧"],
);

// --- 閲覧範囲 ---------------------------------------------------------------
{
  const scope = buildDdViewerScope(ACCOUNT, "investor@example.com", [grant()], NOW);
  assert.ok(scope, "有効な付与と公開中のパッケージなら入れる");
  assert.equal(scope.packages.length, 1);
  assert.deepEqual(scope.packages[0].capabilities, ["dd.view"]);
  assert.equal(scope.packages[0].projectId, "p21");
}
// アカウントの状態・紐付け・メール不一致は閉じる
assert.equal(buildDdViewerScope(null, "investor@example.com", [grant()], NOW), null);
assert.equal(buildDdViewerScope({ ...ACCOUNT, status: "suspended" }, "investor@example.com", [grant()], NOW), null, "停止中のアカウントは入れない");
assert.equal(buildDdViewerScope({ ...ACCOUNT, status: "invited" }, "investor@example.com", [grant()], NOW), null, "ログイン未完了のアカウントは入れない");
assert.equal(buildDdViewerScope({ ...ACCOUNT, auth_user_id: null }, "investor@example.com", [grant()], NOW), null);
assert.equal(buildDdViewerScope(ACCOUNT, "other@example.com", [grant()], NOW), null, "cookie のメールと一致しなければ入れない");
// 付与の状態
for (const status of ["invited", "suspended", "revoked"] as const) {
  assert.equal(buildDdViewerScope(ACCOUNT, "investor@example.com", [grant({ status })], NOW), null, `${status} の付与では入れない`);
}
// パッケージの状態
for (const status of ["draft", "closed"] as const) {
  assert.equal(
    buildDdViewerScope(ACCOUNT, "investor@example.com", [grant({ package: { ...OPEN_PACKAGE, status } })], NOW),
    null,
    `${status} のパッケージは外部アカウントに開かない`,
  );
}
assert.equal(buildDdViewerScope(ACCOUNT, "investor@example.com", [grant({ package: null })], NOW), null, "読めないパッケージは数えない");
// 期限
assert.equal(buildDdViewerScope(ACCOUNT, "investor@example.com", [grant({ expires_at: "2026-09-30T05:59:59Z" })], NOW), null, "期限切れは入れない");
assert.equal(buildDdViewerScope(ACCOUNT, "investor@example.com", [grant({ expires_at: "not-a-date" })], NOW), null, "読めない期限は失効扱い");
assert.ok(buildDdViewerScope(ACCOUNT, "investor@example.com", [grant({ expires_at: "2026-10-01T00:00:00Z" })], NOW));
// 操作
assert.equal(buildDdViewerScope(ACCOUNT, "investor@example.com", [grant({ capabilities: ["dd.download"] })], NOW), null, "dd.view の無い付与は数えない");
assert.equal(buildDdViewerScope(ACCOUNT, "investor@example.com", [grant({ capabilities: "dd.view" })], NOW), null, "配列でない capabilities は数えない");
{
  const scope = buildDdViewerScope(ACCOUNT, "investor@example.com", [grant({ capabilities: ["dd.download", "workspace.view", "dd.view"] })], NOW);
  assert.ok(scope);
  assert.deepEqual(scope.packages[0].capabilities, ["dd.view", "dd.download"], "既知の操作だけを残す");
  assert.ok(hasDdCapability(scope.packages[0], "dd.download"));
}
assert.deepEqual(normalizeDdCapabilities(["x", "dd.view", "dd.view"]), ["dd.view"]);

// --- ログインリンクを送ってよいか ---------------------------------------------
assert.equal(hasLoginEligibleDdGrant([{ status: "invited", capabilities: ["dd.view"], expires_at: null, package: { status: "open" } }], NOW), true);
assert.equal(hasLoginEligibleDdGrant([{ status: "active", capabilities: ["dd.view"], expires_at: null, package: { status: "draft" } }], NOW), false, "未公開パッケージへの付与ではリンクを送らない");
assert.equal(hasLoginEligibleDdGrant([{ status: "revoked", capabilities: ["dd.view"], expires_at: null, package: { status: "open" } }], NOW), false);
assert.equal(hasLoginEligibleDdGrant([{ status: "active", capabilities: ["dd.view"], expires_at: "2026-01-01T00:00:00Z", package: { status: "open" } }], NOW), false);
assert.equal(hasLoginEligibleDdGrant([], NOW), false);

// --- 関所で外部セッションを通す path -----------------------------------------
const ITEM = "0b8c7a1e-3f7e-4a3b-9a55-2b1d8c4e6f70";
for (const path of ["/dd", "/dd/sol", "/dd/sol/", `/dd/sol/items/${ITEM}`, `/dd/sol/items/${ITEM}/file`]) {
  assert.ok(isDdViewerPath(path), `${path} は DD の面`);
}
for (const path of ["/ddx", "/dd/sol/admin", "/dd/sol/items", `/dd/sol/items/${ITEM}/file/x`, "/project/p21/dd", "/project/p21/workspace/dd", "/api/admin/dd"]) {
  assert.ok(!isDdViewerPath(path), `${path} は DD の面として通さない`);
}

// --- 入力の正規化 -----------------------------------------------------------
assert.ok(isDdSlug("sol"));
assert.ok(!isDdSlug("SOL"));
assert.ok(!isDdSlug("../sol"));
assert.ok(isUuid(ITEM));
assert.ok(!isUuid("p21"));
assert.deepEqual(normalizeDdUnverifiedNotes("・シリーズAは未定\n\n- 融資は未合意\n"), ["シリーズAは未定", "融資は未合意"]);
assert.equal(normalizeDdUnverifiedNotes(Array.from({ length: 40 }, (_, i) => `n${i}`)).length, 30);

// --- 公開版の直列化はキー順に依らない -----------------------------------------
assert.equal(canonicalJson({ b: 1, a: [1, { d: 2, c: 3 }] }), canonicalJson({ a: [1, { c: 3, d: 2 }], b: 1 }));
assert.equal(canonicalJson({ a: undefined, b: null }), '{"b":null}');

console.log("dd package core: ok");
