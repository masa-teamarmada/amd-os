import { NextResponse } from "next/server";
import { PROJECT_WORKSPACE_SESSION_COOKIE } from "@/lib/project-workspace-session";
import { WORKSPACE_SESSION_COOKIE } from "@/lib/workspace-access-session";
import { createClient } from "@/lib/supabase/server";

// Unified logout: clears both the workspace and legacy project-workspace cookies,
// and locally signs out of Supabase (scope: "local" only — see auth/callback/route.ts
// comment re: the 2026-07-27 all-device logout incident).
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  const response = NextResponse.redirect(new URL("/auth/login", request.url));
  response.cookies.set(WORKSPACE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(PROJECT_WORKSPACE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
