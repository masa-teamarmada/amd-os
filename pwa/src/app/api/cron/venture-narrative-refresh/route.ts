/**
 * 毎朝 03:00 JST (= UTC 18:00) に走り、差分のある PJ の沿革をリスト形式で生成する。
 *
 * 対象: is_public=true な project_ventures
 * 条件:
 *   - narrative_text が NULL → 初生成
 *   - narrative_invalidated_at > narrative_generated_at → 差分あり、再生成
 *
 * 認証: Authorization: Bearer ${CRON_SECRET}
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateNarrativeItems, type NarrativeInput } from "@/lib/narrative-generator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("Authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data: ventures, error } = await supabase
    .from("project_ventures")
    .select(
      "project_id, display_name, lane, founded_at, outcome_pattern, origin_org, origin_pi, amd_role, amd_support_started_at, amd_support_ended_at, short_description, long_description, narrative_text, narrative_generated_at, narrative_invalidated_at"
    )
    .eq("is_public", true);
  if (error || !ventures) {
    return NextResponse.json({ error: "fetch ventures failed", detail: error }, { status: 500 });
  }

  const targets = ventures.filter((v) => {
    if (!v.narrative_text) return true;
    if (!v.narrative_generated_at) return true;
    if (
      v.narrative_invalidated_at &&
      new Date(v.narrative_invalidated_at) > new Date(v.narrative_generated_at)
    ) {
      return true;
    }
    return false;
  });

  const results: { project_id: string; ok: boolean; count: number; error?: string }[] = [];

  for (const v of targets) {
    const projectId = v.project_id as string;
    const [{ data: xrl }, { data: events }, { data: members }, { data: partners }] = await Promise.all([
      supabase.from("project_xrl_log").select("observed_at, trl, brl, hrl, bottleneck, milestone_label, source").eq("project_id", projectId).order("observed_at", { ascending: true }),
      supabase.from("project_events").select("occurred_on, kind, label, meta").eq("project_id", projectId).order("occurred_on", { ascending: true }),
      supabase.from("project_venture_members").select("full_name, role, started_at, ended_at, note").eq("project_id", projectId),
      supabase.from("project_partners").select("partner_name, partner_type, partner_role, sales_target_date, is_sold").eq("project_id", projectId),
    ]);

    const input: NarrativeInput = {
      display_name: v.display_name as string,
      lane: v.lane as string,
      founded_at: (v.founded_at as string | null) ?? null,
      outcome_pattern: v.outcome_pattern as string,
      origin_org: (v.origin_org as string | null) ?? null,
      origin_pi: (v.origin_pi as string | null) ?? null,
      amd_role: (v.amd_role as string | null) ?? null,
      amd_support_started_at: (v.amd_support_started_at as string | null) ?? null,
      amd_support_ended_at: (v.amd_support_ended_at as string | null) ?? null,
      short_description: (v.short_description as string | null) ?? null,
      long_description: (v.long_description as string | null) ?? null,
      xrl: (xrl as NarrativeInput["xrl"] | null) ?? [],
      events: (events as NarrativeInput["events"] | null) ?? [],
      members: (members as NarrativeInput["members"] | null) ?? [],
      partners: (partners as NarrativeInput["partners"] | null) ?? [],
    };

    try {
      const items = await generateNarrativeItems(geminiKey, input);
      await supabase
        .from("project_ventures")
        .update({
          narrative_text: JSON.stringify(items),
          narrative_generated_at: new Date().toISOString(),
          narrative_invalidated_at: null,
        })
        .eq("project_id", projectId);
      results.push({ project_id: projectId, ok: true, count: items.length });
    } catch (e) {
      console.error("[narrative-refresh]", projectId, e);
      results.push({ project_id: projectId, ok: false, count: 0, error: String(e) });
    }
  }

  return NextResponse.json({
    refreshed: results.length,
    skipped: ventures.length - targets.length,
    results,
  });
}
