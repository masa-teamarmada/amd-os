"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { fetchAtlasInboxCount } from "@/lib/supabase-data";
import { fetchVcInboxCount } from "@/lib/vc-data";
import { fetchSeedInboxCount } from "@/lib/seeds-data";
import { BUILD_VERSION } from "@/lib/build-info";

interface GlobalNavProps {
  userCodeName?: string;
  isAdmin?: boolean;
  memberId?: string | null;
}

export function GlobalNav({ userCodeName, isAdmin = false, memberId = null }: GlobalNavProps) {
  const pathname = usePathname();
  const [inboxCount, setInboxCount] = useState(0);
  const [vcInboxCount, setVcInboxCount] = useState(0);
  const [seedInboxCount, setSeedInboxCount] = useState(0);

  useEffect(() => {
    // Inboxバッジ: 60秒ポーリング + 背景タブでは停止 (= 2026-05-28 egress 削減)。
    const load = () => {
      fetchAtlasInboxCount().then(setInboxCount);
      fetchVcInboxCount().then(setVcInboxCount);
      fetchSeedInboxCount().then(setSeedInboxCount);
    };
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(load, 60000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        load();
        start();
      }
    };
    load();
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex h-11 items-center px-4 gap-4">
        {/* Left: Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold text-sm shrink-0"
          title={`build ${BUILD_VERSION}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/amd-logo.png" alt="AMD" className="h-7 w-7" />
          <div className="flex flex-col leading-tight">
            <span>AMD OS</span>
            <span className="text-[9px] font-mono font-normal text-muted-foreground/70">{BUILD_VERSION}</span>
          </div>
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

        {/* AMD Protocol (= Atlas の左に復活、2026-05-11 まさ要望)
            D-1「AMDプロトコル」(経営判断の構造化記録) を一覧/承認するページ /admin/protocols。
            まさが「これは確定プロトコル」と承認すると status=confirmed に格上げ。 */}
        <Link
          href="/admin/protocols"
          className={cn(
            "text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/admin/protocols")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="AMD プロトコル — 経営判断の構造化記録 (D-1)"
        >
          AMD Protocol
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

        {/* Scholar (μ_A 学術根拠) */}
        <Link
          href="/scholar"
          className={cn(
            "text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/scholar")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Scholar
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

        {/* 研究機関 (ERS / 苗床レイヤー) — Venture Map (個体) の隣に機関 (苗床) を並べる */}
        <Link
          href="/institutions"
          className={cn(
            "text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/institutions")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="研究機関 ERS — エコシステム整備度 (苗床レイヤー)"
        >
          研究機関
        </Link>

        <Link
          href="/management-score"
          className={cn(
            "text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/management-score")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Management
        </Link>

        {/* Seeds + 受信箱バッジ */}
        <Link
          href="/seeds"
          className={cn(
            "relative text-xs px-2.5 py-1 rounded-md transition-colors",
            pathname.startsWith("/seeds")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Seeds
          {seedInboxCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-sky-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {seedInboxCount > 99 ? "99+" : seedInboxCount}
            </span>
          )}
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

        {/* Right: 通知 + Admin + User
            通知 + Admin タブは isAdmin (= members.is_admin = TRUE) のみ表示。
            まさ要望 2026-05-11: 一般メンバーには通知バッジを見せない。 */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          {isAdmin && <NotificationBell />}
          {isAdmin && (
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
          )}
          <Link
            href="/reimburse"
            className="text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md transition-colors"
          >
            立替
          </Link>
          <Link
            href="/bzm/public"
            className={cn(
              "px-2.5 py-1 rounded-md transition-colors",
              pathname.startsWith("/bzm")
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="教科書 — Before Zero の現場から BZM 理論と実践ツールへ"
          >
            📚 教科書
          </Link>
          {isAdmin && (
            <Link
              href="/spec"
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                pathname.startsWith("/spec")
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="設計書 — 確定した実装仕様 (画面/API/cron/DB/判断ロジック)。admin 限定"
            >
              ⚙ 設計書
            </Link>
          )}
          <Link
            href="/manual"
            className={cn(
              "px-2.5 py-1 rounded-md transition-colors",
              pathname.startsWith("/manual")
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="AMD OS マニュアル — 使い方・データ裏側・過去判断・開発手順"
          >
            📖 マニュアル
          </Link>
          <Link
            href="/japanese-culture-map"
            className={cn(
              "px-2.5 py-1 rounded-md transition-colors",
              pathname.startsWith("/japanese-culture-map")
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="日本文化マップ — 日本の文化コンテンツをマインドマップ / 日本地図で探索"
          >
            🇯🇵
          </Link>
          {userCodeName && (
            <Link
              href={memberId ? `/mypage?memberId=${encodeURIComponent(memberId)}` : "/mypage"}
              className="text-muted-foreground border border-border rounded-full px-2.5 py-0.5 hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              {userCodeName}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// 通知ベル (= /notifications へのリンク + 未読バッジ)
// l2_notifications + meeting_notifications + app_notifications の未読合算。
// 60 秒 polling + 背景タブで停止 (= 2026-05-28 egress 削減)。
function NotificationBell() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const [l2Res, mtgRes, appRes] = await Promise.all([
          supabase
            .from("l2_notifications")
            .select("notification_id", { count: "exact", head: true })
            .is("read_at", null),
          supabase
            .from("meeting_notifications")
            .select("meeting_id", { count: "exact", head: true })
            .is("read_at", null),
          supabase
            .from("app_notifications")
            .select("id", { count: "exact", head: true })
            .is("read_at", null)
            .is("dismissed_at", null),
        ]);
        const total = (l2Res.count ?? 0) + (mtgRes.count ?? 0) + (appRes.count ?? 0);
        setUnread(total);
      } catch {
        // ignore
      }
    };
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(load, 60000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        load();
        start();
      }
    };
    load();
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
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
