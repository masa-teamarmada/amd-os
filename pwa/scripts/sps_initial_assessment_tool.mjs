#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
export const CONTRACT = "amd-os-sps-initial-assessment-v1";
export const PROMPT_KEY = "sps.initial-assessment.candidate.v1";
export const CURRENT_SPS_TUPLE = Object.freeze({ model_version: "sps-ind-tier0-v1", measure_version: "sps-ind-v1", q_model_version: "q-eval-v2", q_ruleset_version: "rubric-v1.1", p_model_version: "p-ind-v1", assessment_ruleset_version: "rubric-v1.1+ind-v1" });
export const Q_FACTORS = Object.freeze(["unit_economics", "capital_intensity", "scale_constraint", "reproducibility", "payer_budget", "customer_validation_cost", "regulatory_gate", "alternative_advantage", "social_acceptance", "microtrend_fit", "patent_position"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const PRIVATE_TEXT = /https?:\/\/|ftp:\/\/|www\.|mailto:|\b[A-Z0-9.-]+\.(?:com|jp|org|net|io|edu|gov|ai|dev|app)(?:\/|\b)|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:password|passcode|secret|bearer\s+[a-z0-9._-]+|api[_ -]?key|パスワード|パスコード|暗証番号)/i;
const STAGES = new Set(["S0", "S1", "S2", "S3", "S4", "S5"]);
const DIRECTIONS = new Set(["down", "up", "widen", "neutral"]);
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
export const stableHash = (v) => crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
export const expectedSps = (p, q) => Number.isSafeInteger(Number(p)) && Number(p) >= 0 && Number.isFinite(Number(q)) && Number(q) >= 0 && Number(q) <= 100 ? Math.round(Number(p) * Number(q) / 100) : null;
const oneLine = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const safe = (v, max) => { const x = oneLine(v, max + 1); return x.length > 0 && x.length <= max && !PRIVATE_TEXT.test(x); };
function privacyErrors(v, p = "payload", e = []) { if (typeof v === "string" && PRIVATE_TEXT.test(v)) e.push(`${p} contains private text`); else if (Array.isArray(v)) v.forEach((x, i) => privacyErrors(x, `${p}[${i}]`, e)); else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => privacyErrors(x, `${p}.${k}`, e)); return e; }
function parseArgs(argv) { const args = {}, rest = []; for (let i = 0; i < argv.length; i += 1) { const x = argv[i]; if (!x.startsWith("--")) rest.push(x); else args[x.slice(2)] = !argv[i + 1] || argv[i + 1].startsWith("--") ? true : argv[++i]; } return { command: rest[0] ?? "help", args }; }
async function env() { const out = {}; for (const file of ["pwa/.env.production.local", "pwa/.env.local"]) { try { for (const line of (await fs.readFile(path.join(ROOT, file), "utf8")).split(/\r?\n/)) { const at = line.indexOf("="); if (at > 0 && !line.trim().startsWith("#")) out[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['\"]|['\"]$/g, ""); } } catch {} } return { ...out, ...process.env }; }
async function db() { const e = await env(); if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service environment is missing"); return createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function model(c) { const { data, error } = await c.from("sps_model_versions").select("model_version,measure_version,q_model_version,q_ruleset_version,p_model_version,assessment_ruleset_version").eq("is_current", true).limit(2); if (error || data?.length !== 1) throw new Error(error?.message ?? "exactly one current SPS model is required"); for (const [k, v] of Object.entries(CURRENT_SPS_TUPLE)) if (data[0][k] !== v) throw new Error(`current SPS ${k} is unsupported`); return { ...CURRENT_SPS_TUPLE, hash: stableHash(CURRENT_SPS_TUPLE) }; }
async function prompt(c) { const { data, error } = await c.from("llm_prompts").select("body,updated_at").eq("prompt_key", PROMPT_KEY).eq("is_active", true).maybeSingle(); const body = String(data?.body ?? ""); if (error || !body.trim()) throw new Error(error?.message ?? `active ${PROMPT_KEY} prompt is missing`); return { body, hash: stableHash(body), updated_at: data.updated_at }; }
async function snapshot(c, seedId, cutoff) { const { data, error } = await c.rpc("sps_initial_assessment_source_snapshot", { p_seed_id: seedId, p_cutoff: cutoff }); if (error || !HASH.test(String(data?.fingerprint ?? "")) || !data?.facts) throw new Error(error?.message ?? `source snapshot invalid for ${seedId}`); return data; }
const preparedHash = (p) => { const { prepared_hash: _, ...body } = p; return stableHash(body); };
function latestFactTime(facts) { const dates = [...(facts?.news ?? []).map((x) => x.occurred_on), ...(facts?.contacts ?? []).map((x) => x.contacted_on)].filter(Boolean).map((x) => Date.parse(`${x}T00:00:00.000Z`)).filter(Number.isFinite); return dates.length ? Math.max(...dates) : 0; }

async function seedIdList(c, only) { const out = []; for (let from = 0; ; from += 1000) { let q = c.from("seeds").select("id").order("created_at", { ascending: true }).range(from, from + 999); if (only) q = q.eq("id", only); const { data, error } = await q; if (error) throw new Error(error.message); for (const x of data ?? []) out.push(x.id); if (!data || data.length < 1000) return out; } }
async function assessedSeedIds(c, ids) { const out = new Set(); for (let i = 0; i < ids.length; i += 200) { const { data, error } = await c.from("seed_screening_bands").select("seed_id").in("seed_id", ids.slice(i, i + 200)).eq("frozen", true).eq("model_version", CURRENT_SPS_TUPLE.model_version).eq("measure_version", CURRENT_SPS_TUPLE.measure_version).eq("q_model_version", CURRENT_SPS_TUPLE.q_model_version).eq("q_ruleset_version", CURRENT_SPS_TUPLE.q_ruleset_version).eq("p_model_version", CURRENT_SPS_TUPLE.p_model_version).eq("ruleset_version", CURRENT_SPS_TUPLE.assessment_ruleset_version); if (error) throw new Error(error.message); for (const x of data ?? []) out.add(x.seed_id); } return out; }
async function prepare(a) {
  const c = await db(), n = Number(a.limit ?? 25), limit = Math.max(1, Math.min(100, Number.isFinite(n) ? Math.floor(n) : 25));
  const [ids, currentModel, currentPrompt] = await Promise.all([seedIdList(c, a["seed-id"] && a["seed-id"] !== true ? String(a["seed-id"]) : null), model(c), prompt(c)]);
  const assessed = await assessedSeedIds(c, ids);
  const seedIds = ids.filter((id) => !assessed.has(id)).slice(0, limit), generatedAt = new Date().toISOString();
  const snapshots = await Promise.all(seedIds.map((id) => snapshot(c, id, generatedAt)));
  const inputs = seedIds.map((seed_id, i) => ({ seed_id, source_fingerprint: snapshots[i].fingerprint, source_facts: snapshots[i].facts }));
  const out = { version: 1, contract: CONTRACT, generated_at: generatedAt, prompt: currentPrompt, model: currentModel, q_factor_ids: Q_FACTORS, inputs }; out.prepared_hash = stableHash(out);
  if (a.output && a.output !== true) await fs.writeFile(String(a.output), `${JSON.stringify(out, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, input_count: inputs.length }));
}
function tupleErrors(p, at, errors) { for (const [k, v] of Object.entries(CURRENT_SPS_TUPLE)) if (p?.[k] !== v) errors.push(`${at}.${k} must be ${v}`); }
export function validateInitialPayload(payload, prepared) {
  const errors = [];
  if (!payload || !prepared || prepared.contract !== CONTRACT || !Array.isArray(prepared.inputs)) return ["invalid payload or prepared input"];
  if (prepared.prepared_hash !== preparedHash(prepared)) errors.push("prepared_hash mismatch");
  if (!prepared.prompt?.body || prepared.prompt.hash !== stableHash(String(prepared.prompt.body))) errors.push("prepared prompt hash mismatch");
  if (prepared.model?.hash !== stableHash(CURRENT_SPS_TUPLE)) errors.push("prepared model hash mismatch");
  tupleErrors(prepared.model, "prepared.model", errors);
  if (payload.version !== 1 || payload.contract !== CONTRACT || payload.prompt_hash !== prepared.prompt?.hash || payload.prepared_hash !== prepared.prepared_hash || !Array.isArray(payload.proposals)) errors.push("payload envelope is invalid");
  errors.push(...privacyErrors(payload)); const inputs = new Map(prepared.inputs.map((x) => [x.seed_id, x])), seen = new Set();
  for (const [i, p] of (payload.proposals ?? []).entries()) {
    const at = `proposals[${i}]`, input = inputs.get(p?.seed_id); if (!input || seen.has(p?.seed_id)) errors.push(`${at}.seed_id is invalid or duplicated`); seen.add(p?.seed_id); tupleErrors(p, at, errors);
    for (const k of ["stage_lower", "stage_upper"]) if (!STAGES.has(p?.[k])) errors.push(`${at}.${k} is invalid`);
    if (STAGES.has(p?.stage_lower) && STAGES.has(p?.stage_upper) && Number(p.stage_lower.slice(1)) > Number(p.stage_upper.slice(1))) errors.push(`${at}.stage range is invalid`);
    if (!safe(p?.stage_tag, 60) || !safe(p?.q_main_factor, 120) || !safe(p?.p_class, 160) || !safe(p?.notes, 1500)) errors.push(`${at} text is invalid`);
    const ql = Number(p?.q_lower_pct), qu = Number(p?.q_upper_pct), pl = Number(p?.p_lower_yen), pu = Number(p?.p_upper_yen);
    if (!Number.isFinite(ql) || !Number.isFinite(qu) || ql < 0 || qu > 100 || ql > qu) errors.push(`${at} q range is invalid`);
    if (!Number.isSafeInteger(pl) || !Number.isSafeInteger(pu) || pl < 0 || pl > pu) errors.push(`${at} P range is invalid`);
    if (Number(p?.sps_lower_yen) !== expectedSps(pl, ql) || Number(p?.sps_upper_yen) !== expectedSps(pu, qu)) errors.push(`${at} SPS math is invalid`);
    if (!Array.isArray(p?.q_evidence) || p.q_evidence.length !== 11) errors.push(`${at}.q_evidence must contain 11 factors`); else { const ids = p.q_evidence.map((x) => x?.id); if (new Set(ids).size !== 11 || Q_FACTORS.some((id) => !ids.includes(id))) errors.push(`${at}.q_evidence factor IDs are invalid`); p.q_evidence.forEach((x, j) => { if (!safe(x?.name, 80) || !DIRECTIONS.has(x?.direction) || !safe(x?.evidence, 500) || (x?.assessment != null && !safe(x.assessment, 240))) errors.push(`${at}.q_evidence[${j}] is invalid`); }); }
    const cutoff = Date.parse(prepared.generated_at); if (!Number.isFinite(cutoff) || cutoff < latestFactTime(input?.source_facts)) errors.push(`${at}.information_cutoff is invalid`);
    if (!safe(p?.semantic_key, 240) || !safe(p?.proposal_summary, 1000)) errors.push(`${at} candidate metadata is invalid`);
    if (!HASH.test(String(input?.source_fingerprint ?? "")) || !input?.source_facts) errors.push(`${at}.prepared source facts are invalid`);
  }
  return [...new Set(errors)];
}
async function readJson(file, label) { if (!file || file === true) throw new Error(`--${label} is required`); return JSON.parse(await fs.readFile(String(file), "utf8")); }
function row(p, prepared) { const input = prepared.inputs.find((item) => item.seed_id === p.seed_id); return { seed_id: p.seed_id, ...CURRENT_SPS_TUPLE, prompt_hash: prepared.prompt.hash, model_hash: prepared.model.hash, prepared_hash: prepared.prepared_hash, source_fingerprint: input.source_fingerprint, source_facts: input.source_facts, information_cutoff: prepared.generated_at, stage_lower: p.stage_lower, stage_upper: p.stage_upper, stage_tag: oneLine(p.stage_tag, 60), q_lower_pct: Number(p.q_lower_pct), q_upper_pct: Number(p.q_upper_pct), q_main_factor: oneLine(p.q_main_factor, 120), q_evidence: p.q_evidence, p_class: oneLine(p.p_class, 160), p_lower_yen: Number(p.p_lower_yen), p_upper_yen: Number(p.p_upper_yen), sps_lower_yen: Number(p.sps_lower_yen), sps_upper_yen: Number(p.sps_upper_yen), notes: oneLine(p.notes, 1500), semantic_fingerprint: stableHash({ seed_id: p.seed_id, semantic_key: oneLine(p.semantic_key, 240).normalize("NFKC").toLowerCase() }), proposal_summary: oneLine(p.proposal_summary, 1000), created_by: "codex-sps-initial-assessment" }; }
async function submit(a) { const [payload, prepared] = await Promise.all([readJson(a.file, "file"), readJson(a.prepared, "prepared")]); const errors = validateInitialPayload(payload, prepared); if (errors.length) throw new Error(errors.join("; ")); const c = await db(), [m, p] = await Promise.all([model(c), prompt(c)]); if (m.hash !== prepared.model.hash || p.hash !== prepared.prompt.hash) throw new Error("prompt or model changed after prepare; refusing submit"); if (!payload.proposals.length) return console.log(JSON.stringify({ ok: true, candidates: 0 })); const { data, error } = await c.rpc("submit_sps_initial_assessment_candidates", { p_candidates: payload.proposals.map((x) => row(x, prepared)) }); if (error) throw new Error(error.message); console.log(JSON.stringify(data)); }
async function apply(a) { if (!UUID.test(String(a["candidate-id"] ?? "")) || !safe(a.actor, 200)) throw new Error("candidate and actor required"); const c = await db(), { data, error } = await c.rpc("apply_sps_initial_assessment_candidate", { p_candidate_id: a["candidate-id"], p_actor: a.actor }); if (error) throw new Error(error.message); console.log(JSON.stringify(data)); }
async function reject(a) { if (!UUID.test(String(a["candidate-id"] ?? "")) || !safe(a.actor, 200) || !safe(a.reason, 500)) throw new Error("candidate, actor and reason required"); const c = await db(), { data, error } = await c.rpc("reject_sps_initial_assessment_candidate", { p_candidate_id: a["candidate-id"], p_actor: a.actor, p_reason: a.reason }); if (error) throw new Error(error.message); console.log(JSON.stringify(data)); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const x = parseArgs(process.argv.slice(2)); try { if (x.command === "prepare") await prepare(x.args); else if (x.command === "validate") { const [p, r] = await Promise.all([readJson(x.args.file, "file"), readJson(x.args.prepared, "prepared")]); const errors = validateInitialPayload(p, r); console.log(JSON.stringify({ ok: !errors.length, errors }, null, 2)); if (errors.length) process.exitCode = 1; } else if (x.command === "submit") await submit(x.args); else if (x.command === "apply") await apply(x.args); else if (x.command === "reject") await reject(x.args); else console.log("prepare | validate | submit | apply | reject"); } catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; } }
