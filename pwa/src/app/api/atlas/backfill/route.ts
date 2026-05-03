import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { attachStory } from "@/lib/atlas-stories-server";

export const maxDuration = 300;

interface SignalDraft {
  title: string;
  content: string;
  source_url: string;
  source_type?: "news" | "report" | "data" | "manual";
  importance?: "high" | "medium" | "low";
  submitted_at?: string; // YYYY-MM-DD (JST想定)
}

const DOMAIN_FULL: Record<string, string> = {
  A: "A.地政学・マクロ経済",
  B: "B.規制・政策",
  C: "C.素材・原料",
  D: "D.エネルギー",
  E: "E.製造・プロセス技術",
  F: "F.バイオ・医療",
  G: "G.モビリティ・ロボティクス",
  H: "H.建築・インフラ",
  I: "I.ICT・AI",
  J: "J.宇宙・防衛",
  K: "K.食・農・水産",
  L: "L.金融・資本市場",
  M: "M.社会構造・社会課題",
  N: "N.海洋・水資源",
  O: "O.サーキュラーエコノミー",
};

/**
 * ?domain=A&months=3 で分野ごとに過去Nヶ月の主要シグナルを web_search ベースで投入。
 * Bearer CRON_SECRET 認証。1分野5-8件目標。
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const dKey = (params.get("domain") || "").toUpperCase();
  const months = Math.max(1, Math.min(12, parseInt(params.get("months") || "3", 10)));
  const fullDomain = DOMAIN_FULL[dKey];
  if (!fullDomain) {
    return NextResponse.json({ error: "invalid domain (A-O)" }, { status: 400 });
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!supaUrl || !supaKey || !anthroKey) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(supaUrl, supaKey);
  const anthropic = new Anthropic({ apiKey: anthroKey });

  // 重複回避: 過去N+1ヶ月に投入された同分野のタイトル
  const since = new Date(Date.now() - (months + 1) * 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from("atlas_signals")
    .select("title,domain")
    .gte("submitted_at", since)
    .limit(400);
  const recentTitles = ((recent || []) as Array<{ title: string; domain: string | null }>)
    .filter((r) => !r.domain || r.domain.startsWith(dKey))
    .map((r) => r.title)
    .slice(0, 100);

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const prompt = `あなたは AMD Atlas のマクロトレンド収集エディタ。**${fullDomain}** の分野について、過去${months}ヶ月間（${today} JST から遡る）に発生した重要マクロシグナルを 5〜8 件 web_search で調べて、JSON で返してください。

ルール:
- web_search で実在する一次情報を必ず確認（ソースURL必須・FT/Reuters/Bloomberg/公式機関等を優先）
- 期間内の事象を新しい順で
- 各 signal:
  - title: 60字以内、特定企業名・PJ名を使わない一般化された見出し
  - content: 200-400字、何が起きたか / 一次データ / AMD（armada — 新規事業開発・インキュベーション）への示唆
  - source_url: 信頼できる一次情報源
  - importance: 即時の事業判断影響=high / 中期注視=medium / 参考=low
  - submitted_at: 実際にニュースが出た日付 "YYYY-MM-DD" (JST)
- 既知の同じ事象（下記リストと同じ題材）は出さないでください:
${recentTitles.length > 0 ? recentTitles.map((t) => `  - ${t}`).join("\n") : "  (なし)"}

最後に必ず JSON のみを <signals_json>...</signals_json> タグで囲んで返してください。
形式:
<signals_json>{"signals":[{"title":"...","content":"...","source_url":"https://...","importance":"high","submitted_at":"2026-03-12"}, ...]}</signals_json>`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6144,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const fullText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  let drafts: SignalDraft[] = [];
  const m = fullText.match(/<signals_json>([\s\S]*?)<\/signals_json>/);
  if (m) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed.signals)) drafts = parsed.signals as SignalDraft[];
    } catch {
      // fallthrough
    }
  }
  if (drafts.length === 0) {
    const fb = fullText.match(/\{[\s\S]*"signals"[\s\S]*\}/);
    if (fb) {
      try {
        const parsed = JSON.parse(fb[0]);
        if (Array.isArray(parsed.signals)) drafts = parsed.signals as SignalDraft[];
      } catch {
        // fallthrough
      }
    }
  }
  if (drafts.length === 0) {
    return NextResponse.json({
      ok: false,
      domain: fullDomain,
      inserted: 0,
      reason: "no_signals_parsed",
      preview: fullText.slice(0, 600),
    });
  }

  // タグ自動付与（Haiku）
  const autoTag = async (s: SignalDraft): Promise<string[]> => {
    const tagPrompt = `あなたはマクロトレンド分析のタグ付けエディタです。
以下のシグナルから、後で横串検索するためのタグを 6〜12 個提案してください。

タイトル: ${s.title}
内容: ${s.content}
分野: ${fullDomain}

タグ方針:
- 素材 / 技術 / 地域 / 産業 / 規制 / 市場 / 社会課題などの「一般名詞」
- 特定企業名や PJ 名は使わない
- 単語または 2-3 語の短いフレーズ

JSON のみ返答。例: {"tags": ["..."]}`;
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
    } catch {
      return [];
    }
  };

  const rows = [];
  for (const d of drafts) {
    if (!d.title || !d.content || !d.source_url) continue;
    const tags = await autoTag(d);
    let submittedIso: string;
    if (d.submitted_at && /^\d{4}-\d{2}-\d{2}/.test(d.submitted_at)) {
      submittedIso = new Date(d.submitted_at.slice(0, 10) + "T09:00:00+09:00").toISOString();
    } else {
      submittedIso = new Date().toISOString();
    }
    const storyId = await attachStory(
      { title: d.title, content: d.content, domain: fullDomain, tags },
      db,
      anthropic
    );
    rows.push({
      title: d.title,
      content: d.content,
      source_url: d.source_url,
      source_type: d.source_type || "news",
      domain: fullDomain,
      importance:
        d.importance === "high" || d.importance === "medium" || d.importance === "low"
          ? d.importance
          : "medium",
      suggested_tags: tags,
      status: "inbox",
      story_id: storyId,
      submitted_at: submittedIso,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, domain: fullDomain, inserted: 0, note: "no valid drafts" });
  }
  const { data, error } = await db.from("atlas_signals").insert(rows).select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, domain: fullDomain, inserted: data?.length || 0 });
}
