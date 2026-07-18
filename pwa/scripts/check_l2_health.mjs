#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(scripts, "__fixtures__", "l2_health_fixture.json");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "amd-os-l2-health-"));
const output = path.join(temp, "health.json");
const ledger = path.join(temp, "ledger.json");

const health = spawnSync(process.execPath, [path.join(scripts, "l2_health_check.mjs"), "--fixture", fixture, "--now", "2026-07-18T12:00:00.000Z", "--output", output, "--json"], { encoding: "utf8" });
assert.equal(health.status, 0, health.stderr || health.stdout);
const document = JSON.parse(fs.readFileSync(output, "utf8"));
assert.equal(document.rows.length, 9);
assert.equal(document.summary.green, 9);
assert.ok(document.rows.every((row) => row.id && row.name && row.health));

const action = spawnSync(process.execPath, [path.join(scripts, "l2_health_action_loop.cjs"), "--input", output, "--ledger", ledger, "--json"], { encoding: "utf8" });
assert.equal(action.status, 0, action.stderr || action.stdout);
assert.equal(JSON.parse(fs.readFileSync(ledger, "utf8")).summary.open, 0);
console.log("l2 health fixture + action ledger: ok");
