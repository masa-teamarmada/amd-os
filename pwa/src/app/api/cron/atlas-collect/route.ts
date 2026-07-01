import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";
import { createClient } from "@supabase/supabase-js";
import { attachStory } from "@/lib/atlas-stories-server";

// Anthropic web_search + Haiku auto-tag を直列で回すので長め
export const maxDuration = 300;

interface SignalDraft {
  title: string;
  content: string;
  source_url: string;
  source_type?: "news" | "report" | "data" | "manual";
  domain?: string;
  importance?: "high" | "medium" | "low";
}

/**
 * 毎朝 8:00 JST (23:00 UTC) に Anthropic の web_search で過去24-72時間の
 * マクロシグナルを Claude に集めさせ、auto-tag 付きで atlas_signals に投入する。
 * Bearer CRON_SECRET 認証。
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key || !anthroKey) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);
  let anthropic: Anthropic;
  try {
    anthropic = getBackgroundAnthropic("cron/atlas-collect");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  // 直近48hの投入タイトルを「重複回避リスト」として渡す
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from("atlas_signals")
    .select("title")
    .gte("submitted_at", since)
    .limit(200);
  const recentTitles = ((recent || []).map((r) => r.title) as string[]).slice(0, 80);

  const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const prompt = `あなたは AMD Atlas のマクロトレンド収集エディタ。直近24-72時間のニュースから、AMD（armada — 新規事業開発・インキュベーション・パートナー伴走）の事業判断（新規シーズ開拓 / 既存PJの前提揺らぎ）に関わる重要マクロシグナルを 8〜14 件選び、JSON で返してください。

今日: ${todayJst} (JST)

ドメイン (各 signal で必ず1つ):
A.地政学・マクロ経済 / B.規制・政策 / C.素材・原料 / D.エネルギー / E.製造・プロセス技術 / F.バイオ・医療 / G.モビリティ・ロボティクス / H.建築・インフラ / I.ICT・AI / J.宇宙・防衛 / K.食・農・水産 / L.金融・資本市場 / M.社会構造・社会課題 / N.海洋・水資源 / O.サーキュラーエコノミー / P.量子・量子計算 / Q.センシング・計測 / R.先端通信

過去48hに既に投入済みの題材（同じ事象は除外）:
${recentTitles.length > 0 ? recentTitles.map((t) => `- ${t}`).join("\n") : "(なし)"}

ルール:
- web_search で最新情報を必ず確認（ソースURL必須）
- 各 signal:
  - title: 60字以内、特定企業名・PJ名を使わない一般化された見出し
  - content: 200-400字、何が起きたか / 一次データ / AMDへの示唆
  - source_url: 信頼できる一次情報源（FT, Reuters, Bloomberg, 公式機関など優先）
  - domain: 上記から1つ
  - importance: 即時の事業判断影響=high / 中期注視=medium / 参考=low。high は1〜3件まで
- 分野が偏らないよう分散させる（同じドメイン3件超は避ける）
- 既知の同じ事象を再投入しない

最後に必ず JSON のみを <signals_json>...</signals_json> タグで囲んで返してください。形式:
<signals_json>{"signals":[{"title":"...","content":"...","source_url":"https://...","domain":"C.素材・原料","importance":"high"}, ...]}</signals_json>`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 8,
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const fullText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  const tagMatch = fullText.match(/<signals_json>([\s\S]*?)<\/signals_json>/);
  let drafts: SignalDraft[] = [];
  if (tagMatch) {
    try {
      const parsed = JSON.parse(tagMatch[1].trim());
      if (Array.isArray(parsed.signals)) drafts = parsed.signals as SignalDraft[];
    } catch {
      // fallthrough
    }
  }
  // tag が見つからない場合の保険として裸の JSON も拾う
  if (drafts.length === 0) {
    const fallback = fullText.match(/\{[\s\S]*"signals"[\s\S]*\}/);
    if (fallback) {
      try {
        const parsed = JSON.parse(fallback[0]);
        if (Array.isArray(parsed.signals)) drafts = parsed.signals as SignalDraft[];
      } catch {
        // fallthrough
      }
    }
  }

  if (drafts.length === 0) {
    console.warn("atlas-collect: no signals parsed", fullText.slice(0, 500));
    return NextResponse.json({
      ok: false,
      inserted: 0,
      reason: "no_signals_parsed",
      preview: fullText.slice(0, 500),
    });
  }

  // タグ自動付与（Haiku）
  const autoTag = async (s: SignalDraft): Promise<string[]> => {
    const tagPrompt = `あなたはマクロトレンド分析のタグ付けエディタです。
以下のシグナルから、後で横串検索するためのタグを 6〜12 個提案してください。

タイトル: ${s.title}
内容: ${s.content}
分野: ${s.domain || "—"}

タグ方針:
- 素材 / 技術 / 地域 / 産業 / 規制 / 市場 / 社会課題などの「一般名詞」
- 特定企業名や PJ 名は使わない
- 単語または 2-3 語の短いフレーズ
- 数年後に同じタグで検索しても意味のある粒度

JSON のみ返答。例: {"tags": ["リチウム", "中国", "輸出規制"]}`;
    try {
      const r = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 384,
        messages: [{ role: "user", content: tagPrompt }],
      });
      const block = r.content[0];
      const text = block?.type === "text" ? block.text : "";
      const j = text.match(/\{[\s\S]*\}/);
      if (!j) return [];
      const obj = JSON.parse(j[0]);
      return Array.isArray(obj.tags)
        ? obj.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 16)
        : [];
    } catch (e) {
      console.error("autotag err:", e);
      return [];
    }
  };

  const rows = [];
  for (const d of drafts) {
    if (!d.title || !d.content || !d.source_url) continue;
    const tags = await autoTag(d);
    const storyId = await attachStory(
      { title: d.title, content: d.content, domain: d.domain || null, tags },
      db,
      anthropic
    );
    rows.push({
      title: d.title,
      content: d.content,
      source_url: d.source_url,
      source_type: d.source_type || "news",
      domain: d.domain || null,
      importance:
        d.importance === "high" || d.importance === "medium" || d.importance === "low"
          ? d.importance
          : "medium",
      suggested_tags: tags,
      status: "inbox",
      story_id: storyId,
      submitted_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, note: "no valid drafts" });
  }

  const { data, error } = await db.from("atlas_signals").insert(rows).select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, inserted: data?.length || 0 });
}
