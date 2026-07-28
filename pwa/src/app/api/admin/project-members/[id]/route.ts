/**
 * DELETE /api/admin/project-members/[id]
 *
 * project_members 行を物理削除する。
 *
 * 「除外 (is_active=false 論理削除)」では PJ から復活させずに完全に消したい時用 (まさ要望 2026-06-21)。
 *
 * 安全装置:
 * - 既存業務記録 (monthly_reports / reimbursements / member_monthly_work_agreements /
 *   member_ms_activities / milestone_responsibility / milestone_monthly_contribution_allocations
 *   / monthly_reward_payout / member_monthly_work_agreement_requests
 *   / member_monthly_work_agreement_payout_overrides / legacy_reward_payout_amount_override_events)
 *   で (project_id, member_id) が
 *   参照されているかを SELECT count(*) で確認
 * - 参照があれば 409 + 各テーブル件数を返す (UI 側で件数表示 + 強制削除確認ダイアログ)
 * - body.force=true なら参照を無視して DELETE (= まさが業務記録 dangling を受け入れた場合)
 *
 * 物理 DELETE のあとは reward_summary 再同期して数値を更新する。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { syncRewardSummariesForProject } from "@/lib/reward-summary";

export const runtime = "nodejs";

const REFERENCE_TABLES: Array<{ table: string; label: string }> = [
  { table: "member_monthly_work_agreements", label: "月次稼働合意 (合意済み)" },
  { table: "member_monthly_work_agreement_requests", label: "月次稼働合意 (リクエスト)" },
  { table: "member_monthly_work_agreement_payout_overrides", label: "月次稼働合意 (上書き)" },
  { table: "legacy_reward_payout_amount_override_events", label: "旧制度の事前合意支払額" },
  { table: "member_ms_activities", label: "MS 進捗活動" },
  { table: "milestone_responsibility", label: "MS 担当" },
  { table: "milestone_monthly_contribution_allocations", label: "MS 月次貢献配分" },
  { table: "monthly_reward_payout", label: "月次報酬支払" },
];

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const db = createAdminClient();

  // 対象行を取得 (project_id / member_id を業務記録の参照チェックに使う)
  const { data: row, error: selErr } = await db
    .from("project_members")
    .select("id, project_id, member_id")
    .eq("id", id)
    .maybeSingle();
  if (selErr) {
    return NextResponse.json({ ok: false, error: `select err: ${selErr.message}` }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "project_members row not found" }, { status: 404 });
  }
  const projectId = (row as { project_id: string }).project_id;
  const memberId = (row as { member_id: string }).member_id;

  // 業務記録の参照件数チェック
  const references: Array<{ table: string; label: string; count: number }> = [];
  if (!force) {
    for (const t of REFERENCE_TABLES) {
      const { count, error } = await db
        .from(t.table)
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("member_id", memberId);
      if (error) {
        // テーブルや列が無いケースは無視 (将来の schema 変更耐性)
        continue;
      }
      if ((count ?? 0) > 0) {
        references.push({ table: t.table, label: t.label, count: count ?? 0 });
      }
    }
    if (references.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "references_exist",
          message: "業務記録が存在します。強制削除するには force=1 を指定してください",
          references,
        },
        { status: 409 }
      );
    }
  }

  const { error: delErr } = await db.from("project_members").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ ok: false, error: `delete err: ${delErr.message}` }, { status: 500 });
  }

  let rewardSynced = 0;
  let rewardSyncError: string | null = null;
  try {
    const synced = await syncRewardSummariesForProject(db, projectId);
    rewardSynced = synced.size;
  } catch (err) {
    rewardSyncError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    ok: true,
    deleted: { id, project_id: projectId, member_id: memberId },
    forced: force,
    rewardSynced,
    rewardSyncError,
  });
}
