import assert from "node:assert/strict";
import { test } from "node:test";
import { handlePdfRoute } from "../server/routes/pdf.mjs";
import { makeReq, makeRes } from "./helpers/fakeHttp.mjs";

function makePdfRes() {
  const res = makeRes();
  res.end = (body) => {
    res.body = Buffer.from(body);
  };
  return res;
}

test("POST /api/pdf converts an authenticated HTML file into a private PDF download", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/pdf",
    headers: { origin: "https://vsx.example.com" },
    body: { pathname: "vsx/files/計画.HTML" },
  });
  const res = makePdfRes();

  await handlePdfRoute(req, res, {
    isAuthed: true,
    createSignedAccessUrlFn: async (pathname, options) => {
      assert.equal(pathname, "vsx/files/計画.HTML");
      assert.deepEqual(options, { download: false });
      return { url: "https://blob.example.com/signed/plan.html" };
    },
    fetchFn: async () => new Response("<main>計画</main>", { headers: { "content-type": "text/html" } }),
    renderHtmlToPdfFn: async (html) => {
      assert.match(html, /計画/);
      return Buffer.from("%PDF-test");
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.match(res.headers["Content-Disposition"], /%E8%A8%88%E7%94%BB\.pdf/);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(res.body, Buffer.from("%PDF-test"));
});

test("POST /api/pdf rejects a non-HTML or unsafe pathname", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/pdf",
    headers: { origin: "https://vsx.example.com" },
    body: { pathname: "vsx/files/plan.pdf" },
  });
  const res = makeRes();

  await handlePdfRoute(req, res, { isAuthed: true });

  assert.equal(res.statusCode, 400);
  assert.match(res.body, /invalid HTML pathname/);
});

test("POST /api/pdf requires both a session and same-origin request", async () => {
  const req = makeReq({
    method: "POST",
    url: "/api/pdf",
    headers: { origin: "https://evil.example.com" },
    body: { pathname: "vsx/files/plan.html" },
  });
  const res = makeRes();

  await handlePdfRoute(req, res, { isAuthed: true });

  assert.equal(res.statusCode, 403);
});
