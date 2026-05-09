/**
 * VC ニュース自動収集 cron。
 *
 * 毎朝 09:00 JST (00:00 UTC) に Anthropic の web_search で
 * 各 VC ごとに直近 7 日のニュースを 1 〜 5 件取得し、
 * vc_news に verified=false / ingested_by='web_search_cron' で投入する。
 *
 * - 1 日に処理する VC 数は MAX_VCS_PER_RUN (デフォルト 25)
 * - amd_rating 降順 + 直近未取得を優先 (NULLS LAST で last touch なし優先)
 * - 既に同 source_url が登録済みなら skip (UNIQUE constraint で防止)
 *
 * Atlas (世界マクロ) とは独立した系統。VC のファンドレイズは Atlas 的にはノイズ。
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const runtime = "nodejs";

const MAX_VCS_PER_RUN = 25;

interface NewsDraft {
  kind: "fundraise" | "investment" | "personnel" | "fund_close" | "thesis_change" | "press" | "other";
  title: string;
  summary?: string;
  occurred_on?: string;
  source_url: string;
  related_fund_no?: number | null;
  suggested_fund_patch?: Record<string, unknown> | null;
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

  // 取得対象: amd_rating 降順、updated_at 古い順 (= 直近未取得を優先)
  const { data: vcs } = await db
    .from("vcs")
    .select("id, name, name_en")
    .order("amd_rating", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: true })
    .limit(MAX_VCS_PER_RUN);

  if (!vcs || vcs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "no vcs" });
  }

  const stats = {
    vcs_processed: 0,
    news_inserted: 0,
    skipped_dupes: 0,
    errors: [] as string[],
  };

  for (const vc of vcs as { id: string; name: string; name_en: string | null }[]) {
    stats.vcs_processed++;

    try {
      // 既存ファンドを取得して、suggested_fund_patch のヒントに使える
      const { data: funds } = await db
        .from("vc_funds")
        .select("id, fund_no, status, size_jpy, vintage_year")
        .eq("vc_id", vc.id)
        .order("fund_no", { ascending: false });
      const fundsHint = (funds ?? [])
        .map((f) => `#${f.fund_no} ${f.status} size=${f.size_jpy ?? "?"} vintage=${f.vintage_year ?? "?"}`)
        .join(" / ");

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); // JST

      const prompt = `「${vc.name}」${vc.name_en ? `(${vc.name_en})` : ""} に関する直近 7 日 (${since} 〜 ${today} JST) のニュースを web_search で調べ、JSON で返してください。

# 既知のファンド情報 (これと整合する形で fundraise/fund_close を判定)
${fundsHint || "(まだ未登録)"}

# 出力形式 (必ず <vc_news_json>...</vc_news_json> で囲む)

{
  "news": [
    {
      "kind": "fundraise" | "investment" | "personnel" | "fund_close" | "thesis_change" | "press" | "other",
      "title": "60字以内の見出し",
      "summary": "200-300字の要約 (何が起きたか / 数字 / 背景)",
      "occurred_on": "YYYY-MM-DD",
      "source_url": "一次情報源 URL (公式リリース or 主要メディア)",
      "related_fund_no": 1 | 2 | null,
      "suggested_fund_patch": null | {
        "fund_no": 2,
        "status": "raising" | "first_closed" | "final_closed",
        "size_jpy": 8000000000,
        "target_close_at": "2026-05-31",
        "final_close_at": "2026-05-31",
        "source_url": "..."
      }
    }
  ]
}

# ルール
- 0〜5 件で OK。無ければ "news": []
- VC 自身に関するニュースのみ (出資先企業の話は VC 自身に関わる時のみ含める)
- fundraise / fund_close は最重要。検出したら必ず suggested_fund_patch を埋める (人が承認時に vc_funds に反映)
- source_url は必ず一次情報。X (Twitter) 投稿だけでは NG (公式リリース or 主要メディアを優先)
- 推測で書かない。確実な事実のみ
- JSON のみ、説明文なし`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
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

      const tagMatch = fullText.match(/<vc_news_json>([\s\S]*?)<\/vc_news_json>/);
      if (!tagMatch) continue;

      let parsed: { news?: NewsDraft[] } = {};
      try {
        parsed = JSON.parse(tagMatch[1].trim());
      } catch (e) {
        stats.errors.push(`${vc.name}: parse - ${(e as Error).message}`);
        continue;
      }

      const drafts = Array.isArray(parsed.news) ? parsed.news : [];

      for (const d of drafts) {
        if (!d.title || !d.kind) continue;

        // related_fund_id 解決
        let relatedFundId: string | null = null;
        if (typeof d.related_fund_no === "number") {
          const match = (funds ?? []).find((f) => f.fund_no === d.related_fund_no);
          if (match) relatedFundId = match.id;
        }

        // upsert (vc_id + source_url が unique なので onConflict)
        const payload = {
          vc_id: vc.id,
          kind: d.kind,
          title: d.title.slice(0, 200),
          body: d.summary ?? null,
          occurred_on: d.occurred_on ?? null,
          source_url: d.source_url ?? null,
          related_fund_id: relatedFundId,
          suggested_fund_patch: d.suggested_fund_patch ?? null,
          ingested_by: "web_search_cron",
          verified: false,
          dismissed: false,
        };

        let inserted = false;
        if (d.source_url) {
          // source_url ありなら upsert (既存 source_url なら skip)
          const { data: existDup } = await db
            .from("vc_news")
            .select("id")
            .eq("vc_id", vc.id)
            .eq("source_url", d.source_url)
            .maybeSingle();
          if (existDup) {
            stats.skipped_dupes++;
          } else {
            const { error } = await db.from("vc_news").insert(payload);
            if (error) stats.errors.push(`${vc.name}: insert - ${error.message}`);
            else {
              stats.news_inserted++;
              inserted = true;
            }
          }
        } else {
          // source_url 無しは title 重複チェックして insert
          const { data: dup } = await db
            .from("vc_news")
            .select("id")
            .eq("vc_id", vc.id)
            .eq("title", payload.title)
            .maybeSingle();
          if (dup) {
            stats.skipped_dupes++;
          } else {
            const { error } = await db.from("vc_news").insert(payload);
            if (error) stats.errors.push(`${vc.name}: insert(no url) - ${error.message}`);
            else {
              stats.news_inserted++;
              inserted = true;
            }
          }
        }

        // 新規挿入時のみ通知を作成
        if (inserted) {
          await db.from("app_notifications").insert({
            kind: "vc_news",
            title: `📰 ${vc.name}: ${payload.title}`.slice(0, 200),
            body: payload.body ?? payload.title,
            link: `/vcs/${vc.id}`,
            meta: {
              news_kind: payload.kind,
              source_url: payload.source_url,
              is_new_vc: false,
              vc_name: vc.name,
            },
            related_vc_id: vc.id,
            source: "cron_vc_news_ingest",
          });
        }
      }
    } catch (e) {
      stats.errors.push(`${vc.name}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, ...stats, errors: stats.errors.slice(0, 20) });
}
