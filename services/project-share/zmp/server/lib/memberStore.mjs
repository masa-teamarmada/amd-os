import { BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";
import { hmac, isValidEmailAddress, normalizeEmail } from "./auth.mjs";

export const MEMBERS_PREFIX = "zmp/members/";
const ID_RE = /^[0-9a-f]{64}$/;

export class MemberValidationError extends Error {
  constructor(message = "invalid member email") {
    super(message);
    this.name = "MemberValidationError";
    this.code = "MEMBER_INVALID";
  }
}

export class MemberAlreadyExistsError extends Error {
  constructor(message = "member is already registered") {
    super(message);
    this.name = "MemberAlreadyExistsError";
    this.code = "MEMBER_ALREADY_EXISTS";
  }
}

export class MemberNotFoundError extends Error {
  constructor(message = "member was not found") {
    super(message);
    this.name = "MemberNotFoundError";
    this.code = "MEMBER_NOT_FOUND";
  }
}

function memberId(secret, email) {
  return hmac(secret, `member:${email}`);
}

function buildMemberPathname(secret, email) {
  return MEMBERS_PREFIX + memberId(secret, email) + ".json";
}

function normalizeTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function parseStoredMember(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const email = normalizeEmail(value.email);
  if (!isValidEmailAddress(email)) return null;
  const addedAt = normalizeTimestamp(value.addedAt);
  if (!addedAt) return null;
  return { email, addedAt };
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

// getFn returns null for a genuine 404 (not found — safe to treat as absent).
// Any other non-2xx/non-304 status, a body that fails to parse, a body whose
// shape fails validation, or a body whose email does not hash back to this
// exact pathname is treated as corruption/failure and thrown, never silently
// swallowed to null — callers must fail closed on it.
async function readStoredMember(pathname, { secret, getFn = get } = {}) {
  const result = await getFn(pathname, { access: "private", useCache: false });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`unexpected response reading member record at ${pathname}`);
  }

  let value;
  try {
    value = await new Response(result.stream).json();
  } catch {
    throw new Error(`member record at ${pathname} is not valid JSON`);
  }

  const parsed = parseStoredMember(value);
  if (!parsed) {
    throw new Error(`member record at ${pathname} failed validation`);
  }
  if (secret && buildMemberPathname(secret, parsed.email) !== pathname) {
    throw new Error(`member record at ${pathname} does not match its own pathname`);
  }
  return parsed;
}

function isPutConflictError(err) {
  return err instanceof BlobPreconditionFailedError;
}

export async function listMembers({ secret, listFn = list, getFn = get } = {}) {
  const blobs = await listAllBlobs(MEMBERS_PREFIX, { listFn });
  const pathnames = blobs
    .map((blob) => blob.pathname)
    .filter((pathname) => {
      if (!pathname.startsWith(MEMBERS_PREFIX) || !pathname.endsWith(".json")) return false;
      const id = pathname.slice(MEMBERS_PREFIX.length, -".json".length);
      return ID_RE.test(id);
    });

  // Fail closed: a corrupted record or a failed GET aborts the whole listing
  // rather than being silently dropped from the result.
  const members = await Promise.all(
    pathnames.map((pathname) => readStoredMember(pathname, { secret, getFn }))
  );
  return members.filter(Boolean).sort((a, b) => a.email.localeCompare(b.email));
}

export async function listMemberEmails(options = {}) {
  const members = await listMembers(options);
  return members.map((member) => member.email);
}

// O(1) membership check for a single email via its deterministic HMAC
// pathname — used on the request hot path instead of listing+GETing every
// member record. Returns false only for a genuine "not registered"; backend
// or integrity failures propagate so callers can fail closed.
export async function hasMember(rawEmail, { secret, getFn = get } = {}) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmailAddress(email)) return false;
  const pathname = buildMemberPathname(secret, email);
  const record = await readStoredMember(pathname, { secret, getFn });
  return Boolean(record);
}

export async function addMember(rawEmail, { secret, putFn = put, getFn = get } = {}) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmailAddress(email)) throw new MemberValidationError();

  const pathname = buildMemberPathname(secret, email);
  const existing = await readStoredMember(pathname, { secret, getFn });
  if (existing) throw new MemberAlreadyExistsError();

  const addedAt = new Date().toISOString();
  try {
    await putFn(pathname, JSON.stringify({ email, addedAt }), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json; charset=utf-8",
    });
  } catch (err) {
    if (isPutConflictError(err)) throw new MemberAlreadyExistsError();
    throw err;
  }
  return { email, addedAt };
}

export async function removeMember(rawEmail, { secret, delFn = del, getFn = get } = {}) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmailAddress(email)) throw new MemberValidationError();

  const pathname = buildMemberPathname(secret, email);
  const existing = await readStoredMember(pathname, { secret, getFn });
  if (!existing) throw new MemberNotFoundError();

  await delFn(pathname);
}
