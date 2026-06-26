"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  NOTIFICATION_KIND_LABEL,
  type AppNotification,
} from "@/lib/notifications-data";

/**
 * VC discover / task agent 等から作られた app_notifications を一覧表示する
 * /notifications ページの先頭セクション。
 * L2 抽出 / MTG サマリ通知とは別系統 (NotificationsClient で扱う)。
 */
export function AppNotificationsSection() {
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

  const visible = filter === "unread" ? items.filter((n) => !n.read_at) : items;

  return (
    <section className="mb-6 border border-border rounded-lg p-4">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold">OS通知</h2>
        <span className="text-xs text-muted-foreground">
          (task agent / cron / つくよみ から)
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          {(["unread", "all"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-2 py-1 rounded border ${
                filter === k
                  ? "bg-accent text-accent-foreground border-primary/50"
                  : "border-border hover:bg-accent"
              }`}
            >
              {k === "unread" ? "未読" : "全部"}
            </button>
          ))}
          {filter === "unread" && visible.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("全部既読にする?")) return;
                const res = await markAllNotificationsRead();
                if (!res.ok) alert(res.error);
                else reload();
              }}
              className="px-2 py-1 rounded border border-border hover:bg-accent"
            >
              全部既読
            </button>
          )}
          <span className="text-muted-foreground">{visible.length} 件</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-6 text-xs">読み込み中…</div>
      ) : visible.length === 0 ? (
        <div className="text-center text-muted-foreground py-6 text-xs">
          {filter === "unread" ? "未読の通知なし。" : "通知なし。"}次の cron は毎週土曜 09:00 JST。
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => (
            <NotificationRow key={n.id} item={n} onChange={reload} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationRow({ item, onChange }: { item: AppNotification; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const isUnread = !item.read_at;
  const meta = item.meta as {
    source_url?: string;
    vc_name?: string;
    news_kind?: string;
    task_id?: string;
    project_id?: string;
    reauth_url?: string;
    reauth_app_url?: string;
    reauth_install_url?: string;
    connector?: string;
    connector_id?: string;
    link_id?: string;
    reason?: string;
  } | null;
  const primaryReauthUrl = meta?.reauth_url || meta?.reauth_install_url || meta?.reauth_app_url;

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
      className={`border rounded p-3 ${
        isUnread ? "border-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] mb-1 flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {NOTIFICATION_KIND_LABEL[item.kind] ?? item.kind}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {item.source === "cron_vc_discover" && "🤖 vc-discover"}
              {item.source === "tsukuyomi" && "🌙 つくよみ"}
              {item.source === "manual" && "✋ 手動"}
              {item.source === "system" && "⚙️ system"}
              {item.source === "task_agent" && "task agent"}
              {item.source === "h1_meeting_flow" && "H-1"}
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
              <SmartLink
                href={item.link}
                onClick={() => { if (isUnread) markNotificationRead(item.id).then(onChange); }}
                className="underline text-primary"
              >
                {item.link}
              </SmartLink>
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
            {primaryReauthUrl && (
              <SmartLink
                href={primaryReauthUrl}
                onClick={() => { if (isUnread) markNotificationRead(item.id).then(onChange); }}
                className="rounded border border-primary/40 px-2 py-0.5 text-primary hover:bg-primary/10 text-[10px] whitespace-nowrap"
              >
                再認証を開く
              </SmartLink>
            )}
            {meta?.reauth_app_url && meta.reauth_app_url !== primaryReauthUrl && (
              <SmartLink
                href={meta.reauth_app_url}
                className="underline text-muted-foreground text-[10px] truncate"
              >
                コデックスで開く
              </SmartLink>
            )}
            {meta?.connector && <span className="text-muted-foreground text-[10px] truncate">{connectorLabelJa(meta.connector)}{meta.reason ? ` / ${reasonLabelJa(meta.reason)}` : ""}</span>}
            {meta?.task_id && <span className="text-muted-foreground text-[10px] truncate">{meta.project_id} / {meta.task_id}</span>}
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

function SmartLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (isInternalHref(href)) {
    return (
      <Link href={href} onClick={onClick} className={className}>
        {children}
      </Link>
    );
  }

  const isWeb = href.startsWith("http://") || href.startsWith("https://");
  return (
    <a
      href={href}
      onClick={onClick}
      target={isWeb ? "_blank" : undefined}
      rel={isWeb ? "noreferrer" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}

function isInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

function connectorLabelJa(connector: string) {
  const labels: Record<string, string> = {
    notion: "ノーション",
    gmail: "メール",
    drive: "ドライブ",
    calendar: "カレンダー",
    slack: "スラック",
  };
  return labels[connector] ?? connector;
}

function reasonLabelJa(reason: string) {
  const labels: Record<string, string> = {
    oauth_token_invalid_grant: "認証の有効期限切れ",
    TRIGGER_REAUTHENTICATION: "再認証が必要",
    reauth_required: "再認証が必要",
  };
  return labels[reason] ?? reason;
}
