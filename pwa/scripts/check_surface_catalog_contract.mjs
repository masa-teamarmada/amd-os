import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const [catalog, serverLayout, clientTitle, adminSidebar, adminEntries] = await Promise.all([
  readFile(new URL("../src/lib/surface-catalog.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(app)/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/nav/PageTitleSetter.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/admin/AdminSidebar.tsx", import.meta.url), "utf8"),
  readdir(new URL("../src/app/(app)/admin/", import.meta.url), { withFileTypes: true }),
]);

assert.match(catalog, /export const SURFACE_CATALOG/, "surface catalogを一つの正本として公開する");
for (const field of ["domain", "lens", "status"]) {
  assert.match(catalog, new RegExp(`${field}:`), `surfaceは${field}を持つ`);
}
for (const status of ["canonical", "projection", "transitional", "mirror", "deprecated"]) {
  assert.ok(catalog.includes(`"${status}"`), `surface statusに${status}を定義する`);
}
assert.match(catalog, /id: "portfolio-home"[\s\S]*status: "canonical"/, "ホームはcanonicalとして凍結する");
assert.match(catalog, /id: "weekly-control"[\s\S]*status: "deprecated"/, "旧週次管制routeはdeprecatedとして明記する");
assert.match(catalog, /id: "dashboard-cyber-lab"[\s\S]*status: "mirror"/, "実験dashboardはmirrorとして明記する");

for (const [label, source] of [["server layout", serverLayout], ["client title", clientTitle]]) {
  assert.match(source, /surfaceTitleForPath/, `${label}は共通catalogからtitleを解決する`);
  assert.doesNotMatch(source, /function pathToTitle/, `${label}に独自title mappingを残さない`);
}

assert.match(adminSidebar, /ADMIN_SURFACE_GROUPS/, "admin navは共通catalogのgroupを使う");
assert.doesNotMatch(adminSidebar, /const ADMIN_TABS/, "admin navに追加順のflat listを残さない");
for (const group of ["組織・権限", "契約・お金", "PJ・実行", "知識・AI", "運用"]) {
  assert.ok(catalog.includes(`label: "${group}"`), `admin navに${group}の職務groupを持つ`);
}
assert.match(catalog, /id: "admin-kiyo"[^\n]*navLabel: "きよ"[^\n]*primaryPath: "\/admin\/kiyo"/, "きよをsurface catalogへ登録する");
assert.match(catalog, /label: "契約・お金"[\s\S]*"admin-kiyo"/, "きよを契約・お金メニューへ置く");

const adminRouteNames = adminEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
for (const routeName of adminRouteNames) {
  const route = `/admin/${routeName}`;
  assert.ok(catalog.includes(`"${route}"`), `${route}をsurface catalogへ登録する`);
}

console.log("surface catalog contract: ok");
