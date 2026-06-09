#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const {
  compareVersions,
  evaluateGuard,
  extractBuildVersion,
  maxRefVersion,
  parseVersion,
} = require("./deploy-version-guard.cjs");

assert.deepEqual(parseVersion("v0.16.20").parts, [0, 16, 20]);
assert.equal(compareVersions("v0.16.20", "v0.15.3"), 1);
assert.equal(compareVersions("v0.16.20", "v0.16.20"), 0);
assert.equal(compareVersions("v0.15.18", "v0.16.20"), -1);

assert.equal(extractBuildVersion('export const BUILD_VERSION = "v0.16.20";'), "v0.16.20");
assert.equal(
  maxRefVersion([
    { ref: "codex/stale-v0153", version: "v0.15.3" },
    { ref: "origin/codex/prs-docs-v01618", version: "v0.16.20" },
  ]).version,
  "v0.16.20"
);

const staleCheckout = evaluateGuard({
  target: "production",
  localVersion: "v0.15.3",
  minVersion: "v0.16.20",
  refMaxVersion: "v0.16.20",
  refMaxRef: "origin/codex/prs-docs-v01618",
  refScanOk: true,
  productionVersion: null,
  productionReadOk: false,
  productionReadMessage: "production /api/build-info returned 404",
});
assert.equal(staleCheckout.ok, false);
assert.match(staleCheckout.failures.join("\n"), /older than deploy minimum v0\.16\.20/);
assert.match(staleCheckout.failures.join("\n"), /older than known ref max v0\.16\.20/);

const rollback = evaluateGuard({
  target: "production",
  localVersion: "v0.16.19",
  minVersion: "v0.16.20",
  refMaxVersion: "v0.16.20",
  refMaxRef: "origin/codex/prs-docs-v01618",
  refScanOk: true,
  productionVersion: "v0.16.20",
  productionReadOk: true,
});
assert.equal(rollback.ok, false);
assert.match(rollback.failures.join("\n"), /older than production v0\.16\.20/);

const preview = evaluateGuard({
  target: "preview",
  localVersion: "v0.15.3",
  minVersion: "v0.16.20",
  refMaxVersion: "v0.16.20",
  refMaxRef: "origin/codex/prs-docs-v01618",
  refScanOk: true,
  productionVersion: "v0.16.20",
  productionReadOk: true,
});
assert.equal(preview.ok, true);
assert.match(preview.warnings.join("\n"), /preview deploy is not hard-stopped/);

const current = evaluateGuard({
  target: "production",
  localVersion: "v0.16.21",
  minVersion: "v0.16.20",
  refMaxVersion: "v0.16.20",
  refScanOk: true,
  productionVersion: "v0.16.20",
  productionReadOk: true,
});
assert.equal(current.ok, true);

console.log("deploy-version-guard tests passed");
