function hostFromHeader(req) {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  return host || req.headers.host || "";
}

function originHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export function isSameOrigin(req) {
  const host = hostFromHeader(req);
  if (!host) return false;

  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    const originHostValue = originHost(origin);
    return originHostValue !== null && originHostValue === host;
  }

  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.length > 0) {
    const refererHostValue = originHost(referer);
    return refererHostValue !== null && refererHostValue === host;
  }

  return false;
}
