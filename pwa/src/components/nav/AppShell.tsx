"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { MonthlyAgreementGateOverlay } from "@/components/monthly-agreement/MonthlyAgreementGateOverlay";
import { CriticalRealtimeNotify } from "@/components/notifications/CriticalRealtimeNotify";
import { TsukuyomiChatBridge } from "@/components/tsukuyomi/TsukuyomiChatBridge";
import type { MonthlyWorkAgreementBundle } from "@/lib/monthly-work-agreement-types";
import { GlobalNav } from "./GlobalNav";
import { PageTitleSetter } from "./PageTitleSetter";

type AppShellProps = {
  children: ReactNode;
  userCodeName: string;
  isAdmin: boolean;
  memberId: string | null;
  agreementGateBundle: MonthlyWorkAgreementBundle | null;
};

export function AppShell({
  children,
  userCodeName,
  isAdmin,
  memberId,
  agreementGateBundle,
}: AppShellProps) {
  const pathname = usePathname() ?? "";
  const isNativeShell = pathname.startsWith("/native");
  const isAdminRoute = pathname.startsWith("/admin");
  const useEmbeddedShellOnly = pathname.startsWith("/hud") || isNativeShell;

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
          {isAdminRoute ? (
            <AdminSidebar />
          ) : (
            <GlobalNav
              userCodeName={userCodeName}
              isAdmin={isAdmin}
              memberId={memberId}
            />
          )}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      )}
      {agreementGateBundle && (
        <MonthlyAgreementGateOverlay bundle={agreementGateBundle} />
      )}
      {isAdmin && <CriticalRealtimeNotify />}
      <TsukuyomiChatBridge />
    </>
  );
}
