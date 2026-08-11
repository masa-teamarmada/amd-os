import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMembersRoute } from "../server/routes/members.mjs";
import { makeReq, makeRes } from "./helpers/fakeHttp.mjs";
import { MemberAlreadyExistsError, MemberNotFoundError, MemberValidationError } from "../server/lib/memberStore.mjs";

const SECRET = "test-secret-value";
const ADMIN_PASSWORD = "admin secret";
const INITIAL_EMAILS = ["initial@example.com"];
const ORIGIN_HEADERS = { origin: "https://vsx.example.com", "content-type": "application/json" };

function baseOpts(overrides = {}) {
  return {
    isAuthed: true,
    secret: SECRET,
    adminPassword: ADMIN_PASSWORD,
    initialEmails: INITIAL_EMAILS,
    ...overrides,
  };
}

test("members route requires authentication", async () => {
  const req = makeReq({ method: "POST", url: "/api/members", body: { action: "list" } });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts({ isAuthed: false }));
  assert.equal(res.statusCode, 401);
});

test("members route rejects unsupported methods", async () => {
  const req = makeReq({ method: "GET", url: "/api/members" });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts());
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

test("members route rejects cross-origin requests", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/members",
    headers: { origin: "https://evil.example.com", "content-type": "application/json" },
    body: { action: "list", adminPassword: ADMIN_PASSWORD },
  });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts());
  assert.equal(res.statusCode, 403);
});

test("members route rejects a wrong admin password before dispatching any action", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/members",
    headers: ORIGIN_HEADERS,
    body: { action: "list", adminPassword: "wrong" },
  });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts({
    listMembersFn: async () => {
      throw new Error("must not be called");
    },
  }));
  assert.equal(res.statusCode, 401);
});

test("members route rejects invalid JSON bodies", async () => {
  const req = makeReq({ method: "POST", url: "/api/members", headers: ORIGIN_HEADERS, body: "not-json" });
  req.headers["content-type"] = "application/json";
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts());
  assert.equal(res.statusCode, 400);
});

test("members route lists initial and registered members together", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/members",
    headers: ORIGIN_HEADERS,
    body: { action: "list", adminPassword: ADMIN_PASSWORD },
  });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts({
    listMembersFn: async () => [{ email: "added@example.com", addedAt: "2026-08-01T00:00:00.000Z" }],
  }));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.deepEqual(body.initialEmails, INITIAL_EMAILS);
  assert.equal(body.members[0].email, "added@example.com");
});

test("members route adds a member", async () => {
  let captured = null;
  const req = makeReq({
    method: "POST",
    url: "/api/members",
    headers: ORIGIN_HEADERS,
    body: { action: "add", adminPassword: ADMIN_PASSWORD, email: "new@example.com" },
  });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts({
    addMemberFn: async (email) => {
      captured = email;
      return { email, addedAt: "2026-08-01T00:00:00.000Z" };
    },
  }));
  assert.equal(res.statusCode, 201);
  assert.equal(captured, "new@example.com");
  assert.equal(JSON.parse(res.body).member.email, "new@example.com");
});

test("members route maps store errors from add to the right status codes", async () => {
  const cases = [
    [new MemberValidationError(), 400],
    [new MemberAlreadyExistsError(), 409],
  ];
  for (const [err, status] of cases) {
    const req = makeReq({
      method: "POST",
      url: "/api/members",
      headers: ORIGIN_HEADERS,
      body: { action: "add", adminPassword: ADMIN_PASSWORD, email: "new@example.com" },
    });
    const res = makeRes();
    await handleMembersRoute(req, res, baseOpts({
      addMemberFn: async () => {
        throw err;
      },
    }));
    assert.equal(res.statusCode, status);
  }
});

test("members route rejects adding an email already in the initial list, without calling the member store", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/members",
    headers: ORIGIN_HEADERS,
    body: { action: "add", adminPassword: ADMIN_PASSWORD, email: "Initial@Example.com" },
  });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts({
    addMemberFn: async () => {
      throw new Error("must not be called");
    },
  }));
  assert.equal(res.statusCode, 409);
});

test("members route removes a UI-registered member", async () => {
  let removedEmail = null;
  const req = makeReq({
    method: "POST",
    url: "/api/members",
    headers: ORIGIN_HEADERS,
    body: { action: "remove", adminPassword: ADMIN_PASSWORD, email: "added@example.com" },
  });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts({
    removeMemberFn: async (email) => {
      removedEmail = email;
    },
  }));
  assert.equal(res.statusCode, 200);
  assert.equal(removedEmail, "added@example.com");
});

test("members route refuses to remove an initial/env-registered email", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/members",
    headers: ORIGIN_HEADERS,
    body: { action: "remove", adminPassword: ADMIN_PASSWORD, email: "initial@example.com" },
  });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts({
    removeMemberFn: async () => {
      throw new Error("must not be called");
    },
  }));
  assert.equal(res.statusCode, 403);
});

test("members route returns 404 when removing a member that does not exist", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/members",
    headers: ORIGIN_HEADERS,
    body: { action: "remove", adminPassword: ADMIN_PASSWORD, email: "ghost@example.com" },
  });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts({
    removeMemberFn: async () => {
      throw new MemberNotFoundError();
    },
  }));
  assert.equal(res.statusCode, 404);
});

test("members route rejects an unknown action", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/members",
    headers: ORIGIN_HEADERS,
    body: { action: "wipe", adminPassword: ADMIN_PASSWORD },
  });
  const res = makeRes();
  await handleMembersRoute(req, res, baseOpts());
  assert.equal(res.statusCode, 400);
});
