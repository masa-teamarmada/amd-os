/**
 * Supabase クライアント。
 *
 * 重要: きよOS は **Supabase 未接続でも全画面が動く**。
 * 環境変数が無いときは null を返し、呼び出し側はダミーデータで描画する。
 * この性質を壊さないこと（CLAUDE.md「データの扱い」）。
 */

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 接続情報が揃っているか。値そのものは絶対に画面へ出さない。 */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

/** 未設定なら null。呼び出し側で必ず null チェックする。 */
export function getSupabaseBrowserClient() {
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
