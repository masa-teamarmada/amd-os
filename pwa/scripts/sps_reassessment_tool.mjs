#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
export const CONTRACT = "amd-os-sps-reassessment-v1";
export const PROMPT_KEY = "sps.reassessment.candidate.v1";
export const CURRENT_SPS_TUPLE = Object.freeze({
  model_version: "sps-ind-tier0-v1",
  measure_version: "sps-ind-v1",
  q_model_version: "q-eval-v2",
  q_ruleset_version: "rubric-v1.1",
  p_model_version: "p-ind-v1",
  assessment_ruleset_version: "rubric-v1.1+ind-v1",
});
const DISPOSITIONS = new Set(["no_change", "needs_source", "propose"]);
const IMPACTS = new Set(["q", "p_ind", "q_and_p_ind"]);
const EVIDENCE_RANK = Object.freeze({ soft: 1, mixed: 2, hard: 3 });
const MAX_EVENTS = 200;
// seedsの15件はmigration 209由来でRFC 4122のversion/variantに従わない。Postgresのuuid型は受け付けるため、
// ここでUUID版数まで縛ると当該seedが再評価経路から構造的に締め出される。形だけ検査する。
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_RE = /^[0-9a-f]{64}$/;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_RE = /https?:\/\/|www\./i;
const SECRET_RE = /(?:password|passcode|secret|bearer\s+[a-z0-9._-]+|api[_ -]?key|パスワード|パスコード|暗証番号)/i;

const SOURCE_SELECTS = Object.freeze({
  project_pl_monthly: "id,project_id,ym,revenue_yen,cogs_yen,personnel_yen,rd_yen,marketing_yen,other_opex_yen,created_at,updated_at",
  project_meeting_summaries: "meeting_id,project_id,meeting_date,meeting_start_at,summary_short,decided,progress,source_hash,source_kinds,prep_status,generated_at,created_at,updated_at",
  project_management_partners: "id,project_id,relationship_stage,agreement_state,last_contact_date,last_verified_at,confidence,activity_state,poc_likelihood,effluent_procured,next_meeting_on,deleted_at,created_at,updated_at",
  project_management_partner_interactions: "id,project_id,interaction_kind,occurred_on,occurred_on_precision,summary,outcome_summary,ball_side_after,confidence,actor_side,deleted_at,created_at,updated_at",
  seed_contact_log: "id,seed_id,contacted_on,method,created_at,updated_at",
});

function parseArgs(argv) {
  const args = {};
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      rest.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return { command: rest[0] ?? "help", args };
}

