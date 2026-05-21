import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "通知 - AMD OS" } };

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";
import { AppNotificationsSection } from "@/components/notifications/AppNotificationsSection";

export const dynamic = "force-dynamic";

/**
 * /notifications — 統合通知ページ
 *
 * 仕様正本: pwa/design/notifications.md
 *
 * 表示する通知:
 *  1. app_notifications: VC discover / VC news ingest / つくよみ等 (Web 系、AppNotificationsSection)
 *  2. l2_notifications (Phase 4: ③⑤④②) と meeting_notifications (Phase 3: ⑥) の一覧
 *  3. 各通知から元データ (member_knowledge / project_knowledge / protocols / milestone_monthly_progress / project_meeting_summaries) を展開表示
 *  4. 「⚠️ つくよみに修正依頼」フォームから l2_feedbacks INSERT
 *     → 次回の cron 抽出時に LLM プロンプトに含められる
 */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  if (!email) notFound();

  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", email)
    .maybeSingle();
  if (!member?.is_admin) notFound();

  const [l2Res, mtgRes, feedbacksRes, projectsRes] = await Promise.all([
    supabase
      .from("l2_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("meeting_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("l2_feedbacks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("projects")
      .select("project_id, project_name"),
  ]);

  const projectMap: Record<string, string> = {};
  for (const p of projectsRes.data ?? []) {
    projectMap[p.project_id] = p.project_name;
  }

  return (
    <div className="container mx-auto max-w-4xl py-6 px-4">
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">📬 通知</h1>
        <span className="text-sm text-muted-foreground">
          L2 抽出 {(l2Res.data ?? []).length} 件 / MTGサマリ {(mtgRes.data ?? []).length} 件
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-6">
        cron / つくよみ / Phase 4 抽出 等の通知を統合表示。誤抽出があれば「⚠️ つくよみに修正依頼」で次回以降の抽出を改善できる。
      </p>

      {/* VC 系 / Web 通知 (app_notifications) */}
      <AppNotificationsSection />

      {/* L2 抽出 / MTG サマリ通知 */}
      <NotificationsClient
        l2={(l2Res.data ?? []) as Notification[]}
        mtg={(mtgRes.data ?? []) as MeetingNotification[]}
        feedbacks={(feedbacksRes.data ?? []) as Feedback[]}
        projectMap={projectMap}
      />
    </div>
  );
}

// === 型 (NotificationsClient と共有、再エクスポート用にここでも宣言) ===

export type Notification = {
  notification_id: string;
  l2_kind: string;
  target_id: string;
  scope_key: string;
  title: string;
  summary: string | null;
  saved_count: number;
  total_count: number;
  importance: number;
  notified_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type MeetingNotification = {
  meeting_id: string;
  project_id: string;
  title: string;
  source_kinds: string;
  summary_short: string;
  notified_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type Feedback = {
  feedback_id: string;
  l2_kind: string;
  target_id: string;
  scope_key: string;
  notification_id: string | null;
  meeting_id: string | null;
  feedback_text: string;
  status: string;
  created_by: string | null;
  created_at: string;
  applied_count: number;
  last_applied_at: string | null;
};
