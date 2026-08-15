import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchIcs, IcsFetchError, parseIcs, type IcsEvent } from "@/lib/calendar-ics";

/**
 * 公開ICSをAMD OSへ取り込む。
 *
 * 方針:
 * - 取り込むのは件名・日時・場所・UIDだけ。本文/添付/参加者は parseIcs の時点で捨てている。
 * - フィードから消えた予定は行を削除せず `disappeared_at` を立てる。取得失敗と削除を
 *   区別できないため、消えたことを確定として扱わない。
 * - 業務(マイルストーン)との紐づけは `suggested` までしか自動で進めない。確定は人が行う。
 */

export type SyncResult = {
  sourceId: string;
  ok: boolean;
  eventCount: number;
  inserted: number;
  updated: number;
  disappeared: number;
  error: string | null;
};

type SourceRow = {
  id: string;
  project_id: string;
  feed_url: string;
  status: string;
  visibility_level: string;
};

function toDbRow(sourceId: string, projectId: string, event: IcsEvent, nowIso: string) {
  return {
    source_id: sourceId,
    project_id: projectId,
    event_uid: event.uid,
    summary: event.summary,
    location: event.location,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    is_all_day: event.isAllDay,
    ics_status: event.status,
    last_seen_at: nowIso,
    disappeared_at: null as string | null,
  };
}

export async function syncCalendarFeed(sourceId: string): Promise<SyncResult> {
  const db = createAdminClient();
  const base: SyncResult = {
    sourceId,
    ok: false,
    eventCount: 0,
    inserted: 0,
    updated: 0,
    disappeared: 0,
    error: null,
  };

  const { data: source, error: sourceError } = await db
    .from("calendar_feed_sources")
    .select("id,project_id,feed_url,status,visibility_level")
    .eq("id", sourceId)
    .maybeSingle<SourceRow>();

  if (sourceError || !source) {
    return { ...base, error: "source_not_found" };
  }
  if (source.status !== "active") {
    return { ...base, error: `source_${source.status}` };
  }

  let raw: string;
  try {
    raw = await fetchIcs(source.feed_url);
  } catch (error) {
    const message =
      error instanceof IcsFetchError
        ? error.message
        : `ICSの取得に失敗した: ${error instanceof Error ? error.message : String(error)}`;
    await db
      .from("calendar_feed_sources")
      .update({
        last_fetched_at: new Date().toISOString(),
        last_fetch_status: message.slice(0, 200),
      })
      .eq("id", sourceId);
    return { ...base, error: message };
  }

  const events = parseIcs(raw);
  const nowIso = new Date().toISOString();

  // 既存UIDを引いて、挿入と更新を数え分ける。
  const { data: existingRows } = await db
    .from("calendar_feed_events")
    .select("event_uid")
    .eq("source_id", sourceId);
  const existingUids = new Set((existingRows ?? []).map((row) => String(row.event_uid)));

  let inserted = 0;
  let updated = 0;
  if (events.length > 0) {
    const rows = events.map((event) => toDbRow(sourceId, source.project_id, event, nowIso));
    const { error: upsertError } = await db
      .from("calendar_feed_events")
      .upsert(rows, { onConflict: "source_id,event_uid" });
    if (upsertError) {
      return { ...base, eventCount: events.length, error: `保存に失敗した: ${upsertError.message}` };
    }
    for (const event of events) {
      if (existingUids.has(event.uid)) updated += 1;
      else inserted += 1;
    }
  }

  // 今回のフィードに無かった行へ印を付ける。削除はしない。
  const seenUids = events.map((event) => event.uid);
  let disappeared = 0;
  const { data: goneRows } = await db
    .from("calendar_feed_events")
    .select("id,event_uid")
    .eq("source_id", sourceId)
    .is("disappeared_at", null);
  const goneTargets = (goneRows ?? []).filter((row) => !seenUids.includes(String(row.event_uid)));
  if (goneTargets.length > 0) {
    const { error: goneError } = await db
      .from("calendar_feed_events")
      .update({ disappeared_at: nowIso })
      .in(
        "id",
        goneTargets.map((row) => String(row.id)),
      );
    if (!goneError) disappeared = goneTargets.length;
  }

  await db
    .from("calendar_feed_sources")
    .update({
      last_fetched_at: nowIso,
      last_fetch_status: "ok",
      last_event_count: events.length,
    })
    .eq("id", sourceId);

  return {
    sourceId,
    ok: true,
    eventCount: events.length,
    inserted,
    updated,
    disappeared,
    error: null,
  };
}

export async function syncAllActiveFeeds(projectId?: string): Promise<SyncResult[]> {
  const db = createAdminClient();
  let query = db.from("calendar_feed_sources").select("id").eq("status", "active");
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error || !data) return [];
  const results: SyncResult[] = [];
  for (const row of data) {
    results.push(await syncCalendarFeed(String(row.id)));
  }
  return results;
}
