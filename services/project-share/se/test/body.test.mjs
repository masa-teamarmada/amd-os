import { test } from "node:test";
import assert from "node:assert/strict";
import { readFormCredentials, readJsonBody } from "../server/lib/body.mjs";
import { makeReq } from "./helpers/fakeHttp.mjs";

test("readFormCredentials rejects an oversized Buffer body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = Buffer.alloc(9 * 1024, "a");
  await assert.rejects(() => readFormCredentials(req));
});

test("readFormCredentials rejects an oversized string body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = "password=" + "a".repeat(9 * 1024);
  await assert.rejects(() => readFormCredentials(req));
});

test("readFormCredentials rejects an oversized preparsed object body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = { password: "a".repeat(9 * 1024) };
  await assert.rejects(() => readFormCredentials(req));
});

test("readFormCredentials accepts a normal preparsed object body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = { email: "user@example.com", password: "s3cret" };
  const result = await readFormCredentials(req);
  assert.equal(result.email, "user@example.com");
  assert.equal(result.password, "s3cret");
});

test("readFormCredentials extracts both fields from a URL-encoded body", async () => {
  const req = makeReq({ method: "POST", url: "/" });
  req.body = "email=user%40example.com&password=s3cret";
  const result = await readFormCredentials(req);
  assert.equal(result.email, "user@example.com");
  assert.equal(result.password, "s3cret");
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
  req.body = { pathname: "se/files/deck.pdf" };
  const result = await readJsonBody(req);
  assert.equal(result.pathname, "se/files/deck.pdf");
});
