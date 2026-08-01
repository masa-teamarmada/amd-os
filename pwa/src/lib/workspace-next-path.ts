// Pure "next" redirect path validation shared by /api/auth/email-start and /auth/callback.
// Only same-origin, local paths are ever allowed — never a full URL / protocol-relative path,
// to prevent open-redirect via the workspace email-auth flow.

const DEFAULT_NEXT_PATH = "/";

function hasWhitespaceOrControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function isSafeLocalNextPath(candidate: unknown): candidate is string {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  if (!candidate.startsWith("/")) return false;
  // "//evil.com" and "/\evil.com" are browser-parsed as protocol-relative URLs.
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return false;
  // Reject embedded control chars / whitespace that some browsers still tolerate in a URL.
  if (hasWhitespaceOrControlChar(candidate)) return false;
  // Reject an absolute URL smuggled in behind a leading slash, e.g. "/http://evil.com".
  if (/^\/+[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) return false;
  return true;
}

export function sanitizeNextPath(raw: unknown): string {
  return isSafeLocalNextPath(raw) ? raw : DEFAULT_NEXT_PATH;
}
