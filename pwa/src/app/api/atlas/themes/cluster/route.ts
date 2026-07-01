import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const maxDuration = 300;

/**
 * 既存ストーリーを LLM でクラスタリングして「テーマ」候補を抽出する。
 * DBには保存せず JSON 提案だけ返す。/atlas/admin/themes 側で確認・編集してから apply する流れ。
 *
 * 出力: { themes: [{name, description, primary_domain, tag_keywords, story_ids}] }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);
  let anthropic: Anthropic;
  try {
    anthropic = getBackgroundAnthropic("atlas/themes-cluster");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  // 既存ストーリーを取得
  const { data: stories, error } = await db
    .from("atlas_stories")
    .select("id, title, summary, primary_domain, tags, signal_count")
    .eq("status", "ongoing")
    .order("signal_count", { ascending: false })
    .limit(300);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!stories || stories.length === 0) {
    return NextResponse.json({ ok: true, themes: [], note: "no stories" });
  }

  const lines = stories
    .map(
      (s, i) =>
        `[${i}] id=${s.id}\n  title: ${s.title}\n  summary: ${s.summary || ""}\n  tags: ${(s.tags || []).join(", ")}\n  domain: ${s.primary_domain || ""}\n  signals: ${s.signal_count || 0}`
    )
    .join("\n\n");

  // body から既存テーマも受け取り、同名重複を避けるヒントとして渡す
  let existingHint = "(なし)";
  try {
    const { data: existing } = await db
      .from("atlas_themes")
      .select("name, description")
      .eq("status", "active")
      .limit(50);
    if (existing && existing.length > 0) {
      existingHint = existing
        .map((e) => `- ${e.name}: ${e.description || ""}`)
        .join("\n");
    }
  } catch {
    // ignore
  }

  const prompt = `あなたは AMD Atlas のテーマ整理エディタ。
既存のストーリー群を「世界×日本ズレマップ」で扱う**テーマ単位**にクラスタリングしてください。

テーマとは:
- ストーリーよりも粗い分類軸（例: 「水素」「リチウム」「AI規制」「半導体」「洋上風力」「米中対立」「再生医療」「サーキュラー経済」）
- AMD（armada — 新規事業開発・伴走支援）が「世界はどう動いてる？日本はどう動いてる？差分は？」と問いを立てたい単位
- 30-50個程度を目安に粒度を調整
- 1つのストーリーは複数テーマに属しても良い（多対多）

ルール:
- name: 一般名詞や短いフレーズ（「水素」「半導体製造装置」「AI安全規制」のように、横串で何年も使える名前）
- description: 100字以内で「このテーマで何を見たいか」
- primary_domain: A.地政学・マクロ経済 / B.規制・政策 / C.素材・原料 / D.エネルギー / E.製造・プロセス技術 / F.バイオ・医療 / G.モビリティ・ロボティクス / H.建築・インフラ / I.ICT・AI / J.宇宙・防衛 / K.食・農・水産 / L.金融・資本市場 / M.社会構造・社会課題 / N.海洋・水資源 / O.サーキュラーエコノミー / P.量子・量子計算 / Q.センシング・計測 / R.先端通信 のいずれか
- tag_keywords: そのテーマに該当しそうなタグの候補を 5-12個（実シグナルで使われている語彙に近づける）
- story_indices: そのテーマに含まれるストーリーの [番号] のリスト

== 既存テーマ（重複させない・必要なら統合の提案を出してOK） ==
${existingHint}

== ストーリー一覧 (${stories.length}件) ==
${lines}

JSON のみで返答（前置き不要、\`\`\`json で囲む）:
\`\`\`json
{
  "themes": [
    {
      "name": "水素",
      "description": "...",
      "primary_domain": "D.エネルギー",
      "tag_keywords": ["水素", "燃料電池", "グリーン水素", "水電解"],
      "story_indices": [0, 3, 7]
    },
    ...
  ]
}
\`\`\`

注意:
- 30-50個の範囲で、各テーマに最低でもストーリーが1個は含まれるようにする
- どのテーマにも属さないストーリーが多少あってもOK（その場合は story_indices に含めない）
- AMD の事業判断で意味のある単位で切ること。あまりに広すぎる（例: 「経済」）も狭すぎる（例: 「2026年4月の半導体プレス」）も避ける`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16384,
    messages: [{ role: "user", content: prompt }],
  });

  const fullText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  const tagMatch =
    fullText.match(/```json\s*([\s\S]*?)```/) ||
    fullText.match(/\{[\s\S]*"themes"[\s\S]*\}/);
  if (!tagMatch) {
    return NextResponse.json({
      ok: false,
      error: "no JSON in LLM response",
      preview: fullText.slice(0, 500),
    });
  }

  /**
   * LLM が JSON の文字列リテラル内に生の改行/タブ/制御文字を入れることがある（厳密には不正だが頻発）。
   * JSON.parse は U+0000-U+001F の生コードを文字列内で許さないので、ここで sanitize する。
   * 改行・タブは空白に、その他制御文字は除去。文字列外（フォーマット用）の改行は影響しない。
   */
  const sanitizeJsonControlChars = (raw: string): string => {
    let inString = false;
    let escaped = false;
    let out = "";
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      const code = raw.charCodeAt(i);
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\" && inString) {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        out += ch;
        continue;
      }
      if (inString && code < 0x20) {
        // 文字列内の生制御文字: 改行/タブは空白に、それ以外は除去
        if (ch === "\n" || ch === "\r" || ch === "\t") out += " ";
        continue;
      }
      out += ch;
    }
    return out;
  };

  const rawJson = tagMatch[1] || tagMatch[0];
  const cleanedJson = sanitizeJsonControlChars(rawJson);

  let parsed: {
    themes?: Array<{
      name?: string;
      description?: string;
      primary_domain?: string;
      tag_keywords?: unknown;
      story_indices?: unknown;
    }>;
  };
  try {
    parsed = JSON.parse(cleanedJson);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: "JSON parse failed: " + String(e),
      preview: cleanedJson.slice(0, 500),
    });
  }

  if (!Array.isArray(parsed.themes)) {
    return NextResponse.json({
      ok: false,
      error: "themes is not array",
    });
  }

  // story_indices を story_ids に変換、入力検証
  const themes = parsed.themes
    .map((t) => {
      const indices = Array.isArray(t.story_indices)
        ? (t.story_indices as unknown[])
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 0 && n < stories.length)
        : [];
      const storyIds = indices.map((i) => stories[i].id as string);
      const tags = Array.isArray(t.tag_keywords)
        ? (t.tag_keywords as unknown[]).map((x) => String(x).trim()).filter(Boolean)
        : [];
      return {
        name: String(t.name || "").trim(),
        description: String(t.description || "").trim(),
        primary_domain: String(t.primary_domain || "").trim(),
        tag_keywords: tags,
        story_ids: storyIds,
      };
    })
    .filter((t) => t.name);

  return NextResponse.json({
    ok: true,
    themes,
    total_stories: stories.length,
  });
}
