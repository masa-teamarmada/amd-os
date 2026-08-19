#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACT,
  CURRENT_SPS_TUPLE,
  expectedSps,
  privacyErrors,
  sanitizeEvidenceText,
  semanticFingerprint,
  structuredSourceEvidence,
  validateReassessmentPayload,
} from "./sps_reassessment_tool.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.join(HERE, "migrations", "292_sps_reassessment_review_flow.sql");
const LOCK_MIGRATION = path.join(HERE, "migrations", "294_sps_reassessment_seed_lock_order.sql");
const CANDIDATE_LOCK_MIGRATION = path.join(HERE, "migrations", "295_sps_reassessment_candidate_seed_lock.sql");
const TOOL = path.join(HERE, "sps_reassessment_tool.mjs");
const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";
const SEED = "33333333-3333-4333-8333-333333333333";
const BASE = "44444444-4444-4444-8444-444444444444";

function event(id, { table = "project_pl_monthly", eligible = true, strength = eligible ? "hard" : "soft" } = {}) {
  return {
    event_id: id,
    source_table: table,
    source_row_identity: id,
    project_id: "p01",
    seed_id: SEED,
    operation: "update",
    event_at: "2026-08-19T01:00:00.000Z",
    source_at: "2026-08-18T15:00:00.000Z",
    payload_hash: "a".repeat(64),
    source_hash: id === EVENT_A ? "b".repeat(64) : "c".repeat(64),
    evidence: {
      source_table: table,
      evidence_strength: strength,
      proposal_eligible: eligible,
      actual_forecast_status: table === "project_pl_monthly" ? (eligible ? "actual" : "unspecified") : undefined,
    },
  };
}

function prepared(events = [event(EVENT_A)], { withBase = true } = {}) {
  return {
    version: 1,
    contract: CONTRACT,
    generated_at: "2026-08-19T02:00:00.000Z",
    prompt: { hash: "d".repeat(64) },
    model: { ...CURRENT_SPS_TUPLE, hash: "e".repeat(64) },
    groups: [{
      seed_id: SEED,
      base_assessment: withBase ? {
        id: BASE,
        seed_id: SEED,
        model_version: CURRENT_SPS_TUPLE.model_version,
        measure_version: CURRENT_SPS_TUPLE.measure_version,
        q_model_version: CURRENT_SPS_TUPLE.q_model_version,
        q_ruleset_version: CURRENT_SPS_TUPLE.q_ruleset_version,
        p_model_version: CURRENT_SPS_TUPLE.p_model_version,
        ruleset_version: CURRENT_SPS_TUPLE.assessment_ruleset_version,
        q_lower_pct: 20,
        q_upper_pct: 40,
        p_lower_yen: 1_000_000,
        p_upper_yen: 2_000_000,
        sps_lower_yen: 200_000,
        sps_upper_yen: 800_000,
        frozen: true,
        source_hash: "f".repeat(64),
      } : null,
      events,
    }],
  };
}

function proposal(sourceEventIds = [EVENT_A], overrides = {}) {
  return {
    proposal_id: "proposal-1",
    seed_id: SEED,
    source_event_ids: sourceEventIds,
    semantic_key: "検収済み成果の達成",
    base_assessment_id: BASE,
    ...CURRENT_SPS_TUPLE,
    impact_classification: "q",
    evidence_strength: "hard",
    information_cutoff: "2026-08-19T01:30:00.000Z",
    confidence: 0.9,
    q_lower_pct: 30,
    q_upper_pct: 50,
    q_main_factor: "verified_delivery",
    p_class: "industrial_value_verified",
    p_lower_yen: 1_000_000,
    p_upper_yen: 2_000_000,
    sps_lower_yen: 300_000,
    sps_upper_yen: 1_000_000,
    summary: "検収済み成果に基づく再評価候補",
    ...overrides,
  };
}

function review(preparedPayload, proposals = [proposal()], disposition = "propose") {
  const allEvents = preparedPayload.groups.flatMap((group) => group.events);
  return {
    version: 1,
    contract: CONTRACT,
    prompt_hash: preparedPayload.prompt.hash,
    dispositions: allEvents.map((item) => ({
      event_id: item.event_id,
      source_hash: item.source_hash,
      disposition,
      reason: disposition === "propose" ? "構造化された実績根拠がある" : "根拠が不足している",
    })),
    proposals: disposition === "propose" ? proposals : [],
  };
}

