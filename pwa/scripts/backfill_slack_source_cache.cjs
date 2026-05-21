#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { createClient } = require("@supabase/supabase-js");

const ROOT = process.cwd();

loadEnv(path.join(ROOT, ".env.local"));
loadEnv(path.join(ROOT, ".env.production.local"));

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
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

function addMonth(ym, delta) {
  const year = Number(String(ym).slice(0, 4));
  const month = Number(String(ym).slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthRange(startYm, endYm) {
  const out = [];
  let current = startYm;
  while (current <= endYm && out.length < 60) {
    out.push(current);
    current = addMonth(current, 1);
  }
  return out;
}

function loadCollector() {
  const sourcePath = path.join(ROOT, "src/lib/sources/slack-source-cache.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const localRequire = (request) => {
    if (request === "crypto") return require("crypto");
    if (request === "@slack/web-api") return require("@slack/web-api");
    return require(request);
  };
  new Function("require", "module", "exports", output)(localRequire, mod, mod.exports);
  return mod.exports;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.SLACK_BOT_TOKEN;
  if (!supabaseUrl || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");

  const months = args.months
    ? String(args.months).split(",").map((m) => m.trim()).filter(Boolean)
    : args.ym
      ? [String(args.ym)]
      : monthRange(String(args["start-ym"] || "202604"), String(args["end-ym"] || "202605"));
  const maxMessages = Math.min(500, Math.max(1, Number(args["max-messages"] || 160)));
  const includeBots = args["include-bots"] === true || args["include-bots"] === "1";
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { collectSlackSourceRows } = loadCollector();

  let projectQuery = supabase
    .from("projects")
    .select("project_id, project_name, status, slack_channel_id")
    .not("slack_channel_id", "is", null)
    .order("project_id", { ascending: true });
  if (args.project) projectQuery = projectQuery.eq("project_id", String(args.project));
  if (!args["include-inactive"] && !args.project) projectQuery = projectQuery.or("status.in.(active,sales),project_category.eq.advisor");
  const { data: projects, error } = await projectQuery;
  if (error) throw error;

  const summary = [];
  for (const project of projects || []) {
    for (const ym of months) {
      const collected = await collectSlackSourceRows({
        token,
        projectId: project.project_id,
        projectName: project.project_name,
        ym,
        channelId: project.slack_channel_id,
        maxMessages,
        includeBots,
      });
      let savedCount = 0;
      if (collected.rows.length) {
        const { data: written, error: writeError } = await supabase
          .from("source_cache")
          .upsert(collected.rows, { onConflict: "project_id,source,item_id" })
          .select("id");
        if (writeError) throw writeError;
        savedCount = written?.length || collected.rows.length;
      }
      summary.push({
        project_id: project.project_id,
        project_name: project.project_name,
        ym,
        channel_id: project.slack_channel_id,
        channel_name: collected.channelName,
        message_count: collected.messageCount,
        thread_reply_count: collected.threadReplyCount,
        saved_count: savedCount,
      });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    projectCount: projects?.length || 0,
    months,
    includeBots,
    maxMessages,
    summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
