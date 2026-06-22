/**
 * POST /api/report/generate
 * 月次報告書をLLM（Claude）で生成する。
 * body: { projectId, ym, feedback? }
 * feedback がある場合は既存ドラフトの修正。ない場合は新規生成。
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { estimateProgress } from "@/lib/progress-estimator";
import { requireAdmin } from "@/lib/supabase/api-auth";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// レート制限: projectId ごとに 60 秒のクールタイム（M4）
const reportRateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );

  try {
    const { projectId, ym, feedback } = await req.json();

    // レート制限チェック
    const rateLimitNow = Date.now();
    const lastCall = reportRateLimit.get(projectId) || 0;
    if (rateLimitNow - lastCall < RATE_LIMIT_MS) {
      const wait = Math.ceil((RATE_LIMIT_MS - (rateLimitNow - lastCall)) / 1000);
      return NextResponse.json({ error: `Too many requests. Wait ${wait}s before regenerating.` }, { status: 429 });
    }
    reportRateLimit.set(projectId, rateLimitNow);
    if (!projectId || !ym) {
      return NextResponse.json({ error: "projectId and ym required" }, { status: 400 });
    }

    // 1. プロジェクト情報取得
    const { data: project } = await supabase
      .from("projects")
      .select("project_id, project_name, client_name")
      .eq("project_id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 2. メンバー取得
    const { data: pmRows } = await supabase
      .from("project_members")
      .select("member_id")
      .eq("project_id", projectId)
      .eq("is_active", true);

    const memberIds = (pmRows || []).map((r) => r.member_id);
    const { data: memberRows } = await supabase
      .from("members")
      .select("member_id, code_name")
      .in("member_id", memberIds.length > 0 ? memberIds : ["__none__"]);

    const members = (memberRows || []).map((m) => m.code_name || "PM");

    // 3. SourceCache取得（対象月の全ソース）
    const { data: sourceItems } = await supabase
      .from("source_cache")
      .select("source, title, item_date, content_text, char_count")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .order("item_date", { ascending: false })
      .limit(60);

    // ソース別にグループ化
    const bySource: Record<string, { title: string; content: string; date: string }[]> = {};
    for (const item of sourceItems || []) {
      const src = item.source || "other";
      if (!bySource[src]) bySource[src] = [];
      bySource[src].push({
        title: item.title || "",
        content: (item.content_text || "").slice(0, 2000),
        date: item.item_date || "",
      });
    }

    // 4. マイルストーン情報
    const { data: pcRows } = await supabase
      .from("value_plan_cycles")
      .select("plan_cycle_id, total_points, period_start_ym, period_end_ym")
      .eq("project_id", projectId)
      .in("status", ["active", "confirmed", "fixed"])
      .limit(1);

    let milestonesText = "";
    if (pcRows && pcRows.length > 0) {
      const pc = pcRows[0];
      const { data: msRows } = await supabase
        .from("value_milestones")
        .select("title, points, tag")
        .eq("plan_cycle_id", pc.plan_cycle_id)
        .eq("is_active", true)
        .order("sort_order");

      if (msRows && msRows.length > 0) {
        milestonesText = "## 当期マイルストーン\n" +
          msRows.map((ms) => `- ${ms.title}（${ms.points}pt, ${ms.tag}）`).join("\n");
      }
    }

    // 5. 既存ドラフト取得（修正モードの場合）
    let existingDraft = "";
    if (feedback) {
      const { data: report } = await supabase
        .from("monthly_reports")
        .select("draft_content, final_content")
        .eq("project_id", projectId)
        .eq("ym", ym)
        .single();

      existingDraft = report?.final_content || report?.draft_content || "";
    }

    // 6. つくよみコンテキスト取得
    const { data: contextRows } = await supabase
      .from("tsukuyomi_context")
      .select("system_prompt, priority")
      .eq("tags", "monthlyreport")
      .eq("status", "active")
      .order("priority", { ascending: false })
      .limit(5);

    const baseSystemPrompt = contextRows && contextRows.length > 0
      ? contextRows.map((r) => r.system_prompt).join("\n\n")
      : "あなたはAMD OSの月次報告書生成アシスタント「つくよみ」です。クライアントに提出する月次活動報告書を作成してください。";
    // クライアント提出物として AMD OS 内部固有名を出さないよう強く指示する
    const clientFacingGuard = [
      "",
      "## クライアント提出物としての制約 (絶対遵守)",
      "本報告書はクライアント (大学・研究機関・民間企業) に提出する正式文書。以下の AMD OS 内部固有名や仕組み呼称を**本文に絶対に書かない**。",
      "- 「つくよみ」「つくよみレポート」 → 本書の中で AMD 自身を主語にする場合は「AMD」「弊社」と書く",
      "- 「月次進捗モーダル」「コックピット」「H-1 next action」「nudge」「経営シグナル」 → これらは OS 内 UI / cron 名でクライアントから見えない",
      "- 「MTGページ」「MTG ページ」 → 「会議記録」「打合せ」と書く",
      "- 出典として OS 内画面・cron 名を書かない。実体に基づく出典 (会議日 / 公募名 / メディア名 / 採択日など) のみ書く",
      "- 「FRL」「ATLAS protocol」など社内モデル名も避け、必要なら「内部評価指標」と書く",
      "",
    ].join("\n");
    const systemPrompt = baseSystemPrompt + clientFacingGuard;

    // 7. プロンプト組み立て
    const ymFormatted = `${ym.slice(0, 4)}年${parseInt(ym.slice(4))}月`;
    let userPrompt = `# ${project.project_name}（${project.client_name || ""}）${ymFormatted}度 月次報告書\n\n`;
    userPrompt += `メンバー: ${members.join(", ")}\n\n`;

    if (milestonesText) {
      userPrompt += milestonesText + "\n\n";
    }

    // ソースデータ追加（上限12000文字）
    let charBudget = 12000;
    const sourceLabels: Record<string, string> = {
      notion: "Notion",
      slack: "Slack",
      gmail: "Gmail",
      drive: "Drive",
      calendar: "カレンダー/MTG",
    };

    for (const [src, items] of Object.entries(bySource)) {
      if (charBudget <= 0) break;
      const label = sourceLabels[src] || src;
      let section = `## ${label}の活動\n`;
      for (const item of items.slice(0, 15)) {
        const entry = `- ${item.title}: ${item.content.slice(0, 500)}\n`;
        if (section.length + entry.length > charBudget) break;
        section += entry;
      }
      userPrompt += section + "\n";
      charBudget -= section.length;
    }

    if (feedback && existingDraft) {
      userPrompt += `\n## 現在のドラフト\n${existingDraft}\n\n`;
      userPrompt += `## 修正指示\n${feedback}\n\n`;
      userPrompt += "上記の修正指示に基づいてドラフトを修正してください。";
    } else {
      userPrompt += `\n以下の構成で報告書を生成してください：
1. 概要（3-5行）
2. 進捗状況（マイルストーン別）
3. 課題と対応
4. 来月の計画
5. メンバー活動
6. スライド要約（1-2行×6枚分）`;
    }

    // 8. Claude API呼び出し
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const generatedText = response.content
      .filter((c) => c.type === "text")
      .map((c) => ("text" in c ? c.text : ""))
      .join("");

    // 9. Supabaseに保存
    const now = new Date().toISOString();
    const reportId = `${projectId}_${ym}`;

    if (feedback) {
      // 修正: draft_contentを更新
      await supabase
        .from("monthly_reports")
        .update({
          draft_content: generatedText,
          status: "draft",
          generated_at: now,
        })
        .eq("project_id", projectId)
        .eq("ym", ym);
    } else {
      // 新規: upsert
      await supabase
        .from("monthly_reports")
        .upsert({
          report_id: reportId,
          project_id: projectId,
          ym,
          draft_content: generatedText,
          status: "draft",
          generated_at: now,
        }, { onConflict: "project_id,ym" });
    }

    // 10. 進捗推定（レポート内容をもとにMS進捗%を自動推定してmilestone_monthly_progressに保存）
    // fire-and-forget: エラーがあってもレポート生成の成否には影響させない
    let progressEstimate: { saved?: number; total?: number; message?: string } = {};
    try {
      progressEstimate = await estimateProgress(projectId, ym);
    } catch (estimateErr) {
      console.warn("Progress estimate skipped:", estimateErr);
    }

    return NextResponse.json({
      success: true,
      reportId,
      draftContent: generatedText,
      generatedAt: now,
      tokenUsage: response.usage,
      progressEstimate,
    });
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
