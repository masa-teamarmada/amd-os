import crypto from "crypto";

export type MeetingCalendarSource = {
  meeting_id: string;
  project_id: string;
  title: string;
  meeting_date: string;
  meeting_start_at?: string | null;
  meeting_end_at?: string | null;
  calendar_event_id?: string | null;
  source_url?: string | null;
  notion_url?: string | null;
  source_kinds?: string | null;
  summary_short?: string | null;
  narrative_md?: string | null;
  location?: string | null;
  modality?: "online" | "onsite" | "hybrid" | "unknown" | string | null;
  attendee_emails?: string[] | null;
  carry_items?: string[] | null;
  homework_items?: string[] | null;
  reply_required?: boolean | null;
  invite_attendees?: boolean | null;
  date_confidence?: "high" | "medium" | "low" | string | null;
};

export type ExistingCalendarEvent = {
  id?: string | null;
  event_id?: string | null;
  calendar_event_id?: string | null;
  title?: string | null;
  summary?: string | null;
  start?: string | null;
  start_at?: string | null;
  end?: string | null;
  end_at?: string | null;
  location?: string | null;
  htmlLink?: string | null;
  source_url?: string | null;
  attendees?: Array<{ email?: string | null; displayName?: string | null }> | null;
  extendedProperties?: {
    private?: Record<string, string | null | undefined> | null;
  } | null;
};

export type MeetingCalendarUpsertAction =
  | "update_existing"
  | "create_candidate"
  | "review_required"
  | "hold";

