#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const CONTRACT = "amd-os-proactive-heartbeat-v2";
const PROMPT_KEY = "attention.proactive.extract.v1";
const EVIDENCE_KINDS = new Set(["source_cache", "meeting_summary"]);
const DISPOSITIONS = new Set(["create", "noop", "needs_source"]);
const ATTENTION_TYPES = new Set(["decision", "masa_action"]);
const DUE_BASES = new Set(["explicit", "none"]);
const NOTIFICATION_REASONS = new Set([
  "explicit_deadline_24h",
  "irreversible_decision_window",
  "masa_only_blocker",
]);
const MAX_EVIDENCE = 160;
const MAX_CANDIDATES = 10;
const MAX_NOTIFICATIONS = 3;
const MIN_CREATE_CONFIDENCE = 0.85;

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
      // optional local file
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

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function asText(value, max = 800) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function sanitizeEvidenceText(value, max = 1600) {
  return asText(value, max * 2)
    .replace(/https?:\/\/\S+/gi, "[URL省略]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[メール省略]")
    .replace(/(?:password|passcode|secret|token|api[_ -]?key|パスワード|パスコード|暗証番号)[^。\n]{0,120}/gi, "[認証情報省略]")
    .replace(/\b\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}\b/g, "[電話番号省略]")
    .slice(0, max);
}

function jstDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isFiveSource(value) {
  const source = String(value ?? "").toLowerCase();
  return ["gmail", "drive", "calendar", "slack", "notion"].some((name) => source.includes(name));
}

function sourceCacheSemantic(row) {
  return {
    cache_id: row.cache_id,
    project_id: row.project_id,
    source: row.source,
    item_id: row.item_id,
    title: row.title ?? "",
    item_date: row.item_date,
    content_text: row.content_text ?? "",
    metadata_json: row.metadata_json ?? null,
    collected_at: row.collected_at,
  };
}

function meetingSemantic(row) {
  return {
    meeting_id: row.meeting_id,
    project_id: row.project_id,
    meeting_date: row.meeting_date,
    meeting_start_at: row.meeting_start_at,
    title: row.title,
    summary_short: row.summary_short,
    decided: row.decided ?? [],
    progress: row.progress ?? [],
    next_actions: row.next_actions ?? [],
    risks: row.risks ?? [],
    source_hash: row.source_hash,
    source_kinds: row.source_kinds,
    updated_at: row.updated_at,
  };
}

export function sourceCacheEvidence(row) {
  const semantic = sourceCacheSemantic(row);
  return {
    evidence_kind: "source_cache",
    evidence_id: String(row.id),
    source_ref: `source_cache:${row.id}`,
    source_hash: sha256(semantic),
    project_id: String(row.project_id),
    source: String(row.source),
    observed_at: row.item_date ?? row.collected_at,
    title: sanitizeEvidenceText(row.title, 240),
    content: sanitizeEvidenceText(row.content_text, 1600),
  };
}

export function meetingEvidence(row) {
  const semantic = meetingSemantic(row);
  return {
    evidence_kind: "meeting_summary",
    evidence_id: String(row.meeting_id),
    source_ref: `project_meeting_summaries:${row.meeting_id}`,
    source_hash: sha256(semantic),
    project_id: String(row.project_id),
    source: "held_meeting_summary",
    observed_at: row.meeting_start_at ?? `${row.meeting_date}T00:00:00.000Z`,
    title: sanitizeEvidenceText(row.title, 240),
    content: sanitizeEvidenceText(JSON.stringify({
      summary: row.summary_short,
      decided: row.decided,
      progress: row.progress,
      next_actions: row.next_actions,
      risks: row.risks,
    }), 1800),
  };
}

function safeOutputPath(file, label) {
  if (!file || file === true) throw new Error(`--${label} is required`);
  const resolved = path.resolve(String(file));
  if (!resolved.startsWith("/private/tmp/") && !resolved.startsWith("/tmp/")) {
    throw new Error(`--${label} must be under /private/tmp or /tmp`);
  }
  return resolved;
}

async function writePrivateJson(file, payload) {
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}

