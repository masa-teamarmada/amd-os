/**
 * VC List 初期データ投入。
 *
 * Claude Sonnet + web_search に「国内ディープテック VC を一括生成」させて
 * vcs / vc_funds / vc_investments を upsert する。
 *
 * 使い方:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        https://amd-os-pwa.vercel.app/api/admin/seed-vcs
 *
 * 既存データは name (VC) / vc_id+fund_no (Fund) / source_url (Investment) で
 * upsert/重複回避する。再実行可。
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;
export const runtime = "nodejs";

interface SeedVc {
  name: string;
  name_en?: string | null;
  type?: "independent" | "cvc" | "gov" | "corporate" | "overseas";
  thesis?: string;
  stage_focus?: string[];
  ticket_min_jpy?: number;
  ticket_max_jpy?: number;
  hq?: string;
  website?: string;
  notes?: string;
  funds?: SeedFund[];
  investments?: SeedInvestment[];
}

interface SeedFund {
  fund_no: number;
  name?: string;
  fund_name?: string;             // alias (LLM がときどき間違える)
  size_jpy?: number;
  size_jpy_low?: number;
  size_jpy_high?: number;
  vintage_year?: number;
  status?: "raising" | "first_closed" | "final_closed" | "investing" | "harvesting" | "closed" | "unknown";
  first_close_at?: string;
  final_close_at?: string;
  target_close_at?: string;
  source_url?: string;
}

interface SeedInvestment {
  target_company: string;
  amount_jpy?: number;
  round?: string;
  invested_at?: string;
  is_lead?: boolean;
  source_url?: string;
}

const PROMPT = `あなたは AMD (株式会社チームアルマダ) のディープテック / 科学技術系スタジオ向け、VC リサーチ担当。
日本国内のディープテック・サイエンス系 VC を網羅的に列挙し、最新情報込みで JSON で返してください。

# 対象範囲 (国内 only)
- 独立系 VC でディープテック / サイエンス系投資が中核 (Abies / UTokyo IPC / Beyond Next / Real Tech / SOSV / ANRI / ジャフコ /
  みらい創造 / DEEPCORE / Coral / WiL / Globis / 大学発 VC / 政府系 (DBJ, INCJ 後継, JIC, SBI 系) / GAP ファンド系 / CVC でディープテックを意図的に張ってる組織)
- 海外 VC は除外 (今回スコープ外)
- ディープテック以外の SaaS / consumer 専業 VC は除外

# 必ず web_search で最新情報を確認
- 各 VC の最新ファンド (X 号目, サイズ, status, クローズ予定/実績日, source URL)
- 過去〜直近の代表的 portfolio (各 VC につき最大 8 社)
- 投資ステージ (pre_seed / seed / series_a / ...)
- チケットサイズの目安 (公表されてる範囲で)

# 出力フォーマット (必ず JSON のみ、<vcs_json>...</vcs_json> で囲む)

{
  "vcs": [
    {
      "name": "Abies Ventures",
      "name_en": "Abies Ventures",
      "type": "independent",
      "thesis": "ディープテック / フロンティアテック 国内最初期投資",
      "stage_focus": ["pre_seed", "seed", "series_a"],
      "ticket_min_jpy": 30000000,
      "ticket_max_jpy": 500000000,
      "hq": "東京",
      "website": "https://abiesventures.com",
      "notes": "...",
      "funds": [
        {
          "fund_no": 1,
          "size_jpy": 5500000000,
          "vintage_year": 2020,
          "status": "investing",
          "final_close_at": "2020-12-01",
          "source_url": "https://..."
        },
        {
          "fund_no": 2,
          "size_jpy": 8000000000,
          "size_jpy_low": 8000000000,
          "size_jpy_high": 10000000000,
          "vintage_year": 2025,
          "status": "raising",
          "target_close_at": "2026-05-31",
          "source_url": "https://..."
        }
      ],
      "investments": [
        { "target_company": "ティエムファクトリ", "round": "seed", "is_lead": true, "source_url": "https://..." },
        { "target_company": "Pale Blue", "round": "series_a", "source_url": "https://..." }
      ]
    }
  ]
}

# ルール (出力長制限あり、コンパクトに)
- 18-22 社程度 (出力 16K トークン以内)
- size_jpy は 円 整数 (80億 = 8000000000)
- ファンドのキーは "name" (NOT "fund_name")
- investments は各 VC につき 2-3 社まで (代表的なものだけ)
- 推測しか出来ないフィールドは省略 (null OK)
- source_url は一次情報優先 (公式 > メディア)
- thesis は 60 字以内、notes は 80 字以内に圧縮
- 返答は説明文なし、JSON のみ <vcs_json>...</vcs_json>`;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!anthroKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey: anthroKey });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 15,
      },
    ],
    messages: [{ role: "user", content: PROMPT }],
  });

  const fullText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  // 通常パス: <vcs_json>...</vcs_json> で囲まれてる
  const tagMatch = fullText.match(/<vcs_json>([\s\S]*?)<\/vcs_json>/);
  let parsed: { vcs?: SeedVc[] } = {};
  let salvaged = false;

  if (tagMatch) {
    try {
      parsed = JSON.parse(tagMatch[1].trim());
    } catch (e) {
      return NextResponse.json({ error: `JSON parse failed: ${(e as Error).message}`, raw: tagMatch[1].slice(0, 2000) }, { status: 500 });
    }
  } else {
    // Salvage: max_tokens で出力が切れて closing tag がない場合
    // <vcs_json>{"vcs":[ ... 途中 ... ]} の形を組み立てて部分パース
    const openIdx = fullText.indexOf("<vcs_json>");
    if (openIdx === -1) {
      return NextResponse.json({ error: "no vcs_json block in response", raw: fullText.slice(0, 2000) }, { status: 500 });
    }
    const partial = fullText.slice(openIdx + "<vcs_json>".length);
    // 最後の完全な VC オブジェクトの末尾を見つけて切り詰める
    const arrayStart = partial.indexOf('[');
    if (arrayStart === -1) {
      return NextResponse.json({ error: "no array start", raw: partial.slice(0, 2000) }, { status: 500 });
    }
    let depth = 0;
    let inString = false;
    let escape = false;
    let lastObjectEnd = -1;
    for (let i = arrayStart + 1; i < partial.length; i++) {
      const c = partial[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) lastObjectEnd = i;
      }
    }
    if (lastObjectEnd === -1) {
      return NextResponse.json({ error: "no complete vc object", raw: partial.slice(0, 2000) }, { status: 500 });
    }
    const reconstructed = `{"vcs":[${partial.slice(arrayStart + 1, lastObjectEnd + 1)}]}`;
    try {
      parsed = JSON.parse(reconstructed);
      salvaged = true;
    } catch (e) {
      return NextResponse.json({ error: `salvage parse failed: ${(e as Error).message}`, raw: reconstructed.slice(0, 2000) }, { status: 500 });
    }
  }

  const vcs = Array.isArray(parsed.vcs) ? parsed.vcs : [];
  if (vcs.length === 0) {
    return NextResponse.json({ error: "no vcs returned", raw: fullText.slice(0, 2000) }, { status: 500 });
  }

  const db = createAdminClient();
  const stats = { vcs_inserted: 0, vcs_updated: 0, funds: 0, investments: 0, errors: [] as string[] };

  for (const v of vcs) {
    if (!v.name) continue;
    const slug = (v.name_en || v.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || null;

    // 既存チェック
    const { data: existing } = await db.from("vcs").select("id").eq("name", v.name).maybeSingle();
    let vcId = (existing as { id: string } | null)?.id;

    if (!vcId) {
      const { data: inserted, error: insErr } = await db
        .from("vcs")
        .insert({
          name: v.name,
          name_en: v.name_en ?? null,
          slug,
          type: v.type ?? null,
          thesis: v.thesis ?? null,
          stage_focus: v.stage_focus ?? null,
          ticket_min_jpy: v.ticket_min_jpy ?? null,
          ticket_max_jpy: v.ticket_max_jpy ?? null,
          hq: v.hq ?? null,
          website: v.website ?? null,
          notes: v.notes ?? null,
        })
        .select("id")
        .single();
      if (insErr) {
        stats.errors.push(`vc insert ${v.name}: ${insErr.message}`);
        continue;
      }
      vcId = (inserted as { id: string }).id;
      stats.vcs_inserted++;
    } else {
      // 既存は基本フィールドのみ補完更新 (amd_rating など人が付けた値は触らない)
      await db
        .from("vcs")
        .update({
          name_en: v.name_en ?? null,
          slug: slug,
          type: v.type ?? null,
          thesis: v.thesis ?? null,
          stage_focus: v.stage_focus ?? null,
          ticket_min_jpy: v.ticket_min_jpy ?? null,
          ticket_max_jpy: v.ticket_max_jpy ?? null,
          hq: v.hq ?? null,
          website: v.website ?? null,
          notes: v.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vcId);
      stats.vcs_updated++;
    }

    if (Array.isArray(v.funds)) {
      for (const f of v.funds) {
        if (typeof f.fund_no !== "number") continue;
        const { error: fundErr } = await db.from("vc_funds").upsert(
          {
            vc_id: vcId,
            fund_no: f.fund_no,
            name: f.name ?? f.fund_name ?? null,
            size_jpy: f.size_jpy ?? null,
            size_jpy_low: f.size_jpy_low ?? null,
            size_jpy_high: f.size_jpy_high ?? null,
            vintage_year: f.vintage_year ?? null,
            status: f.status ?? "unknown",
            first_close_at: f.first_close_at ?? null,
            final_close_at: f.final_close_at ?? null,
            target_close_at: f.target_close_at ?? null,
            source_url: f.source_url ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "vc_id,fund_no" }
        );
        if (fundErr) stats.errors.push(`fund ${v.name}#${f.fund_no}: ${fundErr.message}`);
        else stats.funds++;
      }
    }

    if (Array.isArray(v.investments)) {
      for (const inv of v.investments) {
        if (!inv.target_company) continue;
        // 重複避け (vc_id + target_company + invested_at)
        const { data: existInv } = await db
          .from("vc_investments")
          .select("id")
          .eq("vc_id", vcId)
          .eq("target_company", inv.target_company)
          .maybeSingle();
        if (existInv) continue;
        const { error: invErr } = await db.from("vc_investments").insert({
          vc_id: vcId,
          target_company: inv.target_company,
          amount_jpy: inv.amount_jpy ?? null,
          round: inv.round ?? null,
          invested_at: inv.invested_at ?? null,
          is_lead: !!inv.is_lead,
          source_url: inv.source_url ?? null,
        });
        if (invErr) stats.errors.push(`inv ${v.name}/${inv.target_company}: ${invErr.message}`);
        else stats.investments++;
      }
    }
  }

  return NextResponse.json({ ok: true, salvaged, total_vcs_in_response: vcs.length, ...stats });
}
