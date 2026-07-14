/**
 * POST /api/meeting-prep/calendar-sync
 *
 * Deterministic future Calendar event -> upcoming meeting prep card sync.
 *
 * Calendar access itself stays in the L2-6 Claude routine via Google Calendar MCP.
 * This route receives already-read event metadata, resolves the AMD project,
 * and stores confirmed future meetings as project_meeting_summaries rows.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ProjectRow = {
  project_id: string;
  project_name: string | null;
  client_name: string | null;
  status: string | null;
};

const PROJECT_MATCH_ALIASES_BY_ID: Record<string, string[]> = {
  p19: ["ZeMA", "葛飾水素循環"],
  p21: ["SolvioraX"],
};

type ExistingPrepRow = {
  meeting_id: string;
  generated_by_model: string | null;
  prep_status: string | null;
  source_hash: string | null;
  summary_short: string | null;
  narrative_md: string | null;
};

type CalendarEventInput = {
  id?: unknown;
  event_id?: unknown;
  calendar_event_id?: unknown;
  recurring_event_id?: unknown;
  recurringEventId?: unknown;
  recurrence?: unknown;
  title?: unknown;
  summary?: unknown;
  start?: unknown;
  start_at?: unknown;
  start_time?: unknown;
  startISO?: unknown;
  end?: unknown;
  end_at?: unknown;
  end_time?: unknown;
  url?: unknown;
  htmlLink?: unknown;
  source_url?: unknown;
  description?: unknown;
  location?: unknown;
  project_id?: unknown;
  drive_files?: unknown;
};

type NormalizedEvent = {
  eventId: string;
  title: string;
  startIso: string;
  endIso: string | null;
  meetingDate: string;
  sourceUrl: string | null;
  description: string;
  location: string;
  forcedProjectId: string | null;
  recurringEventId: string | null;
  recurrenceRules: string[];
  driveFiles: DriveFileRef[];
};

type DriveFileRef = {
  title: string;
  url: string;
  mimeType: string | null;
  modifiedTime: string | null;
  snippet: string | null;
};

type MatchedCalendarEvent = {
  inputIndex: number;
  event: NormalizedEvent;
  project: ProjectRow;
  reason: string;
};

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function jstDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatJst(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function maybeFormatJst(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : formatJst(iso);
}

function normalizeForMatch(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeDriveFiles(value: unknown): DriveFileRef[] {
  if (!Array.isArray(value)) return [];
  const out: DriveFileRef[] = [];
  const seen = new Set<string>();
  for (const raw of value.slice(0, 12)) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const title = pickString(rec.title, rec.name).slice(0, 240);
    const url = pickString(rec.url, rec.web_url, rec.webViewLink, rec.alternateLink);
    if (!title || !url) continue;
    const key = url || title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title,
      url,
      mimeType: pickString(rec.mime_type, rec.mimeType) || null,
      modifiedTime: pickString(rec.modified_time, rec.modifiedTime) || null,
      snippet: pickString(rec.snippet, rec.text, rec.excerpt).replace(/\s+/g, " ").slice(0, 500) || null,
    });
  }
  return out;
}

function normalizeRecurrenceRules(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

function companyNameVariants(value: string): string[] {
  const normalized = value
    .replace(/株式会社/g, "")
    .replace(/合同会社/g, "")
    .replace(/\binc\.?\b/gi, "")
    .replace(/\bcorp\.?\b/gi, "")
    .trim();
  return normalized && normalized !== value ? [normalized] : [];
}

function aliasesForProject(project: ProjectRow): Array<{ value: string; score: number }> {
  const aliases: Array<{ value: string; score: number }> = [];
  const add = (value: string | null | undefined, score: number) => {
    const v = String(value || "").trim();
    if (!v) return;
    aliases.push({ value: v, score });
    for (const variant of companyNameVariants(v)) aliases.push({ value: variant, score: score - 8 });
  };
  add(project.project_name, 100);
  add(project.client_name, 92);
  add(project.project_id, 80);
  for (const alias of PROJECT_MATCH_ALIASES_BY_ID[project.project_id] ?? []) add(alias, 96);
  return aliases;
}

function matchProject(event: NormalizedEvent, projects: ProjectRow[]): { project: ProjectRow | null; reason: string } {
  if (event.forcedProjectId) {
    const project = projects.find((p) => p.project_id === event.forcedProjectId) ?? null;
    return project ? { project, reason: "forced_project_id" } : { project: null, reason: `forced_project_not_found:${event.forcedProjectId}` };
  }

  const haystack = normalizeForMatch([
    event.title,
    event.description,
    event.location,
  ].filter(Boolean).join(" "));

  let best: { project: ProjectRow; score: number; alias: string } | null = null;
  let tied = false;
  for (const project of projects) {
    for (const alias of aliasesForProject(project)) {
      const needle = normalizeForMatch(alias.value);
      if (!needle || needle.length < 2) continue;
      if (!haystack.includes(needle)) continue;
      if (!best || alias.score > best.score) {
        best = { project, score: alias.score, alias: alias.value };
        tied = false;
      } else if (alias.score === best.score && project.project_id !== best.project.project_id) {
        tied = true;
      }
    }
  }

  if (!best) return { project: null, reason: "no_project_match" };
  if (tied) return { project: null, reason: "ambiguous_project_match" };
  return { project: best.project, reason: `matched:${best.alias}` };
}

function normalizeEvent(input: CalendarEventInput): { event: NormalizedEvent | null; reason: string } {
  const eventId = pickString(input.calendar_event_id, input.event_id, input.id);
  const title = pickString(input.title, input.summary);
  const startIso = normalizeIso(input.start_at) || normalizeIso(input.start_time) || normalizeIso(input.startISO) || normalizeIso(input.start);
  const endIso = normalizeIso(input.end_at) || normalizeIso(input.end_time) || normalizeIso(input.end);
  if (!eventId) return { event: null, reason: "missing_event_id" };
  if (!title) return { event: null, reason: "missing_title" };
  if (title.startsWith("+") || title.startsWith("＋")) return { event: null, reason: "tentative_calendar_title" };
  if (!startIso) return { event: null, reason: "missing_timed_start" };

  return {
    event: {
      eventId,
      title,
      startIso,
      endIso,
      meetingDate: jstDate(startIso),
      sourceUrl: pickString(input.source_url, input.url, input.htmlLink) || null,
      description: pickString(input.description),
      location: pickString(input.location),
      forcedProjectId: pickString(input.project_id) || null,
      recurringEventId: pickString(input.recurring_event_id, input.recurringEventId) || null,
      recurrenceRules: normalizeRecurrenceRules(input.recurrence),
      driveFiles: normalizeDriveFiles(input.drive_files),
    },
    reason: "ok",
  };
}

function normalizeSeriesTitle(value: string): string {
  return normalizeForMatch(value)
    .replace(/\b\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jstWeekdayKey(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? "unknown" : String(d.getDay());
}

function jstTimeKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("hour")}:${get("minute")}`;
}

function dayNumber(ymd: string): number {
  const [year, month, day] = ymd.split("-").map((v) => Number(v));
  if (!year || !month || !day) return Number.NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function looksSeriesLikeTitle(title: string): boolean {
  return /定例|毎週|隔週|月次|毎月|weekly|biweekly|monthly/i.test(title);
}

function recurringSeriesKey(item: MatchedCalendarEvent): string {
  if (item.event.recurringEventId) {
    return `recurring:${item.project.project_id}:${item.event.recurringEventId}`;
  }
  const title = normalizeSeriesTitle(item.event.title) || "(untitled)";
  const time = jstTimeKey(item.event.startIso);
  const location = normalizeForMatch(item.event.location).slice(0, 80);
  if (looksSeriesLikeTitle(item.event.title)) {
    return `title-series:${item.project.project_id}:${title}:${time}:${location}`;
  }
  const weekday = jstWeekdayKey(item.event.meetingDate);
  return `fallback:${item.project.project_id}:${title}:${weekday}:${time}:${location}`;
}

function isWeeklyCadence(items: MatchedCalendarEvent[], hasExplicitSeriesId: boolean): boolean {
  if (items.length < (hasExplicitSeriesId ? 2 : 3)) return false;
  const ordered = [...items].sort((a, b) => a.event.startIso.localeCompare(b.event.startIso));
  let weeklyPairs = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = dayNumber(ordered[i - 1].event.meetingDate);
    const current = dayNumber(ordered[i].event.meetingDate);
    if (!Number.isFinite(prev) || !Number.isFinite(current)) continue;
    const diff = current - prev;
    if (diff >= 6 && diff <= 8) weeklyPairs += 1;
  }
  const requiredPairs = hasExplicitSeriesId ? 1 : Math.max(2, Math.floor((ordered.length - 1) * 0.6));
  return weeklyPairs >= requiredPairs;
}

function findExtraRecurringOccurrences(items: MatchedCalendarEvent[]): Map<number, { kept: MatchedCalendarEvent; seriesKey: string }> {
  const groups = new Map<string, MatchedCalendarEvent[]>();
  for (const item of items) {
    const key = recurringSeriesKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const hidden = new Map<number, { kept: MatchedCalendarEvent; seriesKey: string }>();
  for (const [seriesKey, group] of groups) {
    const hasExplicitSeriesId = seriesKey.startsWith("recurring:");
    const hasTitleSeriesKey = seriesKey.startsWith("title-series:");
    const hasWeeklyRule = group.some((item) => item.event.recurrenceRules.some((rule) => /FREQ=WEEKLY/i.test(rule)));
    if (!hasExplicitSeriesId && !hasTitleSeriesKey && !hasWeeklyRule && !isWeeklyCadence(group, false)) continue;
    const ordered = [...group].sort((a, b) => a.event.startIso.localeCompare(b.event.startIso));
    const kept = ordered[0];
    for (const item of ordered.slice(1)) hidden.set(item.inputIndex, { kept, seriesKey });
  }
  return hidden;
}

function buildCalendarHash(event: NormalizedEvent, projectId: string): string {
  return sha256(JSON.stringify({
    revision: "calendar-sync-v2",
    projectId,
    eventId: event.eventId,
    title: event.title,
    startIso: event.startIso,
    endIso: event.endIso,
    sourceUrl: event.sourceUrl,
    description: event.description.slice(0, 1000),
    location: event.location,
    recurringEventId: event.recurringEventId,
    recurrenceRules: event.recurrenceRules,
    driveFiles: event.driveFiles.map((f) => ({
      title: f.title,
      url: f.url,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      snippet: f.snippet,
    })),
  }));
}

function buildPrepBody(event: NormalizedEvent, project: ProjectRow) {
  const projectName = project.project_name || project.project_id;
  const displayTitle = normalizeForMatch(event.title).startsWith(normalizeForMatch(projectName))
    ? event.title
    : `${projectName}の${event.title}`;
  const when = formatJst(event.startIso);
  const eventContext = [
    event.location ? `場所: ${event.location}` : "",
    event.description ? `Calendarメモ: ${event.description.replace(/\s+/g, " ").trim().slice(0, 500)}` : "",
  ].filter(Boolean);
  const driveLines = event.driveFiles.slice(0, 8).map((file) => {
    const modified = maybeFormatJst(file.modifiedTime);
    const meta = [
      file.mimeType ? file.mimeType.split("/").pop() : "",
      modified ? `更新: ${modified}` : "",
    ].filter(Boolean).join(" / ");
    const snippet = file.snippet ? ` — ${file.snippet}` : "";
    return `- [${file.title}](${file.url})${meta ? ` (${meta})` : ""}${snippet}`;
  });
  const driveSummary = event.driveFiles.length > 0
    ? `関連Drive資料${event.driveFiles.length}件も確認済み。`
    : "";

  return {
    summaryShort: `${displayTitle}。Calendarで日時確定済みのため、開催前/当日の論点と資料を整理する。${driveSummary}`,
    decided: [`${event.title}で確認・決定すべき論点を事前に整理する。`],
    progress: [
      `Calendar上で ${when} の開催が確定している。`,
      ...(event.driveFiles.length > 0 ? [`Drive上で関連資料${event.driveFiles.length}件を確認している。`] : []),
    ],
    nextActions: [
      event.driveFiles.length > 0
        ? "Drive関連資料、前回までの論点、当日確認したい質問を確認する。"
        : "関連資料、前回までの論点、当日確認したい質問を確認する。",
    ],
    risks: [
      "Calendar予定だけでは議題・資料・意思決定範囲が不足している可能性がある。",
      ...(event.driveFiles.length > 0 ? ["Drive資料は会議関連候補として自動紐付けしたものなので、最終的な議案・決議範囲は当日資料で確認する。"] : []),
    ],
    narrativeMd: [
      "## 予定",
      `- PJ: ${projectName}`,
      `- MTG: ${event.title}`,
      `- 日時: ${when}`,
      event.sourceUrl ? `- Calendar: ${event.sourceUrl}` : "",
      eventContext.length ? "" : "",
      ...eventContext.map((line) => `- ${line}`),
      driveLines.length ? "" : "",
      driveLines.length ? "## 関連Drive資料" : "",
      ...driveLines,
      "",
      "## 見ること",
      "このカードは、Calendarで確定しているMTGをOS上の準備ブリーフとして見えるようにするためのもの。議事録や資料がまだ入っていない場合でも、確認したい論点、資料、質問をここに追記する。",
    ].filter(Boolean).join("\n"),
  };
}

async function authorize(req: NextRequest): Promise<{ ok: true; createdBy: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const workflowSecret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (workflowSecret && auth === `Bearer ${workflowSecret}`) return { ok: true, createdBy: "workflow" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) {
    return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, createdBy: member.code_name || user.email };
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawEvents = Array.isArray(body.events)
    ? body.events
    : Array.isArray(body.calendar_events)
      ? body.calendar_events
      : [];
  if (rawEvents.length === 0) {
    return NextResponse.json({ error: "events array required" }, { status: 400 });
  }
  const dryRun = body.dry_run === true;
  const nowIso = new Date().toISOString();
  const currentMeetingDate = jstDate(nowIso);
  const projectIds = Array.isArray(body.project_ids)
    ? body.project_ids.map((v) => String(v).trim()).filter(Boolean)
    : [];

  const admin = createAdminClient();
  let projectQuery = admin
    .from("projects")
    .select("project_id,project_name,client_name,status")
    .in("status", ["active", "sales"]);
  if (projectIds.length > 0) projectQuery = projectQuery.in("project_id", projectIds);
  const { data: projectsData, error: projectError } = await projectQuery;
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  const projects = (projectsData ?? []) as ProjectRow[];

  const results: Array<Record<string, unknown> | null> = new Array(rawEvents.length).fill(null);
  const matchedEvents: MatchedCalendarEvent[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let inputIndex = 0; inputIndex < rawEvents.length; inputIndex += 1) {
    const raw = rawEvents[inputIndex];
    const { event, reason } = normalizeEvent((raw ?? {}) as CalendarEventInput);
    if (!event) {
      skipped += 1;
      results[inputIndex] = { ok: false, reason };
      continue;
    }
    if (event.meetingDate < currentMeetingDate) {
      skipped += 1;
      results[inputIndex] = { ok: false, reason: "past_event", calendar_event_id: event.eventId, title: event.title, start: event.startIso };
      continue;
    }

    const match = matchProject(event, projects);
    if (!match.project) {
      skipped += 1;
      results[inputIndex] = { ok: false, reason: match.reason, calendar_event_id: event.eventId, title: event.title, start: event.startIso };
      continue;
    }

    matchedEvents.push({ inputIndex, event, project: match.project, reason: match.reason });
  }

  const extraRecurringOccurrences = findExtraRecurringOccurrences(matchedEvents);

  for (const matched of matchedEvents) {
    const { inputIndex, event } = matched;
    const recurringSkip = extraRecurringOccurrences.get(inputIndex);
    if (recurringSkip) {
      skipped += 1;
      results[inputIndex] = {
        ok: false,
        reason: "recurring_series_future_occurrence",
        calendar_event_id: event.eventId,
        title: event.title,
        meeting_start_at: event.startIso,
        project_id: matched.project.project_id,
        kept_meeting_id: `upcoming:${recurringSkip.kept.event.eventId}`,
        series_key: recurringSkip.seriesKey,
      };
      continue;
    }

    const meetingId = `upcoming:${event.eventId}`;
    const sourceHash = buildCalendarHash(event, matched.project.project_id);
    const { data: existingData, error: existingError } = await admin
      .from("project_meeting_summaries")
      .select("meeting_id,generated_by_model,prep_status,source_hash,summary_short,narrative_md")
      .eq("meeting_id", meetingId)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    const existing = existingData as ExistingPrepRow | null;
    if (existing?.source_hash === sourceHash) {
      skipped += 1;
      results[inputIndex] = { ok: true, mode: "unchanged", meeting_id: meetingId, project_id: matched.project.project_id, reason: matched.reason };
      continue;
    }

    const bodyText = buildPrepBody(event, matched.project);
    const baseRow = {
      meeting_id: meetingId,
      project_id: matched.project.project_id,
      ym: event.meetingDate.slice(0, 4) + event.meetingDate.slice(5, 7),
      meeting_date: event.meetingDate,
      meeting_start_at: event.startIso,
      title: event.title.slice(0, 500),
      notion_url: null,
      notion_page_id: null,
      calendar_event_id: event.eventId,
      source_url: event.sourceUrl,
      gmail_thread_ids: [],
      source_kinds: "upcoming",
      source_hash: sourceHash,
      prep_status: existing?.prep_status || "draft",
      updated_at: nowIso,
    };
    const shouldPreserveManualBody = !!existing && existing.generated_by_model !== "calendar-future-sync";
    const writeRow = shouldPreserveManualBody
      ? baseRow
      : {
          ...baseRow,
          summary_short: bodyText.summaryShort,
          decided: bodyText.decided,
          progress: bodyText.progress,
          next_actions: bodyText.nextActions,
          risks: bodyText.risks,
          narrative_md: bodyText.narrativeMd,
          generated_by_model: "calendar-future-sync",
          generated_at: nowIso,
        };

    if (!dryRun) {
      const { error: upsertError } = await admin
        .from("project_meeting_summaries")
        .upsert(writeRow, { onConflict: "meeting_id" });
      if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    if (existing) updated += 1;
    else created += 1;
    results[inputIndex] = {
      ok: true,
      mode: existing ? "updated" : "created",
      preserve_manual_body: shouldPreserveManualBody,
      meeting_id: meetingId,
      project_id: matched.project.project_id,
      title: event.title,
      meeting_start_at: event.startIso,
      reason: matched.reason,
      dry_run: dryRun,
    };
  }

  return NextResponse.json({
    ok: true,
    created,
    updated,
    skipped,
    total: rawEvents.length,
    created_by: authz.createdBy,
    results: results.filter((result): result is Record<string, unknown> => result !== null),
  });
}
