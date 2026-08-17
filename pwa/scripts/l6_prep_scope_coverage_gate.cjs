#!/usr/bin/env node

const fs = require("fs");

const REQUIRED_SOURCE_CHECKS = [
  "contract_scope",
  "same_series_history",
  "project_wide_history",
  "active_actions_and_deferrals",
  "project_knowledge",
  "recent_team_inputs",
  "current_prep",
];

const UNRESOLVED_STATUSES = new Set(["active", "decision_needed", "deferred"]);
const VALID_STATUSES = new Set([...UNRESOLVED_STATUSES, "completed", "out_of_scope"]);
const VALID_DISPOSITIONS = new Set(["included", "deferred", "excluded"]);
const VALID_IMPACT_STATUSES = new Set(["impacts_added", "none_found"]);
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,95}$/;

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stringList(value) {
  return Array.isArray(value) ? value.filter(nonEmptyString) : [];
}

function safeId(value, fallback) {
  return nonEmptyString(value) && SAFE_ID.test(value) ? value : fallback;
}

function violation(code, subjectId, field) {
  return {
    code,
    subject_id: subjectId,
    ...(field ? { field } : {}),
  };
}

function buildPrepScopeCoverageGate(input) {
  const violations = [];
  const sourceChecks = input.source_checks || input.sourceChecks || {};

  for (const check of REQUIRED_SOURCE_CHECKS) {
    if (!sourceChecks[check] || sourceChecks[check].checked !== true) {
      violations.push(violation("source_check_missing", "coverage", check));
    }
  }

  const topics = Array.isArray(input.topics) ? input.topics : [];
  if (topics.length === 0) {
    violations.push(violation("topic_ledger_empty", "coverage"));
  }

  const normalizedTopics = topics.map((topic, index) => ({
    raw: topic || {},
    id: safeId(topic?.topic_id || topic?.topicId, `topic:${index + 1}`),
    rawId: topic?.topic_id || topic?.topicId,
  }));
  const topicIds = new Set();

  for (const topic of normalizedTopics) {
    if (!nonEmptyString(topic.rawId) || !SAFE_ID.test(topic.rawId)) {
      violations.push(violation("invalid_topic_id", topic.id, "topic_id"));
    } else if (topicIds.has(topic.id)) {
      violations.push(violation("duplicate_topic_id", topic.id, "topic_id"));
    }
    topicIds.add(topic.id);
  }

  const sourceIndexedTopicIds = new Set();
  for (const check of REQUIRED_SOURCE_CHECKS) {
    const detail = sourceChecks[check];
    if (!detail || !Array.isArray(detail.topic_ids || detail.topicIds)) {
      violations.push(violation("source_topic_index_missing", "coverage", check));
      continue;
    }
    for (const topicId of stringList(detail.topic_ids || detail.topicIds)) {
      sourceIndexedTopicIds.add(topicId);
      if (!topicIds.has(topicId)) {
        violations.push(violation("source_topic_not_in_ledger", "coverage", check));
      }
    }
  }

  for (const topic of normalizedTopics) {
    if (!sourceIndexedTopicIds.has(topic.id)) {
      violations.push(violation("topic_not_indexed_by_source", topic.id, "source_checks"));
    }
  }

  for (const topic of normalizedTopics) {
    const item = topic.raw;
    const status = item.status;
    const sourceRefs = stringList(item.source_refs || item.sourceRefs);

    if (!VALID_STATUSES.has(status)) {
      violations.push(violation("invalid_topic_status", topic.id, "status"));
      continue;
    }
    if (sourceRefs.length === 0) {
      violations.push(violation("topic_source_missing", topic.id, "source_refs"));
    }
    if (typeof item.relevant_to_meeting !== "boolean" && typeof item.relevantToMeeting !== "boolean") {
      violations.push(violation("meeting_relevance_missing", topic.id, "relevant_to_meeting"));
    }

    const relevant = item.relevant_to_meeting ?? item.relevantToMeeting;
    if (UNRESOLVED_STATUSES.has(status)) {
      const impactReview = item.impact_review || item.impactReview;
      if (!impactReview || !VALID_IMPACT_STATUSES.has(impactReview.status)) {
        violations.push(violation("second_order_impact_review_missing", topic.id, "impact_review"));
      } else if (impactReview.status === "impacts_added") {
        const impactIds = stringList(impactReview.impact_topic_ids || impactReview.impactTopicIds);
        if (impactIds.length === 0) {
          violations.push(violation("impact_topic_missing", topic.id, "impact_topic_ids"));
        }
        for (const impactId of impactIds) {
          if (!topicIds.has(impactId)) {
            violations.push(violation("impact_topic_not_in_ledger", topic.id, "impact_topic_ids"));
          }
        }
      } else if (stringList(impactReview.evidence_refs || impactReview.evidenceRefs).length === 0) {
        violations.push(violation("impact_review_evidence_missing", topic.id, "impact_review.evidence_refs"));
      }
    }

    if (!UNRESOLVED_STATUSES.has(status) || relevant !== true) {
      if ((status === "completed" || status === "out_of_scope") && sourceRefs.length === 0) {
        violations.push(violation("terminal_topic_evidence_missing", topic.id, "source_refs"));
      }
      continue;
    }

    const disposition = item.disposition;
    if (!VALID_DISPOSITIONS.has(disposition)) {
      violations.push(violation("silent_omission", topic.id, "disposition"));
      continue;
    }

    if (disposition === "included") {
      if (stringList(item.prep_refs || item.prepRefs).length === 0) {
        violations.push(violation("included_topic_not_traceable", topic.id, "prep_refs"));
      }
    } else if (disposition === "deferred") {
      const revisitAt = item.revisit_at || item.revisitAt;
      if (!nonEmptyString(item.disposition_reason || item.dispositionReason)) {
        violations.push(violation("deferral_reason_missing", topic.id, "disposition_reason"));
      }
      if (!nonEmptyString(item.owner)) {
        violations.push(violation("deferral_owner_missing", topic.id, "owner"));
      }
      if (!nonEmptyString(revisitAt)) {
        violations.push(violation("deferral_revisit_missing", topic.id, "revisit_at"));
      }
    } else if (disposition === "excluded") {
      if (!nonEmptyString(item.disposition_reason || item.dispositionReason)) {
        violations.push(violation("exclusion_reason_missing", topic.id, "disposition_reason"));
      }
      if (stringList(item.disposition_evidence_refs || item.dispositionEvidenceRefs).length === 0) {
        violations.push(violation("exclusion_evidence_missing", topic.id, "disposition_evidence_refs"));
      }
    }
  }

  const relevantUnresolvedIds = normalizedTopics
    .filter((topic) => {
      const relevant = topic.raw.relevant_to_meeting ?? topic.raw.relevantToMeeting;
      return relevant === true && UNRESOLVED_STATUSES.has(topic.raw.status);
    })
    .map((topic) => topic.id);

  const scheduleClaims = Array.isArray(input.schedule_claims)
    ? input.schedule_claims
    : Array.isArray(input.scheduleClaims)
      ? input.scheduleClaims
      : [];
  const completeScheduleRequired = input.complete_schedule_required === true || input.completeScheduleRequired === true;
  const completeClaims = [];

  for (let index = 0; index < scheduleClaims.length; index += 1) {
    const claim = scheduleClaims[index] || {};
    const claimId = safeId(claim.claim_id || claim.claimId, `schedule:${index + 1}`);
    const claimTopicIds = stringList(claim.topic_ids || claim.topicIds);
    if (claim.scope !== "complete" && claim.scope !== "partial") {
      violations.push(violation("invalid_schedule_scope", claimId, "scope"));
      continue;
    }
    for (const topicId of claimTopicIds) {
      if (!topicIds.has(topicId)) {
        violations.push(violation("schedule_topic_not_in_ledger", claimId, "topic_ids"));
      }
    }
    if (claim.scope === "partial") {
      if (!nonEmptyString(claim.scope_note || claim.scopeNote)) {
        violations.push(violation("partial_schedule_scope_note_missing", claimId, "scope_note"));
      }
      continue;
    }
    completeClaims.push({ id: claimId, topicIds: new Set(claimTopicIds) });
    for (const topicId of relevantUnresolvedIds) {
      if (!claimTopicIds.includes(topicId)) {
        violations.push(violation("complete_schedule_missing_topic", claimId, "topic_ids"));
      }
    }
  }

  if (completeScheduleRequired && completeClaims.length === 0) {
    violations.push(violation("complete_schedule_missing", "coverage", "schedule_claims"));
  }

  const violationCodes = [...new Set(violations.map((item) => item.code))].sort();
  const blockedTopicIds = [
    ...new Set(
      violations
        .filter((item) => item.subject_id.startsWith("topic:" ) || topicIds.has(item.subject_id))
        .map((item) => item.subject_id)
    ),
  ].sort();
  const ok = violations.length === 0;

  return {
    ok,
    status: ok ? "scope_coverage_complete" : "scope_coverage_blocked",
    ready_gate: ok ? "complete" : "blocked_until_coverage_complete",
    counts: {
      topics: topics.length,
      relevant_unresolved: relevantUnresolvedIds.length,
      complete_schedule_claims: completeClaims.length,
      violations: violations.length,
    },
    violation_codes: violationCodes,
    blocked_topic_ids: blockedTopicIds,
    violations,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--fixture") {
      args.fixture = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--json") {
      args.json = true;
    }
  }
  return args;
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.fixture) {
    console.error("Usage: node scripts/l6_prep_scope_coverage_gate.cjs --fixture <payload.json> [--json]");
    process.exit(2);
  }

  const input = JSON.parse(fs.readFileSync(args.fixture, "utf8"));
  const result = buildPrepScopeCoverageGate(input);
  const expected = input.expected || {};
  if (expected.status && result.status !== expected.status) {
    console.error(`Expected status=${expected.status} but got ${result.status}`);
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (Array.isArray(expected.violation_codes)) {
    for (const code of expected.violation_codes) {
      if (!result.violation_codes.includes(code)) {
        console.error(`Expected violation code=${code}`);
        console.error(JSON.stringify(result, null, 2));
        process.exit(1);
      }
    }
  }

  if (args.json || input.print_json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`OK L6 prep scope coverage gate: status=${result.status}, violations=${result.counts.violations}`);
  }

  if (!expected.status && !result.ok) {
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  buildPrepScopeCoverageGate,
};
