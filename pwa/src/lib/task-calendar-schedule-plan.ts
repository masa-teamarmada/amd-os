import { normalizePjCode, resolveColorIdForProject } from "./calendar-pj-color.ts";

export type TaskCalendarSource = {
  task_id: string;
  project_id: string;
  project_code?: string | null;
  title: string;
  description?: string | null;
  owner_member_id?: string | null;
  owner_code_name?: string | null;
  owner_calendar_id?: string | null;
  owner_slack_user_id?: string | null;
  manager_calendar_id?: string | null;
  manager_slack_user_id?: string | null;
  due_at?: string | null;
  earliest_start?: string | null;
  latest_end?: string | null;
  estimated_minutes?: number | null;
  priority?: string | null;
  source_kind?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  source_confidence?: number | null;
  source_excerpt?: string | null;
  personal_boundary_risk?: boolean | null;
  external_reply_required?: boolean | null;
};

export type TaskCalendarBusyWindow = {
  calendar_id: string;
  start: string;
  end: string;
};

export type TaskCalendarExistingEvent = {
  id: string;
  calendar_id?: string | null;
  summary?: string | null;
  title?: string | null;
  start?: string | null;
  end?: string | null;
  description?: string | null;
  extendedProperties?: {
    private?: Record<string, string | undefined>;
  } | null;
};

export type TaskCalendarSchedulePlan = {
  task_id: string;
  project_id: string;
  action: "schedule_candidate" | "review_required" | "hold" | "already_scheduled";
  title: string;
  /** その PJ に割り当たっている Google Calendar の event colorId。色を持たない PJ は null */
  color_id: string | null;
  start: string | null;
  end: string | null;
  timezone: "Asia/Tokyo";
  estimated_minutes: number;
  calendars: string[];
  calendar_event_ids: string[];
  calendar_writes: Array<{
    calendar_id: string;
    title: string;
    colorId: string | null;
    start: string;
    end: string;
    description: string;
    attendees: [];
    reminders: { useDefault: false; overrides: Array<{ method: "popup"; minutes: number }> };
    transparency: "opaque";
    extendedProperties: { private: Record<string, string> };
  }>;
  slack_nudge_candidates: Array<{
    slack_user_id: string;
    task_id: string;
    title: string;
    start: string;
    end: string;
    text: string;
  }>;
  review_reasons: string[];
  source_key: string;
};

const DAY_MS = 86400000;

