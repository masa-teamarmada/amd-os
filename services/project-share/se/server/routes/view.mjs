import { createSignedAccessUrl } from "../lib/blobStore.mjs";
import { isWithinFilesPrefix } from "../lib/pathGuard.mjs";
import { sendJson, sendText } from "../lib/respond.mjs";

const VIEW_CSP = [
  "sandbox allow-scripts allow-popups allow-top-navigation-by-user-activation",
  "default-src 'none'",
  "script-src 'unsafe-inline' https:",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "font-src data: https:",
  "media-src blob: https:",
  "connect-src https:",
  "frame-ancestors 'none'",
].join("; ");

export async function handleViewRoute(
  req,
  res,
  { isAuthed, createSignedAccessUrlFn = createSignedAccessUrl, fetchFn = fetch }
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!isAuthed) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const pathname = new URL(req.url, "http://internal").searchParams.get("pathname");
  if (!pathname || !isWithinFilesPrefix(pathname)) {
    sendJson(res, 400, { error: "invalid pathname" });
    return;
  }

  try {
    const { url } = await createSignedAccessUrlFn(pathname, { download: false });
    const upstream = await fetchFn(url);
    if (!upstream.ok || !upstream.body) {
      sendJson(res, 502, { error: "failed to read file" });
      return;
    }

    const name = pathname.split("/").at(-1);
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Security-Policy", VIEW_CSP);
    if (contentLength) res.setHeader("Content-Length", contentLength);

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch {
    sendJson(res, 502, { error: "failed to read file" });
  }
}
