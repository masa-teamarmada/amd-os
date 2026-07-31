import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);

test("PSI review routes are proxied before the portal catch-all", () => {
  const rewrites = config.rewrites;
  const catchAllIndex = rewrites.findIndex((rule) => rule.source === "/(.*)");
  const requiredSources = [
    "/psi-step2",
    "/_next/:path*",
    "/api/session",
    "/api/participants",
    "/api/comments",
    "/api/comments/:path*",
    "/api/reactions",
    "/cover-illustration.png",
    "/logo-symbol.png",
    "/logo-type.png",
  ];

  assert.ok(catchAllIndex >= 0, "portal catch-all rewrite must exist");
  for (const source of requiredSources) {
    const index = rewrites.findIndex((rule) => rule.source === source);
    assert.ok(index >= 0, `${source} rewrite must exist`);
    assert.ok(index < catchAllIndex, `${source} must precede the portal catch-all`);
    assert.match(
      rewrites[index].destination,
      /^https:\/\/vsx-psi-step2-review\.vercel\.app\//,
    );
  }
});

test("portal API routes remain owned by the portal function", () => {
  const proxiedSources = new Set(config.rewrites.map((rule) => rule.source));
  for (const source of ["/api/files", "/api/folders", "/api/upload", "/api/access", "/api/pdf", "/api/view", "/api/logout"]) {
    assert.equal(proxiedSources.has(source), false);
  }
  assert.equal(config.rewrites.at(-1).destination, "/api/index");
});

test("the function includes the Japanese PDF font files", () => {
  assert.equal(config.functions["api/index.mjs"].includeFiles, "node_modules/@fontsource-variable/noto-sans-jp/**");
});
