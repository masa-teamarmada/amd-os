// ⚠️ pwa/src/lib/supabase/client.ts からの逐語コピー。正本は pwa 側。

import { createBrowserClient } from "@supabase/ssr";

const makeBrowserClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

let browserClient: ReturnType<typeof makeBrowserClient> | null = null;

export function createClient() {
  browserClient ??= makeBrowserClient();
  return browserClient;
}
