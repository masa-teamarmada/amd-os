import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/nav/AppShell";
import {
  getCurrentMemberAccess,
  memberHome,
  projectScopedPathAllowed,
} from "@/lib/project-workspace";

// pathname → タブタイトル変換 (= PageTitleSetter と同じマッピングを SSR でも使う)
function pathToTitle(pathname: string): string | null {
  if (!pathname || pathname === "/") return null;
  if (pathname === "/dashboard") return "ダッシュボード";
  if (pathname === "/atlas") return "Atlas";
  if (pathname.startsWith("/atlas/map")) return "Atlas Map";
  if (pathname.startsWith("/atlas/inbox/submit")) return "Atlas Inbox 投稿";
  if (pathname.startsWith("/atlas/inbox")) return "Atlas Inbox";
  if (pathname.startsWith("/atlas/divergence")) return "Atlas Divergence";
  if (pathname.startsWith("/atlas/decisions")) return "Atlas Decisions";
  if (pathname.startsWith("/atlas/admin")) return "Atlas Admin";
  if (pathname === "/scholar") return "Scholar";
  if (pathname.startsWith("/venture-map/amd-score/retrofit"))
    return "AMD Score Retrofit";
  if (pathname.startsWith("/venture-map/amd-score")) return "AMD Score";
  if (pathname.startsWith("/venture-map/timeline-3d"))
    return "Venture Timeline 3D";
  if (pathname.startsWith("/venture-map/cyberspace"))
    return "Venture Cyberspace";
  if (pathname.startsWith("/venture-map/oscillator"))
    return "Venture Oscillator";
  if (pathname.startsWith("/venture-map/state-space"))
    return "Venture State Space";
  if (pathname.startsWith("/venture-map/su/")) return "SU Detail";
  if (pathname === "/venture-map") return "Venture Map";
  if (pathname.startsWith("/knowledge-map")) return "AMD Materials";
  if (pathname === "/bzm/map") return "BZM 理論マップ";
  if (pathname.startsWith("/bzm")) return "BZM 2.0";
  if (pathname.startsWith("/business-cards") || pathname.startsWith("/native/business-cards")) return "名刺";
  if (pathname.startsWith("/institutions/")) return "研究機関 ECR 詳細";
  if (pathname === "/institutions") return "研究機関 ECR";
  if (pathname.startsWith("/management-score")) return "Management Score";
  if (pathname === "/seeds") return "Seeds";
  if (pathname === "/poc") return "PoC案件化";
  if (pathname === "/vcs") return "VC";
  if (pathname === "/mypage") return "マイページ";
  if (pathname === "/monthly-agreement") return "月初合意";
  if (pathname === "/company") return "Company";
  if (pathname === "/notifications") return "通知";
  if (pathname === "/reimburse") return "立替";
  if (pathname === "/admin/projects") return "Admin PJ";
  if (pathname === "/admin/protocols") return "AMD Protocol";
  if (pathname === "/admin/company") return "Admin Company";
  if (pathname === "/admin/contracts") return "Admin 契約";
  if (pathname === "/admin/japanese-culture-map") return "日本文化マップ";
  if (pathname === "/admin/prompts") return "LLM プロンプト";
  if (pathname === "/admin/members") return "Admin メンバー";
  if (pathname === "/admin/access") return "Admin 外部アクセス";
  if (pathname === "/admin/invoices" || pathname === "/admin/billing") return "請求書発行";
  if (pathname === "/admin/payouts") return "Admin 報酬";
  if (pathname === "/admin/monthly-work-agreements") return "Admin 月初合意";
  if (pathname === "/admin/finance") return "Admin Finance";
  if (pathname === "/admin/schedule") return "運営カレンダー";
  if (pathname === "/admin/tsukuyomi") return "Admin つくよみ";
  if (pathname === "/admin/contexts") return "Admin Contexts";
  if (pathname === "/admin/settings") return "Admin 設定";
  if (pathname.startsWith("/admin")) return "Admin";
  if (/^\/project\/[^/]+\/weekly-control\/?$/.test(pathname)) return "PJ 週次管制";
  if (/^\/project\/[^/]+\/navigation\/?$/.test(pathname)) return "PJ管制ダッシュボード";
  if (/^\/project\/[^/]+\/workspace\/?$/.test(pathname)) return "PJ ダッシュボード";
  if (pathname === "/my-projects") return "参加PJ";
  if (pathname.startsWith("/project/")) return "PJ コックピット";
  return null;
}

// SSR 時点で <title> を確定させる (= タブタイトル「変わらない」事故防止)。
// middleware が x-pathname header をセットしてくれている前提。
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const page = pathToTitle(pathname);
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
