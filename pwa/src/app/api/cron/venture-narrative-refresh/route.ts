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
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateNarrativeItems, type NarrativeInput } from "@/lib/narrative-generator";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * フィードバックから lesson を抽出する (Claude Sonnet)。
 * 「PJ 個別に当てはまる事実訂正」と「全 PJ に当てはまる一般ルール」を分けて出力させる。
 */
async function extractLessons(
  anthropic: Anthropic,
  feedback: { feedback: string; item_date: string | null; item_title: string | null; project_id: string }
): Promise<{ lesson_text: string; scope_general: boolean }[]> {
  const sys = `あなたは「つくよみ」、AMD のディープテックスタジオのアシスタント LLM。
ユーザーが沿革に対して書いた修正依頼を読んで、次回以降の生成に効く「ルール」として抽出してください。

ルールは 2 種類に分けます:
- 一般 (general=true): 全 PJ に共通で適用すべきルール (例: "TRL は設立時点で必ず明記する", "「社」と書かず「PJ」と書く")
- 個別 (general=false): その PJ 固有の事実訂正 (例: "BWE の設立日は 2019-04-28")

抽出指針:
- 修正依頼 1 件から 0〜複数のルールを取れる
- 一般ルールは抽象化されていて、他 PJ にも当てはまる形にする
- 個別ルールは事実そのものを書く
- ルール文は「〜する」「〜である」のように完結した一文
- 重要でない感想や曖昧表現は抽出しない
- 出力は \`\`\`json\`\`\` で囲んだ JSON 配列のみ:
  [{ "general": <bool>, "rule": "<一文>" }]`;

  const user = `PJ ID: ${feedback.project_id}
対象項目: ${feedback.item_date ?? "(全体)"} / ${feedback.item_title ?? "(全体)"}
修正依頼:
"""
${feedback.feedback}
"""`;

  try {
    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 800,
      system: sys,
      messages: [{ role: "user", content: user }],
    });
    const text = r.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
    if (!m) return [];
    const parsed = JSON.parse(m[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is { general: boolean; rule: string } =>
          typeof x === "object" && x !== null && typeof (x as { rule: unknown }).rule === "string"
      )
      .map((x) => ({ lesson_text: x.rule.trim(), scope_general: !!x.general }))
      .filter((x) => x.lesson_text.length > 0);
  } catch (e) {
    console.error("[extractLessons]", e);
    return [];
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

  // 全 PJ 共通の learning (scope='all' or 'narrative', target_project_id=null)
  const { data: globalLearnings } = await supabase
    .from("tsukuyomi_learnings_status")
    .select("lesson_text")
    .in("scope", ["narrative", "all"])
    .is("target_project_id", null)
    .order("created_at", { ascending: true });

  // フィードバック → lesson 抽出用の Anthropic client
  const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  const results: { project_id: string; ok: boolean; count: number; lessons?: number; error?: string }[] = [];

  for (const v of targets) {
    const projectId = v.project_id as string;
    const [
      { data: xrl },
      { data: events },
      { data: members },
      { data: partners },
      { data: openFeedbacks },
      { data: pjLearnings },
    ] = await Promise.all([
      supabase.from("project_xrl_log").select("observed_at, trl, brl, hrl, bottleneck, milestone_label, source").eq("project_id", projectId).order("observed_at", { ascending: true }),
      supabase.from("project_events").select("occurred_on, kind, label, meta").eq("project_id", projectId).order("occurred_on", { ascending: true }),
      supabase.from("project_venture_members").select("full_name, role, member_kind, started_at, ended_at, note").eq("project_id", projectId),
      supabase.from("project_partners").select("partner_name, partner_type, partner_role, sales_target_date, is_sold").eq("project_id", projectId),
      supabase.from("narrative_feedbacks").select("id, item_date, item_title, feedback").eq("project_id", projectId).eq("status", "open").order("created_at", { ascending: true }),
      supabase.from("tsukuyomi_learnings_status").select("lesson_text").in("scope", ["narrative", "all"]).eq("target_project_id", projectId),
    ]);

    const learningsList = [
      ...((globalLearnings as { lesson_text: string }[] | null) ?? []),
      ...((pjLearnings as { lesson_text: string }[] | null) ?? []),
    ].map((l) => l.lesson_text);

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
      learnings: learningsList,
      open_feedbacks: ((openFeedbacks as { item_date: string | null; item_title: string | null; feedback: string }[] | null) ?? []).map((f) => ({
        item_date: f.item_date,
        item_title: f.item_title,
        feedback: f.feedback,
      })),
    };

    let lessonCount = 0;
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

      // フィードバックを「適用済」にして lesson 抽出
      const fbList = (openFeedbacks as { id: string; item_date: string | null; item_title: string | null; feedback: string }[] | null) ?? [];
      for (const fb of fbList) {
        if (anthropic) {
          const lessons = await extractLessons(anthropic, { ...fb, project_id: projectId });
          for (const lesson of lessons) {
            await supabase.from("tsukuyomi_learnings_status").insert({
              scope: "narrative",
              target_project_id: lesson.scope_general ? null : projectId,
              lesson_text: lesson.lesson_text,
              source_feedback_id: fb.id,
            });
            lessonCount += 1;
          }
        }
        await supabase
          .from("narrative_feedbacks")
          .update({
            status: "applied",
            applied_at: new Date().toISOString(),
            applied_note: "narrative-refresh で反映済 + lesson 抽出済",
          })
          .eq("id", fb.id);
      }

      results.push({ project_id: projectId, ok: true, count: items.length, lessons: lessonCount });
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
