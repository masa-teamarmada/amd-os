/**
 * Seeds 自動収集 cron。
 *
 * 毎週 月曜 09:00 JST (日曜 00:00 UTC) に Anthropic の web_search で
 * 主要な公的シーズ採択 (GAPファンド各PF / NEDO NEP / AMED preF / JST D-Global /
 * CREST / 創発 / 先導研究 等) の直近採択を発見し、
 * `seeds` に discovery_status='discovered' で投入する。
 *
 * - 既存 seeds との重複は (researcher_name + title) の部分一致でチェック
 * - cron が拾った seeds は /seeds/inbox に並び、人が verify (採用) / dismiss (却下) する
 * - GlobalNav に未確認件数バッジ (sky 色) で表示
 *
 * Atlas / VC とは独立した系統。出資ニュースではなく、研究シーズの一次情報を拾う。
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const runtime = "nodejs";

interface SeedDraft {
  title: string;
  summary?: string;
  org_name: string;
  org_type?: "university" | "national_lab" | "kosen" | "private_lab" | "other";
  org_region?: string;
  researcher_name?: string;
  researcher_title?: string;
  lab_name?: string;
  domain_lane?: "gx_energy" | "gx_circular" | "life" | "materials" | "robo" | "ict" | "other";
  industry_target?: string[];
  keywords?: string[];
  trl?: number;
  brl?: number;
  hrl?: number;
  source_url?: string;
  source_detail?: string;
  funding_program?: string;
  funding_program_short?: string;
  funding_amount_jpy?: number | null;
  funding_year?: number;
}

// 拾うソース定義 (Claude が web_search で巡回するキーワード一覧)
const INGEST_SOURCES = [
  { name: "JST GAPファンド (各PF)", query: "JST GAPファンド 採択 大学発 シーズ ステップ 直近 採択者" },
  { name: "NEDO NEP 躍進コース", query: "NEDO NEP 躍進コース 採択 大学発 ディープテック" },
  { name: "NEDO 先導研究", query: "NEDO 先導研究プログラム 採択 大学" },
  { name: "AMED 橋渡し研究", query: "AMED 橋渡し研究プログラム 採択 preF シーズ 大学" },
  { name: "JST D-Global", query: "JST D-Global 大学発新産業創出基金 採択 ディープテック" },
  { name: "JST CREST / さきがけ", query: "JST CREST さきがけ 採択 戦略目標 直近" },
  { name: "JST 創発的研究支援事業", query: "JST 創発的研究支援事業 採択 直近" },
];

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
    anthropic = getBackgroundAnthropic("cron/seeds-ingest");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  // 既存 seeds の (researcher_name, title) を取得して重複チェックに使う
  const { data: existing } = await db
    .from("seeds")
    .select("title, researcher_name");
  const existingKeys = new Set<string>();
  for (const s of (existing ?? []) as { title: string; researcher_name: string | null }[]) {
    existingKeys.add(`${s.researcher_name ?? ""}::${s.title}`);
    if (s.researcher_name) existingKeys.add(s.researcher_name);
  }

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const stats = {
    sources_processed: 0,
    seeds_inserted: 0,
    skipped_dupes: 0,
    errors: [] as string[],
  };

  for (const source of INGEST_SOURCES) {
    stats.sources_processed++;
    try {
      const prompt = `「${source.name}」について、直近 14 日 (${since} 〜 ${today} JST) に新たに採択された大学・研究機関発の研究シーズを web_search で調べ、JSON で返してください。

# 探すもの
- 起業前段階 (Before 0) の研究シーズ
- 採択先が大学 / 国研 / 高専 / 民間研究所
- 既に法人化済みの大型シリーズ調達 (DTSU 等) は対象外

# 出力形式 (必ず <seeds_json>...</seeds_json> で囲む)

{
  "seeds": [
    {
      "title": "シーズ名 (技術 × 応用先) 60字以内",
      "summary": "1-3 文の概要 (200字以内)",
      "org_name": "機関名 (例: 愛媛大学, NIMS, 産業技術総合研究所)",
      "org_type": "university" | "national_lab" | "kosen" | "private_lab" | "other",
      "org_region": "都道府県 or 地域",
      "researcher_name": "代表者氏名 (姓 名 形式)",
      "researcher_title": "教授 / 准教授 / 助教 等",
      "lab_name": "研究室名 or 研究科",
      "domain_lane": "gx_energy" | "gx_circular" | "life" | "materials" | "robo" | "ict" | "other",
      "industry_target": ["応用先業界", ...],
      "keywords": ["キーワード", ...],
      "trl": 1-9 or null,
      "brl": 1-9 or null,
      "hrl": 1-9 or null,
      "source_url": "一次情報源 URL (公式採択リスト or 大学プレス)",
      "source_detail": "発見経路の具体 (例: 'Tongali GAP ステップ2 2024 採択 (公式)')",
      "funding_program": "採択プログラム正式名",
      "funding_program_short": "短縮名 (例: 'Tongali GAP S2', 'NEP 躍進3000')",
      "funding_amount_jpy": 数値 or null,
      "funding_year": 2024 or 2025
    }
  ]
}

# ルール
- 0〜10 件で OK。確実な採択情報がなければ "seeds": []
- 各シーズは researcher_name + title で重複しないこと
- source_url は必ず一次情報 (公式採択リスト or 大学プレスリリース)。X/Twitter の単独投稿は NG
- 推測や不確実な情報は含めない (確実な公式採択のみ)
- JSON のみ、説明文なし`;

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

      const tagMatch = fullText.match(/<seeds_json>([\s\S]*?)<\/seeds_json>/);
      if (!tagMatch) continue;

      let parsed: { seeds?: SeedDraft[] } = {};
      try {
        parsed = JSON.parse(tagMatch[1].trim());
      } catch (e) {
        stats.errors.push(`${source.name}: parse - ${(e as Error).message}`);
        continue;
      }

      const drafts = Array.isArray(parsed.seeds) ? parsed.seeds : [];

      for (const d of drafts) {
        if (!d.title || !d.org_name) continue;

        // 重複チェック: researcher_name + title 完全一致 or researcher_name 単独で同名研究者既登録
        const key1 = `${d.researcher_name ?? ""}::${d.title}`;
        if (existingKeys.has(key1)) {
          stats.skipped_dupes++;
          continue;
        }

        // 投入
        const seedPayload = {
          title: d.title.slice(0, 200),
          summary: d.summary ?? null,
          org_name: d.org_name,
          org_type: d.org_type ?? null,
          org_region: d.org_region ?? null,
          researcher_name: d.researcher_name ?? null,
          researcher_title: d.researcher_title ?? null,
          lab_name: d.lab_name ?? null,
          domain_lane: d.domain_lane ?? null,
          industry_target: d.industry_target ?? null,
          keywords: d.keywords ?? null,
          trl: d.trl ?? null,
          brl: d.brl ?? null,
          hrl: d.hrl ?? null,
          status: "candidate" as const,
          source: "web_search" as const,
          source_detail: d.source_detail ?? source.name,
          discovery_status: "discovered" as const,
        };

        const { data: inserted, error: insErr } = await db
          .from("seeds")
          .insert(seedPayload)
          .select("id")
          .single();

        if (insErr) {
          stats.errors.push(`${source.name} / ${d.title}: ${insErr.message}`);
          continue;
        }
        stats.seeds_inserted++;
        existingKeys.add(key1);

        const seedId = (inserted as { id: string }).id;

        // funding 情報があれば seed_funding にも投入
        if (d.funding_program && d.funding_program_short) {
          await db.from("seed_funding").insert({
            seed_id: seedId,
            program: d.funding_program,
            program_short: d.funding_program_short,
            amount_jpy: d.funding_amount_jpy ?? null,
            fiscal_year: d.funding_year ?? null,
            status: "awarded",
            source_url: d.source_url ?? null,
          });
        }

        // ニュースに採択情報を記録
        if (d.source_url) {
          await db.from("seed_news").upsert(
            {
              seed_id: seedId,
              kind: "grant",
              title: `${d.funding_program_short ?? source.name} 採択 — ${d.title}`,
              body: d.summary ?? null,
              occurred_on: today,
              source_url: d.source_url,
              ingested_by: "web_search_cron",
              verified: false,
              dismissed: false,
            },
            { onConflict: "seed_id,source_url", ignoreDuplicates: true }
          );
        }
      }
    } catch (e) {
      stats.errors.push(`${source.name}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, ...stats, errors: stats.errors.slice(0, 20) });
}
