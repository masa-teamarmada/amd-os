import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hmac,
  signSession,
  verifySessionToken,
  passwordsMatch,
  passwordDigest,
  parseCookies,
  parseAllowedEmails,
  isEmailAllowed,
  normalizeEmail,
  buildSessionCookie,
  buildClearCookie,
  isAuthenticated,
  COOKIE_NAME,
} from "../server/lib/auth.mjs";

const SECRET = "test-secret-value";
const PASSWORD = "correct horse";
const EMAIL = "user@example.com";
const ALLOWED_EMAILS = [EMAIL];

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  User@Example.com "), "user@example.com");
  assert.equal(normalizeEmail(null), "");
  assert.equal(normalizeEmail(undefined), "");
});

test("parseAllowedEmails handles comma/semicolon/whitespace/newline delimiters", () => {
  const raw = "a@example.com, B@example.com;\nc@example.com   d@example.com";
  assert.deepEqual(parseAllowedEmails(raw), [
    "a@example.com",
    "b@example.com",
    "c@example.com",
    "d@example.com",
  ]);
});

test("parseAllowedEmails dedupes case-insensitively", () => {
  const raw = "a@example.com,A@Example.com,b@example.com";
  assert.deepEqual(parseAllowedEmails(raw), ["a@example.com", "b@example.com"]);
});

test("parseAllowedEmails rejects the entire configuration if any entry is invalid", () => {
  const raw = "a@example.com,not-an-email,b@example.com";
  assert.deepEqual(parseAllowedEmails(raw), []);
});

test("parseAllowedEmails returns empty array for non-string input", () => {
  assert.deepEqual(parseAllowedEmails(undefined), []);
  assert.deepEqual(parseAllowedEmails(""), []);
});

test("isEmailAllowed matches case-insensitively against the allow list", () => {
  assert.equal(isEmailAllowed(ALLOWED_EMAILS, "user@example.com"), true);
  assert.equal(isEmailAllowed(ALLOWED_EMAILS, "  USER@EXAMPLE.COM  "), true);
  assert.equal(isEmailAllowed(ALLOWED_EMAILS, "other@example.com"), false);
  assert.equal(isEmailAllowed(ALLOWED_EMAILS, ""), false);
});

test("signSession/verifySessionToken round-trip succeeds before expiry", () => {
  const expiresAt = Date.now() + 60_000;
  const token = signSession(SECRET, { email: EMAIL, expiresAt, passwordDigest: passwordDigest(SECRET, PASSWORD) });
  const payload = verifySessionToken(SECRET, token);
  assert.ok(payload);
  assert.equal(payload.email, EMAIL);
});

test("verifySessionToken rejects expired session", () => {
  const expiresAt = Date.now() - 1000;
  const token = signSession(SECRET, { email: EMAIL, expiresAt, passwordDigest: passwordDigest(SECRET, PASSWORD) });
  assert.equal(verifySessionToken(SECRET, token), null);
});

test("verifySessionToken rejects tampered payload", () => {
  const expiresAt = Date.now() + 60_000;
  const token = signSession(SECRET, { email: EMAIL, expiresAt, passwordDigest: passwordDigest(SECRET, PASSWORD) });
  const dotIndex = token.lastIndexOf(".");
  const sig = token.slice(dotIndex + 1);
  const tamperedPayload = Buffer.from(
    JSON.stringify({ email: "attacker@example.com", expiresAt, passwordDigest: passwordDigest(SECRET, PASSWORD) }),
    "utf8",
  ).toString("base64url");
  assert.equal(verifySessionToken(SECRET, `${tamperedPayload}.${sig}`), null);
});

test("verifySessionToken rejects wrong secret", () => {
  const expiresAt = Date.now() + 60_000;
  const token = signSession(SECRET, { email: EMAIL, expiresAt, passwordDigest: passwordDigest(SECRET, PASSWORD) });
  assert.equal(verifySessionToken("different-secret", token), null);
});

test("verifySessionToken rejects the legacy expiry-only cookie format", () => {
  const legacyPayload = String(Date.now() + 60_000);
  assert.equal(verifySessionToken(SECRET, `${legacyPayload}.${hmac(SECRET, legacyPayload)}`), null);
});

test("verifySessionToken rejects malformed cookie values", () => {
  assert.equal(verifySessionToken(SECRET, ""), null);
  assert.equal(verifySessionToken(SECRET, null), null);
  assert.equal(verifySessionToken(SECRET, "no-dot-here"), null);
  assert.equal(verifySessionToken(SECRET, "123.not-hex"), null);
  assert.equal(verifySessionToken(SECRET, "abc.deadbeef"), null);
});

test("passwordsMatch is true only for the correct password", () => {
  assert.equal(passwordsMatch(SECRET, PASSWORD, PASSWORD), true);
  assert.equal(passwordsMatch(SECRET, "wrong", PASSWORD), false);
  assert.equal(passwordsMatch(SECRET, "", PASSWORD), false);
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
  const cookie = buildSessionCookie(SECRET, { email: EMAIL, password: PASSWORD });
  const cookieValue = cookie.split(";")[0];
  const req = { headers: { cookie: cookieValue } };
  assert.equal(isAuthenticated(req, SECRET, { password: PASSWORD, allowedEmails: ALLOWED_EMAILS }), true);
});

test("isAuthenticated is false without a cookie header", () => {
  const req = { headers: {} };
  assert.equal(isAuthenticated(req, SECRET, { password: PASSWORD, allowedEmails: ALLOWED_EMAILS }), false);
});

test("isAuthenticated is false once the email is removed from the allow list", () => {
  const cookie = buildSessionCookie(SECRET, { email: EMAIL, password: PASSWORD });
  const cookieValue = cookie.split(";")[0];
  const req = { headers: { cookie: cookieValue } };
  assert.equal(isAuthenticated(req, SECRET, { password: PASSWORD, allowedEmails: [] }), false);
});

test("isAuthenticated is false after the password changes", () => {
  const cookie = buildSessionCookie(SECRET, { email: EMAIL, password: PASSWORD });
  const cookieValue = cookie.split(";")[0];
  const req = { headers: { cookie: cookieValue } };
  assert.equal(
    isAuthenticated(req, SECRET, { password: "a new password", allowedEmails: ALLOWED_EMAILS }),
    false,
  );
});

test("isAuthenticated is false for a tampered cookie", () => {
  const cookie = buildSessionCookie(SECRET, { email: EMAIL, password: PASSWORD });
  const cookieValue = `${COOKIE_NAME}=tampered-value`;
  void cookie;
  const req = { headers: { cookie: cookieValue } };
  assert.equal(isAuthenticated(req, SECRET, { password: PASSWORD, allowedEmails: ALLOWED_EMAILS }), false);
});

test("buildClearCookie expires immediately", () => {
  const cookie = buildClearCookie();
  assert.match(cookie, new RegExp(`^${COOKIE_NAME}=;`));
  assert.match(cookie, /Max-Age=0/);
});

test("buildSessionCookie sets a 30 day Max-Age", () => {
  const cookie = buildSessionCookie(SECRET, { email: EMAIL, password: PASSWORD });
  assert.match(cookie, /Max-Age=2592000/);
});