function parseEnvText(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const splitAt = line.indexOf("=");
    const key = line.slice(0, splitAt).trim();
    let value = line.slice(splitAt + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function loadEnv() {
  const values = {};
  for (const file of [path.join(REPO_ROOT, "pwa/.env.production.local"), path.join(REPO_ROOT, "pwa/.env.local")]) {
    try {
      Object.assign(values, parseEnvText(await fs.readFile(file, "utf8")));
    } catch {
      // Optional local environment files.
    }
  }
  return { ...values, ...process.env };
}

async function serviceClient() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service environment is missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function oneLine(value, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeText(value, max) {
  const text = oneLine(value, max + 1);
  return text.length > 0
    && text.length <= max
    && !URL_RE.test(text)
    && !EMAIL_RE.test(text)
    && !SECRET_RE.test(text);
}

export function sanitizeEvidenceText(value, max = 240) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[URL省略]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[メール省略]")
    .replace(/(?:password|passcode|secret|bearer\s+[a-z0-9._-]+|api[_ -]?key|パスワード|パスコード|暗証番号)[^。\n]{0,100}/gi, "[認証情報省略]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function structuredTextItems(value, maxItems = 3) {
  if (!Array.isArray(value)) return [];
  const fields = ["summary", "text", "title", "decision", "progress", "outcome", "detail"];
  const out = [];
  for (const item of value) {
    const raw = typeof item === "string"
      ? item
      : fields.map((field) => item && typeof item === "object" ? item[field] : null).find((candidate) => typeof candidate === "string");
    const text = sanitizeEvidenceText(raw, 180);
    if (text) out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function isHighConfidence(value) {
  return /^(?:high|confirmed|verified|確定|高)$/i.test(oneLine(value, 40));
}

function isPastOrToday(value, now) {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) && time <= now.getTime();
}

export function privacyErrors(value, prefix = "payload", errors = []) {
  if (typeof value === "string") {
    if (URL_RE.test(value)) errors.push(`${prefix} contains a URL`);
    if (EMAIL_RE.test(value)) errors.push(`${prefix} contains an email address`);
    if (SECRET_RE.test(value)) errors.push(`${prefix} may contain a secret`);
    if (value.length > 4000) errors.push(`${prefix} is too long and may contain raw text`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => privacyErrors(item, `${prefix}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => privacyErrors(item, `${prefix}.${key}`, errors));
  }
  return errors;
}

export function semanticFingerprint(seedId, semanticKey) {
  const normalized = String(semanticKey ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();
  if (!UUID_RE.test(String(seedId)) || normalized.length < 3 || normalized.length > 240) {
    throw new Error("semantic fingerprint input is invalid");
  }
  return stableHash({ seed_id: String(seedId).toLowerCase(), semantic_key: normalized });
}

export function expectedSps(pYen, qPct) {
  const p = Number(pYen);
  const q = Number(qPct);
  if (!Number.isSafeInteger(p) || p < 0 || !Number.isFinite(q) || q < 0 || q > 100) return null;
  const result = Math.round((p * q) / 100);
  return Number.isSafeInteger(result) ? result : null;
}

export function structuredSourceEvidence(event, row, now = new Date()) {
  const common = {
    source_table: event.source_table,
    operation: event.operation,
    source_at: event.source_at,
    row_present: Boolean(row),
    evidence_strength: "soft",
    proposal_eligible: false,
  };
  if (!row) return { ...common, missing_or_deleted: true };

  if (event.source_table === "project_pl_monthly") {
    return {
      ...common,
      ym: row.ym,
      amounts_yen: {
        revenue: Number(row.revenue_yen ?? 0),
        cogs: Number(row.cogs_yen ?? 0),
        personnel: Number(row.personnel_yen ?? 0),
        rd: Number(row.rd_yen ?? 0),
        marketing: Number(row.marketing_yen ?? 0),
        other_opex: Number(row.other_opex_yen ?? 0),
      },
      actual_forecast_status: "unspecified",
      proposal_blocker: "actual_forecast_not_structured",
    };
  }
  if (event.source_table === "project_meeting_summaries") {
    const meetingTime = new Date(row.meeting_start_at || `${row.meeting_date}T00:00:00+09:00`).getTime();
    const held = Number.isFinite(meetingTime) && meetingTime <= now.getTime();
    const progress = structuredTextItems(row.progress);
    const decided = structuredTextItems(row.decided);
    const summary = sanitizeEvidenceText(row.summary_short, 280);
    const hasStructuredProgress = progress.length > 0 || decided.length > 0;
    return {
      ...common,
      meeting_date: row.meeting_date,
      held,
      has_source_hash: HASH_RE.test(String(row.source_hash ?? "")),
      source_kinds: oneLine(row.source_kinds, 80) || null,
      summary: summary || null,
      progress,
      decided,
      actual_progress_structured: held && hasStructuredProgress,
      proposal_eligible: held && hasStructuredProgress,
      evidence_strength: "soft",
      proposal_blocker: held && hasStructuredProgress ? null : held ? "actual_progress_not_structured" : "scheduled_meeting",
    };
  }
  if (event.source_table === "project_management_partners") {
    const agreementSignal = oneLine(row.agreement_state, 80).toLowerCase() === "agreed";
    const executionSignal = oneLine(row.relationship_stage, 80).toLowerCase() === "executing";
    const verified = isPastOrToday(row.last_verified_at, now) && isHighConfidence(row.confidence);
    const eligible = !row.deleted_at && verified && (agreementSignal || executionSignal);
    return {
      ...common,
      relationship_stage: oneLine(row.relationship_stage, 80),
      agreement_state: oneLine(row.agreement_state, 80),
      activity_state: oneLine(row.activity_state, 80),
      poc_likelihood: oneLine(row.poc_likelihood, 80) || null,
      effluent_procured: row.effluent_procured ?? null,
      last_contact_date: row.last_contact_date,
      last_verified_at: row.last_verified_at,
      confidence: oneLine(row.confidence, 40),
      deleted: Boolean(row.deleted_at),
      proposal_eligible: eligible,
      evidence_strength: agreementSignal && executionSignal ? "mixed" : "soft",
      proposal_blocker: eligible ? null : "partner_state_not_verified_or_material",
    };
  }
  if (event.source_table === "project_management_partner_interactions") {
    const occurred = row.occurred_on ? `${row.occurred_on}T23:59:59+09:00` : null;
    const kindEligible = new Set(["agreement", "deliverable"]).has(oneLine(row.interaction_kind, 80).toLowerCase());
    const summary = sanitizeEvidenceText(row.summary, 220);
    const outcome = sanitizeEvidenceText(row.outcome_summary, 220);
    const eligible = !row.deleted_at
      && isPastOrToday(occurred, now)
      && isHighConfidence(row.confidence)
      && kindEligible
      && Boolean(summary || outcome);
    return {
      ...common,
      interaction_kind: oneLine(row.interaction_kind, 80),
      occurred_on: row.occurred_on,
      occurred_on_precision: oneLine(row.occurred_on_precision, 40),
      ball_side_after: oneLine(row.ball_side_after, 40),
      actor_side: oneLine(row.actor_side, 40),
      confidence: oneLine(row.confidence, 40),
      summary: summary || null,
      outcome: outcome || null,
      deleted: Boolean(row.deleted_at),
      proposal_eligible: eligible,
      evidence_strength: "mixed",
      proposal_blocker: eligible ? null : "interaction_not_verified_or_material",
    };
  }
  if (event.source_table === "seed_contact_log") {
    return {
      ...common,
      contacted_on: row.contacted_on,
      method: oneLine(row.method, 60) || null,
      proposal_blocker: "contact_log_is_soft_evidence",
    };
  }
  return { ...common, proposal_blocker: "unsupported_source" };
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
  return { key: PROMPT_KEY, body, hash: stableHash(body), updated_at: data.updated_at };
}

function assertCurrentTuple(model) {
  for (const [key, expected] of Object.entries(CURRENT_SPS_TUPLE)) {
    if (model?.[key] !== expected) throw new Error(`current SPS ${key} is not ${expected}`);
  }
}

async function loadCurrentModel(db) {
  const { data, error } = await db
    .from("sps_model_versions")
    .select("model_version,measure_version,q_model_version,q_ruleset_version,p_model_version,assessment_ruleset_version,is_current")
    .eq("is_current", true)
    .limit(2);
  if (error) throw new Error(error.message);
  if (data?.length !== 1) throw new Error("exactly one current SPS model is required");
  assertCurrentTuple(data[0]);
  return { ...CURRENT_SPS_TUPLE, hash: stableHash(CURRENT_SPS_TUPLE) };
}

async function loadLatestBase(db, seedId) {
  const { data, error } = await db
    .from("seed_screening_bands")
    .select("id,seed_id,ruleset_version,measure_version,model_version,q_model_version,q_ruleset_version,p_model_version,assessed_at,created_at,q_lower_pct,q_upper_pct,q_main_factor,p_class,p_lower_yen,p_upper_yen,sps_lower_yen,sps_upper_yen,frozen")
    .eq("seed_id", seedId)
    .eq("frozen", true)
    .eq("model_version", CURRENT_SPS_TUPLE.model_version)
    .eq("measure_version", CURRENT_SPS_TUPLE.measure_version)
    .eq("q_model_version", CURRENT_SPS_TUPLE.q_model_version)
    .eq("q_ruleset_version", CURRENT_SPS_TUPLE.q_ruleset_version)
    .eq("p_model_version", CURRENT_SPS_TUPLE.p_model_version)
    .eq("ruleset_version", CURRENT_SPS_TUPLE.assessment_ruleset_version)
    .order("assessed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...data, source_hash: stableHash(data) };
}

async function loadSourceRow(db, event) {
  const select = SOURCE_SELECTS[event.source_table];
  if (!select || event.operation === "delete") return null;
  const identityColumn = event.source_table === "project_meeting_summaries" ? "meeting_id" : "id";
  const { data, error } = await db
    .from(event.source_table)
    .select(select)
    .eq(identityColumn, event.source_row_identity)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`${event.source_table}: ${error.message}`);
  return data;
}

async function preparedEvent(db, event, now = new Date()) {
  const evidence = structuredSourceEvidence(event, await loadSourceRow(db, event), now);
  const item = {
    event_id: event.id,
    source_table: event.source_table,
    source_row_identity: event.source_row_identity,
    project_id: event.project_id,
    seed_id: event.seed_id,
    operation: event.operation,
    event_at: event.event_at,
    source_at: event.source_at,
    payload_hash: event.payload_hash,
    evidence,
  };
  return { ...item, source_hash: stableHash(item) };
}

async function prepare(args) {
  const db = await serviceClient();
  const requestedLimit = Number(args.limit ?? 120);
  if (!Number.isFinite(requestedLimit)) throw new Error("--limit must be a number");
  const limit = Math.max(1, Math.min(MAX_EVENTS, Math.floor(requestedLimit)));
  let query = db
    .from("sps_reassessment_source_events")
    .select("id,source_table,source_row_identity,project_id,seed_id,operation,event_at,source_at,payload_hash,status")
    .eq("status", "pending")
    .order("event_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);
  if (args["seed-id"] && args["seed-id"] !== true) query = query.eq("seed_id", String(args["seed-id"]));

  const [prompt, model, eventResult] = await Promise.all([loadPrompt(db), loadCurrentModel(db), query]);
  if (eventResult.error) throw new Error(eventResult.error.message);
  const rawEvents = eventResult.data ?? [];
  if (rawEvents.length === 0) {
    console.log(JSON.stringify({ ok: true, event_count: 0, group_count: 0, candidate_count: 0 }));
    return;
  }

  const now = new Date();
  const events = await Promise.all(rawEvents.map((event) => preparedEvent(db, event, now)));
  const grouped = new Map();
  for (const event of events) {
    if (!grouped.has(event.seed_id)) grouped.set(event.seed_id, []);
    grouped.get(event.seed_id).push(event);
  }
  const groups = [];
  for (const [seedId, seedEvents] of grouped) {
    const base = await loadLatestBase(db, seedId);
    const reviewableEvents = seedEvents.filter((event) => event.evidence.proposal_eligible);
    const strongestRank = Math.max(0, ...reviewableEvents.map((event) => EVIDENCE_RANK[event.evidence.evidence_strength] ?? 0));
    const strongestEvidenceStrength = Object.entries(EVIDENCE_RANK).find(([, rank]) => rank === strongestRank)?.[0] ?? null;
    groups.push({
      seed_id: seedId,
      project_ids: [...new Set(seedEvents.map((event) => event.project_id).filter(Boolean))].sort(),
      base_assessment: base,
      base_status: base ? "current_exact" : "unassessed",
      reviewable_evidence_count: reviewableEvents.length,
      strongest_evidence_strength: strongestEvidenceStrength,
      events: seedEvents,
    });
  }
  const payload = {
    version: 1,
    contract: CONTRACT,
    generated_at: now.toISOString(),
    prompt,
    model,
    group_count: groups.length,
    event_count: events.length,
    groups,
  };
  payload.prepared_hash = stableHash({
    contract: payload.contract,
    generated_at: payload.generated_at,
    prompt_hash: prompt.hash,
    model_hash: model.hash,
    groups,
  });
  if (args.output && args.output !== true) {
    await fs.writeFile(String(args.output), `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    await fs.chmod(String(args.output), 0o600);
  }
  console.log(JSON.stringify({ ok: true, event_count: events.length, group_count: groups.length }));
}

function tupleErrors(proposal, prefix, errors) {
  for (const [key, expected] of Object.entries(CURRENT_SPS_TUPLE)) {
    if (proposal?.[key] !== expected) errors.push(`${prefix}.${key} must be ${expected}`);
  }
}

function bandErrors(proposal, prefix, errors) {
  const qLower = Number(proposal?.q_lower_pct);
  const qUpper = Number(proposal?.q_upper_pct);
  const pLower = Number(proposal?.p_lower_yen);
  const pUpper = Number(proposal?.p_upper_yen);
  const spsLower = Number(proposal?.sps_lower_yen);
  const spsUpper = Number(proposal?.sps_upper_yen);
  if (!Number.isFinite(qLower) || !Number.isFinite(qUpper) || qLower < 0 || qUpper > 100 || qLower > qUpper) {
    errors.push(`${prefix} q range is invalid`);
  }
  if (!Number.isSafeInteger(pLower) || !Number.isSafeInteger(pUpper) || pLower < 0 || pLower > pUpper) {
    errors.push(`${prefix} P^ind range is invalid`);
  }
  if (!Number.isSafeInteger(spsLower) || !Number.isSafeInteger(spsUpper)
      || spsLower !== expectedSps(pLower, qLower)
      || spsUpper !== expectedSps(pUpper, qUpper)
      || spsLower > spsUpper) {
    errors.push(`${prefix} SPS math is invalid`);
  }
}

function impactErrors(proposal, base, prefix, errors) {
  if (!base) return;
  const qChanged = Number(proposal?.q_lower_pct) !== Number(base.q_lower_pct)
    || Number(proposal?.q_upper_pct) !== Number(base.q_upper_pct);
  const pChanged = Number(proposal?.p_lower_yen) !== Number(base.p_lower_yen)
    || Number(proposal?.p_upper_yen) !== Number(base.p_upper_yen);
  const impact = proposal?.impact_classification;
  const consistent = impact === "q" ? qChanged && !pChanged
    : impact === "p_ind" ? !qChanged && pChanged
      : impact === "q_and_p_ind" ? qChanged && pChanged
        : false;
  if (!consistent) errors.push(`${prefix}.impact_classification does not match q/P^ind changes from base`);
}

export function validateReassessmentPayload(payload, prepared) {
  const errors = [];
  if (!payload || typeof payload !== "object") return ["review payload must be an object"];
  if (!prepared || prepared.contract !== CONTRACT || !Array.isArray(prepared.groups)) return ["prepared payload is invalid"];
  if (payload.version !== 1) errors.push("version must be 1");
  if (payload.contract !== CONTRACT) errors.push(`contract must be ${CONTRACT}`);
  if (payload.prompt_hash !== prepared.prompt?.hash) errors.push("prompt_hash mismatch");
  if (!Array.isArray(payload.dispositions)) errors.push("dispositions must be an array");
  if (!Array.isArray(payload.proposals)) errors.push("proposals must be an array");
  errors.push(...privacyErrors(payload));

  const eventMap = new Map();
  const groupMap = new Map();
  for (const group of prepared.groups) {
    groupMap.set(String(group.seed_id), group);
    for (const event of group.events ?? []) eventMap.set(String(event.event_id), { event, group });
  }
  const dispositionMap = new Map();
  for (const [index, disposition] of (payload.dispositions ?? []).entries()) {
    const prefix = `dispositions[${index}]`;
    const id = String(disposition?.event_id ?? "");
    const expected = eventMap.get(id);
    if (!expected) errors.push(`${prefix}.event_id is not prepared`);
    if (dispositionMap.has(id)) errors.push(`${prefix}.event_id is duplicated`);
    dispositionMap.set(id, disposition);
    if (expected && disposition?.source_hash !== expected.event.source_hash) errors.push(`${prefix}.source_hash mismatch`);
    if (!DISPOSITIONS.has(disposition?.disposition)) errors.push(`${prefix}.disposition is invalid`);
    if (!safeText(disposition?.reason, 500)) errors.push(`${prefix}.reason is invalid`);
  }
  if (dispositionMap.size !== eventMap.size) errors.push(`dispositions must cover all prepared events (${dispositionMap.size}/${eventMap.size})`);

  const proposedEventIds = new Set();
  const fingerprints = new Set();
  const proposalIds = new Set();
  for (const [index, proposal] of (payload.proposals ?? []).entries()) {
    const prefix = `proposals[${index}]`;
    if (!safeText(proposal?.proposal_id, 100) || proposalIds.has(proposal?.proposal_id)) errors.push(`${prefix}.proposal_id is invalid or duplicated`);
    proposalIds.add(proposal?.proposal_id);
    const group = groupMap.get(String(proposal?.seed_id ?? ""));
    if (!group) errors.push(`${prefix}.seed_id is not prepared`);
    if (!group?.base_assessment) errors.push(`${prefix} cannot propose without a latest exact current base`);
    if (group?.base_assessment && proposal?.base_assessment_id !== group.base_assessment.id) errors.push(`${prefix}.base_assessment_id mismatch`);
    tupleErrors(proposal, prefix, errors);
    if (!IMPACTS.has(proposal?.impact_classification)) errors.push(`${prefix}.impact_classification is invalid`);
    if (!(proposal?.evidence_strength in EVIDENCE_RANK)) errors.push(`${prefix}.evidence_strength is invalid`);
    const confidence = Number(proposal?.confidence);
    if (!Number.isFinite(confidence) || confidence < 0.85 || confidence > 1) errors.push(`${prefix}.confidence must be 0.85..1`);
    if (!safeText(proposal?.semantic_key, 240)) errors.push(`${prefix}.semantic_key is invalid`);
    if (!safeText(proposal?.summary, 1000)) errors.push(`${prefix}.summary is invalid`);
    if (proposal?.q_main_factor != null && !safeText(proposal.q_main_factor, 120)) errors.push(`${prefix}.q_main_factor is invalid`);
    if (proposal?.p_class != null && !safeText(proposal.p_class, 120)) errors.push(`${prefix}.p_class is invalid`);
    bandErrors(proposal, prefix, errors);
    impactErrors(proposal, group?.base_assessment, prefix, errors);

    const ids = Array.isArray(proposal?.source_event_ids) ? proposal.source_event_ids.map(String) : [];
    if (ids.length < 1 || ids.length > 100 || new Set(ids).size !== ids.length) errors.push(`${prefix}.source_event_ids is invalid`);
    let maxEligibleEvidenceRank = 0;
    let latestSourceTime = 0;
    for (const id of ids) {
      const expected = eventMap.get(id);
      if (!expected || expected.group !== group) errors.push(`${prefix} references an event outside its seed group`);
      if (proposedEventIds.has(id)) errors.push(`${prefix} reuses an event from another proposal`);
      proposedEventIds.add(id);
      if (dispositionMap.get(id)?.disposition !== "propose") errors.push(`${prefix} references an event not classified propose`);
      if (expected?.event.evidence?.proposal_eligible) {
        maxEligibleEvidenceRank = Math.max(
          maxEligibleEvidenceRank,
          EVIDENCE_RANK[expected.event.evidence.evidence_strength] ?? 0,
        );
      }
      const sourceTime = Date.parse(expected?.event.source_at || expected?.event.event_at || "");
      if (Number.isFinite(sourceTime)) latestSourceTime = Math.max(latestSourceTime, sourceTime);
    }
    if (maxEligibleEvidenceRank === 0) errors.push(`${prefix} has no reviewable structured evidence`);
    const proposedEvidenceRank = EVIDENCE_RANK[proposal?.evidence_strength] ?? 0;
    if (proposedEvidenceRank > maxEligibleEvidenceRank) errors.push(`${prefix}.evidence_strength overstates prepared evidence`);
    const cutoff = Date.parse(proposal?.information_cutoff ?? "");
    const preparedAt = Date.parse(prepared.generated_at ?? "");
    if (!Number.isFinite(cutoff) || cutoff < latestSourceTime || (Number.isFinite(preparedAt) && cutoff > preparedAt)) {
      errors.push(`${prefix}.information_cutoff is outside prepared evidence time`);
    }
    try {
      const fingerprint = semanticFingerprint(proposal?.seed_id, proposal?.semantic_key);
      if (fingerprints.has(fingerprint)) errors.push(`${prefix} duplicates another semantic fingerprint`);
      fingerprints.add(fingerprint);
    } catch {
      errors.push(`${prefix}.semantic_key cannot produce a fingerprint`);
    }
  }
  for (const [id, disposition] of dispositionMap) {
    if (disposition?.disposition === "propose" && !proposedEventIds.has(id)) errors.push(`propose event ${id} is not referenced by a proposal`);
    if (disposition?.disposition !== "propose" && proposedEventIds.has(id)) errors.push(`non-propose event ${id} is referenced by a proposal`);
  }
  return [...new Set(errors)];
}

async function readJson(file, label) {
  if (!file || file === true) throw new Error(`--${label} is required`);
  return JSON.parse(await fs.readFile(String(file), "utf8"));
}

async function validateCommand(args) {
  const [payload, prepared] = await Promise.all([readJson(args.file, "file"), readJson(args.prepared, "prepared")]);
  const errors = validateReassessmentPayload(payload, prepared);
  console.log(JSON.stringify({ ok: errors.length === 0, proposals: payload.proposals?.length ?? 0, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}

async function assertFreshPrepared(db, prepared) {
  const [prompt, model] = await Promise.all([loadPrompt(db), loadCurrentModel(db)]);
  if (prompt.hash !== prepared.prompt?.hash) throw new Error("prompt changed after prepare; refusing apply");
  if (model.hash !== prepared.model?.hash) throw new Error("current SPS tuple changed after prepare; refusing apply");
  for (const group of prepared.groups) {
    const currentBase = await loadLatestBase(db, group.seed_id);
    if ((currentBase?.id ?? null) !== (group.base_assessment?.id ?? null)
        || (currentBase?.source_hash ?? null) !== (group.base_assessment?.source_hash ?? null)) {
      throw new Error(`base assessment changed after prepare for seed ${group.seed_id}`);
    }
    for (const event of group.events ?? []) {
      const { data: currentEvent, error } = await db
        .from("sps_reassessment_source_events")
        .select("id,source_table,source_row_identity,project_id,seed_id,operation,event_at,source_at,payload_hash,status")
        .eq("id", event.event_id)
        .eq("status", "pending")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!currentEvent || currentEvent.payload_hash !== event.payload_hash) throw new Error(`event ${event.event_id} is stale`);
      const { data: latestRows, error: latestError } = await db
        .from("sps_reassessment_source_events")
        .select("id")
        .eq("source_table", event.source_table)
        .eq("source_row_identity", event.source_row_identity)
        .order("event_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1);
      if (latestError) throw new Error(latestError.message);
      if (latestRows?.[0]?.id !== event.event_id) throw new Error(`event ${event.event_id} is superseded`);
      const refreshed = await preparedEvent(db, currentEvent, new Date(prepared.generated_at));
      if (refreshed.source_hash !== event.source_hash) throw new Error(`event ${event.event_id} source changed after prepare`);
    }
  }
}

async function markDisposition(db, event, status) {
  const { data, error } = await db
    .from("sps_reassessment_source_events")
    .update({ status })
    .eq("id", event.event_id)
    .eq("payload_hash", event.payload_hash)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  if (data?.length !== 1) throw new Error(`event ${event.event_id} changed before ${status}`);
}

function candidateRow(proposal) {
  return {
    seed_id: proposal.seed_id,
    source_event_ids: proposal.source_event_ids,
    semantic_fingerprint: semanticFingerprint(proposal.seed_id, proposal.semantic_key),
    status: "pending",
    confidence: Number(proposal.confidence),
    ...Object.fromEntries(Object.keys(CURRENT_SPS_TUPLE).map((key) => [key, proposal[key]])),
    base_assessment_id: proposal.base_assessment_id,
    impact_classification: proposal.impact_classification,
    evidence_strength: proposal.evidence_strength,
    information_cutoff: proposal.information_cutoff,
    q_lower_pct: Number(proposal.q_lower_pct),
    q_upper_pct: Number(proposal.q_upper_pct),
    q_main_factor: proposal.q_main_factor == null ? null : oneLine(proposal.q_main_factor, 120),
    p_class: proposal.p_class == null ? null : oneLine(proposal.p_class, 120),
    p_lower_yen: Number(proposal.p_lower_yen),
    p_upper_yen: Number(proposal.p_upper_yen),
    sps_lower_yen: Number(proposal.sps_lower_yen),
    sps_upper_yen: Number(proposal.sps_upper_yen),
    proposal_summary: oneLine(proposal.summary, 1000),
    created_by: "codex-sps-reassessment",
  };
}

async function applyCommand(args) {
  const [payload, prepared] = await Promise.all([readJson(args.file, "file"), readJson(args.prepared, "prepared")]);
  const errors = validateReassessmentPayload(payload, prepared);
  if (errors.length) throw new Error(`review validation failed: ${errors.slice(0, 8).join("; ")}`);
  const db = await serviceClient();
  await assertFreshPrepared(db, prepared);
  const eventMap = new Map(prepared.groups.flatMap((group) => group.events.map((event) => [event.event_id, event])));
  const stats = { candidates: 0, notifications: 0, no_change: 0, needs_source: 0, deduped: 0, errors: 0 };

  for (const disposition of payload.dispositions) {
    if (disposition.disposition === "propose") continue;
    try {
      await markDisposition(db, eventMap.get(disposition.event_id), disposition.disposition);
      stats[disposition.disposition] += 1;
    } catch {
      stats.errors += 1;
    }
  }

  for (const proposal of payload.proposals) {
    const row = candidateRow(proposal);
    const { error } = await db.from("sps_reassessment_candidates").insert(row).select("id").single();
    if (!error) {
      stats.candidates += 1;
      stats.notifications += 1;
      continue;
    }
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await db
        .from("sps_reassessment_candidates")
        .select("id,status")
        .eq("seed_id", row.seed_id)
        .eq("semantic_fingerprint", row.semantic_fingerprint)
        .in("status", ["pending", "applied"])
        .maybeSingle();
      if (!existingError && existing) {
        for (const eventId of proposal.source_event_ids) {
          try {
            await markDisposition(db, eventMap.get(eventId), "no_change");
          } catch {
            stats.errors += 1;
          }
        }
        stats.deduped += 1;
        continue;
      }
    }
    stats.errors += 1;
    console.error(`candidate insert failed: ${error.message}`);
  }

  console.log(JSON.stringify({ ok: stats.errors === 0, ...stats }, null, 2));
  if (stats.errors) process.exitCode = 1;
}

function usage() {
  console.log(`Usage:
  node pwa/scripts/sps_reassessment_tool.mjs prepare --output /private/tmp/sps-prepared.json [--limit 120] [--seed-id UUID]
  node pwa/scripts/sps_reassessment_tool.mjs validate --prepared /private/tmp/sps-prepared.json --file /private/tmp/sps-review.json
  node pwa/scripts/sps_reassessment_tool.mjs apply --prepared /private/tmp/sps-prepared.json --file /private/tmp/sps-review.json`);
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
