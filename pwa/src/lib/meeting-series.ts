import type { ProjectMeetingSummary } from "@/lib/supabase-data";

export type UpcomingMeetingSeriesKind = "single" | "series";

export interface UpcomingMeetingSeries {
  key: string;
  kind: UpcomingMeetingSeriesKind;
  next: ProjectMeetingSummary;
  items: ProjectMeetingSummary[];
  hiddenCount: number;
}

export function sourceKindTokens(sourceKinds: string | null): Set<string> {
  return new Set((sourceKinds || "").split("+").map((v) => v.trim()).filter(Boolean));
}

export function isUpcomingMeeting(item: ProjectMeetingSummary): boolean {
  const sourceKinds = sourceKindTokens(item.sourceKinds);
  return sourceKinds.has("upcoming") && !sourceKinds.has("upcoming_tentative");
}

export function isPrepMeeting(item: ProjectMeetingSummary): boolean {
  const sourceKinds = sourceKindTokens(item.sourceKinds);
  return item.meetingId.startsWith("upcoming:") || sourceKinds.has("upcoming") || sourceKinds.has("upcoming_tentative");
}

export function isTentativePrepMeeting(item: ProjectMeetingSummary): boolean {
  return isPrepMeeting(item) && !isUpcomingMeeting(item);
}

function normalizeUpcomingSeriesTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\b\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dayNumber(ymd: string): number {
  const [year, month, day] = ymd.split("-").map((v) => Number(v));
  if (!year || !month || !day) return Number.NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function weekdayKey(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? "unknown" : String(d.getDay());
}

function formatTimeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function timeKey(item: ProjectMeetingSummary): string {
  return item.meetingStartAt ? formatTimeLabel(item.meetingStartAt) : "";
}

function meetingStartKey(item: ProjectMeetingSummary): string {
  return item.meetingStartAt || `${item.meetingDate}T00:00:00+09:00`;
}

export function compareMeetingStartAsc(a: ProjectMeetingSummary, b: ProjectMeetingSummary): number {
  return meetingStartKey(a).localeCompare(meetingStartKey(b));
}

function recurringSeriesId(item: ProjectMeetingSummary): string | null {
  const raw = item.calendarEventId || item.meetingId.replace(/^upcoming:/, "");
  const match = raw.match(/^(.+)_\d{8}(?:T\d{6}Z?)?$/);
  return match?.[1] || null;
}

function looksSeriesLikeTitle(title: string): boolean {
  return /定例|毎週|隔週|月次|毎月|weekly|biweekly|monthly/i.test(title);
}

function looksSeriesLikeByTitle(item: ProjectMeetingSummary): boolean {
  return looksSeriesLikeTitle(item.title);
}

function upcomingSeriesKey(item: ProjectMeetingSummary): string {
  const seriesId = recurringSeriesId(item);
  if (seriesId) return `calendar-series:${item.projectId}:${seriesId}`;
  const title = normalizeUpcomingSeriesTitle(item.title) || "(untitled)";
  if (looksSeriesLikeTitle(item.title)) {
    return [
      "title-series",
      item.projectId,
      title,
      timeKey(item),
    ].join(":");
  }
  return [
    "fallback",
    item.projectId,
    title,
    weekdayKey(item.meetingDate),
    timeKey(item),
  ].join(":");
}

function hasWeeklyCadence(items: ProjectMeetingSummary[], hasCalendarSeriesId: boolean): boolean {
  if (items.length < (hasCalendarSeriesId ? 2 : 3)) return false;
  const ordered = [...items].sort(compareMeetingStartAsc);
  let weeklyPairs = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = dayNumber(ordered[i - 1].meetingDate);
    const current = dayNumber(ordered[i].meetingDate);
    if (!Number.isFinite(prev) || !Number.isFinite(current)) continue;
    const diff = current - prev;
    if (diff >= 6 && diff <= 8) weeklyPairs += 1;
  }
  const requiredPairs = hasCalendarSeriesId ? 1 : Math.max(2, Math.floor((ordered.length - 1) * 0.6));
  return weeklyPairs >= requiredPairs;
}

function shouldCollapseAsSeries(key: string, group: ProjectMeetingSummary[]): boolean {
  const hasCalendarSeriesId = key.startsWith("calendar-series:");
  if (hasCalendarSeriesId) return true;
  if (key.startsWith("title-series:") && group.length >= 2) return true;
  if (group.some(looksSeriesLikeByTitle) && group.length >= 2) return true;
  return hasWeeklyCadence(group, false);
}

export function groupUpcomingMeetingsBySeries(items: ProjectMeetingSummary[]): UpcomingMeetingSeries[] {
  const groups = new Map<string, ProjectMeetingSummary[]>();
  for (const item of items) {
    const key = upcomingSeriesKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const series: UpcomingMeetingSeries[] = [];
  for (const [key, group] of groups) {
    const ordered = [...group].sort(compareMeetingStartAsc);
    const collapse = shouldCollapseAsSeries(key, ordered);
    if (collapse) {
      series.push({
        key,
        kind: "series",
        next: ordered[0],
        items: ordered,
        hiddenCount: Math.max(0, ordered.length - 1),
      });
      continue;
    }

    for (const item of ordered) {
      series.push({
        key: `${key}:${item.meetingId}`,
        kind: "single",
        next: item,
        items: [item],
        hiddenCount: 0,
      });
    }
  }

  return series.sort((a, b) => compareMeetingStartAsc(a.next, b.next));
}
