import { del, get, list, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { sanitizeBasename, sanitizeFolderPath } from "./pathGuard.mjs";

export const LINKS_PREFIX = "kute/links/";

const LINK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_URL_LENGTH = 4096;

export class OnlineLinkValidationError extends Error {
  constructor(message = "invalid online link") {
    super(message);
    this.name = "OnlineLinkValidationError";
    this.code = "ONLINE_LINK_INVALID";
  }
}

export class OnlineLinkNotFoundError extends Error {
  constructor(message = "online link was not found") {
    super(message);
    this.name = "OnlineLinkNotFoundError";
    this.code = "ONLINE_LINK_NOT_FOUND";
  }
}

export class OnlineLinkUnchangedError extends Error {
  constructor(message = "online link is unchanged") {
    super(message);
    this.name = "OnlineLinkUnchangedError";
    this.code = "ONLINE_LINK_UNCHANGED";
  }
}

function isValidLinkId(value) {
  return typeof value === "string" && LINK_ID_PATTERN.test(value);
}

function buildLinkPathname(id) {
  if (!isValidLinkId(id)) return null;
  return LINKS_PREFIX + id + ".json";
}

export function normalizeOnlineUrl(rawUrl) {
  if (typeof rawUrl !== "string") return null;
  const value = rawUrl.trim();
  if (!value || value.length > MAX_URL_LENGTH) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname || parsed.username || parsed.password) return null;
  return parsed.toString();
}

export function defaultOnlineLinkName(url) {
  const normalized = normalizeOnlineUrl(url);
  if (!normalized) return null;

  const parsed = new URL(normalized);
  const rawSegment = parsed.pathname.split("/").filter(Boolean).pop() || "";
  let segment = rawSegment;
  try {
    segment = decodeURIComponent(rawSegment);
  } catch {
    segment = rawSegment;
  }
  const candidate = (segment ? parsed.hostname + " · " + segment : parsed.hostname).slice(0, 255);
  return sanitizeBasename(candidate) || sanitizeBasename(parsed.hostname);
}

function normalizeName(rawName, url) {
  if (rawName === undefined || rawName === null || rawName === "") {
    return defaultOnlineLinkName(url);
  }
  if (typeof rawName !== "string") return null;
  const name = rawName.trim();
  return sanitizeBasename(name);
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

function parseStoredLink(value, expectedId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!isValidLinkId(value.id) || (expectedId && value.id !== expectedId)) return null;

  const url = normalizeOnlineUrl(value.url);
  const name = typeof value.name === "string" ? sanitizeBasename(value.name) : null;
  const folder = sanitizeFolderPath(value.folder);
  const createdAt = normalizeTimestamp(value.createdAt);
  const updatedAt = normalizeTimestamp(value.updatedAt);
  if (!url || !name || folder === null || !createdAt || !updatedAt) return null;

  return { id: value.id, url, name, folder, createdAt, updatedAt };
}

async function listAllBlobs(prefix, { listFn = list } = {}) {
  const blobs = [];
  let cursor;
  for (;;) {
    const result = await listFn({ prefix, mode: "expanded", ...(cursor ? { cursor } : {}) });
    blobs.push(...result.blobs);
    if (!result.hasMore || !result.cursor) break;
    cursor = result.cursor;
  }
  return blobs;
}

async function readStoredLink(id, { getFn = get } = {}) {
  const pathname = buildLinkPathname(id);
  if (!pathname) throw new OnlineLinkValidationError("invalid online link id");

  const result = await getFn(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new OnlineLinkNotFoundError();
  }

  let value;
  try {
    value = await new Response(result.stream).json();
  } catch {
    throw new OnlineLinkNotFoundError();
  }

  const link = parseStoredLink(value, id);
  if (!link) throw new OnlineLinkNotFoundError();
  return link;
}

async function listStoredLinks({ listFn = list, getFn = get } = {}) {
  const blobs = await listAllBlobs(LINKS_PREFIX, { listFn });
  const ids = blobs
    .map((blob) => {
      if (!blob.pathname.startsWith(LINKS_PREFIX) || !blob.pathname.endsWith(".json")) return null;
      return blob.pathname.slice(LINKS_PREFIX.length, -".json".length);
    })
    .filter((id) => isValidLinkId(id));

  const links = await Promise.all(
    ids.map(async (id) => {
      try {
        return await readStoredLink(id, { getFn });
      } catch {
        return null;
      }
    })
  );
  return links.filter(Boolean);
}

function publicLink(link) {
  return {
    kind: "link",
    id: link.id,
    name: link.name,
    url: link.url,
    size: null,
    uploadedAt: link.updatedAt,
  };
}

function writeOptions(allowOverwrite) {
  return {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite,
    contentType: "application/json; charset=utf-8",
  };
}

export async function listOnlineLinks(folderPath, options = {}) {
  const folder = sanitizeFolderPath(folderPath);
  if (folder === null) throw new OnlineLinkValidationError("invalid folder path");
  const links = await listStoredLinks(options);
  return links.filter((link) => link.folder === folder).map(publicLink);
}

export async function hasOnlineLinksInFolder(folderPath, options = {}) {
  const folder = sanitizeFolderPath(folderPath);
  if (folder === null || !folder) throw new OnlineLinkValidationError("invalid folder path");
  const links = await listStoredLinks(options);
  return links.some((link) => link.folder === folder || link.folder.startsWith(folder + "/"));
}

export async function createOnlineLink(
  { url: rawUrl, name: rawName, folder: rawFolder },
  { putFn = put, randomUUIDFn = randomUUID } = {}
) {
  const url = normalizeOnlineUrl(rawUrl);
  const folder = sanitizeFolderPath(rawFolder);
  const name = normalizeName(rawName, url);
  const id = randomUUIDFn();
  if (!url || folder === null || !name || !isValidLinkId(id)) {
    throw new OnlineLinkValidationError();
  }

  const now = new Date().toISOString();
  const link = { id, url, name, folder, createdAt: now, updatedAt: now };
  await putFn(buildLinkPathname(id), JSON.stringify(link), writeOptions(false));
  return publicLink(link);
}

export async function renameOnlineLink(
  id,
  rawName,
  { getFn = get, putFn = put } = {}
) {
  const link = await readStoredLink(id, { getFn });
  const name = normalizeName(rawName, link.url);
  if (!name) throw new OnlineLinkValidationError("invalid online link name");
  if (name === link.name) throw new OnlineLinkUnchangedError();

  const updated = { ...link, name, updatedAt: new Date().toISOString() };
  await putFn(buildLinkPathname(link.id), JSON.stringify(updated), writeOptions(true));
  return publicLink(updated);
}

export async function moveOnlineLink(
  id,
  rawFolder,
  { getFn = get, putFn = put } = {}
) {
  const link = await readStoredLink(id, { getFn });
  const folder = sanitizeFolderPath(rawFolder);
  if (folder === null) throw new OnlineLinkValidationError("invalid target folder");
  if (folder === link.folder) throw new OnlineLinkUnchangedError();

  const updated = { ...link, folder, updatedAt: new Date().toISOString() };
  await putFn(buildLinkPathname(link.id), JSON.stringify(updated), writeOptions(true));
  return publicLink(updated);
}

export async function deleteOnlineLink(id, { delFn = del } = {}) {
  const pathname = buildLinkPathname(id);
  if (!pathname) throw new OnlineLinkValidationError("invalid online link id");
  await delFn(pathname);
}
