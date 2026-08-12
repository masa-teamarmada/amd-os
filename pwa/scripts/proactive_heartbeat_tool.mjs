#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const CONTRACT = "amd-os-final-decision-review-v1";
const PROMPT_KEY = "attention.l2.final_decision.v1";
const MAX_LIMIT = 200;
const DISPOSITIONS = new Set(["approve", "suppress", "needs_source"]);

const DECISION_ROUTES = Object.freeze({
  member_knowledge: {
    destination: "管理 → メンバーナレッジ",
    approval: "候補をactiveにしてメンバーナレッジへ採用する",
    rejection: "候補をrejectedにして採用しない",
  },
  project_knowledge: {
    destination: "PJコックピット → PJナレッジ",
    approval: "候補をactiveにしてPJナレッジへ採用する",
    rejection: "候補をrejectedにして採用しない",
  },
  protocols: {
    destination: "管理 → AMDプロトコル",
    approval: "対象候補だけをconfirmedにしてAMDプロトコルへ採用する",
    rejection: "対象候補だけをrejectedにして採用しない",
  },
  founding_members: {
    destination: "PJコックピット → 創業メンバー",
    approval: "候補をactiveにして創業メンバーへ採用する",
    rejection: "候補をinvalidにして採用しない",
  },
  ms_progress_revision: {
    destination: "PJコックピット → MS進捗",
    approval: "提案値を確定してMS進捗へ反映する",
    rejection: "提案をdiscardedにして現行値を維持する",
  },
  project_registry_diff: {
    destination: "PJ台帳",
    approval: "allowlist済みの対象差分だけを台帳へ反映する",
    rejection: "対象差分をrejectedにして台帳を変えない",
  },
  xrl_evidence: {
    destination: "PJコックピット → XRL根拠",
    approval: "候補をconfirmedにしてXRL根拠へ採用する",
    rejection: "候補をrejectedにして採用しない",
  },
  project_strategy_signal: {
    destination: "PJコックピット → 経営ハイライト",
    approval: "候補をconfirmedにして経営ハイライトへ採用する",
    rejection: "候補をrejectedにして採用しない",
  },
  textbook_insight: {
    destination: "候補metadataに明示されたBZMまたは経営ノウハウ",
    approval: "明示された保存先の候補をapprovedまたはappliedにする",
    rejection: "候補をrejectedにして採用しない",
  },
  news_mention: {
    destination: "PJコックピット → メディア掲載",
    approval: "候補をconfirmedにして掲載実績へ採用する",
    rejection: "候補をrejectedにして採用しない",
  },
  coverage_gap: {
    destination: "候補metadataに明示された安全な正本反映先",
    approval: "対応済みの反映先へ候補1件を追加する",
    rejection: "gap候補をrejectedにして正本を変えない",
  },
});

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

