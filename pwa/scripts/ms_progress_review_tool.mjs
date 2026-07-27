#!/usr/bin/env node
/**
 * MS progress review helper for Codex automations.
 *
 * The Codex cron sandbox can lose DNS resolution even when the local app
 * session has network access. This helper talks to Supabase/PostgREST and the
 * production PWA API with a small static-DNS fallback for the known AMD OS
 * hosts, so automations can fetch live evidence before creating review rows.
 */
import fs from "node:fs";
import https from "node:https";
import dns from "node:dns";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { resolveTextbookInsightRouting } from "./textbook_insight_routing.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const AUTOMATION_DIR = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "automations", "amd-os-ms");
const DEFAULT_OS_SNAPSHOT = path.join(AUTOMATION_DIR, "snapshots", "os-latest.json");
const DEFAULT_OUTBOX_DIR = path.join(AUTOMATION_DIR, "outbox");
const DEFAULT_APPLIED_DIR = path.join(AUTOMATION_DIR, "applied");
const DEFAULT_FAILED_DIR = path.join(AUTOMATION_DIR, "failed");
loadEnv(path.join(ROOT, ".env.local"));
loadEnv(path.join(ROOT, ".env.production.local"));
const DEFAULT_MAX_SNAPSHOT_AGE_HOURS = positiveNumber(process.env.AMD_OS_MAX_SNAPSHOT_AGE_HOURS, 48);
const DEFAULT_REQUEST_TIMEOUT_MS = positiveNumber(process.env.AMD_OS_HELPER_TIMEOUT_MS, 15000);

const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const PWA_BASE_URL = process.env.PWA_BASE_URL || "https://amd-os-pwa.vercel.app";
const GAS_BASE_URL = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
const GAS_API_KEY = process.env.NEXT_PUBLIC_GAS_API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const STATIC_HOSTS = {
  "nbnhrhybjslbawdukvvk.supabase.co": ["104.18.38.10", "172.64.149.246"],
  "amd-os-pwa.vercel.app": ["64.29.17.3"],
};

const supabaseHost = new URL(SUPABASE_URL).host;
if (!STATIC_HOSTS[supabaseHost]) {
  STATIC_HOSTS[supabaseHost] = ["104.18.38.10", "172.64.149.246"];
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
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

function env(key) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value.trim();
}

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function lookup(host, opts, cb) {
  const staticIps = STATIC_HOSTS[host];
  if (staticIps?.length) {
    // Keep the custom resolver async. Synchronous lookup callbacks can race
    // TLS socket initialization in newer Node runtimes.
    return queueMicrotask(() => {
      if (opts?.all) return cb(null, staticIps.map((address) => ({ address, family: 4 })));
      return cb(null, staticIps[0], 4);
    });
  }
  return dns.lookup(host, opts, cb);
}

