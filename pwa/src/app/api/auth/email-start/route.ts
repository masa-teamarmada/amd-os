import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { normalizeWorkspaceEmail } from "@/lib/workspace-email";
import { sanitizeNextPath } from "@/lib/workspace-next-path";
import { hasAnyUsableMembership } from "@/lib/workspace-access-scope-core";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";

// Always the same response shape/status, whether the email is registered or not —
// this endpoint must never let a caller distinguish "registered" from "unregistered"
// (email enumeration). Never authorize by domain: only a DB row + non-revoked
// membership sends mail, regardless of the email's domain.
const GENERIC_RESPONSE = { ok: true } as const;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service role env vars are required");
  return createServiceClient(url, serviceKey);
}

function getAnonAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase anon env vars are required");
  return createServiceClient(url, anonKey);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const rawEmail = typeof body === "object" && body !== null ? (body as Record<string, unknown>).email : undefined;
  const rawNext = typeof body === "object" && body !== null ? (body as Record<string, unknown>).next : undefined;

  if (typeof rawEmail !== "string" || rawEmail.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const next = sanitizeNextPath(rawNext);
  const normalizedEmail = normalizeWorkspaceEmail(rawEmail);

  // Malformed email format is a structural input error, not a registration signal —
  // safe to respond generically without doing any DB lookup.
  if (!normalizedEmail) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  try {
    const service = getServiceClient();
    const { origin } = new URL(request.url);

    const { data: account } = await service
      .from("workspace_user_accounts")
      .select("id,email_normalized,status")
      .eq("email_normalized", normalizedEmail)
      .in("status", ["invited", "active"])
      .maybeSingle();

    if (!account) {
      // Do not store the raw email for an unregistered/unknown address.
      await recordWorkspaceAuditEvent(service, {
        eventType: "email_start_requested",
        detail: { accountFound: false },
      });
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const [{ data: institutionMemberships }, { data: projectMemberships }] = await Promise.all([
      service
        .from("institution_workspace_memberships")
        .select("status")
        .eq("user_account_id", account.id),
      service
        .from("project_access_memberships")
        .select("status")
        .eq("user_account_id", account.id),
    ]);

    const usable = hasAnyUsableMembership(institutionMemberships ?? [], projectMemberships ?? []);

    await recordWorkspaceAuditEvent(service, {
      eventType: "email_start_requested",
      userAccountId: account.id,
      email: account.email_normalized,
      detail: { accountFound: true, membershipFound: usable },
    });

    if (!usable) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const { data: sendClaimed, error: claimError } = await service.rpc("workspace_claim_email_otp_send", {
      p_user_account_id: account.id,
    });
    if (claimError) {
      console.error("[email-start] OTP rate-limit claim failed:", claimError.message);
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }
    if (sendClaimed !== true) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const authClient = getAnonAuthClient();
    const { error: otpError } = await authClient.auth.signInWithOtp({
      email: account.email_normalized,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${origin}/auth/callback?login_scope=workspace&next=${encodeURIComponent(next)}`,
      },
    });

    if (!otpError) {
      await recordWorkspaceAuditEvent(service, {
        eventType: "email_start_sent",
        userAccountId: account.id,
        email: account.email_normalized,
        detail: {},
      });
    } else {
      console.warn("[email-start] signInWithOtp failed:", otpError.message);
    }

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (err) {
    console.error("[email-start] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }
}
