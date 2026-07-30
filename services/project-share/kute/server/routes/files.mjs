import { listDirectory, deleteFile, moveFile, renameFile, SameLocationError, DestinationExistsError } from "../lib/blobStore.mjs";
import { isWithinFilesPrefix, sanitizeBasename, sanitizeFolderPath } from "../lib/pathGuard.mjs";
import { isSameOrigin } from "../lib/origin.mjs";
import { readJsonBody } from "../lib/body.mjs";
import { sendJson, sendText } from "../lib/respond.mjs";

export async function handleFilesRoute(req, res, { isAuthed, moveFileFn = moveFile, renameFileFn = renameFile }) {
  if (!isAuthed) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (req.method === "GET") {
    const url = new URL(req.url, "http://internal");
    const rawFolder = url.searchParams.get("folder") ?? "";
    const folder = sanitizeFolderPath(rawFolder);
    if (folder === null) {
      sendJson(res, 400, { error: "invalid folder" });
      return;
    }

    try {
      const { folders, files } = await listDirectory(folder);
      sendJson(res, 200, { folder, folders, files });
    } catch {
      sendJson(res, 502, { error: "failed to list files" });
    }
    return;
  }

  if (req.method === "DELETE") {
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
      await deleteFile(pathname);
    } catch {
      sendJson(res, 502, { error: "failed to delete file" });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "PATCH") {
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

    if (Object.prototype.hasOwnProperty.call(body, "newName")) {
      const newName = typeof body.newName === "string" ? sanitizeBasename(body.newName) : null;
      if (!newName) {
        sendJson(res, 400, { error: "invalid rename request" });
        return;
      }

      try {
        const renamed = await renameFileFn(pathname, newName);
        sendJson(res, 200, { ok: true, pathname: renamed.pathname });
      } catch (err) {
        if (err instanceof SameLocationError) {
          sendJson(res, 400, { error: "same name" });
          return;
        }
        if (err instanceof DestinationExistsError) {
          sendJson(res, 409, { error: "destination already exists" });
          return;
        }
        sendJson(res, 502, { error: "failed to rename file" });
      }
      return;
    }

    const targetFolder = typeof body.targetFolder === "string" ? sanitizeFolderPath(body.targetFolder) : null;
    if (targetFolder === null) {
      sendJson(res, 400, { error: "invalid move request" });
      return;
    }

    try {
      const moved = await moveFileFn(pathname, targetFolder);
      sendJson(res, 200, { ok: true, pathname: moved.pathname });
    } catch (err) {
      if (err instanceof SameLocationError) {
        sendJson(res, 400, { error: "same location" });
        return;
      }
      if (err instanceof DestinationExistsError) {
        sendJson(res, 409, { error: "destination already exists" });
        return;
      }
      sendJson(res, 502, { error: "failed to move file" });
    }
    return;
  }

  res.setHeader("Allow", "GET, DELETE, PATCH");
  sendText(res, 405, "Method Not Allowed");
}
