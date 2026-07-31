import { test } from "node:test";
import assert from "node:assert/strict";
import { handleLinksRoute } from "../server/routes/links.mjs";
import { makeReq, makeRes } from "./helpers/fakeHttp.mjs";

const LINK_ID = "123e4567-e89b-42d3-a456-426614174000";

test("online link route requires authentication", async () => {
  const req = makeReq({ method: "POST", url: "/api/links", body: { url: "https://example.com", name: "", folder: "" } });
  const res = makeRes();
  await handleLinksRoute(req, res, { isAuthed: false });
  assert.equal(res.statusCode, 401);
});

test("online link route rejects cross-origin writes", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/links",
    headers: { origin: "https://evil.example.com", "content-type": "application/json" },
    body: { url: "https://example.com", name: "", folder: "" },
  });
  const res = makeRes();
  await handleLinksRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 403);
});

test("online link route rejects unsafe URLs before reaching Blob storage", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/links",
    headers: { origin: "https://cx.example.com", "content-type": "application/json" },
    body: { url: "javascript:alert(1)", name: "", folder: "" },
  });
  const res = makeRes();
  await handleLinksRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 400);
});

test("online link route rejects JSON values that are not objects", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/links",
    headers: { origin: "https://cx.example.com", "content-type": "application/json" },
    body: null,
  });
  const res = makeRes();
  await handleLinksRoute(req, res, { isAuthed: true });
  assert.equal(res.statusCode, 400);
});

test("online link route creates a link in the requested folder", async () => {
  let captured = null;
  const req = makeReq({
    method: "POST",
    url: "/api/links",
    headers: { origin: "https://cx.example.com", "content-type": "application/json" },
    body: { url: "https://docs.example.com/share", name: "共有資料", folder: "meeting" },
  });
  const res = makeRes();
  await handleLinksRoute(req, res, {
    isAuthed: true,
    createOnlineLinkFn: async (value) => {
      captured = value;
      return { kind: "link", id: LINK_ID, name: value.name, url: value.url, size: null, uploadedAt: "2026-07-31T00:00:00.000Z" };
    },
  });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(captured, { url: "https://docs.example.com/share", name: "共有資料", folder: "meeting" });
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.link.kind, "link");
  assert.equal(body.link.id, LINK_ID);
});

test("online link route renames and moves by ID", async () => {
  const renameReq = makeReq({
    method: "PATCH",
    url: "/api/links",
    headers: { origin: "https://cx.example.com", "content-type": "application/json" },
    body: { id: LINK_ID, newName: "更新後資料" },
  });
  const renameRes = makeRes();
  await handleLinksRoute(renameReq, renameRes, {
    isAuthed: true,
    renameOnlineLinkFn: async (id, name) => ({ kind: "link", id, name, url: "https://example.com", size: null, uploadedAt: "2026-07-31T00:00:00.000Z" }),
  });
  assert.equal(renameRes.statusCode, 200);
  assert.equal(JSON.parse(renameRes.body).link.name, "更新後資料");

  const moveReq = makeReq({
    method: "PATCH",
    url: "/api/links",
    headers: { origin: "https://cx.example.com", "content-type": "application/json" },
    body: { id: LINK_ID, targetFolder: "reports" },
  });
  const moveRes = makeRes();
  await handleLinksRoute(moveReq, moveRes, {
    isAuthed: true,
    moveOnlineLinkFn: async (id, folder) => ({ kind: "link", id, name: "資料", url: "https://example.com", folder, size: null, uploadedAt: "2026-07-31T00:00:00.000Z" }),
  });
  assert.equal(moveRes.statusCode, 200);
  assert.equal(JSON.parse(moveRes.body).link.folder, "reports");
});

test("online link route deletes by ID and rejects unsupported methods", async () => {
  let deletedId = null;
  const deleteReq = makeReq({
    method: "DELETE",
    url: "/api/links",
    headers: { origin: "https://cx.example.com", "content-type": "application/json" },
    body: { id: LINK_ID },
  });
  const deleteRes = makeRes();
  await handleLinksRoute(deleteReq, deleteRes, {
    isAuthed: true,
    deleteOnlineLinkFn: async (id) => {
      deletedId = id;
    },
  });
  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deletedId, LINK_ID);

  const wrongReq = makeReq({ method: "GET", url: "/api/links" });
  const wrongRes = makeRes();
  await handleLinksRoute(wrongReq, wrongRes, { isAuthed: true });
  assert.equal(wrongRes.statusCode, 405);
  assert.equal(wrongRes.headers.Allow, "POST, PATCH, DELETE");
});
