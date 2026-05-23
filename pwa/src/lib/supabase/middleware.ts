import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const LAST_LOGIN_TOUCH_COOKIE = "amd_os_last_login_touch";
const LAST_LOGIN_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
}

function shouldTouchLastLogin(request: NextRequest) {
  const lastTouched = Number(request.cookies.get(LAST_LOGIN_TOUCH_COOKIE)?.value || 0);
  return !Number.isFinite(lastTouched) || Date.now() - lastTouched > LAST_LOGIN_TOUCH_INTERVAL_MS;
}

async function touchLastLogin(email: string) {
  const service = getServiceClient();
  if (!service) return;
  const now = new Date().toISOString();
  const { error } = await service
    .from("members")
    .update({ last_login_at: now })
    .eq("email", email.toLowerCase());
  if (error) {
    console.warn("[auth] failed to touch members.last_login_at:", error.message);
  }
}

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
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

  // Redirect unauthenticated users to login
  // API routes handle their own auth (CRON_SECRET etc.) — skip redirect
  if (
    !user &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/api/") &&
    pathname !== "/" &&
    pathname !== "/hud/dashboard/embed" &&
    pathname !== "/mock/dashboard-cyber-3d-lab" &&
    pathname !== "/mock/dashboard-cyber-glass-cube" &&
    pathname !== "/mock/dashboard-cyber-hud-wall"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (user?.email && shouldTouchLastLogin(request)) {
    await touchLastLogin(user.email);
    supabaseResponse.cookies.set(LAST_LOGIN_TOUCH_COOKIE, String(Date.now()), {
      path: "/",
      maxAge: Math.ceil(LAST_LOGIN_TOUCH_INTERVAL_MS / 1000),
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return supabaseResponse;
}
