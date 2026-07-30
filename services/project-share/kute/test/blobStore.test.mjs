import { test } from "node:test";
import assert from "node:assert/strict";
import { BlobNotFoundError } from "@vercel/blob";
import {
  listFiles,
  listDirectory,
  createFolder,
  deleteEmptyFolder,
  deleteFile,
  moveFile,
  renameFile,
  createSignedAccessUrl,
  FolderNotEmptyError,
  SameLocationError,
  DestinationExistsError,
} from "../server/lib/blobStore.mjs";

test("listFiles maps blobs to name/size/uploadedAt and drops the bare prefix marker and folder objects", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const listFn = async (opts) => {
    assert.equal(opts.prefix, "kute/files/");
    return {
      blobs: [
        { pathname: "kute/files/", size: 0, uploadedAt, url: "https://example/should-not-leak" },
        { pathname: "kute/files/reports/", size: 0, uploadedAt, url: "https://example/should-not-leak" },
        { pathname: "kute/files/legacy/.folder", size: 0, uploadedAt, url: "https://example/should-not-leak" },
        { pathname: "kute/files/deck.pdf", size: 1234, uploadedAt, url: "https://example/should-not-leak" },
      ],
      hasMore: false,
    };
  };
  const files = await listFiles({ listFn });
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "deck.pdf");
  assert.equal(files[0].pathname, "kute/files/deck.pdf");
  assert.equal(files[0].size, 1234);
  assert.equal(files[0].uploadedAt, uploadedAt.toISOString());
  assert.equal("url" in files[0], false);
});

test("listDirectory returns immediate folders and files, hiding markers and nested blobs", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const listFn = async (opts) => {
    assert.equal(opts.prefix, "kute/files/");
    return {
      blobs: [
        { pathname: "kute/files/deck.pdf", size: 10, uploadedAt, url: "https://x/should-not-leak" },
        { pathname: "kute/files/reports/.folder", size: 0, uploadedAt, url: "https://x/should-not-leak" },
        { pathname: "kute/files/reports/q1.pdf", size: 20, uploadedAt, url: "https://x/should-not-leak" },
        { pathname: "kute/files/reports/nested/deep.pdf", size: 30, uploadedAt, url: "https://x/should-not-leak" },
        { pathname: "kute/files/あいう/.folder", size: 0, uploadedAt, url: "https://x/should-not-leak" },
      ],
      hasMore: false,
    };
  };

  const { folder, folders, files } = await listDirectory("", { listFn });
  assert.equal(folder, "");
  assert.equal(files.length, 1);
  assert.equal(files[0].pathname, "kute/files/deck.pdf");
  assert.equal("url" in files[0], false);

  assert.equal(folders.length, 2);
  assert.deepEqual(
    new Set(folders.map((f) => f.name)),
    new Set(["あいう", "reports"])
  );
  assert.equal(folders.find((f) => f.name === "reports").path, "reports");
});

test("listDirectory dedupes folders discovered via multiple nested blobs", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const listFn = async () => ({
    blobs: [
      { pathname: "kute/files/reports/.folder", size: 0, uploadedAt },
      { pathname: "kute/files/reports/a.pdf", size: 1, uploadedAt },
      { pathname: "kute/files/reports/nested/deep.pdf", size: 1, uploadedAt },
    ],
    hasMore: false,
  });
  const { folders } = await listDirectory("", { listFn });
  assert.equal(folders.length, 1);
  assert.equal(folders[0].name, "reports");
});

test("listDirectory scopes to a nested folder prefix and returns relative paths", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  let capturedPrefix = null;
  const listFn = async (opts) => {
    capturedPrefix = opts.prefix;
    return {
      blobs: [
        { pathname: "kute/files/reports/.folder", size: 0, uploadedAt },
        { pathname: "kute/files/reports/q1.pdf", size: 5, uploadedAt },
        { pathname: "kute/files/reports/archive/.folder", size: 0, uploadedAt },
      ],
      hasMore: false,
    };
  };
  const { folder, folders, files } = await listDirectory("reports", { listFn });
  assert.equal(capturedPrefix, "kute/files/reports/");
  assert.equal(folder, "reports");
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "q1.pdf");
  assert.equal(folders.length, 1);
  assert.equal(folders[0].path, "reports/archive");
});

