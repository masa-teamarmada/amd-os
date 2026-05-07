/**
 * Google Calendar 生データ抽出。
 * env: 共通 google.ts (OAuth refresh token 推奨)
 *
 * Calendar API:
 *   - events.list で q (free text 検索) + timeMin/timeMax
 *   - 過去 1 年 + 未来 6 ヶ月のレンジで絞る (cron 実行時、毎週なので時間枠は固定)
 */

import { google } from "googleapis";
import { getGoogleAuthAsync } from "./google";

export interface CalendarHit {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  attendees: string[];      // emails
  location: string | null;
  description: string | null;
  htmlLink: string | null;
}

export async function fetchCalendarContext(
  query: string,
  opts: { calendarId?: string; rangeMonthsBack?: number; rangeMonthsAhead?: number; limit?: number } = {}
): Promise<CalendarHit[]> {
  const auth = await getGoogleAuthAsync();
  if (!auth) {
    console.warn("[calendar] no Google auth — skipping");
    return [];
  }
  const cal = google.calendar({ version: "v3", auth });
  const calendarId = opts.calendarId ?? "primary";
  const rangeBack = opts.rangeMonthsBack ?? 24;
  const rangeAhead = opts.rangeMonthsAhead ?? 12;
  const limit = opts.limit ?? 30;
  const now = new Date();
  const timeMin = new Date(now); timeMin.setMonth(timeMin.getMonth() - rangeBack);
  const timeMax = new Date(now); timeMax.setMonth(timeMax.getMonth() + rangeAhead);
  try {
    const r = await cal.events.list({
      calendarId,
      q: query,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: Math.min(limit, 250),
      orderBy: "startTime",
      singleEvents: true,
    });
    return (r.data.items ?? []).map((e) => ({
      id: e.id ?? "",
      summary: e.summary ?? "(無題)",
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
      location: e.location ?? null,
      description: e.description ?? null,
      htmlLink: e.htmlLink ?? null,
    }));
  } catch (e) {
    console.error("[calendar] list failed:", e);
    return [];
  }
}
