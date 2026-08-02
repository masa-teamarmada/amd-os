import assert from "node:assert/strict";
import {
  addDays,
  computeBarMove,
  computeBarResizeEnd,
  computeBarResizeStart,
  computeGateEndMove,
  computeMilestoneMove,
  dateFromPct,
  diffDays,
  isStrictCalendarDate,
  isValidPlannedRange,
  isValidPointMilestoneRange,
  isWithinClickThreshold,
  normalizePointMilestonePatch,
  pxToDayDelta,
  shouldCancelOnLostPointerCapture,
} from "../src/lib/sx-gantt-drag.ts";

// -- isStrictCalendarDate ----------------------------------------------------
assert.equal(isStrictCalendarDate("2026-08-02"), true, "real calendar date passes");
assert.equal(isStrictCalendarDate("2026-02-29"), false, "2026 is not a leap year");
assert.equal(isStrictCalendarDate("2028-02-29"), true, "2028 is a leap year");
assert.equal(isStrictCalendarDate("2026-02-30"), false, "no such day as Feb 30");
assert.equal(isStrictCalendarDate("2026-13-01"), false, "month 13 does not exist");
assert.equal(isStrictCalendarDate("2026-00-01"), false, "month 0 does not exist");
assert.equal(isStrictCalendarDate("2026-8-2"), false, "must be zero-padded YYYY-MM-DD");
assert.equal(isStrictCalendarDate("2026/08/02"), false, "slashes are rejected");
assert.equal(isStrictCalendarDate(""), false, "empty string is rejected");

// -- diffDays / addDays -------------------------------------------------------
assert.equal(diffDays("2026-08-01", "2026-08-05"), 4, "4 day forward span");
assert.equal(diffDays("2026-08-05", "2026-08-01"), -4, "negative span when reversed");
assert.equal(addDays("2026-08-30", 3), "2026-09-02", "addDays crosses a month boundary");
assert.equal(addDays("2026-08-05", -10), "2026-07-26", "addDays can move backward");
assert.equal(addDays("2026-08-05", 0), "2026-08-05", "zero delta is a no-op");

// -- pxToDayDelta --------------------------------------------------------------
assert.equal(pxToDayDelta(0, 20), 0, "no pixel movement is zero days");
assert.equal(pxToDayDelta(19, 20), 1, "rounds to nearest whole day");
assert.equal(pxToDayDelta(-19, 20), -1, "rounds negative movement toward nearest day too");
assert.equal(pxToDayDelta(9, 20), 0, "sub-half-day movement stays at zero days");
assert.equal(pxToDayDelta(100, 0), 0, "zero scale never divides by zero");

// -- isWithinClickThreshold -----------------------------------------------------
assert.equal(isWithinClickThreshold(0, 0), true, "no movement is a click");
assert.equal(isWithinClickThreshold(3, 0), true, "3px alone stays a click");
assert.equal(isWithinClickThreshold(3, 3), false, "combined 3px+3px exceeds the 4px threshold");
assert.equal(isWithinClickThreshold(5, 0), false, "5px alone is a drag");
assert.equal(isWithinClickThreshold(1, 1, 10), true, "custom threshold widens the click zone");

// -- computeBarMove: center-drag preserves duration ----------------------------
const moved = computeBarMove({ plannedStart: "2026-08-01", plannedEnd: "2026-08-10" }, 40, 20);
assert.deepEqual(
  moved,
  { plannedStart: "2026-08-03", plannedEnd: "2026-08-12" },
  "center drag shifts both dates by the same day delta",
);
assert.equal(diffDays(moved.plannedStart, moved.plannedEnd), 9, "duration is preserved across a center drag");

