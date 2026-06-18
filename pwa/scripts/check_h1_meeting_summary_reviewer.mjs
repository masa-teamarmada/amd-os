#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { reviewMeetingSummary } from "./lib/h1_meeting_summary_reviewer.mjs";

const fixturePath = new URL("./__fixtures__/h1_meeting_summary_reviewer_sx_pivot.json", import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const items = reviewMeetingSummary(fixture);

assert.equal(items.length, 1);
assert.equal(items[0].source, "notion");
assert.equal(items[0].project_id, "p21");
assert.equal(items[0].proposed_target_l2, "strategy_signal");
assert.equal(items[0].gap_class, "extractor_miss");
assert.match(items[0].title, /創業体制|CEO|代表|資金調達/);
assert.ok(items[0].salience_score >= 0.8, `salience_score too low: ${items[0].salience_score}`);
assert.ok(items[0].source_hash.startsWith("h1-review:"));
assert.ok(items[0].matched_patterns.present_groups.some((g) => g.id === "leadership_commitment"));
assert.ok(items[0].matched_patterns.present_groups.some((g) => g.id === "vc_fit_break"));
assert.ok(items[0].matched_patterns.present_groups.some((g) => g.id === "local_capital_poc"));
assert.ok(items[0].matched_patterns.missing_groups.some((g) => g.id === "leadership_commitment"));
assert.ok(items[0].evidence_refs_json.snippets.length > 0);

console.log("h1_meeting_summary_reviewer fixture passed");
