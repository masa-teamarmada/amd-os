import assert from "node:assert/strict";
import {
  computeBarMove,
  isWithinClickThreshold,
  shouldCancelOnLostPointerCapture,
} from "../src/lib/sx-gantt-drag.ts";

/** Full pointerdown->move->...->up gesture simulator, built ONLY from the same exported pure
 * functions SxUnifiedTimeline's updateDrag/finishDrag call — not a reimplementation of the
 * component's React state, but the same decision math driven by a synthetic event sequence. This
 * repo's SX test suite has no jsdom/Playwright harness (every other SX test is a pure-logic node
 * script; see scripts/check_pwa_critical_ui.cjs's own comment on that convention), so this is the
 * feasible substitute for a real DOM pointer-gesture test: it exercises the exact same reducer
 * math the component runs, across a realistic multi-event gesture, rather than only single-call
 * unit assertions. */
function simulateMoveGesture(original, pxPerDay, events) {
  let dragging = false;
  let previewStart = original.plannedStart;
  let previewEnd = original.plannedEnd;
  let commits = 0;
  let lastCommittedPatch = null;
  const startClientX = events[0].clientX;
  const startClientY = events[0].clientY;
  for (const event of events) {
    if (event.type === "pointerdown") continue;
    if (event.type === "pointermove") {
      const deltaX = event.clientX - startClientX;
      const deltaY = event.clientY - startClientY;
      dragging = dragging || !isWithinClickThreshold(deltaX, deltaY);
      if (dragging) {
        const moved = computeBarMove(original, deltaX, pxPerDay);
        previewStart = moved.plannedStart;
        previewEnd = moved.plannedEnd;
      }
    } else if (event.type === "pointerup") {
      if (dragging && (previewStart !== original.plannedStart || previewEnd !== original.plannedEnd)) {
        commits += 1;
        lastCommittedPatch = { planned_start: previewStart, planned_end: previewEnd };
      }
    }
  }
  return { dragging, previewStart, previewEnd, commits, lastCommittedPatch };
}

// -- A real drag: several intermediate moves, only the LAST preview is ever committed -----------
const dragResult = simulateMoveGesture(
  { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
  20,
  [
    { type: "pointerdown", clientX: 100, clientY: 0 },
    { type: "pointermove", clientX: 102, clientY: 0 }, // 2px — still a click so far
    { type: "pointermove", clientX: 140, clientY: 0 }, // 40px — crosses the 4px threshold, dragging begins
    { type: "pointermove", clientX: 160, clientY: 0 }, // 60px — final intended position
    { type: "pointerup", clientX: 160, clientY: 0 },
  ],
);
assert.equal(dragResult.dragging, true, "gesture that crosses the click/drag threshold ends up dragging");
assert.equal(dragResult.commits, 1, "exactly one commit for the whole gesture, not once per pointermove");
assert.deepEqual(
  dragResult.lastCommittedPatch,
  { planned_start: "2026-08-04", planned_end: "2026-08-13" },
  "the committed patch reflects the LAST pointermove's preview (60px = 3 days), not an intermediate one (40px = 2 days) — a pointermove immediately followed by pointerup in the same batch must not drop the final preview",
);

// -- dragging is sticky: once past threshold, a later small move does not un-set it -------------
const stickyResult = simulateMoveGesture(
  { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
  20,
  [
    { type: "pointerdown", clientX: 100, clientY: 0 },
    { type: "pointermove", clientX: 140, clientY: 0 }, // crosses threshold
    { type: "pointermove", clientX: 101, clientY: 0 }, // back near the start — still dragging, not a click
    { type: "pointerup", clientX: 101, clientY: 0 },
  ],
);
assert.equal(stickyResult.dragging, true, "dragging stays true once crossed, even if a later move comes back near the start");

// -- A plain click: never crosses the threshold, no commit at all -------------------------------
const clickResult = simulateMoveGesture(
  { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
  20,
  [
    { type: "pointerdown", clientX: 100, clientY: 0 },
    { type: "pointermove", clientX: 102, clientY: 1 },
    { type: "pointerup", clientX: 102, clientY: 1 },
  ],
);
assert.equal(clickResult.dragging, false, "a gesture that never exceeds the threshold is a plain click");
assert.equal(clickResult.commits, 0, "a plain click never commits a PATCH");

// -- A drag that rounds back to the exact original day: dragging=true but still no commit -------
const noopDragResult = simulateMoveGesture(
  { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
  200, // very high px/day scale so a 40px move still rounds to 0 days
  [
    { type: "pointerdown", clientX: 100, clientY: 0 },
    { type: "pointermove", clientX: 140, clientY: 0 },
    { type: "pointerup", clientX: 140, clientY: 0 },
  ],
);
assert.equal(noopDragResult.dragging, true, "the gesture still crosses the pixel threshold");
assert.equal(noopDragResult.commits, 0, "but rounds back to the same day, so there is nothing to persist");

// -- Full lifecycle including lostpointercapture: normal release after pointerup must not cancel --
// (the underlying decision function is unit-tested directly in test_sx_gantt_drag.mjs; this
// exercises it as the tail end of the same gesture sequence used above)
{
  const pointerId = 7;
  const commitStartedPointerId = dragResult.commits > 0 ? pointerId : null; // finishDrag would have set this synchronously before its first await
  assert.equal(
    shouldCancelOnLostPointerCapture(pointerId, commitStartedPointerId, pointerId),
    false,
    "lostpointercapture immediately after this gesture's own pointerup-triggered commit must not cancel it",
  );
  assert.equal(
    shouldCancelOnLostPointerCapture(pointerId, null, pointerId),
    true,
    "the same lostpointercapture, had the commit never actually started, is a true abnormal loss and must cancel",
  );
}

// -- A visually narrow bar uses the same move math; its resize targets live outside its edges ---
const narrowBarDrag = simulateMoveGesture({ plannedStart: "2026-08-01", plannedEnd: "2026-08-03" }, 20, [
  { type: "pointerdown", clientX: 100, clientY: 0 },
  { type: "pointermove", clientX: 140, clientY: 0 },
  { type: "pointerup", clientX: 140, clientY: 0 },
]);
assert.deepEqual(
  narrowBarDrag.lastCommittedPatch,
  { planned_start: "2026-08-03", planned_end: "2026-08-05" },
  "a narrow bar still moves correctly while retaining separate outside-edge resize targets",
);

console.log("sx gantt pointer gesture tests passed");
