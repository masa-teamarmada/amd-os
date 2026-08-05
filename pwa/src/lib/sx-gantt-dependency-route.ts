export type GanttPoint = {
  x: number;
  y: number;
};

export type GanttBarGeometry = {
  left: number;
  right: number;
};

export type GanttDependencyRoute = {
  path: string;
  points: GanttPoint[];
  label: GanttPoint;
};

export function timelinePctToPx(
  pct: number,
  paneWidth: number,
  sideGutterPx: number,
): number {
  const clamped = Math.min(100, Math.max(0, pct));
  return sideGutterPx + ((paneWidth - sideGutterPx * 2) * clamped) / 100;
}

/** Numeric twin of the CSS bar geometry used by the gantt renderer. Dependency endpoints must
 * use the visible bar edge, including the minimum-width expansion, rather than the raw date x. */
export function visibleBarGeometryPx(
  startPct: number,
  endPct: number,
  paneWidth: number,
  sideGutterPx: number,
  minWidthPx: number,
): GanttBarGeometry {
  const startX = timelinePctToPx(startPct, paneWidth, sideGutterPx);
  const endX = timelinePctToPx(endPct, paneWidth, sideGutterPx);
  const width = Math.max(minWidthPx, Math.max(0, endX - startX));
  const rightAnchored = endPct >= 100;
  const left = rightAnchored ? endX - width : startX;
  return { left, right: left + width };
}

function routePath(points: GanttPoint[]): string {
  return points
    .map((point, index) =>
      index === 0
        ? `M ${point.x} ${point.y}`
        : point.y === points[index - 1].y
          ? `H ${point.x}`
          : `V ${point.y}`,
    )
    .join(" ");
}

/** Finish-to-start routing with a guaranteed rightward final approach.
 *
 * A comfortably forward target uses three orthogonal segments. A close or backward target uses
 * a five-segment dogleg: leave the source to the right, cross between rows, move to the target's
 * left, then enter the target from left to right. */
export function buildFinishToStartRoute(
  source: GanttPoint,
  target: GanttPoint,
  options: {
    forwardGapPx?: number;
    exitPaddingPx?: number;
    entryPaddingPx?: number;
  } = {},
): GanttDependencyRoute {
  const forwardGapPx = options.forwardGapPx ?? 44;
  const exitPaddingPx = options.exitPaddingPx ?? 20;
  const entryPaddingPx = options.entryPaddingPx ?? 16;
  const gap = target.x - source.x;

  if (gap >= forwardGapPx) {
    const routeX = source.x + gap / 2;
    const points = [
      source,
      { x: routeX, y: source.y },
      { x: routeX, y: target.y },
      target,
    ];
    return {
      path: routePath(points),
      points,
      label: { x: routeX, y: source.y + (target.y - source.y) / 2 },
    };
  }

  const exitX = Math.max(source.x + exitPaddingPx, target.x + exitPaddingPx);
  const entryX = target.x - Math.min(entryPaddingPx, Math.max(1, target.x));
  const midY =
    source.y === target.y
      ? source.y + entryPaddingPx
      : source.y + (target.y - source.y) / 2;
  const points = [
    source,
    { x: exitX, y: source.y },
    { x: exitX, y: midY },
    { x: entryX, y: midY },
    { x: entryX, y: target.y },
    target,
  ];
  return {
    path: routePath(points),
    points,
    label: { x: entryX + (target.x - entryX) / 2, y: midY },
  };
}
