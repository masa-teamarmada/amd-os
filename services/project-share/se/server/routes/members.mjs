import {
  addMember,
  listMembers,
  MemberAlreadyExistsError,
  MemberNotFoundError,
  MemberValidationError,
  removeMember,
} from "../lib/memberStore.mjs";
import { isSameOrigin } from "../lib/origin.mjs";
import { readJsonBody } from "../lib/body.mjs";
import { sendJson, sendText } from "../lib/respond.mjs";
import { isEmailAllowed, passwordsMatch } from "../lib/auth.mjs";

function sendMemberError(res, err, fallback) {
  if (err instanceof MemberValidationError) {
    sendJson(res, 400, { error: "invalid email address" });
    return;
  }
  if (err instanceof MemberAlreadyExistsError) {
    sendJson(res, 409, { error: "email is already registered" });
    return;
  }
  if (err instanceof MemberNotFoundError) {
    sendJson(res, 404, { error: "email was not found" });
    return;
  }
  sendJson(res, 502, { error: fallback });
}

export async function handleMembersRoute(
  req,
  res,
  {
    isAuthed,
    secret,
    adminPassword,
    initialEmails,
    listMembersFn = listMembers,
    addMemberFn = addMember,
    removeMemberFn = removeMember,
  }
) {
  if (!isAuthed) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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

  if (!passwordsMatch(secret, body.adminPassword, adminPassword)) {
    sendJson(res, 401, { error: "invalid admin password" });
    return;
  }

  const action = body.action;

  if (action === "list") {
    try {
      const members = await listMembersFn({ secret });
      sendJson(res, 200, {
        ok: true,
        initialEmails: [...initialEmails],
        members,
      });
    } catch {
      sendJson(res, 502, { error: "failed to list members" });
    }
    return;
  }

  if (action === "add") {
    if (isEmailAllowed(initialEmails, body.email)) {
      sendJson(res, 409, { error: "email is already registered" });
      return;
    }
    try {
      const member = await addMemberFn(body.email, { secret });
      sendJson(res, 201, { ok: true, member });
    } catch (err) {
      sendMemberError(res, err, "failed to add member");
    }
    return;
  }

  if (action === "remove") {
    if (isEmailAllowed(initialEmails, body.email)) {
      sendJson(res, 403, { error: "initial registrations cannot be removed" });
      return;
    }
    try {
      await removeMemberFn(body.email, { secret });
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendMemberError(res, err, "failed to remove member");
    }
    return;
  }

  sendJson(res, 400, { error: "invalid action" });
}
