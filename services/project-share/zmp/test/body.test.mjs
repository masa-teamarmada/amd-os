import { test } from "node:test";
import assert from "node:assert/strict";
import { readFormPassword, readJsonBody } from "../server/lib/body.mjs";
import { makeReq } from "./helpers/fakeHttp.mjs";

test("readFormPassword rejects an oversized Buffer body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = Buffer.alloc(9 * 1024, "a");
  await assert.rejects(() => readFormPassword(req));
});

test("readFormPassword rejects an oversized string body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = "password=" + "a".repeat(9 * 1024);
  await assert.rejects(() => readFormPassword(req));
});

test("readFormPassword rejects an oversized preparsed object body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = { password: "a".repeat(9 * 1024) };
  await assert.rejects(() => readFormPassword(req));
});

test("readFormPassword accepts a normal preparsed object body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = { password: "s3cret" };
  assert.equal(await readFormPassword(req), "s3cret");
});

test("readJsonBody rejects an oversized Buffer body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = Buffer.from(JSON.stringify({ pathname: "a".repeat(17 * 1024) }));
  await assert.rejects(() => readJsonBody(req));
});

test("readJsonBody rejects an oversized string body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = JSON.stringify({ pathname: "a".repeat(17 * 1024) });
  await assert.rejects(() => readJsonBody(req));
});

test("readJsonBody rejects an oversized preparsed object body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = { pathname: "a".repeat(17 * 1024) };
  await assert.rejects(() => readJsonBody(req));
});

test("readJsonBody accepts a normal preparsed object body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = { pathname: "zmp/files/deck.pdf" };
  const result = await readJsonBody(req);
  assert.equal(result.pathname, "zmp/files/deck.pdf");
});
