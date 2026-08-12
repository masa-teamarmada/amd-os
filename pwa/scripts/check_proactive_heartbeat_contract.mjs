#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  preparedDecisionItem,
  sanitizeDecisionText,
  validateDecisionPayload,
} from "./proactive_heartbeat_tool.mjs";

const protocol = preparedDecisionItem({
  notification_id: "11111111-1111-4111-8111-111111111111",
  l2_kind: "protocols",
  target_id: "p01",
  scope_key: "202608:protocol:22222222-2222-4222-8222-222222222222",
  title: "条件付きで提携を進める判断",
  summary: "判断材料を比較し、条件が満たされる場合だけ検証へ進む候補",
  saved_count: 1,
  total_count: 1,
  metadata_json: {},
  created_at: "2026-08-12T01:00:00.000Z",
  updated_at: "2026-08-12T01:00:00.000Z",
});

assert.equal(protocol.has_supported_apply_route, true);
assert.equal(protocol.candidate_persisted_count, 1);
assert.equal(sanitizeDecisionText("masa@example.com https://example.com").includes("example.com"), false);

const broadProtocol = preparedDecisionItem({
  ...protocol,
  notification_id: "44444444-4444-4444-8444-444444444444",
  scope_key: "202608",
});
assert.equal(broadProtocol.has_supported_apply_route, false, "protocol review must identify one candidate");

const prepared = {
  version: 1,
  contract: "amd-os-final-decision-review-v1",
  prompt: { hash: "prompt-hash" },
  item_count: 1,
  items: [protocol],
};

const valid = {
  version: 1,
  contract: "amd-os-final-decision-review-v1",
  prompt_hash: "prompt-hash",
  decisions: [{
    notification_id: protocol.notification_id,
    source_hash: protocol.source_hash,
    disposition: "approve",
    title: "この判断をAMDプロトコルに採用する？",
    summary: "条件付きで検証へ進む判断パターンを、再利用可能なプロトコル候補として確認する。",
    destination_label: "管理 → AMDプロトコル",
    changes: ["判断材料と分岐条件をAMDプロトコルへ1件追加する"],
    approval_effect: "対象候補だけをconfirmedにしてAMDプロトコルへ採用する",
    rejection_effect: "対象候補だけをrejectedにして採用しない",
    reason: "追加先、変更内容、採否後の状態遷移が具体的",
    confidence: 0.96,
  }],
};

assert.deepEqual(validateDecisionPayload(valid, prepared), []);

const persistedCandidate = structuredClone(valid);
assert.deepEqual(validateDecisionPayload(persistedCandidate, prepared), [], "saved_count=1 is a persisted candidate, not canonical adoption");

const missingChange = structuredClone(valid);
missingChange.decisions[0].changes = [];
assert.match(validateDecisionPayload(missingChange, prepared).join("\n"), /changes/);

const weak = structuredClone(valid);
weak.decisions[0].confidence = 0.7;
assert.match(validateDecisionPayload(weak, prepared).join("\n"), /confidence/);

const unsupported = structuredClone(protocol);
unsupported.notification_id = "33333333-3333-4333-8333-333333333333";
unsupported.l2_kind = "raw_data_gap";
unsupported.has_supported_apply_route = false;
unsupported.route = null;
const unsupportedPrepared = { ...prepared, item_count: 1, items: [unsupported] };
const unsupportedReview = structuredClone(valid);
unsupportedReview.decisions[0].notification_id = unsupported.notification_id;
unsupportedReview.decisions[0].source_hash = unsupported.source_hash;
assert.match(validateDecisionPayload(unsupportedReview, unsupportedPrepared).join("\n"), /supported apply route/);

const suppressUnsupported = structuredClone(unsupportedReview);
suppressUnsupported.decisions[0] = {
  notification_id: unsupported.notification_id,
  source_hash: unsupported.source_hash,
  disposition: "suppress",
  reason: "正本への具体的な反映先と採否処理がない",
  confidence: 0.98,
};
assert.deepEqual(validateDecisionPayload(suppressUnsupported, unsupportedPrepared), []);

const notificationUi = fs.readFileSync(new URL("../src/components/notifications/NotificationsClient.tsx", import.meta.url), "utf8");
assert.match(notificationUi, /この採否で正本が変わる内容/);
assert.match(notificationUi, /function finalDecisionContract/);
assert.doesNotMatch(notificationUi, /既に正本へ保存済みの通知/);

console.log("final decision review contract: ok");
