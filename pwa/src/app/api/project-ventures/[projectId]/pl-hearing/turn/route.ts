/**
 * 試算表ヒアリング 1 ターン (Claude Sonnet)。
 *
 * POST { history: [{q, a}], new_answer?: string }
 *
 * 動作:
 *   - 既存情報 (project_ventures / events / members / partners / xrl / 既存 project_pl_monthly) を集約
 *   - Sonnet にベース情報 + 過去 Q&A + 直近回答を渡す
 *   - Sonnet が { done, question?, monthly?, summary? } を返す
 *     - done=false → question を返す (まだ聞きたい)
 *     - done=true  → monthly[] を返す (12〜36 ヶ月分の PL を生成)
 *
 * done=true のとき: project_pl_monthly に upsert + project_pl_hearings に履歴保存
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

interface MonthlyOut {
  ym: string;
  revenue_yen: number;
  cogs_yen: number;
  personnel_yen: number;
  rd_yen: number;
  marketing_yen: number;
  other_opex_yen: number;
  notes?: string;
}

interface TurnOut {
  done: boolean;
  question?: string;
  monthly?: MonthlyOut[];
  summary?: string;
}

const SYSTEM = `あなたは「つくよみ」、AMD のディープテックスタジオの専属マスコット LLM。
ディープテック PJ の月次試算表 (12〜36 ヶ月分) を組み立てるためのヒアリングをします。

# 進め方
- ベース情報 (PJ メタ / events / members / partners / xrl / 既存 PL) を最大限活用する
- ヒアリングは「他で得られなかった情報のみ」に絞る (events に資金調達履歴があるなら金額は聞かない、members に CTO が居るなら CTO を聞かない、など)
- 質問は 1 ターンに 1 つだけ。ユーザーの認知負荷を最小化
- 6 〜 10 ターン以内で全部の質問を終えるのが理想
- 質問例: 設立直後の月次バーンレート / 売上開始月 / 売上単価 / 売上原価率 / オフィス賃料の有無 / 採用計画 / 資金調達ラウンド / R&D 比率 / etc

# 出力ルール (JSON、\`\`\`json\`\`\` で囲む)
- 質問を返すとき:
  { "done": false, "question": "<質問文 1 つ>" }
- もう十分ヒアリングできたとき (done=true):
  {
    "done": true,
    "summary": "<前提と方針の 2-3 行サマリ>",
    "monthly": [
      {
        "ym": "YYYY-MM",
        "revenue_yen": <数値>,
        "cogs_yen": <数値>,
        "personnel_yen": <数値>,
        "rd_yen": <数値>,
        "marketing_yen": <数値>,
        "other_opex_yen": <数値>,
        "notes": "<該当月の注釈>"
      }, ...
    ]
  }

# 試算表生成ルール
- 月次は設立日 (founded_at) 〜 36 ヶ月後 を基準。設立前 PJ なら設立予定日 〜 36 ヶ月後
- 推測した値には notes に "(推定)" を付ける
- 確定値 (events や手動入力に明示) は notes に "(確定)" を付ける
- 単位は円。"3000 万円" → 30000000
- 数値は全部整数 (小数禁止)

# 単位ルール
- SU を「社」「ventures」と書かない、「PJ」と書く

ヒアリング情報が完全に空でも、ベース情報のみで試算表を作って done=true で返してよい。`;

interface VentureBase {
  project_name: string;
  lane: string;
  founded_at: string | null;
  outcome_pattern: string;
  short_description: string | null;
  long_description: string | null;
  amd_support_started_at: string | null;
  amd_support_ended_at: string | null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { projectId } = await ctx.params;
  let body: { history?: { q: string; a: string }[]; new_answer?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const supabase = createAdminClient();
  const [
    { data: venture },
    { data: events },
    { data: members },
    { data: partners },
    { data: xrl },
    { data: existingPl },
    { data: learningsRows },
  ] = await Promise.all([
    supabase
      .from("project_ventures")
      .select("lane, founded_at, outcome_pattern, short_description, long_description, amd_support_started_at, amd_support_ended_at, projects(project_name)")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase.from("project_events").select("occurred_on, kind, label, meta").eq("project_id", projectId).order("occurred_on", { ascending: true }),
    supabase.from("project_venture_members").select("full_name, role, member_kind, started_at, ended_at, note").eq("project_id", projectId),
    supabase.from("project_partners").select("partner_name, partner_type, partner_role, sales_target_date, is_sold, sales_actuals").eq("project_id", projectId),
    supabase.from("project_xrl_log").select("observed_at, trl, brl, hrl, bottleneck, milestone_label, source").eq("project_id", projectId).order("observed_at", { ascending: true }),
    supabase.from("project_pl_monthly").select("ym, revenue_yen, cogs_yen, personnel_yen, rd_yen, marketing_yen, other_opex_yen, notes").eq("project_id", projectId).order("ym", { ascending: true }),
    supabase.from("tsukuyomi_learnings_status").select("lesson_text").in("scope", ["pl_hearing", "all"]).or(`target_project_id.eq.${projectId},target_project_id.is.null`),
  ]);

  if (!venture) return NextResponse.json({ error: "venture not found" }, { status: 404 });
  const rawVenture = venture as unknown as Omit<VentureBase, "project_name"> & {
    projects: { project_name: string | null } | { project_name: string | null }[] | null;
  };
  const { projects: projectRelRaw, ...ventureRest } = rawVenture;
  const projectRel = Array.isArray(projectRelRaw) ? projectRelRaw[0] : projectRelRaw;
  const v: VentureBase = { ...ventureRest, project_name: projectRel?.project_name?.trim() || projectId };

  const historyText = (body.history ?? []).map((qa, i) => `Q${i + 1}: ${qa.q}\nA${i + 1}: ${qa.a}`).join("\n\n");
  const learnings = ((learningsRows as { lesson_text: string }[] | null) ?? []).map((l) => l.lesson_text);
  const learningsBlock = learnings.length > 0 ? `\n# つくよみが学んだルール\n${learnings.map((l) => `- ${l}`).join("\n")}` : "";

const userPrompt = `# PJ メタ
PJ名: ${v.project_name}
レーン: ${v.lane}
設立日: ${v.founded_at ?? "未設立"}
アウトカム: ${v.outcome_pattern}
short: ${v.short_description ?? ""}
long: ${v.long_description ?? ""}
AMD 参画: ${v.amd_support_started_at ?? "?"} 〜 ${v.amd_support_ended_at ?? "現在"}

# events (時系列、調達 / 採用 / 契約 etc)
${JSON.stringify(events ?? [], null, 2)}

# 関連メンバー
${JSON.stringify(members ?? [], null, 2)}

# 興味事業会社 (協業先 / 顧客候補)
${JSON.stringify(partners ?? [], null, 2)}

# XRL 履歴
${JSON.stringify(xrl ?? [], null, 2)}

# 既存の月次 PL (もしあれば、これより新しい入力を上書き候補として優先)
${JSON.stringify(existingPl ?? [], null, 2)}
${learningsBlock}

# これまでの Q&A
${historyText || "(まだ無し)"}

# 直近の回答
${body.new_answer ?? "(なし、初回ターン)"}

JSON で返してください。`;

  let parsed: TurnOut;
  try {
    const anthropic = new Anthropic({ apiKey });
    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = r.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (!m) return NextResponse.json({ error: "no JSON in response" }, { status: 500 });
    parsed = JSON.parse(m[1]) as TurnOut;
  } catch (e) {
    console.error("[pl-hearing/turn]", e);
    return NextResponse.json({ error: "llm error" }, { status: 500 });
  }

  if (parsed.done && parsed.monthly) {
    // project_pl_monthly に upsert
    const rows = parsed.monthly
      .filter((m) => /^\d{4}-\d{2}$/.test(m.ym))
      .map((m) => ({
        project_id: projectId,
        ym: m.ym,
        revenue_yen: Math.round(Number(m.revenue_yen) || 0),
        cogs_yen: Math.round(Number(m.cogs_yen) || 0),
        personnel_yen: Math.round(Number(m.personnel_yen) || 0),
        rd_yen: Math.round(Number(m.rd_yen) || 0),
        marketing_yen: Math.round(Number(m.marketing_yen) || 0),
        other_opex_yen: Math.round(Number(m.other_opex_yen) || 0),
        notes: m.notes ?? null,
        updated_at: new Date().toISOString(),
      }));
    if (rows.length > 0) {
      await supabase.from("project_pl_monthly").upsert(rows, { onConflict: "project_id,ym" });
    }

    // ヒアリング履歴を保存
    const qaWithLast = [...(body.history ?? [])];
    if (body.new_answer && qaWithLast.length > 0) {
      // 直近の Q に new_answer を紐付け済とみなす (フロントが渡すフォーマットによる)
    }
    await supabase.from("project_pl_hearings").insert({
      project_id: projectId,
      q_a: qaWithLast,
      status: "done",
      generated_pl: parsed.monthly,
    });
  }

  return NextResponse.json(parsed);
}
