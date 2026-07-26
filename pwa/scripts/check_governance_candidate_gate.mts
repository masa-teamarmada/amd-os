import assert from "node:assert/strict";
import { gateGovernanceHistoryCandidate } from "../src/lib/governance-candidate-gate.ts";

const workflow = gateGovernanceHistoryCandidate({
  subject: "承認されていない申請があります。｜ジョブカンワークフロー",
  evidenceText: "臨時株主総会議事録_20260722",
  meetingType: "board",
  meetingDate: null,
});
assert.deepEqual(workflow, { eligible: false, reason: "workflow_notification" });

const invitationOnly = gateGovernanceHistoryCandidate({
  subject: "臨時株主総会 招集通知",
  evidenceText: "2026年7月30日開催",
  meetingType: "egm",
  meetingDate: "2026-07-30",
});
assert.deepEqual(invitationOnly, { eligible: false, reason: "held_evidence_missing" });

const validMinutes = gateGovernanceHistoryCandidate({
  subject: "取締役会議事録",
  evidenceText: "2026年7月22日開催の取締役会における決議事項",
  meetingType: "board",
  meetingDate: "2026-07-22",
});
assert.deepEqual(validMinutes, { eligible: true, meetingType: "board" });

console.log("governance candidate gate tests passed");