test("listDirectory follows Vercel Blob pagination via hasMore/cursor", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const calls = [];
  const listFn = async (opts) => {
    calls.push(opts.cursor ?? null);
    if (!opts.cursor) {
      return {
        blobs: [{ pathname: "kute/files/a.pdf", size: 1, uploadedAt }],
        hasMore: true,
        cursor: "page2",
      };
    }
    return {
      blobs: [{ pathname: "kute/files/b.pdf", size: 2, uploadedAt }],
      hasMore: false,
    };
  };
  const { files } = await listDirectory("", { listFn });
  assert.deepEqual(calls, [null, "page2"]);
  assert.equal(files.length, 2);
});

test("listDirectory recognizes native empty folder objects (trailing-slash pathname)", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const listFn = async () => ({
    blobs: [
      { pathname: "kute/files/reports/", size: 0, uploadedAt },
      { pathname: "kute/files/deck.pdf", size: 10, uploadedAt },
    ],
    hasMore: false,
  });
  const { folders, files } = await listDirectory("", { listFn });
  assert.equal(files.length, 1);
  assert.equal(folders.length, 1);
  assert.equal(folders[0].name, "reports");
  assert.equal(folders[0].path, "reports");
});

test("listDirectory rejects invalid folder paths", async () => {
  await assert.rejects(() => listDirectory("../etc"));
});

test("createFolder creates a native private folder object using a trailing-slash pathname", async () => {
  let captured = null;
  const createFolderFn = async (pathname, options) => {
    captured = { pathname, options };
    return { pathname, url: "https://example/should-not-leak" };
  };
  const folder = await createFolder("reports", "q2", { createFolderFn });
  assert.equal(captured.pathname, "kute/files/reports/q2/");
  assert.equal(captured.options.access, "private");
  assert.deepEqual(folder, { name: "q2", path: "reports/q2" });
});

test("createFolder rejects an invalid parent path", async () => {
  await assert.rejects(() => createFolder("../etc", "q2"));
});

test("deleteEmptyFolder rejects the root path", async () => {
  await assert.rejects(() => deleteEmptyFolder(""));
});

test("deleteEmptyFolder deletes the native folder object when the folder has no other entries", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const listFn = async () => ({
    blobs: [{ pathname: "kute/files/reports/", size: 0, uploadedAt }],
    hasMore: false,
  });
  const deletedPaths = [];
  const delFn = async (pathname) => {
    deletedPaths.push(pathname);
  };
  await deleteEmptyFolder("reports", { listFn, delFn });
  assert.deepEqual(deletedPaths, ["kute/files/reports/"]);
});

test("deleteEmptyFolder deletes a legacy .folder marker when the folder has no other entries", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const listFn = async () => ({
    blobs: [{ pathname: "kute/files/reports/.folder", size: 0, uploadedAt }],
    hasMore: false,
  });
  const deletedPaths = [];
  const delFn = async (pathname) => {
    deletedPaths.push(pathname);
  };
  await deleteEmptyFolder("reports", { listFn, delFn });
  assert.deepEqual(deletedPaths, ["kute/files/reports/.folder"]);
});

test("deleteEmptyFolder deletes both the native folder object and a legacy .folder marker when both are present", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const listFn = async () => ({
    blobs: [
      { pathname: "kute/files/reports/", size: 0, uploadedAt },
      { pathname: "kute/files/reports/.folder", size: 0, uploadedAt },
    ],
    hasMore: false,
  });
  const deletedPaths = [];
  const delFn = async (pathname) => {
    deletedPaths.push(pathname);
  };
  await deleteEmptyFolder("reports", { listFn, delFn });
  assert.deepEqual(
    new Set(deletedPaths),
    new Set(["kute/files/reports/", "kute/files/reports/.folder"])
  );
});

test("deleteEmptyFolder deletes nothing when no marker or native folder object exists", async () => {
  const listFn = async () => ({ blobs: [], hasMore: false });
  const deletedPaths = [];
  const delFn = async (pathname) => {
    deletedPaths.push(pathname);
  };
  await deleteEmptyFolder("reports", { listFn, delFn });
  assert.deepEqual(deletedPaths, []);
});

