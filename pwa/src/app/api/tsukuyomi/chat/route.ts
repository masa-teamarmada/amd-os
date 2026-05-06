/**
 * つくよみマスコットチャット 1 ターン (Claude Sonnet)。
 *
 * POST { session_id, page_path, project_id?, messages: [{role, content}] }
 *   → { reply: string, applied?: [{kind, detail}] }
 *
 * 動作:
 *   - project_id があれば: project_ventures + xrl + events + members + partners + 既存 PL を context に含める
 *   - Sonnet が必要に応じて tool を呼ぶ:
 *       * update_short_long_description: short_description / long_description を更新
 *       * invalidate_narrative: narrative_invalidated_at を立てる (= 沿革を次の cron で再生成)
 *       * record_xrl_feedback: TRL/BRL/HRL の修正依頼を xrl_feedbacks に記録 (cron / 個別 API で再評価)
 *   - 全会話 + applied actions は tsukuyomi_chat_logs に保存
 *   - 修正系の発話があれば admin/tsukuyomi の「修正依頼履歴」相当として narrative_feedbacks にも複製保存
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface ApplyAction {
  kind: string;
  detail: string;
}

const SYSTEM = `あなたは「つくよみ」、AMD (株式会社チームアルマダ) のディープテックスタジオの専属マスコット LLM。
20 代女子っぽく、明るくキレのある書き手。書くときの声はドライでまっすぐ。

# 役割
ユーザーは AMD CEO のまさ。画面に表示されている PJ コックピットの情報をすべて把握した状態で会話する。
- 「○○ について教えて」 → 持っている情報から答える
- 「○○ を直して」 → 該当する tool を呼んで修正する
- 不確かな場合は推測せず、わからないと正直に答える

# 利用可能な tool
- update_short_long_description(short?, long?): 事業概要 (short=1 行サマリ / long=詳細) を書き直す
- invalidate_narrative(): 沿革を「再生成すべき」と markする (次の 03:45 cron で再生成 + 学習)
- record_xrl_feedback(axis?, feedback): TRL/BRL/HRL の修正依頼として記録 (cron / 個別 API で再評価)
- web_search: ネットで検索して事実情報を取る (推測ではなく実データを得たいとき)

# 単位ルール
- SU を「社」「ventures」と書かない、「PJ」と書く

# 修正系の発話への対応
- まさが「直して」「書き直して」と言ったら必ず該当 tool を呼ぶ。確認質問で時間を使わない
- 修正したら、何をどう直したかを 1〜2 行で報告する
- 「ネットで調べて」と言われたら必ず web_search を使う。推測・捏造は禁止`;

interface ProjectContext {
  display_name: string;
  lane: string;
  founded_at: string | null;
  outcome_pattern: string;
  short_description: string | null;
  long_description: string | null;
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  amd_support_started_at: string | null;
  amd_support_ended_at: string | null;
  events: unknown[];
  members: unknown[];
  partners: unknown[];
  xrl: unknown[];
  pl_monthly: unknown[];
  narrative_text: string | null;
}

async function loadProjectContext(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string
): Promise<ProjectContext | null> {
  const [{ data: v }, { data: events }, { data: members }, { data: partners }, { data: xrl }, { data: pl }] =
    await Promise.all([
      supabase
        .from("project_ventures")
        .select("display_name, lane, founded_at, outcome_pattern, short_description, long_description, origin_org, origin_pi, amd_role, amd_support_started_at, amd_support_ended_at, narrative_text")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase.from("project_events").select("occurred_on, kind, label, meta").eq("project_id", projectId).order("occurred_on", { ascending: true }),
      supabase.from("project_venture_members").select("full_name, role, member_kind, started_at, ended_at, note").eq("project_id", projectId),
      supabase.from("project_partners").select("partner_name, partner_type, partner_role, sales_target_date, is_sold").eq("project_id", projectId),
      supabase.from("project_xrl_log").select("observed_at, trl, brl, hrl, bottleneck, milestone_label, source_note, source").eq("project_id", projectId).order("observed_at", { ascending: true }),
      supabase.from("project_pl_monthly").select("ym, revenue_yen, cogs_yen, personnel_yen, rd_yen, marketing_yen, other_opex_yen, notes").eq("project_id", projectId).order("ym", { ascending: true }),
    ]);
  if (!v) return null;
  return {
    display_name: v.display_name as string,
    lane: v.lane as string,
    founded_at: (v.founded_at as string | null) ?? null,
    outcome_pattern: v.outcome_pattern as string,
    short_description: (v.short_description as string | null) ?? null,
    long_description: (v.long_description as string | null) ?? null,
    origin_org: (v.origin_org as string | null) ?? null,
    origin_pi: (v.origin_pi as string | null) ?? null,
    amd_role: (v.amd_role as string | null) ?? null,
    amd_support_started_at: (v.amd_support_started_at as string | null) ?? null,
    amd_support_ended_at: (v.amd_support_ended_at as string | null) ?? null,
    events: events ?? [],
    members: members ?? [],
    partners: partners ?? [],
    xrl: xrl ?? [],
    pl_monthly: pl ?? [],
    narrative_text: (v.narrative_text as string | null) ?? null,
  };
}

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "update_short_long_description",
    description: "PJ の事業概要 (short_description = 1 行サマリ / long_description = 詳細) を更新する。どちらか片方だけでも OK。",
    input_schema: {
      type: "object",
      properties: {
        short: { type: "string", description: "更新後の short_description (省略可)" },
        long: { type: "string", description: "更新後の long_description (省略可)" },
        reason: { type: "string", description: "なぜこう直したか、まさへの 1 行報告" },
      },
      required: ["reason"],
    },
  },
  {
    name: "invalidate_narrative",
    description: "沿革を「再生成すべき」とマークする (次の 03:45 cron で再生成)。情報が古いと感じたら呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "なぜ再生成が必要か" },
      },
      required: ["reason"],
    },
  },
  {
    name: "record_xrl_feedback",
    description: "TRL/BRL/HRL の修正依頼を xrl_feedbacks に記録する。次の 03:15 cron で反映される。",
    input_schema: {
      type: "object",
      properties: {
        axis: { type: "string", enum: ["TRL", "BRL", "HRL"], description: "対象軸 (省略可)" },
        feedback: { type: "string", description: "修正内容" },
      },
      required: ["feedback"],
    },
  },
  // 公式 web_search tool (推論時にネット検索)。SDK の型に未対応なので as unknown
  { type: "web_search_20250305", name: "web_search", max_uses: 5 } as unknown as Anthropic.Messages.Tool,
];

async function executeTool(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string | null,
  name: string,
  input: Record<string, unknown>
): Promise<{ ok: boolean; summary: string }> {
  if (!projectId) return { ok: false, summary: "PJ コックピット外なので適用できない" };

  if (name === "update_short_long_description") {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof input.short === "string") update.short_description = input.short;
    if (typeof input.long === "string") update.long_description = input.long;
    update.narrative_invalidated_at = new Date().toISOString();
    const { error } = await supabase.from("project_ventures").update(update).eq("project_id", projectId);
    if (error) return { ok: false, summary: `update 失敗: ${error.message}` };
    return { ok: true, summary: typeof input.reason === "string" ? input.reason : "概要を更新" };
  }

  if (name === "invalidate_narrative") {
    const { error } = await supabase
      .from("project_ventures")
      .update({ narrative_invalidated_at: new Date().toISOString() })
      .eq("project_id", projectId);
    if (error) return { ok: false, summary: `invalidate 失敗: ${error.message}` };
    return { ok: true, summary: typeof input.reason === "string" ? input.reason : "沿革を invalidate" };
  }

  if (name === "record_xrl_feedback") {
    const fb = typeof input.feedback === "string" ? input.feedback : "";
    const axis = typeof input.axis === "string" ? input.axis : null;
    if (!fb) return { ok: false, summary: "feedback 文がない" };
    const { error } = await supabase.from("xrl_feedbacks").insert({
      project_id: projectId,
      xrl_log_id: null,
      axis,
      feedback: fb,
    });
    if (error) return { ok: false, summary: `xrl_feedback 失敗: ${error.message}` };
    await supabase
      .from("project_ventures")
      .update({ narrative_invalidated_at: new Date().toISOString() })
      .eq("project_id", projectId);
    return { ok: true, summary: `XRL 修正依頼を記録 (${axis ?? "all"})` };
  }

  return { ok: false, summary: `unknown tool: ${name}` };
}

export async function POST(req: Request) {
  let body: {
    session_id?: string;
    page_path?: string | null;
    project_id?: string | null;
    messages?: IncomingMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  if (!body.session_id || !body.messages || body.messages.length === 0) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  let contextBlock = "";
  if (body.project_id) {
    const ctx = await loadProjectContext(supabase, body.project_id);
    if (ctx) {
      contextBlock = `\n# 画面に表示されている PJ コックピットの全 context (${body.project_id})\n${JSON.stringify(ctx, null, 2)}\n`;
    }
  }

  const fullSystem = SYSTEM + contextBlock;

  // 直近のユーザー発話を保存
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    await supabase.from("tsukuyomi_chat_logs").insert({
      project_id: body.project_id ?? null,
      session_id: body.session_id,
      page_path: body.page_path ?? null,
      role: "user",
      content: lastUser.content,
    });
  }

  const anthropic = new Anthropic({ apiKey });
  const conversation: Anthropic.Messages.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // tool ループ (最大 5 ラウンド)
  const applied: ApplyAction[] = [];
  let lastReply = "";
  for (let round = 0; round < 5; round += 1) {
    let r: Anthropic.Messages.Message;
    try {
      r = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        system: fullSystem,
        messages: conversation,
        tools: TOOLS,
      });
    } catch (e) {
      console.error("[tsukuyomi/chat] anthropic error", e);
      return NextResponse.json({ error: "llm error", detail: String(e) }, { status: 500 });
    }

    const toolUses = r.content.filter((c) => c.type === "tool_use") as Array<{
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }>;
    const textParts = r.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");
    if (textParts) lastReply = textParts;

    if (toolUses.length === 0 || r.stop_reason === "end_turn") {
      break;
    }

    // tool 実行 + assistant ターンを履歴に追加 + tool_result を返す
    conversation.push({ role: "assistant", content: r.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      // web_search は SDK が自動処理、ローカル実行不要
      if (tu.name === "web_search") continue;
      const exec = await executeTool(supabase, body.project_id ?? null, tu.name, tu.input);
      if (exec.ok) applied.push({ kind: tu.name, detail: exec.summary });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: exec.summary,
        is_error: !exec.ok,
      });
    }
    if (toolResults.length === 0) break;
    conversation.push({ role: "user", content: toolResults });
  }

  // assistant 返事を保存
  if (lastReply) {
    await supabase.from("tsukuyomi_chat_logs").insert({
      project_id: body.project_id ?? null,
      session_id: body.session_id,
      page_path: body.page_path ?? null,
      role: "assistant",
      content: lastReply,
      applied_actions: applied.length > 0 ? applied : null,
    });
  }

  // 修正依頼系発話 (record_xrl_feedback / invalidate_narrative / 概要修正) は admin の修正依頼履歴にも残す
  if (applied.length > 0 && body.project_id && lastUser) {
    await supabase.from("narrative_feedbacks").insert({
      project_id: body.project_id,
      item_date: null,
      item_title: "(つくよみチャット)",
      feedback: lastUser.content,
      status: "applied",
      applied_at: new Date().toISOString(),
      applied_note: `tsukuyomi chat: ${applied.map((a) => a.kind).join(", ")}`,
    });
  }

  return NextResponse.json({
    reply: lastReply || "(返事を組み立てられませんでした)",
    applied: applied.length > 0 ? applied : undefined,
  });
}
