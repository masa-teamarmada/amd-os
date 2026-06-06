#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const {
  compareVersions,
  evaluateGuard,
  extractBuildVersion,
  maxBranchVersion,
  parseVersion,
} = require("./deploy-version-guard.cjs");

assert.deepEqual(parseVersion("v0.15.6").parts, [0, 15, 6]);
assert.equal(compareVersions("v0.15.6", "v0.15.2"), 1);
assert.equal(compareVersions("v0.15.6", "v0.15.6"), 0);
assert.equal(compareVersions("v0.15.1", "v0.15.6"), -1);

assert.equal(extractBuildVersion('export const BUILD_VERSION = "v0.15.2";'), "v0.15.2");
assert.equal(
  maxBranchVersion([
    { ref: "main", version: "v0.15.2" },
    { ref: "codex/notion-company-content-v0156", version: "v0.15.6" },
  ]).version,
  "v0.15.6"
);

const rollback = evaluateGuard({
  target: "production",
  localVersion: "v0.15.1",
  branchMaxVersion: "v0.15.6",
  branchMaxRef: "codex/notion-company-content-v0156",
  branchScanOk: true,
  productionVersion: "v0.15.6",
  productionReadOk: true,
});
assert.equal(rollback.ok, false);
assert.match(rollback.failures.join("\n"), /older than local branch max v0\.15\.6/);
assert.match(rollback.failures.join("\n"), /older than production v0\.15\.6/);

const preview = evaluateGuard({
  target: "preview",
  localVersion: "v0.15.1",
  branchMaxVersion: "v0.15.6",
  branchMaxRef: "codex/notion-company-content-v0156",
  branchScanOk: true,
  productionVersion: "v0.15.6",
  productionReadOk: true,
});
assert.equal(preview.ok, true);
assert.match(preview.warnings.join("\n"), /preview deploy is not hard-stopped/);

const current = evaluateGuard({
  target: "production",
  localVersion: "v0.15.7",
  branchMaxVersion: "v0.15.6",
  branchScanOk: true,
  productionVersion: "v0.15.6",
  productionReadOk: true,
});
assert.equal(current.ok, true);

console.log("deploy-version-guard tests passed");
