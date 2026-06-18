#!/usr/bin/env node
import fs from "node:fs";
import { reviewMeetingSummaries } from "./lib/h1_meeting_summary_reviewer.mjs";

function readInput() {
  const fixtureIndex = process.argv.indexOf("--fixture");
  if (fixtureIndex !== -1) {
    const file = process.argv[fixtureIndex + 1];
    if (!file) throw new Error("--fixture requires a path");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  const stdin = fs.readFileSync(0, "utf8").trim();
  if (!stdin) throw new Error("JSON input required on stdin or --fixture");
  return JSON.parse(stdin);
}

const input = readInput();
const meetings = Array.isArray(input) ? input : input.meetings ?? input.items ?? [input];
const items = reviewMeetingSummaries(meetings);
const reportJa = buildJapaneseReport(meetings.length, items);

if (process.argv.includes("--human-ja")) {
  process.stdout.write(reportJa);
  process.stdout.write("\n");
  process.exit(0);
}

process.stdout.write(JSON.stringify({
  ok: true,
  reviewed: meetings.length,
  flagged: items.length,
  report_ja: reportJa,
  items,
}, null, 2));
process.stdout.write("\n");

function buildJapaneseReport(reviewed, flaggedItems) {
  const lines = [
    `確認件数: ${reviewed}`,
    `要確認件数: ${flaggedItems.length}`,
  ];

  if (flaggedItems.length === 0) {
    lines.push("H-1レビュアー: 重大な落ちは検知なし");
    return lines.join("\n");
  }

  lines.push("H-1レビュアー: 要確認あり");
  for (const item of flaggedItems) {
    const ref = item.source_hash ? ` (${item.source_hash})` : "";
    lines.push(`- ${item.title}${ref}`);
  }
  return lines.join("\n");
}
