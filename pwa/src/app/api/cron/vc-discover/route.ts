/**
 * 新 VC / VC 業界ニュース 発見 cron。
 *
 * 毎朝 03:00 JST (18:00 UTC) に Anthropic web_search で:
 *   - 国内ディープテック VC 業界の直近 7 日のニュース全般を取得
 *   - 各ニュースで言及される VC を識別
 *   - DB にあれば → vc_news (verified=false) に追加
 *   - DB になければ → vcs に新規 stub 追加 + vc_news 追加
 *   - いずれの場合も app_notifications に通知 push
 *
 * 既存 vc-news-ingest (09:00 JST、各 VC 個別ピンポイント) と相補。
 * こちらは「ニュース起点で VC を見つける」。
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const runtime = "nodejs";

interface DiscoveredItem {
  vc_name: string;            // 言及されている VC 名 (日本語 or 英語)
  vc_name_en?: string;
  vc_type?: "independent" | "cvc" | "government" | "university_affiliated" | "corporate" | "overseas";
  vc_thesis_hint?: string;    // 新規 VC のときの thesis (短く)
  vc_hq?: string;
  vc_website?: string;
  news_kind: "fundraise" | "investment" | "personnel" | "fund_close" | "thesis_change" | "press" | "other";
  news_title: string;
  news_summary?: string;
  news_occurred_on?: string;
  news_source_url: string;
}

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
  const anthropic = new Anthropic({ apiKey: anthroKey });

  // 既知 VC リストを名前で渡す (重複検知用)
  const { data: existing } = await db.from("vcs").select("id, name, name_en, slug");
  const existingVcs = (existing ?? []) as { id: string; name: string; name_en: string | null; slug: string | null }[];
  const knownNames = existingVcs.map((v) => v.name);
  const knownEnNames = existingVcs.map((v) => v.name_en).filter((n): n is string => !!n);

  // 直近 7 日の重複避け用に source_url リスト
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNews } = await db
    .from("vc_news")
    .select("source_url")
    .gte("created_at", since)
    .not("source_url", "is", null);
  const recentUrls = ((recentNews ?? []) as { source_url: string | null }[])
    .map((r) => r.source_url)
    .filter((u): u is string => !!u);

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const prompt = `あなたは AMD (株式会社チームアルマダ — ディープテック / サイエンス系スタジオ) の VC リサーチャー。
直近 7 日 (${sinceDate} 〜 ${today} JST) の国内 VC 業界ニュースを web_search で総ざらいし、
AMD が知っておくべき VC 関連ニュースを 8〜15 件抽出してください。

# AMD が知っておきたいニュース
- 国内ディープテック VC のファンド組成 / クローズ
- VC の出資ニュース (特にディープテック / サイエンス / 大学発)
- VC の人事 (GP / Partner レベル)
- VC のテーゼ変化 / 新方針発表
- 新規 VC 設立
- 海外 VC が日本進出する場合

# 既に知っている VC (${existingVcs.length} 社、name と一致するなら DB マッチ可能)
${knownNames.slice(0, 80).join(" / ")}
${knownEnNames.length > 0 ? `\n英名: ${knownEnNames.slice(0, 50).join(" / ")}` : ""}

# 直近 14 日に既に登録した news source_url (重複回避、これらは出力に含めない)
${recentUrls.slice(0, 50).join("\n") || "(なし)"}

# 出力フォーマット (必ず <discover_json>...</discover_json> で囲む)

{
  "items": [
    {
      "vc_name": "Abies Ventures",
      "vc_name_en": "Abies Ventures",
      "vc_type": "independent",
      "vc_thesis_hint": "ディープテック / フロンティア特化 (新規 VC 時のみ必須)",
      "vc_hq": "東京",
      "vc_website": "https://abiesventures.com",
      "news_kind": "fundraise",
      "news_title": "Abies Ventures が 2 号ファンドを 80 億で...",
      "news_summary": "200-300 字の要約",
      "news_occurred_on": "2026-05-08",
      "news_source_url": "https://..."
    }
  ]
}

# ルール
- 8-15 件 (出力長制限あり、コンパクトに)
- 国内 VC のみ (海外 VC が日本進出するニュースは含む)
- vc_name は既知 VC リストの名前と完全一致を心がける (新規ならそのまま新名で OK)
- vc_type / vc_thesis_hint / vc_hq / vc_website は新規 VC のときだけ埋める (既知ならスキップしてもよい)
- news_source_url は必ず一次情報 (公式リリース / Reuters / 日経 等)。X (Twitter) のみは NG
- 推測は禁止、確実な事実のみ
- 同じ事象の重複は 1 件にまとめる
- JSON のみ、説明文なし`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 12000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10 }],
    messages: [{ role: "user", content: prompt }],
  });

  const fullText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  const tagMatch = fullText.match(/<discover_json>([\s\S]*?)<\/discover_json>/);
  if (!tagMatch) {
    return NextResponse.json({ error: "no discover_json", raw: fullText.slice(0, 2000) }, { status: 500 });
  }

  let parsed: { items?: DiscoveredItem[] } = {};
  try {
    parsed = JSON.parse(tagMatch[1].trim());
  } catch (e) {
    return NextResponse.json({ error: `parse - ${(e as Error).message}`, raw: tagMatch[1].slice(0, 2000) }, { status: 500 });
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  const stats = {
    discovered: items.length,
    new_vcs_created: 0,
    news_inserted: 0,
    notifications_created: 0,
    skipped_dup_url: 0,
    errors: [] as string[],
  };

  for (const it of items) {
    if (!it.vc_name || !it.news_title || !it.news_source_url) continue;

    // 既知 VC か?
    let vcId: string | null = null;
    let isNewVc = false;
    const matched = existingVcs.find(
      (v) =>
        v.name === it.vc_name ||
        v.name_en === it.vc_name ||
        (it.vc_name_en && (v.name === it.vc_name_en || v.name_en === it.vc_name_en))
    );
    if (matched) {
      vcId = matched.id;
    } else {
      // 新規 VC 作成 (stub)
      const slug = (it.vc_name_en || it.vc_name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || null;
      const { data: inserted, error: insErr } = await db
        .from("vcs")
        .insert({
          name: it.vc_name,
          name_en: it.vc_name_en ?? null,
          slug,
          type: it.vc_type ?? null,
          thesis: it.vc_thesis_hint ?? null,
          hq: it.vc_hq ?? null,
          website: it.vc_website ?? null,
          notes: `[${today} cron_vc_discover で自動追加] 初回検出元: ${it.news_source_url}`,
        })
        .select("id")
        .single();
      if (insErr) {
        stats.errors.push(`vc create ${it.vc_name}: ${insErr.message}`);
        continue;
      }
      vcId = (inserted as { id: string }).id;
      isNewVc = true;
      stats.new_vcs_created++;
      // existingVcs に追加して同 batch 内重複も防ぐ
      existingVcs.push({ id: vcId, name: it.vc_name, name_en: it.vc_name_en ?? null, slug });
    }

    // vc_news 追加 (重複 source_url は upsert で skip)
    const { data: newsRow, error: newsErr } = await db
      .from("vc_news")
      .upsert(
        {
          vc_id: vcId,
          kind: it.news_kind,
          title: it.news_title.slice(0, 200),
          body: it.news_summary ?? null,
          occurred_on: it.news_occurred_on ?? null,
          source_url: it.news_source_url,
          ingested_by: "web_search_cron",
          verified: false,
          dismissed: false,
        },
        { onConflict: "vc_id,source_url", ignoreDuplicates: false }
      )
      .select("id")
      .maybeSingle();
    if (newsErr) {
      stats.errors.push(`news ${it.vc_name}: ${newsErr.message}`);
      continue;
    }
    if (!newsRow) {
      stats.skipped_dup_url++;
      continue;
    }
    stats.news_inserted++;

    // app_notifications 追加
    const notifTitle = isNewVc
      ? `🆕 新 VC 発見: ${it.vc_name}`
      : `📰 ${it.vc_name}: ${it.news_title}`.slice(0, 200);
    const notifBody = it.news_summary ?? it.news_title;
    const { error: notifErr } = await db.from("app_notifications").insert({
      kind: isNewVc ? "vc_new" : "vc_news",
      title: notifTitle,
      body: notifBody,
      link: `/vcs/${vcId}`,
      meta: {
        news_kind: it.news_kind,
        source_url: it.news_source_url,
        is_new_vc: isNewVc,
        vc_name: it.vc_name,
      },
      related_vc_id: vcId,
      source: "cron_vc_discover",
    });
    if (notifErr) stats.errors.push(`notif ${it.vc_name}: ${notifErr.message}`);
    else stats.notifications_created++;
  }

  return NextResponse.json({ ok: true, ...stats, errors: stats.errors.slice(0, 20) });
}
