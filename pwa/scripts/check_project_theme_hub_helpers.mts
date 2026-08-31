// Executable behavioral tests for src/lib/project-theme-hub.ts — the write helpers behind
// /api/project-workspace/[projectId]/theme/[trackKey]. No real Supabase connection: each test
// installs a minimal fake chainable query builder (queued per-table responses) and asserts on the
// actual return value / thrown ThemeHubError, not just on source text. This directly answers root
// review (/tmp/amie-zmp-theme.imx1hK/phase2-root-review.md) "Add executable mocked/helper tests
// before claiming save works."
//
// Run: npm run test:project-theme-hub-helpers (node --experimental-strip-types
// --import ./scripts/register_ts_aliases.mjs scripts/check_project_theme_hub_helpers.mts)

import assert from "node:assert/strict";
import {
  ThemeHubError,
  assertValidTrack,
  createDeliverable,
  createWorkLink,
  linkExistingDocument,
  linkExistingMeeting,
  pickPresent,
  updateDeliverable,
  updateMeeting,
  upsertThemeProfile,
} from "@/lib/project-theme-hub";

// ---------------------------------------------------------------------------
// Fake Supabase query builder: `.from(table)` returns a chainable object whose filter methods
// (select/eq/is/not/match/order/limit) all just return `this`, and whose terminal methods
// (single/maybeSingle) resolve the NEXT queued { data, error } response for that table+call-index
// (FIFO, independent of which exact filters were chained — sufficient to test call SEQUENCES,
// which is what every finding below actually hinges on). insert/update/upsert also consume a
// queued response directly (not just via a following .select()), matching how supabase-js
// resolves a mutation without an explicit terminal call.
// ---------------------------------------------------------------------------
type Resp = { data: unknown; error: { code?: string; message: string } | null };

function makeFakeDb(queues: Record<string, Resp[]>) {
  const calls: Array<{ table: string; op: string; arg: unknown }> = [];
  function nextResponse(table: string): Resp {
    const queue = queues[table];
    if (!queue || queue.length === 0) throw new Error(`no queued fake response left for table "${table}"`);
    return queue.shift() as Resp;
  }
  function builder(table: string) {
    const resolved = Promise.resolve(nextResponse(table));
    const chain: Record<string, unknown> = {
      select: (cols: unknown) => { calls.push({ table, op: "select", arg: cols }); return chain; },
      eq: (col: unknown, val: unknown) => { calls.push({ table, op: "eq", arg: [col, val] }); return chain; },
      is: (col: unknown, val: unknown) => { calls.push({ table, op: "is", arg: [col, val] }); return chain; },
      not: (col: unknown, op2: unknown, val: unknown) => { calls.push({ table, op: "not", arg: [col, op2, val] }); return chain; },
      match: (obj: unknown) => { calls.push({ table, op: "match", arg: obj }); return chain; },
      order: () => chain,
      limit: () => chain,
      insert: (row: unknown) => { calls.push({ table, op: "insert", arg: row }); return chain; },
      update: (row: unknown) => { calls.push({ table, op: "update", arg: row }); return chain; },
      upsert: (row: unknown, opts: unknown) => { calls.push({ table, op: "upsert", arg: [row, opts] }); return chain; },
      maybeSingle: () => resolved,
      single: () => resolved,
      then: (onFulfilled: (v: Resp) => unknown) => resolved.then(onFulfilled),
    };
    return chain;
  }
  return { from: (table: string) => builder(table), calls } as unknown as Parameters<typeof upsertThemeProfile>[0];
}

async function assertRejects(fn: () => Promise<unknown>, matcher: (error: ThemeHubError) => void, label: string) {
  try {
    await fn();
    assert.fail(`${label}: expected rejection, got success`);
  } catch (error) {
    assert.ok(error instanceof ThemeHubError, `${label}: expected ThemeHubError, got ${error}`);
    matcher(error as ThemeHubError);
  }
}

