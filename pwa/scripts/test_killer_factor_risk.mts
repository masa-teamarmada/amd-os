import assert from "node:assert/strict";
import {
  isKillerFactorStatusAllowed,
  summarizeKillerFactorRisk,
  type KillerFactorRiskInput,
} from "../src/lib/killer-factor-risk.ts";

const item = (status: KillerFactorRiskInput["status"], operatingMode: KillerFactorRiskInput["operatingMode"] = "monitoring") => ({
  operatingMode,
  status,
});

assert.equal(summarizeKillerFactorRisk([item("clear")]).level, "stable");
assert.equal(summarizeKillerFactorRisk([item("unchecked")]).level, "unknown");
assert.equal(summarizeKillerFactorRisk([item("clear"), item("warning")]).level, "attention");
assert.equal(summarizeKillerFactorRisk([item("clear"), item("watch")]).level, "watch");
assert.equal(summarizeKillerFactorRisk([item("implemented", "prevention")]).level, "watch");
assert.equal(summarizeKillerFactorRisk([item("controlled", "prevention"), item("breached", "prevention")]).level, "critical");

const summary = summarizeKillerFactorRisk([
  item("occurred"),
  item("warning"),
  item("watch"),
  item("not_started", "prevention"),
  item("in_progress", "prevention"),
  item("implemented", "prevention"),
  item("unchecked"),
  item("clear"),
  item("controlled", "prevention"),
]);
assert.deepEqual(summary, {
  level: "critical",
  totalCount: 9,
  criticalCount: 1,
  actionCount: 3,
  watchCount: 2,
  unknownCount: 1,
  safeCount: 2,
});

assert.equal(isKillerFactorStatusAllowed("monitoring", "warning"), true);
assert.equal(isKillerFactorStatusAllowed("monitoring", "watch"), true);
assert.equal(isKillerFactorStatusAllowed("monitoring", "controlled"), false);
assert.equal(isKillerFactorStatusAllowed("prevention", "implemented"), true);
assert.equal(isKillerFactorStatusAllowed("prevention", "controlled"), true);
assert.equal(isKillerFactorStatusAllowed("prevention", "occurred"), false);

console.log("killer factor risk summary: OK");
