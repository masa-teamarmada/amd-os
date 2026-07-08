#!/usr/bin/env node

import fs from "node:fs/promises";
import dns from "node:dns";
import https from "node:https";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const DEFAULT_AUTOMATION_DIR = "/Users/masa/.codex/automations/amd-atlas";
const DEFAULT_OUTBOX_DIR = path.join(DEFAULT_AUTOMATION_DIR, "outbox");
const DEFAULT_APPLIED_DIR = path.join(DEFAULT_AUTOMATION_DIR, "applied");
const DEFAULT_FAILED_DIR = path.join(DEFAULT_AUTOMATION_DIR, "failed");
const DEFAULT_SNAPSHOT_DIR = path.join(DEFAULT_AUTOMATION_DIR, "snapshots");
const DEFAULT_INGEST_URL = "https://amd-os-pwa.vercel.app/api/atlas/signals-ingest";
const DEFAULT_RECENT_URL = "https://amd-os-pwa.vercel.app/api/atlas/recent-titles";
const DEFAULT_GET_TIMEOUT_MS = 30000;
const DEFAULT_POST_TIMEOUT_MS = 300000;
const TEMPFAIL_EXIT_CODE = 75;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENETDOWN",
  "ENETUNREACH",
  "EHOSTDOWN",
  "EHOSTUNREACH",
  "ETIMEDOUT",
  "EPERM",
]);
const STATIC_HOSTS = {
  "amd-os-pwa.vercel.app": ["64.29.17.3"],
};

function lookup(host, opts, cb) {
  const staticIps = STATIC_HOSTS[host];
  if (staticIps?.length) {
    return queueMicrotask(() => {
      if (opts?.all) return cb(null, staticIps.map((address) => ({ address, family: 4 })));
      return cb(null, staticIps[0], 4);
    });
  }
  return dns.lookup(host, opts, cb);
}

function parseArgs(argv) {
  const args = {};
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      rest.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return { command: rest[0] ?? "help", args };
}

function parseEnvText(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
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
    env[key] = value;
  }
  return env;
}

async function loadEnv() {
  const files = [
    path.join(REPO_ROOT, "pwa/.env.local"),
    path.join(REPO_ROOT, "pwa/.env.production.local"),
    path.join(REPO_ROOT, ".vercel/.env.production.local"),
    path.join(REPO_ROOT, "pwa/.vercel/.env.production.local"),
  ];
  const merged = {};
  for (const file of files) {
    try {
      Object.assign(merged, parseEnvText(await fs.readFile(file, "utf8")));
    } catch {
      // optional env file
    }
  }
  return { ...merged, ...process.env };
}

function authToken(env) {
  return env.ATLAS_INGEST_SECRET || env.CRON_SECRET || "";
}

function usage() {
  console.log(`Usage:
  node pwa/scripts/atlas_signal_review_tool.mjs health
  node pwa/scripts/atlas_signal_review_tool.mjs recent [--hours 48] [--limit 80]
  node pwa/scripts/atlas_signal_review_tool.mjs apply-outbox --file FILE
  node pwa/scripts/atlas_signal_review_tool.mjs apply-outbox-dir [--dir DIR]

Outbox format:
  {"signals":[{"title":"...","content":"...","source_url":"https://...","source_type":"news","domain":"I.ICT・AI","importance":"medium"}]}`);
}

async function ensureDirs() {
  await fs.mkdir(DEFAULT_OUTBOX_DIR, { recursive: true });
  await fs.mkdir(DEFAULT_APPLIED_DIR, { recursive: true });
  await fs.mkdir(DEFAULT_FAILED_DIR, { recursive: true });
  await fs.mkdir(DEFAULT_SNAPSHOT_DIR, { recursive: true });
}

function normalizeSignal(input) {
  if (!input || typeof input !== "object") return null;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";
  const sourceUrl =
    typeof input.source_url === "string"
      ? input.source_url.trim()
      : typeof input.sourceUrl === "string"
        ? input.sourceUrl.trim()
        : "";
  if (!title || !content || !sourceUrl) return null;
  const sourceType = typeof input.source_type === "string" ? input.source_type.trim() : "news";
  const importance = typeof input.importance === "string" ? input.importance.trim() : "medium";
  return {
    title,
    content,
    source_url: sourceUrl,
    source_type: ["news", "report", "data", "manual"].includes(sourceType) ? sourceType : "news",
    domain: typeof input.domain === "string" ? input.domain.trim() : "",
    importance: ["high", "medium", "low"].includes(importance) ? importance : "medium",
  };
}