test("deleteEmptyFolder rejects a non-empty folder without deleting the marker", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const listFn = async () => ({
    blobs: [
      { pathname: "kute/files/reports/.folder", size: 0, uploadedAt },
      { pathname: "kute/files/reports/q1.pdf", size: 5, uploadedAt },
    ],
    hasMore: false,
  });
  const delFn = async () => {
    throw new Error("should not be called");
  };
  await assert.rejects(() => deleteEmptyFolder("reports", { listFn, delFn }), FolderNotEmptyError);
});

test("deleteEmptyFolder rejects a folder containing a nested entry without deleting the marker", async () => {
  const uploadedAt = new Date("2026-07-01T00:00:00.000Z");
  const listFn = async () => ({
    blobs: [
      { pathname: "kute/files/reports/", size: 0, uploadedAt },
      { pathname: "kute/files/reports/nested/deep.pdf", size: 5, uploadedAt },
    ],
    hasMore: false,
  });
  const delFn = async () => {
    throw new Error("should not be called");
  };
  await assert.rejects(() => deleteEmptyFolder("reports", { listFn, delFn }), FolderNotEmptyError);
});

test("deleteFile delegates to the provided delete function with the pathname", async () => {
  let calledWith = null;
  const delFn = async (pathname) => {
    calledWith = pathname;
  };
  await deleteFile("kute/files/deck.pdf", { delFn });
  assert.equal(calledWith, "kute/files/deck.pdf");
});

test("moveFile renames a root-level file into a target folder, checking the destination first", async () => {
  const calls = [];
  const headFn = async (pathname) => {
    calls.push({ op: "head", pathname });
    throw new BlobNotFoundError();
  };
  const renameFn = async (from, to, options) => {
    calls.push({ op: "rename", from, to, options });
    return { pathname: to };
  };
  const result = await moveFile("kute/files/deck.pdf", "reports", { headFn, renameFn });
  assert.deepEqual(result, { pathname: "kute/files/reports/deck.pdf" });
  assert.deepEqual(calls, [
    { op: "head", pathname: "kute/files/reports/deck.pdf" },
    {
      op: "rename",
      from: "kute/files/deck.pdf",
      to: "kute/files/reports/deck.pdf",
      options: { access: "private", allowOverwrite: false },
    },
  ]);
});

test("moveFile renames a nested file back to the root, keeping its basename", async () => {
  const headFn = async () => {
    throw new BlobNotFoundError();
  };
  let renamedTo = null;
  const renameFn = async (from, to) => {
    renamedTo = to;
    return { pathname: to };
  };
  const result = await moveFile("kute/files/reports/q1.pdf", "", { headFn, renameFn });
  assert.equal(renamedTo, "kute/files/q1.pdf");
  assert.equal(result.pathname, "kute/files/q1.pdf");
});

test("moveFile rejects a source pathname outside the files prefix", async () => {
  await assert.rejects(() => moveFile("other/deck.pdf", "reports"));
});

test("moveFile rejects an unsafe target folder", async () => {
  await assert.rejects(() => moveFile("kute/files/deck.pdf", "../etc"));
});

test("moveFile rejects moving a file to the folder it is already in", async () => {
  const renameFn = async () => {
    throw new Error("should not be called");
  };
  await assert.rejects(
    () => moveFile("kute/files/reports/deck.pdf", "reports", { renameFn }),
    SameLocationError
  );
});

test("moveFile rejects moving a root file back to the root", async () => {
  const renameFn = async () => {
    throw new Error("should not be called");
  };
  await assert.rejects(() => moveFile("kute/files/deck.pdf", "", { renameFn }), SameLocationError);
});

test("moveFile rejects when a same-named file already exists at the destination, without renaming", async () => {
  const headFn = async () => ({ pathname: "kute/files/reports/deck.pdf" });
  const renameFn = async () => {
    throw new Error("should not be called");
  };
  await assert.rejects(
    () => moveFile("kute/files/deck.pdf", "reports", { headFn, renameFn }),
    DestinationExistsError
  );
});

test("moveFile propagates unexpected head() failures instead of treating them as not-found", async () => {
  const headFn = async () => {
    throw new Error("network down");
  };
  await assert.rejects(() => moveFile("kute/files/deck.pdf", "reports", { headFn }), /network down/);
});

