/**
 * GET /api/cron/daily-estimate
 * Vercel Cron: 毎日 03:00 JST (18:00 UTC) に全アクティブPJの進捗推定を実行。
 * vercel.json の crons[].schedule: "0 18 * * *"
 *
 * 認証: Authorization: Bearer CRON_SECRET (Vercel が自動で付与)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { estimateProgress } from "@/lib/progress-estimator";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder"
  );
}

/** 現在の ym を日本時間で返す（例: "202504"） */
function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

export async function GET(req: NextRequest) {
  // Vercel Cron 認証
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const ym = currentYmJST();

  // アクティブプロジェクト取得
  const supabase = getServiceClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("project_id")
    .eq("status", "active");

  if (error) {
    console.error("[cron/daily-estimate] failed to fetch projects:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const projectIds = (projects ?? []).map((p: { project_id: string }) => p.project_id);
  if (projectIds.length === 0) {
    return NextResponse.json({ ok: true, ym, ran: 0, message: "no active projects" });
  }

  // 各PJに対して推定を実行（直列実行でAPI/LLMレート超過を防ぐ）
  const results: Array<{ projectId: string; ok: boolean; saved: number; message?: string }> = [];

  for (const projectId of projectIds) {
    try {
      const result = await estimateProgress(projectId, ym);
      results.push({ projectId, ok: result.ok, saved: result.saved, message: result.message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[cron/daily-estimate] projectId=${projectId} error:`, msg);
      results.push({ projectId, ok: false, saved: 0, message: msg });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    ok: true,
    ym,
    ran: results.length,
    succeeded,
    failed,
    results,
  });
}
