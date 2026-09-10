#!/usr/bin/env node
/**
 * 問いの木の outbox applier。
 *
 * つくよみ（Codex automation `amd-os-l11-question-extract`）が議事録から拾った
 * 問い・やること・分かったことを JSON で outbox へ吐き、このスクリプトが Supabase へ入れる。
 * 抽出側は DB を直接触らない（既存の D-6 経営ハイライトと同じ経路）。
 *
 * 入れるものは必ず review_state='proposed'。木へはつながず、親の候補だけを添える。
 * 人が画面で承認したときに初めて parent_id / つなぎが入る。
 *
 * 使い方:
 *   node scripts/apply_question_tree_outbox.mjs --dir <outboxディレクトリ> [--dry-run]
 *
 * 正本: pwa/spec/3-21-question-tree-current-spec.md
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEFAULT_DIR = path.join(
  process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
  "automations",
  "amd-os-l11-question-extract",
  "outbox",
);

function readEnv() {
  const file = path.join(ROOT, ".env.local");
  const text = fs.readFileSync(file, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
    const at = line.indexOf("=");
    env[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^["']|["']$/g, "");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(".env.local に Supabase の接続情報が無い");
  return { url, key };
}

async function rest(env, method, pathAndQuery, body, extraHeaders = {}) {
  const response = await fetch(`${env.url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathAndQuery} → ${response.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const QUESTION_KINDS = new Set(["open", "decision"]);
const ACTION_KINDS = new Set(["work", "measure"]);
const FINDING_KINDS = new Set(["supports", "contradicts", "neutral", "missing"]);
const CONTRIBUTIONS = new Set(["required", "alternative"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value, max = 2000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function dateValue(value) {
  const raw = text(value, 10);
  return raw && ISO_DATE.test(raw) ? raw : null;
}

/** 抽出側が id を間違えても、他PJの行へぶら下がらないようにする。 */
function pickExistingId(candidate, existingIds) {
  const id = text(candidate, 64);
  return id && existingIds.has(id) ? id : null;
}

