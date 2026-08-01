import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "vsx_deck_auth";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hmac(secret, value) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!HEX64_RE.test(a) || !HEX64_RE.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function parseAllowedEmails(raw) {
  if (typeof raw !== "string") return [];
  const normalized = raw
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter((email) => email.length > 0);
  if (normalized.some((email) => email.length > 254 || !EMAIL_RE.test(email))) return [];
  return [...new Set(normalized)];
}

export function isEmailAllowed(allowedEmails, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return allowedEmails.includes(normalized);
}

export function passwordDigest(secret, password) {
  return hmac(secret, `pwd:${password ?? ""}`);
}

export function passwordsMatch(secret, submitted, expected) {
  const submittedDigest = hmac(secret, submitted ?? "");
  const expectedDigest = hmac(secret, expected);
  return safeEqualHex(submittedDigest, expectedDigest);
}

function encodeSessionPayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeSessionPayload(encoded) {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.email === "string" &&
      Number.isFinite(parsed.expiresAt) &&
      typeof parsed.passwordDigest === "string"
    ) {
      return parsed;
    }
  } catch {
    // malformed cookie payload: treat as unauthenticated
  }
  return null;
}

export function signSession(secret, payload) {
  const encoded = encodeSessionPayload(payload);
  return `${encoded}.${hmac(secret, encoded)}`;
}

export function verifySessionToken(secret, cookieValue) {
  if (typeof cookieValue !== "string" || !cookieValue) return null;
  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  const encoded = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);
  if (!safeEqualHex(sig, hmac(secret, encoded))) return null;
  const payload = decodeSessionPayload(encoded);
  if (!payload) return null;
  if (Date.now() >= payload.expiresAt) return null;
  return payload;
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

export function isAuthenticated(req, secret, { password, allowedEmails }) {
  const cookies = parseCookies(req.headers.cookie);
  const session = verifySessionToken(secret, cookies[COOKIE_NAME]);
  if (!session) return false;
  if (!isEmailAllowed(allowedEmails, session.email)) return false;
  return safeEqualHex(session.passwordDigest, passwordDigest(secret, password));
}

export function buildSessionCookie(secret, { email, password }) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const sessionValue = signSession(secret, {
    email: normalizeEmail(email),
    expiresAt,
    passwordDigest: passwordDigest(secret, password),
  });
  return `${COOKIE_NAME}=${encodeURIComponent(sessionValue)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function buildClearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
