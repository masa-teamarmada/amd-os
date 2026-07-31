import {
  createOnlineLink,
  deleteOnlineLink,
  moveOnlineLink,
  OnlineLinkNotFoundError,
  OnlineLinkUnchangedError,
  OnlineLinkValidationError,
  renameOnlineLink,
} from "../lib/linkStore.mjs";
import { isSameOrigin } from "../lib/origin.mjs";
import { readJsonBody } from "../lib/body.mjs";
import { sendJson, sendText } from "../lib/respond.mjs";

function sendLinkError(res, err, fallback) {
  if (err instanceof OnlineLinkValidationError) {
    sendJson(res, 400, { error: "invalid online link" });
    return;
  }
  if (err instanceof OnlineLinkUnchangedError) {
    sendJson(res, 400, { error: "online link is unchanged" });
    return;
  }
  if (err instanceof OnlineLinkNotFoundError) {
    sendJson(res, 404, { error: "online link was not found" });
    return;
  }
  sendJson(res, 502, { error: fallback });
}

export async function handleLinksRoute(
  req,
  res,
  {
    isAuthed,
    createOnlineLinkFn = createOnlineLink,
    deleteOnlineLinkFn = deleteOnlineLink,
    moveOnlineLinkFn = moveOnlineLink,
    renameOnlineLinkFn = renameOnlineLink,
  }
) {
  if (!isAuthed) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (req.method !== "POST" && req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", "POST, PATCH, DELETE");
    sendText(res, 405, "Method Not Allowed");
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  if (req.method === "POST") {
    try {
      const link = await createOnlineLinkFn({
        url: body.url,
        name: body.name,
        folder: body.folder,
      });
      sendJson(res, 201, { ok: true, link });
    } catch (err) {
      sendLinkError(res, err, "failed to create online link");
    }
    return;
  }

  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    sendJson(res, 400, { error: "invalid online link" });
    return;
  }

  if (req.method === "DELETE") {
    try {
      await deleteOnlineLinkFn(id);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendLinkError(res, err, "failed to delete online link");
    }
    return;
  }

  try {
    if (Object.prototype.hasOwnProperty.call(body, "newName")) {
      const link = await renameOnlineLinkFn(id, body.newName);
      sendJson(res, 200, { ok: true, link });
      return;
    }

    const link = await moveOnlineLinkFn(id, body.targetFolder);
    sendJson(res, 200, { ok: true, link });
  } catch (err) {
    sendLinkError(res, err, "failed to update online link");
  }
}