function requestJson(url, { method = "GET", headers = {}, body = undefined, redirects = 3, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body == null ? null : JSON.stringify(body);
    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      path: `${u.pathname}${u.search}`,
      method,
      lookup,
      headers: {
        ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          const nextUrl = new URL(res.headers.location, url).toString();
          requestJson(nextUrl, { method, headers, body, redirects: redirects - 1 }).then(resolve, reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`${method} ${url} -> ${res.statusCode}: ${raw.slice(0, 1000)}`));
          return;
        }
        if (!raw) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(raw);
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`${method} ${url} timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function rest(table, query = "") {
  const sep = query ? `?${query}` : "";
  return `${SUPABASE_URL}/rest/v1/${table}${sep}`;
}

function restHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    ...extra,
  };
}

function enc(value) {
  return encodeURIComponent(String(value));
}

function inList(values) {
  return `(${values.map((v) => `"${String(v).replaceAll('"', '\\"')}"`).join(",")})`;
}

const projectCategoryCache = new Map();
const SCORE_L2_NOTIFICATION_KINDS = new Set(["xrl_evidence", "founding_members"]);

// PWA の通知採否ループ (src/app/api/notifications/feedback/route.ts の allowedKinds) が
// 受け付ける l2_kind の正本リスト。ここに無い l2_kind を l2_notifications へ書くと、
// 通知センターに表示はされるが「はい・反映 / いいえ・不採用」が 400 unknown l2_kind で
// 死ぬ採否不能通知になる (例: amd-os-l2 が発明した monthly_report_source_gap、2026-06-02)。
// automation が新種別を発明しても DB に流入させないための applier 側の最終防衛線。
// route.ts の allowedKinds を変えたらここも同期する。
const PWA_FEEDBACK_L2_KINDS = new Set([
  "member_knowledge",
  "project_knowledge",
  "protocols",
  "ms_progress",
  "project_member_candidate",
  "project_contact_candidate",
  "raw_data_gap",
  "project_registry_diff",
  "xrl_evidence",
  "project_strategy_signal",
  "textbook_insight",
  "founding_members",
  "meeting_summary",
]);

async function loadProjectCategories(projectIds) {
  const missing = [...new Set(projectIds.filter(Boolean))].filter((projectId) => !projectCategoryCache.has(projectId));
  if (missing.length > 0) {
    const rows = await get("projects", `select=project_id,project_category&project_id=in.${inList(missing)}`);
    for (const row of rows || []) {
      projectCategoryCache.set(row.project_id, row.project_category || "dtsu");
    }
    for (const projectId of missing) {
      if (!projectCategoryCache.has(projectId)) projectCategoryCache.set(projectId, "dtsu");
    }
  }
  return new Map(projectIds.map((projectId) => [projectId, projectCategoryCache.get(projectId) || "dtsu"]));
}

async function isEcosystemProject(projectId) {
  const categories = await loadProjectCategories([projectId]);
  return categories.get(projectId) === "ecosystem";
}

function yyyymm(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function prevYm(ym) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return m === 1 ? `${y - 1}12` : `${y}${String(m - 1).padStart(2, "0")}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function inspectSnapshotDoc(doc, file = DEFAULT_OS_SNAPSHOT, { maxAgeHours = DEFAULT_MAX_SNAPSHOT_AGE_HOURS } = {}) {
  const generatedAt = doc?.generatedAt || null;
  const generatedTime = generatedAt ? new Date(generatedAt).getTime() : NaN;
  const ageHours = Number.isFinite(generatedTime) ? (Date.now() - generatedTime) / 36e5 : null;
  const stale = !Number.isFinite(generatedTime) || ageHours > maxAgeHours;
  return {
    ok: !stale,
    file,
    generatedAt,
    ageHours: ageHours == null ? null : Number(ageHours.toFixed(2)),
    maxAgeHours,
    stale,
    reason: stale
      ? (!generatedAt ? "snapshot generatedAt missing" : `snapshot older than ${maxAgeHours}h`)
      : "snapshot fresh",
  };
}

function inspectSnapshotFile(file = DEFAULT_OS_SNAPSHOT, { maxAgeHours = DEFAULT_MAX_SNAPSHOT_AGE_HOURS } = {}) {
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      file,
      generatedAt: null,
      ageHours: null,
      maxAgeHours,
      stale: true,
      reason: "snapshot file missing",
    };
  }
  try {
    return inspectSnapshotDoc(readJson(file), file, { maxAgeHours });
  } catch (error) {
    return {
      ok: false,
      file,
      generatedAt: null,
      ageHours: null,
      maxAgeHours,
      stale: true,
      reason: `snapshot unreadable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function moveFileSafe(src, destDir, suffix = "") {
  fs.mkdirSync(destDir, { recursive: true });
  const parsed = path.parse(src);
  const dest = path.join(destDir, `${parsed.name}${suffix}${parsed.ext}`);
  fs.renameSync(src, dest);
  return dest;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex").slice(0, 24);
}

function importanceValue(value, fallback = 2) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.min(3, Math.round(value)));
  const s = String(value ?? "").trim().toLowerCase();
  if (["urgent", "high", "重要", "高"].includes(s)) return 3;
  if (["normal", "medium", "mid", "中"].includes(s)) return 2;
  if (["info", "low", "低"].includes(s)) return 1;
  return fallback;
}

function confidenceValue(value, fallback = 0.5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function summarizePayload(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 3).map((item) => summarizePayload(item, depth + 1));
  if (typeof value === "object") {
    if (depth >= 2) return "[object]";
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 20)) {
      if (/key|token|secret|password|authorization/i.test(key)) {
        out[key] = "[redacted]";
      } else {
        out[key] = summarizePayload(item, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

function serviceDiagnostic(name, result, payload, ok, expected = "request fulfilled") {
  const transportOk = result.status === "fulfilled";
  const error = settledError(result);
  let reason = null;
  if (!transportOk) reason = error || `${name} request failed`;
  else if (!ok) reason = `${name} response did not satisfy health predicate: ${expected}`;
  return {
    ok,
    transportOk,
    reason,
    error,
    payload: summarizePayload(payload),
  };
}

function tableRows(snapshotDoc, table) {
  return snapshotDoc?.tables?.[table] || [];
}

async function get(table, query) {
  return requestJson(rest(table, query), { headers: restHeaders() });
}

function splitEmails(value) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function mergeEmailList(current, additions) {
  const seen = new Set();
  const out = [];
  for (const raw of [...splitEmails(current), ...additions]) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.join(", ");
}

function extractAddresses(text) {
  const matches = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(new Set(matches.map((m) => m.trim().toLowerCase())));
}

function toYmDate(ym, fallback) {
  if (fallback) {
    const d = new Date(fallback);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01T00:00:00.000Z`;
}

async function health({ includeGas = true } = {}) {
  const gasCheck = includeGas
    ? (GAS_BASE_URL
        ? requestJson(`${GAS_BASE_URL}?mode=pwaApi&key=${encodeURIComponent(GAS_API_KEY)}&action=listProps`)
        : Promise.resolve({ skipped: true, message: "NEXT_PUBLIC_GAS_WEBAPP_URL not set" }))
    : Promise.resolve({ skipped: true, message: "GAS health is not required for this automation path" });
  const checks = await Promise.allSettled([
    get("projects", "select=project_id,project_name&limit=1"),
    requestJson(`${PWA_BASE_URL}/api/progress/ms-schedule?projectId=p21&startYm=202601`),
    gasCheck,
  ]);

  const supabase = settledValue(checks[0]);
  const pwa = settledValue(checks[1]);
  const gas = settledValue(checks[2]);
  const supabaseOk = checks[0].status === "fulfilled";
  const pwaScheduleOk = checks[1].status === "fulfilled" && !!pwa?.ok;
  const gasOk = checks[2].status === "fulfilled" && (gas?.ok === true || gas?.skipped === true);
  const diagnostics = {
    supabase: serviceDiagnostic("supabase", checks[0], supabase, supabaseOk),
    pwaSchedule: serviceDiagnostic("pwaSchedule", checks[1], pwa, pwaScheduleOk, "payload.ok === true"),
    gas: serviceDiagnostic("gas", checks[2], gas, gasOk, "payload.ok === true or payload.skipped === true"),
  };

  return {
    ok: supabaseOk,
    degraded: !pwaScheduleOk || !gasOk,
    canProceed: supabaseOk,
    supabaseOk,
    pwaScheduleOk,
    gasOk,
    supabase,
    pwa: summarizePayload(pwa),
    gas: summarizePayload(gas),
    pwaSample: pwa?.schedules?.slice?.(0, 2) || [],
    diagnostics,
    errors: {
      supabase: settledError(checks[0]),
      pwaSchedule: settledError(checks[1]),
      gas: settledError(checks[2]),
    },
  };
}

function settledValue(result) {
  return result.status === "fulfilled" ? result.value : null;
}

function settledError(result) {
  return result.status === "rejected" ? String(result.reason?.message || result.reason) : null;
}

async function targets({ ym = yyyymm(), includePast = true } = {}) {
  const activeProjects = await get("projects", "select=project_id,project_name,status&status=eq.active&order=project_id.asc");
  const yms = [ym, prevYm(ym)];
  const targetMap = new Map();
  for (const p of activeProjects || []) {
    for (const targetYm of yms) {
      targetMap.set(`${p.project_id}:${targetYm}`, { projectId: p.project_id, projectName: p.project_name, ym: targetYm, reason: "active-current-prev" });
    }
  }
  if (includePast) {
    const rows = await get(
      "milestone_monthly_progress",
      "select=milestone_key,ym,progress_pct,source,confirmed_at&source=eq.tsukuyomi_estimate&confirmed_at=is.null&order=ym.desc&limit=80"
    );
    const msIds = Array.from(new Set((rows || []).map((r) => r.milestone_key)));
    if (msIds.length) {
      const milestones = await get("value_milestones", `select=milestone_id,plan_cycle_id&milestone_id=in.${inList(msIds)}`);
      const planIds = Array.from(new Set((milestones || []).map((m) => m.plan_cycle_id)));
      const cycles = planIds.length
        ? await get("value_plan_cycles", `select=plan_cycle_id,project_id&plan_cycle_id=in.${inList(planIds)}`)
        : [];
      const cycleById = new Map((cycles || []).map((c) => [c.plan_cycle_id, c]));
      const projectById = new Map((activeProjects || []).map((p) => [p.project_id, p.project_name]));
      for (const m of milestones || []) {
        const cycle = cycleById.get(m.plan_cycle_id);
        if (!cycle) continue;
        const row = rows.find((r) => r.milestone_key === m.milestone_id);
        if (!row) continue;
        const key = `${cycle.project_id}:${row.ym}`;
        if (!targetMap.has(key)) {
          targetMap.set(key, {
            projectId: cycle.project_id,
            projectName: projectById.get(cycle.project_id) || cycle.project_id,
            ym: row.ym,
            reason: "older-unconfirmed-tsukuyomi-estimate",
          });
        }
      }
    }
  }
  return { ok: true, generatedAt: new Date().toISOString(), targets: Array.from(targetMap.values()) };
}

async function snapshot({ projectId, ym }) {
  if (!projectId || !ym) throw new Error("snapshot requires --project <projectId> --ym <YYYYMM>");
  const [
    projectRows,
    cycles,
    monthlyReports,
    sourceCache,
    meetings,
    memberActivities,
    progressRows,
    pendingRevisions,
    projectMembers,
    members,
    projectPartners,
    projectFreezePeriods,
    registryDiffs,
    xrlEvidence,
    strategySignals,
    textbookInsights,
    foundingMembers,
    projectXrlLog,
    amdScoreInputs,
    projectKnowledge,
  ] = await Promise.all([
    get("projects", `select=project_id,project_name,status,report_emails,slack_channel_id,drive_folder_id,start_ym,end_ym,fee_type,fee_amount&project_id=eq.${enc(projectId)}`),
    get("value_plan_cycles", `select=*&project_id=eq.${enc(projectId)}&order=period_start_ym.asc`),
    get("monthly_reports", `select=project_id,ym,status,final_content,draft_content,collection_summary_json,generated_at,fixed_at&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}`),
    get("source_cache", `select=source,item_id,title,item_date,content_text,metadata_json&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&order=item_date.desc&limit=80`),
    get("project_meeting_summaries", `select=meeting_id,ym,meeting_date,title,summary_short,decided,progress,next_actions,risks,source_kinds,source_url,notion_url,gmail_thread_ids&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&order=meeting_date.desc&limit=80`),
    get("member_activities", `select=member_id,project_id,ym,source,source_item_id,title,content_preview,item_date,raw_metadata,milestone_id,initiative_origin,impact,depth&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&order=item_date.desc&limit=120`),
    get("milestone_monthly_progress", `select=milestone_key,ym,progress_pct,consumed_pt,source,confirmed_at,note&ym=eq.${enc(ym)}`),
    get("ms_progress_revisions", `select=*&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&status=eq.pending&order=created_at.desc`),
    get("project_members", `select=project_id,member_id,role,role_label,is_active,join_ym,leave_ym,is_pm,is_pl,is_closer&project_id=eq.${enc(projectId)}&order=member_id.asc`),
    get("members", "select=member_id,code_name,member_name,email,status,slack_id,role&order=member_id.asc"),
    get("project_partners", `select=*&project_id=eq.${enc(projectId)}&order=created_at.desc&limit=80`),
    get("project_freeze_periods", `select=*&project_id=eq.${enc(projectId)}&order=freeze_from_ym.desc&limit=80`),
    get("project_registry_diffs", `select=*&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&order=created_at.desc&limit=80`),
    get("project_xrl_evidence", `select=*&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&order=created_at.desc&limit=80`),
    get("project_strategy_signals", `select=*&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&order=created_at.desc&limit=80`),
    get("textbook_insight_candidates", `select=*&target_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&order=created_at.desc&limit=80`),
    get("project_founding_members", `select=*&project_id=eq.${enc(projectId)}&order=updated_at.desc&limit=120`),
    get("project_xrl_log", `select=*&project_id=eq.${enc(projectId)}&order=observed_at.desc&limit=80`),
    get("amd_score_inputs", `select=*&project_id=eq.${enc(projectId)}&order=evaluated_at.desc&limit=20`),
    get("project_knowledge", `select=*&project_id=eq.${enc(projectId)}&order=updated_at.desc&limit=200`),
  ]);
  const planIds = (cycles || []).map((c) => c.plan_cycle_id);
  const milestones = planIds.length
    ? await get("value_milestones", `select=*&plan_cycle_id=in.${inList(planIds)}&is_active=eq.true&order=sort_order.asc`)
    : [];
  const milestoneIds = (milestones || []).map((m) => m.milestone_id);
  const [subItems, responsibilities, memberMsActivities] = milestoneIds.length
    ? await Promise.all([
        get("milestone_sub_items", `select=*&milestone_id=in.${inList(milestoneIds)}&order=created_at.asc`),
        get("milestone_responsibility", `select=*&milestone_id=in.${inList(milestoneIds)}`),
        get("member_ms_activities", `select=*&milestone_id=in.${inList(milestoneIds)}&ym=eq.${enc(ym)}`),
      ])
    : [[], [], []];

  const schedules = [];
  for (const cycle of cycles || []) {
    if (ym < cycle.period_start_ym || ym > cycle.period_end_ym) continue;
    try {
      const schedule = await requestJson(`${PWA_BASE_URL}/api/progress/ms-schedule?projectId=${enc(projectId)}&startYm=${enc(cycle.period_start_ym)}`);
      schedules.push({ planCycleId: cycle.plan_cycle_id, ...schedule });
    } catch (e) {
      schedules.push({ planCycleId: cycle.plan_cycle_id, ok: false, error: e.message });
    }
  }

  const relevantProgress = (progressRows || []).filter((p) => milestoneIds.includes(p.milestone_key));
  return {
    ok: true,
    project: projectRows?.[0] || { project_id: projectId },
    ym,
    cycles,
    schedules,
    milestones,
    subItems,
    responsibilities,
    projectMembers,
    projectPartners,
    members,
    progress: relevantProgress,
    pendingRevisions,
    registryDiffs,
    xrlEvidence,
    strategySignals,
    textbookInsights,
    foundingMembers,
    projectXrlLog,
    amdScoreInputs,
    projectKnowledge,
    evidence: {
      sourceCache,
      meetings,
      memberActivities,
      memberMsActivities,
      monthlyReports,
    },
    sourceChecklist: summarizeSources(sourceCache, meetings),
  };
}

async function exportOsSnapshot({ ym = yyyymm(), out = DEFAULT_OS_SNAPSHOT } = {}) {
  const currentYm = ym;
  const priorYm = prevYm(ym);
  const [
    projects,
    members,
    projectMembers,
    cycles,
    milestones,
    subItems,
    responsibilities,
    progress,
    pendingRevisions,
    sourceCache,
    meetings,
    memberActivities,
    memberMsActivities,
    monthlyReports,
    notifications,
    projectPartners,
    projectFreezePeriods,
    registryDiffs,
    xrlEvidence,
    strategySignals,
    textbookInsights,
    foundingMembers,
    projectXrlLog,
    amdScoreInputs,
    projectKnowledge,
    memberKnowledge,
  ] = await Promise.all([
    get("projects", "select=*&order=project_id.asc"),
    get("members", "select=*&order=member_id.asc"),
    get("project_members", "select=*&order=project_id.asc,member_id.asc"),
    get("value_plan_cycles", "select=*&order=project_id.asc,period_start_ym.asc"),
    get("value_milestones", "select=*&order=plan_cycle_id.asc,sort_order.asc"),
    get("milestone_sub_items", "select=*&order=milestone_id.asc,created_at.asc"),
    get("milestone_responsibility", "select=*&order=milestone_id.asc,member_id.asc"),
    get("milestone_monthly_progress", `select=*&ym=in.${inList([currentYm, priorYm])}&order=ym.desc,milestone_key.asc`),
    get("ms_progress_revisions", `select=*&ym=in.${inList([currentYm, priorYm])}&status=eq.pending&order=created_at.desc`),
    get("source_cache", `select=*&ym=in.${inList([currentYm, priorYm])}&order=item_date.desc&limit=2000`),
    get("project_meeting_summaries", `select=*&ym=in.${inList([currentYm, priorYm])}&order=meeting_date.desc&limit=1000`),
    get("member_activities", `select=*&ym=in.${inList([currentYm, priorYm])}&order=item_date.desc&limit=3000`),
    get("member_ms_activities", `select=*&ym=in.${inList([currentYm, priorYm])}&limit=3000`),
    get("monthly_reports", `select=*&ym=in.${inList([currentYm, priorYm])}&order=generated_at.desc&limit=500`),
    get("l2_notifications", "select=*&order=created_at.desc&limit=500"),
    get("project_partners", "select=*&order=project_id.asc,created_at.desc&limit=1000"),
    get("project_freeze_periods", "select=*&order=project_id.asc,freeze_from_ym.desc&limit=1000"),
    get("project_registry_diffs", `select=*&ym=in.${inList([currentYm, priorYm])}&order=created_at.desc&limit=1000`),
    get("project_xrl_evidence", `select=*&ym=in.${inList([currentYm, priorYm])}&order=created_at.desc&limit=1000`),
    get("project_strategy_signals", `select=*&ym=in.${inList([currentYm, priorYm])}&order=created_at.desc&limit=1000`),
    get("textbook_insight_candidates", "select=*&order=created_at.desc&limit=1000"),
    get("project_founding_members", "select=*&order=project_id.asc,updated_at.desc&limit=2000"),
    get("project_xrl_log", "select=*&order=observed_at.desc&limit=1000"),
    get("amd_score_inputs", "select=*&order=evaluated_at.desc&limit=1000"),
    get("project_knowledge", "select=*&order=updated_at.desc&limit=3000"),
    get("member_knowledge", "select=*&order=updated_at.desc&limit=2000"),
  ]);
  const snapshotDoc = {
    ok: true,
    generatedAt: new Date().toISOString(),
    ym: currentYm,
    source: "supabase-export",
    note: "Local OS snapshot for token-light Codex automation. Automation reads this file instead of calling Supabase/PWA/GAS.",
    tables: {
      projects,
      members,
      project_members: projectMembers,
      value_plan_cycles: cycles,
      value_milestones: milestones,
      milestone_sub_items: subItems,
      milestone_responsibility: responsibilities,
      milestone_monthly_progress: progress,
      ms_progress_revisions: pendingRevisions,
      source_cache: sourceCache,
      project_meeting_summaries: meetings,
      member_activities: memberActivities,
      member_ms_activities: memberMsActivities,
      monthly_reports: monthlyReports,
      l2_notifications: notifications,
      project_partners: projectPartners,
      project_freeze_periods: projectFreezePeriods,
      project_registry_diffs: registryDiffs,
      project_xrl_evidence: xrlEvidence,
      project_strategy_signals: strategySignals,
      textbook_insight_candidates: textbookInsights,
      project_founding_members: foundingMembers,
      project_xrl_log: projectXrlLog,
      amd_score_inputs: amdScoreInputs,
      project_knowledge: projectKnowledge,
      member_knowledge: memberKnowledge,
    },
  };
  writeJson(out, snapshotDoc);
  return {
    ok: true,
    out,
    generatedAt: snapshotDoc.generatedAt,
    counts: Object.fromEntries(Object.entries(snapshotDoc.tables).map(([key, rows]) => [key, rows.length])),
  };
}

function localTargets({ file = DEFAULT_OS_SNAPSHOT, ym = yyyymm(), includePast = true } = {}) {
  const doc = readJson(file);
  const snapshotHealth = inspectSnapshotDoc(doc, file);
  const activeProjects = tableRows(doc, "projects").filter((p) => String(p.status || "").toLowerCase() === "active");
  const yms = [ym, prevYm(ym)];
  const targetMap = new Map();
  for (const p of activeProjects) {
    for (const targetYm of yms) {
      targetMap.set(`${p.project_id}:${targetYm}`, {
        projectId: p.project_id,
        projectName: p.project_name,
        ym: targetYm,
        reason: "local-snapshot-active-current-prev",
      });
    }
  }
  if (includePast) {
    const milestones = tableRows(doc, "value_milestones");
    const cycles = tableRows(doc, "value_plan_cycles");
    const milestoneById = new Map(milestones.map((m) => [m.milestone_id, m]));
    const cycleById = new Map(cycles.map((c) => [c.plan_cycle_id, c]));
    const projectById = new Map(activeProjects.map((p) => [p.project_id, p.project_name]));
    for (const row of tableRows(doc, "milestone_monthly_progress")) {
      if (row.source !== "tsukuyomi_estimate" || row.confirmed_at) continue;
      const ms = milestoneById.get(row.milestone_key);
      const cycle = ms ? cycleById.get(ms.plan_cycle_id) : null;
      if (!cycle) continue;
      const key = `${cycle.project_id}:${row.ym}`;
      if (!targetMap.has(key)) {
        targetMap.set(key, {
          projectId: cycle.project_id,
          projectName: projectById.get(cycle.project_id) || cycle.project_id,
          ym: row.ym,
          reason: "local-snapshot-older-unconfirmed-tsukuyomi-estimate",
        });
      }
    }
  }
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    snapshotGeneratedAt: doc.generatedAt,
    snapshotHealth,
    warning: snapshotHealth.stale ? snapshotHealth.reason : null,
    file,
    targets: Array.from(targetMap.values()),
  };
}

