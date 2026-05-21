"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const hudLinks = [
  { href: "/hud/dashboard", label: "Dashboard" },
  { href: "/hud/atlas", label: "Atlas" },
  { href: "/hud/seeds", label: "Seeds" },
  { href: "/hud/vcs", label: "VC" },
  { href: "/hud/venture-map/amd-score/retrofit", label: "Score Retrofit" },
  { href: "/hud/notifications", label: "Notifications" },
];

export function HudShell({ children, title = "AMD OS HUD" }: { children: ReactNode; title?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.add("amd-hud-body");
    return () => document.body.classList.remove("amd-hud-body");
  }, []);

  return (
    <div className="min-h-screen bg-[#020714] text-cyan-50">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_42%),radial-gradient(circle_at_85%_16%,rgba(255,95,145,0.12),transparent_24%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,rgba(57,217,255,0.055)_0,transparent_1px,transparent_13px),linear-gradient(90deg,rgba(57,217,255,0.035)_0,transparent_1px,transparent_127px)] bg-[size:100%_14px,128px_100%]" />
      <div className="relative z-10">
        <header className="sticky top-0 z-40 border-b border-cyan-300/20 bg-[#03101f]/95 backdrop-blur-xl">
          <div className="flex min-h-14 items-center gap-4 px-5">
            <Link href="/hud/dashboard" className="group min-w-[150px]">
              <div className="text-[10px] font-black tracking-[0.22em] text-cyan-200/70">TEAM ARMADA</div>
              <div className="truncate font-mono text-lg font-black leading-none text-white drop-shadow-[0_0_12px_rgba(103,232,249,.65)]">
                {title}
              </div>
            </Link>
            <nav className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto py-2">
              {hudLinks.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`whitespace-nowrap border px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-[0.08em] transition ${
                      active
                        ? "border-cyan-200 bg-cyan-300/20 text-white shadow-[0_0_18px_rgba(34,211,238,.28)]"
                        : "border-cyan-300/25 bg-slate-950/45 text-cyan-100/70 hover:border-cyan-200/65 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Link
                href="/dashboard"
                className="whitespace-nowrap border border-rose-300/35 bg-rose-950/30 px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-rose-100/80 transition hover:border-rose-200/70 hover:text-white"
              >
                Classic
              </Link>
            </nav>
          </div>
        </header>
        <main className="amd-hud-page-skin relative min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}
