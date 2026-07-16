/**
 * 単一 PJ の沿革を再生成するロジック (cron と単発 API 両方から使う)。
 *
 * 入力: project_id
 * 動作:
 *   1. project_ventures + xrl + events + members + partners + open feedbacks + learnings を集約
 *   2. Gemini 2.5 Flash で narrative items 生成
 *   3. project_ventures.narrative_text に JSON 配列で保存 + invalidated_at クリア
 *   4. open feedbacks から Claude Sonnet が lesson 抽出 → tsukuyomi_learnings_status に保存
 *   5. feedbacks を applied 化
 *
 * 戻り値: { ok, count, lessons }
 */

import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic } from "@/lib/anthropic-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateNarrativeItems, type NarrativeInput } from "./narrative-generator";

interface FeedbackRow {
  id: string;
  item_date: string | null;
  item_title: string | null;
  feedback: string;
}

async function extractLessons(
  anthropic: Anthropic,
  feedback: FeedbackRow & { project_id: string }
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

export interface RefreshOneResult {
  ok: boolean;
  count: number;
  lessons: number;
  error?: string;
}

export async function refreshNarrativeForProject(
  supabase: SupabaseClient,
  geminiKey: string,
  anthropicKey: string | null,
  projectId: string
): Promise<RefreshOneResult> {
  const { data: v, error: vErr } = await supabase
    .from("project_ventures")
    .select(
      "project_id, lane, founded_at, outcome_pattern, origin_org, origin_pi, amd_role, amd_support_started_at, amd_support_ended_at, short_description, long_description, projects(project_name)"
    )
    .eq("project_id", projectId)
    .maybeSingle();
  if (vErr || !v) return { ok: false, count: 0, lessons: 0, error: "venture not found" };
  const project = Array.isArray(v.projects) ? v.projects[0] : v.projects;

  const [
    { data: xrl },
    { data: events },
    { data: members },
    { data: partners },
    { data: openFeedbacks },
    { data: globalLearnings },
    { data: pjLearnings },
  ] = await Promise.all([
    supabase
      .from("project_xrl_log")
      .select("observed_at, trl, brl, hrl, bottleneck, milestone_label, source")
      .eq("project_id", projectId)
      .order("observed_at", { ascending: true }),
    supabase
      .from("project_events")
      .select("occurred_on, kind, label, meta")
      .eq("project_id", projectId)
      .order("occurred_on", { ascending: true }),
    supabase
      .from("project_venture_members")
      .select("full_name, role, member_kind, amd_member_id, started_at, ended_at, note")
      .eq("project_id", projectId),
    supabase
      .from("project_partners")
      .select("partner_name, partner_type, partner_role, sales_target_date, is_sold")
      .eq("project_id", projectId),
    supabase
      .from("narrative_feedbacks")
      .select("id, item_date, item_title, feedback")
      .eq("project_id", projectId)
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase
      .from("tsukuyomi_learnings_status")
      .select("lesson_text")
      .in("scope", ["narrative", "all"])
      .is("target_project_id", null),
    supabase
      .from("tsukuyomi_learnings_status")
      .select("lesson_text")
      .in("scope", ["narrative", "all"])
      .eq("target_project_id", projectId),
  ]);

  const learnings = [
    ...((globalLearnings as { lesson_text: string }[] | null) ?? []),
    ...((pjLearnings as { lesson_text: string }[] | null) ?? []),
  ].map((l) => l.lesson_text);

  const input: NarrativeInput = {
    project_name: project?.project_name?.trim() || projectId,
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
    learnings,
    open_feedbacks: ((openFeedbacks as FeedbackRow[] | null) ?? []).map((f) => ({
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

    const fbList = (openFeedbacks as FeedbackRow[] | null) ?? [];
    const anthropic = anthropicKey ? getBackgroundAnthropic("lib/narrative-refresh") : null;
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

    return { ok: true, count: items.length, lessons: lessonCount };
  } catch (e) {
    console.error("[refreshNarrativeForProject]", projectId, e);
    return { ok: false, count: 0, lessons: lessonCount, error: String(e) };
  }
}