function localSnapshot({ file = DEFAULT_OS_SNAPSHOT, projectId, ym }) {
  if (!projectId || !ym) throw new Error("local-snapshot requires --project <projectId> --ym <YYYYMM>");
  const doc = readJson(file);
  const snapshotHealth = inspectSnapshotDoc(doc, file);
  const projects = tableRows(doc, "projects");
  const cycles = tableRows(doc, "value_plan_cycles").filter((c) => c.project_id === projectId);
  const planIds = new Set(cycles.map((c) => c.plan_cycle_id));
  const milestones = tableRows(doc, "value_milestones").filter((m) => planIds.has(m.plan_cycle_id) && m.is_active !== false);
  const milestoneIds = new Set(milestones.map((m) => m.milestone_id));
  const progress = tableRows(doc, "milestone_monthly_progress").filter((p) => p.ym === ym && milestoneIds.has(p.milestone_key));
  return {
    ok: true,
    offline: true,
    snapshotGeneratedAt: doc.generatedAt,
    snapshotHealth,
    warning: snapshotHealth.stale ? snapshotHealth.reason : null,
    project: projects.find((p) => p.project_id === projectId) || { project_id: projectId },
    ym,
    cycles,
    schedules: [],
    milestones,
    subItems: tableRows(doc, "milestone_sub_items").filter((s) => milestoneIds.has(s.milestone_id)),
    responsibilities: tableRows(doc, "milestone_responsibility").filter((r) => milestoneIds.has(r.milestone_id)),
    projectMembers: tableRows(doc, "project_members").filter((m) => m.project_id === projectId),
    members: tableRows(doc, "members"),
    progress,
    pendingRevisions: tableRows(doc, "ms_progress_revisions").filter((r) => r.project_id === projectId && r.ym === ym && r.status === "pending"),
    registryDiffs: tableRows(doc, "project_registry_diffs").filter((r) => r.project_id === projectId && r.ym === ym),
    xrlEvidence: tableRows(doc, "project_xrl_evidence").filter((r) => r.project_id === projectId && r.ym === ym),
    strategySignals: tableRows(doc, "project_strategy_signals").filter((r) => r.project_id === projectId && r.ym === ym),
    textbookInsights: tableRows(doc, "textbook_insight_candidates").filter((r) => r.target_id === projectId && r.ym === ym),
    foundingMembers: tableRows(doc, "project_founding_members").filter((r) => r.project_id === projectId),
    projectXrlLog: tableRows(doc, "project_xrl_log").filter((r) => r.project_id === projectId),
    amdScoreInputs: tableRows(doc, "amd_score_inputs").filter((r) => r.project_id === projectId),
    projectKnowledge: tableRows(doc, "project_knowledge").filter((r) => r.project_id === projectId),
    projectPartners: tableRows(doc, "project_partners").filter((r) => r.project_id === projectId),
    projectFreezePeriods: tableRows(doc, "project_freeze_periods").filter((r) => r.project_id === projectId),
    evidence: {
      sourceCache: tableRows(doc, "source_cache").filter((r) => r.project_id === projectId && r.ym === ym),
      meetings: tableRows(doc, "project_meeting_summaries").filter((r) => r.project_id === projectId && r.ym === ym),
      memberActivities: tableRows(doc, "member_activities").filter((r) => r.project_id === projectId && r.ym === ym),
      memberMsActivities: tableRows(doc, "member_ms_activities").filter((r) => r.ym === ym && milestoneIds.has(r.milestone_id)),
      monthlyReports: tableRows(doc, "monthly_reports").filter((r) => r.project_id === projectId && r.ym === ym),
    },
    sourceChecklist: summarizeSources(
      tableRows(doc, "source_cache").filter((r) => r.project_id === projectId && r.ym === ym),
      tableRows(doc, "project_meeting_summaries").filter((r) => r.project_id === projectId && r.ym === ym),
    ),
  };
}

async function callGasRunFunc(fn, args) {
  if (!GAS_BASE_URL) throw new Error("NEXT_PUBLIC_GAS_WEBAPP_URL is required");
  const url = new URL(GAS_BASE_URL);
  url.searchParams.set("mode", "pwaApi");
  url.searchParams.set("key", GAS_API_KEY);
  url.searchParams.set("action", "runFunc");
  url.searchParams.set("fn", fn);
  url.searchParams.set("args", JSON.stringify(args || []));
  return requestJson(url.toString());
}

async function syncReportEmailsToGas(projectId, reportEmails) {
  if (!GAS_BASE_URL) return { ok: false, skipped: true, message: "NEXT_PUBLIC_GAS_WEBAPP_URL not set" };
  return callGasRunFunc("projectConfig_api_saveProject", [
    {
      projectId,
      fields: { reportEmails },
    },
  ]);
}

async function registerEmails({ projectId, emails = [], syncGas = true }) {
  if (!projectId) throw new Error("register-emails requires --project <projectId>");
  const cleanEmails = emails.map((e) => String(e || "").trim()).filter(Boolean);
  if (!cleanEmails.length) throw new Error("register-emails requires --emails <comma separated emails>");

  const rows = await get("projects", `select=project_id,project_name,report_emails&project_id=eq.${enc(projectId)}&limit=1`);
  const project = rows?.[0];
  if (!project) throw new Error(`project not found: ${projectId}`);
  const merged = mergeEmailList(project.report_emails, cleanEmails);

  const updated = await requestJson(rest("projects", `project_id=eq.${enc(projectId)}&select=project_id,project_name,report_emails`), {
    method: "PATCH",
    headers: restHeaders({ prefer: "return=representation" }),
    body: { report_emails: merged },
  });

  const gas = syncGas ? await syncReportEmailsToGas(projectId, merged) : { ok: true, skipped: true };
  return {
    ok: true,
    projectId,
    projectName: project.project_name,
    before: project.report_emails || "",
    after: merged,
    added: cleanEmails.filter((e) => !splitEmails(project.report_emails).some((cur) => cur.toLowerCase() === e.toLowerCase())),
    supabase: updated?.[0] || null,
    gas,
  };
}

async function collectGmail({ projectId, ym }) {
  if (!projectId || !ym) throw new Error("collect-gmail requires --project <projectId> --ym <YYYYMM>");
  const pwaDirect = await collectGmailViaPwa({ projectId, ym }).catch((error) => ({ ok: false, error: error.message }));
  if (pwaDirect?.ok) return pwaDirect;
  return {
    ok: false,
    via: "pwa-gmail-api",
    projectId,
    ym,
    error: pwaDirect?.error || "PWA Gmail collect failed",
    note: "GAS Gmail collection is intentionally not used here because it reads backup Sheets instead of the Supabase source of truth.",
  };
}

async function collectSlack({ projectId, ym, maxMessages = 120, includeBots = false }) {
  if (!projectId || !ym) throw new Error("collect-slack requires --project <projectId> --ym <YYYYMM>");
  const pwaDirect = await collectSlackViaPwa({ projectId, ym, maxMessages, includeBots })
    .catch((error) => ({ ok: false, error: error.message }));
  if (pwaDirect?.ok) return pwaDirect;
  return {
    ok: false,
    via: "pwa-slack-api",
    projectId,
    ym,
    error: pwaDirect?.error || "PWA Slack collect failed",
  };
}