const validPrepared = prepared();
const validReview = review(validPrepared);
assert.deepEqual(validateReassessmentPayload(validReview, validPrepared), [], "valid current tuple proposal must pass");
const zeroCandidateReview = review(validPrepared, [], "needs_source");
assert.deepEqual(validateReassessmentPayload(zeroCandidateReview, validPrepared), [], "zero candidates must be a normal valid result");

const oldTupleReview = structuredClone(validReview);
oldTupleReview.proposals[0].model_version = "sps-eq-v0";
assert(validateReassessmentPayload(oldTupleReview, validPrepared).some((error) => error.includes("model_version")), "old model fallback must fail");

const unassessedPrepared = prepared([event(EVENT_A)], { withBase: false });
assert(validateReassessmentPayload(review(unassessedPrepared), unassessedPrepared).some((error) => error.includes("without a latest exact current base")), "unassessed seed must not fall back");

const badMathReview = structuredClone(validReview);
badMathReview.proposals[0].sps_upper_yen += 1;
assert(validateReassessmentPayload(badMathReview, validPrepared).some((error) => error.includes("SPS math")), "SPS arithmetic mismatch must fail");
assert.equal(expectedSps(2_000_000, 50), 1_000_000, "SPS rounding contract must be P*q/100");

const mismatchedImpactReview = structuredClone(validReview);
mismatchedImpactReview.proposals[0].impact_classification = "p_ind";
assert(validateReassessmentPayload(mismatchedImpactReview, validPrepared).some((error) => error.includes("does not match")), "impact must match actual q/P changes");
const unchangedBandReview = review(validPrepared, [proposal([EVENT_A], {
  impact_classification: "q",
  q_lower_pct: 20,
  q_upper_pct: 40,
  sps_lower_yen: 200_000,
  sps_upper_yen: 800_000,
})]);
assert(validateReassessmentPayload(unchangedBandReview, validPrepared).some((error) => error.includes("does not match")), "unchanged q/P bands must not create a candidate");

const privacyReview = structuredClone(validReview);
privacyReview.proposals[0].summary = "詳細は https://example.com と person@example.com";
const privacyResult = validateReassessmentPayload(privacyReview, validPrepared);
assert(privacyResult.some((error) => error.includes("URL")), "URL must be rejected");
assert(privacyResult.some((error) => error.includes("email")), "email must be rejected");
assert(privacyErrors({ text: "API key: abc" }).length > 0, "secret-like text must be rejected");

const softMeetingPrepared = prepared([event(EVENT_A, { table: "project_meeting_summaries", eligible: false })]);
assert(validateReassessmentPayload(review(softMeetingPrepared), softMeetingPrepared).some((error) => error.includes("no reviewable structured evidence")), "unstructured meeting evidence must not propose");

const plOnlyPrepared = prepared([event(EVENT_A, { table: "project_pl_monthly", eligible: false })]);
assert(validateReassessmentPayload(review(plOnlyPrepared), plOnlyPrepared).some((error) => error.includes("no reviewable structured evidence")), "PL without actual/forecast must not propose");

const heldMeeting = structuredSourceEvidence(
  { source_table: "project_meeting_summaries", operation: "update", source_at: "2026-08-18T00:00:00Z" },
  {
    meeting_date: "2026-08-18",
    meeting_start_at: "2026-08-18T01:00:00Z",
    summary_short: "成果の確認 https://example.com person@example.com",
    decided: ["検収条件を合意"],
    progress: ["成果物を提出"],
    source_hash: "a".repeat(64),
    source_kinds: "Calendar,Notion",
  },
  new Date("2026-08-19T00:00:00Z"),
);
assert.equal(heldMeeting.proposal_eligible, true, "held meeting with structured progress must be reviewable");
assert.equal(heldMeeting.evidence_strength, "soft");
assert(!heldMeeting.summary.includes("https://") && !heldMeeting.summary.includes("@example.com"), "prepared meeting evidence must be sanitized");

