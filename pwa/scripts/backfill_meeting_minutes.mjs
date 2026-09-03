#!/usr/bin/env node
/**
 * 欠損した議事録を後から埋める正規手順のCLI。
 *
 *   # 何が書かれるかだけ見る (既定)
 *   node scripts/backfill_meeting_minutes.mjs --file minutes.json
 *
 *   # 実際に入れる
 *   node scripts/backfill_meeting_minutes.mjs --file minutes.json --apply
 *
 *   # 台帳の pending を一覧する
 *   node scripts/backfill_meeting_minutes.mjs --list
 *
 * minutes.json の形:
 *   {
 *     "calendar_event_id": "5gnivrdogk1hreu8ni8lkqbe54_20260819T070000Z",
 *     "project_id": "p21",
 *     "title": "SX定例MTG",
 *     "meeting_start_at": "2026-08-19T07:00:00+00:00",
 *     "source_kinds": "notion+calendar",
 *     "summary_short": "...",
 *     "narrative_md": "## 🎯背景\n...",
 *     "decided": [], "progress": [], "next_actions": [], "risks": []
 *   }
 *
 * 予定カード (`upcoming:` 行) は消さない。確定版を別行として作る。
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

const args = parseArgs(process.argv.slice(2));
const BASE_URL = String(args["base-url"] || process.env.APP_BASE_URL || "https://amd-os-pwa.vercel.app");

async function main() {
  if (args.list) return listPending();

  const file = args.file;
  if (!file || file === true) {
    process.stderr.write("--file <minutes.json> か --list を指定する\n");
    process.exit(2);
  }
  const payload = JSON.parse(fs.readFileSync(path.resolve(String(file)), "utf8"));
  const entries = Array.isArray(payload) ? payload : [payload];

  const secret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET;
  if (!secret) throw new Error("WORKFLOW_SECRET / CRON_SECRET が無い");

  let ok = 0;
  let failed = 0;
  for (const entry of entries) {
    const body = { ...entry, dry_run: !args.apply };
    const response = await fetch(`${BASE_URL}/api/meeting-summary/backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
    const label = `${entry.meeting_start_at ?? "?"} ${entry.project_id ?? "?"} ${entry.title ?? "?"}`;
    if (result.ok) {
      ok += 1;
      process.stdout.write(`${args.apply ? "入れた " : "確認のみ "} ${label}\n`);
    } else {
      failed += 1;
      process.stdout.write(`失敗   ${label}\n        ${result.error ?? "unknown"}\n`);
    }
  }
  process.stdout.write(`\n${args.apply ? "反映" : "確認"}: 成功${ok}件 / 失敗${failed}件\n`);
  if (failed) process.exitCode = 1;
}

async function listPending() {
  const db = createDb();
  const { data, error } = await db
    .from("meeting_minutes_backfill_ledger")
    .select("calendar_event_id,project_id,title,meeting_start_at,status,attempt_count,max_attempts,last_outcome")
    .in("status", ["pending", "abandoned"])
    .order("meeting_start_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = data ?? [];
  process.stdout.write(`\n議事録が埋まっていない会議: ${rows.length}件\n\n`);
  for (const row of rows) {
    const when = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(new Date(row.meeting_start_at));
    const state = row.status === "abandoned" ? "諦めた" : `再試行${row.attempt_count}/${row.max_attempts}`;
    process.stdout.write(`  ${when}  ${String(row.project_id || "?").padEnd(5)} ${state.padEnd(12)} ${row.title}\n`);
  }
  process.stdout.write("\n");
}

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env が無い");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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
  process.stderr.write(`backfill failed: ${String(error?.stack || error?.message || error)}\n`);
  process.exit(1);
});
