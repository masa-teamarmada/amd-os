/**
 * 毎朝 03:00 JST の XRL 自動判定 cron。
 *
 * 対象: is_public=true な project_ventures。ただし projects.project_category='ecosystem' は
 * AMD Score / XRL 算定対象外なので除外する。
 * 条件: 直近の確定 xrl_log (source != 'llm_proposal') の observed_at より新しい
 *      project_events か project_venture_members 変動があるなら判定実行。
 *      何も無いなら飛ばす (LLM コール節約)。
 *
 * 出力: project_xrl_log に source='llm_proposal' で INSERT。
 *       既存 proposal が今日のなら上書きでなく無視 (重複させない)。
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPrimaryProjectAlias } from "@/lib/project-labels";
import { isBackgroundLlmAllowed } from "@/lib/anthropic-client";

export const runtime = "nodejs";
export const maxDuration = 300;

interface VentureRow {
  project_id: string;
  project_name: string;
  project_alias: string | null;
  lane: string;
  founded_at: string | null;
  outcome_pattern: string;
  short_description: string | null;
  long_description: string | null;
}

interface XrlPropose {
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  bottleneck: string | null;
  milestone_label: string;
  trl_reason?: string;
  brl_reason?: string;
  hrl_reason?: string;
}

async function proposeForProject(
  supabase: ReturnType<typeof createAdminClient>,
  geminiKey: string,
  v: VentureRow
): Promise<XrlPropose | null> {
  const [{ data: xrl }, { data: events }, { data: members }] = await Promise.all([
    supabase.from("project_xrl_log").select("observed_at, trl, brl, hrl, bottleneck, source").eq("project_id", v.project_id).order("observed_at", { ascending: true }),
    supabase.from("project_events").select("occurred_on, kind, label, meta").eq("project_id", v.project_id).order("occurred_on", { ascending: true }),
    supabase.from("project_venture_members").select("full_name, role, started_at, ended_at").eq("project_id", v.project_id),
  ]);

  const prompt = `AMD のディープテック PJ「${v.project_name}」の現時点の XRL レベル (TRL / BRL / HRL) を判定してください。
内閣府 SIP 第 3 期の XRL 体系 (TRL=技術成熟度、BRL=事業化成熟度、HRL=人材・市場成熟度、各 1-9)。

PJ メタ:
- 外部別名: ${v.project_alias ?? "(なし)"}
- レーン: ${v.lane}
- 設立日: ${v.founded_at ?? "未設立"}
- アウトカム: ${v.outcome_pattern}
- short: ${v.short_description ?? ""}
- long: ${v.long_description ?? ""}

過去 XRL (時系列):
${JSON.stringify(xrl ?? [], null, 2)}

イベント:
${JSON.stringify(events ?? [], null, 2)}

メンバー:
${JSON.stringify(members ?? [], null, 2)}

判定ルール:
- TRL/BRL/HRL は 1-9 整数、確信できない / 情報不足なら null
- bottleneck: 最も低い軸の名前 (TRL/BRL/HRL)、一意でなければ null
- milestone_label: 一行
- 評価理由は軸別に分けて書く。情報不足な軸は "情報不足" と明記

出力は \`\`\`json\`\`\` で囲んだ JSON のみ:
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

  try {
    const gen = new GoogleGenerativeAI(geminiKey);
    const model = gen.getGenerativeModel({ model: "gemini-2.5-flash" });
    const r = await model.generateContent(prompt);
    const text = r.response.text();
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    return JSON.parse(m[1]) as XrlPropose;
  } catch (e) {
    console.error("[xrl-refresh] llm", v.project_id, e);
    return null;
  }
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("Authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  // 背景処理での従量課金 LLM (ここは Gemini) はデフォルト封鎖。7/1 の Anthropic 封鎖と同じ扱い。
  if (!isBackgroundLlmAllowed()) {
    return NextResponse.json({ ok: true, disabled: true, reason: "background llm disabled" });
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const supabase = createAdminClient();
  const { data: rawVentures, error } = await supabase
    .from("project_ventures")
    .select("project_id, lane, founded_at, outcome_pattern, short_description, long_description, projects(project_name, client_name, news_search_query)")
    .eq("is_public", true);
  if (error || !rawVentures) {
    return NextResponse.json({ error: "fetch ventures failed", detail: error }, { status: 500 });
  }
  const ventures = (rawVentures as Array<VentureRow & {
    projects:
      | { project_name: string | null; client_name: string | null; news_search_query: string | null }
      | { project_name: string | null; client_name: string | null; news_search_query: string | null }[]
      | null;
  }>).map((raw) => {
    const project = Array.isArray(raw.projects) ? raw.projects[0] : raw.projects;
    return {
      ...raw,
      project_name: project?.project_name?.trim() || raw.project_id,
      project_alias: getPrimaryProjectAlias({
        project_name: project?.project_name,
        client_name: project?.client_name,
        news_search_query: project?.news_search_query,
      }),
    };
  });

  const projectIds = [...new Set(ventures.map((v) => v.project_id))];
  if (projectIds.length === 0) {
    return NextResponse.json({ total: 0, skippedEcosystem: 0, results: [] });
  }
  const { data: projectRows, error: projectError } = await supabase
    .from("projects")
    .select("project_id, project_category")
    .in("project_id", projectIds);
  if (projectError) {
    return NextResponse.json({ error: "fetch project categories failed", detail: projectError }, { status: 500 });
  }
  const categoryByProject = new Map(
    ((projectRows ?? []) as Array<{ project_id: string; project_category: string | null }>).map((row) => [
      row.project_id,
      row.project_category || "dtsu",
    ])
  );
  const targetVentures = ventures.filter((v) => categoryByProject.get(v.project_id) !== "ecosystem");
  const skippedEcosystem = ventures.filter((v) => categoryByProject.get(v.project_id) === "ecosystem");

  const today = new Date().toISOString().slice(0, 10);
  const results: { project_id: string; status: "skipped" | "proposed" | "error"; reason?: string }[] = skippedEcosystem.map((v) => ({
    project_id: v.project_id,
    status: "skipped",
    reason: "ecosystem project",
  }));

  for (const v of targetVentures) {
    // 既に今日 proposal を作っていればスキップ
    const { data: todayProposal } = await supabase
      .from("project_xrl_log")
      .select("id")
      .eq("project_id", v.project_id)
      .eq("source", "llm_proposal")
      .eq("observed_at", today)
      .maybeSingle();
    if (todayProposal) {
      results.push({ project_id: v.project_id, status: "skipped", reason: "today proposal already exists" });
      continue;
    }

    // 直近の確定値より新しい event がない場合はスキップ
    const { data: lastConfirmed } = await supabase
      .from("project_xrl_log")
      .select("observed_at")
      .eq("project_id", v.project_id)
      .neq("source", "llm_proposal")
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastConfirmedDate = (lastConfirmed?.observed_at as string | undefined) ?? null;

    if (lastConfirmedDate) {
      const { data: newerEvents } = await supabase
        .from("project_events")
        .select("id")
        .eq("project_id", v.project_id)
        .gt("occurred_on", lastConfirmedDate)
        .limit(1);
      const { data: newerMembers } = await supabase
        .from("project_venture_members")
        .select("id")
        .eq("project_id", v.project_id)
        .gt("updated_at", lastConfirmedDate)
        .limit(1);
      const hasDelta = (newerEvents && newerEvents.length > 0) || (newerMembers && newerMembers.length > 0);
      if (!hasDelta) {
        results.push({ project_id: v.project_id, status: "skipped", reason: "no delta since last confirmed XRL" });
        continue;
      }
    }

    const proposal = await proposeForProject(supabase, geminiKey, v);
    if (!proposal) {
      results.push({ project_id: v.project_id, status: "error" });
      continue;
    }
    const sourceNoteJson = JSON.stringify({
      trl_reason: proposal.trl_reason ?? "情報不足",
      brl_reason: proposal.brl_reason ?? "情報不足",
      hrl_reason: proposal.hrl_reason ?? "情報不足",
    });
    await supabase.from("project_xrl_log").insert({
      project_id: v.project_id,
      observed_at: today,
      trl: proposal.trl,
      brl: proposal.brl,
      hrl: proposal.hrl,
      bottleneck: proposal.bottleneck,
      milestone_label: proposal.milestone_label,
      source_note: sourceNoteJson,
      source: "llm_proposal",
    });
    await supabase
      .from("project_ventures")
      .update({ narrative_invalidated_at: new Date().toISOString() })
      .eq("project_id", v.project_id);
    results.push({ project_id: v.project_id, status: "proposed" });
  }

  return NextResponse.json({ total: targetVentures.length, skippedEcosystem: skippedEcosystem.length, results });
}
