import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

/** リクエストのJWTからユーザー情報を取得 */
export async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );

  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}

/** CORS headers */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** JSONレスポンス */
export function jsonResponse(
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** エラーレスポンス */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: message }, status);
}
