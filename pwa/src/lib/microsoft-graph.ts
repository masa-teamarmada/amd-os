import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Microsoft Graph (M365) 委任同意の最小実装。
 *
 * 目的は「石原先生のM365から業務の進捗を取る」ことだが、その前段として
 * まさ自身のMicrosoftアカウントで同意フローと読み取りが成立するかを確かめる
 * (まさ確定 2026-08-13「さきにおれのmicrosoftアカウントでテストしようよ」)。
 *
 * 設計上の約束:
 * - **代理ログインをしない**。本人がMicrosoftのドメインで同意を1回押すだけで、
 *   パスワードはAMD側へ渡らない。AMDが保持するのはトークンだけ。
 * - 第1波のスコープは Calendars.Read + offline_access + User.Read だけ。
 *   メールは読まない (大学テナントで管理者承認が要る可能性が高く、説明範囲も広がるため)。
 * - 予定の本文・添付は保存しない。件名・日時・場所・主催者だけを扱う。
 * - client secret はサーバー側の環境変数にだけ置き、DTOやログへ出さない。
 */

export const MS_GRAPH_SCOPES = [
  "offline_access",
  "User.Read",
  "Calendars.Read",
] as const;

// common = 職場・学校アカウントと個人用Microsoftアカウントの両方を受ける。
// 大学テナント(work_school)とまさの個人アカウント(personal)を同じアプリで試せる。
const MS_AUTHORITY = "https://login.microsoftonline.com/common";

export type MsGraphConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export class MsGraphNotConfiguredError extends Error {
  constructor() {
    super("Microsoft Graph の client id / secret が未設定");
    this.name = "MsGraphNotConfiguredError";
  }
}

export function getMsGraphConfig(origin: string): MsGraphConfig {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new MsGraphNotConfiguredError();
  return { clientId, clientSecret, redirectUri: `${origin}/api/ms/auth/callback` };
}

