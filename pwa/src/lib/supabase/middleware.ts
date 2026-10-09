import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDdViewerPath } from "@/lib/dd-package-core";
import { apiRouteOwnsAuthentication } from "@/lib/supabase/api-auth-routes";
import { API_ACTIVITY_HEADER, LAST_LOGIN_TOUCH_COOKIE, shouldTouchLastLogin, touchLastLogin, lastLoginCookieOptions } from "@/lib/supabase/last-login";

const PROJECT_WORKSPACE_SESSION_COOKIE = "amd_os_project_session";
const WORKSPACE_SESSION_COOKIE = "amd_os_workspace_session";

// amd_os_workspace_session (workspace_account principal) may only stand in for a normal
// authenticated session on the shared-workspace surface and the DD surface — never on internal
// member routes. Each page still DB-revalidates its own grant (workspace membership or DD grant).
// Legacy amd_os_project_session gating is untouched below.
const PROJECT_WORKSPACE_PATH_PATTERN = /^\/project\/[^/]+\/workspace(?:\/files)?\/?$/;

function isWorkspaceSessionAllowedPath(pathname: string) {
  if (pathname === "/workspaces") return true;
  if (pathname === "/workspace" || pathname.startsWith("/workspace/")) return true;
  if (PROJECT_WORKSPACE_PATH_PATTERN.test(pathname)) return true;
  if (isDdViewerPath(pathname)) return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  // Bearer and cookie can represent different principals. Preserve cookie-user
  // validation/activity in middleware for those requests instead of conflating
  // it with the route's independently validated Bearer identity.
  const routeOwnsAuth = apiRouteOwnsAuthentication(request.nextUrl.pathname, request.method)
    && !request.headers.get("authorization")?.match(/^Bearer\s+[^\s]+$/i);
  // This is only an activity-recording hint, never identity or authorization.
  // Overwrite client input before forwarding the request to the handler.
  request.headers.delete(API_ACTIVITY_HEADER);
  if (routeOwnsAuth) request.headers.set(API_ACTIVITY_HEADER, "1");
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  // ログインなしで開いてよい会議資料の置き場（public/shared/<PJ>/…）。どのPJも同じ置き場を使う
  // （2026-10-04 まさ「特定のPJだけの特例を入れたらシステムにならない」。以前は KUTE の /kute/ だけ）。
  const isPublicMeetingArtifact = pathname.startsWith("/shared/");
  // `/bzm/public/**` は公開原稿。通常の `/bzm/**` は引き続き会員限定にする。
  const isPublicBzmManuscript = pathname === "/bzm/public" || pathname.startsWith("/bzm/public/");
  const hasProjectWorkspaceSession = request.cookies.has(PROJECT_WORKSPACE_SESSION_COOKIE);
  const hasWorkspaceAccountSession = request.cookies.has(WORKSPACE_SESSION_COOKIE)
    && isWorkspaceSessionAllowedPath(pathname);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headersToSet).forEach(([name, value]) =>
            supabaseResponse.headers.set(name, value)
          );
        },
      },
    }
  );

  if (routeOwnsAuth) {
    // Refresh cookies here, then let the route's requireAuth/Member/Admin make
    // the authoritative getUser check. Never authorize from getSession data or
    // send a client-spoofable identity header to the route.
    await supabase.auth.getSession();
    return supabaseResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  // API routes handle their own auth (CRON_SECRET etc.) — skip redirect
  if (
    !user &&
    !hasProjectWorkspaceSession &&
    !hasWorkspaceAccountSession &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/api/") &&
    !isPublicMeetingArtifact &&
    !isPublicBzmManuscript &&
    pathname !== "/"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(url);
    // Expired/revoked sessions may have cleared cookies before the redirect.
    supabaseResponse.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = supabaseResponse.headers.get(name);
      if (value) redirectResponse.headers.set(name, value);
    }
    return redirectResponse;
  }

  if (user?.email && shouldTouchLastLogin(request.cookies.get(LAST_LOGIN_TOUCH_COOKIE)?.value)) {
    await touchLastLogin(user.email);
    supabaseResponse.cookies.set(LAST_LOGIN_TOUCH_COOKIE, String(Date.now()), lastLoginCookieOptions());
  }

  return supabaseResponse;
}
