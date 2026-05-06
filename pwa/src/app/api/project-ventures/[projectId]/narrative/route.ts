/**
 * PJ 沿革 (narrative) を Gemini で自動生成。
 *
 * POST { force?: boolean }
 * → { narrative: <text>, cached: <bool> }
 *
 * キャッシュ方針:
 *   - narrative_text が NULL → 生成
 *   - narrative_invalidated_at > narrative_generated_at → 古いので生成
 *   - force=true → 常に再生成
 *   - それ以外 → キャッシュ返却
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface VentureRow {
  project_id: string;
  display_name: string;
  short_label: string | null;
  lane: string;
  founded_at: string | null;
  outcome_pattern: string;
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  short_description: string | null;
  narrative_text: string | null;
  narrative_generated_at: string | null;
  narrative_invalidated_at: string | null;
}

interface XrlRow {
  observed_at: string;
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  bottleneck: string | null;
  milestone_label: string | null;
}

interface EventRow {
  occurred_on: string;
  kind: string;
  label: string;
  meta: Record<string, unknown>;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  let body: { force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const supabase = await createClient();

  const { data: venture, error: vErr } = await supabase
    .from("project_ventures")
    .select(
      "project_id, display_name, short_label, lane, founded_at, outcome_pattern, origin_org, origin_pi, amd_role, short_description, narrative_text, narrative_generated_at, narrative_invalidated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (vErr || !venture) {
    return NextResponse.json({ error: "venture not found" }, { status: 404 });
  }
  const v = venture as VentureRow;

  const isFresh =
    !!v.narrative_text &&
    !!v.narrative_generated_at &&
    (!v.narrative_invalidated_at ||
      new Date(v.narrative_invalidated_at) <= new Date(v.narrative_generated_at));

  if (!body.force && isFresh) {
    return NextResponse.json({ narrative: v.narrative_text, cached: true });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const [{ data: xrl }, { data: events }] = await Promise.all([
    supabase
      .from("project_xrl_log")
      .select("observed_at, trl, brl, hrl, bottleneck, milestone_label")
      .eq("project_id", projectId)
      .order("observed_at", { ascending: true }),
    supabase
      .from("project_events")
      .select("occurred_on, kind, label, meta")
      .eq("project_id", projectId)
      .order("occurred_on", { ascending: true }),
  ]);

  const prompt = `AMD (株式会社チームアルマダ、ディープテック・スタジオ) の PJ「${v.display_name}」の沿革を、時系列の物語として書いてください。

PJ メタ:
- レーン: ${v.lane}
- 起源: ${v.origin_org ?? "?"} / 代表: ${v.origin_pi ?? "?"}
- AMD 関わり方: ${v.amd_role ?? "?"}
- 設立日: ${v.founded_at ?? "未設立"}
- アウトカム: ${v.outcome_pattern}
- 概要: ${v.short_description ?? ""}

XRL 観測:
${JSON.stringify((xrl as XrlRow[] | null) ?? [], null, 2)}

イベント:
${JSON.stringify((events as EventRow[] | null) ?? [], null, 2)}

出力ルール:
- 日本語、文体は丁寧でドライ。
- 時系列で「YYYY-MM」見出し → 出来事の順。
- 設立前は "Before 0"、設立後は "After 0" のラベルを使ってよい。
- 推測は書かず、与えたデータからのみ書く。
- 800〜1500 字を目安に。
- 単位ルール: SU は「PJ」と書く。「社」「ventures」表記は使わない。`;

  let narrative: string;
  try {
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({ model: "gemini-2.5-flash" });
    const r = await model.generateContent(prompt);
    narrative = r.response.text().trim();
    // 余計な ``` を取り除く
    narrative = narrative.replace(/^```\w*\s*/, "").replace(/```\s*$/, "");
  } catch (e) {
    console.error("[narrative]", e);
    return NextResponse.json({ error: "llm error" }, { status: 500 });
  }

  await supabase
    .from("project_ventures")
    .update({
      narrative_text: narrative,
      narrative_generated_at: new Date().toISOString(),
      narrative_invalidated_at: null,
    })
    .eq("project_id", projectId);

  return NextResponse.json({ narrative, cached: false });
}
