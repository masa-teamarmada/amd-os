/**
 * GET /api/cron/ms-schedule-progress
 *
 * D-2 MS進捗の非LLM daily cron。
 *
 * アクティブPJ × {当月, 前月} に対して applyScheduleDefaultsForProject を実行し、
 * スケジュール按分のデフォルト累積進捗 (source='routine_auto') を最新化する。
 *   - PM確定行 (PM_LOCKED_PROGRESS_SOURCES) は触らない
 *   - confirmed な ms_progress_revisions は tsukuyomi_revision として再適用 (修復)
 *   - 開始前MSの非確定値は 0% に補正
 *   - 進捗が変わった PJ は reward_summary_json を再同期
 *
 * LLM を一切呼ばないため ALLOW_PWA_LLM_CRONS に依存せず毎日動く。
 * LLM 乖離検知 (revision 提案) は estimateProgress (手動再推定 / report/generate 直後) 側。
 *
 * 認証: Authorization: Bearer CRON_SECRET
 * 仕様正本: pwa/spec/3-10-l2-ms-progress-current-spec.md
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyScheduleDefaultsForProject } from "@/lib/progress-estimator";

export const maxDuration = 300; // 5 min (Vercel Pro)
export const dynamic = "force-dynamic";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder"
  );
}

function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function prevYm(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const pm = m - 1 < 1 ? 12 : m - 1;
  const py = m - 1 < 1 ? y - 1 : y;
  return `${py}${String(pm).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const ymOverride = url.searchParams.get("ym") || "";
  const projectOverride = url.searchParams.get("projectId") || "";

  const baseYm = ymOverride && /^\d{6}$/.test(ymOverride) ? ymOverride : currentYmJST();
  const ymList = ymOverride && /^\d{6}$/.test(ymOverride) ? [ymOverride] : [baseYm, prevYm(baseYm)];

  const supabase = getServiceClient();
  let projectIds: string[];
  if (projectOverride) {
    projectIds = [projectOverride];
  } else {
    const { data: projects, error } = await supabase
      .from("projects")
      .select("project_id")
      .eq("status", "active");
    if (error) {
      console.error("[cron/ms-schedule-progress] failed to fetch projects:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    projectIds = (projects ?? []).map((p: { project_id: string }) => p.project_id);
  }

  if (projectIds.length === 0) {
    return NextResponse.json({ ok: true, ymList, ran: 0, message: "no active projects" });
  }

  type Result = {
    projectId: string;
    ym: string;
    ok: boolean;
    saved: number;
    skipped: number;
    message?: string;
  };
  const results: Result[] = [];

  for (const projectId of projectIds) {
    for (const ym of ymList) {
      try {
        const r = await applyScheduleDefaultsForProject(projectId, ym);
        results.push({ projectId, ym, ok: r.ok, saved: r.saved, skipped: r.skipped, message: r.message });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown error";
        console.error(`[cron/ms-schedule-progress] projectId=${projectId} ym=${ym} error:`, msg);
        results.push({ projectId, ym, ok: false, saved: 0, skipped: 0, message: msg });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ymList,
    ran: results.length,
    savedTotal: results.reduce((sum, r) => sum + r.saved, 0),
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
