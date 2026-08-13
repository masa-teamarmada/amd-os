"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, hrefFor } from "@/lib/modules";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** PC: 左サイドナビ */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-[var(--line)] md:p-4">
      <div className="mb-6 px-2">
        <div className="text-lg font-semibold tracking-tight">きよOS</div>
        <div className="text-xs text-[var(--muted)]">personal operating system</div>
      </div>

      {MODULES.map((m) => {
        const href = hrefFor(m);
        const active = isActive(pathname, href);
        return (
          <Link
            key={m.slug || "home"}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-[var(--panel)] text-[var(--text)] ring-1 ring-[var(--line)]"
                : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
            }`}
          >
            <span aria-hidden>{m.icon}</span>
            <span>{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** スマホ: 下タブ */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur md:hidden">
      {MODULES.map((m) => {
        const href = hrefFor(m);
        const active = isActive(pathname, href);
        return (
          <Link
            key={m.slug || "home"}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
              active ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            <span className="text-base" aria-hidden>
              {m.icon}
            </span>
            <span>{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
