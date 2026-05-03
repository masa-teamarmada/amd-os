/**
 * GET /api/cron/atlas-weekly
 * Vercel Cron: 毎週金曜 08:00 UTC (JST 17:00) に週次レポートを生成。
 * vercel.json: "0 8 * * 5"
 */

import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport } from "@/lib/atlas-report";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await generateWeeklyReport();
    return NextResponse.json({
      ok: true,
      reportId: result.id,
      signalCount: result.signalCount,
    });
  } catch (e) {
    console.error("atlas-weekly cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
