/**
 * GET /api/cron/atlas-monthly
 * Vercel Cron: 毎月1日 22:00 UTC (JST 07:00) に月次レポートを生成。
 * vercel.json: "0 22 1 * *"
 */

import { NextRequest, NextResponse } from "next/server";
import { generateMonthlyReport } from "@/lib/atlas-report";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await generateMonthlyReport();
    return NextResponse.json({
      ok: true,
      reportId: result.id,
      signalCount: result.signalCount,
    });
  } catch (e) {
    console.error("atlas-monthly cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
