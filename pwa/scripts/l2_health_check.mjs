#!/usr/bin/env node
/**
 * Read-only L2 health generator.
 *
 * It checks the freshness of canonical, already-written L2 rows. It does not
 * run extractors or change data; its only local write is the health JSON that
 * feeds l2_health_action_loop.cjs.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEFAULT_OUTPUT = path.join(PWA_ROOT, "tmp", "l2-health-latest.json");
const LANE_DEFINITIONS = [
  { id: "m-1", name: "M-1 月次報告", table: "monthly_reports", column: "generated_at", maxAgeHours: 24 * 45 },
  { id: "d-6", name: "D-6 経営ハイライト", table: "project_strategy_signals", column: "updated_at", maxAgeHours: 48 },
  { id: "d-7", name: "D-7 教科書実務知見", table: "textbook_insight_candidates", column: "updated_at", maxAgeHours: 24 * 14 },
  { id: "d-9", name: "D-9 マクロトレンド集計", table: "macro_index_log", column: "computed_at", maxAgeHours: 24 * 45 },
  { id: "d-10", name: "D-10 メンバー活動根拠", table: "member_activities", column: "extracted_at", maxAgeHours: 48 },
  { id: "d-11", name: "D-11 メディア掲載根拠", table: "project_media_mentions", column: "updated_at", maxAgeHours: 24 * 14 },
  { id: "d-13", name: "D-13 契約予兆", table: "contract_signals", column: "updated_at", maxAgeHours: 24 * 14 },
  { id: "d-14", name: "D-14 要対応・ガバナンス", table: "action_items", column: "updated_at", maxAgeHours: 48 },
  { id: "h-1", name: "H-1 会議フロー", table: "project_meeting_summaries", column: "updated_at", maxAgeHours: 48 },
];

const args = parseArgs(process.argv.slice(2));
const now = args.now ? new Date(args.now) : new Date();
if (Number.isNaN(now.getTime())) throw new Error("--now must be a valid ISO timestamp");

const fixture = args.fixture ? readJson(path.resolve(args.fixture), "fixture") : null;
const env = args.envFile ? readDotenv(path.resolve(args.envFile)) : {};
const output = path.resolve(args.output || DEFAULT_OUTPUT);
const rows = await Promise.all(LANE_DEFINITIONS.map((definition) => healthRow(definition, { now, fixture, env })));
const summary = summarize(rows);
const document = {
  version: 1,
  generatedAt: now.toISOString(),
  mode: fixture ? "fixture" : "supabase_rest",
  source: fixture
    ? { supabase: "fixture", supabaseError: null }
    : { supabase: cleanUrl(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL) || null, supabaseError: summary.sourceErrors[0] || null },
  summary,
  rows,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
if (args.json) console.log(JSON.stringify(document, null, 2));
else console.log(`L2 health: green=${summary.green} yellow=${summary.yellow} red=${summary.red} output=${output}`);
if (args.failOnRed && summary.red > 0) process.exitCode = 2;

async function healthRow(definition, context) {
  const result = await latestValue(definition, context);
  const base = {
    id: definition.id,
    name: definition.name,
    destination: definition.table,
    priority: definition.id === "h-1" || definition.id === "d-14" ? "P0" : "P1",
    generatedAt: context.now.toISOString(),
    runnerIds: [],
    runnerStatuses: [],
    reviewRequiredCount: 0,
    successEvidence: result.value ? { table: definition.table, column: definition.column, value: result.value } : null,
    dbEvidence: result.value ? { table: definition.table, latestValue: result.value } : null,
    fileEvidence: null,
    reportEvidence: null,
    lastOutputSuccess: result.value || null,
    lastReportEvidence: null,
    lastAnyEvidence: result.value || null,
    runnerHealth: result.error ? "unknown" : "green",
    outputHealth: "unknown",
  };

  if (result.error) {
    return {
      ...base,
      health: "yellow",
      failureMode: "unable_to_verify_output",
      missingReason: result.error,
      outputHealth: "unverified",
    };
  }
  if (!result.value) {
    return {
      ...base,
      health: "yellow",
      failureMode: "no_success_evidence",
      missingReason: `${definition.table} に最新出力の証跡がない。明示no-dataのrun証跡も未確認。`,
      outputHealth: "missing",
    };
  }

  const evidenceAt = normalizeTimestamp(result.value);
  if (!evidenceAt) {
    return {
      ...base,
      health: "yellow",
      failureMode: "unable_to_verify_output",
      missingReason: `${definition.table}.${definition.column} の時刻形式を確認できない。`,
      outputHealth: "unverified",
    };
  }
  const ageHours = (context.now.getTime() - evidenceAt.getTime()) / 3_600_000;
  if (ageHours > definition.maxAgeHours) {
    return {
      ...base,
      health: "yellow",
      failureMode: "stale_last_success",
      missingReason: `最新証跡が${Math.floor(ageHours)}時間前で、許容${definition.maxAgeHours}時間を超えている。`,
      outputHealth: "stale",
    };
  }
  return {
    ...base,
    health: "green",
    failureMode: null,
    missingReason: null,
    outputHealth: "fresh",
  };
}

async function latestValue(definition, { fixture, env }) {
  if (fixture) {
    const values = Array.isArray(fixture.tables?.[definition.table]) ? fixture.tables[definition.table] : [];
    const value = values.map((row) => row?.[definition.column]).filter(Boolean).sort().at(-1) || null;
    return { value, error: null };
  }
  const baseUrl = cleanUrl(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL);
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!baseUrl || !key) return { value: null, error: "Supabase URLまたはread-only keyをenv fileから読めない。" };
  const url = new URL(`/rest/v1/${definition.table}`, baseUrl);
  url.searchParams.set("select", definition.column);
  url.searchParams.set("order", `${definition.column}.desc`);
  url.searchParams.set("limit", "1");
  try {
    const response = await fetch(url, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!response.ok) return { value: null, error: `${definition.table}のread checkがHTTP ${response.status}。` };
    const rows = await response.json();
    return { value: Array.isArray(rows) ? rows[0]?.[definition.column] || null : null, error: null };
  } catch {
    return { value: null, error: `${definition.table}のread checkに接続できない。` };
  }
}

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--json") values.json = true;
    else if (token === "--fail-on-red") values.failOnRed = true;
    else if (["--output", "--env-file", "--now", "--fixture"].includes(token)) values[{ "--output": "output", "--env-file": "envFile", "--now": "now", "--fixture": "fixture" }[token]] = argv[++i];
    else throw new Error(`unknown argument: ${token}`);
  }
  return values;
}

function readDotenv(file) {
  if (!fs.existsSync(file)) throw new Error(`env file not found: ${file}`);
  const env = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { throw new Error(`${label} JSONを読めない: ${error instanceof Error ? error.message : "unknown"}`); }
}

function normalizeTimestamp(value) {
  const text = String(value || "");
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00.000Z` : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function summarize(rows) {
  const sourceErrors = rows.filter((row) => row.failureMode === "unable_to_verify_output").map((row) => row.missingReason);
  return {
    total: rows.length,
    green: rows.filter((row) => row.health === "green").length,
    yellow: rows.filter((row) => row.health === "yellow").length,
    red: rows.filter((row) => row.health === "red").length,
    sourceErrors,
  };
}

function cleanUrl(value) {
  const text = String(value || "").trim();
  return text ? text.replace(/\/$/, "") : "";
}
