import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeBasename,
  sanitizeFolderPath,
  buildFilePathname,
  buildFolderMarkerPath,
  isWithinFilesPrefix,
  FILES_PREFIX,
  FOLDER_MARKER,
} from "../server/lib/pathGuard.mjs";

test("FILES_PREFIX is the expected blob namespace", () => {
  assert.equal(FILES_PREFIX, "kute/files/");
});

test("sanitizeBasename accepts a normal file name", () => {
  assert.equal(sanitizeBasename("report 2026.pdf"), "report 2026.pdf");
});

test("sanitizeBasename rejects path traversal and separators", () => {
  assert.equal(sanitizeBasename("../secret.txt"), null);
  assert.equal(sanitizeBasename("a/b.txt"), null);
  assert.equal(sanitizeBasename("a\\b.txt"), null);
  assert.equal(sanitizeBasename(".."), null);
  assert.equal(sanitizeBasename("."), null);
});

test("sanitizeBasename rejects empty or non-string input", () => {
  assert.equal(sanitizeBasename(""), null);
  assert.equal(sanitizeBasename("   "), null);
  assert.equal(sanitizeBasename(null), null);
  assert.equal(sanitizeBasename(undefined), null);
  assert.equal(sanitizeBasename(42), null);
});

test("sanitizeBasename rejects leading/trailing whitespace", () => {
  assert.equal(sanitizeBasename(" deck.pdf"), null);
  assert.equal(sanitizeBasename("deck.pdf "), null);
  assert.equal(sanitizeBasename("\tdeck.pdf"), null);
});

test("sanitizeBasename rejects ASCII control characters", () => {
  assert.equal(sanitizeBasename("deck\n.pdf"), null);
  assert.equal(sanitizeBasename("deck\t.pdf"), null);
  assert.equal(sanitizeBasename("deck\x00.pdf"), null);
  assert.equal(sanitizeBasename("deck\x7f.pdf"), null);
});

test("sanitizeBasename rejects names over 255 characters", () => {
  assert.equal(sanitizeBasename("a".repeat(256)), null);
  assert.equal(sanitizeBasename("a".repeat(255)), "a".repeat(255));
});

test("buildFilePathname prefixes a sanitized basename", () => {
  assert.equal(buildFilePathname("deck.pdf"), "kute/files/deck.pdf");
});

test("buildFilePathname returns null for unsafe names", () => {
  assert.equal(buildFilePathname("../../etc/passwd"), null);
});

test("isWithinFilesPrefix accepts single-segment paths under the prefix", () => {
  assert.equal(isWithinFilesPrefix("kute/files/deck.pdf"), true);
});

test("isWithinFilesPrefix rejects paths outside the prefix", () => {
  assert.equal(isWithinFilesPrefix("other/deck.pdf"), false);
  assert.equal(isWithinFilesPrefix("kute/files/"), false);
});

test("isWithinFilesPrefix accepts nested user file paths", () => {
  assert.equal(isWithinFilesPrefix("kute/files/sub/deck.pdf"), true);
  assert.equal(isWithinFilesPrefix("kute/files/a/b/c/deck.pdf"), true);
});

test("isWithinFilesPrefix rejects traversal", () => {
  assert.equal(isWithinFilesPrefix("kute/files/../secret.pdf"), false);
  assert.equal(isWithinFilesPrefix("kute/files/sub/../secret.pdf"), false);
});

test("isWithinFilesPrefix rejects any .folder segment", () => {
  assert.equal(isWithinFilesPrefix(`kute/files/${FOLDER_MARKER}`), false);
  assert.equal(isWithinFilesPrefix(`kute/files/sub/${FOLDER_MARKER}`), false);
});

test("isWithinFilesPrefix rejects empty segments from doubled slashes", () => {
  assert.equal(isWithinFilesPrefix("kute/files/sub//deck.pdf"), false);
});

