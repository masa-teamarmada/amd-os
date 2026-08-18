#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  advanceHistoricalScanState,
  boundBlankCandidates,
  buildBlankOnlyPatch,
  isJstScheduleHour,
  normalizeHistoricalScanState,
  resolveMinutesSchema,
  verifyReadback,
} from "./h1_notion_metadata_contract.mjs";

assert.equal(isJstScheduleHour(8, 1), false);
assert.equal(isJstScheduleHour(9, 1), true);
assert.equal(isJstScheduleHour(21, 5), true);
assert.equal(isJstScheduleHour(22, 5), false);
assert.equal(isJstScheduleHour(12, 6), false);

assert.deepEqual(normalizeHistoricalScanState({ next_cursor: "cursor-1", cycle: 2 }), {
  version: 1, next_cursor: "cursor-1", cycle: 2,
});
assert.equal(advanceHistoricalScanState({ previous: { next_cursor: "cursor-1", cycle: 2 }, nextCursor: "cursor-2", runId: "run-1" }).next_cursor, "cursor-2");
const wrapped = advanceHistoricalScanState({ previous: { next_cursor: "cursor-2", cycle: 2 }, reachedEof: true, runId: "run-2", scanned: 100, blankCandidates: 4 });
assert.equal(wrapped.next_cursor, null);
assert.equal(wrapped.cycle, 3);
assert.equal(wrapped.reached_eof, true);

const schema = resolveMinutesSchema({
  eventId: { type: "rich_text" },
  PJ: { type: "relation" },
  メンバー: { type: "relation" },
  日付: { type: "date" },
});
assert.deepEqual(Object.keys(schema), ["eventId", "pj", "member", "date"]);

const pages = Array.from({ length: 30 }, (_, index) => ({ id: `page-${index}`, properties: {} }));
const bounded = boundBlankCandidates(pages, schema, 25);
assert.equal(bounded.candidates.length, 25);
assert.equal(bounded.deferred, 5);
assert.deepEqual(boundBlankCandidates([{ properties: {
  eventId: { rich_text: [{ plain_text: "event-1" }] }, PJ: { relation: [{ id: "pj-1" }] },
  メンバー: { relation: [{ id: "member-1" }] }, 日付: { date: { start: "2026-08-18" } },
} }], schema), { candidates: [], deferred: 0 });

const before = { メンバー: { relation: [{ id: "member-1" }] } };
const plan = buildBlankOnlyPatch({
  properties: before, schema, calendarEventId: "event-1",
  meetingStartAt: "2026-08-17T16:30:00.000Z", pjPageId: "pj-1",
  memberPageIds: ["member-1", "member-2"],
});
assert.equal(plan.patch.日付.date.start, "2026-08-18");
assert.deepEqual(plan.patch.メンバー.relation.map(({ id }) => id), ["member-1", "member-2"]);

const conflict = buildBlankOnlyPatch({
  properties: {
    eventId: { rich_text: [{ plain_text: "other-event" }] },
    PJ: { relation: [{ id: "other-pj" }] },
  }, schema, calendarEventId: "event-1", pjPageId: "pj-1",
});
assert.equal("eventId" in conflict.patch, false);
assert.equal("PJ" in conflict.patch, false);
assert.equal(conflict.skipped.includes("notion_event_id_conflict"), true);
assert.equal(conflict.skipped.includes("notion_pj_relation_conflict"), true);

const after = { ...before, ...plan.patch };
assert.equal(verifyReadback({ before, after, patch: plan.patch, schema }).ok, true);
const failed = verifyReadback({ before, after: { ...after, 日付: { date: null } }, patch: plan.patch, schema });
assert.equal(failed.ok, false);
assert.deepEqual(failed.failed, ["date"]);

console.log("H-1 Notion metadata contract: OK");
