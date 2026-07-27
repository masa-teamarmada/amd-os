"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { MonthlyAgreementGateOverlay } from "@/components/monthly-agreement/MonthlyAgreementGateOverlay";
import { CriticalRealtimeNotify } from "@/components/notifications/CriticalRealtimeNotify";
import { TsukuyomiChatBridge } from "@/components/tsukuyomi/TsukuyomiChatBridge";
import type { MonthlyWorkAgreementBundle } from "@/lib/monthly-work-agreement-types";
import type { OsAccessScope, ProjectNavItem } from "@/lib/project-workspace-types";
import { GlobalNav } from "./GlobalNav";
import { PageTitleSetter } from "./PageTitleSetter";
import { ProjectWorkspaceNav } from "./ProjectWorkspaceNav";

type AppShellProps = {
  children: ReactNode;
  userCodeName: string;
  isAdmin: boolean;
  memberId: string | null;
  accessScope: OsAccessScope;
  projectNavItems: ProjectNavItem[];
};

function shouldSkipMonthlyAgreementGate(pathname: string) {
  return pathname.startsWith("/monthly-agreement") || pathname.startsWith("/hud") || pathname.startsWith("/native") || /^\/project\/[^/]+\/(?:workspace|weekly-control|navigation)(?:\/|$)/.test(pathname);
}

// 月初合意ゲートは (app)/layout.tsx の SSR では計算しない。
// buildMonthlyWorkAgreementBundle は project_members 起点で 10 テーブル超を複数波に分けて叩く重い集計で、
// 全 authenticated route の初回表示をブロックしていた (2026-07-17 パフォーマンス監査で特定)。
// payouts の agreement gate 修正 (BUGS.md 2026-06-23) と同じ方針で、mount 後に非同期取得してから overlay を出す。
function useMonthlyAgreementGateBundle(memberId: string | null, pathname: string) {
  const [bundle, setBundle] = useState<MonthlyWorkAgreementBundle | null>(null);
  const skip = shouldSkipMonthlyAgreementGate(pathname);

  useEffect(() => {
    // Route/member changes invalidate the previously fetched agreement snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBundle(null);
    if (!memberId || skip) return;
    let cancelled = false;
    fetch("/api/monthly-work-agreement")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const fetchedBundle = json?.ok ? (json.bundle as MonthlyWorkAgreementBundle) : null;
        if (!fetchedBundle) return;
        const requiresAgreement =
          fetchedBundle.tableReady &&
          fetchedBundle.snapshot.totals.projectCount > 0 &&
          (fetchedBundle.status === "pending" || fetchedBundle.status === "needs_reagreement");
        setBundle(requiresAgreement ? fetchedBundle : null);
      })
      .catch((err) => {
        console.warn("[monthly-agreement] failed to evaluate entry gate:", err);
      });
    return () => {
      cancelled = true;
    };
    // skip は pathname から導出される真偽値。/native 等の skip route で mount した後に
    // 非 skip route へ遷移するケースでも取得が起動するよう、依存に含める
    // (真偽値が変わらない限り同一ルート内の再遷移では再フェッチしない)。
  }, [memberId, skip]);

  return skip ? null : bundle;
}

export function AppShell({
  children,
  userCodeName,
  isAdmin,
  memberId,
  accessScope,
  projectNavItems,
}: AppShellProps) {
  const pathname = usePathname() ?? "";
  const isNativeShell = pathname.startsWith("/native");
  const isAdminRoute = pathname.startsWith("/admin");
  const isWorkspaceRoute = /^\/project\/[^/]+\/(?:workspace|weekly-control|navigation)(?:\/|$)/.test(pathname);
  const useEmbeddedShellOnly = pathname.startsWith("/hud") || isNativeShell || isWorkspaceRoute;
  const isProjectScope = accessScope === "project";
  const agreementGateBundle = useMonthlyAgreementGateBundle(isProjectScope ? null : memberId, pathname);

  if (isNativeShell) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <PageTitleSetter />
      {useEmbeddedShellOnly ? (
        <main className="flex-1">{children}</main>
      ) : (
        <div className="flex min-h-screen bg-background text-foreground">
          {isProjectScope ? (
            <ProjectWorkspaceNav userCodeName={userCodeName} projects={projectNavItems} />
          ) : isAdminRoute ? (
            <AdminSidebar />
          ) : (
            <GlobalNav
              userCodeName={userCodeName}
              isAdmin={isAdmin}
              memberId={memberId}
            />
          )}
          <main className={`min-w-0 flex-1 ${isProjectScope ? "pb-16 lg:pb-0" : ""}`}>{children}</main>
        </div>
      )}
      {agreementGateBundle && (
        <MonthlyAgreementGateOverlay bundle={agreementGateBundle} />
      )}
      {isAdmin && !isProjectScope && <CriticalRealtimeNotify />}
      {!isProjectScope && <TsukuyomiChatBridge />}
    </>
  );
}
