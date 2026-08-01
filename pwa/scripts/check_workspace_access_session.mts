// Pure test: HMAC sign/verify for the workspace session cookie — tamper + expiry.
// No DB, no Next.js runtime. Run: npm run test:workspace-access-session

import assert from "node:assert/strict";
import {
  signWorkspaceSessionValue,
  verifyWorkspaceSessionValue,
} from "../src/lib/workspace-access-session-core.ts";

const SECRET = "test-secret-value-not-real";
const NOW = 1_700_000_000;

// Valid round-trip.
{
  const value = signWorkspaceSessionValue({ accountId: "acct-1", email: "Foo@Example.com" }, SECRET, NOW);
  const verified = verifyWorkspaceSessionValue(value, SECRET, NOW);
  assert.ok(verified, "expected a valid signed cookie to verify");
  assert.equal(verified.accountId, "acct-1");
  assert.equal(verified.email, "foo@example.com");
  assert.equal(verified.version, 1);
}

// Wrong secret must fail (tamper via re-signing with a different key).
{
  const value = signWorkspaceSessionValue({ accountId: "acct-1", email: "a@b.com" }, SECRET, NOW);
  assert.equal(verifyWorkspaceSessionValue(value, "wrong-secret", NOW), null, "wrong secret must not verify");
}

// Tampered payload (flip a char in the base64url payload segment) must fail.
{
  const value = signWorkspaceSessionValue({ accountId: "acct-1", email: "a@b.com" }, SECRET, NOW);
  const [encoded, sig] = value.split(".");
  const tamperedChar = encoded[0] === "a" ? "b" : "a";
  const tampered = `${tamperedChar}${encoded.slice(1)}.${sig}`;
  assert.equal(verifyWorkspaceSessionValue(tampered, SECRET, NOW), null, "tampered payload must not verify");
}

// Tampered signature must fail.
{
  const value = signWorkspaceSessionValue({ accountId: "acct-1", email: "a@b.com" }, SECRET, NOW);
  const [encoded, sig] = value.split(".");
  const tamperedSig = sig.split("").reverse().join("") + "x";
  assert.equal(verifyWorkspaceSessionValue(`${encoded}.${tamperedSig}`, SECRET, NOW), null, "tampered signature must not verify");
}

// Expiry: valid at issue time, rejected once past MAX_AGE.
{
  const value = signWorkspaceSessionValue({ accountId: "acct-1", email: "a@b.com" }, SECRET, NOW);
  assert.ok(verifyWorkspaceSessionValue(value, SECRET, NOW), "should verify immediately after signing");
  assert.ok(verifyWorkspaceSessionValue(value, SECRET, NOW + 60 * 60 * 24 * 7 - 1), "should still verify just before 7d");
  assert.equal(
    verifyWorkspaceSessionValue(value, SECRET, NOW + 60 * 60 * 24 * 7 + 1),
    null,
    "should be rejected once past 7d expiry",
  );
}

// Malformed inputs must all fail closed.
{
  assert.equal(verifyWorkspaceSessionValue(null, SECRET, NOW), null);
  assert.equal(verifyWorkspaceSessionValue(undefined, SECRET, NOW), null);
  assert.equal(verifyWorkspaceSessionValue("", SECRET, NOW), null);
  assert.equal(verifyWorkspaceSessionValue("no-dot-here", SECRET, NOW), null);
  assert.equal(verifyWorkspaceSessionValue("a.b.c", SECRET, NOW), null);
  assert.equal(verifyWorkspaceSessionValue("not-base64!!!.also-not", SECRET, NOW), null);
}

console.log("check_workspace_access_session.mts: OK");
