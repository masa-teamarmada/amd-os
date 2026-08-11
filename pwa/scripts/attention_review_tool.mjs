#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const SOURCE_KINDS = new Set(["proactive_todo", "l2_notification", "app_notification"]);
const ATTENTION_TYPES = new Set([
  "decision",
  "masa_action",
  "team_action",
  "recovery",
  "information",
  "waiting",
  "suppressed",
  "needs_source",
]);
const OWNERS = new Set(["none", "masa", "team", "system"]);
const MAX_LIMIT = 200;

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
    if (!next || next.startsWith("--")) args[key] = true;
    else {
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadEnv() {
  const merged = {};
  // .env.local is the current local source of truth. Stale Vercel pulls must not override it.
  for (const file of [path.join(REPO_ROOT, "pwa/.env.production.local"), path.join(REPO_ROOT, "pwa/.env.local")]) {
    try {
      Object.assign(merged, parseEnvText(await fs.readFile(file, "utf8")));
    } catch {
      // optional
    }
  }
  return { ...merged, ...process.env };
}

async function adminClient() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin environment is missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function asText(value, max = 700) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function sanitizeAttentionText(value, max = 700) {
  return asText(value, max * 2)
    .replace(/https?:\/\/\S+/gi, "[URL省略]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[メール省略]")
    .replace(/(?:password|passcode|secret|token|api[_ -]?key|パスワード|パスコード|暗証番号)[^。\n]{0,100}/gi, "[認証情報省略]")
    .replace(/\b\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}\b/g, "[電話番号省略]")
    .slice(0, max);
}

function sourceHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function proactiveSemantic(row) {
  return {
    project_id: row.project_id,
    trigger_kind: row.trigger_kind,
    source_meeting_id: row.source_meeting_id ?? "",
    source_event_id: row.source_event_id ?? "",
    title: row.title,
    detail: row.detail ?? "",
    ball_owner: row.ball_owner,
    due_at: row.due_at,
    due_basis: row.due_basis ?? "unknown",
  };
}

function l2Semantic(row) {
  return {
    l2_kind: row.l2_kind,
    target_id: row.target_id,
    scope_key: row.scope_key,
    title: row.title,
    summary: row.summary ?? "",
    saved_count: Number(row.saved_count ?? 0),
    total_count: Number(row.total_count ?? 0),
    metadata_json: row.metadata_json ?? null,
  };
}

function appSemantic(row) {
  return {
    kind: row.kind,
    title: row.title,
    body: row.body ?? "",
    link: row.link ?? "",
    meta: row.meta ?? null,
    source: row.source,
  };
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function appContractHints(meta) {
  const root = objectValue(meta);
  const contract = objectValue(root?.action_contract) ?? objectValue(root?.notification_contract);
  const owner = sanitizeAttentionText(contract?.action_owner, 80) || "none";
  return {
    action_owner: owner,
    action_required: sanitizeAttentionText(contract?.action_required, 300) || null,
    action_label: sanitizeAttentionText(contract?.action_label, 120) || null,
    has_action_url: Boolean(asText(contract?.action_url, 400)),
    completion_condition: sanitizeAttentionText(contract?.completion_condition, 300) || null,
    why_now: sanitizeAttentionText(contract?.why_now, 300) || null,
    direct_reauth_url: Boolean(
      asText(root?.reauth_url, 400)
      || asText(root?.reauth_install_url, 400)
      || asText(root?.reauth_app_url, 400),
    ),
  };
}

function metadataHints(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const key of [
    "origin_kind",
    "destination_label",
    "approval_effect",
    "effect",
    "gap_class",
    "proposed_target_l2",
    "action_category",
    "notification_channel",
  ]) {
    const text = sanitizeAttentionText(value[key], 180);
    if (text) out[key] = text;
  }
  return out;
}

