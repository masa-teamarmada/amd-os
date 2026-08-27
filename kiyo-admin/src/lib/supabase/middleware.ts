// pwa/src/lib/supabase/middleware.ts をベースに kiyo-admin 向けへ簡略化したもの。
// pwa 側にある members.last_login_at の touch は入れない（同じ列を2アプリから書くと事故るため。
// last_login_at の更新は pwa 側の責務のまま）。

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未ログインは /auth/login へ。API route は自前で requireAdmin() するので素通し。
  if (!user && !pathname.startsWith("/auth") && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
