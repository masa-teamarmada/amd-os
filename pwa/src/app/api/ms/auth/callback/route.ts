/**
 * GET /api/ms/auth/callback
 *
 * Microsoft の同意後に戻ってくる先。認可コードをトークンへ交換して保存する。
 * 同意が拒否された場合や、テナントが管理者承認を要求した場合は、その理由を
 * そのまま画面へ返す (大学テナントで何が起きるかを判定するのがこの実装の主目的)。
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForToken,
  fetchProfile,
  getMsGraphConfig,
  MS_GRAPH_SCOPES,
  MsGraphNotConfiguredError,
  saveToken,
} from "@/lib/microsoft-graph";

export const dynamic = "force-dynamic";

function resultRedirect(origin: string, target: string, params: Record<string, string>) {
  const url = new URL(target.startsWith("/") ? target : "/settings/microsoft", origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorCode = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  const db = createAdminClient();

  // state は成否にかかわらず1度で使い切る。
  let redirectAfter = "/settings/microsoft";
  let memberId: string | null = null;
  if (state) {
    const { data } = await db
      .from("microsoft_oauth_states")
      .select("member_id,redirect_after,expires_at")
      .eq("state", state)
      .maybeSingle();
    await db.from("microsoft_oauth_states").delete().eq("state", state);
    if (data && new Date(String(data.expires_at)).getTime() > Date.now()) {
      memberId = String(data.member_id);
      redirectAfter = String(data.redirect_after || redirectAfter);
    }
  }

  if (errorCode) {
    // 典型: consent_required / admin_consent_required (テナントがユーザー同意を制限している)
    return resultRedirect(origin, redirectAfter, {
      ms_result: "denied",
      ms_error: errorCode,
      ms_detail: (errorDescription || "").slice(0, 300),
    });
  }
  if (!code || !memberId) {
    return resultRedirect(origin, redirectAfter, { ms_result: "invalid_state" });
  }

  let config;
  try {
    config = getMsGraphConfig(origin);
  } catch (error) {
    if (error instanceof MsGraphNotConfiguredError) {
      return resultRedirect(origin, redirectAfter, { ms_result: "not_configured" });
    }
    throw error;
  }

  try {
    const token = await exchangeCodeForToken(config, code);
    const profile = await fetchProfile(token.access_token);
    await saveToken({
      memberId,
      accountLabel: profile.displayName || profile.userPrincipalName,
      accountKind: profile.accountKind,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresInSeconds: token.expires_in,
      scopes: token.scope ? token.scope.split(" ") : [...MS_GRAPH_SCOPES],
    });
    return resultRedirect(origin, redirectAfter, {
      ms_result: "connected",
      ms_account_kind: profile.accountKind,
    });
  } catch (error) {
    return resultRedirect(origin, redirectAfter, {
      ms_result: "token_failed",
      ms_detail: (error instanceof Error ? error.message : String(error)).slice(0, 300),
    });
  }
}
