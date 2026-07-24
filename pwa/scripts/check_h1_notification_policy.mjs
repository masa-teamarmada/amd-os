#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(PWA_ROOT, "..");
const helper = path.join(PWA_ROOT, "scripts", "notify_h1_report.mjs");

function runNotification(args) {
  return spawnSync(process.execPath, [helper, "--dry-run", "--run-key", "h1-notification-policy", "--body", "予定カードを更新した。", ...args], {
    cwd: PWA_ROOT,
    encoding: "utf8",
  });
}

function rowFor(outcome) {
  const result = runNotification(["--outcome", outcome]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).row;
}

const updated = rowFor("updated");
assert.equal(updated.title, "会議確認: 記録または予定を更新");
assert.equal(updated.meta.outcome, "updated");
assert.equal(updated.meta.notification_channel, "normal");
assert.match(updated.body, /^H-1は、終わった会議の記録、議事録なしの再確認、前後24時間の予定カード、ノーション議事録のひも付けを整える定期確認だよ。/);

const reviewRequired = rowFor("review_required");
assert.equal(reviewRequired.title, "会議確認: 確認が必要");

const blocked = rowFor("blocked");
assert.equal(blocked.title, "会議確認: 処理が止まった");
assert.equal(blocked.meta.notification_channel, "critical");

const noOutcome = runNotification([]);
assert.notEqual(noOutcome.status, 0);
assert.match(noOutcome.stderr, /--outcome is required/);

const legacyTitle = runNotification(["--outcome", "updated", "--title", "H-1: 対象会議なし"]);
assert.notEqual(legacyTitle.status, 0);
assert.match(legacyTitle.stderr, /--title is not supported/);

const candidateGate = fs.readFileSync(path.join(PWA_ROOT, "scripts", "h1_background_candidate_gate.mjs"), "utf8");
assert.doesNotMatch(candidateGate, /notify:h1-report/);
assert.match(candidateGate, /OS通知なし（内部記録のみ）/);

const runnerPrompt = fs.readFileSync(path.join(REPO_ROOT, "scripts", "h1-background-runner-prompt.md"), "utf8");
assert.match(runnerPrompt, /変化がない場合はOS通知を作らない/);

process.stdout.write("H-1 notification policy checks passed.\n");
