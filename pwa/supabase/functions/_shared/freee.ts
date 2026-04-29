/**
 * freee OAuth トークン管理 + API呼び口
 * GAS版 006_FreeeCore.js からの移植
 *
 * トークンは Supabase settings テーブルに保存。
 * PostgreSQL advisory lock で同時リフレッシュを防ぐ。
 */

import { createServiceClient } from "./supabase.ts";

const TOKEN_URL = "https://accounts.secure.freee.co.jp/public_api/token";
const ACCOUNTING_BASE = "https://api.freee.co.jp/api/1";
const IV_BASE = "https://api.freee.co.jp/iv";

// ─── Token Management ───

/** freee access_token を取得（キャッシュ or リフレッシュ） */
export async function getAccessToken(): Promise<string> {
  const db = createServiceClient();

  // Advisory lock (key = hash of 'freee_token')
  await db.rpc("pg_advisory_lock", { key: 736533 }).catch(() => {});

  try {
    // キャッシュ確認
    const { data: row } = await db
      .from("settings")
      .select("value")
      .eq("key", "freee_credentials")
      .single();

    const creds = row?.value || {};
    const now = Date.now();

    if (creds.access_token && creds.expires_at && now < creds.expires_at - 60_000) {
      return creds.access_token;
    }

    // リフレッシュ
    const clientId = Deno.env.get("FREEE_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("FREEE_CLIENT_SECRET") || "";
    const refreshToken = creds.refresh_token || Deno.env.get("FREEE_REFRESH_TOKEN") || "";

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("freee credentials not configured");
    }

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`freee token refresh failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    const accessToken = json.access_token || "";
    const expiresIn = Number(json.expires_in || 0);
    const newRefresh = json.refresh_token || refreshToken;

    if (!accessToken) throw new Error("freee token refresh: access_token missing");

    // 更新保存
    await db
      .from("settings")
      .update({
        value: {
          access_token: accessToken,
          refresh_token: newRefresh,
          expires_at: Date.now() + expiresIn * 1000,
        },
      })
      .eq("key", "freee_credentials");

    return accessToken;
  } finally {
    await db.rpc("pg_advisory_unlock", { key: 736533 }).catch(() => {});
  }
}

// ─── API Callers ───

/** freee 会計API（/api/1） */
export async function requestAccounting(
  method: string,
  path: string,
  query?: Record<string, string>,
  body?: unknown
): Promise<unknown> {
  const token = await getAccessToken();
  const qs = query
    ? "?" + new URLSearchParams(query).toString()
    : "";
  const url = ACCOUNTING_BASE + path + qs;

  const opts: RequestInit = {
    method: method.toUpperCase(),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Api-Version": "2020-06-15",
    },
  };
  if (body != null) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`freee accounting ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

/** freee 請求書API（/iv） */
export async function requestIv(
  method: string,
  path: string,
  query?: Record<string, string>,
  body?: unknown
): Promise<unknown> {
  const token = await getAccessToken();
  const qs = query
    ? "?" + new URLSearchParams(query).toString()
    : "";
  const url = IV_BASE + path + qs;

  const opts: RequestInit = {
    method: method.toUpperCase(),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  if (body != null) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`freee iv ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

/** freee company_id */
export function getCompanyId(): string {
  const id = Deno.env.get("FREEE_COMPANY_ID") || "";
  if (!id) throw new Error("FREEE_COMPANY_ID not set");
  return id;
}

/** 税込→税抜（切り捨て） */
export function calcAmountExclTax(amountIncl: number, taxRate = 0.1): number {
  return Math.floor(amountIncl / (1 + taxRate));
}
