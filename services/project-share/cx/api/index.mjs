import { applySecurityHeaders } from "../server/lib/security.mjs";
import { isAuthenticated, parseAllowedEmails } from "../server/lib/auth.mjs";
import { sendText } from "../server/lib/respond.mjs";
import { handleLoginRoute } from "../server/routes/login.mjs";
import { handleFilesRoute } from "../server/routes/files.mjs";
import { handleLinksRoute } from "../server/routes/links.mjs";
import { handleFoldersRoute } from "../server/routes/folders.mjs";
import { handleUploadRoute } from "../server/routes/upload.mjs";
import { handleAccessRoute } from "../server/routes/access.mjs";
import { handlePdfRoute } from "../server/routes/pdf.mjs";
import { handleViewRoute } from "../server/routes/view.mjs";
import { handleLogoutRoute } from "../server/routes/logout.mjs";

export default async function handler(req, res) {
  const password = process.env.CX_ACCESS_PASSWORD;
  const secret = process.env.CX_AUTH_SECRET;
  const allowedEmails = parseAllowedEmails(process.env.CX_ALLOWED_EMAILS);

  applySecurityHeaders(res);

  if (!password || !secret || allowedEmails.length === 0) {
    sendText(res, 503, "Service unavailable: authentication is not configured.");
    return;
  }

  const pathname = (() => {
    try {
      return new URL(req.url, "http://internal").pathname;
    } catch {
      return req.url || "/";
    }
  })();

  const isAuthed = isAuthenticated(req, secret, { password, allowedEmails });

  if (pathname === "/") {
    await handleLoginRoute(req, res, { password, secret, allowedEmails, isAuthed });
    return;
  }

  if (pathname === "/api/files") {
    await handleFilesRoute(req, res, { isAuthed });
    return;
  }

  if (pathname === "/api/links") {
    await handleLinksRoute(req, res, { isAuthed });
    return;
  }

  if (pathname === "/api/folders") {
    await handleFoldersRoute(req, res, { isAuthed });
    return;
  }

  if (pathname === "/api/upload") {
    await handleUploadRoute(req, res, { isAuthed });
    return;
  }

  if (pathname === "/api/access") {
    await handleAccessRoute(req, res, { isAuthed });
    return;
  }

  if (pathname === "/api/pdf") {
    await handlePdfRoute(req, res, { isAuthed });
    return;
  }

  if (pathname === "/api/view") {
    await handleViewRoute(req, res, { isAuthed });
    return;
  }

  if (pathname === "/api/logout") {
    await handleLogoutRoute(req, res);
    return;
  }

  sendText(res, 404, "Not Found");
}
