/**
 * POST /api/admin/project-members/bulk
 * body: {
 *   projectId: string,
 *   members: Array<{
 *     memberId: string;
 *     isPM: boolean; isCloser: boolean; isPL: boolean;
 *     roleLabel: string; joinYm: string; leaveYm: string; isActive: boolean;
 *   }>
 * }
 *
 * 該当 PJ のメンバー一覧を一括で incremental update する。
 * - members に含まれる + 行が既存 → UPDATE 全フィールド
 * - members に含まれる + 行が無い → INSERT
 * - members に含まれない + 行が既存 (is_active=true) → UPDATE is_active=false (論理削除)
 *
 * 設計意図 (2026-05-13 → 2026-06-21 更新):
 * - 旧 saveProjectMembers の「全削除→挿入」事故 (2026-05-08) を再発させない
 * - bulk では物理 DELETE しない (= 安全側、過去の業務記録への影響を避ける)
 * - メンバーを根本削除したい場合は DELETE /api/admin/project-members/[id] を使う (= 行ごとに
 *   業務記録の参照件数を返してユーザ確認を取る安全装置つき)
 * - 上記の挙動を admin/projects のメンバー列モーダル と project/[id]/config の
 *   両方から共有して使う (どちらも同じ ProjectMembersEditor が叩く)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { syncRewardSummariesForProject } from "@/lib/reward-summary";

interface MemberInput {
  memberId: string;
  isPM: boolean;
  isCloser: boolean;
  isPL: boolean;
  roleLabel: string;
  joinYm: string;
  leaveYm: string;
  isActive: boolean;
}

function normalizeYm(value: string): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (!/^\d{6}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { projectId?: string; members?: MemberInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid JSON" }, { status: 400 });
  }
  const { projectId, members } = body;
  if (!projectId || !Array.isArray(members)) {
    return NextResponse.json(
      { ok: false, message: "projectId, members required" },
      { status: 400 }
    );
  }

  // memberId 重複は弾く (UI 側で防ぐが、API でも保護)
  const seen = new Set<string>();
  for (const m of members) {
    const id = (m.memberId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, message: "memberId required for each row" }, { status: 400 });
    }
    if (seen.has(id)) {
      return NextResponse.json({ ok: false, message: `memberId duplicated: ${id}` }, { status: 400 });
    }
    seen.add(id);
  }

  const supabase = createAdminClient();

  // 既存 project_members を全取得 (active / inactive 問わず)
  const { data: existingRows, error: selErr } = await supabase
    .from("project_members")
    .select("id, member_id, is_pl, is_pm, is_closer, role_label, join_ym, leave_ym, is_active")
    .eq("project_id", projectId);
  if (selErr) {
    return NextResponse.json({ ok: false, message: selErr.message }, { status: 500 });
  }

  const existingByMember = new Map<string, { id: string }>();
  for (const row of existingRows ?? []) {
    existingByMember.set(row.member_id, { id: row.id });
  }

  const desiredIds = new Set(members.map((m) => m.memberId.trim()));

  // 1. INSERT 対象 (desired にあり、既存行なし)
  const toInsert: Array<Record<string, unknown>> = [];
  // 2. UPDATE 対象 (desired にあり、既存行あり) — 全フィールド上書き
  const toUpdate: Array<{ id: string; patch: Record<string, unknown> }> = [];
  for (const m of members) {
    const memberId = m.memberId.trim();
    const patch: Record<string, unknown> = {
      is_pl: !!m.isPL,
      is_pm: !!m.isPM,
      is_closer: !!m.isCloser,
      role_label: (m.roleLabel || "").trim() || null,
      join_ym: normalizeYm(m.joinYm),
      leave_ym: normalizeYm(m.leaveYm),
      is_active: m.isActive !== false,
    };
    const existing = existingByMember.get(memberId);
    if (existing) {
      toUpdate.push({ id: existing.id, patch });
    } else {
      toInsert.push({
        project_id: projectId,
        member_id: memberId,
        ...patch,
      });
    }
  }

  // 3. 論理削除対象 (既存行あり、desired に無し、かつ is_active=true)
  const toDeactivate: string[] = [];
  for (const row of existingRows ?? []) {
    if (!desiredIds.has(row.member_id) && row.is_active !== false) {
      toDeactivate.push(row.id);
    }
  }

  // 順番: UPDATE → INSERT → 論理削除 (順序に依存はないが、慣例的にこの順)
  for (const u of toUpdate) {
    const { error } = await supabase
      .from("project_members")
      .update(u.patch)
      .eq("id", u.id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from("project_members").insert(toInsert);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  if (toDeactivate.length > 0) {
    const { error } = await supabase
      .from("project_members")
      .update({ is_active: false })
      .in("id", toDeactivate);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  let rewardSynced = 0;
  let rewardSyncError: string | null = null;
  if (toUpdate.length + toInsert.length + toDeactivate.length > 0) {
    try {
      const synced = await syncRewardSummariesForProject(supabase, projectId);
      rewardSynced = synced.size;
    } catch (err) {
      rewardSyncError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    ok: true,
    updated: toUpdate.length,
    inserted: toInsert.length,
    deactivated: toDeactivate.length,
    rewardSynced,
    rewardSyncError,
  });
}
