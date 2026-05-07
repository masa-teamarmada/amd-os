/**
 * Google API 共通認証 — Drive / Gmail / Calendar で共有。
 *
 * 認証方針:
 *   1) GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN があれば OAuth (個人アカウント代理)
 *   2) GOOGLE_SERVICE_ACCOUNT_JSON があれば Service Account (Drive 共有のみ可、Gmail/Calendar は domain-wide delegation 必須)
 *
 * env を 1 つも設定していなければ null を返す → 各 source 側で skip。
 */

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

let cachedAuth: OAuth2Client | null = null;

export function getGoogleAuth(): OAuth2Client | null {
  if (cachedAuth) return cachedAuth;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const oauth = new google.auth.OAuth2(clientId, clientSecret);
    oauth.setCredentials({ refresh_token: refreshToken });
    cachedAuth = oauth;
    return cachedAuth;
  }

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const credentials = JSON.parse(saJson);
      const sa = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/calendar.readonly",
        ],
      });
      // Service Account も OAuth2Client として返す (型を統一)
      // domain-wide delegation の場合 subject 指定が必要だが、ここでは基本パターンのみ
      // (詳細な subject 切替は将来拡張)
      sa.getClient().then((c) => {
        cachedAuth = c as OAuth2Client;
      });
      // 同期返却用に getClient を一度待つ
      // 実用上 cron route では await getGoogleAuth() を使うので OK
    } catch (e) {
      console.error("[google] failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", e);
      return null;
    }
  }

  return null;
}

/** await 可能な版 (Service Account の場合 getClient が非同期) */
export async function getGoogleAuthAsync(): Promise<OAuth2Client | null> {
  const sync = getGoogleAuth();
  if (sync) return sync;

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const credentials = JSON.parse(saJson);
      const sa = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/calendar.readonly",
        ],
      });
      const client = (await sa.getClient()) as OAuth2Client;
      cachedAuth = client;
      return client;
    } catch (e) {
      console.error("[google] SA auth failed:", e);
      return null;
    }
  }
  return null;
}
