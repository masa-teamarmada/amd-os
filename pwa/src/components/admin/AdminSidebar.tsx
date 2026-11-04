"use client";

import { IntentLink } from "@/components/nav/IntentLink";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Menu, X } from "lucide-react";
import { BUILD_VERSION } from "@/lib/build-info";
import { cn } from "@/lib/utils";
import { ADMIN_SURFACE_GROUPS, getSurfaceById } from "@/lib/surface-catalog";
import { adminNavigationMatches, rankAdminNavigation, type AdminNavigationItem, type AdminNavigationUsage } from "@/lib/admin-navigation-usage";

const ADMIN_NAV_GROUPS = ADMIN_SURFACE_GROUPS.map((group) => ({
  label: group.label,
  items: group.surfaceIds.map((id) => {
    const surface = getSurfaceById(id);
    if (!surface?.primaryPath) throw new Error(`Admin surface is not navigable: ${id}`);
    return { label: surface.navLabel ?? surface.title, href: surface.primaryPath };
  }),
}));
const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
type UsageState = { status: "loading" | "error"; usage?: never } | { status: "ready"; usage: AdminNavigationUsage };

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [usageState, setUsageState] = useState<UsageState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  // Admin内の移動中は順序を固定する。入り直し・再読込時に最新の閲覧回数を反映。
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    fetch("/api/admin/navigation-usage", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("navigation usage unavailable");
        const value = await response.json() as { usage?: AdminNavigationUsage };
        if (!value.usage || typeof value.usage !== "object") throw new Error("invalid navigation usage");
        if (active) setUsageState({ status: "ready", usage: value.usage });
      })
      .catch(() => { if (active) setUsageState({ status: "error" }); })
      .finally(() => window.clearTimeout(timer));
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [refreshKey]);

  const ranked = usageState.status === "ready" ? rankAdminNavigation(ADMIN_NAV_ITEMS, usageState.usage, query) : null;
  const selected = ADMIN_NAV_ITEMS.filter((item) => adminNavigationMatches(item, query));
  const renderItem = (tab: AdminNavigationItem) => {
    const count = usageState.status === "ready" ? usageState.usage[tab.href]?.visitCount ?? 0 : null;
    return <IntentLink
      key={tab.href}
      href={tab.href}
      aria-current={pathname === tab.href ? "page" : undefined}
      title={`${tab.group}${count != null ? ` · 自分の閲覧${count.toLocaleString("ja-JP")}回` : ""}`}
      onClick={() => setMobileOpen(false)}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0",
        pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{tab.label}</span>
      {count != null && count > 0 && <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true">{count.toLocaleString("ja-JP")}回</span>}
    </IntentLink>;
  };
  const renderGroups = (items: AdminNavigationItem[]) => ADMIN_NAV_GROUPS.map((group) => {
    const rows = items.filter((item) => item.group === group.label);
    return rows.length > 0 ? <div key={group.label} className="pb-2">
      <h2 className="px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">{group.label}</h2>
      {rows.map(renderItem)}
    </div> : null;
  });

  return (
    <>
      <div className="sticky top-0 z-30 flex h-screen w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-background p-1.5 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Adminメニューを開く"
          aria-controls="admin-navigation"
          aria-expanded={mobileOpen}
          title="Adminメニュー"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <IntentLink
          href="/dashboard"
          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={`AMD OSへ戻る / build ${BUILD_VERSION}`}
          aria-label="AMD OSへ戻る"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </IntentLink>
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/25 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Adminメニューを閉じる"
        />
      )}

      <aside
        id="admin-navigation"
        aria-label="Adminメニュー"
        className={cn(
          "fixed inset-y-0 left-0 z-50 h-screen w-64 shrink-0 space-y-0.5 overflow-y-auto border-r border-border bg-background p-2 shadow-xl transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:z-20 md:w-60 md:translate-x-0 md:shadow-none",
        )}
      >
        <div className="mb-1 flex items-center gap-1">
          <IntentLink
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={`AMD OSへ戻る / build ${BUILD_VERSION}`}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">AMD OS</span>
            <span className="font-mono text-[10px] font-normal text-muted-foreground">{BUILD_VERSION}</span>
          </IntentLink>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            aria-label="Adminメニューを閉じる"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-1 pb-2">
          <input type="search" aria-label="Adminページを検索" placeholder="ページを検索" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        {usageState.status === "loading" && <p role="status" className="px-3 py-1.5 text-[11px] text-muted-foreground">閲覧回数を確認中…</p>}
        {usageState.status === "error" && <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
          閲覧回数の取得に失敗。<button type="button" className="ml-1 underline" onClick={() => { setUsageState({ status: "loading" }); setRefreshKey((value) => value + 1); }}>再読込</button>
        </div>}
        {ranked ? <>
          {ranked.visited.length > 0 && <div className="pb-2">
            <h2 className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">閲覧が多い順</h2>
            {ranked.visited.map(renderItem)}
          </div>}
          {ranked.unvisited.length > 0 && <details key={query ? "search" : "all"} open={Boolean(query.trim()) || ranked.visited.length === 0} className="border-t border-border pt-1">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">閲覧履歴なし <span className="tabular-nums">{ranked.unvisited.length}</span></summary>
            {renderGroups(ranked.unvisited)}
          </details>}
        </> : renderGroups(selected)}
        {selected.length === 0 && <p role="status" className="px-3 py-3 text-xs text-muted-foreground">該当するページなし</p>}
      </aside>
    </>
  );
}
