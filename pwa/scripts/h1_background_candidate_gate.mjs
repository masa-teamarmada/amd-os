#!/usr/bin/env node
/**
 * Deterministic H-1 candidate gate for the non-visible background runner.
 * It reads Calendar + Supabase once, emits only bounded meeting metadata, and
 * avoids paying the LLM startup cost when there is no H-1 work to perform.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import {
  planLedgerReconciliation,
  readLedgerRows,
  applyLedgerPlan,
  DEFAULT_EMIT_LIMIT,
} from "./lib/meeting_backfill_ledger.mjs";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(PWA_ROOT, "..");

loadEnv(path.join(PWA_ROOT, ".env.local"));
loadEnv(path.join(PWA_ROOT, ".env.production.local"));
loadEnv(path.join(REPO_ROOT, ".vercel", ".env.production.local"));
loadEnv(path.join(PWA_ROOT, ".vercel", ".env.production.local"));

const args = parseArgs(process.argv.slice(2));
const NOTION_METADATA_CANDIDATE_LIMIT = 25;
// 台帳から1runで出す再試行の上限。毎時runを長時間化させないための数であり、
// 欠損の保持期間の上限ではない。台帳は期限なく残る。
const BACKLOG_EMIT_LIMIT = DEFAULT_EMIT_LIMIT;
// 新しい欠損を検出する範囲。検出済みの行は範囲外へ出ても台帳に残り続ける。
const BACKLOG_DETECT_LOOKBACK_DAYS = 45;
const NOTION_METADATA_MAX_SCAN_PAGES = 8;

async function main() {
  const outputPath = requiredPath(args.output, "--output");
  const notionMetadataStatePath = requiredPath(args["notion-metadata-state"], "--notion-metadata-state");
  const notionMetadataState = readNotionMetadataState(notionMetadataStatePath);
  const now = new Date();
  const windows = {
    calendar_min: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    calendar_max: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    held_min: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    held_max: new Date(now.getTime() - 60 * 60 * 1000),
    recovery_min: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    upcoming_min: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    upcoming_max: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    backlog_min: new Date(now.getTime() - BACKLOG_DETECT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
  };

  const db = await createDb();
  let events = [];
  let calendarError = null;
  try {
    events = await listCalendarEvents(windows.calendar_min, windows.calendar_max);
  } catch (error) {
    // The Codex Calendar connector is the supported fallback on this Mac.
    // Do not mistake an absent local OAuth env for an empty Calendar.
    calendarError = String(error?.message || error).slice(0, 180);
  }

  const calendarEvents = events.filter(isEligibleCalendarEvent);
  const eventIds = calendarEvents.map((event) => event.id);
  const summaryRows = await readSummaryRows(db, windows, eventIds);
  const rowsByEventId = new Map(
    summaryRows.windowRows.filter((row) => row.calendar_event_id).map((row) => [row.calendar_event_id, row]),
  );

  const heldCandidates = calendarEvents
    .filter((event) => event.end_at && inRange(event.end_at, windows.held_min, windows.held_max))
    .map(normalizeEvent);
  const recoveryCandidates = summaryRows.recoveryRows.map(normalizeRow);
  const upcomingCandidates = calendarEvents
    .filter((event) => inRange(event.start_at, windows.upcoming_min, windows.upcoming_max))
    .filter((event) => isNewOrChanged(event, rowsByEventId.get(event.id)))
    .map((event) => ({ ...normalizeEvent(event), reason: rowsByEventId.has(event.id) ? "calendar_metadata_changed" : "new_calendar_card" }));

  // 議事録欠損台帳。抽出窓を外した会議はここに残り、期限なく再試行の対象になる。
  // Calendarが読めなくても動く必要があるため、検出はDBの予定カード行だけを見る。
  let backlog = { candidates: [], stats: null, error: null };
  try {
    const [backlogRows, ledgerRows] = await Promise.all([
      readBacklogSummaryRows(db, windows),
      readLedgerRows(db),
    ]);
    const plan = planLedgerReconciliation({
      now,
      summaryRows: backlogRows,
      ledgerRows,
      emitLimit: BACKLOG_EMIT_LIMIT,
    });
    await applyLedgerPlan(db, plan, { now });
    backlog = { candidates: plan.emits, stats: plan.stats, error: null };
  } catch (error) {
    // 台帳が壊れてもH-1本体を止めない。旧来の3レーンは従来どおり動かす。
    backlog = { candidates: [], stats: null, error: String(error?.message || error).slice(0, 180) };
  }

  const result = {
    generated_at: now.toISOString(),
    external_writes: "ledger_only",
    calendar: {
      status: calendarError ? "connector_required" : "direct_api",
      error: calendarError,
      scanned: events.length,
      eligible: calendarEvents.length,
      excluded: events.length - calendarEvents.length,
    },
    candidates: {
      held: heldCandidates,
      recovery: recoveryCandidates,
      upcoming: upcomingCandidates,
      backlog: backlog.candidates,
      notion_metadata: {
        scan_required: true,
        scope: "all_history",
        limit: NOTION_METADATA_CANDIDATE_LIMIT,
        max_scan_pages: NOTION_METADATA_MAX_SCAN_PAGES,
        data_source: "minutes",
        state_file: notionMetadataStatePath,
        start_cursor: notionMetadataState.next_cursor,
        cycle: notionMetadataState.cycle,
        blank_properties: ["eventId", "PJ", "member", "date"],
        body_read_allowed: false,
        external_writes: "blank_only_after_unique_match",
      },
    },
  };
  result.backlog_ledger = { stats: backlog.stats, error: backlog.error };
  writeJson(outputPath, result);

  const candidateCount = heldCandidates.length + recoveryCandidates.length
    + upcomingCandidates.length + backlog.candidates.length;
  // The bounded Notion metadata repair lane is independent from Calendar.
  // Codex must scan it before a run may be reported as a no-op.
  if (candidateCount > 0 || calendarError || result.candidates.notion_metadata.scan_required) {
    process.exitCode = 10;
    return;
  }

  if (args["empty-report-dir"] && args["memory-file"]) {
    writeNoCandidateReport({
      reportDir: requiredPath(args["empty-report-dir"], "--empty-report-dir"),
      memoryFile: requiredPath(args["memory-file"], "--memory-file"),
      now,
    });
  }
}

async function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env is missing for H-1 candidate gate.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function listCalendarEvents(timeMin, timeMax) {
  const auth = await buildGoogleAuth();
  const calendar = google.calendar({ version: "v3", auth });
  const events = [];
  let pageToken;
  do {
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
      pageToken,
      fields: "items(id,summary,status,start,end,updated,recurringEventId,transparency,eventType),nextPageToken",
    });
    events.push(...(response.data.items ?? []).map((event) => ({
      id: String(event.id || ""),
      title: String(event.summary || "").trim(),
      status: String(event.status || ""),
      start_at: event.start?.dateTime || null,
      end_at: event.end?.dateTime || null,
      updated_at: event.updated || null,
      recurring_event_id: event.recurringEventId || null,
      transparency: event.transparency || null,
      event_type: event.eventType || null,
    })));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
  return events;
}

async function buildGoogleAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    return auth;
  }
  const source = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!source) throw new Error("Google Calendar auth is missing for H-1 candidate gate.");
  const credentials = JSON.parse(source);
  const subject = process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT || process.env.GOOGLE_IMPERSONATE_EMAIL;
  if (subject) {
    return new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      subject,
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  return auth.getClient();
}

async function readSummaryRows(db, windows, eventIds) {
  const select = "meeting_id,calendar_event_id,project_id,meeting_start_at,title,source_kinds,summary_short,updated_at";
  const [recoveryResult, windowResult] = await Promise.all([
    db
      .from("project_meeting_summaries")
      .select(select)
      .gte("meeting_start_at", windows.recovery_min.toISOString())
      .or("source_kinds.ilike.%none%,summary_short.eq.議事録なし")
      .limit(200),
    eventIds.length
      ? db.from("project_meeting_summaries").select(select).in("calendar_event_id", eventIds).limit(300)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (recoveryResult.error) throw recoveryResult.error;
  if (windowResult.error) throw windowResult.error;
  return { recoveryRows: recoveryResult.data ?? [], windowRows: windowResult.data ?? [] };
}

/**
 * 台帳の照合に使う行。予定カードと確定版の両方を、検出範囲ぶんまとめて読む。
 * 旧救済レーンの「直近24時間」「既存行のみ」という条件はここでは使わない。
 */