export function buildAuthorizeUrl(config: MsGraphConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: MS_GRAPH_SCOPES.join(" "),
    state,
    // 同意画面を毎回出す。既に同意済みでもスコープの追加漏れに気づけるようにする。
    prompt: "select_account",
  });
  return `${MS_AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

async function requestToken(
  config: MsGraphConfig,
  body: Record<string, string>,
): Promise<TokenResponse> {
  const res = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...body,
    }).toString(),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // Microsoft の error_description は同意拒否・管理者承認要求の判定に必要なので残すが、
    // トークン類は絶対に含めない。
    const description = String(json.error_description ?? json.error ?? res.status);
    throw new Error(`Microsoft token endpoint: ${description.slice(0, 400)}`);
  }
  return json as unknown as TokenResponse;
}

export async function exchangeCodeForToken(config: MsGraphConfig, code: string) {
  return requestToken(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    scope: MS_GRAPH_SCOPES.join(" "),
  });
}

export async function refreshAccessToken(config: MsGraphConfig, refreshToken: string) {
  return requestToken(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: MS_GRAPH_SCOPES.join(" "),
  });
}

export type MsGraphProfile = {
  displayName: string | null;
  userPrincipalName: string | null;
  accountKind: "personal" | "work_school" | "unknown";
};

export async function fetchProfile(accessToken: string): Promise<MsGraphProfile> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,userPrincipalName,id", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return { displayName: null, userPrincipalName: null, accountKind: "unknown" };
  const json = (await res.json()) as Record<string, unknown>;
  const upn = typeof json.userPrincipalName === "string" ? json.userPrincipalName : null;
  // 個人用アカウントのUPNは outlook.com / hotmail.com / live.* などの消費者ドメインになる。
  // 完全な判定ではないので、迷ったら unknown に倒す (検証結果の読み替えを誤らせないため)。
  const personalDomains = ["outlook.com", "outlook.jp", "hotmail.com", "hotmail.co.jp", "live.jp", "live.com", "msn.com"];
  const domain = upn?.split("@")[1]?.toLowerCase() ?? "";
  const accountKind: MsGraphProfile["accountKind"] = !domain
    ? "unknown"
    : personalDomains.includes(domain)
      ? "personal"
      : "work_school";
  return {
    displayName: typeof json.displayName === "string" ? json.displayName : null,
    userPrincipalName: upn,
    accountKind,
  };
}

export type MsCalendarEvent = {
  id: string;
  subject: string;
  start: string | null;
  end: string | null;
  isAllDay: boolean;
  location: string | null;
  organizer: string | null;
  attendeeCount: number;
  webLink: string | null;
};

/**
 * 直近の予定を読む。本文(body)・添付は要求しない。
 * @param days 何日先まで読むか (既定28日)
 */
export async function fetchUpcomingEvents(
  accessToken: string,
  days = 28,
  limit = 50,
): Promise<MsCalendarEvent[]> {
  const now = new Date();
  const start = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $select: "id,subject,start,end,isAllDay,location,organizer,attendees,webLink",
    $orderby: "start/dateTime",
    $top: String(limit),
  });
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="Asia/Tokyo"',
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph calendarView ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { value?: Array<Record<string, unknown>> };
  return (json.value ?? []).map((row) => {
    const startObj = row.start as Record<string, unknown> | undefined;
    const endObj = row.end as Record<string, unknown> | undefined;
    const locationObj = row.location as Record<string, unknown> | undefined;
    const organizerObj = row.organizer as Record<string, unknown> | undefined;
    const organizerAddress = (organizerObj?.emailAddress as Record<string, unknown> | undefined) ?? undefined;
    const attendees = Array.isArray(row.attendees) ? row.attendees : [];
    return {
      id: String(row.id ?? ""),
      subject: typeof row.subject === "string" && row.subject ? row.subject : "(件名なし)",
      start: typeof startObj?.dateTime === "string" ? startObj.dateTime : null,
      end: typeof endObj?.dateTime === "string" ? endObj.dateTime : null,
      isAllDay: row.isAllDay === true,
      location: typeof locationObj?.displayName === "string" && locationObj.displayName ? locationObj.displayName : null,
      // 主催者は表示名だけ。メールアドレスは持ち出さない。
      organizer: typeof organizerAddress?.name === "string" ? organizerAddress.name : null,
      attendeeCount: attendees.length,
      webLink: typeof row.webLink === "string" ? row.webLink : null,
    };
  });
}

export type StoredMsToken = {
  memberId: string;
  accountLabel: string | null;
  accountKind: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
  lastAuthorizedAt: string | null;
};

export async function loadStoredToken(memberId: string): Promise<StoredMsToken | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("member_microsoft_oauth_tokens")
    .select("member_id,account_label,account_kind,access_token,refresh_token,token_expires_at,scopes,last_authorized_at")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error || !data?.access_token) return null;
  return {
    memberId: String(data.member_id),
    accountLabel: (data.account_label as string | null) ?? null,
    accountKind: (data.account_kind as string | null) ?? null,
    accessToken: String(data.access_token),
    refreshToken: (data.refresh_token as string | null) ?? null,
    expiresAt: (data.token_expires_at as string | null) ?? null,
    scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : [],
    lastAuthorizedAt: (data.last_authorized_at as string | null) ?? null,
  };
}

export async function saveToken(params: {
  memberId: string;
  accountLabel: string | null;
  accountKind: string;
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  scopes: string[];
}) {
  const db = createAdminClient();
  const expiresAt = new Date(Date.now() + Math.max(60, params.expiresInSeconds - 60) * 1000).toISOString();
  const patch: Record<string, unknown> = {
    member_id: params.memberId,
    account_label: params.accountLabel,
    account_kind: params.accountKind,
    access_token: params.accessToken,
    token_expires_at: expiresAt,
    scopes: params.scopes,
    last_authorized_at: new Date().toISOString(),
  };
  // 再同意でrefresh_tokenが返らないことがある。その場合は既存を消さない。
  if (params.refreshToken) patch.refresh_token = params.refreshToken;
  const { error } = await db.from("member_microsoft_oauth_tokens").upsert(patch, { onConflict: "member_id" });
  if (error) throw new Error(`token save: ${error.message}`);
}

/** 期限切れなら refresh して保存し直し、使えるアクセストークンを返す。 */
export async function getUsableAccessToken(
  memberId: string,
  config: MsGraphConfig,
): Promise<{ accessToken: string; stored: StoredMsToken } | null> {
  const stored = await loadStoredToken(memberId);
  if (!stored) return null;
  const expired = !stored.expiresAt || new Date(stored.expiresAt).getTime() <= Date.now();
  if (!expired) return { accessToken: stored.accessToken, stored };
  if (!stored.refreshToken) return null;
  const refreshed = await refreshAccessToken(config, stored.refreshToken);
  await saveToken({
    memberId,
    accountLabel: stored.accountLabel,
    accountKind: stored.accountKind || "unknown",
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? null,
    expiresInSeconds: refreshed.expires_in,
    scopes: refreshed.scope ? refreshed.scope.split(" ") : stored.scopes,
  });
  const next = await loadStoredToken(memberId);
  return next ? { accessToken: next.accessToken, stored: next } : null;
}

export async function markUsed(memberId: string) {
  const db = createAdminClient();
  await db
    .from("member_microsoft_oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("member_id", memberId);
}
