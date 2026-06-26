export type NotificationPriority = "normal" | "critical";

type AppNotificationLike = {
  kind: string;
  title?: string | null;
  body?: string | null;
  source?: string | null;
  meta?: Record<string, unknown> | null;
};

type L2NotificationLike = {
  l2_kind: string;
  title?: string | null;
  summary?: string | null;
  importance?: number | null;
  metadata_json?: unknown;
};

type MeetingNotificationLike = {
  title?: string | null;
  summary_short?: string | null;
  source_kinds?: string | null;
};

const CRITICAL_L2_KINDS = new Set([
  "action_item",
  "contract_signals",
  "shareholder_meeting",
]);

const META_TEXT_KEYS = [
  "priority",
  "severity",
  "urgency",
  "notification_priority",
  "notification_channel",
  "risk_level",
  "reason",
  "connector",
  "category",
  "action_category",
  "blocker_kind",
  "proposed_target_l2",
  "gap_class",
  "signal_type",
];

const CRITICAL_TOKEN_RE =
  /(critical|urgent|blocker|blocked|oauth_token_invalid_grant|trigger_reauthentication|認証切れ|再認証|ブロッカー|事故|法務|契約|秘密保持|株主間契約|設立前|事前承諾|外部接点|顧客接点|取締役会|役会|総会|株主総会|議決権|決議|利益相反|反社|\bnda\b|\bsha\b|\bcoi\b)/i;

export function notificationPriorityLabel(priority: NotificationPriority): string {
  return priority === "critical" ? "緊急" : "通常";
}

export function appNotificationPriority(notification: AppNotificationLike): NotificationPriority {
  if (notification.kind === "connector_auth") return "critical";
  if (hasExplicitCritical(notification.meta)) return "critical";
  if (hasCriticalToken([notification.kind, notification.source, notification.title, notification.body, metaText(notification.meta)])) {
    return "critical";
  }
  return "normal";
}

export function l2NotificationPriority(notification: L2NotificationLike): NotificationPriority {
  if ((notification.importance ?? 0) >= 8) return "critical";
  if (CRITICAL_L2_KINDS.has(notification.l2_kind)) return "critical";
  const meta = objectValue(notification.metadata_json);
  if (hasExplicitCritical(meta)) return "critical";
  if (hasCriticalToken([notification.l2_kind, notification.title, notification.summary, metaText(meta)])) {
    return "critical";
  }
  return "normal";
}

export function meetingNotificationPriority(notification: MeetingNotificationLike): NotificationPriority {
  if (hasCriticalToken([notification.title, notification.summary_short, notification.source_kinds])) {
    return "critical";
  }
  return "normal";
}

function hasExplicitCritical(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  if (meta.critical === true || meta.is_critical === true) return true;
  for (const key of ["priority", "severity", "urgency", "notification_priority", "notification_channel", "risk_level"]) {
    const value = textValue(meta[key]).toLowerCase();
    if (["critical", "urgent", "blocker", "事故", "緊急"].includes(value)) return true;
  }
  return false;
}

function hasCriticalToken(values: Array<string | null | undefined>): boolean {
  return values.some((value) => !!value && CRITICAL_TOKEN_RE.test(value));
}

function metaText(meta: Record<string, unknown> | null | undefined): string {
  if (!meta) return "";
  return META_TEXT_KEYS
    .map((key) => textValue(meta[key]))
    .filter(Boolean)
    .join(" ");
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