async function readBacklogSummaryRows(db, windows) {
  const select = "meeting_id,calendar_event_id,project_id,meeting_start_at,title,source_kinds";
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("project_meeting_summaries")
      .select(select)
      .gte("meeting_start_at", windows.backlog_min.toISOString())
      .lte("meeting_start_at", new Date().toISOString())
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function isEligibleCalendarEvent(event) {
  return Boolean(
    event.id
      && event.title
      && event.start_at
      && event.end_at
      && event.status === "confirmed"
      && !event.title.startsWith("+")
      && !event.title.startsWith("＋"),
  );
}

function isNewOrChanged(event, row) {
  if (!row) return true;
  if (String(row.title || "").trim() !== event.title) return true;
  return !sameInstant(row.meeting_start_at, event.start_at);
}

function sameInstant(a, b) {
  const left = Date.parse(a || "");
  const right = Date.parse(b || "");
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 60_000;
}

function inRange(value, min, max) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) && time >= min.getTime() && time <= max.getTime();
}

function normalizeEvent(event) {
  return {
    calendar_event_id: event.id,
    title: event.title,
    meeting_start_at: event.start_at,
    meeting_end_at: event.end_at,
    recurring_event_id: event.recurring_event_id,
  };
}

function normalizeRow(row) {
  return {
    meeting_id: row.meeting_id,
    calendar_event_id: row.calendar_event_id,
    project_id: row.project_id,
    title: row.title,
    meeting_start_at: row.meeting_start_at,
    reason: "recent_none_recovery",
  };
}

