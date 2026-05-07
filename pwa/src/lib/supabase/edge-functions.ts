/** Supabase Edge Function を GET でクエリパラメータ付きで呼ぶ。
 *  supabase-js の `functions.invoke` は POST 専用なので、GET (URL パラメータ) で叩きたい
 *  Edge Function（meeting-slots / schedule-meeting 等）はこのヘルパーを使う。
 */
export async function callEdgeFunctionGET<T>(
  name: string,
  params: Record<string, string>
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error("Supabase env vars missing");

  const query = new URLSearchParams(params).toString();
  const url = `${baseUrl}/functions/v1/${name}${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${name} ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}
