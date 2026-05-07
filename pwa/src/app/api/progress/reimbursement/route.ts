/**
 * GET /api/progress/reimbursement?projectId=...&ym=...
 * 立替精算一覧を取得する。
 *
 * 旧実装は GAS reimburseForMonth bridge 経由 (数秒遅延 / env 未設定で空)。
 * 今は Supabase の reimbursements テーブルを直接読む (#1 + #4)。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const ym = searchParams.get("ym");

  if (!projectId || !ym) {
    return NextResponse.json({ error: "projectId and ym required" }, { status: 400 });
  }

  if (ym.length !== 6) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const supabase = auth.supabase;
  const startIso = `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const endIso = `${ny}-${String(nm).padStart(2, "0")}-01`;

  const { data } = await supabase
    .from("reimbursements")
    .select("reimbursement_id, member_id, date, description, category, amount, status, pm_approved_at, admin_approved_at")
    .eq("project_id", projectId)
    .gte("date", startIso)
    .lt("date", endIso)
    .order("date", { ascending: false });

  // モーダル側の型 (description, amount, memberName?, date?) に合わせる
  const memberIds = Array.from(new Set((data ?? []).map((r) => r.member_id).filter(Boolean)));
  let memberMap: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("member_id, code_name")
      .in("member_id", memberIds);
    memberMap = Object.fromEntries((members ?? []).map((m: { member_id: string; code_name: string | null }) => [m.member_id, m.code_name || m.member_id]));
  }

  const items = (data ?? []).map((r) => ({
    id: r.reimbursement_id,
    description: r.description,
    amount: r.amount,
    memberName: memberMap[r.member_id] || r.member_id,
    date: r.date,
  }));
  return NextResponse.json({ ok: true, items });
}