async function prepare(args) {
  const db = await adminClient();
  const limit = Math.max(1, Math.min(MAX_EVIDENCE, Number(args.limit || MAX_EVIDENCE)));
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const meetingSince = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const [promptRes, projectsRes, sourceRes, meetingRes] = await Promise.all([
    db.from("llm_prompts").select("prompt_key,body,is_active,updated_at").eq("prompt_key", PROMPT_KEY).maybeSingle(),
    db.from("projects").select("project_id,project_name,status,project_type,work_content").eq("status", "active"),
    db
      .from("source_cache")
      .select("id,cache_id,project_id,source,item_id,title,item_date,content_text,metadata_json,collected_at")
      .gte("collected_at", since)
      .order("collected_at", { ascending: false })
      .limit(limit),
    db
      .from("project_meeting_summaries")
      .select("meeting_id,project_id,meeting_date,meeting_start_at,title,summary_short,decided,progress,next_actions,risks,source_hash,source_kinds,updated_at")
      .gte("meeting_date", meetingSince)
      .lte("meeting_date", jstDate())
      .order("meeting_date", { ascending: false })
      .limit(limit),
  ]);
  for (const result of [promptRes, projectsRes, sourceRes, meetingRes]) {
    if (result.error) throw new Error(result.error.message);
  }
  const prompt = promptRes.data;
  if (!prompt?.is_active || !asText(prompt.body, 200_000)) {
    throw new Error(`${PROMPT_KEY} is missing, inactive, or empty`);
  }
  const projects = (projectsRes.data ?? []).map((row) => ({
    project_id: String(row.project_id),
    project_name: sanitizeEvidenceText(row.project_name, 160),
    project_type: sanitizeEvidenceText(row.project_type, 80),
    work_content: sanitizeEvidenceText(JSON.stringify(row.work_content ?? []), 800),
  }));
  const activeProjects = new Set(projects.map((row) => row.project_id));
  const sourceEvidence = (sourceRes.data ?? [])
    .filter((row) => activeProjects.has(String(row.project_id)))
    .filter((row) => isFiveSource(row.source))
    .filter((row) => asText(row.title, 20_000) || asText(row.content_text, 20_000))
    .map(sourceCacheEvidence);
  const heldEvidence = (meetingRes.data ?? [])
    .filter((row) => activeProjects.has(String(row.project_id)))
    .filter((row) => !/(^|[,;\s])(upcoming|prep)([,;\s]|$)/i.test(String(row.source_kinds ?? "")))
    .filter((row) => row.meeting_date < jstDate() || (row.meeting_start_at && new Date(row.meeting_start_at).getTime() < Date.now()))
    .filter((row) => asText(row.summary_short, 20_000) || (Array.isArray(row.next_actions) && row.next_actions.length > 0))
    .map(meetingEvidence);
  const evidence = [...sourceEvidence, ...heldEvidence]
    .sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)))
    .slice(0, limit);
  const output = safeOutputPath(args.output, "output");
  if (evidence.length === 0) {
    await fs.rm(output, { force: true });
    console.log(JSON.stringify({ ok: true, evidence_count: 0, output_written: false }));
    return;
  }
  const payload = {
    version: 2,
    contract: CONTRACT,
    generated_at: new Date().toISOString(),
    prompt: {
      key: PROMPT_KEY,
      hash: sha256(prompt.body),
      body: prompt.body,
      updated_at: prompt.updated_at,
    },
    limits: {
      max_candidates: MAX_CANDIDATES,
      max_notifications: MAX_NOTIFICATIONS,
      min_create_confidence: MIN_CREATE_CONFIDENCE,
    },
    projects,
    evidence_count: evidence.length,
    evidence,
  };
  await writePrivateJson(output, payload);
  console.log(JSON.stringify({ ok: true, evidence_count: evidence.length, output_written: true }));
}

function requireText(value, field, max, errors) {
  const text = asText(value, max + 1);
  if (!text) errors.push(`${field} is required`);
  if (text.length > max) errors.push(`${field} exceeds ${max}`);
  if (/https?:\/\/|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
    errors.push(`${field} contains URL or email`);
  }
  return text;
}

