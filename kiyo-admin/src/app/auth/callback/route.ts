/**
 * pwa/src/app/auth/callback/route.ts の簡略版。
 * pwa 側にある Calendar 権限検証 / member_google_oauth_tokens への保存はしない
 * （kiyo-admin は Calendar を使わないし、同じ行を2アプリから書くと事故るため）。
 * 残すのはドメイン検証だけ。is_admin の判定は各 page / API route の requireAdmin() が行う。
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN = "team-armada.jp";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // hd パラメータはクライアントヒントにすぎないのでサーバー側で必ず検証する
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/auth/login?error=domain_not_allowed`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
