#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  calendarEventDurationMinutes,
  calendarEventTimeMeta,
  isAllDayEvent,
  isEventStartWithinBounds,
  pickCalendarTimeMeta,
  evidenceTimeMetadata,
} from "../src/lib/member-weekly-calendar-duration.ts";

// all-day (date のみ) は all_day=true, duration_minutes=0
{
  const meta = calendarEventTimeMeta({ date: "2026-07-20" }, { date: "2026-07-21" });
  assert.equal(meta.all_day, true);
  assert.equal(meta.duration_minutes, 0);
  assert.equal(meta.start_at, "2026-07-20");
  assert.equal(meta.end_at, "2026-07-21");
  assert.equal(isAllDayEvent({ date: "2026-07-20" }), true);
  assert.equal(isAllDayEvent({ date: "2026-07-20", dateTime: "2026-07-20T09:00:00+09:00" }), false);
}

// 日時イベントは end-start を分単位で算出
{
  const meta = calendarEventTimeMeta(
    { dateTime: "2026-07-20T09:00:00+09:00" },
    { dateTime: "2026-07-20T10:30:00+09:00" }
  );
  assert.equal(meta.all_day, false);
  assert.equal(meta.duration_minutes, 90);
}

// end < start (データ不整合) でも負値を返さない
{
  const minutes = calendarEventDurationMinutes(
    "2026-07-20T10:00:00+09:00",
    "2026-07-20T09:00:00+09:00",
    false
  );
  assert.equal(minutes, 0);
}

// start/end 欠損時も 0
{
  assert.equal(calendarEventDurationMinutes(null, "2026-07-20T09:00:00+09:00", false), 0);
  assert.equal(calendarEventDurationMinutes("2026-07-20T09:00:00+09:00", null, false), 0);
}

// window bounds: [start,end) の外の event start は除外 (18:00境界の隣接window二重取得防止)
{
  const boundsStart = "2026-07-19T09:00:00.000Z"; // = 2026-07-19 18:00 JST
  const boundsEnd = "2026-07-20T09:00:00.000Z"; // = 2026-07-20 18:00 JST
  assert.equal(isEventStartWithinBounds("2026-07-19T09:00:00.000Z", boundsStart, boundsEnd), true); // inclusive start
  assert.equal(isEventStartWithinBounds("2026-07-20T08:59:00.000Z", boundsStart, boundsEnd), true);
  assert.equal(isEventStartWithinBounds("2026-07-20T09:00:00.000Z", boundsStart, boundsEnd), false); // exclusive end
  assert.equal(isEventStartWithinBounds("2026-07-19T08:59:00.000Z", boundsStart, boundsEnd), false); // before window
  assert.equal(isEventStartWithinBounds(null, boundsStart, boundsEnd), false);
}

// meeting_summary が calendar evidence を置き換えるとき、event_id/start_at/end_at/duration_minutes/all_day を引き継ぐ
{
  const picked = pickCalendarTimeMeta({
    event_id: "evt123",
    start_at: "2026-07-20T09:00:00+09:00",
    end_at: "2026-07-20T10:00:00+09:00",
    duration_minutes: 60,
    all_day: false,
  });
  assert.equal(picked.event_id, "evt123");
  assert.equal(picked.start_at, "2026-07-20T09:00:00+09:00");
  assert.equal(picked.end_at, "2026-07-20T10:00:00+09:00");
  assert.equal(picked.duration_minutes, 60);
  assert.equal(picked.all_day, false);
}

// raw が無い/欠損時は安全な default
{
  const picked = pickCalendarTimeMeta(null);
  assert.equal(picked.event_id, null);
  assert.equal(picked.start_at, null);
  assert.equal(picked.duration_minutes, 0);
  assert.equal(picked.all_day, false);
}

// evidence_refs 用の時間 metadata は必要最小限 (participant emails / 本文を含まない)
{
  const meta = evidenceTimeMetadata({
    event_id: "evt1",
    start_at: "2026-07-20T09:00:00+09:00",
    end_at: "2026-07-20T10:00:00+09:00",
    duration_minutes: 60,
    all_day: false,
  });
  assert.deepEqual(meta, {
    event_id: "evt1",
    start_at: "2026-07-20T09:00:00+09:00",
    end_at: "2026-07-20T10:00:00+09:00",
    duration_minutes: 60,
    all_day: false,
  });
  assert.equal(Object.keys(meta).includes("participant_emails" as never), false);
}

// gmail/source_cache evidence (時間情報を持たない raw) は event_id も null のまま
{
  const meta = evidenceTimeMetadata({ message_id: "m1" } as never);
  assert.deepEqual(meta, { event_id: null, start_at: null, end_at: null, duration_minutes: null, all_day: null });
  const metaUndefined = evidenceTimeMetadata(undefined);
  assert.deepEqual(metaUndefined, { event_id: null, start_at: null, end_at: null, duration_minutes: null, all_day: null });
}

console.log(JSON.stringify({ ok: true, checks: "member-weekly-calendar-duration" }, null, 2));
