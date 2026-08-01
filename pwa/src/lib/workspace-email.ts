// Pure email normalization/validation shared by /api/auth/email-start and /auth/callback.
// Mirrors the DB-side `email_normalized` generated column (lower(btrim(email))) in
// workspace_user_accounts so lookups always agree with what Postgres computed.

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeWorkspaceEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 320) return null;
  if (!SIMPLE_EMAIL_PATTERN.test(trimmed)) return null;
  return trimmed;
}
