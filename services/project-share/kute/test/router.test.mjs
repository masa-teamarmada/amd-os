import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/index.mjs";
import { buildSessionCookie } from "../server/lib/auth.mjs";
import { makeReq, makeRes } from "./helpers/fakeHttp.mjs";

const PASSWORD = "s3cret-password";
const SECRET = "router-test-secret";

function withEnv(fn) {
  return async () => {
    const prevPassword = process.env.KUTE_ACCESS_PASSWORD;
    const prevSecret = process.env.KUTE_AUTH_SECRET;
    process.env.KUTE_ACCESS_PASSWORD = PASSWORD;
    process.env.KUTE_AUTH_SECRET = SECRET;
    try {
      await fn();
    } finally {
      process.env.KUTE_ACCESS_PASSWORD = prevPassword;
      process.env.KUTE_AUTH_SECRET = prevSecret;
    }
  };
}

function authCookieHeader() {
  return buildSessionCookie(SECRET).split(";")[0];
}

test(
  "returns 503 when auth environment variables are not configured",
  async () => {
    delete process.env.KUTE_ACCESS_PASSWORD;
    delete process.env.KUTE_AUTH_SECRET;
    const req = makeReq({ method: "GET", url: "/" });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 503);
  }
);

test(
  "GET / without a session cookie returns the login page",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/" });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /パスワード/);
    assert.doesNotMatch(res.body, /file-rows/);
  })
);

test(
  "POST / with the wrong password returns 401 and no cookie",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://kute.example.com",
        host: "kute.example.com",
      },
      body: "password=nope",
    });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers["Set-Cookie"], undefined);
  })
);

test(
  "POST / with the correct password sets a session cookie and redirects to the portal",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://kute.example.com",
        host: "kute.example.com",
      },
      body: `password=${PASSWORD}`,
    });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 303);
    assert.equal(res.headers.Location, "/");
    assert.match(res.headers["Set-Cookie"], /kute_auth=/);
  })
);

test(
  "POST / from a cross-origin request with the correct password sets a session cookie and redirects",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://evil.example.com",
      },
      body: `password=${PASSWORD}`,
    });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 303);
    assert.equal(res.headers.Location, "/");
    assert.match(res.headers["Set-Cookie"], /kute_auth=/);
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
      body: "password=nope",
    });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers["Set-Cookie"], undefined);
  })
);

test(
  "GET / with a valid session cookie returns the portal",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/", headers: { cookie: authCookieHeader() } });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /file-rows/);
  })
);

test(
  "unknown routes return 404",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/nope" });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 404);
  })
);

test(
  "GET /api/files without auth returns 401",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/api/files" });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  })
);

test(
  "POST /api/links without auth returns 401",
  withEnv(async () => {
    const req = makeReq({ method: "POST", url: "/api/links", body: { url: "https://example.com", name: "", folder: "" } });
    const res = makeRes();
    await handler(req, res);
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
      body: { pathname: "kute/files/deck.pdf" },
    });
    const res = makeRes();
    await handler(req, res);
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
        origin: "https://kute.example.com",
        "content-type": "application/json",
      },
      body: { pathname: "../etc/passwd" },
    });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
  })
);

test(
  "POST /api/logout without a same-origin header returns 403",
  withEnv(async () => {
    const req = makeReq({ method: "POST", url: "/api/logout", headers: {} });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 403);
  })
);

test(
  "POST /api/logout from the same origin clears the session cookie",
  withEnv(async () => {
    const req = makeReq({
      method: "POST",
      url: "/api/logout",
      headers: { origin: "https://kute.example.com", cookie: authCookieHeader() },
    });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Set-Cookie"], /Max-Age=0/);
  })
);

test(
  "GET /api/logout (wrong method) returns 405",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/api/logout" });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, "POST");
  })
);

test(
  "every response carries the shared security headers",
  withEnv(async () => {
    const req = makeReq({ method: "GET", url: "/" });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
    assert.equal(res.headers["X-Frame-Options"], "DENY");
    assert.ok(res.headers["Content-Security-Policy"]);
  })
);
