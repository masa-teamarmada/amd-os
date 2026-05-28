import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/supabase/api-auth";

/**
 * シグナルの title / content / domain から、横串検索用のタグを LLM が自動生成する。
 * Atlas は階層分類せずタグで検索する運用なので、ここがコア。
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.errorResponse;

    const body = await req.json();
    const { title, content, domain } = body || {};

    if (!title || !content) {
      return NextResponse.json(
        { error: "title and content are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not set" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const prompt = `あなたはマクロトレンド分析のタグ付けエディタです。
以下のシグナルから、後で横串検索するためのタグを 6〜12 個提案してください。

タイトル: ${title}
内容: ${content}
分野: ${domain || "—"}

タグの方針:
- 素材名 / 技術名 / 地域名 / 産業名 / 規制名 / 市場名 / 社会課題などの「一般名詞」
- 特定企業名や PJ 名は使わない（一般化された呼称に置き換える）
- 単語または 2-3 語の短いフレーズ
- 日本語と英語どちらでも可。一般的な英略語（EV、NIMBY、CCUS など）は英語のまま
- 数年後に同じタグで検索しても意味のある粒度で
- 重要度が high のものほど多めにタグ付け

JSON のみを返してください。例:
{"tags": ["リチウム", "中国", "輸出規制", "EVバッテリー", "サプライチェーン", "資源安全保障"], "importance": "high"}

importance は内容から推定: high (即時の事業判断に影響) / medium (中期的に注視) / low (参考).`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 384,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "";

    // JSON 部だけ抜き出す（コードフェンスや前置きがあっても拾えるように）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ tags: [], importance: null, raw: text }, { status: 200 });
    }

    let parsed: { tags?: string[]; importance?: string };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ tags: [], importance: null, raw: text }, { status: 200 });
    }

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 16)
      : [];
    const importance =
      parsed.importance === "high" || parsed.importance === "medium" || parsed.importance === "low"
        ? parsed.importance
        : null;

    return NextResponse.json({ tags, importance });
  } catch (e) {
    console.error("auto-tag error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
