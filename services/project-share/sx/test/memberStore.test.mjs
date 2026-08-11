import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMember,
  hasMember,
  listMembers,
  listMemberEmails,
  MemberAlreadyExistsError,
  MemberNotFoundError,
  MemberValidationError,
  MEMBERS_PREFIX,
  removeMember,
} from "../server/lib/memberStore.mjs";
import { BlobPreconditionFailedError } from "@vercel/blob";
import { hmac } from "../server/lib/auth.mjs";

const SECRET = "test-secret-value";
const EMAIL = "member@example.com";

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

function storedMember(overrides = {}) {
  return { email: EMAIL, addedAt: "2026-08-01T00:00:00.000Z", ...overrides };
}

function memberPathname(secret, email) {
  return MEMBERS_PREFIX + hmac(secret, `member:${email}`) + ".json";
}

test("addMember writes a deterministic HMAC-derived pathname keyed off the normalized email", async () => {
  let written = null;
  const member = await addMember("  Member@Example.com ", {
    secret: SECRET,
    getFn: async () => null,
    putFn: async (pathname, body, options) => {
      written = { pathname, body, options };
    },
  });

  assert.equal(written.pathname, memberPathname(SECRET, EMAIL));
  assert.equal(written.options.access, "private");
  assert.equal(written.options.addRandomSuffix, false);
  assert.equal(written.options.allowOverwrite, false);
  const stored = JSON.parse(written.body);
  assert.equal(stored.email, EMAIL);
  assert.equal(member.email, EMAIL);
  assert.ok(member.addedAt);
});

test("addMember rejects invalid email addresses without touching Blob storage", async () => {
  await assert.rejects(
    () => addMember("not-an-email", { secret: SECRET, getFn: async () => null, putFn: async () => {
      throw new Error("must not be called");
    } }),
    MemberValidationError
  );
});

test("addMember rejects a duplicate email", async () => {
  await assert.rejects(
    () =>
      addMember(EMAIL, {
        secret: SECRET,
        getFn: async () => jsonResult(storedMember()),
        putFn: async () => {},
      }),
    MemberAlreadyExistsError
  );
});

test("removeMember deletes the matching pathname and rejects when the member is not found", async () => {
  let deletedPathname = null;
  await removeMember(EMAIL, {
    secret: SECRET,
    getFn: async () => jsonResult(storedMember()),
    delFn: async (pathname) => {
      deletedPathname = pathname;
    },
  });
  assert.equal(deletedPathname, memberPathname(SECRET, EMAIL));

  await assert.rejects(
    () =>
      removeMember(EMAIL, {
        secret: SECRET,
        getFn: async () => null,
        delFn: async () => {
          throw new Error("must not be called");
        },
      }),
    MemberNotFoundError
  );
});

test("removeMember rejects invalid email addresses", async () => {
  await assert.rejects(
    () => removeMember("not-an-email", { secret: SECRET }),
    MemberValidationError
  );
});

test("listMembers returns only valid member records sorted by email, never exposing pathnames", async () => {
  const other = "other@example.com";
  const records = new Map([
    [EMAIL, storedMember()],
    [other, storedMember({ email: other })],
  ]);
  const listFn = async (options) => {
    assert.equal(options.prefix, MEMBERS_PREFIX);
    return {
      blobs: [
        { pathname: memberPathname(SECRET, EMAIL) },
        { pathname: memberPathname(SECRET, other) },
        { pathname: MEMBERS_PREFIX + "not-a-record.txt" },
      ],
      hasMore: false,
    };
  };
  const getFn = async (pathname, options) => {
    assert.equal(options.access, "private");
    const id = pathname.slice(MEMBERS_PREFIX.length, -".json".length);
    const email = [...records.keys()].find((e) => memberPathname(SECRET, e).includes(id));
    return jsonResult(records.get(email));
  };

  const members = await listMembers({ secret: SECRET, listFn, getFn });
  assert.deepEqual(members.map((m) => m.email), [other, EMAIL].sort());
  assert.equal("pathname" in members[0], false);

  const emails = await listMemberEmails({ secret: SECRET, listFn, getFn });
  assert.deepEqual(emails, members.map((m) => m.email));
});

test("addMember surfaces a genuine Blob write failure as a generic error, not a duplicate", async () => {
  await assert.rejects(
    () =>
      addMember(EMAIL, {
        secret: SECRET,
        getFn: async () => null,
        putFn: async () => {
          throw new BlobServiceNotAvailableStub();
        },
      }),
    (err) => {
      assert.equal(err instanceof MemberAlreadyExistsError, false);
      return true;
    }
  );
});

test("addMember maps a put-time overwrite conflict to MemberAlreadyExistsError", async () => {
  await assert.rejects(
    () =>
      addMember(EMAIL, {
        secret: SECRET,
        getFn: async () => null,
        putFn: async () => {
          throw new BlobPreconditionFailedError();
        },
      }),
    MemberAlreadyExistsError
  );
});

test("listMembers fails closed when a stored record's email does not hash back to its own pathname", async () => {
  const other = "other@example.com";
  const listFn = async () => ({
    blobs: [{ pathname: memberPathname(SECRET, EMAIL) }],
    hasMore: false,
  });
  // Content claims to be `other`'s record but is stored under EMAIL's pathname.
  const getFn = async () => jsonResult(storedMember({ email: other }));

  await assert.rejects(() => listMembers({ secret: SECRET, listFn, getFn }));
});

test("listMembers fails closed (aborts the whole list) when any single record's GET fails", async () => {
  const other = "other@example.com";
  const listFn = async () => ({
    blobs: [
      { pathname: memberPathname(SECRET, EMAIL) },
      { pathname: memberPathname(SECRET, other) },
    ],
    hasMore: false,
  });
  const getFn = async (pathname) => {
    if (pathname === memberPathname(SECRET, other)) {
      throw new Error("network failure");
    }
    return jsonResult(storedMember());
  };

  await assert.rejects(() => listMembers({ secret: SECRET, listFn, getFn }));
});

test("hasMember returns true only for a genuinely registered email, without listing the roster", async () => {
  let listCalled = false;
  const getFn = async (pathname) => {
    if (pathname === memberPathname(SECRET, EMAIL)) return jsonResult(storedMember());
    return null;
  };
  const listFn = async () => {
    listCalled = true;
    return { blobs: [], hasMore: false };
  };

  assert.equal(await hasMember(EMAIL, { secret: SECRET, getFn }), true);
  assert.equal(await hasMember("nobody@example.com", { secret: SECRET, getFn }), false);
  assert.equal(await hasMember("not-an-email", { secret: SECRET, getFn }), false);
  assert.equal(listCalled, false);
  void listFn;
});

test("hasMember propagates a backend read failure instead of treating it as false", async () => {
  await assert.rejects(() =>
    hasMember(EMAIL, {
      secret: SECRET,
      getFn: async () => {
        throw new Error("blob service unavailable");
      },
    })
  );
});

class BlobServiceNotAvailableStub extends Error {
  constructor() {
    super("service unavailable");
  }
}
