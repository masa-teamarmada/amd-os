/**
 * member-weekly-activities cron の Calendar 時間メタデータ算出を純関数化したもの。
 * route.ts と scripts/check_member_weekly_calendar_duration.mts の両方から import する。
 */

export type GoogleEventDateTime = {
  date?: string | null;
  dateTime?: string | null;
};

export type CalendarEventTimeMeta = {
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number;
  all_day: boolean;
};

/** date のみ (dateTime 無し) の予定を all-day とみなす */
export function isAllDayEvent(start?: GoogleEventDateTime | null): boolean {
  return !!(start?.date && !start?.dateTime);
}

/**
 * all-day は duration_minutes=0。日時イベントは end-start を 0 以上の分で算出する
 * (Google のデータ不整合で end < start でも負値を返さない)。
 */
export function calendarEventDurationMinutes(
  startAt: string | null,
  endAt: string | null,
  allDay: boolean
): number {
  if (allDay) return 0;
  if (!startAt || !endAt) return 0;
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  const minutes = Math.round((endMs - startMs) / 60000);
  return Math.max(0, minutes);
}

export function calendarEventTimeMeta(
  start?: GoogleEventDateTime | null,
  end?: GoogleEventDateTime | null
): CalendarEventTimeMeta {
  const allDay = isAllDayEvent(start);
  const start_at = start?.dateTime || start?.date || null;
  const end_at = end?.dateTime || end?.date || null;
  return {
    start_at,
    end_at,
    duration_minutes: calendarEventDurationMinutes(start_at, end_at, allDay),
    all_day: allDay,
  };
}

/**
 * events.list は timeMin/timeMax(window) に重なる予定も返す (start が window 外でも
 * end が window に食い込む予定が含まれ得る)。18:00 境界の隣接 window で同じ予定が
 * 二重取得されるのを防ぐため、event start が [boundsStartIso, boundsEndIso) に
 * 入らない予定は明示的に除外する。
 */
export function isEventStartWithinBounds(
  eventStartIso: string | null,
  boundsStartIso: string,
  boundsEndIso: string
): boolean {
  if (!eventStartIso) return false;
  const startMs = new Date(eventStartIso).getTime();
  const boundsStartMs = new Date(boundsStartIso).getTime();
  const boundsEndMs = new Date(boundsEndIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(boundsStartMs) || !Number.isFinite(boundsEndMs)) return false;
  return startMs >= boundsStartMs && startMs < boundsEndMs;
}

export type CalendarTimeRaw = {
  event_id?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  duration_minutes?: number | null;
  all_day?: boolean | null;
};

/**
 * meeting_summary が Calendar evidence を置き換えるとき、calendarHit.raw から
 * event_id/start_at/end_at/duration_minutes/all_day だけを最小限で引き継ぐ。
 */
export function pickCalendarTimeMeta(raw: CalendarTimeRaw | null | undefined): {
  event_id: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number;
  all_day: boolean;
} {
  return {
    event_id: raw?.event_id ?? null,
    start_at: raw?.start_at ?? null,
    end_at: raw?.end_at ?? null,
    duration_minutes: typeof raw?.duration_minutes === "number" ? raw.duration_minutes : 0,
    all_day: raw?.all_day === true,
  };
}

export type EvidenceTimeMetadata = {
  event_id: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number | null;
  all_day: boolean | null;
};

/**
 * member_activities.raw_metadata.evidence_refs に載せる時間 metadata を必要最小限で抽出する。
 * calendar/meeting_summary 以外の evidence には時間情報を付けない (null のまま)。
 */
export function evidenceTimeMetadata(raw: CalendarTimeRaw | null | undefined): EvidenceTimeMetadata {
  if (!raw) return { event_id: null, start_at: null, end_at: null, duration_minutes: null, all_day: null };
  const hasTimeInfo = raw.start_at != null || raw.end_at != null || raw.all_day != null;
  if (!hasTimeInfo) return { event_id: null, start_at: null, end_at: null, duration_minutes: null, all_day: null };
  return {
    event_id: raw.event_id ?? null,
    start_at: raw.start_at ?? null,
    end_at: raw.end_at ?? null,
    duration_minutes: typeof raw.duration_minutes === "number" ? raw.duration_minutes : null,
    all_day: raw.all_day ?? null,
  };
}
