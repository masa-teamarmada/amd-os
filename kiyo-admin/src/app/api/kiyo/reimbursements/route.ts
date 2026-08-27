/**
 * 「立替精算」— 一覧を読むだけ。
 *
 * reimbursements テーブルをそのまま読む（本体 pwa の /reimburse 画面と同じ列）。
 * 金額は申請者が入力した実費で、ここで計算するものは何も無い。
 * 承認は /api/kiyo/reimbursements/decision（本体へ中継）で行う。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

/** 本体 /reimburse と同じ選択列。増やすときは本体に合わせる。 */
const REIMBURSEMENT_COLUMNS =
  "reimbursement_id, project_id, project_name, date, description, category, amount, tax_rate, status, created_by, pm_approved_by, pm_approved_at, admin_approved_by, admin_approved_at, transport_mode, transport_from, transport_to, transport_trip, receipt_storage_paths, receipt_file_names";

type ReimbursementRow = {
  reimbursement_id: string;
  project_id: string | null;
  project_name: string | null;
  date: string | null;
  description: string | null;
  category: string | null;
  amount: number | string | null;
  tax_rate: number | string | null;
  status: string | null;
  created_by: string | null;
  pm_approved_by: string | null;
  pm_approved_at: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
};

type MemberRow = {
  member_id: string;
  email: string | null;
  code_name: string | null;
  member_name: string | null;
};

function numberValue(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const statusFilter = (req.nextUrl.searchParams.get("status") ?? "").trim();

  try {
    const db = createAdminClient();
    const [rowsRes, membersRes] = await Promise.all([
      db.from("reimbursements").select(REIMBURSEMENT_COLUMNS).order("date", { ascending: false }).limit(400),
      db.from("members").select("member_id, email, code_name, member_name"),
    ]);
    if (rowsRes.error) throw rowsRes.error;
    if (membersRes.error) throw membersRes.error;

    const nameByEmail = new Map<string, string>();
    for (const member of (membersRes.data ?? []) as MemberRow[]) {
      const email = (member.email ?? "").toLowerCase();
      if (!email) continue;
      nameByEmail.set(email, member.member_name || member.code_name || email);
    }
    const displayName = (email: string | null) =>
      email ? (nameByEmail.get(email.toLowerCase()) ?? email) : null;

    const all = ((rowsRes.data ?? []) as unknown as ReimbursementRow[]).map((row) => ({
      reimbursementId: row.reimbursement_id,
      projectId: row.project_id,
      projectName: row.project_name,
      date: row.date,
      description: row.description,
      category: row.category,
      amountYen: numberValue(row.amount),
      taxRate: numberValue(row.tax_rate),
      status: row.status ?? "unknown",
      applicant: displayName(row.created_by),
      pmApprovedBy: displayName(row.pm_approved_by),
      pmApprovedAt: row.pm_approved_at,
      adminApprovedBy: displayName(row.admin_approved_by),
      adminApprovedAt: row.admin_approved_at,
    }));

    const rows = statusFilter ? all.filter((row) => row.status === statusFilter) : all;

    const countByStatus: Record<string, number> = {};
    for (const row of all) {
      countByStatus[row.status] = (countByStatus[row.status] ?? 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      rows,
      summary: {
        total: all.length,
        shown: rows.length,
        countByStatus,
        // 表示中のぶんの合計。申請された実費をそのまま足しているだけ。
        shownAmountYen: rows.reduce((sum, row) => sum + row.amountYen, 0),
      },
    });
  } catch (err) {
    console.error("[kiyo reimbursements GET]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
