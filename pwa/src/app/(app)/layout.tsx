import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { GlobalNav } from "@/components/nav/GlobalNav";
import { PageTitleSetter } from "@/components/nav/PageTitleSetter";
import { TsukuyomiChatBridge } from "@/components/tsukuyomi/TsukuyomiChatBridge";
import { createClient } from "@/lib/supabase/server";

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
  if (pathname.startsWith("/venture-map/amd-score/retrofit")) return "AMD Score Retrofit";
  if (pathname.startsWith("/venture-map/amd-score")) return "AMD Score";
  if (pathname.startsWith("/venture-map/timeline-3d")) return "Venture Timeline 3D";
  if (pathname.startsWith("/venture-map/cyberspace")) return "Venture Cyberspace";
  if (pathname.startsWith("/venture-map/oscillator")) return "Venture Oscillator";
  if (pathname.startsWith("/venture-map/state-space")) return "Venture State Space";
  if (pathname.startsWith("/venture-map/su/")) return "SU Detail";
  if (pathname === "/venture-map") return "Venture Map";
  if (pathname.startsWith("/management-score")) return "Management Score";
  if (pathname === "/seeds") return "Seeds";
  if (pathname === "/vcs") return "VC";
  if (pathname === "/mypage") return "マイページ";
  if (pathname === "/notifications") return "通知";
  if (pathname === "/reimburse") return "立替";
  if (pathname === "/admin/projects") return "Admin PJ";
  if (pathname === "/admin/protocols") return "AMD Protocol";
  if (pathname === "/admin/prompts") return "LLM プロンプト";
  if (pathname === "/admin/members") return "Admin メンバー";
  if (pathname === "/admin/billing") return "Admin 請求";
  if (pathname === "/admin/payouts") return "Admin 報酬";
  if (pathname === "/admin/finance") return "Admin Finance";
  if (pathname === "/admin/tsukuyomi") return "Admin つくよみ";
  if (pathname === "/admin/contexts") return "Admin Contexts";
  if (pathname === "/admin/settings") return "Admin 設定";
  if (pathname.startsWith("/admin")) return "Admin";
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
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/auth/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
  }

  let userCodeName = "Guest";
  let isAdmin = false;
  let memberId: string | null = null;
  if (user.email) {
    const { data: member } = await supabase
      .from("members")
      .select("code_name, is_admin, member_id, google_calendar_status")
      .eq("email", user.email)
      .single();
    if (member?.code_name) userCodeName = member.code_name;
    if (member?.is_admin) isAdmin = true;
    if (member?.member_id) memberId = member.member_id;
    if (member && member.google_calendar_status !== "connected") {
      redirect(`/auth/login?next=${encodeURIComponent(pathname || "/dashboard")}&error=calendar_required`);
    }
  }
  const hudSkinned =
    pathname.startsWith("/hud") ||
    pathname.startsWith("/atlas") ||
    pathname.startsWith("/seeds") ||
    pathname.startsWith("/vcs") ||
    pathname.startsWith("/venture-map/amd-score");
  const useHudShellOnly = pathname.startsWith("/hud");

  return (
    <>
      <PageTitleSetter />
      {!useHudShellOnly && <GlobalNav userCodeName={userCodeName} isAdmin={isAdmin} memberId={memberId} />}
      <main className={hudSkinned ? "amd-hud-page-skin flex-1" : "flex-1"}>{children}</main>
      <TsukuyomiChatBridge />
    </>
  );
}