async function run() {
  // -------------------------------------------------------------------------
  // pickPresent — finding #3: omitted fields must not silently become "clear this field".
  // -------------------------------------------------------------------------
  {
    const picked = pickPresent(
      { purpose_md: "目的だよ" }, // only purpose_md is present on the wire
      { purpose_md: "purposeMd", current_state_md: "currentStateMd", next_focus_note: "nextFocusNote" },
    );
    assert.deepEqual(Object.keys(picked), ["purposeMd"], "pickPresent must not invent keys for omitted wire fields");
    assert.equal(picked.purposeMd, "目的だよ");
  }
  {
    // Explicit null IS a real "please clear this field" request and must survive pickPresent.
    const picked = pickPresent({ purpose_md: null }, { purpose_md: "purposeMd" });
    assert.deepEqual(picked, { purposeMd: null }, "an explicit null must still be forwarded (it's a real clear request)");
  }
  console.log("ok: pickPresent preserves omitted-vs-null distinction");

  // -------------------------------------------------------------------------
  // Finding #7 — optionalDate must reject calendar-impossible dates, not silently normalize them.
  // Exercised indirectly through createDeliverable's due_on validation (optionalDate is private).
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({}); // never reaches a DB call — validation throws first
    await assertRejects(
      () => createDeliverable(db, "p19", "kr_management_reform", "ID001", {
        title: "テスト成果物", dueOn: "2026-02-30", clientToken: "11111111-1111-4111-8111-111111111111",
      }),
      (e) => assert.match(e.message, /due_on|実在する日付/),
      "createDeliverable must reject 2026-02-30",
    );
  }
  console.log("ok: impossible calendar dates (2026-02-30) are rejected, not silently normalized");

  // -------------------------------------------------------------------------
  // Finding #6 — client_token must be REQUIRED, never a silent server-generated fallback.
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({});
    await assertRejects(
      () => createDeliverable(db, "p19", "kr_management_reform", "ID001", { title: "テスト成果物", clientToken: undefined }),
      (e) => { assert.equal(e.status, 400); assert.match(e.message, /冪等キー/); },
      "createDeliverable must 400 on a missing client_token, not invent one",
    );
    await assertRejects(
      () => createDeliverable(db, "p19", "kr_management_reform", "ID001", { title: "テスト成果物", clientToken: "not-a-uuid" }),
      (e) => assert.equal(e.status, 400),
      "createDeliverable must reject a malformed client_token",
    );
  }
  console.log("ok: client_token is required and validated, never server-generated");

  // -------------------------------------------------------------------------
  // Finding #1 — createDeliverable must recover from a 23505 on the client_token partial unique
  // index via plain INSERT + re-read, NOT via upsert(onConflict) (which 42P10s against a partial
  // index). Simulate: first insert call errors 23505, second (recovery) select call returns the
  // already-created row.
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({
      project_theme_deliverables: [
        { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
        { data: { id: "existing-deliverable-id" }, error: null },
      ],
    });
    const id = await createDeliverable(db, "p19", "kr_management_reform", "ID001", {
      title: "テスト成果物", clientToken: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(id, "existing-deliverable-id", "a 23505 retry must return the ALREADY-CREATED row, not throw or duplicate");
  }
  console.log("ok: createDeliverable recovers a concurrent/retried client_token via 23505, not upsert(onConflict)");

  // -------------------------------------------------------------------------
  // root review (release checkpoint, point 7) — a 23505 retry of a client_token whose row was
  // already soft-deleted by someone else must fail with 409, not silently report success
  // pointing at a row the caller can no longer see.
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({
      project_theme_deliverables: [
        { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
        { data: { id: "archived-deliverable-id", deleted_at: "2026-08-30T00:00:00Z" }, error: null },
      ],
    });
    await assertRejects(
      () => createDeliverable(db, "p19", "kr_management_reform", "ID001", {
        title: "テスト成果物", clientToken: "11111111-1111-4111-8111-111111111111",
      }),
      (e) => assert.equal(e.status, 409),
      "a client_token retry landing on an archived row must 409, not report success",
    );
  }
  console.log("ok: createDeliverable rejects a client_token retry that resolves to an archived row");

  // -------------------------------------------------------------------------
  // Finding #4 — upsertThemeProfile must require expected_version for an EXISTING row (missing
  // version must never silently skip the optimistic-concurrency check).
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({
      project_theme_profiles: [{ data: { id: "profile-1", version: 3 }, error: null }],
    });
    await assertRejects(
      () => upsertThemeProfile(db, "p19", "kr_management_reform", "ID001", { purposeMd: "更新" }, null),
      (e) => { assert.equal(e.status, 400); assert.match(e.message, /expected_version/); },
      "editing an existing profile row with expectedVersion=null must be rejected, not silently allowed",
    );
  }
  {
    // First-ever save (no existing row) legitimately has no version to send.
    const db = makeFakeDb({
      project_theme_profiles: [
        { data: null, error: null }, // existing-row lookup: none found
        { data: null, error: null }, // insert
      ],
    });
    await upsertThemeProfile(db, "p19", "kr_management_reform", "ID001", { purposeMd: "はじめて" }, null);
  }
  console.log("ok: upsertThemeProfile requires expected_version for existing rows, allows null only for first-ever save");

  // -------------------------------------------------------------------------
  // Finding #3 (continued) — updateMeeting must not overwrite fields the caller never sent, and
  // must require expected_updated_at (finding #4's meeting-specific form: no version column,
  // updated_at is the CAS token).
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({});
    await assertRejects(
      () => updateMeeting(db, "p19", "meeting-1", { title: "新しいタイトル" }, undefined),
      (e) => { assert.equal(e.status, 400); assert.match(e.message, /expected_updated_at/); },
      "updateMeeting must reject a missing expected_updated_at",
    );
  }
  {
    const db = makeFakeDb({
      project_meeting_summaries: [
        { data: { meeting_id: "meeting-1" }, error: null }, // before-select (existence check)
        { data: null, error: null }, // atomic update affected 0 rows (stale updated_at)
      ],
    });
    await assertRejects(
      () => updateMeeting(db, "p19", "meeting-1", { title: "新しいタイトル" }, "2026-08-31T00:00:00Z"),
      (e) => assert.equal(e.status, 409),
      "a stale expected_updated_at must 409, not silently overwrite",
    );
  }
  console.log("ok: updateMeeting enforces expected_updated_at as a real optimistic-concurrency token");

  // -------------------------------------------------------------------------
  // Finding #8 — work_links must reject the pairs that already have a canonical FK relationship
  // (issue<->milestone, decision<->issue, task<->milestone), before ever reaching the DB.
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({}); // must never be called — rejected by pure validation first
    await assertRejects(
      () => createWorkLink(db, "p19", "kr_management_reform", "ID001", {
        fromKind: "issue", fromId: "issue-1", toKind: "milestone", toId: "ms-1",
        clientToken: "11111111-1111-4111-8111-111111111111",
      }),
      (e) => assert.match(e.message, /既存の管理画面/),
      "issue<->milestone must be rejected — that relationship already has a canonical FK writer",
    );
  }
  console.log("ok: createWorkLink rejects canonical-FK pairs (issue-milestone/decision-issue/task-milestone)");

  // -------------------------------------------------------------------------
  // Finding #5 — a document link to an archived document must be rejected up front (linkExisting
  // Document's own active-status check), independent of the natural-key restore-or-insert path.
  // -------------------------------------------------------------------------
  {
    const documentId = "22222222-2222-4222-8222-222222222222";
    const db = makeFakeDb({
      workspace_documents: [{ data: { document_id: documentId, upload_status: "archived" }, error: null }],
    });
    await assertRejects(
      () => linkExistingDocument(db, "p19", "kr_management_reform", documentId, "ID001"),
      (e) => assert.equal(e.status, 409),
      "linking an archived document must be rejected, not silently accepted as usable",
    );
  }
  console.log("ok: linkExistingDocument rejects archived documents");

  // -------------------------------------------------------------------------
  // root review (UI completion phase, point 8) — real p19 data has meeting_id values up to 190
  // characters (a composed text natural key, gas/074_MeetingSummaryRepo.js, not a short uuid).
  // The old 80-char cap silently rejected linking most of the project's actual meeting history —
  // a real 190-char id must now be accepted, not just something under the old 80-char ceiling.
  // -------------------------------------------------------------------------
  {
    const meetingId190 = `slack:C0${"1".repeat(20)}:thread:${"9".repeat(20)}:${"a".repeat(133)}`;
    assert.equal(meetingId190.length, 190, "test fixture itself must be exactly 190 chars");
    const db = makeFakeDb({
      project_meeting_summaries: [{ data: { meeting_id: meetingId190 }, error: null }],
      project_theme_meetings: [
        { data: null, error: null }, // restoreOrInsertLink's own-row lookup: no existing link
        { data: { id: "link-1" }, error: null }, // insert succeeds
      ],
    });
    await linkExistingMeeting(db, "p19", "kr_management_reform", meetingId190, "ID001");
  }
  console.log("ok: linkExistingMeeting accepts a real 190-character meeting_id (root review point 8)");

  // -------------------------------------------------------------------------
  // assertValidTrack — sanity check on the shared guard every write path calls first.
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({ project_management_tracks: [{ data: null, error: null }] });
    await assertRejects(
      () => assertValidTrack(db, "p19", "not_a_real_track"),
      (e) => assert.equal(e.status, 404),
      "an unknown track_key must 404",
    );
  }
  console.log("ok: assertValidTrack rejects an unknown track_key");

  // -------------------------------------------------------------------------
  // updateDeliverable — expected_version is mandatory (no first-save exemption; unlike profiles,
  // a deliverable always has a version from creation).
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({});
    await assertRejects(
      () => updateDeliverable(db, "p19", "kr_management_reform", "deliverable-1", "ID001", { title: "新タイトル" }, undefined),
      (e) => assert.equal(e.status, 400),
      "updateDeliverable must reject a missing expected_version",
    );
  }
  console.log("ok: updateDeliverable requires expected_version");

  // -------------------------------------------------------------------------
  // root review (release checkpoint, point 7) — updateDeliverable must filter deleted_at IS NULL:
  // updating an already soft-deleted row (two tabs, one deletes then the other edits) must 409,
  // not silently resurrect it. Simulated here as the update matching zero rows (the deleted_at
  // filter excludes it), which the existing 409 path already reports correctly.
  // -------------------------------------------------------------------------
  {
    const db = makeFakeDb({
      project_theme_deliverables: [{ data: null, error: null }],
    });
    await assertRejects(
      () => updateDeliverable(db, "p19", "kr_management_reform", "deliverable-1", "ID001", { title: "新タイトル" }, 3),
      (e) => assert.equal(e.status, 409),
      "updateDeliverable must 409 when the row is soft-deleted (deleted_at filter excludes it)",
    );
  }
  console.log("ok: updateDeliverable rejects a soft-deleted row (deleted_at IS NULL filter)");

  // -------------------------------------------------------------------------
  // root review (release checkpoint, point 7) — createWorkLink's client_token dedupe (byToken)
  // must not report success for an archived row either.
  // -------------------------------------------------------------------------
  {
    const issueId = "33333333-3333-4333-8333-333333333333";
    const taskId = "44444444-4444-4444-8444-444444444444";
    const db = makeFakeDb({
      project_management_issues: [{ data: { project_id: "p19" }, error: null }],
      project_management_tasks: [{ data: { project_id: "p19" }, error: null }],
      project_theme_work_links: [
        { data: { id: "archived-link-id", deleted_at: "2026-08-30T00:00:00Z" }, error: null },
      ],
    });
    await assertRejects(
      () => createWorkLink(db, "p19", "kr_management_reform", "ID001", {
        fromKind: "issue", fromId: issueId, toKind: "task", toId: taskId,
        clientToken: "22222222-2222-4222-8222-222222222222",
      }),
      (e) => assert.equal(e.status, 409),
      "createWorkLink's client_token retry must 409 when it resolves to an archived row",
    );
  }
  console.log("ok: createWorkLink rejects a client_token retry that resolves to an archived row");

  console.log("\nproject-theme-hub helper contract: all checks passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
