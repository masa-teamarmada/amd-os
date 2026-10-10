// Each email attempt owns its PKCE cookie. Google login or a second email request
// must not overwrite the verifier for a link already delivered to the user.
export function workspaceEmailCookieName(attempt: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attempt)) return null;
  return `sb-workspace-${attempt.toLowerCase()}-auth-token`;
}

export function workspaceEmailLanding(next: string, hasWorkspace: boolean, hasDd: boolean, institutionSlugs: readonly string[] = []) {
  const available = hasWorkspace ? "/workspaces" : hasDd ? "/dd" : "/";
  if (next === "/") return available;
  const institution = next.match(/^\/workspace\/([^/?]+)(?:[/?]|$)/);
  if (institution) {
    try {
      if (!institutionSlugs.includes(decodeURIComponent(institution[1]))) return available;
    } catch {
      return available;
    }
  }
  if (next === "/workspaces" && !hasWorkspace && hasDd) return "/dd";
  return next;
}
