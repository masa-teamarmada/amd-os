import { test } from "node:test";
import assert from "node:assert/strict";
import { SECURITY_HEADERS } from "../server/lib/security.mjs";

function getDirective(csp, name) {
  const match = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
  return match ? match.slice(name.length + 1) : null;
}

test("CSP connect-src allows self, vercel.com, and the blob storage wildcard", () => {
  const csp = SECURITY_HEADERS["Content-Security-Policy"];
  const connectSrc = getDirective(csp, "connect-src");
  assert.ok(connectSrc, "connect-src directive must be present");

  const sources = connectSrc.split(/\s+/);
  assert.ok(sources.includes("'self'"), "connect-src must include 'self'");
  assert.ok(sources.includes("https://vercel.com"), "connect-src must include https://vercel.com");
  assert.ok(
    sources.includes("https://*.blob.vercel-storage.com"),
    "connect-src must include the blob storage wildcard"
  );
});

test("CSP connect-src does not use a broad wildcard", () => {
  const csp = SECURITY_HEADERS["Content-Security-Policy"];
  const connectSrc = getDirective(csp, "connect-src");
  assert.ok(connectSrc, "connect-src directive must be present");
  assert.ok(!connectSrc.split(/\s+/).includes("*"), "connect-src must not include a bare '*' wildcard");
});
