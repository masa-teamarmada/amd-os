// Pure HMAC sign/verify for the workspace email-auth session cookie.
// No "server-only" / next/headers here on purpose: this module must be importable
// from a plain Node test script (see scripts/check_workspace_access_session.mts).

import { createHmac, timingSafeEqual } from "node:crypto";

export const WORKSPACE_SESSION_COOKIE = "amd_os_workspace_session";
export const WORKSPACE_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7d

export type WorkspaceSessionPayload = {
  version: 1;
  accountId: string;
  email: string;
  expiresAt: number;
};

// Domain-separated from other HMAC cookies (e.g. amd_os_project_session) that may
// share the same underlying secret, so a signature can't be replayed across cookies.
const HMAC_DOMAIN = "amd_os_workspace_session:v1";

function signature(secret: string, payload: string) {
  return createHmac("sha256", secret).update(`${HMAC_DOMAIN}:${payload}`).digest("base64url");
}

export function signWorkspaceSessionValue(
  input: { accountId: string; email: string },
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const payload: WorkspaceSessionPayload = {
    version: 1,
    accountId: input.accountId,
    email: input.email.toLowerCase(),
    expiresAt: nowSeconds + WORKSPACE_SESSION_MAX_AGE,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(secret, encoded)}`;
}

export function verifyWorkspaceSessionValue(
  value: string | undefined | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): WorkspaceSessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSignature] = parts;
  if (!encoded || !providedSignature) return null;

  const expectedSignature = signature(secret, encoded);
  const provided = Buffer.from(providedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  let parsed: Partial<WorkspaceSessionPayload>;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    parsed.version !== 1 ||
    typeof parsed.accountId !== "string" ||
    !parsed.accountId ||
    typeof parsed.email !== "string" ||
    !parsed.email ||
    typeof parsed.expiresAt !== "number" ||
    parsed.expiresAt <= nowSeconds
  ) {
    return null;
  }

  return parsed as WorkspaceSessionPayload;
}
