/**
 * POST /api/admin/project-members/role
 * body: { projectId: string, role: 'pl'|'pm'|'closer', memberIds: string[] }
 *
 * 該当 PJ × 該当ロールの集合だけを incremental 更新する。
 * - 集合に含まれる + 行が既存 → is_<role>=true に UPDATE
 * - 集合に含まれない + 行が is_<role>=true → is_<role>=false に UPDATE (行は残す)
 * - 集合に含まれる + 行が無い → 新規行 INSERT (is_<role>=true、他フラグ false、is_active=true)
 *
 * 設計意図 (2026-05-08):
 * - 旧 /api/admin/project-members は「全削除→挿入」方式で、role / id / role_label /
 *   join_ym などを副作用で破壊していた。再発防止のため、フラグ単位の incremental に分離。
 * - 他のフラグ・他のメンバー行・他の列は一切触らない。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

type Role = "pl" | "pm" | "closer";

const ROLE_FLAG: Record<Role, "is_pl" | "is_pm" | "is_closer"> = {
  pl: "is_pl",
  pm: "is_pm",
  closer: "is_closer",
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { projectId?: string; role?: string; memberIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid JSON" }, { status: 400 });
  }
  const { projectId, role, memberIds } = body;
  if (!projectId || !role || !Array.isArray(memberIds)) {
    return NextResponse.json(
      { ok: false, message: "projectId, role, memberIds required" },
      { status: 400 }
    );
  }
  if (role !== "pl" && role !== "pm" && role !== "closer") {
    return NextResponse.json({ ok: false, message: "role must be pl|pm|closer" }, { status: 400 });
  }
  const flagCol = ROLE_FLAG[role as Role];
  const desired = new Set(memberIds.map((m) => m.trim()).filter(Boolean));

  const supabase = createAdminClient();

  const { data: existing, error: selErr } = await supabase
    .from("project_members")
    .select("id, member_id, is_pl, is_pm, is_closer")
    .eq("project_id", projectId);
  if (selErr) {
    return NextResponse.json({ ok: false, message: selErr.message }, { status: 500 });
  }

  const existingByMember = new Map<string, { id: string; flag: boolean }>();
  for (const row of existing ?? []) {
    existingByMember.set(row.member_id, {
      id: row.id,
      flag: !!row[flagCol as "is_pl" | "is_pm" | "is_closer"],
    });
  }

  const toAddFlag: string[] = []; // 既存行で flag を true にする (id 列リスト)
  const toRemoveFlag: string[] = []; // 既存行で flag を false にする (id 列リスト)
  const toInsert: string[] = []; // project_members に行が無い memberId

  for (const memberId of desired) {
    const row = existingByMember.get(memberId);
    if (!row) {
      toInsert.push(memberId);
    } else if (!row.flag) {
      toAddFlag.push(row.id);
    }
  }
  for (const [memberId, row] of existingByMember) {
    if (row.flag && !desired.has(memberId)) {
      toRemoveFlag.push(row.id);
    }
  }

  // 1. 既存行を flag=true に
  if (toAddFlag.length > 0) {
    const { error } = await supabase
      .from("project_members")
      .update({ [flagCol]: true })
      .in("id", toAddFlag);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  // 2. 既存行を flag=false に
  if (toRemoveFlag.length > 0) {
    const { error } = await supabase
      .from("project_members")
      .update({ [flagCol]: false })
      .in("id", toRemoveFlag);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  // 3. 新規 insert
  if (toInsert.length > 0) {
    const rows = toInsert.map((memberId) => ({
      project_id: projectId,
      member_id: memberId,
      is_pl: role === "pl",
      is_pm: role === "pm",
      is_closer: role === "closer",
      is_active: true,
    }));
    const { error } = await supabase.from("project_members").insert(rows);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    role,
    added: toAddFlag.length,
    removed: toRemoveFlag.length,
    inserted: toInsert.length,
  });
}
