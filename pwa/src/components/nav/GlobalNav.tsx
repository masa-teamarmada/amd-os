"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookMarked,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  CircleUserRound,
  Database,
  FileText,
  GraduationCap,
  Handshake,
  Landmark,
  LayoutDashboard,
  Map,
  Network,
  ScrollText,
  Shield,
  Sprout,
  User,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchActiveProjectsForNav,
  fetchAtlasInboxCount,
  type ActiveProjectNavItem,
} from "@/lib/supabase-data";
import { fetchVcInboxCount } from "@/lib/vc-data";
import { fetchSeedInboxCount } from "@/lib/seeds-data";
import { BUILD_VERSION } from "@/lib/build-info";

interface GlobalNavProps {
  userCodeName?: string;
  isAdmin?: boolean;
  memberId?: string | null;
}

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  title?: string;
  badge?: number;
  adminOnly?: boolean;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  adminOnly?: boolean;
  items: NavItem[];
};

function isActivePath(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function badgeText(count?: number) {
  if (!count || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

export function GlobalNav({
  userCodeName,
  isAdmin = false,
  memberId = null,
}: GlobalNavProps) {
  const pathname = usePathname();
  const [atlasInboxCount, setAtlasInboxCount] = useState(0);
  const [vcInboxCount, setVcInboxCount] = useState(0);
  const [seedInboxCount, setSeedInboxCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [activeProjects, setActiveProjects] = useState<ActiveProjectNavItem[]>(
    [],
  );
  const [activeProjectsStatus, setActiveProjectsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    let cancelled = false;

    fetchActiveProjectsForNav()
      .then((projects) => {
        if (cancelled) return;
        setActiveProjects(projects);
        setActiveProjectsStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setActiveProjectsStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Inboxバッジ: 60秒ポーリング + 背景タブでは停止 (= 2026-05-28 egress 削減)。
    const load = () => {
      fetchAtlasInboxCount()
        .then(setAtlasInboxCount)
        .catch(() => setAtlasInboxCount(0));
      fetchVcInboxCount()
        .then(setVcInboxCount)
        .catch(() => setVcInboxCount(0));
      fetchSeedInboxCount()
        .then(setSeedInboxCount)
        .catch(() => setSeedInboxCount(0));

      if (isAdmin) {
        import("@/lib/supabase/client")
          .then(async ({ createClient }) => {
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
            setNotificationCount(
              (l2Res.count ?? 0) + (mtgRes.count ?? 0) + (appRes.count ?? 0),
            );
          })
          .catch(() => setNotificationCount(0));
      } else {
        setNotificationCount(0);
      }
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(load, 60000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
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
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isAdmin]);

  const groups = useMemo<NavGroup[]>(
    () => [
      {
        label: "動かす",
        items: [
          {
            label: "ボード",
            href: "/dashboard",
            icon: LayoutDashboard,
            title: "ダッシュボード",
            exact: true,
          },
          {
            label: "AMD Protocol",
            href: "/admin/protocols",
            icon: ScrollText,
            title: "経営判断の構造化記録",
          },
          {
            label: "Atlas",
            href: "/atlas",
            icon: Database,
            badge: atlasInboxCount,
          },
          {
            label: "Knowledge",
            href: "/knowledge-map",
            icon: Network,
            title: "AMD のノウハウ地図",
          },
        ],
      },
      {
        label: "探索",
        items: [
          { label: "Scholar", href: "/scholar", icon: GraduationCap },
          { label: "Venture Map", href: "/venture-map", icon: Map },
          { label: "研究機関", href: "/institutions", icon: Building2 },
          {
            label: "Seeds",
            href: "/seeds",
            icon: Sprout,
            badge: seedInboxCount,
          },
          {
            label: "PoC",
            href: "/poc",
            icon: Handshake,
          },
          {
            label: "VC",
            href: "/vcs",
            icon: CircleDollarSign,
            badge: vcInboxCount,
          },
        ],
      },
      {
        label: "自分",
        items: [
          { label: "マイページ", href: "/mypage", icon: User },
          {
            label: "通知",
            href: "/notifications",
            icon: Bell,
            badge: notificationCount,
            adminOnly: true,
          },
          { label: "立替", href: "/reimburse", icon: WalletCards },
        ],
      },
      {
        label: "Admin",
        adminOnly: true,
        items: [
          {
            label: "Admin",
            href: "/admin/projects",
            icon: Shield,
            exact: true,
          },
          {
            label: "Management",
            href: "/management-score",
            icon: ChartNoAxesCombined,
          },
          { label: "設計書", href: "/spec", icon: FileText },
          {
            label: "日本文化",
            href: "/admin/japanese-culture-map",
            icon: Landmark,
          },
        ],
      },
      {
        label: "資料",
        items: [
          { label: "教科書", href: "/bzm", icon: BookMarked },
          { label: "マニュアル", href: "/manual", icon: BookOpen },
        ],
      },
    ],
    [atlasInboxCount, notificationCount, seedInboxCount, vcInboxCount],
  );

  const visibleGroups = groups
    .filter((group) => !group.adminOnly || isAdmin)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || isAdmin),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="sticky top-0 z-50 flex h-screen w-[76px] shrink-0 flex-col border-r border-border/60 bg-background/95 px-2 py-3 shadow-[1px_0_0_rgba(0,0,0,0.02)] backdrop-blur lg:w-64 lg:px-4">
      <Link
        href="/dashboard"
        className="mb-2 flex h-10 shrink-0 items-center justify-center gap-3 rounded-md px-2 text-foreground transition-colors hover:bg-muted lg:justify-start"
        title={`AMD OS / build ${BUILD_VERSION}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/amd-logo.png" alt="AMD" className="h-7 w-7 shrink-0" />
        <div className="hidden min-w-0 flex-col leading-tight lg:flex">
          <span className="truncate text-sm font-semibold">AMD OS</span>
          <span className="font-mono text-[10px] font-normal text-muted-foreground/70">
            {BUILD_VERSION}
          </span>
        </div>
      </Link>

      <nav
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Primary navigation"
      >
        {visibleGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <div className="hidden px-3 pb-0.5 text-[11px] font-semibold text-muted-foreground/65 lg:block">
              {group.label}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActivePath(pathname, item)}
                activeProjects={activeProjects}
                activeProjectsStatus={activeProjectsStatus}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-2 shrink-0 border-t border-border/60 pt-2">
        {userCodeName && (
          <Link
            href={
              memberId
                ? `/mypage?memberId=${encodeURIComponent(memberId)}`
                : "/mypage"
            }
            className="flex h-9 items-center justify-center gap-3 rounded-md border border-border bg-background px-2 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground lg:justify-start lg:px-3"
            title={userCodeName}
          >
            <CircleUserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden min-w-0 truncate lg:inline">
              {userCodeName}
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  activeProjects,
  activeProjectsStatus,
}: {
  item: NavItem;
  active: boolean;
  activeProjects: ActiveProjectNavItem[];
  activeProjectsStatus: "loading" | "ready" | "error";
}) {
  if (item.href === "/dashboard") {
    return (
      <BoardNavLink
        item={item}
        active={active}
        activeProjects={activeProjects}
        activeProjectsStatus={activeProjectsStatus}
      />
    );
  }

  const Icon = item.icon;
  const count = badgeText(item.badge);
  const tooltip = item.title ? `${item.label} - ${item.title}` : item.label;

  return (
    <Link
      href={item.href}
      title={tooltip}
      className={cn(
        "relative flex h-8 items-center justify-center gap-3 rounded-md px-2 text-sm font-medium transition-colors lg:justify-start lg:px-3",
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden min-w-0 flex-1 truncate lg:inline">
        {item.label}
      </span>
      {count && (
        <span
          className={cn(
            "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold leading-none text-white lg:static lg:ml-auto",
            active && "bg-white/20 text-white",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function BoardNavLink({
  item,
  active,
  activeProjects,
  activeProjectsStatus,
}: {
  item: NavItem;
  active: boolean;
  activeProjects: ActiveProjectNavItem[];
  activeProjectsStatus: "loading" | "ready" | "error";
}) {
  const [open, setOpen] = useState(false);
  const Icon = item.icon;
  const tooltip = item.title ? `${item.label} - ${item.title}` : item.label;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (
          !(nextTarget instanceof Node) ||
          !event.currentTarget.contains(nextTarget)
        ) {
          setOpen(false);
        }
      }}
    >
      <Link
        href={item.href}
        title={tooltip}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "relative flex h-8 items-center justify-center gap-3 rounded-md px-2 text-sm font-medium transition-colors lg:justify-start lg:px-3",
          active
            ? "bg-blue-600 text-white shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden min-w-0 flex-1 truncate lg:inline">
          {item.label}
        </span>
      </Link>

      <div
        className={cn(
          "absolute left-full top-0 z-[60] ml-2 w-[calc(100vw-96px)] max-w-72 rounded-lg border border-border/80 bg-popover p-2 text-popover-foreground shadow-lg transition-[opacity,transform,visibility] duration-150",
          open
            ? "visible translate-x-0 opacity-100"
            : "pointer-events-none invisible -translate-x-1 opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <span className="text-xs font-semibold text-foreground">
            アクティブPJ
          </span>
          {activeProjectsStatus === "ready" && (
            <span className="text-[11px] text-muted-foreground">
              {activeProjects.length}件
            </span>
          )}
        </div>

        {activeProjectsStatus === "loading" && (
          <p className="px-2 py-3 text-xs text-muted-foreground">読み込み中…</p>
        )}
        {activeProjectsStatus === "error" && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            PJ一覧を読み込めませんでした
          </p>
        )}
        {activeProjectsStatus === "ready" && activeProjects.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            アクティブなPJはありません
          </p>
        )}
        {activeProjectsStatus === "ready" && activeProjects.length > 0 && (
          <div className="max-h-[calc(100vh-40px)] space-y-0.5 overflow-y-auto pr-0.5">
            {activeProjects.map((project) => (
              <Link
                key={project.projectId}
                href={`/project/${encodeURIComponent(project.projectId)}/cockpit`}
                prefetch={false}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
              >
                <span className="min-w-0 flex-1 truncate">
                  {project.projectName}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {project.projectId}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
