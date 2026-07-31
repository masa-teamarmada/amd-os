import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createOnlineLink,
  defaultOnlineLinkName,
  hasOnlineLinksInFolder,
  listOnlineLinks,
  moveOnlineLink,
  normalizeOnlineUrl,
  OnlineLinkValidationError,
  renameOnlineLink,
} from "../server/lib/linkStore.mjs";

const LINK_ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_LINK_ID = "123e4567-e89b-42d3-a456-426614174001";

function jsonResult(value) {
  return {
    statusCode: 200,
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(value)));
        controller.close();
      },
    }),
  };
}

function storedLink(overrides = {}) {
  return {
    id: LINK_ID,
    url: "https://docs.example.com/folder/proposal",
    name: "事業計画",
    folder: "",
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    ...overrides,
  };
}

test("online link URLs accept only credential-free http or https URLs", () => {
  assert.equal(normalizeOnlineUrl(" https://docs.example.com/share?id=1 "), "https://docs.example.com/share?id=1");
  assert.equal(normalizeOnlineUrl("http://example.com"), "http://example.com/");
  assert.equal(normalizeOnlineUrl("javascript:alert(1)"), null);
  assert.equal(normalizeOnlineUrl("data:text/plain,nope"), null);
  assert.equal(normalizeOnlineUrl("file:///Users/masa/example.pdf"), null);
  assert.equal(normalizeOnlineUrl("https://user:pass@example.com/file"), null);
});

test("online link fallback names use a safe host and final URL path segment", () => {
  assert.equal(defaultOnlineLinkName("https://docs.example.com/folder/proposal"), "docs.example.com · proposal");
  assert.equal(defaultOnlineLinkName("https://docs.example.com/"), "docs.example.com");
});

test("createOnlineLink stores private metadata outside the files prefix and returns a public link entry", async () => {
  let written = null;
  const link = await createOnlineLink(
    { url: "https://drive.google.com/file/d/abc/view", name: "", folder: "meeting" },
    {
      randomUUIDFn: () => LINK_ID,
      putFn: async (pathname, body, options) => {
        written = { pathname, body, options };
      },
    }
  );

  assert.equal(written.pathname, "se/links/" + LINK_ID + ".json");
  assert.equal(written.options.access, "private");
  assert.equal(written.options.addRandomSuffix, false);
  assert.equal(written.options.allowOverwrite, false);
  assert.equal(written.options.contentType, "application/json; charset=utf-8");
  const stored = JSON.parse(written.body);
  assert.equal(stored.folder, "meeting");
  assert.equal(stored.url, "https://drive.google.com/file/d/abc/view");
  assert.equal(stored.name, "drive.google.com · view");
  assert.equal(link.kind, "link");
  assert.equal(link.id, LINK_ID);
  assert.equal(link.size, null);
  assert.equal("pathname" in link, false);
});

test("createOnlineLink rejects invalid folder paths and unsafe URLs", async () => {
  await assert.rejects(
    () => createOnlineLink({ url: "javascript:alert(1)", name: "", folder: "" }, { randomUUIDFn: () => LINK_ID, putFn: async () => {} }),
    OnlineLinkValidationError
  );
  await assert.rejects(
    () => createOnlineLink({ url: "https://example.com", name: "", folder: "../outside" }, { randomUUIDFn: () => LINK_ID, putFn: async () => {} }),
    OnlineLinkValidationError
  );
});

test("listOnlineLinks returns only records in the requested folder and never exposes a Blob pathname", async () => {
  const records = new Map([
    [LINK_ID, storedLink()],
    [OTHER_LINK_ID, storedLink({ id: OTHER_LINK_ID, folder: "reports", name: "報告書" })],
  ]);
  const listFn = async (options) => {
    assert.equal(options.prefix, "se/links/");
    return {
      blobs: [
        { pathname: "se/links/" + LINK_ID + ".json" },
        { pathname: "se/links/" + OTHER_LINK_ID + ".json" },
        { pathname: "se/links/not-a-record.txt" },
      ],
      hasMore: false,
    };
  };
  const getFn = async (pathname, options) => {
    assert.equal(options.access, "private");
    return jsonResult(records.get(pathname.slice("se/links/".length, -".json".length)));
  };

  const links = await listOnlineLinks("", { listFn, getFn });
  assert.equal(links.length, 1);
  assert.equal(links[0].id, LINK_ID);
  assert.equal(links[0].name, "事業計画");
  assert.equal(links[0].url, "https://docs.example.com/folder/proposal");
  assert.equal("pathname" in links[0], false);
});

test("hasOnlineLinksInFolder blocks deletion for a link in the folder or a nested folder", async () => {
  const listFn = async () => ({
    blobs: [{ pathname: "se/links/" + LINK_ID + ".json" }],
    hasMore: false,
  });
  const getFn = async () => jsonResult(storedLink({ folder: "reports/2026" }));
  assert.equal(await hasOnlineLinksInFolder("reports", { listFn, getFn }), true);
  assert.equal(await hasOnlineLinksInFolder("archive", { listFn, getFn }), false);
});

test("renameOnlineLink and moveOnlineLink overwrite only the link metadata record", async () => {
  const current = storedLink();
  const writes = [];
  const getFn = async () => jsonResult(current);
  const putFn = async (pathname, body, options) => {
    writes.push({ pathname, value: JSON.parse(body), options });
  };

  const renamed = await renameOnlineLink(LINK_ID, "最終事業計画", { getFn, putFn });
  assert.equal(renamed.name, "最終事業計画");
  assert.equal(writes[0].pathname, "se/links/" + LINK_ID + ".json");
  assert.equal(writes[0].value.url, current.url);
  assert.equal(writes[0].options.allowOverwrite, true);

  const moved = await moveOnlineLink(LINK_ID, "reports", { getFn, putFn });
  assert.equal(moved.name, current.name);
  assert.equal(writes[1].value.folder, "reports");
  assert.equal(writes[1].value.url, current.url);
});
