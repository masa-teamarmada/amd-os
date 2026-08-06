import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/index.mjs";
import { buildSessionCookie } from "../server/lib/auth.mjs";
import { makeReq, makeRes } from "./helpers/fakeHttp.mjs";

const PASSWORD = "s3cret-password";
const SECRET = "folders-test-secret";
const EMAIL = "user@example.com";
const ADMIN_PASSWORD = "admin-only-secret";

function withEnv(fn) {
  return async () => {
    const prevPassword = process.env.SX_ACCESS_PASSWORD;
    const prevSecret = process.env.SX_AUTH_SECRET;
    const prevAllowedEmails = process.env.SX_ALLOWED_EMAILS;
    const prevAdminPassword = process.env.SX_ADMIN_PASSWORD;
    process.env.SX_ACCESS_PASSWORD = PASSWORD;
    process.env.SX_AUTH_SECRET = SECRET;
    process.env.SX_ALLOWED_EMAILS = EMAIL;
    process.env.SX_ADMIN_PASSWORD = ADMIN_PASSWORD;
    try {
      await fn();
    } finally {
      process.env.SX_ACCESS_PASSWORD = prevPassword;
      process.env.SX_AUTH_SECRET = prevSecret;
      if (prevAllowedEmails === undefined) {
        delete process.env.SX_ALLOWED_EMAILS;
      } else {
        process.env.SX_ALLOWED_EMAILS = prevAllowedEmails;
      }
      if (prevAdminPassword === undefined) {
        delete process.env.SX_ADMIN_PASSWORD;
      } else {
        process.env.SX_ADMIN_PASSWORD = prevAdminPassword;
      }
    }
  };
}

function authCookieHeader() {
  return buildSessionCookie(SECRET, { email: EMAIL, password: PASSWORD }).split(";")[0];
}

test(
  "POST /api/folders without auth returns 401",
  withEnv(async () => {
    const req = makeReq({ method: "POST", url: "/api/folders", body: { parentPath: "", name: "reports" } });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 401);
  })
);

test(
  "POST /api/folders cross-origin returns 403",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/api/folders",
      headers: {
        cookie: authCookieHeader(),
        origin: "https://evil.example.com",
        "content-type": "application/json",
      },
      body: { parentPath: "", name: "reports" },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 403);
  })
);

test(
  "POST /api/folders with an invalid name returns 400",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/api/folders",
      headers: {
        cookie: authCookieHeader(),
        origin: "https://sx.example.com",
        "content-type": "application/json",
      },
      body: { parentPath: "", name: "../etc" },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 400);
  })
);

test(
  "POST /api/folders with the reserved .folder name returns 400",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/api/folders",
      headers: {
        cookie: authCookieHeader(),
        origin: "https://sx.example.com",
        "content-type": "application/json",
      },
      body: { parentPath: "", name: ".folder" },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 400);
  })
);

test(
  "GET /api/folders (wrong method) returns 405 with Allow POST, DELETE",
  withEnv(async () => {
    const req = makeReq({
      method: "GET",
      url: "/api/folders",
      headers: { cookie: authCookieHeader() },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, "POST, DELETE");
  })
);

test(
  "DELETE /api/folders with the root path returns 400",
  withEnv(async () => {
    const req = makeReq({
      method: "DELETE",
      url: "/api/folders",
      headers: {
        cookie: authCookieHeader(),
        origin: "https://sx.example.com",
        "content-type": "application/json",
      },
      body: { folderPath: "" },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 400);
  })
);

test(
  "DELETE /api/folders keeps a folder when it contains an online link",
  withEnv(async () => {
    let deleted = false;
    const req = makeReq({
      method: "DELETE",
      url: "/api/folders",
      headers: {
        cookie: authCookieHeader(),
        origin: "https://sx.example.com",
        "content-type": "application/json",
      },
      body: { folderPath: "reports" },
    });
    const res = makeRes();
    const { handleFoldersRoute } = await import("../server/routes/folders.mjs");
    await handleFoldersRoute(req, res, {
      isAuthed: true,
      hasOnlineLinksInFolderFn: async () => true,
      deleteEmptyFolderFn: async () => {
        deleted = true;
      },
    });
    assert.equal(res.statusCode, 409);
    assert.equal(deleted, false);
  })
);

test(
  "GET /api/files with an invalid folder query returns 400",
  withEnv(async () => {
    const req = makeReq({
      method: "GET",
      url: "/api/files?folder=..%2Fetc",
      headers: { cookie: authCookieHeader() },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 400);
  })
);
