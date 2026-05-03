/**
 * Freee API Client — サーバーサイド専用
 * OAuth2 refresh_token → access_token のトークン管理を含む。
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getFreeeAccessToken(): Promise<string> {
  // キャッシュ確認（60秒バッファ）
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const refreshToken = process.env.FREEE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("FREEE credentials not configured");
  }

  const res = await fetch("https://accounts.secure.freee.co.jp/public_api/token", {
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
    const errText = await res.text();
    throw new Error(`Freee token refresh failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 7200) * 1000,
  };

  // refresh_tokenローテーション対応
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    console.warn("[freee] New refresh_token received — update FREEE_REFRESH_TOKEN env var!");
    // 本番ではDBに保存するべきだが、現時点ではログ警告のみ
  }

  return cachedToken.token;
}

export async function freeeApi(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const token = await getFreeeAccessToken();
  const companyId = process.env.FREEE_COMPANY_ID;

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
  const companyId = process.env.FREEE_COMPANY_ID;

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
