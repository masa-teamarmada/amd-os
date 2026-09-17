#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const read = (file) => fs.readFileSync(path.join(repo, file), "utf8");

const budget = read("pwa/src/lib/automation-route-budget.ts");
const migration = read("ios/supabase/migrations/20260917130000_automation_route_budget.sql");
const runner = read("scripts/run-h1-background.sh");
const reviewer = read("scripts/run-h1-reviewer-background.sh");
const prompt = read("scripts/h1-background-runner-prompt.md");
const skill = read("pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md");

assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /daily_budget_exceeded/);
assert.match(migration, /run_budget_exceeded/);
assert.match(budget, /RUN_REQUEST_LIMIT = 12/);
assert.match(budget, /RUN_BODY_LIMIT = 2 \* MIB/);
assert.match(budget, /automation_run_id_required/);
assert.match(budget, /automation_body_too_large/);

for (const file of [runner, reviewer]) {
  assert.match(file, /AMD_OS_AUTOMATION_REPO_DIR/);
  assert.match(file, /amd-os-vercel-emergency-stop/);
  assert.match(file, /background\.lock/);
  assert.match(file, /run_bounded_command\.mjs.*--timeout-seconds 900/);
  assert.match(file, /h1_runner_safety\.mjs.*check/);
  assert.match(file, /h1_runner_safety\.mjs.*failure/);
}
assert.match(prompt, /x-amd-automation-run-id/);
assert.match(prompt, /全route合計12回/);
assert.match(prompt, /send_slack=false/);
assert.match(prompt, /408、425、429、5xx/);
assert.match(skill, /同じrunnerの多重起動は禁止/);
assert.match(skill, /H-1はSlack DM、メール、外部通知を送らない/);

const routeFiles = [
  "pwa/src/app/api/meeting-prep/route.ts",
  "pwa/src/app/api/meeting-prep/calendar-sync/route.ts",
  "pwa/src/app/api/meeting-calendar/upsert-plan/route.ts",
  "pwa/src/app/api/task-calendar/register-tasks/route.ts",
  "pwa/src/app/api/task-calendar/schedule-plan/route.ts",
  "pwa/src/app/api/meeting-workflow/finalize/route.ts",
  "pwa/src/app/api/meeting-assets/adopt-drive-folder/route.ts",
  "pwa/src/app/api/project-workspace/[projectId]/automation-context/route.ts",
];
for (const file of routeFiles) assert.match(read(file), /enforceAutomationRouteBudget/);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "h1-safety-test-"));
const stateFile = path.join(tempDir, "state.json");
const safetyScript = path.join(repo, "pwa/scripts/h1_runner_safety.mjs");
assert.equal(spawnSync(process.execPath, [safetyScript, "check", stateFile]).status, 0);
assert.equal(spawnSync(process.execPath, [safetyScript, "failure", stateFile]).status, 0);
assert.equal(spawnSync(process.execPath, [safetyScript, "check", stateFile]).status, 75);
assert.equal(spawnSync(process.execPath, [safetyScript, "success", stateFile]).status, 0);
assert.equal(spawnSync(process.execPath, [safetyScript, "check", stateFile]).status, 0);
fs.rmSync(tempDir, { recursive: true, force: true });

console.log("H-1 automation safety: OK");
