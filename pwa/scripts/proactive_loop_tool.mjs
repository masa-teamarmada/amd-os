#!/usr/bin/env node
/**
 * Proactive Operating Loop helper.
 *
 * This is a local/operator helper for the control-layer outbox. It writes only
 * operational state for proactive_outbox/proactive_loop_events/proactive_loops;
 * it is not an external-user tool and does not generate or send counterpart
 * messages by itself.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(PWA_ROOT, "..");
const DEFAULT_DUE_HOURS = 72;
const DEFAULT_LIMIT = 20;
const ACTOR_ID = process.env.PROACTIVE_LOOP_ACTOR || "proactive_loop_tool";
const PROJECT_LABELS = {
  p25: "KUTE",
  zmp: "ZMP / OkuDoor",
  p19: "ZMP / OkuDoor",
  p20: "CX",
  p21: "SX",
  p26: "VSX / 香川大",
  nims_os: "NIMS / AMD OS導入",
};
const INITIAL_TARGETS = [
  { label: "KUTE", project_ids: ["p25"] },
  { label: "ZMP / OkuDoor / Tokyo University of Science", project_ids: ["p19", "zmp"] },
  { label: "CX", project_ids: ["p20"] },
  { label: "SX", project_ids: ["p21"] },
  { label: "VSX / Kagawa University", project_ids: ["p26"] },
  { label: "NIMS OS install", project_ids: ["nims_os"] },
];

loadEnv(path.join(PWA_ROOT, ".env.local"));
loadEnv(path.join(PWA_ROOT, ".env.production.local"));
loadEnv(path.join(REPO_ROOT, ".vercel", ".env.production.local"));
loadEnv(path.join(PWA_ROOT, ".vercel", ".env.production.local"));

const SUPABASE_URL = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const SERVICE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

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

function requiredEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value.trim();
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      out._.push(token);
      continue;
    }
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

function enc(value) {
  return encodeURIComponent(String(value));
}

function inList(values) {
  return `(${values.map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(",")})`;
}

function rest(table, query = "") {
  return `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`;
}

function restHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    "content-type": "application/json",
    ...extra,
  };
}

async function requestJson(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: restHeaders(headers),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  if (!res.ok) {
    throw new Error(`${method} ${url} failed (${res.status}): ${typeof json === "string" ? json : text}`);
  }
  return json;
}

async function getRows(table, query) {
  return requestJson(rest(table, query), { headers: { accept: "application/json" } });
}

async function patchRows(table, filter, body) {
  return requestJson(rest(table, `${filter}&select=*`), {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body,
  });
}

async function insertRow(table, body) {
  return requestJson(rest(table, "select=*"), {
    method: "POST",
    headers: { prefer: "return=representation" },
    body,
  });
}

function nowIso() {
  return new Date().toISOString();
}

function parseStatuses(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLimit(value) {
  const n = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(200, Math.floor(n));
}

function sortOutbox(rows) {
  const priorityRank = { red: 1, yellow: 2, green: 3 };
  return [...(rows || [])].sort((a, b) => {
    const pa = priorityRank[a.priority] || 9;
    const pb = priorityRank[b.priority] || 9;
    if (pa !== pb) return pa - pb;
    return String(a.due_at || "").localeCompare(String(b.due_at || ""));
  });
}

function formatJst(iso) {
  if (!iso) return "未設定";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function labelForProject(projectId) {
  return PROJECT_LABELS[projectId] || projectId;
}

function evidenceLines(refs) {
  const items = Array.isArray(refs) ? refs : [];
  if (!items.length) return "- 未設定";
  return items.map((ref) => {
    const source = ref.source || ref.url || ref.id || "source";
    const section = ref.section ? ` / ${ref.section}` : "";
    const snippet = ref.snippet ? `: ${ref.snippet}` : "";
    return `- ${source}${section}${snippet}`;
  }).join("\n");
}

function buildCommanderPrompt(row) {
  const label = labelForProject(row.project_id);
  const title = `【先手力outbox】${label}: ${row.draft_type} / ${row.trigger_type}`;
  return `${title}

priority: ${row.priority}
due_at: ${formatJst(row.due_at)} JST
project_id: ${row.project_id}
outbox_id: ${row.outbox_id}
trigger: ${row.trigger_type}
ball_owner: ${row.ball_owner}
draft_type: ${row.draft_type}

推奨 first move:
${row.recommended_first_move}

遅れた場合のリスク:
${row.risk_if_late}

根拠:
${evidenceLines(row.evidence_refs)}

司令塔でやること:
1. 必要なら worker を切って、上の first move のドラフト/整理資料を作る。
2. worker には成果物、検証、残課題、次アクションをこの司令塔へ能動報告させる。
3. 外部送付またはチーム提示が終わったら proactive_outbox を drafted / sent_to_counterpart / closed のどれかへ進める。

heartbeat note:
この通知は 10:15-20:15 JST 毎時15分の先手力 heartbeat が queued/blocked outbox を拾って送る運用。重い draft 生成は heartbeat ではやらない。`;
}

async function heartbeat(args) {
  const listResult = await listOutbox({
    ...args,
    status: args.status || "queued,blocked",
    limit: args.limit || DEFAULT_LIMIT,
  });
  const actions = listResult.rows.map((row) => ({
    outbox_id: row.outbox_id,
    project_id: row.project_id,
    project_label: labelForProject(row.project_id),
    status: row.status,
    priority: row.priority,
    due_at: row.due_at,
    due_at_jst: formatJst(row.due_at),
    commander_thread_id: row.commander_thread_id || null,
    can_send: Boolean(row.commander_thread_id),
    prompt: buildCommanderPrompt(row),
    mark_sent_command: `node pwa/scripts/proactive_loop_tool.mjs mark-sent ${row.outbox_id} --summary "Heartbeat notified ${labelForProject(row.project_id)} commander."`,
  }));
  return {
    ok: true,
    count: actions.length,
    due_hours: Number(args["due-hours"] || DEFAULT_DUE_HOURS),
    actions,
    missing_routes: actions.filter((action) => !action.can_send),
  };
}

async function loadOutbox(outboxId) {
  if (!outboxId) throw new Error("outbox_id is required");
  const rows = await getRows(
    "proactive_outbox",
    `select=*&outbox_id=eq.${enc(outboxId)}&limit=1`,
  );
  if (!rows?.[0]) throw new Error(`proactive_outbox not found: ${outboxId}`);
  return rows[0];
}

function buildEvent(row, eventType, summary, metadata = {}) {
  return {
    loop_id: row.loop_id || null,
    outbox_id: row.outbox_id,
    project_id: row.project_id,
    event_type: eventType,
    event_summary: summary,
    actor_kind: "codex",
    actor_id: ACTOR_ID,
    metadata_json: {
      ...metadata,
      previous_status: row.status,
    },
  };
}

function mutationPlan({ row, patch, event, loopPatch = null }) {
  return {
    ok: true,
    dryRun: true,
    outbox_id: row.outbox_id,
    current_status: row.status,
    patch,
    event,
    loopPatch,
  };
}

async function applyMutation({ row, patch, event, dryRun, loopPatch = null }) {
  if (dryRun) return mutationPlan({ row, patch, event, loopPatch });
  const updated = await patchRows("proactive_outbox", `outbox_id=eq.${enc(row.outbox_id)}`, patch);
  const insertedEvent = await insertRow("proactive_loop_events", event);
  let updatedLoop = null;
  if (loopPatch?.loop_id) {
    updatedLoop = await patchRows("proactive_loops", `loop_id=eq.${enc(loopPatch.loop_id)}`, loopPatch.patch);
  }
  return {
    ok: true,
    outbox: updated?.[0] || null,
    event: insertedEvent?.[0] || null,
    loop: updatedLoop?.[0] || null,
  };
}

async function listOutbox(args) {
  const explicitStatus = Boolean(args.status);
  const statuses = parseStatuses(args.status, ["queued", "blocked"]);
  const limit = parseLimit(args.limit);
  const parts = [
    "select=*",
    `status=in.${inList(statuses)}`,
    `limit=${limit}`,
  ];
  if (args.project) parts.push(`project_id=eq.${enc(args.project)}`);
  if (args.institution) parts.push(`institution_id=eq.${enc(args.institution)}`);
  if (!explicitStatus || args["due-hours"]) {
    const dueHours = Number(args["due-hours"] || DEFAULT_DUE_HOURS);
    const dueAt = new Date(Date.now() + Math.max(0, dueHours) * 60 * 60 * 1000).toISOString();
    parts.push(`due_at=lte.${enc(dueAt)}`);
  }
  const rows = sortOutbox(await getRows("proactive_outbox", parts.join("&")));
  return { ok: true, count: rows.length, rows };
}

async function threads(args) {
  const statuses = parseStatuses(args.status, ["active"]);
  const parts = [
    "select=*",
    `status=in.${inList(statuses)}`,
    `limit=${parseLimit(args.limit || 100)}`,
    "order=project_id.asc,created_at.asc",
  ];
  if (args.project) parts.push(`project_id=eq.${enc(args.project)}`);
  if (args.institution) parts.push(`institution_id=eq.${enc(args.institution)}`);
  const rows = await getRows("project_commander_threads", parts.join("&"));
  return { ok: true, count: rows?.length || 0, rows: rows || [] };
}

async function seedCheck() {
  const projectIds = [...new Set(INITIAL_TARGETS.flatMap((target) => target.project_ids))];
  const projectFilter = `project_id=in.${inList(projectIds)}`;
  const [threadRows, loopRows, outboxRows] = await Promise.all([
    getRows("project_commander_threads", `select=project_id,institution_id,commander_thread_id,thread_label,status&${projectFilter}`),
    getRows("proactive_loops", `select=project_id,status&${projectFilter}`),
    getRows("proactive_outbox", `select=project_id,status&${projectFilter}`),
  ]);
  const summary = INITIAL_TARGETS.map((target) => {
    const aliases = new Set(target.project_ids);
    const targetThreads = (threadRows || []).filter((row) => aliases.has(row.project_id));
    const targetLoops = (loopRows || []).filter((row) => aliases.has(row.project_id));
    const targetOutbox = (outboxRows || []).filter((row) => aliases.has(row.project_id));
    const foundProjectIds = [...new Set([
      ...targetThreads.map((row) => row.project_id),
      ...targetLoops.map((row) => row.project_id),
      ...targetOutbox.map((row) => row.project_id),
    ])].sort();
    return {
      label: target.label,
      project_ids: target.project_ids,
      found_project_ids: foundProjectIds,
      thread_count: targetThreads.length,
      active_thread_count: targetThreads.filter((row) => row.status === "active").length,
      open_loop_count: targetLoops.filter((row) => ["open", "watching", "blocked"].includes(row.status)).length,
      active_outbox_count: targetOutbox.filter((row) => !["closed"].includes(row.status)).length,
    };
  });
  return { ok: true, targets: summary };
}

async function markSent(outboxId, args) {
  const row = await loadOutbox(outboxId);
  const at = nowIso();
  const patch = {
    status: "sent_to_commander",
    sent_at: at,
    blocked_reason: null,
  };
  const event = buildEvent(row, "sent_to_commander", args.summary || "Sent to commander thread.", {
    sent_at: at,
    commander_thread_id: row.commander_thread_id || null,
  });
  return applyMutation({ row, patch, event, dryRun: args["dry-run"] === true });
}

async function markDrafted(outboxId, args) {
  if (!args.artifact) throw new Error("mark-drafted requires --artifact <path-or-url>");
  if (!args.summary) throw new Error("mark-drafted requires --summary <text>");
  const row = await loadOutbox(outboxId);
  const at = nowIso();
  const currentRefs = Array.isArray(row.draft_artifact_refs) ? row.draft_artifact_refs : [];
  const artifactRef = {
    artifact: String(args.artifact),
    summary: String(args.summary),
    added_at: at,
    added_by: ACTOR_ID,
  };
  const patch = {
    status: "drafted",
    drafted_at: at,
    blocked_reason: null,
    draft_artifact_refs: [...currentRefs, artifactRef],
  };
  const event = buildEvent(row, "drafted", args.summary, { drafted_at: at, artifact_ref: artifactRef });
  return applyMutation({ row, patch, event, dryRun: args["dry-run"] === true });
}

async function markCounterpartSent(outboxId, args) {
  const row = await loadOutbox(outboxId);
  const at = nowIso();
  const summary = args.summary || "Counterpart send confirmed by operator.";
  const patch = {
    status: "sent_to_counterpart",
    sent_to_counterpart_at: at,
    blocked_reason: null,
  };
  const event = buildEvent(row, "sent_to_counterpart", summary, { sent_to_counterpart_at: at });
  return applyMutation({ row, patch, event, dryRun: args["dry-run"] === true });
}

async function closeOutbox(outboxId, args) {
  if (!args.summary) throw new Error("close requires --summary <text>");
  const row = await loadOutbox(outboxId);
  const at = nowIso();
  const patch = {
    status: "closed",
    closed_at: at,
    blocked_reason: null,
  };
  const event = buildEvent(row, "closed", args.summary, { closed_at: at });
  let loopPatch = null;
  if (row.loop_id) {
    const siblings = await getRows(
      "proactive_outbox",
      `select=outbox_id,status&loop_id=eq.${enc(row.loop_id)}&outbox_id=neq.${enc(row.outbox_id)}`,
    );
    const hasOpenSibling = (siblings || []).some((item) => !["closed", "sent_to_counterpart"].includes(item.status));
    if (!hasOpenSibling) {
      loopPatch = {
        loop_id: row.loop_id,
        patch: {
          status: "closed",
          closed_at: at,
        },
      };
    }
  }
  return applyMutation({ row, patch, event, dryRun: args["dry-run"] === true, loopPatch });
}

async function blockOutbox(outboxId, args) {
  if (!args.reason) throw new Error("block requires --reason <text>");
  const row = await loadOutbox(outboxId);
  const patch = {
    status: "blocked",
    blocked_reason: String(args.reason),
  };
  const event = buildEvent(row, "blocked", args.reason, { blocked_reason: String(args.reason) });
  return applyMutation({ row, patch, event, dryRun: args["dry-run"] === true });
}

function usage() {
  return {
    ok: true,
    usage: [
      "node pwa/scripts/proactive_loop_tool.mjs list [--status queued,blocked] [--project p25] [--institution inst_id] [--limit 20] [--json]",
      "node pwa/scripts/proactive_loop_tool.mjs heartbeat [--status queued,blocked] [--due-hours 72] [--limit 20] [--json]",
      "node pwa/scripts/proactive_loop_tool.mjs threads [--project p25] [--institution inst_id] [--status active] [--json]",
      "node pwa/scripts/proactive_loop_tool.mjs seed-check [--json]",
      "node pwa/scripts/proactive_loop_tool.mjs mark-sent <outbox_id> [--summary text] [--dry-run]",
      "node pwa/scripts/proactive_loop_tool.mjs mark-drafted <outbox_id> --artifact <path-or-url> --summary <text> [--dry-run]",
      "node pwa/scripts/proactive_loop_tool.mjs mark-counterpart-sent <outbox_id> [--summary text] [--dry-run]",
      "node pwa/scripts/proactive_loop_tool.mjs close <outbox_id> --summary <text> [--dry-run]",
      "node pwa/scripts/proactive_loop_tool.mjs block <outbox_id> --reason <text> [--dry-run]",
    ],
  };
}

function printTable(rows, columns) {
  if (!rows?.length) {
    console.log("(no rows)");
    return;
  }
  const widths = columns.map((column) => Math.max(column.header.length, ...rows.map((row) => String(column.get(row) ?? "").length)));
  console.log(columns.map((column, idx) => column.header.padEnd(widths[idx])).join("  "));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(columns.map((column, idx) => String(column.get(row) ?? "").padEnd(widths[idx])).join("  "));
  }
}

function printHuman(command, result) {
  if (command === "list") {
    printTable(result.rows, [
      { header: "priority", get: (row) => row.priority },
      { header: "status", get: (row) => row.status },
      { header: "due_at", get: (row) => row.due_at },
      { header: "project", get: (row) => row.project_id },
      { header: "draft", get: (row) => row.draft_type },
      { header: "trigger", get: (row) => row.trigger_type },
      { header: "outbox_id", get: (row) => row.outbox_id },
    ]);
    return;
  }
  if (command === "heartbeat") {
    printTable(result.actions, [
      { header: "send", get: (row) => (row.can_send ? "yes" : "no") },
      { header: "priority", get: (row) => row.priority },
      { header: "status", get: (row) => row.status },
      { header: "due_at_jst", get: (row) => row.due_at_jst },
      { header: "project", get: (row) => row.project_label },
      { header: "thread_id", get: (row) => row.commander_thread_id || "" },
      { header: "outbox_id", get: (row) => row.outbox_id },
    ]);
    return;
  }
  if (command === "threads") {
    printTable(result.rows, [
      { header: "status", get: (row) => row.status },
      { header: "project", get: (row) => row.project_id },
      { header: "institution", get: (row) => row.institution_id || "" },
      { header: "label", get: (row) => row.thread_label || "" },
      { header: "thread_id", get: (row) => row.commander_thread_id },
    ]);
    return;
  }
  if (command === "seed-check") {
    printTable(result.targets, [
      { header: "target", get: (row) => row.label },
      { header: "projects", get: (row) => row.project_ids.join(",") },
      { header: "found", get: (row) => row.found_project_ids.join(",") },
      { header: "threads", get: (row) => row.active_thread_count },
      { header: "open_loops", get: (row) => row.open_loop_count },
      { header: "outbox", get: (row) => row.active_outbox_count },
    ]);
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  const outboxId = args._[1];
  let result;
  if (command === "list") result = await listOutbox(args);
  else if (command === "heartbeat") result = await heartbeat(args);
  else if (command === "threads") result = await threads(args);
  else if (command === "seed-check") result = await seedCheck(args);
  else if (command === "mark-sent") result = await markSent(outboxId, args);
  else if (command === "mark-drafted") result = await markDrafted(outboxId, args);
  else if (command === "mark-counterpart-sent") result = await markCounterpartSent(outboxId, args);
  else if (command === "close") result = await closeOutbox(outboxId, args);
  else if (command === "block") result = await blockOutbox(outboxId, args);
  else result = usage();

  if (args.json || !["list", "heartbeat", "threads", "seed-check"].includes(command)) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(command, result);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
