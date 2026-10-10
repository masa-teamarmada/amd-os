import "server-only";
import { sharedMeetingNarrative } from "./shared-meeting-content";
import type { SupabaseClient } from "@supabase/supabase-js";
import { managementMinuteFromRow, parseMeetingResolutions, MEETING_RESOLUTIONS_KEY_PREFIX, type ProjectManagementMinute } from "./project-management-minutes";

/** DD認可後に呼ぶ。MTGツリーと同じ正本をPJ限定・全期間で読む。 */
export async function loadProjectManagementMinutes(db: SupabaseClient, projectId: string, sharedOnly=false): Promise<ProjectManagementMinute[]> {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const minutes: ProjectManagementMinute[] = [];
  const seen = new Set<string>();
  const sourceHashes = new Map<string, unknown>();
  for (let offset = 0; ; offset += 500) {
    let query = db.from("project_meeting_summaries")
      .select("meeting_id,meeting_date,title,summary_short,decided,narrative_md,source_kinds,source_hash")
      .eq("project_id", projectId).ilike("title", "%経営会議%")
      .lte("meeting_date", today).order("meeting_date", { ascending: false })
      .order("meeting_id", { ascending: false }).range(offset, offset + 499);
    if (sharedOnly) query = query.eq("workspace_shared",true);
    const {data,error} = await query;
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const minute = managementMinuteFromRow(sharedOnly ? {...row,narrative_md:sharedMeetingNarrative(row.narrative_md)} : row, today);
      if (minute && !seen.has(minute.meetingId)) { minutes.push(minute); sourceHashes.set(minute.meetingId, row.source_hash); seen.add(minute.meetingId); }
    }
    if ((data ?? []).length < 500) break;
  }
  // Private resolution annotations have no independent publication flag.
  if (sharedOnly) return minutes;
  for (let offset = 0; offset < minutes.length; offset += 100) {
    const chunk = minutes.slice(offset, offset + 100);
    const { data, error } = await db.from("project_config").select("key,value").eq("project_id", projectId)
      .in("key", chunk.map(minute => MEETING_RESOLUTIONS_KEY_PREFIX + minute.meetingId));
    if (error) throw new Error(error.message);
    const values = new Map((data ?? []).map(row => [row.key, row.value]));
    for (const minute of chunk) minute.resolutions = parseMeetingResolutions(values.get(MEETING_RESOLUTIONS_KEY_PREFIX + minute.meetingId), sourceHashes.get(minute.meetingId), minute);
  }
  return minutes;
}
