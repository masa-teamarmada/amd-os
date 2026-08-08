import assert from "node:assert/strict";
import {
  buildFinishToStartRoute,
  timelinePctToPx,
  visibleBarGeometryPx,
} from "../src/lib/sx-gantt-dependency-route.ts";

function assertExactEndpoints(route, source, target, label) {
  assert.deepEqual(route.points[0], source, `${label}: route starts at visible source edge`);
  assert.deepEqual(
    route.points.at(-1),
    target,
    `${label}: route ends at visible target edge`,
  );
  const beforeTarget = route.points.at(-2);
  assert.equal(beforeTarget.y, target.y, `${label}: final segment is horizontal`);
  assert.ok(beforeTarget.x < target.x, `${label}: final segment enters left-to-right`);
}

const forwardSource = { x: 100, y: 24 };
const forwardTarget = { x: 220, y: 72 };
const forward = buildFinishToStartRoute(forwardSource, forwardTarget);
assert.equal(forward.points.length, 4, "wide forward dependency uses three segments");
assertExactEndpoints(forward, forwardSource, forwardTarget, "wide forward");

const sameDateSource = { x: 160, y: 24 };
const sameDateTarget = { x: 160, y: 72 };
const sameDate = buildFinishToStartRoute(sameDateSource, sameDateTarget);
assert.equal(sameDate.points.length, 6, "same-date dependency uses five-segment dogleg");
assert.equal(
  sameDate.points[1].x - sameDateSource.x,
  5,
  "dogleg leaves the source by only the compact 5px clearance",
);
assert.equal(
  sameDateTarget.x - sameDate.points.at(-2).x,
  4,
  "dogleg reaches the target with only the compact 4px entry clearance",
);
assertExactEndpoints(sameDate, sameDateSource, sameDateTarget, "same date");

const closeForward = buildFinishToStartRoute(
  { x: 100, y: 24 },
  { x: 112, y: 72 },
);
assert.equal(
  closeForward.points.length,
  4,
  "a 12px forward gap stays on the simple three-segment route",
);
assertExactEndpoints(
  closeForward,
  { x: 100, y: 24 },
  { x: 112, y: 72 },
  "compact forward gap",
);

const backwardSource = { x: 280, y: 24 };
const backwardTarget = { x: 120, y: 120 };
const backward = buildFinishToStartRoute(backwardSource, backwardTarget);
assert.equal(backward.points.length, 6, "backward dependency uses five-segment dogleg");
assert.ok(backward.points[1].x > backwardSource.x, "dogleg first clears source to the right");
assertExactEndpoints(backward, backwardSource, backwardTarget, "backward");

const paneWidth = 1000;
const gutter = 22;
const minBarWidth = 16;
const oneDayBar = visibleBarGeometryPx(40, 40, paneWidth, gutter, minBarWidth);
assert.equal(oneDayBar.right - oneDayBar.left, 16, "same-day bar uses visible 16px minimum width");
const minWidthRoute = buildFinishToStartRoute(
  { x: oneDayBar.right, y: 24 },
  { x: oneDayBar.left, y: 72 },
);
assertExactEndpoints(
  minWidthRoute,
  { x: oneDayBar.right, y: 24 },
  { x: oneDayBar.left, y: 72 },
  "minimum-width bar",
);

const milestoneCenter = timelinePctToPx(55, paneWidth, gutter);
const milestoneRadius = 12 / Math.sqrt(2);
const taskToMilestone = buildFinishToStartRoute(
  { x: 420, y: 72 },
  { x: milestoneCenter - milestoneRadius, y: 17 },
);
assertExactEndpoints(
  taskToMilestone,
  { x: 420, y: 72 },
  { x: milestoneCenter - milestoneRadius, y: 17 },
  "task to milestone",
);
const milestoneToTask = buildFinishToStartRoute(
  { x: milestoneCenter + milestoneRadius, y: 17 },
  { x: 760, y: 120 },
);
assertExactEndpoints(
  milestoneToTask,
  { x: milestoneCenter + milestoneRadius, y: 17 },
  { x: 760, y: 120 },
  "milestone to task",
);

console.log("sx gantt dependency route tests: ok");