const softReviewablePrepared = prepared([event(EVENT_A, { table: "project_meeting_summaries", eligible: true, strength: "soft" })]);
const softReviewable = review(softReviewablePrepared, [proposal([EVENT_A], { evidence_strength: "soft" })]);
assert.deepEqual(validateReassessmentPayload(softReviewable, softReviewablePrepared), [], "reviewable soft evidence may create a human-review candidate");
const overstatedReview = review(softReviewablePrepared, [proposal([EVENT_A], { evidence_strength: "hard" })]);
assert(validateReassessmentPayload(overstatedReview, softReviewablePrepared).some((error) => error.includes("overstates")), "candidate must not overstate evidence strength");
assert.equal(sanitizeEvidenceText("secret token abc", 100), "[認証情報省略]", "secret-like evidence must be redacted");

const verifiedPartner = structuredSourceEvidence(
  { source_table: "project_management_partners", operation: "update", source_at: "2026-08-18T00:00:00Z" },
  {
    relationship_stage: "executing",
    agreement_state: "agreed",
    activity_state: "active",
    last_verified_at: "2026-08-18",
    confidence: "high",
    deleted_at: null,
  },
  new Date("2026-08-19T00:00:00Z"),
);
assert.equal(verifiedPartner.proposal_eligible, true, "verified material partner state must be reviewable");
assert.equal(verifiedPartner.evidence_strength, "mixed");

const unagreedPartner = structuredSourceEvidence(
  { source_table: "project_management_partners", operation: "update", source_at: "2026-08-18T00:00:00Z" },
  {
    relationship_stage: "candidate",
    agreement_state: "unagreed",
    activity_state: "active",
    last_verified_at: "2026-08-18",
    confidence: "high",
    deleted_at: null,
  },
  new Date("2026-08-19T00:00:00Z"),
);
assert.equal(unagreedPartner.proposal_eligible, false, "unagreed/active partner must not be treated as agreed or executing");

const verifiedInteraction = structuredSourceEvidence(
  { source_table: "project_management_partner_interactions", operation: "insert", source_at: "2026-08-18T00:00:00Z" },
  {
    interaction_kind: "deliverable",
    occurred_on: "2026-08-18",
    occurred_on_precision: "day",
    summary: "成果物を確認",
    outcome_summary: "検収済み",
    confidence: "verified",
    deleted_at: null,
  },
  new Date("2026-08-19T00:00:00Z"),
);
assert.equal(verifiedInteraction.proposal_eligible, true, "verified past agreement/deliverable interaction must be reviewable");
assert.equal(verifiedInteraction.evidence_strength, "mixed");

assert.equal(
  semanticFingerprint(SEED, " 検収済み・成果の達成 "),
  semanticFingerprint(SEED, "検収済み 成果の達成"),
  "semantic fingerprint must ignore source-format punctuation",
);
const duplicatePrepared = prepared([event(EVENT_A), event(EVENT_B, { table: "project_management_partners" })]);
const duplicateReview = review(duplicatePrepared, [
  proposal([EVENT_A], { semantic_key: "検収済み 成果の達成" }),
  proposal([EVENT_B], { proposal_id: "proposal-2", semantic_key: "検収済み・成果の達成" }),
]);
assert(validateReassessmentPayload(duplicateReview, duplicatePrepared).some((error) => error.includes("semantic fingerprint")), "cross-source semantic duplicate must fail");