async function collectGmailViaPwa({ projectId, ym }) {
  if (!CRON_SECRET) throw new Error("CRON_SECRET is required for PWA Gmail collect");
  const url = new URL(`${PWA_BASE_URL}/api/sources/gmail/collect`);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("ym", ym);
  url.searchParams.set("save", "1");
  const json = await requestJson(url.toString(), {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  if (!json?.ok) throw new Error(json?.error || "PWA Gmail collect failed");
  return {
    ok: true,
    via: "pwa-gmail-api",
    projectId,
    ym,
    gasOk: null,
    gmailSuccess: true,
    note: json.note || "",
    threadCount: json.threadCount || 0,
    messageCount: json.messageCount || 0,
    savedThreadCount: json.savedThreadCount || 0,
    savedMessageCount: json.savedMessageCount || 0,
    savedCount: json.savedCount || 0,
    saved: [],
    emailRegistration: null,
    query: json.query,
  };
}

async function collectSlackViaPwa({ projectId, ym, maxMessages, includeBots }) {
  if (!CRON_SECRET) throw new Error("CRON_SECRET is required for PWA Slack collect");
  const url = new URL(`${PWA_BASE_URL}/api/sources/slack/collect`);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("ym", ym);
  url.searchParams.set("save", "1");
  url.searchParams.set("maxMessages", String(maxMessages || 120));
  if (includeBots) url.searchParams.set("includeBots", "1");
  const json = await requestJson(url.toString(), {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  if (!json?.ok) throw new Error(json?.error || "PWA Slack collect failed");
  return {
    ok: true,
    via: "pwa-slack-api",
    projectId,
    ym,
    channelId: json.channelId || null,
    channelName: json.channelName || null,
    messageCount: json.messageCount || 0,
    threadReplyCount: json.threadReplyCount || 0,
    savedCount: json.savedCount || 0,
    includeBots: json.includeBots === true,
  };
}

function summarizeSources(sourceCache = [], meetings = []) {
  const kinds = { gmail: 0, drive: 0, calendar: 0, slack: 0, notion: 0 };
  for (const row of sourceCache || []) {
    const source = String(row.source || "").toLowerCase();
    for (const key of Object.keys(kinds)) if (source.includes(key)) kinds[key] += 1;
  }
  for (const row of meetings || []) {
    const sourceKinds = String(row.source_kinds || "").toLowerCase();
    for (const key of Object.keys(kinds)) if (sourceKinds.includes(key)) kinds[key] += 1;
    if (row.notion_url) kinds.notion += 1;
    if (Array.isArray(row.gmail_thread_ids) && row.gmail_thread_ids.length) kinds.gmail += row.gmail_thread_ids.length;
  }
  return kinds;
}

async function upsertReview(file) {
  if (!file) throw new Error("upsert-review requires --file <payload.json>");
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const revisions = Array.isArray(payload.revisions) ? payload.revisions : [];
  const written = [];
  for (const r of revisions) {
    for (const key of ["project_id", "milestone_id", "ym"]) {
      if (!r[key]) throw new Error(`revision missing ${key}`);
    }
    const existing = await get(
      "ms_progress_revisions",
      `select=id&project_id=eq.${enc(r.project_id)}&milestone_id=eq.${enc(r.milestone_id)}&ym=eq.${enc(r.ym)}&status=eq.pending&limit=1`
    );
    const body = {
      project_id: r.project_id,
      milestone_id: r.milestone_id,
      ym: r.ym,
      current_pct: r.current_pct ?? null,
      current_note: r.current_note ?? null,
      revised_pct: r.revised_pct ?? null,
      revised_note: r.revised_note ?? null,
      status: "pending",
      requested_by: r.requested_by || "codex-automation",
      updated_at: new Date().toISOString(),
    };
    if (existing?.[0]?.id) {
      const updated = await requestJson(rest("ms_progress_revisions", `id=eq.${enc(existing[0].id)}&select=*`), {
        method: "PATCH",
        headers: restHeaders({ prefer: "return=representation" }),
        body,
      });
      written.push({ action: "updated", row: updated?.[0] || null });
    } else {
      const inserted = await requestJson(rest("ms_progress_revisions", "select=*"), {
        method: "POST",
        headers: restHeaders({ prefer: "return=representation" }),
        body,
      });
      written.push({ action: "inserted", row: inserted?.[0] || null });
    }
  }
  if (payload.notification && revisions.length > 0) {
    await requestJson(rest("l2_notifications", "on_conflict=l2_kind,target_id,scope_key&select=*"), {
      method: "POST",
      headers: restHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
      body: {
        l2_kind: "ms_progress",
        target_id: payload.notification.target_id,
        scope_key: payload.notification.scope_key,
        title: payload.notification.title,
        summary: String(payload.notification.summary || "").slice(0, 500),
        saved_count: payload.notification.saved_count ?? revisions.length,
        total_count: payload.notification.total_count ?? revisions.length,
        importance: payload.notification.importance ?? 2,
      },
    });
  }
  return { ok: true, writtenCount: written.length, written };
}

async function notify(file) {
  if (!file) throw new Error("notify requires --file <payload.json>");
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!payload.target_id || !payload.scope_key || !payload.title) {
    throw new Error("notification missing target_id, scope_key or title");
  }
  assertNoMojibake(payload, file);
  const rawL2Kind = payload.l2_kind || "ms_progress";
  // PWA が知らない l2_kind は採否不能な死に通知になるので、PWA 対応済みの汎用検知種別
  // project_config_gap (= 台帳/抽出経路の欠落) に矯正する。設定不足は承認対象ではないため、
  // ダッシュボードの抽出状況カードがPJ台帳から直接表示し、通知には流さない。
  let l2Kind = rawL2Kind;
  let metadataJson = payload.metadata_json || payload.metadata || {};
  if (!PWA_FEEDBACK_L2_KINDS.has(l2Kind)) {
    console.warn(`[notify] PWA 非対応の l2_kind "${rawL2Kind}" を project_config_gap に矯正 (target=${payload.target_id}, scope=${payload.scope_key})`);
    l2Kind = "project_config_gap";
    metadataJson = { ...metadataJson, original_l2_kind: rawL2Kind };
  }
  if (l2Kind === "project_config_gap") {
    return { ok: true, skipped: true, reason: "project config gaps are shown on the dashboard extraction status card" };
  }
  if (SCORE_L2_NOTIFICATION_KINDS.has(l2Kind) && await isEcosystemProject(payload.target_id)) {
    return { ok: true, skipped: true, reason: "ecosystem project is excluded from AMD Score / XRL notifications" };
  }
  const written = await requestJson(rest("l2_notifications", "on_conflict=l2_kind,target_id,scope_key&select=*"), {
    method: "POST",
    headers: restHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: {
      l2_kind: l2Kind,
      target_id: payload.target_id,
      scope_key: payload.scope_key,
      title: payload.title,
      summary: String(payload.summary || "").slice(0, 500),
      saved_count: payload.saved_count ?? 1,
      total_count: payload.total_count ?? 1,
      importance: importanceValue(payload.importance, 2),
      metadata_json: metadataJson,
    },
  });
  return { ok: true, written: written?.[0] || null };
}

// 文字化けゲート: LLM (Codex automation) が outbox を書く際、日本語 (multibyte) が
// U+003F '?' に lossy 変換される事故が稀に起きる (2026-06-01 p19/p25 registry diff)。
// 化けた payload を DB に流すと、通知タイトル・evidence snippet が「??? ZMP: ???」と
// なり採否判断不能になる。正常な日本語文に '?' が 3 個以上連続することはまず無いので、
// `???` 以上の連続を文字化けシグナルとみなし、該当 outbox を弾いて failed/ へ退避する。
// 弾かれた run は次回 automation が生データから作り直す (DB は汚さない)。
const MOJIBAKE_RUN_RE = /\?{3,}/;
function assertNoMojibake(payload, file) {
  const hits = [];
  const walk = (node, path) => {
    if (typeof node === "string") {
      if (MOJIBAKE_RUN_RE.test(node)) hits.push({ path, sample: node.slice(0, 60) });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(payload, "");
  if (hits.length > 0) {
    const detail = hits.slice(0, 5).map((h) => `${h.path}="${h.sample}"`).join(" | ");
    throw new Error(
      `mojibake detected in outbox (${hits.length} field(s)): ${detail}. ` +
      `Refusing to write garbled Japanese to DB; this run must be regenerated from raw data.`,
    );
  }
}

async function applyOutbox(file) {
  if (!file) throw new Error("apply-outbox requires --file <payload.json>");
  const payload = readJson(file);
  assertNoMojibake(payload, file);
  const results = {
    notifications: [],
    revisions: null,
    emailRegistrations: [],
    registryDiffs: null,
    xrlEvidence: null,
    strategySignals: null,
    textbookInsights: null,
    sourceCache: null,
    monthlyReports: null,
    monthlyReportsExternal: null,
    projectPatches: null,
  };
  for (const notification of payload.notifications || []) {
    const tmp = path.join(os.tmpdir(), `amd-os-notification-${crypto.randomUUID()}.json`);
    writeJson(tmp, notification);
    try {
      results.notifications.push(await notify(tmp));
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
  if (Array.isArray(payload.revisions) && payload.revisions.length) {
    const tmp = path.join(os.tmpdir(), `amd-os-revisions-${crypto.randomUUID()}.json`);
    writeJson(tmp, { revisions: payload.revisions, notification: payload.revisionNotification });
    try {
      results.revisions = await upsertReview(tmp);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
  if (Array.isArray(payload.registryDiffs) && payload.registryDiffs.length) {
    results.registryDiffs = await upsertRegistryDiffs(payload.registryDiffs);
  }
  if (Array.isArray(payload.xrlEvidence) && payload.xrlEvidence.length) {
    results.xrlEvidence = await upsertXrlEvidence(payload.xrlEvidence);
  }
  if (Array.isArray(payload.strategySignals) && payload.strategySignals.length) {
    results.strategySignals = await upsertStrategySignals(payload.strategySignals);
  }
  if (Array.isArray(payload.textbookInsights) && payload.textbookInsights.length) {
    results.textbookInsights = await upsertTextbookInsights(payload.textbookInsights);
  }
  if (Array.isArray(payload.sourceCache) && payload.sourceCache.length) {
    results.sourceCache = await upsertSourceCache(payload.sourceCache);
  }
  if (Array.isArray(payload.monthlyReports) && payload.monthlyReports.length) {
    results.monthlyReports = await upsertMonthlyReports(payload.monthlyReports);
  }
  if (Array.isArray(payload.monthlyReportsExternal) && payload.monthlyReportsExternal.length) {
    results.monthlyReportsExternal = await upsertMonthlyReportsExternal(payload.monthlyReportsExternal);
  }
  if (Array.isArray(payload.projectPatches) && payload.projectPatches.length) {
    results.projectPatches = await updateProjectPatches(payload.projectPatches);
  }
  for (const item of payload.emailRegistrations || []) {
    results.emailRegistrations.push(await registerEmails({
      projectId: item.project_id || item.projectId,
      emails: item.emails || [],
      syncGas: item.syncGas !== false,
    }));
  }
  return {
    ok: true,
    appliedAt: new Date().toISOString(),
    sourceFile: file,
    results,
  };
}

async function refreshSnapshot({ ym = yyyymm(), out = DEFAULT_OS_SNAPSHOT, includeGasHealth = false } = {}) {
  const healthResult = await health({ includeGas: includeGasHealth });
  if (!healthResult.supabaseOk) {
    return {
      ok: false,
      skipped: true,
      reason: "supabase unavailable",
      health: healthResult,
    };
  }
  const snapshotResult = await exportOsSnapshot({ ym, out });
  return {
    ok: true,
    refreshed: true,
    health: healthResult,
    snapshot: snapshotResult,
  };
}

async function applyOutboxDir({ dir = DEFAULT_OUTBOX_DIR, appliedDir, failedDir } = {}) {
  appliedDir = appliedDir || (dir === DEFAULT_OUTBOX_DIR ? DEFAULT_APPLIED_DIR : path.join(path.dirname(dir), "applied"));
  failedDir = failedDir || (dir === DEFAULT_OUTBOX_DIR ? DEFAULT_FAILED_DIR : path.join(path.dirname(dir), "failed"));
  fs.mkdirSync(dir, { recursive: true });
  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name))
    .sort();
  const results = [];
  for (const file of files) {
    try {
      const applied = await applyOutbox(file);
      const movedTo = moveFileSafe(file, appliedDir, ".applied");
      results.push({ ok: true, file, movedTo, applied });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const movedTo = moveFileSafe(file, failedDir, ".failed");
      results.push({ ok: false, file, movedTo, error: message });
    }
  }
  return {
    ok: results.every((r) => r.ok),
    scanned: files.length,
    appliedCount: results.filter((r) => r.ok).length,
    failedCount: results.filter((r) => !r.ok).length,
    results,
  };
}

async function automationPrepare({ ym = yyyymm(), out = DEFAULT_OS_SNAPSHOT, includeGasHealth = false } = {}) {
  const snapshotResult = await refreshSnapshot({ ym, out, includeGasHealth });
  const localSnapshotHealth = inspectSnapshotFile(out);
  const shouldApplyOutbox = process.env.AMD_OS_AUTOMATION_APPLY_OUTBOX === "1";
  const applyResult = shouldApplyOutbox
    ? await applyOutboxDir({})
    : {
        ok: true,
        skipped: true,
        reason: "outbox apply is handled by the local non-LLM applier",
      };
  const actionRequired = [];
  if (!snapshotResult.ok) {
    actionRequired.push("Enable network for the automation runner or run a local non-LLM snapshot refresh worker.");
  }
  if (localSnapshotHealth.stale) {
    actionRequired.push(`Do not rely on local review without explicitly noting stale snapshot: ${localSnapshotHealth.reason}.`);
  }
  if (snapshotResult.health?.degraded) {
    actionRequired.push("Review degraded health diagnostics before trusting scheduled extraction coverage.");
  }
  return {
    ok: snapshotResult.ok && applyResult.ok,
    snapshot: snapshotResult,
    localSnapshotHealth,
    outbox: applyResult,
    actionRequired,
  };
}

async function upsertRegistryDiffs(items) {
  const now = new Date().toISOString();
  const rows = items.map((item) => {
    const patch = item.proposed_patch_json || item.proposedPatch || {};
    return {
      project_id: item.project_id || item.projectId,
      ym: item.ym || null,
      diff_kind: item.diff_kind || item.diffKind || "other",
      target_table: item.target_table || item.targetTable,
      target_key: item.target_key || item.targetKey || null,
      current_snapshot_json: item.current_snapshot_json || item.currentSnapshot || {},
      proposed_patch_json: patch,
      proposed_patch_hash: item.proposed_patch_hash || item.proposedPatchHash || stableHash(patch),
      evidence_refs_json: item.evidence_refs_json || item.evidenceRefs || [],
      confidence: confidenceValue(item.confidence, 0.5),
      status: item.status || "pending",
      review_comment: item.review_comment || null,
      created_by: item.created_by || "codex_automation",
      created_at: item.created_at || now,
      updated_at: now,
    };
  });
  const missing = rows.find((r) => !r.project_id || !r.target_table);
  if (missing) throw new Error(`registryDiffs missing project_id/target_table: ${JSON.stringify(missing)}`);
  const written = await requestJson(rest("project_registry_diffs", "on_conflict=project_id,scope_key,diff_kind,target_table,target_key_norm,proposed_patch_hash&select=*"), {
    method: "POST",
    headers: restHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: rows,
  });
  return { ok: true, writtenCount: written?.length || 0, written };
}

async function upsertXrlEvidence(items) {
  const now = new Date().toISOString();
  let rows = items.map((item) => {
    const refs = item.source_refs_json || item.sourceRefs || [];
    const rawStatus = String(item.status || "candidate").trim().toLowerCase();
    return {
      project_id: item.project_id || item.projectId,
      ym: item.ym || null,
      axis: String(item.axis || "").toLowerCase(),
      evidence_kind: item.evidence_kind || item.evidenceKind || "other",
      summary: item.summary || "",
      structured_value_json: item.structured_value_json || item.structuredValue || {},
      source_refs_json: refs,
      source_hash: item.source_hash || item.sourceHash || stableHash({ refs, summary: item.summary }),
      confidence: confidenceValue(item.confidence, 0.5),
      status: rawStatus === "pending" ? "candidate" : rawStatus,
      created_by: item.created_by || "codex_automation",
      created_at: item.created_at || now,
      updated_at: now,
    };
  });
  const categories = await loadProjectCategories(rows.map((row) => row.project_id));
  const beforeFilterCount = rows.length;
  rows = rows.filter((row) => categories.get(row.project_id) !== "ecosystem");
  const skippedEcosystem = beforeFilterCount - rows.length;
  if (rows.length === 0) {
    return { ok: true, writtenCount: 0, skippedEcosystem, written: [] };
  }
  const missing = rows.find((r) => !r.project_id || !r.axis || !r.summary);
  if (missing) throw new Error(`xrlEvidence missing project_id/axis/summary: ${JSON.stringify(missing)}`);
  const written = await requestJson(rest("project_xrl_evidence", "on_conflict=project_id,scope_key,axis,evidence_kind,source_hash&select=*"), {
    method: "POST",
    headers: restHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: rows,
  });
  return { ok: true, writtenCount: written?.length || 0, skippedEcosystem, written };
}

async function upsertStrategySignals(items) {
  const now = new Date().toISOString();
  const validTypes = new Set([
    "management_decision",
    "business_progress",
    "strategic_pivot",
    "commercial_progress",
    "partnership",
    "funding",
    "ip_regulatory",
    "tech_progress",
    "risk",
    "next_move",
  ]);
  const validImpacts = new Set(["low", "medium", "high", "critical"]);
  const validStates = new Set(["observed", "proposed", "decided", "executing", "revised"]);
  const validScopes = new Set(["company", "project", "cross_project"]);
  const validPipelineStatus = new Set(["prospect", "high_confidence", "contracting", "contracted", "lost", "deferred"]);
  const validCompanyScoreAxis = new Set(["pipeline", "funding", "runway", "finance", "capacity", "decision", "resource_allocation", "revenue"]);
  const rows = items.map((item) => {
    const refs = item.source_refs_json || item.sourceRefs || [];
    const signalType = String(item.signal_type || item.signalType || "business_progress").trim();
    const impact = String(item.impact_level || item.impactLevel || "medium").trim();
    const state = String(item.decision_state || item.decisionState || "observed").trim();
    const rawStatus = String(item.status || "candidate").trim().toLowerCase();
    const rawScope = item.signal_scope || item.signalScope || null;
    const rawPipelineStatus = item.pipeline_status || item.pipelineStatus || null;
    const rawCompanyScoreAxis = item.company_score_axis || item.companyScoreAxis || null;
    const probability = item.pipeline_probability ?? item.pipelineProbability;
    const expectedAmount = item.expected_amount_yen ?? item.expectedAmountYen;
    const expectedContractYm = item.expected_contract_ym || item.expectedContractYm || null;
    return {
      project_id: item.project_id || item.projectId,
      ym: item.ym || null,
      signal_date: item.signal_date || item.signalDate || null,
      signal_type: validTypes.has(signalType) ? signalType : "business_progress",
      title: String(item.title || "").slice(0, 180),
      summary: String(item.summary || "").slice(0, 900),
      impact_level: validImpacts.has(impact) ? impact : "medium",
      decision_state: validStates.has(state) ? state : "observed",
      status: ["candidate", "confirmed", "rejected", "archived"].includes(rawStatus) ? rawStatus : "candidate",
      source_refs_json: refs,
      source_hash: item.source_hash || item.sourceHash || stableHash({ refs, title: item.title, summary: item.summary }),
      confidence: confidenceValue(item.confidence, 0.5),
      extraction_run_id: item.extraction_run_id || item.extractionRunId || null,
      created_by: item.created_by || "codex_automation",
      created_at: item.created_at || now,
      updated_at: now,
      signal_scope: rawScope && validScopes.has(String(rawScope)) ? String(rawScope) : null,
      applies_to_company_score: typeof (item.applies_to_company_score ?? item.appliesToCompanyScore) === "boolean" ? (item.applies_to_company_score ?? item.appliesToCompanyScore) : null,
      pipeline_status: rawPipelineStatus && validPipelineStatus.has(String(rawPipelineStatus)) ? String(rawPipelineStatus) : null,
      pipeline_probability: Number.isFinite(Number(probability)) ? Math.max(0, Math.min(1, Number(probability))) : null,
      expected_amount_yen: Number.isFinite(Number(expectedAmount)) ? Number(expectedAmount) : null,
      expected_contract_ym: expectedContractYm && /^\d{6}$/.test(String(expectedContractYm)) ? String(expectedContractYm) : null,
      company_score_axis: rawCompanyScoreAxis && validCompanyScoreAxis.has(String(rawCompanyScoreAxis)) ? String(rawCompanyScoreAxis) : null,
      scope_reason: item.scope_reason || item.scopeReason ? String(item.scope_reason || item.scopeReason).slice(0, 1000) : null,
    };
  });
  for (const row of rows) {
    for (const key of [
      "signal_scope",
      "applies_to_company_score",
      "pipeline_status",
      "pipeline_probability",
      "expected_amount_yen",
      "expected_contract_ym",
      "company_score_axis",
      "scope_reason",
    ]) {
      if (row[key] === null || row[key] === undefined) delete row[key];
    }
  }
  const missing = rows.find((r) => !r.project_id || !r.title || !r.summary || !r.source_hash);
  if (missing) throw new Error(`strategySignals missing project_id/title/summary/source_hash: ${JSON.stringify(missing)}`);
  const invalidCompanyScope = rows.find((r) =>
    r.applies_to_company_score === true
    && (!["company", "cross_project"].includes(r.signal_scope) || !r.company_score_axis || !r.scope_reason)
  );
  if (invalidCompanyScope) {
    throw new Error(`strategySignals invalid company-score scope: ${JSON.stringify(invalidCompanyScope)}`);
  }
  const invalidCandidatePipeline = rows.find((r) =>
    r.status === "candidate"
    && r.applies_to_company_score === true
    && r.company_score_axis === "pipeline"
    && Math.max(Number(r.pipeline_probability || 0), Number(r.confidence || 0)) < 0.75
  );
  if (invalidCandidatePipeline) {
    throw new Error(`strategySignals candidate company pipeline requires probability >= 0.75: ${JSON.stringify(invalidCandidatePipeline)}`);
  }
  const written = await requestJson(rest("project_strategy_signals", "on_conflict=project_id,scope_key,signal_type,source_hash&select=*"), {
    method: "POST",
    headers: restHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: rows,
  });
  return { ok: true, writtenCount: written?.length || 0, written };
}

async function upsertTextbookInsights(items) {
  const now = new Date().toISOString();
  const validTypes = new Set([
    "before_zero_knowhow",
    "cross_project_pattern",
    "case_study",
    "theory_evidence",
  ]);
  const validPracticeKinds = new Set([
    "decision_branch",
    "failure_learning",
    "cross_project_pattern",
    "theory_case",
    "reusable_question",
    "relationship_playbook",
    "field_transition",
  ]);
  const validTheoryCaseKinds = new Set(["edge_case", "update_candidate"]);
  const validConfidentiality = new Set(["internal_only", "sanitized", "publishable"]);
  const validBzmReviewStatuses = new Set(["not_required", "pending", "approved", "changes_requested", "rejected"]);
  const validTheoryChangeScopes = new Set([
    "none",
    "terminology",
    "axis_definition",
    "rubric",
    "formula",
    "weight",
    "chapter_structure",
  ]);
  const validDestinationKinds = new Set(["bzm_textbook", "management_knowledge"]);
  const validManagementCategories = new Set([
    "commercialization_route",
    "coalition_design",
    "pricing",
    "sales",
    "finance",
    "governance",
    "organization",
    "fundraising",
    "legal",
    "operations",
    "other",
  ]);
  const validManagementMaturities = new Set(["raw_note", "hypothesis", "field_tested", "playbook"]);
  const validStatuses = new Set(["candidate", "approved", "rejected", "applied", "archived"]);
  const rows = items.map((item) => {
    const refs = item.evidence_refs || item.evidenceRefs || [];
    const sourceTables = item.source_tables || item.sourceTables || [];
    const targetId = item.target_id || item.targetId || item.project_id || item.projectId || "p00";
    const insightType = String(item.insight_type || item.insightType || "before_zero_knowhow").trim();
    const metadataInput = item.metadata_json || item.metadataJson || item.metadata || {};
    const metadata = metadataInput && typeof metadataInput === "object" && !Array.isArray(metadataInput)
      ? { ...metadataInput }
      : {};
    const validationWarnings = Array.isArray(metadata.validation_warnings)
      ? metadata.validation_warnings.map((v) => String(v)).filter(Boolean)
      : [];
    // destination_kind は practice_kind から推測しない。抽出器が「BZMへ追記」か
    // 「管理 → 経営ノウハウへ保存」かを明示する。旧 outbox だけは互換のため BZM 扱い。
    const rawDestinationKind = String(item.destination_kind || item.destinationKind || metadata.destination_kind || "").trim();
    const destinationKind = validDestinationKinds.has(rawDestinationKind)
      ? rawDestinationKind
      : "bzm_textbook";
    if (rawDestinationKind && !validDestinationKinds.has(rawDestinationKind)) {
      validationWarnings.push(`unknown destination_kind treated as bzm_textbook: ${rawDestinationKind}`);
    }
    metadata.destination_kind = destinationKind;
    if (destinationKind === "management_knowledge") {
      const rawCategory = String(item.management_category || item.managementCategory || metadata.management_category || "operations").trim();
      const rawMaturity = String(item.management_maturity || item.managementMaturity || metadata.management_maturity || "hypothesis").trim();
      const rawTags = item.management_tags || item.managementTags || metadata.management_tags || [];
      const tags = Array.isArray(rawTags)
        ? rawTags.map((tag) => String(tag).trim()).filter(Boolean)
        : String(rawTags).split(",").map((tag) => tag.trim()).filter(Boolean);
      metadata.management_category = validManagementCategories.has(rawCategory) ? rawCategory : "operations";
      metadata.management_maturity = validManagementMaturities.has(rawMaturity) ? rawMaturity : "hypothesis";
      metadata.management_tags = Array.from(new Set(tags)).slice(0, 32);
      metadata.management_tags_text = metadata.management_tags.join("、");
      metadata.management_reusable_when = String(item.management_reusable_when || item.managementReusableWhen || metadata.management_reusable_when || "").trim().slice(0, 2000);
      metadata.management_next_check = String(item.management_next_check || item.managementNextCheck || metadata.management_next_check || "").trim().slice(0, 2000);
      const rawConfidence = Number(item.management_confidence || item.managementConfidence || metadata.management_confidence);
      metadata.management_confidence = Number.isFinite(rawConfidence)
        ? Math.max(0, Math.min(1, Math.round(rawConfidence * 100) / 100))
        : 0.5;
    }
    const rawPracticeKind = String(item.practice_kind || item.practiceKind || metadata.practice_kind || "").trim();
    if (rawPracticeKind) {
      metadata.practice_kind = rawPracticeKind;
      if (!validPracticeKinds.has(rawPracticeKind)) {
        validationWarnings.push(`unknown practice_kind: ${rawPracticeKind}`);
      }
    } else if (!metadata.practice_kind && destinationKind === "bzm_textbook") {
      validationWarnings.push("missing practice_kind; target routing fell back to explicit/default slug");
    }
    const rawTheoryCaseKind = String(item.theory_case_kind || item.theoryCaseKind || metadata.theory_case_kind || "").trim();
    if (rawTheoryCaseKind) {
      metadata.theory_case_kind = rawTheoryCaseKind;
      if (!validTheoryCaseKinds.has(rawTheoryCaseKind)) {
        validationWarnings.push(`unknown theory_case_kind: ${rawTheoryCaseKind}`);
      }
    }
    const rawConfidentiality = String(item.confidentiality || metadata.confidentiality || "internal_only").trim();
    const confidentiality = validConfidentiality.has(rawConfidentiality) ? rawConfidentiality : "internal_only";
    if (!validConfidentiality.has(rawConfidentiality)) {
      validationWarnings.push(`unknown confidentiality treated as internal_only: ${rawConfidentiality}`);
    }
    const rawTheoryChangeScope = String(item.theory_change_scope || item.theoryChangeScope || metadata.theory_change_scope || "none").trim();
    const theoryChangeScope = validTheoryChangeScopes.has(rawTheoryChangeScope) ? rawTheoryChangeScope : "none";
    if (!validTheoryChangeScopes.has(rawTheoryChangeScope)) {
      validationWarnings.push(`unknown theory_change_scope treated as none: ${rawTheoryChangeScope}`);
    }
    const practiceKind = String(metadata.practice_kind || "");
    const hasTheoryCaseReview = destinationKind === "bzm_textbook" && practiceKind === "theory_case";
    if (destinationKind === "bzm_textbook" && practiceKind === "theory_case" && !rawTheoryCaseKind) {
      validationWarnings.push("theory_case missing theory_case_kind; BZM review required");
    }
    const bzmReviewRequired = destinationKind === "bzm_textbook" && (
      Boolean(item.bzm_review_required ?? item.bzmReviewRequired ?? metadata.bzm_review_required)
      || theoryChangeScope !== "none"
      || hasTheoryCaseReview
    );
    const rawBzmReviewStatus = String(item.bzm_review_status || item.bzmReviewStatus || metadata.bzm_review_status || "").trim();
    const bzmReviewStatus = validBzmReviewStatuses.has(rawBzmReviewStatus)
      ? rawBzmReviewStatus
      : bzmReviewRequired
        ? "pending"
        : "not_required";
    if (bzmReviewRequired && bzmReviewStatus === "not_required") {
      validationWarnings.push("bzm_review_required=true with not_required status; treated as pending");
    }
    const rawTargetBzmSlug = String(item.target_bzm_slug || item.targetBzmSlug || "").trim();
    const rawProposedSection = item.proposed_section || item.proposedSection || null;
    const routing = destinationKind === "bzm_textbook"
      ? resolveTextbookInsightRouting({
        practiceKind,
        targetBzmSlug: rawTargetBzmSlug,
        proposedSection: rawProposedSection,
      })
      : null;
    for (const warning of routing?.warnings || []) validationWarnings.push(warning);
    if (routing) {
      metadata.target_routing = {
        source: routing.source,
        reason: routing.reason,
        target_bzm_slug: routing.targetBzmSlug,
      };
    }
    metadata.confidentiality = confidentiality;
    metadata.bzm_review_required = bzmReviewRequired;
    metadata.bzm_review_status = destinationKind === "bzm_textbook" && bzmReviewRequired && bzmReviewStatus === "not_required" ? "pending" : (destinationKind === "bzm_textbook" ? bzmReviewStatus : "not_required");
    metadata.theory_change_scope = destinationKind === "bzm_textbook" ? theoryChangeScope : "none";
    if (validationWarnings.length) metadata.validation_warnings = Array.from(new Set(validationWarnings));
    const sourceHash = item.source_hash || item.sourceHash || stableHash({
      targetId,
      title: item.title,
      body: item.body_md || item.bodyMd || item.body,
      refs,
    });
    const rawStatus = String(item.status || "candidate").trim().toLowerCase();
    return {
      target_id: targetId,
      ym: item.ym || null,
      scope_key: item.scope_key || item.scopeKey || `textbook:${String(sourceHash).slice(0, 12)}`,
      topic: String(item.topic || item.title || "").slice(0, 180),
      title: String(item.title || item.topic || "").slice(0, 180),
      proposed_section: destinationKind === "bzm_textbook" ? (rawProposedSection || routing?.proposedSection || null) : null,
      target_bzm_slug: destinationKind === "bzm_textbook" ? routing?.targetBzmSlug || null : null,
      insight_type: validTypes.has(insightType) ? insightType : "before_zero_knowhow",
      priority: Math.min(4, Math.max(1, Number(item.priority || 2))),
      body_md: String(item.body_md || item.bodyMd || item.body || "").trim(),
      evidence_refs: refs,
      source_tables: sourceTables,
      metadata_json: metadata,
      confidentiality,
      bzm_review_required: bzmReviewRequired,
      bzm_review_status: metadata.bzm_review_status,
      theory_change_scope: metadata.theory_change_scope,
      source_hash: String(sourceHash),
      status: validStatuses.has(rawStatus) ? rawStatus : "candidate",
      extraction_run_id: item.extraction_run_id || item.extractionRunId || null,
      created_by: item.created_by || item.createdBy || "codex_automation_l10",
      created_at: item.created_at || now,
      updated_at: now,
    };
  });
  const missing = rows.find((r) => !r.target_id || !r.scope_key || !r.title || !r.body_md || !r.source_hash);
  if (missing) throw new Error(`textbookInsights missing target_id/scope_key/title/body_md/source_hash: ${JSON.stringify(missing)}`);
  const written = await requestJson(rest("textbook_insight_candidates", "on_conflict=target_id,scope_key&select=*"), {
    method: "POST",
    headers: restHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: rows,
  });

  const notifications = [];
  for (const row of written || []) {
    const notification = await requestJson(rest("l2_notifications", "on_conflict=l2_kind,target_id,scope_key&select=*"), {
      method: "POST",
      headers: restHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
      body: {
        l2_kind: "textbook_insight",
        target_id: row.target_id,
        scope_key: row.scope_key,
        title: `${row.metadata_json?.destination_kind === "management_knowledge" ? "💡 経営ノウハウ追加候補" : "📘 BZM追記候補"}: ${row.title}`,
        summary: String(row.body_md || "").replace(/\s+/g, " ").slice(0, 500),
        saved_count: 1,
        total_count: 1,
        importance: Math.max(1, Math.min(3, 5 - Number(row.priority || 2))),
        metadata_json: {
          candidate_id: row.candidate_id,
          candidate_source_hash: row.source_hash,
          insight_type: row.insight_type,
          destination_kind: row.metadata_json?.destination_kind || "bzm_textbook",
          practice_kind: row.metadata_json?.practice_kind,
          confidentiality: row.confidentiality,
          bzm_review_required: row.bzm_review_required,
          bzm_review_status: row.bzm_review_status,
          theory_change_scope: row.theory_change_scope,
          target_bzm_slug: row.target_bzm_slug,
          management_category: row.metadata_json?.management_category,
          management_maturity: row.metadata_json?.management_maturity,
          management_tags: row.metadata_json?.management_tags,
          management_tags_text: row.metadata_json?.management_tags_text,
          management_reusable_when: row.metadata_json?.management_reusable_when,
          management_next_check: row.metadata_json?.management_next_check,
          management_confidence: row.metadata_json?.management_confidence,
          priority: row.priority,
        },
      },
    });
    notifications.push(notification?.[0] || null);
  }

  return { ok: true, writtenCount: written?.length || 0, notificationCount: notifications.length, written, notifications };
}

async function upsertSourceCache(items) {
  const now = new Date().toISOString();
  const rows = items.map((item) => {
    const projectId = item.project_id || item.projectId;
    const source = String(item.source || "").trim().toLowerCase();
    const itemId = String(item.item_id || item.itemId || item.id || "").trim();
    const contentText = String(item.content_text || item.contentText || item.snippet || "").slice(0, 4000);
    return {
      cache_id: item.cache_id || item.cacheId || stableHash({ projectId, source, itemId }),
      project_id: projectId,
      ym: item.ym || yyyymm(),
      source,
      item_id: itemId,
      title: item.title || null,
      item_date: item.item_date || item.itemDate || null,
      content_text: contentText,
      char_count: item.char_count ?? item.charCount ?? contentText.length,
      metadata_json: item.metadata_json || item.metadata || {},
      collected_at: item.collected_at || item.collectedAt || now,
    };
  });
  const missing = rows.find((r) => !r.project_id || !r.ym || !r.source || !r.item_id);
  if (missing) throw new Error(`sourceCache missing project_id/ym/source/item_id: ${JSON.stringify(missing)}`);
  const written = await requestJson(rest("source_cache", "on_conflict=project_id,source,item_id&select=*"), {
    method: "POST",
    headers: restHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: rows,
  });
  return { ok: true, writtenCount: written?.length || 0, written };
}

const MONTHLY_REPORT_REQUIRED_HEADINGS = [
  "概要",
  "今月進んだこと",
  "重要な判断・合意",
  "顧客・共同研究・外部関係者の動き",
  "技術・知財・実験・資料",
  "リスク・未確定事項",
  "来月の焦点",
  "根拠",
];

function monthlyReportSectionBody(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = new RegExp(`^##\\s+${escaped}\\s*$`, "m").exec(content);
  if (!start) return "";
  const rest = content.slice(start.index + start[0].length);
  const next = /^##\s+/m.exec(rest);
  return rest.slice(0, next?.index ?? rest.length).trim();
}

// 月次レポート draft/final の品質検証。
// 見出しだけでなく、概要が状況の要約であることと、進捗が会議ログの羅列でないことも要求する。
function validateMonthlyReportContent(content) {
  const errors = [];
  if (typeof content !== "string" || !content.trim()) {
    return { ok: false, errors: ["月次報告書本文が空です"], normalized: content };
  }

  const normalized = content.replace(/eLAD/gi, "e-Rad").trim();
  const foundHeadings = [];
  const headingLine = /^##\s+(.+?)\s*$/gm;
  let m;
  while ((m = headingLine.exec(normalized)) !== null) {
    const text = m[1].replace(/[:：]\s*$/, "").trim();
    if (MONTHLY_REPORT_REQUIRED_HEADINGS.includes(text)) foundHeadings.push(text);
  }
  for (const required of MONTHLY_REPORT_REQUIRED_HEADINGS) {
    const count = foundHeadings.filter((heading) => heading === required).length;
    if (count === 0) errors.push(`見出し「${required}」が見つかりません`);
    else if (count > 1) errors.push(`見出し「${required}」は1回だけ使用してください`);
  }
  if (foundHeadings.length === MONTHLY_REPORT_REQUIRED_HEADINGS.length) {
    const ordered = MONTHLY_REPORT_REQUIRED_HEADINGS.every((heading, index) => foundHeadings[index] === heading);
    if (!ordered) errors.push(`見出しの順序が不正です: ${foundHeadings.join(" > ")}`);
  }

  const noActivity = /(?:確認できる実進捗はない|実進捗を確認できなかった|進捗なし)/.test(normalized);
  if (!noActivity && normalized.length < 1000) {
    errors.push("実進捗がある月の社内版は1000文字以上で、経緯・到達点・残課題まで統合してください");
  }

  const overviewBody = monthlyReportSectionBody(normalized, "概要");
  if (overviewBody.length < 120 || overviewBody.length > 600) {
    errors.push("概要は120〜600文字の範囲で、当月の進展・判断・次の焦点をまとめてください");
  }
  const overviewSentenceCount = (overviewBody.match(/[。！？]/g) || []).length;
  if (overviewSentenceCount < 3 || overviewSentenceCount > 5) {
    errors.push(`概要は3〜5文にしてください (現在${overviewSentenceCount}文)`);
  }
  if (/^(?:\s*[-*]|\s*\|)/m.test(overviewBody)) {
    errors.push("概要は箇条書きや表ではなく、3〜5文の文章で書いてください");
  }

  const processPattern = /(?:既存|前回).{0,12}draft|draft.{0,12}(?:生成|更新|追補)|collection[_ ]summary|source[_ ]refs?|OS内L2|L2(?:の|を|から|\s)*(?:要約|証跡|件数|カウント)|snapshot|確認した根拠|今回の追補|今回確認したL2断面|新しい根拠の扱い|本文は.{0,30}(?:構成|作成)|raw(?:メール|データ)|Slack本文|議事録全文|月次断面|補強した/gi;
  const processTerms = normalized.match(processPattern) || [];
  if (processTerms.length > 0) {
    errors.push(`本文に生成・収集プロセスの作業ログが残っています: ${[...new Set(processTerms)].slice(0, 4).join(" / ")}`);
  }
  if (/^\s*(?:決定(?:\/確認)?|確認|次アクション)\s*[:：]/m.test(normalized)) {
    errors.push("本文に生の決定・確認・次アクション行が残っています");
  }
  if (/。\s*,/.test(normalized)) errors.push("句点直後にASCIIカンマが連結しています");
  if (/(\.\.\.|…)/.test(normalized)) errors.push("途中省略記号を使わず、文を最後まで書いてください");

  const progressBody = monthlyReportSectionBody(normalized, "今月進んだこと");
  if (!noActivity) {
    const proseBlocks = progressBody
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter((block) => block && !/^[-*|]/.test(block));
    if (progressBody.length < 250 || proseBlocks.length < 2) {
      errors.push("「今月進んだこと」は会議ログを並べず、2つ以上の業務領域を文章で統合してください");
    }
  }

  for (const heading of MONTHLY_REPORT_REQUIRED_HEADINGS) {
    if (monthlyReportSectionBody(normalized, heading).length < 20) {
      errors.push(`「${heading}」の内容が不足しています`);
    }
  }

  const evidenceBody = monthlyReportSectionBody(normalized, "根拠");
  if (/https?:\/\/|\/mypage\?|\b(?:source|meeting|cache|signal)[-_ ]?id\b/i.test(evidenceBody)) {
    errors.push("根拠には内部IDやURLを載せず、日付・種別・自然な件名だけを書いてください");
  }

  return { ok: errors.length === 0, errors, normalized };
}

async function upsertMonthlyReports(items) {
  const now = new Date().toISOString();
  const written = [];
  for (const item of items) {
    const projectId = item.project_id || item.projectId;
    const ym = item.ym;
    if (!projectId || !ym) throw new Error(`monthlyReports missing project_id/ym: ${JSON.stringify(item)}`);
    const existing = await get("monthly_reports", `select=*&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&limit=1`);
    const current = existing?.[0] || null;
    if (current?.final_content && item.force !== true) {
      written.push({ action: "skipped_final_exists", row: current });
      continue;
    }
    const incomingDraft = item.draft_content ?? item.draftContent ?? item.content;
    let draft = incomingDraft ?? current?.draft_content ?? "";
    if (incomingDraft !== undefined) {
      const validation = validateMonthlyReportContent(incomingDraft);
      if (!validation.ok) {
        if (item.strict === false) {
          written.push({ action: "skipped_validation_failed", project_id: projectId, ym, target: "draft_content", errors: validation.errors });
          continue;
        }
        throw new Error(`monthlyReports draft_content quality check failed for ${projectId}/${ym}:\n- ${validation.errors.join("\n- ")}`);
      }
      draft = validation.normalized;
    }
    const body = {
      report_id: item.report_id || item.reportId || current?.report_id || `${projectId}_${ym}`,
      project_id: projectId,
      ym,
      draft_content: draft,
      status: item.status || current?.status || "draft",
      collection_summary_json: item.collection_summary_json || item.collectionSummary || current?.collection_summary_json || {},
      generated_at: item.generated_at || item.generatedAt || now,
      last_cron_at: item.last_cron_at || item.lastCronAt || now,
      section_members: item.section_members ?? item.sectionMembers ?? current?.section_members ?? null,
    };
    const finalContent = item.final_content || item.finalContent;
    if (finalContent) {
      const validation = validateMonthlyReportContent(finalContent);
      if (!validation.ok) {
        if (item.strict === false) {
          written.push({ action: "skipped_validation_failed", project_id: projectId, ym, errors: validation.errors });
          continue;
        }
        throw new Error(`monthlyReports final_content quality check failed for ${projectId}/${ym}:\n- ${validation.errors.join("\n- ")}`);
      }
      body.final_content = validation.normalized;
    }
    const response = current
      ? await requestJson(rest("monthly_reports", `project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}&select=*`), {
          method: "PATCH",
          headers: restHeaders({ prefer: "return=representation" }),
          body,
        })
      : await requestJson(rest("monthly_reports", "select=*"), {
          method: "POST",
          headers: restHeaders({ prefer: "return=representation" }),
          body,
        });
    written.push({ action: current ? "updated" : "inserted", row: response?.[0] || null });
  }
  return { ok: true, writtenCount: written.length, written };
}

function surnameOnly(memberName) {
  const parts = String(memberName || "").trim().split(/[\s　]+/).filter(Boolean);
  return parts.length >= 2 ? parts[0] : "担当者";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function normalizeExternalMonthlyReport(content) {
  let normalized = String(content || "").replace(/eLAD/gi, "e-Rad");
  const members = await get("members", "select=code_name,member_name");
  const identities = (members || []).map((member) => ({
    codeName: String(member.code_name || "").trim(),
    memberName: String(member.member_name || "").trim(),
    surname: surnameOnly(member.member_name),
  })).filter((member) => member.codeName || member.memberName);

  for (const member of identities) {
    if (member.memberName) normalized = normalized.split(member.memberName).join(member.surname);
    if (member.codeName) {
      normalized = normalized.replace(new RegExp(`\\[${escapeRegExp(member.codeName)}\\](?=\\()`, "g"), member.surname);
    }
  }
  for (const left of identities) {
    for (const right of identities) {
      if (!left.codeName || !right.codeName || left === right) continue;
      normalized = normalized.split(`${left.codeName}と${right.codeName}`).join(`${left.surname}と${right.surname}`);
    }
  }
  for (const member of identities) {
    if (!member.codeName) continue;
    const pattern = new RegExp(`(^|[\\s、。,，。・（(「『【:：]|[はがをものと])${escapeRegExp(member.codeName)}(?=(?:(?:は|が|を|も|へ|の|から|より)(?:[\\s、。,，。]|$|[一-龥ぁ-んァ-ンA-Za-z0-9])|[A-Z]{2,}|[:：]))`, "g");
    normalized = normalized.replace(pattern, `$1${member.surname}`);
  }
  return normalized;
}

const EXTERNAL_REPORT_REQUIRED_SECTIONS = [
  "業務概要",
  "当月の実施内容",
  "体制および打合せ実施記録",
  "主要成果物",
  "来月以降の予定",
];

// 対外提出版は 2026-06-30 KUTE 実提出版を品質基準とする。内部版の8章検証とは
// 分離し、契約情報・実施内容・業務領域・体制・成果物・翌月予定を備えた連続文書を要求する。
function validateExternalMonthlyReportContent(content) {
  const errors = [];
  if (typeof content !== "string" || !content.trim()) {
    return { ok: false, errors: ["対外月次業務報告書本文が空です"] };
  }

  if (!/^[\t ]*#[\t ]+月次業務報告書[\t ]*(?:\r?\n|$)/u.test(content)) {
    errors.push("先頭見出し「# 月次業務報告書」がありません");
  }
  for (const section of EXTERNAL_REPORT_REQUIRED_SECTIONS) {
    const re = new RegExp(`^##\\s+\\d+(?:\\.\\d+)?[.．]?\\s*[^\\n]*${escapeRegExp(section)}[^\\n]*$`, "m");
    if (!re.test(content)) errors.push(`必須章「${section}」がありません`);
  }

  const h2Count = (content.match(/^##\s+/gm) || []).length;
  if (h2Count < 7) errors.push(`章数が不足しています (${h2Count}章、7章以上必要)`);
  const tableCount = (content.match(/^\|\s*[-:]+/gm) || []).length;
  if (tableCount < 3) errors.push(`表が不足しています (${tableCount}表、3表以上必要)`);
  if (content.trim().length < 3000) {
    errors.push(`本文が短すぎます (${content.trim().length}文字、3000文字以上必要)`);
  }
  if (!/以上のとおり報告する。\s*$/.test(content)) {
    errors.push("末尾が「以上のとおり報告する。」で終わっていません");
  }
  if (/eLAD/i.test(content)) errors.push("誤表記 eLAD が残っています (e-Rad に統一してください)");
  if (/^\s*(?:決定(?:\/確認)?|確認|次アクション)\s*[:：]/m.test(content)) {
    errors.push("生データのラベル行が残っています (報告文へ再構成してください)");
  }
  if (/。\s*,/.test(content)) errors.push("句点直後に ASCII カンマが連結しています");
  if (/(?:\.\.\.|…)/.test(content)) errors.push("省略記号が含まれています");

  return { ok: errors.length === 0, errors };
}

async function upsertMonthlyReportsExternal(items) {
  const now = new Date().toISOString();
  const rows = [];
  for (const item of items) {
    const projectId = item.project_id || item.projectId;
    const ym = item.ym;
    const rawBody = item.body_md ?? item.bodyMd ?? item.content;
    if (!projectId || !/^\d{4}-\d{2}$/.test(String(ym || "")) || !String(rawBody || "").trim()) {
      throw new Error(`monthlyReportsExternal requires project_id, ym=YYYY-MM, and body_md: ${JSON.stringify({ project_id: projectId, ym })}`);
    }
    const bodyMd = await normalizeExternalMonthlyReport(rawBody);
    const validation = validateExternalMonthlyReportContent(bodyMd);
    if (!validation.ok) {
      if (item.strict === false) {
        continue;
      }
      throw new Error(`monthlyReportsExternal body_md quality check failed for ${projectId}/${ym}:\n- ${validation.errors.join("\n- ")}`);
    }
    rows.push({
      project_id: projectId,
      ym,
      body_md: bodyMd,
      generated_at: item.generated_at || item.generatedAt || now,
      generated_by_model: item.generated_by_model || item.generatedByModel || "manual-quality-repair",
      pdf_drive_url: item.pdf_drive_url ?? item.pdfDriveUrl ?? null,
      pdf_local_path: item.pdf_local_path ?? item.pdfLocalPath ?? null,
      jargon_check_status: item.jargon_check_status || item.jargonCheckStatus || "clean",
      jargon_check_findings: item.jargon_check_findings || item.jargonCheckFindings || [],
    });
  }
  if (rows.length === 0) return { ok: true, writtenCount: 0, written: [] };
  const written = await requestJson(rest("monthly_reports_external", "on_conflict=project_id,ym&select=*"), {
    method: "POST",
    headers: restHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: rows,
  });
  return { ok: true, writtenCount: written?.length || 0, written };
}

const PROJECT_PATCH_ALLOWLIST = new Set([
  "report_emails",
  "slack_channel_id",
  "drive_folder_id",
  "start_ym",
  "end_ym",
  "fee_type",
  "fee_amount",
  "status",
]);

async function updateProjectPatches(items) {
  const written = [];
  for (const item of items) {
    const projectId = item.project_id || item.projectId;
    const patch = item.patch || item.proposed_patch_json || item.proposedPatch || {};
    if (!projectId) throw new Error(`projectPatches missing project_id: ${JSON.stringify(item)}`);
    const body = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!PROJECT_PATCH_ALLOWLIST.has(key)) {
        throw new Error(`projectPatches field not allowlisted: ${key}`);
      }
      body[key] = value;
    }
    if (!Object.keys(body).length) throw new Error(`projectPatches empty patch: ${JSON.stringify(item)}`);
    const updated = await requestJson(rest("projects", `project_id=eq.${enc(projectId)}&select=project_id,project_name,report_emails,slack_channel_id,drive_folder_id,start_ym,end_ym,fee_type,fee_amount,status`), {
      method: "PATCH",
      headers: restHeaders({ prefer: "return=representation" }),
      body,
    });
    written.push({ action: "updated", project_id: projectId, row: updated?.[0] || null });
  }
  return { ok: true, writtenCount: written.length, written };
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || "help";
  let result;
  if (cmd === "health") {
    result = await health({ includeGas: args["no-gas"] !== true });
  } else if (cmd === "snapshot-health") {
    result = inspectSnapshotFile(args.file || DEFAULT_OS_SNAPSHOT, {
      maxAgeHours: positiveNumber(args["max-age-hours"], DEFAULT_MAX_SNAPSHOT_AGE_HOURS),
    });
  } else if (cmd === "targets") {
    result = await targets({ ym: args.ym || yyyymm(), includePast: args["no-past"] !== true });
  } else if (cmd === "snapshot") {
    result = await snapshot({ projectId: args.project, ym: args.ym });
  } else if (cmd === "export-os-snapshot") {
    result = await exportOsSnapshot({ ym: args.ym || yyyymm(), out: args.out || DEFAULT_OS_SNAPSHOT });
  } else if (cmd === "refresh-snapshot") {
    result = await refreshSnapshot({
      ym: args.ym || yyyymm(),
      out: args.out || DEFAULT_OS_SNAPSHOT,
      includeGasHealth: args["include-gas-health"] === true,
    });
  } else if (cmd === "local-targets") {
    result = localTargets({ file: args.file || DEFAULT_OS_SNAPSHOT, ym: args.ym || yyyymm(), includePast: args["no-past"] !== true });
  } else if (cmd === "local-snapshot") {
    result = localSnapshot({ file: args.file || DEFAULT_OS_SNAPSHOT, projectId: args.project, ym: args.ym });
  } else if (cmd === "upsert-review") {
    result = await upsertReview(args.file);
  } else if (cmd === "register-emails") {
    result = await registerEmails({
      projectId: args.project,
      emails: splitEmails(args.emails),
      syncGas: args["no-gas"] !== true,
    });
  } else if (cmd === "collect-gmail") {
    result = await collectGmail({
      projectId: args.project,
      ym: args.ym,
      registerFoundEmails: args["register-found-emails"] === true,
    });
  } else if (cmd === "collect-slack") {
    result = await collectSlack({
      projectId: args.project,
      ym: args.ym,
      maxMessages: Number(args["max-messages"] || 120),
      includeBots: args["include-bots"] === true,
    });
  } else if (cmd === "notify") {
    result = await notify(args.file);
  } else if (cmd === "upsert-source-cache") {
    result = await upsertSourceCache(readJson(args.file).sourceCache || readJson(args.file).items || []);
  } else if (cmd === "upsert-monthly-reports") {
    result = await upsertMonthlyReports(readJson(args.file).monthlyReports || readJson(args.file).items || []);
  } else if (cmd === "upsert-monthly-reports-external") {
    result = await upsertMonthlyReportsExternal(readJson(args.file).monthlyReportsExternal || readJson(args.file).items || []);
  } else if (cmd === "validate-monthly-report") {
    const items = args.file
      ? readJson(args.file).monthlyReports || readJson(args.file).items || []
      : [{ project_id: args.project, ym: args.ym, final_content: args.content }];
    const results = items.map((item) => {
      const content = item.final_content || item.finalContent || item.draft_content || item.draftContent || item.content || "";
      const v = validateMonthlyReportContent(content);
      return { project_id: item.project_id || item.projectId, ym: item.ym, ok: v.ok, errors: v.errors };
    });
    result = {
      ok: results.every((item) => item.ok),
      results,
    };
  } else if (cmd === "validate-monthly-report-external") {
    const items = readJson(args.file).monthlyReportsExternal || readJson(args.file).items || [];
    const results = items.map((item) => {
      const content = item.body_md || item.bodyMd || item.content || "";
      const v = validateExternalMonthlyReportContent(content);
      return { project_id: item.project_id || item.projectId, ym: item.ym, ok: v.ok, errors: v.errors };
    });
    result = {
      ok: results.length > 0 && results.every((item) => item.ok),
      results,
    };
  } else if (cmd === "upsert-textbook-insights") {
    result = await upsertTextbookInsights(readJson(args.file).textbookInsights || readJson(args.file).items || []);
  } else if (cmd === "update-projects") {
    result = await updateProjectPatches(readJson(args.file).projectPatches || readJson(args.file).items || []);
  } else if (cmd === "apply-outbox") {
    result = await applyOutbox(args.file);
  } else if (cmd === "apply-outbox-dir") {
    result = await applyOutboxDir({ dir: args.dir || DEFAULT_OUTBOX_DIR });
  } else if (cmd === "automation-prepare") {
    result = await automationPrepare({
      ym: args.ym || yyyymm(),
      out: args.out || DEFAULT_OS_SNAPSHOT,
      includeGasHealth: args["include-gas-health"] === true,
    });
  } else {
    result = {
      ok: true,
      usage: [
        "node pwa/scripts/ms_progress_review_tool.mjs health",
        "node pwa/scripts/ms_progress_review_tool.mjs health --no-gas",
        "node pwa/scripts/ms_progress_review_tool.mjs snapshot-health --file /tmp/os-snapshot.json --max-age-hours 48",
        "node pwa/scripts/ms_progress_review_tool.mjs export-os-snapshot --ym 202605",
        "node pwa/scripts/ms_progress_review_tool.mjs local-targets --ym 202605",
        "node pwa/scripts/ms_progress_review_tool.mjs local-snapshot --project p25 --ym 202605",
        "node pwa/scripts/ms_progress_review_tool.mjs targets --ym 202605",
        "node pwa/scripts/ms_progress_review_tool.mjs snapshot --project p21 --ym 202601",
        "node pwa/scripts/ms_progress_review_tool.mjs register-emails --project p25 --emails kenkyu2_suishin@sc.kogakuin.ac.jp,sangaku@sc.kogakuin.ac.jp",
        "node pwa/scripts/ms_progress_review_tool.mjs collect-gmail --project p25 --ym 202605 --register-found-emails",
        "node pwa/scripts/ms_progress_review_tool.mjs collect-slack --project p21 --ym 202605",
        "node pwa/scripts/ms_progress_review_tool.mjs refresh-snapshot --ym 202605",
        "node pwa/scripts/ms_progress_review_tool.mjs upsert-review --file /tmp/review.json",
        "node pwa/scripts/ms_progress_review_tool.mjs notify --file /tmp/notification.json",
        "node pwa/scripts/ms_progress_review_tool.mjs upsert-source-cache --file /tmp/source-cache.json",
        "node pwa/scripts/ms_progress_review_tool.mjs upsert-monthly-reports --file /tmp/monthly-reports.json",
        "node pwa/scripts/ms_progress_review_tool.mjs upsert-monthly-reports-external --file /tmp/monthly-reports-external.json",
        "node pwa/scripts/ms_progress_review_tool.mjs validate-monthly-report --file /tmp/monthly-reports.json",
        "node pwa/scripts/ms_progress_review_tool.mjs validate-monthly-report-external --file /tmp/monthly-reports-external.json",
        "node pwa/scripts/ms_progress_review_tool.mjs upsert-textbook-insights --file /tmp/textbook-insights.json",
        "node pwa/scripts/ms_progress_review_tool.mjs update-projects --file /tmp/project-patches.json",
        "node pwa/scripts/ms_progress_review_tool.mjs apply-outbox --file /tmp/amd-os-outbox.json",
        "node pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir",
        "node pwa/scripts/ms_progress_review_tool.mjs automation-prepare --ym 202605",
        "node pwa/scripts/ms_progress_review_tool.mjs automation-prepare --ym 202605 --include-gas-health",
      ],
    };
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, stack: e.stack }, null, 2));
  process.exit(1);
});
