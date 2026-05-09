// app_notifications テーブルのデータアクセス層

import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
);

function getAuthClient() {
  return createBrowserSupabase();
}

export type NotificationKind =
  | "vc_new"
  | "vc_news"
  | "vc_fund"
  | "misc";

export interface AppNotification {
  id: string;
  kind: NotificationKind | string;
  title: string;
  body: string | null;
  link: string | null;
  meta: Record<string, unknown> | null;
  related_vc_id: string | null;
  source: string;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const NOTIFICATION_KIND_LABEL: Record<string, string> = {
  vc_new: "🆕 新 VC",
  vc_news: "📰 VC ニュース",
  vc_fund: "💰 ファンド更新",
  misc: "その他",
};

/** 一覧 (default は未読 + 最新 100 件) */
export async function fetchNotifications(opts?: {
  limit?: number;
  includeRead?: boolean;
  includeDismissed?: boolean;
}): Promise<AppNotification[]> {
  let q = supabase
    .from("app_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (!opts?.includeDismissed) q = q.is("dismissed_at", null);
  const { data } = await q;
  return (data ?? []) as AppNotification[];
}

/** 未読件数 (バッジ用) */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count } = await supabase
    .from("app_notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null)
    .is("dismissed_at", null);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean; error?: string }> {
  const c = getAuthClient();
  const { error } = await c
    .from("app_notifications")
    .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean; error?: string }> {
  const c = getAuthClient();
  const { error } = await c
    .from("app_notifications")
    .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .is("read_at", null)
    .is("dismissed_at", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function dismissNotification(id: string): Promise<{ ok: boolean; error?: string }> {
  const c = getAuthClient();
  const { error } = await c
    .from("app_notifications")
    .update({ dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