function normalizePayload(raw) {
  const source = Array.isArray(raw) ? raw : raw?.signals;
  const signals = Array.isArray(source) ? source.map(normalizeSignal).filter(Boolean) : [];
  return { signals };
}

function requestJson(
  url,
  {
    method = "GET",
    headers = {},
    body = undefined,
    redirects = 3,
    timeoutMs = method === "POST" ? DEFAULT_POST_TIMEOUT_MS : DEFAULT_GET_TIMEOUT_MS,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const bodyText = body === undefined ? undefined : JSON.stringify(body);
    const req = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method,
      headers: {
        ...headers,
        ...(bodyText ? { "content-type": "application/json", "content-length": Buffer.byteLength(bodyText) } : {}),
      },
      lookup,
      servername: target.hostname,
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", async () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode || 0) &&
          res.headers.location &&
          redirects > 0
        ) {
          const nextUrl = new URL(res.headers.location, target).toString();
          try {
            resolve(await requestJson(nextUrl, { method, headers, body, redirects: redirects - 1 }));
          } catch (error) {
            reject(error);
          }
          return;
        }
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = { raw: text };
        }
        resolve({
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          status: res.statusCode || 0,
          json,
        });
      });
    });
    req.on("timeout", () => req.destroy(new Error(`timeout ${method} ${url}`)));
    req.on("error", reject);
    if (bodyText) req.write(bodyText);
    req.end();
  });
}

function classifyError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const retryable =
    RETRYABLE_ERROR_CODES.has(code) ||
    /timeout|timed out|fetch failed|network|socket hang up|ENOTFOUND/i.test(message);
  return {
    kind: retryable ? "transient_network" : "error",
    retryable,
    code: code || undefined,
    message,
  };
}

function isRetryableResponse(result) {
  return RETRYABLE_STATUS_CODES.has(Number(result?.status || 0));
}

async function postJson(url, token, body) {
  return requestJson(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body,
  });
}

async function getJson(url, token) {
  return requestJson(url, {
    headers: { authorization: `Bearer ${token}` },
  });
}

function withSuffix(file, suffix) {
  const parsed = path.parse(file);
  const stamp = new Date().toISOString().replace(/[:.]/g, "").replace("T", "-").slice(0, 15);
  return `${parsed.name}.${stamp}${suffix}${parsed.ext || ".json"}`;
}

async function moveFile(file, dir, suffix) {
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, withSuffix(file, suffix));
  await fs.rename(file, dest);
  return dest;
}

