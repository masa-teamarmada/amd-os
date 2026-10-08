// Each email attempt owns its PKCE cookie. Google login or a second email request
// must not overwrite the verifier for a link already delivered to the user.
export function workspaceEmailCookieName(attempt: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attempt)) return null;
  return `sb-workspace-${attempt.toLowerCase()}-auth-token`;
}

export function workspaceEmailLanding(next: string, hasWorkspace: boolean, hasDd: boolean) {
  if (next === "/") return hasWorkspace ? "/workspaces" : hasDd ? "/dd" : next;
  if (next === "/workspaces" && !hasWorkspace && hasDd) return "/dd";
  return next;
}
