/**
 * AMD Score L2 抽出 cron — 週 1 回 (毎週月曜 03:00 JST = 日曜 18:00 UTC)
 *
 * 6 ソース (Slack/Drive/Notion/Gmail/Calendar/WebSearch) から生データを集めて、
 * 全 SU 系 PJ の AMD Score timeline を Sonnet 4.5 で再抽出 → amd_score_inputs に upsert。
 *
 * 認証: Authorization: Bearer ${CRON_SECRET}
 *
 * Vercel Hobby plan の maxDuration=300s 上限あり。9 PJ 順次処理で約 9×30s ≈ 270s 想定。
 * もし時間超過するなら、PJ chunk 化 (例: 3 PJ ずつ別 cron) に分割を検討。
 */

import { NextResponse } from "next/server";
import { extractAmdScoreForAllPjs } from "@/lib/amd-score-l2-extract";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const results = await extractAmdScoreForAllPjs();
  const finishedAt = new Date().toISOString();

  const totalUpserted = results.reduce((s, r) => s + r.upserted, 0);
  const errors = results.filter((r) => r.errors.length > 0);

  console.log(`[cron/amd-score-l2-refresh] ${startedAt} → ${finishedAt}: ${results.length} PJs, ${totalUpserted} upserted, ${errors.length} errors`);

  return NextResponse.json({
    ok: true,
    started_at: startedAt,
    finished_at: finishedAt,
    pj_count: results.length,
    total_upserted: totalUpserted,
    error_count: errors.length,
    results: results.map((r) => ({
      project_id: r.project_id,
      upserted: r.upserted,
      summary: r.summary.slice(0, 200),
      uncertainty: r.uncertainty.slice(0, 200),
      errors: r.errors,
    })),
  });
}
