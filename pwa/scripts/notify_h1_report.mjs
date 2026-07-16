#!/usr/bin/env node
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
  const title = String(args.title || "H-1報告").trim().slice(0, 180);
  const body = readBody(args).trim();
  if (!body) throw new Error("notification body is empty");

  assertSanitized(body);

  const runKey = String(args["run-key"] || buildDefaultRunKey()).trim();
  const source = String(args.source || "h1_meeting_flow").trim();
  const link = String(args.link || "/notifications").trim();
  const dryRun = Boolean(args["dry-run"]);
  const now = new Date().toISOString();

  const row = {
    kind: "h1_report",
    title,
    body,
    link,
    source,
    native_notified_at: null,
    meta: {
      run_key: runKey,
      report_date_jst: jstDate(),
      notification_channel: "normal",
      generated_at: now,
      sanitized: true,
    },
  };

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({ ok: true, dry_run: true, row }, null, 2)}\n`);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase env is missing. Need NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const { data: existing, error: existingError } = await db
    .from("app_notifications")
    .select("id,created_at")
    .eq("kind", "h1_report")
    .eq("source", source)
    .gte("created_at", since)
    .contains("meta", { run_key: runKey })
    .limit(1);
  if (existingError) throw existingError;

  if (existing?.length && !args.force) {
    const { data: updated, error: updateError } = await db
      .from("app_notifications")
      .update({ ...row, updated_at: now, read_at: null, dismissed_at: null })
      .eq("id", existing[0].id)
      .select("id,created_at,updated_at")
      .single();
    if (updateError) throw updateError;
    process.stdout.write(`${JSON.stringify({ ok: true, action: "updated_existing", notification_id: updated.id, run_key: runKey }, null, 2)}\n`);
    return;
  }

  const { data, error } = await db
    .from("app_notifications")
    .insert(row)
    .select("id,created_at")
    .single();
  if (error) throw error;

  process.stdout.write(`${JSON.stringify({ ok: true, action: "inserted", notification_id: data.id, run_key: runKey }, null, 2)}\n`);
}

function readBody(parsedArgs) {
  if (parsedArgs["body-file"]) {
    return fs.readFileSync(String(parsedArgs["body-file"]), "utf8");
  }
  if (parsedArgs.body) return String(parsedArgs.body);
  return fs.readFileSync(0, "utf8");
}

function assertSanitized(text) {
  const forbidden = [
    /https?:\/\//i,
    /drive\.google\.com/i,
    /docs\.google\.com/i,
    /notion\.so/i,
    /calendar\.google\.com/i,
    /meet\.google\.com/i,
    /zoom\.us/i,
    /teams\.microsoft\.com/i,
    /passcode|password|secret|token/i,
  ];
  const hit = forbidden.find((pattern) => pattern.test(text));
  if (hit) {
    throw new Error(`notification body may contain unsafe raw source detail: ${hit}`);
  }
}

function buildDefaultRunKey() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}+09:00`;
}

function jstDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
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

function loadEnv(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Optional env file.
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
