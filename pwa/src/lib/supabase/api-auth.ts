/**
 * API Route 認証ヘルパー
 * 全 API route の冒頭で requireAuth() / requireAdmin() を呼ぶ。
 *
 * 【体感速度】requireMember / requireAdmin は本来、1リクエストにつきSupabaseへ2往復する
 * (JWT検証の auth.getUser と、members の照合)。members はめったに変わらない参照系なので、
 * 照合結果だけをプロセス内に短時間持ち、往復を1回に減らす。
 * JWT検証 (getUser) はキャッシュしない — ここを省くとログアウトや失効が効かなくなる。
 * 規範: pwa/spec/5-10-reference-data-caching-current-spec.md
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * members 照合の短期キャッシュ。
 * TTL を30秒に抑えているのは、メンバーを外した直後に権限が残る窓を最小にするため。
 * 権限の変更が即時に効いてほしい場面では invalidateMemberLookupCache() を呼ぶ。
 */
const MEMBER_LOOKUP_TTL_MS = 30 * 1000;
type MemberLookup = { isMember: boolean; isAdmin: boolean };
const memberLookupCache = new Map<string, { value: MemberLookup; storedAt: number }>();

async function lookupMember(supabase: SupabaseClient, email: string): Promise<MemberLookup> {
  const cached = memberLookupCache.get(email);
  if (cached && Date.now() - cached.storedAt < MEMBER_LOOKUP_TTL_MS) return cached.value;

  const { data } = await supabase
    .from("members")
    .select("member_id, is_admin")
    .eq("email", email)
    .maybeSingle();
  const value: MemberLookup = {
    isMember: Boolean(data?.member_id),
    isAdmin: Boolean((data as { is_admin?: boolean } | null)?.is_admin),
  };
  memberLookupCache.set(email, { value, storedAt: Date.now() });
  return value;
}

/** メンバー追加・削除・管理者フラグ変更の直後に呼ぶ。引数なしで全件。 */
export function invalidateMemberLookupCache(email?: string): void {
  if (email) memberLookupCache.delete(email.toLowerCase());
  else memberLookupCache.clear();
}

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

/** AMD members に登録されているログイン済みユーザーのみ許可 */
export async function requireMember(): Promise<AuthResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const member = await lookupMember(auth.supabase, auth.user.email.toLowerCase());

  if (!member.isMember) {
    return {
      ok: false,
      user: null,
      supabase: null,
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return auth;
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

  const member = await lookupMember(supabase, user.email.toLowerCase());

  if (!member.isAdmin) {
    return {
      ok: false,
      user: null,
      supabase: null,
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id, email: user.email }, supabase, errorResponse: null };
}
