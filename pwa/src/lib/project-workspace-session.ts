import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const PROJECT_WORKSPACE_SESSION_COOKIE = "amd_os_project_session";
export const PROJECT_WORKSPACE_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type ProjectWorkspaceSession = {
  version: 1;
  memberId: string;
  email: string;
  expiresAt: number;
};

function sessionSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for project workspace sessions");
  return secret;
}
function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createProjectWorkspaceSessionValue(input: { memberId: string; email: string }) {
  const payload: ProjectWorkspaceSession = {
    version: 1,
    memberId: input.memberId,
    email: input.email.toLowerCase(),
    expiresAt: Math.floor(Date.now() / 1000) + PROJECT_WORKSPACE_SESSION_MAX_AGE,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyProjectWorkspaceSessionValue(value: string | undefined | null): ProjectWorkspaceSession | null {
  if (!value) return null;
  const [encoded, providedSignature, ...rest] = value.split(".");
  if (!encoded || !providedSignature || rest.length > 0) return null;

  const expectedSignature = signature(encoded);
  const provided = Buffer.from(providedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<ProjectWorkspaceSession>;
    if (
      parsed.version !== 1
      || typeof parsed.memberId !== "string"
      || typeof parsed.email !== "string"
      || typeof parsed.expiresAt !== "number"
      || parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;
    return parsed as ProjectWorkspaceSession;
  } catch {
    return null;
  }
}

export async function getProjectWorkspaceSession() {
  const cookieStore = await cookies();
  return verifyProjectWorkspaceSessionValue(cookieStore.get(PROJECT_WORKSPACE_SESSION_COOKIE)?.value);
}
