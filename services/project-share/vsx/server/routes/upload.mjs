import { handleUpload } from "@vercel/blob/client";
import { isWithinFilesPrefix } from "../lib/pathGuard.mjs";
import { isSameOrigin } from "../lib/origin.mjs";
import { readJsonBody } from "../lib/body.mjs";
import { sendJson, sendText } from "../lib/respond.mjs";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export async function handleUploadRoute(req, res, { isAuthed, handleUploadFn = handleUpload }) {
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

  try {
    const result = await handleUploadFn({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!isWithinFilesPrefix(pathname)) {
          throw new Error("invalid file name");
        }
        return {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
        };
      },
    });
    sendJson(res, 200, result);
  } catch {
    sendJson(res, 400, { error: "upload failed" });
  }
}
