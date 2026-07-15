"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BUILD_VERSION } from "@/lib/build-info";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { label: "Projects", href: "/admin/projects" },
  { label: "Members", href: "/admin/members" },
  { label: "Company", href: "/admin/company" },
  { label: "Management", href: "/management-score" },
  { label: "日本文化", href: "/admin/japanese-culture-map" },
  { label: "契約", href: "/admin/contracts" },
  { label: "🏛 株主・ガバナンス", href: "/admin/governance" },
  { label: "🛰 Coverage Scanner", href: "/admin/coverage-gaps" },
  { label: "週次活動", href: "/admin/weekly" },
  { label: "Protocols", href: "/admin/protocols" },
  { label: "LLM Context", href: "/admin/contexts" },
  { label: "経営ノウハウ", href: "/admin/management-knowledge" },
  { label: "裏wiki", href: "/admin/private-wiki" },
  { label: "つくよみ", href: "/admin/tsukuyomi" },
  { label: "📝 LLM プロンプト", href: "/admin/prompts" },
  { label: "請求書発行", href: "/admin/invoices" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "月初合意", href: "/admin/monthly-work-agreements" },
  { label: "シーズン予実", href: "/admin/season-pl" },
  { label: "MS一覧", href: "/admin/ms-overview" },
  { label: "Finance", href: "/admin/finance" },
  { label: "📄 知財 / IP", href: "/admin/ip" },
  { label: "Settings", href: "/admin/settings" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen w-48 shrink-0 space-y-0.5 overflow-y-auto border-r border-border bg-background p-2">
      <Link
        href="/dashboard"
        className="mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        title={`AMD OSへ戻る / build ${BUILD_VERSION}`}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">AMD OS</span>
        <span className="font-mono text-[10px] font-normal text-muted-foreground">{BUILD_VERSION}</span>
      </Link>
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
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </aside>
  );
}
