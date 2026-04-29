// revise-monthly-report Edge Function
// 入力: { project_id, ym, instruction, requested_by, revision_id? }
// 動作:
//   1. monthly_reports の final_content/draft_content を取得
//   2. tsukuyomi_learnings から該当PJの学習を取得してプロンプトに注入
//   3. LLM に「修正指示 → 修正後全文」を生成させる
//   4. monthly_report_revisions に upsert, メッセージを追加
//   5. { ok, revision_id, revised_content } を返す

// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SYSTEM = `あなたはAMD OSのアシスタントAI「つくよみ」。月次報告書の修正を依頼されたら、依頼内容に従って報告書全体を修正し、修正後の報告書全文のみを出力する。前置き・解説・「以下を修正しました」などのメタ説明は一切書かない。Markdown形式（見出しは##から）を維持する。一人称は「つくよみ」。タメ語で優しく書く。`;

async function callAnthropic(prompt: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8000,
        temperature: 0.3,
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("anthropic error", data);
      return null;
    }
    const text = data?.content?.[0]?.text;
    return typeof text === "string" ? text.trim() : null;
  } catch (e) {
    console.error("anthropic call failed", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const projectId: string = String(body.project_id || "").trim();
    const ym: string = String(body.ym || "").trim();
    const instruction: string = String(body.instruction || "").trim();
    const requestedBy: string = String(body.requested_by || "").trim();
    const existingRevisionId: string = String(body.revision_id || "").trim();

    if (!projectId || !ym || !instruction) {
      return new Response(
        JSON.stringify({ error: "project_id, ym, instruction required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 1. 現在の報告書を取得
    const { data: reportRows } = await supa
      .from("monthly_reports")
      .select("final_content, draft_content, status")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .limit(1);

    const currentContent = reportRows?.[0]?.final_content || reportRows?.[0]?.draft_content || "";

    if (!currentContent) {
      return new Response(
        JSON.stringify({ error: "報告書の本文が見つかりません" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. このPJの学習データを取得（active のみ）
    const { data: learnings } = await supa
      .from("tsukuyomi_learnings")
      .select("content, source")
      .eq("scope", "monthlyReport")
      .eq("status", "active")
      .or(`scope_key.eq.${projectId},scope_key.is.null`)
      .order("created_at", { ascending: false })
      .limit(20);

    const learningText = learnings && learnings.length > 0
      ? learnings.map((l: any, i: number) => `${i + 1}. ${l.content}`).join("\n")
      : "";

    // 3. プロンプト構築
    const prompt = [
      "# 月次報告書の修正依頼",
      "",
      "## 現在の報告書",
      currentContent,
      "",
      "## 修正指示",
      instruction,
      ...(learningText
        ? [
            "",
            "## 過去の修正で学習したこと（参考にして）",
            learningText,
          ]
        : []),
      "",
      "## 出力ルール",
      "- 修正指示に従って報告書全体を修正し、全文を出力する",
      "- 修正指示に関係ない部分はそのまま維持する",
      "- Markdown形式を維持する（見出しは##から始める）",
      "- 修正についてのメタ説明は一切書かない",
      "- 出力は報告書本文のみ",
    ].join("\n");

    // 4. LLM 呼び出し
    const revisedContent = await callAnthropic(prompt);
    const finalContent = revisedContent ?? currentContent;

    // 5. monthly_report_revisions に保存
    let revisionId = existingRevisionId;

    if (revisionId) {
      await supa
        .from("monthly_report_revisions")
        .update({
          revised_content: finalContent,
          status: "pending",
        })
        .eq("id", revisionId);
    } else {
      const { data: inserted } = await supa
        .from("monthly_report_revisions")
        .insert({
          project_id: projectId,
          ym,
          instruction,
          requested_by: requestedBy || null,
          revised_content: finalContent,
          status: "pending",
        })
        .select("id")
        .single();
      revisionId = (inserted as any)?.id ?? "";
    }

    // 6. メッセージを追加
    if (revisionId) {
      await supa.from("monthly_report_revision_messages").insert({
        revision_id: revisionId,
        sender_kind: "pm",
        body: instruction,
      });

      const tsukuyomiMsg = revisedContent
        ? `修正したよ🌙 変更箇所を確認して、いいと思ったら承認してね。気に入らない部分は却下して理由を教えてくれると、次回の参考にするね。`
        : `ごめん、修正の生成に失敗しちゃった💦 もう一度試してみて。`;

      await supa.from("monthly_report_revision_messages").insert({
        revision_id: revisionId,
        sender_kind: "tsukuyomi",
        body: tsukuyomiMsg,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        revision_id: revisionId,
        revised_content: finalContent,
        llm_used: !!ANTHROPIC_API_KEY && !!revisedContent,
      }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }
});
