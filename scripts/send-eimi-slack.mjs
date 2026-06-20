#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV_PATH = path.resolve(__dirname, "../pwa/.env.local");
const EIMI_POST_FUNCTION = "slackNotifyPostToChannelTsukuyomi_";

function usage() {
  console.error([
    "Usage:",
    "  send-eimi-slack.mjs --channel <C...|U...> --text <message>",
    "  send-eimi-slack.mjs --channel <C...|U...> --file <message.txt>",
    "  printf '%s\\n' 'message' | send-eimi-slack.mjs --channel <C...|U...> --stdin",
    "",
    "Examples:",
    "  scripts/send-eimi-slack.mjs --channel C04QB6F7YPN --text 'えいみ名義テスト'",
    "  scripts/send-eimi-slack.mjs --channel C0B3KB8L7B5 --file /tmp/kute-message.txt",
  ].join("\n"));
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return "";
  return String(process.argv[idx + 1] || "");
}

function hasArg(name) {
  return process.argv.includes(name);
}

function parseEnvFile(envPath) {
  const env = {};
  const text = fs.readFileSync(envPath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  if (hasArg("--help") || hasArg("-h")) {
    usage();
    return;
  }

  const envPath = getArg("--env") || DEFAULT_ENV_PATH;
  const channelId = getArg("--channel").trim();
  const textArg = getArg("--text");
  const fileArg = getArg("--file");

  if (!channelId) {
    usage();
    throw new Error("--channel is required");
  }

  let message = "";
  if (textArg) {
    message = textArg;
  } else if (fileArg) {
    message = fs.readFileSync(fileArg, "utf8");
  } else if (hasArg("--stdin") || !process.stdin.isTTY) {
    message = await readStdin();
  }

  message = String(message || "").trim();
  if (!message) {
    usage();
    throw new Error("message is empty");
  }

  const env = parseEnvFile(envPath);
  const gasUrl = env.NEXT_PUBLIC_GAS_WEBAPP_URL;
  const authKey = env.NEXT_PUBLIC_GAS_API_KEY || env.PWA_API_KEY || env.CRON_SECRET;

  if (!gasUrl) throw new Error(`NEXT_PUBLIC_GAS_WEBAPP_URL is missing in ${envPath}`);
  if (!authKey) throw new Error(`GAS auth key is missing in ${envPath}`);

  const endpoint = `${gasUrl}?mode=pwaApi&key=${encodeURIComponent(authKey)}&action=runFunc`;
  const body = JSON.stringify({
    fn: EIMI_POST_FUNCTION,
    args: [channelId, { text: message }],
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const raw = await res.text();

  let obj = null;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error(`GAS returned non-JSON response: ${raw.slice(0, 300)}`);
  }

  const result = obj && obj.data && obj.data.result ? obj.data.result : null;
  if (!obj.ok || !result || result.ok !== true) {
    throw new Error(`Eimi Slack post failed: ${JSON.stringify(obj).slice(0, 1000)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    persona: "eimi",
    channel: result.channel || channelId,
    ts: result.ts || "",
  }));
}

main().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exitCode = 1;
});
