#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import { preparedDecisionItem } from "./proactive_heartbeat_tool.mjs";

const routeSource = fs.readFileSync(new URL("../src/app/api/notifications/feedback/route.ts", import.meta.url), "utf8");
const heartbeatSource = fs.readFileSync(new URL("./proactive_heartbeat_tool.mjs", import.meta.url), "utf8");
const skillSource = fs.readFileSync(new URL("../scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md", import.meta.url), "utf8");
const notificationUiSource = fs.readFileSync(new URL("../src/components/notifications/NotificationsClient.tsx", import.meta.url), "utf8");

const prepared = preparedDecisionItem({
  notification_id: "11111111-1111-4111-8111-111111111111",
  l2_kind: "sps_reassessment",
  target_id: "33333333-3333-4333-8333-333333333333",
  scope_key: "22222222-2222-4222-8222-222222222222",
  title: "最新版SPSを再評価する？",
  summary: "新しい根拠を現行版で独立評価した候補",
  saved_count: 1,
  total_count: 1,
  metadata_json: {
    current_sps: { lower_yen: 1_000_000_000, upper_yen: 2_000_000_000, raw_text: "除外" },
    proposed_sps: { lower_yen: 1_200_000_000, upper_yen: 2_400_000_000 },
    current_q: { lower_pct: 20, upper_pct: 30 },
    proposed_q: { lower_pct: 24, upper_pct: 36 },
    current_p_ind: { lower_yen: 5_000_000_000, upper_yen: 6_700_000_000 },
    proposed_p_ind: { lower_yen: 5_000_000_000, upper_yen: 6_700_000_000 },
    impact_classification: "q",
    evidence_strength: "hard",
    information_cutoff: "2026-08-19T00:00:00+09:00",
    confidence: 0.94,
    raw_text: "通知へ出してはいけない本文",
    source_url: "https://example.com/private",
  },
  created_at: "2026-08-19T01:00:00.000Z",
  updated_at: "2026-08-19T01:00:00.000Z",
});

assert.equal(prepared.has_supported_apply_route, true);
assert.deepEqual(prepared.route, {
  destination: "最新版SPS",
  approval: "対象候補から新しい凍結評価をappend-onlyで1件追加する",
  rejection: "対象候補をrejectedにして現行SPSを変えない",
});
assert.deepEqual(Object.keys(prepared.metadata_hints).sort(), [
  "confidence",
  "current_p_ind",
  "current_q",
  "current_sps",
  "evidence_strength",
  "impact_classification",
  "information_cutoff",
  "proposed_p_ind",
  "proposed_q",
  "proposed_sps",
].sort());
assert.equal("raw_text" in prepared.metadata_hints, false);
assert.equal("source_url" in prepared.metadata_hints, false);
assert.deepEqual(prepared.metadata_hints.current_sps, { lower_yen: 1_000_000_000, upper_yen: 2_000_000_000 });
assert.deepEqual(prepared.metadata_hints.proposed_q, { lower_pct: 24, upper_pct: 36 });
assert.equal(prepared.metadata_hints.confidence, 0.94);

assert.match(routeSource, /"sps_reassessment",/);
assert.match(routeSource, /\.rpc\("apply_sps_reassessment_candidate",\s*\{/);
assert.match(routeSource, /\.rpc\("reject_sps_reassessment_candidate",\s*\{/);
assert.match(routeSource, /p_candidate_id:\s*args\.scopeKey/);
assert.match(routeSource, /\.eq\("id", args\.scopeKey\)[\s\S]*?\.eq\("seed_id", args\.targetId\)/);
assert.match(routeSource, /\["coverage_gap", "sps_reassessment"\]\.includes\(l2Kind\)[\s\S]*?from\("l2_feedbacks"\)[\s\S]*?\.delete\(\)/);
assert.match(routeSource, /action === "comment"[\s\S]*?\{ applied: false, message: "comment only" \}/);
assert.match(routeSource, /l2Kind !== "sps_reassessment"[\s\S]*?triggerImmediateReExtraction/);
assert.match(routeSource, /SPS reassessment candidate rejected; current SPS unchanged/);
assert.match(routeSource, /if \(!result\.rejected\) throw new Error/);

assert.match(heartbeatSource, /sps_reassessment:\s*\{[\s\S]*?destination: "最新版SPS"/);
assert.match(heartbeatSource, /"impact_classification"[\s\S]*?"evidence_strength"[\s\S]*?"information_cutoff"/);
assert.match(heartbeatSource, /\["current_sps", "lower_yen", "upper_yen"\][\s\S]*?\["proposed_sps", "lower_yen", "upper_yen"\][\s\S]*?\["current_q", "lower_pct", "upper_pct"\][\s\S]*?\["proposed_q", "lower_pct", "upper_pct"\][\s\S]*?\["current_p_ind", "lower_yen", "upper_yen"\][\s\S]*?\["proposed_p_ind", "lower_yen", "upper_yen"\]/);

const phaseA = skillSource.indexOf("## Phase A: SPS再評価候補の独立レビュー");
const spsPrepare = skillSource.indexOf("sps_reassessment_tool.mjs prepare");
const spsValidate = skillSource.indexOf("sps_reassessment_tool.mjs validate");
const spsApply = skillSource.indexOf("sps_reassessment_tool.mjs apply");
const phaseB = skillSource.indexOf("## Phase B: 既存の最終採否判断");
assert.ok(phaseA >= 0 && phaseA < spsPrepare && spsPrepare < spsValidate && spsValidate < spsApply && spsApply < phaseB);
assert.match(skillSource, /既存 automation id `amd-os-proactive-heartbeat`/);
assert.match(skillSource, /別automationを作らず/);
assert.doesNotMatch(skillSource, /automation\.toml/);
assert.match(skillSource, /event_count=0, group_count=0[\s\S]*?古いprepared\/review JSONを読まず[\s\S]*?空のreview JSONも作らず/);
assert.match(skillSource, /provider API[\s\S]*?使わない/);
assert.match(skillSource, /raw本文・個人情報・URLの保存や報告は禁止/);
assert.match(skillSource, /旧9軸[\s\S]*?fallback[\s\S]*?禁止/);
assert.match(skillSource, /seed_screening_bands`へ直接書かない/);

assert.match(notificationUiSource, /sps_reassessment: "SPS再評価"/);
assert.match(notificationUiSource, /case "sps_reassessment":[\s\S]*?\/seeds\/\$\{encodeURIComponent\(n\.target_id\)\}/);
assert.match(notificationUiSource, /n\.l2_kind === "sps_reassessment"[\s\S]*?\/seeds\/\$\{encodeURIComponent\(n\.target_id\)\}/);
assert.match(notificationUiSource, /contract\.href[\s\S]*?<Link href=\{contract\.href\}/);

console.log("sps reassessment notification contract: ok");
