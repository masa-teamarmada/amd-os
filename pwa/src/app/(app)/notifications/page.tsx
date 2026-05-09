"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  NOTIFICATION_KIND_LABEL,
  type AppNotification,
} from "@/lib/notifications-data";

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("unread");

  const reload = async () => {
    setLoading(true);
    const list = await fetchNotifications({ limit: 200, includeRead: filter === "all" });
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const visible =
    filter === "unread" ? items.filter((n) => !n.read_at) : items;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">通知</h1>
          <p className="text-xs text-muted-foreground mt-1">
            cron / つくよみ / その他システムから届いた通知。クリックでリンク先へ、Read で既読、Dismiss で消去。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filter === "unread" && visible.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("全部既読にする?")) return;
                const res = await markAllNotificationsRead();
                if (!res.ok) alert(res.error);
                else reload();
              }}
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent"
            >
              全部既読
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(["unread", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded border ${
              filter === k
                ? "bg-accent text-accent-foreground border-primary/50"
                : "border-border hover:bg-accent"
            }`}
          >
            {k === "unread" ? "未読のみ" : "全部"}
          </button>
        ))}
        <span className="text-muted-foreground ml-auto">{visible.length} 件</span>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-10 text-sm">読み込み中…</div>
      ) : visible.length === 0 ? (
        <div className="text-center text-muted-foreground py-10 text-sm">
          通知なし。次の cron は毎朝 03:00 / 09:00 JST。
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => (
            <NotificationRow key={n.id} item={n} onChange={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({ item, onChange }: { item: AppNotification; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const isUnread = !item.read_at;
  const meta = item.meta as { source_url?: string; vc_name?: string; news_kind?: string } | null;

  const onRead = async () => {
    setBusy(true);
    const res = await markNotificationRead(item.id);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else onChange();
  };
  const onDismiss = async () => {
    setBusy(true);
    const res = await dismissNotification(item.id);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else onChange();
  };

  return (
    <li
      className={`border rounded-lg p-3 ${
        isUnread ? "border-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] mb-1">
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {NOTIFICATION_KIND_LABEL[item.kind] ?? item.kind}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {item.source === "cron_vc_discover" && "🤖 vc-discover"}
              {item.source === "cron_vc_news_ingest" && "🤖 vc-news-ingest"}
              {item.source === "tsukuyomi" && "🌙 つくよみ"}
              {item.source === "manual" && "✋ 手動"}
              {item.source === "system" && "⚙️ system"}
            </span>
            <span className="text-muted-foreground text-[10px] ml-auto">
              {new Date(item.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="font-medium text-sm">{item.title}</div>
          {item.body && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{item.body}</p>
          )}
          <div className="flex items-center gap-2 text-[11px] mt-2">
            {item.link && (
              <Link
                href={item.link}
                onClick={() => { if (isUnread) markNotificationRead(item.id).then(onChange); }}
                className="underline text-primary"
              >
                {item.link}
              </Link>
            )}
            {meta?.source_url && (
              <a
                href={meta.source_url}
                target="_blank"
                rel="noreferrer"
                className="underline text-muted-foreground text-[10px] truncate"
              >
                source
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {isUnread && (
            <button
              onClick={onRead}
              disabled={busy}
              className="text-xs px-3 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50 whitespace-nowrap"
            >
              ✓ 既読
            </button>
          )}
          <button
            onClick={onDismiss}
            disabled={busy}
            className="text-xs px-3 py-1 rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 whitespace-nowrap"
          >
            ✕ 削除
          </button>
        </div>
      </div>
    </li>
  );
}
