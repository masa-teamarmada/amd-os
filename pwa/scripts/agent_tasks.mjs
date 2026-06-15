#!/usr/bin/env node
/**
 * Local bridge for Codex / Claude Code Eimi to read and write AMD OS tasks.
 *
 * Examples:
 *   npm run agent:tasks -- list --status open --limit 20
 *   npm run agent:tasks -- create --project p00 --title "次のタスク" --agent codex --session-id 019e...
 *   npm run agent:tasks -- attach-session --task task_... --agent claude_code --session-url https://...
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(PWA_ROOT, "..");
const DEFAULT_BASE_URL = "https://amd-os-pwa.vercel.app";
const STATUS_VALUES = new Set(["pending", "todo", "doing", "review", "blocked", "done", "open", "all"]);
const PRIORITY_VALUES = new Set(["low", "medium", "high", "urgent"]);

loadEnv(path.join(PWA_ROOT, ".env.local"));
loadEnv(path.join(PWA_ROOT, ".env.production.local"));
loadEnv(path.join(REPO_ROOT, ".vercel", ".env.production.local"));
loadEnv(path.join(PWA_ROOT, ".vercel", ".env.production.local"));

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

function usage() {
  return `AMD OS agent task bridge

Commands:
  list [--status open|all|todo|doing|review|blocked|done] [--project p00] [--agent codex] [--session-id ID] [--limit 20] [--json]
  create --project p00 --title TITLE [--description TEXT] [--status todo] [--priority medium] [--assignee ID001] [--parent TASK_ID] [--agent codex|claude_code] [--session-id ID] [--session-url URL] [--session-label LABEL] [--json]
  update --task TASK_ID [--title TITLE] [--description TEXT] [--status doing] [--priority high] [--progress 50] [--session-id ID] [--session-url URL] [--session-label LABEL] [--json]
  attach-session --task TASK_ID [--agent codex|claude_code] --session-id ID [--session-url URL] [--session-label LABEL] [--json]

Env:
  CRON_SECRET is required. AMD_OS_TASKS_BASE_URL defaults to ${DEFAULT_BASE_URL}.
  AMD_OS_AGENT_KIND / AMD_OS_AGENT_SESSION_ID / AMD_OS_AGENT_SESSION_URL can provide defaults.`;
}

function required(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return String(value);
}

function baseUrl() {
  return (process.env.AMD_OS_TASKS_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function cronSecret() {
  return required(process.env.CRON_SECRET, "CRON_SECRET is required");
}

function cleanToken(value, fallback) {
  const text = String(value || fallback || "").trim();
  if (!text) return "";
  return text.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 80);
}

function numberOrUndefined(value) {
  if (value === undefined || value === true || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function sessionPayload(args) {
  const agentKind = cleanToken(args.agent, process.env.AMD_OS_AGENT_KIND || "codex");
  const sessionId = args["session-id"] || process.env.AMD_OS_AGENT_SESSION_ID || process.env.CODEX_THREAD_ID || process.env.CLAUDE_SESSION_ID || "";
  const sessionUrl = args["session-url"] || process.env.AMD_OS_AGENT_SESSION_URL || "";
  const sessionLabel = args["session-label"] || process.env.AMD_OS_AGENT_SESSION_LABEL || sessionId || "";
  return {
    taskSource: agentKind || "agent",
    agentKind: agentKind || "agent",
    agentSessionId: sessionId || null,
    agentSessionUrl: sessionUrl || null,
    agentSessionLabel: sessionLabel || null,
  };
}

function queryString(params) {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    url.set(key, String(value));
  }
  const text = url.toString();
  return text ? `?${text}` : "";
}

async function requestJson(pathname, { method = "GET", body, agentKind = "codex" } = {}) {
  const res = await fetch(`${baseUrl()}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${cronSecret()}`,
      "content-type": "application/json",
      "x-amd-os-agent": `agent_tasks:${agentKind}`,
    },
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
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(`${method} ${pathname} failed (${res.status}): ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
  return json;
}

function printTasks(tasks) {
  if (!tasks?.length) {
    console.log("No active tasks matched.");
    return;
  }
  for (const task of tasks) {
    const session = task.agentSessionLabel || task.agentSessionId || "";
    const sessionPart = session ? ` session=${session}` : "";
    const assignee = task.assigneeMemberId || task.assignee || "unassigned";
    console.log(`[${task.status}] ${task.projectId} ${task.taskId} ${task.title || "(no title)"} @${assignee}${sessionPart}`);
  }
}

async function listTasks(args) {
  const status = args.status || "open";
  if (!STATUS_VALUES.has(String(status))) throw new Error(`invalid status: ${status}`);
  const query = queryString({
    status,
    projectId: args.project || args["project-id"],
    assigneeMemberId: args.assignee,
    taskSource: args.source,
    agentKind: args.agent,
    agentSessionId: args["session-id"],
    limit: args.limit || 50,
  });
  const json = await requestJson(`/api/tasks${query}`, { agentKind: cleanToken(args.agent, "codex") });
  if (args.json) console.log(JSON.stringify(json, null, 2));
  else printTasks(json.tasks || []);
}

async function createTask(args) {
  const projectId = required(args.project || args["project-id"], "--project is required");
  const title = required(args.title, "--title is required");
  const status = args.status || "todo";
  if (!STATUS_VALUES.has(String(status)) || status === "open" || status === "all") throw new Error(`invalid status for create: ${status}`);
  const priority = args.priority || "medium";
  if (!PRIORITY_VALUES.has(String(priority))) throw new Error(`invalid priority: ${priority}`);
  const payload = {
    title,
    description: args.description || null,
    projectId,
    assigneeMemberId: args.assignee || null,
    status,
    priority,
    parentTaskId: args.parent || null,
    progress: numberOrUndefined(args.progress) ?? 0,
    ...sessionPayload(args),
  };
  const json = await requestJson("/api/tasks", {
    method: "POST",
    body: payload,
    agentKind: payload.agentKind,
  });
  if (args.json) console.log(JSON.stringify(json, null, 2));
  else printTasks([json.task]);
}

async function updateTask(args) {
  const taskId = required(args.task || args["task-id"], "--task is required");
  const payload = { taskId };
  if (args.title !== undefined) payload.title = args.title;
  if (args.description !== undefined) payload.description = args.description;
  if (args.status !== undefined) {
    if (!STATUS_VALUES.has(String(args.status)) || args.status === "open" || args.status === "all") throw new Error(`invalid status for update: ${args.status}`);
    payload.status = args.status;
  }
  if (args.priority !== undefined) {
    if (!PRIORITY_VALUES.has(String(args.priority))) throw new Error(`invalid priority: ${args.priority}`);
    payload.priority = args.priority;
  }
  if (args.progress !== undefined) payload.progress = numberOrUndefined(args.progress);
  if (args["session-id"] || args["session-url"] || args["session-label"] || args.agent) {
    Object.assign(payload, sessionPayload(args));
  }
  const json = await requestJson("/api/tasks", {
    method: "PATCH",
    body: payload,
    agentKind: cleanToken(args.agent, "codex"),
  });
  if (args.json) console.log(JSON.stringify(json, null, 2));
  else printTasks([json.task]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  if (command === "help" || args.help) {
    console.log(usage());
    return;
  }
  if (command === "list") return listTasks(args);
  if (command === "create") return createTask(args);
  if (command === "update") return updateTask(args);
  if (command === "attach-session") return updateTask({ ...args, title: undefined, description: undefined, status: undefined, priority: undefined, progress: undefined });
  throw new Error(`unknown command: ${command}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
