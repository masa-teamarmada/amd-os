import { createBrowserClient } from "@supabase/ssr";

const makeBrowserClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type BrowserClient = ReturnType<typeof makeBrowserClient>;

const browserClientKey = "__amdOsSupabaseBrowserClient" as const;

export function createClient() {
  // Next.js can evaluate this module in more than one client chunk (for example
  // when /mypage is reused inside /dashboard). Keep the auth client on
  // globalThis so every chunk shares one GoTrue instance and one storage lock.
  const scope = globalThis as typeof globalThis & {
    [browserClientKey]?: BrowserClient;
  };
  scope[browserClientKey] ??= makeBrowserClient();
  return scope[browserClientKey];
}
