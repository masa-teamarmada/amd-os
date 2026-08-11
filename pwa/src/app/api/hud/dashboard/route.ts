/**
 * GET /api/hud/dashboard
 *
 * `/hud/dashboard` (HudControlCenterDashboard) と同じ集計を server 側で行い JSON で返す。
 * iOS アプリの HUD コックピットがこの endpoint を叩いて、PWA と同一の数値を表示する。
 *
 * - projects / billingStatus / scoreHistory / signalMetrics: 既存 lib の anon read + 純粋計算関数を再利用
 * - managementScore / managementHistory: amd_management_score_snapshots を service_role で read
 * - 認証: AMD member の Supabase JWT (Authorization: Bearer <access_token>) を検証。CRON_SECRET も許可。
 *
 * 注: AAA (架空デモ PJ) は含めない（実機デモで実 PJ のみ見せるため）。
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchActiveAlpha, fetchAllAmdScoreInputs, type AmdScoreInputRow } from "@/lib/amd-score-data";
import {
  buildPrimaryScoreSnapshot,
  computeAmdScoreSeries,
  latestVisibleScorableScoreInput,
  scoreInputToSignalMetrics,
  type AmdSignalMetrics,
} from "@/lib/amd-score-derived";
import {
  fetchBillingStatusFromSupabase,
  fetchProjectsFromSupabase,
} from "@/lib/supabase-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ManagementSnapshot = {
  ym: string | null;
  total_score: number | null;
  initiative_score: number | null;
  finance_score: number | null;
  retention_score: number | null;
  pipeline_score: number | null;
  direction_score: number | null;
  confidence: number | null;
};

type PrimarySnapshot = {
  score: number | null;
  status: "ready" | "missing";
  missingAxes: string[];
  legacyScore: number | null;
  components: {
    macro: number | null;
    potential: number | null;
    reach: number | null;
    survival: number | null;
  };
};

function getCurrentYm(): string {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
}

export async function GET(req: NextRequest) {
  // --- auth: AMD member Bearer JWT or CRON_SECRET ---
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  const admin = createAdminClient();
  let authed = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
  if (!authed && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token) {
      const { data } = await admin.auth.getUser(token);
      const email = data.user?.email?.toLowerCase() ?? null;
      if (email) {
        const { data: member, error: memberError } = await admin
          .from("members")
          .select("member_id")
          .eq("email", email)
          .maybeSingle();
        authed = !memberError && Boolean(member);
      }
    }
  }
  if (!authed) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const ym = getCurrentYm();
    const [projects, billingStatus, scoreBundle, managementHistory] = await Promise.all([
      fetchProjectsFromSupabase(admin),
      fetchBillingStatusFromSupabase(ym, admin),
      buildScoreData(),
      fetchManagementHistory(admin),
    ]);

    return NextResponse.json({
      ok: true,
      ym,
      projects,
      billingStatus,
      scoreHistory: scoreBundle.history,
      signalMetrics: scoreBundle.metrics,
      primarySnapshots: scoreBundle.primary,
      managementScore: managementHistory[managementHistory.length - 1] ?? null,
      managementHistory,
      actionItems: [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// ---- score history + M/X/F signal metrics (実 PJ のみ) ----
async function buildScoreData(): Promise<{
  history: Record<string, number[]>;
  metrics: Record<string, AmdSignalMetrics>;
  primary: Record<string, PrimarySnapshot>;
}> {
  const [inputs, activeAlpha] = await Promise.all([fetchAllAmdScoreInputs(), fetchActiveAlpha()]);
  const grouped: Record<string, AmdScoreInputRow[]> = {};
  for (const row of inputs) {
    (grouped[row.project_id] ||= []).push(row);
  }
  const today = new Date().toISOString().slice(0, 10);
  const visible = (rows: AmdScoreInputRow[]) => rows.filter((r) => r.evaluated_at.slice(0, 10) <= today);

  const history = Object.fromEntries(
    Object.entries(grouped).map(([projectId, rows]) => [
      projectId,
      computeAmdScoreSeries(visible(rows), activeAlpha.alpha).map((p) => p.score),
    ])
  );
  const metrics = Object.fromEntries(
    Object.entries(grouped).flatMap(([projectId, rows]) => {
      const latest = latestVisibleScorableScoreInput(rows);
      if (!latest) return [];
      const metric = scoreInputToSignalMetrics(latest, activeAlpha.alpha);
      return metric ? [[projectId, metric]] : [];
    })
  );
  const primary: Record<string, PrimarySnapshot> = {};
  for (const [projectId, rows] of Object.entries(grouped)) {
    const visibleRows = visible(rows);
    const latest = latestVisibleScorableScoreInput(rows);
    if (!latest) continue;
    const snapshot = buildPrimaryScoreSnapshot(latest, activeAlpha.alpha, { P: null, R_net: null }, visibleRows);
    primary[projectId] = {
      score: snapshot.prs.status === "ready" ? snapshot.prs.score : null,
      status: snapshot.prs.status === "ready" ? "ready" : "missing",
      missingAxes: snapshot.prs.status === "ready" ? [] : snapshot.prs.missingAxes,
      legacyScore: snapshot.legacy.score,
      components: {
        macro: snapshot.prs.components?.macro ?? null,
        potential: snapshot.prs.axisValues.P,
        reach: snapshot.prs.components?.reach ?? null,
        survival: snapshot.prs.components?.survival ?? null,
      },
    };
  }
  return { history, metrics, primary };
}

// ---- AMD Management Score snapshots ----
async function fetchManagementHistory(
  admin: ReturnType<typeof createAdminClient>
): Promise<ManagementSnapshot[]> {
  const { data, error } = await admin
    .from("amd_management_score_snapshots")
    .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,updated_at")
    .order("ym", { ascending: true })
    .order("updated_at", { ascending: true });
  if (error || !data) return [];
  const latestByYm = new Map<string, ManagementSnapshot>();
  for (const row of data) {
    latestByYm.set(String(row.ym ?? ""), normalizeManagement(row));
  }
  return Array.from(latestByYm.values()).filter((r) => r.ym);
}

function normalizeManagement(row: Record<string, unknown>): ManagementSnapshot {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    ym: (row.ym as string) ?? null,
    total_score: num(row.total_score),
    initiative_score: num(row.initiative_score),
    finance_score: num(row.finance_score),
    retention_score: num(row.retention_score),
    pipeline_score: num(row.pipeline_score),
    direction_score: num(row.direction_score),
    confidence: num(row.confidence),
  };
}
