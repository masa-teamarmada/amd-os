#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  appPreparedItem,
  l2PreparedItem,
  proactivePreparedItem,
  sanitizeAttentionText,
  validateReviewPayload,
} from "./attention_review_tool.mjs";

const proactive = proactivePreparedItem({
  id: "todo-1",
  project_id: "p01",
  trigger_kind: "meeting_next_action",
  source_meeting_id: "meeting-1",
  source_event_id: "",
  title: "契約案を採用するか決める",
  detail: "https://example.com masa@example.com から確認",
  ball_owner: "amd",
  due_at: "2026-08-20T09:00:00.000Z",
  due_basis: "explicit",
  priority: "normal",
  status: "open",
  created_at: "2026-08-12T00:00:00.000Z",
  updated_at: "2026-08-12T00:00:00.000Z",
});
assert.equal(proactive.summary.includes("example.com"), false);
assert.equal(sanitizeAttentionText("連絡 a@example.com https://example.com").includes("example.com"), false);

const l2 = l2PreparedItem({
  notification_id: "l2-1",
  l2_kind: "project_knowledge",
  target_id: "p01",
  scope_key: "global",
  title: "保存完了",
  summary: "1件保存した",
  saved_count: 1,
  total_count: 1,
  metadata_json: {},
  created_at: "2026-08-12T00:00:00.000Z",
  updated_at: "2026-08-12T00:00:00.000Z",
});
const app = appPreparedItem({
  id: "app-1",
  kind: "vc_new",
  title: "新規VC候補",
  body: "追客対象にするか判断する",
  link: "/vcs/vc-1",
  source: "cron_vc_discover",
  meta: {
    action_contract: {
      action_owner: "まさ",
      action_required: "候補を確認して追客対象にするか決める",
      action_url: "/vcs/vc-1",
      completion_condition: "追客対象か見送りかを決めたら完了",
    },
  },
  created_at: "2026-08-12T00:00:00.000Z",
  updated_at: "2026-08-12T00:00:00.000Z",
});
const prepared = { version: 1, contract: "amd-os-attention-review-v1", items: [proactive, l2, app] };
const valid = {
  version: 1,
  reviewer: "codex-automation",
  decisions: [
    {
      source_kind: "proactive_todo",
      source_id: proactive.source_id,
      source_hash: proactive.source_hash,
      attention_type: "decision",
      owner: "masa",
      requires_masa_decision: true,
      reason: "採否で次の契約行動が変わる",
      action: "契約案の採用可否を決める",
      effect: "採用なら契約手続きを開始し、不採用なら止める",
      confidence: 0.94,
    },
    {
      source_kind: "l2_notification",
      source_id: l2.source_id,
      source_hash: l2.source_hash,
      attention_type: "information",
      owner: "none",
      requires_masa_decision: false,
      reason: "すでに保存済みの完了報告",
      action: "",
      effect: "",
      confidence: 0.99,
    },
    {
      source_kind: "app_notification",
      source_id: app.source_id,
      source_hash: app.source_hash,
      attention_type: "decision",
      owner: "masa",
      requires_masa_decision: true,
      reason: "追客するかで次の行動が変わる",
      action: "追客対象にするか決める",
      effect: "採用ならVC接点づくりへ進み、見送りなら通知を閉じる",
      confidence: 0.9,
    },
  ],
};
assert.deepEqual(validateReviewPayload(valid, prepared), []);

const invalid = structuredClone(valid);
invalid.decisions[1].attention_type = "decision";
invalid.decisions[1].owner = "masa";
invalid.decisions[1].requires_masa_decision = true;
invalid.decisions[1].action = "採用する";
invalid.decisions[1].effect = "保存する";
assert.match(validateReviewPayload(invalid, prepared).join("\n"), /already-saved/);

const invalidApp = structuredClone(valid);
invalidApp.decisions[2].source_kind = "app_notification";
invalidApp.decisions[2].source_id = "app-meeting";
const meetingApp = appPreparedItem({
  id: "app-meeting",
  kind: "meeting_action",
  title: "会議の要対応",
  body: "担当者を確認",
  link: "/project/p01/cockpit",
  source: "meeting_workflow",
  meta: { action_contract: { action_owner: "まさ", action_required: "確認", action_url: "/project/p01/cockpit", completion_condition: "確認完了" } },
  created_at: "2026-08-12T00:00:00.000Z",
  updated_at: "2026-08-12T00:00:00.000Z",
});
invalidApp.decisions[2].source_hash = meetingApp.source_hash;
const preparedWithMeeting = { ...prepared, items: [proactive, l2, meetingApp] };
assert.match(validateReviewPayload(invalidApp, preparedWithMeeting).join("\n"), /action ledger/);

const missing = structuredClone(valid);
missing.decisions.pop();
assert.match(validateReviewPayload(missing, prepared).join("\n"), /cover all prepared items/);

console.log("attention review contract: ok");
