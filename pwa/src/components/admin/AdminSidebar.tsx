"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { label: "Projects", href: "/admin/projects" },
  { label: "Members", href: "/admin/members" },
  { label: "Company", href: "/admin/company" },
  { label: "契約", href: "/admin/contracts" },
  { label: "週次活動", href: "/admin/weekly" },
  { label: "Protocols", href: "/admin/protocols" },
  { label: "LLM Context", href: "/admin/contexts" },
  { label: "裏wiki", href: "/admin/private-wiki" },
  { label: "つくよみ", href: "/admin/tsukuyomi" },
  { label: "📝 LLM プロンプト", href: "/admin/prompts" },
  { label: "Billing", href: "/admin/billing" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Finance", href: "/admin/finance" },
  { label: "📄 知財 / IP", href: "/admin/ip" },
  { label: "Settings", href: "/admin/settings" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 border-r border-border shrink-0 p-2 space-y-0.5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
        Admin
      </h2>
      {ADMIN_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "block text-sm px-3 py-1.5 rounded-md transition-colors",
            pathname === tab.href
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </aside>
  );
}
