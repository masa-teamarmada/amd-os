#!/usr/bin/env node
/**
 * 全PJ・全期間の議事録欠損棚卸し (read-only)。
 *
 * 「予定としては存在するのに、確定版の議事録行が無い会議」を洗い出す。
 * DB は一切書き換えない。台帳への反映は h1_background_candidate_gate.mjs が行う。
 *
 *   node scripts/audit_missing_meeting_minutes.mjs --since 2026-05-01 --json out.json
 *   node scripts/audit_missing_meeting_minutes.mjs --events events.json
 *
 * 「予定」の取得元は2つある。PWA も本 script も Google Calendar を直接読めない
 * (`/api/meeting-prep/calendar-sync` は automation が POST body で渡した events を
 * 受け取るだけで、Calendar を自分では読まない)。したがって既定は DB 経路である。
 *
 *   DB 経路 (既定)   `upcoming:` 予定カード行。calendar-sync が入れたもの。認証に依存しない
 *   events 経路      Calendar MCP を持つ automation / 人が取得した events JSON を --events で渡す
 *
 * 判定:
 *   held        開始時刻が now - 60分 より前 = 開催済みとみなす
 *   confirmed   project_meeting_summaries に meeting_id が 'upcoming:' で始まらない行がある
 *   missing     held なのに confirmed が無い = 欠損
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(PWA_ROOT, "..");

loadEnv(path.join(PWA_ROOT, ".env.local"));
loadEnv(path.join(PWA_ROOT, ".env.production.local"));
loadEnv(path.join(REPO_ROOT, ".vercel", ".env.production.local"));
loadEnv(path.join(PWA_ROOT, ".vercel", ".env.production.local"));

const args = parseArgs(process.argv.slice(2));
const SINCE = String(args.since || "2026-05-01");
const UNTIL = args.until ? String(args.until) : null;
const HELD_GRACE_MINUTES = 60;

async function main() {
  const now = new Date();
  const since = new Date(`${SINCE}T00:00:00+09:00`);
  const until = UNTIL ? new Date(`${UNTIL}T23:59:59+09:00`) : new Date(now.getTime() - HELD_GRACE_MINUTES * 60 * 1000);

  const db = createDb();
  const [rows, assets] = await Promise.all([readAllSummaryRows(db, since, until), readAssetCounts(db)]);

  // 確定版 = meeting_id が 'upcoming:' で始まらない行。calendar_event_id と meeting_id の
  // 両方を索引にする。過去の手動取り込みは meeting_id にだけ event id を入れた例がある。
  const confirmedByEvent = new Map();
  const upcomingByEvent = new Map();
  for (const row of rows) {
    const isUpcoming = String(row.meeting_id || "").startsWith("upcoming:");
    const keys = [row.calendar_event_id, row.meeting_id].filter(Boolean).map(String);
    for (const key of keys) {
      const bare = key.startsWith("upcoming:") ? key.slice("upcoming:".length).replace(/_\d{8}T\d{6}Z$/, "") : key;
      (isUpcoming ? upcomingByEvent : confirmedByEvent).set(bare, row);
    }
  }

  // 「予定」の集合。events JSON があればそれを、無ければ upcoming 予定カード行を使う。
  const source = args.events ? "calendar_events_file" : "upcoming_rows";
  const scheduled = args.events
    ? JSON.parse(fs.readFileSync(path.resolve(String(args.events)), "utf8"))
      .filter(isEligibleCalendarEvent)
      .map((event) => ({ id: event.id, title: event.title, start_at: event.start_at, end_at: event.end_at, recurring_event_id: event.recurring_event_id ?? null }))
    : rows
      .filter((row) => String(row.meeting_id || "").startsWith("upcoming:") && row.meeting_start_at)
      .map((row) => ({
        id: String(row.calendar_event_id || bareEventId(row.meeting_id)),
        title: row.title,
        start_at: row.meeting_start_at,
        end_at: null,
        recurring_event_id: null,
      }))
      .filter((event) => event.id);

  const held = scheduled.filter((event) => {
    const start = Date.parse(event.start_at || "");
    return Number.isFinite(start) && start < now.getTime() - HELD_GRACE_MINUTES * 60 * 1000
      && start >= since.getTime() && start <= until.getTime();
  });

  const missing = [];
  const covered = [];
  for (const event of held) {
    const confirmed = confirmedByEvent.get(event.id);
    if (confirmed) {
      covered.push({ event, row: confirmed, assets: assets.get(confirmed.meeting_id) ?? 0 });
      continue;
    }
    const prep = upcomingByEvent.get(event.id);
    missing.push({
      calendar_event_id: event.id,
      title: event.title,
      meeting_start_at: event.start_at,
      meeting_end_at: event.end_at,
      jst: jstDateTime(event.start_at),
      date: jstDate(event.start_at),
      project_id: prep?.project_id ?? null,
      prep_meeting_id: prep?.meeting_id ?? null,
      has_prep_row: Boolean(prep),
      recurring_event_id: event.recurring_event_id,
    });
  }
  missing.sort((a, b) => String(a.meeting_start_at).localeCompare(String(b.meeting_start_at)));

  // 添付の欠損: 確定版はあるが meeting_assets が 0 件
  const assetGaps = covered
    .filter((entry) => entry.assets === 0 && entry.row.source_kinds && entry.row.source_kinds !== "none")
    .map((entry) => ({
      meeting_id: entry.row.meeting_id,
      project_id: entry.row.project_id,
      title: entry.row.title,
      date: entry.row.meeting_date,
    }));

  const byProject = new Map();
  for (const item of missing) {
    const key = item.project_id || "(PJ未解決)";
    byProject.set(key, (byProject.get(key) ?? 0) + 1);
  }
  const byDate = new Map();
  for (const item of missing) byDate.set(item.date, (byDate.get(item.date) ?? 0) + 1);

  const report = {
    generated_at: now.toISOString(),
    range: { since: since.toISOString(), until: until.toISOString() },
    scheduled_source: source,
    scheduled: { total: scheduled.length, held: held.length },
    summary: {
      held: held.length,
      confirmed: covered.length,
      missing: missing.length,
      missing_with_prep_row: missing.filter((m) => m.has_prep_row).length,
      asset_gaps: assetGaps.length,
    },
    by_project: Object.fromEntries([...byProject.entries()].sort((a, b) => b[1] - a[1])),
    by_date: Object.fromEntries([...byDate.entries()].sort()),
    missing,
    asset_gaps: assetGaps,
  };

  if (args.json) {
    const file = path.resolve(String(args.json));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${file}\n`);
  }

  process.stdout.write(`\n== 議事録欠損の棚卸し (${SINCE} 〜 ${UNTIL || "現在"}) ==\n`);
  process.stdout.write(`予定の取得元: ${source === "upcoming_rows" ? "予定カード行 (DB)" : "カレンダー events ファイル"}\n`);
  process.stdout.write(`開催済みとみなした会議: ${held.length}件\n`);
  process.stdout.write(`  うち確定版の議事録あり: ${covered.length}件\n`);
  process.stdout.write(`  うち欠損: ${missing.length}件 (予定カードだけ残っている: ${report.summary.missing_with_prep_row}件)\n`);
  process.stdout.write(`確定版はあるが添付が0件: ${assetGaps.length}件\n\n`);

  if (missing.length) {
    process.stdout.write("欠損の内訳:\n");
    for (const item of missing) {
      process.stdout.write(
        `  ${item.jst}  ${(item.project_id || "PJ未解決").padEnd(10)} ${item.title}${item.has_prep_row ? "  [予定カードあり]" : ""}\n`,
      );
    }
  }
  process.stdout.write("\n");
}

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env is missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readAllSummaryRows(db, since, until) {
  const select = "meeting_id,calendar_event_id,project_id,meeting_date,meeting_start_at,title,source_kinds,summary_short,narrative_md,generated_by_model";
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("project_meeting_summaries")
      .select(select)
      .gte("meeting_date", jstDate(since.toISOString()))
      .lte("meeting_date", jstDate(until.toISOString()))
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function readAssetCounts(db) {
  const counts = new Map();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from("meeting_assets").select("meeting_id").range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) counts.set(row.meeting_id, (counts.get(row.meeting_id) ?? 0) + 1);
    if (!data || data.length < pageSize) break;
  }
  return counts;
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

function bareEventId(meetingId) {
  const value = String(meetingId || "");
  if (!value.startsWith("upcoming:")) return value;
  return value.slice("upcoming:".length).replace(/_\d{8}T\d{6}Z$/, "");
}

function jstDate(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function jstDateTime(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso)).reduce((r, p) => ({ ...r, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
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
  process.stderr.write(`audit failed: ${String(error?.stack || error?.message || error)}\n`);
  process.exit(1);
});
