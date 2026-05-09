/**
 * 既存 VC の情報精度を上げる。
 *
 * Claude + web_search で各 VC を再スキャンし:
 *   - thesis (より具体的に)
 *   - notes (最新動向)
 *   - vc_funds (新規 / 更新)
 *   - vc_investments (主要 portco 5-10 社)
 * を upsert。amd_rating / amd_rating_note は人が付けた値なので触らない。
 *
 * batch_size と offset を query で指定可能 (時間制約のため):
 *   POST /api/admin/enrich-vcs?offset=0&limit=10
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;
export const runtime = "nodejs";

interface EnrichResult {
  thesis?: string;
  type?: string;
  hq?: string;
  website?: string;
  stage_focus?: string[];
  ticket_min_jpy?: number;
  ticket_max_jpy?: number;
  notes_addendum?: string;          // notes 末尾に追記する文 (上書きしない)
  funds?: Array<{
    fund_no: number;
    name?: string;
    size_jpy?: number;
    size_jpy_low?: number;
    size_jpy_high?: number;
    vintage_year?: number;
    status?: string;
    first_close_at?: string;
    final_close_at?: string;
    target_close_at?: string;
    source_url?: string;
  }>;
  investments?: Array<{
    target_company: string;
    target_company_en?: string;
    amount_jpy?: number;
    round?: string;
    invested_at?: string;
    is_lead?: boolean;
    source_url?: string;
  }>;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "10"), 12);

  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!anthroKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  const db = createAdminClient();
  const anthropic = new Anthropic({ apiKey: anthroKey });

  // 既知 VC を amd_rating 高い順、updated_at 古い順 で
  const { data: vcs } = await db
    .from("vcs")
    .select("id, name, name_en, type, thesis, notes, hq, website")
    .order("amd_rating", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (!vcs || vcs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "no vcs in range" });
  }

  const stats = {
    vcs_processed: 0,
    vcs_updated: 0,
    funds_upserted: 0,
    investments_inserted: 0,
    errors: [] as string[],
  };

  for (const v of vcs as Array<{ id: string; name: string; name_en: string | null; type: string | null; thesis: string | null; notes: string | null; hq: string | null; website: string | null }>) {
    stats.vcs_processed++;
    try {
      const prompt = `「${v.name}」${v.name_en ? `(${v.name_en})` : ""} (国内 VC) の最新情報を web_search で調べ、JSON で返してください。

# 既存登録情報 (上書き判断用)
type: ${v.type ?? "?"}
thesis: ${v.thesis ?? "?"}
hq: ${v.hq ?? "?"}
website: ${v.website ?? "?"}
notes: ${v.notes?.slice(0, 200) ?? "?"}

# 出力フォーマット (必ず <vc_enrich_json>...</vc_enrich_json> で囲む)

{
  "thesis": "60-150 字の投資テーゼ (現状より具体的に)",
  "type": "independent|cvc|government|university_affiliated|corporate|overseas",
  "hq": "東京 等",
  "website": "https://...",
  "stage_focus": ["seed","series_a"],
  "ticket_min_jpy": 30000000,
  "ticket_max_jpy": 500000000,
  "notes_addendum": "最近の動向 (50-150 字)",
  "funds": [
    {
      "fund_no": 1, "name": "正式名", "size_jpy": 5000000000,
      "vintage_year": 2020, "status": "investing",
      "final_close_at": "2020-12-01", "source_url": "https://..."
    }
  ],
  "investments": [
    { "target_company": "...", "round": "series_a", "is_lead": true, "source_url": "https://..." }
  ]
}

# ルール
- web_search で最新情報を確認
- 推測のみのフィールドは省略
- size_jpy は円整数 (50億 = 5000000000)
- funds は最大 5、investments は最大 8
- 既存値と同じなら省略 OK (差分のみ返してもよい)
- source_url は一次情報必須
- 日本語でフィールドの値を埋める (英語 OK のものは英語)
- JSON のみ、説明文なし`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: prompt }],
      });

      const fullText = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n");

      const tagMatch = fullText.match(/<vc_enrich_json>([\s\S]*?)<\/vc_enrich_json>/);
      if (!tagMatch) continue;

      let parsed: EnrichResult = {};
      try {
        parsed = JSON.parse(tagMatch[1].trim());
      } catch (e) {
        stats.errors.push(`${v.name}: parse - ${(e as Error).message}`);
        continue;
      }

      // VC 本体 update
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (parsed.thesis && parsed.thesis !== v.thesis) updates.thesis = parsed.thesis;
      if (parsed.type) updates.type = parsed.type;
      if (parsed.hq && !v.hq) updates.hq = parsed.hq;
      if (parsed.website && !v.website) updates.website = parsed.website;
      if (parsed.stage_focus && parsed.stage_focus.length > 0) updates.stage_focus = parsed.stage_focus;
      if (parsed.ticket_min_jpy) updates.ticket_min_jpy = parsed.ticket_min_jpy;
      if (parsed.ticket_max_jpy) updates.ticket_max_jpy = parsed.ticket_max_jpy;
      if (parsed.notes_addendum) {
        const newNotes = (v.notes ?? "") +
          (v.notes ? "\n" : "") +
          `[${new Date().toISOString().slice(0, 10)} enrich] ${parsed.notes_addendum}`;
        updates.notes = newNotes.slice(0, 4000);
      }
      if (Object.keys(updates).length > 1) {
        const { error } = await db.from("vcs").update(updates).eq("id", v.id);
        if (error) stats.errors.push(`${v.name}: vcs update - ${error.message}`);
        else stats.vcs_updated++;
      }

      // funds upsert
      if (Array.isArray(parsed.funds)) {
        for (const f of parsed.funds) {
          if (typeof f.fund_no !== "number") continue;
          const { error } = await db.from("vc_funds").upsert(
            {
              vc_id: v.id,
              fund_no: f.fund_no,
              name: f.name ?? null,
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
            { onConflict: "vc_id,fund_no", ignoreDuplicates: false }
          );
          if (error) stats.errors.push(`${v.name} fund#${f.fund_no}: ${error.message}`);
          else stats.funds_upserted++;
        }
      }

      // investments insert (重複避けて)
      if (Array.isArray(parsed.investments)) {
        for (const inv of parsed.investments) {
          if (!inv.target_company) continue;
          const { data: dup } = await db
            .from("vc_investments")
            .select("id")
            .eq("vc_id", v.id)
            .eq("target_company", inv.target_company)
            .maybeSingle();
          if (dup) continue;
          const { error } = await db.from("vc_investments").insert({
            vc_id: v.id,
            target_company: inv.target_company,
            target_company_en: inv.target_company_en ?? null,
            amount_jpy: inv.amount_jpy ?? null,
            round: inv.round ?? null,
            invested_at: inv.invested_at ?? null,
            is_lead: !!inv.is_lead,
            source_url: inv.source_url ?? null,
          });
          if (error) stats.errors.push(`${v.name} inv ${inv.target_company}: ${error.message}`);
          else stats.investments_inserted++;
        }
      }
    } catch (e) {
      stats.errors.push(`${v.name}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, range: { offset, limit }, ...stats, errors: stats.errors.slice(0, 20) });
}
