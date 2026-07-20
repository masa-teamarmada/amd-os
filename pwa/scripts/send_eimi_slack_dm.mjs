#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(PWA_ROOT, "..");

loadEnv(path.join(PWA_ROOT, ".env.local"));
loadEnv(path.join(PWA_ROOT, ".env.production.local"));
loadEnv(path.join(REPO_ROOT, ".vercel", ".env.production.local"));
loadEnv(path.join(PWA_ROOT, ".vercel", ".env.production.local"));

const args = parseArgs(process.argv.slice(2));

async function main() {
  const userId = String(args["user-id"] || "").trim();
  const text = readText(args).trim();
  if (!/^U[A-Z0-9]+$/.test(userId)) throw new Error("Slack user id is invalid");
  if (!text) throw new Error("DM body is empty");
  if (text.length > 1200) throw new Error("DM body is too long");
  assertSanitized(text);

  const token = String(process.env.SLACK_EIMI_BOT_TOKEN || "").trim();
  if (!token) throw new Error("SLACK_EIMI_BOT_TOKEN is unavailable");

  const auth = await callSlack(token, "auth.test", {});
  if (String(auth.user || "").trim().toLowerCase() !== "eimi") {
    throw new Error("Configured Slack bot is not えいみ");
  }

  const channel = await callSlack(token, "conversations.open", { users: userId });
  const channelId = String(channel?.channel?.id || "").trim();
  if (!channelId) throw new Error("Could not open Slack DM");

  const sent = await callSlack(token, "chat.postMessage", {
    channel: channelId,
    text,
  });

  process.stdout.write(`${JSON.stringify({ ok: true, sender: "えいみ", message_ts: sent.ts || null })}\n`);
}

async function callSlack(token, method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.ok !== true) {
    throw new Error(`Slack ${method} failed`);
  }
  return payload;
}

function readText(parsedArgs) {
  if (parsedArgs["body-file"]) return fs.readFileSync(String(parsedArgs["body-file"]), "utf8");
  return String(parsedArgs.text || "");
}

function assertSanitized(text) {
  const forbidden = [
    /https?:\/\//i,
    /drive\.google\.com/i,
    /docs\.google\.com/i,
    /notion\.so/i,
    /calendar\.google\.com/i,
    /meet\.google\.com/i,
    /zoom\.us/i,
    /passcode|password|secret|token/i,
  ];
  if (forbidden.some((pattern) => pattern.test(text))) {
    throw new Error("DM body may contain unsafe source detail");
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function loadEnv(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Optional env file.
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
