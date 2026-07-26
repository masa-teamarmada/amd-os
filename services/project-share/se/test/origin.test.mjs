import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin } from "../server/lib/origin.mjs";

test("isSameOrigin accepts a matching Origin header", () => {
  const req = { headers: { host: "se.example.com", origin: "https://se.example.com" } };
  assert.equal(isSameOrigin(req), true);
});

test("isSameOrigin rejects a cross-origin Origin header", () => {
  const req = { headers: { host: "se.example.com", origin: "https://evil.example.com" } };
  assert.equal(isSameOrigin(req), false);
});

test("isSameOrigin falls back to Referer when Origin is absent", () => {
  const req = { headers: { host: "se.example.com", referer: "https://se.example.com/some/page" } };
  assert.equal(isSameOrigin(req), true);
});

test("isSameOrigin rejects a cross-origin Referer", () => {
  const req = { headers: { host: "se.example.com", referer: "https://evil.example.com/some/page" } };
  assert.equal(isSameOrigin(req), false);
});

test("isSameOrigin rejects when neither Origin nor Referer is present", () => {
  const req = { headers: { host: "se.example.com" } };
  assert.equal(isSameOrigin(req), false);
});

test("isSameOrigin rejects malformed Origin values", () => {
  const req = { headers: { host: "se.example.com", origin: "not-a-url" } };
  assert.equal(isSameOrigin(req), false);
});

test("isSameOrigin uses x-forwarded-host when present", () => {
  const req = {
    headers: {
      host: "internal-host:3000",
      "x-forwarded-host": "se.example.com",
      origin: "https://se.example.com",
    },
  };
  assert.equal(isSameOrigin(req), true);
});

test("isSameOrigin rejects when host header is missing", () => {
  const req = { headers: { origin: "https://se.example.com" } };
  assert.equal(isSameOrigin(req), false);
});
