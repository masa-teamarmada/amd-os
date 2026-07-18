import { NextResponse } from "next/server";
import {
  PROJECT_WORKSPACE_SESSION_COOKIE,
} from "@/lib/project-workspace-session";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/auth/login", request.url));
  response.cookies.set(PROJECT_WORKSPACE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
