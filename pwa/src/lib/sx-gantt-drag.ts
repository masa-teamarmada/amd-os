/** Pure date math + pixel<->day conversion for the SX weekly-control gantt's
 * direct pointer editing (move/resize a phase bar, place/move a milestone
 * diamond). No DOM access, no React — every export here is a plain function
 * over strings/numbers so the drag math and its edge cases (day 0, inverted
 * ranges, sub-threshold moves) can be unit tested without mounting the gantt. */

export type SxGanttDateRange = {
  plannedStart: string | null;
  plannedEnd: string | null;
};

const STRICT_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real YYYY-MM-DD calendar date (rejects 2026-02-30,
 * 2026-13-01, non-zero-padded values, etc.) — a regex match alone is not
 * enough because Date normalizes out-of-range components instead of
 * rejecting them. */
export function isStrictCalendarDate(value: string): boolean {
  const match = STRICT_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toUtcDays(value: string): number {
  const match = STRICT_DATE_RE.exec(value);
  if (!match) throw new Error(`invalid date: ${value}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

function fromUtcDays(days: number): string {
  const date = new Date(days * 86_400_000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Whole-day difference, `to - from`. Both must be strict calendar dates. */
export function diffDays(from: string, to: string): number {
  return toUtcDays(to) - toUtcDays(from);
}

export function addDays(date: string, days: number): string {
  return fromUtcDays(toUtcDays(date) + Math.round(days));
}

/** Convert a horizontal pointer displacement into a whole-day delta at the
 * gantt's current pixels-per-day scale. Always rounds to the nearest whole
 * day — the gantt only ever shows day-granularity bars. */
export function pxToDayDelta(deltaPx: number, pxPerDay: number): number {
  if (pxPerDay <= 0) return 0;
  return Math.round(deltaPx / pxPerDay);
}

/** A pointer move below this many CSS pixels (in either axis) is a click,
 * not a drag — matches the requirement that click and drag never conflict. */
export const CLICK_DRAG_THRESHOLD_PX = 4;

export function isWithinClickThreshold(
  deltaX: number,
  deltaY: number,
  thresholdPx: number = CLICK_DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(deltaX, deltaY) < thresholdPx;
}

export type SxGanttMoveResult = { plannedStart: string; plannedEnd: string };

/** Drag the bar's center: both start and end shift by the same day delta,
 * so duration is preserved exactly. Requires both dates to already be set —
 * a row with no planned dates has no bar to grab. */
export function computeBarMove(
  original: { plannedStart: string; plannedEnd: string },
  deltaPx: number,
  pxPerDay: number,
): SxGanttMoveResult {
  const dayDelta = pxToDayDelta(deltaPx, pxPerDay);
  return {
    plannedStart: addDays(original.plannedStart, dayDelta),
    plannedEnd: addDays(original.plannedEnd, dayDelta),
  };
}

/** Drag the left handle: only plannedStart moves. Clamped so it can never
 * pass plannedEnd (a bar cannot invert by dragging its start past its end). */
export function computeBarResizeStart(
  original: { plannedStart: string; plannedEnd: string },
  deltaPx: number,
  pxPerDay: number,
): { plannedStart: string } {
  const dayDelta = pxToDayDelta(deltaPx, pxPerDay);
  const proposed = addDays(original.plannedStart, dayDelta);
  return { plannedStart: diffDays(proposed, original.plannedEnd) < 0 ? original.plannedEnd : proposed };
}

/** Drag the right handle: only plannedEnd moves. Clamped so it can never
 * pass plannedStart. */
export function computeBarResizeEnd(
  original: { plannedStart: string; plannedEnd: string },
  deltaPx: number,
  pxPerDay: number,
): { plannedEnd: string } {
  const dayDelta = pxToDayDelta(deltaPx, pxPerDay);
  const proposed = addDays(original.plannedEnd, dayDelta);
  return { plannedEnd: diffDays(original.plannedStart, proposed) < 0 ? original.plannedStart : proposed };
}

/** Drag a milestone diamond: a milestone's planned date is stored as
 * plannedStart===plannedEnd (a single day), so both columns are written
 * together and stay equal. */
export function computeMilestoneMove(
  original: { plannedDate: string },
  deltaPx: number,
  pxPerDay: number,
): { plannedDate: string } {
  const dayDelta = pxToDayDelta(deltaPx, pxPerDay);
  return { plannedDate: addDays(original.plannedDate, dayDelta) };
}

/** Drag a NewCo blocking gate's end diamond: unlike a generic point-MS, the 2 founding-
 * prerequisite gates may keep a real planned_start<planned_end range with only the end diamond
 * draggable — so only plannedEnd moves, and plannedStart (if any) is preserved and used only to
 * keep the range from inverting. When plannedStart is null (no start set yet) there is nothing to
 * clamp against. */
export function computeGateEndMove(
  original: { plannedStart: string | null; plannedEnd: string },
  deltaPx: number,
  pxPerDay: number,
): { plannedEnd: string } {
  const dayDelta = pxToDayDelta(deltaPx, pxPerDay);
  const proposed = addDays(original.plannedEnd, dayDelta);
  if (!original.plannedStart) return { plannedEnd: proposed };
  return { plannedEnd: diffDays(original.plannedStart, proposed) < 0 ? original.plannedStart : proposed };
}

/** planned_start <= planned_end when both are present — mirrors the DB
 * CHECK (migration 220) so the client can reject an inverted range before
 * ever sending the PATCH. */
export function isValidPlannedRange(range: SxGanttDateRange): boolean {
  if (!range.plannedStart || !range.plannedEnd) return true;
  if (!isStrictCalendarDate(range.plannedStart) || !isStrictCalendarDate(range.plannedEnd)) return false;
  return diffDays(range.plannedStart, range.plannedEnd) >= 0;
}

/** True when a milestone's planned_start/planned_end satisfy the generic point-MS invariant:
 * both null together, or equal (a single day). The 2 NewCo founding-prerequisite gates are exempt
 * from this — callers must check that separately (sxIsBlockingMilestone / SX_BLOCKING_MILESTONE_SLUGS)
 * before applying it. */
export function isValidPointMilestoneRange(range: SxGanttDateRange): boolean {
  if (range.plannedStart == null && range.plannedEnd == null) return true;
  return range.plannedStart === range.plannedEnd;
}

/** Given a PATCH that may touch planned_start and/or planned_end for a generic point-MS,
 * normalize so both columns end up equal — moving "the" date via either field moves both.
 * Returns null when the caller supplied both fields and they disagree (a genuine rejection, not
 * normalizable) — the caller must reject the PATCH in that case, not silently pick one. */
export function normalizePointMilestonePatch(
  patchStart: string | null | undefined,
  patchEnd: string | null | undefined,
): { plannedStart: string | null; plannedEnd: string | null } | null {
  const hasStart = patchStart !== undefined;
  const hasEnd = patchEnd !== undefined;
  if (hasStart && hasEnd) {
    if (patchStart !== patchEnd) return null;
    return { plannedStart: patchStart ?? null, plannedEnd: patchEnd ?? null };
  }
  if (hasStart) return { plannedStart: patchStart ?? null, plannedEnd: patchStart ?? null };
  if (hasEnd) return { plannedStart: patchEnd ?? null, plannedEnd: patchEnd ?? null };
  return null;
}

/** Decide whether a `lostpointercapture` event should cancel an in-flight gantt drag. A normal
 * pointerup also releases capture implicitly right after it's dispatched — that is not an
 * abnormal loss and must not wipe a save already in flight, so it's excluded whenever the pointer
 * that lost capture is the one whose commit had already begun (commitStartedPointerId, set
 * synchronously the instant finishDrag decides to PATCH, before the first await). Everything else
 * — capture lost for the pointer that's mid-drag but never reached commit — is a genuine abnormal
 * loss and must cancel. */
export function shouldCancelOnLostPointerCapture(
  activeDragPointerId: number | null,
  commitStartedPointerId: number | null,
  lostPointerId: number,
): boolean {
  if (commitStartedPointerId === lostPointerId) return false;
  return activeDragPointerId === lostPointerId;
}

/** Convert a click position (0-100, same convention as SxUnifiedTimeline's dateToPct) inside the
 * gantt's month-grid column into the calendar date under the pointer — used by "MSを置く"
 * placement mode: the user enters placement mode, then clicks a point inside one of the 3 lanes
 * to drop a new milestone there. Clamped to the domain and rounded to the nearest whole day. */
export function dateFromPct(pct: number, domainStart: string, domainEnd: string): string | null {
  if (!isStrictCalendarDate(domainStart) || !isStrictCalendarDate(domainEnd)) return null;
  const totalDays = diffDays(domainStart, domainEnd);
  if (totalDays <= 0) return null;
  const clamped = Math.min(100, Math.max(0, pct));
  return addDays(domainStart, Math.round((clamped / 100) * totalDays));
}
