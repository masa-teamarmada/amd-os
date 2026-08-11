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
import {
  appNotificationPriority,
  isActionableAppNotification,
  notificationPriorityLabel,
  parseActionContract,
  type ActionContract,
  type NotificationPriority,
} from "@/lib/notification-priority";

/**
 * VC discover / task agent 等から作られた app_notifications を一覧表示する
 * /notifications ページの先頭セクション。
 * L2 抽出 / MTG サマリ通知とは別系統 (NotificationsClient で扱う)。
 */
export function AppNotificationsSection() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("unread");

  const reload = async () => {
    setLoading(true);
    const list = await fetchNotifications({ limit: 200, includeRead: filter !== "unread" });
    setItems(list.filter(isActionableAppNotification));
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const visible =
    filter === "unread"
      ? items.filter((n) => !n.read_at)
      : filter === "read"
        ? items.filter((n) => n.read_at)
        : items;
  const criticalItems = visible.filter((n) => appNotificationPriority(n) === "critical");
  const normalItems = visible.filter((n) => appNotificationPriority(n) === "normal");

  return (
    <section className="mb-6 border border-border rounded-lg p-4">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold">OS通知</h2>
        <span className="text-xs text-muted-foreground">
          (まさの具体行動があるものだけ)
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          {(["unread", "read", "all"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-2 py-1 rounded border ${
                filter === k
                  ? "bg-accent text-accent-foreground border-primary/50"
                  : "border-border hover:bg-accent"
              }`}
            >
              {k === "unread" ? "未読" : k === "read" ? "既読" : "全部"}
            </button>
          ))}
          {filter === "unread" && visible.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("全部既読にする?")) return;
                const res = await markAllNotificationsRead(visible.map((item) => item.id));
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
          {filter === "unread" ? "いま対応が必要な未読通知はないよ。" : "対応対象の通知はないよ。"}
        </div>
      ) : (
        <div className="space-y-4">
          {criticalItems.length > 0 && (
            <NotificationGroup priority="critical" items={criticalItems} onChange={reload} />
          )}
          {normalItems.length > 0 && (
            <NotificationGroup priority="normal" items={normalItems} onChange={reload} />
          )}
        </div>
      )}
    </section>
  );
}

function NotificationGroup({
  priority,
  items,
  onChange,
}: {
  priority: NotificationPriority;
  items: AppNotification[];
  onChange: () => void;
}) {
  return (
    <div>
      <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${
        priority === "critical" ? "text-red-700" : "text-muted-foreground"
      }`}>
        <span>{priority === "critical" ? "緊急性の高い通知" : "通常通知"}</span>
        <span className="font-mono text-[11px] opacity-70">{items.length}</span>
      </div>
      <ul className="space-y-2">
        {items.map((n) => (
          <NotificationRow key={n.id} item={n} priority={priority} onChange={onChange} />
        ))}
      </ul>
    </div>
  );
}

function NotificationRow({
  item,
  priority,
  onChange,
}: {
  item: AppNotification;
  priority: NotificationPriority;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
  const actionInfo = resolveActionInfo(item, primaryReauthUrl);

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
        priority === "critical"
          ? "border-red-300 bg-red-50/70"
          : isUnread
            ? "border-primary/40 bg-primary/5"
            : "border-border"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] mb-1 flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {NOTIFICATION_KIND_LABEL[item.kind] ?? item.kind}
            </span>
            <span className={`px-1.5 py-0.5 rounded ${
              priority === "critical"
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-600"
            }`}>
              {notificationPriorityLabel(priority)}
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
            <>
              <p className={`mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground ${
                needsReadMore(item.body) && !expanded ? "line-clamp-3" : ""
              }`}>
                {item.body}
              </p>
              {needsReadMore(item.body) && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 rounded text-[11px] font-medium text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {expanded ? "閉じる" : "続きを読む"}
                </button>
              )}
            </>
          )}
          <dl className="mt-3 space-y-2 rounded-md border border-border bg-muted/35 p-3 text-xs leading-relaxed">
            {actionInfo.whyNow && <ActionDetailRow label="いま出た理由">{actionInfo.whyNow}</ActionDetailRow>}
            <ActionDetailRow label="まさがやること">{actionInfo.actionRequired}</ActionDetailRow>
            <ActionDetailRow label="開く場所">
              {actionInfo.actionUrl ? (
                <SmartLink
                  href={actionInfo.actionUrl}
                  onClick={() => { if (isUnread) markNotificationRead(item.id).then(onChange); }}
                  className="inline-flex min-h-7 items-center rounded-md border border-primary/35 bg-background px-2.5 py-1 font-medium text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {actionInfo.actionLabel || "対応する"}
                </SmartLink>
              ) : (
                <span className="text-muted-foreground">{actionInfo.openLocationFallback}</span>
              )}
            </ActionDetailRow>
            <ActionDetailRow label="完了条件">{actionInfo.completionCondition}</ActionDetailRow>
          </dl>
          <div className="flex items-center gap-2 text-[11px] mt-2">
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
        <div className="flex shrink-0 gap-2 sm:flex-col">
          {isUnread && (
            <button
              onClick={onRead}
              disabled={busy}
              className="min-h-8 whitespace-nowrap rounded-md border border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              ✓ 既読
            </button>
          )}
          <button
            onClick={onDismiss}
            disabled={busy}
            className="min-h-8 whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            ✕ 削除
          </button>
        </div>
      </div>
    </li>
  );
}

function ActionDetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

type ActionInfo = {
  actionRequired: string;
  actionLabel: string | null;
  actionUrl: string | null;
  completionCondition: string;
  openLocationFallback: string;
  whyNow: string | null;
};

const KIND_FALLBACK_ACTION: Record<string, Omit<ActionInfo, "actionUrl" | "openLocationFallback" | "whyNow">> = {
  vc_new: { actionRequired: "新規VCの情報を確認して、必要なら次の動きを決める。", actionLabel: "対応する", completionCondition: "内容を確認し、必要な対応(スルー含む)を決めたら完了。" },
  vc_news: { actionRequired: "VCニュースの内容を確認する。", actionLabel: "対応する", completionCondition: "内容を確認したら完了。" },
  vc_fund: { actionRequired: "ファンド更新情報を確認する。", actionLabel: "対応する", completionCondition: "内容を確認したら完了。" },
  task_created: { actionRequired: "追加されたタスクを確認する。", actionLabel: "対応する", completionCondition: "タスク内容を確認したら完了。" },
  meeting_action: { actionRequired: "担当者・期限・内容を確認し、必要なら修正またはフォローする。", actionLabel: "要対応を確認", completionCondition: "担当者と期限が正しい状態で、次の対応を決めたら完了。" },
};

/**
 * 通知カードの「まさがやること / 開く場所 / 完了条件」を解決する。
 * meta.action_contract (action_owner/action_required/action_label/action_url/completion_condition) が
 * 正本。無い通知は kind 別の安全な fallback を出す (「対応不要」を安易に断定しない)。
 */
function resolveActionInfo(item: AppNotification, primaryReauthUrl?: string): ActionInfo {
  const contract: ActionContract | null = parseActionContract(item.meta as Record<string, unknown> | null);

  if (contract && contract.actionOwner === "none") {
    return {
      actionRequired: contract.actionRequired || "対応不要。実行結果の報告だよ。",
      actionLabel: contract.actionLabel,
      actionUrl: contract.actionUrl,
      completionCondition: contract.completionCondition || "対応不要。",
      openLocationFallback: "開く場所なし",
      whyNow: contract.whyNow,
    };
  }

  if (contract && contract.actionRequired && contract.completionCondition) {
    return {
      actionRequired: contract.actionRequired,
      actionLabel: contract.actionLabel,
      actionUrl: contract.actionUrl,
      completionCondition: contract.completionCondition,
      openLocationFallback: "開く場所なし",
      whyNow: contract.whyNow,
    };
  }

  if (item.kind === "connector_auth") {
    return {
      actionRequired: "再認証する。",
      actionLabel: "再認証を開く",
      actionUrl: primaryReauthUrl || null,
      completionCondition: "再認証が完了し、この通知が消えること。",
      openLocationFallback: "再認証リンクなし。内容を確認して対応方法を判断する。",
      whyNow: "接続エラーを検知したため。",
    };
  }

  const fallback = KIND_FALLBACK_ACTION[item.kind];
  if (fallback) {
    return {
      ...fallback,
      actionUrl: item.link && item.link !== "/notifications" ? item.link : null,
      openLocationFallback: "この一覧の本文を確認する。",
      whyNow: null,
    };
  }

  return {
    actionRequired: "この通知には対応契約が記録されていない。本文を読んで対応が必要か判断する。",
    actionLabel: null,
    actionUrl: item.link && item.link !== "/notifications" ? item.link : null,
    completionCondition: "内容を確認し、必要な対応(対応不要の判断含む)を終えたら完了。",
    openLocationFallback: "この一覧の本文を確認する。",
    whyNow: null,
  };
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

function needsReadMore(body: string) {
  return body.length > 180 || body.split("\n").length >= 4;
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