async function applyFile(env, file, dryRun) {
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const projectId = text(payload.projectId, 32);
  if (!projectId) throw new Error("projectId が無い");

  const existing = await rest(
    env,
    "GET",
    `project_questions?project_id=eq.${encodeURIComponent(projectId)}&deleted_at=is.null&select=id`,
  );
  const existingIds = new Set(existing.map((row) => row.id));

  const sourceRef = text(payload.sourceRef, 300);
  const summary = { questions: 0, actions: 0, findings: 0, skipped: 0 };

  const rows = { questions: [], actions: [], findings: [] };

  for (const item of Array.isArray(payload.questions) ? payload.questions : []) {
    const title = text(item.title, 400);
    const clientToken = text(item.clientToken, 64);
    if (!title || !clientToken) {
      summary.skipped += 1;
      continue;
    }
    rows.questions.push({
      project_id: projectId,
      client_token: clientToken,
      title,
      background: text(item.background, 8000),
      question_kind: QUESTION_KINDS.has(item.questionKind) ? item.questionKind : "open",
      owner_label: text(item.ownerLabel, 120) || "担当未確認",
      due_date: dateValue(item.dueDate),
      status: "open",
      review_state: "proposed",
      origin_kind: "automation",
      origin_ref: text(item.originRef, 300) || sourceRef,
      proposed_parent_id: pickExistingId(item.proposedParentId, existingIds),
      proposed_contribution: CONTRIBUTIONS.has(item.proposedContribution) ? item.proposedContribution : null,
      proposal_reason: text(item.proposalReason, 1200),
      last_verified_at: new Date().toISOString().slice(0, 10),
    });
  }

  for (const item of Array.isArray(payload.actions) ? payload.actions : []) {
    const title = text(item.title, 400);
    const clientToken = text(item.clientToken, 64);
    if (!title || !clientToken) {
      summary.skipped += 1;
      continue;
    }
    rows.actions.push({
      project_id: projectId,
      client_token: clientToken,
      title,
      detail: text(item.detail, 4000),
      action_kind: ACTION_KINDS.has(item.actionKind) ? item.actionKind : "measure",
      status: "unassessed",
      owner_label: text(item.ownerLabel, 120) || "担当未確認",
      planned_end: dateValue(item.plannedEnd),
      review_state: "proposed",
      origin_kind: "automation",
      origin_ref: text(item.originRef, 300) || sourceRef,
      proposed_question_id: pickExistingId(item.proposedQuestionId, existingIds),
      proposal_reason: text(item.proposalReason, 1200),
      last_verified_at: new Date().toISOString().slice(0, 10),
    });
  }

  for (const item of Array.isArray(payload.findings) ? payload.findings : []) {
    const body = text(item.summary, 4000);
    const clientToken = text(item.clientToken, 64);
    if (!body || !clientToken) {
      summary.skipped += 1;
      continue;
    }
    rows.findings.push({
      project_id: projectId,
      client_token: clientToken,
      summary: body,
      finding_kind: FINDING_KINDS.has(item.findingKind) ? item.findingKind : "neutral",
      observed_on: dateValue(item.observedOn),
      source_label: text(item.sourceLabel, 300) || sourceRef || "出どころ未確認",
      source_url: text(item.sourceUrl, 500),
      review_state: "proposed",
      proposed_question_id: pickExistingId(item.proposedQuestionId, existingIds),
      proposal_reason: text(item.proposalReason, 1200),
      last_verified_at: new Date().toISOString().slice(0, 10),
    });
  }

  if (dryRun) {
    console.log(`[dry-run] ${path.basename(file)} → 問い${rows.questions.length} やること${rows.actions.length} 分かったこと${rows.findings.length} 除外${summary.skipped}`);
    return summary;
  }

  // client_token の partial unique index が二重取り込みを弾く。同じ outbox を
  // 二度流しても増えない（ignore-duplicates で既存行はそのまま）。
  const header = { Prefer: "return=representation,resolution=ignore-duplicates" };
  if (rows.questions.length) {
    const inserted = await rest(env, "POST", "project_questions?on_conflict=project_id,client_token", rows.questions, header);
    summary.questions = inserted?.length ?? 0;
  }
  if (rows.actions.length) {
    const inserted = await rest(env, "POST", "project_actions?on_conflict=project_id,client_token", rows.actions, header);
    summary.actions = inserted?.length ?? 0;
  }
  if (rows.findings.length) {
    const inserted = await rest(env, "POST", "project_findings?on_conflict=project_id,client_token", rows.findings, header);
    summary.findings = inserted?.length ?? 0;
  }
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const dirFlag = args.indexOf("--dir");
  const dir = dirFlag >= 0 ? args[dirFlag + 1] : DEFAULT_DIR;
  const dryRun = args.includes("--dry-run");

  if (!fs.existsSync(dir)) {
    console.log(`outbox が無い: ${dir}`);
    return;
  }
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  if (!files.length) {
    console.log("取り込むファイルなし");
    return;
  }

  const env = readEnv();
  const appliedDir = path.join(dir, "..", "applied");
  const failedDir = path.join(dir, "..", "failed");
  if (!dryRun) {
    fs.mkdirSync(appliedDir, { recursive: true });
    fs.mkdirSync(failedDir, { recursive: true });
  }

  const total = { questions: 0, actions: 0, findings: 0, failed: 0 };
  for (const name of files) {
    const file = path.join(dir, name);
    try {
      const summary = await applyFile(env, file, dryRun);
      total.questions += summary.questions;
      total.actions += summary.actions;
      total.findings += summary.findings;
      if (!dryRun) {
        fs.renameSync(file, path.join(appliedDir, name));
        console.log(`applied ${name} → 問い${summary.questions} やること${summary.actions} 分かったこと${summary.findings}`);
      }
    } catch (error) {
      total.failed += 1;
      console.error(`failed ${name}: ${error instanceof Error ? error.message : error}`);
      if (!dryRun) fs.renameSync(file, path.join(failedDir, name));
    }
  }
  console.log(`合計 問い${total.questions} やること${total.actions} 分かったこと${total.findings} 失敗${total.failed}`);
  if (total.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
