/**
 * service_role キーで Supabase に直接アクセスするクライアント。
 *
 * RLS をバイパスするので、server-side の API route / cron で書き込みするとき以外は使わない。
 * `service_role_bypass` policy を持つテーブルでは普通の anon でも動くが、
 * 統一して service_role で動かす方が事故を起こしにくい (auth.jwt() に依存しない)。
 */

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL not set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
