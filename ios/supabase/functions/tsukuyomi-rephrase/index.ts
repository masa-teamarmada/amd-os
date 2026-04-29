// tsukuyomi-rephrase Edge Function
// 入力: { proposal_id, raw_reason }
// 仕事:
//   1. raw_reason を つくよみ口調（タメ語、優しめ）に LLM で言い換える
//   2. ms_proposal_messages に sender_kind='tsukuyomi' で append
//   3. ms_progress_proposals.status='rejected', reject_reason_raw を保存

// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TSUKUYOMI_SYSTEM = `あなたはAMD OSのアシスタントAI「つくよみ」。性格は明るくて親しみやすく、メンバーに寄り添う口調。一人称は「つくよみ」または「あたし」。タメ語で短くまとめる。adminから受け取った差し戻し理由を、メンバーが受け取っても傷つかない優しい言い換えにする。事実は変えず、語気だけ柔らかくする。300文字以内。最後に「修正して再提案してね🌙」のような一言を添える。`;

async function callAnthropic(rawReason: string, context: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    // fallback: そのまま返す（プレフィックスだけ付ける）
    return `差し戻しになっちゃった、ごめんね🌙\n${rawReason}\n\nもう一度考え直して再提案してくれる？`;
  }
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
        max_tokens: 800,
        temperature: 0.5,
        system: TSUKUYOMI_SYSTEM,
        messages: [
          {
            role: "user",
            content: `# 提案コンテキスト\n${context}\n\n# adminからの差し戻し理由（生）\n${rawReason}\n\n# 指示\n上記の差し戻し理由を、つくよみの口調でメンバーに伝える文章に言い換えて。`,
          },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("anthropic error", data);
      return `差し戻しになっちゃった、ごめんね🌙\n${rawReason}\n\nもう一度考え直して再提案してくれる？`;
    }
    const text = data?.content?.[0]?.text;
    return typeof text === "string" && text.trim()
      ? text.trim()
      : `差し戻しになっちゃった、ごめんね🌙\n${rawReason}`;
  } catch (e) {
    console.error("anthropic call failed", e);
    return `差し戻しになっちゃった、ごめんね🌙\n${rawReason}`;
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
    const proposalId: string = String(body.proposal_id || "").trim();
    const rawReason: string = String(body.raw_reason || "").trim();
    const adminId: string = String(body.admin_id || "").trim();
    if (!proposalId || !rawReason) {
      return new Response(JSON.stringify({ error: "proposal_id and raw_reason required" }), { status: 400 });
    }

    // 提案コンテキスト取得
    const { data: prop } = await supa
      .from("ms_progress_proposals")
      .select("id, member_id, project_id, milestone_id, ym, suggested_pct, suggested_text, status")
      .eq("id", proposalId)
      .maybeSingle();
    if (!prop) {
      return new Response(JSON.stringify({ error: "proposal not found" }), { status: 404 });
    }

    const context = `MS=${prop.milestone_id} 月=${prop.ym} 提案者=${prop.member_id}\n提案テキスト: ${prop.suggested_text ?? "(なし)"}\n提案進捗率: ${prop.suggested_pct ?? "(なし)"}`;
    const tsukuyomiText = await callAnthropic(rawReason, context);

    // proposal を rejected に更新
    const updPayload: any = {
      status: "rejected",
      reject_reason_raw: rawReason,
      reviewed_at: new Date().toISOString(),
    };
    if (adminId) updPayload.reviewed_by = adminId;
    const { error: updErr } = await supa
      .from("ms_progress_proposals")
      .update(updPayload)
      .eq("id", proposalId);
    if (updErr) {
      console.error("update proposal error", updErr);
    }

    // tsukuyomi メッセージ append
    const { error: msgErr } = await supa.from("ms_proposal_messages").insert({
      proposal_id: proposalId,
      sender_kind: "tsukuyomi",
      body: tsukuyomiText,
    });
    if (msgErr) {
      console.error("insert message error", msgErr);
    }

    return new Response(
      JSON.stringify({ ok: true, tsukuyomi_text: tsukuyomiText, llm_used: !!ANTHROPIC_API_KEY }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
