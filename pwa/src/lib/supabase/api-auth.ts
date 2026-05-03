/**
 * API Route 認証ヘルパー
 * 全 API route の冒頭で requireAuth() / requireAdmin() を呼ぶ。
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthResult =
  | { ok: true; user: { id: string; email: string }; supabase: SupabaseClient; errorResponse: null }
  | { ok: false; user: null; supabase: null; errorResponse: NextResponse };

/** ログイン済みユーザーのみ許可 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return {
      ok: false,
      user: null,
      supabase: null,
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, user: { id: user.id, email: user.email }, supabase, errorResponse: null };
}

/** Admin（members.is_admin = true）のみ許可 */
export async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return {
      ok: false,
      user: null,
      supabase: null,
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", user.email.toLowerCase())
    .single();

  if (!member?.is_admin) {
    return {
      ok: false,
      user: null,
      supabase: null,
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id, email: user.email }, supabase, errorResponse: null };
}
