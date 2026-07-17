/* eslint-disable @typescript-eslint/no-explicit-any -- notification worker reads the versioned Supabase row shape dynamically. */
import { WebClient } from "@slack/web-api";
import { daysUntil, todayJst } from "./date.ts";
import type { ScheduleDb } from "@/lib/admin-schedule/generator";

type RawRow = Record<string, any>;

export type ScheduleNotificationResult = {
  ok: boolean;
  considered: number;
  created: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export type ScheduleNotificationRunResult = ScheduleNotificationResult & {
  enabled: boolean;
  reason: "enabled" | "disabled_by_env";
};

export type NotificationStageRow = {
  lifecycle_status?: unknown;
  generation_state?: unknown;
  notification_owner?: unknown;
  due_on?: unknown;
  category?: unknown;
  missing_reason?: unknown;
  source_hash?: unknown;
  needs_source_since?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export function notificationStateLabel(stage: string): string {
  return stage.startsWith("overdue:") ? "期限超過" : stage;
}

export function scheduleNotificationsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AMD_OS_SCHEDULE_NOTIFICATIONS_ENABLED === "1";
}

function emptyNotificationResult(): ScheduleNotificationResult {
  return {
    ok: true,
    considered: 0,
    created: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
}

export async function sendScheduleNotificationsWhenEnabled(
  send: () => Promise<ScheduleNotificationResult>,
  env: Record<string, string | undefined> = process.env,
): Promise<ScheduleNotificationRunResult> {
  if (!scheduleNotificationsEnabled(env)) {
    return {
      ...emptyNotificationResult(),
      enabled: false,
      reason: "disabled_by_env",
    };
  }
  return {
    ...(await send()),
    enabled: true,
    reason: "enabled",
  };
}

function jstDateFromTimestamp(value: unknown): string | null {
  if (!value) return null;
  const timestamp = new Date(String(value));
  if (Number.isNaN(timestamp.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp).map((part) => [part.type, part.value]));
  if (!parts.year || !parts.month || !parts.day) return null;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function daysSince(start: string, today: string): number {
  const elapsed = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  return Math.max(0, elapsed);
}

function needsSourceStage(row: NotificationStageRow, today: string): string {
  const since = jstDateFromTimestamp(row.needs_source_since ?? row.created_at ?? row.updated_at);
  if (!since) return "needs_source:initial";
  const elapsed = daysSince(since, today);
  if (elapsed < 7) return `needs_source:initial:${since}`;
  return `needs_source:cycle-${Math.floor(elapsed / 7)}:${since}`;
}

export function stageFor(row: NotificationStageRow, today: string): string | null {
  const lifecycle = String(row.lifecycle_status ?? "");
  if (lifecycle === "completed" || lifecycle === "cancelled" || lifecycle === "superseded" || row.notification_owner === "payment_obligation") return null;
  if (lifecycle === "needs_source" || row.generation_state === "needs_source" || row.missing_reason) return needsSourceStage(row, today);
  if (!row.due_on) return null;
  const offset = daysUntil(String(row.due_on), today);
  if (offset < 0) return `overdue:${today}`;
  const category = String(row.category ?? "");
  const thresholds = category === "contract" ? [90, 60, 30, 14, 7, 1, 0]
    : category === "tax" || category === "labor" ? [30, 14, 7, 1, 0]
      : [14, 7, 3, 1, 0];
  return thresholds.includes(offset) ? `d-${offset}` : null;
}

export function scheduleKey(row: Pick<NotificationStageRow, "source_hash">): string {
  return `schedule-v1:${String(row.source_hash ?? "unknown")}`;
}

function recipientRows(row: RawRow, members: RawRow[]): RawRow[] {
  const owner = members.find((member) => String(member.member_id) === String(row.owner_member_id) && member.slack_id);
  if (owner) return [owner];
  if (row.lifecycle_status === "needs_source" || row.missing_reason) return members.filter((member) => member.is_admin && member.slack_id);
  return [];
}

function displayDate(row: RawRow): string {
  if (row.due_on) return String(row.due_on);
  if (row.due_ym) return `${String(row.due_ym).slice(0, 4)}-${String(row.due_ym).slice(4, 6)}（日未確定）`;
  return "期限未確定";
}

export async function sendScheduleNotifications(db: ScheduleDb, options: { now?: Date } = {}): Promise<ScheduleNotificationResult> {
  const result: ScheduleNotificationResult = { ok: true, considered: 0, created: 0, sent: 0, skipped: 0, failed: 0, errors: [] };
  const [occurrencesResult, membersResult] = await Promise.all([
    db.from("company_schedule_occurrences").select("*").eq("current_version", true).eq("notification_owner", "company_schedule").in("lifecycle_status", ["open", "needs_source"]).limit(20000),
    db.from("members").select("member_id,code_name,slack_id,is_admin,status").eq("status", "active").limit(1000),
  ]);
  if (occurrencesResult.error) { result.ok = false; result.errors.push(`occurrences: ${occurrencesResult.error.message}`); return result; }
  if (membersResult.error) { result.ok = false; result.errors.push(`members: ${membersResult.error.message}`); return result; }
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) { result.skipped = (occurrencesResult.data ?? []).length; result.errors.push("SLACK_BOT_TOKEN not set"); return result; }
  const client = new WebClient(token);
  const members = (membersResult.data ?? []) as RawRow[];
  const today = todayJst(options.now);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://amd-os-pwa.vercel.app";
  for (const row of (occurrencesResult.data ?? []) as RawRow[]) {
    const stage = stageFor(row, today);
    if (!stage) { result.skipped += 1; continue; }
    result.considered += 1;
    const recipients = recipientRows(row, members);
    if (recipients.length === 0) { result.skipped += 1; continue; }
    for (const recipient of recipients) {
      const recipientSlackId = String(recipient.slack_id);
      const schedule = scheduleKey(row);
      const existing = await db.from("company_schedule_notifications")
        .select("notification_id,status")
        .eq("occurrence_id", row.occurrence_id)
        .eq("recipient_slack_id", recipientSlackId)
        .eq("schedule_key", schedule)
        .eq("stage", stage)
        .maybeSingle();
      if (existing.error) { result.ok = false; result.errors.push(`ledger lookup: ${existing.error.message}`); continue; }
      if (existing.data) { result.skipped += 1; continue; }
      const { data: ledger, error: insertError } = await db.from("company_schedule_notifications")
        .insert({ occurrence_id: row.occurrence_id, recipient_member_id: recipient.member_id, recipient_slack_id: recipientSlackId, schedule_key: schedule, stage, status: "pending", attempted_at: new Date().toISOString() })
        .select("notification_id")
        .maybeSingle();
      if (insertError || !ledger) {
        // Unique key競合時は別ワーカーが所有しているため、再送しない。
        result.skipped += 1;
        if (insertError && !String(insertError.message).toLowerCase().includes("duplicate")) result.errors.push(`ledger insert: ${insertError.message}`);
        continue;
      }
      result.created += 1;
      try {
        const open = await client.conversations.open({ users: recipientSlackId });
        const channel = open.channel?.id ?? recipientSlackId;
        const text = `運営カレンダー: ${String(row.title)} / ${displayDate(row)}`;
        const message = [
          "*運営カレンダー*",
          `*${String(row.title)}*`,
          `期限: ${displayDate(row)}`,
          row.missing_reason ? `根拠: ${String(row.missing_reason).slice(0, 160)}` : `状態: ${notificationStateLabel(stage)}`,
          `<${baseUrl}/admin/schedule?occurrence=${encodeURIComponent(String(row.occurrence_id))}|詳細を開く>`,
        ].join("\n");
        const posted = await client.chat.postMessage({ channel, text, blocks: [{ type: "section", text: { type: "mrkdwn", text: message } }] });
        const { error: updateError } = await db.from("company_schedule_notifications").update({ status: "sent", slack_channel_id: channel, slack_ts: posted.ts ?? null, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("notification_id", ledger.notification_id);
        if (updateError) { result.ok = false; result.errors.push(`ledger sent update: ${updateError.message}`); }
        else result.sent += 1;
      } catch (error) {
        result.failed += 1;
        result.ok = false;
        const message = error instanceof Error ? error.message : String(error);
        await db.from("company_schedule_notifications").update({ status: "failed", error_message: message.slice(0, 500), updated_at: new Date().toISOString() }).eq("notification_id", ledger.notification_id);
        result.errors.push(`Slack: ${message}`);
      }
    }
  }
  return result;
}
