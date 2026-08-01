// Pure test: local-only "next" redirect path validation (open-redirect prevention).
// No DB, no Next.js runtime. Run: npm run test:workspace-next-path

import assert from "node:assert/strict";
import { isSafeLocalNextPath, sanitizeNextPath } from "../src/lib/workspace-next-path.ts";

// Accepted: plain local paths.
for (const ok of ["/", "/mypage", "/venture-map/amd-score", "/a/b?c=1&d=2", "/a#frag"]) {
  assert.equal(isSafeLocalNextPath(ok), true, `expected accepted: ${ok}`);
  assert.equal(sanitizeNextPath(ok), ok);
}

// Rejected: protocol-relative / smuggled absolute URLs / non-string / control chars.
const rejected = [
  "//evil.com",
  "/\\evil.com",
  "/http://evil.com",
  "/HTTPS://evil.com",
  "http://evil.com",
  "https://evil.com/a",
  "evil.com",
  "",
  "   ",
  "/a\nb",
  "/a\tb",
  "/a b",
  null,
  undefined,
  42,
  {},
  ["/a"],
];
for (const bad of rejected) {
  assert.equal(isSafeLocalNextPath(bad), false, `expected rejected: ${JSON.stringify(bad)}`);
  assert.equal(sanitizeNextPath(bad), "/", `expected sanitize fallback to '/': ${JSON.stringify(bad)}`);
}

console.log("check_workspace_next_path.mts: OK");
