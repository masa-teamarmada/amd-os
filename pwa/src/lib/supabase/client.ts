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
