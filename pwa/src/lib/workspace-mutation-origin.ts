import "server-only";

/**
 * Cookie-authenticated workspace mutations are browser-only operations.
 * Accept an exact Origin match, or Fetch Metadata's same-origin signal when a browser
 * legitimately omits Origin. Conflicting or missing evidence fails closed.
 */
export function isSameOriginWorkspaceMutation(request: Request): boolean {
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    try {
      if (new URL(originHeader).origin !== expectedOrigin) return false;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  if (originHeader) return true;
  if (fetchSite === "same-origin") return true;

  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}