const sql = fs.readFileSync(MIGRATION, "utf8");
const lockSql = fs.readFileSync(LOCK_MIGRATION, "utf8");
const candidateLockSql = fs.readFileSync(CANDIDATE_LOCK_MIGRATION, "utf8");
const tool = fs.readFileSync(TOOL, "utf8");
for (const table of [
  "project_pl_monthly",
  "project_meeting_summaries",
  "project_management_partners",
  "project_management_partner_interactions",
  "seed_contact_log",
]) {
  assert.match(sql, new RegExp(`AFTER INSERT OR UPDATE OR DELETE ON public\\.${table}`), `${table} trigger missing`);
}
assert.match(sql, /to_jsonb\(NEW\) - 'updated_at'[\s\S]*IS NOT DISTINCT FROM[\s\S]*to_jsonb\(OLD\) - 'updated_at'/, "updated_at-only no-op guard missing");
assert.match(sql, /SET status = 'superseded'[\s\S]*status = 'pending'/, "older pending events must be superseded before inserting the latest state");
assert.match(sql, /v_latest_operation = lower\(TG_OP\)[\s\S]*v_latest_hash = v_hash/, "only consecutive identical states may be deduped");
assert.doesNotMatch(sql, /UNIQUE \(source_table, source_row_identity, operation, payload_hash\)/, "historical A-B-A state must not be permanently deduped");
assert.match(sql, /apply_sps_reassessment_candidate\([\s\S]*p_candidate_id uuid,[\s\S]*p_actor text/, "apply RPC signature missing");
assert.match(sql, /reject_sps_reassessment_candidate\([\s\S]*p_candidate_id uuid,[\s\S]*p_actor text,[\s\S]*p_reason text/, "reject RPC signature missing");
assert.match(sql, /FOR UPDATE/, "candidate row lock missing");
assert.match(sql, /candidate base assessment is stale/, "latest-base CAS guard missing");
assert.match(sql, /model_version = v_model\.model_version[\s\S]*q_model_version = v_model\.q_model_version[\s\S]*q_ruleset_version = v_model\.q_ruleset_version[\s\S]*p_model_version = v_model\.p_model_version/, "base lookup must require the full current tuple");
assert.match(sql, /sps-current-tuple-backfill/, "append-only current tuple backfill missing");
assert.match(sql, /impact_classification does not match q\/P changes from base/, "DB impact/base invariant missing");
assert.match(sql, /WHERE status IN \('pending', 'applied'\)/, "semantic dedupe must only block active/adopted candidates");
assert.match(sql, /status = 'superseded'[\s\S]*rejected_by = 'source-update'/, "new source events must supersede stale pending candidates");
assert.match(sql, /attention_state = 'suppressed'[\s\S]*requires_masa_decision = false/, "stale candidate notifications must leave the decision queue");
assert.match(tool, /\.in\("status", \["pending", "applied"\]\)/, "duplicate lookup must ignore replaceable rejected/superseded candidates");
assert.match(sql, /BEFORE INSERT ON public\.sps_reassessment_source_events[\s\S]*lock_sps_reassessment_source_seed/, "source event must take the seed lock before insert");
assert.match(lockSql, /SELECT candidate\.seed_id INTO v_seed_id[\s\S]*pg_advisory_xact_lock[\s\S]*apply_sps_reassessment_candidate_locked_body/, "public apply RPC must take the seed lock before entering the row-locking body");
assert.match(lockSql, /REVOKE ALL ON FUNCTION public\.apply_sps_reassessment_candidate_locked_body\(uuid, text\)/, "row-locking apply body must not be externally executable");
assert.match(candidateLockSql, /sps_reassessment_candidate_00_seed_lock[\s\S]*BEFORE INSERT ON public\.sps_reassessment_candidates/, "candidate insert must take the seed lock before validation");
assert.match(sql, /INSERT INTO public\.seed_screening_bands[\s\S]*true,[\s\S]*reviewed SPS reassessment candidate/, "frozen append missing");
assert.doesNotMatch(sql, /UPDATE public\.seed_screening_bands/, "frozen history must never be updated");
assert.match(sql, /'applied', true,[\s\S]*'assessment_id'/, "apply RPC result contract missing");
assert.match(sql, /'applied', false,[\s\S]*'rejected', true/, "reject RPC result contract missing");
assert.match(sql, /evidence_strength IN \('soft', 'mixed', 'hard'\)/, "candidate evidence-strength review levels missing");
for (const key of [
  "current_sps",
  "proposed_sps",
  "current_q",
  "proposed_q",
  "current_p_ind",
  "proposed_p_ind",
  "impact_classification",
  "evidence_strength",
  "information_cutoff",
  "confidence",
]) assert.match(sql, new RegExp(`'${key}'`), `notification metadata ${key} missing`);

const eventDefinition = sql.slice(
  sql.indexOf("CREATE TABLE public.sps_reassessment_source_events"),
  sql.indexOf("ALTER TABLE public.seed_screening_bands"),
);
for (const forbidden of ["raw_text", "body", "url", "email", "secret", "note", "title"]) {
  assert(!new RegExp(`\\b${forbidden}\\b`, "i").test(eventDefinition), `source event table must not persist ${forbidden}`);
}
assert.match(sql, /'sps\.reassessment\.candidate\.v1'/, "DB prompt seed missing");
assert.doesNotMatch(tool, /あなたはAMD OSのSPS再評価候補分類器/, "prompt body must not be hardcoded in tool");
assert.doesNotMatch(tool, /Anthropic|GoogleGenerativeAI|OpenAI/, "provider API client must not appear in tool");

console.log("SPS reassessment flow tests passed");
