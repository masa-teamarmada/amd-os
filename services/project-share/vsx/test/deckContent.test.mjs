import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DECK_HTML } from "../server/deck-data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceHtml = readFileSync(join(root, "content", "index.html"), "utf8");

function businessModelSection(html) {
  const match = html.match(/<div class="value-model"[\s\S]*?<p class="lead">/);
  assert.ok(match, "business model section must exist");
  return match[0];
}

test("business model entities use generated bitmap assets, not code-drawn SVG illustrations", () => {
  const section = businessModelSection(sourceHtml);

  assert.doesNotMatch(section, /<svg\b/);
  assert.match(section, /<img src="\.\/assets\/business-model-startup\.png"/);
  assert.match(section, /<img src="\.\/assets\/business-model-farmer\.png"/);
  assert.match(section, /<img src="\.\/assets\/business-model-institution\.png"/);
});

test("built deck inlines all three business model bitmap assets", () => {
  const section = businessModelSection(DECK_HTML);
  const embeddedPngs = section.match(/data:image\/png;base64,/g) ?? [];

  assert.equal(embeddedPngs.length, 3);
  assert.doesNotMatch(section, /<svg\b/);
});
