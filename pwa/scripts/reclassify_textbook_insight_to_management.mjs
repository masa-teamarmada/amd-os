#!/usr/bin/env node
/**
 * Reclassify one existing D-7 candidate from BZM routing to management knowledge.
 *
 * This never creates a management_knowledge_entries row. It only changes the
 * candidate and its notification so the administrator can make the actual yes/no
 * decision from a clear card. Run with --apply only after checking the dry run.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
loadEnv(path.join(ROOT, ".env.local"));
loadEnv(path.join(ROOT, ".env.production.local"));
loadEnv(path.join(process.cwd(), "pwa", ".env.local"));

const SUPABASE_URL = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const args = parseArgs(process.argv.slice(2));
const candidateId = String(args["candidate-id"] || "").trim();
const apply = args.apply === true;
const category = String(args.category || "operations").trim();
const maturity = String(args.maturity || "hypothesis").trim();
const tags = String(args.tags || "").split(",").map((value) => value.trim()).filter(Boolean).slice(0, 32);
const reusableWhen = String(args["reusable-when"] || "").trim().slice(0, 2000);
const nextCheck = String(args["next-check"] || "").trim().slice(0, 2000);

if (!candidateId) throw new Error("--candidate-id is required");
if (!reusableWhen) throw new Error("--reusable-when is required so the notification can explain when to reuse it");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function requiredEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value.trim();
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith("--")) continue;
    const key = raw.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

async function request(pathname, { method = "GET", body } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = json?.message || json?.hint || json?.details || "unknown database error";
    throw new Error(`${method} ${pathname} failed (${response.status}): ${detail}`);
  }
  return json;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function main() {
  const candidates = await request(`textbook_insight_candidates?candidate_id=eq.${encodeURIComponent(candidateId)}&select=candidate_id,target_id,scope_key,title,metadata_json,status`);
  if (!Array.isArray(candidates) || candidates.length !== 1) throw new Error("candidate not found or ambiguous");
  const candidate = candidates[0];
  if (candidate.status !== "candidate") throw new Error("candidate is no longer awaiting a decision");
  const metadata = objectValue(candidate.metadata_json);
  const nextMetadata = {
    ...metadata,
    destination_kind: "management_knowledge",
    management_category: category,
    management_maturity: maturity,
    management_tags: tags,
    management_tags_text: tags.join("、"),
    management_reusable_when: reusableWhen,
    management_next_check: nextCheck,
    management_confidence: Number.isFinite(Number(metadata.management_confidence)) ? Number(metadata.management_confidence) : 0.5,
    bzm_review_required: false,
    bzm_review_status: "not_required",
    theory_change_scope: "none",
  };
  const notifications = await request(`l2_notifications?l2_kind=eq.textbook_insight&target_id=eq.${encodeURIComponent(candidate.target_id)}&scope_key=eq.${encodeURIComponent(candidate.scope_key)}&select=notification_id,metadata_json`);
  const plan = {
    mode: apply ? "apply" : "dry_run",
    candidate_count: 1,
    notification_count: Array.isArray(notifications) ? notifications.length : 0,
    destination: "management_knowledge",
    canonical_entry_created: false,
  };
  if (!apply) {
    console.log(JSON.stringify(plan));
    return;
  }

  const updatedCandidates = await request(`textbook_insight_candidates?candidate_id=eq.${encodeURIComponent(candidateId)}`, {
    method: "PATCH",
    body: {
      target_bzm_slug: null,
      proposed_section: null,
      metadata_json: nextMetadata,
      bzm_review_required: false,
      bzm_review_status: "not_required",
      theory_change_scope: "none",
      updated_at: new Date().toISOString(),
    },
  });
  let updatedNotifications = 0;
  for (const notification of notifications || []) {
    await request(`l2_notifications?notification_id=eq.${encodeURIComponent(notification.notification_id)}`, {
      method: "PATCH",
      body: {
        title: `💡 経営ノウハウ追加候補: ${candidate.title}`,
        metadata_json: {
          ...objectValue(notification.metadata_json),
          candidate_id: candidate.candidate_id,
          destination_kind: "management_knowledge",
          management_category: category,
          management_maturity: maturity,
          management_tags: tags,
          management_tags_text: tags.join("、"),
          management_reusable_when: reusableWhen,
          management_next_check: nextCheck,
          management_confidence: nextMetadata.management_confidence,
          target_bzm_slug: null,
          bzm_review_required: false,
          bzm_review_status: "not_required",
          theory_change_scope: "none",
        },
      },
    });
    updatedNotifications += 1;
  }
  console.log(JSON.stringify({
    ...plan,
    candidate_updated: Array.isArray(updatedCandidates) && updatedCandidates.length === 1,
    notifications_updated: updatedNotifications,
    canonical_entry_created: false,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
