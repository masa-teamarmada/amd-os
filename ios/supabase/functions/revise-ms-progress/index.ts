// revise-ms-progress Edge Function
// 入力: { project_id, milestone_id, ym, request_text, requested_by, revision_id? }
// 動作:
//   1. 既存の milestone_monthly_progress (current_pct, current_note) を取得
//   2. PMの修正依頼テキスト + 既存note + MS定義を LLM に投げて 新pct + 新note を提案
//   3. ms_progress_revisions に upsert（status=pending）。同時にスレッドにメッセージ追加
//   4. revision_id 指定時は同じ revision を更新（再依頼時の追加メッセージ）

// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SYSTEM = `あなたはAMD OSのアシスタントAI「つくよみ」。MSの進捗推定が間違ってるとPMから修正依頼を受けたら、依頼内容と既存noteを踏まえて新しい累積進捗率（0〜100の数値）と新しい説明note（200〜800文字）を1つだけ提案する。提案はJSONで {"revised_pct": <number>, "revised_note": "<text>"} の形式のみ。前置きや解説はつけない。一人称は「つくよみ」。タメ語、メンバーに優しく寄り添う口調。`;

interface ParsedRevision {
  revised_pct: number | null;
  revised_note: string | null;
}

function parseLlm(raw: string): ParsedRevision {
  // JSON抽出
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { revised_pct: null, revised_note: raw.trim() || null };
  try {
    const obj = JSON.parse(jsonMatch[0]);
    return {
      revised_pct: typeof obj.revised_pct === "number" ? obj.revised_pct : null,
      revised_note: typeof obj.revised_note === "string" ? obj.revised_note : null,
    };
  } catch {
    return { revised_pct: null, revised_note: raw.trim() };
  }
}

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
        max_tokens: 2000,
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
    return typeof text === "string" ? text : null;
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
    const milestoneId: string = String(body.milestone_id || "").trim();
    const ym: string = String(body.ym || "").trim();
    const requestText: string = String(body.request_text || "").trim();
    const requestedBy: string = String(body.requested_by || "").trim();
    const existingRevisionId: string = String(body.revision_id || "").trim();

    if (!projectId || !milestoneId || !ym || !requestText) {
      return new Response(JSON.stringify({ error: "project_id, milestone_id, ym, request_text required" }), { status: 400 });
    }

    // 既存の進捗
    const { data: progRows } = await supa
      .from("milestone_monthly_progress")
      .select("progress_pct, note")
      .eq("milestone_key", milestoneId)
      .eq("ym", ym)
      .limit(1);
    const currentPct = progRows?.[0]?.progress_pct ?? 0;
    const currentNote = progRows?.[0]?.note ?? "";

    // MS タイトル
    const { data: msRows } = await supa
      .from("value_milestones")
      .select("title")
      .eq("milestone_id", milestoneId)
      .limit(1);
    const msTitle = msRows?.[0]?.title ?? milestoneId;

    // 過去のスレッド（revision_id 指定時のコンテキスト）
    let pastMessages = "";
    if (existingRevisionId) {
      const { data: msgs } = await supa
        .from("ms_revision_messages")
        .select("sender_kind, body, created_at")
        .eq("revision_id", existingRevisionId)
        .order("created_at", { ascending: true });
      if (msgs && msgs.length > 0) {
        pastMessages = msgs
          .map((m: any) => `${m.sender_kind === "pm" ? "PM" : "つくよみ"}: ${m.body}`)
          .join("\n");
      }
    }

    const prompt = `# MS情報
タイトル: ${msTitle}
対象月: ${ym}
現在の累積進捗: ${currentPct}%
現在のnote: ${currentNote || "(なし)"}

${pastMessages ? `# これまでのやりとり\n${pastMessages}\n` : ""}
# PMからの修正依頼
${requestText}

# 出力
JSON {"revised_pct": <0-100の数値>, "revised_note": "<新しい説明note>"} のみ。`;

    const llmRaw = await callAnthropic(prompt);
    let parsed: ParsedRevision = { revised_pct: null, revised_note: null };
    if (llmRaw) parsed = parseLlm(llmRaw);

    // fallback: pct がない場合は currentPct を使う
    const finalPct = parsed.revised_pct !== null ? parsed.revised_pct : Number(currentPct);
    const finalNote = parsed.revised_note ?? `（PMの修正依頼を受信。LLM応答なしのため自動推定スキップ）\n${requestText}`;

    let revisionId = existingRevisionId;

    if (revisionId) {
      // 既存 revision を更新
      await supa
        .from("ms_progress_revisions")
        .update({
          revised_pct: finalPct,
          revised_note: finalNote,
          status: "pending",
        })
        .eq("id", revisionId);
    } else {
      // 新規 revision を作成
      const { data: inserted } = await supa
        .from("ms_progress_revisions")
        .insert({
          project_id: projectId,
          milestone_id: milestoneId,
          ym,
          current_pct: currentPct,
          current_note: currentNote,
          revised_pct: finalPct,
          revised_note: finalNote,
          status: "pending",
          requested_by: requestedBy || null,
        })
        .select("id")
        .single();
      revisionId = (inserted as any)?.id ?? "";
    }

    // メッセージを追加（PM → つくよみ）
    if (revisionId) {
      await supa.from("ms_revision_messages").insert({
        revision_id: revisionId,
        sender_kind: "pm",
        body: requestText,
      });
      // つくよみ応答（提案内容を口語で要約）
      const tsukuyomiBody = parsed.revised_pct !== null
        ? `分かった、確認したよ🌙 進捗を ${finalPct}% で修正提案するね。\n\n${finalNote}\n\nこれでいい？OKならボタン押してね。違ったらまた教えて〜`
        : `ごめん、うまく推定できなかった…💦 PMの依頼内容で進捗率を確定するか、もう一度別の言い方で教えてくれる？`;
      await supa.from("ms_revision_messages").insert({
        revision_id: revisionId,
        sender_kind: "tsukuyomi",
        body: tsukuyomiBody,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        revision_id: revisionId,
        revised_pct: finalPct,
        revised_note: finalNote,
        llm_used: !!ANTHROPIC_API_KEY && !!llmRaw,
      }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
