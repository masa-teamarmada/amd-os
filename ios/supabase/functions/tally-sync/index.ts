import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-tally-sync-key",
};
const MAX_PROJECTS = 100;
const MAX_WEEKS = 5_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Week = { weekStart: string; developmentHours: number; meetingHours: number };
type Project = { projectID: string; displayName: string; meetingSearchTerms: string[]; weeklyEffort: Week[] };
type Payload = { memberID: string; windowStart: string; windowEnd: string; projects: Project[] };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function text(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 && result.length <= max ? result : null;
}

function hours(value: unknown) {
  const result = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(result) && result >= 0 && result <= 168 ? Math.round(result * 100) / 100 : null;
}

function parsePayload(value: unknown): Payload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const memberID = text(raw.memberID, 80);
  const windowStart = text(raw.windowStart, 10);
  const windowEnd = text(raw.windowEnd, 10);
  if (memberID !== "ID001" || !windowStart || !windowEnd || !DAY.test(windowStart) || !DAY.test(windowEnd) || windowStart > windowEnd || !Array.isArray(raw.projects) || raw.projects.length > MAX_PROJECTS) return null;

  const projectIDs = new Set<string>();
  const projects: Project[] = [];
  let weekCount = 0;
  for (const rawProject of raw.projects) {
    if (!rawProject || typeof rawProject !== "object") return null;
    const project = rawProject as Record<string, unknown>;
    const projectID = text(project.projectID, 80);
    const displayName = text(project.displayName, 160);
    if (!projectID || !displayName || projectIDs.has(projectID) || !Array.isArray(project.meetingSearchTerms) || !Array.isArray(project.weeklyEffort)) return null;
    projectIDs.add(projectID);
    const terms = project.meetingSearchTerms.map((term) => text(term, 100)).filter((term): term is string => Boolean(term));
    if (terms.length !== project.meetingSearchTerms.length || terms.length > 20) return null;
    const weeks = new Set<string>();
    const weeklyEffort: Week[] = [];
    for (const rawWeek of project.weeklyEffort) {
      if (!rawWeek || typeof rawWeek !== "object") return null;
      const week = rawWeek as Record<string, unknown>;
      const weekStart = text(week.weekStart, 10);
      const developmentHours = hours(week.developmentHours);
      const meetingHours = hours(week.meetingHours);
      if (!weekStart || !DAY.test(weekStart) || weekStart < windowStart || weekStart > windowEnd || weeks.has(weekStart) || developmentHours === null || meetingHours === null) return null;
      weeks.add(weekStart);
      weeklyEffort.push({ weekStart, developmentHours, meetingHours });
    }
    weekCount += weeklyEffort.length;
    if (weekCount > MAX_WEEKS) return null;
    projects.push({ projectID, displayName, meetingSearchTerms: terms, weeklyEffort });
  }
  return { memberID, windowStart, windowEnd, projects };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "POSTだけ使える" }, 405);

  const expectedKey = Deno.env.get("TALLY_SYNC_KEY") ?? "";
  if (!expectedKey || request.headers.get("x-tally-sync-key") !== expectedKey) return json({ ok: false, error: "認証に失敗" }, 401);
  const payload = parsePayload(await request.json().catch(() => null));
  if (!payload) return json({ ok: false, error: "同期内容が不正" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const projectIDs = payload.projects.map((project) => project.projectID);
  const [{ data: projects, error: projectError }, { data: member, error: memberError }] = await Promise.all([
    db.from("projects").select("project_id").in("project_id", projectIDs),
    db.from("members").select("member_id").eq("member_id", payload.memberID).maybeSingle(),
  ]);
  if (projectError || memberError || !member || (projects ?? []).length !== projectIDs.length) return json({ ok: false, error: "PJまたはメンバーを確認できない" }, 400);

  const now = new Date().toISOString();
  const { error: settingsError } = await db.from("tally_project_syncs").upsert(
    payload.projects.map((project) => ({ project_id: project.projectID, member_id: payload.memberID, display_name: project.displayName, meeting_search_terms: project.meetingSearchTerms, last_synced_at: now })),
    { onConflict: "project_id,member_id" },
  );
  if (settingsError) return json({ ok: false, error: "同期設定を保存できない" }, 500);

  for (const project of payload.projects) {
    const { error: deleteError } = await db.from("tally_weekly_effort_entries")
      .delete().eq("project_id", project.projectID).eq("member_id", payload.memberID)
      .gte("week_start", payload.windowStart).lte("week_start", payload.windowEnd);
    if (deleteError) return json({ ok: false, error: "古い週次記録を置き換えられない" }, 500);
    if (project.weeklyEffort.length === 0) continue;
    const { error: insertError } = await db.from("tally_weekly_effort_entries").insert(
      project.weeklyEffort.map((week) => ({ project_id: project.projectID, member_id: payload.memberID, week_start: week.weekStart, development_hours: week.developmentHours, meeting_hours: week.meetingHours, synced_at: now })),
    );
    if (insertError) return json({ ok: false, error: "週次記録を保存できない" }, 500);
  }

  return json({ ok: true, projectCount: payload.projects.length, weekCount: payload.projects.reduce((sum, project) => sum + project.weeklyEffort.length, 0) });
});
