import { normalizeWorkspaceEmail } from "./workspace-email";

// This selects a sign-in method only. Membership and access remain server-verified.
export function resolveLoginEntry(rawEmail: unknown): { email: string; method: "google" | "email" } | null {
  const email = normalizeWorkspaceEmail(rawEmail);
  if (!email) return null;
  return { email, method: email.split("@")[1] === "team-armada.jp" ? "google" : "email" };
}
