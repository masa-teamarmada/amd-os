import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const routePath = fileURLToPath(
  new URL("../src/app/api/cron/proactive-todo-extract/route.ts", import.meta.url),
);
const source = readFileSync(routePath, "utf8");

assert.doesNotMatch(
  source,
  /trigger_kind:\s*"next_meeting_prep"/,
  "next_meeting_prep must not be inserted or upserted again",
);
assert.doesNotMatch(
  source,
  /\.eq\("source_kinds",\s*"upcoming"\)/,
  "the proactive cron must not scan upcoming meetings for prep TODOs",
);
assert.match(
  source,
  /status:\s*"dismissed"[\s\S]*?\.eq\("trigger_kind",\s*"next_meeting_prep"\)[\s\S]*?\.in\("status",\s*\["open",\s*"blocked"\]\)/,
  "legacy open or blocked prep TODOs must be retired to dismissed",
);
assert.match(
  source,
  /resolved_by:\s*"system"[\s\S]*?resolved_note:\s*"MTG prepをCodexへ一本化したため自動退役"/,
  "retired prep TODOs must keep an auditable system resolution",
);

console.log("proactive MTG prep retirement contract: OK");
