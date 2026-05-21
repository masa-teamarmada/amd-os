import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN = "team-armada.jp";
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder"
  );
}

function tokenExpiresAt(session: unknown) {
  const expiresIn = typeof (session as { expires_in?: unknown }).expires_in === "number"
    ? (session as { expires_in: number }).expires_in
    : 3600;
  return new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000).toISOString();
}

async function verifyCalendarAccess(accessToken: string) {
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth });
  await calendar.calendarList.list({ maxResults: 1 });
}

async function markCalendarStatus(input: {
  email: string;
  status: "connected" | "missing" | "error";
  error?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  session?: unknown;
}) {
  const service = getServiceClient();
  const { data: member } = await service
    .from("members")
    .select("member_id")
    .eq("email", input.email)
    .maybeSingle();

  const now = new Date().toISOString();
  const memberUpdate: Record<string, unknown> = {
    google_calendar_status: input.status,
    google_calendar_checked_at: now,
    google_calendar_connected_at: input.status === "connected" ? now : null,
    google_calendar_error: input.error ? input.error.slice(0, 500) : null,
  };
  if (input.status === "connected") {
    memberUpdate.last_login_at = now;
  }

  await service
    .from("members")
    .update(memberUpdate)
    .eq("email", input.email);

  if (member?.member_id && input.status === "connected") {
    let refreshToken = input.refreshToken || null;
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
        access_token: input.accessToken || null,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt(input.session),
        scopes: REQUIRED_SCOPES,
        updated_at: now,
      }, { onConflict: "member_id" });
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // サーバー側でドメイン検証（hd パラメータはクライアントヒントにすぎないため必須）
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/auth/login?error=domain_not_allowed`);
      }
      const email = user.email.toLowerCase();
      const session = data.session as {
        provider_token?: string | null;
        provider_refresh_token?: string | null;
      } | null;
      const accessToken = session?.provider_token || null;
      if (!accessToken) {
        await markCalendarStatus({
          email,
          status: "missing",
          error: "Google provider token missing. Calendar scope consent is required.",
        });
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/auth/login?next=${encodeURIComponent(next)}&error=calendar_required`);
      }
      try {
        await verifyCalendarAccess(accessToken);
        await markCalendarStatus({
          email,
          status: "connected",
          accessToken,
          refreshToken: session?.provider_refresh_token || null,
          session: data.session,
        });
      } catch (calendarError) {
        await markCalendarStatus({
          email,
          status: "error",
          error: calendarError instanceof Error ? calendarError.message : String(calendarError),
        });
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/auth/login?next=${encodeURIComponent(next)}&error=calendar_required`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