// -- computeBarResizeStart: left handle changes only the start ----------------
const resizedStart = computeBarResizeStart(
  { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
  40,
  20,
);
assert.deepEqual(resizedStart, { plannedStart: "2026-08-03" }, "left handle moves only plannedStart");
const clampedStart = computeBarResizeStart(
  { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
  400,
  20,
);
assert.deepEqual(
  clampedStart,
  { plannedStart: "2026-08-10" },
  "left handle clamps at plannedEnd instead of inverting the range",
);

// -- computeBarResizeEnd: right handle changes only the end -------------------
const resizedEnd = computeBarResizeEnd(
  { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
  -40,
  20,
);
assert.deepEqual(resizedEnd, { plannedEnd: "2026-08-08" }, "right handle moves only plannedEnd");
const clampedEnd = computeBarResizeEnd(
  { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
  -400,
  20,
);
assert.deepEqual(
  clampedEnd,
  { plannedEnd: "2026-08-01" },
  "right handle clamps at plannedStart instead of inverting the range",
);

// -- computeMilestoneMove -------------------------------------------------------
assert.deepEqual(
  computeMilestoneMove({ plannedDate: "2026-08-01" }, 60, 20),
  { plannedDate: "2026-08-04" },
  "milestone diamond drag moves its single planned date",
);

// -- isValidPlannedRange ---------------------------------------------------------
assert.equal(isValidPlannedRange({ plannedStart: null, plannedEnd: null }), true, "both unset is valid");
assert.equal(isValidPlannedRange({ plannedStart: "2026-08-01", plannedEnd: null }), true, "one-sided is valid");
assert.equal(
  isValidPlannedRange({ plannedStart: "2026-08-01", plannedEnd: "2026-08-01" }),
  true,
  "equal start/end (a milestone) is valid",
);
assert.equal(
  isValidPlannedRange({ plannedStart: "2026-08-10", plannedEnd: "2026-08-01" }),
  false,
  "start after end is invalid",
);
assert.equal(
  isValidPlannedRange({ plannedStart: "2026-02-30", plannedEnd: "2026-08-01" }),
  false,
  "a non-calendar date is invalid even if the string order looks fine",
);

// -- computeGateEndMove: NewCo blocking gate end-diamond drag ------------------
assert.deepEqual(
  computeGateEndMove({ plannedStart: "2026-08-01", plannedEnd: "2026-08-10" }, -40, 20),
  { plannedEnd: "2026-08-08" },
  "gate end-move shifts only plannedEnd",
);
assert.deepEqual(
  computeGateEndMove({ plannedStart: "2026-08-01", plannedEnd: "2026-08-10" }, -400, 20),
  { plannedEnd: "2026-08-01" },
  "gate end-move clamps at plannedStart instead of inverting",
);
assert.deepEqual(
  computeGateEndMove({ plannedStart: null, plannedEnd: "2026-08-10" }, 40, 20),
  { plannedEnd: "2026-08-12" },
  "gate end-move with no plannedStart has nothing to clamp against",
);

// -- isValidPointMilestoneRange: generic point-MS invariant --------------------
assert.equal(isValidPointMilestoneRange({ plannedStart: null, plannedEnd: null }), true, "both null is a valid point-MS");
assert.equal(
  isValidPointMilestoneRange({ plannedStart: "2026-08-01", plannedEnd: "2026-08-01" }),
  true,
  "equal start/end is a valid point-MS",
);
assert.equal(
  isValidPointMilestoneRange({ plannedStart: "2026-08-01", plannedEnd: "2026-08-05" }),
  false,
  "a real range is not a valid generic point-MS (NewCo blocking gates are exempt via a separate slug check, not this function)",
);
assert.equal(
  isValidPointMilestoneRange({ plannedStart: "2026-08-01", plannedEnd: null }),
  false,
  "one-sided is not a valid point-MS — a point-MS is both-null or both-equal, never half-set",
);

// -- normalizePointMilestonePatch: PATCH one date moves both / two conflicting dates reject ------
assert.deepEqual(
  normalizePointMilestonePatch("2026-08-05", undefined),
  { plannedStart: "2026-08-05", plannedEnd: "2026-08-05" },
  "PATCHing only planned_start normalizes planned_end to match",
);
assert.deepEqual(
  normalizePointMilestonePatch(undefined, "2026-08-07"),
  { plannedStart: "2026-08-07", plannedEnd: "2026-08-07" },
  "PATCHing only planned_end normalizes planned_start to match",
);
assert.deepEqual(
  normalizePointMilestonePatch("2026-08-05", "2026-08-05"),
  { plannedStart: "2026-08-05", plannedEnd: "2026-08-05" },
  "PATCHing both with matching values passes through unchanged",
);
assert.equal(
  normalizePointMilestonePatch("2026-08-05", "2026-08-09"),
  null,
  "PATCHing both with different values is a rejection, not a pick-one",
);
assert.deepEqual(
  normalizePointMilestonePatch(null, undefined),
  { plannedStart: null, plannedEnd: null },
  "PATCHing planned_start to null normalizes planned_end to null too",
);
assert.equal(
  normalizePointMilestonePatch(undefined, undefined),
  null,
  "PATCHing neither field is not normalizable (caller should not have invoked this at all)",
);

// -- shouldCancelOnLostPointerCapture: normal pointerup-release vs true abnormal loss -----------
assert.equal(
  shouldCancelOnLostPointerCapture(7, 7, 7),
  false,
  "lostpointercapture right after our own pointerup commit (commitStartedPointerId set) must not cancel it",
);
assert.equal(
  shouldCancelOnLostPointerCapture(7, null, 7),
  true,
  "lostpointercapture for the actively-dragging pointer, with no commit ever started, is a true abnormal loss and must cancel",
);
assert.equal(
  shouldCancelOnLostPointerCapture(null, null, 7),
  false,
  "lostpointercapture for a pointer that isn't the active drag at all is a no-op",
);
assert.equal(
  shouldCancelOnLostPointerCapture(3, null, 7),
  false,
  "lostpointercapture for a different pointerId than the active drag must not touch it",
);
assert.equal(
  shouldCancelOnLostPointerCapture(7, 3, 7),
  true,
  "a stale/different commitStartedPointerId does not shield this pointer's abnormal loss",
);

// -- dateFromPct: MSを置く placement click -> date -----------------------------
assert.equal(dateFromPct(0, "2026-08-01", "2026-09-30"), "2026-08-01", "0% lands on domain start");
assert.equal(dateFromPct(100, "2026-08-01", "2026-09-30"), "2026-09-30", "100% lands on domain end");
assert.equal(dateFromPct(50, "2026-08-01", "2026-09-30"), "2026-08-31", "50% lands mid-domain");
assert.equal(dateFromPct(-10, "2026-08-01", "2026-09-30"), "2026-08-01", "below 0% clamps to domain start");
assert.equal(dateFromPct(140, "2026-08-01", "2026-09-30"), "2026-09-30", "above 100% clamps to domain end");
assert.equal(dateFromPct(50, "2026-02-30", "2026-09-30"), null, "invalid domain start yields null");
assert.equal(dateFromPct(50, "2026-08-01", "2026-08-01"), null, "zero-width domain yields null");

console.log("sx gantt drag tests passed");
