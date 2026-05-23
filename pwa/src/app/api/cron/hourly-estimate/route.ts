/**
 * GET /api/cron/hourly-estimate
 *
 * Vercel Cron: 毎時 0 分発火 (vercel.json schedule: "0 * * * *")。
 * L2 ③ MS進捗の毎時 polling cron (Phase 4)。
 *
 * 仕様正本: pwa/design/ms_progress.md (Phase 4 セクション)
 *
 * 動き:
 *   1. アクティブPJ × {当月, 前月} の組み合わせを target list 化
 *      (前月を含めるのは月跨ぎ直後にレポートが確定するケースを拾うため)
 *   2. progress_estimate_state.last_processed_at 古い順 (NULL = 未処理優先) に sort
 *   3. 各 target で estimateProgress(force=false) を呼ぶ
 *      - source_hash 一致なら LLM 呼ばずスキップ (= unchanged: true)
 *      - MS管理対象(DTSU/ecosystem)かつ対象月のMSがあれば LLM 抽出 + milestone_monthly_progress upsert + state upsert
 *      - MS管理対象外、または対象月を覆うMSがなければ project_monthly_notes に当月ソースを保存
 *   4. LLM call 数が maxItems (default 14) に達したら hasMore=true で打ち切り
 *      → 翌時の cron で残りを処理 (last_processed_at 古い順なので公平に回る)
 *
 * 認証: Authorization: Bearer CRON_SECRET (Vercel が自動で付与)
 *
 * 互換: 旧 cron/daily-estimate (03:00 daily) は削除済。手動再推定は /api/progress/estimate (force=true)。
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { estimateProgress } from "@/lib/progress-estimator";

export const maxDuration = 300; // 5 min (Vercel Pro)

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
  const force = url.searchParams.get("force") === "1";
  const ymOverride = url.searchParams.get("ym") || "";
  const maxItems = Number(url.searchParams.get("maxItems") || 14);

  const baseYm = ymOverride && /^\d{6}$/.test(ymOverride) ? ymOverride : currentYmJST();
  const ymList = ymOverride && /^\d{6}$/.test(ymOverride) ? [ymOverride] : [baseYm, prevYm(baseYm)];

  const supabase = getServiceClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("project_id")
    .eq("status", "active");

  if (error) {
    console.error("[cron/hourly-estimate] failed to fetch projects:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const projectIds = (projects ?? []).map((p: { project_id: string }) => p.project_id);
  if (projectIds.length === 0) {
    return NextResponse.json({ ok: true, ymList, ran: 0, message: "no active projects" });
  }

  type Target = { projectId: string; ym: string; lastProcessedAt: string | null };
  const targets: Target[] = [];
  for (const pid of projectIds) {
    for (const y of ymList) {
      targets.push({ projectId: pid, ym: y, lastProcessedAt: null });
    }
  }

  const { data: stateRows } = await supabase
    .from("progress_estimate_state")
    .select("project_id, ym, last_processed_at")
    .in("project_id", projectIds)
    .in("ym", ymList);

  const stateMap = new Map<string, string>();
  for (const r of stateRows || []) {
    stateMap.set(`${r.project_id}|${r.ym}`, r.last_processed_at);
  }
  for (const t of targets) {
    t.lastProcessedAt = stateMap.get(`${t.projectId}|${t.ym}`) || null;
  }

  targets.sort((a, b) => {
    const av = a.lastProcessedAt ? Date.parse(a.lastProcessedAt) : 0;
    const bv = b.lastProcessedAt ? Date.parse(b.lastProcessedAt) : 0;
    return av - bv;
  });

  type Result = {
    projectId: string;
    ym: string;
    ok: boolean;
    saved: number;
    unchanged?: boolean;
    message?: string;
  };
  const results: Result[] = [];
  let llmCalls = 0;
  let hasMore = false;

  for (const t of targets) {
    if (llmCalls >= maxItems) {
      hasMore = true;
      results.push({ projectId: t.projectId, ym: t.ym, ok: true, saved: 0, message: "deferred_maxItems" });
      continue;
    }
    try {
      const r = await estimateProgress(t.projectId, t.ym, { force });
      if (!r.unchanged) llmCalls++;
      results.push({
        projectId: t.projectId,
        ym: t.ym,
        ok: r.ok,
        saved: r.saved,
        unchanged: r.unchanged,
        message: r.message,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[cron/hourly-estimate] projectId=${t.projectId} ym=${t.ym} error:`, msg);
      results.push({ projectId: t.projectId, ym: t.ym, ok: false, saved: 0, message: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    ymList,
    ran: results.length,
    llmCalls,
    hasMore,
    maxItems,
    succeeded: results.filter((r) => r.ok && !r.unchanged).length,
    unchanged: results.filter((r) => r.unchanged).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