async function health(args) {
  await ensureDirs();
  const env = await loadEnv();
  const token = authToken(env);
  const recentUrl = args["recent-url"] || DEFAULT_RECENT_URL;
  const ingestUrl = args["ingest-url"] || DEFAULT_INGEST_URL;
  const result = {
    ok: false,
    hasToken: Boolean(token),
    recent: null,
    ingest: null,
  };
  if (!token) {
    console.log(JSON.stringify({ ...result, error: "ATLAS_INGEST_SECRET or CRON_SECRET missing" }, null, 2));
    process.exitCode = 1;
    return;
  }
  try {
    result.recent = await getJson(`${recentUrl}?hours=1&limit=1`, token);
    // Empty signals validates auth/env without inserting rows.
    result.ingest = await postJson(ingestUrl, token, { signals: [] });
  } catch (error) {
    const classified = classifyError(error);
    console.log(JSON.stringify({
      ...result,
      ok: false,
      retryable: classified.retryable,
      errorKind: classified.kind,
      error: classified.message,
      code: classified.code,
      action: classified.retryable ? "continue automation if source search is available" : "inspect helper/API configuration",
    }, null, 2));
    process.exitCode = classified.retryable ? TEMPFAIL_EXIT_CODE : 1;
    return;
  }
  result.ok =
    result.recent.ok &&
    result.recent.json?.ok === true &&
    result.ingest.status === 400 &&
    result.ingest.json?.error === "signals array required";
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

async function recent(args) {
  await ensureDirs();
  const env = await loadEnv();
  const token = authToken(env);
  if (!token) throw new Error("ATLAS_INGEST_SECRET or CRON_SECRET missing");
  const hours = Number(args.hours || 48);
  const limit = Number(args.limit || 80);
  const recentUrl = args["recent-url"] || DEFAULT_RECENT_URL;
  let result;
  try {
    result = await getJson(`${recentUrl}?hours=${hours}&limit=${limit}`, token);
  } catch (error) {
    const classified = classifyError(error);
    console.log(JSON.stringify({
      ok: false,
      retryable: classified.retryable,
      errorKind: classified.kind,
      error: classified.message,
      code: classified.code,
      action: classified.retryable ? "continue with duplicate-risk note" : "inspect helper/API configuration",
    }, null, 2));
    process.exitCode = classified.retryable ? TEMPFAIL_EXIT_CODE : 1;
    return;
  }
  const out = path.join(DEFAULT_SNAPSHOT_DIR, "recent-titles.json");
  await fs.writeFile(out, JSON.stringify({ fetchedAt: new Date().toISOString(), ...result.json }, null, 2));
  console.log(JSON.stringify({ ...result, snapshot: out }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

async function applyOutbox(args) {
  await ensureDirs();
  const file = args.file;
  if (!file || file === true) throw new Error("--file is required");
  const env = await loadEnv();
  const token = authToken(env);
  if (!token) throw new Error("ATLAS_INGEST_SECRET or CRON_SECRET missing");
  const ingestUrl = args["ingest-url"] || DEFAULT_INGEST_URL;
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  const payload = normalizePayload(raw);
  if (payload.signals.length === 0) {
    throw new Error("outbox has no valid signals");
  }
  let result;
  try {
    result = await postJson(ingestUrl, token, payload);
  } catch (error) {
    const classified = classifyError(error);
    console.log(JSON.stringify({
      ok: false,
      retryable: classified.retryable,
      errorKind: classified.kind,
      error: classified.message,
      code: classified.code,
      file,
      action: classified.retryable ? "left in outbox for next LaunchAgent retry" : "inspect helper/API configuration",
    }, null, 2));
    process.exitCode = classified.retryable ? TEMPFAIL_EXIT_CODE : 1;
    return;
  }
  if (!result.ok || result.json?.ok === false) {
    if (isRetryableResponse(result)) {
      console.log(JSON.stringify({
        ok: false,
        retryable: true,
        errorKind: "transient_http",
        file,
        result,
        action: "left in outbox for next LaunchAgent retry",
      }, null, 2));
      process.exitCode = TEMPFAIL_EXIT_CODE;
      return;
    }
    const dest = await moveFile(file, DEFAULT_FAILED_DIR, "failed");
    console.log(JSON.stringify({ ok: false, file, movedTo: dest, result }, null, 2));
    process.exitCode = 1;
    return;
  }
  if (result.json?.disabled === true) {
    console.log(JSON.stringify({
      ok: false,
      retryable: true,
      errorKind: "ingest_disabled",
      file,
      result,
      action: "left in outbox until Atlas ingest is enabled",
    }, null, 2));
    process.exitCode = TEMPFAIL_EXIT_CODE;
    return;
  }
  const dest = await moveFile(file, DEFAULT_APPLIED_DIR, "applied");
  console.log(JSON.stringify({ ok: true, file, movedTo: dest, result }, null, 2));
}

async function applyOutboxDir(args) {
  await ensureDirs();
  const dir = args.dir && args.dir !== true ? args.dir : DEFAULT_OUTBOX_DIR;
  const files = (await fs.readdir(dir))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(dir, name));
  const results = [];
  for (const file of files) {
    const beforeExitCode = process.exitCode;
    process.exitCode = 0;
    await applyOutbox({ ...args, file });
    const exitCode = process.exitCode || 0;
    results.push({ file, ok: exitCode === 0, retryable: exitCode === TEMPFAIL_EXIT_CODE });
    process.exitCode = beforeExitCode;
  }
  const failed = results.filter((r) => !r.ok).length;
  const retryable = results.filter((r) => r.retryable).length;
  const permanentFailed = results.filter((r) => !r.ok && !r.retryable).length;
  console.log(JSON.stringify({
    ok: failed === 0,
    processed: results.length,
    failed,
    retryable,
    permanentFailed,
    action: retryable > 0 && permanentFailed === 0 ? "left retryable files in outbox" : undefined,
    results,
  }, null, 2));
  if (permanentFailed > 0) process.exitCode = 1;
  else if (retryable > 0) process.exitCode = TEMPFAIL_EXIT_CODE;
}

const { command, args } = parseArgs(process.argv.slice(2));

try {
  if (command === "health") await health(args);
  else if (command === "recent") await recent(args);
  else if (command === "apply-outbox") await applyOutbox(args);
  else if (command === "apply-outbox-dir") await applyOutboxDir(args);
  else usage();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