export type MeetingCalendarUpsertPlan = {
  meeting_id: string;
  project_id: string;
  action: MeetingCalendarUpsertAction;
  auto_write_eligible: boolean;
  requires_review_before_write: boolean;
  target_event_id: string | null;
  idempotency_key: string;
  duplicate_match: {
    event_id: string;
    reason: string;
    confidence: "high" | "medium";
  } | null;
  review_reasons: string[];
  risk_flags: string[];
  proposed_payload: {
    summary: string;
    start: { dateTime: string; timeZone: "Asia/Tokyo" };
    end: { dateTime: string; timeZone: "Asia/Tokyo" };
    location?: string;
    description: string;
    attendees: [];
    reminders: { useDefault: false; overrides: Array<{ method: "popup"; minutes: number }> };
    extendedProperties: { private: Record<string, string> };
  } | null;
  sendUpdates: "none";
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[()[\]{}<>【】「」『』、。・:：/\\|_\-+~!?,，.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function jstDateFromIso(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function jstBlockIso(ymd: string, hour: number): string {
  const hh = String(hour).padStart(2, "0");
  return new Date(`${ymd}T${hh}:00:00+09:00`).toISOString();
}

function addHoursIso(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function validYmd(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function eventIdOf(event: ExistingCalendarEvent): string {
  return pickString(event.calendar_event_id, event.event_id, event.id);
}

function titleOf(event: ExistingCalendarEvent): string {
  return pickString(event.title, event.summary);
}

function startOf(event: ExistingCalendarEvent): string | null {
  return normalizeIso(event.start_at) || normalizeIso(event.start);
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 2),
  );
}

function titleOverlap(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / Math.max(left.size, right.size);
}

function privateProps(event: ExistingCalendarEvent): Record<string, string | null | undefined> {
  return event.extendedProperties?.private ?? {};
}

function findDuplicate(
  source: MeetingCalendarSource,
  existingEvents: ExistingCalendarEvent[],
  idempotencyKey: string,
): MeetingCalendarUpsertPlan["duplicate_match"] {
  const expectedEventId = pickString(source.calendar_event_id);
  for (const event of existingEvents) {
    const eventId = eventIdOf(event);
    if (expectedEventId && eventId === expectedEventId) {
      return { event_id: eventId, reason: "calendar_event_id_exact", confidence: "high" };
    }
    const props = privateProps(event);
    if (
      props.amd_os_mtg_card_id === source.meeting_id ||
      props.amd_os_source_key === idempotencyKey
    ) {
      return { event_id: eventId, reason: "extended_properties_exact", confidence: "high" };
    }
  }

  const sourceTitle = pickString(source.title);
  const sourceDate = validYmd(source.meeting_date);
  for (const event of existingEvents) {
    const eventStart = startOf(event);
    if (!eventStart || !sourceDate) continue;
    if (jstDateFromIso(eventStart) !== sourceDate) continue;
    const overlap = titleOverlap(sourceTitle, titleOf(event));
    const locationMatch =
      !!source.location &&
      !!event.location &&
      normalizeText(source.location).includes(normalizeText(event.location).slice(0, 20));
    if (overlap >= 0.72 || (overlap >= 0.48 && locationMatch)) {
      return {
        event_id: eventIdOf(event),
        reason: locationMatch ? "same_date_title_location" : "same_date_title",
        confidence: overlap >= 0.72 ? "high" : "medium",
      };
    }
  }
  return null;
}

function detectRiskFlags(source: MeetingCalendarSource): string[] {
  const text = normalizeText([
    source.title,
    source.summary_short,
    source.narrative_md,
    source.location,
    source.modality,
    ...(source.carry_items ?? []),
    ...(source.homework_items ?? []),
  ].join(" "));
  const flags: string[] = [];
  const has = (words: string[]) => words.some((word) => text.includes(normalizeText(word)));
  if (source.modality === "onsite" || has(["対面", "訪問", "現地", "往訪", "来訪", "オフライン"])) flags.push("onsite");
  if (has(["初回", "キックオフ", "kickoff", "first meeting"])) flags.push("first_meeting");
  if (has(["大学", "工学院", "香川大", "研究室", "教授", "先生"])) flags.push("university_or_research_partner");
  if (has(["顧客", "先方", "クライアント", "取引先"])) flags.push("external_partner");
  if ((source.carry_items ?? []).length > 0 || has(["持参", "持ち物", "持っていく", "印刷", "名刺"])) flags.push("carry_items");
  if ((source.homework_items ?? []).length > 0 || has(["宿題", "事前", "準備", "資料"])) flags.push("homework");
  if (source.reply_required || has(["返信", "返事", "回答", "要返信"])) flags.push("reply_required");
  if (has(["出張直後", "帰京直後", "移動直後"])) flags.push("post_trip");
  return [...new Set(flags)];
}

function buildReminders(strong: boolean, dateOnly: boolean): Array<{ method: "popup"; minutes: number }> {
  const minutes = strong
    ? dateOnly
      ? [24 * 60, 12 * 60, 3 * 60]
      : [24 * 60, 3 * 60, 60, 10]
    : [60, 10];
  return minutes.map((value) => ({ method: "popup" as const, minutes: value }));
}

function compactLines(lines: Array<string | null | undefined>): string {
  return lines
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function buildDescription(source: MeetingCalendarSource, flags: string[]): string {
  const items = (source.carry_items ?? []).slice(0, 8);
  const homework = (source.homework_items ?? []).slice(0, 8);
  return compactLines([
    "AMD OS MTG card sync candidate",
    `PJ: ${source.project_id}`,
    `MTG card: ${source.meeting_id}`,
    `Source kind: ${source.source_kinds || "project_meeting_summaries"}`,
    source.source_url ? `OS/Calendar source: ${source.source_url}` : null,
    source.notion_url ? `Notion: ${source.notion_url}` : null,
    flags.length ? `Reminder flags: ${flags.join(", ")}` : null,
    items.length ? `Carry items: ${items.join(" / ")}` : null,
    homework.length ? `Homework: ${homework.join(" / ")}` : null,
    source.reply_required ? "Reply required: yes" : null,
    "",
    "External attendees are intentionally not auto-invited by AMD OS.",
  ]).slice(0, 1800);
}

function sourceKey(source: MeetingCalendarSource): string {
  if (source.calendar_event_id) return `calendar:${source.calendar_event_id}`;
  return `amd-os:project_meeting_summaries:${source.meeting_id}`;
}

export function buildMeetingCalendarUpsertPlan(
  source: MeetingCalendarSource,
  existingEvents: ExistingCalendarEvent[] = [],
): MeetingCalendarUpsertPlan {
  const reviewReasons: string[] = [];
  const title = pickString(source.title);
  const meetingDate = validYmd(source.meeting_date);
  const idempotencyKey = sourceKey(source);

  if (!source.meeting_id || !source.project_id || !title || !meetingDate) {
    return {
      meeting_id: source.meeting_id || "",
      project_id: source.project_id || "",
      action: "hold",
      auto_write_eligible: false,
      requires_review_before_write: true,
      target_event_id: null,
      idempotency_key: idempotencyKey,
      duplicate_match: null,
      review_reasons: ["missing_required_meeting_fields"],
      risk_flags: [],
      proposed_payload: null,
      sendUpdates: "none",
    };
  }

  const startIso = normalizeIso(source.meeting_start_at);
  const endIso = normalizeIso(source.meeting_end_at);
  const dateOnly = !startIso;
  const proposedStart = startIso || jstBlockIso(meetingDate, 8);
  const proposedEnd = endIso || (dateOnly ? jstBlockIso(meetingDate, 21) : addHoursIso(proposedStart, 1));
  const duplicate = findDuplicate(source, existingEvents, idempotencyKey);
  const flags = detectRiskFlags(source);
  const strongReminder = flags.some((flag) => [
    "onsite",
    "first_meeting",
    "university_or_research_partner",
    "external_partner",
    "carry_items",
    "post_trip",
  ].includes(flag));

  if (source.date_confidence === "low") reviewReasons.push("low_date_confidence");
  if (dateOnly) reviewReasons.push("date_only_wide_0800_2100_block");
  if (source.invite_attendees) reviewReasons.push("external_attendee_invite_requested");
  if ((source.attendee_emails ?? []).length > 0) reviewReasons.push("attendees_kept_metadata_only_not_invited");

  const targetEventId = duplicate?.event_id || pickString(source.calendar_event_id) || null;
  let action: MeetingCalendarUpsertAction;
  if (source.date_confidence === "low") {
    action = "hold";
  } else if (targetEventId) {
    action = "update_existing";
  } else if (reviewReasons.length > 0) {
    action = "review_required";
  } else {
    action = "create_candidate";
  }

  const requiresReview = action === "review_required" || action === "hold" || reviewReasons.includes("external_attendee_invite_requested");
  const autoWriteEligible = !requiresReview && (action === "update_existing" || action === "create_candidate");
  const privateProperties: Record<string, string> = {
    amd_os_mtg_card_id: source.meeting_id,
    amd_os_project_id: source.project_id,
    amd_os_source_kind: source.source_kinds || "project_meeting_summaries",
    amd_os_source_key: idempotencyKey,
    amd_os_plan_hash: sha256(JSON.stringify({
      meeting_id: source.meeting_id,
      project_id: source.project_id,
      title,
      meetingDate,
      proposedStart,
      proposedEnd,
      targetEventId,
    })).slice(0, 32),
  };

  const proposedPayload = {
    summary: title.slice(0, 500),
    start: { dateTime: proposedStart, timeZone: "Asia/Tokyo" as const },
    end: { dateTime: proposedEnd, timeZone: "Asia/Tokyo" as const },
    ...(source.location ? { location: source.location.slice(0, 500) } : {}),
    description: buildDescription(source, flags),
    attendees: [] as [],
    reminders: {
      useDefault: false as const,
      overrides: buildReminders(strongReminder, dateOnly),
    },
    extendedProperties: { private: privateProperties },
  };

  return {
    meeting_id: source.meeting_id,
    project_id: source.project_id,
    action,
    auto_write_eligible: autoWriteEligible,
    requires_review_before_write: requiresReview,
    target_event_id: targetEventId,
    idempotency_key: idempotencyKey,
    duplicate_match: duplicate,
    review_reasons: reviewReasons,
    risk_flags: flags,
    proposed_payload: proposedPayload,
    sendUpdates: "none",
  };
}

export function buildMeetingCalendarUpsertPlans(
  sources: MeetingCalendarSource[],
  existingEvents: ExistingCalendarEvent[] = [],
): MeetingCalendarUpsertPlan[] {
  return sources.map((source) => buildMeetingCalendarUpsertPlan(source, existingEvents));
}
