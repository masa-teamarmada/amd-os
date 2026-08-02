"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * pathname に応じて document.title を「<page> - AMD OS」形式に動的更新する。
 * 各 page.tsx に export const metadata を散らさず、layout 側で 1 箇所管理。
 */
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
  if (pathname.startsWith("/venture-map/amd-score/retrofit")) return "AMD Score Retrofit";
  if (pathname.startsWith("/venture-map/amd-score")) return "AMD Score";
  if (pathname.startsWith("/venture-map/timeline-3d")) return "Venture Timeline 3D";
  if (pathname.startsWith("/venture-map/cyberspace")) return "Venture Cyberspace";
  if (pathname.startsWith("/venture-map/oscillator")) return "Venture Oscillator";
  if (pathname.startsWith("/venture-map/state-space")) return "Venture State Space";
  if (pathname.startsWith("/venture-map/su/")) return "SU Detail";
  if (pathname === "/venture-map") return "Venture Map";
  if (pathname.startsWith("/knowledge-map")) return "AMD Materials";
  if (pathname === "/bzm/map") return "BZM 理論マップ";
  if (pathname.startsWith("/bzm")) return "BZM 2.0";
  if (pathname.startsWith("/business-cards") || pathname.startsWith("/native/business-cards")) return "名刺";
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
  if (pathname === "/admin/members") return "Admin メンバー";
  if (pathname === "/admin/company") return "Admin Company";
  if (pathname === "/admin/contracts") return "Admin 契約";
  if (pathname === "/admin/invoices" || pathname === "/admin/billing") return "請求書発行";
  if (pathname === "/admin/payouts") return "Admin 報酬";
  if (pathname === "/admin/monthly-work-agreements") return "Admin 月初合意";
  if (pathname === "/admin/finance") return "Admin Finance";
  if (pathname === "/admin/tsukuyomi") return "Admin つくよみ";
  if (pathname === "/admin/contexts") return "Admin Contexts";
  if (pathname === "/admin/settings") return "Admin 設定";
  if (pathname.startsWith("/admin")) return "Admin";
  if (/^\/project\/[^/]+\/weekly-control\/?$/.test(pathname)) return "PJ 週次管制";
  if (/^\/project\/[^/]+\/navigation\/?$/.test(pathname)) return "PJ管制ダッシュボード";
  if (/^\/project\/[^/]+\/workspace\/files\/?$/.test(pathname)) return "PJ 資料室";
  if (/^\/project\/[^/]+\/workspace\/?$/.test(pathname)) return "PJ ダッシュボード";
  if (pathname.startsWith("/projects/")) return "PJ コックピット";
  if (pathname.startsWith("/auth/login")) return "ログイン";
  return null;
}

export function PageTitleSetter() {
  const pathname = usePathname();
  useEffect(() => {
    const page = pathToTitle(pathname);
    document.title = page ? `${page} - AMD OS` : "AMD OS";
  }, [pathname]);
  return null;
}
