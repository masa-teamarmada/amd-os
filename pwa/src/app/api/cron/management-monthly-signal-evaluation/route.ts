/**
 * GET /api/cron/management-monthly-signal-evaluation
 *
 * L2⑯ Management Monthly Signal Evaluation.
 * Management Score snapshot / evidence / 予実表から、数字再掲ではない月末経営評価文を生成する。
 *
 * 認証: Authorization: Bearer CRON_SECRET
 * - ?dryRun=1: DB writeせず評価payloadだけ返す
 * - ?ym=YYYYMM: 対象月指定
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildManagementMonthlySignalEvaluation,
  type ManagementSignalBudgetInput,
  type ManagementSignalEvidenceInput,
  type ManagementSignalScoreInput,
} from "@/lib/management-score/monthly-signal";

export const maxDuration = 60;

function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function queryOne<T>(query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "query failed");
  return data?.[0] ?? null;
}

async function queryMany<T>(query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "query failed");
  return data ?? [];
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const ym = req.nextUrl.searchParams.get("ym") || currentYmJST();
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1" || req.nextUrl.searchParams.get("dryRun") === "true";
  const supabase = createAdminClient();

  try {
    const score = await queryOne<Record<string, unknown>>(
      supabase
        .from("amd_management_score_snapshots")
        .select("id,ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,summary")
        .eq("ym", ym)
        .limit(1)
    );
    if (!score) {
      return NextResponse.json({ ok: false, error: `management score snapshot not found for ${ym}` }, { status: 404 });
    }

    const previousScore = await queryOne<Record<string, unknown>>(
      supabase
        .from("amd_management_score_snapshots")
        .select("id,ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,summary")
        .lt("ym", ym)
        .order("ym", { ascending: false })
        .limit(1)
    );

    const [evidenceRows, budgetRows, varianceNotes, latestVersionRow] = await Promise.all([
      queryMany<Record<string, unknown>>(
        supabase
          .from("amd_management_score_evidence")
          .select("id,axis,summary,impact,confidence,source_type,source_ref")
          .eq("snapshot_id", String(score.id))
          .limit(100)
      ),
      queryMany<Record<string, unknown>>(
        supabase
          .from("company_budget_actual_monthly")
          .select("ym,category,budget_amount_yen,actual_amount_yen,variance_yen,cash_amount_yen,runway_months")
          .eq("ym", ym)
          .eq("scope", "company")
          .limit(200)
      ),
      queryMany<{ id: string; note: string | null; category: string | null }>(
        supabase
          .from("company_budget_variance_notes")
          .select("id,note,category")
          .eq("ym", ym)
          .limit(20)
      ),
      queryOne<{ version: number }>(
        supabase
          .from("amd_management_monthly_signal_evaluations")
          .select("version")
          .eq("ym", ym)
          .order("version", { ascending: false })
          .limit(1)
      ).catch(() => null),
    ]);

    const runway = budgetRows.map((row) => Number(row.runway_months)).find((value) => Number.isFinite(value));
    const financeAlerts = [
      runway != null && runway < 2 ? "runwayが短く、cashの先読みを先に締めたい。" : null,
      Number(score.finance_score) < 45 ? "財務耐久が弱く、入金予定と支出予定の確認が必要。" : null,
      Number(score.pipeline_score) < 45 ? "新規案件の厚みが薄く、翌月の安心材料を増やしたい。" : null,
    ].filter((item): item is string => Boolean(item));

    const evaluation = buildManagementMonthlySignalEvaluation({
      ym,
      score: score as ManagementSignalScoreInput,
      previousScore: previousScore as ManagementSignalScoreInput | null,
      evidenceRows: evidenceRows as ManagementSignalEvidenceInput[],
      budgetRows: budgetRows as ManagementSignalBudgetInput[],
      varianceNotes,
      financeAlerts,
      version: (latestVersionRow?.version ?? 0) + 1,
    });

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, evaluation });
    }

    const nowIso = new Date().toISOString();
    const { error: closeError } = await supabase
      .from("amd_management_monthly_signal_evaluations")
      .update({ is_current: false, superseded_at: nowIso, updated_at: nowIso })
      .eq("ym", ym)
      .eq("is_current", true);
    if (closeError) throw new Error(closeError.message);

    const { data: inserted, error: insertError } = await supabase
      .from("amd_management_monthly_signal_evaluations")
      .insert({
        ym: evaluation.ym,
        version: evaluation.version,
        status: evaluation.status,
        icon: evaluation.icon,
        label: evaluation.label,
        headline: evaluation.headline,
        reason_items_json: evaluation.reasons,
        next_watch_json: evaluation.next_watch,
        source_refs_json: evaluation.source_refs_json,
        payload_json: evaluation.payload_json,
        is_current: true,
        created_by: "management_monthly_signal_cron_v1_non_llm",
      })
      .select("id,ym,version,status,icon,label,headline,created_at")
      .single();
    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({ ok: true, dryRun: false, evaluation: inserted });
  } catch (error) {
    console.error("[cron/management-monthly-signal-evaluation]", error);
    return NextResponse.json({ ok: false, error: toError(error) }, { status: 500 });
  }
}
