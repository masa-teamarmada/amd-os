import { createSignedAccessUrl } from "../lib/blobStore.mjs";
import { isWithinFilesPrefix } from "../lib/pathGuard.mjs";
import { isSameOrigin } from "../lib/origin.mjs";
import { readJsonBody } from "../lib/body.mjs";
import { sendJson, sendText } from "../lib/respond.mjs";

export async function handleAccessRoute(
  req,
  res,
  { isAuthed, createSignedAccessUrlFn = createSignedAccessUrl }
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!isAuthed) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (!isSameOrigin(req)) {
    sendJson(res, 403, { error: "cross-origin request rejected" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  const pathname = typeof body.pathname === "string" ? body.pathname : null;
  if (!pathname || !isWithinFilesPrefix(pathname)) {
    sendJson(res, 400, { error: "invalid pathname" });
    return;
  }

  try {
    const download = body.download === true;
    const { url, expiresAt } = await createSignedAccessUrlFn(pathname, { download });
    sendJson(res, 200, { url, expiresAt });
  } catch {
    sendJson(res, 502, { error: "failed to issue access url" });
  }
}
