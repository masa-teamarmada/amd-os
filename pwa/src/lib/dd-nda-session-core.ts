import { createHmac, timingSafeEqual } from "node:crypto";
export const DD_NDA_SESSION_MAX_AGE = 60 * 60;
export type DdNdaSessionScope = { actor: string; packageId: string; promptHash: string; version: string };
const domain = "amd_os_dd_nda_entry:v1";
const signature = (encoded: string, secret: string) => createHmac("sha256", secret).update(`${domain}:${encoded}`).digest("base64url");
export function signDdNdaSession(scope: DdNdaSessionScope, secret: string, now = Math.floor(Date.now() / 1000)): string {
  const encoded = Buffer.from(JSON.stringify({ ...scope, expiresAt: now + DD_NDA_SESSION_MAX_AGE })).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}
export function verifyDdNdaSession(value: string | undefined, scope: DdNdaSessionScope, secret: string, now = Math.floor(Date.now() / 1000)): boolean {
  if (!value || value.length > 2048) return false;
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const provided = Buffer.from(parts[1]), expected = Buffer.from(signature(parts[0], secret));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    return Object.entries(scope).every(([key, field]) => payload[key] === field)
      && Number.isInteger(payload.expiresAt) && payload.expiresAt > now && payload.expiresAt <= now + DD_NDA_SESSION_MAX_AGE;
  } catch { return false; }
}
