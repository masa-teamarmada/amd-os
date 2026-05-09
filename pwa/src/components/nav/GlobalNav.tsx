"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { fetchAtlasInboxCount } from "@/lib/supabase-data";
import { fetchVcInboxCount } from "@/lib/vc-data";

interface GlobalNavProps {
  userCodeName?: string;
}

export function GlobalNav({ userCodeName }: GlobalNavProps) {
  const pathname = usePathname();
  const [inboxCount, setInboxCount] = useState(0);
  const [vcInboxCount, setVcInboxCount] = useState(0);

  useEffect(() => {
    // Inboxバッジ: 15秒ごとにポーリング
    const load = () => {
      fetchAtlasInboxCount().then(setInboxCount);
      fetchVcInboxCount().then(setVcInboxCount);
    };
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex h-11 items-center px-4 gap-4">
        {/* Left: Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold text-sm shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/amd-logo.png" alt="AMD" className="h-7 w-7" />
          <span>AMD OS</span>
        </Link>

        {/* Dashboard link */}
        <Link
          href="/dashboard"
          className={cn(
            "text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname === "/dashboard"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          ダッシュボードに戻る
        </Link>

        {/* Atlas + Inbox badge */}
        <Link
          href="/atlas"
          className={cn(
            "relative text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/atlas")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Atlas
          {inboxCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {inboxCount > 99 ? "99+" : inboxCount}
            </span>
          )}
        </Link>

        {/* Venture Map */}
        <Link
          href="/venture-map"
          className={cn(
            "text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/venture-map")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Venture Map
        </Link>

        {/* Seeds */}
        <Link
          href="/seeds"
          className={cn(
            "text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/seeds")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Seeds
        </Link>

        {/* VC + 受信箱バッジ */}
        <Link
          href="/vcs"
          className={cn(
            "relative text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/vcs")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          VC
          {vcInboxCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {vcInboxCount > 99 ? "99+" : vcInboxCount}
            </span>
          )}
        </Link>

        {/* マイページ */}
        <Link
          href="/mypage"
          className={cn(
            "text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/mypage")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          マイページ
        </Link>

        {/* Right: 通知 + Admin + Settings + User */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <NotificationBell />
          <Link
            href="/admin/projects"
            className={cn(
              "px-2.5 py-1 rounded-md transition-colors",
              pathname.startsWith("/admin")
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Admin
          </Link>
          <Link
            href="/reimburse"
            className="text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md transition-colors"
          >
            立替
          </Link>
          <Link
            href="/settings"
            className="text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md transition-colors"
          >
            設定
          </Link>
          {userCodeName && (
            <span className="text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
              {userCodeName}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

// 通知ベル (= /notifications へのリンク + 未読バッジ、15 秒 polling)
function NotificationBell() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const [l2Res, mtgRes] = await Promise.all([
          supabase
            .from("l2_notifications")
            .select("notification_id", { count: "exact", head: true })
            .is("notified_at", null),
          supabase
            .from("meeting_notifications")
            .select("meeting_id", { count: "exact", head: true })
            .is("notified_at", null),
        ]);
        const total = (l2Res.count ?? 0) + (mtgRes.count ?? 0);
        setUnread(total);
      } catch {
        // ignore
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const isActive = pathname.startsWith("/notifications");
  return (
    <Link
      href="/notifications"
      className={cn(
        "relative px-2.5 py-1 rounded-md transition-colors",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:text-foreground"
      )}
      aria-label={unread > 0 ? `通知 ${unread} 件` : "通知"}
      title={unread > 0 ? `未読 ${unread} 件` : "通知"}
    >
      <span>📬</span>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
