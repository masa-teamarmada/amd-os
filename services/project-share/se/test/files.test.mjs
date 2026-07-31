import { test } from "node:test";
import assert from "node:assert/strict";
import { handleFilesRoute } from "../server/routes/files.mjs";
import { SameLocationError, DestinationExistsError } from "../server/lib/blobStore.mjs";
import { makeReq, makeRes } from "./helpers/fakeHttp.mjs";

test("GET /api/files returns ordinary files and online links in one authenticated listing", async () => {
  const req = makeReq({ method: "GET", url: "/api/files?folder=meeting" });
  const res = makeRes();
  await handleFilesRoute(req, res, {
    isAuthed: true,
    listDirectoryFn: async (folder) => {
      assert.equal(folder, "meeting");
      return {
        folders: [{ name: "archive", path: "meeting/archive" }],
        files: [{ pathname: "se/files/meeting/deck.pdf", name: "deck.pdf", size: 12, uploadedAt: "2026-07-31T00:00:00.000Z" }],
      };
    },
    listOnlineLinksFn: async (folder) => {
      assert.equal(folder, "meeting");
      return [{ kind: "link", id: "123e4567-e89b-42d3-a456-426614174000", name: "外部資料", url: "https://example.com", size: null, uploadedAt: "2026-07-31T01:00:00.000Z" }];
    },
  });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.folders.length, 1);
  assert.equal(body.files.length, 2);
  assert.equal(body.files[1].kind, "link");
  assert.equal("pathname" in body.files[1], false);
});

test("PATCH /api/files requires authentication", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    body: { pathname: "se/files/deck.pdf", targetFolder: "reports" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, { isAuthed: false });
  assert.equal(res.statusCode, 401);
});

test("PATCH /api/files rejects a cross-origin request", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: {
      origin: "https://evil.example.com",
      "content-type": "application/json",
    },
    body: { pathname: "se/files/deck.pdf", targetFolder: "reports" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 403);
});

test("PATCH /api/files rejects an invalid JSON body", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: "{not json",
  });
  const res = makeRes();
  await handleFilesRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 400);
});

test("PATCH /api/files rejects a source pathname outside the files prefix", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { pathname: "other/deck.pdf", targetFolder: "reports" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 400);
});

test("PATCH /api/files rejects a missing pathname", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { targetFolder: "reports" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 400);
});

test("PATCH /api/files rejects a target folder with path traversal", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { pathname: "se/files/deck.pdf", targetFolder: "../etc" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 400);
});

test("PATCH /api/files moves the file and returns the new pathname on success", async () => {
  let capturedArgs = null;
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { pathname: "se/files/deck.pdf", targetFolder: "reports" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, {
    isAuthed: true,
    moveFileFn: async (pathname, targetFolder) => {
      capturedArgs = { pathname, targetFolder };
      return { pathname: "se/files/reports/deck.pdf" };
    },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(capturedArgs, { pathname: "se/files/deck.pdf", targetFolder: "reports" });
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.pathname, "se/files/reports/deck.pdf");
  assert.equal("url" in body, false);
});

test("PATCH /api/files renames the file and returns the new pathname on success", async () => {
  let capturedArgs = null;
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { pathname: "se/files/deck.pdf", newName: "deck-final.pdf" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, {
    isAuthed: true,
    renameFileFn: async (pathname, newName) => {
      capturedArgs = { pathname, newName };
      return { pathname: "se/files/deck-final.pdf" };
    },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(capturedArgs, { pathname: "se/files/deck.pdf", newName: "deck-final.pdf" });
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.pathname, "se/files/deck-final.pdf");
});

test("PATCH /api/files rejects an invalid rename name", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { pathname: "se/files/deck.pdf", newName: "../etc" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 400);
});

test("PATCH /api/files returns 409 when the rename destination exists", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { pathname: "se/files/deck.pdf", newName: "renamed.pdf" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, {
    isAuthed: true,
    renameFileFn: async () => {
      throw new DestinationExistsError();
    },
  });
  assert.equal(res.statusCode, 409);
});

test("PATCH /api/files returns 409 when a same-named file already exists at the destination", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { pathname: "se/files/deck.pdf", targetFolder: "reports" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, {
    isAuthed: true,
    moveFileFn: async () => {
      throw new DestinationExistsError();
    },
  });
  assert.equal(res.statusCode, 409);
});

test("PATCH /api/files returns 400 when the destination is the same location as the source", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { pathname: "se/files/reports/deck.pdf", targetFolder: "reports" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, {
    isAuthed: true,
    moveFileFn: async () => {
      throw new SameLocationError();
    },
  });
  assert.equal(res.statusCode, 400);
});

test("PATCH /api/files returns 502 on an unexpected storage failure", async () => {
  const req = makeReq({
    method: "PATCH",
    url: "/api/files",
    headers: { origin: "https://se.example.com", "content-type": "application/json" },
    body: { pathname: "se/files/deck.pdf", targetFolder: "reports" },
  });
  const res = makeRes();
  await handleFilesRoute(req, res, {
    isAuthed: true,
    moveFileFn: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(res.statusCode, 502);
});

test("unsupported /api/files method returns 405 with an Allow header listing PATCH", async () => {
  const req = makeReq({ method: "POST", url: "/api/files", headers: {} });
  const res = makeRes();
  await handleFilesRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "GET, DELETE, PATCH");
});
