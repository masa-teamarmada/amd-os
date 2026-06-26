"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  appNotificationPriority,
  l2NotificationPriority,
  meetingNotificationPriority,
} from "@/lib/notification-priority";

type AppCriticalRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  meta: {
    connector?: string;
    reason?: string;
    reauth_url?: string;
    reauth_app_url?: string;
    reauth_install_url?: string;
    priority?: string;
    severity?: string;
    urgency?: string;
    notification_priority?: string;
    notification_channel?: string;
    risk_level?: string;
  } | null;
  source: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

type L2CriticalRow = {
  notification_id: string;
  l2_kind: string;
  target_id: string;
  scope_key: string;
  title: string;
  summary: string | null;
  importance: number | null;
  metadata_json: unknown;
  notified_at: string | null;
  read_at: string | null;
  created_at: string;
};

type MeetingCriticalRow = {
  meeting_id: string;
  project_id: string;
  title: string;
  source_kinds: string | null;
  summary_short: string | null;
  notified_at: string | null;
  read_at: string | null;
  created_at: string;
};

type CriticalNotification =
  | {
      source: "app";
      key: string;
      id: string;
      title: string;
      body: string | null;
      badge: string;
      actionLabel: string;
      actionUrl: string;
      createdAt: string;
      browserTag: string;
      row: AppCriticalRow;
    }
  | {
      source: "l2";
      key: string;
      id: string;
      title: string;
      body: string | null;
      badge: string;
      actionLabel: string;
      actionUrl: string;
      createdAt: string;
      browserTag: string;
      row: L2CriticalRow;
    }
  | {
      source: "meeting";
      key: string;
      id: string;
      title: string;
      body: string | null;
      badge: string;
      actionLabel: string;
      actionUrl: string;
      createdAt: string;
      browserTag: string;
      row: MeetingCriticalRow;
    };

const L2_KIND_LABEL: Record<string, string> = {
  action_item: "要対応",
  contract_signals: "契約予兆",
  guardrail_match: "経営ガードレール",
  shareholder_meeting: "株主総会/役会",
};

