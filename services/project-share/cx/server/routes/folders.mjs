import { createFolder, deleteEmptyFolder, FolderNotEmptyError } from "../lib/blobStore.mjs";
import { hasOnlineLinksInFolder } from "../lib/linkStore.mjs";
import { sanitizeFolderPath, sanitizeBasename } from "../lib/pathGuard.mjs";
import { isSameOrigin } from "../lib/origin.mjs";
import { readJsonBody } from "../lib/body.mjs";
import { sendJson, sendText } from "../lib/respond.mjs";

export async function handleFoldersRoute(
  req,
  res,
  { isAuthed, deleteEmptyFolderFn = deleteEmptyFolder, hasOnlineLinksInFolderFn = hasOnlineLinksInFolder }
) {
  if (!isAuthed) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (req.method !== "POST" && req.method !== "DELETE") {
    res.setHeader("Allow", "POST, DELETE");
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!isSameOrigin(req)) {
    sendJson(res, 403, { error: "cross-origin request rejected" });
    return;
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "invalid JSON body" });
      return;
    }

    const parentPath = typeof body.parentPath === "string" ? sanitizeFolderPath(body.parentPath) : null;
    const name = typeof body.name === "string" ? sanitizeBasename(body.name) : null;
    if (parentPath === null || !name) {
      sendJson(res, 400, { error: "invalid folder" });
      return;
    }

    try {
      const folder = await createFolder(parentPath, name);
      sendJson(res, 201, { ok: true, folder });
    } catch {
      sendJson(res, 502, { error: "failed to create folder" });
    }
    return;
  }

  if (req.method === "DELETE") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "invalid JSON body" });
      return;
    }

    const folderPath = typeof body.folderPath === "string" ? sanitizeFolderPath(body.folderPath) : null;
    if (folderPath === null || !folderPath) {
      sendJson(res, 400, { error: "invalid folder" });
      return;
    }

    try {
      if (await hasOnlineLinksInFolderFn(folderPath)) {
        sendJson(res, 409, { error: "folder is not empty" });
        return;
      }
      await deleteEmptyFolderFn(folderPath);
    } catch (err) {
      if (err instanceof FolderNotEmptyError) {
        sendJson(res, 409, { error: "folder is not empty" });
        return;
      }
      sendJson(res, 502, { error: "failed to delete folder" });
      return;
    }
    sendJson(res, 200, { ok: true });
  }
}
