/**
 * XRL (TRL/BRL/HRL) を Gemini が判定して、project_xrl_log に source='llm_proposal' で挿入。
 *
 * POST →  { proposal: <project_xrl_log row> }
 *
 * 入力:
 *   - project_ventures (lane / founded_at / outcome / short_description)
 *   - project_xrl_log (直近の確定値、historical context)
 *   - project_events (events 全件)
 *
 * 出力 (LLM):
 *   { trl, brl, hrl, bottleneck, milestone_label }
 *   → INSERT INTO project_xrl_log (source='llm_proposal', observed_at=今日)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface VentureRow {
  display_name: string;
  lane: string;
  founded_at: string | null;
  outcome_pattern: string;
  short_description: string | null;
}

interface XrlRow {
  observed_at: string;
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  bottleneck: string | null;
  source: string;
}

interface EventRow {
  occurred_on: string;
  kind: string;
  label: string;
  meta: Record<string, unknown>;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: venture, error: vErr } = await supabase
    .from("project_ventures")
    .select("display_name, lane, founded_at, outcome_pattern, short_description")
    .eq("project_id", projectId)
    .maybeSingle();
  if (vErr || !venture) {
    return NextResponse.json({ error: "venture not found" }, { status: 404 });
  }

  const [{ data: xrl }, { data: events }] = await Promise.all([
    supabase
      .from("project_xrl_log")
      .select("observed_at, trl, brl, hrl, bottleneck, source")
      .eq("project_id", projectId)
      .order("observed_at", { ascending: true }),
    supabase
      .from("project_events")
      .select("occurred_on, kind, label, meta")
      .eq("project_id", projectId)
      .order("occurred_on", { ascending: true }),
  ]);

  const v = venture as VentureRow;
  const prompt = `AMD のディープテック PJ「${v.display_name}」の現時点の XRL レベル (TRL / BRL / HRL) を判定してください。
内閣府 SIP 第 3 期の XRL 体系 (TRL=技術成熟度、BRL=事業化成熟度、HRL=人材・市場成熟度、各 1-9) で評価。

PJ メタ:
- レーン: ${v.lane}
- 設立日: ${v.founded_at ?? "未設立"}
- アウトカム: ${v.outcome_pattern}
- 概要: ${v.short_description ?? ""}

過去の XRL 観測 (時系列):
${JSON.stringify((xrl as XrlRow[] | null) ?? [], null, 2)}

イベント (時系列、自由文 raw_text + 構造化フィールド):
${JSON.stringify((events as EventRow[] | null) ?? [], null, 2)}

判定ルール:
- 各 1-9 の整数 (確信できないなら null)
- bottleneck は TRL / BRL / HRL のうち最も低いもの (一意でなければ null)
- milestone_label に「いま何をクリアしたか」を一行で
- evidence に判断根拠を 2-3 行で
- 出力は \`\`\`json\`\`\` で囲んだ JSON オブジェクトのみ:

{
  "trl": <int|null>,
  "brl": <int|null>,
  "hrl": <int|null>,
  "bottleneck": "TRL"|"BRL"|"HRL"|null,
  "milestone_label": "<一行>",
  "evidence": "<根拠 2-3 行>"
}`;

  let parsed: {
    trl: number | null;
    brl: number | null;
    hrl: number | null;
    bottleneck: string | null;
    milestone_label: string;
    evidence: string;
  };
  try {
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({ model: "gemini-2.5-flash" });
    const r = await model.generateContent(prompt);
    const text = r.response.text();
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (!m) {
      return NextResponse.json({ error: "no JSON in response" }, { status: 500 });
    }
    parsed = JSON.parse(m[1]);
  } catch (e) {
    console.error("[xrl-propose]", e);
    return NextResponse.json({ error: "llm error" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: insertResult, error: insErr } = await supabase
    .from("project_xrl_log")
    .insert({
      project_id: projectId,
      observed_at: today,
      trl: parsed.trl,
      brl: parsed.brl,
      hrl: parsed.hrl,
      bottleneck: parsed.bottleneck,
      milestone_label: parsed.milestone_label,
      source_note: parsed.evidence,
      source: "llm_proposal",
    })
    .select()
    .single();
  if (insErr) {
    console.error("[xrl-propose] insert", insErr);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  // 沿革も古くなる
  await supabase
    .from("project_ventures")
    .update({ narrative_invalidated_at: new Date().toISOString() })
    .eq("project_id", projectId);

  return NextResponse.json({ proposal: insertResult });
}
