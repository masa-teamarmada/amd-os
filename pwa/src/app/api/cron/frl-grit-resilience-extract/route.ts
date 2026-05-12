/**
 * GET /api/cron/frl-grit-resilience-extract
 *
 * 2026-05-12 まさ「FRL の grit と resilience もまだ 0 のまま、ちゃんと数値が入るようにして」
 * (= 過去 HANDOFF に「FRL grit/resilience LLM 抽出 cron 新規」とだけ書いて実装してなかった)
 *
 * 全 active PJ について、過去 3 ヶ月分の monthly_reports + project_meeting_summaries を集約し、
 * Sonnet 4.6 で frl_grit (Duckworth 2007) / frl_resilience (Markman 2005) を 0-9 推定 →
 * amd_score_inputs に upsert (UNIQUE (project_id, evaluated_at))。
 *
 * Vercel Cron: 月初 03:00 JST (前月 18:00 UTC) — vercel.json schedule "0 18 1 * *"
 * 認証: Authorization: Bearer CRON_SECRET
 * 手動キック: ?projectId=p21 で 1 PJ だけ抽出可
 *
 * system prompt は llm_prompts.frl_grit_resilience.extract から fetch (= AGENTS 絶対ルール遵守)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder"
  );
}

function ymOffset(today: Date, monthsBack: number): string {
  const d = new Date(today.getTime());
  d.setUTCMonth(d.getUTCMonth() - monthsBack);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface PromptRow {
  body: string;
  model: string | null;
  max_tokens: number | null;
  is_active: boolean;
}

async function loadPrompt(supabase: SupabaseClient): Promise<PromptRow | null> {
  const { data } = await supabase
    .from("llm_prompts")
    .select("body, model, max_tokens, is_active")
    .eq("prompt_key", "frl.grit_resilience.extract")
    .limit(1)
    .single();
  if (!data) return null;
  if (!data.is_active || !data.body || !String(data.body).trim()) return null;
  return data as PromptRow;
}

interface ExtractResult {
  frl_grit: number | null;
  frl_resilience: number | null;
  reasoning_grit: string;
  reasoning_resilience: string;
}

async function extractForProject(
  projectId: string,
  supabase: SupabaseClient,
  anthropic: Anthropic,
  prompt: PromptRow
): Promise<{ ok: boolean; saved: number; message?: string; result?: ExtractResult }> {
  // 1) PJ name + メタ
  const { data: projectRow } = await supabase
    .from("projects")
    .select("project_id, project_name")
    .eq("project_id", projectId)
    .limit(1)
    .single();
  const projectName = projectRow?.project_name || projectId;

  // 2) 過去 3 ヶ月の ym (= 当月 / 前月 / 前々月)
  const today = new Date();
  const yms = [ymOffset(today, 0), ymOffset(today, 1), ymOffset(today, 2)];

  // 3) monthly_reports (3 ヶ月分)
  const { data: reports } = await supabase
    .from("monthly_reports")
    .select("ym, final_content, draft_content")
    .eq("project_id", projectId)
    .in("ym", yms)
    .order("ym", { ascending: true });

  const reportBlock = (reports ?? [])
    .map((r: { ym: string; final_content: string | null; draft_content: string | null }) => {
      const content = (r.final_content || r.draft_content || "").trim();
      if (!content) return "";
      return `### ${r.ym}\n${content.slice(0, 3500)}`;
    })
    .filter(Boolean)
    .join("\n\n");

  // 4) MTG サマリ (3 ヶ月分)
  const { data: meetings } = await supabase
    .from("project_meeting_summaries")
    .select("ym, meeting_date, title, summary_short, decided, next_actions, risks")
    .eq("project_id", projectId)
    .in("ym", yms)
    .order("meeting_date", { ascending: true })
    .limit(120);

  const meetingBlock = (meetings ?? [])
    .map((m: {
      meeting_date: string;
      title: string;
      summary_short: string;
      decided: unknown;
      next_actions: unknown;
      risks: unknown;
    }) => {
      const dec = Array.isArray(m.decided) ? (m.decided as string[]).filter(Boolean) : [];
      const nxt = Array.isArray(m.next_actions) ? (m.next_actions as string[]).filter(Boolean) : [];
      const rsk = Array.isArray(m.risks) ? (m.risks as string[]).filter(Boolean) : [];
      const parts = [
        `### ${m.meeting_date} ${m.title}`,
        m.summary_short ? `要約: ${m.summary_short}` : "",
        dec.length ? `決定: ${dec.join(" / ")}` : "",
        nxt.length ? `次アクション: ${nxt.join(" / ")}` : "",
        rsk.length ? `リスク: ${rsk.join(" / ")}` : "",
      ].filter(Boolean);
      return parts.join("\n");
    })
    .join("\n\n")
    .slice(0, 8000);

  // 5) 創業メンバー (= CEO 候補の同定用)。db_schema.md の列名に従う (organization は存在しない、affiliation が正解)。
  //    category='amd' の AMD 伴走メンバーと category='university'/'startup'/'unknown' の外部創業者を区別して LLM に渡す。
  const { data: founders } = await supabase
    .from("project_founding_members")
    .select("person_name, role, role_label_jp, category, affiliation, responsibility")
    .eq("project_id", projectId)
    .eq("status", "active")
    .limit(30);

  type Founder = {
    person_name: string;
    role: string | null;
    role_label_jp: string | null;
    category: string | null;
    affiliation: string | null;
    responsibility: string | null;
  };

  const founderRows = (founders ?? []) as Founder[];
  const externalFounders = founderRows.filter((f) => f.category !== "amd");
  const amdMembers = founderRows.filter((f) => f.category === "amd");

  const fmtFounder = (f: Founder) =>
    `- ${f.person_name} / ${f.role_label_jp ?? f.role ?? "?"} / ${f.affiliation ?? ""}` +
    (f.responsibility ? ` / 担当=${f.responsibility}` : "");

  const founderBlock =
    externalFounders.length > 0
      ? `### 外部創業者 / CEO 候補 (= 評価対象)\n${externalFounders.map(fmtFounder).join("\n")}\n\n### AMD 伴走メンバー (= 評価対象外、参考情報)\n${amdMembers.map(fmtFounder).join("\n") || "（なし）"}`
      : "（創業メンバー未抽出。月次レポート + MTG サマリ本文から CEO/創業者っぽい人物を直接推定してください）";

  // 6) 入力ソースが空ならスキップ
  if (!reportBlock && !meetingBlock) {
    return { ok: true, saved: 0, message: "no source content (no reports / no meetings)" };
  }

  const userPrompt =
    `## PJ 情報\n` +
    `- projectId: ${projectId}\n` +
    `- PJ 名: ${projectName}\n` +
    `- 対象期間: 過去 3 ヶ月 (${yms.slice().reverse().join(" → ")})\n\n` +
    `## 創業メンバー\n${founderBlock}\n\n` +
    `## 月次レポート (過去 3 ヶ月分)\n${reportBlock || "（月次レポート未生成）"}\n\n` +
    `## MTG サマリ集 (過去 3 ヶ月分)\n${meetingBlock || "（MTG サマリなし）"}\n\n` +
    `上記から CEO の frl_grit / frl_resilience を 0-9 で推定してください。\n` +
    `判断不能なら null。捏造引用は仕様違反です。`;

  // 7) Sonnet 呼び出し
  let extracted: ExtractResult;
  try {
    const response = await anthropic.messages.create({
      model: prompt.model || "claude-sonnet-4-6",
      max_tokens: prompt.max_tokens || 2048,
      system: prompt.body,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, saved: 0, message: `LLM no JSON: ${text.slice(0, 200)}` };
    }
    const parsed = JSON.parse(jsonMatch[0]);

    const validateScore = (v: unknown): number | null => {
      if (v == null) return null;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return null;
      const r = Math.round(n);
      if (r < 0 || r > 9) return null;
      return r;
    };

    extracted = {
      frl_grit: validateScore(parsed.frl_grit),
      frl_resilience: validateScore(parsed.frl_resilience),
      reasoning_grit: String(parsed.reasoning_grit || "").slice(0, 500),
      reasoning_resilience: String(parsed.reasoning_resilience || "").slice(0, 500),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[frl-grit-resilience] LLM error projectId=${projectId}:`, msg);
    return { ok: false, saved: 0, message: `LLM error: ${msg}` };
  }

  // 8) 既存の最新 amd_score_inputs row (= UNIQUE(project_id, evaluated_at)) を update。
  //    無ければ当日付で INSERT。
  const todayIso = new Date().toISOString();
  const todayDate = todayIso.slice(0, 10);

  const { data: existing } = await supabase
    .from("amd_score_inputs")
    .select("id, evaluated_at, frl_notes")
    .eq("project_id", projectId)
    .order("evaluated_at", { ascending: false })
    .limit(1);

  // 同じ日 (= today date) の row があるか? あれば update、無ければ INSERT (= 当日評価点)
  const isToday = existing?.[0] && existing[0].evaluated_at?.slice(0, 10) === todayDate;
  const targetEvaluatedAt = isToday ? existing[0].evaluated_at : todayIso;
  const mergedFrlNotes = [
    existing?.[0]?.frl_notes ?? "",
    `[${todayDate} grit/resilience auto] grit=${extracted.frl_grit ?? "null"} (${extracted.reasoning_grit}); resilience=${extracted.frl_resilience ?? "null"} (${extracted.reasoning_resilience})`,
  ].filter(Boolean).join("\n").slice(0, 3000);

  const upsertRow = {
    project_id: projectId,
    evaluated_at: targetEvaluatedAt,
    frl_grit: extracted.frl_grit,
    frl_resilience: extracted.frl_resilience,
    frl_notes: mergedFrlNotes,
    evaluator: "cron:frl-grit-resilience-extract",
  };

  const { error: upsertErr } = await supabase
    .from("amd_score_inputs")
    .upsert(upsertRow, { onConflict: "project_id,evaluated_at" });

  if (upsertErr) {
    return { ok: false, saved: 0, message: `upsert error: ${upsertErr.message}` };
  }

  return { ok: true, saved: 1, result: extracted };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const supabase = getServiceClient();
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const prompt = await loadPrompt(supabase);
  if (!prompt) {
    return NextResponse.json(
      {
        error: "llm_prompts.frl.grit_resilience.extract が is_active=false / body 空。/admin/prompts で本文を入力してください",
      },
      { status: 500 }
    );
  }

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  let projectIds: string[] = [];
  if (projectIdParam) {
    projectIds = [projectIdParam];
  } else {
    const { data: projects, error } = await supabase
      .from("projects")
      .select("project_id")
      .eq("status", "active");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    projectIds = (projects ?? []).map((p: { project_id: string }) => p.project_id);
  }

  if (projectIds.length === 0) {
    return NextResponse.json({ ok: true, ran: 0, message: "no target projects" });
  }

  const results: Array<{
    projectId: string;
    ok: boolean;
    saved: number;
    message?: string;
    result?: ExtractResult;
  }> = [];
  for (const projectId of projectIds) {
    try {
      const r = await extractForProject(projectId, supabase, anthropic, prompt);
      results.push({ projectId, ok: r.ok, saved: r.saved, message: r.message, result: r.result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/frl-grit-resilience] projectId=${projectId} fatal:`, msg);
      results.push({ projectId, ok: false, saved: 0, message: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    ran: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    totalSaved: results.reduce((s, r) => s + (r.saved || 0), 0),
    results,
  });
}