function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function jstDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function jstIso(ymd: string, hhmm: string): string {
  return new Date(`${ymd}T${hhmm}:00+09:00`).toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

function compareIso(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

function clampEstimatedMinutes(task: TaskCalendarSource): number {
  if (typeof task.estimated_minutes === "number" && Number.isFinite(task.estimated_minutes)) {
    return Math.min(240, Math.max(15, Math.round(task.estimated_minutes / 15) * 15));
  }
  const text = `${task.title} ${task.description ?? ""}`.toLowerCase();
  if (/mail|メール|返信|アポ|日程|slack/.test(text)) return 30;
  if (/資料|draft|作成|調査|分析/.test(text)) return 120;
  return 60;
}

function projectCode(task: TaskCalendarSource): string {
  const raw = String(task.project_code || "").trim().replace(/^\+/, "");
  return normalizePjCode(raw || task.project_id) || "AMD";
}

function taskTitle(task: TaskCalendarSource): string {
  const raw = task.title.trim().replace(/^\+/, "").trim();
  return `+${projectCode(task)} ${raw}`.slice(0, 500);
}

function sourceKey(task: TaskCalendarSource): string {
  return task.source_id
    ? `amd-os:${task.source_kind || "task"}:${task.source_id}`
    : `amd-os:task:${task.task_id}`;
}

function isGmailOrSlackTask(task: TaskCalendarSource): boolean {
  return task.source_kind === "gmail_todo" || task.source_kind === "slack_todo";
}

function planningHorizon(task: TaskCalendarSource, now: Date): { start: string; end: string } {
  const earliest = normalizeIso(task.earliest_start) || new Date(now.getTime() + 30 * 60000).toISOString();
  const due = normalizeIso(task.due_at);
  const explicitLatest = normalizeIso(task.latest_end);
  const fallbackEnd = new Date(new Date(earliest).getTime() + 7 * DAY_MS).toISOString();
  return { start: earliest, end: explicitLatest || due || fallbackEnd };
}

function dailyWorkWindows(startIso: string, endIso: string): Array<{ start: string; end: string }> {
  const windows: Array<{ start: string; end: string }> = [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor = new Date(cursor.getTime() + DAY_MS)) {
    const ymd = jstDate(cursor);
    const dayStart = jstIso(ymd, "09:00");
    const dayEnd = jstIso(ymd, "21:00");
    const windowStart = compareIso(dayStart, startIso) < 0 ? startIso : dayStart;
    const windowEnd = compareIso(dayEnd, endIso) > 0 ? endIso : dayEnd;
    if (compareIso(windowStart, windowEnd) < 0) windows.push({ start: windowStart, end: windowEnd });
  }
  return windows;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return compareIso(aStart, bEnd) < 0 && compareIso(bStart, aEnd) < 0;
}

function calendarsForTask(task: TaskCalendarSource): string[] {
  return [...new Set([
    task.owner_calendar_id,
    task.manager_calendar_id || "primary",
  ].map((value) => String(value || "").trim()).filter(Boolean))];
}

function isSlotFree(
  slotStart: string,
  slotEnd: string,
  calendars: string[],
  busyWindows: TaskCalendarBusyWindow[],
): boolean {
  return !busyWindows.some((busy) => {
    if (!calendars.includes(busy.calendar_id)) return false;
    return overlaps(slotStart, slotEnd, busy.start, busy.end);
  });
}

function findFirstCommonSlot(
  task: TaskCalendarSource,
  busyWindows: TaskCalendarBusyWindow[],
  now: Date,
): { start: string; end: string } | null {
  const estimated = clampEstimatedMinutes(task);
  const horizon = planningHorizon(task, now);
  for (const window of dailyWorkWindows(horizon.start, horizon.end)) {
    let cursor = window.start;
    while (compareIso(addMinutes(cursor, estimated), window.end) <= 0) {
      const slotEnd = addMinutes(cursor, estimated);
      if (isSlotFree(cursor, slotEnd, calendarsForTask(task), busyWindows)) {
        return { start: cursor, end: slotEnd };
      }
      cursor = addMinutes(cursor, 15);
    }
  }
  return null;
}

function descriptionForTask(task: TaskCalendarSource): string {
  return [
    "AMD OS task schedule",
    `Task: ${task.task_id}`,
    `PJ: ${task.project_id}`,
    task.owner_member_id ? `Owner: ${task.owner_member_id}${task.owner_code_name ? ` (${task.owner_code_name})` : ""}` : null,
    task.source_kind ? `Source kind: ${task.source_kind}` : null,
    task.source_url ? `Source URL: ${task.source_url}` : null,
    task.due_at ? `Due: ${task.due_at}` : null,
    task.description ? `Note: ${task.description.slice(0, 700)}` : null,
    task.source_excerpt ? `Source excerpt: ${task.source_excerpt.slice(0, 240)}` : null,
    task.external_reply_required ? "External reply: work block only; no reply is sent by Calendar scheduling." : null,
    `Source key: ${sourceKey(task)}`,
    "",
    "Created as a + task block. External attendees are intentionally not invited.",
  ].filter(Boolean).join("\n").slice(0, 1800);
}

function metadataForTask(task: TaskCalendarSource): Record<string, string> {
  return {
    amd_os_task_id: task.task_id,
    amd_os_project_id: task.project_id,
    amd_os_source_kind: task.source_kind || "task",
    amd_os_task_source_key: sourceKey(task),
  };
}

function slackNudgeCandidatesForTask(
  task: TaskCalendarSource,
  title: string,
  slot: { start: string; end: string } | null,
): TaskCalendarSchedulePlan["slack_nudge_candidates"] {
  if (!slot) return [];
  const userIds = [...new Set([
    task.owner_slack_user_id,
    task.manager_slack_user_id,
  ].map((value) => String(value || "").trim()).filter(Boolean))];
  return userIds.map((slackUserId) => ({
    slack_user_id: slackUserId,
    task_id: task.task_id,
    title,
    start: slot.start,
    end: slot.end,
    text: [
      `カレンダーにこの作業予定を入れたよ: ${title}`,
      `時間: ${slot.start} - ${slot.end}`,
      task.source_url ? `元: ${task.source_url}` : `Source key: ${sourceKey(task)}`,
      "外部返信や招待は送ってないよ。",
    ].join("\n"),
  }));
}

function existingTaskEventMatches(
  task: TaskCalendarSource,
  title: string,
  existingEvents: TaskCalendarExistingEvent[],
): TaskCalendarExistingEvent[] {
  const key = sourceKey(task);
  return existingEvents.filter((event) => {
    const privateProps = event.extendedProperties?.private || {};
    if (privateProps.amd_os_task_source_key === key) return true;
    if (privateProps.amd_os_task_id === task.task_id) return true;
    if (typeof event.description === "string" && event.description.includes(`Source key: ${key}`)) return true;
    const eventTitle = String(event.summary || event.title || "").trim();
    return !task.source_id && eventTitle === title && typeof event.start === "string";
  });
}

export function buildTaskCalendarSchedulePlan(
  task: TaskCalendarSource,
  busyWindows: TaskCalendarBusyWindow[] = [],
  existingEvents: TaskCalendarExistingEvent[] = [],
  now: Date = new Date(),
): TaskCalendarSchedulePlan {
  const reviewReasons: string[] = [];
  if (!task.task_id || !task.project_id || !task.title.trim()) reviewReasons.push("missing_required_task_fields");
  if (isGmailOrSlackTask(task) && !task.owner_member_id) reviewReasons.push("missing_task_owner");
  if (isGmailOrSlackTask(task) && typeof task.source_confidence === "number" && task.source_confidence < 0.75) {
    reviewReasons.push("low_source_confidence");
  }
  if (task.personal_boundary_risk) reviewReasons.push("personal_boundary_review");
  if (!task.owner_calendar_id) reviewReasons.push("missing_task_owner_calendar");
  const calendars = calendarsForTask(task);
  if (calendars.length === 0) reviewReasons.push("missing_target_calendars");

  const estimated = clampEstimatedMinutes(task);
  const title = taskTitle(task);
  const colorId = resolveColorIdForProject(task.project_code || task.project_id, now);
  const existingMatches = existingTaskEventMatches(task, title, existingEvents);
  const alreadyScheduled = existingMatches.length > 0;
  const blockingBeforeSlot = reviewReasons.some((reason) => [
    "missing_required_task_fields",
    "missing_task_owner_calendar",
    "missing_target_calendars",
    "personal_boundary_review",
  ].includes(reason));
  const slot = !blockingBeforeSlot && !alreadyScheduled ? findFirstCommonSlot(task, busyWindows, now) : null;
  if (!slot && !blockingBeforeSlot && !alreadyScheduled) reviewReasons.push("no_common_free_slot");

  const action = alreadyScheduled
    ? "already_scheduled"
    : reviewReasons.length > 0 ? (slot ? "review_required" : "hold") : "schedule_candidate";
  const writes = slot
    ? calendars.map((calendarId) => ({
        calendar_id: calendarId,
        title,
        colorId,
        start: slot.start,
        end: slot.end,
        description: descriptionForTask(task),
        attendees: [] as [],
        reminders: { useDefault: false as const, overrides: [{ method: "popup" as const, minutes: 10 }] },
        transparency: "opaque" as const,
        extendedProperties: { private: metadataForTask(task) },
      }))
    : [];
  const slackNudges = action === "schedule_candidate"
    ? slackNudgeCandidatesForTask(task, title, slot)
    : [];

  return {
    task_id: task.task_id,
    project_id: task.project_id,
    action,
    title,
    color_id: colorId,
    start: slot?.start ?? null,
    end: slot?.end ?? null,
    timezone: "Asia/Tokyo",
    estimated_minutes: estimated,
    calendars,
    calendar_event_ids: existingMatches.map((event) => event.id),
    calendar_writes: writes,
    slack_nudge_candidates: slackNudges,
    review_reasons: reviewReasons,
    source_key: sourceKey(task),
  };
}

export function buildTaskCalendarSchedulePlans(
  tasks: TaskCalendarSource[],
  busyWindows: TaskCalendarBusyWindow[] = [],
  existingEvents: TaskCalendarExistingEvent[] = [],
  now: Date = new Date(),
): TaskCalendarSchedulePlan[] {
  const occupied = [...busyWindows];
  const plans: TaskCalendarSchedulePlan[] = [];
  for (const task of tasks) {
    const plan = buildTaskCalendarSchedulePlan(task, occupied, existingEvents, now);
    plans.push(plan);
    for (const write of plan.calendar_writes) {
      occupied.push({ calendar_id: write.calendar_id, start: write.start, end: write.end });
    }
  }
  return plans;
}
