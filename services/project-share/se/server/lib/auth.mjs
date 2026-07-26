import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "se_auth";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function hmac(secret, value) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!HEX64_RE.test(a) || !HEX64_RE.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function signSession(secret, expiresAt) {
  const payload = String(expiresAt);
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifySession(secret, cookieValue) {
  if (!cookieValue) return false;
  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex <= 0) return false;
  const payload = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);
  const expected = hmac(secret, payload);
  if (!safeEqualHex(sig, expected)) return false;
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function passwordsMatch(secret, submitted, expected) {
  const submittedDigest = hmac(secret, submitted ?? "");
  const expectedDigest = hmac(secret, expected);
  return safeEqualHex(submittedDigest, expectedDigest);
}

export function isAuthenticated(req, secret) {
  const cookies = parseCookies(req.headers.cookie);
  return verifySession(secret, cookies[COOKIE_NAME]);
}

export function buildSessionCookie(secret) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const sessionValue = signSession(secret, expiresAt);
  return `${COOKIE_NAME}=${encodeURIComponent(sessionValue)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function buildClearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
