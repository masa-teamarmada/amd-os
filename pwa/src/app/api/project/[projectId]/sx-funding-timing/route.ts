import { NextResponse } from "next/server";
import { extractSxFirstFundingTarget, type SxFundingMeetingEvidence } from "@/lib/sx-funding-timing";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  if (projectId !== "p21") {
    return NextResponse.json({ target: null }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }

  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const { data, error } = await auth.supabase
    .from("project_meeting_summaries")
    .select("meeting_id,meeting_date,title,summary_short,decided,progress,next_actions,risks,narrative_md")
    .eq("project_id", projectId)
    .gte("meeting_date", "2026-06-01")
    .order("meeting_date", { ascending: false })
    .limit(80);

  if (error) {
    return NextResponse.json({ error: "SX初回調達時期の会議証跡を取得できません" }, { status: 500 });
  }

  const meetings: SxFundingMeetingEvidence[] = (data ?? []).map((row) => ({
    meetingId: String(row.meeting_id),
    meetingDate: String(row.meeting_date),
    title: String(row.title ?? ""),
    summaryShort: String(row.summary_short ?? ""),
    decided: strings(row.decided),
    progress: strings(row.progress),
    nextActions: strings(row.next_actions),
    risks: strings(row.risks),
    narrativeMd: typeof row.narrative_md === "string" ? row.narrative_md : null,
  }));

  return NextResponse.json(
    { target: extractSxFirstFundingTarget(meetings) },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