export function CriticalRealtimeNotify() {
  const supabase = useMemo(() => createClient(), []);
  const [item, setItem] = useState<CriticalNotification | null>(null);
  const [items, setItems] = useState<CriticalNotification[]>([]);
  const [closedKeys, setClosedKeys] = useState<Set<string>>(() => new Set());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const itemsRef = useRef<CriticalNotification[]>([]);
  const closedRef = useRef(new Set<string>());
  const browserSeenRef = useRef(new Set<string>());

  const emitBrowserNotification = useCallback((next: CriticalNotification) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission !== "granted") return;
    if (browserSeenRef.current.has(next.browserTag)) return;
    browserSeenRef.current.add(next.browserTag);

    const notification = new window.Notification(next.title, {
      body: compactBody(next),
      tag: next.browserTag,
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      openCriticalNotification(next, supabase);
      notification.close();
    };
  }, [supabase]);

  const showFirstOpen = useCallback((list: CriticalNotification[]) => {
    const next = list.find((candidate) => !closedRef.current.has(candidate.key)) ?? null;
    setItem(next);
    if (next) emitBrowserNotification(next);
  }, [emitBrowserNotification]);

  const loadCritical = useCallback(async () => {
    const [appRes, l2Res, meetingRes] = await Promise.all([
      supabase
        .from("app_notifications")
        .select("id,kind,title,body,link,meta,source,read_at,dismissed_at,created_at,updated_at")
        .is("read_at", null)
        .is("dismissed_at", null)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabase
        .from("l2_notifications")
        .select("notification_id,l2_kind,target_id,scope_key,title,summary,importance,metadata_json,notified_at,read_at,created_at")
        .is("read_at", null)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("meeting_notifications")
        .select("meeting_id,project_id,title,source_kinds,summary_short,notified_at,read_at,created_at")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const critical = [
      ...((appRes.data ?? []) as AppCriticalRow[]).flatMap(appRowToCritical),
      ...((l2Res.data ?? []) as L2CriticalRow[]).flatMap(l2RowToCritical),
      ...((meetingRes.data ?? []) as MeetingCriticalRow[]).flatMap(meetingRowToCritical),
    ].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));

    itemsRef.current = critical;
    setItems(critical);
    showFirstOpen(critical);
  }, [showFirstOpen, supabase]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) void loadCritical();
    };

    refresh();
    const interval = window.setInterval(refresh, 10_000);
    const channel = supabase
      .channel("critical-notifications-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_notifications" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "l2_notifications" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_notifications" }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadCritical, supabase]);

  const closeForSession = () => {
    if (!item) return;
    closedRef.current.add(item.key);
    setClosedKeys(new Set(closedRef.current));
    showFirstOpen(itemsRef.current);
  };

  if (!item) return null;

  const openItems = items.filter((candidate) => !closedKeys.has(candidate.key));

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[min(380px,calc(100vw-2rem))] rounded-[8px] border border-red-300 bg-white p-3 text-sm shadow-xl">
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
          !
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-red-700">
            <span className="rounded bg-red-50 px-1.5 py-0.5">{item.badge}</span>
            <span>緊急通知</span>
            {openItems.length > 1 && (
              <span className="ml-auto font-mono text-[10px] text-red-600">{openItems.length}件</span>
            )}
          </div>
          <div className="font-semibold text-red-700">{item.title}</div>
          {item.body && (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
              {item.body}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => openCriticalNotification(item, supabase)}
              className="rounded-[6px] bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              {item.actionLabel}
            </button>
            {permission === "default" && (
              <button
                onClick={async () => {
                  const next = await window.Notification.requestPermission();
                  setPermission(next);
                }}
                className="rounded-[6px] border border-border px-3 py-1.5 text-xs hover:bg-muted"
              >
                ブラウザ通知を許可
              </button>
            )}
            <button
              onClick={closeForSession}
              className="rounded-[6px] border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function appRowToCritical(row: AppCriticalRow): CriticalNotification[] {
  if (appNotificationPriority(row) !== "critical") return [];
  const url = reauthUrl(row) || row.link || "/notifications";
  const actionLabel = row.kind === "connector_auth" ? "再認証を開く" : "開く";
  return [{
    source: "app",
    key: `app:${row.id}:${row.updated_at}`,
    id: row.id,
    title: row.title,
    body: row.body || row.meta?.reason || null,
    badge: row.kind === "connector_auth" ? "再認証" : "OS通知",
    actionLabel,
    actionUrl: url,
    createdAt: row.updated_at || row.created_at,
    browserTag: `critical-app-${row.id}-${row.updated_at}`,
    row,
  }];
}

function l2RowToCritical(row: L2CriticalRow): CriticalNotification[] {
  if (l2NotificationPriority(row) !== "critical") return [];
  return [{
    source: "l2",
    key: `l2:${row.notification_id}:${row.notified_at || row.created_at}`,
    id: row.notification_id,
    title: row.title,
    body: row.summary,
    badge: L2_KIND_LABEL[row.l2_kind] ?? row.l2_kind,
    actionLabel: "通知ページで確認",
    actionUrl: "/notifications",
    createdAt: row.notified_at || row.created_at,
    browserTag: `critical-l2-${row.notification_id}-${row.notified_at || row.created_at}`,
    row,
  }];
}

function meetingRowToCritical(row: MeetingCriticalRow): CriticalNotification[] {
  if (meetingNotificationPriority(row) !== "critical") return [];
  return [{
    source: "meeting",
    key: `meeting:${row.meeting_id}:${row.notified_at || row.created_at}`,
    id: row.meeting_id,
    title: row.title,
    body: row.summary_short,
    badge: "MTG",
    actionLabel: "通知ページで確認",
    actionUrl: "/notifications",
    createdAt: row.notified_at || row.created_at,
    browserTag: `critical-meeting-${row.meeting_id}-${row.notified_at || row.created_at}`,
    row,
  }];
}

async function openCriticalNotification(item: CriticalNotification, supabase: ReturnType<typeof createClient>) {
  if (item.source === "app") {
    await supabase
      .from("app_notifications")
      .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", item.id);
  }

  if (item.actionUrl.startsWith("http://") || item.actionUrl.startsWith("https://")) {
    window.open(item.actionUrl, "_blank", "noopener,noreferrer");
  } else {
    window.location.href = item.actionUrl;
  }
}

function reauthUrl(row: AppCriticalRow) {
  return row.meta?.reauth_url || row.meta?.reauth_install_url || row.meta?.reauth_app_url || "";
}

function compactBody(item: CriticalNotification) {
  const body = item.body || "通知ページで確認してね。";
  return body.length > 180 ? `${body.slice(0, 177)}...` : body;
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
