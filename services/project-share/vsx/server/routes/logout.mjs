import { buildClearCookie } from "../lib/auth.mjs";
import { isSameOrigin } from "../lib/origin.mjs";
import { sendJson, sendText } from "../lib/respond.mjs";

export async function handleLogoutRoute(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!isSameOrigin(req)) {
    sendJson(res, 403, { error: "cross-origin request rejected" });
    return;
  }

  res.setHeader("Set-Cookie", buildClearCookie());
  sendJson(res, 200, { ok: true });
}
