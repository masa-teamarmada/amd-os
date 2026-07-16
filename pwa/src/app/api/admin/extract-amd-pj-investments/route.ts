/**
 * AMD PJ への過去出資を web 情報から抽出して vc_investments に追加する。
 *
 * 各 SU 系 PJ ごとに:
 *   - project_ventures + projects(news_search_query) を context に含める
 *   - Claude + web_search で「<PJ 名> が誰から出資受けたか」を JSON で取得
 *   - 既知の vcs (name 一致) と紐付けて vc_investments に upsert
 *   - 同時に project_events に funding イベントとして記録
 *
 * 使い方:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        https://amd-os-pwa.vercel.app/api/admin/extract-amd-pj-investments
 *
 * 既知 VC とマッチしない出資 (個人エンジェル等) は記録しない (vc_id がないため)。
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPrimaryProjectAlias } from "@/lib/project-labels";

export const maxDuration = 300;
export const runtime = "nodejs";

interface FoundInvestment {
  vc_name: string;            // VC 名 (vcs.name と一致させたい)
  amount_jpy?: number;
  round?: string;
  invested_at?: string;       // YYYY-MM-DD
  is_lead?: boolean;
  source_url?: string;
  note?: string;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!anthroKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const db = createAdminClient();
  const anthropic = new Anthropic({ apiKey: anthroKey });

  // 既知 VC を name → id でマップ
  const { data: vcs } = await db.from("vcs").select("id, name, name_en");
  const vcByName = new Map<string, { id: string; name: string }>();
  for (const v of (vcs ?? []) as { id: string; name: string; name_en: string | null }[]) {
    vcByName.set(v.name, { id: v.id, name: v.name });
    if (v.name_en) vcByName.set(v.name_en, { id: v.id, name: v.name });
  }

  // 全 SU 系 PJ
  const { data: pjs } = await db
    .from("project_ventures")
    .select("project_id, short_label, narrative_text, founded_at, origin_org, projects(project_name, client_name, news_search_query)");
  const projects = (pjs ?? []) as {
    project_id: string;
    short_label: string | null;
    narrative_text: string | null;
    founded_at: string | null;
    origin_org: string | null;
    projects:
      | { project_name: string | null; client_name: string | null; news_search_query: string | null }
      | { project_name: string | null; client_name: string | null; news_search_query: string | null }[]
      | null;
  }[];
  const normalizedProjects = projects.map((pj) => {
    const project = Array.isArray(pj.projects) ? pj.projects[0] : pj.projects;
    const projectName = project?.project_name?.trim() || pj.project_id;
    const projectAlias = getPrimaryProjectAlias({
      project_name: project?.project_name,
      client_name: project?.client_name,
      news_search_query: project?.news_search_query,
    });
    return {
      ...pj,
      project_name: projectName,
      project_alias: projectAlias,
      target_company: projectAlias ?? projectName,
    };
  });

  const stats = {
    pjs_processed: 0,
    investments_inserted: 0,
    investments_skipped_no_vc_match: 0,
    project_events_inserted: 0,
    unmatched_vcs: [] as string[],
    errors: [] as string[],
  };

  for (const pj of normalizedProjects) {
    stats.pjs_processed++;
    const pjLabel = `${pj.project_name}${pj.project_alias && pj.project_alias !== pj.project_name ? ` (${pj.project_alias})` : ""}`;

    try {
      // 沿革から既知の funding イベントを抜粋して LLM 重複防止に使う
      let knownFundingHints = "";
      try {
        const narr = pj.narrative_text ? JSON.parse(pj.narrative_text) : [];
        if (Array.isArray(narr)) {
          const fundings = narr
            .filter((n: { title?: string }) => /出資|資金調達|シード|シリーズ|round/i.test(n.title ?? ""))
            .map((n: { date?: string; title?: string }) => `${n.date ?? "?"}: ${n.title ?? ""}`)
            .slice(0, 5);
          if (fundings.length > 0) knownFundingHints = fundings.join("\n");
        }
      } catch {
        // narrative_text not JSON, ignore
      }

      const knownVcs = (vcs ?? [])
        .map((v) => (v as { name: string }).name)
        .slice(0, 30)
        .join(" / ");

      const prompt = `AMD のディープテック PJ「${pj.project_name}」${pj.project_alias && pj.project_alias !== pj.project_name ? `（外部別名: ${pj.project_alias}）` : ""} の VC 出資履歴を web_search で調べ、JSON で返してください。

設立: ${pj.founded_at ?? "?"}
出自: ${pj.origin_org ?? "?"}

# 既知の沿革ヒント (重複しないように)
${knownFundingHints || "(なし)"}

# 既知 VC リスト (この名前と一致するように vc_name を返す)
${knownVcs}

# 出力 (必ず <pj_inv_json>...</pj_inv_json> で囲む)

{
  "investments": [
    {
      "vc_name": "Beyond Next Ventures",
      "amount_jpy": 100000000,
      "round": "seed",
      "invested_at": "2024-03-01",
      "is_lead": true,
      "source_url": "https://...",
      "note": "Series A first close. AMD スタジオ伴走"
    }
  ]
}

# ルール
- 出資元の vc_name は上記既知 VC リストの名前と完全一致させる (個人エンジェル / 一致しない VC は除外)
- amount_jpy は円整数 (1億 = 100000000)、未公表なら省略
- source_url は一次情報 (公式リリース / 主要メディア) を必ず付ける、推測のみは禁止
- 確実な事実のみ。「らしい」「推測」は出さない
- 0 件なら "investments": []
- 説明文なし、JSON のみ`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 6,
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });

      const fullText = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n");

      const tagMatch = fullText.match(/<pj_inv_json>([\s\S]*?)<\/pj_inv_json>/);
      if (!tagMatch) continue;

      let parsed: { investments?: FoundInvestment[] } = {};
      try {
        parsed = JSON.parse(tagMatch[1].trim());
      } catch (e) {
        stats.errors.push(`${pjLabel}: parse - ${(e as Error).message}`);
        continue;
      }

      const found = Array.isArray(parsed.investments) ? parsed.investments : [];

      for (const inv of found) {
        if (!inv.vc_name) continue;
        const vc = vcByName.get(inv.vc_name);
        if (!vc) {
          stats.investments_skipped_no_vc_match++;
          if (!stats.unmatched_vcs.includes(inv.vc_name)) stats.unmatched_vcs.push(inv.vc_name);
          continue;
        }

        // 重複チェック (vc_id + our_project_id + invested_at で fuzzy)
        const { data: existing } = await db
          .from("vc_investments")
          .select("id")
          .eq("vc_id", vc.id)
          .eq("our_project_id", pj.project_id);
        const dup = (existing ?? []).find(() => true);
        if (dup) continue;

        const { error: invErr } = await db.from("vc_investments").insert({
          vc_id: vc.id,
          our_project_id: pj.project_id,
          target_company: pj.target_company,
          amount_jpy: inv.amount_jpy ?? null,
          round: inv.round ?? null,
          invested_at: inv.invested_at ?? null,
          is_lead: !!inv.is_lead,
          source_url: inv.source_url ?? null,
          notes: inv.note ?? null,
        });
        if (invErr) {
          stats.errors.push(`${pjLabel}/${inv.vc_name}: ${invErr.message}`);
          continue;
        }
        stats.investments_inserted++;

        // project_events にも記録
        if (inv.invested_at) {
          const labelPart = inv.is_lead ? "リード " : "";
          const amountPart = inv.amount_jpy ? `${(inv.amount_jpy / 1e8).toFixed(1)} 億円 ` : "";
          const { error: evErr } = await db.from("project_events").insert({
            project_id: pj.project_id,
            occurred_on: inv.invested_at,
            kind: "funding",
            label: `${vc.name} ${labelPart}${amountPart}${inv.round ?? ""}`.trim(),
            meta: {
              amount_yen: inv.amount_jpy ?? null,
              lead: inv.is_lead ? vc.name : null,
              vc_name: vc.name,
              round: inv.round ?? null,
              source_url: inv.source_url ?? null,
              note: inv.note ?? null,
            },
            source: "llm_proposal",
          });
          if (evErr) {
            stats.errors.push(`${pjLabel}/event: ${evErr.message}`);
          } else {
            stats.project_events_inserted++;
          }
        }
      }

      // narrative 再生成予約
      await db
        .from("project_ventures")
        .update({ narrative_invalidated_at: new Date().toISOString() })
        .eq("project_id", pj.project_id);
    } catch (e) {
      stats.errors.push(`${pjLabel}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, ...stats });
}
