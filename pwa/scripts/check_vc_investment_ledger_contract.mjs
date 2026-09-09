#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireIncludes(relativePath, needles) {
  const source = read(relativePath);
  const missing = needles.filter((needle) => !source.includes(needle));
  if (missing.length > 0) {
    throw new Error(`${relativePath}: missing ${missing.join(", ")}`);
  }
}

requireIncludes("src/components/vc/VcInvestmentLedger.tsx", [
  "VC個別出資額",
  "ラウンド総額",
  "収集候補",
  "既存・要確認",
  "amount_disclosure",
  "total_amount_disclosure",
  "出資・完了日",
  "公表日",
]);
requireIncludes("src/components/vc/VcSectionNav.tsx", [
  "VC一覧",
  "投資履歴",
  "ニュース受信箱",
]);
requireIncludes("src/app/api/admin/collect-vc-investment-history/route.ts", [
  'const PROMPT_KEY = "vc.investment_history.collect.v1"',
  "LIGHTWEIGHT_MODELS",
  'verification_status: "candidate"',
  '.neq("status", "not_contacted")',
  "googleSearch",
  "validateEvidenceSource",
  "assertPublicUrl",
  "sourceMentionsDate",
  "sourceMentionsAmount",
  "evidence note does not state an investment transaction",
]);
requireIncludes("scripts/migrations/378_vc_investment_ledger.sql", [
  "startup_companies",
  "startup_funding_rounds",
  "investor_amount_low",
  "vc.investment_history.collect.v1",
  "claude-haiku-4-5-20251001",
]);
requireIncludes("scripts/migrations/379_vc_investment_collector_gemini_flash_lite.sql", [
  "gemini-3.5-flash-lite",
  "llm_prompt_revisions",
]);
requireIncludes("scripts/migrations/380_vc_investment_evidence_gate.sql", [
  "根拠品質ルール",
  "verification_status = 'dismissed'",
]);
requireIncludes("scripts/migrations/383_vc_investment_candidate_fact_sanitization.sql", [
  "根拠本文に日付・金額が無いものを未確認へ戻す",
]);

console.log("vc investment ledger contract: ok");