function writeNoCandidateReport({ reportDir, memoryFile, now }) {
  const stamp = jstStamp(now);
  const report = [
    "H-1は、終わった会議の記録と近い予定を整える定期確認。今回は更新や確認が必要な変化はなかった。",
    "",
    "確認件数: 0件",
    "確認した開催済みMTG: なし",
    "",
    "再確認した議事録なしMTG: 0件",
    "予定カード同期: 0件",
    "ノーション補完: 0件",
    "要確認: 0件",
    "",
  ].join("\n");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `${stamp}-h1-report.md`);
  fs.writeFileSync(reportFile, report, "utf8");
  fs.mkdirSync(path.dirname(memoryFile), { recursive: true });
  fs.appendFileSync(memoryFile, `\n- ${stamp}: Calendar/DB candidate gate: 対象なし。OS通知なし（内部記録のみ）。\n`, "utf8");
}

function jstStamp(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}`;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readNotionMetadataState(file) {
  if (!fs.existsSync(file)) return { version: 1, next_cursor: null, cycle: 0 };
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      version: 1,
      next_cursor: typeof value?.next_cursor === "string" && value.next_cursor ? value.next_cursor : null,
      cycle: Number.isInteger(value?.cycle) && value.cycle >= 0 ? value.cycle : 0,
    };
  } catch {
    // A corrupt local cursor must not disable historical coverage. Restart at
    // the beginning and let the writer replace the state after a verified run.
    return { version: 1, next_cursor: null, cycle: 0 };
  }
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) result[key] = true;
    else {
      result[key] = value;
      index += 1;
    }
  }
  return result;
}

function requiredPath(value, label) {
  if (!value || value === true) throw new Error(`${label} is required.`);
  return path.resolve(String(value));
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

main().catch((error) => {
  process.stderr.write(`H-1 candidate gate failed: ${String(error?.message || error)}\n`);
  process.exit(1);
});
