"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Menu, X } from "lucide-react";
import { BUILD_VERSION } from "@/lib/build-info";
import { cn } from "@/lib/utils";
import { ADMIN_SURFACE_GROUPS, getSurfaceById } from "@/lib/surface-catalog";

const ADMIN_NAV_GROUPS = ADMIN_SURFACE_GROUPS.map((group) => ({
  label: group.label,
  items: group.surfaceIds.map((id) => {
    const surface = getSurfaceById(id);
    if (!surface?.primaryPath) throw new Error(`Admin surface is not navigable: ${id}`);
    return { label: surface.navLabel ?? surface.title, href: surface.primaryPath };
  }),
}));

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <Link
          href="/dashboard"
          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={`AMD OSへ戻る / build ${BUILD_VERSION}`}
          aria-label="AMD OSへ戻る"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
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
          "md:sticky md:top-0 md:z-20 md:w-48 md:translate-x-0 md:shadow-none",
        )}
      >
        <div className="mb-1 flex items-center gap-1">
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            title={`AMD OSへ戻る / build ${BUILD_VERSION}`}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">AMD OS</span>
            <span className="font-mono text-[10px] font-normal text-muted-foreground">{BUILD_VERSION}</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            aria-label="Adminメニューを閉じる"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label} className="pb-2">
            <h2 className="px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
              {group.label}
            </h2>
            {group.items.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0",
                  pathname === tab.href || pathname.startsWith(`${tab.href}/`)
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        ))}
      </aside>
    </>
  );
}
