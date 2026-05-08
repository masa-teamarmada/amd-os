/**
 * POST /api/monthly-report/edit-by-tsukuyomi
 * body: { projectId, ym, instruction }
 *
 * 月次報告書を「つくよみへの修正指示」で書き換える。
 * - 現在の draft_content (or final_content) を取得
 * - Sonnet に「現本文 + 指示」を投げて改訂版を生成
 * - draft_content に上書き
 * - 改訂後本文を返す
 *
 * モデル: claude-sonnet-4-6 (本文修正は構造化 / 文体保持が必要)
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/supabase/api-auth";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  let body: { projectId?: string; ym?: string; instruction?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid JSON" }, { status: 400 });
  }
  const { projectId, ym, instruction } = body;
  if (!projectId || !ym || !instruction || !instruction.trim()) {
    return NextResponse.json(
      { ok: false, message: "projectId, ym, instruction required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );

  const { data: report, error: fetchErr } = await supabase
    .from("monthly_reports")
    .select("report_id, draft_content, final_content, status")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .single();
  if (fetchErr || !report) {
    return NextResponse.json({ ok: false, message: "Report not found" }, { status: 404 });
  }

  const currentBody = report.final_content || report.draft_content || "";
  if (!currentBody) {
    return NextResponse.json({ ok: false, message: "本文がまだありません" }, { status: 400 });
  }

  const systemPrompt = `あなたは AMD OS のアシスタント「つくよみ」。月次報告書の本文を、ユーザー (まさ) の指示に従って改訂する役目。

# 出力ルール
- Markdown 形式で本文全体を返す
- 既存の見出し構造 (## 活動概要 / ## 技術進捗 / ## ビジネス進捗 等) は基本的に保つ
- 指示で明示された箇所だけを変更し、それ以外の文章はそのまま残す
- 説明文や前置きは付けず、改訂後の本文のみを <revised_report> タグで囲んで返す`;

  const userPrompt = `# 現在の月次報告書
${currentBody}

# 修正指示 (まさより)
${instruction.trim()}

上記の指示に従って報告書を改訂し、本文全体を <revised_report>...</revised_report> で返してください。`;

  const anthropic = new Anthropic({ apiKey });
  let revised = "";
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const fullText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");
    const m = fullText.match(/<revised_report>([\s\S]*?)<\/revised_report>/);
    revised = (m ? m[1] : fullText).trim();
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  if (!revised) {
    return NextResponse.json({ ok: false, message: "改訂結果が空でした" }, { status: 500 });
  }

  const { error: updErr } = await supabase
    .from("monthly_reports")
    .update({ draft_content: revised })
    .eq("project_id", projectId)
    .eq("ym", ym);
  if (updErr) {
    return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, content: revised });
}