test("renameFile renames a nested file in place, checking the destination first", async () => {
  const calls = [];
  const headFn = async (pathname) => {
    calls.push({ op: "head", pathname });
    throw new BlobNotFoundError();
  };
  const renameFn = async (from, to, options) => {
    calls.push({ op: "rename", from, to, options });
    return { pathname: to };
  };
  const result = await renameFile("kute/files/reports/q1.pdf", "q2.pdf", { headFn, renameFn });
  assert.deepEqual(result, { pathname: "kute/files/reports/q2.pdf" });
  assert.deepEqual(calls, [
    { op: "head", pathname: "kute/files/reports/q2.pdf" },
    {
      op: "rename",
      from: "kute/files/reports/q1.pdf",
      to: "kute/files/reports/q2.pdf",
      options: { access: "private", allowOverwrite: false },
    },
  ]);
});

test("renameFile rejects unsafe names and unchanged names", async () => {
  const renameFn = async () => {
    throw new Error("should not be called");
  };
  await assert.rejects(() => renameFile("kute/files/deck.pdf", "../etc", { renameFn }));
  await assert.rejects(() => renameFile("kute/files/deck.pdf", "deck.pdf", { renameFn }), SameLocationError);
});

test("renameFile rejects when the destination already exists", async () => {
  const headFn = async () => ({ pathname: "kute/files/renamed.pdf" });
  const renameFn = async () => {
    throw new Error("should not be called");
  };
  await assert.rejects(
    () => renameFile("kute/files/deck.pdf", "renamed.pdf", { headFn, renameFn }),
    DestinationExistsError
  );
});

test("createSignedAccessUrl issues a short-lived GET delegation and presigns the exact pathname", async () => {
  const before = Date.now();
  let issuedOptions = null;
  const issueSignedTokenFn = async (options) => {
    issuedOptions = options;
    return { delegationToken: "d", clientSigningToken: "c", validUntil: options.validUntil };
  };
  const presignUrlFn = async (signedToken, options) => {
    assert.equal(signedToken.delegationToken, "d");
    assert.equal(options.operation, "get");
    assert.equal(options.pathname, "kute/files/共同レビュー.html");
    return { presignedUrl: "https://blob.example/deck.pdf?signed=1" };
  };
  const { url, expiresAt } = await createSignedAccessUrl("kute/files/共同レビュー.html", {
    issueSignedTokenFn,
    presignUrlFn,
  });
  assert.equal(url, "https://blob.example/deck.pdf?signed=1");
  assert.equal(issuedOptions.pathname, undefined);
  assert.deepEqual(issuedOptions.operations, ["get"]);
  const ttl = expiresAt - before;
  assert.ok(ttl > 4 * 60 * 1000 && ttl <= 5 * 60 * 1000 + 1000, `unexpected ttl: ${ttl}`);
});

test("createSignedAccessUrl returns the presigned URL unchanged when download is not requested", async () => {
  const issueSignedTokenFn = async (options) => ({ delegationToken: "d", clientSigningToken: "c", validUntil: options.validUntil });
  const presignUrlFn = async () => ({ presignedUrl: "https://blob.example/deck.pdf?signed=1" });
  const getDownloadUrlFn = () => {
    throw new Error("should not be called");
  };
  const { url } = await createSignedAccessUrl("kute/files/deck.pdf", {
    issueSignedTokenFn,
    presignUrlFn,
    getDownloadUrlFn,
  });
  assert.equal(url, "https://blob.example/deck.pdf?signed=1");
});

test("createSignedAccessUrl converts the presigned URL through getDownloadUrl when download is requested", async () => {
  const issueSignedTokenFn = async (options) => ({ delegationToken: "d", clientSigningToken: "c", validUntil: options.validUntil });
  const presignUrlFn = async () => ({ presignedUrl: "https://blob.example/deck.pdf?signed=1" });
  let receivedUrl = null;
  const getDownloadUrlFn = (blobUrl) => {
    receivedUrl = blobUrl;
    return "https://blob.example/deck.pdf?signed=1&download=1";
  };
  const { url } = await createSignedAccessUrl("kute/files/deck.pdf", {
    download: true,
    issueSignedTokenFn,
    presignUrlFn,
    getDownloadUrlFn,
  });
  assert.equal(receivedUrl, "https://blob.example/deck.pdf?signed=1");
  assert.equal(url, "https://blob.example/deck.pdf?signed=1&download=1");
});
