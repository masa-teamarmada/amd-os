/**
 * 事業概要に追記をマージ (つくよみ persona、Claude Sonnet)。
 *
 * POST { addition: string }
 * → { long_description: string, short_description: string }
 *
 * 動作:
 *   1. 既存 long_description / short_description を読む
 *   2. Claude Sonnet が既存に追記を統合 (重複除去、矛盾は新情報優先)
 *   3. project_ventures を更新 (long_description / short_description / narrative_invalidated_at)
 *   4. クライアントに更新後を返す
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `あなたは「つくよみ」、AMD (株式会社チームアルマダ) のディープテックスタジオの専属マスコット LLM。
20 代女子っぽい、明るくキレのある書き手。書くときの声はドライでまっすぐ。
PJ の事業概要を、まさからの追記でマージするのがあなたの仕事。

ルール:
- 既存の long_description (詳細概要) に、追記内容を破綻なく統合する
- 重複情報は除き、矛盾があれば追記内容 (新情報) を優先
- 文体は事業説明として自然に。専門用語は残し、敬語にしない
- 単位ルール: SU を「社」「ventures」と書かない。「PJ」と書く
- short_description (1〜2 行サマリ) も必要なら更新。変更不要なら既存のまま返す

# Web 検索について
- まさが「ネットで調べて」「最新情報を入れて」「調査して」と書いていたら、必ず web_search ツールを使って実際に検索すること
- 推測・捏造は禁止。検索結果から得た事実だけを書く
- 検索した出典 URL は long_description の末尾に "出典:" として箇条書きで残してよい

# 出力フォーマット
\`\`\`json\`\`\` で囲んだ JSON オブジェクトのみ:
  { "long_description": "<更新後>", "short_description": "<更新後 or 既存>" }`;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  let body: { addition?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.addition || typeof body.addition !== "string" || !body.addition.trim()) {
    return NextResponse.json({ error: "addition required" }, { status: 400 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data: venture, error: vErr } = await supabase
    .from("project_ventures")
    .select("display_name, short_description, long_description")
    .eq("project_id", projectId)
    .maybeSingle();
  if (vErr || !venture) {
    return NextResponse.json({ error: "venture not found" }, { status: 404 });
  }

  const userPrompt = `PJ: ${venture.display_name}

既存 short_description (1 行):
${venture.short_description || "(未設定)"}

既存 long_description (詳細):
${venture.long_description || "(未設定)"}

追記したい内容:
${body.addition}

JSON で返してください。`;

  let parsed: { long_description: string; short_description: string };
  try {
    const client = new Anthropic({ apiKey });
    const r = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      // Anthropic 公式 web_search tool。まさが「ネットで調べて」と言ったら自動で検索する
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] as unknown as Anthropic.Messages.Tool[],
    });
    const text = r.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (!m) return NextResponse.json({ error: "no JSON in response" }, { status: 500 });
    parsed = JSON.parse(m[1]);
  } catch (e) {
    console.error("[description-merge]", e);
    return NextResponse.json({ error: "llm error" }, { status: 500 });
  }

  await supabase
    .from("project_ventures")
    .update({
      long_description: parsed.long_description,
      short_description: parsed.short_description,
      narrative_invalidated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);

  return NextResponse.json({
    long_description: parsed.long_description,
    short_description: parsed.short_description,
  });
}
