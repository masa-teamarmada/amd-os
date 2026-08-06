import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/index.mjs";
import { buildSessionCookie } from "../server/lib/auth.mjs";
import { makeReq, makeRes } from "./helpers/fakeHttp.mjs";

const PASSWORD = "s3cret-password";
const SECRET = "router-test-secret";
const EMAIL = "user@example.com";
const ADMIN_PASSWORD = "admin-only-secret";

function withEnv(fn, { allowedEmails = EMAIL } = {}) {
  return async () => {
    const prevPassword = process.env.VSX_ACCESS_PASSWORD;
    const prevSecret = process.env.VSX_AUTH_SECRET;
    const prevAllowedEmails = process.env.VSX_ALLOWED_EMAILS;
    const prevAdminPassword = process.env.VSX_ADMIN_PASSWORD;
    process.env.VSX_ACCESS_PASSWORD = PASSWORD;
    process.env.VSX_AUTH_SECRET = SECRET;
    process.env.VSX_ADMIN_PASSWORD = ADMIN_PASSWORD;
    if (allowedEmails === null) {
      delete process.env.VSX_ALLOWED_EMAILS;
    } else {
      process.env.VSX_ALLOWED_EMAILS = allowedEmails;
    }
    try {
      await fn();
    } finally {
      process.env.VSX_ACCESS_PASSWORD = prevPassword;
      process.env.VSX_AUTH_SECRET = prevSecret;
      if (prevAdminPassword === undefined) {
        delete process.env.VSX_ADMIN_PASSWORD;
      } else {
        process.env.VSX_ADMIN_PASSWORD = prevAdminPassword;
      }
      if (prevAllowedEmails === undefined) {
        delete process.env.VSX_ALLOWED_EMAILS;
      } else {
        process.env.VSX_ALLOWED_EMAILS = prevAllowedEmails;
      }
    }
  };
}

function authCookieHeader(password = PASSWORD) {
  return buildSessionCookie(SECRET, { email: EMAIL, password }).split(";")[0];
}

test(
  "returns 503 when auth environment variables are not configured",
  async () => {
    delete process.env.VSX_ACCESS_PASSWORD;
    delete process.env.VSX_AUTH_SECRET;
    delete process.env.VSX_ALLOWED_EMAILS;
    delete process.env.VSX_ADMIN_PASSWORD;
    const req = makeReq({ method: "GET", url: "/" });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 503);
  }
);

test(
  "returns 503 when the allowed email list is unset",
  withEnv(
    async () => {
      const req = makeReq({ method: "GET", url: "/" });
      const res = makeRes();
      await handler(req, res, { hasMemberFn: async () => false });
      assert.equal(res.statusCode, 503);
    },
    { allowedEmails: null }
  )
);

test(
  "returns 503 when the allowed email list is empty",
  withEnv(
    async () => {
      const req = makeReq({ method: "GET", url: "/" });
      const res = makeRes();
      await handler(req, res, { hasMemberFn: async () => false });
      assert.equal(res.statusCode, 503);
    },
    { allowedEmails: "   " }
  )
);

test(
  "returns 503 when the allowed email list contains an invalid entry",
  withEnv(
    async () => {
      const req = makeReq({ method: "GET", url: "/" });
      const res = makeRes();
      await handler(req, res, { hasMemberFn: async () => false });
      assert.equal(res.statusCode, 503);
    },
    { allowedEmails: "user@example.com,not-an-email" }
  )
);

test(
  "GET / without a session cookie returns the login page",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/" });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /type="email"/);
    assert.match(res.body, /登録済みのメールアドレスとパスワード/);
    assert.match(res.body, /パスワード/);
    assert.doesNotMatch(res.body, /file-rows/);
  })
);

test(
  "POST / with the wrong password returns 401 and no cookie, generic message",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://vsx.example.com",
        host: "vsx.example.com",
      },
      body: `email=${EMAIL}&password=nope`,
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers["Set-Cookie"], undefined);
    assert.match(res.body, /メールアドレスまたはパスワードが違います。/);
  })
);

test(
  "POST / with a disallowed email returns 401 and no cookie, generic message",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://vsx.example.com",
        host: "vsx.example.com",
      },
      body: `email=other@example.com&password=${PASSWORD}`,
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers["Set-Cookie"], undefined);
    assert.match(res.body, /メールアドレスまたはパスワードが違います。/);
  })
);

test(
  "POST / with the correct email (different case) and password sets a 30-day session cookie and redirects",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://vsx.example.com",
        host: "vsx.example.com",
      },
      body: `email=${encodeURIComponent("  USER@Example.com ")}&password=${PASSWORD}`,
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 303);
    assert.equal(res.headers.Location, "/");
    assert.match(res.headers["Set-Cookie"], /vsx_deck_auth=/);
    assert.match(res.headers["Set-Cookie"], /Max-Age=2592000/);
  })
);