test("isWithinFilesPrefix rejects unsanitized basenames", () => {
  assert.equal(isWithinFilesPrefix("kute/files/deck.pdf "), false);
  assert.equal(isWithinFilesPrefix("kute/files/ deck.pdf"), false);
  assert.equal(isWithinFilesPrefix("kute/files/deck\n.pdf"), false);
  assert.equal(isWithinFilesPrefix("kute/files/.."), false);
});

test("isWithinFilesPrefix rejects non-string input", () => {
  assert.equal(isWithinFilesPrefix(null), false);
  assert.equal(isWithinFilesPrefix(undefined), false);
});

test("sanitizeFolderPath accepts root as empty string", () => {
  assert.equal(sanitizeFolderPath(""), "");
  assert.equal(sanitizeFolderPath(undefined), "");
  assert.equal(sanitizeFolderPath(null), "");
});

test("sanitizeFolderPath accepts a nested folder path", () => {
  assert.equal(sanitizeFolderPath("a/b/c"), "a/b/c");
});

test("sanitizeFolderPath rejects traversal and unsafe segments", () => {
  assert.equal(sanitizeFolderPath("a/../b"), null);
  assert.equal(sanitizeFolderPath("a//b"), null);
  assert.equal(sanitizeFolderPath("a/ b"), null);
  assert.equal(sanitizeFolderPath("a/b "), null);
  assert.equal(sanitizeFolderPath("a/b\\c"), null);
  assert.equal(sanitizeFolderPath("a/b\n"), null);
  assert.equal(sanitizeFolderPath("a".repeat(256)), null);
});

test("sanitizeFolderPath rejects any segment equal to the folder marker", () => {
  assert.equal(sanitizeFolderPath(FOLDER_MARKER), null);
  assert.equal(sanitizeFolderPath(`a/${FOLDER_MARKER}/b`), null);
});

test("buildFilePathname stays compatible with the one-argument form", () => {
  assert.equal(buildFilePathname("deck.pdf"), "kute/files/deck.pdf");
  assert.equal(buildFilePathname("../../etc/passwd"), null);
});

test("buildFilePathname builds a nested path from folder and name", () => {
  assert.equal(buildFilePathname("a/b", "deck.pdf"), "kute/files/a/b/deck.pdf");
  assert.equal(buildFilePathname("", "deck.pdf"), "kute/files/deck.pdf");
});

test("buildFilePathname rejects unsafe folder or name", () => {
  assert.equal(buildFilePathname("a/../b", "deck.pdf"), null);
  assert.equal(buildFilePathname("a", "../secret.pdf"), null);
  assert.equal(buildFilePathname(FOLDER_MARKER, "deck.pdf"), null);
});

test("buildFolderMarkerPath builds a marker path for a nested folder", () => {
  assert.equal(buildFolderMarkerPath("a/b"), `kute/files/a/b/${FOLDER_MARKER}`);
});

test("buildFolderMarkerPath rejects the root and unsafe folders", () => {
  assert.equal(buildFolderMarkerPath(""), null);
  assert.equal(buildFolderMarkerPath("a/../b"), null);
});

test("buildFolderMarkerPath still builds the marker path for a normal nested folder (not broken by reserved-name check)", () => {
  assert.equal(buildFolderMarkerPath("reports"), `kute/files/reports/${FOLDER_MARKER}`);
});

test("sanitizeBasename rejects the exact reserved folder marker name", () => {
  assert.equal(sanitizeBasename(FOLDER_MARKER), null);
});

test("sanitizeBasename accepts names that merely contain the marker as a substring", () => {
  assert.equal(sanitizeBasename(".foldering"), ".foldering");
  assert.equal(sanitizeBasename("my.folder"), "my.folder");
});

test("buildFilePathname rejects the reserved folder marker as a basename (one-arg form)", () => {
  assert.equal(buildFilePathname(FOLDER_MARKER), null);
});

test("buildFilePathname rejects the reserved folder marker as a basename (two-arg form)", () => {
  assert.equal(buildFilePathname("a/b", FOLDER_MARKER), null);
  assert.equal(buildFilePathname("", FOLDER_MARKER), null);
});
