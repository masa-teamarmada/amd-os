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

function rowFor(outcome, extraArgs = []) {
  const result = runNotification(["--outcome", outcome, ...extraArgs]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).row;
}

const updated = rowFor("updated");
assert.equal(updated.title, "会議確認: 記録または予定を更新");
assert.equal(updated.meta.outcome, "updated");
assert.equal(updated.meta.notification_channel, "normal");
assert.match(updated.body, /^H-1は、終わった会議の記録、議事録なしの再確認、前後24時間の予定カード、ノーション議事録のひも付けを整える定期確認だよ。/);
assert.equal(updated.meta.action_contract.action_owner, "none");
assert.equal(updated.meta.action_contract.why_now, "OSの記録または予定を更新したよ。内容を確認してね。");
assert.equal(updated.link, "");

const reviewRequired = rowFor("review_required", [
  "--action-required", "確認して判断する",
  "--action-url", "/project/p01/cockpit",
  "--completion-condition", "内容を確認し判断したら完了",
]);
assert.equal(reviewRequired.title, "会議確認: 確認が必要");
assert.equal(reviewRequired.meta.action_contract.action_owner, "まさ");
assert.equal(reviewRequired.meta.action_contract.action_label, null);
assert.equal(reviewRequired.link, "/project/p01/cockpit");

const reviewRequiredWithoutAction = runNotification(["--outcome", "review_required"]);
assert.notEqual(reviewRequiredWithoutAction.status, 0);
assert.match(reviewRequiredWithoutAction.stderr, /--action-required, --action-url, and --completion-condition/);

const blockedWithoutAction = runNotification(["--outcome", "blocked"]);
assert.notEqual(blockedWithoutAction.status, 0);
assert.match(blockedWithoutAction.stderr, /--action-required, --action-url, and --completion-condition/);

const blocked = rowFor("blocked", [
  "--action-required", "対応する会議カードを開いて内容を確認する",
  "--action-url", "/project/p01/cockpit",
  "--completion-condition", "会議カードの内容を確認し記録を反映したら完了",
  "--action-label", "会議カードを開く",
]);
assert.equal(blocked.title, "会議確認: 処理が止まった");
assert.equal(blocked.meta.notification_channel, "critical");
assert.equal(blocked.meta.action_contract.action_owner, "まさ");
assert.equal(blocked.meta.action_contract.action_required, "対応する会議カードを開いて内容を確認する");
assert.equal(blocked.meta.action_contract.action_url, "/project/p01/cockpit");
assert.equal(blocked.meta.action_contract.completion_condition, "会議カードの内容を確認し記録を反映したら完了");
assert.equal(blocked.meta.action_contract.action_label, "会議カードを開く");
assert.equal(blocked.link, "/project/p01/cockpit");

const blockedMissingUrl = runNotification([
  "--outcome", "blocked",
  "--action-required", "対応する",
  "--completion-condition", "完了",
]);
assert.notEqual(blockedMissingUrl.status, 0);
assert.match(blockedMissingUrl.stderr, /--action-required, --action-url, and --completion-condition/);

const badActionUrl = runNotification([
  "--outcome", "blocked",
  "--action-required", "対応する",
  "--action-url", "not-a-url",
  "--completion-condition", "完了",
]);
assert.notEqual(badActionUrl.status, 0);
assert.match(badActionUrl.stderr, /--action-url must start with/);

const protocolRelativeUrl = runNotification([
  "--outcome", "blocked",
  "--action-required", "対応する",
  "--action-url", "//evil.example.com",
  "--completion-condition", "完了",
]);
assert.notEqual(protocolRelativeUrl.status, 0);
assert.match(protocolRelativeUrl.stderr, /--action-url must start with/);

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
