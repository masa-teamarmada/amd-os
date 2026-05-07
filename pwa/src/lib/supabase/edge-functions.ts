/** Supabase Edge Function を生 fetch で叩くヘルパー。
 *  supabase-js の `functions.invoke` は実環境で "Failed to send a request to the Edge Function"
 *  エラーになることがあるため、iOS の `URLSession.shared.data` と同じ生 fetch 方式を使う。
 *  iOS の `SupabaseService.callEdgeFunction` ([ios/AMDOS/Core/Services/SupabaseService.swift:355]) と同等。
 */
function edgeFunctionUrl(name: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing");
  return `${baseUrl}/functions/v1/${name}`;
}

function authHeaders(): Record<string, string> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
  return { Authorization: `Bearer ${anonKey}` };
}

export async function callEdgeFunctionGET<T>(
  name: string,
  params: Record<string, string>
): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const url = `${edgeFunctionUrl(name)}${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${name} ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export async function callEdgeFunctionPOST<T>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(edgeFunctionUrl(name), {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${name} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}
