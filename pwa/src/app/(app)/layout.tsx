import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/nav/AppShell";
import {
  getCurrentMemberAccess,
  memberHome,
  projectScopedPathAllowed,
} from "@/lib/project-workspace";
import { surfaceTitleForPath } from "@/lib/surface-catalog";

// SSR 時点で <title> を確定させる (= タブタイトル「変わらない」事故防止)。
// middleware が x-pathname header をセットしてくれている前提。
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const page = surfaceTitleForPath(pathname);
  return {
    title: page ? `${page} - AMD OS` : "AMD OS",
  };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const isMonthlyReportPrintRoute = /^\/project\/[^/]+\/report\/[^/]+\/print\/?$/.test(pathname);

  // 公開原稿は `(app)` 配下に置いていても、会員シェルやログインを通さない。
  // `/bzm` 本体は引き続きメンバー限定で、公開境界はこの subtree だけに固定する。
  if (pathname === "/bzm/public" || pathname.startsWith("/bzm/public/")) {
    return <>{children}</>;
  }

  const access = await getCurrentMemberAccess();
  if (!access) {
    redirect(`/auth/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
  }
  if (access.scope === "portfolio" && access.calendarStatus !== "connected") {
    redirect(
      `/auth/login?next=${encodeURIComponent(pathname || "/dashboard")}&error=calendar_required`,
    );
  }
  if (!projectScopedPathAllowed(access, pathname)) {
    redirect(memberHome(access));
  }

  // 印刷専用画面は認証・PJアクセス判定を通した上で、OSのナビや常駐UIを載せない。
  // PDFへ左メニュー・通知・チャットが混ざらないよう、CSSで隠すのではなくシェル自体を外す。
  if (isMonthlyReportPrintRoute) {
    return <>{children}</>;
  }

  return (
    <AppShell
      userCodeName={access.displayName}
      isAdmin={access.isAdmin}
      memberId={access.memberId}
      accessScope={access.scope}
      projectNavItems={access.projects}
    >
      {children}
    </AppShell>
  );
}
