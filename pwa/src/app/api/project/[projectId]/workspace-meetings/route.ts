import { NextResponse } from "next/server";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProjectMeetingSummaries } from "@/lib/supabase-data";

export const dynamic = "force-dynamic";
export async function GET(req: Request, ctx: {params: Promise<{projectId:string}>}) {
  const {projectId} = await ctx.params;
  if (!await resolveSharedWorkspaceAccess(projectId)) return NextResponse.json({ok:false,error:"見つからない"},{status:404});
  const db = createAdminClient();
  const since = new URL(req.url).searchParams.get("since");
  const meetings = await fetchProjectMeetingSummaries(projectId, {sinceDate: since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : undefined}, db);
  const result = await db.from("project_strategy_signals").select("*").eq("project_id",projectId).in("status",["candidate","confirmed"]).order("signal_date",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(220);
  if (result.error) return NextResponse.json({ok:false,error:"動向を読み込めない"},{status:500});
  const signals = (result.data??[]).filter(row=>row.origin_kind!=="external_research"||row.status==="confirmed").map(row=>({
    signalId:row.signal_id,projectId:row.project_id,ym:row.ym||null,signalDate:row.signal_date||null,signalType:row.signal_type||"business_progress",polarity:row.polarity||null,
    title:row.title||"",summary:row.summary||"",scoreImpactSummary:row.score_impact_summary||null,scoreImpactDelta:row.score_impact_delta_json||null,
    impactLevel:row.impact_level||"medium",decisionState:row.decision_state||"observed",status:row.status||"candidate",sourceRefs:Array.isArray(row.source_refs_json)?row.source_refs_json:[],sourceHash:row.source_hash||"",
    originKind:row.origin_kind==="external_research"?"external_research":"internal",researchCategory:["industry_market","grant","partner"].includes(row.research_category)?row.research_category:null,
    confidence:Number(row.confidence)||0,createdAt:row.created_at,confirmedAt:row.confirmed_at||null,
  }));
  return NextResponse.json({ok:true,meetings,signals},{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