function oneLine(value, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function sanitizeDecisionText(value, max = 1000) {
  return oneLine(value, max * 2)
    .replace(/https?:\/\/\S+/gi, "[URL省略]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[メール省略]")
    .replace(/(?:password|passcode|secret|token|api[_ -]?key|パスワード|パスコード|暗証番号)[^。\n]{0,100}/gi, "[認証情報省略]")
    .slice(0, max);
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function metadataHints(value) {
  const meta = objectValue(value);
  const out = {};
  for (const key of [
    "origin_kind",
    "destination_kind",
    "destination_label",
    "approval_effect",
    "effect",
    "proposed_target_l2",
    "gap_class",
    "classification",
    "practice_kind",
    "signal_type",
    "axis",
    "evidence_kind",
    "category",
  ]) {
    const text = sanitizeDecisionText(meta[key], 220);
    if (text) out[key] = text;
  }
  if (Array.isArray(meta.changes)) {
    out.changes = meta.changes.map((item) => sanitizeDecisionText(item, 300)).filter(Boolean).slice(0, 8);
  }
  return out;
}

function semantic(row) {
  return {
    notification_id: row.notification_id,
    l2_kind: row.l2_kind,
    target_id: row.target_id,
    scope_key: row.scope_key,
    title: row.title,
    summary: row.summary ?? "",
    saved_count: Number(row.saved_count ?? 0),
    total_count: Number(row.total_count ?? 0),
    metadata_json: row.metadata_json ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function sourceHash(row) {
  return crypto.createHash("sha256").update(JSON.stringify(semantic(row))).digest("hex");
}

export function preparedDecisionItem(row, feedbackKeys = new Set()) {
  const configuredRoute = DECISION_ROUTES[row.l2_kind] ?? null;
  const hasExactProtocolTarget = row.l2_kind !== "protocols"
    || /:protocol:[^:]+$/.test(String(row.scope_key ?? ""));
  const route = configuredRoute && hasExactProtocolTarget ? configuredRoute : null;
  const feedbackKey = `${row.l2_kind}|${row.target_id}|${row.scope_key}`;
  return {
    notification_id: String(row.notification_id),
    source_hash: sourceHash(row),
    l2_kind: String(row.l2_kind),
    target_id: sanitizeDecisionText(row.target_id, 100),
    scope_key: sanitizeDecisionText(row.scope_key, 180),
    title: sanitizeDecisionText(row.title, 260),
    summary: sanitizeDecisionText(row.summary, 1400),
    candidate_persisted_count: Number(row.saved_count ?? 0),
    total_count: Number(row.total_count ?? 0),
    already_answered: feedbackKeys.has(feedbackKey),
    has_supported_apply_route: Boolean(route),
    route: route ? { ...route } : null,
    metadata_hints: metadataHints(row.metadata_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPrompt(db) {
  const { data, error } = await db
    .from("llm_prompts")
    .select("body,updated_at")
    .eq("prompt_key", PROMPT_KEY)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const body = String(data?.body ?? "").trim();
  if (!body) throw new Error(`active ${PROMPT_KEY} prompt is missing`);
  return {
    key: PROMPT_KEY,
    body,
    hash: crypto.createHash("sha256").update(body).digest("hex"),
    updated_at: data.updated_at,
  };
}

async function prepare(args) {
  const db = await adminClient();
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(args.limit || 120)));
  const [prompt, notificationRes, feedbackRes] = await Promise.all([
    loadPrompt(db),
    db
      .from("l2_notifications")
      .select("notification_id,l2_kind,target_id,scope_key,title,summary,saved_count,total_count,metadata_json,created_at,updated_at")
      .eq("attention_state", "pending")
      .order("updated_at", { ascending: false })
      .limit(limit),
    db
      .from("l2_feedbacks")
      .select("l2_kind,target_id,scope_key")
      .eq("status", "active")
      .limit(2000),
  ]);
  if (notificationRes.error) throw new Error(notificationRes.error.message);
  if (feedbackRes.error) throw new Error(feedbackRes.error.message);
  const feedbackKeys = new Set((feedbackRes.data ?? []).map((row) => `${row.l2_kind}|${row.target_id}|${row.scope_key}`));
  const items = (notificationRes.data ?? []).map((row) => preparedDecisionItem(row, feedbackKeys));
  const payload = {
    version: 1,
    contract: CONTRACT,
    generated_at: new Date().toISOString(),
    prompt,
    item_count: items.length,
    items,
  };
  if (args.output && args.output !== true && items.length > 0) {
    await fs.writeFile(String(args.output), `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(JSON.stringify({ ok: true, item_count: items.length }));
}

function safeText(value, max) {
  const text = oneLine(value, max + 1);
  return text.length > 0 && text.length <= max && !/https?:\/\/|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
}

export function validateDecisionPayload(payload, prepared) {
  const errors = [];
  if (!payload || typeof payload !== "object") return ["review payload must be an object"];
  if (payload.version !== 1) errors.push("version must be 1");
  if (payload.contract !== CONTRACT) errors.push(`contract must be ${CONTRACT}`);
  if (payload.prompt_hash !== prepared?.prompt?.hash) errors.push("prompt_hash mismatch");
  if (!Array.isArray(payload.decisions)) errors.push("decisions must be an array");
  if (!prepared || prepared.contract !== CONTRACT || !Array.isArray(prepared.items)) {
    errors.push("prepared payload is invalid");
    return errors;
  }
  const expected = new Map(prepared.items.map((item) => [item.notification_id, item]));
  const seen = new Set();
  for (const [index, decision] of (payload.decisions ?? []).entries()) {
    const prefix = `decisions[${index}]`;
    const item = expected.get(String(decision?.notification_id));
    if (!item) errors.push(`${prefix} is not in prepared payload`);
    if (seen.has(String(decision?.notification_id))) errors.push(`${prefix} is duplicated`);
    seen.add(String(decision?.notification_id));
    if (item && decision?.source_hash !== item.source_hash) errors.push(`${prefix}.source_hash mismatch`);
    if (!DISPOSITIONS.has(decision?.disposition)) errors.push(`${prefix}.disposition is invalid`);
    const confidence = Number(decision?.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) errors.push(`${prefix}.confidence must be 0..1`);
    if (!safeText(decision?.reason, 500)) errors.push(`${prefix}.reason is invalid`);
    if (decision?.disposition === "approve") {
      if (!item?.has_supported_apply_route) errors.push(`${prefix}: approve requires a supported apply route`);
      if (item?.already_answered) errors.push(`${prefix}: answered candidate cannot be approved again`);
      if (confidence < 0.85) errors.push(`${prefix}: approve confidence must be >= 0.85`);
      if (!safeText(decision?.title, 180)) errors.push(`${prefix}.title is invalid`);
      if (!safeText(decision?.summary, 1000)) errors.push(`${prefix}.summary is invalid`);
      if (!safeText(decision?.destination_label, 220)) errors.push(`${prefix}.destination_label is invalid`);
      if (!Array.isArray(decision?.changes) || decision.changes.length < 1 || decision.changes.length > 6) {
        errors.push(`${prefix}.changes must contain 1..6 items`);
      } else if (decision.changes.some((change) => !safeText(change, 400))) {
        errors.push(`${prefix}.changes contains invalid text`);
      }
      if (!safeText(decision?.approval_effect, 500)) errors.push(`${prefix}.approval_effect is invalid`);
      if (!safeText(decision?.rejection_effect, 500)) errors.push(`${prefix}.rejection_effect is invalid`);
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
  const errors = validateDecisionPayload(payload, prepared);
  console.log(JSON.stringify({ ok: errors.length === 0, reviewed: payload.decisions?.length ?? 0, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}

async function currentItem(db, notificationId) {
  const { data, error } = await db
    .from("l2_notifications")
    .select("notification_id,l2_kind,target_id,scope_key,title,summary,saved_count,total_count,metadata_json,created_at,updated_at,attention_state")
    .eq("notification_id", notificationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function applyCommand(args) {
  const payload = await readJson(args.file, "file");
  const prepared = await readJson(args.prepared, "prepared");
  const errors = validateDecisionPayload(payload, prepared);
  if (errors.length) throw new Error(`review validation failed: ${errors.slice(0, 5).join("; ")}`);
  const db = await adminClient();
  const currentPrompt = await loadPrompt(db);
  if (currentPrompt.hash !== prepared.prompt.hash) {
    throw new Error("prompt changed after prepare; refusing apply");
  }
  const stats = { reviewed: payload.decisions.length, approved: 0, suppressed: 0, needs_source: 0, stale: 0, missing: 0, errors: 0 };
  for (const decision of payload.decisions) {
    try {
      const current = await currentItem(db, decision.notification_id);
      if (!current) {
        stats.missing += 1;
        continue;
      }
      if (current.attention_state !== "pending" || sourceHash(current) !== decision.source_hash) {
        stats.stale += 1;
        continue;
      }
      const reviewedAt = new Date().toISOString();
      if (decision.disposition === "approve") {
        const metadata = {
          ...objectValue(current.metadata_json),
          destination_label: oneLine(decision.destination_label, 220),
          changes: decision.changes.map((item) => oneLine(item, 400)),
          approval_effect: oneLine(decision.approval_effect, 500),
          rejection_effect: oneLine(decision.rejection_effect, 500),
          decision_review: {
            version: 1,
            reviewed_at: reviewedAt,
            source_hash: decision.source_hash,
          },
        };
        const { data: contentRows, error: contentError } = await db
          .from("l2_notifications")
          .update({
            title: oneLine(decision.title, 180),
            summary: oneLine(decision.summary, 1000),
            metadata_json: metadata,
          })
          .eq("notification_id", decision.notification_id)
          .eq("attention_state", "pending")
          .select("notification_id");
        if (contentError) throw new Error(contentError.message);
        if (contentRows?.length !== 1) throw new Error("candidate changed before content update");
        const { data: gateRows, error: gateError } = await db
          .from("l2_notifications")
          .update({
            attention_state: "approved",
            attention_type: "decision",
            attention_owner: "masa",
            requires_masa_decision: true,
            attention_reason: oneLine(decision.reason, 500),
            attention_action: oneLine(decision.changes.join(" / "), 500),
            attention_effect: oneLine(decision.approval_effect, 500),
            attention_confidence: Number(decision.confidence),
            attention_source_hash: decision.source_hash,
            attention_reviewed_at: reviewedAt,
            attention_reviewed_by: "codex-automation-l2-final-decision",
            notified_at: null,
            read_at: null,
          })
          .eq("notification_id", decision.notification_id)
          .eq("attention_state", "pending")
          .select("notification_id");
        if (gateError) throw new Error(gateError.message);
        if (gateRows?.length !== 1) throw new Error("candidate changed before gate update");
        stats.approved += 1;
      } else {
        const state = decision.disposition === "needs_source" ? "needs_source" : "suppressed";
        const type = decision.disposition === "needs_source" ? "needs_source" : "suppressed";
        const { data: reviewRows, error } = await db
          .from("l2_notifications")
          .update({
            attention_state: state,
            attention_type: type,
            attention_owner: "none",
            requires_masa_decision: false,
            attention_reason: oneLine(decision.reason, 500),
            attention_action: null,
            attention_effect: null,
            attention_confidence: Number(decision.confidence),
            attention_source_hash: decision.source_hash,
            attention_reviewed_at: reviewedAt,
            attention_reviewed_by: "codex-automation-l2-final-decision",
          })
          .eq("notification_id", decision.notification_id)
          .eq("attention_state", "pending")
          .select("notification_id");
        if (error) throw new Error(error.message);
        if (reviewRows?.length !== 1) throw new Error("candidate changed before review update");
        stats[state] += 1;
      }
    } catch {
      stats.errors += 1;
    }
  }
  console.log(JSON.stringify({ ok: stats.errors === 0, ...stats }, null, 2));
  if (stats.errors) process.exitCode = 1;
}

function usage() {
  console.log(`Usage:
  node pwa/scripts/proactive_heartbeat_tool.mjs prepare --output /private/tmp/prepared.json [--limit 120]
  node pwa/scripts/proactive_heartbeat_tool.mjs validate --prepared /private/tmp/prepared.json --file /private/tmp/review.json
  node pwa/scripts/proactive_heartbeat_tool.mjs apply --prepared /private/tmp/prepared.json --file /private/tmp/review.json`);
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
