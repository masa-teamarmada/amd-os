import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

test("portal catch-all owns the instance routes", () => {
  assert.equal(config.rewrites.length, 1);
  assert.deepEqual(config.rewrites[0], { source: "/(.*)", destination: "/api/index" });
});

test("the function build check only requires generic portal assets", () => {
  assert.match(config.buildCommand, /server\/brand-data\.mjs/);
  assert.doesNotMatch(config.buildCommand, /deck|psi|agventure/i);
  assert.equal(config.functions["api/index.mjs"].includeFiles, "node_modules/@fontsource-variable/noto-sans-jp/**");
});
