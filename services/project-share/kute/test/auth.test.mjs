import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signSession,
  verifySession,
  passwordsMatch,
  parseCookies,
  buildSessionCookie,
  buildClearCookie,
  isAuthenticated,
  COOKIE_NAME,
} from "../server/lib/auth.mjs";

const SECRET = "test-secret-value";

test("signSession/verifySession round-trip succeeds before expiry", () => {
  const expiresAt = Date.now() + 60_000;
  const token = signSession(SECRET, expiresAt);
  assert.equal(verifySession(SECRET, token), true);
});

test("verifySession rejects expired session", () => {
  const expiresAt = Date.now() - 1000;
  const token = signSession(SECRET, expiresAt);
  assert.equal(verifySession(SECRET, token), false);
});

test("verifySession rejects tampered payload", () => {
  const expiresAt = Date.now() + 60_000;
  const token = signSession(SECRET, expiresAt);
  const [, sig] = token.split(".");
  const tampered = `${expiresAt + 1000}.${sig}`;
  assert.equal(verifySession(SECRET, tampered), false);
});

test("verifySession rejects wrong secret", () => {
  const expiresAt = Date.now() + 60_000;
  const token = signSession(SECRET, expiresAt);
  assert.equal(verifySession("different-secret", token), false);
});

test("verifySession rejects malformed cookie values", () => {
  assert.equal(verifySession(SECRET, ""), false);
  assert.equal(verifySession(SECRET, null), false);
  assert.equal(verifySession(SECRET, "no-dot-here"), false);
  assert.equal(verifySession(SECRET, "123.not-hex"), false);
  assert.equal(verifySession(SECRET, "abc.deadbeef"), false);
});

test("passwordsMatch is true only for the correct password", () => {
  assert.equal(passwordsMatch(SECRET, "correct horse", "correct horse"), true);
  assert.equal(passwordsMatch(SECRET, "wrong", "correct horse"), false);
  assert.equal(passwordsMatch(SECRET, "", "correct horse"), false);
});

test("parseCookies handles multiple cookies and decoding", () => {
  const parsed = parseCookies("a=1; b=hello%20world; c=");
  assert.equal(parsed.a, "1");
  assert.equal(parsed.b, "hello world");
  assert.equal(parsed.c, "");
});

test("parseCookies returns empty object for missing header", () => {
  assert.deepEqual(parseCookies(undefined), {});
});

test("isAuthenticated reads the session cookie from request headers", () => {
  const cookie = buildSessionCookie(SECRET);
  const cookieValue = cookie.split(";")[0];
  const req = { headers: { cookie: cookieValue } };
  assert.equal(isAuthenticated(req, SECRET), true);
});

test("isAuthenticated is false without a cookie header", () => {
  const req = { headers: {} };
  assert.equal(isAuthenticated(req, SECRET), false);
});

test("buildClearCookie expires immediately", () => {
  const cookie = buildClearCookie();
  assert.match(cookie, new RegExp(`^${COOKIE_NAME}=;`));
  assert.match(cookie, /Max-Age=0/);
});