export function proactivePreparedItem(row) {
  const semantic = proactiveSemantic(row);
  return {
    source_kind: "proactive_todo",
    source_id: String(row.id),
    source_hash: sourceHash(semantic),
    item_kind: String(row.trigger_kind),
    target: sanitizeAttentionText(row.project_id, 80),
    title: sanitizeAttentionText(row.title, 220),
    summary: sanitizeAttentionText(row.detail, 700),
    ball_owner: String(row.ball_owner ?? "ambiguous"),
    due_at: row.due_at,
    due_basis: row.due_basis ?? "unknown",
    priority_hint: row.priority ?? "normal",
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function l2PreparedItem(row, feedbackKeys = new Set()) {
  const semantic = l2Semantic(row);
  const feedbackKey = `${row.l2_kind}|${row.target_id}|${row.scope_key}`;
  return {
    source_kind: "l2_notification",
    source_id: String(row.notification_id),
    source_hash: sourceHash(semantic),
    item_kind: String(row.l2_kind),
    target: sanitizeAttentionText(row.target_id, 100),
    scope: sanitizeAttentionText(row.scope_key, 120),
    title: sanitizeAttentionText(row.title, 220),
    summary: sanitizeAttentionText(row.summary, 700),
    saved_count: Number(row.saved_count ?? 0),
    total_count: Number(row.total_count ?? 0),
    already_saved: Number(row.saved_count ?? 0) > 0,
    already_answered: feedbackKeys.has(feedbackKey),
    metadata_hints: metadataHints(row.metadata_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function appPreparedItem(row) {
  const semantic = appSemantic(row);
  return {
    source_kind: "app_notification",
    source_id: String(row.id),
    source_hash: sourceHash(semantic),
    item_kind: String(row.kind),
    target: sanitizeAttentionText(row.source, 100),
    title: sanitizeAttentionText(row.title, 220),
    summary: sanitizeAttentionText(row.body, 700),
    action_contract: appContractHints(row.meta),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function prepare(args) {
  const db = await adminClient();
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(args.limit || 120)));
  const [proactiveRes, l2Res, appRes, feedbackRes] = await Promise.all([
    db
      .from("proactive_todos")
      .select("id,project_id,trigger_kind,source_meeting_id,source_event_id,title,detail,ball_owner,due_at,due_basis,priority,status,created_at,updated_at")
      .in("status", ["open", "blocked"])
      .eq("attention_state", "pending")
      .order("updated_at", { ascending: false })
      .limit(limit),
    db
      .from("l2_notifications")
      .select("notification_id,l2_kind,target_id,scope_key,title,summary,saved_count,total_count,metadata_json,created_at,updated_at")
      .eq("attention_state", "pending")
      .order("updated_at", { ascending: false })
      .limit(limit),
    db
      .from("app_notifications")
      .select("id,kind,title,body,link,meta,source,read_at,dismissed_at,created_at,updated_at")
      .eq("attention_state", "pending")
      .is("read_at", null)
      .is("dismissed_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit),
    db
      .from("l2_feedbacks")
      .select("l2_kind,target_id,scope_key")
      .eq("status", "active")
      .limit(1000),
  ]);
  for (const result of [proactiveRes, l2Res, appRes, feedbackRes]) {
    if (result.error) throw new Error(result.error.message);
  }
  const feedbackKeys = new Set((feedbackRes.data ?? []).map((row) => `${row.l2_kind}|${row.target_id}|${row.scope_key}`));
  const items = [
    ...(proactiveRes.data ?? []).map(proactivePreparedItem),
    ...(l2Res.data ?? []).map((row) => l2PreparedItem(row, feedbackKeys)),
    ...(appRes.data ?? []).map(appPreparedItem),
  ]
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, limit);
  const payload = {
    version: 1,
    generated_at: new Date().toISOString(),
    contract: "amd-os-attention-review-v1",
    item_count: items.length,
    items,
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  if (args.output && args.output !== true) await fs.writeFile(String(args.output), json, { mode: 0o600 });
  if (args.quiet) console.log(JSON.stringify({ ok: true, item_count: items.length }));
  else console.log(json.trim());
}

function requireText(value, field, max, errors) {
  const text = asText(value, max + 1);
  if (!text) errors.push(`${field} is required`);
  if (text.length > max) errors.push(`${field} exceeds ${max}`);
  if (/https?:\/\/|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) errors.push(`${field} contains URL or email`);
  return text;
}

export function validateReviewPayload(payload, prepared) {
  const errors = [];
  if (!payload || typeof payload !== "object") return ["review payload must be an object"];
  if (payload.version !== 1) errors.push("version must be 1");
  if (payload.reviewer !== "codex-automation") errors.push("reviewer must be codex-automation");
  if (!Array.isArray(payload.decisions)) errors.push("decisions must be an array");
  if (!prepared || prepared.contract !== "amd-os-attention-review-v1" || !Array.isArray(prepared.items)) {
    errors.push("prepared payload is invalid");
    return errors;
  }
  const expected = new Map(prepared.items.map((item) => [`${item.source_kind}|${item.source_id}`, item]));
  const seen = new Set();
  for (const [index, decision] of (payload.decisions ?? []).entries()) {
    const prefix = `decisions[${index}]`;
    if (!SOURCE_KINDS.has(decision?.source_kind)) errors.push(`${prefix}.source_kind is invalid`);
    const key = `${decision?.source_kind}|${decision?.source_id}`;
    if (seen.has(key)) errors.push(`${prefix} is duplicated`);
    seen.add(key);
    const item = expected.get(key);
    if (!item) errors.push(`${prefix} is not in prepared payload`);
    else if (decision.source_hash !== item.source_hash) errors.push(`${prefix}.source_hash mismatch`);
    if (!ATTENTION_TYPES.has(decision?.attention_type)) errors.push(`${prefix}.attention_type is invalid`);
    if (!OWNERS.has(decision?.owner)) errors.push(`${prefix}.owner is invalid`);
    if (typeof decision?.requires_masa_decision !== "boolean") errors.push(`${prefix}.requires_masa_decision must be boolean`);
    const confidence = Number(decision?.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) errors.push(`${prefix}.confidence must be 0..1`);
    requireText(decision?.reason, `${prefix}.reason`, 500, errors);
    const action = asText(decision?.action, 500);
    const effect = asText(decision?.effect, 500);

    if (decision?.attention_type === "decision") {
      if (decision.owner !== "masa" || decision.requires_masa_decision !== true) errors.push(`${prefix}: decision must be owned by masa and require a decision`);
      requireText(action, `${prefix}.action`, 500, errors);
      requireText(effect, `${prefix}.effect`, 500, errors);
    } else if (decision?.attention_type === "masa_action") {
      if (decision.owner !== "masa" || decision.requires_masa_decision !== false) errors.push(`${prefix}: masa_action ownership is invalid`);
      requireText(action, `${prefix}.action`, 500, errors);
    } else if (decision?.requires_masa_decision !== false) {
      errors.push(`${prefix}: non-decision must not require masa decision`);
    }

    if (item?.source_kind === "l2_notification" && decision?.attention_type === "masa_action") {
      errors.push(`${prefix}: l2 notification cannot be masa_action; use app notification action contract`);
    }
    if (item?.source_kind === "l2_notification" && item.already_answered && decision?.attention_type === "decision") {
      errors.push(`${prefix}: answered l2 item cannot be a decision`);
    }
    if (item?.source_kind === "l2_notification" && item.already_saved && item.item_kind !== "coverage_gap" && decision?.attention_type === "decision") {
      errors.push(`${prefix}: already-saved l2 result cannot be a decision`);
    }
    if (item?.source_kind === "l2_notification" && ["raw_data_gap", "project_config_gap"].includes(item.item_kind) && decision?.attention_type === "decision") {
      errors.push(`${prefix}: data/config gap is a recovery lane, not a masa decision`);
    }
    if (item?.source_kind === "app_notification" && ["decision", "masa_action"].includes(decision?.attention_type)) {
      const contract = item.action_contract ?? {};
      const ownerIsMasa = ["masa", "まさ"].includes(String(contract.action_owner ?? "").toLowerCase());
      const complete = ownerIsMasa && contract.action_required && contract.has_action_url && contract.completion_condition;
      if (!complete) errors.push(`${prefix}: approved app notification requires a complete masa action contract`);
      if (item.item_kind === "meeting_action") errors.push(`${prefix}: meeting actions belong in the action ledger, not the notification surface`);
    }
  }
  if (seen.size !== expected.size) errors.push(`decisions must cover all prepared items (${seen.size}/${expected.size})`);
  return errors;
}

async function readJson(file, label) {
  if (!file || file === true) throw new Error(`--${label} is required`);
  return JSON.parse(await fs.readFile(String(file), "utf8"));
}

async function validateCommand(args) {
  const payload = await readJson(args.file, "file");
  const prepared = await readJson(args.prepared, "prepared");
  const errors = validateReviewPayload(payload, prepared);
  console.log(JSON.stringify({ ok: errors.length === 0, reviewed: payload.decisions?.length ?? 0, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}

function attentionState(type) {
  if (type === "decision" || type === "masa_action") return "approved";
  if (type === "needs_source") return "needs_source";
  return "suppressed";
}

async function currentPreparedItem(db, decision) {
  if (decision.source_kind === "proactive_todo") {
    const { data, error } = await db
      .from("proactive_todos")
      .select("id,project_id,trigger_kind,source_meeting_id,source_event_id,title,detail,ball_owner,due_at,due_basis,priority,status,created_at,updated_at")
      .eq("id", decision.source_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? proactivePreparedItem(data) : null;
  }
  if (decision.source_kind === "l2_notification") {
    const { data, error } = await db
      .from("l2_notifications")
      .select("notification_id,l2_kind,target_id,scope_key,title,summary,saved_count,total_count,metadata_json,created_at,updated_at")
      .eq("notification_id", decision.source_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? l2PreparedItem(data) : null;
  }
  const { data, error } = await db
    .from("app_notifications")
    .select("id,kind,title,body,link,meta,source,read_at,dismissed_at,created_at,updated_at")
    .eq("id", decision.source_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? appPreparedItem(data) : null;
}

async function applyCommand(args) {
  const payload = await readJson(args.file, "file");
  const prepared = await readJson(args.prepared, "prepared");
  const errors = validateReviewPayload(payload, prepared);
  if (errors.length) throw new Error(`review validation failed: ${errors.slice(0, 5).join("; ")}`);
  const db = await adminClient();
  const stats = { reviewed: payload.decisions.length, approved: 0, suppressed: 0, needs_source: 0, stale: 0, missing: 0, errors: 0 };
  for (const decision of payload.decisions) {
    try {
      const current = await currentPreparedItem(db, decision);
      if (!current) {
        stats.missing++;
        continue;
      }
      if (current.source_hash !== decision.source_hash) {
        stats.stale++;
        continue;
      }
      const state = attentionState(decision.attention_type);
      const patch = {
        attention_state: state,
        attention_type: decision.attention_type,
        attention_owner: decision.owner,
        requires_masa_decision: decision.requires_masa_decision,
        attention_reason: asText(decision.reason, 500),
        attention_action: asText(decision.action, 500) || null,
        attention_effect: asText(decision.effect, 500) || null,
        attention_confidence: Number(decision.confidence),
        attention_source_hash: decision.source_hash,
        attention_reviewed_at: new Date().toISOString(),
        attention_reviewed_by: "codex-automation",
        ...(decision.source_kind === "l2_notification" && state === "approved" ? { notified_at: null, read_at: null } : {}),
      };
      const table = decision.source_kind === "proactive_todo"
        ? "proactive_todos"
        : decision.source_kind === "l2_notification"
          ? "l2_notifications"
          : "app_notifications";
      const key = decision.source_kind === "l2_notification" ? "notification_id" : "id";
      const { error } = await db.from(table).update(patch).eq(key, decision.source_id);
      if (error) throw new Error(error.message);
      stats[state]++;
    } catch {
      stats.errors++;
    }
  }
  const ok = stats.errors === 0;
  console.log(JSON.stringify({ ok, ...stats }, null, 2));
  if (!ok) process.exitCode = 1;
}

function usage() {
  console.log(`Usage:
  node pwa/scripts/attention_review_tool.mjs prepare --output /private/tmp/prepared.json [--limit 120]
  node pwa/scripts/attention_review_tool.mjs validate --prepared /private/tmp/prepared.json --file /private/tmp/review.json
  node pwa/scripts/attention_review_tool.mjs apply --prepared /private/tmp/prepared.json --file /private/tmp/review.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { command, args } = parseArgs(process.argv.slice(2));
  try {
    if (command === "prepare") await prepare(args);
    else if (command === "validate") await validateCommand(args);
    else if (command === "apply") await applyCommand(args);
    else usage();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