test(
  "POST / from a cross-origin request with the correct credentials sets a session cookie and redirects",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://evil.example.com",
      },
      body: `email=${EMAIL}&password=${PASSWORD}`,
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 303);
    assert.equal(res.headers.Location, "/");
    assert.match(res.headers["Set-Cookie"], /vsx_deck_auth=/);
  })
);

test(
  "POST / from a cross-origin request with the wrong password returns 401 and no cookie",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://evil.example.com",
      },
      body: `email=${EMAIL}&password=nope`,
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers["Set-Cookie"], undefined);
  })
);

test(
  "GET / with a valid session cookie returns the portal",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/", headers: { cookie: authCookieHeader() } });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /file-rows/);
  })
);

test(
  "GET / with a session cookie whose email was removed from the allow list returns the login page",
  withEnv(
    async () => {
      const cookie = authCookieHeader();
      process.env.VSX_ALLOWED_EMAILS = "someone-else@example.com";
      const req = makeReq({ method: "GET", url: "/", headers: { cookie } });
      const res = makeRes();
      await handler(req, res, { hasMemberFn: async () => false });
      assert.equal(res.statusCode, 200);
      assert.doesNotMatch(res.body, /file-rows/);
    },
    { allowedEmails: EMAIL }
  )
);

test(
  "GET / with a session cookie minted under an old password returns the login page after the password changes",
  withEnv(async () => {
    const cookie = authCookieHeader();
    process.env.VSX_ACCESS_PASSWORD = "a brand new password";
    const req = makeReq({ method: "GET", url: "/", headers: { cookie } });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 200);
    assert.doesNotMatch(res.body, /file-rows/);
  })
);

test(
  "GET / with a tampered session cookie returns the login page",
  withEnv(async () => {
    const req = makeReq({
      method: "GET",
      url: "/",
      headers: { cookie: "vsx_deck_auth=not-a-valid-token" },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 200);
    assert.doesNotMatch(res.body, /file-rows/);
  })
);

test(
  "unknown routes return 404",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/nope" });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 404);
  })
);

test(
  "GET /api/files without auth returns 401",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/api/files" });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 401);
  })
);

test(
  "POST /api/links without auth returns 401",
  withEnv(async () => {
    const req = makeReq({ method: "POST", url: "/api/links", body: { url: "https://example.com", name: "", folder: "" } });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 401);
  })
);

test(
  "DELETE /api/files with a valid session but cross-origin request returns 403",
  withEnv(async () => {
    const req = makeReq({
      method: "DELETE",
      url: "/api/files",
      headers: {
        cookie: authCookieHeader(),
        origin: "https://evil.example.com",
        "content-type": "application/json",
      },
      body: { pathname: "vsx/files/deck.pdf" },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 403);
  })
);

test(
  "DELETE /api/files with an invalid pathname returns 400",
  withEnv(async () => {
    const req = makeReq({
      method: "DELETE",
      url: "/api/files",
      headers: {
        cookie: authCookieHeader(),
        origin: "https://vsx.example.com",
        "content-type": "application/json",
      },
      body: { pathname: "../etc/passwd" },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 400);
  })
);

test(
  "POST /api/logout without a same-origin header returns 403",
  withEnv(async () => {
    const req = makeReq({ method: "POST", url: "/api/logout", headers: {} });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 403);
  })
);

test(
  "POST /api/logout from the same origin clears the session cookie",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/api/logout",
      headers: { origin: "https://vsx.example.com", cookie: authCookieHeader() },
    });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Set-Cookie"], /Max-Age=0/);
  })
);

test(
  "GET /api/logout (wrong method) returns 405",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/api/logout" });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, "POST");
  })
);

test(
  "GET /documents/agventure-lab without auth redirects to /",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/documents/agventure-lab" });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, "/");
  })
);

test(
  "GET /documents/agventure-lab with auth returns the deck HTML",
  withEnv(async () => {
    const req = makeReq({
      method: "GET",
      url: "/documents/agventure-lab",
      headers: { cookie: authCookieHeader() },
    });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Content-Type"], "text/html; charset=utf-8");
  })
);

test(
  "every response carries the shared security headers",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/" });
    const res = makeRes();
    await handler(req, res, { hasMemberFn: async () => false });
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
    assert.equal(res.headers["X-Frame-Options"], "DENY");
    assert.ok(res.headers["Content-Security-Policy"]);
  })
);
