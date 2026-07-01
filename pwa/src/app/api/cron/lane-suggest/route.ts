/**
 * lane-suggest cron — 新規 PJ (lanes が NULL or 未承認) の ASPI 8 domain weighted lanes を
 * LLM (Sonnet) で推定して lane_suggestions テーブルに candidate として保存する。
 *
 * 正本: pwa/design/aspi_lanes.md (Phase 2-B)。
 *
 * 入力: project_ventures.lanes IS NULL OR 直近 lane_suggestions が無い PJ。
 * 出力:
 *   - lane_suggestions (project_id, suggested_lanes JSONB, reasoning, model, confidence, status='pending')
 *   - l2_notifications (kind='lane_suggestion', saved_count=1) でまさに通知
 *
 * まさが /admin/projects の Lane 列で承認 → project_ventures.lanes に書き戻し + status='approved'。
 *
 * cron: weekly (毎週月曜 04:30 JST)、または手動キック。
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";
import { createClient } from "@supabase/supabase-js";
import {
  ASPI_DOMAIN_IDS,
  ASPI_DOMAIN_LABEL_JP,
  type AspiDomainId,
  type LaneWeight,
} from "@/lib/aspi-lanes";

export const maxDuration = 300;
export const runtime = "nodejs";

interface VentureForSuggest {
  project_id: string;
  display_name: string;
  short_description: string | null;
  long_description: string | null;
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  outcome_pattern: string | null;
  founded_at: string | null;
  lanes: LaneWeight[] | null;
}

interface SonnetResponse {
  lanes: LaneWeight[];
  reasoning: string;
  confidence: number;
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
    anthropic = getBackgroundAnthropic("cron/lane-suggest");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  // 候補抽出: lanes IS NULL (= seed されてない新規 PJ) または、既存 lanes があるが
  // 直近 30 日に pending suggestion がなく、最後の承認が 180 日以上前 (= 再評価したい) のもの
  const { data: ventures, error: vErr } = await db
    .from("project_ventures")
    .select("project_id, display_name, short_description, long_description, origin_org, origin_pi, amd_role, outcome_pattern, founded_at, lanes")
    .order("project_id");
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  const { data: existingSugg } = await db
    .from("lane_suggestions")
    .select("project_id, status, created_at")
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });

  const pendingByPj = new Map<string, boolean>();
  for (const s of (existingSugg ?? []) as { project_id: string; status: string }[]) {
    if (s.status === "pending") pendingByPj.set(s.project_id, true);
  }

  const candidates = (ventures ?? []).filter((v): v is VentureForSuggest => {
    const pv = v as VentureForSuggest;
    if (pv.lanes === null) return true; // 未設定
    return false; // 既に lanes ある PJ は今回スキップ (再評価は manual で)
  }).filter((v) => !pendingByPj.get(v.project_id));

  const domainListJp = ASPI_DOMAIN_IDS.map((d) => `  - ${d}: ${ASPI_DOMAIN_LABEL_JP[d]}`).join("\n");

  const created: { project_id: string; lanes: LaneWeight[]; confidence: number }[] = [];

  for (const v of candidates) {
    const prompt = `あなたは AMD (株式会社チームアルマダ、ディープテック特化スタジオ) の lane 推定 AI です。
新規 PJ の概要を読んで、ASPI Critical Technology Tracker の 8 domain のうちどれに該当するかを weighted で推定してください。

PJ 情報:
- ID: ${v.project_id}
- 名称: ${v.display_name}
- 短説明: ${v.short_description ?? "(なし)"}
- 長説明: ${v.long_description ?? "(なし)"}
- 出身組織: ${v.origin_org ?? "(なし)"}
- PI: ${v.origin_pi ?? "(なし)"}
- AMD 関与: ${v.amd_role ?? "(なし)"}

ASPI 8 domain (pwa/design/aspi_lanes.md):
${domainListJp}

ルール:
1. 1〜3 個の domain を選び、weight (0-1) を割り振る。合計 = 1.0。
2. 単一 domain で主軸ならその 1 つに weight=1.0。
3. 複数 domain にまたがるなら関連度に応じて分配 (例: 国産リチウム + 核融合 → advanced_materials_manufacturing 0.5 + energy_environment 0.5)。
4. 該当ナシ・判断できない場合は最も近そうな 1 つに weight=1.0 + confidence=0.3 程度。
5. JSON のみで返答。code fence 禁止。

出力形式 (STRICT JSON、preamble なし、code fence なし):
{
  "lanes": [{"domain": "energy_environment", "weight": 1.0}],
  "reasoning": "理由を 1-2 文で日本語で",
  "confidence": 0.85
}`;

    let parsed: SonnetResponse | null = null;
    try {
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n")
        .trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]) as SonnetResponse;
    } catch (e) {
      console.error(`[lane-suggest] ${v.project_id}`, e);
      continue;
    }
    if (!parsed || !Array.isArray(parsed.lanes) || parsed.lanes.length === 0) continue;

    // weight 正規化 (合計 1.0)
    const total = parsed.lanes.reduce((a, b) => a + (Number(b.weight) || 0), 0);
    const validDomains = new Set<string>(ASPI_DOMAIN_IDS);
    const normalized: LaneWeight[] = parsed.lanes
      .filter((lw) => validDomains.has(lw.domain))
      .map((lw) => ({
        domain: lw.domain as AspiDomainId,
        weight: Number(((Number(lw.weight) || 0) / (total || 1)).toFixed(3)),
      }))
      .slice(0, 3);

    if (normalized.length === 0) continue;
    // 端数を最初の domain で吸収
    const sumAfter = normalized.reduce((a, b) => a + b.weight, 0);
    if (Math.abs(sumAfter - 1) > 0.001) normalized[0].weight += 1 - sumAfter;

    const { error: insErr } = await db.from("lane_suggestions").insert({
      project_id: v.project_id,
      suggested_lanes: normalized,
      reasoning: parsed.reasoning ?? null,
      model: "anthropic:claude-sonnet-4-5-20250929",
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      status: "pending",
    });
    if (insErr) {
      console.error(`[lane-suggest] insert error ${v.project_id}`, insErr);
      continue;
    }
    created.push({ project_id: v.project_id, lanes: normalized, confidence: parsed.confidence });
  }

  // 通知作成 (1 つ以上推定したら)
  if (created.length > 0) {
    await db.from("l2_notifications").insert({
      kind: "lane_suggestion",
      title: `lane 推定 ${created.length} PJ`,
      body: created.map((c) => `${c.project_id}: ${c.lanes.map((l) => `${l.domain}=${l.weight}`).join(", ")}`).join("\n"),
      saved_count: created.length,
    });
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    created: created.length,
    details: created,
  });
}
