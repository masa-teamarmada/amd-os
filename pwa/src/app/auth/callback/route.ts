import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { cookies } from "next/headers";
import {
  createProjectWorkspaceSessionValue,
  PROJECT_WORKSPACE_SESSION_COOKIE,
  PROJECT_WORKSPACE_SESSION_MAX_AGE,
} from "@/lib/project-workspace-session";
import { createClient } from "@/lib/supabase/server";
import { normalizeWorkspaceEmail } from "@/lib/workspace-email";
import { sanitizeNextPath } from "@/lib/workspace-next-path";
import {
  createWorkspaceSessionCookieValue,
  WORKSPACE_SESSION_COOKIE,
  WORKSPACE_SESSION_MAX_AGE,
} from "@/lib/workspace-access-session";
import { resolveWorkspaceAccessForAccount } from "@/lib/workspace-access-resolver";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";

const ALLOWED_DOMAIN = "team-armada.jp";
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service role env vars are required");
  return createServiceClient(url, serviceKey);
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

// workspace_account (社外の共有ワークスペース利用者) 用の OTP ログイン。member テーブルとは
// 完全に別の principal — Supabase 側の認証セッションはこの関数の中で必ず signOut し、
// 発行するのは署名付き WORKSPACE_SESSION_COOKIE だけ（内部 member 用 RLS には一切触れさせない）。
async function handleWorkspaceLoginCallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email: string },
  next: string,
  origin: string,
) {
  const service = getServiceClient();
  const normalizedEmail = normalizeWorkspaceEmail(user.email);

  if (!normalizedEmail) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(`${origin}/auth/login?error=workspace_auth_failed`);
  }

  const { data: account } = await service
    .from("workspace_user_accounts")
    .select("id,email_normalized,auth_user_id,status")
    .eq("email_normalized", normalizedEmail)
    .in("status", ["invited", "active"])
    .maybeSingle();

  if (!account) {
    await supabase.auth.signOut({ scope: "local" });
    await recordWorkspaceAuditEvent(service, {
      eventType: "callback_login_denied",
      detail: { reason: "account_not_found" },
    });
    return NextResponse.redirect(`${origin}/auth/login?error=workspace_account_not_found`);
  }

  if (account.auth_user_id && account.auth_user_id !== user.id) {
    await supabase.auth.signOut({ scope: "local" });
    await recordWorkspaceAuditEvent(service, {
      eventType: "callback_login_denied",
      userAccountId: account.id,
      email: account.email_normalized,
      detail: { reason: "auth_user_id_mismatch" },
    });
    return NextResponse.redirect(`${origin}/auth/login?error=workspace_account_conflict`);
  }

  // 初回ログインでの紐付けと、招待済み(invited)アカウントの有効化(active)は同時に行う。
  if (!account.auth_user_id || account.status === "invited") {
    const { error: activateError } = await service
      .from("workspace_user_accounts")
      .update({ auth_user_id: user.id, status: "active" })
      .eq("id", account.id);
    if (activateError) {
      await supabase.auth.signOut({ scope: "local" });
      await recordWorkspaceAuditEvent(service, {
        eventType: "callback_login_denied",
        userAccountId: account.id,
        email: account.email_normalized,
        detail: { reason: "account_activation_failed" },
      });
      return NextResponse.redirect(`${origin}/auth/login?error=workspace_activation_failed`);
    }
  }

  // 招待済み(invited)のメンバーシップも、このログインで初回参加として active 化する。
  // アカウント自体は既に active でも、新規招待メンバーシップだけが invited のケースがあるため
  // account の activation 有無に関わらず毎回試みる。どちらかの update が失敗したら fail closed。
  const { error: institutionActivateError } = await service
    .from("institution_workspace_memberships")
    .update({ status: "active" })
    .eq("user_account_id", account.id)
    .eq("status", "invited");
  if (institutionActivateError) {
    await supabase.auth.signOut({ scope: "local" });
    await recordWorkspaceAuditEvent(service, {
      eventType: "callback_login_denied",
      userAccountId: account.id,
      email: account.email_normalized,
      detail: { reason: "institution_membership_activation_failed" },
    });
    return NextResponse.redirect(`${origin}/auth/login?error=workspace_activation_failed`);
  }

  const { error: projectActivateError } = await service
    .from("project_access_memberships")
    .update({ status: "active" })
    .eq("user_account_id", account.id)
    .eq("status", "invited");
  if (projectActivateError) {
    await supabase.auth.signOut({ scope: "local" });
    await recordWorkspaceAuditEvent(service, {
      eventType: "callback_login_denied",
      userAccountId: account.id,
      email: account.email_normalized,
      detail: { reason: "project_membership_activation_failed" },
    });
    return NextResponse.redirect(`${origin}/auth/login?error=workspace_activation_failed`);
  }

  const scopeSummary = await resolveWorkspaceAccessForAccount(account.id, account.email_normalized);
  const hasActiveScope = !!scopeSummary
    && (scopeSummary.projects.length > 0 || scopeSummary.institutionWorkspaces.length > 0);

  if (!hasActiveScope) {
    await supabase.auth.signOut({ scope: "local" });
    await recordWorkspaceAuditEvent(service, {
      eventType: "callback_login_denied",
      userAccountId: account.id,
      email: account.email_normalized,
      detail: { reason: "no_active_scope" },
    });
    return NextResponse.redirect(`${origin}/auth/login?error=workspace_no_access`);
  }

  const cookieStore = await cookies();
  const supabaseCookieNames = cookieStore
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-"));
  const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
  if (signOutError) {
    return NextResponse.redirect(`${origin}/auth/login?error=workspace_auth_failed`);
  }

  await recordWorkspaceAuditEvent(service, {
    eventType: "callback_login_success",
    userAccountId: account.id,
    email: account.email_normalized,
    detail: {},
  });

  const response = NextResponse.redirect(`${origin}${sanitizeNextPath(next)}`);
  for (const name of supabaseCookieNames) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  response.cookies.set(
    WORKSPACE_SESSION_COOKIE,
    createWorkspaceSessionCookieValue(account.id, account.email_normalized),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: WORKSPACE_SESSION_MAX_AGE,
    },
  );
  return response;
}

