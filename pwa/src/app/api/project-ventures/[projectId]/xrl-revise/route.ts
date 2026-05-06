/**
 * XRL 観測ドットへのフィードバックを反映 (Gemini で再評価)。
 *
 * POST { xrl_log_id, feedback }
 *   → 該当 xrl_log を更新 (source_note に feedback 反映済の評価理由を書き直す。
 *      TRL/BRL/HRL/bottleneck/milestone_label も Gemini の判断に従って書き換える)
 *   → xrl_feedbacks.status = 'applied'
 */

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

interface VentureRow {
  display_name: string;
  lane: string;
  founded_at: string | null;
  outcome_pattern: string;
  short_description: string | null;
  long_description: string | null;
}

interface XrlLogRow {
  id: string;
  observed_at: string;
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  bottleneck: string | null;
  milestone_label: string | null;
  source_note: string | null;
  source: string;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  let body: { xrl_log_id?: string; feedback?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.xrl_log_id || !body.feedback) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const supabase = createAdminClient();
  const [{ data: venture }, { data: log }, { data: events }, { data: members }] = await Promise.all([
    supabase
      .from("project_ventures")
      .select("display_name, lane, founded_at, outcome_pattern, short_description, long_description")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("project_xrl_log")
      .select("id, observed_at, trl, brl, hrl, bottleneck, milestone_label, source_note, source")
      .eq("id", body.xrl_log_id)
      .maybeSingle(),
    supabase
      .from("project_events")
      .select("occurred_on, kind, label, meta")
      .eq("project_id", projectId)
      .order("occurred_on", { ascending: true }),
    supabase
      .from("project_venture_members")
      .select("full_name, role, member_kind, started_at, ended_at, note")
      .eq("project_id", projectId),
  ]);

  if (!venture || !log) return NextResponse.json({ error: "not found" }, { status: 404 });
  const v = venture as VentureRow;
  const x = log as XrlLogRow;

  const prompt = `AMD のディープテック PJ「${v.display_name}」の XRL 観測 (${x.observed_at}) について、
まさからのフィードバックを反映して再評価してください。

# 現在の値
- TRL: ${x.trl ?? "—"}, BRL: ${x.brl ?? "—"}, HRL: ${x.hrl ?? "—"}
- bottleneck: ${x.bottleneck ?? "—"}
- milestone_label: ${x.milestone_label ?? "—"}
- source_note: ${x.source_note ?? "—"}
- source: ${x.source}

# まさからのフィードバック
"""
${body.feedback}
"""

# 参考情報
- レーン: ${v.lane} / 設立: ${v.founded_at ?? "未設立"} / アウトカム: ${v.outcome_pattern}
- short: ${v.short_description ?? ""}
- long: ${v.long_description ?? ""}
- events: ${JSON.stringify(events ?? [], null, 2)}
- members: ${JSON.stringify(members ?? [], null, 2)}

# 出力ルール
- まさのフィードバックを優先しつつ、矛盾がないか確認して TRL/BRL/HRL を再評価
- 各レベル 1-9 整数 (確信できなければ null)
- bottleneck: 最も低い軸の名前 (TRL/BRL/HRL)、一意でなければ null
- milestone_label: 一行
- source_note: フィードバック内容を反映した評価理由 (3-5 行)
- 出力は \`\`\`json\`\`\` で囲んだ JSON のみ:

{
  "trl": <int|null>,
  "brl": <int|null>,
  "hrl": <int|null>,
  "bottleneck": "TRL"|"BRL"|"HRL"|null,
  "milestone_label": "<>",
  "source_note": "<>"
}`;

  let parsed: {
    trl: number | null;
    brl: number | null;
    hrl: number | null;
    bottleneck: string | null;
    milestone_label: string;
    source_note: string;
  };
  try {
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({ model: "gemini-2.5-flash" });
    const r = await model.generateContent(prompt);
    const text = r.response.text();
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (!m) return NextResponse.json({ error: "no JSON in response" }, { status: 500 });
    parsed = JSON.parse(m[1]);
  } catch (e) {
    console.error("[xrl-revise]", e);
    return NextResponse.json({ error: "llm error" }, { status: 500 });
  }

  // 更新: 確定値として書き換える (source も pm_confirmed に格上げ)
  await supabase
    .from("project_xrl_log")
    .update({
      trl: parsed.trl,
      brl: parsed.brl,
      hrl: parsed.hrl,
      bottleneck: parsed.bottleneck,
      milestone_label: parsed.milestone_label,
      source_note: parsed.source_note,
      source: "pm_confirmed",
    })
    .eq("id", body.xrl_log_id);

  // フィードバックを applied 化
  await supabase
    .from("xrl_feedbacks")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
      applied_note: "xrl-revise で反映済",
    })
    .eq("xrl_log_id", body.xrl_log_id)
    .eq("status", "open");

  // 沿革も古くなる
  await supabase
    .from("project_ventures")
    .update({ narrative_invalidated_at: new Date().toISOString() })
    .eq("project_id", projectId);

  return NextResponse.json({ ok: true, updated: parsed });
}
