/**
 * GET /api/cron/atlas-daily
 * Vercel Cron: 毎日 21:00 UTC (JST 06:00) に前日のシグナルをまとめたデイリーレポートを生成。
 * vercel.json: "0 21 * * *"
 */

import { NextRequest, NextResponse } from "next/server";
import { generateDailyReport } from "@/lib/atlas-report";

export async function GET(req: NextRequest) {
  // Vercel Cron 認証 (CRON_SECRET が設定されている場合のみチェック)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await generateDailyReport();
    return NextResponse.json({
      ok: true,
      reportId: result.id,
      signalCount: result.signalCount,
    });
  } catch (e) {
    console.error("atlas-daily cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