// この route の signOut はすべて「いま確立しかけた、このブラウザのセッションだけを捨てる」意図。
// GoTrueClient.signOut() の既定 scope は "global" で、省略すると当人の全デバイスの
// セッションまで失効する。scope: "local" の明示は必須（2026-07-27 の全端末ログアウト事故）。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const loginScope = searchParams.get("login_scope");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
      }

      if (loginScope === "workspace") {
        return handleWorkspaceLoginCallback(supabase, { id: user.id, email: user.email }, next, origin);
      }

      const email = user.email.toLowerCase();
      const service = getServiceClient();
      const { data: member } = await service
        .from("members")
        .select("member_id,status,os_access_scope")
        .ilike("email", email)
        .maybeSingle();

      if (!member || member.status !== "active") {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.redirect(`${origin}/auth/login?error=member_not_registered`);
      }

      if (member.os_access_scope === "project") {
        const { count, error: membershipError } = await service
          .from("project_members")
          .select("id", { count: "exact", head: true })
          .eq("member_id", member.member_id)
          .eq("is_active", true);
        if (membershipError || !count) {
          await supabase.auth.signOut({ scope: "local" });
          return NextResponse.redirect(`${origin}/auth/login?error=project_membership_required`);
        }
        await service
          .from("members")
          .update({ last_login_at: new Date().toISOString() })
          .eq("member_id", member.member_id);

        // Project-only users must not keep a normal Supabase authenticated
        // session. Existing AMD tables have internal-member RLS contracts;
        // the signed HTTP-only workspace cookie is deliberately narrower.
        const cookieStore = await cookies();
        const supabaseCookieNames = cookieStore
          .getAll()
          .map((cookie) => cookie.name)
          .filter((name) => name.startsWith("sb-"));
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        if (signOutError) {
          return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
        }

        const response = NextResponse.redirect(`${origin}${next}`);
        for (const name of supabaseCookieNames) {
          response.cookies.set(name, "", { path: "/", maxAge: 0 });
        }
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

      // portfolio アカウントは従来どおり AMD Google Workspace + Calendar/Gmail が必須。
      // hd はクライアントヒントにすぎないため、サーバー側でも検証する。
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.redirect(`${origin}/auth/login?error=domain_not_allowed`);
      }
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
        await supabase.auth.signOut({ scope: "local" });
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
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.redirect(`${origin}/auth/login?next=${encodeURIComponent(next)}&error=calendar_required`);
      }
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.set(PROJECT_WORKSPACE_SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
