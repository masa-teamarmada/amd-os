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
import { requireAdmin } from "@/lib/supabase/api-auth";
import { oneRelation, projectDisplayName } from "@/lib/project-labels";

export const runtime = "nodejs";
export const maxDuration = 60;

interface VentureRow {
  project_label: string;
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
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { projectId } = await ctx.params;
  let body: { xrl_log_id?: string; feedback?: string; axis?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.xrl_log_id || !body.feedback) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const targetAxis = body.axis === "TRL" || body.axis === "BRL" || body.axis === "HRL" ? body.axis : null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const supabase = createAdminClient();
  const [{ data: venture }, { data: log }, { data: events }, { data: members }] = await Promise.all([
    supabase
      .from("project_ventures")
      .select("project_id, lane, founded_at, outcome_pattern, short_description, long_description, projects(project_name, client_name)")
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
  const project = oneRelation((venture as { projects?: { project_name?: string | null; client_name?: string | null } | { project_name?: string | null; client_name?: string | null }[] | null }).projects);
  const v = {
    ...(venture as Omit<VentureRow, "project_label">),
    project_label: projectDisplayName({
      project_id: projectId,
      project_name: project?.project_name ?? null,
      client_name: project?.client_name ?? null,
    }),
  };
  const x = log as XrlLogRow;

  const prompt = `AMD のディープテック PJ「${v.project_label}」の XRL 観測 (${x.observed_at}) について、
まさからのフィードバックを反映して再評価してください。
${targetAxis ? `フィードバックの主対象軸: ${targetAxis}` : ""}

# 現在の値
- TRL: ${x.trl ?? "—"}, BRL: ${x.brl ?? "—"}, HRL: ${x.hrl ?? "—"}
- bottleneck: ${x.bottleneck ?? "—"}
- milestone_label: ${x.milestone_label ?? "—"}
- source_note (旧 / 軸別 JSON のいずれか): ${x.source_note ?? "—"}
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
- 各レベル 1-9 整数 (確信できない / 情報不足なら null)
- bottleneck: 最も低い軸の名前 (TRL/BRL/HRL)、一意でなければ null
- milestone_label: 一行
- 評価理由は **軸ごとに分けて書く** こと。情報不足な軸は "情報不足" と明記
  - trl_reason / brl_reason / hrl_reason をそれぞれ 2-4 行で
- 出力は \`\`\`json\`\`\` で囲んだ JSON のみ:

{
  "trl": <int|null>,
  "brl": <int|null>,
  "hrl": <int|null>,
  "bottleneck": "TRL"|"BRL"|"HRL"|null,
  "milestone_label": "<>",
  "trl_reason": "<TRL の評価理由 or '情報不足'>",
  "brl_reason": "<BRL の評価理由 or '情報不足'>",
  "hrl_reason": "<HRL の評価理由 or '情報不足'>"
}`;

  let parsed: {
    trl: number | null;
    brl: number | null;
    hrl: number | null;
    bottleneck: string | null;
    milestone_label: string;
    trl_reason: string;
    brl_reason: string;
    hrl_reason: string;
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

  // 更新: 確定値として書き換える (source も pm_confirmed に格上げ、source_note は軸別 JSON で保存)
  const sourceNoteJson = JSON.stringify({
    trl_reason: parsed.trl_reason ?? "情報不足",
    brl_reason: parsed.brl_reason ?? "情報不足",
    hrl_reason: parsed.hrl_reason ?? "情報不足",
  });
  await supabase
    .from("project_xrl_log")
    .update({
      trl: parsed.trl,
      brl: parsed.brl,
      hrl: parsed.hrl,
      bottleneck: parsed.bottleneck,
      milestone_label: parsed.milestone_label,
      source_note: sourceNoteJson,
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