export function candidateGenerationKey(candidate) {
  return sha256({
    project_id: candidate.project_id,
    attention_type: candidate.attention_type,
    evidence_ids: (candidate.evidence_refs ?? [])
      .map((ref) => `${ref.evidence_kind}:${ref.evidence_id}`)
      .sort(),
  });
}

export function validateGenerationPayload(payload, prepared, now = new Date()) {
  const errors = [];
  if (!payload || typeof payload !== "object") return ["generation payload must be an object"];
  if (!prepared || prepared.contract !== CONTRACT || !Array.isArray(prepared.evidence)) {
    return ["prepared payload is invalid"];
  }
  if (payload.version !== 2 || payload.contract !== CONTRACT) errors.push("generation contract/version is invalid");
  if (payload.prompt_hash !== prepared.prompt?.hash) errors.push("prompt_hash mismatch");
  if (!Array.isArray(payload.dispositions)) errors.push("dispositions must be an array");
  if (!Array.isArray(payload.candidates)) errors.push("candidates must be an array");
  if ((payload.candidates ?? []).length > MAX_CANDIDATES) errors.push(`candidates exceed ${MAX_CANDIDATES}`);

  const expectedEvidence = new Map(prepared.evidence.map((item) => [
    `${item.evidence_kind}|${item.evidence_id}`,
    item,
  ]));
  const dispositions = new Map();
  for (const [index, disposition] of (payload.dispositions ?? []).entries()) {
    const prefix = `dispositions[${index}]`;
    const key = `${disposition?.evidence_kind}|${disposition?.evidence_id}`;
    if (!EVIDENCE_KINDS.has(disposition?.evidence_kind)) errors.push(`${prefix}.evidence_kind is invalid`);
    if (dispositions.has(key)) errors.push(`${prefix} is duplicated`);
    dispositions.set(key, disposition);
    const evidence = expectedEvidence.get(key);
    if (!evidence) errors.push(`${prefix} is not in prepared evidence`);
    else if (disposition.source_hash !== evidence.source_hash) errors.push(`${prefix}.source_hash mismatch`);
    if (!DISPOSITIONS.has(disposition?.disposition)) errors.push(`${prefix}.disposition is invalid`);
    requireText(disposition?.reason, `${prefix}.reason`, 400, errors);
    if (disposition?.disposition === "create" && !asText(disposition.candidate_id, 120)) {
      errors.push(`${prefix}.candidate_id is required for create`);
    }
    if (disposition?.disposition !== "create" && asText(disposition.candidate_id, 120)) {
      errors.push(`${prefix}.candidate_id is only allowed for create`);
    }
  }
  if (dispositions.size !== expectedEvidence.size) {
    errors.push(`dispositions must cover all evidence (${dispositions.size}/${expectedEvidence.size})`);
  }

  const activeProjects = new Set((prepared.projects ?? []).map((row) => row.project_id));
  const candidateIds = new Set();
  let notificationCount = 0;
  for (const [index, candidate] of (payload.candidates ?? []).entries()) {
    const prefix = `candidates[${index}]`;
    const candidateId = asText(candidate?.candidate_id, 120);
    if (!candidateId) errors.push(`${prefix}.candidate_id is required`);
    if (candidateIds.has(candidateId)) errors.push(`${prefix}.candidate_id is duplicated`);
    candidateIds.add(candidateId);
    if (!activeProjects.has(candidate?.project_id)) errors.push(`${prefix}.project_id is not active`);
    if (!ATTENTION_TYPES.has(candidate?.attention_type)) errors.push(`${prefix}.attention_type is invalid`);
    requireText(candidate?.title, `${prefix}.title`, 180, errors);
    requireText(candidate?.detail, `${prefix}.detail`, 800, errors);
    requireText(candidate?.why_now, `${prefix}.why_now`, 400, errors);
    requireText(candidate?.action, `${prefix}.action`, 400, errors);
    requireText(candidate?.effect, `${prefix}.effect`, 400, errors);
    requireText(candidate?.completion_condition, `${prefix}.completion_condition`, 400, errors);
    const confidence = Number(candidate?.confidence);
    if (!Number.isFinite(confidence) || confidence < MIN_CREATE_CONFIDENCE || confidence > 1) {
      errors.push(`${prefix}.confidence must be ${MIN_CREATE_CONFIDENCE}..1`);
    }
    if (!DUE_BASES.has(candidate?.due_basis)) errors.push(`${prefix}.due_basis is invalid`);
    const dueAt = candidate?.due_at ? new Date(candidate.due_at) : null;
    if (candidate?.due_basis === "explicit" && (!dueAt || Number.isNaN(dueAt.getTime()))) {
      errors.push(`${prefix}.due_at is required for explicit due_basis`);
    }
    const dueEvidenceText = asText(candidate?.due_evidence_text, 160);
    if (candidate?.due_basis === "explicit" && !dueEvidenceText) {
      errors.push(`${prefix}.due_evidence_text is required for explicit due_basis`);
    }
    if (candidate?.due_basis === "none" && candidate?.due_at != null) {
      errors.push(`${prefix}.due_at must be null when due_basis is none`);
    }
    if (candidate?.due_basis === "none" && candidate?.due_evidence_text != null) {
      errors.push(`${prefix}.due_evidence_text must be null when due_basis is none`);
    }
    if (!Array.isArray(candidate?.evidence_refs) || candidate.evidence_refs.length === 0) {
      errors.push(`${prefix}.evidence_refs is required`);
    }
    const candidateEvidenceKeys = new Set();
    for (const [refIndex, ref] of (candidate?.evidence_refs ?? []).entries()) {
      const refPrefix = `${prefix}.evidence_refs[${refIndex}]`;
      const key = `${ref?.evidence_kind}|${ref?.evidence_id}`;
      const evidence = expectedEvidence.get(key);
      if (!evidence) errors.push(`${refPrefix} is not in prepared evidence`);
      else {
        if (ref.source_hash !== evidence.source_hash) errors.push(`${refPrefix}.source_hash mismatch`);
        if (evidence.project_id !== candidate.project_id) errors.push(`${refPrefix}.project_id mismatch`);
      }
      candidateEvidenceKeys.add(key);
    }
    if (candidate?.due_basis === "explicit" && dueEvidenceText) {
      const duePhraseFound = [...candidateEvidenceKeys].some((key) => {
        const evidence = expectedEvidence.get(key);
        return evidence && `${evidence.title} ${evidence.content}`.includes(dueEvidenceText);
      });
      if (!duePhraseFound) errors.push(`${prefix}.due_evidence_text is not present in linked evidence`);
    }
    const linkedCreate = [...dispositions.entries()].some(([key, value]) => (
      value.disposition === "create" && value.candidate_id === candidateId && candidateEvidenceKeys.has(key)
    ));
    if (!linkedCreate) errors.push(`${prefix} has no matching create disposition`);
    if (/MTG\s*prep|MTG準備|会議準備|アジェンダ準備/i.test(`${candidate?.title ?? ""} ${candidate?.detail ?? ""}`)) {
      errors.push(`${prefix} contains retired meeting prep work`);
    }
    if (candidate?.notify_now === true) {
      notificationCount += 1;
      if (!NOTIFICATION_REASONS.has(candidate?.notification_reason)) {
        errors.push(`${prefix}.notification_reason is invalid`);
      }
      requireText(candidate?.notification_why_now, `${prefix}.notification_why_now`, 300, errors);
      if (candidate.notification_reason === "explicit_deadline_24h") {
        const hours = dueAt ? (dueAt.getTime() - now.getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;
        if (candidate.due_basis !== "explicit" || hours > 24) {
          errors.push(`${prefix}: explicit_deadline_24h requires an explicit due within 24h`);
        }
      }
    } else if (candidate?.notification_reason != null || candidate?.notification_why_now != null) {
      errors.push(`${prefix}: notification fields require notify_now=true`);
    }
  }
  if (notificationCount > MAX_NOTIFICATIONS) errors.push(`notifications exceed ${MAX_NOTIFICATIONS}`);
  for (const [index, disposition] of (payload.dispositions ?? []).entries()) {
    if (disposition.disposition === "create" && !candidateIds.has(disposition.candidate_id)) {
      errors.push(`dispositions[${index}].candidate_id does not exist`);
    }
  }
  return errors;
}

async function readJson(file, label) {
  return JSON.parse(await fs.readFile(safeOutputPath(file, label), "utf8"));
}

async function validateCommand(args) {
  const prepared = await readJson(args.prepared, "prepared");
  const generated = await readJson(args.file, "file");
  const errors = validateGenerationPayload(generated, prepared);
  console.log(JSON.stringify({ ok: errors.length === 0, evidence: prepared.evidence?.length ?? 0, candidates: generated.candidates?.length ?? 0, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}

async function currentEvidence(db, evidence) {
  if (evidence.evidence_kind === "source_cache") {
    const { data, error } = await db
      .from("source_cache")
      .select("id,cache_id,project_id,source,item_id,title,item_date,content_text,metadata_json,collected_at")
      .eq("id", evidence.evidence_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? sourceCacheEvidence(data) : null;
  }
  const { data, error } = await db
    .from("project_meeting_summaries")
    .select("meeting_id,project_id,meeting_date,meeting_start_at,title,summary_short,decided,progress,next_actions,risks,source_hash,source_kinds,updated_at")
    .eq("meeting_id", evidence.evidence_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? meetingEvidence(data) : null;
}

async function applyCommand(args) {
  const prepared = await readJson(args.prepared, "prepared");
  const generated = await readJson(args.file, "file");
  const errors = validateGenerationPayload(generated, prepared);
  if (errors.length) throw new Error(`generation validation failed: ${errors.slice(0, 8).join("; ")}`);
  const db = await adminClient();
  const promptRes = await db.from("llm_prompts").select("body,is_active").eq("prompt_key", PROMPT_KEY).maybeSingle();
  if (promptRes.error) throw new Error(promptRes.error.message);
  if (!promptRes.data?.is_active || sha256(promptRes.data.body) !== prepared.prompt.hash) {
    throw new Error("prompt changed after prepare; refusing apply");
  }

  const preparedEvidence = new Map(prepared.evidence.map((item) => [`${item.evidence_kind}|${item.evidence_id}`, item]));
  const currentEvidenceByKey = new Map();
  const stats = { evidence: prepared.evidence.length, candidates: generated.candidates.length, created: 0, duplicate: 0, notified: 0, stale: 0, missing: 0, errors: 0 };
  for (const evidence of prepared.evidence) {
    const current = await currentEvidence(db, evidence);
    const key = `${evidence.evidence_kind}|${evidence.evidence_id}`;
    if (!current) {
      stats.missing += 1;
      continue;
    }
    if (current.source_hash !== evidence.source_hash) {
      stats.stale += 1;
      continue;
    }
    currentEvidenceByKey.set(key, current);
  }

  if (stats.stale > 0 || stats.missing > 0) {
    console.log(JSON.stringify({ ok: false, ...stats }));
    process.exitCode = 1;
    return;
  }

  for (const candidate of generated.candidates) {
    try {
      const evidenceKeys = candidate.evidence_refs.map((ref) => `${ref.evidence_kind}|${ref.evidence_id}`);
      if (evidenceKeys.some((key) => !currentEvidenceByKey.has(key))) continue;
      const generationKey = candidateGenerationKey(candidate);
      const existingRes = await db.from("proactive_todos").select("id,status").eq("generation_key", generationKey).maybeSingle();
      if (existingRes.error) throw new Error(existingRes.error.message);
      let todoId = existingRes.data ? String(existingRes.data.id) : null;
      if (todoId) {
        stats.duplicate += 1;
      }
      const refs = candidate.evidence_refs.map((ref) => {
        const item = preparedEvidence.get(`${ref.evidence_kind}|${ref.evidence_id}`);
        return { evidence_kind: ref.evidence_kind, evidence_id: ref.evidence_id, source_ref: item.source_ref, source_hash: ref.source_hash };
      });
      if (!todoId) {
        const primaryMeeting = refs.find((ref) => ref.evidence_kind === "meeting_summary");
        const primarySource = refs.find((ref) => ref.evidence_kind === "source_cache");
        const insertRes = await db.from("proactive_todos").insert({
          project_id: candidate.project_id,
          trigger_kind: "source_evidence",
          source_meeting_id: primaryMeeting?.evidence_id ?? "",
          source_event_id: primarySource?.evidence_id ?? "",
          title: asText(candidate.title, 180),
          detail: asText(candidate.detail, 800),
          ball_owner: "amd",
          due_at: candidate.due_at ?? null,
          due_basis: candidate.due_basis,
          priority: candidate.due_basis === "explicit" && new Date(candidate.due_at).getTime() < Date.now() ? "red" : "normal",
          status: "open",
          generation_key: generationKey,
          evidence_refs: refs,
          completion_condition: asText(candidate.completion_condition, 400),
          attention_state: "approved",
          attention_type: candidate.attention_type,
          attention_owner: "masa",
          requires_masa_decision: candidate.attention_type === "decision",
          attention_reason: asText(candidate.why_now, 400),
          attention_action: asText(candidate.action, 400),
          attention_effect: asText(candidate.effect, 400),
          attention_confidence: Number(candidate.confidence),
          attention_source_hash: sha256(refs),
          attention_reviewed_at: new Date().toISOString(),
          attention_reviewed_by: "amd-os-proactive-heartbeat",
        }).select("id").single();
        if (insertRes.error) throw new Error(insertRes.error.message);
        todoId = String(insertRes.data.id);
        stats.created += 1;
      }
      if (candidate.notify_now === true && (!existingRes.data || ["open", "blocked"].includes(existingRes.data.status))) {
        const existingNotification = await db
          .from("app_notifications")
          .select("id")
          .eq("source", "amd-os-proactive-heartbeat")
          .contains("meta", { generation_key: generationKey })
          .maybeSingle();
        if (existingNotification.error) throw new Error(existingNotification.error.message);
        if (existingNotification.data) continue;
        const link = `/proactive?todo_id=${encodeURIComponent(todoId)}`;
        const notificationRes = await db.from("app_notifications").insert({
          kind: "proactive_attention",
          title: asText(candidate.title, 180),
          body: asText(candidate.notification_why_now, 300),
          link,
          source: "amd-os-proactive-heartbeat",
          meta: {
            generation_key: generationKey,
            notification_priority: "critical",
            notification_reason: candidate.notification_reason,
            action_contract: {
              action_owner: "masa",
              action_required: asText(candidate.action, 400),
              action_label: candidate.attention_type === "decision" ? "判断する" : "対応する",
              action_url: link,
              completion_condition: asText(candidate.completion_condition, 400),
              why_now: asText(candidate.notification_why_now, 300),
            },
          },
          attention_state: "approved",
          attention_type: candidate.attention_type,
          attention_owner: "masa",
          requires_masa_decision: candidate.attention_type === "decision",
          attention_reason: asText(candidate.notification_why_now, 300),
          attention_action: asText(candidate.action, 400),
          attention_effect: asText(candidate.effect, 400),
          attention_confidence: Number(candidate.confidence),
          attention_source_hash: sha256(refs),
          attention_reviewed_at: new Date().toISOString(),
          attention_reviewed_by: "amd-os-proactive-heartbeat",
        });
        if (notificationRes.error) throw new Error(notificationRes.error.message);
        stats.notified += 1;
      }
    } catch {
      stats.errors += 1;
    }
  }
  const ok = stats.errors === 0 && stats.stale === 0 && stats.missing === 0;
  console.log(JSON.stringify({ ok, ...stats }));
  if (!ok) process.exitCode = 1;
}

function usage() {
  console.log(`Usage:
  node pwa/scripts/proactive_heartbeat_tool.mjs prepare --output /private/tmp/prepared.json [--limit 160]
  node pwa/scripts/proactive_heartbeat_tool.mjs validate --prepared /private/tmp/prepared.json --file /private/tmp/generated.json
  node pwa/scripts/proactive_heartbeat_tool.mjs apply --prepared /private/tmp/prepared.json --file /private/tmp/generated.json`);
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
