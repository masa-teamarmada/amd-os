"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  loadModelSections,
  type ModelSectionNavItem,
} from "@/lib/model-sections-client";
import {
  Bell,
  BookMarked,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  ContactRound,
  Database,
  FileText,
  FlaskConical,
  FunctionSquare,
  GraduationCap,
  Handshake,
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
import { isActionableAppNotification } from "@/lib/notification-priority";

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
            const [l2Res, appRes] = await Promise.all([
              supabase
                .from("l2_notifications")
                .select("notification_id", { count: "exact", head: true })
                .eq("attention_state", "approved")
                .eq("requires_masa_decision", true)
                .is("read_at", null),
              supabase
                .from("app_notifications")
                .select("id,kind,title,body,source,meta,attention_state,attention_type")
                .is("read_at", null)
                .is("dismissed_at", null)
                .limit(200),
            ]);
            setNotificationCount(
              (l2Res.count ?? 0) + (appRes.data ?? []).filter(isActionableAppNotification).length,
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
        label: "研究ポートフォリオ",
        items: [
          {
            label: "ホーム",
            href: "/dashboard",
            icon: LayoutDashboard,
            title: "研究機関・シーズ・PJを横断する優先キュー",
            exact: true,
          },
          {
            label: "研究機関",
            href: "/institutions",
            icon: Building2,
            title: "契約有無に依存しない研究機関カタログ",
          },
          {
            label: "シーズ",
            href: "/seeds",
            icon: Sprout,
            title: "事業化候補の母集団",
            badge: seedInboxCount,
          },
          {
            label: "PJ運用",
            href: "/dashboard#pj-operations",
            icon: FlaskConical,
            title: "研究機関・シーズが契約成立後に生まれる運用レイヤー",
          },
        ],
      },
      {
        label: "動かす",
        items: [
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
            label: "Materials",
            href: "/knowledge-map",
            icon: Network,
            title: "元素・鉱物・樹脂を供給と用途まで辿る",
          },
          {
            label: "名刺",
            href: "/business-cards",
            icon: ContactRound,
            title: "撮影OCRとPJ knowledge連携",
          },
        ],
      },
      {
        label: "探索",
        items: [
          { label: "Scholar", href: "/scholar", icon: GraduationCap },
          { label: "Venture Map", href: "/venture-map", icon: Map },
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
            href: "/admin/schedule",
            icon: Shield,
            exact: true,
          },
          {
            label: "Management",
            href: "/management-score",
            icon: ChartNoAxesCombined,
          },
          { label: "設計書", href: "/spec", icon: FileText },
        ],
      },
      {
        label: "資料",
        items: [
          { label: "モデル", href: "/model", icon: FunctionSquare, adminOnly: true },
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

  // まさ 2026-08-25「左ナビの『モデル』にマウスオーバーしたら、セクションリストが出てくるように
  // してほしい。『ホーム』にマウスオーバーしたときにPJリストが出るみたいに」。
  if (item.href === "/model") {
    return <ModelNavLink item={item} active={active} />;
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

/**
 * 左ナビの「モデル」— マウスを載せるとモデルページの節の一覧が出る。
 *
 * まさ 2026-08-25「左ナビの『モデル』にマウスオーバーしたら、セクションリストが出てくるように
 * してほしい。『ホーム』にマウスオーバーしたときにPJリストが出るみたいに」。
 *
 * 節の一覧は正本 md の見出しから作っている（`/api/model/sections`）ので、正本に節が増えれば
 * ここは何もしなくても追随する。**参照系データ**なので専用のクライアントキャッシュを通し、
 * 開くたびにネットワーク往復を払わない。
 */
function ModelNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [sections, setSections] = useState<ModelSectionNavItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = item.icon;

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(320, Math.max(200, window.innerWidth - 96));
    const gutter = 8;
    const left = Math.min(
      rect.right + gutter,
      Math.max(gutter, window.innerWidth - width - gutter),
    );
    const top = Math.max(gutter, Math.min(rect.top, window.innerHeight - 48));
    const maxHeight = Math.max(120, window.innerHeight - top - gutter);
    setPosition({ top, left, width, maxHeight });
  }, []);

  const loadSections = useCallback(() => {
    if (status === "ready" || status === "loading") return;
    setStatus("loading");
    loadModelSections()
      .then((list) => {
        setSections(list);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [status]);

  const openFlyout = useCallback(() => {
    clearCloseTimer();
    updatePosition();
    loadSections();
    setOpen(true);
  }, [clearCloseTimer, loadSections, updatePosition]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) return undefined;
    const onChange = () => updatePosition();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open, updatePosition]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const flyout =
    open && position
      ? createPortal(
          <div
            ref={flyoutRef}
            data-testid="model-nav-flyout"
            className="fixed z-[60] flex flex-col overflow-hidden rounded-lg border border-border/80 bg-popover p-2 text-popover-foreground shadow-lg"
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            onMouseEnter={openFlyout}
            onMouseLeave={scheduleClose}
          >
            <div className="flex items-center justify-between gap-3 px-2 py-1.5">
              <span className="text-xs font-semibold text-foreground">モデルの節</span>
              {status === "ready" && (
                <span className="text-[11px] text-muted-foreground">{sections.length}件</span>
              )}
            </div>
            {status === "loading" && (
              <p className="px-2 py-3 text-xs text-muted-foreground">読み込み中…</p>
            )}
            {status === "error" && (
              <p className="px-2 py-3 text-xs text-muted-foreground">節の一覧を読み込めませんでした</p>
            )}
            {status === "ready" && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Link
                  href="/model#current-formulas"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  現行モデルの式
                </Link>
                {sections.map((section) => (
                  <Link
                    key={section.id}
                    href={`/model#${section.id}`}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    <span className="min-w-0 truncate">{section.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={anchorRef}
      className="relative"
      onMouseEnter={openFlyout}
      onMouseLeave={scheduleClose}
      onFocus={openFlyout}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (
          !(next instanceof Node) ||
          (!event.currentTarget.contains(next) && !flyoutRef.current?.contains(next))
        ) {
          scheduleClose();
        }
      }}
    >
      <Link
        href={item.href}
        title={item.label}
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
        <span className="hidden min-w-0 flex-1 truncate lg:inline">{item.label}</span>
      </Link>
      {flyout}
    </div>
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
  const [flyoutPosition, setFlyoutPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectFlyoutPosition, setProjectFlyoutPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const projectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const projectFlyoutRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = item.icon;
  const tooltip = item.title ? `${item.label} - ${item.title}` : item.label;

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const updateFlyoutPosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.min(288, Math.max(180, window.innerWidth - 96));
    const gutter = 8;
    const left = Math.min(
      rect.right + gutter,
      Math.max(gutter, window.innerWidth - width - gutter),
    );
    const top = Math.max(gutter, Math.min(rect.top, window.innerHeight - 48));
    const maxHeight = Math.max(120, window.innerHeight - top - gutter);

    setFlyoutPosition({ top, left, width, maxHeight });
  }, []);

  const updateProjectFlyoutPosition = useCallback((trigger?: HTMLElement | null) => {
    const rect = (trigger ?? projectTriggerRef.current)?.getBoundingClientRect();
    if (!rect) return;

    const gutter = 8;
    const width = Math.min(232, Math.max(196, window.innerWidth - gutter * 2));
    const rightSideLeft = rect.right + gutter;
    const left =
      rightSideLeft + width <= window.innerWidth - gutter
        ? rightSideLeft
        : Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter));
    const top = Math.max(gutter, Math.min(rect.top, window.innerHeight - 128));

    setProjectFlyoutPosition({ top, left, width });
  }, []);

  const openFlyout = useCallback(() => {
    clearCloseTimer();
    updateFlyoutPosition();
    setOpen(true);
  }, [clearCloseTimer, updateFlyoutPosition]);

  const openProjectFlyout = useCallback(
    (projectId: string, trigger: HTMLButtonElement) => {
      clearCloseTimer();
      projectTriggerRef.current = trigger;
      updateProjectFlyoutPosition(trigger);
      setActiveProjectId(projectId);
    },
    [clearCloseTimer, updateProjectFlyoutPosition],
  );

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setActiveProjectId(null);
      setProjectFlyoutPosition(null);
    }, 120);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) return undefined;

    const handleViewportChange = () => {
      updateFlyoutPosition();
      if (activeProjectId) updateProjectFlyoutPosition();
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [activeProjectId, open, updateFlyoutPosition, updateProjectFlyoutPosition]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  const activeProject = activeProjectId
    ? activeProjects.find((project) => project.projectId === activeProjectId) ?? null
    : null;

  const flyout =
    open && flyoutPosition
      ? createPortal(
          <div
            ref={flyoutRef}
            data-testid="board-nav-flyout"
            className="fixed z-[60] flex flex-col overflow-hidden rounded-lg border border-border/80 bg-popover p-2 text-popover-foreground shadow-lg"
            style={{
              left: flyoutPosition.left,
              top: flyoutPosition.top,
              width: flyoutPosition.width,
              maxHeight: flyoutPosition.maxHeight,
            }}
            onMouseEnter={openFlyout}
            onMouseLeave={scheduleClose}
            onFocus={openFlyout}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget;
              if (
                !(nextTarget instanceof Node) ||
                (!anchorRef.current?.contains(nextTarget) &&
                  !flyoutRef.current?.contains(nextTarget))
              ) {
                scheduleClose();
              }
            }}
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
              <p className="px-2 py-3 text-xs text-muted-foreground">
                読み込み中…
              </p>
            )}
            {activeProjectsStatus === "error" && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                PJ一覧を読み込めませんでした
              </p>
            )}
            {activeProjectsStatus === "ready" &&
              activeProjects.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  アクティブなPJはありません
                </p>
              )}
            {activeProjectsStatus === "ready" && activeProjects.length > 0 && (
              <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
                {activeProjects.map((project) => (
                  <button
                    type="button"
                    key={project.projectId}
                    aria-haspopup="menu"
                    aria-controls={`board-nav-project-submenu-${project.projectId}`}
                    aria-expanded={activeProjectId === project.projectId}
                    data-testid="board-nav-project-trigger"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      activeProjectId === project.projectId && "bg-muted",
                    )}
                    onMouseEnter={(event) =>
                      openProjectFlyout(project.projectId, event.currentTarget)
                    }
                    onFocus={(event) =>
                      openProjectFlyout(project.projectId, event.currentTarget)
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {project.projectName}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {project.projectId}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  const projectFlyout =
    open && activeProject && projectFlyoutPosition
      ? createPortal(
          <div
            ref={projectFlyoutRef}
            id={`board-nav-project-submenu-${activeProject.projectId}`}
            data-testid="board-nav-project-submenu"
            role="menu"
            aria-label={`${activeProject.projectName} の移動先`}
            className="fixed z-[61] overflow-hidden rounded-lg border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-lg"
            style={{
              left: projectFlyoutPosition.left,
              top: projectFlyoutPosition.top,
              width: projectFlyoutPosition.width,
            }}
            onMouseEnter={openFlyout}
            onMouseLeave={scheduleClose}
            onFocus={openFlyout}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget;
              if (
                !(nextTarget instanceof Node) ||
                (!anchorRef.current?.contains(nextTarget) &&
                  !flyoutRef.current?.contains(nextTarget) &&
                  !projectFlyoutRef.current?.contains(nextTarget))
              ) {
                scheduleClose();
              }
            }}
          >
            <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
              {activeProject.projectName}
            </p>
            <Link
              href={`/project/${encodeURIComponent(activeProject.projectId)}/cockpit`}
              prefetch={false}
              role="menuitem"
              data-testid="board-nav-project-cockpit"
              className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              コックピット
            </Link>
            <Link
              href={`/project/${encodeURIComponent(activeProject.projectId)}/workspace`}
              prefetch={false}
              role="menuitem"
              data-testid="board-nav-project-workspace"
              className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Network className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              ワークスペース
            </Link>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={anchorRef}
      className="relative"
      onMouseEnter={openFlyout}
      onMouseLeave={scheduleClose}
      onFocus={openFlyout}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (
          !(nextTarget instanceof Node) ||
          (!event.currentTarget.contains(nextTarget) &&
            !flyoutRef.current?.contains(nextTarget) &&
            !projectFlyoutRef.current?.contains(nextTarget))
        ) {
          scheduleClose();
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
      {flyout}
      {projectFlyout}
    </div>
  );
}
