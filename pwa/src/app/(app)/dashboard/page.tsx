"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { createClient } from "@/lib/supabase/client";
import {
  fetchProjectsFromSupabase,
  fetchBillingStatusFromSupabase,
  type DashProject,
  type DashBillingStatus,
} from "@/lib/supabase-data";

function getCurrentYm() {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [billingStatus, setBillingStatus] = useState<Record<string, DashBillingStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetchProjectsFromSupabase(),
      fetchBillingStatusFromSupabase(getCurrentYm()),
    ]).then(([projRes, billRes]) => {
      if (projRes.status === "fulfilled") {
        setProjects(projRes.value);
      }
      if (billRes.status === "fulfilled") {
        setBillingStatus(billRes.value);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2.75rem)]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <NotificationsBanner />
      <DashboardGrid projects={projects} billingStatus={billingStatus} />
    </div>
  );
}

// 通知センターへの導線バナー (= ダッシュボード先頭に常設)
function NotificationsBanner() {
  const [unread, setUnread] = useState<number | null>(null);
  const [recentTitles, setRecentTitles] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const [l2Res, mtgRes, recentL2Res] = await Promise.all([
          supabase
            .from("l2_notifications")
            .select("notification_id", { count: "exact", head: true })
            .is("notified_at", null),
          supabase
            .from("meeting_notifications")
            .select("meeting_id", { count: "exact", head: true })
            .is("notified_at", null),
          supabase
            .from("l2_notifications")
            .select("title")
            .order("created_at", { ascending: false })
            .limit(3),
        ]);
        setUnread((l2Res.count ?? 0) + (mtgRes.count ?? 0));
        setRecentTitles(((recentL2Res.data ?? []) as { title: string }[]).map((r) => r.title));
      } catch {
        setUnread(0);
      }
    };
    load();
  }, []);

  return (
    <Link
      href="/notifications"
      className="block border rounded-lg p-3 hover:bg-muted/50 transition-colors bg-card"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">📬</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">
            通知センター
            {unread !== null && unread > 0 && (
              <span className="ml-2 inline-flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5">
                {unread > 99 ? "99+" : `${unread} 未読`}
              </span>
            )}
            {unread === 0 && <span className="ml-2 text-xs text-muted-foreground">(未読なし)</span>}
          </div>
          {recentTitles.length > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              直近: {recentTitles.slice(0, 2).join(" / ")}
              {recentTitles.length > 2 && " ..."}
            </div>
          )}
        </div>
        <span className="text-muted-foreground text-sm">→</span>
      </div>
    </Link>
  );
}
