import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { managementMinuteFromRow, type ProjectManagementMinute } from "./project-management-minutes";

/** DD認可後に呼ぶ。MTGツリーと同じ正本をPJ限定・全期間で読む。 */
export async function loadProjectManagementMinutes(db: SupabaseClient, projectId: string): Promise<ProjectManagementMinute[]> {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const minutes: ProjectManagementMinute[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("project_meeting_summaries")
      .select("meeting_id,meeting_date,title,summary_short,decided,narrative_md,source_kinds")
      .eq("project_id", projectId).ilike("title", "%経営会議%")
      .lte("meeting_date", today).order("meeting_date", { ascending: false })
      .order("meeting_id", { ascending: false }).range(offset, offset + 499);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const minute = managementMinuteFromRow(row, today);
      if (minute && !seen.has(minute.meetingId)) { minutes.push(minute); seen.add(minute.meetingId); }
    }
    if ((data ?? []).length < 500) break;
  }
  return minutes;
}
