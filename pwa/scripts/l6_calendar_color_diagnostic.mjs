#!/usr/bin/env node
/**
 * Read-only L6 Calendar color diagnostic.
 *
 * Purpose:
 * - Bypass connector-shaped event payloads and read Google Calendar API v3
 *   directly through the existing PWA Google OAuth / service-account env.
 * - Return only the fields needed before L6 Phase A:
 *   event id, calendar id, summary, start/end, explicit event colorId, and
 *   calendar-list default color metadata.
 *
 * This helper never writes to Calendar, Supabase, files, outbox, or external APIs.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { google } from "googleapis";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(PWA_ROOT, "..");
const TEMPFAIL_EXIT_CODE = 75;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

loadEnv(path.join(PWA_ROOT, ".env.local"));
loadEnv(path.join(PWA_ROOT, ".env.production.local"));
loadEnv(path.join(REPO_ROOT, ".vercel", ".env.production.local"));
loadEnv(path.join(PWA_ROOT, ".vercel", ".env.production.local"));

const args = parseArgs(process.argv.slice(2));

async function main() {
  const now = new Date();
  const timeMin = parseDateArg(args["time-min"]) ?? new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const timeMax = parseDateArg(args["time-max"]) ?? new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const calendarId = String(args["calendar-id"] || "primary").trim();
  const maxResults = clampInt(args["max-results"], 1, 250, 50);

  if (!(timeMin < timeMax)) {
    throw new Error("--time-min must be earlier than --time-max");
  }
  if (!calendarId) {
    throw new Error("--calendar-id must not be empty");
  }

  const authInfo = await buildAuth();
  const calendar = google.calendar({ version: "v3", auth: authInfo.auth });

  const calendarDefault = await readCalendarDefault(calendar, calendarId);
  const events = await listEvents(calendar, {
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults,
  });

  const normalized = events.map((event) => normalizeEvent(event, calendarId));
  const explicitColorEvents = normalized.filter((event) => event.colorId);

  const result = {
    ok: true,
    diagnostic: "l6_calendar_color",
    external_writes: "none",
    auth_mode: authInfo.mode,
    calendar_id: calendarId,
    time_min: timeMin.toISOString(),
    time_max: timeMax.toISOString(),
    calendar_default: calendarDefault,
    events_scanned: normalized.length,
    explicit_color_events: explicitColorEvents.length,
    no_explicit_color_events: normalized.length - explicitColorEvents.length,
    events: normalized,
    next_recommendation:
      explicitColorEvents.length > 0
        ? "resolve_color_history_then_monitored_live_once"
        : "needs_cfg_alias_resolution_or_explicit_event_color_stop",
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function parseDateArg(value) {
  if (!value || value === true) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${value}`);
  }
  return date;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value || fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function buildAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth = new google.auth.OAuth2(clientId, clientSecret);
    oauth.setCredentials({ refresh_token: refreshToken });
    return { auth: oauth, mode: "oauth_refresh_token" };
  }

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    const credentials = JSON.parse(saJson);
    const subject = process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT || process.env.GOOGLE_IMPERSONATE_EMAIL;
    if (subject) {
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        subject,
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      });
      return { auth, mode: "service_account_delegated" };
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });
    return { auth: await auth.getClient(), mode: "service_account" };
  }

  throw new Error(
    "Google auth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON.",
  );
}

async function readCalendarDefault(calendar, calendarId) {
  try {
    const res = await calendar.calendarList.get({
      calendarId,
      fields: "id,summary,colorId,backgroundColor,foregroundColor,primary,timeZone,accessRole",
    });
    return normalizeCalendarListEntry(res.data, "calendarList.get");
  } catch (error) {
    const listFallback = await findCalendarListEntry(calendar, calendarId);
    if (listFallback) return listFallback;
    return {
      ok: false,
      source: "calendarList.get",
      error_class: errorClass(error),
      colorId: null,
      backgroundColor: null,
      foregroundColor: null,
    };
  }
}

async function findCalendarListEntry(calendar, calendarId) {
  try {
    let pageToken;
    do {
      const res = await calendar.calendarList.list({
        maxResults: 250,
        pageToken,
        fields:
          "items(id,summary,colorId,backgroundColor,foregroundColor,primary,timeZone,accessRole),nextPageToken",
      });
      const items = res.data.items ?? [];
      const hit =
        items.find((item) => item.id === calendarId) ||
        (calendarId === "primary" ? items.find((item) => item.primary) : null);
      if (hit) return normalizeCalendarListEntry(hit, "calendarList.list");
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  } catch {
    return null;
  }
  return null;
}

function normalizeCalendarListEntry(entry, source) {
  return {
    ok: true,
    source,
    id: entry?.id ?? null,
    summary: entry?.summary ?? null,
    primary: entry?.primary === true,
    timeZone: entry?.timeZone ?? null,
    accessRole: entry?.accessRole ?? null,
    colorId: entry?.colorId ?? null,
    backgroundColor: entry?.backgroundColor ?? null,
    foregroundColor: entry?.foregroundColor ?? null,
  };
}

async function listEvents(calendar, opts) {
  const events = [];
  let pageToken;
  do {
    const remaining = opts.maxResults - events.length;
    if (remaining <= 0) break;
    const res = await calendar.events.list({
      calendarId: opts.calendarId,
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
      maxResults: Math.min(remaining, 250),
      singleEvents: true,
      orderBy: "startTime",
      pageToken,
      fields:
        "items(id,summary,start,end,colorId,recurringEventId,originalStartTime,eventType,transparency,htmlLink),nextPageToken",
    });
    events.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return events;
}

function normalizeEvent(event, calendarId) {
  const title = String(event.summary || "").trim();
  const start = event.start?.dateTime ?? event.start?.date ?? null;
  const end = event.end?.dateTime ?? event.end?.date ?? null;
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const colorId = event.colorId ? String(event.colorId) : null;

  return {
    event_id: event.id ?? null,
    calendar_id: calendarId,
    summary: title || "(no title)",
    start,
    end,
    is_all_day: isAllDay,
    title_prefix_skip: title.startsWith("+") || title.startsWith("＋"),
    event_type: event.eventType ?? null,
    transparency: event.transparency ?? null,
    recurring_event_id: event.recurringEventId ?? null,
    original_start_time:
      event.originalStartTime?.dateTime ?? event.originalStartTime?.date ?? null,
    colorId,
    has_explicit_color: Boolean(colorId),
    alias_candidate: {
      matched: false,
      candidate: false,
      reason: "cfg_alias_not_loaded_by_node_color_helper",
    },
    l6_resolution_gate:
      colorId && !isAllDay && title && !title.startsWith("+") && !title.startsWith("＋")
        ? "eligible_for_color_history_resolution"
        : "needs_cfg_alias_resolution_or_explicit_event_color",
  };
}

function errorClass(error) {
  const status = error?.code || error?.response?.status;
  if (status) return `google_api_${status}`;
  return error?.name || "unknown_error";
}

main().catch((error) => {
  const result = {
    ok: false,
    diagnostic: "l6_calendar_color",
    external_writes: "none",
    error_class: errorClass(error),
    message: String(error?.message || error).slice(0, 500),
  };
  process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  const status = Number(error?.code || error?.response?.status);
  process.exit(RETRYABLE_STATUS_CODES.has(status) ? TEMPFAIL_EXIT_CODE : 1);
});
