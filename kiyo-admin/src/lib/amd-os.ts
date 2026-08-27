/**
 * AMD OS 本体を呼ぶための薄いクライアント。
 *
 * 【なぜこれがあるか】
 * kiyo-admin は金額を計算しない。数字は本体が計算した結果をもらって表示するだけ。
 * 本体のロジックをコピーすると必ず腐って金額事故になるので、コピーではなく「呼ぶ」。
 *
 * 【どうやって認証しているか】
 * 本体の pwa/src/lib/supabase/server.ts は Authorization: Bearer <access_token> を
 * 受け付ける作りになっている（iOS ネイティブ版のために元から入っている仕組み）。
 * kiyo-admin と本体は同じ Supabase プロジェクトなので、こちらのログインで得た
 * access token をそのまま渡せば、本体側は同じ人としてログインを認識する。
 * → 本体には一切手を入れなくてよい。
 */

import { createClient } from "@/lib/supabase/server";

/** 本体の公開URL。既定は本番。ローカルの本体に向けたいときだけ .env.local で上書きする。 */
const AMD_OS_BASE_URL = (
  process.env.AMD_OS_BASE_URL || "https://amd-os-pwa.vercel.app"
).replace(/\/$/, "");

export type AmdOsResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

/**
 * 本体の API を、いまログインしている人として呼ぶ。
 * 本体側の権限判定（members.is_admin など）はそのまま効く。
 */
export async function callAmdOs<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<AmdOsResult<T>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    return { ok: false, status: 401, data: null, error: "ログイン情報が取れなかった" };
  }

  let res: Response;
  try {
    res = await fetch(`${AMD_OS_BASE_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch (cause) {
    return {
      ok: false,
      status: 502,
      data: null,
      error: `AMD OS 本体につながらなかった: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: `AMD OS 本体の応答が読めなかった (status ${res.status})`,
    };
  }

  const errorFromBody =
    json && typeof json === "object" && "error" in json
      ? String((json as { error: unknown }).error)
      : null;

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: errorFromBody ?? `AMD OS 本体がエラーを返した (status ${res.status})`,
    };
  }

  return { ok: true, status: res.status, data: json as T, error: null };
}
