/**
 * vc-investment-ingest cron — Triple Helix 観測量 V (VC 投資) を vc_news / atlas_signals から quarter 単位で取得。
 *
 * 正本: pwa/design/aspi_lanes.md (Phase 2-E)、
 *       before-zero/theory/data_specification.md §V (VC 投資額)
 *
 * 仕様:
 * - 既存 vc_news + atlas_signals (source_type='news', 投資関連) を quarter ごとに集約
 * - Sonnet に「過去 quarter の主要 deeptech VC 投資 + 推定総額」を抽出させる (Crunchbase 代替)
 * - observation_log に upsert (key='V', source='vc_news')
 *
 * 注: Crunchbase / INITIAL の有償 API が使えない期間の代替実装。本格化したら vc-investment-ingest-crunchbase を別に作る。
 *
 * cron: weekly (毎週月曜 04:45 JST) or 手動キック。
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";
import { createClient } from "@supabase/supabase-js";
import { ASPI_DOMAIN_IDS, ASPI_DOMAIN_LABEL_JP, type AspiDomainId } from "@/lib/aspi-lanes";

export const maxDuration = 300;
export const runtime = "nodejs";

const QUARTERS_BACK = 16;

function quarterStartDate(year: number, q: 1 | 2 | 3 | 4): string {
  const month = (q - 1) * 3 + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function recentQuarters(n: number): { year: number; q: 1 | 2 | 3 | 4 }[] {
  const now = new Date();
  let year = now.getUTCFullYear();
  let q = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const out: { year: number; q: 1 | 2 | 3 | 4 }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ year, q });
    q = (q - 1) as 1 | 2 | 3 | 4;
    if (q < 1) {
      q = 4;
      year -= 1;
    }
  }
  return out.reverse();
}

interface SonnetVCRow {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  investment_oku: number;
  deal_count: number;
  notable_deals?: string[];
  reasoning?: string;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
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
    anthropic = getBackgroundAnthropic("cron/vc-investment-ingest");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  const quarters = recentQuarters(QUARTERS_BACK);

  // vc_news を直近 4 年取得して LLM プロンプト材料にする (件数のみ、context として渡す)
  const { data: vcNews } = await db
    .from("vc_news")
    .select("title, summary, raised_amount_jpy, funding_round, published_at, tags")
    .gte("published_at", `${quarters[0].year}-01-01`)
    .order("published_at", { ascending: false })
    .limit(200);

  const newsBriefs = (vcNews ?? []).slice(0, 100).map((n) => ({
    title: n.title,
    raised: n.raised_amount_jpy,
    round: n.funding_round,
    date: String(n.published_at).slice(0, 10),
    tags: n.tags,
  }));

  const rows: { lane: string; observed_at: string; observation_key: string; value: number; unit: string; source: string; raw_meta: Record<string, unknown> }[] = [];

  for (const domain of ASPI_DOMAIN_IDS) {
    const label = ASPI_DOMAIN_LABEL_JP[domain as AspiDomainId];

    const prompt = `あなたは日本の deeptech VC 投資動向に精通したアナリストです。
ASPI Critical Technology Tracker の ${domain} (${label}) 領域について、直近 ${QUARTERS_BACK} 四半期 (${quarters[0].year}-Q${quarters[0].q} 〜 ${quarters[quarters.length - 1].year}-Q${quarters[quarters.length - 1].q}) の、
日本企業 (またはグローバル展開でも本社が日本) への VC 投資 (シード〜シリーズ B 中心) の総額 (億円) を quarter 単位で推定してください。

参考データ (AMD OS が ingest した vc_news の直近 100 件、ただし複数 domain にまたがるので domain ごとに按分):
${JSON.stringify(newsBriefs.slice(0, 30))}

過去の代表的な deeptech VC trends (補助情報):
- 2020-2022: VC 投資ピーク (グローバル QE 政策の余波)
- 2023: 金利上昇 → deeptech VC やや冷え込み
- 2024: AI / 量子 / GX で再加速、一部 down round も
- 2025: 経済安保関連 (材料・防衛) で持続、ICT/AI 拡大

各 domain の年間規模 (日本国内):
- ai_technologies: 年 500-1500 億円 (2024+ で急増)
- biotechnology: 年 300-800 億円
- energy_environment: 年 300-800 億円 (Climate Tech 含む)
- advanced_materials_manufacturing: 年 200-500 億円
- defence_space_robotics_transport: 年 200-500 億円 (宇宙 SU 増加)
- advanced_ict: 年 200-500 億円
- quantum: 年 50-200 億円
- sensing_timing_navigation: 年 100-300 億円

出力 STRICT JSON 配列、preamble なし、code fence なし。配列長は ${QUARTERS_BACK} (古い順):
[
  {"year": 2022, "quarter": 1, "investment_oku": 80.0, "deal_count": 12, "notable_deals": ["A社シリーズB 30億"]},
  ...
]`;

    let parsed: SonnetVCRow[] | null = null;
    try {
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n")
        .trim();
      const m = text.match(/\[[\s\S]*\]/);
      if (m) parsed = JSON.parse(m[0]) as SonnetVCRow[];
    } catch (e) {
      console.error(`[vc-investment-ingest] ${domain}`, e);
      continue;
    }
    if (!parsed || !Array.isArray(parsed)) continue;

    for (const pt of parsed) {
      const obsAt = quarterStartDate(pt.year, pt.quarter);
      rows.push({
        lane: domain,
        observed_at: obsAt,
        observation_key: "V",
        value: Math.max(0, Number(pt.investment_oku) || 0),
        unit: "億円",
        source: "vc_news",
        raw_meta: {
          deal_count: Math.max(0, Number(pt.deal_count) || 0),
          notable_deals: pt.notable_deals ?? [],
          estimator: "anthropic:claude-sonnet-4-5-20250929",
          quarter: `${pt.year}-Q${pt.quarter}`,
        },
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: "no rows" });
  }

  const { error } = await db.from("observation_log").upsert(rows, {
    onConflict: "lane,observed_at,observation_key,source",
    ignoreDuplicates: false,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    inserted: rows.length,
    domains: ASPI_DOMAIN_IDS.length,
    quarters: QUARTERS_BACK,
  });
}
