import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  createProjectWorkspaceSessionValue,
  PROJECT_WORKSPACE_SESSION_COOKIE,
  PROJECT_WORKSPACE_SESSION_MAX_AGE,
} from "@/lib/project-workspace-session";

const ALLOWED_DOMAIN = "team-armada.jp";
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
  );
}

function tokenExpiresAt(expiresIn: unknown) {
  const seconds = typeof expiresIn === "number" ? expiresIn : 3600;
  return new Date(Date.now() + Math.max(60, seconds - 60) * 1000).toISOString();
}

async function markCalendarStatus(input: {
  email: string;
  status: "connected" | "missing" | "error";
  error?: string | null;
  providerToken?: string | null;
  providerRefreshToken?: string | null;
  expiresIn?: number | null;
}) {
  const service = getServiceClient();
  const { data: member } = await service
    .from("members")
    .select("member_id")
    .eq("email", input.email)
    .maybeSingle();

  const now = new Date().toISOString();
  await service
    .from("members")
    .update({
      google_calendar_status: input.status,
      google_calendar_checked_at: now,
      google_calendar_connected_at: input.status === "connected" ? now : null,
      google_calendar_error: input.error ? input.error.slice(0, 500) : null,
      ...(input.status === "connected" ? { last_login_at: now } : {}),
    })
    .eq("email", input.email);

  if (!member?.member_id || input.status !== "connected") return;

  let refreshToken = input.providerRefreshToken || null;
  if (!refreshToken) {
    const { data: existing } = await service
      .from("member_google_oauth_tokens")
      .select("refresh_token")
      .eq("member_id", member.member_id)
      .maybeSingle();
    refreshToken = existing?.refresh_token || null;
  }
  await service
    .from("member_google_oauth_tokens")
    .upsert({
      member_id: member.member_id,
      email: input.email,
      provider: "google",
      access_token: input.providerToken || null,
      refresh_token: refreshToken,
      token_expires_at: tokenExpiresAt(input.expiresIn),
      scopes: REQUIRED_SCOPES,
      updated_at: now,
    }, { onConflict: "member_id" });
}

/**
 * Native PKCE login has no PWA callback cookie exchange. This endpoint is the
 * post-exchange half of the existing `/auth/callback` contract: validate the
 * same Calendar permission and save the same member OAuth status before the
 * SwiftUI workspace becomes available.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const email = auth.user.email.toLowerCase();
  const service = getServiceClient();
  const { data: member, error: memberError } = await service
    .from("members")
    .select("member_id,status,os_access_scope")
    .ilike("email", email)
    .maybeSingle();
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  if (!member || member.status !== "active") {
    return NextResponse.json({ error: "member_not_registered" }, { status: 403 });
  }

  // PWA `/auth/callback` と同じく、PJ限定ユーザーにはCalendar/Gmailも
  // team-armada.jpドメインも要求しない。PJ参加設定だけを確認する。
  if (member.os_access_scope === "project") {
    const { count, error: membershipError } = await service
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.member_id)
      .eq("is_active", true);
    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json({ error: "project_membership_required" }, { status: 403 });
    }
    await service
      .from("members")
      .update({ last_login_at: new Date().toISOString() })
      .eq("member_id", member.member_id);

    // Native must not retain a normal Supabase session for a PJ限定ユーザー.
    // Mirror `/auth/callback`: hand the client the same narrow signed workspace
    // cookie, then let Swift discard its PKCE token before it renders a screen.
    const response = NextResponse.json({ ok: true, scope: "project" });
    response.cookies.set(
      PROJECT_WORKSPACE_SESSION_COOKIE,
      createProjectWorkspaceSessionValue({ memberId: member.member_id, email }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: PROJECT_WORKSPACE_SESSION_MAX_AGE,
      },
    );
    return response;
  }

  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return NextResponse.json({ error: "domain_not_allowed" }, { status: 403 });
  }

  let body: { provider_token?: unknown; provider_refresh_token?: unknown; expires_in?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const providerToken = typeof body.provider_token === "string" ? body.provider_token : null;
  const providerRefreshToken = typeof body.provider_refresh_token === "string" ? body.provider_refresh_token : null;
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : null;

  if (!providerToken) {
    await markCalendarStatus({
      email,
      status: "missing",
      error: "Google provider token missing. Calendar scope consent is required.",
    });
    return NextResponse.json({ error: "calendar_required" }, { status: 403 });
  }

  try {
    const oauth = new google.auth.OAuth2();
    oauth.setCredentials({ access_token: providerToken });
    await google.calendar({ version: "v3", auth: oauth }).calendarList.list({ maxResults: 1 });
    await markCalendarStatus({
      email,
      status: "connected",
      providerToken,
      providerRefreshToken,
      expiresIn,
    });
    return NextResponse.json({ ok: true, scope: "portfolio" });
  } catch (error) {
    await markCalendarStatus({
      email,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "calendar_required" }, { status: 403 });
  }
}
