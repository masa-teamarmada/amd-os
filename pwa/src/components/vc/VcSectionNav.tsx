"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { path: "", label: "VC一覧" },
  { path: "/investments", label: "投資履歴" },
  { path: "/inbox", label: "ニュース受信箱" },
] as const;

export function VcSectionNav() {
  const pathname = usePathname();
  const base = pathname.startsWith("/hud/") ? "/hud/vcs" : "/vcs";

  return (
    <nav aria-label="VC台帳の表示切替" className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-border/70">
      {ITEMS.map((item) => {
        const href = `${base}${item.path}`;
        const active = item.path === "" ? pathname === base : pathname === href;
        return (
          <Link
            key={item.path || "list"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
              active
                ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-cyan-300"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
