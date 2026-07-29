// app_notifications テーブルのデータアクセス層

import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

function getAuthClient() {
  return createBrowserSupabase();
}

export type NotificationKind =
  | "vc_new"
  | "vc_news"
  | "vc_fund"
  | "task_created"
  | "connector_auth"
  | "h1_report"
  | "meeting_action"
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
  native_notified_at: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const NOTIFICATION_KIND_LABEL: Record<string, string> = {
  vc_new: "🆕 新 VC",
  vc_news: "📰 VC ニュース",
  vc_fund: "💰 ファンド更新",
  task_created: "タスク追加",
  connector_auth: "再認証",
  h1_report: "H-1報告",
  meeting_action: "会議の要対応",
  misc: "その他",
};

/** 一覧 (default は未読 + 最新 100 件) */
export async function fetchNotifications(opts?: {
  limit?: number;
  includeRead?: boolean;
  includeDismissed?: boolean;
}): Promise<AppNotification[]> {
  const c = getAuthClient();
  let q = c
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
  const c = getAuthClient();
  const { count } = await c
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
