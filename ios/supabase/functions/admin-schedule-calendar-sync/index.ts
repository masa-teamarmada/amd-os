/**
 * AMD OS 管理カレンダーを Google Calendar の共有カレンダーへ同期する。
 *
 * - company_schedule_occurrences が正本。Google Calendar は読み取り用の投影。
 * - active admin 全員へ reader 共有し、個人の予定表へ重複作成しない。
 * - 日付確定済みの当日〜8か月後末だけを、終日・予定ありにしない形で同期する。
 *
 * Required secrets:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CAL_API = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SETTING_KEY = "admin_schedule_google_calendar_id";
const CALENDAR_SUMMARY = "AMD 管理カレンダー";
const TZ = "Asia/Tokyo";

type Row = Record<string, unknown>;
type GoogleEvent = {
  id?: string;
  summary?: string;
  description?: string;
  start?: { date?: string };
  end?: { date?: string };
  transparency?: string;
  extendedProperties?: { private?: Record<string, string> };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function ymdJst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function endOfMonthAfter(iso: string, months: number): string {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month + months, 0)).toISOString().slice(0, 10);
}

async function googleToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Calendar OAuth secrets are missing");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(`Google token refresh failed (${response.status})`);
  return String(body.access_token);
}

async function googleRequest(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${CAL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || `HTTP_${response.status}`;
    throw new Error(`Google Calendar ${reason}`);
  }
  return body;
}

async function ensureCalendar(db: ReturnType<typeof createClient>, token: string): Promise<string> {
  const { data: setting } = await db.from("settings").select("value").eq("key", CALENDAR_SETTING_KEY).maybeSingle();
  if (setting?.value) {
    try {
      await googleRequest(token, `/calendars/${encodeURIComponent(String(setting.value))}`);
      return String(setting.value);
    } catch {
      // Calendar was removed or access changed. Recreate and replace the derived setting below.
    }
  }
  const created = await googleRequest(token, "/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: CALENDAR_SUMMARY, timeZone: TZ }),
  });
  const calendarId = String(created.id || "");
  if (!calendarId) throw new Error("Google Calendar create returned no id");
  const { error } = await db.from("settings").upsert({
    key: CALENDAR_SETTING_KEY,
    value: calendarId,
    updated_by: "admin-schedule-calendar-sync",
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });
  if (error) throw new Error(`Calendar id setting write failed: ${error.message}`);
  return calendarId;
}

async function ensureAdminReaders(db: ReturnType<typeof createClient>, token: string, calendarId: string) {
  const { data, error } = await db.from("members")
    .select("member_id,email")
    .eq("is_admin", true)
    .eq("status", "active");
  if (error) throw new Error(`Admin read failed: ${error.message}`);
  const admins = (data ?? []).filter((row: Row) => typeof row.email === "string" && row.email);
  if (admins.length !== 2) throw new Error(`Expected 2 active admins, found ${admins.length}`);

  const acl = await googleRequest(token, `/calendars/${encodeURIComponent(calendarId)}/acl?maxResults=250`);
  const existing = new Map<string, string>((acl.items ?? []).map((item: Row) => [
    String((item.scope as Row | undefined)?.value ?? ""),
    String(item.role ?? ""),
  ]));
  for (const admin of admins) {
    const email = String(admin.email);
    if (["reader", "writer", "owner"].includes(existing.get(email) ?? "")) continue;
    await googleRequest(token, `/calendars/${encodeURIComponent(calendarId)}/acl?sendNotifications=false`, {
      method: "POST",
      body: JSON.stringify({ role: "reader", scope: { type: "user", value: email } }),
    });
  }
  return admins.map((row: Row) => String(row.member_id));
}

async function desiredOccurrences(db: ReturnType<typeof createClient>, from: string, to: string) {
  const { data, error } = await db.from("company_schedule_occurrences")
    .select("occurrence_id,occurrence_key,title,due_on,category,lifecycle_status,date_precision")
    .eq("current_version", true)
    .eq("date_precision", "day")
    .gte("due_on", from)
    .lte("due_on", to)
    .in("lifecycle_status", ["open", "needs_source"])
    .order("due_on");
  if (error) throw new Error(`Schedule occurrence read failed: ${error.message}`);
  const rows = (data ?? []) as Row[];
  const ids = rows.map((row) => String(row.occurrence_id));
  if (!ids.length) return [];
  const { data: actions, error: actionError } = await db.from("company_schedule_actions")
    .select("occurrence_id,action,acted_at")
    .in("occurrence_id", ids)
    .order("acted_at", { ascending: false });
  if (actionError) throw new Error(`Schedule action read failed: ${actionError.message}`);
  const latest = new Map<string, string>();
  for (const action of (actions ?? []) as Row[]) {
    const id = String(action.occurrence_id);
    if (!latest.has(id)) latest.set(id, String(action.action));
  }
  return rows.filter((row) => !["completed", "not_applicable"].includes(latest.get(String(row.occurrence_id)) ?? ""));
}

function eventBody(row: Row) {
  const dueOn = String(row.due_on);
  const key = String(row.occurrence_key);
  return {
    summary: String(row.title),
    description: [
      "AMD OS 管理カレンダーから自動同期",
      `区分: ${String(row.category)}`,
      "日付や内容の修正はAMD OSの元データで行う。",
    ].join("\n"),
    start: { date: dueOn },
    end: { date: addDays(dueOn, 1) },
    transparency: "transparent",
    reminders: { useDefault: false },
    extendedProperties: { private: { amdOsSource: "admin_schedule", amdScheduleOccurrenceKey: key } },
  };
}

function eventMatches(existing: GoogleEvent, desired: ReturnType<typeof eventBody>): boolean {
  return existing.summary === desired.summary
    && existing.description === desired.description
    && existing.start?.date === desired.start.date
    && existing.end?.date === desired.end.date
    && existing.transparency === desired.transparency;
}

async function listManagedEvents(token: string, calendarId: string, from: string, to: string): Promise<GoogleEvent[]> {
  const events: GoogleEvent[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      timeMin: `${from}T00:00:00+09:00`,
      timeMax: `${addDays(to, 1)}T00:00:00+09:00`,
      singleEvents: "true",
      maxResults: "2500",
      privateExtendedProperty: "amdOsSource=admin_schedule",
      ...(pageToken ? { pageToken } : {}),
    });
    const body = await googleRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    events.push(...(body.items ?? []));
    pageToken = String(body.nextPageToken ?? "");
  } while (pageToken);
  return events;
}

Deno.serve(async (request) => {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const syncSecret = Deno.env.get("ADMIN_SCHEDULE_SYNC_SECRET") ?? "";
    if (!serviceKey || !syncSecret || request.headers.get("x-admin-schedule-sync-secret") !== syncSecret) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
    const today = ymdJst();
    const through = endOfMonthAfter(today, 8);
    const token = await googleToken();
    const calendarId = await ensureCalendar(db, token);
    const adminMemberIds = await ensureAdminReaders(db, token, calendarId);
    const desired = await desiredOccurrences(db, today, through);
    const existing = await listManagedEvents(token, calendarId, today, through);
    const desiredByKey = new Map(desired.map((row) => [String(row.occurrence_key), row]));
    const existingByKey = new Map<string, GoogleEvent>();
    const duplicateIds: string[] = [];
    for (const event of existing) {
      const key = event.extendedProperties?.private?.amdScheduleOccurrenceKey ?? "";
      if (!key || !event.id) continue;
      if (existingByKey.has(key)) duplicateIds.push(event.id);
      else existingByKey.set(key, event);
    }

    let created = 0;
    let updated = 0;
    let deleted = 0;
    for (const [key, row] of desiredByKey) {
      const body = eventBody(row);
      const current = existingByKey.get(key);
      if (!current?.id) {
        await googleRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`, { method: "POST", body: JSON.stringify(body) });
        created += 1;
      } else if (!eventMatches(current, body)) {
        await googleRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(current.id)}?sendUpdates=none`, { method: "PATCH", body: JSON.stringify(body) });
        updated += 1;
      }
    }
    const staleIds = [...duplicateIds, ...[...existingByKey.entries()]
      .filter(([key]) => !desiredByKey.has(key))
      .map(([, event]) => String(event.id))];
    for (const eventId of staleIds) {
      await googleRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, { method: "DELETE" });
      deleted += 1;
    }
    return json({ ok: true, range: { from: today, to: through }, admins: adminMemberIds, desired: desired.length, created, updated, deleted, unchanged: desired.length - created - updated });
  } catch (error) {
    console.error("[admin-schedule-calendar-sync]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
