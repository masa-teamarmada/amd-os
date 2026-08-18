import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cockpit = await readFile(
  new URL("../src/components/cockpit/CockpitKuteSeeds.tsx", import.meta.url),
  "utf8",
);

assert.match(cockpit, />シーズ状態<\/th>/);
assert.match(cockpit, /SEED_STATUS_LABEL\[seed\.status\]/);
assert.match(cockpit, /seed\.status === "spun_off" \? projectLink\.venture_name \?\? projectLink\.project_name/);
assert.doesNotMatch(cockpit, /\{realized \? "PJ化済み"/);
assert.doesNotMatch(cockpit, /\{projectLink\.project_name\} · \{projectLink\.project_status\}/);

console.log("seed list display contract: OK");
