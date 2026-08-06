import { applySecurityHeaders } from "../server/lib/security.mjs";
import { isAuthenticatedAsync, parseAllowedEmails, passwordsMatch } from "../server/lib/auth.mjs";
import { hasMember } from "../server/lib/memberStore.mjs";
import { sendText } from "../server/lib/respond.mjs";
import { handleLoginRoute } from "../server/routes/login.mjs";
import { handleDeckDocumentRoute } from "../server/routes/deckDocument.mjs";
import { handleFilesRoute } from "../server/routes/files.mjs";
import { handleLinksRoute } from "../server/routes/links.mjs";
import { handleFoldersRoute } from "../server/routes/folders.mjs";
import { handleUploadRoute } from "../server/routes/upload.mjs";
import { handleAccessRoute } from "../server/routes/access.mjs";
import { handlePdfRoute } from "../server/routes/pdf.mjs";
import { handleViewRoute } from "../server/routes/view.mjs";
import { handleLogoutRoute } from "../server/routes/logout.mjs";
import { handleMembersRoute } from "../server/routes/members.mjs";

export default async function handler(req, res, { hasMemberFn } = {}) {
  const password = process.env.VSX_ACCESS_PASSWORD;
  const secret = process.env.VSX_AUTH_SECRET;
  const adminPassword = process.env.VSX_ADMIN_PASSWORD;
  const initialEmails = parseAllowedEmails(process.env.VSX_ALLOWED_EMAILS);
  const checkMember = hasMemberFn || ((email) => hasMember(email, { secret }));

  applySecurityHeaders(res);

  if (!password || !secret || initialEmails.length === 0 || !adminPassword) {
    sendText(res, 503, "Service unavailable: authentication is not configured.");
    return;
  }

  if (passwordsMatch(secret, adminPassword, password)) {
    sendText(res, 503, "Service unavailable: admin password must differ from the access password.");
    return;
  }

  const pathname = (() => {
    try {
      return new URL(req.url, "http://internal").pathname;
    } catch {
      return req.url || "/";
    }
  })();

  // Only UI-added (non-initial) members ever touch the membership backend, so
  // a Blob outage fails closed to "not authenticated" here rather than a hard
  // 503 for everyone — initial-list users are unaffected either way.
  let isAuthed = false;
  try {
    isAuthed = await isAuthenticatedAsync(req, secret, { password, initialEmails, hasMemberFn: checkMember });
  } catch {
    isAuthed = false;
  }

  if (pathname === "/") {
    await handleLoginRoute(req, res, { password, secret, initialEmails, hasMemberFn: checkMember, isAuthed });
    return;
  }

  if (pathname === "/documents/agventure-lab") {
    await handleDeckDocumentRoute(req, res, { isAuthed });
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

  if (pathname === "/api/members") {
    await handleMembersRoute(req, res, { isAuthed, secret, adminPassword, initialEmails });
    return;
  }

  sendText(res, 404, "Not Found");
}
