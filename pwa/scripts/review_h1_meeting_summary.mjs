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

process.stdout.write(JSON.stringify({
  ok: true,
  reviewed: meetings.length,
  flagged: items.length,
  items,
}, null, 2));
process.stdout.write("\n");
