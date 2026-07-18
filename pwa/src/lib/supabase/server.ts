import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
      // Native clients use the same Supabase access token as the PWA. Keep
      // cookie sessions as the default and only forward a well-formed Bearer
      // header when one is present.
      ...(authorization?.match(/^Bearer\s+[^\s]+$/i)
        ? { global: { headers: { Authorization: authorization } } }
        : {}),
    }
  );
}
