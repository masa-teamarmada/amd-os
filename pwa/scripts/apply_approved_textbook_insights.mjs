#!/usr/bin/env node
/**
 * Local applier for D-7 Textbook Insights.
 *
 * This script is intentionally local-only: it reads approved candidates from
 * Supabase and appends them to git-managed pwa/bzm/*.md files. Vercel runtime
 * never edits repository files or commits.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
loadEnv(path.join(ROOT, ".env.local"));
loadEnv(path.join(ROOT, ".env.production.local"));
loadEnv(path.join(process.cwd(), ".env.local"));
loadEnv(path.join(process.cwd(), "pwa", ".env.local"));

const SUPABASE_URL = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const BZM_DIR = path.join(ROOT, "bzm");
const APPLIER = process.env.TEXTBOOK_INSIGHT_APPLIER || "local_textbook_applier";
const VALID_CONFIDENTIALITY = new Set(["internal_only", "sanitized", "publishable"]);
const VALID_BZM_REVIEW_STATUS = new Set(["not_required", "pending", "approved", "changes_requested", "rejected"]);

const args = parseArgs(process.argv.slice(2));
const limit = Math.min(50, Math.max(1, Number(args.limit || 20)));
const apply = args.apply === true;
const targetSlug = typeof args.slug === "string" ? args.slug : "";

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
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const key = raw.slice(2);
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

async function request(pathname, { method = "GET", body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${pathname} failed (${res.status}): ${text}`);
  return json;
}

function slugToFile(slug) {
  const clean = String(slug || "").trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(clean)) {
    throw new Error(`unsafe target_bzm_slug: ${slug}`);
  }
  const file = path.join(BZM_DIR, `${clean}.md`);
  if (!fs.existsSync(file)) throw new Error(`BZM chapter not found: ${file}`);
  return file;
}

function evidenceMarkdown(refs) {
  const list = Array.isArray(refs) ? refs : [];
  if (list.length === 0) return "";
  const lines = list.slice(0, 8).map((entry) => {
    const ref = entry && typeof entry === "object" ? entry : {};
    const bits = [
      ref.table || ref.source || ref.kind || "source",
      ref.row_id || ref.ref_id || ref.id || "",
      ref.date || ref.item_date || "",
      ref.title || "",
      ref.snippet || ref.summary || "",
      ref.confidentiality ? `confidentiality=${ref.confidentiality}` : "",
      ref.hash ? `hash=${String(ref.hash).slice(0, 12)}` : "",
    ].filter(Boolean);
    return `- ${bits.join(" / ")}`;
  });
  return ["", "### 根拠", "", ...lines].join("\n");
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizedCandidateMeta(candidate) {
  const metadata = objectValue(candidate.metadata_json);
  const confidentiality = VALID_CONFIDENTIALITY.has(candidate.confidentiality)
    ? candidate.confidentiality
    : VALID_CONFIDENTIALITY.has(metadata.confidentiality)
      ? metadata.confidentiality
      : "internal_only";
  const theoryChangeScope = String(candidate.theory_change_scope || metadata.theory_change_scope || "none").trim() || "none";
  const hasTheoryCaseReview =
    String(metadata.practice_kind || "") === "theory_case"
    && ["edge_case", "update_candidate"].includes(String(metadata.theory_case_kind || ""));
  const bzmReviewRequired = Boolean(candidate.bzm_review_required ?? metadata.bzm_review_required)
    || theoryChangeScope !== "none"
    || hasTheoryCaseReview;
  const bzmReviewStatusRaw = String(candidate.bzm_review_status || metadata.bzm_review_status || "").trim();
  const bzmReviewStatus = VALID_BZM_REVIEW_STATUS.has(bzmReviewStatusRaw)
    ? bzmReviewStatusRaw
    : bzmReviewRequired
      ? "pending"
      : "not_required";
  return {
    metadata,
    practiceKind: String(metadata.practice_kind || "unknown"),
    confidentiality,
    bzmReviewRequired,
    bzmReviewStatus,
    theoryChangeScope,
  };
}

function candidateGate(candidate) {
  const meta = normalizedCandidateMeta(candidate);
  if (meta.confidentiality === "internal_only") {
    return { ok: false, reason: "confidentiality internal_only; BZM file append requires sanitized or publishable", meta };
  }
  if (meta.bzmReviewRequired && meta.bzmReviewStatus !== "approved") {
    return { ok: false, reason: `BZM review required but status is ${meta.bzmReviewStatus}`, meta };
  }
  if (meta.theoryChangeScope !== "none" && meta.bzmReviewStatus !== "approved") {
    return { ok: false, reason: `theory_change_scope=${meta.theoryChangeScope} requires BZM review approved`, meta };
  }
  return { ok: true, reason: null, meta };
}

function candidateBlock(candidate) {
  const marker = `<!-- textbook-insight:${candidate.candidate_id} -->`;
  const gate = normalizedCandidateMeta(candidate);
  return [
    "",
    marker,
    `## ${candidate.proposed_section || "Textbook Insight"}: ${candidate.title}`,
    "",
    [
      `> D-7 Textbook Insights`,
      `practice_kind=${gate.practiceKind}`,
      `insight_type=${candidate.insight_type}`,
      `priority=${candidate.priority}`,
      `confidentiality=${gate.confidentiality}`,
      `bzm_review_status=${gate.bzmReviewStatus}`,
      `theory_change_scope=${gate.theoryChangeScope}`,
    ].join(" / "),
    "",
    String(candidate.body_md || "").trim(),
    evidenceMarkdown(candidate.evidence_refs),
    `<!-- /textbook-insight:${candidate.candidate_id} -->`,
    "",
  ].join("\n");
}

function appendCandidate(candidate) {
  const file = slugToFile(candidate.target_bzm_slug);
  const current = fs.readFileSync(file, "utf8");
  if (current.includes(`textbook-insight:${candidate.candidate_id}`)) {
    return { file, changed: false, reason: "already present" };
  }
  fs.writeFileSync(file, `${current.trimEnd()}\n${candidateBlock(candidate)}`, "utf8");
  return { file, changed: true };
}

function currentCommit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: path.dirname(ROOT), encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const filters = [
    "status=eq.approved",
    "order=priority.asc,created_at.asc",
    `limit=${limit}`,
    "select=*",
  ];
  if (targetSlug) filters.unshift(`target_bzm_slug=eq.${encodeURIComponent(targetSlug)}`);
  const candidates = await request(`textbook_insight_candidates?${filters.join("&")}`);
  const results = [];
  for (const candidate of candidates || []) {
    const gate = candidateGate(candidate);
    if (!gate.ok) {
      results.push({
        candidate_id: candidate.candidate_id,
        title: candidate.title,
        target_bzm_slug: candidate.target_bzm_slug,
        skipped: true,
        reason: gate.reason,
        gate: gate.meta,
      });
      continue;
    }
    const destination = slugToFile(candidate.target_bzm_slug);
    if (!apply) {
      results.push({
        candidate_id: candidate.candidate_id,
        title: candidate.title,
        target_bzm_slug: candidate.target_bzm_slug,
        file: destination,
        dryRun: true,
        gate: gate.meta,
      });
      continue;
    }
    const written = appendCandidate(candidate);
    if (written.changed) {
      await request(`textbook_insight_candidates?candidate_id=eq.${encodeURIComponent(candidate.candidate_id)}&select=*`, {
        method: "PATCH",
        body: {
          status: "applied",
          applied_file: path.relative(ROOT, written.file),
          applied_commit: process.env.APPLIED_COMMIT || currentCommit(),
          applied_by: APPLIER,
          applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }
    results.push({
      candidate_id: candidate.candidate_id,
      title: candidate.title,
      target_bzm_slug: candidate.target_bzm_slug,
      file: written.file,
      changed: written.changed,
      reason: written.reason || null,
    });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, apply, count: results.length, results }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
