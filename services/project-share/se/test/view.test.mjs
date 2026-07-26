import { test } from "node:test";
import assert from "node:assert/strict";
import { handleViewRoute } from "../server/routes/view.mjs";
import { makeReq, makeRes } from "./helpers/fakeHttp.mjs";

function makeStreamingRes() {
  const res = makeRes();
  res.chunks = [];
  res.ended = false;
  res.write = (chunk) => res.chunks.push(Buffer.from(chunk));
  res.end = () => {
    res.ended = true;
  };
  return res;
}

test("GET /api/view streams an authenticated file inline under the portal origin", async () => {
  const pathname = "se/files/test-folder/review.pdf";
  const req = makeReq({ method: "GET", url: `/api/view?pathname=${encodeURIComponent(pathname)}` });
  const res = makeStreamingRes();

  await handleViewRoute(req, res, {
    isAuthed: true,
    createSignedAccessUrlFn: async () => ({ url: "https://blob.example.com/signed/review.pdf" }),
    fetchFn: async () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/pdf", "content-length": "3" },
    }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.match(res.headers["Content-Disposition"], /^inline;/);
  assert.match(res.headers["Content-Security-Policy"], /^sandbox /);
  assert.deepEqual(Buffer.concat(res.chunks), Buffer.from([1, 2, 3]));
  assert.equal(res.ended, true);
});

test("GET /api/view rejects an unsafe pathname", async () => {
  const req = makeReq({ method: "GET", url: "/api/view?pathname=..%2Fsecret" });
  const res = makeRes();

  await handleViewRoute(req, res, { isAuthed: true });

  assert.equal(res.statusCode, 400);
});

test("GET /api/view requires authentication", async () => {
  const req = makeReq({ method: "GET", url: "/api/view?pathname=se%2Ffiles%2Freview.pdf" });
  const res = makeRes();

  await handleViewRoute(req, res, { isAuthed: false });

  assert.equal(res.statusCode, 401);
});
