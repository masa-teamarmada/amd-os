/**
 * member_weekly_effort_plan の純関数 (computeMemberWeeklyEffortPlan) を使い、
 * project_weekly_effort_entries (source_kind='inferred') を実際に DB 同期する
 * server-only helper。member_activities(source='member_weekly') の delete+upsert
 * 成功直後にのみ呼ぶこと (legacy GET save では呼ばない)。
 */
import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeMemberWeeklyEffortPlan,
  mondayWeekStartJst,
  type ExistingEffortRow,
  type MemberActivityRow,
} from "@/lib/member-weekly-effort-plan";

export type MemberWeeklyEffortSyncOptions = {
  windowStartIso: string;
  windowEndIso: string;
  memberId?: string | null;
  projectId?: string | null;
};

export type MemberWeeklyEffortSyncResult = {
  weeks: number;
  upserted: number;
  deleted: number;
};

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function weekStartToUtcIso(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map((v) => Number.parseInt(v, 10));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - JST_OFFSET_MS).toISOString();
}

function addDaysToWeekStart(weekStart: string, days: number): string {
  const [y, m, d] = weekStart.split("-").map((v) => Number.parseInt(v, 10));
  const next = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function enumerateMondayWeeks(windowStartIso: string, windowEndIso: string): string[] {
  const startWeek = mondayWeekStartJst(windowStartIso);
  const lastMs = new Date(windowEndIso).getTime() - 1;
  const endWeek = mondayWeekStartJst(new Date(lastMs).toISOString());

  const weeks: string[] = [];
  let cursor = startWeek;
  while (true) {
    weeks.push(cursor);
    if (cursor === endWeek) break;
    cursor = addDaysToWeekStart(cursor, 7);
  }
  return weeks;
}

export async function syncMemberWeeklyEffortEntries(
  supabase: SupabaseClient,
  options: MemberWeeklyEffortSyncOptions
): Promise<MemberWeeklyEffortSyncResult> {
  const weeks = enumerateMondayWeeks(options.windowStartIso, options.windowEndIso);
  const rangeStartIso = weekStartToUtcIso(weeks[0]);
  const rangeEndIso = weekStartToUtcIso(addDaysToWeekStart(weeks[weeks.length - 1], 7));

  let activitiesQuery = supabase
    .from("member_activities")
    .select("member_id, project_id, item_date, title, content_preview, raw_metadata")
    .eq("source", "member_weekly")
    .gte("item_date", rangeStartIso)
    .lt("item_date", rangeEndIso);
  if (options.memberId) activitiesQuery = activitiesQuery.eq("member_id", options.memberId);
  if (options.projectId) activitiesQuery = activitiesQuery.eq("project_id", options.projectId);
  const activitiesRes = await activitiesQuery;
  if (activitiesRes.error) throw activitiesRes.error;

  let effortQuery = supabase
    .from("project_weekly_effort_entries")
    .select("id, member_id, project_id, week_start, work_category, source_kind")
    .in("week_start", weeks);
  if (options.memberId) effortQuery = effortQuery.eq("member_id", options.memberId);
  if (options.projectId) effortQuery = effortQuery.eq("project_id", options.projectId);
  const effortRes = await effortQuery;
  if (effortRes.error) throw effortRes.error;

  const activities = (activitiesRes.data ?? []) as MemberActivityRow[];
  const existingEffort = (effortRes.data ?? []) as ExistingEffortRow[];
  const plan = computeMemberWeeklyEffortPlan(activities, existingEffort);

  if (plan.deleteIds.length > 0) {
    const { error } = await supabase
      .from("project_weekly_effort_entries")
      .delete()
      .in("id", plan.deleteIds);
    if (error) throw error;
  }

  if (plan.upserts.length > 0) {
    const nowIso = new Date().toISOString();
    const payload = plan.upserts.map((upsert) => {
      const { id, ...rest } = upsert;
      // PostgREST は既存 ID あり行と ID 無し行を同じ bulk upsert に混ぜると、
      // ID 無し行へ DB default ではなく null を送る。新規行には明示 ID を与える。
      return { id: id || randomUUID(), ...rest, updated_at: nowIso };
    });
    const { error } = await supabase
      .from("project_weekly_effort_entries")
      .upsert(payload, { onConflict: "project_id,member_id,week_start,work_category" });
    if (error) throw error;
  }

  return {
    weeks: weeks.length,
    upserted: plan.upserts.length,
    deleted: plan.deleteIds.length,
  };
}
