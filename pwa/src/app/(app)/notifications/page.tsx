import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "通知 - AMD OS" } };

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";
import { AppNotificationsSection } from "@/components/notifications/AppNotificationsSection";
import { ActionItemsPanel } from "@/components/governance/ActionItemsPanel";

export const dynamic = "force-dynamic";

/**
 * /notifications — 統合通知ページ
 *
 * 仕様正本: pwa/design/notifications.md
 *
 * 表示する通知:
 *  1. app_notifications: VC discover / VC news ingest / 再認証等 (Web 系、AppNotificationsSection)
 *  2. l2_notifications の一覧
 *  3. 各通知から元データ (member_knowledge / project_knowledge / protocols / milestone_monthly_progress / project_strategy_signals) を展開表示
 *  4. 「⚠️ つくよみに修正依頼」フォームから l2_feedbacks INSERT
 *     → 次回の cron 抽出時に LLM プロンプトに含められる
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notification_id?: string | string[]; meeting_id?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : {};
  const focusNotificationId = firstParam(params.notification_id);
  const focusMeetingId = firstParam(params.meeting_id);
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

  const [l2Res, feedbacksRes, projectsRes] = await Promise.all([
    supabase
      .from("l2_notifications")
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

  let l2Rows = l2Res.data ?? [];
  const mtgRows: MeetingNotification[] = [];

  if (focusNotificationId && !l2Rows.some((row) => row.notification_id === focusNotificationId)) {
    const { data } = await supabase
      .from("l2_notifications")
      .select("*")
      .eq("notification_id", focusNotificationId)
      .maybeSingle();
    if (data) l2Rows = [data, ...l2Rows];
  }

  const projectMap: Record<string, string> = {};
  for (const p of projectsRes.data ?? []) {
    projectMap[p.project_id] = p.project_name;
  }
  const l2Count = l2Rows.length;
  const feedbackCount = (feedbacksRes.data ?? []).length;

  return (
    <div className="amd-desk-page-skin px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 grid gap-3 border-b border-[var(--desk-line)] pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <h1 className="text-xl font-semibold leading-tight">通知</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              cron / つくよみ / Phase 4 抽出 等の通知を統合表示。誤抽出があれば「つくよみに修正依頼」で次回以降の抽出を改善できる。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-[8px] border border-[var(--desk-line)] bg-[rgba(255,253,247,0.82)] px-3 py-2">
              <div className="font-mono text-xl font-bold text-[var(--desk-green)]">{l2Count}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">L2抽出</div>
            </div>
            <div className="rounded-[8px] border border-[var(--desk-line)] bg-[rgba(255,253,247,0.82)] px-3 py-2">
              <div className="font-mono text-xl font-bold text-[var(--desk-amber)]">{feedbackCount}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">修正依頼</div>
            </div>
          </div>
        </header>

        <div className="grid gap-4">
          {/* 要対応 (期日順) — 5生データ抽出 + 手動の inbound 義務 */}
          <section className="dashboard-desk-section">
            <div className="dashboard-desk-section-title">要対応</div>
            <ActionItemsPanel variant="notifications" />
          </section>

          {/* VC 系 / 復旧アクション / Web 通知 (app_notifications) */}
          <AppNotificationsSection />

          {/* L2 抽出レビューキュー */}
          <section className="dashboard-desk-section">
            <div className="dashboard-desk-section-title">L2レビューキュー</div>
            <NotificationsClient
              l2={l2Rows as Notification[]}
              mtg={mtgRows}
              feedbacks={(feedbacksRes.data ?? []) as Feedback[]}
              focus={{ l2NotificationId: focusNotificationId, meetingId: focusMeetingId }}
              projectMap={projectMap}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
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
  metadata_json?: unknown;
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
