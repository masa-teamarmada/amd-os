#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const runner = fs.readFileSync(path.join(repo, "scripts/run-h1-background.sh"), "utf8");
const gate = fs.readFileSync(path.join(repo, "pwa/scripts/h1_background_candidate_gate.mjs"), "utf8");
const prompt = fs.readFileSync(path.join(repo, "scripts/h1-background-runner-prompt.md"), "utf8");

assert.match(runner, /TZ=Asia\/Tokyo date \+%H/);
assert.match(runner, /hour\} < 9 \|\| 10#\$\{hour\} > 21/);
assert.match(runner, /H1_NOW_HOUR_JST/);
assert.match(gate, /NOTION_METADATA_CANDIDATE_LIMIT = 25/);
assert.match(gate, /scan_required: true/);
assert.match(gate, /body_read_allowed: false/);
assert.match(gate, /notion_metadata\.scan_required/);
assert.match(prompt, /親data source/);
assert.match(prompt, /readback不一致/);
assert.match(prompt, /member relationは既存IDを維持したunionだけ/);

console.log("H-1 background contract: OK");
