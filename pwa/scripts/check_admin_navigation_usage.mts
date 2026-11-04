import assert from "node:assert/strict";
import { summarizeAdminVisits, rankAdminNavigation, adminNavigationMatches } from "../src/lib/admin-navigation-usage.ts";
import { ADMIN_SURFACE_GROUPS, getSurfaceById } from "../src/lib/surface-catalog.ts";

const items = [
  { label: "未使用", href: "/admin/unused", group: "組織" },
  { label: "契約", href: "/admin/contracts", group: "契約・お金" },
  { label: "月次試算表", href: "/admin/monthly-trial-balance", group: "契約・お金" },
  { label: "明細", href: "/admin/contracts/detail", group: "契約・お金" },
];
const rows = [
  { pathname: "/admin/contracts", visit_count: "5", last_visited_at: "2026-11-01T00:00:00Z" },
  { pathname: "/admin/contracts/detail/entry", visit_count: 3, last_visited_at: "2026-11-02T00:00:00Z" },
  { pathname: "/admin/monthly-trial-balance", visit_count: 5, last_visited_at: "2026-11-03T00:00:00Z" },
  { pathname: "/project/private/cockpit", visit_count: 999, last_visited_at: "2026-11-04T00:00:00Z" },
  { pathname: "/admin/unused", visit_count: -10, last_visited_at: "invalid" },
];
const saved = JSON.stringify({items,rows});
const usage = summarizeAdminVisits(rows,items.map(item=>item.href));
assert.deepEqual(Object.keys(usage).sort(),items.map(item=>item.href).sort(),"許可されたメニュー以外の履歴を返さない");
assert.equal(usage["/admin/contracts"].visitCount,5,"詳細履歴は最も具体的なリンクだけに数え、親と二重計上しない");
assert.equal(usage["/admin/contracts/detail"].visitCount,3);
const ranked = rankAdminNavigation(items,usage);
assert.deepEqual(ranked.visited.map(item=>item.label),["月次試算表","契約","明細"],"回数の降順。同数なら直近に開いたページを先にする");
assert.deepEqual(ranked.unvisited.map(item=>item.label),["未使用"],"記録のないページも保持");
assert.deepEqual(rankAdminNavigation(items,{},"").unvisited,items,"履歴が空でも全ページが残る");
assert.deepEqual(rankAdminNavigation(items,usage,"お金 月次").visited.map(item=>item.label),["月次試算表"],"ページ名と分類の両方で絞り込める");
assert.equal(adminNavigationMatches({label:"AI設定",href:"/admin/settings",group:"運用"},"ａｉ"),true);
assert.equal(rankAdminNavigation(items,usage,"該当なし").visited.length,0);
assert.equal(rankAdminNavigation(items,usage,"該当なし").unvisited.length,0);
assert.equal(JSON.stringify({items,rows}),saved,"表示順の計算で履歴と元の定義を変更しない");
const definition=getSurfaceById("admin-monthly-trial-balance");
assert.equal(definition?.title,"月次試算表");
assert.equal(definition?.primaryPath,"/admin/monthly-trial-balance");
assert.ok(ADMIN_SURFACE_GROUPS.some(group=>(group.surfaceIds as readonly string[]).includes("admin-monthly-trial-balance")),"独立ページが管理メニューから開ける");
console.log("admin navigation usage: frequency, ties, nested pages, search, empty history and monthly route passed");
