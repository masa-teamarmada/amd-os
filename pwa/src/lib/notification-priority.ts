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

const OPERATIONAL_CRITICAL_TOKEN_RE =
  /(critical|urgent|blocker|blocked|oauth_token_invalid_grant|trigger_reauthentication|認証切れ|再認証|ブロッカー|事故|緊急|至急|期限超過)/i;

export function notificationPriorityLabel(priority: NotificationPriority): string {
  return priority === "critical" ? "緊急" : "通常";
}

export function appNotificationPriority(notification: AppNotificationLike): NotificationPriority {
  if (notification.kind === "connector_auth") {
    return hasCompleteActionContract(notification.meta) || hasDirectReauthUrl(notification.meta)
      ? "critical"
      : "normal";
  }

  const flaggedCritical =
    hasExplicitCritical(notification.meta) ||
    hasOperationalCriticalToken([notification.kind, notification.source, notification.title, notification.body, metaText(notification.meta)]);
  if (!flaggedCritical) return "normal";

  // まさ本人が取るべき行動・URL・完了条件が揃わない critical は、
  // 対応しようがない通知として normal へ降格する (connector_auth は上で別扱い済み)。
  return hasCompleteActionContract(notification.meta) ? "critical" : "normal";
}

export function l2NotificationPriority(notification: L2NotificationLike): NotificationPriority {
  const meta = objectValue(notification.metadata_json);
  if (hasExplicitCritical(meta)) return "critical";
  if (hasOperationalCriticalToken([metaText(meta)])) {
    return "critical";
  }
  return "normal";
}

export function meetingNotificationPriority(notification: MeetingNotificationLike): NotificationPriority {
  void notification;
  return "normal";
}

export type ActionContract = {
  actionOwner: string;
  actionRequired: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  completionCondition: string | null;
  whyNow: string | null;
};

/**
 * `meta.action_contract` の正本形式。action_owner が "none" のときは
 * まさの対応が不要な通知 (完了報告など) を表す。
 */
const ACTION_KEYS = ["action_owner", "action_required", "action_url", "action_label", "completion_condition", "why_now"];

export function parseActionContract(meta: Record<string, unknown> | null | undefined): ActionContract | null {
  const primary = objectValue(meta?.action_contract);
  const legacy = objectValue(meta?.notification_contract);
  const legacyHasActionKeys = !!legacy && ACTION_KEYS.some((key) => key in legacy);
  const raw = primary || (legacyHasActionKeys ? legacy : null);
  if (!raw) return null;
  return {
    actionOwner: textValue(raw.action_owner) || "none",
    actionRequired: textValue(raw.action_required) || null,
    actionLabel: textValue(raw.action_label) || null,
    actionUrl: textValue(raw.action_url) || null,
    completionCondition: textValue(raw.completion_condition) || null,
    whyNow: textValue(raw.why_now) || null,
  };
}

export function hasCompleteActionContract(meta: Record<string, unknown> | null | undefined): boolean {
  const contract = parseActionContract(meta);
  if (!contract) return false;
  return contract.actionOwner !== "none" && !!contract.actionRequired && !!contract.actionUrl && !!contract.completionCondition;
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

function hasDirectReauthUrl(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  return [meta.reauth_url, meta.reauth_install_url, meta.reauth_app_url]
    .some((value) => isActionableUrl(textValue(value)));
}

function isActionableUrl(value: string): boolean {
  return /^(https?:\/\/|app:\/\/|\/(?!\/))/.test(value);
}

function hasOperationalCriticalToken(values: Array<string | null | undefined>): boolean {
  return values.some((value) => !!value && OPERATIONAL_CRITICAL_TOKEN_RE.test(value));
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
