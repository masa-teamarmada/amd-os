/**
 * Freee API Client — サーバーサイド専用
 * OAuth2 refresh_token → access_token のトークン管理を含む。
 */

import { createAdminClient } from "@/lib/supabase/admin";

let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedCompanyId: string | null = null;

type StoredFreeeToken = {
  refreshToken: string | null;
  companyId: string | null;
};

async function loadStoredFreeeToken(): Promise<StoredFreeeToken> {
  const envRefreshToken = process.env.FREEE_REFRESH_TOKEN || null;
  const envCompanyId = process.env.FREEE_COMPANY_ID || null;
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("freee_oauth_tokens")
      .select("refresh_token, company_id")
      .eq("token_key", "default")
      .maybeSingle();
    return {
      refreshToken: data?.refresh_token || envRefreshToken,
      companyId: data?.company_id || envCompanyId,
    };
  } catch {
    return { refreshToken: envRefreshToken, companyId: envCompanyId };
  }
}

async function loadRefreshToken(): Promise<string> {
  const stored = await loadStoredFreeeToken();
  cachedCompanyId = stored.companyId;
  if (!stored.refreshToken) throw new Error("FREEE_REFRESH_TOKEN not configured");
  return stored.refreshToken;
}

async function loadCompanyId(): Promise<string | null> {
  if (cachedCompanyId) return cachedCompanyId;
  const stored = await loadStoredFreeeToken();
  cachedCompanyId = stored.companyId;
  return cachedCompanyId;
}

async function storeFreeeToken(token: {
  refresh_token?: string;
  company_id?: string | number;
  scope?: string;
  external_cid?: string;
}): Promise<void> {
  if (!token.refresh_token) return;
  try {
    const db = createAdminClient();
    await db
      .from("freee_oauth_tokens")
      .upsert({
        token_key: "default",
        refresh_token: token.refresh_token,
        company_id: token.company_id ? String(token.company_id) : cachedCompanyId || process.env.FREEE_COMPANY_ID || null,
        scope: token.scope ?? null,
        external_cid: token.external_cid ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "token_key" });
  } catch {
    // freee API呼び出し自体は成功しているので、rotation保存失敗は次回の警告に留める。
  }
}

export async function getFreeeAccessToken(): Promise<string> {
  // キャッシュ確認（60秒バッファ）
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const refreshToken = await loadRefreshToken();

  if (!clientId || !clientSecret) {
    throw new Error("FREEE credentials not configured");
  }

  const res = await fetch("https://accounts.secure.freee.co.jp/public_api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Freee token refresh failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  if (data.company_id) cachedCompanyId = String(data.company_id);
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 7200) * 1000,
  };

  // refresh_tokenローテーション対応。company_id もDB側を正に寄せる。
  if (data.refresh_token) {
    await storeFreeeToken(data);
  }

  return cachedToken.token;
}

export async function freeeApi(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const token = await getFreeeAccessToken();
  const companyId = await loadCompanyId();
  if (!companyId) throw new Error("FREEE_COMPANY_ID not configured");

  // パスにcompany_idを付加（まだ含まれていない場合）
  const baseUrl = "https://api.freee.co.jp";
  const sep = path.includes("?") ? "&" : "?";
  const url = `${baseUrl}${path}${companyId ? `${sep}company_id=${companyId}` : ""}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Freee API ${method} ${path}: ${res.status} ${errText.slice(0, 500)}`);
  }

  return res.json();
}

export async function freeeInvoiceApi(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const token = await getFreeeAccessToken();
  const companyId = await loadCompanyId();
  if (!companyId) throw new Error("FREEE_COMPANY_ID not configured");

  const baseUrl = "https://api.freee.co.jp/iv";
  const sep = path.includes("?") ? "&" : "?";
  const url = `${baseUrl}${path}${companyId ? `${sep}company_id=${companyId}` : ""}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Freee Invoice API ${method} ${path}: ${res.status} ${errText.slice(0, 500)}`);
  }

  return res.json();
}
