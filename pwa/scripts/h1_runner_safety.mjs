#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const [command, stateFile] = process.argv.slice(2);
if (!command || !stateFile) {
  console.error("usage: h1_runner_safety.mjs <check|success|failure> <state-file>");
  process.exit(64);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return { version: 1, consecutiveFailures: 0, cooldownUntil: null };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  const temp = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, stateFile);
}

const state = readState();
const now = Date.now();

if (command === "check") {
  const until = Date.parse(String(state.cooldownUntil || ""));
  if (Number.isFinite(until) && until > now) {
    console.error(`cooldown active until ${state.cooldownUntil}`);
    process.exit(75);
  }
  process.exit(0);
}

if (command === "success") {
  writeState({ version: 1, consecutiveFailures: 0, cooldownUntil: null, lastSuccessAt: new Date(now).toISOString() });
  process.exit(0);
}

if (command === "failure") {
  const failures = Math.max(0, Number(state.consecutiveFailures) || 0) + 1;
  const cooldownSeconds = failures === 1 ? 15 * 60 : failures === 2 ? 60 * 60 : 6 * 60 * 60;
  writeState({
    version: 1,
    consecutiveFailures: failures,
    cooldownUntil: new Date(now + cooldownSeconds * 1000).toISOString(),
    lastFailureAt: new Date(now).toISOString(),
  });
  process.exit(0);
}

console.error(`unknown command: ${command}`);
process.exit(64);
