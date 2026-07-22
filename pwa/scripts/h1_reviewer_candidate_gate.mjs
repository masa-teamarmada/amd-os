#!/usr/bin/env node
/** Bounded, no-LLM candidate gate for the non-visible H-1 reviewer. */
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

async function main() {
  const output = requiredPath(args.output, "--output");
  const now = new Date();
  const db = createDb();
  const since = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("project_meeting_summaries")
    .select("meeting_id,calendar_event_id,project_id,meeting_start_at,title,source_kinds,updated_at")
    .gte("updated_at", since)
    .limit(200);
  if (error) throw error;

  const reportsDir = requiredPath(args["h1-reports-dir"], "--h1-reports-dir");
  const ledgerFile = requiredPath(args["ledger-file"], "--ledger-file");
  const today = jstDate(now);
  const allReports = fs.existsSync(reportsDir)
    ? fs.readdirSync(reportsDir).filter((name) => name.startsWith(today) && /^\d{8}T\d{4}-h1-report\.md$/.test(name)).sort()
    : [];
  const ledger = readLedger(ledgerFile);
  const aggregated = ledger.date_jst === today && Array.isArray(ledger.reports) ? new Set(ledger.reports) : new Set();
  const unaggregatedReports = allReports.filter((name) => !aggregated.has(name));
  const meetingCandidates = (data ?? [])
    .filter((row) => !["none", "upcoming", "upcoming_tentative"].includes(String(row.source_kinds || "").trim()))
    .map((row) => ({
      meeting_id: row.meeting_id,
      calendar_event_id: row.calendar_event_id,
      project_id: row.project_id,
      title: row.title,
      meeting_start_at: row.meeting_start_at,
      source_kinds: row.source_kinds,
    }));
  const result = {
    generated_at: now.toISOString(),
    external_writes: "none",
    candidates: { meetings: meetingCandidates, unaggregated_h1_reports: unaggregatedReports },
  };
  writeJson(output, result);

  if (meetingCandidates.length || unaggregatedReports.length) {
    process.exitCode = 10;
    return;
  }
  if (args["empty-report-dir"] && args["memory-file"]) {
    const reportDir = requiredPath(args["empty-report-dir"], "--empty-report-dir");
    const memoryFile = requiredPath(args["memory-file"], "--memory-file");
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, `${jstStamp(now)}-reviewer-report.md`), "確認件数: 0件\n要確認件数: 0件\n見た会議: なし\n要確認として残したもの: なし\nブロッカー: なし\n", "utf8");
    fs.mkdirSync(path.dirname(memoryFile), { recursive: true });
    fs.appendFileSync(memoryFile, `\n- ${jstStamp(now)}: reviewer candidate gate: 対象なし。\n`, "utf8");
  }
}

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env is missing for H-1 reviewer candidate gate.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function readLedger(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) result[key] = true;
    else { result[key] = value; index += 1; }
  }
  return result;
}

function requiredPath(value, label) {
  if (!value || value === true) throw new Error(`${label} is required.`);
  return path.resolve(String(value));
}

function jstDate(date) { return jstStamp(date).slice(0, 8); }

function jstStamp(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}`;
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
  process.stderr.write(`H-1 reviewer candidate gate failed: ${String(error?.message || error)}\n`);
  process.exit(1);
});
