#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  candidateGenerationKey,
  meetingEvidence,
  sanitizeEvidenceText,
  sourceCacheEvidence,
  validateGenerationPayload,
} from "./proactive_heartbeat_tool.mjs";

const source = sourceCacheEvidence({
  id: "11111111-1111-4111-8111-111111111111",
  cache_id: "gmail:p01:thread-1",
  project_id: "p01",
  source: "gmail",
  item_id: "thread-1",
  title: "代表者の承認依頼",
  item_date: "2026-08-12T03:00:00.000Z",
  content_text: "masa@example.com へ https://example.com から8月12日17時までに承認してください",
  metadata_json: {},
  collected_at: "2026-08-12T03:10:00.000Z",
});
assert.equal(source.content.includes("example.com"), false);
assert.equal(sanitizeEvidenceText("token=secret https://example.com").includes("example.com"), false);

const meeting = meetingEvidence({
  meeting_id: "meeting-1",
  project_id: "p01",
  meeting_date: "2026-08-11",
  meeting_start_at: "2026-08-11T06:00:00.000Z",
  title: "事業方針会議",
  summary_short: "提携案は代表判断待ち",
  decided: [],
  progress: [],
  next_actions: ["チームが比較表を作る"],
  risks: [],
  source_hash: "upstream-hash",
  source_kinds: "calendar,gmail",
  updated_at: "2026-08-11T08:00:00.000Z",
});

const prepared = {
  version: 2,
  contract: "amd-os-proactive-heartbeat-v2",
  prompt: { hash: "prompt-hash" },
  projects: [{ project_id: "p01" }],
  evidence: [source, meeting],
};

const validCandidate = {
  candidate_id: "c1",
  project_id: "p01",
  attention_type: "decision",
  title: "提携案を採用するか決める",
  detail: "提携開始には代表判断が必要な状態",
  why_now: "明示された回答期限が本日中",
  action: "提携案の採用可否を決める",
  effect: "採用なら締結準備へ進み、見送りなら交渉を止める",
  completion_condition: "採用または見送りを選んだら完了",
  confidence: 0.94,
  due_basis: "explicit",
  due_at: "2026-08-12T08:00:00.000Z",
  due_evidence_text: "8月12日17時まで",
  evidence_refs: [{ evidence_kind: source.evidence_kind, evidence_id: source.evidence_id, source_hash: source.source_hash }],
  notify_now: true,
  notification_reason: "explicit_deadline_24h",
  notification_why_now: "明示された回答期限まで5時間",
};

const valid = {
  version: 2,
  contract: "amd-os-proactive-heartbeat-v2",
  prompt_hash: "prompt-hash",
  dispositions: [
    { evidence_kind: source.evidence_kind, evidence_id: source.evidence_id, source_hash: source.source_hash, disposition: "create", reason: "代表判断で進行が分岐する", candidate_id: "c1" },
    { evidence_kind: meeting.evidence_kind, evidence_id: meeting.evidence_id, source_hash: meeting.source_hash, disposition: "noop", reason: "チーム作業であり本人判断ではない" },
  ],
  candidates: [validCandidate],
};

const now = new Date("2026-08-12T03:00:00.000Z");
assert.deepEqual(validateGenerationPayload(valid, prepared, now), []);

const sameCandidate = structuredClone(validCandidate);
sameCandidate.action = "表現が変わっても同じ根拠なら再生成しない";
assert.equal(candidateGenerationKey(validCandidate), candidateGenerationKey(sameCandidate));

const zero = structuredClone(valid);
zero.dispositions[0] = { ...zero.dispositions[0], disposition: "needs_source", reason: "選択肢が不足", candidate_id: undefined };
zero.candidates = [];
assert.deepEqual(validateGenerationPayload(zero, prepared, now), []);

const missingDisposition = structuredClone(valid);
missingDisposition.dispositions.pop();
assert.match(validateGenerationPayload(missingDisposition, prepared, now).join("\n"), /cover all evidence/);

const teamAction = structuredClone(valid);
teamAction.candidates[0].attention_type = "team_action";
assert.match(validateGenerationPayload(teamAction, prepared, now).join("\n"), /attention_type is invalid/);

const meetingPrep = structuredClone(valid);
meetingPrep.candidates[0].title = "次回MTG準備をする";
assert.match(validateGenerationPayload(meetingPrep, prepared, now).join("\n"), /retired meeting prep/);

const inventedDue = structuredClone(valid);
inventedDue.candidates[0].due_basis = "none";
assert.match(validateGenerationPayload(inventedDue, prepared, now).join("\n"), /due_at must be null/);

const ungroundedDue = structuredClone(valid);
ungroundedDue.candidates[0].due_evidence_text = "明日まで";
assert.match(validateGenerationPayload(ungroundedDue, prepared, now).join("\n"), /not present in linked evidence/);

const weak = structuredClone(valid);
weak.candidates[0].confidence = 0.7;
assert.match(validateGenerationPayload(weak, prepared, now).join("\n"), /confidence/);

const weakNotification = structuredClone(valid);
weakNotification.candidates[0].due_at = "2026-08-14T08:00:00.000Z";
assert.match(validateGenerationPayload(weakNotification, prepared, now).join("\n"), /within 24h/);

const information = structuredClone(valid);
information.dispositions[0] = { ...information.dispositions[0], disposition: "noop", reason: "完了報告", candidate_id: undefined };
information.candidates = [];
assert.deepEqual(validateGenerationPayload(information, prepared, now), []);

console.log("proactive heartbeat contract: ok");
